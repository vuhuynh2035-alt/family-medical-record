const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Add settings button
html = html.replace(
    /(<button type="button" id="btn-tts-speed" class="tts-ctrl-btn"[^>]*>.*?<\/button>)/,
    `$1\n            <button type="button" id="btn-tts-settings" class="tts-ctrl-btn" title="Cài đặt Giọng đọc">\n                <span class="material-symbols-rounded" style="font-size: 18px;">settings_voice</span>\n            </button>`
);

// Add modal
const modalHTML = `
    <!-- Modal TTS Settings -->
    <div id="modal-tts-settings" class="modal-overlay hidden" role="dialog" aria-modal="true">
        <div class="modal-content neumorphic-panel" style="max-width: 400px; max-height: 85vh; overflow-y: auto;">
            <div class="modal-header">
                <h2>Cài đặt Giọng đọc</h2>
                <button type="button" class="icon-btn close-modal"><span class="material-symbols-rounded">close</span></button>
            </div>
            <div class="modal-body" style="padding: 15px 20px;">
                <div class="form-group">
                    <label style="font-weight: 700; color: var(--primary-blue);">Chế độ đọc</label>
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
                    </div>
                </div>
                
                <div class="form-group" style="margin-top: 20px;">
                    <label style="font-weight: 700; color: var(--primary-blue);">Tùy chỉnh giọng (chỉ áp dụng cho Giọng Tự Nhiên)</label>
                    <p style="font-size: 12px; color: #64748b; margin-bottom: 8px;">Nếu điện thoại của bạn có cài nhiều giọng đọc, bạn có thể chỉ định chính xác giọng muốn dùng.</p>
                    <select id="tts-system-voice-select" class="neumorphic-input" style="width: 100%; font-size: 14px;">
                        <option value="">-- Để máy tự động chọn giọng tốt nhất --</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer" style="display: flex; justify-content: flex-end; padding: 15px 20px; border-top: 1px solid rgba(0,0,0,0.05);">
                <button type="button" class="primary-btn neumorphic-btn close-modal">Đóng & Lưu</button>
            </div>
        </div>
    </div>
`;

if (!html.includes('id="modal-tts-settings"')) {
    html = html.replace('<!-- Crop Modal -->', modalHTML + '\n    <!-- Crop Modal -->');
}

fs.writeFileSync('index.html', html);
console.log("Updated HTML");
