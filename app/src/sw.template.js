// Service worker: makes the app open instantly and work with a weak signal.
// App files are cached on install; pages fall back to the cached shell when offline.
// Data requests (Supabase) always go to the network.
const VERSION = '__VERSION__';
const CACHE = `sunday-board-${VERSION}`;
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !isFont) return; // Supabase and anything else: straight to the network

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')));
    return;
  }
  event.respondWith(
    caches.match(request).then((hit) => hit || fetch(request).then((res) => {
      if (res.ok && (isFont || url.pathname.startsWith('/assets/'))) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
      }
      return res;
    })),
  );
});

// Notifications: reminders sent by the `push` Edge Function.
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(d.title || 'Sunday Board', {
    body: d.body || '',
    icon: '/icons/icon-192.png',
    tag: d.tag,
    data: { url: d.url || '/#/todos' },
  }));
});

// Tapping a notification opens the app (or brings it forward) at the right screen.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if ('focus' in w) {
        try { await w.navigate(url); } catch { /* some browsers refuse; focusing is enough */ }
        return w.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});

// The push service replaced this phone's address (it can do so at any time). Get the
// new one and tell the server, proving it's us with the old address.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const old = event.oldSubscription;
    let sub = event.newSubscription;
    if (!sub && old && old.options) sub = await self.registration.pushManager.subscribe(old.options);
    if (!old || !sub) return;   // the app re-checks and renews when it next opens
    const j = sub.toJSON();
    await fetch('https://ecgskwekeitfqtjvprao.supabase.co/functions/v1/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resubscribe', old: old.endpoint, endpoint: j.endpoint, keys: j.keys }),
    });
  })().catch(() => { /* the app's own check will fix it */ }));
});
