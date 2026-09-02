const fs = require('fs');
let c = fs.readFileSync('js/app.js', 'utf8');

const startIdx = c.indexOf("document.getElementById('btn-tts-mode')?.addEventListener('click'");
if (startIdx !== -1) {
    // Find the end of this block. It ends right before "// Init state UI"
    const endIdx = c.indexOf("// Init state UI", startIdx);
    if (endIdx !== -1) {
        const oldCode = c.substring(startIdx, endIdx);
        console.log("Found old code:", oldCode.substring(0, 50) + "...");
        
        const newCode = `// Wake Lock để giữ màn hình sáng trong khi đọc
let ttsWakeLock = null;
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            ttsWakeLock = await navigator.wakeLock.request('screen');
            ttsWakeLock.addEventListener('release', () => { ttsWakeLock = null; });
        }
    } catch(e) { console.log('WakeLock không được cấp phép:', e); }
}
function releaseWakeLock() {
    if (ttsWakeLock) { ttsWakeLock.release(); ttsWakeLock = null; }
}

document.getElementById('btn-tts-mode')?.addEventListener('click', async () => {
    if (!TTSService) return;
    const btn = document.getElementById('btn-tts-mode');
    const icon = document.getElementById('tts-mode-icon');
    const text = document.getElementById('tts-mode-text');
    
    const isKeepScreenOn = !ttsWakeLock; // Nếu chưa có wake lock → đang tắt → BẬT lên
    
    if (isKeepScreenOn) {
        // BẬT giữ màn hình sáng
        await requestWakeLock();
        if (icon) icon.innerText = 'brightness_high';
        if (text) text.innerText = 'Đang giữ sáng';
        btn.style.background = 'rgba(251, 191, 36, 0.25)';
        btn.style.color = '#fcd34d';
        if (typeof showToast !== 'undefined') showToast('Màn hình sẽ không tắt trong khi đọc ☀️');
    } else {
        // TẮT giữ màn hình — màn hình có thể tự tắt theo cài đặt máy
        releaseWakeLock();
        if (icon) icon.innerText = 'screen_lock_landscape';
        if (text) text.innerText = 'Giữ màn hình';
        btn.style.background = 'rgba(255,255,255,0.2)';
        btn.style.color = '#fff';
        if (typeof showToast !== 'undefined') showToast('Màn hình có thể tự tắt theo cài đặt máy');
    }
});

`;
        c = c.replace(oldCode, newCode);
        fs.writeFileSync('js/app.js', c);
        console.log("REPLACED SUCCESSFULLY");
    } else {
        console.log("Could not find endIdx");
    }
} else {
    console.log("Could not find startIdx");
}
