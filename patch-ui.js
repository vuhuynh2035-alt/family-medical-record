const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');

const target = `<label style="font-weight: 700; color: var(--primary-blue);">Chế độ đọc</label>
                    <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 10px;">
                        <label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer; padding: 10px; background: rgba(0,0,0,0.02); border-radius: 8px;">
                            <input type="radio" name="tts_voice_provider" value="system" style="margin-top: 4px;">
                            <div>
                                <div style="font-weight: 600;">Giọng Tự Nhiên (iOS / Hệ thống)</div>
                                <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Cần giữ màn hình sáng. Nghe êm ái, giống người thật.</div>
                            </div>
                        </label>
                        <label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer; padding: 10px; background: rgba(0,0,0,0.02); border-radius: 8px;">
                            <input type="radio" name="tts_voice_provider" value="google_translate" style="margin-top: 4px;">
                            <div>
                                <div style="font-weight: 600;">Giọng Chạy Nền (Google Robot)</div>
                                <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Vẫn tiếp tục đọc kể cả khi khóa màn hình. Giọng tự động giống chị Google.</div>
                            </div>
                        </label>
                    </div>`;

const replacement = `<label style="font-weight: 700; color: var(--primary-blue);">Chế độ đọc</label>
                    <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 10px;">
                        <label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer; padding: 10px; background: rgba(0,0,0,0.02); border-radius: 8px;">
                            <input type="radio" name="tts_voice_provider" value="system" style="margin-top: 4px;" checked>
                            <div>
                                <div style="font-weight: 600;">Giọng Tự Nhiên (iOS / Hệ thống)</div>
                                <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Hoạt động ổn định trên mọi thiết bị. Có thể bấm nút "Giữ màn hình" trên thanh điều khiển để không bị tắt màn hình khi đọc.</div>
                            </div>
                        </label>
                    </div>`;

if (c.includes(target)) {
    c = c.replace(target, replacement);
    fs.writeFileSync('index.html', c);
    console.log('SUCCESS index.html');
} else {
    // Try regex
    const newTarget = /<label style="font-weight: 700; color: var\(--primary-blue\);">Chế độ đọc<\/label>[\s\S]*?<\/label>\s*<\/div>/;
    c = c.replace(newTarget, replacement);
    fs.writeFileSync('index.html', c);
    console.log('SUCCESS regex index.html');
}
