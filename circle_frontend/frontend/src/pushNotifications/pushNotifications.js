/* ══════════════════════════════════════════════════════════════════
         PUSH NOTIFICATIONS
         ══════════════════════════════════════════════════════════════════
         Flow:
           1. User flips toggle → request Notification permission
           2. On grant → subscribe via pushManager with VAPID key
           3. POST subscription endpoint to /api/push/subscribe
           4. On unsubscribe → POST to /api/push/unsubscribe
           5. Service worker handles push events and shows system notifications
           6. Preference toggles (likes/comments/etc) POST to /api/push/preferences

         VAPID public key: replace the placeholder below with your real key.
         Generate with: npx web-push generate-vapid-keys
      ══════════════════════════════════════════════════════════════════ */

// ── VAPID public key (replace with your real key) ──────────────
const VAPID_PUBLIC_KEY =
  "BDrQXFG6fUBbN110-JFtCCpHYAcHYvIdoExS1tolzULYEOBI1Ky2d-Rdsk-q071dk1DE7o_n2sje_xvxLUOFPWQ";

function _urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// ── Sync the push toggle to reflect actual subscription state ───
async function _syncPushToggle() {
  const toggle = document.getElementById("notif-push");
  const sub = document.getElementById("push-notif-sub");
  const deniedBadge = document.getElementById("push-notif-denied-badge");
  const toggleLabel = document.getElementById("push-notif-toggle-label");
  if (!toggle) return;

  if (!("Notification" in window) || !("PushManager" in window)) {
    // Browser doesn't support push
    toggle.disabled = true;
    if (sub) sub.textContent = "Not supported in this browser";
    return;
  }

  const perm = Notification.permission;

  if (perm === "denied") {
    toggle.checked = false;
    toggle.disabled = true;
    if (toggleLabel) toggleLabel.style.display = "none";
    if (deniedBadge) deniedBadge.style.display = "";
    if (sub)
      sub.textContent = "Blocked by browser — update in your browser settings";
    return;
  }

  if (toggleLabel) toggleLabel.style.display = "";
  if (deniedBadge) deniedBadge.style.display = "none";
  toggle.disabled = false;

  if (perm === "granted" && _swRegistration) {
    try {
      const existing = await _swRegistration.pushManager.getSubscription();
      toggle.checked = !!existing;
      if (sub)
        sub.textContent = existing
          ? "You're subscribed — notifications are active"
          : "Enable browser push notifications";
    } catch {
      toggle.checked = false;
    }
  } else {
    toggle.checked = false;
    if (sub) sub.textContent = "Enable browser push notifications";
  }
}

// ── Subscribe to push ───────────────────────────────────────────
async function _subscribePush() {
  if (!_swRegistration) throw new Error("Service worker not ready");
  const applicationServerKey = _urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  const subscription = await _swRegistration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });
  // Send subscription to your backend
  try {
    await api("POST", "/api/push/subscribe", {
      subscription: subscription.toJSON(),
      preferences: _getPushPreferences(),
      userId:
        currentUser?.id || JSON.parse(localStorage.getItem("circle_user"))?.id,
    });
  } catch {
    // Server not yet set up — subscription is still stored client-side
  }
  return subscription;
}

// ── Unsubscribe from push ───────────────────────────────────────
async function _unsubscribePush() {
  if (!_swRegistration) return;
  const sub = await _swRegistration.pushManager.getSubscription();
  if (!sub) return;
  try {
    await api(
      "POST",
      "/api/push/unsubscribe",
      JSON.stringify({
        endpoint: sub.endpoint,
      }),
    );
  } catch {
    /* server may not be configured */
  }
  await sub.unsubscribe();
}

// ── Read the per-type notification preference toggles ───────────
function _getPushPreferences() {
  return {
    likes: document.getElementById("notif-likes")?.checked ?? true,
    comments: document.getElementById("notif-comments")?.checked ?? true,
    reposts: document.getElementById("notif-reposts")?.checked ?? true,
    new_post: document.getElementById("notif-new_post")?.checked ?? true,
    profile_pic: document.getElementById("notif-profile_pic")?.checked ?? true,
    follows: document.getElementById("notif-follows")?.checked ?? true,
    mentions: document.getElementById("notif-mentions")?.checked ?? true,
  };
}

// ── Handle a push notification click → navigate to the right place ──
async function _handlePushNotifClick(data) {
  // data shape sent by the service worker:
  // { type: 'NOTIFICATION_CLICK', notifType, postId, actorId, notifId }
  const { notifType, postId, actorId, notifId } = data;

  // Debug: open DevTools Console to see exactly what arrived
  console.log("[Circle] _handlePushNotifClick received:", data);

  // Mark as read server-side (best-effort)
  if (notifId) {
    try {
      await api("PUT", `/api/notifications/${notifId}/read`);
    } catch (_) {}
  }

  // Bring the window to the foreground (no-op if already focused)
  window.focus();

  // Route exactly like onNotifClick() does for in-app notification taps
  if (notifType === "profile_pic" || notifType === "follow") {
    if (actorId) {
      viewProfile(actorId);
    } else goTo("feed");
  } else if (notifType === "milestone") {
    goTo("profile");
  } else if (postId) {
    // like / comment / repost / mention / reply / new_post → open the post
    // For comment/like/repost/reply always fetch fresh so new reactions show immediately
    const needsFresh =
      notifType === "comment" ||
      notifType === "like" ||
      notifType === "repost" ||
      notifType === "reply";
    const cached =
      !needsFresh &&
      (posts.find((p) => p.id === postId) || PostCache.getPost(postId));
    if (cached) {
      renderPostDetail(cached);
      goTo("post-detail");
    } else {
      try {
        const res = await api("GET", `/api/posts/${postId}`);
        const found = res.data;
        if (found) {
          PostCache.putPost(found);
          renderPostDetail(found);
          goTo("post-detail");
        } else {
          showToast("Post not found.");
          goTo("feed");
        }
      } catch (e) {
        showToast("Could not load post.");
        goTo("feed");
      }
    }
  } else {
    // Fallback: open notifications panel so user can see what's new
    goTo("feed");
    setTimeout(openNotifPanel, 300);
  }

  // Refresh notification badge / list
  fetchUnreadCount();
  fetchNotifications(true);
}

// ── Called when the push toggle is flipped ──────────────────────
async function handlePushToggle(enabled) {
  const toggle = document.getElementById("notif-push");
  const subEl = document.getElementById("push-notif-sub");

  if (!("Notification" in window) || !("PushManager" in window)) {
    showToast("Push notifications are not supported in this browser.");
    if (toggle) toggle.checked = false;
    return;
  }

  if (enabled) {
    // Request permission first
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      if (toggle) toggle.checked = false;
      if (perm === "denied") {
        showToast(
          "Notifications blocked. Please allow them in your browser settings.",
        );
        _syncPushToggle();
      } else {
        showToast("Notification permission was dismissed.");
      }
      return;
    }

    try {
      if (toggle) toggle.disabled = true;
      if (subEl) subEl.textContent = "Subscribing…";
      await _subscribePush();
      showToast("Push notifications enabled! 🔔");
      if (subEl)
        subEl.textContent = "You're subscribed — notifications are active";

      // Fire a welcome notification so the user can confirm it works
      setTimeout(() => {
        if (_swRegistration) {
          _swRegistration.showNotification("Circle notifications are on! 🎉", {
            body: "You'll now get notified about likes, comments, and more.",
            icon: "./icon.svg",
            badge: "./icon.svg",
            tag: "circle-welcome",
            vibrate: [100, 50, 100],
          });
        }
      }, 800);
    } catch (err) {
      showToast("Could not enable push notifications: " + err.message);
      if (toggle) toggle.checked = false;
      if (subEl) subEl.textContent = "Enable browser push notifications";
    } finally {
      if (toggle) toggle.disabled = false;
    }
  } else {
    try {
      await _unsubscribePush();
      showToast("Push notifications disabled.");
      if (subEl) subEl.textContent = "Enable browser push notifications";
    } catch (err) {
      showToast("Error unsubscribing: " + err.message);
      // Re-sync to reflect true state
      _syncPushToggle();
    }
  }
}

// ── Sync push prefs to server whenever a type toggle changes ────
async function _savePushPreferences() {
  if (!_swRegistration) return;
  const sub = await _swRegistration.pushManager
    .getSubscription()
    .catch(() => null);
  if (!sub) return;
  try {
    await api(
      "POST",
      "/api/push/preferences",
      JSON.stringify({
        endpoint: sub.endpoint,
        preferences: _getPushPreferences(),
      }),
    );
  } catch {
    /* server may not be configured */
  }
}

// Attach preference-save listener to each per-type toggle
[
  "notif-likes",
  "notif-comments",
  "notif-reposts",
  "notif-new_post",
  "notif-profile_pic",
  "notif-follows",
  "notif-mentions",
].forEach((id) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("change", _savePushPreferences);
});

// Initial sync once DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", _syncPushToggle);
} else {
  _syncPushToggle();
}
