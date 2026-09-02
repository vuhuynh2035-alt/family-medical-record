const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

// 1. Update speak() signature
code = code.replace(
    /speak\(text, title = 'Đang đọc nội dung\.\.\.', btnTarget = null, type = null, containerTarget = null\) \{/,
    `speak(text, title = 'Đang đọc nội dung...', btnTarget = null, type = null, containerTarget = null, startChunkText = null) {`
);

// 2. Inside speak(), before playNextChunk(), check startChunkText
code = code.replace(
    /this\.setButtonState\(true\);\s*this\.setContainerHighlight\(true\);\s*this\.playNextChunk\(\);/,
    `this.setButtonState(true);
        this.setContainerHighlight(true);

        if (startChunkText) {
            const chunkLower = startChunkText.toLowerCase();
            const chunkIndex = this.chunks.findIndex(c => chunkLower.includes(c.toLowerCase()) || c.toLowerCase().includes(chunkLower.substring(0, 20)));
            if (chunkIndex !== -1) {
                this.currentChunkIndex = chunkIndex;
            }
        }

        this.playNextChunk();`
);

// 3. Update the click listener to pass startChunkText and remove the substring logic!
const oldClickListener = /\/\/ If not playing, or chunk not found, read from this specific block down to the end of its section[\s\S]*?TTSService\.speak\(textToRead, 'Đọc nội dung', container, 'karaoke', container\);\n\s*\}/;

const newClickListener = `// If not playing, or chunk not found, read from this specific block down to the end of its section
            const container = block.closest('.detail-section-card') || viewRecordContent;
            const fullText = container.innerText || '';
            
            if (fullText && window.TTSService) {
                if(typeof showToast !== 'undefined') showToast("Bắt đầu đọc từ: " + clickedText.substring(0, 20) + "...");
                TTSService.speak(fullText, 'Đọc nội dung', container, 'karaoke', container, clickedText);
            }`;

code = code.replace(oldClickListener, newClickListener);

fs.writeFileSync('js/app.js', code);
console.log("Patched karaoke click logic!");
