const SW_VERSION = 'v2.2.3';

self.addEventListener('install', (e) => {
  // Không tự động gọi self.skipWaiting() để tránh tự động tải lại trang gây khó chịu
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

// Xử lý thông điệp yêu cầu cập nhật bản mới (Service Worker chờ -> kích hoạt ngay)
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (e) => {
  // CHỈ can thiệp vào yêu cầu điều hướng trang (document navigation).
  // Trước đây SW bắt TOÀN BỘ request (kể cả gọi API AI, tải ảnh, script CDN...) và
  // trả về một response văn bản giả khi mạng lỗi -> gây lỗi khó hiểu (vd: script CDN
  // tải thất bại lại nhận về text thay vì JS nên vỡ trang, hoặc lời gọi API AI nhận
  // "response" giả thay vì báo lỗi mạng rõ ràng). Giới hạn lại đúng phạm vi fallback.
  if (e.request.mode !== 'navigate') {
    return; // Để trình duyệt xử lý request bình thường (không respondWith)
  }

  e.respondWith(
    fetch(e.request).catch(() => {
      return new Response(
        '<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Ngoại tuyến</title></head>' +
        '<body style="font-family:sans-serif;text-align:center;padding:40px;">' +
        '<h2>Bạn đang ngoại tuyến</h2><p>Không thể tải trang. Vui lòng kiểm tra kết nối mạng và thử lại.</p>' +
        '</body></html>',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    })
  );
});
