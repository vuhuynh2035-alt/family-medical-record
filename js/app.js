/**
 * app.js — điểm khởi tạo (bootstrap), gắn sự kiện (event listeners) và các hàm điều phối
 * (logic functions) nối UI (components.js), dữ liệu (data.js) và AI (ai.js) lại với nhau.
 * Không chứa logic hiển thị HTML trực tiếp — việc đó thuộc về `UI` trong components.js.
 */

let currentMemberId = null;
let currentRecords = [];
let deferredPrompt;
let cropper = null;

// Cấu hình worker cho pdf.js (dùng để tách từng trang PDF thành ảnh trước khi gửi AI đọc —
// xem trong xử lý #record-image-input bên dưới). Đặt ở đây (file .js ngoài, cùng gốc 'self')
// thay vì <script> nội tuyến trong index.html, vì Content-Security-Policy của trang không cho
// phép chạy script nội tuyến — đặt bằng script nội tuyến sẽ bị trình duyệt âm thầm chặn.
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

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
    const settings = DataManager.getSettings();
    const isChange = !!(settings.pinEnabled && settings.pinHash);
    const groupOldPin = document.getElementById('group-old-pin');
    if (groupOldPin) groupOldPin.classList.toggle('hidden', !isChange);
    
    document.getElementById('pin-setup-form').classList.remove('hidden');
    document.getElementById('input-old-pin').value = '';
    document.getElementById('input-new-pin').value = '';
    document.getElementById('input-confirm-pin').value = '';
    
    if (isChange) {
        setTimeout(() => document.getElementById('input-old-pin').focus(), 50);
    } else {
        setTimeout(() => document.getElementById('input-new-pin').focus(), 50);
    }
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

    document.getElementById('btn-forgot-pin-reset').addEventListener('click', () => {
        if (confirm('CẢNH BÁO NGUY HIỂM: Hành động này sẽ XÓA TOÀN BỘ dữ liệu hồ sơ bệnh án đang lưu trên máy này để khôi phục cài đặt gốc, giúp bạn vào lại ứng dụng. Bạn có chắc chắn muốn xóa mọi thứ không?')) {
            if (confirm('Đây là xác nhận cuối cùng. Mọi dữ liệu sẽ bị xóa VĨNH VIỄN và không thể khôi phục. Bạn vẫn muốn tiếp tục?')) {
                localStorage.clear();
                if (window.indexedDB) {
                    indexedDB.deleteDatabase('FamilyMedicalRecordDB');
                }
                alert('Đã xóa toàn bộ dữ liệu. Ứng dụng sẽ khởi động lại.');
                window.location.reload();
            }
        }
    });

    document.getElementById('btn-enable-pin').addEventListener('click', () => showPinSetupForm());
    document.getElementById('btn-change-pin').addEventListener('click', () => showPinSetupForm());
    document.getElementById('btn-cancel-pin-setup').addEventListener('click', () => hidePinSetupForm());

    document.getElementById('btn-save-pin').addEventListener('click', async () => {
        const settings = DataManager.getSettings();
        const isChange = !!(settings.pinEnabled && settings.pinHash);
        
        if (isChange) {
            const oldPin = document.getElementById('input-old-pin').value.trim();
            const oldHash = await DataManager.sha256Hex(oldPin);
            if (oldHash !== settings.pinHash) {
                alert('Mã PIN cũ không chính xác!');
                return;
            }
        }
        
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
            showToast('Đã lưu mã PIN thành công.');
        } catch (err) {
            alert(err.message);
        }
    });

    document.getElementById('btn-disable-pin').addEventListener('click', () => {
        if (confirm('Tắt khóa PIN? Ứng dụng sẽ mở trực tiếp mà không cần nhập mã PIN nữa. (Mã PIN vẫn sẽ được dùng để xác nhận bảo mật khi xoá dữ liệu).')) {
            DataManager.saveSettings({ pinEnabled: false });
            updatePinUIState();
            showToast('Đã tắt yêu cầu mã PIN khi mở ứng dụng.');
        }
    });

    document.getElementById('form-forced-pin-setup').addEventListener('submit', async (e) => {
        e.preventDefault();
        const pin = document.getElementById('input-forced-pin').value.trim();
        const confirmPin = document.getElementById('input-forced-confirm-pin').value.trim();
        const errorEl = document.getElementById('forced-pin-error');
        
        if (!/^\d{4,6}$/.test(pin)) {
            errorEl.innerText = 'Mã PIN phải gồm từ 4 đến 6 chữ số.';
            errorEl.classList.remove('hidden');
            return;
        }
        if (pin !== confirmPin) {
            errorEl.innerText = 'Hai mã PIN không khớp.';
            errorEl.classList.remove('hidden');
            return;
        }
        
        try {
            const hash = await DataManager.sha256Hex(pin);
            DataManager.saveSettings({ pinEnabled: true, pinHash: hash });
            document.getElementById('forced-pin-setup-screen').classList.add('hidden');
            updatePinUIState();
            showToast('Đã tạo mã PIN thành công.');
            checkReminders();
            checkBackupReminder();
        } catch (err) {
            alert(err.message);
        }
    });


}

const CURRENT_APP_VERSION = 'v2.5.1';
let newWorker = null;
let latestDetectedVersion = '';

function getRunningAppVersion() {
    const tag = document.querySelector('.version-tag');
    return tag ? tag.innerText.trim() : CURRENT_APP_VERSION;
}

function showUpdateToast(newVersion) {
    const runningVer = getRunningAppVersion();
    if (!newVersion || newVersion === runningVer || newVersion === CURRENT_APP_VERSION) {
        document.getElementById('update-toast')?.classList.add('hidden');
        return;
    }
    
    latestDetectedVersion = newVersion;
    
    // Nếu người dùng đã chọn "Để sau" cho phiên bản này -> Không hiện lại
    if (localStorage.getItem('update_dismissed_' + latestDetectedVersion) === 'true') {
        return;
    }
    
    const updateToast = document.getElementById('update-toast');
    const title = document.getElementById('update-toast-title');
    if (title) {
        title.innerText = `Đã có bản cập nhật mới (${latestDetectedVersion})!`;
    }
    if (updateToast) {
        updateToast.classList.remove('hidden');
    }
}

function checkForRemoteUpdate() {
    const runningVer = getRunningAppVersion();
    // Kiểm tra version.json với no-cache để lấy phiên bản mới nhất từ server
    fetch('./version.json?t=' + Date.now(), { cache: 'no-store' })
        .then(res => {
            if (!res.ok) throw new Error('Cannot fetch version.json');
            return res.json();
        })
        .then(data => {
            if (data && data.version) {
                if (data.version === runningVer || data.version === CURRENT_APP_VERSION) {
                    // Đang ở phiên bản mới nhất -> Đóng thông báo ngay
                    document.getElementById('update-toast')?.classList.add('hidden');
                } else {
                    showUpdateToast(data.version);
                }
            }
        })
        .catch(err => {
            // Ngoại tuyến
        });
}

// Kiểm tra phiên bản ngay lập tức khi mã JS chạy, không cần đợi
checkForRemoteUpdate();
document.addEventListener('DOMContentLoaded', checkForRemoteUpdate);

// PWA Service Worker Registration & Reliable Update Detection
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => {
            console.log('Service Worker registered', reg);

            // Tự động kiểm tra bản cập nhật mới
            try { reg.update(); } catch(e){}

            // Tự động kiểm tra cập nhật mỗi 3 phút
            setInterval(() => {
                try { reg.update(); } catch(e){}
                checkForRemoteUpdate();
            }, 3 * 60 * 1000);

            // Kiểm tra cập nhật mỗi khi người dùng chuyển lại tab ứng dụng
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    try { reg.update(); } catch(e){}
                    checkForRemoteUpdate();
                }
            });
        }).catch(err => {
            console.log('Service Worker registration error: ', err);
        });
    });

    let isRefreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (isRefreshing) return;
        isRefreshing = true;
        window.location.reload();
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

// ==================== KHỞI TẠO ỨNG DỤNG ====================
document.addEventListener('DOMContentLoaded', async () => {
    // Tự động đồng bộ số phiên bản từ sw.js để tránh quên cập nhật giao diện
    try {
        const swText = await fetch('sw.js?t=' + Date.now()).then(r => r.text());
        const match = swText.match(/const SW_VERSION\s*=\s*['"](v[^'"]+)['"]/);
        if (match && match[1]) {
            const version = match[1];
            document.querySelectorAll('.version-tag').forEach(el => el.textContent = version);
            
            // Cập nhật text trong modal Settings (ví dụ: Phiên bản v2.2.6)
            const settingsContent = document.getElementById('modal-settings')?.innerHTML;
            if (settingsContent) {
                document.getElementById('modal-settings').innerHTML = settingsContent.replace(/Phiên bản <strong>v[^<]+<\/strong>/, `Phiên bản <strong>${version}</strong>`);
            }
        }
    } catch (e) {
        console.warn("Không thể tự động đồng bộ phiên bản", e);
    }

    initDashboard();
    setupEventListeners();
    setupPinLockListeners();
    
    // Set timer to automatically check reminders every 60 seconds
    setInterval(() => {
        checkReminders();
    }, 60000);
    updatePinUIState();
    UI.enhanceA11y(document); // Gán aria-label cho các nút chỉ có icon (tĩnh trong index.html)

    const btnUpdateApp = document.getElementById('btn-update-app');
    if (btnUpdateApp) {
        btnUpdateApp.addEventListener('click', async () => {
            btnUpdateApp.disabled = true;
            btnUpdateApp.innerText = 'Đang nạp...';
            
            // Ghi nhận đã cập nhật phiên bản này để không hiện lại
            if (latestDetectedVersion) {
                localStorage.setItem('update_dismissed_' + latestDetectedVersion, 'true');
                localStorage.setItem('app_installed_version', latestDetectedVersion);
            }
            document.getElementById('update-toast')?.classList.add('hidden');

            // Xóa cache cũ
            if ('caches' in window) {
                try {
                    const cacheKeys = await caches.keys();
                    await Promise.all(cacheKeys.map(k => caches.delete(k)));
                } catch(e){}
            }

            if (newWorker) {
                newWorker.postMessage('SKIP_WAITING');
            } else if ('serviceWorker' in navigator) {
                try {
                    const reg = await navigator.serviceWorker.getRegistration();
                    if (reg && reg.waiting) {
                        reg.waiting.postMessage('SKIP_WAITING');
                        return;
                    }
                } catch(e){}
            }

            // Tải lại trang sạch sẽ
            setTimeout(() => {
                window.location.replace(window.location.origin + window.location.pathname + '?t=' + Date.now());
            }, 250);
        });
    }

    const btnDismissUpdate = document.getElementById('btn-dismiss-update');
    if (btnDismissUpdate) {
        btnDismissUpdate.addEventListener('click', () => {
            if (latestDetectedVersion) {
                localStorage.setItem('update_dismissed_' + latestDetectedVersion, 'true');
            }
            document.getElementById('update-toast')?.classList.add('hidden');
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
    
    if (settings.providerAssessment) document.getElementById('input-ai-provider-assessment').value = settings.providerAssessment;
    else if (settings.activeProvider) document.getElementById('input-ai-provider-assessment').value = settings.activeProvider;
    
    if (settings.providerSearch) document.getElementById('input-ai-provider-search').value = settings.providerSearch;
    else if (settings.activeProvider) document.getElementById('input-ai-provider-search').value = settings.activeProvider;
    
    if (settings.providerTrend) document.getElementById('input-ai-provider-trend').value = settings.providerTrend;
    else if (settings.activeProvider) document.getElementById('input-ai-provider-trend').value = settings.activeProvider;

    if (settings.providerChat) document.getElementById('input-ai-provider-chat').value = settings.providerChat;
    else if (settings.activeProvider) document.getElementById('input-ai-provider-chat').value = settings.activeProvider;
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
    // Nếu chưa có mã PIN, ép buộc tạo mã PIN (chặn không cho dùng app)
    ensureFirstRunTimestamp();
    if (!settings.pinHash) {
        document.getElementById('forced-pin-setup-screen').classList.remove('hidden');
        setTimeout(() => document.getElementById('input-forced-pin').focus(), 50);
    } else if (settings.pinEnabled) {
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
        
        const providerAssessment = document.getElementById('input-ai-provider-assessment').value;
        const providerSearch = document.getElementById('input-ai-provider-search').value;
        const providerTrend = document.getElementById('input-ai-provider-trend').value;
        const providerChat = document.getElementById('input-ai-provider-chat').value;
        
        const geminiModel = document.getElementById('input-gemini-model').value;
        const openaiModel = document.getElementById('input-openai-model') ? document.getElementById('input-openai-model').value.trim() : '';
        const anthropicModel = document.getElementById('input-anthropic-model') ? document.getElementById('input-anthropic-model').value.trim() : '';

        DataManager.saveSettings({
            geminiApiKey: geminiKey,
            openaiApiKey: openaiKey,
            anthropicApiKey: anthropicKey,
            providerAssessment: providerAssessment,
            providerSearch: providerSearch,
            providerTrend: providerTrend,
            providerChat: providerChat,
            activeProvider: providerAssessment, // kept for backward compatibility
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
            document.getElementById('input-confirm-action-pin').value = '';
            document.getElementById('confirm-pin-error').classList.add('hidden');
            document.getElementById('modal-confirm-pin').classList.remove('hidden');
            setTimeout(() => document.getElementById('input-confirm-action-pin').focus(), 50);
        });
    }

    const formConfirmPin = document.getElementById('form-confirm-pin');
    if (formConfirmPin) {
        formConfirmPin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('input-confirm-action-pin');
            const pin = input.value.trim();
            const errorEl = document.getElementById('confirm-pin-error');
            
            try {
                const settings = DataManager.getSettings();
                const hash = await DataManager.sha256Hex(pin);
                if (hash === settings.pinHash) {
                    // Valid PIN, execute wipe
                    document.getElementById('modal-confirm-pin').classList.add('hidden');
                    if (confirm("CẢNH BÁO CUỐI: Hành động này sẽ xóa VĨNH VIỄN toàn bộ hồ sơ khám bệnh và thành viên. Bạn có chắc chắn?")) {
                        DataManager.wipeAllDataKeepSettings();
                        alert("Đã xóa sạch dữ liệu thành công! Ứng dụng sẽ tải lại.");
                        window.location.reload();
                    }
                } else {
                    errorEl.innerText = 'Mã PIN không đúng, vui lòng thử lại.';
                    errorEl.classList.remove('hidden');
                    input.value = '';
                    input.focus();
                }
            } catch (err) {
                alert(err.message);
            }
        });
    }

    const closeConfirmPinBtn = document.querySelector('#modal-confirm-pin .close-modal');
    if (closeConfirmPinBtn) {
        closeConfirmPinBtn.addEventListener('click', () => {
            document.getElementById('modal-confirm-pin').classList.add('hidden');
        });
    }

    // Exit App Logic
    const btnExitApp = document.getElementById('btn-exit-app');
    if (btnExitApp) {
        btnExitApp.addEventListener('click', () => {
            document.getElementById('modal-exit-app').classList.remove('hidden');
        });
    }

    const btnConfirmExit = document.getElementById('btn-confirm-exit');
    if (btnConfirmExit) {
        btnConfirmExit.addEventListener('click', async () => {
            try {
                // AUTO BACKUP LOGIC
                if (DataManager.isDataChanged) {
                    try {
                        const exportData = await DataManager.exportData();
                        await AutoBackupStore.saveAutoBackup(exportData);
                    } catch (err) {
                        console.error('Lỗi khi sao lưu tự động:', err);
                    }
                }

                // Trick để lừa trình duyệt cho phép đóng tab (hoạt động trên một số trình duyệt)
                window.open(location.href, '_self', '');
                window.close();
                
                // Dành cho PWA hoặc môi trường đặc biệt
                if (window.electron) {
                    window.close();
                } else if (navigator.app && navigator.app.exitApp) {
                    navigator.app.exitApp();
                }
                
                // Nếu trình duyệt vẫn chặn window.close() (đặc biệt là trên Cloud/Web)
                setTimeout(() => {
                    // Dọn dẹp DOM và hiển thị thông báo thoát an toàn đẹp mắt
                    document.body.innerHTML = `
                        <div style="display:flex; height:100vh; align-items:center; justify-content:center; flex-direction:column; background:var(--bg-body, #f0f2f5); font-family:'Outfit', sans-serif; color:var(--text-dark, #2d3436); text-align:center; padding: 20px;">
                            <span class="material-symbols-rounded" style="font-size: 64px; color: var(--primary-blue, #2980b9); margin-bottom: 20px;">check_circle</span>
                            <h2 style="margin-bottom: 10px; font-weight: 600;">Đã thoát chương trình an toàn</h2>
                            <p style="color: var(--text-muted, #636e72); margin-bottom: 30px; font-size: 15px;">Dữ liệu đã được lưu trữ cục bộ. Bạn có thể đóng thẻ trình duyệt này.</p>
                            <button onclick="window.close()" style="padding: 12px 24px; border: none; border-radius: 25px; background: var(--primary-blue, #2980b9); color: white; font-family: inherit; font-size: 15px; cursor: pointer; box-shadow: 0 4px 15px rgba(41,128,185,0.3);">
                                Đóng trang (hoặc bấm Ctrl + W)
                            </button>
                        </div>
                    `;
                }, 400);
            } catch(e) {
                console.error(e);
            }
        });
    }

    // Auto Backup UI Logic
    const btnShowAutoBackups = document.getElementById('btn-show-auto-backups');
    if (btnShowAutoBackups) {
        btnShowAutoBackups.addEventListener('click', async () => {
            try {
                const backups = await AutoBackupStore.getAllAutoBackups();
                const listEl = document.getElementById('auto-backup-list');
                if (backups.length === 0) {
                    listEl.innerHTML = '<div class="empty-state">Chưa có bản sao lưu tự động nào. Hãy thử thêm dữ liệu và đóng ứng dụng để hệ thống tự động tạo bản sao.</div>';
                } else {
                    listEl.innerHTML = backups.map(b => `
                        <div class="member-card neumorphic-card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding: 15px;">
                            <div>
                                <div style="font-weight: 500;">Bản sao lưu tự động</div>
                                <div style="font-size:12px; color:var(--text-muted);">${b.dateString}</div>
                            </div>
                            <button class="primary-btn neumorphic-btn btn-restore-auto" data-id="${b.id}" style="padding: 6px 12px; font-size:13px;">Khôi phục</button>
                        </div>
                    `).join('');
                    
                    listEl.querySelectorAll('.btn-restore-auto').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            const id = e.target.dataset.id;
                            if (confirm('CẢNH BÁO: Hành động này sẽ GHI ĐÈ toàn bộ dữ liệu hiện tại (bao gồm cài đặt và hồ sơ) bằng bản sao lưu này. Không thể hoàn tác! Bạn có chắc chắn?')) {
                                try {
                                    const backup = await AutoBackupStore.getAutoBackupById(id);
                                    if (backup && backup.data) {
                                        const success = await DataManager.importData(backup.data);
                                        if (success) {
                                            alert('Đã khôi phục dữ liệu thành công!');
                                            location.reload();
                                        }
                                    }
                                } catch (err) {
                                    alert('Lỗi khôi phục: ' + err.message);
                                }
                            }
                        });
                    });
                }
                openModal('modal-auto-backup');
            } catch (err) {
                alert('Không thể tải lịch sử sao lưu: ' + err.message);
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
            document.querySelectorAll('.tab-pane').forEach(p => {
                p.classList.remove('active', 'rotate-in-next', 'rotate-in-prev');
            });

            // Add active class
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');

            // Đổi tab hiển thị nội dung khác hẳn (Hồ sơ / Lịch sử khám / Thống kê / Lịch hẹn) —
            // luôn cuộn về đầu trang để người dùng thấy ngay nội dung mới thay vì vẫn đứng ở vị
            // trí cuộn cũ của tab trước (đặc biệt rõ khi tab trước dài, tab sau ngắn hơn nhiều).
            window.scrollTo(0, 0);
        });
    });

    // Xử lý vuốt chuyển tab xoay vòng (3D Carousel effect)
    const tabContents = document.querySelector('.tab-contents');
    if (tabContents) {
        let touchStartX = 0;
        let touchEndX = 0;
        let touchStartY = 0;
        let touchEndY = 0;
        
        tabContents.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        }, {passive: true});
        
        tabContents.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;
            handleTabSwipe();
        }, {passive: true});
        
        function handleTabSwipe() {
            const swipeThresholdX = 50; // Quét ít nhất 50px ngang mới tính
            const swipeThresholdY = 50; // Quét quá 50px dọc thì bỏ qua (chắc là cuộn trang)
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;
            
            if (Math.abs(deltaX) > swipeThresholdX && Math.abs(deltaY) < swipeThresholdY) {
                const tabs = Array.from(document.querySelectorAll('.tab-btn'));
                if (tabs.length === 0) return;
                
                const activeIndex = tabs.findIndex(btn => btn.classList.contains('active'));
                if (activeIndex === -1) return;
                
                let nextIndex = activeIndex;
                let directionClass = '';
                
                if (deltaX < 0) {
                    // Vuốt sang trái -> Trang tiếp theo
                    nextIndex = (activeIndex + 1) % tabs.length;
                    directionClass = 'rotate-in-next';
                } else {
                    // Vuốt sang phải -> Trang trước đó
                    nextIndex = (activeIndex - 1 + tabs.length) % tabs.length;
                    directionClass = 'rotate-in-prev';
                }
                
                // Chuyển tab
                tabs[nextIndex].click();
                
                // Gắn class hiệu ứng 3D
                const targetPane = document.getElementById(tabs[nextIndex].dataset.target);
                if (targetPane) {
                    // Buộc trình duyệt reflow để chạy lại animation
                    void targetPane.offsetWidth;
                    targetPane.classList.add(directionClass);
                }
            }
        }
    }

    // Evaluate Health Trend Action
    document.getElementById('btn-evaluate-trend').addEventListener('click', async () => {
        if (!currentMemberId) return;
        const records = DataManager.getRecords(currentMemberId);
        if (!records || records.length === 0) {
            alert('Thành viên này chưa có hồ sơ khám bệnh nào để đánh giá.');
            return;
        }

        const member = DataManager.getMembers().find(m => m.id === currentMemberId);
        const activeProvider = DataManager.getProviderTrend();
        const pName = activeProvider === 'openai' ? 'ChatGPT' : (activeProvider === 'anthropic' ? 'Claude' : 'Gemini');
        
        document.querySelector('#modal-ai-assessment .modal-header h3').innerHTML = `<span class="material-symbols-rounded ai-sparkle">auto_awesome</span> ${pName} Đánh giá xu hướng sức khỏe`;
        openModal('modal-ai-assessment');
        const loading = document.getElementById('ai-assessment-loading');
        const content = document.getElementById('ai-assessment-content');
        
        loading.innerHTML = `<span class="loading-spinner"></span> ${pName} đang phân tích toàn bộ lịch sử khám bệnh...`;
        loading.classList.remove('hidden');
        content.innerHTML = '';
        
        try {
            const mdText = await AIService.evaluateHealthTrend(records, member);
            loading.classList.add('hidden');
            content.innerHTML = UI.renderMarkdown(mdText);
        } catch (err) {
            loading.classList.add('hidden');
            content.innerHTML = `<p style="color:var(--danger);">Lỗi khi liên hệ AI: ${err.message}</p>`;
        }
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

        // Kiểm tra tiêm chủng để tự động gợi ý & hỏi tạo lịch nhắc hẹn thông minh
        const isVaccine = recordData.type === 'Tiêm chủng' || 
                          (recordData.type && recordData.type.toLowerCase().includes('tiêm')) || 
                          (typeof AIService !== 'undefined' && AIService.findVaccineInfo(recordData.disease + ' ' + recordData.treatment + ' ' + recordData.symptoms));
        
        if (isVaccine && typeof AIService !== 'undefined') {
            const vInfo = AIService.calculateNextVaccineDose(recordData.disease || recordData.treatment || recordData.symptoms || '', recordData.date);
            if (vInfo && vInfo.nextDoseDate) {
                // Kiểm tra xem đã có lịch nhắc nào cùng ngày hoặc cùng tên mũi tiêm chưa
                const existingReminders = DataManager.getReminders();
                const isAlreadyReminded = existingReminders.some(r => 
                    r.memberId === currentMemberId && 
                    (r.date === vInfo.nextDoseDate || (r.title && r.title.includes(vInfo.nextDoseTitle)))
                );
                
                if (!isAlreadyReminded) {
                    setTimeout(() => {
                        promptVaccineReminderModal(currentMemberId, vInfo, recordData);
                    }, 350);
                }
            }
        }
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
            const imgEl = document.getElementById('viewer-image');
            if (imgEl && src) {
                imgEl.src = src;
                viewerZoomScale = 1;
                imgEl.style.transform = 'scale(1)';
            }
            openModal('modal-image-viewer');
            return;
        }
        
        const btnAi = e.target.closest('.btn-ai-assessment') || e.target.closest('.btn-ai-eval');
        if (btnAi) {
            const id = btnAi.dataset.id;
            const record = currentRecords.find(r => r.id === id);
            const member = DataManager.getMemberById(currentMemberId);
            
            if (record && member) {
                const activeProvider = DataManager.getProviderAssessment();
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
            
            const activeProvider = DataManager.getProviderSearch();
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
            
            if (data.reminders && data.reminders.length > 0) {
                let reminderCount = 0;
                data.reminders.forEach(r => {
                    if (r.title && r.date) {
                        DataManager.saveReminder({
                            memberId: currentMemberId,
                            title: r.title,
                            date: r.date,
                            time: r.time || "08:00",
                            note: r.note || ""
                        });
                        reminderCount++;
                    }
                });
                if (reminderCount > 0) {
                    showToast(`Đã tự động tạo ${reminderCount} nhắc nhở từ hồ sơ bệnh án.`, 'success');
                    checkReminders(); // Cập nhật lại chuông thông báo
                }
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

    async function getPdfOpt(element, filename) {
        // Tính toán scale an toàn dựa trên chiều cao để tránh lỗi quá giới hạn Canvas của WebGL (thường là 16384px trên mobile)
        const docHeight = element.scrollHeight;
        let safeScale = 2; // Mặc định chất lượng cao nhất
        if (docHeight * safeScale > 14000) safeScale = 1.5;
        if (docHeight * safeScale > 14000) safeScale = 1; // Hạ xuống scale thấp hơn nếu file quá dài

        return {
            margin:       0.5,
            filename:     filename,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { 
                scale: safeScale,
                useCORS: true,
                scrollY: 0,
                scrollX: 0
            },
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
        };
    }

    async function withExpandedModal(element, callback) {
        const modalContent = element.closest('.modal-content');
        let originalMaxHeight = '';
        let originalOverflow = '';
        const originalScrollY = window.scrollY;
        const originalScrollX = window.scrollX;
        
        // Mở rộng modal để không bị giới hạn 90vh (nguyên nhân gây cắt chữ)
        if (modalContent) {
            originalMaxHeight = modalContent.style.maxHeight;
            originalOverflow = modalContent.style.overflowY;
            modalContent.style.maxHeight = 'none';
            modalContent.style.overflowY = 'visible';
        }

        // Đưa màn hình về góc trên cùng để html2canvas không bị lệch tọa độ
        window.scrollTo(0, 0);
        
        // Đảm bảo hình ảnh đính kèm đã tải xong hoàn toàn
        const imgs = Array.from(element.querySelectorAll('img'));
        await Promise.all(imgs.map(img => new Promise(resolve => {
            if (img.complete) resolve();
            else { img.onload = resolve; img.onerror = resolve; }
        })));
        
        // Đợi DOM cập nhật layout
        await new Promise(r => setTimeout(r, 500)); 
        
        await callback();
        
        // Khôi phục lại modal như cũ
        if (modalContent) {
            modalContent.style.maxHeight = originalMaxHeight;
            modalContent.style.overflowY = originalOverflow;
        }
        window.scrollTo(originalScrollX, originalScrollY);
    }

    async function downloadPdf(element, filename) {
        await withExpandedModal(element, async () => {
            const opt = await getPdfOpt(element, filename);
            await html2pdf().set(opt).from(element).save();
        });
    }

    async function sharePdf(element, filename) {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (!(isMobile && navigator.share && typeof navigator.canShare === 'function')) {
            alert('Trình duyệt hoặc thiết bị của bạn không hỗ trợ tính năng chia sẻ. Đang chuyển sang tải xuống...');
            return downloadPdf(element, filename);
        }

        const loadingOverlay = document.createElement('div');
        loadingOverlay.style.position = 'fixed';
        loadingOverlay.style.top = '0';
        loadingOverlay.style.left = '0';
        loadingOverlay.style.width = '100vw';
        loadingOverlay.style.height = '100vh';
        loadingOverlay.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        loadingOverlay.style.zIndex = '999999';
        loadingOverlay.style.display = 'flex';
        loadingOverlay.style.flexDirection = 'column';
        loadingOverlay.style.justifyContent = 'center';
        loadingOverlay.style.alignItems = 'center';
        loadingOverlay.style.color = '#2563eb';
        loadingOverlay.style.fontSize = '18px';
        loadingOverlay.innerHTML = '<div class="loading-spinner" style="width:40px;height:40px;margin-bottom:15px;border:4px solid #2563eb;border-top-color:transparent;"></div> Đang chuẩn bị tệp để chia sẻ...';
        document.body.appendChild(loadingOverlay);

        try {
            await withExpandedModal(element, async () => {
                const opt = await getPdfOpt(element, filename);
                const pdfBlob = await html2pdf().set(opt).from(element).output('blob');
                const file = new File([pdfBlob], filename, { type: 'application/pdf' });
                
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: 'Tài liệu Y khoa',
                        files: [file]
                    });
                }
            });
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.warn('Lỗi khi chia sẻ:', e);
                alert('Có lỗi xảy ra khi chia sẻ.');
            }
        } finally {
            if (document.body.contains(loadingOverlay)) loadingOverlay.remove();
        }
    }

    document.getElementById('btn-download-pdf').addEventListener('click', async () => {
        const element = document.getElementById('report-preview-mode');
        await downloadPdf(element, 'Bao_Cao_Y_Khoa.pdf');
    });

    document.getElementById('btn-download-record-pdf').addEventListener('click', async () => {
        const element = document.getElementById('view-record-content');
        await downloadPdf(element, 'Chi_Tiet_Ho_So.pdf');
    });

    // Thêm nút chia sẻ cho Chi Tiết Hồ Sơ
    document.getElementById('btn-share-record').addEventListener('click', async () => {
        const element = document.getElementById('view-record-content');
        await sharePdf(element, 'Chi_Tiet_Ho_So.pdf');
    });

    document.getElementById('btn-download-assessment-pdf').addEventListener('click', async () => {
        const element = document.getElementById('ai-assessment-content');
        let rawTitle = document.querySelector('#modal-ai-assessment .modal-header h3').innerText.trim();
        const titleText = rawTitle.replace(/psychiatry|travel_explore|auto_awesome/g, '').trim() || 'AI_Assessment';
        await downloadPdf(element, `${titleText}.pdf`.replace(/\s+/g, '_'));
    });

    // Thêm nút chia sẻ cho Đánh Giá AI
    document.getElementById('btn-share-assessment').addEventListener('click', async () => {
        const element = document.getElementById('ai-assessment-content');
        let rawTitle = document.querySelector('#modal-ai-assessment .modal-header h3').innerText.trim();
        const titleText = rawTitle.replace(/psychiatry|travel_explore|auto_awesome/g, '').trim() || 'AI_Assessment';
        await sharePdf(element, `${titleText}.pdf`.replace(/\s+/g, '_'));
    });

    // Image Viewer Logic
    document.getElementById('btn-download-viewer-image').addEventListener('click', () => {
        const src = document.getElementById('viewer-image').src;
        if (!src) return;
        const link = document.createElement('a');
        link.href = src;
        link.download = 'hinh_anh_y_khoa.jpg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    document.getElementById('btn-share-viewer-image').addEventListener('click', async () => {
        const src = document.getElementById('viewer-image').src;
        if (!src) return;
        
        if (navigator.share && navigator.canShare) {
            try {
                const res = await fetch(src);
                const blob = await res.blob();
                const file = new File([blob], 'hinh_anh_y_khoa.jpg', { type: blob.type || 'image/jpeg' });
                
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: 'Hình ảnh Y khoa',
                        files: [file]
                    });
                    return;
                }
            } catch (e) {
                console.warn('Không thể chia sẻ ảnh:', e);
            }
        }
        // Fallback: Tải xuống bình thường
        document.getElementById('btn-download-viewer-image').click();
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
        document.getElementById('reminder-offset1-val').value = '';
        document.getElementById('reminder-offset1-unit').value = 'minutes';
        document.getElementById('reminder-offset2-val').value = '';
        document.getElementById('reminder-offset2-unit').value = 'minutes';
        document.getElementById('modal-reminder-title').innerText = 'Tạo lịch hẹn mới';
        openModal('modal-reminder');
    });

    // Dynamic Fields Logic
    document.getElementById('btn-add-dynamic-field').addEventListener('click', () => {
        addDynamicFieldRow();
    });

    // Bắt sự kiện tắt chuông báo thức
    document.getElementById('btn-stop-alarm').addEventListener('click', () => {
        stopLoudBell();
        document.getElementById('modal-alarm').classList.add('hidden');
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
            datetime,
            offset1_val: document.getElementById('reminder-offset1-val').value,
            offset1_unit: document.getElementById('reminder-offset1-unit').value,
            offset2_val: document.getElementById('reminder-offset2-val').value,
            offset2_unit: document.getElementById('reminder-offset2-unit').value,
            notified_offsets: {} // Lưu trạng thái đã thông báo cho từng mốc (kể cả mốc 0 là đúng giờ)
        };
        // Nếu ngày giờ (mới) nằm trong tương lai, đảm bảo lịch hẹn được "gỡ" trạng thái đã nhắc
        if (new Date(datetime) > new Date()) {
            rmData.notified = false;
            rmData.notified_offsets = {};
        }
        DataManager.saveReminder(rmData);
        closeModal('modal-reminder');
        reloadRecordsAndStats();
        checkReminders();
    });
}

// --- LOGIC FUNCTIONS ---
function updateFloatingBackButtonState() {
    const floatingBackBtn = document.getElementById('btn-floating-back');
    if (!floatingBackBtn) return;

    // Kiểm tra xem có modal nào đang mở không hoặc đang ở màn hình Chi tiết Thành viên
    const visibleModals = document.querySelectorAll('.modal-overlay:not(.hidden)');
    const isDetailView = document.getElementById('view-member-detail')?.classList.contains('active');

    if (visibleModals.length > 0 || isDetailView) {
        floatingBackBtn.classList.remove('hidden');
    } else {
        floatingBackBtn.classList.add('hidden');
    }
}

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    // Mỗi khi chuyển sang 1 "trang" mới (Trang chủ <-> Chi tiết thành viên), luôn đưa vị trí
    // xem về đầu trang — tránh trường hợp trang mới hiển thị ngay tại vị trí cuộn dở dang của
    // trang trước đó (vì đây là ứng dụng 1 trang - SPA - nên trình duyệt không tự cuộn lại).
    window.scrollTo(0, 0);
    updateFloatingBackButtonState();
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
    checkbox.title = 'Chọn gửi ảnh này cho AI đọc';
    checkbox.style.position = 'absolute';
    checkbox.style.top = '5px';
    checkbox.style.left = '5px';
    checkbox.style.zIndex = '2';
    checkbox.style.width = '18px';
    checkbox.style.height = '18px';
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
    if (!modal) return;
    modal.classList.remove('hidden');
    // Mỗi lần mở hộp thoại (kể cả mở lại hộp thoại vừa đóng lúc đang cuộn dở, ví dụ sửa hồ sơ
    // dài rồi mở hồ sơ khác), luôn hiển thị từ đầu nội dung thay vì giữ nguyên vị trí cuộn cũ.
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) modalContent.scrollTop = 0;
    updateFloatingBackButtonState();
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
    if (typeof TTSService !== 'undefined' && TTSService.isPlaying) {
        TTSService.stop();
    }
    updateFloatingBackButtonState();
}

function loadMemberDetail(id) {
    currentMemberId = id;
    const member = DataManager.getMemberById(id);
    if (!member) return;

    // Reset tabs
    document.querySelectorAll('.tab-btn')[0].click();

    // Set Header
    const nameDesktop = document.querySelector('#current-member-name .name-desktop');
    const nameMobile = document.querySelector('#current-member-name .name-mobile');
    if (nameDesktop && nameMobile) {
        nameDesktop.innerText = member.name;
        nameMobile.innerText = member.nickname || member.name;
    } else {
        document.getElementById('current-member-name').innerText = member.name;
    }
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
const ALARM_SOUND_URL = 'https://actions.google.com/sounds/v1/alarms/mechanical_clock_ring.ogg';

function getOffsetMs(val, unit) {
    if (!val || !unit) return 0;
    const v = parseInt(val);
    if (isNaN(v) || v <= 0) return 0;
    if (unit === 'minutes') return v * 60 * 1000;
    if (unit === 'hours') return v * 60 * 60 * 1000;
    if (unit === 'days') return v * 24 * 60 * 60 * 1000;
    if (unit === 'weeks') return v * 7 * 24 * 60 * 60 * 1000;
    return 0;
}

function checkReminders() {
    const allReminders = DataManager.getReminders();
    const now = new Date();
    let pendingCount = 0;
    let alarmTriggered = null;
    let modified = false;

    allReminders.forEach(rm => {
        const rmDate = new Date(rm.datetime);
        const offsets = [
            { id: 'offset1', ms: getOffsetMs(rm.offset1_val, rm.offset1_unit) },
            { id: 'offset2', ms: getOffsetMs(rm.offset2_val, rm.offset2_unit) },
            { id: '0', ms: 0 }
        ];

        if (!rm.notified_offsets) rm.notified_offsets = {};
        let hasPending = false;
        
        offsets.forEach(offset => {
            if (offset.ms > 0 || offset.id === '0') {
                const triggerTime = new Date(rmDate.getTime() - offset.ms);
                if (now >= triggerTime) {
                    if (!rm.notified_offsets[offset.id]) {
                        alarmTriggered = rm;
                        rm.notified_offsets[offset.id] = true;
                        modified = true;
                    }
                } else {
                    hasPending = true;
                }
            }
        });
        
        if (hasPending) {
            pendingCount++;
        }
    });

    if (modified) {
        localStorage.setItem('family_reminders', JSON.stringify(allReminders));
    }

    UI.updateNotificationBadge(pendingCount);

    if (alarmTriggered) {
        showAlarmModal(alarmTriggered);
    }
}

let currentAlarmAudio = null;
let vibrationInterval = null;

function playLoudBell() {
    try {
        if (currentAlarmAudio) {
            currentAlarmAudio.pause();
            currentAlarmAudio.currentTime = 0;
        }
        if (vibrationInterval) {
            clearInterval(vibrationInterval);
        }
        
        currentAlarmAudio = new Audio(ALARM_SOUND_URL);
        currentAlarmAudio.volume = 1.0;
        currentAlarmAudio.loop = true; // Lặp liên tục
        const playPromise = currentAlarmAudio.play();
        if (playPromise !== undefined) {
            playPromise.catch(e => console.log("Trình duyệt chặn tự động phát âm thanh.", e));
        }
        if (navigator.vibrate) {
            // Rung ngay lập tức
            navigator.vibrate([1000, 500, 1000, 500]);
            // Lặp lại việc rung mỗi 3 giây
            vibrationInterval = setInterval(() => {
                navigator.vibrate([1000, 500, 1000, 500]);
            }, 3000);
        }
    } catch (err) {}
}

function stopLoudBell() {
    if (currentAlarmAudio) {
        currentAlarmAudio.pause();
        currentAlarmAudio.currentTime = 0;
        currentAlarmAudio = null;
    }
    if (vibrationInterval) {
        clearInterval(vibrationInterval);
        vibrationInterval = null;
    }
    if (navigator.vibrate) {
        navigator.vibrate(0); // Dừng rung ngay lập tức
    }
}

function showAlarmModal(rm) {
    document.getElementById('alarm-title').innerText = rm.title;
    document.getElementById('alarm-time').innerText = new Date(rm.datetime).toLocaleString('vi-VN');
    if (rm.note) {
        document.getElementById('alarm-note-container').style.display = 'block';
        document.getElementById('alarm-note').innerText = rm.note;
    } else {
        document.getElementById('alarm-note-container').style.display = 'none';
    }
    document.getElementById('modal-alarm').classList.remove('hidden');
    playLoudBell();
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
    document.getElementById('reminder-offset1-val').value = reminder.offset1_val || '';
    document.getElementById('reminder-offset1-unit').value = reminder.offset1_unit || 'minutes';
    document.getElementById('reminder-offset2-val').value = reminder.offset2_val || '';
    document.getElementById('reminder-offset2-unit').value = reminder.offset2_unit || 'minutes';
    document.getElementById('modal-reminder-title').innerText = 'Sửa lịch hẹn';
    openModal('modal-reminder');
});

// --- AI Medication Analysis & Chatbot Events ---
document.addEventListener('click', async (e) => {
    // 1. Phân tích thuốc chuyên sâu
    const btnAnalyzeMeds = e.target.closest('.btn-analyze-meds');
    if (btnAnalyzeMeds) {
        const id = btnAnalyzeMeds.dataset.id;
        const record = currentRecords.find(r => r.id === id);
        if (record && record.treatment) {
            btnAnalyzeMeds.innerHTML = `<span class="loading-spinner" style="width: 14px; height: 14px; border-width: 2px; margin-right: 5px;"></span> Đang phân tích...`;
            btnAnalyzeMeds.disabled = true;
            try {
                const analysis = await AIService.analyzeMedications(record.treatment);
                record.medicationAnalysis = analysis;
                DataManager.saveRecord(currentMemberId, record); // Lưu vào DB
                await UI.renderRecordDetailModal(record); // Render lại form
            } catch (err) {
                alert("Lỗi khi phân tích thuốc: " + err.message);
                btnAnalyzeMeds.innerHTML = `<span class="material-symbols-rounded ai-sparkle" style="font-size: 16px;">medication</span> Phân tích đơn thuốc chuyên sâu (AI)`;
                btnAnalyzeMeds.disabled = false;
            }
        }
        return;
    }

    // 2. Toggle Chat
    const btnToggleChat = e.target.closest('#btn-toggle-chat');
    if (btnToggleChat) {
        const chatContainer = document.getElementById('view-record-chat-container');
        chatContainer.classList.toggle('hidden');
        if (!chatContainer.classList.contains('hidden')) {
            // Scroll to chat
            chatContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
            document.getElementById('chat-input').focus();
        }
        return;
    }

    // 3. Send Chat
    const btnChatSend = e.target.closest('#btn-chat-send');
    if (btnChatSend) {
        handleSendChat();
        return;
    }
});

// Handle Enter key for Deep Chat Input
document.addEventListener('keypress', (e) => {
    if (e.target.id === 'deep-chat-input' && e.key === 'Enter') {
        handleDeepChatSend();
    }
});

async function handleDeepChatSend(initialMessage = null) {
    const input = document.getElementById('deep-chat-input');
    const msg = initialMessage || input.value.trim();
    if (!msg) return;

    const modal = document.getElementById('modal-view-record');
    const recordId = modal.dataset.id;
    const record = currentRecords.find(r => r.id === recordId);
    if (!record) return;

    const chatMessages = document.getElementById('deep-chat-messages');
    
    // Nếu là tin nhắn đầu tiên (tự động hỏi)
    if (initialMessage) {
        chatMessages.innerHTML = `
            <div class="chat-message assistant">
                <p>Chào bạn, tôi đang phân tích chuyên sâu hồ sơ này...</p>
            </div>
        `;
    }

    // Hiển thị tin nhắn user
    chatMessages.innerHTML += `
        <div class="chat-message user">
            <p>${UI.escapeHtml(msg)}</p>
        </div>
    `;
    input.value = '';
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Hiển thị typing indicator
    const typingId = 'typing-' + Date.now();
    chatMessages.innerHTML += `
        <div id="${typingId}" class="chat-message assistant chat-typing">
            <p>AI đang suy nghĩ...</p>
        </div>
    `;
    chatMessages.scrollTop = chatMessages.scrollHeight;

    const btnSend = document.getElementById('btn-deep-chat-send');
    btnSend.disabled = true;
    input.disabled = true;

    try {
        if (!window.currentDeepChatHistory) window.currentDeepChatHistory = [];
        const reply = await AIService.chatWithRecord(record, window.currentDeepChatHistory, msg);
        
        // Xóa typing
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();

        // Hiển thị reply
        chatMessages.innerHTML += `
            <div class="chat-message assistant">
                <div class="markdown-body" style="background: none; padding: 0;">${UI.renderMarkdown(reply)}</div>
                <div style="font-size: 11px; color: var(--danger); margin-top: 10px; font-style: italic; border-top: 1px solid rgba(0,0,0,0.05); padding-top: 5px;">* Lưu ý: Thông tin chỉ mang tính tham khảo. Hãy tham khảo ý kiến Bác sĩ.</div>
            </div>
        `;
        
        // Lưu lịch sử
        window.currentDeepChatHistory.push({ role: 'user', content: msg });
        window.currentDeepChatHistory.push({ role: 'assistant', content: reply });
        
    } catch (err) {
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();
        chatMessages.innerHTML += `
            <div class="chat-message assistant" style="color: var(--danger);">
                <p>Lỗi: ${err.message}</p>
            </div>
        `;
    } finally {
        btnSend.disabled = false;
        input.disabled = false;
        if (!initialMessage) input.focus();
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// --- UX Tương tác AI Nâng cao ---
let currentSelectedText = "";
const floatingBtn = document.getElementById('floating-ai-btn');

document.addEventListener('selectionchange', () => {
    const modal = document.getElementById('modal-view-record');
    if (!modal || modal.classList.contains('hidden')) return;

    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text.length > 0 && text.length < 150) {
        currentSelectedText = text;
        try {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) return;
            
            let top = rect.top - 40;
            if (top < 10) top = rect.bottom + 10;
            
            floatingBtn.style.top = `${top}px`;
            floatingBtn.style.left = `${rect.left + (rect.width / 2) - 40}px`;
            floatingBtn.classList.remove('hidden');
            floatingBtn.classList.add('visible');
        } catch (e) {}
    } else {
        setTimeout(() => {
            const currentText = window.getSelection().toString().trim();
            if (currentText.length === 0) {
                floatingBtn.classList.remove('visible');
                setTimeout(() => {
                    if (!floatingBtn.classList.contains('visible')) {
                        floatingBtn.classList.add('hidden');
                    }
                }, 200);
            }
        }, 100);
    }
});

function openDeepChatModal(keyword = null) {
    document.getElementById('modal-deep-chat').classList.remove('hidden');
    
    // Khởi tạo lịch sử chat mới
    window.currentDeepChatHistory = [];
    document.getElementById('deep-chat-messages').innerHTML = '';
    
    if (keyword) {
        handleDeepChatSend(`Hãy phân tích chuyên sâu cho tôi về: "${keyword}"`);
    } else {
        document.getElementById('deep-chat-messages').innerHTML = `
            <div class="chat-message assistant">
                <p>Chào bạn, tôi là Trợ lý Y tế AI. Bạn muốn trao đổi chuyên sâu về vấn đề gì trong hồ sơ này?</p>
            </div>
        `;
    }
}

document.addEventListener('click', async (e) => {
    // 1. Phân tích thuốc chuyên sâu
    const btnAnalyzeMeds = e.target.closest('.btn-analyze-meds');
    if (btnAnalyzeMeds) {
        const id = btnAnalyzeMeds.dataset.id;
        const record = currentRecords.find(r => r.id === id);
        if (record && record.treatment) {
            btnAnalyzeMeds.innerHTML = `<span class="loading-spinner" style="width: 14px; height: 14px; border-width: 2px; margin-right: 5px;"></span> Đang phân tích...`;
            btnAnalyzeMeds.disabled = true;
            try {
                const analysis = await AIService.analyzeMedications(record.treatment);
                record.medicationAnalysis = analysis;
                DataManager.saveRecord(currentMemberId, record);
                await UI.renderRecordDetailModal(record);
            } catch (err) {
                alert("Lỗi khi phân tích thuốc: " + err.message);
                btnAnalyzeMeds.innerHTML = `<span class="material-symbols-rounded ai-sparkle" style="font-size: 16px;">medication</span> Phân tích đơn thuốc chuyên sâu (AI)`;
                btnAnalyzeMeds.disabled = false;
            }
        }
        return;
    }

    // 2. Toggle Chat (Hỏi AI chung) -> Mở Deep Chat
    const btnToggleChat = e.target.closest('#btn-toggle-chat');
    if (btnToggleChat) {
        openDeepChatModal();
        return;
    }

    // 3. Send Deep Chat
    const btnDeepChatSend = e.target.closest('#btn-deep-chat-send');
    if (btnDeepChatSend) {
        handleDeepChatSend();
        return;
    }

    // 4. Bôi đen văn bản (Floating Button) -> Mở Deep Chat
    if (e.target.closest('#floating-ai-btn')) {
        if (currentSelectedText) {
            openDeepChatModal(currentSelectedText);
            
            window.getSelection().removeAllRanges();
            floatingBtn.classList.remove('visible');
            setTimeout(() => floatingBtn.classList.add('hidden'), 200);
        }
    }

    // 5. Clickable Row (Mở Inline Info)
    const clickableRow = e.target.closest('.clickable-row');
    if (clickableRow) {
        const nextRow = clickableRow.nextElementSibling;
        if (nextRow && nextRow.classList.contains('inline-info-row')) {
            // Toggle
            if (nextRow.classList.contains('hidden')) {
                nextRow.classList.remove('hidden');
                
                const contentDiv = nextRow.querySelector('.inline-info-content');
                if (contentDiv.innerHTML.includes('Loaded by JS') || contentDiv.innerHTML.trim() === '') {
                    // Lấy record hiện tại
                    const modal = document.getElementById('modal-view-record');
                    const record = currentRecords.find(r => r.id === modal.dataset.id);
                    const keyword = clickableRow.dataset.keyword;
                    const fieldIndex = record.dynamicFields.findIndex(f => f.key === keyword);
                    const field = record.dynamicFields[fieldIndex];

                    const renderExplanation = (text) => `
                        <div style="margin-bottom: 12px; line-height: 1.5;">${UI.renderMarkdown(text)}</div>
                        <button class="secondary-btn btn-open-deep-chat" data-keyword="${UI.escapeHtml(keyword)}" style="font-size: 12px; padding: 5px 10px; color: #8e44ad; border-color: #8e44ad;">
                            <span class="material-symbols-rounded" style="font-size: 14px; vertical-align: middle; margin-right: 4px;">forum</span> Trao đổi chuyên sâu
                        </button>
                    `;

                    if (field && field.explanation) {
                        contentDiv.innerHTML = renderExplanation(field.explanation);
                    } else {
                        contentDiv.innerHTML = `<div style="display: flex; align-items: center; gap: 8px; color: #8e44ad;"><span class="loading-spinner" style="width: 14px; height: 14px; border-width: 2px; border-color: #8e44ad; border-right-color: transparent;"></span> Đang lấy thông tin tóm tắt...</div>`;
                        
                        try {
                            const explanation = await AIService.getShortExplanation(keyword, record?.disease, record?.treatment);
                            
                            // Lưu lại offline để lần sau mở nhanh hơn (nếu tìm thấy field)
                            if (field) {
                                field.explanation = explanation;
                                DataManager.saveRecord(currentMemberId, record);
                            }

                            contentDiv.innerHTML = renderExplanation(explanation);
                        } catch (err) {
                            contentDiv.innerHTML = `<span style="color: var(--danger);">Không thể lấy thông tin: ${err.message}</span>`;
                        }
                    }
                }
            } else {
                nextRow.classList.add('hidden');
            }
        }
        return;
    }
    
    // 6. Nút "Trao đổi chuyên sâu" bên trong Inline Info
    const btnOpenDeepChat = e.target.closest('.btn-open-deep-chat');
    if (btnOpenDeepChat) {
        const keyword = btnOpenDeepChat.dataset.keyword;
        openDeepChatModal(keyword);
    }
    // 7. Nút "Cách tạo Key"
    const btnCreateKey = e.target.closest('.btn-create-key');
    if (btnCreateKey) {
        e.preventDefault();
        const provider = btnCreateKey.dataset.provider;
        const modal = document.getElementById('modal-api-key-guide');
        const titleEl = document.getElementById('api-key-guide-title');
        const contentEl = document.getElementById('api-key-guide-content');
        
        if (provider === 'gemini') {
            titleEl.innerHTML = '<span style="color: #27ae60;">Hướng dẫn tạo API Key Google Gemini (Miễn phí)</span>';
            contentEl.innerHTML = `
                <p>Google Gemini là AI mặc định và bắt buộc phải có để đọc ảnh bệnh án. Hiện tại Google cho phép dùng hoàn toàn miễn phí.</p>
                <ol style="margin-left: 20px;">
                    <li style="margin-bottom: 10px;">Mở trang <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color: #2980b9; font-weight: bold;">Google AI Studio</a> và đăng nhập bằng tài khoản Gmail của bạn.</li>
                    <li style="margin-bottom: 10px;">Bấm nút <strong>"Create API Key"</strong> màu xanh.</li>
                    <li style="margin-bottom: 10px;">Chọn <strong>"Create API key in new project"</strong>. Quá trình tạo mất vài giây.</li>
                    <li style="margin-bottom: 10px;">Bạn sẽ thấy một chuỗi ký tự dài (thường bắt đầu bằng <code>AIzaSy...</code>). Bấm nút Copy (Sao chép).</li>
                    <li>Quay lại màn hình Cài đặt của phần mềm này, dán chuỗi đó vào ô <strong>Google Gemini API Key</strong> rồi lưu lại.</li>
                </ol>
            `;
        } else if (provider === 'openai') {
            titleEl.innerHTML = '<span style="color: #10a37f;">Hướng dẫn tạo API Key OpenAI (ChatGPT)</span>';
            contentEl.innerHTML = `
                <p>OpenAI (nhà phát triển của ChatGPT) cung cấp API rất thông minh nhưng yêu cầu nạp tiền trả trước (Pay-as-you-go).</p>
                <ol style="margin-left: 20px;">
                    <li style="margin-bottom: 10px;">Mở trang <a href="https://platform.openai.com/api-keys" target="_blank" style="color: #2980b9; font-weight: bold;">OpenAI Platform</a> và đăng nhập.</li>
                    <li style="margin-bottom: 10px;">(Nếu đây là lần đầu dùng API, bạn cần vào mục <strong>Settings > Billing</strong> để thêm thẻ thanh toán và nạp tối thiểu 5$).</li>
                    <li style="margin-bottom: 10px;">Tại mục <strong>API Keys</strong>, bấm nút <strong>"Create new secret key"</strong>.</li>
                    <li style="margin-bottom: 10px;">Nhập tên tùy ý (ví dụ "App So Kham") rồi bấm Create.</li>
                    <li style="margin-bottom: 10px;">Copy chuỗi ký tự hiển thị ra (bắt đầu bằng <code>sk-proj-...</code>). <em>Lưu ý: Mã này chỉ hiện ra 1 lần duy nhất.</em></li>
                    <li>Dán mã đó vào ô <strong>OpenAI API Key</strong> của phần mềm và lưu lại.</li>
                </ol>
            `;
        } else if (provider === 'anthropic') {
            titleEl.innerHTML = '<span style="color: #d35400;">Hướng dẫn tạo API Key Anthropic (Claude)</span>';
            contentEl.innerHTML = `
                <p>Claude của Anthropic nổi tiếng với khả năng đọc hiểu lập luận dài và ngôn ngữ mượt mà. Giống như OpenAI, bạn cần nạp tiền trả trước.</p>
                <ol style="margin-left: 20px;">
                    <li style="margin-bottom: 10px;">Mở trang <a href="https://console.anthropic.com/settings/keys" target="_blank" style="color: #2980b9; font-weight: bold;">Anthropic Console</a> và đăng nhập.</li>
                    <li style="margin-bottom: 10px;">Vào mục <strong>Billing</strong> để nạp tiền vào tài khoản (thường tối thiểu 5$).</li>
                    <li style="margin-bottom: 10px;">Quay lại mục <strong>API Keys</strong>, bấm nút <strong>"Create Key"</strong>.</li>
                    <li style="margin-bottom: 10px;">Đặt tên cho key và copy đoạn mã (thường bắt đầu bằng <code>sk-ant-...</code>).</li>
                    <li>Dán mã đó vào ô <strong>Anthropic API Key</strong> của phần mềm và lưu lại.</li>
                </ol>
            `;
        }
        modal.classList.remove('hidden');
    }
});

// ==================== VACCINE REMINDERS & CONSULTATION CONTROLLER ====================

/**
 * Mở modal tương tác hỏi người dùng có muốn thêm lịch nhắc tiêm mũi tiếp theo
 */
function promptVaccineReminderModal(memberId, vInfo, recordData) {
    const titleEl = document.getElementById('vaccine-reminder-title');
    const dateEl = document.getElementById('vaccine-reminder-date');
    const timeEl = document.getElementById('vaccine-reminder-time');
    const noteEl = document.getElementById('vaccine-reminder-note');
    const promptInfoEl = document.getElementById('vaccine-prompt-info');
    const promptModal = document.getElementById('modal-vaccine-reminder-prompt');

    if (!promptModal || !titleEl || !dateEl) return;

    titleEl.value = vInfo.nextDoseTitle || `Tiêm mũi tiếp theo (${vInfo.vaccineName || 'Vắc xin'})`;
    dateEl.value = vInfo.nextDoseDate || '';
    if (timeEl) timeEl.value = '08:00';
    if (noteEl) noteEl.value = vInfo.defaultNote || `Lịch hẹn tiêm vắc xin ${vInfo.vaccineName || ''}. Mang theo sổ tiêm chủng.`;

    if (promptInfoEl) {
        promptInfoEl.innerHTML = `
            <p style="margin: 0 0 6px 0;"><strong>Vắc xin vừa lưu:</strong> ${UI.escapeHtml(vInfo.vaccineName || 'Vắc xin')} (Mũi ${vInfo.currentDose || 1})</p>
            <p style="margin: 0 0 6px 0;"><strong>Bệnh phòng ngừa:</strong> ${UI.escapeHtml(vInfo.diseaseTarget || 'Bệnh truyền nhiễm')}</p>
            <p style="margin: 0 0 6px 0;"><strong>Phác đồ chuẩn:</strong> ${UI.escapeHtml(vInfo.schedule || 'Theo hướng dẫn y tế')}</p>
            ${vInfo.nextDoseDate ? `<p style="margin: 0; color: #27ae60; font-weight: 600;">👉 Đề xuất mũi tiếp theo: <u>${UI.escapeHtml(vInfo.nextDoseTitle || '')}</u> vào ngày <u>${UI.formatDate(vInfo.nextDoseDate)}</u> (~${vInfo.intervalDays || 30} ngày sau mũi vừa tiêm).</p>` : ''}
        `;
    }

    promptModal.dataset.memberId = memberId;
    promptModal.dataset.vaccineText = vInfo.vaccineName || '';
    openModal('modal-vaccine-reminder-prompt');
}

/**
 * Tra cứu và mở Modal Cẩm nang Vắc xin
 */
async function openVaccineConsultation(vaccineText, date) {
    const modal = document.getElementById('modal-vaccine-consultation');
    const loading = document.getElementById('vaccine-consultation-loading');
    const content = document.getElementById('vaccine-consultation-content');
    const member = DataManager.getMemberById(currentMemberId);
    const memberName = member ? (member.nickname || member.name) : '';

    if (!modal) return;
    modal.dataset.vaccineText = vaccineText;
    modal.dataset.date = date;
    openModal('modal-vaccine-consultation');

    if (loading) loading.classList.remove('hidden');
    if (content) content.innerHTML = '';

    try {
        const mdText = await AIService.getVaccineConsultation(vaccineText, date, memberName);
        if (content) content.innerHTML = UI.renderMarkdown(mdText);
    } catch (err) {
        if (content) content.innerHTML = `<p style="color: var(--danger);">Lỗi khi tra cứu vắc xin: ${UI.escapeHtml(err.message)}</p>`;
    } finally {
        if (loading) loading.classList.add('hidden');
    }
}

// Xử lý xác nhận tạo lịch nhắc tiêm từ Modal Gợi ý
document.getElementById('btn-confirm-vaccine-reminder')?.addEventListener('click', () => {
    const promptModal = document.getElementById('modal-vaccine-reminder-prompt');
    const memberId = promptModal?.dataset.memberId || currentMemberId;
    const title = document.getElementById('vaccine-reminder-title')?.value.trim();
    const date = document.getElementById('vaccine-reminder-date')?.value;
    const time = document.getElementById('vaccine-reminder-time')?.value || '08:00';
    const note = document.getElementById('vaccine-reminder-note')?.value.trim();

    if (!title || !date) {
        alert('Vui lòng nhập đầy đủ tên mũi tiêm và ngày hẹn tiêm.');
        return;
    }

    DataManager.saveReminder({
        memberId: memberId,
        title: title,
        date: date,
        time: time,
        note: note
    });

    closeModal('modal-vaccine-reminder-prompt');
    showToast('Đã thêm lịch nhắc tiêm phòng thành công!', 'success');
    checkReminders();
    if (currentView === 'detail') {
        const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
        if (activeTab === 'tab-reminders') {
            const member = DataManager.getMemberById(memberId);
            if (member) UI.renderRemindersList(DataManager.getReminders().filter(r => r.memberId === memberId));
        }
    }
});

// Xử lý bỏ qua nhắc tiêm
document.getElementById('btn-cancel-vaccine-reminder')?.addEventListener('click', () => {
    closeModal('modal-vaccine-reminder-prompt');
});

// Xử lý nút "Cẩm nang Vắc xin" trong Chi tiết Hồ sơ
document.getElementById('btn-view-vaccine-guide')?.addEventListener('click', (e) => {
    const vaccineText = e.currentTarget.dataset.vaccineText || 'Tiêm chủng';
    const date = e.currentTarget.dataset.date || '';
    openVaccineConsultation(vaccineText, date);
});

// Xử lý nút "Tra cứu Vắc xin" trên thanh banner nhanh trong form nhập hồ sơ
document.getElementById('btn-quick-vaccine-guide')?.addEventListener('click', () => {
    const disease = document.getElementById('record-disease')?.value.trim() || '';
    const treatment = document.getElementById('record-treatment')?.value.trim() || '';
    const date = document.getElementById('record-date')?.value || '';
    const vaccineText = disease || treatment || 'Vắc xin tiêm phòng';
    openVaccineConsultation(vaccineText, date);
});

// Xử lý nút "Tạo Lịch nhắc tiêm" từ trong Modal Cẩm nang
document.getElementById('btn-create-reminder-from-guide')?.addEventListener('click', () => {
    const modal = document.getElementById('modal-vaccine-consultation');
    const vaccineText = modal?.dataset.vaccineText || 'Tiêm chủng';
    const date = modal?.dataset.date || '';
    closeModal('modal-vaccine-consultation');

    const vInfo = AIService.calculateNextVaccineDose(vaccineText, date) || {
        isVaccine: true,
        vaccineName: vaccineText,
        currentDose: 1,
        nextDoseTitle: `Tiêm mũi tiếp theo (${vaccineText})`,
        nextDoseDate: '',
        defaultNote: `Lịch nhắc tiêm vắc xin ${vaccineText}. Mang theo sổ tiêm chủng.`
    };
    promptVaccineReminderModal(currentMemberId, vInfo, { date: date });
});

// Xử lý nút đặt lịch nhắc nhanh từ khối thông tin vắc xin trong Chi tiết hồ sơ (event delegation)
document.addEventListener('click', (e) => {
    const btnInline = e.target.closest('.btn-create-vaccine-reminder-inline');
    if (btnInline) {
        const title = btnInline.dataset.title || 'Tiêm mũi tiếp theo';
        const date = btnInline.dataset.date || '';
        const note = btnInline.dataset.note || '';
        const vInfo = {
            nextDoseTitle: title,
            nextDoseDate: date,
            defaultNote: note,
            vaccineName: title,
            currentDose: 1,
            diseaseTarget: 'Phòng ngừa bệnh truyền nhiễm',
            schedule: 'Theo phác đồ chuẩn'
        };
        promptVaccineReminderModal(currentMemberId, vInfo, { date: date });
    }
});

// Tự động bật/tắt banner gợi ý vắc xin trong form nhập hồ sơ
function updateVaccineBannerState() {
    const typeVal = document.getElementById('record-type')?.value || '';
    const diseaseVal = document.getElementById('record-disease')?.value || '';
    const treatmentVal = document.getElementById('record-treatment')?.value || '';
    const banner = document.getElementById('vaccine-quick-banner');
    if (!banner) return;

    const isVac = typeVal === 'Tiêm chủng' || 
                  typeVal.toLowerCase().includes('tiêm') || 
                  (typeof AIService !== 'undefined' && AIService.findVaccineInfo(diseaseVal + ' ' + treatmentVal));
    
    if (isVac) {
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }
}

document.getElementById('record-type')?.addEventListener('input', updateVaccineBannerState);
document.getElementById('record-type')?.addEventListener('change', updateVaccineBannerState);
document.getElementById('record-disease')?.addEventListener('input', updateVaccineBannerState);
document.getElementById('record-treatment')?.addEventListener('input', updateVaccineBannerState);

// ==================== IMAGE VIEWER ZOOM & PRINT CONTROLS ====================
let viewerZoomScale = 1;

function updateViewerZoom() {
    const imgEl = document.getElementById('viewer-image');
    if (imgEl) {
        imgEl.style.transform = `scale(${viewerZoomScale})`;
    }
}

document.getElementById('btn-viewer-zoom-in')?.addEventListener('click', () => {
    viewerZoomScale = Math.min(viewerZoomScale + 0.25, 3.5);
    updateViewerZoom();
});

document.getElementById('btn-viewer-zoom-out')?.addEventListener('click', () => {
    viewerZoomScale = Math.max(viewerZoomScale - 0.25, 0.5);
    updateViewerZoom();
});

document.getElementById('btn-viewer-zoom-reset')?.addEventListener('click', () => {
    viewerZoomScale = 1;
    updateViewerZoom();
});

// In ảnh đang hiển thị trong modal viewer
document.getElementById('btn-print-viewer-image')?.addEventListener('click', () => {
    const imgEl = document.getElementById('viewer-image');
    if (imgEl && imgEl.src) {
        printMedicalImages([imgEl.src], 'Tài liệu y tế gốc');
    }
});

// Tải ảnh về máy từ modal viewer
document.getElementById('btn-download-viewer-image')?.addEventListener('click', () => {
    const imgEl = document.getElementById('viewer-image');
    if (imgEl && imgEl.src) {
        const a = document.createElement('a');
        a.href = imgEl.src;
        a.download = `Tai_lieu_y_te_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('Đang tải hình ảnh về thiết bị...', 'success');
    }
});

// Chia sẻ ảnh từ modal viewer
document.getElementById('btn-share-viewer-image')?.addEventListener('click', async () => {
    const imgEl = document.getElementById('viewer-image');
    if (!imgEl || !imgEl.src) return;

    if (navigator.share) {
        try {
            // Chuyển base64 sang Blob nếu cần chia sẻ file
            const res = await fetch(imgEl.src);
            const blob = await res.blob();
            const file = new File([blob], `Ho_so_y_te_${Date.now()}.png`, { type: blob.type });
            await navigator.share({
                title: 'Hồ sơ y tế',
                text: 'Hình ảnh tài liệu hồ sơ y tế gia đình',
                files: [file]
            });
        } catch (err) {
            if (err.name !== 'AbortError') {
                showToast('Không thể chia sẻ: ' + err.message, 'error');
            }
        }
    } else {
        showToast('Trình duyệt không hỗ trợ Web Share API.', 'error');
    }
});

/**
 * Hàm in ấn một hoặc nhiều hình ảnh tài liệu y tế chuẩn
 */
function printMedicalImages(imageSrcs, title = 'Tài liệu hồ sơ y tế') {
    if (!imageSrcs || imageSrcs.length === 0) {
        showToast('Không tìm thấy hình ảnh nào để in.', 'error');
        return;
    }

    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow.document;
    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>${title}</title>
            <style>
                @page { margin: 10mm; size: auto; }
                body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; }
                .print-page { page-break-after: always; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 96vh; }
                .print-page:last-child { page-break-after: avoid; }
                img { max-width: 100%; max-height: 90vh; object-fit: contain; box-shadow: none; }
                .print-caption { margin-top: 10px; font-size: 13px; color: #555; }
            </style>
        </head>
        <body>
            ${imageSrcs.map((src, idx) => `
                <div class="print-page">
                    <img src="${src}" alt="${title}">
                    <div class="print-caption">${title} (Trang ${idx + 1}/${imageSrcs.length})</div>
                </div>
            `).join('')}
        </body>
        </html>
    `);
    doc.close();

    printFrame.contentWindow.focus();
    setTimeout(() => {
        printFrame.contentWindow.print();
        setTimeout(() => {
            if (document.body.contains(printFrame)) {
                document.body.removeChild(printFrame);
            }
        }, 1500);
    }, 600);
}

// Xử lý sự kiện bấm In một ảnh riêng lẻ từ Gallery / Thu gọn tài liệu
document.addEventListener('click', async (e) => {
    // 0. Đóng/mở mục Tài liệu đính kèm ở cuối trang
    const toggleDocsBtn = e.target.closest('#btn-toggle-attached-docs');
    if (toggleDocsBtn) {
        const body = document.getElementById('attached-docs-body');
        const icon = document.getElementById('attached-docs-toggle-icon');
        const text = document.getElementById('attached-docs-toggle-text');
        if (body) {
            const isHidden = body.classList.contains('hidden');
            if (isHidden) {
                body.classList.remove('hidden');
                if (icon) icon.style.transform = 'rotate(180deg)';
                if (text) text.innerText = 'Thu gọn';
            } else {
                body.classList.add('hidden');
                if (icon) icon.style.transform = 'rotate(0deg)';
                if (text) text.innerText = 'Xem tài liệu';
            }
        }
        return;
    }

    // 1. Mở xem ảnh phóng to từ bất kỳ phần tử nào có class .btn-view-img
    const btnView = e.target.closest('.btn-view-img');
    if (btnView && !btnView.closest('#records-list')) {
        let src = btnView.dataset.img;
        if (src && src.startsWith('img_')) {
            src = await ImageStore.getImage(src);
        }
        const imgEl = document.getElementById('viewer-image');
        if (imgEl && src) {
            imgEl.src = src;
            viewerZoomScale = 1;
            imgEl.style.transform = 'scale(1)';
            openModal('modal-image-viewer');
        }
        return;
    }

    // 2. In 1 tài liệu đơn lẻ
    const btnPrintSingle = e.target.closest('.btn-print-single-doc');
    if (btnPrintSingle) {
        let src = btnPrintSingle.dataset.img;
        if (src && src.startsWith('img_')) {
            src = await ImageStore.getImage(src);
        }
        if (src) {
            printMedicalImages([src], 'Tài liệu y tế gốc');
        }
        return;
    }

    // 3. In toàn bộ tài liệu đính kèm của hồ sơ
    const btnPrintAll = e.target.closest('.btn-print-all-docs');
    if (btnPrintAll) {
        const recordId = btnPrintAll.dataset.recordId;
        const record = currentRecords.find(r => r.id === recordId);
        if (record) {
            const images = record.originalImages || (record.originalImage ? [record.originalImage] : []);
            if (images.length === 0) {
                showToast('Hồ sơ này không có tài liệu hình ảnh nào đính kèm.', 'error');
                return;
            }
            const resolvedSrcs = [];
            for (let img of images) {
                let s = img;
                if (img.startsWith('img_')) {
                    s = await ImageStore.getImage(img);
                }
                if (s) resolvedSrcs.push(s);
            }
            printMedicalImages(resolvedSrcs, `Hồ sơ ${record.hospital || 'Khám bệnh'} (${record.date || ''})`);
        }
    }
});

// ==================== NÚT NỔI "QUAY VỀ" (FLOATING LEFT BACK BUTTON) ====================
document.getElementById('btn-floating-back')?.addEventListener('click', () => {
    // 1. Nếu có modal đang mở -> Đóng modal trên cùng
    const visibleModals = Array.from(document.querySelectorAll('.modal-overlay:not(.hidden)'));
    if (visibleModals.length > 0) {
        const topModal = visibleModals[visibleModals.length - 1];
        if (topModal && topModal.id) {
            closeModal(topModal.id);
            return;
        }
    }

    // 2. Nếu đang ở màn hình Chi tiết Thành viên -> Quay về Dashboard (Danh sách thành viên)
    const isDetailView = document.getElementById('view-member-detail')?.classList.contains('active');
    if (isDetailView) {
        switchView('view-dashboard');
        initDashboard();
    }
});

// ==================== HỆ THỐNG ĐỌC GIỌNG NÓI CHO NGƯỜI LỚN TUỔI (TEXT-TO-SPEECH) ====================
const TTSService = {
    chunks: [],
    currentChunkIndex: 0,
    isPlaying: false,
    isPaused: false,
    currentType: null,
    activeBtnElement: null,
    activeContainerElement: null,
    speed: 0.9, // Tốc độ đọc từ tốn, ấm áp, rõ ràng cho người lớn tuổi
    pitch: 1.05, // Cao độ giọng nữ êm dịu
    audioFallback: null,
    currentUtterance: null,
    voiceProvider: localStorage.getItem('tts_voice_provider') || 'system',

    getVietnameseFemaleVoice() {
        if (!('speechSynthesis' in window)) return null;
        const voices = window.speechSynthesis.getVoices() || [];
        const viVoices = voices.filter(v => 
            v.lang === 'vi-VN' || v.lang === 'vi_VN' || (v.lang && v.lang.toLowerCase().startsWith('vi'))
        );
        if (viVoices.length === 0) return null;

        // Ưu tiên giọng nữ tiếng Việt êm dịu, tự nhiên:
        // 1. Microsoft HoaiMy Online (Edge Natural)
        // 2. Google Tiếng Việt (Chrome / Android)
        // 3. Linh / Mai (iOS / macOS Enhanced)
        const femaleKeywords = ['hoaimy', 'linh', 'mai', 'female', 'tiếng việt', 'vietnam', 'vi-vn'];
        for (let kw of femaleKeywords) {
            const found = viVoices.find(v => (v.name || '').toLowerCase().includes(kw));
            if (found) return found;
        }
        return viVoices[0];
    },

    cleanTextForSpeech(rawText) {
        if (!rawText) return '';
        let t = rawText
            .replace(/<[^>]*>/g, ' ') // Xóa thẻ HTML
            .replace(/[*#_`>~]/g, ' ') // Xóa ký tự markdown
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Giữ lại text trong markdown link
            .replace(/\bmg\b/gi, ' miligam ')
            .replace(/\bml\b/gi, ' mililit ')
            .replace(/\bkg\b/gi, ' kilogam ')
            .replace(/\bcm\b/gi, ' xentimét ')
            .replace(/\bmmhg\b/gi, ' milimét thủy ngân ')
            .replace(/\bmmol\/l\b/gi, ' milimol trên lít ')
            .replace(/\bui\/l\b/gi, ' đơn vị trên lít ')
            .replace(/\bbpm\b/gi, ' nhịp một phút ')
            .replace(/\bHA\b/g, ' Huyết áp ')
            .replace(/\bSpO2\b/gi, ' Độ bão hòa oxy SpO2 ')
            .replace(/\blần\/ngày\b/gi, ' lần một ngày ')
            .replace(/\bviên\/ngày\b/gi, ' viên một ngày ')
            .replace(/\bĐ\/C\b/gi, ' Địa chỉ ')
            .replace(/\bBS\b/g, ' Bác sĩ ')
            .replace(/\bBV\b/g, ' Bệnh viện ')
            .replace(/\s+/g, ' ')
            .trim();
        return t;
    },

    splitIntoChunks(text, maxChunkLength = 100) {
        // Tách văn bản thành các câu ngắn để không bao giờ bị đứng/treo trên điện thoại
        const rawSentences = text.split(/([.,;!?\n]+)/);
        const chunks = [];
        let cur = '';

        for (let i = 0; i < rawSentences.length; i++) {
            const piece = (rawSentences[i] || '').trim();
            if (!piece) continue;
            if ((cur + ' ' + piece).length <= maxChunkLength) {
                cur += (cur ? ' ' : '') + piece;
            } else {
                if (cur) chunks.push(cur);
                cur = piece;
            }
        }
        if (cur) chunks.push(cur);
        
        // Đảm bảo tuyệt đối không có chunk nào vượt quá maxChunkLength (nếu câu thiếu dấu câu)
        const finalChunks = [];
        for (let c of chunks) {
            if (c.length > maxChunkLength) {
                const words = c.split(' ');
                let temp = '';
                for (let w of words) {
                    if ((temp + ' ' + w).length <= maxChunkLength) {
                        temp += (temp ? ' ' : '') + w;
                    } else {
                        if (temp) finalChunks.push(temp);
                        temp = w;
                    }
                }
                if (temp) finalChunks.push(temp);
            } else {
                finalChunks.push(c);
            }
        }
        return finalChunks.filter(c => c.length > 1);
    },

    buildRecordSpokenText(record) {
        if (!record) return '';
        let parts = [];
        parts.push(`Hồ sơ khám bệnh tại ${record.hospital || 'bệnh viện'}.`);
        if (record.date) {
            const [y, m, d] = record.date.split('-');
            parts.push(`Ngày khám: ngày ${parseInt(d)} tháng ${parseInt(m)} năm ${y}.`);
        }
        if (record.doctor) parts.push(`Bác sĩ phụ trách: ${record.doctor}.`);
        if (record.type) parts.push(`Phân loại: ${record.type}.`);
        if (record.disease) parts.push(`Chẩn đoán kết luận: ${record.disease}.`);

        if (record.treatment) {
            parts.push(`Chỉ định điều trị và đơn thuốc: ${record.treatment}.`);
        }

        if (record.medicationAnalysis) {
            parts.push(`Phân tích đơn thuốc chuyên sâu: ${record.medicationAnalysis}.`);
        }

        if (record.note) parts.push(`Lời khuyên dặn dò của bác sĩ: ${record.note}.`);
        if (record.cost) parts.push(`Chi phí khám chữa bệnh: ${UI.formatCurrency ? UI.formatCurrency(record.cost) : record.cost + ' đồng'}.`);

        const vitals = [];
        if (record.bp) vitals.push(`Huyết áp: ${record.bp} milimét thủy ngân`);
        if (record.hr) vitals.push(`Nhịp tim: ${record.hr} nhịp một phút`);
        if (record.temp) vitals.push(`Thân nhiệt: ${record.temp} độ C`);
        if (record.spo2) vitals.push(`Độ bão hòa oxy máu: ${record.spo2} phần trăm`);
        if (vitals.length > 0) {
            parts.push(`Chỉ số sinh hiệu cơ thể: ${vitals.join(', ')}.`);
        }

        if (record.symptoms) parts.push(`Triệu chứng ghi nhận: ${record.symptoms}.`);
        if (record.labs) parts.push(`Kết quả cận lâm sàng: ${record.labs}.`);

        if (record.dynamicFields && record.dynamicFields.length > 0) {
            const abnormalFields = record.dynamicFields.filter(f => f.isAbnormal);
            const normalFields = record.dynamicFields.filter(f => !f.isAbnormal);
            if (abnormalFields.length > 0) {
                parts.push(`Cảnh báo các chỉ số xét nghiệm bất thường: ${abnormalFields.map(f => f.key + ' là ' + f.value).join(', ')}.`);
            }
            if (normalFields.length > 0) {
                parts.push(`Các chỉ số xét nghiệm bình thường: ${normalFields.map(f => f.key + ' là ' + f.value).join(', ')}.`);
            }
        }

        if (record.comprehensiveReport) {
            parts.push(`Báo cáo nhận xét chuyên sâu từ trí tuệ nhân tạo: ${record.comprehensiveReport}.`);
        }

        return parts.join(' ');
    },

    speak(text, title = 'Đang đọc nội dung...', btnTarget = null, type = null, containerTarget = null) {
        this.stop();

        // Mở khóa âm thanh cho trình duyệt di động
        if ('speechSynthesis' in window) {
            try {
                window.speechSynthesis.resume();
            } catch(e){}
        }

        const clean = this.cleanTextForSpeech(text);
        if (!clean) {
            showToast('Không có nội dung văn bản để đọc.', 'error');
            return;
        }

        this.chunks = this.splitIntoChunks(clean);
        if (this.chunks.length === 0) return;

        this.currentChunkIndex = 0;
        this.isPlaying = true;
        this.isPaused = false;
        this.currentType = type;

        // Resolve Button Element
        if (typeof btnTarget === 'string') {
            this.activeBtnElement = document.querySelector(btnTarget);
        } else {
            this.activeBtnElement = btnTarget;
        }

        // Resolve Container Element
        if (typeof containerTarget === 'string') {
            this.activeContainerElement = document.querySelector(containerTarget);
        } else {
            this.activeContainerElement = containerTarget;
        }

        this.showPlayerUI(title);
        this.setButtonState(true);
        this.setContainerHighlight(true);

        this.playNextChunk();
    },

    playNextChunk() {
        if (!this.isPlaying || this.isPaused) return;

        if (this.currentChunkIndex >= this.chunks.length) {
            this.stop();
            showToast('Đã đọc xong toàn bộ nội dung.', 'success');
            return;
        }

        const chunkText = this.chunks[this.currentChunkIndex];
        this.updatePlayerSubtitle(chunkText);

        if (this.voiceProvider === 'google_translate') {
            this.playChunkWithAudioFallback(chunkText);
            return;
        }

        const voice = this.getVietnameseFemaleVoice();
        const hasNativeVi = 'speechSynthesis' in window && (voice || !/Android/i.test(navigator.userAgent));

        if (hasNativeVi && 'speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(chunkText);
            utterance.lang = 'vi-VN';
            utterance.rate = this.speed;
            utterance.pitch = this.pitch;
            if (voice) utterance.voice = voice;

            utterance.onend = () => {
                if (this.isPlaying && !this.isPaused) {
                    this.currentChunkIndex++;
                    setTimeout(() => this.playNextChunk(), 120);
                }
            };

            utterance.onerror = (e) => {
                console.warn('SpeechSynthesis error, fallback to audio stream:', e);
                this.playChunkWithAudioFallback(chunkText);
            };

            this.currentUtterance = utterance;
            window.speechSynthesis.speak(utterance);
        } else {
            this.playChunkWithAudioFallback(chunkText);
        }
    },

    playChunkWithAudioFallback(chunkText) {
        if (!this.isPlaying || this.isPaused) return;
        const encoded = encodeURIComponent(chunkText);
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encoded}`;

        if (!this.audioFallback) {
            this.audioFallback = new Audio();
        }
        this.audioFallback.src = url;
        this.audioFallback.playbackRate = this.speed;

        this.audioFallback.onended = () => {
            if (this.isPlaying && !this.isPaused) {
                this.currentChunkIndex++;
                setTimeout(() => this.playNextChunk(), 120);
            }
        };

        this.audioFallback.onerror = () => {
            this.currentChunkIndex++;
            setTimeout(() => this.playNextChunk(), 120);
        };

        this.audioFallback.play().catch(err => {
            console.warn('Audio play fallback error:', err);
            this.currentChunkIndex++;
            setTimeout(() => this.playNextChunk(), 150);
        });
    },

    pauseResume() {
        if (!this.isPlaying) return;
        const icon = document.getElementById('tts-pause-icon');
        if (this.isPaused) {
            this.isPaused = false;
            if (icon) icon.innerText = 'pause';
            if (this.audioFallback && !this.audioFallback.paused) {
                this.audioFallback.play();
            } else if ('speechSynthesis' in window) {
                window.speechSynthesis.resume();
            }
            this.playNextChunk();
            showToast('Tiếp tục đọc');
        } else {
            this.isPaused = true;
            if (icon) icon.innerText = 'play_arrow';
            if (this.audioFallback) {
                this.audioFallback.pause();
            }
            if ('speechSynthesis' in window) {
                window.speechSynthesis.pause();
            }
            showToast('Đã tạm dừng đọc');
        }
    },

    stop() {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        if (this.audioFallback) {
            this.audioFallback.pause();
            this.audioFallback.currentTime = 0;
        }
        this.isPlaying = false;
        this.isPaused = false;
        this.currentType = null;
        this.chunks = [];
        this.currentChunkIndex = 0;
        this.hidePlayerUI();
        this.setButtonState(false);
        this.setContainerHighlight(false);
        this.activeBtnElement = null;
        this.activeContainerElement = null;
    },

    toggleSpeed() {
        const speeds = [0.8, 0.9, 1.1];
        const labels = ['0.8x', '0.9x', '1.1x'];
        const desc = ['Rất chậm', 'Êm dịu chuẩn', 'Nhanh hơn'];
        let idx = speeds.indexOf(this.speed);
        if (idx === -1) idx = 1;
        idx = (idx + 1) % speeds.length;
        this.speed = speeds[idx];
        const btn = document.getElementById('btn-tts-speed');
        if (btn) btn.innerText = labels[idx];
        showToast(`Tốc độ đọc: ${labels[idx]} (${desc[idx]})`);
    },

    showPlayerUI(title) {
        const bar = document.getElementById('tts-player-bar');
        const titleEl = document.getElementById('tts-player-title');
        const pauseIcon = document.getElementById('tts-pause-icon');
        if (titleEl) titleEl.innerText = title;
        if (pauseIcon) pauseIcon.innerText = 'pause';
        if (bar) bar.classList.remove('hidden');
    },

    updatePlayerSubtitle(text) {
        const titleEl = document.getElementById('tts-player-title');
        if (titleEl) {
            titleEl.innerText = `Đang đọc: "${text}"`;
            titleEl.title = text;
        }
    },

    hidePlayerUI() {
        const bar = document.getElementById('tts-player-bar');
        if (bar) bar.classList.add('hidden');
    },

    setContainerHighlight(isHighlight) {
        document.querySelectorAll('.reading-active-container').forEach(el => {
            el.classList.remove('reading-active-container');
        });
        if (isHighlight && this.activeContainerElement) {
            this.activeContainerElement.classList.add('reading-active-container');
        }
    },

    setButtonState(isSpeaking) {
        document.querySelectorAll('.tts-speak-btn').forEach(btn => {
            btn.classList.remove('speaking');
            const isAllBtn = btn.id === 'btn-speak-record';
            btn.innerHTML = `
                <span class="material-symbols-rounded" style="font-size: ${isAllBtn ? 16 : 14}px;">volume_up</span>
                <span>${isAllBtn ? 'Đọc tất cả' : 'Đọc'}</span>
            `;
        });

        if (isSpeaking && this.activeBtnElement) {
            this.activeBtnElement.classList.add('speaking');
            this.activeBtnElement.innerHTML = `
                <div class="sound-wave-bars">
                    <span class="bar b1"></span>
                    <span class="bar b2"></span>
                    <span class="bar b3"></span>
                    <span class="bar b4"></span>
                    <span class="bar b5"></span>
                </div>
                <span>Dừng</span>
            `;
        }
    }
};

// Đảm bảo tải trước danh sách giọng nói tiếng Việt khi trình duyệt sẵn sàng
if ('speechSynthesis' in window) {
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => TTSService.getVietnameseFemaleVoice();
    }
}

// 1. Đọc Chi tiết Toàn bộ Hồ sơ
document.getElementById('btn-speak-record')?.addEventListener('click', (e) => {
    const btn = document.getElementById('btn-speak-record');
    if (TTSService.isPlaying && TTSService.activeBtnElement === btn) {
        TTSService.stop();
        return;
    }
    const modal = document.getElementById('modal-view-record');
    const recordId = modal.dataset.id;
    const record = currentRecords.find(r => r.id === recordId);
    if (!record) return showToast('Không tìm thấy thông tin hồ sơ.', 'error');

    let spokenText = TTSService.buildRecordSpokenText(record);
    TTSService.speak(spokenText, `Hồ sơ: ${record.disease || record.hospital || 'Khám bệnh'}`, btn, 'record-all', '#view-record-content');
});

// 2. Đọc Từng Khung Nội dung Riêng biệt (.btn-speak-section)
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-speak-section');
    if (!btn) return;

    if (TTSService.isPlaying && TTSService.activeBtnElement === btn) {
        TTSService.stop();
        return;
    }

    const targetSelector = btn.dataset.target;
    const sectionName = btn.dataset.sectionName || 'Nội dung mục';
    const container = targetSelector ? document.querySelector(targetSelector) : btn.closest('.detail-section-card');

    if (!container) return;

    // Clone container và xóa các nút điều khiển để chỉ đọc văn bản nội dung sạch
    const clone = container.cloneNode(true);
    clone.querySelectorAll('button, .attached-doc-actions, script, style, .material-symbols-rounded').forEach(el => el.remove());
    const text = clone.innerText || '';

    if (!text.trim()) {
        showToast('Mục này chưa có nội dung văn bản để đọc.', 'info');
        return;
    }

    TTSService.speak(text, sectionName, btn, 'section', container);
});

// 3. Đọc AI Nhận xét
document.getElementById('btn-speak-assessment')?.addEventListener('click', () => {
    const btn = document.getElementById('btn-speak-assessment');
    if (TTSService.isPlaying && TTSService.activeBtnElement === btn) {
        TTSService.stop();
        return;
    }
    const content = document.getElementById('ai-assessment-content')?.innerText;
    if (!content || !content.trim()) return showToast('Chưa có nội dung nhận xét để đọc.', 'error');

    TTSService.speak(content, 'AI Nhận xét sức khỏe', btn, 'assessment', '#ai-assessment-content');
});

// 4. Đọc Cẩm nang Vắc xin
document.getElementById('btn-speak-vaccine-guide')?.addEventListener('click', () => {
    const btn = document.getElementById('btn-speak-vaccine-guide');
    if (TTSService.isPlaying && TTSService.activeBtnElement === btn) {
        TTSService.stop();
        return;
    }
    const content = document.getElementById('vaccine-consultation-content')?.innerText;
    if (!content || !content.trim()) return showToast('Chưa có nội dung cẩm nang để đọc.', 'error');

    TTSService.speak(content, 'Cẩm nang Tiêm chủng', btn, 'vaccine', '#vaccine-consultation-content');
});

// 5. Các nút điều khiển trên Mini Player
document.getElementById('btn-tts-pause-resume')?.addEventListener('click', () => TTSService.pauseResume());
document.getElementById('btn-tts-stop')?.addEventListener('click', () => TTSService.stop());
document.getElementById('btn-tts-speed')?.addEventListener('click', () => TTSService.toggleSpeed());

// 6. Cài đặt Giọng đọc
document.getElementById('btn-tts-settings')?.addEventListener('click', () => {
    const provider = TTSService.voiceProvider;
    const radio = document.querySelector(`input[name="tts_voice_provider"][value="${provider}"]`);
    if (radio) radio.checked = true;
    document.getElementById('modal-tts-settings').classList.remove('hidden');
});

document.querySelectorAll('input[name="tts_voice_provider"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const val = e.target.value;
        TTSService.voiceProvider = val;
        localStorage.setItem('tts_voice_provider', val);
        showToast('Đã lưu cài đặt giọng đọc.');
        setTimeout(() => document.getElementById('modal-tts-settings').classList.add('hidden'), 500);
    });
});


// ==================== CLOUD SYNC (GIA ĐÌNH) ====================
const CloudSync = {
    firebaseConfigStr: localStorage.getItem('cloud_sync_firebase_config') || '',
    familyId: localStorage.getItem('cloud_sync_family_id') || '',
    app: null,
    db: null,
    unsubscribe: null,
    isSyncing: false,
    
    saveConfig(configStr, familyId) {
        this.firebaseConfigStr = configStr.trim();
        this.familyId = familyId.trim();
        localStorage.setItem('cloud_sync_firebase_config', this.firebaseConfigStr);
        localStorage.setItem('cloud_sync_family_id', this.familyId);
    },

    clearConfig() {
        this.firebaseConfigStr = '';
        this.familyId = '';
        localStorage.removeItem('cloud_sync_firebase_config');
        localStorage.removeItem('cloud_sync_family_id');
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        this.app = null;
        this.db = null;
    },

    isConfigured() {
        return this.firebaseConfigStr && this.familyId;
    },

    updateStatus(msg, isError = false) {
        const box = document.getElementById('cloud-sync-status-box');
        const text = document.getElementById('cloud-sync-status-text');
        if (box && text) {
            box.style.display = 'block';
            box.style.backgroundColor = isError ? 'rgba(231, 76, 60, 0.1)' : 'rgba(46, 204, 113, 0.1)';
            box.style.color = isError ? '#e74c3c' : '#27ae60';
            text.innerText = msg;
        }
        if (isError) {
            console.error('Cloud Sync Error:', msg);
        }
    },

    async initFirebase() {
        if (!this.isConfigured()) return false;
        if (this.db) return true;

        try {
            const config = JSON.parse(this.firebaseConfigStr);
            const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
            const { getDatabase } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js");
            
            this.app = initializeApp(config, 'family-sync-app-' + Date.now());
            this.db = getDatabase(this.app);
            return true;
        } catch (err) {
            this.updateStatus('Cấu hình Firebase không hợp lệ hoặc lỗi kết nối!', true);
            return false;
        }
    },

    async startAutoSync() {
        if (!await this.initFirebase()) return;
        
        this.updateStatus('Đang kết nối Firebase và lắng nghe đồng bộ...');
        
        try {
            const { ref, onValue } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js");
            const dbRef = ref(this.db, 'families/' + this.familyId);
            
            if (this.unsubscribe) this.unsubscribe();
            
            this.unsubscribe = onValue(dbRef, async (snapshot) => {
                if (this.isSyncing) return; // Prevent echoing back our own pushes
                
                const data = snapshot.val();
                if (data && data.localStorage) {
                    this.updateStatus('Đang nạp dữ liệu từ Firebase...');
                    this.isSyncing = true;
                    try {
                        const success = await DataManager.importData(JSON.stringify(data));
                        if (success) {
                            this.updateStatus('Đã đồng bộ tự động thành công!');
                            if (typeof initDashboard === 'function') initDashboard();
                            if (document.getElementById('view-member-detail')?.classList.contains('active') && window.currentMember) {
                                if (typeof renderMemberDetail === 'function') renderMemberDetail(window.currentMember);
                            }
                        }
                    } catch (e) {
                        console.error("Lỗi khi nạp dữ liệu tự động:", e);
                        this.updateStatus('Lỗi khi nạp dữ liệu từ đám mây.', true);
                    }
                    setTimeout(() => { this.isSyncing = false; }, 1000);
                } else {
                    this.updateStatus('Kho dữ liệu trên Firebase hiện đang trống.', true);
                }
            }, (error) => {
                this.updateStatus('Bị từ chối quyền truy cập (Kiểm tra Database Rules).', true);
            });
            
        } catch (err) {
            this.updateStatus(err.message, true);
        }
    },

    async syncUp() {
        if (!await this.initFirebase()) return;
        
        this.updateStatus('Đang đẩy dữ liệu lên Firebase...');
        this.isSyncing = true; // Block incoming auto-sync temporarily to prevent echo loop
        
        try {
            const backupStr = await DataManager.exportData();
            const payload = JSON.parse(backupStr);

            const { ref, set } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js");
            const dbRef = ref(this.db, 'families/' + this.familyId);
            
            await set(dbRef, payload);
            this.updateStatus('Đã đẩy dữ liệu thành công lên hệ thống chung!');
        } catch (err) {
            this.updateStatus('Lỗi khi đẩy dữ liệu: ' + err.message, true);
        } finally {
            setTimeout(() => { this.isSyncing = false; }, 1000);
        }
    }
};
window.CloudSync = CloudSync;

// Tự động kích hoạt đẩy dữ liệu lên mây khi có thay đổi nội bộ
setTimeout(() => {
    if (typeof DataManager !== 'undefined') {
        const methodsToPatch = ['saveMember', 'deleteMember', 'saveRecord', 'deleteRecord', 'saveReminder', 'deleteReminder', 'markReminderAsNotified'];
        methodsToPatch.forEach(method => {
            const original = DataManager[method];
            if (typeof original === 'function') {
                DataManager[method] = async function(...args) {
                    const result = await original.apply(this, args);
                    if (CloudSync.isConfigured() && !CloudSync.isSyncing) {
                        CloudSync.syncUp(); // fire and forget
                    }
                    return result;
                };
            }
        });
    }
}, 1000);

// ==================== BINDING CLOUD SYNC EVENTS ====================
document.addEventListener('DOMContentLoaded', () => {
    const inputFirebaseConfig = document.getElementById('sync-firebase-config');
    const inputFamilyId = document.getElementById('sync-family-id');

    // Phục hồi UI
    if (inputFirebaseConfig) inputFirebaseConfig.value = CloudSync.firebaseConfigStr;
    if (inputFamilyId) inputFamilyId.value = CloudSync.familyId;

    function parseFirebaseConfig(raw) {
        try {
            return JSON.stringify(JSON.parse(raw));
        } catch(e) {
            try {
                const first = raw.indexOf('{');
                const last = raw.lastIndexOf('}');
                if (first !== -1 && last !== -1) {
                    const extracted = raw.substring(first, last + 1);
                    const obj = new Function("return " + extracted)();
                    if (obj && typeof obj === 'object') {
                        return JSON.stringify(obj);
                    }
                }
            } catch(err) {}
            return null;
        }
    }

    document.getElementById('btn-sync-connect')?.addEventListener('click', () => {
        let config = inputFirebaseConfig.value.trim();
        const familyId = inputFamilyId.value.trim();
        if (!config || !familyId) return CloudSync.updateStatus('Vui lòng nhập đủ Cấu hình Firebase và Mã Gia Đình!', true);
        
        config = parseFirebaseConfig(config);
        if (!config) return CloudSync.updateStatus('Cấu hình Firebase không hợp lệ!', true);
        if (inputFirebaseConfig) inputFirebaseConfig.value = config; // Update UI to show valid JSON
        
        CloudSync.saveConfig(config, familyId);
        CloudSync.startAutoSync();
    });

    document.getElementById('btn-sync-push')?.addEventListener('click', () => {
        let config = inputFirebaseConfig.value.trim();
        const familyId = inputFamilyId.value.trim();
        if (!config || !familyId) return CloudSync.updateStatus('Vui lòng nhập đủ Cấu hình Firebase và Mã Gia Đình!', true);
        
        config = parseFirebaseConfig(config);
        if (!config) return CloudSync.updateStatus('Cấu hình Firebase không hợp lệ!', true);
        if (inputFirebaseConfig) inputFirebaseConfig.value = config;
        
        if (!confirm('Hành động này sẽ ép ghi đè dữ liệu trên mây bằng dữ liệu máy bạn. Bạn có chắc không?')) return;
        
        CloudSync.saveConfig(config, familyId);
        CloudSync.syncUp();
    });

    document.getElementById('btn-sync-clear')?.addEventListener('click', () => {
        if (!confirm('Bạn có muốn ngắt kết nối đồng bộ không? Dữ liệu trên máy không bị ảnh hưởng.')) return;
        CloudSync.clearConfig();
        if (inputFirebaseConfig) inputFirebaseConfig.value = '';
        if (inputFamilyId) inputFamilyId.value = '';
        CloudSync.updateStatus('Đã ngắt kết nối Cloud Sync.');
    });

    if (CloudSync.isConfigured()) {
        setTimeout(() => {
            CloudSync.startAutoSync();
        }, 1500);
    }
});
