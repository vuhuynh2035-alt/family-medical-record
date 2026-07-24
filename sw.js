const SW_VERSION = 'v1.8.1';

self.addEventListener('install', (e) => {
  // Không tự động gọi self.skipWaiting() để tránh tự động tải lại trang gây khó chịu
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (e) => {
  return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Trình xử lý fetch cơ bản để đạt chuẩn PWA (Progressive Web App)
  // Thực tế ứng dụng lưu dữ liệu bằng localStorage/IndexedDB nên phần lớn đã offline
  e.respondWith(
    fetch(e.request).catch(() => {
      // Bỏ qua cache phức tạp vì ứng dụng chạy offline sẵn
      return new Response("Ứng dụng đang ngoại tuyến");
    })
  );
});

// Xử lý thông điệp yêu cầu cập nhật bản mới
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
