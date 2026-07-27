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

    // Biometric UI Update
    if (window.PublicKeyCredential) {
        document.getElementById('biometric-settings-container')?.classList.remove('hidden');
        const biometricOn = !!settings.biometricCredentialId;
        document.getElementById('biometric-status-on')?.classList.toggle('hidden', !biometricOn);
        document.getElementById('biometric-status-off')?.classList.toggle('hidden', biometricOn);
        
        const bioLoginContainer = document.getElementById('biometric-login-container');
        if (bioLoginContainer) {
            bioLoginContainer.classList.toggle('hidden', !biometricOn || !pinOn);
        }
    }
}

// WebAuthn Helpers
function bufferToBase64url(buffer) {
    const bytes = new Uint8Array(buffer);
    let str = '';
    for (let charCode of bytes) {
        str += String.fromCharCode(charCode);
    }
    const base64String = btoa(str);
    return base64String.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlToBuffer(base64url) {
    const padding = '='.repeat((4 - base64url.length % 4) % 4);
    const base64 = (base64url + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray.buffer;
}

async function registerBiometric() {
    if (!window.PublicKeyCredential) {
        alert("Trình duyệt hoặc thiết bị của bạn không hỗ trợ sinh trắc học.");
        return;
    }
    try {
        const challenge = crypto.getRandomValues(new Uint8Array(32));
        const userId = crypto.getRandomValues(new Uint8Array(16));
        
        const createCredentialOptions = {
            publicKey: {
                challenge: challenge,
                rp: { 
                    name: "Family Medical Record",
                    id: window.location.hostname
                },
                user: {
                    id: userId,
                    name: "user",
                    displayName: "Chủ sở hữu thiết bị"
                },
                pubKeyCredParams: [
                    { alg: -7, type: "public-key" },
                    { alg: -257, type: "public-key" }
                ],
                authenticatorSelection: {
                    // Loại bỏ authenticatorAttachment: "platform" để hỗ trợ các thiết bị ngoại vi như Webcam USB dùng Windows Hello Face
                    userVerification: "required"
                },
                timeout: 60000
            }
        };

        const credential = await navigator.credentials.create(createCredentialOptions);
        const credentialId = bufferToBase64url(credential.rawId);
        
        DataManager.saveSettings({ biometricCredentialId: credentialId });
        updatePinUIState();
        showToast("Đã bật sinh trắc học thành công!");
    } catch (err) {
        console.error(err);
        alert("Không thể thiết lập sinh trắc học (có thể bạn đã hủy hoặc thiết bị không hỗ trợ): " + err.message);
    }
}

async function loginBiometric(silentFail = false) {
    const settings = DataManager.getSettings();
    const credId = settings.biometricCredentialId;
    if (!credId || !window.PublicKeyCredential) return;

    try {
        const challenge = crypto.getRandomValues(new Uint8Array(32));
        const rawId = base64urlToBuffer(credId);
        
        const getCredentialOptions = {
            publicKey: {
                challenge: challenge,
                rpId: window.location.hostname,
                allowCredentials: [{
                    id: rawId,
                    type: 'public-key'
                }],
                userVerification: "required",
                timeout: 60000
            }
        };

        const assertion = await navigator.credentials.get(getCredentialOptions);
        if (assertion) {
            unlockApp();
            showToast("Đăng nhập bằng sinh trắc học thành công!");
        }
    } catch (err) {
        console.error(err);
        if (!silentFail) {
            alert("Xác thực sinh trắc học thất bại: " + err.message);
        }
    }
}

function showLockScreen() {
    const lockScreen = document.getElementById('lock-screen');
    lockScreen.classList.remove('hidden');
    document.getElementById('unlock-error').classList.add('hidden');
    const input = document.getElementById('input-unlock-pin');
    input.value = '';
    
    const settings = DataManager.getSettings();
    if (settings.biometricCredentialId && window.PublicKeyCredential) {
        // Tự động yêu cầu sinh trắc học thay vì chờ bấm nút
        loginBiometric(true);
    } else {
        setTimeout(() => input.focus(), 50);
    }
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

    // btn-forgot-pin đã được loại bỏ để tăng cường bảo mật.



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

    const btnEnableBiometric = document.getElementById('btn-enable-biometric');
    if (btnEnableBiometric) {
        btnEnableBiometric.addEventListener('click', () => {
            registerBiometric();
        });
    }

    const btnDisableBiometric = document.getElementById('btn-disable-biometric');
    if (btnDisableBiometric) {
        btnDisableBiometric.addEventListener('click', () => {
            if (confirm('Bạn có chắc chắn muốn tắt tính năng đăng nhập bằng Sinh trắc học?')) {
                DataManager.saveSettings({ biometricCredentialId: null });
                updatePinUIState();
                showToast('Đã tắt Sinh trắc học.');
            }
        });
    }

    const btnBiometricLogin = document.getElementById('btn-biometric-login');
    if (btnBiometricLogin) {
        btnBiometricLogin.addEventListener('click', () => {
            loginBiometric();
        });
    }
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
    
    // Set timer to automatically check reminders every 60 seconds
    setInterval(() => {
        checkReminders();
    }, 60000);
    updatePinUIState();
    UI.enhanceA11y(document); // Gán aria-label cho các nút chỉ có icon (tĩnh trong index.html)

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
    
    if (settings.providerAssessment) document.getElementById('input-ai-provider-assessment').value = settings.providerAssessment;
    else if (settings.activeProvider) document.getElementById('input-ai-provider-assessment').value = settings.activeProvider;
    
    if (settings.providerSearch) document.getElementById('input-ai-provider-search').value = settings.providerSearch;
    else if (settings.activeProvider) document.getElementById('input-ai-provider-search').value = settings.activeProvider;
    
    if (settings.providerTrend) document.getElementById('input-ai-provider-trend').value = settings.providerTrend;
    else if (settings.activeProvider) document.getElementById('input-ai-provider-trend').value = settings.activeProvider;
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

    async function generateAndSharePdf(element, filename) {
        // Tạo overlay che màn hình để giấu việc xử lý DOM
        const loadingOverlay = document.createElement('div');
        loadingOverlay.style.position = 'fixed';
        loadingOverlay.style.top = '0';
        loadingOverlay.style.left = '0';
        loadingOverlay.style.width = '100vw';
        loadingOverlay.style.height = '100vh';
        loadingOverlay.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
        loadingOverlay.style.zIndex = '999999';
        loadingOverlay.style.display = 'flex';
        loadingOverlay.style.flexDirection = 'column';
        loadingOverlay.style.justifyContent = 'center';
        loadingOverlay.style.alignItems = 'center';
        loadingOverlay.style.color = '#2563eb';
        loadingOverlay.style.fontSize = '18px';
        loadingOverlay.style.fontWeight = 'bold';
        loadingOverlay.innerHTML = '<div class="loading-spinner" style="width:40px;height:40px;margin-bottom:15px;border:4px solid #2563eb;border-top-color:transparent;"></div> Đang tạo tệp PDF chất lượng cao...';
        document.body.appendChild(loadingOverlay);

        // Tạo một container độc lập hoàn toàn gắn thẳng vào body
        const wrapper = document.createElement('div');
        wrapper.style.position = 'absolute';
        wrapper.style.top = '0'; // Bắt buộc ở toạ độ 0 để html2canvas không chụp hụt (gây ra lỗi trang trắng)
        wrapper.style.left = '0';
        wrapper.style.width = '800px'; 
        wrapper.style.height = 'auto'; // Tự do giãn theo nội dung
        wrapper.style.background = 'white';
        wrapper.style.padding = '30px';
        wrapper.style.color = 'black';
        wrapper.style.zIndex = '999990'; // Nằm ngay dưới loadingOverlay

        const clone = element.cloneNode(true);
        // Xóa sạch mọi rào cản chiều cao trên clone
        clone.style.overflow = 'visible';
        clone.style.overflowY = 'visible';
        clone.style.maxHeight = 'none';
        clone.style.height = 'auto';
        
        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);

        // Đảm bảo tất cả hình ảnh trong bản sao đã load xong hoàn toàn để tính toán chiều cao chính xác
        const imgs = Array.from(wrapper.querySelectorAll('img'));
        await Promise.all(imgs.map(img => new Promise(resolve => {
            if (img.complete) resolve();
            else { img.onload = resolve; img.onerror = resolve; }
        })));

        // Đợi thêm một chút để trình duyệt hoàn tất render layout (dành cho máy yếu)
        await new Promise(r => setTimeout(r, 1500)); 

        // Tính toán chiều cao chính xác (cộng thêm 1 chút biên độ an toàn)
        const docHeight = wrapper.scrollHeight + 50;
        let safeScale = 2;
        if (docHeight * safeScale > 14000) safeScale = 1.5;
        if (docHeight * safeScale > 14000) safeScale = 1;

        const opt = {
            margin:       0.5,
            filename:     filename,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { 
                scale: safeScale, 
                useCORS: true, 
                logging: false,
                windowWidth: 800,
                windowHeight: docHeight,
                scrollY: 0
            },
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' },
            // Bỏ avoid-all để html2pdf tự do cắt trang nếu phần tử quá dài, đảm bảo không bao giờ mất chữ
            pagebreak:    { mode: ['css', 'legacy'] } 
        };

        try {
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            if (isMobile && navigator.share && typeof navigator.canShare === 'function') {
                try {
                    const pdfBlob = await html2pdf().set(opt).from(wrapper).output('blob');
                    const file = new File([pdfBlob], filename, { type: 'application/pdf' });
                    
                    if (navigator.canShare({ files: [file] })) {
                        // Dọn dẹp DOM trước khi gọi bảng share
                        wrapper.remove();
                        loadingOverlay.remove();

                        await navigator.share({
                            title: 'Tài liệu Y khoa',
                            text: 'Tài liệu xuất từ ứng dụng Hồ sơ Sức khỏe Gia đình',
                            files: [file]
                        });
                        return; 
                    }
                } catch (shareErr) {
                    if (shareErr.name === 'AbortError') return;
                    console.warn('Lỗi khi chia sẻ, đang chuyển sang tải xuống...', shareErr);
                }
            }
            
            await html2pdf().set(opt).from(wrapper).save();
            
        } catch (err) {
            console.error('Lỗi quá trình tạo PDF:', err);
            alert('Đã xảy ra lỗi khi tạo tệp PDF. Xin vui lòng thử lại.');
        } finally {
            if (document.body.contains(wrapper)) wrapper.remove();
            if (document.body.contains(loadingOverlay)) loadingOverlay.remove();
        }
    }

    document.getElementById('btn-download-pdf').addEventListener('click', async () => {
        const element = document.getElementById('report-preview-mode');
        await generateAndSharePdf(element, 'Bao_Cao_Y_Khoa.pdf');
    });

    document.getElementById('btn-download-record-pdf').addEventListener('click', async () => {
        const element = document.getElementById('view-record-content');
        await generateAndSharePdf(element, 'Chi_Tiet_Ho_So.pdf');
    });

    document.getElementById('btn-download-assessment-pdf').addEventListener('click', async () => {
        const element = document.getElementById('ai-assessment-content');
        let rawTitle = document.querySelector('#modal-ai-assessment .modal-header h3').innerText.trim();
        const titleText = rawTitle.replace(/psychiatry|travel_explore|auto_awesome/g, '').trim() || 'AI_Assessment';
        await generateAndSharePdf(element, `${titleText}.pdf`.replace(/\s+/g, '_'));
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
