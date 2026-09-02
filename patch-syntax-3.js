const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

code = code.replace(/stop\(\) \{\\n        this\.currentPlaybackId = Date\.now\(\);/,
`stop() {
        this.currentPlaybackId = Date.now();`);

code = code.replace(/resume\(\) \{\\n        if \(\!this\.isPlaying\) return;\\n        this\.isPaused = false;\\n        this\.currentPlaybackId = Date\.now\(\);/,
`resume() {
        if (!this.isPlaying) return;
        this.isPaused = false;
        this.currentPlaybackId = Date.now();`);

fs.writeFileSync('js/app.js', code);
console.log("Success");
