const fs = require('fs');

// Patch data.js
let dataJs = fs.readFileSync('js/data.js', 'utf8');
dataJs = dataJs.replace(
    /const key = `\$\{r\.memberId\}_\$\{r\.title\}_\$\{r\.date \|\| ''\}_\$\{r\.time \|\| ''\}`;/,
    'const key = `${r.memberId}_${r.title}_${r.date || \'\'}_${r.time || \'\'}_${(r.note || \'\').substring(0, 15)}`;'
);
fs.writeFileSync('js/data.js', dataJs);

// Patch app.js
let appJs = fs.readFileSync('js/app.js', 'utf8');
appJs = appJs.replace(
    /const isDup = existingReminders\.some\(r => r\.title === rmData\.title && r\.date === rmData\.date\);/,
    'const isDup = existingReminders.some(r => r.title === rmData.title && r.date === rmData.date && r.note === rmData.note);'
);
appJs = appJs.replace(
    /const isDup = existingReminders\.some\(r => r\.type === 'followup' && r\.date === dateParts && r\.time === timePart\);/,
    'const isDup = existingReminders.some(r => r.type === \'followup\' && r.date === dateParts && r.time === timePart && r.note === rmData.note);'
);
fs.writeFileSync('js/app.js', appJs);

console.log('SUCCESS deduplication patches');
