const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

const regex = /content\.innerHTML = UI\.renderMarkdown\(mdText\);/g;

const newReplacement = `content.innerHTML = UI.renderMarkdown(mdText);
            
            // Inject TTS buttons to all headings so users can read section by section
            content.querySelectorAll('h2, h3').forEach(heading => {
                const playBtn = document.createElement('button');
                playBtn.className = 'icon-btn tts-speak-btn';
                playBtn.style.cssText = 'font-size: 12px; padding: 2px 8px; margin-left: 8px; vertical-align: middle; color: #8e44ad; background: rgba(142,68,173,0.1); border-radius: 12px;';
                playBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 14px; vertical-align: middle;">volume_up</span> Nghe phần này';
                playBtn.title = 'Nghe phần này';
                
                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (window.TTSService && TTSService.isPlaying && TTSService.activeBtnElement === playBtn) {
                        TTSService.stop();
                        return;
                    }
                    
                    let textToRead = heading.innerText.replace('Nghe phần này', '').trim() + '\\n';
                    let nextEl = heading.nextElementSibling;
                    const stopTags = ['H1', 'H2', 'H3'];
                    while(nextEl && !stopTags.includes(nextEl.tagName)) {
                        textToRead += nextEl.innerText + '\\n';
                        nextEl = nextEl.nextElementSibling;
                    }
                    
                    if (window.TTSService) {
                        TTSService.speak(textToRead.trim(), heading.innerText.replace('volume_up', '').replace('Nghe phần này', '').trim(), playBtn, 'assessment', '#ai-assessment-content');
                    }
                });
                heading.appendChild(playBtn);
            });`;

if (regex.test(code)) {
    code = code.replace(regex, newReplacement);
    fs.writeFileSync('js/app.js', code);
    console.log("Replaced successfully!");
} else {
    console.log("Not found.");
}
