// ============================================================
//  models/DismissedRecommendationModel.js
// ============================================================

const { db } = require('../config/db');

async function dismissRecommendation(userId, dismissedUserId) {
  await db.query(
    `INSERT IGNORE INTO dismissed_recommendations (user_id, dismissed_user_id)
     VALUES (?, ?)`,
    [userId, dismissedUserId]
  );
}

async function getDismissedUserIds(userId) {
  const [rows] = await db.query(
    `SELECT dismissed_user_id FROM dismissed_recommendations WHERE user_id = ?`,
    [userId]
  );
  return rows.map(r => r.dismissed_user_id);
}

module.exports = {
  dismissRecommendation,
  getDismissedUserIds,
};