// ============================================================
//  models/pushModel.js
//  MySQL queries for push_subscriptions (web) and push_tokens (mobile).
//  Used by:
//    • routes/pushRoutes.js   (subscribe / unsubscribe / prefs)
//    • models/notificationModel.js (sendPushToUser)
// ============================================================

const { db } = require('../config/db');
const { Expo } = require('expo-server-sdk');

// Lazy-init so the SDK doesn't load if you never send mobile pushes
let expoClient = null;
function getExpo() {
  if (!expoClient) expoClient = new Expo();
  return expoClient;
}

// Maps pref key names to their column — whitelist prevents injection
const PREF_COLS = {
  likes:       'pref_likes',
  comments:    'pref_comments',
  reposts:     'pref_reposts',
  new_post:    'pref_new_post',
  profile_pic: 'pref_profile_pic',
  follows:     'pref_follows',
  mentions:    'pref_mentions',
};

// Maps prefKey → notifType string the client router expects
const NOTIF_TYPE_MAP = {
  likes:       'like',
  comments:    'comment',
  reposts:     'repost',
  new_post:    'new_post',
  mentions:    'mention',
  follows:     'follow',
  profile_pic: 'profile_pic',
};

// ── Save or update a web subscription ─────────────────────
async function upsertSubscription(userId, subscription, preferences = {}) {
  const {
    likes = true, comments = true, reposts = true,
    new_post = true, profile_pic = true, follows = true, mentions = true,
  } = preferences;

  await db.query(
    `INSERT INTO push_subscriptions
       (user_id, endpoint, p256dh, auth,
        pref_likes, pref_comments, pref_reposts, pref_new_post,
        pref_profile_pic, pref_follows, pref_mentions)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id),
       p256dh  = VALUES(p256dh),
       auth    = VALUES(auth),
       pref_likes       = VALUES(pref_likes),
       pref_comments    = VALUES(pref_comments),
       pref_reposts     = VALUES(pref_reposts),
       pref_new_post    = VALUES(pref_new_post),
       pref_profile_pic = VALUES(pref_profile_pic),
       pref_follows     = VALUES(pref_follows),
       pref_mentions    = VALUES(pref_mentions),
       updated_at       = CURRENT_TIMESTAMP`,
    [
      userId,
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth,
      likes ? 1 : 0, comments ? 1 : 0, reposts ? 1 : 0, new_post ? 1 : 0,
      profile_pic ? 1 : 0, follows ? 1 : 0, mentions ? 1 : 0,
    ]
  );
}

async function deleteSubscription(endpoint) {
  await db.query('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
}

async function updatePreferences(endpoint, preferences = {}) {
  const b = v => (v != null ? (v ? 1 : 0) : null);
  const { likes, comments, reposts, new_post, profile_pic, follows, mentions } = preferences;

  await db.query(
    `UPDATE push_subscriptions SET
       pref_likes       = COALESCE(?, pref_likes),
       pref_comments    = COALESCE(?, pref_comments),
       pref_reposts     = COALESCE(?, pref_reposts),
       pref_new_post    = COALESCE(?, pref_new_post),
       pref_profile_pic = COALESCE(?, pref_profile_pic),
       pref_follows     = COALESCE(?, pref_follows),
       pref_mentions    = COALESCE(?, pref_mentions),
       updated_at       = CURRENT_TIMESTAMP
     WHERE endpoint = ?`,
    [b(likes), b(comments), b(reposts), b(new_post), b(profile_pic), b(follows), b(mentions), endpoint]
  );
}

// ── MOBILE: save or update an Expo push token ─────────────
async function upsertPushToken(userId, token, platform, deviceName = null) {
  if (!Expo.isExpoPushToken(token)) {
    throw new Error('Invalid Expo push token');
  }
  await db.query(
    `INSERT INTO push_tokens (user_id, token, platform, device_name)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id),
       platform = VALUES(platform),
       device_name = VALUES(device_name),
       updated_at = CURRENT_TIMESTAMP`,
    [userId, token, platform, deviceName]
  );
}

async function deletePushToken(token) {
  await db.query('DELETE FROM push_tokens WHERE token = ?', [token]);
}

// ── MOBILE: fan out to all of a user's devices via Expo ───
async function sendMobilePushToUser(userId, title, body, data = {}) {
  const [rows] = await db.query(
    'SELECT token FROM push_tokens WHERE user_id = ?',
    [userId]
  );
  if (!rows.length) return;

  const messages = [];
  for (const { token } of rows) {
    if (!Expo.isExpoPushToken(token)) continue;
    messages.push({
      to: token,
      sound: 'default',
      title,
      body,
      data: {
        ...data,
        // The client hook reads this to route the tap
        notifType: data.notifType || null,
        postId:    data.postId  ? Number(data.postId)  : null,
        actorId:   data.actorId ? Number(data.actorId) : null,
        notifId:   data.notifId ? Number(data.notifId) : null,
      },
      priority: 'high',
      channelId: 'default',
    });
  }
  if (!messages.length) return;

  const expo = getExpo();

  // Expo accepts up to 100 messages per request
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const receipts = await expo.sendPushNotificationsAsync(chunk);
      // Handle invalid tokens — remove them so we don't keep retrying
      receipts.forEach((receipt, idx) => {
        if (receipt.status === 'error') {
          const code = receipt.details?.error;
          if (code === 'DeviceNotRegistered' || code === 'InvalidCredentials') {
            const badToken = chunk[idx].to;
            deletePushToken(badToken).catch(() => {});
          } else {
            console.warn('[Push] Expo error:', code, receipt.message);
          }
        }
      });
    } catch (err) {
      console.error('[Push] Expo send failed:', err.message);
    }
  }
}

// ── UNIFIED: fan out to web AND mobile ────────────────────
async function sendPushToUser(
  userId,
  prefKey,
  title,
  body,
  url = './',
  { postId = null, actorId = null, notifId = null, commentId = null, parentCommentId = null, sessionId = null } = {}
) {
  // 1) Mobile — Expo push tokens (always send if the user has any)
  //    Preference filtering for mobile is handled by the client when registering,
  //    or add a `prefs` column to push_tokens if you want per-type control.
  sendMobilePushToUser(userId, title, body, {
    notifType: prefKey,
    postId, actorId, notifId,
    commentId, parentCommentId, sessionId,
    url,
  }).catch(err => console.error('[Push] mobile dispatch error:', err.message));

  // 2) Web — legacy VAPID subscriptions (unchanged)
  if (!global.webpush) return;
  const col = PREF_COLS[prefKey];
  if (!col) return;

  const [rows] = await db.query(
    `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ? AND ${col} = 1`,
    [userId]
  );
  if (!rows.length) return;

  const POST_TYPES  = ['likes', 'comments', 'reposts', 'new_post', 'mentions'];
  const ACTOR_TYPES = ['follows', 'profile_pic'];
  let tag;
  if (POST_TYPES.includes(prefKey) && postId) {
    tag = `${prefKey}-${postId}`;
  } else if (ACTOR_TYPES.includes(prefKey) && actorId) {
    tag = `${prefKey}-${actorId}`;
  } else {
    tag = `circle-${prefKey}`;
  }

  const payload = JSON.stringify({
    title, body,
    icon: './icon.svg',
    badge: './icon.svg',
    tag,
    data: {
      notifType: NOTIF_TYPE_MAP[prefKey] || prefKey,
      postId:    postId  ? Number(postId)  : null,
      actorId:   actorId ? Number(actorId) : null,
      notifId:   notifId ? Number(notifId) : null,
      url,
    },
  });

  await Promise.allSettled(
    rows.map(row => {
      const sub = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
      return global.webpush.sendNotification(sub, payload).catch(async err => {
        if (err.statusCode === 410) {
          await db.query('DELETE FROM push_subscriptions WHERE endpoint = ?', [row.endpoint]).catch(() => {});
        }
      });
    })
  );
}

module.exports = {
  upsertSubscription,
  deleteSubscription,
  updatePreferences,
  upsertPushToken,
  deletePushToken,
  sendPushToUser,
};