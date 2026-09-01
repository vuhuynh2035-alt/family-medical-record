const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

const regex = /window\.currentTrendMetadata\s*=\s*\{\s*title:\s*'Đánh giá xu hướng sức khỏe',\s*date:\s*new Date\(\)\.toISOString\(\),\s*recordIds:\s*records\.map\(r => r\.id\),\s*comparedRecordsSummary:\s*summary,\s*content:\s*mdText\s*\};/;

const newStr = `window.currentTrendMetadata = {
                title: 'Đánh giá xu hướng sức khỏe',
                date: new Date().toISOString(),
                recordIds: records.map(r => r.id),
                comparedRecordsSummary: summary,
                content: mdText
            };
            
            // TỰ ĐỘNG LƯU ĐỂ TRÁNH MẤT KHI VUỐT ĐÓNG
            DataManager.saveTrendReport(currentMemberId, window.currentTrendMetadata);
            window.currentTrendMetadata.id = 'saved';
            renderTrendReportsList();`;

if (regex.test(code)) {
    code = code.replace(regex, newStr);
    fs.writeFileSync('js/app.js', code);
    console.log("Replaced successfully!");
} else {
    console.log("Not found.");
}
