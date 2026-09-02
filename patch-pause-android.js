const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

const regex = /pause\(\) \{[\s\S]*?pauseResume\(\) \{[\s\S]*?\}/;

const newCode = `pause() {
        if (!this.isPlaying) return;
        this.isPaused = true;
        if ('speechSynthesis' in window && this.voiceProvider !== 'google_translate') {
            window.speechSynthesis.cancel(); // Use cancel instead of pause for Android reliability
        } else if (this.audioFallback) {
            this.audioFallback.pause();
        }
        const pauseIcon = document.getElementById('tts-pause-icon');
        if (pauseIcon) pauseIcon.innerText = 'play_arrow';
        this.setButtonState(false);
    },
    
    resume() {
        if (!this.isPlaying) return;
        this.isPaused = false;
        
        if ('speechSynthesis' in window && this.voiceProvider !== 'google_translate') {
            // Because we used cancel(), we must restart the current chunk
            this.playNextChunk();
        } else if (this.audioFallback) {
            this.audioFallback.play();
        }
        
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
console.log(code.includes("window.speechSynthesis.cancel(); // Use cancel instead of pause") ? "Success" : "Failed");
