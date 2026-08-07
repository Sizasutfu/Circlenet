// ============================================================
//  feed/feedNichePosts.js
//
//  Fetches niche-specific posts that match the user's
//  primary interests but aren't already in the feed.
//
//  This complements the main feed by injecting fresh content
//  from the user's detected niches (tech, gaming, lifestyle, etc.)
//  at strategic positions in the feed.
// ============================================================

const { db } = require('../config/db');
const { hydratePosts } = require('../models/postModel');
const { NICHE_DEFINITIONS } = require('./nicheModel');

/**
 * Fetch posts from user's niches that are fresh and engaging
 * 
 * @param {number} viewerUserId - The user viewing the feed
 * @param {Object} userNiches - User's niche data from nicheModel
 * @param {Set<number>} excludePostIds - Posts already in the feed
 * @param {number} limit - Max posts to fetch
 * @returns {Promise<Object[]>} Array of hydrated niche posts
 */
async function fetchNichePosts(viewerUserId, userNiches, excludePostIds, limit = 5) {
  if (!viewerUserId || !userNiches || !userNiches.niches || !userNiches.niches.length) {
    return [];
  }

  const primaryNiches = userNiches.niches.slice(0, 3);
  const nicheKeys = primaryNiches.map(n => n.key);
  
  // Build query to find posts matching niche topics
  const params = [];
  const conditions = [];

  // Exclude seen posts
  if (excludePostIds && excludePostIds.size) {
    conditions.push(`p.id NOT IN (${[...excludePostIds].map(() => '?').join(',')})`);
    params.push(...excludePostIds);
  }

  // Match niche topics
  const nicheTopicConditions = [];
  for (const nicheKey of nicheKeys) {
    const nicheDef = NICHE_DEFINITIONS[nicheKey];
    if (nicheDef && nicheDef.topics && nicheDef.topics.length) {
      const topicPlaceholders = nicheDef.topics.map(() => '?').join(',');
      nicheTopicConditions.push(
        `EXISTS (
          SELECT 1 FROM post_topics pt 
          WHERE pt.post_id = p.id AND pt.topic IN (${topicPlaceholders})
        )`
      );
      params.push(...nicheDef.topics);
    }
  }

  if (nicheTopicConditions.length) {
    conditions.push(`(${nicheTopicConditions.join(' OR ')})`);
  }

  // Only recent posts (last 7 days for niche content)
  conditions.push(`p.created_at >= NOW() - INTERVAL 7 DAY`);

  // Exclude posts from the viewer themselves
  if (viewerUserId) {
    conditions.push(`p.user_id != ?`);
    params.push(viewerUserId);
  }

  // Prefer posts with some engagement (quality signal)
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
       u.gender AS authorGender,
       u.date_of_birth AS authorDateOfBirth,
       p.text,
       p.image,
       p.video,
       p.is_repost AS isRepost,
       p.original_post_id AS originalPostId,
       p.group_id AS groupId,
       p.created_at AS createdAt,
       (
         (SELECT COUNT(*) FROM likes WHERE post_id = p.id) * 2 +
         (SELECT COUNT(*) FROM comments WHERE post_id = p.id) * 4 +
         (SELECT COUNT(*) FROM reposts WHERE original_post_id = p.id) * 3
       ) AS relevance_score
     FROM posts p
     JOIN users u ON u.id = p.user_id
     ${whereClause}
     ORDER BY relevance_score DESC, p.created_at DESC
     LIMIT ?`,
    [...params, limit * 2]
  );

  if (!rawPosts.length) return [];

  // Shuffle and select to add variety
  const shuffled = rawPosts.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, limit);

  // Hydrate with engagement data
  const hydrated = await hydratePosts(selected, {
    followingIds: new Set(),
    includeFullComments: false,
  });

  // Mark as niche recommendations
  hydrated.forEach(p => {
    p._nicheRecommendation = true;
    p._nicheSource = 'niche_fetcher';
  });

  return hydrated;
}

module.exports = { fetchNichePosts };