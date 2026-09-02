const fs = require('fs');
let c = fs.readFileSync('js/app.js', 'utf8');

c = c.replace(
    /const deleteBtn = document\.getElementById\('btn-delete-reminder'\);\s*if \(deleteBtn\) deleteBtn\.classList\.add\('hidden'\);/g,
    `const deleteBtn = document.getElementById('btn-delete-reminder');
        if (deleteBtn) deleteBtn.classList.add('hidden');
        const exportBtn = document.getElementById('btn-export-reminder-ics');
        if (exportBtn) exportBtn.classList.add('hidden');`
);

c = c.replace(
    /const deleteBtn = document\.getElementById\('btn-delete-reminder'\);\s*if \(deleteBtn\) deleteBtn\.classList\.remove\('hidden'\);/g,
    `const deleteBtn = document.getElementById('btn-delete-reminder');
        if (deleteBtn) deleteBtn.classList.remove('hidden');
        const exportBtn = document.getElementById('btn-export-reminder-ics');
        if (exportBtn) exportBtn.classList.remove('hidden');`
);

fs.writeFileSync('js/app.js', c);
console.log('SUCCESS visibility logic');
