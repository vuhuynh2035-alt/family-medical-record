const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

// Fix string literals that were split into multiple lines
code = code.replace(/'v2\.9\.56': '• Cải tiến tính năng Đọc \(TTS\): Hỗ trợ chạy nền khi tắt màn hình, chọn đọc từ bất kỳ đâu \(Karaoke mode\), và cuộn tự động.\n• Đã vá lỗi sự cố nút Tạm dừng \/ Tiếp tục và Tốc độ đọc trên thanh công cụ.\n• Khắc phục thuật toán Đọc Karaoke \(chọn chữ để đọc\) bị treo.',/g, 
"'v2.9.56': '• Cải tiến tính năng Đọc (TTS): Hỗ trợ chạy nền khi tắt màn hình, chọn đọc từ bất kỳ đâu (Karaoke mode), và cuộn tự động.\\n• Đã vá lỗi sự cố nút Tạm dừng / Tiếp tục và Tốc độ đọc trên thanh công cụ.\\n• Khắc phục thuật toán Đọc Karaoke (chọn chữ để đọc) bị treo.',");

code = code.replace(/'v2\.9\.47': `\n/g, "'v2.9.47': `\\n"); // Or something similar if it uses template literal
// Actually, template literals CAN span multiple lines.

// Let's just fix the APP_CHANGELOG single quoted string specifically
const badStringRegex = /'v2\.9\.56': '• Cải tiến[^']*?',/;
code = code.replace(badStringRegex, 
"'v2.9.56': '• Cải tiến tính năng Đọc (TTS): Hỗ trợ chạy nền khi tắt màn hình, chọn đọc từ bất kỳ đâu (Karaoke mode), và cuộn tự động.\\n• Đã vá lỗi sự cố nút Tạm dừng / Tiếp tục và Tốc độ đọc trên thanh công cụ.\\n• Khắc phục thuật toán Đọc Karaoke (chọn chữ để đọc) bị treo.',");

fs.writeFileSync('js/app.js', code);
console.log("Success");
