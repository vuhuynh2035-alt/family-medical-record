const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

// Combine duplicate v2.9.52 changelogs
code = code.replace(/'v2\.9\.52': '• Thêm tính năng[\s\S]*?'v2\.9\.52': '• Cập nhật thuật toán[\s\S]*?'v2\.9\.52': '• Cải tiến tính năng[\s\S]*?',/, 
`'v2.9.52': '• Cải tiến tính năng Đọc (TTS): Hỗ trợ chạy nền khi tắt màn hình, chọn đọc từ bất kỳ đâu (Karaoke mode), và cuộn tự động.\\n• Đã vá lỗi sự cố nút Tạm dừng / Tiếp tục và Tốc độ đọc trên thanh công cụ.\\n• Khắc phục thuật toán Đọc Karaoke (chọn chữ để đọc) bị treo.',`);

fs.writeFileSync('js/app.js', code);
console.log("Fixed duplicate changelog keys");
