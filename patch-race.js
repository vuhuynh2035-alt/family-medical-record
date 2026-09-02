const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

// Add playbackId to TTSService
code = code.replace(/isPlaying: false,/, 'isPlaying: false,\n    currentPlaybackId: 0,');

// In speak(), increment playbackId
code = code.replace(/this\.isPlaying = true;/g, 
`this.isPlaying = true;
        this.currentPlaybackId = Date.now();
        const expectedPlaybackId = this.currentPlaybackId;`);

// In speak() setTimeout
code = code.replace(/setTimeout\(\(\) => \{\s*if \(this\.isPlaying\) this\.playNextChunk\(\);\s*\}, 150\);/,
`setTimeout(() => {
            if (this.isPlaying && this.currentPlaybackId === expectedPlaybackId) this.playNextChunk();
        }, 150);`);

// In playNextChunk()
code = code.replace(/playNextChunk\(\) \{/,
`playNextChunk() {
        const expectedPlaybackId = this.currentPlaybackId;`);

// In utterance.onend
code = code.replace(/utterance\.onend = \(\) => \{\s*if \(this\.isPlaying && !this\.isPaused\) \{\s*this\.currentChunkIndex\+\+;\s*setTimeout\(\(\) => this\.playNextChunk\(\), 50\);\s*\}\s*\};/,
`utterance.onend = () => {
                if (this.isPlaying && !this.isPaused && this.currentPlaybackId === expectedPlaybackId) {
                    this.currentChunkIndex++;
                    setTimeout(() => {
                        if (this.currentPlaybackId === expectedPlaybackId) this.playNextChunk();
                    }, 50);
                }
            };`);

// In audioFallback.onended
code = code.replace(/this\.audioFallback\.onended = \(\) => \{\s*if \(this\.isPlaying && !this\.isPaused\) \{\s*this\.currentChunkIndex\+\+;\s*setTimeout\(\(\) => this\.playNextChunk\(\), 50\);\s*\}\s*\};/,
`this.audioFallback.onended = () => {
            if (this.isPlaying && !this.isPaused && this.currentPlaybackId === expectedPlaybackId) {
                this.currentChunkIndex++;
                setTimeout(() => {
                    if (this.currentPlaybackId === expectedPlaybackId) this.playNextChunk();
                }, 50);
            }
        };`);

// In karaoke click listener
code = code.replace(/TTSService\.currentChunkIndex = chunkIndex;\s*if \('speechSynthesis' in window\) window\.speechSynthesis\.cancel\(\);\s*if \(TTSService\.audioFallback\) \{[\s\S]*?\}\s*setTimeout\(\(\) => \{ TTSService\.playNextChunk\(\); \}, 150\);/,
`TTSService.currentChunkIndex = chunkIndex;
                    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                    if (TTSService.audioFallback) {
                        TTSService.audioFallback.pause();
                        TTSService.audioFallback.currentTime = 0;
                    }
                    TTSService.currentPlaybackId = Date.now();
                    const expectedPlaybackId = TTSService.currentPlaybackId;
                    setTimeout(() => { 
                        if (TTSService.currentPlaybackId === expectedPlaybackId) TTSService.playNextChunk(); 
                    }, 150);`);

fs.writeFileSync('js/app.js', code);
console.log("Success");
