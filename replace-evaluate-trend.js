const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

const regex = /\/\/ Evaluate Health Trend Action[\s\S]*?Lỗi khi liên hệ AI: \$\{err\.message\}<\/p>\`;\s*\}\s*\}\);/;

const newBlock = `// Format helpers for UI
    function formatDateShort(isoString) {
        if (!isoString) return '';
        const d = new Date(isoString);
        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }

    // Evaluate Health Trend Action
    document.getElementById('btn-evaluate-trend').addEventListener('click', () => {
        if (!currentMemberId) return;
        const records = DataManager.getRecords(currentMemberId);
        if (!records || records.length === 0) {
            alert('Thành viên này chưa có hồ sơ khám bệnh nào để đánh giá.');
            return;
        }
        
        renderTrendReportsList();
        openModal('modal-trend-history');
    });

    function renderTrendReportsList() {
        const container = document.getElementById('trend-reports-list');
        const reports = DataManager.getTrendReports(currentMemberId);
        container.innerHTML = '';
        if (!reports || reports.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); font-size: 14px; text-align: center;">Chưa có bản đánh giá nào được lưu.</p>';
            return;
        }

        reports.forEach(r => {
            const div = document.createElement('div');
            div.className = 'neumorphic-panel clickable-row';
            div.style.padding = '12px';
            div.style.borderRadius = '12px';
            div.innerHTML = \`
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <div style="font-weight: 600; color: var(--primary-blue); font-size: 14px;">\${r.title || 'Đánh giá xu hướng'}</div>
                        <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">\${formatDateShort(r.date)}</div>
                        <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">\${r.comparedRecordsSummary || ''}</div>
                    </div>
                    <button class="icon-btn danger btn-del-trend" data-id="\${r.id}" style="padding: 4px;"><span class="material-symbols-rounded" style="font-size: 18px;">delete</span></button>
                </div>
            \`;
            
            // Xoá
            div.querySelector('.btn-del-trend').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Xóa bản đánh giá này?')) {
                    DataManager.deleteTrendReport(currentMemberId, r.id);
                    renderTrendReportsList();
                }
            });

            // Mở xem lại
            div.addEventListener('click', () => {
                document.querySelector('#modal-ai-assessment .modal-header h3').innerHTML = \`<span class="material-symbols-rounded ai-sparkle">history</span> Đánh giá xu hướng sức khỏe (Đã lưu)\`;
                document.getElementById('ai-assessment-loading').classList.add('hidden');
                document.getElementById('ai-assessment-content').innerHTML = UI.renderMarkdown(r.content);
                // Gắn metadata để lúc lưu PDF biết tên
                window.currentTrendMetadata = r; 
                openModal('modal-ai-assessment');
            });
            container.appendChild(div);
        });
    }

    document.getElementById('btn-create-new-trend').addEventListener('click', async () => {
        const records = DataManager.getRecords(currentMemberId);
        const member = DataManager.getMembers().find(m => m.id === currentMemberId);
        const activeProvider = DataManager.getProviderTrend();
        const pName = activeProvider === 'openai' ? 'ChatGPT' : (activeProvider === 'anthropic' ? 'Claude' : 'Gemini');
        
        document.querySelector('#modal-ai-assessment .modal-header h3').innerHTML = \`<span class="material-symbols-rounded ai-sparkle">auto_awesome</span> \${pName} Đánh giá xu hướng sức khỏe\`;
        openModal('modal-ai-assessment');
        const loading = document.getElementById('ai-assessment-loading');
        const content = document.getElementById('ai-assessment-content');
        
        loading.innerHTML = \`<span class="loading-spinner"></span> \${pName} đang phân tích toàn bộ lịch sử khám bệnh...\`;
        loading.classList.remove('hidden');
        content.innerHTML = '';
        
        try {
            const mdText = await AIService.evaluateHealthTrend(records, member);
            loading.classList.add('hidden');
            content.innerHTML = UI.renderMarkdown(mdText);
            
            // Tạo metadata chờ người dùng bấm Lưu
            const dates = records.map(r => r.date).sort();
            const summary = dates.length > 0 ? \`Từ \${dates[0]} đến \${dates[dates.length-1]} (\${dates.length} hồ sơ)\` : '';
            window.currentTrendMetadata = {
                title: 'Đánh giá xu hướng sức khỏe',
                date: new Date().toISOString(),
                recordIds: records.map(r => r.id),
                comparedRecordsSummary: summary,
                content: mdText
            };
        } catch (err) {
            loading.classList.add('hidden');
            content.innerHTML = \`<p style="color:var(--danger);">Lỗi khi liên hệ AI: \${err.message}</p>\`;
        }
    });`;

if (regex.test(code)) {
    code = code.replace(regex, newBlock);
    fs.writeFileSync('js/app.js', code);
    console.log("Replaced successfully!");
} else {
    console.log("Not found.");
}
