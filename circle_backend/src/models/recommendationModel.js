// ============================================================
//  models/RecommendationModel.js
//  User recommendation engine with human-readable reasons.
//
//  Combines three sources:
//    1. Interaction (likes, comments, reposts)
//    2. New members (joined within last 30 days)
//    3. Top creators (by follower count)
//
//  Returns a deduplicated list of users, each with a `reasons`
//  array explaining the recommendation.
// ============================================================

const { db } = require('../config/db');

async function getRecommendations(userId, limit = 10) {
  // Check for suspended column (safe fallback)
  let hasSuspended = false;
  try {
    await db.query('SELECT suspended FROM users LIMIT 1');
    hasSuspended = true;
  } catch (_) {}

  const suspendedClause = hasSuspended ? 'AND u.suspended = 0' : '';

  // ── 1. Interaction candidates ─────────────────────────────
  const [interactionRows] = await db.query(
    `
    SELECT
      u.id,
      u.username,
      u.name,
      u.picture,
      u.created_at,
      SUM(interactions.score) AS interaction_score,
      (SELECT COUNT(*) FROM posts WHERE user_id = u.id) AS post_count,
      (SELECT COUNT(*) FROM follows WHERE following_id = u.id) AS follower_count
    FROM (
      SELECT p.user_id AS target_user_id, 1 AS score
      FROM likes l
      JOIN posts p ON p.id = l.post_id
      WHERE l.user_id = ? AND p.user_id != ?

      UNION ALL

      SELECT p.user_id AS target_user_id, 2 AS score
      FROM comments c
      JOIN posts p ON p.id = c.post_id
      WHERE c.user_id = ? AND p.user_id != ?

      UNION ALL

      SELECT p.user_id AS target_user_id, 3 AS score
      FROM reposts r
      JOIN posts p ON p.id = r.original_post_id
      WHERE r.user_id = ? AND p.user_id != ?
    ) AS interactions
    JOIN users u ON u.id = interactions.target_user_id
    LEFT JOIN follows f ON f.follower_id = ? AND f.following_id = interactions.target_user_id
    WHERE f.follower_id IS NULL AND u.id != ? ${suspendedClause}
    GROUP BY u.id, u.username, u.name, u.picture, u.created_at
    ORDER BY interaction_score DESC
    LIMIT ?
    `,
    [
      userId, userId,
      userId, userId,
      userId, userId,
      userId,
      userId,
      limit * 2,
    ]
  );

  // ── 2. New members (last 30 days) ──────────────────────────
  const [newMemberRows] = await db.query(
    `
    SELECT
      u.id,
      u.username,
      u.name,
      u.picture,
      u.created_at,
      0 AS interaction_score,
      (SELECT COUNT(*) FROM posts WHERE user_id = u.id) AS post_count,
      (SELECT COUNT(*) FROM follows WHERE following_id = u.id) AS follower_count
    FROM users u
    WHERE u.id != ?
      AND u.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      ${suspendedClause}
      AND NOT EXISTS (SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id)
    ORDER BY u.created_at DESC
    LIMIT ?
    `,
    [userId, userId, limit * 2]
  );

  // ── 3. Top creators (by follower count) ────────────────────
  const [topCreatorRows] = await db.query(
    `
    SELECT
      u.id,
      u.username,
      u.name,
      u.picture,
      u.created_at,
      0 AS interaction_score,
      (SELECT COUNT(*) FROM posts WHERE user_id = u.id) AS post_count,
      (SELECT COUNT(*) FROM follows WHERE following_id = u.id) AS follower_count
    FROM users u
    WHERE u.id != ?
      ${suspendedClause}
      AND NOT EXISTS (SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id)
    ORDER BY follower_count DESC
    LIMIT ?
    `,
    [userId, userId, limit * 2]
  );

  // ── Combine, deduplicate, and score ──────────────────────
  const usersMap = new Map();

  // Helper to add a user with a given source label
  const addUser = (row, sourceLabel) => {
    const id = row.id;
    if (!usersMap.has(id)) {
      // Normalize scores
      const interaction = Number(row.interaction_score) || 0;
      const daysSinceJoined = Math.floor((Date.now() - new Date(row.created_at).getTime()) / 86400000);
      let recencyScore = 0;
      if (daysSinceJoined < 7) recencyScore = 5;
      else if (daysSinceJoined <= 30) recencyScore = 3;

      const followerCount = Number(row.follower_count) || 0;
      const popularityScore = Math.min(followerCount / 20, 5);

      const compositeScore = (interaction * 3) + (recencyScore * 2) + popularityScore;

      usersMap.set(id, {
        id,
        username: row.username,
        name: row.name,
        picture: row.picture,
        post_count: Number(row.post_count) || 0,
        follower_count: followerCount,
        interaction_score: interaction,
        recency_score: recencyScore,
        popularity_score: popularityScore,
        composite_score: compositeScore,
        reasons: [sourceLabel],
      });
    } else {
      // If already in map, keep higher interaction and merge reasons
      const existing = usersMap.get(id);
      if (row.interaction_score > existing.interaction_score) {
        existing.interaction_score = row.interaction_score;
        // Recalculate composite
        existing.composite_score = (existing.interaction_score * 3) +
          (existing.recency_score * 2) +
          existing.popularity_score;
      }
      // Add reason if not already present
      if (!existing.reasons.includes(sourceLabel)) {
        existing.reasons.push(sourceLabel);
      }
    }
  };

  // Add all rows with appropriate source labels
  interactionRows.forEach(row => addUser(row, 'You interacted with their content'));
  newMemberRows.forEach(row => addUser(row, 'New member'));
  topCreatorRows.forEach(row => addUser(row, 'Popular creator'));

  // Convert map to array, sort by composite descending, slice to limit
  const results = Array.from(usersMap.values())
    .sort((a, b) => b.composite_score - a.composite_score)
    .slice(0, limit);

  // Return only the fields the frontend expects, plus the `reasons` array
  return results.map(({ id, username, name, picture, post_count, follower_count, reasons }) => ({
    id,
    username,
    name,
    picture,
    post_count,
    follower_count,
    reasons, // array of strings
  }));
}

module.exports = { getRecommendations };