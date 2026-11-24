const SW_VERSION = 'v2.9.108';
const CACHE_NAME = `family-health-static-${SW_VERSION}`;
const NETWORK_TIMEOUT_MS = 4000;
const BUILD_TIME = '2026-11-05_22-45';

const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/data.js',
  './js/ai-policy.js',
  './js/ai.js',
  './js/ai-settings-ui.js',
  './js/components.js',
  './js/help.js',
  './js/i18n.js',
  './js/speech.js',
  './js/vendor/cropper.min.js',
  './js/vendor/marked.min.js',
  './js/vendor/purify.min.js',
  './js/vendor/html2pdf.bundle.min.js',
  './js/vendor/pdf.min.js',
  './js/vendor/pdf.worker.min.js',
  './css/vendor/cropper.min.css',
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
    const isNavigate = event.request.mode === 'navigate';
    const fromCache = async () => (await caches.match(event.request, { ignoreSearch: true }))
      || (isNavigate ? await caches.match('./index.html') : null);
    // Luôn thử MẠNG trước để nhận bản mới nhất; riêng khi mạng yếu/treo quá NETWORK_TIMEOUT_MS thì dùng bản nhớ tạm (nếu có)
    const network = fetch(event.request).then(async (response) => {
      if (response && response.ok && response.type === 'basic') {
        const copy = response.clone();
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, copy).catch(() => {});
      }
      return response;
    });
    network.catch(() => {}); // tránh cảnh báo promise bị từ chối khi đã dùng bản nhớ tạm
    try {
      const cachedNow = await fromCache();
      if (!cachedNow) return await network;
      const timeout = new Promise((resolve) => setTimeout(() => resolve(cachedNow), NETWORK_TIMEOUT_MS));
      return await Promise.race([network, timeout]);
    } catch (err) {
      const cached = await fromCache();
      if (cached) return cached;
      if (isNavigate) {
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
