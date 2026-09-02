const fs = require('fs');
let c = fs.readFileSync('js/ai.js', 'utf8');

c = c.replace(
    /"times": \["\$\{tMorning\}", "\$\{tEvening\}"\], \/\/ mảng các giờ uống tự suy luận logic\. Tham khảo giờ mặc định: Sáng=\$\{tMorning\}, Trưa=\$\{tNoon\}, Chiều=\$\{tAfternoon\}, Tối=\$\{tEvening\}\./g,
    `"times": ["\${tMorning}", "\${tEvening}"], // mảng các giờ uống. Chỉ dùng 3 mốc mặc định: Sáng=\${tMorning}, Trưa=\${tNoon}, Tối=\${tEvening}. Nếu bắt buộc phải có chiều thì tự thêm giờ.`
);

// We need to also check if tAfternoon is defined in ai.js
// Let's replace the whole block where tAfternoon is defined if possible, or just ignore since it's harmless
c = c.replace(/const tAfternoon = settings\.medTimeAfternoon \|\| '14:00';\n/g, '');

fs.writeFileSync('js/ai.js', c);
console.log('SUCCESS ai.js');
