// ============================================================
//  feed/feedExploration.js
//
//  Fetches a pool of "exploration" posts — content the viewer
//  hasn't seen, from creators they don't follow, that is
//  trending or simply recent — and injects them at fixed slots
//  in the personalised feed.
//
//  Injection pattern: every EXPLORE_EVERY_N positions gets one
//  exploration post swapped in (positions 5, 10, 15 … on a
//  20-item page = ~20% exploration, ~80% personalised).
//
//  UPDATED: Better hydration, more robust SQL, and support for
//  username and verified fields.
// ============================================================

const { db }                          = require('../config/db');
const { hydratePosts }                = require('../models/postModel');
const { EXPLORE_EVERY_N, EXPLORE_MAX_AGE_HOURS } = require('../config/constants');

/**
 * Fetch candidate exploration posts.
 * Excludes posts from people the viewer already follows,
 * and posts already in the personalised batch.
 *
 * @param {number|null} viewerUserId
 * @param {number[]}    followingIds      - already-followed author IDs
 * @param {Set<number>} excludePostIds   - personalised batch post IDs
 * @param {number}      needed            - how many exploration slots exist
 * @returns {Object[]}  hydrated posts
 */
async function fetchExplorationPosts(viewerUserId, followingIds, excludePostIds, needed) {
  if (needed <= 0) return [];

  // Exclude the viewer themselves and people they follow
  const excludeAuthorIds = viewerUserId
    ? [viewerUserId, ...followingIds]
    : [...followingIds];

  // ── Build parameterised query ──────────────────────────────
  const params = [];

  // WHERE conditions
  const conditions = [];

  if (excludeAuthorIds.length) {
    conditions.push(`p.user_id NOT IN (${excludeAuthorIds.map(() => '?').join(',')})`);
    params.push(...excludeAuthorIds);
  }

  if (excludePostIds.size) {
    conditions.push(`p.id NOT IN (${[...excludePostIds].map(() => '?').join(',')})`);
    params.push(...excludePostIds);
  }

  conditions.push(`p.created_at >= NOW() - INTERVAL ? HOUR`);
  params.push(EXPLORE_MAX_AGE_HOURS);

  // Only fetch posts that have some engagement (trending)
  conditions.push(`(
    (SELECT COUNT(*) FROM likes WHERE post_id = p.id) > 0
    OR (SELECT COUNT(*) FROM comments WHERE post_id = p.id) > 0
  )`);

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  // ── Query with author attributes ───────────────────────────
  const [rawPosts] = await db.query(
    `SELECT
       p.id,
       p.user_id          AS userId,
       u.name             AS author,
       u.username         AS authorUsername,
       u.picture          AS authorPicture,
       u.verified         AS authorVerified,
       p.text,
       p.image,
       p.video,
       p.is_repost        AS isRepost,
       p.original_post_id AS originalPostId,
       p.group_id         AS groupId,
       p.created_at       AS createdAt,
       (
         (SELECT COUNT(*) FROM likes    WHERE post_id = p.id) * 2 +
         (SELECT COUNT(*) FROM comments WHERE post_id = p.id) * 4 +
         (SELECT COUNT(*) FROM reposts  WHERE original_post_id = p.id) * 3
       ) AS _trendScore
     FROM posts p
     JOIN users u ON u.id = p.user_id
     ${whereClause}
     ORDER BY _trendScore DESC, RAND()
     LIMIT ?`,
    [...params, needed * 3] // over-fetch for buffer
  );

  if (!rawPosts.length) return [];

  // ── Hydrate with engagement data ──────────────────────────
  const hydrated = await hydratePosts(rawPosts, {
    followingIds: followingIds,
    includeFullComments: false,
  });

  return hydrated.slice(0, needed);
}

/**
 * Splice exploration posts into the personalised feed at
 * every EXPLORE_EVERY_N-th position.
 *
 * @param {Object[]} personalised   - diversity-filtered personalised posts
 * @param {Object[]} exploration    - exploration posts
 * @returns {Object[]}               merged feed
 */
function injectExplorationPosts(personalised, exploration) {
  if (!exploration.length) return personalised;

  const result = [];
  let explIdx = 0;

  // Only inject if we have more than EXPLORE_EVERY_N personalised posts
  // This avoids injecting too early in the feed
  const startIndex = Math.min(EXPLORE_EVERY_N - 1, personalised.length - 1);

  for (let i = 0; i < personalised.length; i++) {
    result.push(personalised[i]);

    // After every Nth personalised post (starting from position EXPLORE_EVERY_N),
    // insert one exploration post
    const isSlot = (i + 1) % EXPLORE_EVERY_N === 0 && i >= startIndex;
    if (isSlot && explIdx < exploration.length) {
      const explPost = exploration[explIdx++];
      explPost._explore = true; // flag for client and reasons
      result.push(explPost);
    }
  }

  // If we have extra exploration posts and room, append them at the end
  while (explIdx < exploration.length && result.length < personalised.length + exploration.length) {
    const explPost = exploration[explIdx++];
    explPost._explore = true;
    result.push(explPost);
  }

  return result;
}

module.exports = { fetchExplorationPosts, injectExplorationPosts };