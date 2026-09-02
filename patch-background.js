const fs = require('fs');

// 1. UPDATE index.html
let html = fs.readFileSync('index.html', 'utf8');
const btnSpeed = `<button type="button" id="btn-tts-speed"`;
const btnMode = `<button type="button" id="btn-tts-mode" class="tts-ctrl-btn" title="Bật/Tắt chế độ đọc khi khóa màn hình" style="width: auto; padding: 0 8px; font-size: 11px; font-weight: 600; color: #8e44ad; display: flex; align-items: center; gap: 4px;">
                <span class="material-symbols-rounded" id="tts-mode-icon" style="font-size: 16px;">screen_lock_landscape</span> <span id="tts-mode-text">Màn hình sáng</span>
            </button>\n            ` + btnSpeed;
html = html.replace(btnSpeed, btnMode);
fs.writeFileSync('index.html', html);

// 2. UPDATE app.js
let js = fs.readFileSync('js/app.js', 'utf8');

const ttsEvents = `    document.getElementById('btn-tts-speed')?.addEventListener('click', () => {`;
const ttsModeLogic = `
    document.getElementById('btn-tts-mode')?.addEventListener('click', () => {
        if (!window.TTSService) return;
        if (TTSService.voiceProvider === 'system') {
            TTSService.voiceProvider = 'google_translate';
            localStorage.setItem('tts_voice_provider', 'google_translate');
            document.getElementById('tts-mode-icon').innerText = 'screen_lock_portrait';
            document.getElementById('tts-mode-text').innerText = 'Chạy nền';
            if (typeof showToast !== 'undefined') showToast('Đã BẬT chế độ đọc nền (có thể tắt màn hình)');
        } else {
            TTSService.voiceProvider = 'system';
            localStorage.setItem('tts_voice_provider', 'system');
            document.getElementById('tts-mode-icon').innerText = 'screen_lock_landscape';
            document.getElementById('tts-mode-text').innerText = 'Màn hình sáng';
            if (typeof showToast !== 'undefined') showToast('Đã chuyển về Giọng đọc tự nhiên (Màn hình sáng)');
        }
        
        // Cập nhật ngay nếu đang đọc
        if (TTSService.isPlaying && !TTSService.isPaused) {
            const tempChunks = [...TTSService.chunks];
            const tempIdx = TTSService.currentChunkIndex;
            const tempBtn = TTSService.activeBtnElement;
            const tempType = TTSService.currentType;
            const tempContainer = TTSService.activeContainerElement;
            const tempTitle = document.getElementById('tts-player-title').title;
            
            TTSService.stop();
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
        }
    });
    
    // Init state UI
    if (localStorage.getItem('tts_voice_provider') === 'google_translate') {
        const icon = document.getElementById('tts-mode-icon');
        const text = document.getElementById('tts-mode-text');
        if (icon) icon.innerText = 'screen_lock_portrait';
        if (text) text.innerText = 'Chạy nền';
    }

    document.getElementById('btn-tts-speed')?.addEventListener('click', () => {`;
js = js.replace(ttsEvents, ttsModeLogic);

// 3. Ensure chunk length is small enough for Google Translate (max ~200)
js = js.replace(/splitIntoChunks\(text, maxChunkLength = \d+\)/, 'splitIntoChunks(text, maxChunkLength = 180)');

fs.writeFileSync('js/app.js', js);
console.log("Patched background reading mode");
