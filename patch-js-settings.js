const fs = require('fs');
let c = fs.readFileSync('js/app.js', 'utf8');
const regex = /    document\.getElementById\('modal-tts-settings'\)\.classList\.remove\('hidden'\);\r?\n\}\);/;
const newStr = `    document.getElementById('modal-tts-settings').classList.remove('hidden');
});

function populateVoiceSelector() {
    const select = document.getElementById('tts-system-voice-select');
    if (!select || !window.speechSynthesis) return;
    const voices = Array.from(window.speechSynthesis.getVoices() || []);
    const viVoices = voices.filter(v => v.lang === 'vi-VN' || v.lang === 'vi_VN' || (v.lang && v.lang.toLowerCase().startsWith('vi')));
    
    select.innerHTML = '<option value="">-- Để máy tự động chọn giọng tốt nhất --</option>';
    viVoices.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.name;
        opt.textContent = v.name + (v.localService ? ' (Ngoại tuyến)' : '');
        select.appendChild(opt);
    });
    
    const preferred = localStorage.getItem('tts_preferred_voice');
    if (preferred) select.value = preferred;
}

if ('speechSynthesis' in window) {
    window.speechSynthesis.addEventListener('voiceschanged', populateVoiceSelector);
}

document.getElementById('tts-system-voice-select')?.addEventListener('change', (e) => {
    localStorage.setItem('tts_preferred_voice', e.target.value);
});`;

c = c.replace(regex, newStr);
fs.writeFileSync('js/app.js', c);
console.log(c.includes('populateVoiceSelector') ? "Success" : "Failed to replace");
