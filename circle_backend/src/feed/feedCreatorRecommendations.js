// ============================================================
//  feed/feedCreatorRecommendations.js
//
//  Fetches posts from creators who share the same niche
//  as the viewing user (based on what they post about).
//  
//  This is a "People Like You" recommendation system.
// ============================================================

const { db } = require('../config/db');
const { hydratePosts } = require('../models/postModel');
const { NICHE_DEFINITIONS, getSimilarCreators } = require('./creatorNicheModel');

/**
 * Fetch posts from creators who create similar content
 * 
 * @param {number} viewerUserId - The user viewing the feed
 * @param {Object} userNiches - User's creator niches from creatorNicheModel
 * @param {Set<number>} excludePostIds - Posts already in the feed
 * @param {number} limit - Max posts to fetch
 * @returns {Promise<Object[]>} Array of hydrated posts from similar creators
 */
async function fetchSimilarCreatorPosts(viewerUserId, userNiches, excludePostIds, limit = 5) {
  if (!viewerUserId || !userNiches || !userNiches.niches || !userNiches.niches.length) {
    return [];
  }

  // Get similar creators
  const similarCreators = await getSimilarCreators(viewerUserId, userNiches, limit * 2);
  
  if (!similarCreators.length) {
    return [];
  }

  const creatorIds = similarCreators.map(c => c.id);
  const ph = creatorIds.map(() => '?').join(',');

  // Build query for posts from these creators
  const params = [...creatorIds];
  const conditions = [];

  // Exclude seen posts
  if (excludePostIds && excludePostIds.size) {
    conditions.push(`p.id NOT IN (${[...excludePostIds].map(() => '?').join(',')})`);
    params.push(...excludePostIds);
  }

  // Only recent posts
  conditions.push(`p.created_at >= NOW() - INTERVAL 14 DAY`);

  // Prefer posts with engagement
  conditions.push(`(
    (SELECT COUNT(*) FROM likes WHERE post_id = p.id) > 0 OR
    (SELECT COUNT(*) FROM comments WHERE post_id = p.id) > 0
  )`);

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const [rawPosts] = await db.query(
    `SELECT
       p.id,
       p.user_id AS userId,
       u.name AS author,
       u.username AS authorUsername,
       u.picture AS authorPicture,
       u.verified AS authorVerified,
       u.location AS authorLocation,
       u.school AS authorSchool,
       u.occupation AS authorOccupation,
       p.text,
       p.image,
       p.video,
       p.is_repost AS isRepost,
       p.original_post_id AS originalPostId,
       p.group_id AS groupId,
       p.created_at AS createdAt,
       (
         (SELECT COUNT(*) FROM likes WHERE post_id = p.id) * 2 +
         (SELECT COUNT(*) FROM comments WHERE post_id = p.id) * 4
       ) AS relevance_score
     FROM posts p
     JOIN users u ON u.id = p.user_id
     ${whereClause}
     ORDER BY relevance_score DESC, p.created_at DESC
     LIMIT ?`,
    [...params, limit * 2]
  );

  if (!rawPosts.length) return [];

  // Shuffle and select
  const shuffled = rawPosts.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, limit);

  // Hydrate with engagement data
  const hydrated = await hydratePosts(selected, {
    followingIds: new Set(),
    includeFullComments: false,
  });

  // Mark as similar creator recommendations
  hydrated.forEach(p => {
    p._similarCreator = true;
    p._nicheSource = 'similar_creators';
  });

  return hydrated;
}

/**
 * Get trending creators in a niche (for discovery)
 */
async function getTrendingCreatorsInNiche(nicheKey, limit = 10) {
  const nicheDef = NICHE_DEFINITIONS[nicheKey];
  if (!nicheDef) return [];

  const topicConditions = nicheDef.topics.map(() => '?').join(',');

  const [rows] = await db.query(
    `SELECT 
       u.id,
       u.name,
       u.username,
       u.picture,
       u.verified,
       COUNT(DISTINCT p.id) AS post_count,
       SUM((SELECT COUNT(*) FROM likes WHERE post_id = p.id)) AS total_likes,
       SUM((SELECT COUNT(*) FROM comments WHERE post_id = p.id)) AS total_comments,
       MAX(p.created_at) AS last_post
     FROM users u
     JOIN posts p ON p.user_id = u.id
     JOIN post_topics pt ON pt.post_id = p.id
     WHERE pt.topic IN (${topicConditions})
       AND p.created_at >= NOW() - INTERVAL 7 DAY
     GROUP BY u.id
     HAVING post_count >= 3
     ORDER BY (total_likes * 2 + total_comments * 4) DESC
     LIMIT ?`,
    [...nicheDef.topics, limit]
  );

  return rows;
}

module.exports = { 
  fetchSimilarCreatorPosts,
  getTrendingCreatorsInNiche
};