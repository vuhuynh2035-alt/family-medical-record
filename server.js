/**
 * Web Server Cục bộ cho Ứng dụng Family Health Manager
 * Chạy trên máy chủ riêng (HPG2Z4) để phục vụ cho máy tính và điện thoại trong gia đình.
 */

const express = require('express');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = __dirname;

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

// Phục vụ toàn bộ tệp tĩnh từ thư mục hiện tại
app.use(express.static(PUBLIC_DIR, {
    index: 'index.html',
    dotfiles: 'ignore'
}));

// Fallback: mọi đường dẫn không tồn tại đều chuyển hướng về index.html (hỗ trợ PWA)
app.use((req, res) => {
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

const server = app.listen(PORT, '0.0.0.0', () => {
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
    console.log(`    👉 http://localhost:${PORT}`);
    console.log('');
    console.log(`  * Mở trên Điện thoại / Máy tính bảng / Laptop cùng mạng Wi-Fi:`);
    if (ips.length > 0) {
        ips.forEach(ip => {
            console.log(`    👉 http://${ip}:${PORT}`);
        });
    } else {
        console.log(`    👉 http://<IP_MÁY_HP>:${PORT}`);
    }
    console.log('----------------------------------------------------------------');
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
