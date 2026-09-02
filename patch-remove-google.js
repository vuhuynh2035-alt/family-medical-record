const fs = require('fs');
let c = fs.readFileSync('js/app.js', 'utf8');

// 1. Force voiceProvider to always be 'system' and ignore localStorage
c = c.replace(/voiceProvider:\s*localStorage\.getItem\('tts_voice_provider'\)\s*\|\|\s*'system'/, "voiceProvider: 'system'");

// 2. Remove google_translate check in playNextChunk
const gCheck = `        if (this.voiceProvider === 'google_translate') {
            this.playChunkWithAudioFallback(chunkText);
            return;
        }`;
if (c.includes(gCheck)) {
    c = c.replace(gCheck, `        // Bắt buộc luôn dùng SpeechSynthesis`);
} else {
    // try removing line breaks
    c = c.replace(/if\s*\(this\.voiceProvider\s*===\s*'google_translate'\)\s*{\s*this\.playChunkWithAudioFallback\(chunkText\);\s*return;\s*}/g, '');
}

// 3. Force clean the init UI logic that checks google_translate
const oldInitUI = `if (localStorage.getItem('tts_voice_provider') === 'google_translate') {
    const icon = document.getElementById('tts-mode-icon');
    const text = document.getElementById('tts-mode-text');
    const btn = document.getElementById('btn-tts-mode');
    if (icon) icon.innerText = 'screen_lock_portrait';
    if (text) text.innerText = 'Chạy nền';
    if (btn) {
        btn.style.background = 'rgba(251, 191, 36, 0.2)';
        btn.style.color = '#fcd34d';
    }
}`;
if (c.includes(oldInitUI)) {
    c = c.replace(oldInitUI, `// Đã bỏ google_translate, reset localStorage nếu còn bị kẹt
if (localStorage.getItem('tts_voice_provider') === 'google_translate') {
    localStorage.removeItem('tts_voice_provider');
}`);
} else {
    // If not found exactly, try a regex replacement
    c = c.replace(/if\s*\(localStorage\.getItem\('tts_voice_provider'\)\s*===\s*'google_translate'\)\s*\{[\s\S]*?btn\.style\.color\s*=\s*'#fcd34d';\s*\}\s*\}/, 
    `// Đã bỏ google_translate, reset localStorage nếu còn bị kẹt
if (localStorage.getItem('tts_voice_provider') === 'google_translate') {
    localStorage.removeItem('tts_voice_provider');
}`);
}

// 4. Fix pause/resume logic where it checks for google_translate
c = c.replace(/this\.voiceProvider\s*!==\s*'google_translate'/g, "true");

fs.writeFileSync('js/app.js', c);
console.log("REMOVED ALL GOOGLE_TRANSLATE TRACES");
