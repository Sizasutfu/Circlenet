// models/ContentTypePreferenceModel.js
const { db } = require('../config/db');

/**
 * Increment impression counts for each content type found in the posts list.
 * @param {number} userId
 * @param {Array} posts - array of post objects (must have `video` and `image` fields)
 */
async function incrementImpressions(userId, posts) {
  if (!userId || !posts.length) return;
  const counts = { text: 0, image: 0, video: 0 };
  for (const p of posts) {
    let type = 'text';
    if (p.video) type = 'video';
    else if (p.image) type = 'image';
    counts[type]++;
  }
  for (const [type, count] of Object.entries(counts)) {
    if (count > 0) {
      await db.query(
        `INSERT INTO user_content_type_preferences (user_id, content_type, impressions)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE impressions = impressions + VALUES(impressions)`,
        [userId, type, count]
      );
    }
  }
}

/**
 * Get the engagement rate (engagements / impressions) per content type.
 * Returns an object: { text: number, image: number, video: number }
 * If no data, default is 0.5 (neutral).
 */
async function getContentTypeBoost(userId) {
  const [rows] = await db.query(
    `SELECT content_type,
            CASE WHEN impressions > 0 THEN engagements / impressions ELSE 0 END AS rate
     FROM user_content_type_preferences
     WHERE user_id = ?`,
    [userId]
  );
  const rates = { text: 0.5, image: 0.5, video: 0.5 };
  rows.forEach(r => {
    rates[r.content_type] = Math.min(1, Math.max(0, r.rate));
  });
  return rates;
}

/**
 * Increment engagement count for a user on a given post's content type.
 * Called after a like, comment, repost, or video view.
 */
async function incrementEngagement(userId, postId) {
  if (!userId || !postId) return;
  // Determine content type from the post
  const [postRows] = await db.query(
    'SELECT video, image FROM posts WHERE id = ?',
    [postId]
  );
  if (!postRows.length) return;
  const p = postRows[0];
  let type = 'text';
  if (p.video) type = 'video';
  else if (p.image) type = 'image';

  await db.query(
    `INSERT INTO user_content_type_preferences (user_id, content_type, engagements)
     VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE engagements = engagements + 1`,
    [userId, type]
  );
}

module.exports = {
  incrementImpressions,
  getContentTypeBoost,
  incrementEngagement,
};