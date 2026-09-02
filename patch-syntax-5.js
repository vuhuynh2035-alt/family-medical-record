const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

code = code.replace(/checkReminders\(\);\\n    loadSystemNotifications\(\);\\n    setInterval/, `checkReminders();\n    loadSystemNotifications();\n    setInterval`);

fs.writeFileSync('js/app.js', code);
console.log("Success");
