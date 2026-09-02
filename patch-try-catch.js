const fs = require('fs');
let c = fs.readFileSync('js/app.js', 'utf8');
const regex = /const btnView = e\.target\.closest\('\.record-item'\);[\s\S]*?openModal\('modal-view-record'\);\s*\}\s*return;\s*\}/;

const replacement = `const btnView = e.target.closest('.record-item');
        if (btnView && !e.target.closest('.record-actions')) {
            try {
                const id = btnView.dataset.id;
                const record = currentRecords.find(r => r.id === id);
                if (record) {
                    await UI.renderRecordDetailModal(record);
                    openModal('modal-view-record');
                } else {
                    alert('Không tìm thấy dữ liệu hồ sơ này trong bộ nhớ!');
                }
            } catch (err) {
                alert('Lỗi mở hồ sơ: ' + err.message + '\\n' + err.stack);
            }
            return;
        }`;

c = c.replace(regex, replacement);
fs.writeFileSync('js/app.js', c);
console.log(c.includes('Lỗi mở hồ sơ') ? "Success" : "Failed");
