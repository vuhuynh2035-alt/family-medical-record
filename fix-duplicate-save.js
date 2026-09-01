const fs = require('fs');

// Fix data.js
let codeData = fs.readFileSync('js/data.js', 'utf8');
codeData = codeData.replace(/id: 'tr_' \+ Date\.now\(\),[\s\S]*?\.\.\.reportData/g, '...reportData,\n                id: reportData.id || (\'tr_\' + Date.now())');
fs.writeFileSync('js/data.js', codeData);
console.log("Fixed js/data.js duplicate bug");

// Fix app.js
let codeApp = fs.readFileSync('js/app.js', 'utf8');

// The auto-save block
const oldAppStr = `// TỰ ĐỘNG LƯU ĐỂ TRÁNH MẤT KHI VUỐT ĐÓNG
            DataManager.saveTrendReport(currentMemberId, window.currentTrendMetadata);
            window.currentTrendMetadata.id = 'saved';`;

const newAppStr = `// TỰ ĐỘNG LƯU ĐỂ TRÁNH MẤT KHI VUỐT ĐÓNG
            window.currentTrendMetadata.id = 'tr_' + Date.now();
            DataManager.saveTrendReport(currentMemberId, window.currentTrendMetadata);`;

codeApp = codeApp.replace(oldAppStr, newAppStr);
fs.writeFileSync('js/app.js', codeApp);
console.log("Fixed js/app.js auto-save logic");
