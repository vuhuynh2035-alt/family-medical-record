const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

const regex = /resume\(\) \{[\s\S]*?this\.setButtonState\(true\);\s*\}/;
const newCode = `resume() {
        if (!this.isPlaying) return;
        this.isPaused = false;
        if ('speechSynthesis' in window) window.speechSynthesis.resume();
        if (this.audioFallback) this.audioFallback.play();
        const pauseIcon = document.getElementById('tts-pause-icon');
        if (pauseIcon) pauseIcon.innerText = 'pause';
        this.setButtonState(true);
    },

    pauseResume() {
        if (this.isPaused) this.resume();
        else this.pause();
    }`;

code = code.replace(regex, newCode);
fs.writeFileSync('js/app.js', code);
console.log(code.includes("pauseResume() {") ? "Success" : "Failed");
