const fs = require('fs');

let c = fs.readFileSync('js/app.js', 'utf8');

const oldCheckRemindersEnd = `    const notifBadge = document.getElementById('notification-badge');
    if (notifBadge) {
        if (alarmTriggered) notifBadge.classList.remove('hidden');
    }
}`;

const newCheckRemindersEnd = `    const notifBadge = document.getElementById('notification-badge');
    if (notifBadge) {
        if (alarmTriggered) notifBadge.classList.remove('hidden');
    }

    if (alarmTriggered) {
        const title = alarmTriggered.isPlan ? 'Lịch Uống Thuốc' : alarmTriggered.title;
        const msg = alarmTriggered.isPlan ? \`Đã đến giờ uống thuốc: \${alarmTriggered.triggerTimeStr}\` : \`Lịch hẹn: \${alarmTriggered.title} - \${alarmTriggered.date}\`;
        
        playLoudBell();
        showAlarmModal(title, msg, alarmTriggered.isPlan, alarmTriggered.id, alarmTriggered.timeKey);
        
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                navigator.serviceWorker.ready.then(reg => {
                    reg.showNotification(title, {
                        body: msg,
                        icon: 'assets/icon-192.png',
                        vibrate: [1000, 500, 1000, 500]
                    });
                });
            } catch(e) {}
        }
    }
}`;

c = c.replace(oldCheckRemindersEnd, newCheckRemindersEnd);

fs.writeFileSync('js/app.js', c);
console.log("SUCCESS");
