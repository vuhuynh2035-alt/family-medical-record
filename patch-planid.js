const fs = require('fs');
let c = fs.readFileSync('js/app.js', 'utf8');

const regex = /const modal = document\.getElementById\('modal-medication-plan-details'\);\s*if \(\!modal\) return;/;
const replace = `const modal = document.getElementById('modal-medication-plan-details');
        if (!modal) return;
        modal.dataset.planId = plan.id;`;

c = c.replace(regex, replace);
fs.writeFileSync('js/app.js', c);
console.log('SUCCESS dataset planId');
