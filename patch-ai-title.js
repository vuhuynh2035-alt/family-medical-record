const fs = require('fs');
let c = fs.readFileSync('js/ai.js', 'utf8');

c = c.replace(
    /"title": "Tên lịch hẹn \(vd: Tái khám, Xét nghiệm máu, Siêu âm, Nhắc nhở tiêm\)",/g,
    `"title": "Tên lịch hẹn (BẮT BUỘC KÈM TÊN CHUYÊN KHOA HOẶC PHÒNG KHÁM, vd: Tái khám Khoa Sản, Xét nghiệm máu Nhi Đồng... để tránh trùng lặp)",`
);

fs.writeFileSync('js/ai.js', c);
console.log('SUCCESS ai.js title prompt updated');
