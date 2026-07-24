/**
 * app.js — điểm khởi tạo (bootstrap), gắn sự kiện (event listeners) và các hàm điều phối
 * (logic functions) nối UI (components.js), dữ liệu (data.js) và AI (ai.js) lại với nhau.
 * Không chứa logic hiển thị HTML trực tiếp — việc đó thuộc về `UI` trong components.js.
 */

let currentMemberId = null;
let currentRecords = [];
let deferredPrompt;
let cropper = null;

/**
 * Hiển thị một thông báo nhỏ, không chặn thao tác (toast), tự biến mất sau vài giây.
 * Dùng cho các phản hồi mang tính thông tin (vd: "Đã lưu cài đặt") thay vì alert() gây gián
 * đoạn trải nghiệm. Các xác nhận hành động phá hủy dữ liệu vẫn dùng confirm()/alert() như cũ
 * để đảm bảo người dùng phải chủ động đọc và xác nhận trước khi tiếp tục.
 * @param {string} message
 * @param {'success'|'error'} [type='success']
 */
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `app-toast app-toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    // Cho phép animation vào rồi mới thêm class hiển thị (giúp transition CSS chạy mượt)
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

// ==================== KHÓA MÀN HÌNH BẰNG MÃ PIN ====================
// Đây là một lớp khóa GIAO DIỆN nhằm tránh người khác vô tình xem được hồ sơ khi
// cầm/mượn thiết bị của bạn — KHÔNG mã hóa dữ liệu (xem ghi chú trong js/data.js).

/** Đồng bộ giao diện phần "Khóa PIN" trong Cài đặt + hiện/ẩn nút khóa nhanh trên header. */
function updatePinUIState() {
    const settings = DataManager.getSettings();
    const pinOn = !!(settings.pinEnabled && settings.pinHash);

    const statusOn = document.getElementById('pin-status-on');
    const statusOff = document.getElementById('pin-status-off');
    if (statusOn) statusOn.classList.toggle('hidden', !pinOn);
    if (statusOff) statusOff.classList.toggle('hidden', pinOn);

    const lockBtn = document.getElementById('btn-lock-now');
    if (lockBtn) lockBtn.classList.toggle('hidden', !pinOn);
}

function showLockScreen() {
    const lockScreen = document.getElementById('lock-screen');
    lockScreen.classList.remove('hidden');
    document.getElementById('unlock-error').classList.add('hidden');
    const input = document.getElementById('input-unlock-pin');
    input.value = '';
    setTimeout(() => input.focus(), 50);
}

/** Ẩn màn hình khóa và tiếp tục các bước khởi tạo vốn bị trì hoãn khi app đang khóa. */
function unlockApp() {
    document.getElementById('lock-screen').classList.add('hidden');
    checkReminders();
    checkBackupReminder();
}

function showPinSetupForm() {
    document.getElementById('pin-setup-form').classList.remove('hidden');
    document.getElementById('input-new-pin').value = '';
    document.getElementById('input-confirm-pin').value = '';
    document.getElementById('input-new-pin').focus();
}

function hidePinSetupForm() {
    document.getElementById('pin-setup-form').classList.add('hidden');
}

function setupPinLockListeners() {
    document.getElementById('form-unlock').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('input-unlock-pin');
        const pin = input.value.trim();
        const errorEl = document.getElementById('unlock-error');
        try {
            const settings = DataManager.getSettings();
            const hash = await DataManager.sha256Hex(pin);
            if (hash === settings.pinHash) {
                unlockApp();
            } else {
                errorEl.classList.remove('hidden');
                input.value = '';
                input.focus();
            }
        } catch (err) {
            alert(err.message);
        }
    });

    document.getElementById('btn-forgot-pin').addEventListener('click', () => {
        if (confirm('Nếu quên mã PIN, bạn có thể tắt khóa để tiếp tục sử dụng ứng dụng — TOÀN BỘ hồ sơ y tế và dữ liệu hiện có sẽ được GIỮ NGUYÊN (chỉ xóa mã PIN, không xóa dữ liệu). Bạn có muốn tắt khóa PIN không?')) {
            DataManager.saveSettings({ pinEnabled: false, pinHash: '' });
            unlockApp();
            updatePinUIState();
            showToast('Đã tắt khóa PIN. Bạn có thể bật lại trong Cài đặt.');
        }
    });

    const btnLockNow = document.getElementById('btn-lock-now');
    if (btnLockNow) {
        btnLockNow.addEventListener('click', () => showLockScreen());
    }

    document.getElementById('btn-enable-pin').addEventListener('click', () => showPinSetupForm());
    document.getElementById('btn-change-pin').addEventListener('click', () => showPinSetupForm());
    document.getElementById('btn-cancel-pin-setup').addEventListener('click', () => hidePinSetupForm());

    document.getElementById('btn-save-pin').addEventListener('click', async () => {
        const pin = document.getElementById('input-new-pin').value.trim();
        const confirmPin = document.getElementById('input-confirm-pin').value.trim();

        if (!/^\d{4,6}$/.test(pin)) {
            alert('Mã PIN phải gồm 4-6 chữ số.');
            return;
        }
        if (pin !== confirmPin) {
            alert('Hai mã PIN nhập vào không khớp. Vui lòng thử lại.');
            return;
        }
        try {
            const hash = await DataManager.sha256Hex(pin);
            DataManager.saveSettings({ pinEnabled: true, pinHash: hash });
            hidePinSetupForm();
            updatePinUIState();
            showToast('Đã bật khóa PIN thành công.');
        } catch (err) {
            alert(err.message);
        }
    });

    document.getElementById('btn-disable-pin').addEventListener('click', () => {
        if (confirm('Tắt khóa PIN? Ứng dụng sẽ mở trực tiếp mà không cần nhập mã PIN nữa.')) {
            DataManager.saveSettings({ pinEnabled: false, pinHash: '' });
            updatePinUIState();
            showToast('Đã tắt khóa PIN.');
        }
    });
}

// PWA Service Worker Registration
let newWorker;
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => {
            console.log('Service Worker registered', reg);
            
            // Tự động kiểm tra bản cập nhật mỗi 1 giờ (3600000 ms)
            setInterval(() => {
                reg.update();
            }, 3600000);

            // Kiểm tra cập nhật mỗi khi người dùng mở lại tab ứng dụng
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    reg.update();
                }
            });

            reg.addEventListener('updatefound', () => {
                newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        const updateToast = document.getElementById('update-toast');
                        if (updateToast) {
                            updateToast.classList.remove('hidden');
                        }
                    }
                });
            });
        }).catch(err => {
            console.log('Service Worker registration failed: ', err);
        });
    });
    
    let refreshing;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        window.location.reload();
        refreshing = true;
    });
}

// Handle PWA Install Prompt
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('btn-install-app');
    if (installBtn) {
        installBtn.classList.remove('hidden');
        installBtn.addEventListener('click', () => {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                deferredPrompt = null;
                installBtn.classList.add('hidden');
            });
        });
    }
});

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    setupEventListeners();
    setupPinLockListeners();
    updatePinUIState();
    UI.enhanceA11y(document); // Gán aria-label cho các nút chỉ có icon (tĩnh trong index.html)
    
    if (typeof HelpService !== 'undefined') {
        HelpService.init();
    }

    const btnUpdateApp = document.getElementById('btn-update-app');
    if (btnUpdateApp) {
        btnUpdateApp.addEventListener('click', () => {
            if (newWorker) {
                newWorker.postMessage('SKIP_WAITING');
            }
        });
    }

    // Tự động nâng cấp cho người dùng cũ đang kẹt ở 1 model Gemini đã bị Google ngừng hỗ trợ
    // (ví dụ model mặc định cũ 'gemini-1.5-flash') mà không hề biết — xem DataManager để rõ danh
    // sách các model đã ngừng hoạt động. Phải chạy TRƯỚC khi đọc settings vào các ô input bên dưới.
    const modelUpgraded = DataManager.migrateDeprecatedGeminiModel();

    // Load Settings
    const settings = DataManager.getSettings();
    if (settings.geminiApiKey) document.getElementById('input-api-key').value = settings.geminiApiKey;
    if (settings.openaiApiKey) document.getElementById('input-openai-key').value = settings.openaiApiKey;
    if (settings.anthropicApiKey) document.getElementById('input-anthropic-key').value = settings.anthropicApiKey;
    if (settings.activeProvider) document.getElementById('input-ai-provider').value = settings.activeProvider;
    if (settings.geminiModel) {
        const select = document.getElementById('input-gemini-model');
        if (!Array.from(select.options).some(opt => opt.value === settings.geminiModel)) {
            const opt = document.createElement('option');
            opt.value = settings.geminiModel;
            opt.innerText = settings.geminiModel;
            select.appendChild(opt);
        }
        select.value = settings.geminiModel;
    }
    if (settings.openaiModel) {
        const select = document.getElementById('input-openai-model');
        if (select && !Array.from(select.options).some(opt => opt.value === settings.openaiModel)) {
            const opt = document.createElement('option');
            opt.value = settings.openaiModel;
            opt.innerText = settings.openaiModel;
            select.appendChild(opt);
        }
        if (select) select.value = settings.openaiModel;
    }
    if (settings.anthropicModel) {
        const select = document.getElementById('input-anthropic-model');
        if (select && !Array.from(select.options).some(opt => opt.value === settings.anthropicModel)) {
            const opt = document.createElement('option');
            opt.value = settings.anthropicModel;
            opt.innerText = settings.anthropicModel;
            select.appendChild(opt);
        }
        if (select) select.value = settings.anthropicModel;
    }
    if (modelUpgraded) {
        showToast(`Model AI (Gemini) đã được tự động cập nhật sang "${settings.geminiModel}" vì phiên bản cũ đã ngừng hoạt động. Bạn có thể đổi lại trong Cài đặt nếu muốn.`);
    }

    // Nếu khóa PIN đang bật: hiện màn hình khóa NGAY và trì hoãn việc kiểm tra/thông báo lịch hẹn
    // tới khi mở khóa thành công — tránh lộ nội dung nhắc hẹn qua hộp thoại alert() trước khi
    // người dùng xác thực (hộp thoại alert() của trình duyệt luôn hiện trên mọi lớp phủ z-index).
    ensureFirstRunTimestamp();
    if (settings.pinEnabled && settings.pinHash) {
        showLockScreen();
    } else {
        checkReminders();
        checkBackupReminder();
    }
});

function initDashboard() {
    const members = DataManager.getMembers();
    UI.renderMembersList(members);
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    // Navigation
    document.getElementById('btn-back-dashboard').addEventListener('click', () => {
        switchView('view-dashboard');
        initDashboard();
    });

    // Nút điều hướng ở cuối trang chi tiết thành viên (trước đây dùng onclick="" nội tuyến —
    // đã chuyển sang addEventListener để tương thích với Content-Security-Policy script-src
    // không cho phép 'unsafe-inline').
    document.getElementById('btn-back-dashboard-bottom').addEventListener('click', () => {
        document.getElementById('btn-back-dashboard').click();
    });
    document.getElementById('btn-scroll-top-detail').addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.querySelectorAll('.btn-scroll-modal-top').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalContent = btn.closest('.modal-content');
            if (modalContent) modalContent.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    // Modals Close
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal-overlay');
            if (modal) closeModal(modal.id);
        });
    });

    // Settings Modal
    document.getElementById('btn-settings').addEventListener('click', () => {
        const settings = DataManager.getSettings();
        
        // Add current model to dropdown if it doesn't exist
        if (settings.geminiModel) {
            const select = document.getElementById('input-gemini-model');
            if (!Array.from(select.options).some(opt => opt.value === settings.geminiModel)) {
                const opt = document.createElement('option');
                opt.value = settings.geminiModel;
                opt.innerText = settings.geminiModel;
                select.appendChild(opt);
            }
            select.value = settings.geminiModel;
        }
        if (settings.openaiModel) {
            const select = document.getElementById('input-openai-model');
            if (select && !Array.from(select.options).some(opt => opt.value === settings.openaiModel)) {
                const opt = document.createElement('option');
                opt.value = settings.openaiModel;
                opt.innerText = settings.openaiModel;
                select.appendChild(opt);
            }
            if (select) select.value = settings.openaiModel;
        }
        if (settings.anthropicModel) {
            const select = document.getElementById('input-anthropic-model');
            if (select && !Array.from(select.options).some(opt => opt.value === settings.anthropicModel)) {
                const opt = document.createElement('option');
                opt.value = settings.anthropicModel;
                opt.innerText = settings.anthropicModel;
                select.appendChild(opt);
            }
            if (select) select.value = settings.anthropicModel;
        }
        updatePinUIState();
        openModal('modal-settings');
    });
    
    document.getElementById('btn-fetch-models').addEventListener('click', async () => {
        const key = document.getElementById('input-api-key').value.trim();
        if (!key) return alert('Vui lòng nhập Google Gemini API Key trước!');
        
        const btn = document.getElementById('btn-fetch-models');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 18px; margin-right: 5px; vertical-align: text-bottom;">hourglass_empty</span>Đang tải...';
        
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
            if (!res.ok) throw new Error('API Key không hợp lệ hoặc lỗi mạng');
            const data = await res.json();
            
            const select = document.getElementById('input-gemini-model');
            const currentSelected = select.value || DataManager.getGeminiModel();
            select.innerHTML = '';
            
            let foundCount = 0;
            data.models.forEach(m => {
                // Only show models that support text generation
                if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent') && m.name.includes('gemini')) {
                    const modelId = m.name.replace('models/', '');
                    const opt = document.createElement('option');
                    opt.value = modelId;
                    opt.innerText = m.displayName || modelId;
                    select.appendChild(opt);
                    foundCount++;
                }
            });
            
            // Restore previous selection if it exists in the new list
            if (Array.from(select.options).some(opt => opt.value === currentSelected)) {
                select.value = currentSelected;
            }
            
            showToast(`Đã tải thành công ${foundCount} mô hình AI hỗ trợ sinh văn bản từ tài khoản của bạn!`);
        } catch (e) {
            alert('Lỗi: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 18px; margin-right: 5px; vertical-align: text-bottom;">sync</span>Tải danh sách';
        }
    });
    
    document.getElementById('btn-fetch-openai-models')?.addEventListener('click', async () => {
        const key = document.getElementById('input-openai-key').value.trim();
        if (!key) return alert('Vui lòng nhập OpenAI API Key trước!');
        
        const btn = document.getElementById('btn-fetch-openai-models');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 18px; margin-right: 5px; vertical-align: text-bottom;">hourglass_empty</span>Đang tải...';
        
        try {
            const res = await fetch('https://api.openai.com/v1/models', {
                headers: { 'Authorization': `Bearer ${key}` }
            });
            if (!res.ok) throw new Error('API Key không hợp lệ hoặc lỗi mạng');
            const data = await res.json();
            
            const select = document.getElementById('input-openai-model');
            const currentSelected = select.value || DataManager.getOpenAIModel();
            select.innerHTML = '';
            
            let foundCount = 0;
            const models = data.data.sort((a, b) => b.created - a.created); // Sort by created desc
            models.forEach(m => {
                if (m.id.includes('gpt') || m.id.includes('o1') || m.id.includes('o3')) {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.innerText = m.id;
                    select.appendChild(opt);
                    foundCount++;
                }
            });
            
            if (Array.from(select.options).some(opt => opt.value === currentSelected)) {
                select.value = currentSelected;
            } else if (currentSelected) {
                const opt = document.createElement('option');
                opt.value = currentSelected;
                opt.innerText = currentSelected;
                select.appendChild(opt);
                select.value = currentSelected;
            }
            showToast(`Đã tải thành công ${foundCount} mô hình ChatGPT từ tài khoản của bạn!`);
        } catch (e) {
            alert('Lỗi: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 18px; margin-right: 5px; vertical-align: text-bottom;">sync</span>Tải danh sách';
        }
    });

    document.getElementById('btn-fetch-anthropic-models')?.addEventListener('click', async () => {
        const key = document.getElementById('input-anthropic-key').value.trim();
        if (!key) return alert('Vui lòng nhập Anthropic API Key trước!');
        
        const btn = document.getElementById('btn-fetch-anthropic-models');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 18px; margin-right: 5px; vertical-align: text-bottom;">hourglass_empty</span>Đang tải...';
        
        try {
            const res = await fetch('https://api.anthropic.com/v1/models', {
                headers: { 
                    'x-api-key': key,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                }
            });
            if (!res.ok) throw new Error('API Key không hợp lệ hoặc bị lỗi mạng/CORS');
            const data = await res.json();
            
            const select = document.getElementById('input-anthropic-model');
            const currentSelected = select.value || DataManager.getAnthropicModel();
            select.innerHTML = '';
            
            let foundCount = 0;
            // anthropic returns { data: [{ type: "model", id: "...", display_name: "...", created_at: "..." }] }
            const models = data.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            models.forEach(m => {
                if (m.id.includes('claude')) {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.innerText = m.display_name ? `${m.display_name} (${m.id})` : m.id;
                    select.appendChild(opt);
                    foundCount++;
                }
            });
            
            if (Array.from(select.options).some(opt => opt.value === currentSelected)) {
                select.value = currentSelected;
            } else if (currentSelected) {
                const opt = document.createElement('option');
                opt.value = currentSelected;
                opt.innerText = currentSelected;
                select.appendChild(opt);
                select.value = currentSelected;
            }
            showToast(`Đã tải thành công ${foundCount} mô hình Claude từ tài khoản của bạn!`);
        } catch (e) {
            alert('Lỗi lấy model Claude: ' + e.message + '. (Lưu ý: API Anthropic có thể chặn trình duyệt).');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 18px; margin-right: 5px; vertical-align: text-bottom;">sync</span>Tải danh sách';
        }
    });
    
    document.getElementById('btn-save-settings').addEventListener('click', () => {
        const geminiKey = document.getElementById('input-api-key').value.trim();
        const openaiKey = document.getElementById('input-openai-key').value.trim();
        const anthropicKey = document.getElementById('input-anthropic-key').value.trim();
        const provider = document.getElementById('input-ai-provider').value;
        const geminiModel = document.getElementById('input-gemini-model').value;
        const openaiModel = document.getElementById('input-openai-model') ? document.getElementById('input-openai-model').value.trim() : '';
        const anthropicModel = document.getElementById('input-anthropic-model') ? document.getElementById('input-anthropic-model').value.trim() : '';

        DataManager.saveSettings({
            geminiApiKey: geminiKey,
            openaiApiKey: openaiKey,
            anthropicApiKey: anthropicKey,
            activeProvider: provider,
            geminiModel: geminiModel,
            openaiModel: openaiModel,
            anthropicModel: anthropicModel
        });

        closeModal('modal-settings');
        showToast("Đã lưu Cấu hình Đa AI.");
    });

    // Backup & Restore
    document.getElementById('btn-export-data').addEventListener('click', async () => {
        try {
            const btn = document.getElementById('btn-export-data');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<span class="material-symbols-rounded" style="vertical-align: text-bottom; font-size: 20px;">hourglass_empty</span> Đang tạo...';
            btn.disabled = true;

            const jsonData = await DataManager.exportData();
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            const now = new Date();
            const dd = String(now.getDate()).padStart(2, '0');
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const yy = String(now.getFullYear()).slice(-2);
            const hour = String(now.getHours()).padStart(2, '0');
            const minute = String(now.getMinutes()).padStart(2, '0');
            a.download = `medical_backup_${dd}${mm}${yy}${hour}${minute}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            // Ghi lại mốc backup gần nhất để tắt nhắc nhở định kỳ cho đến lần hạn tiếp theo
            DataManager.saveSettings({ lastBackupAt: Date.now(), backupReminderSnoozeUntil: null });
            hideBackupReminder();

            btn.innerHTML = originalText;
            btn.disabled = false;
        } catch (e) {
            alert("Lỗi khi sao lưu dữ liệu: " + e.message);
            document.getElementById('btn-export-data').disabled = false;
        }
    });

    document.getElementById('btn-import-data').addEventListener('click', () => {
        document.getElementById('input-import-data').click();
    });

    document.getElementById('input-import-data').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (confirm("LƯU Ý: Quá trình này sẽ XÓA TOÀN BỘ dữ liệu hiện tại trên máy này và thay thế bằng dữ liệu từ file sao lưu. Bạn có chắc chắn muốn tiếp tục?")) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const btn = document.getElementById('btn-import-data');
                    btn.innerHTML = '<span class="material-symbols-rounded" style="vertical-align: text-bottom; font-size: 20px;">hourglass_empty</span> Đang khôi phục...';
                    btn.disabled = true;

                    await DataManager.importData(event.target.result);
                    alert("Khôi phục dữ liệu thành công! Ứng dụng sẽ tự động tải lại.");
                    window.location.reload();
                } catch (err) {
                    alert("Lỗi khôi phục: " + err.message);
                    document.getElementById('btn-import-data').disabled = false;
                    document.getElementById('btn-import-data').innerHTML = '<span class="material-symbols-rounded" style="vertical-align: text-bottom; font-size: 20px;">upload</span> Khôi Phục Dữ Liệu';
                }
            };
            reader.readAsText(file);
        }
        e.target.value = ''; // Reset input
    });

    // Wipe Data Button
    const btnWipeData = document.getElementById('btn-wipe-data');
    if (btnWipeData) {
        btnWipeData.addEventListener('click', () => {
            if (confirm("CẢNH BÁO: Bấm OK sẽ xóa VĨNH VIỄN toàn bộ hồ sơ khám bệnh, thông tin thành viên và hình ảnh trên máy này (Các cài đặt API Key sẽ được giữ nguyên). Bạn có chắc chắn muốn xóa sạch?")) {
                DataManager.wipeAllDataKeepSettings();
                alert("Đã xóa sạch dữ liệu thành công! Ứng dụng sẽ tải lại.");
                window.location.reload();
            }
        });
    }

    // Backup Reminder Banner
    document.getElementById('btn-backup-reminder-now').addEventListener('click', () => {
        updatePinUIState();
        openModal('modal-settings');
    });
    document.getElementById('btn-backup-reminder-later').addEventListener('click', () => {
        DataManager.saveSettings({ backupReminderSnoozeUntil: Date.now() + BACKUP_REMINDER_SNOOZE_MS });
        hideBackupReminder();
    });

    // Notifications Modal
    document.getElementById('btn-notifications').addEventListener('click', () => openNotifications());



    // DOB Toggle Logic
    document.getElementById('toggle-dob-type').addEventListener('click', (e) => {
        const isYearOnly = document.getElementById('member-dob-full').classList.contains('hidden');
        if (isYearOnly) {
            document.getElementById('member-dob-full').classList.remove('hidden');
            document.getElementById('member-dob-year').classList.add('hidden');
            e.target.innerText = 'Chỉ nhập Năm';
        } else {
            document.getElementById('member-dob-full').classList.add('hidden');
            document.getElementById('member-dob-year').classList.remove('hidden');
            e.target.innerText = 'Nhập chi tiết ngày';
        }
    });

    // Member Modal
    document.getElementById('btn-add-member').addEventListener('click', () => {
        document.getElementById('form-member').reset();
        document.getElementById('member-id').value = '';
        document.getElementById('member-nickname').value = '';
        document.getElementById('member-avatar-preview').src = UI.getAvatarUrl(null);
        document.getElementById('modal-member-title').innerText = 'Thêm thành viên';
        document.getElementById('custom-fields-container').innerHTML = ''; // Clear custom fields
        
        document.getElementById('member-dob-full').classList.remove('hidden');
        document.getElementById('member-dob-year').classList.add('hidden');
        document.getElementById('toggle-dob-type').innerText = 'Chỉ nhập Năm';
        
        document.getElementById('btn-delete-member').classList.add('hidden');
        
        openModal('modal-member');
    });

    // Avatar Upload
    document.getElementById('btn-upload-avatar').addEventListener('click', () => {
        document.getElementById('member-avatar-input').click();
    });
    document.getElementById('member-avatar-input').addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            const imageToCrop = document.getElementById('image-to-crop');
            imageToCrop.src = url;
            
            openModal('modal-crop');
            
            if (cropper) {
                cropper.destroy();
            }
            
            setTimeout(() => {
                cropper = new Cropper(imageToCrop, {
                    aspectRatio: 1,
                    viewMode: 1,
                    dragMode: 'move',
                    autoCropArea: 1,
                    restore: false,
                    guides: true,
                    center: true,
                    highlight: false,
                    cropBoxMovable: true,
                    cropBoxResizable: true,
                    toggleDragModeOnDblclick: false,
                });
            }, 100);
            
            e.target.value = '';
        }
    });

    document.getElementById('btn-save-crop').addEventListener('click', () => {
        if (!cropper) return;
        const canvas = cropper.getCroppedCanvas({
            width: 300,
            height: 300
        });
        
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        document.getElementById('member-avatar-preview').src = base64;
        closeModal('modal-crop');
    });

    // Custom Fields
    document.getElementById('btn-add-custom-field').addEventListener('click', () => {
        const container = document.getElementById('custom-fields-container');
        const fieldRow = document.createElement('div');
        fieldRow.style.display = 'flex';
        fieldRow.style.gap = '10px';
        fieldRow.className = 'custom-field-row';
        fieldRow.innerHTML = `
            <input type="text" class="neumorphic-input custom-field-key" placeholder="Tên mục (VD: Cân nặng)" style="flex: 1;">
            <input type="text" class="neumorphic-input custom-field-value" placeholder="Nội dung (VD: 65kg)" style="flex: 2;">
            <button type="button" class="icon-btn neumorphic-btn danger btn-remove-custom-field" style="padding: 10px;" aria-label="Xóa mục thông tin bổ sung này"><span class="material-symbols-rounded">delete</span></button>
        `;
        container.appendChild(fieldRow);
        
        fieldRow.querySelector('.btn-remove-custom-field').addEventListener('click', () => {
            fieldRow.remove();
        });
    });

    // Save Member
    document.getElementById('form-member').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const customFields = [];
        document.querySelectorAll('.custom-field-row').forEach(row => {
            const key = row.querySelector('.custom-field-key').value.trim();
            const value = row.querySelector('.custom-field-value').value.trim();
            if (key && value) {
                customFields.push({ key, value });
            }
        });

        const memberData = {
            id: document.getElementById('member-id').value,
            name: document.getElementById('member-name').value,
            nickname: document.getElementById('member-nickname').value,
            dob: document.getElementById('member-dob-full').classList.contains('hidden') ? 
                 document.getElementById('member-dob-year').value : 
                 (document.getElementById('member-dob-full').value ? document.getElementById('member-dob-full').value.split('-').reverse().join('/') : ''),
            blood: document.getElementById('member-blood').value,
            height: document.getElementById('member-height').value,
            weight: document.getElementById('member-weight').value,
            conditions: document.getElementById('member-conditions').value,
            avatar: document.getElementById('member-avatar-preview').src,
            customFields: customFields
        };
        DataManager.saveMember(memberData);
        closeModal('modal-member');
        
        if (currentMemberId === memberData.id) {
            loadMemberDetail(currentMemberId); // Đang ở trang detail thì reload detail
        } else {
            initDashboard(); // Reload dashboard
        }
    });

    // Click on Member Card
    document.getElementById('members-grid').addEventListener('click', (e) => {
        const card = e.target.closest('.member-card');
        if (card) {
            const id = card.dataset.id;
            loadMemberDetail(id);
        }
    });

    // Member Actions (Edit / Delete)
    document.getElementById('btn-edit-member').addEventListener('click', () => {
        const member = DataManager.getMemberById(currentMemberId);
        if (member) {
            document.getElementById('member-id').value = member.id;
            document.getElementById('member-name').value = member.name;
            document.getElementById('member-nickname').value = member.nickname || '';
            const dob = member.dob || '';
            if (dob.includes('/')) {
                document.getElementById('member-dob-full').value = dob.split('/').reverse().join('-');
                document.getElementById('member-dob-full').classList.remove('hidden');
                document.getElementById('member-dob-year').classList.add('hidden');
                document.getElementById('toggle-dob-type').innerText = 'Chỉ nhập Năm';
            } else {
                document.getElementById('member-dob-year').value = dob;
                document.getElementById('member-dob-full').classList.add('hidden');
                document.getElementById('member-dob-year').classList.remove('hidden');
                document.getElementById('toggle-dob-type').innerText = 'Nhập chi tiết ngày';
            }
            document.getElementById('member-blood').value = member.blood || '';
            document.getElementById('member-height').value = member.height || '';
            document.getElementById('member-weight').value = member.weight || '';
            document.getElementById('member-conditions').value = member.conditions || '';
            document.getElementById('member-avatar-preview').src = UI.getAvatarUrl(member);
            document.getElementById('modal-member-title').innerText = 'Sửa thông tin thành viên';
            
            const container = document.getElementById('custom-fields-container');
            container.innerHTML = '';
            if (member.customFields && member.customFields.length > 0) {
                member.customFields.forEach(field => {
                    const fieldRow = document.createElement('div');
                    fieldRow.style.display = 'flex';
                    fieldRow.style.gap = '10px';
                    fieldRow.className = 'custom-field-row';
                    fieldRow.innerHTML = `
                        <input type="text" class="neumorphic-input custom-field-key" placeholder="Tên mục" value="${field.key}" style="flex: 1;">
                        <input type="text" class="neumorphic-input custom-field-value" placeholder="Nội dung" value="${field.value}" style="flex: 2;">
                        <button type="button" class="icon-btn neumorphic-btn danger btn-remove-custom-field" style="padding: 10px;" aria-label="Xóa mục thông tin bổ sung này"><span class="material-symbols-rounded">delete</span></button>
                    `;
                    container.appendChild(fieldRow);
                    fieldRow.querySelector('.btn-remove-custom-field').addEventListener('click', () => {
                        fieldRow.remove();
                    });
                });
            }

            document.getElementById('btn-delete-member').classList.remove('hidden');

            openModal('modal-member');
        }
    });

    document.getElementById('btn-delete-member').addEventListener('click', async () => {
        if (confirm("Bạn có chắc chắn muốn xóa thành viên này và toàn bộ hồ sơ khám bệnh liên quan?")) {
            const records = DataManager.getRecords(currentMemberId);
            for (let record of records) {
                const images = record.originalImages || (record.originalImage ? [record.originalImage] : []);
                for (let imgId of images) {
                    if (imgId.startsWith('img_')) await ImageStore.deleteImage(imgId);
                }
            }
            DataManager.deleteMember(currentMemberId);
            closeModal('modal-member');
            switchView('view-dashboard');
            initDashboard();
        }
    });

    // Tabs in Detail View
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove active classes
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

            // Add active class
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');

            // Đổi tab hiển thị nội dung khác hẳn (Hồ sơ / Lịch sử khám / Thống kê / Lịch hẹn) —
            // luôn cuộn về đầu trang để người dùng thấy ngay nội dung mới thay vì vẫn đứng ở vị
            // trí cuộn cũ của tab trước (đặc biệt rõ khi tab trước dài, tab sau ngắn hơn nhiều).
            window.scrollTo(0, 0);
        });
    });

    // Record Modal & Actions
    document.getElementById('btn-add-record').addEventListener('click', () => {
        document.getElementById('form-record').reset();
        document.getElementById('record-id').value = '';
        if(document.getElementById('ocr-preview-container')) {
            document.getElementById('ocr-preview-container').style.display = 'none';
            document.getElementById('ocr-preview-container').innerHTML = '';
        }
        if (document.getElementById('btn-scan-analyze')) {
            document.getElementById('btn-scan-analyze').disabled = true;
        }

        document.getElementById('dynamic-fields-container').innerHTML = '';
        if (document.getElementById('record-comprehensive-report-data')) {
            document.getElementById('record-comprehensive-report-data').value = '';
            document.getElementById('btn-view-ai-report').classList.add('hidden');
        }
        document.getElementById('btn-delete-record-modal').classList.add('hidden');
        
        openModal('modal-record');
    });

    // Save Record
    document.getElementById('form-record').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Save images to ImageStore
        const imgElements = document.querySelectorAll('#ocr-preview-container img');
        const imageIds = [];
        for (let img of imgElements) {
            if (img.dataset.imgId) {
                imageIds.push(img.dataset.imgId); // Already saved
            } else if (img.src && img.src.startsWith('data:image')) {
                const id = await ImageStore.saveImage(img.src);
                imageIds.push(id);
            }
        }
        
        const recordData = {
            id: document.getElementById('record-id').value,
            date: document.getElementById('record-date').value,
            type: document.getElementById('record-type').value,
            hospital: document.getElementById('record-hospital').value,
            doctor: document.getElementById('record-doctor').value,
            disease: document.getElementById('record-disease').value,
            cost: document.getElementById('record-cost').value || 0,
            treatment: document.getElementById('record-treatment').value,
            // New EMR fields
            bp: document.getElementById('record-bp').value,
            hr: document.getElementById('record-hr').value,
            temp: document.getElementById('record-temp').value,
            spo2: document.getElementById('record-spo2').value,
            symptoms: document.getElementById('record-symptoms').value,
            labs: document.getElementById('record-labs').value,
            note: document.getElementById('record-note').value,
            comprehensiveReport: document.getElementById('record-comprehensive-report-data') ? document.getElementById('record-comprehensive-report-data').value : '',
            originalImages: imageIds
        };
        
        const dynamicFieldRows = document.querySelectorAll('.dynamic-field-row');
        const dynamicFields = [];
        dynamicFieldRows.forEach(row => {
            const k = row.querySelector('.dynamic-field-key').value.trim();
            const v = row.querySelector('.dynamic-field-value').value.trim();
            const isAbnormal = row.querySelector('.dynamic-field-abnormal') ? row.querySelector('.dynamic-field-abnormal').checked : false;
            if(k) {
                dynamicFields.push({ key: k, value: v, isAbnormal: isAbnormal });
            }
        });
        recordData.dynamicFields = dynamicFields;
        
        DataManager.saveRecord(currentMemberId, recordData);
        closeModal('modal-record');
        reloadRecordsAndStats();
    });

    // Delete Modal Record logic
    document.getElementById('btn-delete-record-modal').addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (id && confirm("Bạn có chắc chắn muốn xóa hồ sơ khám bệnh này? Dữ liệu không thể khôi phục.")) {
            const record = currentRecords.find(r => r.id === id);
            if (record && record.originalImages) {
                for (let imgId of record.originalImages) {
                    if (imgId.startsWith('img_')) await ImageStore.deleteImage(imgId);
                }
            }
            if (record && record.originalImage && record.originalImage.startsWith('img_')) {
                await ImageStore.deleteImage(record.originalImage);
            }
            
            DataManager.deleteRecord(currentMemberId, id);
            closeModal('modal-record');
            reloadRecordsAndStats();
        }
    });

    // Edit / Delete Record / AI / Image View (Event Delegation)
    document.getElementById('records-list').addEventListener('click', async (e) => {
        const btnEdit = e.target.closest('.btn-edit-record');
        if (btnEdit) {
            try {
                const id = btnEdit.dataset.id;
                const record = currentRecords.find(r => r.id === id);
                if (record) {
                    document.getElementById('record-id').value = record.id;
                document.getElementById('record-date').value = record.date;
                document.getElementById('record-type').value = record.type;
                document.getElementById('record-hospital').value = record.hospital;
                document.getElementById('record-doctor').value = record.doctor || '';
                document.getElementById('record-disease').value = record.disease;
                document.getElementById('record-cost').value = record.cost || '';
                document.getElementById('record-treatment').value = record.treatment || '';
                
                // New EMR fields
                document.getElementById('record-bp').value = record.bp || '';
                document.getElementById('record-hr').value = record.hr || '';
                document.getElementById('record-temp').value = record.temp || '';
                document.getElementById('record-spo2').value = record.spo2 || '';
                document.getElementById('record-symptoms').value = record.symptoms || '';
                document.getElementById('record-labs').value = record.labs || '';
                document.getElementById('record-note').value = record.note || '';
                if (document.getElementById('record-comprehensive-report-data')) {
                    document.getElementById('record-comprehensive-report-data').value = record.comprehensiveReport || '';
                    if (record.comprehensiveReport) {
                        document.getElementById('btn-view-ai-report').classList.remove('hidden');
                    } else {
                        document.getElementById('btn-view-ai-report').classList.add('hidden');
                    }
                }

                if (document.getElementById('ocr-preview-container')) {
                    const container = document.getElementById('ocr-preview-container');
                    container.innerHTML = '';
                    
                    const images = record.originalImages || (record.originalImage ? [record.originalImage] : []);
                    if (images.length > 0) {
                        for (let imgData of images) {
                            if (imgData.startsWith('img_')) {
                                try {
                                    const base64 = await ImageStore.getImage(imgData);
                                    if(base64) addImageToPreview(base64, imgData);
                                } catch(err) {
                                    console.error("Lỗi khi tải ảnh đính kèm:", err);
                                }
                            } else {
                                addImageToPreview(imgData); // Legacy base64
                            }
                        }
                    } else {
                        container.style.display = 'none';
                        if (document.getElementById('btn-scan-analyze')) {
                            document.getElementById('btn-scan-analyze').disabled = true;
                        }
                    }
                }
                
                document.getElementById('dynamic-fields-container').innerHTML = '';
                if (record.dynamicFields && record.dynamicFields.length > 0) {
                    record.dynamicFields.forEach(f => {
                        addDynamicFieldRow(f.key, f.value, f.isAbnormal);
                    });
                }
                
                    document.getElementById('btn-delete-record-modal').classList.remove('hidden');
                    document.getElementById('btn-delete-record-modal').dataset.id = record.id;
                    
                    openModal('modal-record');
                }
            } catch (err) {
                console.error("Lỗi khi mở form sửa:", err);
                alert("Đã xảy ra lỗi khi mở hồ sơ: " + err.message);
            }
            return;
        }
        
        const btnView = e.target.closest('.record-item');
        if (btnView && !e.target.closest('.record-actions')) {
            const id = btnView.dataset.id;
            const record = currentRecords.find(r => r.id === id);
            if (record) {
                await UI.renderRecordDetailModal(record);
                openModal('modal-view-record');
            }
            return;
        }
        
        const btnViewImg = e.target.closest('.btn-view-img');
        if (btnViewImg) {
            let src = btnViewImg.dataset.img;
            if (src && src.startsWith('img_')) {
                src = await ImageStore.getImage(src);
            }
            document.getElementById('viewer-image').src = src;
            openModal('modal-image-viewer');
            return;
        }
        
        const btnAi = e.target.closest('.btn-ai-assessment') || e.target.closest('.btn-ai-eval');
        if (btnAi) {
            const id = btnAi.dataset.id;
            const record = currentRecords.find(r => r.id === id);
            const member = DataManager.getMemberById(currentMemberId);
            
            if (record && member) {
                const activeProvider = DataManager.getActiveProvider();
                const pName = activeProvider === 'openai' ? 'ChatGPT' : (activeProvider === 'anthropic' ? 'Claude' : 'Gemini');
                
                document.querySelector('#modal-ai-assessment .modal-header h3').innerHTML = `<span class="material-symbols-rounded ai-sparkle">psychiatry</span> ${pName} Nhận xét tình trạng`;
                openModal('modal-ai-assessment');
                const loading = document.getElementById('ai-assessment-loading');
                const content = document.getElementById('ai-assessment-content');
                
                loading.innerHTML = `<span class="loading-spinner"></span> ${pName} đang tổng hợp và phân tích hồ sơ...`;
                loading.classList.remove('hidden');
                content.innerHTML = '';
                
                try {
                    const mdText = await AIService.generateHealthAssessment(record, member);
                    content.innerHTML = UI.renderMarkdown(mdText);
                } catch (err) {
                    content.innerHTML = `<p style="color:var(--danger);">Lỗi khi liên hệ AI: ${err.message}</p>`;
                } finally {
                    loading.classList.add('hidden');
                }
            }
            return;
        }

        const btnSearch = e.target.closest('.btn-search-disease');
        if (btnSearch) {
            const disease = btnSearch.dataset.disease;
            if (!disease) return;
            
            const activeProvider = DataManager.getActiveProvider();
            const pName = activeProvider === 'openai' ? 'ChatGPT' : (activeProvider === 'anthropic' ? 'Claude' : 'Gemini');
            
            document.querySelector('#modal-ai-assessment .modal-header h3').innerHTML = `<span class="material-symbols-rounded ai-sparkle">travel_explore</span> Tra cứu chuyên sâu (${pName})`;
            openModal('modal-ai-assessment');
            const loading = document.getElementById('ai-assessment-loading');
            const content = document.getElementById('ai-assessment-content');
            
            loading.innerHTML = `<span class="loading-spinner"></span> ${pName} đang tra cứu chuyên sâu về "${disease}"... Xin vui lòng chờ.`;
            loading.classList.remove('hidden');
            content.innerHTML = '';
            try {
                const aiResult = await AIService.searchDiseaseInfo(disease);
                loading.classList.add('hidden');
                content.innerHTML = UI.renderMarkdown(aiResult);
            } catch (err) {
                loading.classList.add('hidden');
                content.innerHTML = `<p style="color:var(--danger);">Lỗi khi liên hệ AI: ${err.message}</p>`;
            }
            return;
        }
    });

    // AI OCR Handling
    document.getElementById('btn-select-ocr-img').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('record-image-input').click();
    });

    document.getElementById('record-image-input').addEventListener('change', async (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const btnScan = document.getElementById('btn-scan-analyze');
            const originalScanText = btnScan.innerHTML;
            const files = e.target.files;

            btnScan.innerHTML = `<span class="material-symbols-rounded" style="vertical-align: middle;">hourglass_empty</span> Đang tải...`;
            btnScan.disabled = true;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                try {
                    if (file.type === 'application/pdf') {
                        btnScan.innerHTML = `<span class="material-symbols-rounded" style="vertical-align: middle;">hourglass_empty</span> Đang đọc PDF...`;
                        await new Promise(r => setTimeout(r, 50));
                        
                        const arrayBuffer = await file.arrayBuffer();
                        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                        
                        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                            btnScan.innerHTML = `<span class="material-symbols-rounded" style="vertical-align: middle;">hourglass_empty</span> Tách trang ${pageNum}/${pdf.numPages}...`;
                            await new Promise(r => setTimeout(r, 50));
                            
                            const page = await pdf.getPage(pageNum);
                            const viewport = page.getViewport({ scale: 1.5 });
                            const canvas = document.createElement('canvas');
                            const context = canvas.getContext('2d');
                            canvas.height = viewport.height;
                            canvas.width = viewport.width;
                            
                            await page.render({ canvasContext: context, viewport: viewport }).promise;
                            
                            const base64 = canvas.toDataURL('image/jpeg', 0.8);
                            addImageToPreview(base64);
                        }
                    } else {
                        btnScan.innerHTML = `<span class="material-symbols-rounded" style="vertical-align: middle;">hourglass_empty</span> Đang tải ảnh ${i + 1}/${files.length}...`;
                        await new Promise(r => setTimeout(r, 50));
                        const base64 = await DataManager.fileToBase64(file);
                        if (base64) {
                            addImageToPreview(base64);
                        }
                    }
                } catch (err) {
                    console.error("Lỗi khi tải file:", err);
                    alert("Có lỗi khi xử lý file " + file.name + ": " + err.message);
                }
            }

            e.target.value = '';
            setTimeout(() => {
                btnScan.innerHTML = originalScanText;
            }, 500);
        }
    });

    // Điền form & Tạo báo cáo đánh giá (1 nút duy nhất, gộp từ 2 nút cũ "Điền form" và
    // "Kết luận"). Bấm 1 lần sẽ chạy đồng thời 2 lệnh gọi AI độc lập trên cùng bộ ảnh đã chọn:
    // (1) trích xuất dữ liệu để tự động điền vào form, và (2) tạo báo cáo đánh giá tổng hợp.
    // Dùng Promise.allSettled thay vì Promise.all để nếu 1 trong 2 lệnh gọi AI bị lỗi (hết
    // quota, mạng chập chờn...) thì lệnh còn lại vẫn được xử lý và hiển thị kết quả bình
    // thường, thay vì mất trắng cả hai chỉ vì một lệnh lỗi.
    document.getElementById('btn-scan-analyze').addEventListener('click', async (e) => {
        e.preventDefault();
        const checkedImgs = Array.from(document.querySelectorAll('#ocr-preview-container > div')).filter(div => {
            const cb = div.querySelector('.ai-select-checkbox');
            return !cb || cb.checked;
        }).map(div => {
            const img = div.querySelector('img');
            return img ? (img.dataset.pdfData || img.src) : null;
        }).filter(src => src);

        if (checkedImgs.length === 0) {
            alert("Vui lòng chọn ít nhất một ảnh để phân tích!");
            return;
        }

        if (!DataManager.getGeminiApiKey()) {
            alert("Vui lòng vào cài đặt nhập API Key của Gemini trước!");
            return;
        }

        const base64Images = checkedImgs;
        const btn = document.getElementById('btn-scan-analyze');
        const loading = document.getElementById('ocr-loading');
        const loadingText = document.getElementById('ocr-loading-text');
        const loadingPercent = document.getElementById('ocr-loading-percent');
        const loadingBar = document.getElementById('ocr-loading-bar');

        btn.disabled = true;
        loading.classList.remove('hidden');
        loadingBar.style.width = '0%';
        loadingPercent.innerText = '0%';
        loadingText.innerText = `Đang phân tích ảnh: vừa điền form vừa tạo báo cáo đánh giá...`;

        let progress = 0;
        const progressInterval = setInterval(() => {
            if (progress < 90) {
                progress += Math.random() * 6;
                if (progress > 90) progress = 90;
                loadingBar.style.width = progress + '%';
                loadingPercent.innerText = Math.round(progress) + '%';
            }
        }, 600);

        const openReportViewer = (reportMarkdown) => {
            document.getElementById('record-comprehensive-report-data').value = reportMarkdown;
            document.getElementById('btn-view-ai-report').classList.remove('hidden');
            const preview = document.getElementById('report-preview-mode');
            const editor = document.getElementById('report-edit-mode');
            preview.innerHTML = UI.renderMarkdown(reportMarkdown);
            editor.value = reportMarkdown;
            preview.classList.remove('hidden');
            editor.classList.add('hidden');
            document.getElementById('btn-save-report-editor').classList.add('hidden');
            openModal('modal-ai-report-editor');
        };

        const [autofillResult, reportResult] = await Promise.allSettled([
            AIService.extractDataFromImage(base64Images),
            AIService.generateComprehensiveReport(base64Images, 'gemini')
        ]);

        clearInterval(progressInterval);

        let autofillOk = false;
        if (autofillResult.status === 'fulfilled') {
            const data = autofillResult.value;
            if (data.date) document.getElementById('record-date').value = data.date;
            if (data.hospital) document.getElementById('record-hospital').value = data.hospital;
            if (data.doctor) document.getElementById('record-doctor').value = data.doctor;
            // Lưu ý: "disease" (chẩn đoán/kết luận) có thể để trống nếu ảnh chỉ là phiếu kết
            // quả xét nghiệm chưa có kết luận của bác sĩ — trường này không còn bắt buộc.
            if (data.disease) document.getElementById('record-disease').value = data.disease;
            if (data.treatment) document.getElementById('record-treatment').value = data.treatment;
            if (data.cost !== undefined) document.getElementById('record-cost').value = data.cost;
            if (data.type) {
                document.getElementById('record-type').value = data.type;
            }
            if (data.bp) document.getElementById('record-bp').value = data.bp;
            if (data.hr) document.getElementById('record-hr').value = data.hr;
            if (data.temp) document.getElementById('record-temp').value = data.temp;
            if (data.spo2) document.getElementById('record-spo2').value = data.spo2;
            if (data.symptoms) document.getElementById('record-symptoms').value = data.symptoms;
            if (data.labs) document.getElementById('record-labs').value = data.labs;
            if (data.note) document.getElementById('record-note').value = data.note;

            document.getElementById('dynamic-fields-container').innerHTML = '';
            if (data.dynamicFields && data.dynamicFields.length > 0) {
                data.dynamicFields.forEach(f => {
                    addDynamicFieldRow(f.key, f.value, f.isAbnormal);
                });
            }
            autofillOk = true;
        } else {
            console.error("Lỗi khi điền form từ ảnh:", autofillResult.reason);
        }

        let reportOk = false;
        let reportMarkdown = '';
        if (reportResult.status === 'fulfilled') {
            reportMarkdown = reportResult.value;
            reportOk = true;
        } else {
            console.error("Lỗi khi tạo báo cáo đánh giá:", reportResult.reason);
        }

        loadingBar.style.width = '100%';
        loadingPercent.innerText = '100%';

        if (autofillOk && reportOk) {
            loadingText.innerText = 'Hoàn tất: đã điền form & tạo báo cáo!';
            showToast("Đã điền form và tạo báo cáo đánh giá thành công!");
            openReportViewer(reportMarkdown);
        } else if (autofillOk && !reportOk) {
            loadingText.innerText = 'Đã điền form, nhưng tạo báo cáo thất bại';
            const msg = (reportResult.reason && reportResult.reason.message) || 'Lỗi không xác định';
            showToast("Đã điền thông tin form, nhưng tạo báo cáo đánh giá bị lỗi: " + msg, 'error');
        } else if (!autofillOk && reportOk) {
            loadingText.innerText = 'Đã tạo báo cáo, nhưng điền form thất bại';
            const msg = (autofillResult.reason && autofillResult.reason.message) || 'Lỗi không xác định';
            showToast("Đã tạo báo cáo đánh giá, nhưng điền thông tin form bị lỗi: " + msg, 'error');
            openReportViewer(reportMarkdown);
        } else {
            loadingBar.style.width = '0%';
            loadingPercent.innerText = 'Lỗi';
            loadingText.innerText = 'Phân tích thất bại';
            const errMsg = (autofillResult.reason && autofillResult.reason.message) || (reportResult.reason && reportResult.reason.message) || 'Lỗi không xác định';
            alert("Lỗi khi phân tích ảnh: " + errMsg);
        }

        btn.disabled = false;
        setTimeout(() => { loading.classList.add('hidden'); }, 3000);
    });

    document.getElementById('btn-download-pdf').addEventListener('click', () => {
        const element = document.getElementById('report-preview-mode');
        
        const originalMaxHeight = element.style.maxHeight;
        const originalOverflow = element.style.overflowY;
        element.style.maxHeight = 'none';
        element.style.overflowY = 'visible';

        const opt = {
            margin:       0.5,
            filename:     'Bao_Cao_Y_Khoa.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
        };
        
        html2pdf().set(opt).from(element).save().then(() => {
            element.style.maxHeight = originalMaxHeight;
            element.style.overflowY = originalOverflow;
        });
    });

    document.getElementById('btn-download-record-pdf').addEventListener('click', () => {
        const element = document.getElementById('view-record-content');
        const opt = {
            margin:       0.5,
            filename:     'Chi_Tiet_Ho_So.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
    });

    document.getElementById('btn-download-assessment-pdf').addEventListener('click', () => {
        const element = document.getElementById('ai-assessment-content');
        const titleText = document.querySelector('#modal-ai-assessment .modal-header h3').innerText.trim().replace('psychiatry', '').trim() || 'AI_Assessment';
        const opt = {
            margin:       0.5,
            filename:     `${titleText}.pdf`.replace(/\s+/g, '_'),
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
    });

    // Report Editor Modal Logic
    document.getElementById('btn-view-ai-report').addEventListener('click', () => {
        const reportData = document.getElementById('record-comprehensive-report-data').value;
        const preview = document.getElementById('report-preview-mode');
        const editor = document.getElementById('report-edit-mode');
        
        preview.innerHTML = UI.renderMarkdown(reportData || '*Chưa có báo cáo nào.*');
        editor.value = reportData || '';
        
        preview.classList.remove('hidden');
        editor.classList.add('hidden');
        document.getElementById('btn-save-report-editor').classList.add('hidden');
        
        openModal('modal-ai-report-editor');
    });

    document.getElementById('btn-toggle-report-edit').addEventListener('click', () => {
        const preview = document.getElementById('report-preview-mode');
        const editor = document.getElementById('report-edit-mode');
        const saveBtn = document.getElementById('btn-save-report-editor');
        
        if (editor.classList.contains('hidden')) {
            editor.classList.remove('hidden');
            preview.classList.add('hidden');
            saveBtn.classList.remove('hidden');
        } else {
            editor.classList.add('hidden');
            preview.classList.remove('hidden');
            saveBtn.classList.add('hidden');
            preview.innerHTML = UI.renderMarkdown(editor.value || '*Chưa có báo cáo nào.*');
        }
    });

    document.getElementById('btn-save-report-editor').addEventListener('click', () => {
        const editor = document.getElementById('report-edit-mode');
        document.getElementById('record-comprehensive-report-data').value = editor.value;
        closeModal('modal-ai-report-editor');
    });

    // Search and Filter
    document.getElementById('search-history').addEventListener('input', applyFilters);
    document.getElementById('filter-type').addEventListener('change', applyFilters);
    document.getElementById('filter-month').addEventListener('change', applyFilters);

    // Add Reminder (Member View)
    document.getElementById('btn-add-reminder').addEventListener('click', () => {
        document.getElementById('form-reminder').reset();
        document.getElementById('reminder-id').value = '';
        document.getElementById('modal-reminder-title').innerText = 'Tạo lịch hẹn mới';
        openModal('modal-reminder');
    });

    // Dynamic Fields Logic
    document.getElementById('btn-add-dynamic-field').addEventListener('click', () => {
        addDynamicFieldRow();
    });

    document.getElementById('form-reminder').addEventListener('submit', (e) => {
        e.preventDefault();
        const datetime = `${document.getElementById('reminder-date').value}T${document.getElementById('reminder-time').value}`;
        const rmData = {
            id: document.getElementById('reminder-id').value,
            memberId: currentMemberId,
            title: document.getElementById('reminder-title').value,
            date: document.getElementById('reminder-date').value,
            time: document.getElementById('reminder-time').value,
            note: document.getElementById('reminder-note').value,
            datetime
        };
        // Nếu ngày giờ (mới) nằm trong tương lai, đảm bảo lịch hẹn được "gỡ" trạng thái đã nhắc
        // trước đó — quan trọng khi sửa một lịch hẹn cũ đã qua hạn sang một ngày mới, để nó
        // được nhắc lại đúng hạn thay vì bị coi là "đã qua" mãi mãi.
        if (new Date(datetime) > new Date()) {
            rmData.notified = false;
        }
        DataManager.saveReminder(rmData);
        closeModal('modal-reminder');
        reloadRecordsAndStats();
        checkReminders();
    });
}

// --- LOGIC FUNCTIONS ---
function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    // Mỗi khi chuyển sang 1 "trang" mới (Trang chủ <-> Chi tiết thành viên), luôn đưa vị trí
    // xem về đầu trang — tránh trường hợp trang mới hiển thị ngay tại vị trí cuộn dở dang của
    // trang trước đó (vì đây là ứng dụng 1 trang - SPA - nên trình duyệt không tự cuộn lại).
    window.scrollTo(0, 0);
}

function addImageToPreview(src, id = null) {
    const container = document.getElementById('ocr-preview-container');
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';
    
    const img = document.createElement('img');
    const isPDF = src && src.startsWith('data:application/pdf');
    if (isPDF) {
        img.src = 'https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg';
        img.dataset.pdfData = src;
        img.style.padding = '10px';
        img.style.background = 'white';
        img.title = 'Tài liệu PDF';
    } else {
        img.src = src || '';
        img.style.cursor = 'zoom-in';
        img.title = 'Nhấn để phóng to';
        img.addEventListener('click', () => {
            document.getElementById('lightbox-img').src = src;
            openModal('modal-lightbox');
        });
    }
    
    if (id) img.dataset.imgId = id;
    img.style.maxHeight = '100px';
    img.style.borderRadius = '8px';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'ai-select-checkbox';
    checkbox.checked = true;
    checkbox.style.position = 'absolute';
    checkbox.style.top = '5px';
    checkbox.style.left = '5px';
    checkbox.style.width = '20px';
    checkbox.style.height = '20px';
    checkbox.style.cursor = 'pointer';
    checkbox.style.zIndex = '10';
    checkbox.style.accentColor = 'var(--primary-blue)';
    checkbox.title = 'Chọn ảnh này để AI phân tích';
    
    const delBtn = document.createElement('button');
    delBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 14px;">close</span>';
    delBtn.className = 'icon-btn';
    delBtn.style.position = 'absolute';
    delBtn.style.top = '-5px';
    delBtn.style.right = '-5px';
    delBtn.style.background = 'var(--danger)';
    delBtn.style.color = 'white';
    delBtn.style.width = '20px';
    delBtn.style.height = '20px';
    delBtn.style.padding = '0';
    delBtn.style.display = 'flex';
    delBtn.style.alignItems = 'center';
    delBtn.style.justifyContent = 'center';
    delBtn.style.border = '2px solid white';
    delBtn.style.opacity = '0'; // Ẩn mặc định
    delBtn.style.transition = 'opacity 0.2s';
    
    // Hiển thị nút X khi di chuột vào ảnh
    wrapper.onmouseenter = () => delBtn.style.opacity = '1';
    wrapper.onmouseleave = () => delBtn.style.opacity = '0';
    
    delBtn.onclick = (e) => {
        e.preventDefault();
        wrapper.remove();
        if (container.querySelectorAll('img').length === 0) {
            if (document.getElementById('btn-scan-analyze')) {
                document.getElementById('btn-scan-analyze').disabled = true;
            }
            container.style.display = 'none';
        }
    };
    
    wrapper.appendChild(img);
    wrapper.appendChild(checkbox);
    wrapper.appendChild(delBtn);
    container.appendChild(wrapper);
    container.style.display = 'flex';
    if (document.getElementById('btn-scan-analyze')) {
        document.getElementById('btn-scan-analyze').disabled = false;
    }
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('hidden');
    // Mỗi lần mở hộp thoại (kể cả mở lại hộp thoại vừa đóng lúc đang cuộn dở, ví dụ sửa hồ sơ
    // dài rồi mở hồ sơ khác), luôn hiển thị từ đầu nội dung thay vì giữ nguyên vị trí cuộn cũ.
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) modalContent.scrollTop = 0;
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function loadMemberDetail(id) {
    currentMemberId = id;
    const member = DataManager.getMemberById(id);
    if (!member) return;

    // Reset tabs
    document.querySelectorAll('.tab-btn')[0].click();

    // Set Header
    document.getElementById('current-member-name').innerText = member.name;
    document.getElementById('detail-member-avatar').src = member.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(member.name) + '&background=random';

    // Render Profile
    UI.renderMemberProfile(member);
    
    // Load & Render Records/Stats
    reloadRecordsAndStats();

    switchView('view-member-detail');
}

function addDynamicFieldRow(key = '', value = '', isAbnormal = false) {
    const container = document.getElementById('dynamic-fields-container');
    const row = document.createElement('div');
    row.className = 'form-group-row dynamic-field-row';
    row.style.alignItems = 'center';
    row.innerHTML = `
        <div class="form-group" style="flex: 1; margin-bottom: 0;">
            <input type="text" class="neumorphic-input dynamic-field-key" placeholder="Tên chỉ số (vd: Glucose)" value="${key}">
        </div>
        <div class="form-group" style="flex: 1; margin-bottom: 0;">
            <input type="text" class="neumorphic-input dynamic-field-value" placeholder="Kết quả (vd: 5.5 mmol/L)" value="${value}" style="${isAbnormal ? 'color: #e74c3c; font-weight: bold;' : ''}">
        </div>
        <label style="display:flex; align-items:center; gap:3px; font-size:12px; margin:0 5px; cursor:pointer;" title="Đánh dấu nếu kết quả bất thường">
            <input type="checkbox" class="dynamic-field-abnormal" ${isAbnormal ? 'checked' : ''}> Đỏ
        </label>
        <button type="button" class="icon-btn danger btn-remove-dynamic-field" style="padding: 10px; margin-top: 5px;" aria-label="Xóa chỉ số này">
            <span class="material-symbols-rounded">delete</span>
        </button>
    `;
    
    row.querySelector('.btn-remove-dynamic-field').addEventListener('click', () => {
        row.remove();
    });
    
    container.appendChild(row);
}

// Danh mục "Loại khám" mặc định gợi ý cho ô nhập tự do (khớp với danh mục mà AI được yêu cầu
// dùng khi trích xuất dữ liệu, xem js/ai.js -> extractDataFromImage).
const DEFAULT_RECORD_TYPES = [
    'Khám sức khỏe tổng quát',
    'Bệnh lý cấp tính (Nhẹ)',
    'Bệnh lý cấp tính (Nặng)',
    'Bệnh lý mạn tính',
    'Khám thai',
    'Tiêm chủng',
    'Nha khoa'
];

/**
 * Cập nhật gợi ý tự động (datalist) cho ô "Loại khám" trong form hồ sơ, và danh sách lựa chọn
 * của bộ lọc "Loại khám" trong tab Lịch sử khám, dựa trên các hồ sơ hiện có của thành viên.
 *
 * BUG ĐÃ SỬA: trước đây thẻ <datalist id="record-type-list"> không bao giờ được điền option nào,
 * và <select id="filter-type"> chỉ có mỗi lựa chọn "Tất cả" — khiến bộ lọc theo loại khám không
 * thể sử dụng được trên giao diện.
 */
function updateTypeAutocomplete(records) {
    const usedTypes = [...new Set(
        records.map(r => UI.getTypeInfo(r.type).text).filter(t => t && t !== 'Chưa phân loại')
    )].sort((a, b) => a.localeCompare(b, 'vi'));

    const allTypes = [...new Set([...DEFAULT_RECORD_TYPES, ...usedTypes])];
    UI.populateDatalist('record-type-list', allTypes);

    const filterSelect = document.getElementById('filter-type');
    if (!filterSelect) return;
    const previousValue = filterSelect.value;
    filterSelect.innerHTML = '<option value="all">Tất cả</option>';
    usedTypes.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        filterSelect.appendChild(opt);
    });
    // Giữ lại lựa chọn hiện tại nếu vẫn còn hợp lệ sau khi danh sách được làm mới
    if (Array.from(filterSelect.options).some(o => o.value === previousValue)) {
        filterSelect.value = previousValue;
    }
}

function reloadRecordsAndStats() {
    currentRecords = DataManager.getRecords(currentMemberId);
    updateTypeAutocomplete(currentRecords);
    applyFilters(); // Render with current filters
    UI.renderStatistics(currentRecords);

    // Load reminders for this member
    const memberReminders = DataManager.getReminders().filter(r => r.memberId === currentMemberId);
    UI.renderRemindersList(memberReminders, 'member-reminders-list', false);
}

function applyFilters() {
    const q = document.getElementById('search-history').value.toLowerCase();
    const type = document.getElementById('filter-type').value;
    const month = document.getElementById('filter-month').value; // YYYY-MM

    let filtered = currentRecords;

    if (q) {
        filtered = filtered.filter(r =>
            r.disease.toLowerCase().includes(q) ||
            r.hospital.toLowerCase().includes(q) ||
            (r.doctor && r.doctor.toLowerCase().includes(q)) ||
            (r.treatment && r.treatment.toLowerCase().includes(q)) ||
            (r.symptoms && r.symptoms.toLowerCase().includes(q)) ||
            (r.labs && r.labs.toLowerCase().includes(q)) ||
            (r.note && r.note.toLowerCase().includes(q))
        );
    }
    if (type !== 'all') {
        // BUG ĐÃ SỬA: trước đây gọi "Components.getTypeInfo" nhưng không tồn tại object nào tên
        // "Components" trong ứng dụng (object thực tế tên là "UI"), khiến việc lọc theo loại khám
        // luôn ném lỗi ReferenceError và làm hỏng luồng lọc/tìm kiếm hồ sơ.
        filtered = filtered.filter(r => UI.getTypeInfo(r.type).text === type);
    }
    if (month) {
        filtered = filtered.filter(r => r.date.startsWith(month));
    }

    UI.renderRecordsList(filtered);
}

// --- REMINDERS LOGIC ---
const ALARM_SOUND_URL = 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg'; 

function checkReminders() {
    const allReminders = DataManager.getReminders();
    const now = new Date();
    let hasNewNotification = false;
    let pendingCount = 0;

    allReminders.forEach(rm => {
        const rmDate = new Date(rm.datetime);
        if (now >= rmDate) {
            if (!rm.notified) {
                hasNewNotification = true;
                DataManager.markReminderAsNotified(rm.id);
            }
        } else {
            pendingCount++;
        }
    });

    UI.updateNotificationBadge(pendingCount);

    if (hasNewNotification) {
        playLoudBell();
        alert("Bạn có lịch hẹn / nhắc nhở mới đã đến hạn! Vui lòng bấm vào biểu tượng Chuông ở góc phải để kiểm tra.");
    }
}

function playLoudBell() {
    try {
        const audio = new Audio(ALARM_SOUND_URL);
        audio.volume = 1.0;
        audio.play().catch(e => console.log("Trình duyệt chặn tự động phát âm thanh.", e));
        if (navigator.vibrate) {
            navigator.vibrate([500, 200, 500, 200, 1000]);
        }
    } catch (err) {}
}

function openNotifications() {
    const allReminders = DataManager.getReminders();
    
    const mapped = allReminders.map(rm => {
        const member = DataManager.getMemberById(rm.memberId);
        return { ...rm, memberName: member ? member.name : 'Đã xóa' };
    });
    
    mapped.sort((a, b) => {
        if (a.notified === b.notified) {
            return new Date(a.datetime) - new Date(b.datetime);
        }
        return a.notified ? 1 : -1;
    });

    UI.renderRemindersList(mapped, 'notifications-list', true);
    openModal('modal-notifications');
}

// --- BACKUP REMINDER LOGIC ---
const BACKUP_REMINDER_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000; // 30 ngày
const BACKUP_REMINDER_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;    // "Để sau" 3 ngày

/** Ghi lại mốc "lần đầu dùng ứng dụng" một lần duy nhất, làm điểm tham chiếu khi chưa từng backup. */
function ensureFirstRunTimestamp() {
    const settings = DataManager.getSettings();
    if (!settings.firstRunAt) {
        DataManager.saveSettings({ firstRunAt: Date.now() });
    }
}

/**
 * Nhắc người dùng sao lưu dữ liệu nếu đã quá lâu (mặc định 30 ngày) kể từ lần backup gần nhất
 * (hoặc từ lần đầu dùng ứng dụng nếu chưa từng backup lần nào), và không đang trong thời gian
 * "tạm ẩn" do người dùng bấm "Để sau". Chỉ nhắc khi đã có ít nhất 1 thành viên (có gì để backup).
 */
function checkBackupReminder() {
    const members = DataManager.getMembers();
    if (members.length === 0) return;

    const settings = DataManager.getSettings();
    const now = Date.now();

    if (settings.backupReminderSnoozeUntil && now < settings.backupReminderSnoozeUntil) return;

    const reference = settings.lastBackupAt || settings.firstRunAt || now;
    if (now - reference >= BACKUP_REMINDER_INTERVAL_MS) {
        document.getElementById('backup-reminder-toast').classList.remove('hidden');
    }
}

function hideBackupReminder() {
    document.getElementById('backup-reminder-toast').classList.add('hidden');
}

// Event Delegation for Delete/Go to Member
document.addEventListener('change', (e) => {
    if (e.target.classList.contains('chk-delete-reminder')) {
        const id = e.target.dataset.id;
        DataManager.deleteReminder(id);
        
        if (!document.getElementById('modal-notifications').classList.contains('hidden')) {
            openNotifications();
        }
        if (currentMemberId) {
            reloadRecordsAndStats();
        }
        checkReminders();
    }
});

document.addEventListener('click', (e) => {
    const btnGo = e.target.closest('.btn-go-member');
    if (btnGo) {
        closeModal('modal-notifications');
        const id = btnGo.dataset.id;
        loadMemberDetail(id);
    }
});

// Sửa lịch hẹn: điền lại form với dữ liệu của lịch hẹn đã chọn rồi mở modal ở chế độ chỉnh sửa.
document.addEventListener('click', (e) => {
    const btnEditReminder = e.target.closest('.btn-edit-reminder');
    if (!btnEditReminder) return;

    const id = btnEditReminder.dataset.id;
    const reminder = DataManager.getReminders().find(r => r.id === id);
    if (!reminder) return;

    document.getElementById('reminder-id').value = reminder.id;
    document.getElementById('reminder-title').value = reminder.title || '';
    document.getElementById('reminder-date').value = reminder.date || '';
    document.getElementById('reminder-time').value = reminder.time || '';
    document.getElementById('reminder-note').value = reminder.note || '';
    document.getElementById('modal-reminder-title').innerText = 'Sửa lịch hẹn';
    openModal('modal-reminder');
});
