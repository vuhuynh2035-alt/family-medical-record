const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

const oldFuncRegex = /playNextChunk\(\) \{[\s\S]*?\},[\s\n]*stop\(\) \{/;

const newFunc = `playNextChunk() {
        if (!this.isPlaying || this.isPaused) return;

        if (this.currentChunkIndex >= this.chunks.length) {
            this.stop();
            return;
        }

        const chunkText = this.chunks[this.currentChunkIndex];

        if (this.voiceProvider === 'google_translate') {
            this.playChunkWithAudioFallback(chunkText);
            return;
        }

        const voice = this.getVietnameseFemaleVoice();
        const hasNativeVi = 'speechSynthesis' in window && (voice || !/Android/i.test(navigator.userAgent));

        if (hasNativeVi) {
            const utterance = new SpeechSynthesisUtterance(chunkText);
            utterance.lang = 'vi-VN';
            utterance.rate = this.speed;
            utterance.pitch = this.pitch;
            if (voice) utterance.voice = voice;

            utterance.onstart = () => {
                if (this.isPlaying && !this.isPaused) {
                    this.updatePlayerSubtitle(chunkText);
                    this.highlightChunk(chunkText);
                }
            };

            utterance.onend = () => {
                if (this.isPlaying && !this.isPaused) {
                    this.currentChunkIndex++;
                    setTimeout(() => this.playNextChunk(), 50);
                }
            };

            utterance.onerror = (e) => {
                console.warn('SpeechSynthesis error:', e);
                this.playChunkWithAudioFallback(chunkText);
            };

            this.currentUtterance = utterance;
            window.speechSynthesis.speak(utterance);
        } else {
            this.playChunkWithAudioFallback(chunkText);
        }
    },

    playChunkWithAudioFallback(chunkText) {
        if (!this.isPlaying || this.isPaused) return;
        const encoded = encodeURIComponent(chunkText);
        const url = \`https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=\${encoded}\`;

        if (!this.audioFallback) {
            this.audioFallback = new Audio();
        }
        this.audioFallback.src = url;
        this.audioFallback.playbackRate = this.speed;
        
        this.audioFallback.onplay = () => {
            if (this.isPlaying && !this.isPaused) {
                this.updatePlayerSubtitle(chunkText);
                this.highlightChunk(chunkText);
            }
        };

        this.audioFallback.onended = () => {
            if (this.isPlaying && !this.isPaused) {
                this.currentChunkIndex++;
                setTimeout(() => this.playNextChunk(), 50);
            }
        };

        this.audioFallback.onerror = () => {
            this.currentChunkIndex++;
            setTimeout(() => this.playNextChunk(), 50);
        };
        
        this.audioFallback.play().catch(e => {
            console.error('Audio play failed', e);
            this.currentChunkIndex++;
            setTimeout(() => this.playNextChunk(), 50);
        });
    },

    stop() {`;

code = code.replace(oldFuncRegex, newFunc);

// Add MediaSession for silentAudio
const silentRegex = /playSilentAudio\(\) \{[\s\S]*?this\.silentAudio\.play\(\)\.catch\(e => console\.log\('Silent audio block', e\)\);\n    \},/;
const newSilent = `playSilentAudio() {
        if (!this.silentAudio) {
            this.silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
            this.silentAudio.loop = true;
        }
        this.silentAudio.play().then(() => {
            if ('mediaSession' in navigator) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: 'Đang đọc hồ sơ y tế',
                    artist: 'Trợ lý AI'
                });
            }
        }).catch(e => console.log('Silent audio block', e));
    },`;
code = code.replace(silentRegex, newSilent);

fs.writeFileSync('js/app.js', code);
console.log("Patched sync and media session successfully!");
