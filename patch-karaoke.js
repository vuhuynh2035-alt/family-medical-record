const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

const target = `                      setTimeout(() => { 
                          if (TTSService.currentPlaybackId === expectedPlaybackId) TTSService.playNextChunk(); 
                      }, 150);`;

const replacement = `                      if ('speechSynthesis' in window) {
                          const dummy = new SpeechSynthesisUtterance('');
                          dummy.volume = 0;
                          window.speechSynthesis.speak(dummy);
                      }
                      if (TTSService.currentPlaybackId === expectedPlaybackId) TTSService.playNextChunk();`;

code = code.replace(target, replacement);
fs.writeFileSync('js/app.js', code);
console.log("Replaced karaoke");
