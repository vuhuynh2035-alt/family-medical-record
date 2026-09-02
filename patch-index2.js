const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');

const regexTimeGrid = /<div class="form-group-row" style="margin-bottom: 10px;">[\s\S]*?<div class="form-group">[\s\S]*?<label style="font-size: 12px;">Giờ Sáng<\/label>[\s\S]*?<input type="time" id="medplan-time-morning" class="neumorphic-input">[\s\S]*?<\/div>[\s\S]*?<div class="form-group">[\s\S]*?<label style="font-size: 12px;">Giờ Trưa<\/label>[\s\S]*?<input type="time" id="medplan-time-noon" class="neumorphic-input">[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<div class="form-group-row" style="margin-bottom: 0;">[\s\S]*?<div class="form-group">[\s\S]*?<label style="font-size: 12px;">Giờ Chiều<\/label>[\s\S]*?<input type="time" id="medplan-time-afternoon" class="neumorphic-input">[\s\S]*?<\/div>[\s\S]*?<div class="form-group">[\s\S]*?<label style="font-size: 12px;">Giờ Tối<\/label>[\s\S]*?<input type="time" id="medplan-time-evening" class="neumorphic-input">[\s\S]*?<\/div>[\s\S]*?<\/div>/;

const newGrid = `<div class="form-group-row" style="margin-bottom: 10px;">
                            <div class="form-group">
                                <label style="font-size: 12px;">Giờ Sáng</label>
                                <input type="time" id="medplan-time-morning" class="neumorphic-input">
                            </div>
                            <div class="form-group">
                                <label style="font-size: 12px;">Giờ Trưa</label>
                                <input type="time" id="medplan-time-noon" class="neumorphic-input">
                            </div>
                            <div class="form-group">
                                <label style="font-size: 12px;">Giờ Tối</label>
                                <input type="time" id="medplan-time-evening" class="neumorphic-input">
                            </div>
                        </div>`;

if (c.match(regexTimeGrid)) {
    c = c.replace(regexTimeGrid, newGrid);
    console.log("Replaced time grid");
} else {
    console.log("Could not find time grid regex");
}
fs.writeFileSync('index.html', c);
