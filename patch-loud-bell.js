const fs = require('fs');

let c = fs.readFileSync('js/app.js', 'utf8');

const missingFuncs = `// --- ALARM LOGIC ---
let currentAlarmAudio = null;
let vibrationInterval = null;

function playLoudBell(soundUrl = null) {
    try {
        if (currentAlarmAudio) {
            currentAlarmAudio.pause();
            currentAlarmAudio.currentTime = 0;
        }
        if (vibrationInterval) {
            clearInterval(vibrationInterval);
        }
        
        const settings = DataManager.getSettings();
        const url = soundUrl || settings.alarmSound || 'assets/alarm.mp3';
        
        currentAlarmAudio = new Audio(url);
        currentAlarmAudio.volume = 1.0;
        currentAlarmAudio.loop = true; // Lặp liên tục
        const playPromise = currentAlarmAudio.play();
        if (playPromise !== undefined) {
            playPromise.catch(e => console.log("Trình duyệt chặn tự động phát âm thanh.", e));
        }
        if (navigator.vibrate) {
            // Rung ngay lập tức
            navigator.vibrate([1000, 500, 1000, 500]);
            // Lặp lại việc rung mỗi 3 giây
            vibrationInterval = setInterval(() => {
                navigator.vibrate([1000, 500, 1000, 500]);
            }, 3000);
        }
    } catch (err) {
        console.error("Alarm error:", err);
    }
}

function stopLoudBell() {
    try {
        if (currentAlarmAudio) {
            currentAlarmAudio.pause();
            currentAlarmAudio.currentTime = 0;
            currentAlarmAudio = null;
        }
        if (vibrationInterval) {
            clearInterval(vibrationInterval);
            vibrationInterval = null;
        }
        if (navigator.vibrate) {
            navigator.vibrate(0);
        }
    } catch (err) {}
}

function showAlarmModal(title, message, isMedication = false, reminderId = null, medTimeKey = null) {
    const modal = document.getElementById('modal-alarm');
    if (!modal) return;
    
    document.getElementById('alarm-title').innerText = title;
    document.getElementById('alarm-message').innerText = message;
    
    const doseActions = document.getElementById('alarm-dose-actions');
    const defaultBtn = document.getElementById('btn-stop-alarm');
    
    if (isMedication && reminderId && medTimeKey) {
        doseActions.classList.remove('hidden');
        defaultBtn.classList.add('hidden');
        
        document.getElementById('btn-dose-taken').onclick = () => {
            const reminders = DataManager.getReminders();
            const rm = reminders.find(r => r.id === reminderId);
            if (rm) {
                if (!rm.dose_status) rm.dose_status = {};
                rm.dose_status[medTimeKey] = 'taken';
                DataManager.saveReminder(rm);
                reloadRecordsAndStats();
            }
            stopLoudBell();
            closeModal('modal-alarm');
        };
        
        document.getElementById('btn-dose-snooze').onclick = () => {
            const reminders = DataManager.getReminders();
            const rm = reminders.find(r => r.id === reminderId);
            if (rm) {
                if (!rm.snoozed_doses) rm.snoozed_doses = {};
                // Snooze 30 minutes
                rm.snoozed_doses[medTimeKey] = Date.now() + 30 * 60 * 1000;
                DataManager.saveReminder(rm);
            }
            stopLoudBell();
            closeModal('modal-alarm');
        };
        
        document.getElementById('btn-dose-skip').onclick = () => {
            if (!confirm('Bạn có chắc chắn muốn bỏ qua cữ thuốc này? Sẽ không nhắc lại nữa.')) return;
            const reminders = DataManager.getReminders();
            const rm = reminders.find(r => r.id === reminderId);
            if (rm) {
                if (!rm.dose_status) rm.dose_status = {};
                rm.dose_status[medTimeKey] = 'skipped';
                DataManager.saveReminder(rm);
                reloadRecordsAndStats();
            }
            stopLoudBell();
            closeModal('modal-alarm');
        };
    } else {
        doseActions.classList.add('hidden');
        defaultBtn.classList.remove('hidden');
    }
    
    modal.classList.remove('hidden');
}

// --- END ALARM LOGIC ---

`;

// insert before checkReminders
if (!c.includes("function playLoudBell")) {
    c = c.replace("function checkReminders() {", missingFuncs + "\nfunction checkReminders() {");
    fs.writeFileSync('js/app.js', c);
    console.log("SUCCESS");
} else {
    console.log("ALREADY EXISTS");
}
