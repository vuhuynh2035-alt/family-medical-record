// Cấu trúc lưu trữ dữ liệu trong LocalStorage
// 'family_members': [{ id, name, dob, blood, conditions, avatar }]
// 'family_records_m_{id}': [{ id, date, hospital, type, doctor, disease, cost, treatment, originalImage, aiAssessment }]
// 'settings': { geminiApiKey: '' }

const DataManager = {
    // ---- UTILS ----
    generateId() {
        return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    },

    // ---- SETTINGS ----
    getSettings() {
        const defaultSettings = { 
            activeProvider: 'gemini', 
            geminiModel: 'gemini-1.5-flash',
            geminiApiKey: '', 
            openaiApiKey: '', 
            anthropicApiKey: '' 
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
    getGeminiModel() { 
        return this.getSettings().geminiModel;
    },

    // ---- SEED MOCK DATA ----
    forceSeedMockData() {
        const m1 = this.generateId();
        const m2 = this.generateId();
        const m3 = this.generateId();
        const m4 = this.generateId();
        const m5 = this.generateId();
        const m6 = this.generateId();

        const mockMembers = [
            { id: m1, name: 'Ba', nickname: 'Bố', dob: '1965', blood: 'A+', height: '175', weight: '70', conditions: 'Cao huyết áp vô căn (2 năm)', avatar: 'https://ui-avatars.com/api/?name=Ba&background=random' },
            { id: m2, name: 'Mẹ', nickname: 'Mẹ', dob: '1968', blood: 'O+', height: '158', weight: '55', conditions: 'Không có ghi nhận', avatar: 'https://ui-avatars.com/api/?name=Me&background=random' },
            { id: m3, name: 'Anh trai', nickname: 'Anh Hai', dob: '1990', blood: 'B+', height: '180', weight: '75', conditions: 'Không', avatar: 'https://ui-avatars.com/api/?name=Anh+Trai&background=random' },
            { id: m4, name: 'Tôi', nickname: 'Tôi', dob: '1995', blood: 'O+', height: '172', weight: '68', conditions: 'Đau dạ dày nhẹ', avatar: 'https://ui-avatars.com/api/?name=Toi&background=random' },
            { id: m5, name: 'Em trai', nickname: 'Út nam', dob: '1998', blood: 'AB+', height: '176', weight: '65', conditions: 'Không', avatar: 'https://ui-avatars.com/api/?name=Em+Trai&background=random' },
            { id: m6, name: 'Em gái', nickname: 'Út nữ', dob: '2000', blood: 'A+', height: '162', weight: '48', conditions: 'Dị ứng hải sản', avatar: 'https://ui-avatars.com/api/?name=Em+Gai&background=random' }
        ];

        let members = this.getMembers();
        members = members.concat(mockMembers);
        localStorage.setItem('family_members', JSON.stringify(members));

        const hospitals = ['Bệnh viện Chợ Rẫy', 'Bệnh viện FV', 'Phòng khám Đa khoa Quốc tế', 'Bệnh viện Y Dược', 'Bệnh viện Nhi Đồng', 'Bệnh viện Da Liễu'];
        const types = ['routine', 'mild', 'severe', 'chronic'];
        const diseases = ['Cảm cúm', 'Viêm họng', 'Khám tổng quát', 'Đau dạ dày', 'Tăng huyết áp', 'Tiểu đường', 'Viêm da dị ứng', 'Trào ngược dạ dày', 'Đau mỏi vai gáy', 'Khám sức khỏe định kỳ'];
        
        const generateRandomDate = () => {
            const start = new Date(2024, 0, 1).getTime();
            const end = new Date(2026, 11, 31).getTime();
            const date = new Date(start + Math.random() * (end - start));
            return date.toISOString().split('T')[0];
        };

        mockMembers.forEach(member => {
            const records = [];
            for (let i = 0; i < 10; i++) {
                records.push({
                    id: this.generateId() + i,
                    date: generateRandomDate(),
                    hospital: hospitals[Math.floor(Math.random() * hospitals.length)],
                    type: types[Math.floor(Math.random() * types.length)],
                    doctor: 'BS. ' + ['Nguyễn', 'Trần', 'Lê', 'Phạm'][Math.floor(Math.random() * 4)] + ' ' + ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)],
                    disease: diseases[Math.floor(Math.random() * diseases.length)],
                    cost: (Math.floor(Math.random() * 20) + 5) * 100000 + "",
                    treatment: 'Uống thuốc theo toa. Nghỉ ngơi tĩnh dưỡng.',
                    bp: '120/80', hr: Math.floor(Math.random() * 20) + 70, temp: 37, spo2: 98,
                    symptoms: 'Bệnh nhân có triệu chứng cần theo dõi.',
                    labs: 'Xét nghiệm máu và nước tiểu trong giới hạn bình thường.',
                    note: 'Ăn uống khoa học, tập thể dục thường xuyên.',
                    dynamicFields: [
                        { key: "Chỉ số xét nghiệm ngẫu nhiên", value: (Math.random() * 10).toFixed(1) + " mg/dL" }
                    ]
                });
            }
            // Sắp xếp hồ sơ theo ngày (mới nhất lên trên)
            records.sort((a, b) => new Date(b.date) - new Date(a.date));
            localStorage.setItem(`family_records_m_${member.id}`, JSON.stringify(records));
        });
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
        return memberData;
    },
    deleteMember(id) {
        let members = this.getMembers();
        members = members.filter(m => m.id !== id);
        localStorage.setItem('family_members', JSON.stringify(members));
        // Xóa luôn hồ sơ của người này
        localStorage.removeItem(`family_records_m_${id}`);
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
        return recordData;
    },
    deleteRecord(memberId, recordId) {
        let records = this.getRecords(memberId);
        records = records.filter(r => r.id !== recordId);
        localStorage.setItem(`family_records_m_${memberId}`, JSON.stringify(records));
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

    // ---- IMAGE UTILS ----
    // Helper to read file as Base64 for avatar / OCR image
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
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
            console.error("Import failed:", e);
            throw new Error("Dữ liệu không hợp lệ hoặc bị lỗi.");
        }
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
