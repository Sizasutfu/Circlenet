// ============================================================
//  models/notificationModel.js
//  All database queries related to notifications.
// ============================================================

const { db } = require('../config/db');
const { sendPushToUser } = require('./pushModel');

// ── Push copy for each notification type ────
const PUSH_COPY = {
  like:        (actor, snippet) => ({ title: 'New like ❤️',           body: snippet ? `${actor} liked your post: "${snippet}"` : `${actor} liked your post` }),
  comment:     (actor, snippet) => ({ title: 'New comment 💬',         body: snippet ? `${actor} commented: "${snippet}"` : `${actor} commented on your post` }),
  reply:       (actor, snippet) => ({ title: 'New reply 💬',           body: snippet ? `${actor} replied: "${snippet}"` : `${actor} replied to your comment` }),
  repost:      (actor, snippet) => ({ title: 'New repost 🔁',          body: `${actor} reposted your post` }),
  follow:      (actor)          => ({ title: 'New follower 👤',         body: `${actor} started following you` }),
  mention:     (actor, snippet) => ({ title: 'You were mentioned 📣',   body: snippet ? `${actor} mentioned you: "${snippet}"` : `${actor} mentioned you in a post` }),
  new_post:    (actor, snippet) => ({ title: 'New post ✨',             body: snippet ? `${actor} posted: "${snippet}"` : `${actor} published a new post` }),
  profile_pic: (actor)          => ({ title: 'Profile updated 📸',      body: `${actor} updated their profile photo` }),
  live:        (actor)          => ({ title: 'Live now 🔴',             body: `${actor} just started a live stream` }),
  verified:    (actor)          => ({ title: '✅ Verified!',             body: `Your account has been verified! You now have a verification badge.` }),
  unverified:  (actor)          => ({ title: 'Verification Removed ❌',  body: `Your verification badge has been removed.` }),
};

// Maps notification `type` values to push_subscriptions pref columns
const TYPE_TO_PREF = {
  like:        'likes',
  comment:     'comments',
  reply:       'comments',
  repost:      'reposts',
  follow:      'follows',
  mention:     'mentions',
  new_post:    'new_post',
  profile_pic: 'profile_pic',
  live:        'live',
  verified:    null, // Always send verification notifications
  unverified:  null, // Always send verification notifications
};

// ── Create a notification (deduplicates automatically) ─────
// Returns the new notification id, or null if deduplicated / failed.
async function createNotification(
  recipientId,
  actorId,
  type,
  postId = null,
  sessionId = null,
  options = {} // { commentId, parentCommentId }
) {
  if (recipientId === actorId) return null; // never notify yourself

  const { commentId = null, parentCommentId = null } = options;

  try {
    // ── Duplicate detection per type ──
    let duplicateCheckQuery;
    let params;

    if (type === 'reply' && parentCommentId) {
      duplicateCheckQuery = `
        SELECT id FROM notifications
        WHERE recipient_id = ? AND actor_id = ? AND type = ?
          AND parent_comment_id = ?
          AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `;
      params = [recipientId, actorId, type, parentCommentId];
    } else if (type === 'live' && sessionId) {
      duplicateCheckQuery = `
        SELECT id FROM notifications
        WHERE recipient_id = ? AND actor_id = ? AND type = ?
          AND session_id = ?
          AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `;
      params = [recipientId, actorId, type, sessionId];
    } else if (type === 'follow') {
      duplicateCheckQuery = `
        SELECT id FROM notifications
        WHERE recipient_id = ? AND actor_id = ? AND type = ?
          AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `;
      params = [recipientId, actorId, type];
    } else if (type === 'mention' || type === 'like' || type === 'comment' || type === 'repost') {
      duplicateCheckQuery = `
        SELECT id FROM notifications
        WHERE recipient_id = ? AND actor_id = ? AND type = ?
          AND post_id = ?
          AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `;
      params = [recipientId, actorId, type, postId];
    } else {
      duplicateCheckQuery = `
        SELECT id FROM notifications
        WHERE recipient_id = ? AND actor_id = ? AND type = ?
          AND (post_id = ? OR (post_id IS NULL AND ? IS NULL))
          AND (session_id = ? OR (session_id IS NULL AND ? IS NULL))
          AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `;
      params = [recipientId, actorId, type, postId, postId, sessionId, sessionId];
    }

    const [dup] = await db.query(duplicateCheckQuery, params);
    if (dup.length > 0) {
      console.log(`[Notification] Skipping duplicate ${type} for user ${recipientId} (already sent recently)`);
      return null;
    }

    // ── Insert ──
    const [result] = await db.query(
      `INSERT INTO notifications
         (recipient_id, actor_id, type, post_id, session_id, comment_id, parent_comment_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [recipientId, actorId, type, postId, sessionId, commentId, parentCommentId]
    );
    const notifId = result.insertId;

    // ── Fire push notification (non-blocking) ──
    const prefType = TYPE_TO_PREF[type];
    const copyFn   = PUSH_COPY[type];

    if (copyFn) {
      // Verification notifications have no actor
      if (type === 'verified' || type === 'unverified') {
        const { title, body } = copyFn(null);
        sendPushToUser(recipientId, null, title, body, './', {
          notifId,
          type,
        }).catch(err => console.error('push dispatch error:', err.message));
        return notifId;
      }

      if (prefType) {
        // For reply notifications, the snippet comes from the reply comment.
        // For everything else, it comes from the post.
        const snippetQuery = commentId
          ? `SELECT u.name AS actorName, LEFT(c.text, 60) AS snippet
             FROM users u
             LEFT JOIN comments c ON c.id = ?
             WHERE u.id = ?`
          : `SELECT u.name AS actorName, LEFT(p.text, 60) AS snippet
             FROM users u
             LEFT JOIN posts p ON p.id = ?
             WHERE u.id = ?`;

        const snippetParams = commentId ? [commentId, actorId] : [postId, actorId];

        db.query(snippetQuery, snippetParams)
          .then(([[row]]) => {
            if (!row) return;
            const { title, body } = copyFn(row.actorName, row.snippet || null);
            sendPushToUser(recipientId, prefType, title, body, './', {
              postId,
              sessionId,
              actorId,
              notifId,
              commentId,
              parentCommentId,
            });
          })
          .catch(err => console.error('push dispatch error:', err.message));
      }
    }

    return notifId;
  } catch (err) {
    // Log but never crash the calling request over a notification failure
    console.error('createNotification error:', err.message);
    return null;
  }
}

// ── Create a system notification (no actor — used for admin actions) ──
async function createSystemNotification(recipientId, type, message) {
  try {
    const [dup] = await db.query(
      `SELECT id FROM notifications
       WHERE recipient_id = ? AND type = ? AND message = ?
         AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
       LIMIT 1`,
      [recipientId, type, message]
    );

    if (dup.length > 0) {
      console.log(`[Notification] Skipping duplicate system ${type} for user ${recipientId}`);
      return null;
    }

    const [result] = await db.query(
      `INSERT INTO notifications (recipient_id, actor_id, type, message, created_at)
       VALUES (?, NULL, ?, ?, NOW())`,
      [recipientId, type, message]
    );

    const pushCopy = {
      report_resolved: { title: 'Report Update ✅', body: message },
      report_ignored:  { title: 'Report Update ℹ️',  body: message },
      verified:        { title: '✅ Verified!',      body: message },
      unverified:      { title: 'Verification Removed ❌', body: message },
    };
    const copy = pushCopy[type];
    if (copy) {
      sendPushToUser(recipientId, null, copy.title, copy.body, './', { type })
        .catch(err => console.error('push dispatch error:', err.message));
    }

    return result.insertId;
  } catch (err) {
    console.error('createSystemNotification error:', err.message);
    return null;
  }
}

// ── Create verification notification ────────────────────────
async function createVerificationNotification(userId, verified) {
  const type = verified ? 'verified' : 'unverified';
  const message = verified
    ? '🎉 Congratulations! Your account has been verified. You now have a verification badge!'
    : 'Your verification badge has been removed. If you think this was a mistake, please contact support.';

  return createSystemNotification(userId, type, message);
}

// ── Fetch paginated notifications for a user ──────────────
async function getNotifications(userId, limit = 10, offset = 0) {
  const [rows] = await db.query(
    `SELECT
       n.id,
       n.type,
       n.is_read              AS isRead,
       n.created_at           AS createdAt,
       n.post_id              AS postId,
       n.session_id           AS sessionId,
       n.comment_id           AS commentId,
       n.parent_comment_id    AS parentCommentId,
       n.message              AS customMessage,
       a.id                   AS actorId,
       a.name                 AS actorName,
       a.username             AS actorUsername,
       a.picture              AS actorPicture,
       a.verified             AS actorVerified,
       LEFT(p.text, 80)       AS postSnippet,
       LEFT(rc.text, 120)     AS commentText
     FROM notifications n
     LEFT JOIN users    a  ON a.id  = n.actor_id
     LEFT JOIN posts    p  ON p.id  = n.post_id
     LEFT JOIN comments rc ON rc.id = n.comment_id
     WHERE n.recipient_id = ?
     ORDER BY n.created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );
  return rows;
}

// ── Unread count ───────────────────────────────────────────
async function getUnreadCount(userId) {
  const [[{ count }]] = await db.query(
    'SELECT COUNT(*) AS count FROM notifications WHERE recipient_id=? AND is_read=0',
    [userId]
  );
  return count;
}

// ── Mark all notifications as read ────────────────────────
async function markAllRead(userId) {
  await db.query(
    'UPDATE notifications SET is_read=1 WHERE recipient_id=?',
    [userId]
  );
}

// ── Mark a single notification as read ────────────────────
async function markOneRead(notifId) {
  await db.query('UPDATE notifications SET is_read=1 WHERE id=?', [notifId]);
}

module.exports = {
  createNotification,
  createSystemNotification,
  createVerificationNotification,
  getNotifications,
  getUnreadCount,
  markAllRead,
  markOneRead,
};