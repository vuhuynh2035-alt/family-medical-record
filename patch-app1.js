const fs = require('fs');
let c = fs.readFileSync('js/app.js', 'utf8');

// Remove medplan-time-afternoon init
c = c.replace(/document\.getElementById\('medplan-time-afternoon'\)\.value = [^;]+;/g, '');

// Remove afternoon from timeMap
c = c.replace(/'afternoon': document\.getElementById\('medplan-time-afternoon'\)\.value,\s*/g, '');

// Remove afternoon time chk injection in btn-add-med-item
const chkAfternoon1 = `<label style="display:flex; align-items:center; gap:5px;"><input type="checkbox" class="med-time-chk" value="afternoon"> Chiều</label>`;
c = c.replace(chkAfternoon1, '');

const chkAfternoon2 = `<label style="display:flex; align-items:center; gap:5px;"><input type="checkbox" class="med-time-chk" value="afternoon" \${sessAfternoon ? 'checked' : ''}> Chiều</label>`;
c = c.replace(chkAfternoon2, '');

// Remove sessAfternoon logic
c = c.replace(/let sessMorning = false, sessNoon = false, sessAfternoon = false, sessEvening = false;/g, 'let sessMorning = false, sessNoon = false, sessEvening = false;');

c = c.replace(/else if \(hr < 18\) sessAfternoon = true;\s*/g, '');

// Also remove from time labels in AI formatting if needed
// Actually, AI formatting could keep it in case it's in the data, but the prompt says 3 cu.

fs.writeFileSync('js/app.js', c);
console.log('SUCCESS');
