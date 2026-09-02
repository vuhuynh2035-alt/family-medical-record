const fs = require('fs');
let c = fs.readFileSync('js/app.js', 'utf8');
c = c.replace(
    /updateDiv\.querySelector\('#btn-dismiss-changelog'\)\.addEventListener\('click', \(\) => {[\s\S]*?updateDiv\.remove\(\);[\s\S]*?localStorage\.setItem\('last_seen_changelog', runningVer\);[\s\S]*?if \(notifBadge\) notifBadge\.classList\.add\('hidden'\);[\s\S]*?if \(notifList\.children\.length === 0\) {[\s\S]*?notifList\.innerHTML = '<div[^>]+>.*?<\/div>';[\s\S]*?}[\s\S]*?}\);/,
    `updateDiv.querySelector('#btn-dismiss-changelog').addEventListener('click', () => {
            updateDiv.remove();
            localStorage.setItem('last_seen_changelog', runningVer);
            if (notifBadge) {
                notifBadge.classList.add('hidden');
                notifBadge.innerText = '';
            }
            if (notifList.children.length === 0) {
                closeModal('modal-notifications');
            }
        });`
);
fs.writeFileSync('js/app.js', c);
