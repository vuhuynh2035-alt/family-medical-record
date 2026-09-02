const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

const regex = /'v2\.9\.47': '.*?',\s*/g;
let changelog47 = '';
let match;
while ((match = regex.exec(code)) !== null) {
    changelog47 += match[0].replace(/'v2\.9\.47': '(.*?)',\s*/, "$1\\n");
}

code = code.replace(regex, '');
code = code.replace(/const APP_CHANGELOG = \{/, 
`const APP_CHANGELOG = {
    'v2.9.47': \`${changelog47.trim()}\`,`);

fs.writeFileSync('js/app.js', code);
console.log("Fixed v2.9.47 changelog keys");
