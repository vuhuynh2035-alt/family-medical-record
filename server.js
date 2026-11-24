/**
 * Web Server Cục bộ cho Ứng dụng Family Health Manager
 * Chạy trên máy chủ riêng (HPG2Z4) để phục vụ cho máy tính và điện thoại trong gia đình.
 */

const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0'; // đặt HOST=127.0.0.1 nếu chỉ dùng trên chính máy này
const PUBLIC_DIR = __dirname;

// HTTPS (tùy chọn): đặt SSL_KEY và SSL_CERT là đường dẫn file khóa/chứng chỉ. Cần thiết để dùng khóa PIN
// (Web Crypto) khi mở app từ điện thoại qua địa chỉ IP trong mạng nội bộ, vì trình duyệt chỉ cho phép
// Web Crypto ở HTTPS hoặc localhost.
const USE_HTTPS = !!(process.env.SSL_KEY && process.env.SSL_CERT);

// CHỈ những tệp/thư mục này được phục vụ ra ngoài — không lộ server.js, package.json, .release.json, *.md, v.v.
const PUBLIC_FILES = ['index.html', '404.html', 'sw.js', 'manifest.json', 'version.json', 'favicon.jpg', 'favicon.png'];
const PUBLIC_DIRS = ['css', 'js'];

app.disable('x-powered-by');
app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('X-Frame-Options', 'DENY');
    next();
});

// Thiết lập header kiểm soát bộ nhớ đệm (Cache-Control) tương tự chuẩn PWA
app.use((req, res, next) => {
    const url = req.path;

    // sw.js và version.json không được lưu đệm để client luôn nhận thông báo bản cập nhật mới
    if (url === '/sw.js' || url === '/version.json') {
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (url === '/' || url === '/index.html') {
        res.set('Cache-Control', 'no-cache');
    } else if (url.match(/\.(css|js|png|jpg|jpeg|svg|ico|woff2?)$/)) {
        // Tài nguyên tĩnh được cache 1 ngày (hoặc cập nhật qua cache-busting ?v=...)
        res.set('Cache-Control', 'public, max-age=86400');
    }
    next();
});

// Phục vụ tệp tĩnh theo danh sách trắng
PUBLIC_FILES.forEach(f => {
    app.get('/' + f, (req, res) => res.sendFile(path.join(PUBLIC_DIR, f), { dotfiles: 'deny' }));
});
PUBLIC_DIRS.forEach(d => {
    app.use('/' + d, express.static(path.join(PUBLIC_DIR, d), { dotfiles: 'ignore', index: false }));
});

// Fallback PWA: đường dẫn "trang" (không có đuôi tệp) chuyển về index.html; yêu cầu tệp không tồn tại trả 404 thật.
app.use((req, res) => {
    if (path.extname(req.path)) {
        return res.status(404).type('text/plain').send('Not found');
    }
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Lấy danh sách địa chỉ IP nội bộ của máy chủ HP
function getLocalIpAddresses() {
    const interfaces = os.networkInterfaces();
    const addresses = [];

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Chỉ lấy IPv4 và bỏ qua địa chỉ loopback nội bộ (127.0.0.1)
            if (iface.family === 'IPv4' && !iface.internal) {
                addresses.push(iface.address);
            }
        }
    }
    return addresses;
}

const server = (USE_HTTPS
    ? https.createServer({ key: fs.readFileSync(process.env.SSL_KEY), cert: fs.readFileSync(process.env.SSL_CERT) }, app)
    : http.createServer(app)
).listen(PORT, HOST, () => {
    const SCHEME = USE_HTTPS ? 'https' : 'http';
    const ips = getLocalIpAddresses();

    console.clear();
    console.log('================================================================');
    console.log('       SỔ SỨC KHỎE GIA ĐÌNH - MÁY CHỦ RIÊNG HPG2Z4');
    console.log('================================================================\n');
    console.log(`  [OK] Máy chủ đang hoạt động tại cổng: ${PORT}`);
    console.log('  [OK] Toàn bộ dữ liệu web được phát trực tiếp từ máy tính này.\n');
    console.log('----------------------------------------------------------------');
    console.log('  ĐƯỜNG LINK TRUY CẬP ỨNG DỤNG:');
    console.log('----------------------------------------------------------------');
    console.log(`  * Mở trên máy tính này (HP):`);
    console.log(`    👉 ${SCHEME}://localhost:${PORT}`);
    console.log('');
    console.log(`  * Mở trên Điện thoại / Máy tính bảng / Laptop cùng mạng Wi-Fi:`);
    if (ips.length > 0) {
        ips.forEach(ip => {
            console.log(`    👉 ${SCHEME}://${ip}:${PORT}`);
        });
    } else {
        console.log(`    👉 ${SCHEME}://<IP_MÁY_HP>:${PORT}`);
    }
    console.log('----------------------------------------------------------------');
    if (!USE_HTTPS) {
        console.log('  * Lưu ý: dùng HTTP nên khóa PIN chỉ hoạt động trên chính máy này (localhost). Muốn dùng PIN từ điện thoại,');
        console.log('    hãy đặt biến môi trường SSL_KEY và SSL_CERT để bật HTTPS.');
    }
    console.log('  * Ghi chú: GitHub hiện chỉ đóng vai trò lưu trữ bản sao lưu (backup).');
    console.log('  * Nhấn Ctrl + C để dừng máy chủ.\n');
    console.log('================================================================');
});

// Xử lý dừng máy chủ an toàn
process.on('SIGINT', () => {
    console.log('\nĐang dừng máy chủ...');
    server.close(() => {
        console.log('Đã dừng máy chủ an toàn.');
        process.exit(0);
    });
});
