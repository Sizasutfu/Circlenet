// ============================================================
//  routes/pushRoutes.js
//  Mounted at /api/push in server.js
// ============================================================

const express   = require('express');
const router    = express.Router();
const PushModel = require('../models/pushModel');

// ── POST /api/push/subscribe ──────────────────────────────
router.post('/subscribe', async (req, res) => {
  const { subscription, preferences = {}, userId } = req.body;

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription object.' });
  }
  if (!userId) return res.status(400).json({ error: 'userId is required.' });

  try {
    await PushModel.upsertSubscription(userId, subscription, preferences);
    res.status(201).json({ message: 'Subscribed.' });
  } catch (err) {
    console.error('push/subscribe error:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// ── POST /api/push/unsubscribe ────────────────────────────
router.post('/unsubscribe', async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'endpoint required.' });

  try {
    await PushModel.deleteSubscription(endpoint);
    res.json({ message: 'Unsubscribed.' });
  } catch (err) {
    console.error('push/unsubscribe error:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// ── POST /api/push/preferences ────────────────────────────
router.post('/preferences', async (req, res) => {
  const { endpoint, preferences = {} } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'endpoint required.' });

  try {
    await PushModel.updatePreferences(endpoint, preferences);
    res.json({ message: 'Preferences updated.' });
  } catch (err) {
    console.error('push/preferences error:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});


// ── MOBILE: register / refresh an Expo push token ──
// POST /push/token  { token, platform, deviceName? }
router.post('/token', async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId; // adapt to your auth middleware
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { token, platform, deviceName } = req.body;
    if (!token || !platform) {
      return res.status(400).json({ message: 'token and platform are required' });
    }
    if (!['ios', 'android'].includes(platform)) {
      return res.status(400).json({ message: 'platform must be ios or android' });
    }

    await pushModel.upsertPushToken(userId, token, platform, deviceName || null);
    return res.json({ ok: true });
  } catch (err) {
    console.error('push/token error:', err);
    return res.status(500).json({ message: err.message || 'Server error' });
  }
});

// ── MOBILE: unregister a token (call on logout) ──
// DELETE /push/token  { token }
router.delete('/token', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'token required' });
    await pushModel.deletePushToken(token);
    return res.json({ ok: true });
  } catch (err) {
    console.error('push/token delete error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
