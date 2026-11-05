const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

const regex = /document\.getElementById\('btn-download-assessment-pdf'\)\.addEventListener\('click', async \(\) => \{[\s\S]*?\}\);/;

const newBlock = `document.getElementById('btn-download-assessment-pdf').addEventListener('click', async () => {
        const element = document.getElementById('ai-assessment-content');
        let rawTitle = document.querySelector('#modal-ai-assessment .modal-header h3').innerText.trim();
        const titleText = rawTitle.replace(/psychiatry|travel_explore|auto_awesome|history/g, '').trim() || 'AI_Assessment';
        
        // Save locally if this is a trend evaluation
        if (window.currentTrendMetadata) {
            // Check if already saved by id
            const existing = DataManager.getTrendReports(currentMemberId).find(x => x.id === window.currentTrendMetadata.id);
            if (!existing) {
                // If it doesn't have an ID yet, it's newly created. Save it.
                DataManager.saveTrendReport(currentMemberId, window.currentTrendMetadata);
                showToast('Đã lưu bản đánh giá vào hồ sơ!');
                // We don't have the exact ID returned since saveTrendReport assigns it, 
                // but we can set a dummy id to prevent saving again.
                window.currentTrendMetadata.id = 'saved'; 
            }
        }
        
        await downloadPdf(element, \`\${titleText}.pdf\`.replace(/\\s+/g, '_'));
    });`;

if (regex.test(code)) {
    code = code.replace(regex, newBlock);
    fs.writeFileSync('js/app.js', code);
    console.log("Replaced successfully!");
} else {
    console.log("Not found.");
}
