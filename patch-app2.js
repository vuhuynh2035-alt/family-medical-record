const fs = require('fs');
let c = fs.readFileSync('js/app.js', 'utf8');

// Remove settings modal load logic
c = c.replace(/document\.getElementById\('input-med-time-morning'\)\.value =[^;]+;/g, '');
c = c.replace(/document\.getElementById\('input-med-time-noon'\)\.value =[^;]+;/g, '');
c = c.replace(/document\.getElementById\('input-med-time-afternoon'\)\.value =[^;]+;/g, '');
c = c.replace(/document\.getElementById\('input-med-time-evening'\)\.value =[^;]+;/g, '');

// Remove settings modal save logic
c = c.replace(/const medTimeMorning = document\.getElementById\('input-med-time-morning'\)\.value \|\| '08:00';/g, '');
c = c.replace(/const medTimeNoon = document\.getElementById\('input-med-time-noon'\)\.value \|\| '12:00';/g, '');
c = c.replace(/const medTimeAfternoon = document\.getElementById\('input-med-time-afternoon'\)\.value \|\| '14:00';/g, '');
c = c.replace(/const medTimeEvening = document\.getElementById\('input-med-time-evening'\)\.value \|\| '20:00';/g, '');

c = c.replace(/medTimeMorning: medTimeMorning,/g, '');
c = c.replace(/medTimeNoon: medTimeNoon,/g, '');
c = c.replace(/medTimeAfternoon: medTimeAfternoon,/g, '');
c = c.replace(/medTimeEvening: medTimeEvening/g, ''); // no comma at end

// Replace initNewReminder and edit logic with hardcoded defaults
c = c.replace(/document\.getElementById\('medplan-time-morning'\)\.value = settings\.medTimeMorning \|\| '08:00';/, "document.getElementById('medplan-time-morning').value = '08:00';");
c = c.replace(/document\.getElementById\('medplan-time-noon'\)\.value = settings\.medTimeNoon \|\| '12:00';/, "document.getElementById('medplan-time-noon').value = '12:00';");
c = c.replace(/document\.getElementById\('medplan-time-evening'\)\.value = settings\.medTimeEvening \|\| '20:00';/, "document.getElementById('medplan-time-evening').value = '20:00';");

c = c.replace(/let morningTime = settings\.medTimeMorning \|\| '08:00';/, "let morningTime = '08:00';");
c = c.replace(/let noonTime = settings\.medTimeNoon \|\| '12:00';/, "let noonTime = '12:00';");
c = c.replace(/let afternoonTime = settings\.medTimeAfternoon \|\| '14:00';/, "");
c = c.replace(/let eveningTime = settings\.medTimeEvening \|\| '20:00';/, "let eveningTime = '20:00';");

fs.writeFileSync('js/app.js', c);
console.log('SUCCESS app.js cleanup');
