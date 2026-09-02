const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

// 1. Fix TTSService.speak
code = code.replace(
/        setTimeout\(\(\) => \{\s*if \(this\.isPlaying && this\.currentPlaybackId === expectedPlaybackId\) this\.playNextChunk\(\);\s*\}, 150\);/g,
`        if ('speechSynthesis' in window) {
            const dummy = new SpeechSynthesisUtterance('');
            dummy.volume = 0;
            window.speechSynthesis.speak(dummy);
        }
        if (this.isPlaying && this.currentPlaybackId === expectedPlaybackId) this.playNextChunk();`
);

// 2. Fix btn-tts-mode
code = code.replace(
/        TTSService\.stop\(\);\s*setTimeout\(\(\) => \{\s*TTSService\.chunks = tempChunks;[\s\S]*?TTSService\.playNextChunk\(\);\s*\}, 100\);/g,
`        TTSService.stop();
        if ('speechSynthesis' in window) {
            const dummy = new SpeechSynthesisUtterance('');
            dummy.volume = 0;
            window.speechSynthesis.speak(dummy);
        }
        TTSService.chunks = tempChunks;
        TTSService.currentChunkIndex = tempIdx;
        TTSService.isPlaying = true;
        TTSService.activeBtnElement = tempBtn;
        TTSService.currentType = tempType;
        TTSService.activeContainerElement = tempContainer;
        TTSService.showPlayerUI(tempTitle);
        TTSService.setButtonState(true);
        TTSService.setContainerHighlight(true);
        TTSService.playNextChunk();`
);

// 3. Fix karaoke click mid-sentence
code = code.replace(
/                      setTimeout\(\(\) => \{ \s*if \(TTSService\.currentPlaybackId === expectedPlaybackId\) TTSService\.playNextChunk\(\); \s*\}, 150\);/g,
`                      if ('speechSynthesis' in window) {
                          const dummy = new SpeechSynthesisUtterance('');
                          dummy.volume = 0;
                          window.speechSynthesis.speak(dummy);
                      }
                      if (TTSService.currentPlaybackId === expectedPlaybackId) TTSService.playNextChunk();`
);

fs.writeFileSync('js/app.js', code);
console.log("Success");
