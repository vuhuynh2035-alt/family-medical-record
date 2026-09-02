const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');

const regexSettings = /<h4 style="margin-bottom: 15px; color: var\(--primary-blue\); display: flex; align-items: center; gap: 5px;">[\s\S]*?<span class="material-symbols-rounded">pill<\/span> Cài đặt Giờ uống thuốc mặc định[\s\S]*?<\/h4>[\s\S]*?<p style="font-size: 13px; color: var\(--text-muted\); margin-bottom: 15px;">Thiết lập các mốc giờ uống thuốc cá nhân của bạn\. AI sẽ ưu tiên sử dụng các mốc giờ này khi tự động lên lịch nhắc nhở\.<\/p>[\s\S]*?<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;

if (c.match(regexSettings)) {
    c = c.replace(regexSettings, '');
    console.log("Deleted Settings block");
} else {
    console.log("Could not find settings block regex");
}

fs.writeFileSync('index.html', c);
