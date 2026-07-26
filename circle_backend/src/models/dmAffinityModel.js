// models/dmAffinityModel.js
const { db } = require('../config/db');

/**
 * Compute DM affinity scores for a user.
 * Returns a map: { [otherUserId]: score }
 * 
 * @param {number} userId
 * @returns {Promise<Map<number, number>>}
 */
async function getDmAffinity(userId) {
  // Get all conversation IDs where the user is a participant
  const [conversations] = await db.query(
    `SELECT id, participant_one_id, participant_two_id 
     FROM dm_conversations 
     WHERE participant_one_id = ? OR participant_two_id = ?`,
    [userId, userId]
  );

  if (!conversations.length) {
    return new Map();
  }

  const convIds = conversations.map(c => c.id);
  const ph = convIds.map(() => '?').join(',');

  // Get messages from these conversations where the user is NOT the sender
  // The other participant is determined by the conversation participants
  const [rows] = await db.query(
    `SELECT 
       m.conversation_id,
       m.sender_id,
       m.created_at,
       CASE 
         WHEN c.participant_one_id = ? THEN c.participant_two_id
         ELSE c.participant_one_id
       END AS other_user_id
     FROM dm_messages m
     JOIN dm_conversations c ON c.id = m.conversation_id
     WHERE m.conversation_id IN (${ph})
       AND m.sender_id != ?`,
    [userId, userId, ...convIds]
  );

  // Build affinity scores
  const scores = new Map();
  const userMessages = {};

  // Group messages by other user
  for (const row of rows) {
    const otherId = row.other_user_id;
    if (!otherId) continue;

    if (!userMessages[otherId]) {
      userMessages[otherId] = {
        messages: [],
        lastMessageAt: row.created_at,
      };
    }
    userMessages[otherId].messages.push(row);
    
    // Track most recent message
    if (row.created_at > userMessages[otherId].lastMessageAt) {
      userMessages[otherId].lastMessageAt = row.created_at;
    }
  }

  // Calculate scores
  for (const [otherId, data] of Object.entries(userMessages)) {
    const messageCount = data.messages.length;
    const lastMessageAt = new Date(data.lastMessageAt);
    const hoursSinceLast = (Date.now() - lastMessageAt.getTime()) / (1000 * 60 * 60);

    // ── Recency score ──────────────────────────────────────
    let recencyWeight = 0;
    if (hoursSinceLast < 24) recencyWeight = 3;
    else if (hoursSinceLast < 168) recencyWeight = 2; // 7 days
    else if (hoursSinceLast < 720) recencyWeight = 1; // 30 days

    // ── Message count bonus ──────────────────────────────
    const countBonus = Math.min(messageCount / 50, 1);

    // ── Final score ──────────────────────────────────────
    // Normalise: min 0.1, max 2.0
    const base = Math.min(2, Math.max(0.1, recencyWeight / 10));
    const score = base + countBonus;

    scores.set(Number(otherId), score);
  }

  return scores;
}

module.exports = { getDmAffinity };