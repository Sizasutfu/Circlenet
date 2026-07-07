const CACHE_NAME = 'circlenet-v3';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon.png',
  '/icon-maskable.png',
  '/favicon.ico',
  '/offline.html', // optional
];

// ── Install: cache static assets ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Pre-cache static assets (including /)
        return Promise.allSettled(
          STATIC_ASSETS.map((url) =>
            cache.add(url).catch((err) => {
              console.warn(`[SW] Failed to cache ${url}:`, err);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ── Activate: remove old caches ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network-first for navigation, cache-first for assets ──
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip cross-origin, non-GET, and API requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // For navigation (HTML) – try network first, fallback to cache, then offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the fresh response
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(async () => {
          // Try cache
          const cached = await caches.match(request);
          if (cached) return cached;
          // Fallback to offline page
          const offline = await caches.match('/offline.html');
          if (offline) return offline;
          // Ultimate fallback: return a simple offline message
          return new Response('Offline', { status: 503 });
        })
    );
    return;
  }

  // For static assets – cache first, fallback to network
  event.respondWith(
    caches.match(request)
      .then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            // Cache successful responses
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => new Response('Offline', { status: 503 }));
      })
  );
});

// ── Push: display notification ──
self.addEventListener('push', (event) => {
  let payload = {
    title: 'Circle',
    body: 'You have a new notification',
    icon: '/icon.png',
    badge: '/icon.png',
    tag: 'circle-notification',
    data: { url: '/' },
  };

  if (event.data) {
    try {
      const incoming = event.data.json();
      payload = { ...payload, ...incoming };
      if (incoming.data) payload.data = { ...payload.data, ...incoming.data };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      tag: payload.tag,
      data: payload.data,
      vibrate: [100, 50, 100],
      renotify: true,
    })
  );
});

// ── Notification Click: deep-link ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notifData = event.notification.data || {};
  let notifType = notifData.notifType || null;
  let postId = notifData.postId ? Number(notifData.postId) : null;
  let actorId = notifData.actorId ? Number(notifData.actorId) : null;
  let notifId = notifData.notifId ? Number(notifData.notifId) : null;
  const fallback = notifData.url || '/';

  const msgPayload = {
    type: 'NOTIFICATION_CLICK',
    notifType,
    postId,
    actorId,
    notifId,
  };

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.postMessage(msgPayload);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(fallback);
      }
    })
  );
});