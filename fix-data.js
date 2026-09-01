const fs = require('fs');
let code = fs.readFileSync('js/data.js', 'utf8');

const regexSave = /saveTrendReport\(memberId, reportData\) \{[\s\S]*?\},/;
const newSave = `saveTrendReport(memberId, reportData) {
        let members = this.getMembers();
        const mIndex = members.findIndex(x => x.id === memberId);
        if (mIndex !== -1) {
            if (!members[mIndex].trendReports) members[mIndex].trendReports = [];
            members[mIndex].trendReports.push({
                id: 'tr_' + Date.now(),
                ...reportData
            });
            localStorage.setItem('family_members', JSON.stringify(members));
            this.isDataChanged = true;
        }
    },`;

const regexDelete = /deleteTrendReport\(memberId, reportId\) \{[\s\S]*?\},/;
const newDelete = `deleteTrendReport(memberId, reportId) {
        let members = this.getMembers();
        const mIndex = members.findIndex(x => x.id === memberId);
        if (mIndex !== -1 && members[mIndex].trendReports) {
            members[mIndex].trendReports = members[mIndex].trendReports.filter(r => r.id !== reportId);
            localStorage.setItem('family_members', JSON.stringify(members));
            this.isDataChanged = true;
        }
    },`;

code = code.replace(regexSave, newSave);
code = code.replace(regexDelete, newDelete);
fs.writeFileSync('js/data.js', code);
console.log("Fixed js/data.js");
