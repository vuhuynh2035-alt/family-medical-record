const fs = require('fs');

let idx = fs.readFileSync('index.html', 'utf8');

const modalFooter1 = `<button type="button" class="primary-btn neumorphic-btn close-modal" style="width: 100%; border-radius: 8px;">Đóng lại</button>`;
const newModalFooter1 = `<button type="button" class="primary-btn neumorphic-btn close-modal" style="width: 100%; border-radius: 8px;">Đóng lại</button>
                <button type="button" id="btn-export-medplan-ics" class="secondary-btn neumorphic-btn" style="width: 100%; border-radius: 8px; background: #e8f5e9; color: #2e7d32; border: 1px solid #c8e6c9; margin-top: 10px; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600;">
                    <span class="material-symbols-rounded">calendar_add_on</span> Thêm vào Lịch điện thoại
                </button>`;

idx = idx.replace(modalFooter1, newModalFooter1);

const modalFooter2 = `<button type="button" id="btn-delete-reminder" class="icon-btn neumorphic-btn hidden" style="color: #e11d48; border: 1px solid #e11d48; background: rgba(225, 29, 72, 0.05); border-radius: 8px; width: auto; padding: 0 15px; font-size: 14px; font-weight: bold;" title="Xóa lịch hẹn này">Xóa bỏ</button>`;
const newModalFooter2 = `<button type="button" id="btn-delete-reminder" class="icon-btn neumorphic-btn hidden" style="color: #e11d48; border: 1px solid #e11d48; background: rgba(225, 29, 72, 0.05); border-radius: 8px; width: auto; padding: 0 15px; font-size: 14px; font-weight: bold;" title="Xóa lịch hẹn này">Xóa bỏ</button>
                      <button type="button" id="btn-export-reminder-ics" class="icon-btn neumorphic-btn hidden" style="color: #2e7d32; border: 1px solid #c8e6c9; background: #e8f5e9; border-radius: 8px; width: auto; padding: 0 15px; font-size: 14px; font-weight: bold; display: flex; align-items: center; gap: 5px;" title="Thêm vào Lịch điện thoại"><span class="material-symbols-rounded" style="font-size: 18px;">calendar_add_on</span> Lịch ĐT</button>`;

idx = idx.replace(modalFooter2, newModalFooter2);

fs.writeFileSync('index.html', idx);
console.log('SUCCESS index.html patched');
