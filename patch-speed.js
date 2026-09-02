const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

const regex = /if \(btn\) btn\.innerText = labels\[idx\];/;
const newCode = `if (btn) btn.innerText = labels[idx];
        if (this.audioFallback) this.audioFallback.playbackRate = this.speed;
        if (typeof showToast !== 'undefined') showToast('Tốc độ đọc: ' + desc[idx]);
        
        // Cập nhật ngay nếu đang đọc bằng speechSynthesis
        if (this.isPlaying && !this.isPaused && this.voiceProvider === 'system') {
            const tempChunks = [...this.chunks];
            const tempIdx = this.currentChunkIndex;
            const tempBtn = this.activeBtnElement;
            const tempType = this.currentType;
            const tempContainer = this.activeContainerElement;
            const titleEl = document.getElementById('tts-player-title');
            const tempTitle = titleEl ? titleEl.title : 'Đang đọc';
            
            this.stop();
            setTimeout(() => {
                this.chunks = tempChunks;
                this.currentChunkIndex = tempIdx;
                this.isPlaying = true;
                this.activeBtnElement = tempBtn;
                this.currentType = tempType;
                this.activeContainerElement = tempContainer;
                this.showPlayerUI(tempTitle);
                this.setButtonState(true);
                this.setContainerHighlight(true);
                this.playNextChunk();
            }, 50);
        }`;

code = code.replace(regex, newCode);
fs.writeFileSync('js/app.js', code);
console.log(code.includes("showToast('Tốc độ đọc:") ? "Success" : "Failed");
