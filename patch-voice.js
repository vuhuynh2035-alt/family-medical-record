const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

const target = `    getVietnameseFemaleVoice() {
        if (!('speechSynthesis' in window)) return null;
        const voices = window.speechSynthesis.getVoices() || [];
        const viVoices = voices.filter(v => 
            v.lang === 'vi-VN' || v.lang === 'vi_VN' || (v.lang && v.lang.toLowerCase().startsWith('vi'))
        );
        if (viVoices.length === 0) return null;`;

const replacement = `    getVietnameseFemaleVoice() {
        if (!('speechSynthesis' in window)) return null;
        const voices = window.speechSynthesis.getVoices() || [];
        
        // 1. Nếu người dùng đã chọn giọng yêu thích
        const preferred = localStorage.getItem('tts_preferred_voice');
        if (preferred) {
            const preferredVoice = voices.find(v => v.name === preferred);
            if (preferredVoice) return preferredVoice;
        }

        const viVoices = voices.filter(v => 
            v.lang === 'vi-VN' || v.lang === 'vi_VN' || (v.lang && v.lang.toLowerCase().startsWith('vi'))
        );
        if (viVoices.length === 0) return null;`;

code = code.replace(target, replacement);
fs.writeFileSync('js/app.js', code);
console.log("Updated getVietnameseFemaleVoice");
