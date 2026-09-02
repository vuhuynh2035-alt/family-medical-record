const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

const regex = /    let pendingCount = 0;[\s\S]*?openModal\('modal-notifications'\);\s*\}/;
const replaceWith = `    const notifBadge = document.getElementById('notification-badge');
    if (notifBadge) {
        if (alarmTriggered) notifBadge.classList.remove('hidden');
    }
}`;

code = code.replace(regex, replaceWith);

fs.writeFileSync('js/app.js', code);
console.log(code.includes("openModal('modal-notifications')") ? "Still has openModal" : "Success");
