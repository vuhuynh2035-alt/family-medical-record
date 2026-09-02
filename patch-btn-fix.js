const fs = require('fs');

// 1. UPDATE index.html
let html = fs.readFileSync('index.html', 'utf8');
const oldBtn = /<button type="button" id="btn-tts-mode"[\s\S]*?<\/button>/;
const newBtn = `<button type="button" id="btn-tts-mode" class="tts-ctrl-btn" title="Bật/Tắt chế độ đọc khi khóa màn hình" style="width: auto; padding: 4px 10px; font-size: 11.5px; font-weight: 700; color: #fff; background: rgba(255,255,255,0.2); display: flex; align-items: center; gap: 4px; border-radius: 20px;">
                <span class="material-symbols-rounded" id="tts-mode-icon" style="font-size: 16px;">screen_lock_landscape</span> <span id="tts-mode-text">Màn hình sáng</span>
            </button>`;
html = html.replace(oldBtn, newBtn);
fs.writeFileSync('index.html', html);

// 2. UPDATE app.js
let js = fs.readFileSync('js/app.js', 'utf8');

const ttsEvents = `document.getElementById('btn-tts-speed')?.addEventListener('click', () => TTSService.toggleSpeed());`;
const ttsModeLogic = `document.getElementById('btn-tts-speed')?.addEventListener('click', () => TTSService.toggleSpeed());

document.getElementById('btn-tts-mode')?.addEventListener('click', () => {
    if (!window.TTSService) return;
    const btn = document.getElementById('btn-tts-mode');
    
    if (TTSService.voiceProvider === 'system') {
        TTSService.voiceProvider = 'google_translate';
        localStorage.setItem('tts_voice_provider', 'google_translate');
        document.getElementById('tts-mode-icon').innerText = 'screen_lock_portrait';
        document.getElementById('tts-mode-text').innerText = 'Chạy nền';
        btn.style.background = 'rgba(251, 191, 36, 0.2)'; // yellow bg
        btn.style.color = '#fcd34d'; // yellow text
        if (typeof showToast !== 'undefined') showToast('Đã BẬT chế độ đọc nền (có thể tắt màn hình)');
    } else {
        TTSService.voiceProvider = 'system';
        localStorage.setItem('tts_voice_provider', 'system');
        document.getElementById('tts-mode-icon').innerText = 'screen_lock_landscape';
        document.getElementById('tts-mode-text').innerText = 'Màn hình sáng';
        btn.style.background = 'rgba(255,255,255,0.2)';
        btn.style.color = '#fff';
        if (typeof showToast !== 'undefined') showToast('Đã chuyển về Giọng đọc tự nhiên (Màn hình sáng)');
    }
    
    // Cập nhật ngay nếu đang đọc
    if (TTSService.isPlaying && !TTSService.isPaused) {
        const tempChunks = [...TTSService.chunks];
        const tempIdx = TTSService.currentChunkIndex;
        const tempBtn = TTSService.activeBtnElement;
        const tempType = TTSService.currentType;
        const tempContainer = TTSService.activeContainerElement;
        
        const titleEl = document.getElementById('tts-player-title');
        const tempTitle = titleEl ? titleEl.title : 'Đang đọc';
        
        TTSService.stop();
        setTimeout(() => {
            TTSService.chunks = tempChunks;
            TTSService.currentChunkIndex = tempIdx;
            TTSService.isPlaying = true;
            TTSService.activeBtnElement = tempBtn;
            TTSService.currentType = tempType;
            TTSService.activeContainerElement = tempContainer;
            TTSService.showPlayerUI(tempTitle);
            TTSService.setButtonState(true);
            TTSService.setContainerHighlight(true);
            TTSService.playNextChunk();
        }, 100);
    }
});

// Init state UI
if (localStorage.getItem('tts_voice_provider') === 'google_translate') {
    const icon = document.getElementById('tts-mode-icon');
    const text = document.getElementById('tts-mode-text');
    const btn = document.getElementById('btn-tts-mode');
    if (icon) icon.innerText = 'screen_lock_portrait';
    if (text) text.innerText = 'Chạy nền';
    if (btn) {
        btn.style.background = 'rgba(251, 191, 36, 0.2)';
        btn.style.color = '#fcd34d';
    }
}
`;
if(!js.includes("btn-tts-mode")) {
    js = js.replace(ttsEvents, ttsModeLogic);
    fs.writeFileSync('js/app.js', js);
    console.log("Successfully patched JS");
} else {
    console.log("JS already contains btn-tts-mode");
}
