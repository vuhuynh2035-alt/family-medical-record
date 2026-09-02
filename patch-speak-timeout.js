const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

const regex = /this\.playNextChunk\(\);\s*\}/;

const newCode = `setTimeout(() => {
            if (this.isPlaying) this.playNextChunk();
        }, 150);
    }`;

code = code.replace(regex, newCode);
fs.writeFileSync('js/app.js', code);
console.log(code.includes("setTimeout(() => {") ? "Success" : "Failed");
