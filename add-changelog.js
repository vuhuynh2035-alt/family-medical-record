const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

// 1. Inject APP_CHANGELOG
const changelogObj = `
const APP_CHANGELOG = {
    'v2.9.2': '• Khắc phục lỗi không thể xuất PDF Bảng đánh giá phân tích AI.\\n• Sửa lỗi cấp phát sai ID khi lưu báo cáo nhiều lần liên tiếp.',
    'v2.9.1': '• Tự động lưu Báo cáo phân tích xu hướng AI ngay khi tạo để tránh mất dữ liệu nếu lỡ vuốt màn hình.\\n• Cho phép nghe đọc Báo cáo (Text-to-Speech) theo từng phần nhỏ thay vì phải nghe từ đầu.\\n• Thêm Lịch sử để xem lại các bản Đánh giá cũ.',
    'v2.8.6': '• Hỗ trợ nhập liệu bằng giọng nói (Voice-to-text) khi Chat với AI.\\n• Sửa lỗi thao tác vuốt từ cạnh màn hình gây thoát ứng dụng.\\n• Tối ưu định dạng ngày tháng trong bảng so sánh.'
};
`;
// Insert near CURRENT_APP_VERSION
code = code.replace(/const CURRENT_APP_VERSION = '.*?';/, match => match + changelogObj);

// 2. Update checkReminders
const badgeRegex = /const pendingCount = allReminders\.filter\(rm => !rm\.completed\)\.length;\s*UI\.updateNotificationBadge\(pendingCount\);/;
const newBadge = `let pendingCount = allReminders.filter(rm => !rm.completed).length;
    const runningVer = getRunningAppVersion();
    if (localStorage.getItem('last_seen_changelog') !== runningVer && APP_CHANGELOG[runningVer]) {
        pendingCount += 1; // Thêm 1 thông báo cho bản cập nhật mới
    }
    UI.updateNotificationBadge(pendingCount);`;
code = code.replace(badgeRegex, newBadge);

// 3. Update openNotifications
const openNotifRegex = /UI\.renderRemindersList\(pendingReminders, 'notifications-list', true\);\s*openModal\('modal-notifications'\);/;
const newOpenNotif = `UI.renderRemindersList(pendingReminders, 'notifications-list', true);
    
    // Inject system update notification
    const runningVer = getRunningAppVersion();
    if (localStorage.getItem('last_seen_changelog') !== runningVer && APP_CHANGELOG[runningVer]) {
        const notifList = document.getElementById('notifications-list');
        const updateDiv = document.createElement('div');
        updateDiv.className = 'neumorphic-panel';
        updateDiv.style.padding = '12px';
        updateDiv.style.marginBottom = '10px';
        updateDiv.style.borderLeft = '4px solid var(--primary-blue)';
        updateDiv.style.background = 'rgba(41, 128, 185, 0.05)';
        updateDiv.innerHTML = \`
            <h4 style="color: var(--primary-blue); margin: 0 0 5px 0; font-size: 14px; display: flex; align-items: center; gap: 5px;"><span class="material-symbols-rounded">new_releases</span> Đã cập nhật lên \${runningVer}!</h4>
            <p style="font-size: 12px; margin: 0 0 10px 0; color: var(--text-color);">Nhấn vào để xem những tính năng mới vừa được bổ sung.</p>
            <button id="btn-view-changelog" class="primary-btn neumorphic-btn" style="font-size: 12px; padding: 6px 12px; width: 100%;">Xem thay đổi</button>
        \`;
        
        // Insert at the top
        notifList.insertBefore(updateDiv, notifList.firstChild);
        
        updateDiv.querySelector('#btn-view-changelog').addEventListener('click', () => {
            // Hiển thị nội dung
            const changelogText = APP_CHANGELOG[runningVer];
            const contentDiv = document.getElementById('changelog-content');
            contentDiv.innerHTML = '<ul style="margin: 0; padding-left: 20px;">' + changelogText.split('\\n').map(line => \`<li style="margin-bottom: 8px;">\${line.replace('• ', '')}</li>\`).join('') + '</ul>';
            
            closeModal('modal-notifications');
            openModal('modal-changelog');
            
            // Đánh dấu đã xem
            localStorage.setItem('last_seen_changelog', runningVer);
            checkReminders(); // Cập nhật lại số lượng chuông
        });
    }

    openModal('modal-notifications');`;
code = code.replace(openNotifRegex, newOpenNotif);

fs.writeFileSync('js/app.js', code);
console.log("Updated app.js");
