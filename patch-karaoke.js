const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

code = code.replace(/TTSService\.playNextChunk\(\);\s*if\(typeof showToast !== 'undefined'\)/,
`setTimeout(() => { TTSService.playNextChunk(); }, 150);
                    if(typeof showToast !== 'undefined')`);

fs.writeFileSync('js/app.js', code);
console.log(code.includes("setTimeout(() => { TTSService.playNextChunk(); }, 150);") ? "Success" : "Failed");
