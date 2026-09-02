const fs = require('fs');
let c = fs.readFileSync('js/app.js', 'utf8');

const target1 = "sortedRecords.map(rec => `- ${rec.disease || rec.hospital || 'Khám bệnh'} (Ngày ${formatDateShort(rec.date)})`).join('<br>');";
const target2 = "sortedRecords.map(r => `- ${r.disease || r.hospital || 'Khám bệnh'} (Ngày ${formatDateShort(r.date)})`).join('<br>');";

const replace1 = "sortedRecords.map(rec => { let name = rec.hospital || rec.disease || 'Khám bệnh'; if (name.length > 35) name = name.substring(0, 35) + '...'; return `- Hồ sơ: ${name} (Ngày ${formatDateShort(rec.date)})`; }).join('<br>');";
const replace2 = "sortedRecords.map(r => { let name = r.hospital || r.disease || 'Khám bệnh'; if (name.length > 35) name = name.substring(0, 35) + '...'; return `- Hồ sơ: ${name} (Ngày ${formatDateShort(r.date)})`; }).join('<br>');";

c = c.replace(target1, replace1);
c = c.replace(target2, replace2);

fs.writeFileSync('js/app.js', c);
console.log('SUCCESS');
