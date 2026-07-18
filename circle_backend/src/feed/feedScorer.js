// ============================================================
//  feed/feedScorer.js
//
//  Exports:
//    computeScore(post, context) → number
//    generateReasons(post, context) → string[]
//
//  Score anatomy (all values ≥ 0):
//
//    finalScore = (baseScore - negativePenalty + newness + recency)
//                 × affinityMultiplier
//                 × topicMultiplier
//                 × seenMultiplier
//                 × similarityMultiplier   (user attributes)
//                 × collaborativeMultiplier
//                 × contentTypeMultiplier
//                 × jitter
//
//  Each factor is independently logged in scoreDebug.
// ============================================================

const C = require('../config/constants');

// ── Helpers ────────────────────────────────────────────────

function logScale(count) {
  return Math.log1p(Math.max(0, count));
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

function exponentialDecay(hoursOld, halfLifeHours) {
  return Math.exp((-Math.LN2 * hoursOld) / halfLifeHours);
}

// ── Similarity helpers ──────────────────────────────────────
function exactMatch(val1, val2) {
  if (!val1 || !val2) return 0;
  return val1.toLowerCase() === val2.toLowerCase() ? 1 : 0;
}

function ageSimilarity(viewerBirth, authorBirth) {
  if (!viewerBirth || !authorBirth) return 0;
  const ageDiff = Math.abs(
    (new Date(viewerBirth).getFullYear() - new Date(authorBirth).getFullYear())
  );
  return Math.max(0, 1 - (ageDiff / C.AGE_SIMILARITY_DECAY));
}

// ── generateReasons ─────────────────────────────────────────
function generateReasons(post, {
  viewerUserId   = null,
  followingIds   = new Set(),
  engagementMap  = {},
  topicScoreMap  = {},
  seenPostIds    = new Set(),
  negativeMap    = {},
  viewerAttributes = {},
  viewerEngagedPosts = new Set(),
  postSimilarityMap = {},
  contentTypeBoost = { text: 0.5, image: 0.5, video: 0.5 },
} = {}) {
  const reasons = [];

  // 1. Follow
  if (followingIds.has(post.userId)) {
    reasons.push('You follow this author');
  }

  // 2. Author engagement (likes/comments/reposts)
  const eng = engagementMap[post.userId] || {};
  let authorEngagement = [];
  if (eng.likes > 0) authorEngagement.push(`liked ${eng.likes} of their posts`);
  if (eng.comments > 0) authorEngagement.push(`commented ${eng.comments} times`);
  if (eng.reposts > 0) authorEngagement.push(`reposted ${eng.reposts} of their posts`);
  if (authorEngagement.length) {
    reasons.push(`You have ${authorEngagement.join(', ')}`);
  }

  // 3. Topic interest
  const postTopics = post._topics || [];
  let strongTopics = [];
  if (postTopics.length) {
    postTopics.forEach(t => {
      const score = topicScoreMap[t] || 0;
      if (score > 3) strongTopics.push(t);
    });
    if (strongTopics.length) {
      reasons.push(`You're interested in topics: ${strongTopics.slice(0, 3).join(', ')}`);
    }
  }

  // 4. Collaborative filtering – similar to posts you engaged with
  const sims = postSimilarityMap[post.id] || [];
  let similarPostsCount = 0;
  if (sims.length && viewerEngagedPosts.size) {
    for (const item of sims) {
      if (viewerEngagedPosts.has(item.post_id)) {
        similarPostsCount++;
      }
    }
    if (similarPostsCount > 1) {
      reasons.push(`Similar to posts you've engaged with (${similarPostsCount} matches)`);
    }
  }

  // 5. User‑attribute similarity
  const v = viewerAttributes;
  const a = post;
  let attrs = [];
  if (v.location && a.authorLocation && exactMatch(v.location, a.authorLocation)) attrs.push('same location');
  if (v.school && a.authorSchool && exactMatch(v.school, a.authorSchool)) attrs.push('same school');
  if (v.occupation && a.authorOccupation && exactMatch(v.occupation, a.authorOccupation)) attrs.push('same occupation');
  if (v.gender && a.authorGender && exactMatch(v.gender, a.authorGender)) attrs.push('same gender');
  if (v.birthDate && a.authorDateOfBirth && ageSimilarity(v.birthDate, a.authorDateOfBirth) > 0.5) attrs.push('similar age');
  if (attrs.length) {
    reasons.push(`You share ${attrs.join(', ')} with the author`);
  }

  // 6. Newness / recency
  const hoursOld = (Date.now() - new Date(post.createdAt).getTime()) / 3_600_000;
  if (hoursOld < 2) {
    reasons.push('This is a very recent post');
  } else if (hoursOld < 24) {
    reasons.push('This post is from today');
  }

  // 7. Content‑type preference
  let type = 'text';
  if (post.video) type = 'video';
  else if (post.image) type = 'image';
  const boost = contentTypeBoost[type] || 0.5;
  if (boost > 0.6) {
    reasons.push(`You often engage with ${type} content`);
  }

  // 8. High engagement (popular)
  const likeCount = post.likes?.length || 0;
  const commentCount = post.comments?.length || 0;
  const repostCount = post.reposts?.length || 0;
  if (likeCount > 5 || commentCount > 3 || repostCount > 2) {
    reasons.push('This post is popular in your network');
  }

  // 9. Exploration (if tagged)
  if (post._explore) {
    reasons.push('We thought you might like something different');
  }

  // Deduplicate and limit to 5
  const unique = [...new Set(reasons)];
  return unique.slice(0, 5);
}

// ── computeScore ───────────────────────────────────────────
function computeScore(post, {
  viewerUserId   = null,
  followingIds   = new Set(),
  engagementMap  = {},
  topicScoreMap  = {},
  seenPostIds    = new Set(),
  negativeMap    = {},
  viewerAttributes = {},
  viewerEngagedPosts = new Set(),
  postSimilarityMap = {},
  contentTypeBoost = { text: 0.5, image: 0.5, video: 0.5 },
} = {}) {

  // ── 1. Base engagement ──────────────────────────────────
  const likeCount    = post.likes?.length    ?? 0;
  const commentCount = post.comments?.length ?? 0;
  const repostCount  = post.reposts?.length  ?? 0;
  const viewCount    = post.views            ?? 0;
  const dwellSeconds = post.dwellSeconds     ?? 0;

  const baseEngagement =
    logScale(likeCount)    * C.WEIGHT_LIKE    +
    logScale(commentCount) * C.WEIGHT_COMMENT +
    logScale(repostCount)  * C.WEIGHT_REPOST  +
    logScale(viewCount)    * C.WEIGHT_VIEW    +
    logScale(dwellSeconds) * C.WEIGHT_DWELL;

  // ── 2. Negative signals ──────────────────────────────────
  const negSignals = negativeMap[post.id] || {};
  const negativePenalty =
    (negSignals.skips      || 0) * C.PENALTY_SKIP       +
    (negSignals.shortViews || 0) * C.PENALTY_SHORT_VIEW;
  const baseScore = Math.max(0, baseEngagement - negativePenalty);

  // ── 3. Newness boost ─────────────────────────────────────
  const hoursOld    = (Date.now() - new Date(post.createdAt).getTime()) / 3_600_000;
  const newnessBoost = hoursOld < C.NEWNESS_HOURS ? C.NEWNESS_BOOST : 0;

  // ── 4. Recency ────────────────────────────────────────────
  const recencyScore =
    C.RECENCY_WEIGHT * exponentialDecay(hoursOld, C.RECENCY_HALFLIFE_HOURS);

  // ── 5. Affinity ──────────────────────────────────────────
  const eng = engagementMap[post.userId] || {};
  const isFollowing = followingIds.has(post.userId);
  const rawAffinity =
    (eng.likes    || 0) * C.AFFINITY_LIKE_WEIGHT    +
    (eng.comments || 0) * C.AFFINITY_COMMENT_WEIGHT  +
    (eng.reposts  || 0) * C.AFFINITY_REPOST_WEIGHT   +
    (isFollowing ? C.AFFINITY_FOLLOW_BONUS : 0);
  const affinityMultiplier = clamp(
    1.0 + rawAffinity,
    C.AFFINITY_MULTIPLIER_MIN,
    C.AFFINITY_MULTIPLIER_MAX
  );

  // ── 6. Topic interest ────────────────────────────────────
  const postTopics = post._topics || [];
  let topicRaw = 0;
  if (postTopics.length && Object.keys(topicScoreMap).length) {
    postTopics.forEach(t => { topicRaw += topicScoreMap[t] || 0; });
    topicRaw /= postTopics.length;
  }
  const normalisedTopic  = Math.min(1.0, topicRaw / C.TOPIC_SCORE_NORMALISE);
  const topicMultiplier  = clamp(
    1.0 + normalisedTopic * C.TOPIC_WEIGHT,
    1.0,
    C.TOPIC_MULTIPLIER_MAX
  );

  // ── 7. Seen penalty ──────────────────────────────────────
  const seenMultiplier = seenPostIds.has(post.id) ? C.SEEN_PENALTY : 1.0;

  // ── 8. Similarity multiplier (user attributes) ──────────
  const v = viewerAttributes;
  const a = post;
  let rawSim = 0;

  if (v.location && a.authorLocation) rawSim += C.SIMILARITY_LOCATION_WEIGHT * exactMatch(v.location, a.authorLocation);
  if (v.school && a.authorSchool) rawSim += C.SIMILARITY_SCHOOL_WEIGHT * exactMatch(v.school, a.authorSchool);
  if (v.occupation && a.authorOccupation) rawSim += C.SIMILARITY_OCCUPATION_WEIGHT * exactMatch(v.occupation, a.authorOccupation);
  if (v.gender && a.authorGender) rawSim += C.SIMILARITY_GENDER_WEIGHT * exactMatch(v.gender, a.authorGender);
  if (v.birthDate && a.authorDateOfBirth) rawSim += C.SIMILARITY_AGE_WEIGHT * ageSimilarity(v.birthDate, a.authorDateOfBirth);

  const similarityMultiplier = Math.min(1.0 + rawSim, C.SIMILARITY_MAX_MULTIPLIER);

  // ── 9. Collaborative filtering multiplier ──────────────
  let collaborativeScore = 0;
  const sims = postSimilarityMap[post.id] || [];
  if (sims.length && viewerEngagedPosts.size) {
    let total = 0, count = 0;
    for (const item of sims) {
      if (viewerEngagedPosts.has(item.post_id)) {
        total += item.score;
        count++;
      }
    }
    if (count > 0) collaborativeScore = total / count;
  }
  const collaborativeMultiplier = Math.min(
    1.0 + collaborativeScore * C.COLLABORATIVE_SCALE,
    C.COLLABORATIVE_MAX_BOOST
  );

  // ── 10. Content‑type multiplier ──────────────────────────
  let type = 'text';
  if (post.video) type = 'video';
  else if (post.image) type = 'image';
  const typeBoost = contentTypeBoost[type] ?? 0.5;
  const contentTypeMultiplier = 0.8 + 0.4 * typeBoost;

  // ── 11. Jitter ────────────────────────────────────────────
  const jitter = 0.95 + Math.random() * 0.10;

  // ── 12. Final score ──────────────────────────────────────
  const preMultiplied = baseScore + newnessBoost + recencyScore;
  const finalScore    = preMultiplied
    * affinityMultiplier
    * topicMultiplier
    * seenMultiplier
    * similarityMultiplier
    * collaborativeMultiplier
    * contentTypeMultiplier
    * jitter;

  // ── 13. Debug payload ──────────────────────────────────
  if (C.DEBUG_SCORES) {
    post._scoreDebug = {
      finalScore:          +finalScore.toFixed(3),
      baseEngagement:      +baseEngagement.toFixed(3),
      negativePenalty:     +negativePenalty.toFixed(3),
      baseScore:           +baseScore.toFixed(3),
      newnessBoost,
      recencyScore:        +recencyScore.toFixed(3),
      hoursOld:            +hoursOld.toFixed(2),
      affinityMultiplier:  +affinityMultiplier.toFixed(3),
      topicMultiplier:     +topicMultiplier.toFixed(3),
      seenMultiplier,
      similarityMultiplier: +similarityMultiplier.toFixed(3),
      collaborativeScore:  +collaborativeScore.toFixed(3),
      collaborativeMultiplier: +collaborativeMultiplier.toFixed(3),
      contentTypeMultiplier: +contentTypeMultiplier.toFixed(3),
      typeBoost:           +typeBoost.toFixed(3),
      content_type:        type,
      jitter:              +jitter.toFixed(3),
      signals: {
        likes: likeCount, comments: commentCount,
        reposts: repostCount, views: viewCount, dwellSeconds,
        skips: negSignals.skips || 0, shortViews: negSignals.shortViews || 0,
        isFollowing, postTopics, topicRaw: +topicRaw.toFixed(3),
        viewerAttributes: v,
        authorAttributes: {
          location: a.authorLocation,
          school: a.authorSchool,
          occupation: a.authorOccupation,
          gender: a.authorGender,
          birthDate: a.authorDateOfBirth,
        },
        engagedPostCount: viewerEngagedPosts.size,
        similarityHits: sims.filter(s => viewerEngagedPosts.has(s.post_id)).length,
      },
    };
  }

  return finalScore;
}

module.exports = { computeScore, generateReasons };