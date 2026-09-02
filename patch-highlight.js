const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

const oldFuncRegex = /highlightChunk\(chunkText\) \{[\s\S]*?\},[\s\n]*playNextChunk\(\)/;

const newFunc = `highlightChunk(chunkText) {
        if (!this.activeContainerElement || !chunkText) return;
        
        const els = Array.from(this.activeContainerElement.querySelectorAll('p, li, h1, h2, h3, h4, span, div, td, th'));
        let matched = null;
        let minLen = Infinity;
        
        const chunkLower = chunkText.toLowerCase().trim();
        if (chunkLower.length < 3) return;
        
        // Remove old highlights
        els.forEach(el => {
            if (el.dataset.ttsHighlighted) {
                el.style.backgroundColor = '';
                el.style.color = '';
                el.style.borderRadius = '';
                el.style.transition = '';
                delete el.dataset.ttsHighlighted;
            }
        });

        // Use the first 15 chars to find the container
        const searchStr = chunkLower.length > 15 ? chunkLower.substring(0, 15) : chunkLower;
        
        els.forEach(el => {
            const elText = (el.innerText || '').toLowerCase();
            // Don't match the whole modal body or very large containers if possible
            if (elText.includes(searchStr)) {
                if (elText.length < minLen && el.children.length <= 2) {
                    minLen = elText.length;
                    matched = el;
                }
            }
        });
        
        // Fallback if no leaf node matched
        if (!matched) {
            els.forEach(el => {
                const elText = (el.innerText || '').toLowerCase();
                if (elText.includes(searchStr)) {
                    if (elText.length < minLen) {
                        minLen = elText.length;
                        matched = el;
                    }
                }
            });
        }
        
        if (matched) {
            matched.style.backgroundColor = 'rgba(255, 235, 59, 0.4)';
            matched.style.color = '#d35400';
            matched.style.borderRadius = '4px';
            matched.style.transition = 'all 0.3s';
            matched.dataset.ttsHighlighted = 'true';
            
            try {
                matched.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch(e) {}
        }
    },

    playNextChunk()`;

code = code.replace(oldFuncRegex, newFunc);
fs.writeFileSync('js/app.js', code);
console.log("Patched highlightChunk successfully!");
