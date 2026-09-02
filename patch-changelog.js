const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

code = code.replace(/const APP_CHANGELOG = \{/, "const APP_CHANGELOG = {\n    'v2.9.49': '• Cập nhật thuật toán tính năng Đọc (Karaoke Mode) và sửa lỗi tự động cuộn.',");

fs.writeFileSync('js/app.js', code);
console.log("Added changelog");
