// ============================================================
//  feed/feedPipeline.js
//
//  The main feed pipeline. Replaces getPostsPage() in PostModel.
//
//  Pipeline stages:
//    1. FETCH     — pull a large candidate pool from DB,
//                   excluding already-seen post IDs so the
//                   same post never appears on two pages
//    2. HYDRATE   — add likes / comments / reposts / views
//                   (now also builds recentComments for followed users)
//    3. ENRICH    — attach topics, seen set, engagement map,
//                   topic score map, negative signals,
//                   content‑type preferences
//    4. SCORE     — compute finalScore per post (includes
//                   similarity, collaborative filtering,
//                   and content‑type boost)
//    5. SORT      — sort by finalScore DESC
//    6. DIVERSITY — enforce author cap + topic-streak limits
//    7. EXPLORE   — inject exploration posts at fixed slots
//    8. PAGE      — slice to requested page size
//    9. MARK SEEN — write served post IDs to post_views so
//                   they are excluded from future pages
//   10. CLEAN     — strip internal fields before returning
// ============================================================

const { db }                          = require('../config/db');
const PostModel                       = require('../models/postModel');
const UserModel                       = require('../models/UserModel');
const TopicPreferenceModel            = require('../models/topicPreferenceModel');
const NegativeSignalModel             = require('../models/negativeSignalModel');
const ContentTypePreference           = require('../models/contentTypePreferenceModel');
const { getDmAffinity }               = require('../models/dmAffinityModel');
const { computeScore, generateReasons } = require('./feedScorer');
const { applyDiversity }              = require('./feedDiversity');
const { fetchExplorationPosts,
        injectExplorationPosts }       = require('./feedExploration');
const C                               = require('../config/constants');

// ── Stage helpers ──────────────────────────────────────────

/** Bulk-fetch topics for a list of post IDs → { [postId]: string[] } */
async function fetchTopicsForPosts(postIds) {
  if (!postIds.length) return {};
  const ph = postIds.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT post_id, topic FROM post_topics WHERE post_id IN (${ph})`,
    postIds
  );
  const map = {};
  postIds.forEach(id => { map[id] = []; });
  rows.forEach(r => map[r.post_id]?.push(r.topic));
  return map;
}

/**
 * Fetch mention data for a viewer on a set of posts
 * Returns a Set of post IDs where the viewer is mentioned
 */
async function fetchMentionedPostIds(viewerUserId, postIds) {
  if (!viewerUserId || !postIds.length) return new Set();
  
  const ph = postIds.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT DISTINCT post_id FROM mentions 
     WHERE mentioned_user_id = ? AND post_id IN (${ph})`,
    [viewerUserId, ...postIds]
  );
  return new Set(rows.map(r => r.post_id));
}

/**
 * Write served post IDs to post_views so they are excluded
 * from future pages for this viewer.
 * Uses INSERT IGNORE so re-serving a post (e.g. after a bug)
 * never throws a duplicate-key error.
 */
async function markPostsAsSeen(viewerUserId, postIds) {
  if (!viewerUserId || !postIds.length) return;
  const values = postIds.map(id => [id, String(viewerUserId)]);
  await db.query(
    'INSERT IGNORE INTO post_views (post_id, viewer_key) VALUES ?',
    [values]
  );
}

// ── Main pipeline ──────────────────────────────────────────

/**
 * Fetch, score, and return one page of personalised feed posts.
 *
 * @param {number|null} viewerUserId   - authenticated user, or null for guest
 * @param {'global'|'following'} feedMode
 * @param {number}      page           - 1-based page number (used only for
 *                                       guests who have no seen-post state)
 * @param {number}      limit          - page size (default from constants)
 * @param {string|null} mediaFilter    - 'video' | null
 *
 * @returns {{ posts: Object[], hasMore: boolean, page: number, limit: number }}
 */
async function getPostsPage(
  viewerUserId,
  feedMode     = 'global',
  page         = 1,
  limit        = C.FEED_PAGE_SIZE,
  mediaFilter  = null,
) {
  const LIMIT     = limit;
  const POOL_SIZE = LIMIT * C.FEED_CANDIDATE_MULTIPLIER;

  // ── Stage 1: Fetch ─────────────────────────────────────
  const followingIds = await PostModel.getFollowingIds(viewerUserId);
  const seenPostIds = await PostModel.getSeenPostIds(
    viewerUserId ? String(viewerUserId) : null
  );

  let conditions = [];
  let whereParams = [];

  // ── Following / global filter ────────────────────────────
  if (feedMode === 'following' && viewerUserId) {
    if (!followingIds.length) return { posts: [], hasMore: false, page, limit };
    
    const followedIds = followingIds.map(() => '?').join(',');
    
    // ⬅️ ONLY show reposts from users the viewer follows
    // Get repost post IDs from followed users only
    const [repostIds] = await db.query(
      `SELECT DISTINCT r.repost_post_id 
       FROM reposts r
       JOIN posts p ON p.id = r.repost_post_id
       WHERE r.user_id IN (${followedIds})
         AND p.is_repost = 1`,
      followingIds
    );
    const repostPostIds = repostIds.map(r => r.repost_post_id);
    
    // Build query: posts from followed users OR reposts by followed users ONLY
    if (repostPostIds.length) {
      const repostPh = repostPostIds.map(() => '?').join(',');
      conditions.push(`(p.user_id IN (${followedIds}) OR p.id IN (${repostPh}))`);
      whereParams.push(...followingIds, ...repostPostIds);
    } else {
      const ph = followingIds.map(() => '?').join(',');
      conditions.push(`p.user_id IN (${ph})`);
      whereParams.push(...followingIds);
    }
  } else if (feedMode === 'global' && viewerUserId && followingIds.length) {
    // Global mode: Show reposts from followed users only
    const ph = followingIds.map(() => '?').join(',');
    // ⬅️ Only include reposts from followed users, not from anyone
    conditions.push(`(p.user_id = ? OR p.user_id IN (${ph}) OR (p.is_repost = 1 AND p.user_id IN (${ph})))`);
    whereParams.push(viewerUserId, ...followingIds, ...followingIds);
  } else if (feedMode === 'global' && viewerUserId) {
    // No following users - show normal posts only (no reposts from strangers)
    conditions.push(`p.user_id = ? AND p.is_repost = 0`);
    whereParams.push(viewerUserId);
  }

  // ── Media filter ─────────────────────────────────────────
  if (mediaFilter === 'video') {
    conditions.push(`p.video IS NOT NULL AND p.video != ''`);
  }

  // ── Seen-exclusion cursor ──────────────────────────────
  let guestOffset = 0;
  if (viewerUserId && seenPostIds.size) {
    const seenPh = [...seenPostIds].map(() => '?').join(',');
    conditions.push(`p.id NOT IN (${seenPh})`);
    whereParams.push(...seenPostIds);
  } else if (!viewerUserId) {
    guestOffset = (page - 1) * LIMIT;
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  // ── SQL query with author attributes ─────────────────────
  const [rawPosts] = await db.query(
    `SELECT
       p.id,
       p.user_id          AS userId,
       u.name             AS author,
       u.username         AS authorUsername,
       u.picture          AS authorPicture,
       u.verified         AS authorVerified,
       u.location         AS authorLocation,
       u.school           AS authorSchool,
       u.occupation       AS authorOccupation,
       u.gender           AS authorGender,
       u.date_of_birth    AS authorDateOfBirth,
       p.text,
       p.image,
       p.video,
       p.is_repost        AS isRepost,
       p.original_post_id AS originalPostId,
       p.group_id         AS groupId,
       p.created_at       AS createdAt
     FROM posts p
     JOIN users u ON u.id = p.user_id
     ${whereClause}
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`,
    [...whereParams, POOL_SIZE + 1, guestOffset]
  );

  const poolHasMore = rawPosts.length > POOL_SIZE;
  const candidates  = rawPosts.slice(0, POOL_SIZE);
  if (!candidates.length) return { posts: [], hasMore: false, page, limit };

  // ── Stage 2: Hydrate ───────────────────────────────────
  // Pass followingIds and request recentComments only (not full tree)
  const hydrated = await PostModel.hydratePosts(candidates, {
    followingIds: followingIds,
    includeFullComments: false,
  });

  // ── Stage 3: Enrich (BATCHED) ──────────────────────────
  const postIds = hydrated.map(p => p.id);
  const authorIds = [...new Set(candidates.map(p => p.userId))];

  const [
    topicsByPost,
    engagementMap,
    topicScoreMap,
    negativeMap,
    mentionedPostIds,
    viewerAttributes,
    viewerEngagedPostsResult,
    contentTypeBoost,
    dmAffinity,
    mutualFollowsArray,
    userGroupsArray,
    sessionPostsArray,
  ] = await Promise.all([
    fetchTopicsForPosts(postIds),
    PostModel.getEngagementMap(viewerUserId),
    TopicPreferenceModel.getTopicScoreMap(viewerUserId),
    NegativeSignalModel.getNegativeSignalMap(viewerUserId, postIds),
    fetchMentionedPostIds(viewerUserId, postIds),
    
    viewerUserId ? UserModel.findById(viewerUserId) : Promise.resolve({}),
    
    viewerUserId ? db.query(
      `(SELECT post_id FROM likes WHERE user_id = ?)
       UNION
       (SELECT post_id FROM comments WHERE user_id = ?)
       UNION
       (SELECT original_post_id AS post_id FROM reposts WHERE user_id = ?)
       LIMIT ?`,
      [viewerUserId, viewerUserId, viewerUserId, C.MAX_ENGAGED_POSTS]
    ) : Promise.resolve([[]]),
    
    viewerUserId ? ContentTypePreference.getContentTypeBoost(viewerUserId) : Promise.resolve({ text: 0.5, image: 0.5, video: 0.5 }),
    
    viewerUserId ? getDmAffinity(viewerUserId) : Promise.resolve(null),
    
    viewerUserId ? db.query(
      `SELECT follower_id FROM follows 
       WHERE follower_id IN (${authorIds.map(() => '?').join(',')}) 
       AND following_id = ?`,
      [...authorIds, viewerUserId]
    ) : Promise.resolve([[]]),
    
    viewerUserId ? db.query(
      `SELECT group_id FROM group_members WHERE user_id = ?`,
      [viewerUserId]
    ) : Promise.resolve([[]]),
    
    viewerUserId ? db.query(
      `SELECT post_id FROM likes WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`,
      [viewerUserId]
    ) : Promise.resolve([[]]),
  ]);

  // Process results
  hydrated.forEach(p => { p._topics = topicsByPost[p.id] || []; });

  const viewerEngagedPosts = new Set((viewerEngagedPostsResult[0] || []).map(r => r.post_id));
  const mutualFollows = new Set((mutualFollowsArray[0] || []).map(r => r.follower_id));
  const userGroups = new Set((userGroupsArray[0] || []).map(r => r.group_id));

  let sessionPosts = [];
  const sessionPostIds = (sessionPostsArray[0] || []).map(r => r.post_id);
  if (sessionPostIds.length) {
    const ph = sessionPostIds.map(() => '?').join(',');
    const [postRows] = await db.query(
      `SELECT id, user_id, text FROM posts WHERE id IN (${ph})`,
      sessionPostIds
    );
    // Fetch topics for session posts
    if (postRows.length) {
      const sessionPostIds2 = postRows.map(p => p.id);
      const topicsForSession = await fetchTopicsForPosts(sessionPostIds2);
      postRows.forEach(p => { p._topics = topicsForSession[p.id] || []; });
    }
    sessionPosts = postRows;
  }

  // Fetch post similarities (depends on viewerEngagedPosts)
  let postSimilarityMap = {};
  if (postIds.length && viewerEngagedPosts.size) {
    const ph = postIds.map(() => '?').join(',');
    const [simRows] = await db.query(
      `SELECT post_id, similar_post_id, score
       FROM post_similarities
       WHERE post_id IN (${ph})
         AND similar_post_id IN (${[...viewerEngagedPosts].map(() => '?').join(',')})`,
      [...postIds, ...viewerEngagedPosts]
    );
    simRows.forEach(({ post_id, similar_post_id, score }) => {
      if (!postSimilarityMap[post_id]) postSimilarityMap[post_id] = [];
      postSimilarityMap[post_id].push({ post_id: similar_post_id, score });
    });
  }

  // ── Stage 4: Score ─────────────────────────────────────
  const followingSet = new Set(followingIds);
  const scoringContext = {
    viewerUserId,
    followingIds: followingSet,
    engagementMap,
    topicScoreMap,
    seenPostIds,
    negativeMap,
    viewerAttributes,
    viewerEngagedPosts,
    postSimilarityMap,
    contentTypeBoost,
    dmAffinity,
    mutualFollows,
    userGroups,
    sessionPosts,
    mentionedPostIds,
  };

  hydrated.forEach(p => {
    p._score = computeScore(p, scoringContext);
    p._reasons = generateReasons(p, scoringContext);
  });

  // ── Stage 5: Sort ──────────────────────────────────────
  hydrated.sort((a, b) => b._score - a._score);

  // ── Stage 6: Diversity ─────────────────────────────────
  const diversified = applyDiversity(hydrated);

  // ── Stage 7: Slice to page ─────────────────────────────
  const personalisedSlice = diversified.slice(0, LIMIT);
  const explorationNeeded = Math.floor(LIMIT / C.EXPLORE_EVERY_N);

  // ── Stage 8: Exploration ───────────────────────────────
  let finalPosts = personalisedSlice;
  if (viewerUserId && feedMode === 'global' && explorationNeeded > 0) {
    const excludeIds = new Set([
      ...diversified.map(p => p.id),
      ...seenPostIds,
    ]);
    const explorationPosts = await fetchExplorationPosts(
      viewerUserId,
      followingIds,
      excludeIds,
      explorationNeeded,
    );
    finalPosts = injectExplorationPosts(personalisedSlice, explorationPosts);
    
    // ── Cap the result to prevent page size drift ──────
    const maxAllowed = LIMIT + explorationNeeded;
    if (finalPosts.length > maxAllowed) {
      finalPosts = finalPosts.slice(0, maxAllowed);
    }
  }

  const hasMore = diversified.length > LIMIT || poolHasMore;

  // ── Stage 8.5: Record impressions on final posts only ──
  if (viewerUserId && finalPosts.length) {
    await ContentTypePreference.incrementImpressions(viewerUserId, finalPosts);
  }

  // ── Stage 9: Mark seen ──────────────────────────────────
  const servedIds = finalPosts.map(p => p.id);
  await markPostsAsSeen(viewerUserId, servedIds);

  // ── Stage 10: Clean ────────────────────────────────────
  finalPosts.forEach(p => {
    p.reasons = p._reasons || [];
    delete p._score;
    delete p._topics;
    delete p._trendScore;
    delete p._explore;
    delete p._reasons;
    if (!C.DEBUG_SCORES) delete p._scoreDebug;
  });

  return { posts: finalPosts, hasMore, page, limit };
}

module.exports = { getPostsPage };