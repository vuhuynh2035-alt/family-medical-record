const fs = require('fs');

let c = fs.readFileSync('js/app.js', 'utf8');

const icsLogic = `
// --- ICS EXPORT LOGIC ---
window.exportToICS = function(planOrReminder) {
    let icsContent = "BEGIN:VCALENDAR\\r\\nVERSION:2.0\\r\\nPRODID:-//FamilyMedicalRecord//VI\\r\\n";

    const formatDateICS = (dateStr, timeStr) => {
        const d = new Date(\`\${dateStr}T\${timeStr}:00\`);
        return d.toISOString().replace(/[-:]/g, '').split('.')[0] + "Z";
    };

    if (planOrReminder.type === 'medication_plan') {
        const title = planOrReminder.title || "Lịch Uống Thuốc";
        
        planOrReminder.times.forEach(t => {
            const dtStart = formatDateICS(planOrReminder.startDate, t);
            // End time is 15 minutes after start
            const dEnd = new Date(new Date(\`\${planOrReminder.startDate}T\${t}:00\`).getTime() + 15 * 60000);
            const dtEnd = dEnd.toISOString().replace(/[-:]/g, '').split('.')[0] + "Z";
            
            // Build descriptions
            const medsForTime = planOrReminder.medications.filter(m => m.times && m.times.includes(t));
            let desc = "Cần uống:\\\\n";
            medsForTime.forEach(m => desc += \`- \${m.name} (\${m.usage})\\\\n\`);
            
            icsContent += "BEGIN:VEVENT\\r\\n";
            icsContent += \`DTSTART:\${dtStart}\\r\\n\`;
            icsContent += \`DTEND:\${dtEnd}\\r\\n\`;
            icsContent += \`RRULE:FREQ=DAILY;COUNT=\${planOrReminder.totalDays}\\r\\n\`;
            icsContent += \`SUMMARY:\${title} (\${t})\\r\\n\`;
            icsContent += \`DESCRIPTION:\${desc}\\r\\n\`;
            icsContent += "BEGIN:VALARM\\r\\nTRIGGER:-PT0M\\r\\nACTION:DISPLAY\\r\\nDESCRIPTION:Reminder\\r\\nEND:VALARM\\r\\n";
            icsContent += "END:VEVENT\\r\\n";
        });
    } else {
        const dtStart = formatDateICS(planOrReminder.date, planOrReminder.time || "08:00");
        const dEnd = new Date(new Date(\`\${planOrReminder.date}T\${planOrReminder.time || "08:00"}:00\`).getTime() + 60 * 60000);
        const dtEnd = dEnd.toISOString().replace(/[-:]/g, '').split('.')[0] + "Z";
        
        icsContent += "BEGIN:VEVENT\\r\\n";
        icsContent += \`DTSTART:\${dtStart}\\r\\n\`;
        icsContent += \`DTEND:\${dtEnd}\\r\\n\`;
        icsContent += \`SUMMARY:\${planOrReminder.title}\\r\\n\`;
        icsContent += \`DESCRIPTION:\${planOrReminder.note || ''}\\r\\n\`;
        // Alarm offsets
        const offsets = planOrReminder.selected_offsets || ["0"];
        offsets.forEach(msStr => {
            const min = parseInt(msStr) / 60000;
            icsContent += \`BEGIN:VALARM\\r\\nTRIGGER:-PT\${min}M\\r\\nACTION:DISPLAY\\r\\nDESCRIPTION:Reminder\\r\\nEND:VALARM\\r\\n\`;
        });
        icsContent += "END:VEVENT\\r\\n";
    }

    icsContent += "END:VCALENDAR\\r\\n";

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = (planOrReminder.title || 'lich_hen') + '.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

// Bind button clicks
document.getElementById('btn-export-medplan-ics')?.addEventListener('click', () => {
    const modal = document.getElementById('modal-medication-plan-details');
    const planId = modal.dataset.planId;
    if (planId) {
        const plan = DataManager.getReminders().find(r => r.id === planId);
        if (plan) {
            window.exportToICS(plan);
            showToast('Đã tạo lịch ĐT thành công! Vui lòng lưu vào Lịch.');
        }
    }
});

document.getElementById('btn-export-reminder-ics')?.addEventListener('click', () => {
    const id = document.getElementById('reminder-id').value;
    if (id) {
        const rm = DataManager.getReminders().find(r => r.id === id);
        if (rm) {
            window.exportToICS(rm);
            showToast('Đã tạo lịch ĐT thành công! Vui lòng lưu vào Lịch.');
        }
    }
});
`;

c += icsLogic;
fs.writeFileSync('js/app.js', c);
console.log('SUCCESS appended ics logic');
