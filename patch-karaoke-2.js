const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

const regex = /\/\/ If not playing, or chunk not found[\s\S]*?TTSService\.speak\(textToRead, 'Đọc nội dung', container, 'karaoke', container\);\s*\}/;

const newClickListener = `// If not playing, or chunk not found, read from this specific block down to the end of its section
            const container = block.closest('.detail-section-card') || viewRecordContent;
            const fullText = container.innerText || '';
            
            if (fullText && window.TTSService) {
                if(typeof showToast !== 'undefined') showToast("Bắt đầu đọc từ: " + clickedText.substring(0, 20) + "...");
                TTSService.speak(fullText, 'Đọc nội dung', container, 'karaoke', container, clickedText);
            }`;

code = code.replace(regex, newClickListener);

fs.writeFileSync('js/app.js', code);
console.log(code.includes("showToast(\"Bắt đầu đọc từ: \"") ? "Success" : "Failed");
