const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

code = code.split('\\n').join('\n');

fs.writeFileSync('js/app.js', code);
console.log("Success");
