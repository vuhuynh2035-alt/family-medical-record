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
        return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
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

    // ---- SETTINGS ----
    // Các model Gemini đã ngừng hoạt động (Google decommission định kỳ ~1 năm/lần) — dùng để tự
    // động nâng cấp cho người dùng cũ đang kẹt ở model chết mà không hề biết, thay vì để họ nhận
    // lỗi khó hiểu mãi mãi. Cập nhật danh sách này nếu Google thông báo ngừng thêm model khác.
    DEPRECATED_GEMINI_MODELS: [
        'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash-8b',
        'gemini-2.0-flash', 'gemini-2.0-flash-001', 'gemini-2.0-flash-lite', 'gemini-2.0-flash-lite-001'
    ],

    getSettings() {
        const defaultSettings = {
            activeProvider: 'gemini', // kept for backwards compatibility
            providerAssessment: 'gemini',
            providerSearch: 'gemini',
            providerTrend: 'gemini',
            providerChat: 'gemini',
            // LƯU Ý: Google ngừng hỗ trợ (decommission) các model Gemini theo chu kỳ ~1 năm. Nếu
            // giá trị này báo lỗi "model không tồn tại", vào Cài đặt > bấm "Tải danh sách" để lấy
            // model còn hoạt động từ chính tài khoản của bạn thay vì sửa cứng trong mã nguồn.
            geminiModel: 'gemini-3.1-pro',
            geminiApiKey: '',
            openaiApiKey: '',
            anthropicApiKey: '',
            // Cho phép ghi đè tên model của ChatGPT/Claude (mặc định dùng model khá cũ do OpenAI/
            // Anthropic cũng thường xuyên ra bản mới) — để trống thì dùng giá trị mặc định bên dưới.
            openaiModel: '',
            anthropicModel: '',
            // Khóa màn hình bằng mã PIN (xem sha256Hex ở trên) — mặc định tắt.
            pinEnabled: false,
            pinHash: '',
            // Nhắc backup định kỳ: mốc thời gian (ms) của lần backup gần nhất, thời điểm
            // dùng ứng dụng lần đầu (để tính hạn nhắc khi chưa từng backup lần nào), và mốc
            // "tạm ẩn" nhắc nhở khi người dùng bấm "Để sau".
            lastBackupAt: null,
            firstRunAt: null,
            backupReminderSnoozeUntil: null,
            mutedMembers: [] // Mảng chứa ID của các thành viên KHÔNG đổ chuông/thông báo trên máy này
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
    getGeminiApiKey() { return this.getSettings().geminiApiKey; },
    getOpenAIApiKey() { return this.getSettings().openaiApiKey; },
    getAnthropicApiKey() { return this.getSettings().anthropicApiKey; },
    getActiveProvider() { return this.getSettings().activeProvider || 'gemini'; },
    getProviderAssessment() { return this.getSettings().providerAssessment || this.getActiveProvider(); },
    getProviderSearch() { return this.getSettings().providerSearch || this.getActiveProvider(); },
    getProviderTrend() { return this.getSettings().providerTrend || this.getActiveProvider(); },
    getProviderChat() { return this.getSettings().providerChat || this.getActiveProvider(); },
    getGeminiModel() {
        return this.getSettings().geminiModel;
    },
    // Nếu người dùng không tự nhập model riêng, dùng giá trị mặc định (có thể lỗi thời theo
    // thời gian vì OpenAI/Anthropic cũng thường xuyên ra bản mới — người dùng có thể tự ghi đè
    // trong Cài đặt khi biết tên model mới hơn).
    getOpenAIModel() { return this.getSettings().openaiModel || 'gpt-4o'; },
    getAnthropicModel() { return this.getSettings().anthropicModel || 'claude-3-5-sonnet-20240620'; },

    /**
     * Tự động nâng cấp model Gemini đã ngừng hoạt động lên model mặc định hiện tại, cho những
     * người dùng cũ đang kẹt ở 1 model chết mà không biết (trước đây mặc định là 'gemini-1.5-flash',
     * đã bị Google ngừng hỗ trợ). Chỉ chạm vào field geminiModel, không đụng gì khác.
     * @returns {boolean} true nếu vừa tự động nâng cấp (dùng để báo cho người dùng biết)
     */
    migrateDeprecatedGeminiModel() {
        const settings = this.getSettings();
        if (settings.geminiModel && this.DEPRECATED_GEMINI_MODELS.includes(settings.geminiModel)) {
            const oldModel = settings.geminiModel;
            this.saveSettings({ geminiModel: 'gemini-3.1-pro' });
            console.warn(`Model Gemini "${oldModel}" đã ngừng hoạt động — đã tự động chuyển sang "gemini-3.1-pro".`);
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
        return stored ? JSON.parse(stored) : [];
    },
    saveReminder(reminderData) {
        let reminders = this.getReminders();
        if (reminderData.id) {
            const index = reminders.findIndex(r => r.id === reminderData.id);
            if (index > -1) {
                reminders[index] = { ...reminders[index], ...reminderData };
            }
        } else {
            reminderData.id = this.generateId();
            reminderData.notified = false; // Mặc định chưa thông báo
            reminders.push(reminderData);
        }
        // Sắp xếp theo ngày giờ tăng dần (gần nhất lên trên)
        reminders.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
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
            const key = `${r.memberId}_${r.title}_${r.date || ''}_${r.time || ''}`;
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
    async exportData() {
        const data = {
            localStorage: {},
            indexedDB: {
                images: []
            }
        };

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('family_')) {
                data.localStorage[key] = localStorage.getItem(key);
            }
        }

        try {
            data.indexedDB.images = await ImageStore.getAllImages();
        } catch (e) {
            console.error("Error exporting images", e);
        }

        return JSON.stringify(data);
    },

    async importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('family_')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));

            if (data.localStorage) {
                for (const key in data.localStorage) {
                    localStorage.setItem(key, data.localStorage[key]);
                }
            }

            if (data.indexedDB && data.indexedDB.images) {
                await ImageStore.importImages(data.indexedDB.images);
            }

            return true;
        } catch (e) {
            console.error("Lỗi khi nạp dữ liệu:", e);
            alert("File không hợp lệ hoặc bị lỗi.");
            return false;
        }
    },

    // ---- WIPE ALL DATA (KEEP SETTINGS) ----
    wipeAllDataKeepSettings() {
        const settings = localStorage.getItem('family_settings');
        localStorage.clear();
        if (settings) {
            localStorage.setItem('family_settings', settings);
        }
        // IndexedDB is managed by ImageStore, we can clear it by deleting the database or clearing the store.
        // For simplicity, we just delete the database entirely and it will be recreated on next reload.
        indexedDB.deleteDatabase("FamilyMedicalDB");
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
            const id = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
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
