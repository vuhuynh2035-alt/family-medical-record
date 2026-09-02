const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

const regex = /\/\/ 6\. Cài đặt Giọng đọc[\s\S]*?\n\n\/\/ ==================== AUTO SCROLL SERVICE ====================/;

const newSettingsBlock = `// 6. Cài đặt Giọng đọc
function populateVoiceSelector() {
    const select = document.getElementById('tts-system-voice-select');
    if (!select || !window.speechSynthesis) return;
    const voices = window.speechSynthesis.getVoices() || [];
    if (voices.length === 0) return;
    
    // Only show Vietnamese voices or clear the list except default
    const viVoices = voices.filter(v => v.lang.toLowerCase().startsWith('vi'));
    
    let html = '<option value="">-- Tự động chọn (Tốt nhất) --</option>';
    viVoices.forEach(v => {
        html += \`<option value="\${v.name}">\${v.name} (\${v.lang})</option>\`;
    });
    // Add default voices in case language tags are missing on some weird phones
    if (viVoices.length === 0) {
        voices.forEach(v => {
            html += \`<option value="\${v.name}">\${v.name} (\${v.lang})</option>\`;
        });
    }
    
    select.innerHTML = html;
    const preferred = localStorage.getItem('tts_preferred_voice');
    if (preferred) select.value = preferred;
}

if ('speechSynthesis' in window) {
    window.speechSynthesis.addEventListener('voiceschanged', populateVoiceSelector);
}

document.getElementById('btn-tts-settings')?.addEventListener('click', () => {
    const provider = TTSService.voiceProvider;
    const radio = document.querySelector(\`input[name="tts_voice_provider"][value="\${provider}"]\`);
    if (radio) radio.checked = true;
    populateVoiceSelector();
    openModal('modal-tts-settings');
});

document.querySelectorAll('input[name="tts_voice_provider"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const val = e.target.value;
        TTSService.voiceProvider = val;
        localStorage.setItem('tts_voice_provider', val);
        
        // Update the quick toggle button UI immediately
        const btn = document.getElementById('btn-tts-mode');
        if (btn) {
            if (val === 'google_translate') {
                document.getElementById('tts-mode-icon').innerText = 'screen_lock_portrait';
                document.getElementById('tts-mode-text').innerText = 'Chạy nền';
                btn.style.background = 'rgba(251, 191, 36, 0.2)';
                btn.style.color = '#fcd34d';
            } else {
                document.getElementById('tts-mode-icon').innerText = 'screen_lock_landscape';
                document.getElementById('tts-mode-text').innerText = 'Màn hình sáng';
                btn.style.background = 'rgba(255,255,255,0.2)';
                btn.style.color = '#fff';
            }
        }
    });
});

document.getElementById('tts-system-voice-select')?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val) {
        localStorage.setItem('tts_preferred_voice', val);
    } else {
        localStorage.removeItem('tts_preferred_voice');
    }
    showToast('Đã lưu tùy chọn giọng.');
});

// ==================== AUTO SCROLL SERVICE ====================`;

code = code.replace(regex, newSettingsBlock);

fs.writeFileSync('js/app.js', code);
console.log("Settings replaced via Regex");
