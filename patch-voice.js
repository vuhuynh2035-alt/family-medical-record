const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

const regex = /getVietnameseFemaleVoice\(\) \{[\s\S]*?return viVoices\[0\];\s*\}/;

const newCode = `getVietnameseFemaleVoice() {
        if (!('speechSynthesis' in window)) return null;
        const voices = window.speechSynthesis.getVoices() || [];
        const viVoices = voices.filter(v => 
            v.lang === 'vi-VN' || v.lang === 'vi_VN' || (v.lang && v.lang.toLowerCase().startsWith('vi'))
        );
        if (viVoices.length === 0) return null;
        
        // Ưu tiên giọng Premium/Enhanced (iOS/Android chất lượng cao)
        const premiumVoice = viVoices.find(v => {
            const name = (v.name || '').toLowerCase();
            return name.includes('premium') || name.includes('enhanced') || name.includes('cao cấp');
        });
        if (premiumVoice) return premiumVoice;

        const femaleKeywords = ['hoaimy', 'linh', 'mai', 'female', 'tiếng việt', 'vietnam', 'vi-vn'];
        for (let kw of femaleKeywords) {
            const found = viVoices.find(v => (v.name || '').toLowerCase().includes(kw));
            if (found) return found;
        }
        return viVoices[0];
    }`;

code = code.replace(regex, newCode);
fs.writeFileSync('js/app.js', code);
console.log("Success");
