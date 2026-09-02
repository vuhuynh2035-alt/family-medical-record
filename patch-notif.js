const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

// 1. Remove the bad block from checkReminders
const badBlockStart = `    let pendingCount = 0;
    const runningVer = getRunningAppVersion();
    if (localStorage.getItem('last_seen_changelog') !== runningVer && APP_CHANGELOG[runningVer]) {
        hasSystemNotif = true;`;

const badBlockEnd = `    if (!hasSystemNotif) {
        notifList.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px 0;"><span class="material-symbols-rounded" style="font-size: 32px; display: block; margin-bottom: 10px; opacity: 0.5;">notifications_paused</span>Không có thông báo chung nào từ hệ thống.</div>';
    }

    openModal('modal-notifications');
}`;

const badBlockRegex = new RegExp(
    badBlockStart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + badBlockEnd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
);

// We replace it with just closing checkReminders() properly
code = code.replace(badBlockRegex, 
`    const notifBadge = document.getElementById('notification-badge');
    if (notifBadge) {
        if (alarmTriggered) notifBadge.classList.remove('hidden');
        else notifBadge.classList.add('hidden');
    }
}`);

// 2. Add loadSystemNotifications function
const newFunc = `
function loadSystemNotifications() {
    const notifList = document.getElementById('notifications-list');
    const notifBadge = document.getElementById('notification-badge');
    if (!notifList) return;
    
    notifList.innerHTML = '';
    let hasSystemNotif = false;
    const runningVer = getRunningAppVersion();
    
    if (localStorage.getItem('last_seen_changelog') !== runningVer && APP_CHANGELOG[runningVer]) {
        hasSystemNotif = true;
        const changelogText = APP_CHANGELOG[runningVer];
        const updateDiv = document.createElement('div');
        updateDiv.className = 'neumorphic-panel';
        updateDiv.style.padding = '12px';
        updateDiv.style.marginBottom = '10px';
        updateDiv.style.borderLeft = '4px solid var(--primary-blue)';
        updateDiv.style.background = 'rgba(41, 128, 185, 0.05)';
        
        const listHtml = '<ul style="margin: 0; padding-left: 20px; font-size: 13px; color: var(--text-color); margin-bottom: 15px; line-height: 1.4;">' + changelogText.split('\\n').map(line => \`<li style="margin-bottom: 8px;">\${line.replace('• ', '')}</li>\`).join('') + '</ul>';

        updateDiv.innerHTML = \`
            <h4 style="color: var(--primary-blue); margin: 0 0 10px 0; font-size: 15px; display: flex; align-items: center; gap: 5px;"><span class="material-symbols-rounded">new_releases</span> Đã cập nhật lên \${runningVer}!</h4>
            \${listHtml}
            <button id="btn-dismiss-changelog" class="primary-btn neumorphic-btn" style="font-size: 13px; padding: 8px 12px; width: 100%;">Đã hiểu</button>
        \`;
        
        notifList.appendChild(updateDiv);
        
        updateDiv.querySelector('#btn-dismiss-changelog').addEventListener('click', () => {
            updateDiv.remove();
            localStorage.setItem('last_seen_changelog', runningVer);
            if (notifBadge) notifBadge.classList.add('hidden');
            if (notifList.children.length === 0) {
                notifList.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px 0;"><span class="material-symbols-rounded" style="font-size: 32px; display: block; margin-bottom: 10px; opacity: 0.5;">notifications_paused</span>Không có thông báo chung nào từ hệ thống.</div>';
            }
        });
    }

    if (!hasSystemNotif) {
        notifList.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px 0;"><span class="material-symbols-rounded" style="font-size: 32px; display: block; margin-bottom: 10px; opacity: 0.5;">notifications_paused</span>Không có thông báo chung nào từ hệ thống.</div>';
        if (notifBadge) notifBadge.classList.add('hidden');
    } else {
        if (notifBadge) notifBadge.classList.remove('hidden');
    }
}
`;

code = code.replace('function initDashboard() {', newFunc + '\nfunction initDashboard() {');

// 3. Fix event listeners
code = code.replace(/document\.getElementById\('btn-notifications'\)\.addEventListener\('click', \(\) => openNotifications\(\)\);/g, 
`document.getElementById('btn-notifications').addEventListener('click', () => {
        loadSystemNotifications();
        openModal('modal-notifications');
    });`);

code = code.replace(/openNotifications\(\);/g, `loadSystemNotifications();\nopenModal('modal-notifications');`);

fs.writeFileSync('js/app.js', code);
console.log("Success");
