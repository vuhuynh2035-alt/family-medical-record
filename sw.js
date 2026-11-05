const SW_VERSION = 'v2.9.107';
const CACHE_NAME = `family-health-static-${SW_VERSION}`;
const BUILD_TIME = '2026-11-05_22-45';

const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/data.js',
  './js/ai.js',
  './js/components.js',
  './js/help.js',
  './js/i18n.js',
  './js/speech.js',
  './manifest.json',
  './version.json',
  './favicon.jpg',
  './favicon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        STATIC_ASSETS.map((url) => cache.add(url).catch((err) => {
          console.warn('[SW] Cache asset failed:', url, err);
        }))
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./index.html');
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw.js') || url.pathname.endsWith('/version.json')) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response && response.ok && response.type === 'basic') {
        const copy = response.clone();
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, copy).catch(() => {});
      }
      return response;
    } catch (err) {
      const cached = await caches.match(event.request, { ignoreSearch: true })
        || (event.request.mode === 'navigate' ? await caches.match('./index.html') : null);
      if (cached) return cached;
      if (event.request.mode === 'navigate') {
        return new Response(
          '<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Ngoại tuyến</title></head>' +
          '<body style="font-family:sans-serif;text-align:center;padding:40px;">' +
          '<h2>Bạn đang ngoại tuyến</h2><p>Không thể tải trang. Hãy kiểm tra mạng rồi mở lại.</p>' +
          '</body></html>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 }
        );
      }
      throw err;
    }
  })());
});
