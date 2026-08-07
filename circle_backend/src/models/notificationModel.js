// ============================================================
//  models/NotificationModel.js
//  All database queries related to notifications.
// ============================================================

const { db } = require('../config/db');
const { sendPushToUser } = require('./pushModel');

//push copy for each notification type ────
const PUSH_COPY = {
  like:        (actor, snippet) => ({ title: 'New like ❤️',           body: snippet ? `${actor} liked your post: "${snippet}"` : `${actor} liked your post` }),
  comment:     (actor, snippet) => ({ title: 'New comment 💬',         body: snippet ? `${actor} commented: "${snippet}"` : `${actor} commented on your post` }),
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
async function createNotification(recipientId, actorId, type, postId = null, sessionId = null) {
  if (recipientId === actorId) return; // never notify yourself

  try {
    const [dup] = await db.query(
      `SELECT id FROM notifications
       WHERE recipient_id=? AND actor_id=? AND type=?
         AND (post_id=? OR (post_id IS NULL AND ? IS NULL))
         AND (session_id=? OR (session_id IS NULL AND ? IS NULL))`,
      [recipientId, actorId, type, postId, postId, sessionId, sessionId]
    );
    if (dup.length > 0) return; // already exists

    // INSERT and capture the new row's id for the push payload
    const [result] = await db.query(
      `INSERT INTO notifications (recipient_id, actor_id, type, post_id, session_id, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [recipientId, actorId, type, postId, sessionId]
    );
    const notifId = result.insertId;

    // ── Fire push notification (non-blocking) ───────────────
    const prefType = TYPE_TO_PREF[type];
    const copyFn   = PUSH_COPY[type];
    if (copyFn) {
      // For verification notifications, we don't need actor name
      if (type === 'verified' || type === 'unverified') {
        const { title, body } = copyFn(null);
        return sendPushToUser(recipientId, null, title, body, './', {
          notifId,
          type,
        }).catch(err => console.error('push dispatch error:', err.message));
      }

      if (prefType && copyFn) {
        db.query(
          // Fetch actor name + post snippet in one query
          `SELECT u.name AS actorName, LEFT(p.text, 60) AS snippet
           FROM users u
           LEFT JOIN posts p ON p.id = ?
           WHERE u.id = ?`,
          [postId, actorId]
        )
          .then(([[row]]) => {
            if (!row) return;
            const { title, body } = copyFn(row.actorName, row.snippet || null);
            return sendPushToUser(recipientId, prefType, title, body, './', {
              postId,
              sessionId,
              actorId,
              notifId,
            });
          })
          .catch(err => console.error('push dispatch error:', err.message));
      }
    }
  } catch (err) {
    // Log but never crash the calling request over a notification failure
    console.error('createNotification error:', err.message);
  }
}

// ── Create a system notification (no actor — used for admin actions) ──
async function createSystemNotification(recipientId, type, message) {
  try {
    await db.query(
      `INSERT INTO notifications (recipient_id, actor_id, type, message, created_at)
       VALUES (?, NULL, ?, ?, NOW())`,
      [recipientId, type, message]
    );

    // Fire push notification (non-blocking)
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
  } catch (err) {
    console.error('createSystemNotification error:', err.message);
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
       n.is_read      AS isRead,
       n.created_at   AS createdAt,
       n.post_id      AS postId,
       n.session_id   AS sessionId,
       n.message      AS customMessage,
       a.id           AS actorId,
       a.name         AS actorName,
       a.username     AS actorUsername,
       a.picture      AS actorPicture,
       LEFT(p.text, 80) AS postSnippet
     FROM notifications n
     LEFT JOIN users a ON a.id = n.actor_id
     LEFT JOIN posts p ON p.id = n.post_id
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