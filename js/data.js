// Cấu trúc lưu trữ dữ liệu trong LocalStorage
// 'family_members': [{ id, name, dob, blood, conditions, avatar }]
// 'family_records_m_{id}': [{ id, date, hospital, type, doctor, disease, cost, treatment, originalImages, comprehensiveReport }]
// 'family_reminders': [{ id, memberId, title, date, time, note, datetime, notified }]
// 'family_settings': { activeProvider, geminiModel, geminiApiKey, openaiApiKey, anthropicApiKey }
//
// LƯU Ý BẢO MẬT: Toàn bộ dữ liệu (kể cả API Key) được lưu ở dạng văn bản thường (plain text)
// trong LocalStorage/IndexedDB của trình duyệt — KHÔNG được mã hóa. Đây là lựa chọn có chủ đích
// vì ứng dụng không có backend/máy chủ; mã hóa phía client bằng một khóa cũng lưu trên cùng máy
// sẽ không mang lại thêm an toàn thực sự. Người dùng không nên dùng chung thiết bị này với người
// lạ và nên đăng xuất/khóa máy khi rời đi.

/**
 * DataManager — lớp truy cập dữ liệu (data-access layer) duy nhất của ứng dụng.
 * Toàn bộ tương tác với LocalStorage đều nên đi qua các hàm ở đây thay vì gọi
 * localStorage trực tiếp ở nơi khác, để giữ định dạng dữ liệu nhất quán.
 */
const DataManager = {
    // ---- UTILS ----
    isDataChanged: false,

    generateId() {
        if (window.crypto && window.crypto.getRandomValues) {
            const a = new Uint32Array(2);
            window.crypto.getRandomValues(a);
            return a[0].toString(36) + a[1].toString(36) + Date.now().toString(36);
        }
        return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
    },

    /**
     * Băm một chuỗi bằng SHA-256, trả về chuỗi hex. Dùng để lưu mã PIN khóa màn hình
     * dưới dạng đã băm thay vì văn bản thường.
     * LƯU Ý: đây KHÔNG phải mã hóa dữ liệu — chỉ là một lớp khóa giao diện. Yêu cầu
     * secure context (HTTPS hoặc localhost) vì dùng Web Crypto API (crypto.subtle).
     * @param {string} text
     * @returns {Promise<string>}
     */
    async sha256Hex(text) {
        if (!window.crypto || !window.crypto.subtle) {
            throw new Error('Trình duyệt/kết nối hiện tại không hỗ trợ mã hóa an toàn (cần HTTPS).');
        }
        const data = new TextEncoder().encode(text);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    },

    // ---- MÃ PIN (PBKDF2 + muối + chống dò) ----
    PIN_ITERATIONS: 150000,
    _hex(buf) { return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''); },
    async _pbkdf2(pin, saltBytes, iterations) {
        if (!window.crypto || !window.crypto.subtle) {
            throw new Error('Trình duyệt/kết nối hiện tại không hỗ trợ mã hóa an toàn (cần HTTPS).');
        }
        const key = await window.crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
        return window.crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' }, key, 256);
    },
    /** Băm mã PIN để lưu: "pbkdf2$<số vòng>$<muối hex>$<băm hex>" (mỗi lần có muối ngẫu nhiên khác nhau). */
    async hashPin(pin) {
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const bits = await this._pbkdf2(pin, salt, this.PIN_ITERATIONS);
        return 'pbkdf2$' + this.PIN_ITERATIONS + '$' + this._hex(salt) + '$' + this._hex(bits);
    },
    _pinThrottleGet() {
        try { return JSON.parse(localStorage.getItem('pin_throttle') || '{}'); } catch (e) { return {}; }
    },
    /**
     * Kiểm tra mã PIN. Sai liên tiếp từ lần thứ 5 sẽ bị khóa tạm thời (30 giây, tăng gấp đôi mỗi lần, tối đa 15 phút).
     * Tự nâng cấp mã PIN cũ (SHA-256 không muối) lên PBKDF2 khi nhập đúng.
     * @returns {Promise<boolean>}
     * @throws {Error} khi đang bị khóa tạm thời hoặc trình duyệt không hỗ trợ mã hóa
     */
    async verifyPin(pin) {
        const th = this._pinThrottleGet();
        const wait = (th.until || 0) - Date.now();
        if (wait > 0) {
            throw new Error('Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau ' + Math.ceil(wait / 1000) + ' giây.');
        }
        const stored = this.getSettings().pinHash;
        if (!stored) return false;
        let ok = false;
        const legacy = !stored.startsWith('pbkdf2$');
        if (!legacy) {
            const [, iter, saltHex, hashHex] = stored.split('$');
            const salt = new Uint8Array((saltHex.match(/../g) || []).map(h => parseInt(h, 16)));
            ok = this._hex(await this._pbkdf2(pin, salt, parseInt(iter, 10) || this.PIN_ITERATIONS)) === hashHex;
        } else {
            ok = (await this.sha256Hex(pin)) === stored;
        }
        if (ok) {
            try { localStorage.removeItem('pin_throttle'); } catch (e) { /* bỏ qua */ }
            if (legacy) this.saveSettings({ pinHash: await this.hashPin(pin) });
            return true;
        }
        const fails = (th.fails || 0) + 1;
        const next = { fails };
        if (fails >= 5) next.until = Date.now() + Math.min(900000, 30000 * Math.pow(2, fails - 5));
        try { localStorage.setItem('pin_throttle', JSON.stringify(next)); } catch (e) { /* bỏ qua */ }
        return false;
    },

    // ---- SETTINGS ----
    // Các model Gemini đã ngừng hoạt động (Google decommission định kỳ ~1 năm/lần) — dùng để tự
    // động nâng cấp cho người dùng cũ đang kẹt ở model chết mà không hề biết, thay vì để họ nhận
    // lỗi khó hiểu mãi mãi. Cập nhật danh sách này nếu Google thông báo ngừng thêm model khác.
    DEPRECATED_GEMINI_MODELS: [
        'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash-8b',
        'gemini-2.0-flash', 'gemini-2.0-flash-001', 'gemini-2.0-flash-lite', 'gemini-2.0-flash-lite-001',
        'gemini-2.5-flash', 'gemini-2.5-pro'
    ],

    getSettings() {
        const defaultSettings = {
            // ---- Trí tuệ nhân tạo (xem js/ai-policy.js) ----
            // Quốc gia quyết định nhóm nhà cung cấp AI hiển thị. Rỗng = tự suy ra (xem AIConfig.getRegion).
            aiRegion: '',
            // Mỗi tác vụ: 'auto' (app tự chọn) hoặc 'nhàCungCấp|môHình'.
            aiTasks: { ocr: 'auto', assessment: 'auto', search: 'auto', trend: 'auto', chat: 'auto' },
            // Mỗi nhà cung cấp tối đa 2 khóa: '<p>ApiKey' (MIỄN PHÍ) và '<p>ApiKeyPaid' (TRẢ PHÍ).
            geminiApiKey: '', geminiApiKeyPaid: '',
            zhipuApiKey: '', zhipuApiKeyPaid: '',
            openaiApiKeyPaid: '', anthropicApiKeyPaid: '', deepseekApiKeyPaid: '',
            openaiApiKey: '', anthropicApiKey: '', deepseekApiKey: '', // khóa cũ (đọc như khóa trả phí)
            customModels: {}, // mô hình tải thêm từ tài khoản: { provider: [id, ...] }
            customModelsAt: {}, // lần tải danh sách mô hình gần nhất của từng AI: { provider: mili-giây }
            // Hạn mức trần chi phí API trả phí (USD / tháng) và mức đã dùng (ước tính).
            aiCapUsd: 5, // giá trị chung cũ — chỉ còn dùng làm mặc định cho AI chưa đặt trần riêng
            aiCaps: {}, // hạn mức trần trả phí (USD/tháng) RIÊNG từng AI: { provider: usd }
            aiSpendBy: {}, // mức dùng API trả phí ước tính theo từng AI: { provider: { month, usd, calls } }
            aiFreeState: {}, // theo dõi hạn mức miễn phí từng AI + mô hình: { 'provider|model': { day, calls, exhaustedAt, resetAt, kind } }
            aiKeyOff: {}, // API Key đang TẮT tạm thời (key vẫn được giữ, app không dùng): { 'provider:free'|'provider:paid': true }

            // Giờ nhắc uống thuốc mặc định
            medTimeMorning: '08:00',
            medTimeNoon: '12:00',
            medTimeAfternoon: '16:00',
            medTimeEvening: '20:00',
            // Khóa màn hình bằng mã PIN (xem sha256Hex ở trên) — mặc định tắt.
            pinEnabled: false,
            pinHash: '',
            // Nhắc backup định kỳ: mốc thời gian (ms) của lần backup gần nhất, thời điểm
            // dùng ứng dụng lần đầu (để tính hạn nhắc khi chưa từng backup lần nào), và mốc
            // "tạm ẩn" nhắc nhở khi người dùng bấm "Để sau".
            lastBackupAt: null,
            firstRunAt: null,
            backupReminderSnoozeUntil: null,
            alarmSound: 'synth:digital_loud', // Kiểu chuông to rõ mặc định
            mutedMembers: [], // Mảng chứa ID của các thành viên KHÔNG đổ chuông/thông báo trên máy này
            language: 'vi'
        };
        const stored = localStorage.getItem('family_settings');
        return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
    },
    saveSettings(settings) {
        // Merge with existing
        const current = this.getSettings();
        const updated = { ...current, ...settings };
        localStorage.setItem('family_settings', JSON.stringify(updated));
    },
    getLanguage() { return this.getSettings().language || 'vi'; },
    setLanguage(lang) { this.saveSettings({ language: lang }); },
    // Khóa/nhà cung cấp/mô hình đều do AIConfig (js/ai-policy.js) quyết định; các hàm dưới đây giữ lại để tương thích.
    getGeminiApiKey() { const k = AIConfig.getKeys('gemini', true); return k.free || k.paid; },
    getOpenAIApiKey() { const k = AIConfig.getKeys('openai', true); return k.free || k.paid; },
    getAnthropicApiKey() { const k = AIConfig.getKeys('anthropic', true); return k.free || k.paid; },
    getDeepSeekApiKey() { const k = AIConfig.getKeys('deepseek', true); return k.free || k.paid; },
    getZhipuApiKey() { const k = AIConfig.getKeys('zhipu', true); return k.free || k.paid; },
    getProviderAssessment() { return AIConfig.resolve('assessment').provider; },
    getProviderSearch() { return AIConfig.resolve('search').provider; },
    getProviderTrend() { return AIConfig.resolve('trend').provider; },
    getProviderChat() { return AIConfig.resolve('chat').provider; },
    getProviderOcr() { return AIConfig.resolve('ocr').provider; },
    getGeminiModel() { const r = AIConfig.resolve('assessment'); return r.provider === 'gemini' ? r.model : 'gemini-3.0-flash'; },

    /**
     * Chuyển cấu hình AI kiểu cũ (providerX + geminiModel + 1 khóa/nhà cung cấp) sang kiểu mới
     * (aiTasks). Chỉ chạy 1 lần cho người dùng cũ chưa có 'aiTasks' trong dữ liệu đã lưu.
     */
    migrateAiSettings() {
        let stored;
        try { stored = JSON.parse(localStorage.getItem('family_settings') || 'null'); } catch (e) { stored = null; }
        if (!stored || stored.aiTasks) return;
        const map = { ocr: 'providerOcr', assessment: 'providerAssessment', search: 'providerSearch', trend: 'providerTrend', chat: 'providerChat' };
        const tasks = {};
        Object.keys(map).forEach(t => {
            const p = stored[map[t]] || stored.activeProvider;
            if (!p || !AIConfig.PROVIDERS[p]) { tasks[t] = 'auto'; return; }
            if (p === 'gemini') { tasks[t] = /pro/i.test(stored.geminiModel || '') ? 'gemini|gemini-3.1-pro' : 'auto'; return; }
            const def = AIConfig.TASKS.find(x => x.id === t);
            const models = AIConfig.getModelsOf(p, def.vision);
            const custom = stored[p + 'Model'];
            const pick = (custom && models.find(m => m.id === custom)) || models[0];
            tasks[t] = pick ? p + '|' + pick.id : 'auto';
        });
        this.saveSettings({ aiTasks: tasks });
    },

    /**
     * Tự động nâng cấp model Gemini đã ngừng hoạt động lên model mặc định hiện tại, cho những
     * người dùng cũ đang kẹt ở 1 model chết mà không biết (trước đây mặc định là 'gemini-1.5-flash',
     * đã bị Google ngừng hỗ trợ). Chỉ chạm vào field geminiModel, không đụng gì khác.
     * @returns {boolean} true nếu vừa tự động nâng cấp (dùng để báo cho người dùng biết)
     */
    migrateDeprecatedGeminiModel() {
        const settings = this.getSettings();
        const m = settings.geminiModel;
        // Tự động nâng cấp nếu model nằm trong danh sách khai tử hoặc thuộc thế hệ cũ < 3.0 (1.x, 2.x)
        const isOldVersion = m && (this.DEPRECATED_GEMINI_MODELS.includes(m) || /^gemini-[12]./.test(m));
        if (isOldVersion) {
            const oldModel = settings.geminiModel;
            this.saveSettings({ geminiModel: 'gemini-3.0-flash' });
            console.warn(`Model Gemini "${oldModel}" đã ngừng hoạt động — đã tự động chuyển sang "gemini-3.0-flash".`);
            return true;
        }
        return false;
    },



    // ---- MEMBERS ----
    getMembers() {
        const stored = localStorage.getItem('family_members');
        return stored ? JSON.parse(stored) : [];
    },
    getMemberById(id) {
        return this.getMembers().find(m => m.id === id);
    },
    saveMember(memberData) {
        let members = this.getMembers();
        if (memberData.id) {
            // Cập nhật
            const index = members.findIndex(m => m.id === memberData.id);
            if (index > -1) {
                members[index] = { ...members[index], ...memberData };
            }
        } else {
            // Thêm mới
            memberData.id = this.generateId();
            members.push(memberData);
        }
        localStorage.setItem('family_members', JSON.stringify(members));
        this.isDataChanged = true;
        return memberData;
    },
    deleteMember(id) {
        let members = this.getMembers();
        members = members.filter(m => m.id !== id);
        localStorage.setItem('family_members', JSON.stringify(members));
        // Xóa luôn hồ sơ của người này
        localStorage.removeItem(`family_records_m_${id}`);
        this.isDataChanged = true;
    },

    // ---- MEDICAL RECORDS ----
    getRecords(memberId) {
        const stored = localStorage.getItem(`family_records_m_${memberId}`);
        return stored ? JSON.parse(stored) : [];
    },
    saveRecord(memberId, recordData) {
        let records = this.getRecords(memberId);
        if (recordData.id) {
            const index = records.findIndex(r => r.id === recordData.id);
            if (index > -1) {
                records[index] = { ...records[index], ...recordData };
            }
        } else {
            recordData.id = this.generateId();
            records.push(recordData);
        }
        records.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        localStorage.setItem(`family_records_m_${memberId}`, JSON.stringify(records));
        this.isDataChanged = true;
        return recordData;
    },
    deleteRecord(memberId, recordId) {
        let records = this.getRecords(memberId);
        records = records.filter(r => r.id !== recordId);
        localStorage.setItem(`family_records_m_${memberId}`, JSON.stringify(records));
        this.isDataChanged = true;
    },
    saveTrendReport(memberId, reportData) {
        let members = this.getMembers();
        const mIndex = members.findIndex(x => x.id === memberId);
        if (mIndex !== -1) {
            if (!members[mIndex].trendReports) members[mIndex].trendReports = [];
            members[mIndex].trendReports.push({
                ...reportData,
                id: reportData.id || ('tr_' + Date.now())
            });
            localStorage.setItem('family_members', JSON.stringify(members));
            this.isDataChanged = true;
        }
    },
    getTrendReports(memberId) {
        const m = this.getMemberById(memberId);
        return (m && m.trendReports) ? m.trendReports.sort((a,b) => new Date(b.date) - new Date(a.date)) : [];
    },
    deleteTrendReport(memberId, reportId) {
        let members = this.getMembers();
        const mIndex = members.findIndex(x => x.id === memberId);
        if (mIndex !== -1 && members[mIndex].trendReports) {
            members[mIndex].trendReports = members[mIndex].trendReports.filter(r => r.id !== reportId);
            localStorage.setItem('family_members', JSON.stringify(members));
            this.isDataChanged = true;
        }
    },

    // ---- REMINDERS ----
    getReminders() {
        const stored = localStorage.getItem('family_reminders');
        if (!stored) return [];
        let data = JSON.parse(stored);
        let changed = false;
        data.forEach(r => {
            if (r.isPlan && r.type !== 'medication_plan') {
                r.type = 'medication_plan';
                changed = true;
            }
        });
        if (changed) {
            localStorage.setItem('family_reminders', JSON.stringify(data));
        }
        return data;
    },
    saveReminder(reminderData) {
        let reminders = this.getReminders();
        if (reminderData.id) {
            const index = reminders.findIndex(r => r.id === reminderData.id);
            if (index > -1) {
                reminders[index] = { ...reminders[index], ...reminderData };
            } else {
                reminders.push(reminderData);
            }
        } else {
            reminderData.id = this.generateId();
            reminderData.notified = false; // Mặc định chưa thông báo
            reminders.push(reminderData);
        }
        // Đảm bảo có datetime để sắp xếp chuẩn xác
        if (!reminderData.datetime && reminderData.startDate) {
            const firstTime = (reminderData.times && reminderData.times[0]) || '08:00';
            reminderData.datetime = `${reminderData.startDate}T${firstTime}:00`;
        }
        // Sắp xếp theo ngày giờ tăng dần (gần nhất lên trên)
        reminders.sort((a, b) => new Date(a.datetime || 0) - new Date(b.datetime || 0));
        localStorage.setItem('family_reminders', JSON.stringify(reminders));
        return reminderData;
    },
    deleteReminder(id) {
        let reminders = this.getReminders();
        reminders = reminders.filter(r => r.id !== id);
        localStorage.setItem('family_reminders', JSON.stringify(reminders));
    },
    markReminderAsNotified(id) {
        let reminders = this.getReminders();
        const index = reminders.findIndex(r => r.id === id);
        if (index > -1) {
            reminders[index].notified = true;
            localStorage.setItem('family_reminders', JSON.stringify(reminders));
        }
    },
    deduplicateReminders() {
        let reminders = this.getReminders();
        const unique = [];
        const seen = new Set();
        let changed = false;
        
        reminders.forEach(r => {
            // Khóa nhận diện trùng lặp: MemberID + Tiêu đề + Ngày + Giờ
            // Sử dụng r.date và r.time thay vì r.datetime vì datetime có thể undefined
            let key = `${r.memberId}_${r.title}_${r.date || ''}_${r.time || ''}_${(r.note || '').substring(0, 15)}`;
            if (r.type === 'medication_plan') {
                key = `${r.memberId}_${r.type}_${r.startDate}_${r.endDate}_${r.medications ? r.medications.length : 0}`;
            }
            if (seen.has(key)) {
                changed = true; // Phát hiện trùng lặp
            } else {
                seen.add(key);
                unique.push(r);
            }
        });
        
        if (changed) {
            localStorage.setItem('family_reminders', JSON.stringify(unique));
        }
        return changed;
    },
    deleteAllReminders(memberId) {
        let reminders = this.getReminders();
        reminders = reminders.filter(r => r.memberId !== memberId);
        localStorage.setItem('family_reminders', JSON.stringify(reminders));
    },

    // ---- IMAGE UTILS ----
    // Helper to read file as Base64 for avatar / OCR image
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            if (!file) return resolve('');
            
            const fallbackReader = () => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = (e) => resolve(''); // DO NOT REJECT, resolve empty to prevent app crash
            };

            if (file.type === 'application/pdf') {
                return fallbackReader();
            }
            
            let objectUrl;
            try {
                objectUrl = URL.createObjectURL(file);
            } catch (err) {
                console.error("URL.createObjectURL failed:", err);
                return fallbackReader();
            }
            
            const img = new Image();
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1600;
                    const MAX_HEIGHT = 1600;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    const compressed = canvas.toDataURL('image/jpeg', 0.8);
                    
                    try { URL.revokeObjectURL(objectUrl); } catch(e){}
                    resolve(compressed);
                } catch (err) {
                    console.error("Image compression error:", err);
                    try { URL.revokeObjectURL(objectUrl); } catch(e){}
                    fallbackReader();
                }
            };
            img.onerror = (e) => {
                try { URL.revokeObjectURL(objectUrl); } catch(e){}
                fallbackReader();
            };
            img.src = objectUrl;
        });
    },

    // ---- EXPORT / IMPORT ----
    // Các trường trong family_settings thuộc nhóm "API Key & bảo mật" (nhạy cảm — người dùng chọn có sao lưu hay không).
    isSensitiveSettingField(name) {
        return /ApiKey(Paid)?$/.test(name) || name === 'apiKey' || name === 'pinHash' || name === 'pinEnabled';
    },
    // Dữ liệu chỉ có ý nghĩa trên từng máy (mức dùng API ước tính) — không bao giờ đưa vào file sao lưu.
    isDeviceLocalSettingField(name) {
        return name === 'aiSpend' || name === 'aiSpendBy' || name === 'aiFreeState';
    },

    /**
     * Xuất dữ liệu thành chuỗi JSON.
     * @param {{data?:boolean, settings?:boolean, apiKeys?:boolean}} [options] mặc định: tất cả (dùng cho bản lưu tự động nội bộ)
     *   - data: thành viên, hồ sơ khám, nhắc hẹn, ảnh
     *   - settings: cài đặt ứng dụng (ngôn ngữ, giờ uống thuốc, chuông, cấu hình AI...) — không gồm API Key/PIN
     *   - apiKeys: API Key các nhà cung cấp AI và mã PIN (đã băm)
     */
    async exportData(options = {}) {
        const opt = { data: true, settings: true, apiKeys: true, ...options };
        const out = {
            version: 2,
            meta: { exportedAt: new Date().toISOString(), contains: { data: !!opt.data, settings: !!opt.settings, apiKeys: !!opt.apiKeys } },
            localStorage: {},
            indexedDB: { images: [] }
        };

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith('family_') || key === 'family_settings') continue;
            if (opt.data) out.localStorage[key] = localStorage.getItem(key);
        }

        if (opt.settings || opt.apiKeys) {
            const all = this.getSettings();
            const picked = {};
            Object.keys(all).forEach(f => {
                if (this.isDeviceLocalSettingField(f)) return;
                const sensitive = this.isSensitiveSettingField(f);
                if ((sensitive && opt.apiKeys) || (!sensitive && opt.settings)) picked[f] = all[f];
            });
            out.localStorage['family_settings'] = JSON.stringify(picked);
        }

        if (opt.data) {
            try {
                out.indexedDB.images = await ImageStore.getAllImages();
            } catch (e) {
                console.error("Error exporting images", e);
            }
        }

        return JSON.stringify(out);
    },

    /**
     * Nhập dữ liệu từ file sao lưu. Chỉ thay thế những nhóm CÓ trong file (file cũ = có tất cả).
     * An toàn: kiểm tra toàn bộ file trước khi đụng tới dữ liệu hiện tại; nếu ghi lỗi giữa chừng
     * (ví dụ hết dung lượng) sẽ khôi phục lại nguyên trạng cũ.
     * @returns {Promise<{data:boolean,settings:boolean,apiKeys:boolean}>} nhóm đã được khôi phục
     */
    async importData(jsonData) {
        let data;
        try {
            data = JSON.parse(jsonData);
        } catch (e) {
            console.error("Lỗi khi nạp dữ liệu:", e);
            throw new Error("File không hợp lệ hoặc bị lỗi.");
        }
        if (!data || typeof data !== 'object' || Array.isArray(data)
            || !data.localStorage || typeof data.localStorage !== 'object' || Array.isArray(data.localStorage)) {
            throw new Error("File không hợp lệ hoặc bị lỗi (không phải file sao lưu của ứng dụng).");
        }

        // 1. Kiểm tra hợp lệ trước khi thay đổi bất cứ thứ gì
        const incoming = {};
        for (const key of Object.keys(data.localStorage)) {
            if (!key.startsWith('family_')) continue; // bỏ qua khóa lạ, không ghi vào máy
            const val = data.localStorage[key];
            if (typeof val !== 'string') throw new Error(`File sao lưu bị lỗi ở mục "${key}".`);
            try { JSON.parse(val); } catch (e) { throw new Error(`File sao lưu bị lỗi ở mục "${key}".`); }
            incoming[key] = val;
        }
        const images = data.indexedDB && Array.isArray(data.indexedDB.images) ? data.indexedDB.images : null;
        if (images && images.some(im => !im || typeof im !== 'object' || im.id === undefined)) {
            throw new Error("File sao lưu bị lỗi ở phần ảnh đính kèm.");
        }

        const legacy = !data.meta || !data.meta.contains;
        const contains = legacy
            ? { data: true, settings: true, apiKeys: true }
            : { data: !!data.meta.contains.data, settings: !!data.meta.contains.settings, apiKeys: !!data.meta.contains.apiKeys };
        if (legacy && !incoming['family_settings']) { contains.settings = false; contains.apiKeys = false; }

        // 2. Chụp lại trạng thái hiện tại để khôi phục nếu lỗi
        const snapshot = {};
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('family_')) snapshot[k] = localStorage.getItem(k);
        }
        let oldImages = null;
        if (contains.data && images) {
            try { oldImages = await ImageStore.getAllImages(); } catch (e) { oldImages = null; }
        }

        const rollback = () => {
            Object.keys(localStorage).filter(k => k.startsWith('family_')).forEach(k => localStorage.removeItem(k));
            Object.keys(snapshot).forEach(k => { try { localStorage.setItem(k, snapshot[k]); } catch (e) { /* bỏ qua */ } });
        };

        try {
            if (contains.data) {
                Object.keys(snapshot).filter(k => k !== 'family_settings').forEach(k => localStorage.removeItem(k));
                Object.keys(incoming).filter(k => k !== 'family_settings').forEach(k => localStorage.setItem(k, incoming[k]));
            }
            if ((contains.settings || contains.apiKeys) && incoming['family_settings']) {
                const current = snapshot['family_settings'] ? JSON.parse(snapshot['family_settings']) : {};
                const fromFile = JSON.parse(incoming['family_settings']);
                const merged = { ...current };
                Object.keys(fromFile).forEach(f => {
                    if (this.isDeviceLocalSettingField(f)) return;
                    const sensitive = this.isSensitiveSettingField(f);
                    if ((sensitive && contains.apiKeys) || (!sensitive && contains.settings)) merged[f] = fromFile[f];
                });
                localStorage.setItem('family_settings', JSON.stringify(merged));
            }
            if (contains.data && images) {
                await ImageStore.importImages(images);
            }
        } catch (e) {
            console.error('Lỗi khi khôi phục, đang hoàn tác:', e);
            rollback();
            if (oldImages) { try { await ImageStore.importImages(oldImages); } catch (e2) { /* bỏ qua */ } }
            const quota = e && (e.name === 'QuotaExceededError' || /quota/i.test(String(e.message)));
            throw new Error(quota
                ? 'Không đủ dung lượng lưu trữ trên máy để khôi phục. Dữ liệu cũ của bạn vẫn được giữ nguyên.'
                : 'Khôi phục thất bại, dữ liệu cũ của bạn vẫn được giữ nguyên. (' + (e && e.message ? e.message : e) + ')');
        }

        return contains;
    },

    // ---- WIPE ALL DATA (KEEP SETTINGS) ----
    wipeAllDataKeepSettings() {
        const settings = localStorage.getItem('family_settings');
        localStorage.clear();
        if (settings) {
            localStorage.setItem('family_settings', settings);
        }
        if (typeof ImageStore !== 'undefined' && ImageStore.db) {
            try { ImageStore.db.close(); } catch (e) {}
            ImageStore.db = null;
        }
        indexedDB.deleteDatabase(ImageStore.dbName);
    }
};

// ---- IMAGE STORE (IndexedDB) ----
const ImageStore = {
    dbName: 'MedicalRecordImagesDB',
    storeName: 'images',
    db: null,

    init() {
        return new Promise((resolve, reject) => {
            if (this.db) { resolve(this.db); return; }
            const request = indexedDB.open(this.dbName, 1);
            request.onerror = (e) => reject(e.target.error);
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(this.db);
            };
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
        });
    },

    async saveImage(base64) {
        await this.init();
        return new Promise((resolve, reject) => {
            const id = 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put({ id: id, data: base64 });
            request.onsuccess = () => resolve(id);
            request.onerror = (e) => reject(e.target.error);
        });
    },

    async getImage(id) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(id);
            request.onsuccess = (e) => {
                resolve(e.target.result ? e.target.result.data : null);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    },

    async deleteImage(id) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    },

    async getAllImages() {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    },

    async importImages(imagesList) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            transaction.onerror = (e) => reject(e.target.error);
            transaction.onabort = (e) => reject(e.target.error || new Error('Giao dịch ảnh bị hủy'));
            store.clear().onsuccess = () => {
                let count = 0;
                if (imagesList.length === 0) {
                    resolve();
                    return;
                }
                imagesList.forEach(img => {
                    const req = store.put(img);
                    req.onsuccess = () => {
                        count++;
                        if (count === imagesList.length) resolve();
                    };
                    req.onerror = (e) => reject(e.target.error);
                });
            };
        });
    }
};

// ---- AUTO BACKUP STORE (IndexedDB) ----
const AutoBackupStore = {
    dbName: 'MedicalRecordAutoBackupDB',
    storeName: 'autobackups',
    db: null,

    init() {
        return new Promise((resolve, reject) => {
            if (this.db) { resolve(this.db); return; }
            const request = indexedDB.open(this.dbName, 1);
            request.onerror = (e) => reject(e.target.error);
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(this.db);
            };
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
        });
    },

    async saveAutoBackup(dataObj) {
        await this.init();
        const backups = await this.getAllAutoBackups();
        
        const newBackup = {
            id: Date.now(),
            dateString: new Date().toLocaleString('vi-VN'),
            data: dataObj
        };
        
        backups.push(newBackup);
        backups.sort((a, b) => b.id - a.id); // Mới nhất lên đầu
        
        // Giữ tối đa 10 bản, xóa bản cũ
        const toDelete = backups.slice(10);
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            // Xóa cũ
            toDelete.forEach(b => store.delete(b.id));
            
            // Lưu mới
            const req = store.put(newBackup);
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e.target.error);
        });
    },

    async getAllAutoBackups() {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();
            request.onsuccess = (e) => {
                const res = e.target.result || [];
                res.sort((a, b) => b.id - a.id);
                resolve(res);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    },
    
    async getAutoBackupById(id) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(Number(id));
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    },

    async wipeAll() {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            store.clear().onsuccess = () => resolve();
        });
    }
};
