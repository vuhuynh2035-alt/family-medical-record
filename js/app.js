let currentMemberId = null;
let currentRecords = [];
let deferredPrompt;
let cropper = null;

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
    checkReminders();
    
    const btnUpdateApp = document.getElementById('btn-update-app');
    if (btnUpdateApp) {
        btnUpdateApp.addEventListener('click', () => {
            if (newWorker) {
                newWorker.postMessage('SKIP_WAITING');
            }
        });
    }
    
    // Load Settings
    const settings = DataManager.getSettings();
    if (settings.geminiApiKey) document.getElementById('input-api-key').value = settings.geminiApiKey;
    if (settings.openaiApiKey) document.getElementById('input-openai-key').value = settings.openaiApiKey;
    if (settings.anthropicApiKey) document.getElementById('input-anthropic-key').value = settings.anthropicApiKey;
    if (settings.activeProvider) document.getElementById('input-ai-provider').value = settings.activeProvider;
    if (settings.geminiModel) document.getElementById('input-gemini-model').value = settings.geminiModel;
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
            let exists = Array.from(select.options).some(opt => opt.value === settings.geminiModel);
            if (!exists) {
                const opt = document.createElement('option');
                opt.value = settings.geminiModel;
                opt.innerText = settings.geminiModel;
                select.appendChild(opt);
            }
            select.value = settings.geminiModel;
        }
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
            
            alert(`Đã tải thành công ${foundCount} mô hình AI hỗ trợ sinh văn bản từ tài khoản của bạn!`);
        } catch (e) {
            alert('Lỗi: ' + e.message);
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
        
        DataManager.saveSettings({ 
            geminiApiKey: geminiKey,
            openaiApiKey: openaiKey,
            anthropicApiKey: anthropicKey,
            activeProvider: provider,
            geminiModel: geminiModel
        });
        
        closeModal('modal-settings');
        alert("Đã lưu Cấu hình Đa AI.");
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
        document.getElementById('member-avatar-preview').src = 'assets/default-avatar.png';
        document.getElementById('modal-member-title').innerText = 'Thêm thành viên';
        document.getElementById('custom-fields-container').innerHTML = ''; // Clear custom fields
        
        document.getElementById('member-dob-full').classList.remove('hidden');
        document.getElementById('member-dob-year').classList.add('hidden');
        document.getElementById('toggle-dob-type').innerText = 'Chỉ nhập Năm';
        
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
            <button type="button" class="icon-btn neumorphic-btn danger btn-remove-custom-field" style="padding: 10px;"><span class="material-symbols-rounded">delete</span></button>
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
            document.getElementById('member-avatar-preview').src = member.avatar || 'assets/default-avatar.png';
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
                        <button type="button" class="icon-btn neumorphic-btn danger btn-remove-custom-field" style="padding: 10px;"><span class="material-symbols-rounded">delete</span></button>
                    `;
                    container.appendChild(fieldRow);
                    fieldRow.querySelector('.btn-remove-custom-field').addEventListener('click', () => {
                        fieldRow.remove();
                    });
                });
            }

            openModal('modal-member');
        }
    });

    document.getElementById('btn-delete-member').addEventListener('click', async () => {
        if (confirm("Bạn có chắc chắn muốn xóa thành viên này và toàn bộ hồ sơ khám bệnh liên quan?")) {
            const records = DataManager.getRecordsByMemberId(currentMemberId);
            for (let record of records) {
                const images = record.originalImages || (record.originalImage ? [record.originalImage] : []);
                for (let imgId of images) {
                    if (imgId.startsWith('img_')) await ImageStore.deleteImage(imgId);
                }
            }
            DataManager.deleteMember(currentMemberId);
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
        if(document.getElementById('btn-trigger-ocr')) {
            document.getElementById('btn-trigger-ocr').disabled = true;
        }
        
        if(document.getElementById('btn-trigger-report')) {
            document.getElementById('btn-trigger-report').disabled = true;
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
            if(k) {
                dynamicFields.push({ key: k, value: v });
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
                                const base64 = await ImageStore.getImage(imgData);
                                addImageToPreview(base64, imgData);
                            } else {
                                addImageToPreview(imgData); // Legacy base64
                            }
                        }
                    } else {
                        container.style.display = 'none';
                        if(document.getElementById('btn-process-ai')) {
                            document.getElementById('btn-process-ai').disabled = true;
                        }
                    }
                }
                
                document.getElementById('dynamic-fields-container').innerHTML = '';
                if (record.dynamicFields && record.dynamicFields.length > 0) {
                    record.dynamicFields.forEach(f => {
                        addDynamicFieldRow(f.key, f.value);
                    });
                }
                
                document.getElementById('btn-delete-record-modal').classList.remove('hidden');
                document.getElementById('btn-delete-record-modal').dataset.id = record.id;
                
                openModal('modal-record');
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
                document.querySelector('#modal-ai-assessment .modal-header h3').innerHTML = `<span class="material-symbols-rounded ai-sparkle">psychiatry</span> AI Nhận xét tình trạng`;
                openModal('modal-ai-assessment');
                const loading = document.getElementById('ai-assessment-loading');
                const content = document.getElementById('ai-assessment-content');
                loading.classList.remove('hidden');
                content.innerHTML = '';
                
                try {
                    const mdText = await AIService.generateHealthAssessment(record, member);
                    content.innerHTML = marked.parse(mdText);
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
            
            document.querySelector('#modal-ai-assessment .modal-header h3').innerHTML = `<span class="material-symbols-rounded ai-sparkle">travel_explore</span> Tra cứu chuyên sâu`;
            openModal('modal-ai-assessment');
            const loading = document.getElementById('ai-assessment-loading');
            const content = document.getElementById('ai-assessment-content');
            loading.classList.remove('hidden');
            content.innerHTML = `<p style="text-align:center; color: var(--text-muted); margin-top: 10px;">Đang tra cứu chuyên sâu về "${disease}"... Xin vui lòng chờ.</p>`;
            
            try {
                const aiResult = await AIService.searchDiseaseInfo(disease);
                loading.classList.add('hidden');
                content.innerHTML = marked.parse(aiResult);
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
            const btnAutofill = document.getElementById('btn-autofill-info');
            const btnGenerate = document.getElementById('btn-generate-report');
            const originalAutofillText = btnAutofill.innerHTML;
            const originalGenerateText = btnGenerate.innerHTML;
            const total = e.target.files.length;
            
            btnAutofill.innerHTML = `<span class="material-symbols-rounded" style="vertical-align: middle;">hourglass_empty</span> Đang tải... 0%`;
            btnAutofill.disabled = true;
            btnGenerate.disabled = true;
            
            for (let i = 0; i < total; i++) {
                try {
                    const base64 = await DataManager.fileToBase64(e.target.files[i]);
                    if (base64) {
                        addImageToPreview(base64);
                    }
                } catch (err) {
                    console.error("Lỗi khi tải ảnh:", err);
                }
                const percent = Math.round(((i + 1) / total) * 100);
                btnAutofill.innerHTML = `<span class="material-symbols-rounded" style="vertical-align: middle;">hourglass_empty</span> Đang tải... ${percent}%`;
                await new Promise(r => setTimeout(r, 50)); // Force DOM repaint
            }
            btnAutofill.disabled = false;
            btnGenerate.disabled = false;
            e.target.value = '';
            
            setTimeout(() => {
                btnAutofill.innerHTML = originalAutofillText;
            }, 500);
        }
    });

    // 1. Tự động điền form (Autofill Info)
    document.getElementById('btn-autofill-info').addEventListener('click', async (e) => {
        e.preventDefault();
        const imgs = document.querySelectorAll('#ocr-preview-container img');
        if (imgs.length === 0) return;
        
        const base64Images = Array.from(imgs).map(img => img.dataset.pdfData || img.src);
        
        if (!DataManager.getGeminiApiKey()) {
            alert("Vui lòng vào cài đặt nhập API Key của Gemini trước!");
            return;
        }

        const btn = document.getElementById('btn-autofill-info');
        const loading = document.getElementById('ocr-loading');
        const loadingText = document.getElementById('ocr-loading-text');
        const loadingPercent = document.getElementById('ocr-loading-percent');
        const loadingBar = document.getElementById('ocr-loading-bar');
        
        btn.disabled = true;
        document.getElementById('btn-generate-report').disabled = true;
        loading.classList.remove('hidden');
        loadingBar.style.width = '0%';
        loadingPercent.innerText = '0%';
        loadingText.innerText = `Đang trích xuất dữ liệu form...`;

        let progress = 0;
        const progressInterval = setInterval(() => {
            if (progress < 95) {
                progress += Math.random() * 10;
                if (progress > 95) progress = 95;
                loadingBar.style.width = progress + '%';
                loadingPercent.innerText = Math.round(progress) + '%';
            }
        }, 500);

        try {
            const data = await AIService.extractDataFromImage(base64Images);
            
            clearInterval(progressInterval);
            loadingBar.style.width = '100%';
            loadingPercent.innerText = '100%';
            loadingText.innerText = 'Hoàn tất điền form!';
            
            await new Promise(r => setTimeout(r, 600)); 
            
            if (data.date) document.getElementById('record-date').value = data.date;
            if (data.hospital) document.getElementById('record-hospital').value = data.hospital;
            if (data.doctor) document.getElementById('record-doctor').value = data.doctor;
            if (data.disease) document.getElementById('record-disease').value = data.disease;
            if (data.treatment) document.getElementById('record-treatment').value = data.treatment;
            if (data.cost !== undefined) document.getElementById('record-cost').value = data.cost;
            if (data.type) {
                const sel = document.getElementById('record-type');
                for (let i = 0; i < sel.options.length; i++) {
                    if (sel.options[i].value === data.type) sel.selectedIndex = i;
                }
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
                    addDynamicFieldRow(f.key, f.value);
                });
            }
            alert("Đã điền thông tin form thành công!");
        } catch (err) {
            clearInterval(progressInterval);
            loadingBar.style.width = '0%';
            loadingPercent.innerText = 'Lỗi';
            loadingText.innerText = 'Trích xuất thất bại';
            alert(err.message);
        } finally {
            btn.disabled = false;
            document.getElementById('btn-generate-report').disabled = false;
            setTimeout(() => { loading.classList.add('hidden'); }, 3000);
        }
    });

    // 2. Kết luận & Phân tích (Generate Report)
    document.getElementById('btn-generate-report').addEventListener('click', async (e) => {
        e.preventDefault();
        const imgs = document.querySelectorAll('#ocr-preview-container img');
        if (imgs.length === 0) return;
        const base64Images = Array.from(imgs).map(img => img.dataset.pdfData || img.src);
        
        const selectedModel = document.getElementById('select-report-ai').value;
        const btnGenerate = document.getElementById('btn-generate-report');
        const btnAutofill = document.getElementById('btn-autofill-info');
        const loading = document.getElementById('ocr-loading');
        const loadingText = document.getElementById('ocr-loading-text');
        const loadingPercent = document.getElementById('ocr-loading-percent');
        const loadingBar = document.getElementById('ocr-loading-bar');

        btnGenerate.disabled = true;
        btnAutofill.disabled = true;
        loading.classList.remove('hidden');
        loadingBar.style.width = '0%';
        loadingPercent.innerText = '0%';
        loadingText.innerText = `Đang kết nối ${selectedModel} để phân tích...`;
        
        let progress = 0;
        const progressInterval = setInterval(() => {
            if (progress < 90) {
                progress += Math.random() * 5;
                if (progress > 90) progress = 90;
                loadingBar.style.width = progress + '%';
                loadingPercent.innerText = Math.round(progress) + '%';
            }
        }, 1000);
        
        try {
            const reportMarkdown = await AIService.generateComprehensiveReport(base64Images, selectedModel);
            
            clearInterval(progressInterval);
            loadingBar.style.width = '100%';
            loadingPercent.innerText = '100%';
            loadingText.innerText = 'Hoàn tất phân tích!';
            
            // Lưu vào form
            document.getElementById('record-comprehensive-report-data').value = reportMarkdown;
            document.getElementById('btn-view-ai-report').classList.remove('hidden');
            
            // Mở trực tiếp trình xem
            const preview = document.getElementById('report-preview-mode');
            const editor = document.getElementById('report-edit-mode');
            preview.innerHTML = marked.parse(reportMarkdown);
            editor.value = reportMarkdown;
            preview.classList.remove('hidden');
            editor.classList.add('hidden');
            document.getElementById('btn-save-report-editor').classList.add('hidden');
            openModal('modal-ai-report-editor');
            
        } catch (err) {
            clearInterval(progressInterval);
            loadingBar.style.width = '0%';
            loadingPercent.innerText = 'Lỗi';
            loadingText.innerText = 'Phân tích thất bại';
            alert("Lỗi khi tạo báo cáo: " + err.message);
        } finally {
            btnGenerate.disabled = false;
            btnAutofill.disabled = false;
            setTimeout(() => { loading.classList.add('hidden'); }, 3000);
        }
    });

    document.getElementById('btn-download-pdf').addEventListener('click', () => {
        const element = document.getElementById('report-preview-mode');
        const opt = {
            margin:       0.5,
            filename:     'Bao_Cao_Y_Khoa.pdf',
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
        
        preview.innerHTML = marked.parse(reportData || '*Chưa có báo cáo nào.*');
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
            preview.innerHTML = marked.parse(editor.value || '*Chưa có báo cáo nào.*');
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
        openModal('modal-reminder');
    });

    // Dynamic Fields Logic
    document.getElementById('btn-add-dynamic-field').addEventListener('click', () => {
        addDynamicFieldRow();
    });

    document.getElementById('form-reminder').addEventListener('submit', (e) => {
        e.preventDefault();
        const rmData = {
            id: document.getElementById('reminder-id').value,
            memberId: currentMemberId,
            title: document.getElementById('reminder-title').value,
            date: document.getElementById('reminder-date').value,
            time: document.getElementById('reminder-time').value,
            note: document.getElementById('reminder-note').value,
            datetime: `${document.getElementById('reminder-date').value}T${document.getElementById('reminder-time').value}`
        };
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
            document.getElementById('btn-trigger-ocr').disabled = true;
            container.style.display = 'none';
        }
    };
    
    wrapper.appendChild(img);
    wrapper.appendChild(delBtn);
    container.appendChild(wrapper);
    container.style.display = 'flex';
    document.getElementById('btn-trigger-ocr').disabled = false;
}

function openModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
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

function addDynamicFieldRow(key = '', value = '') {
    const container = document.getElementById('dynamic-fields-container');
    const row = document.createElement('div');
    row.className = 'form-group-row dynamic-field-row';
    row.style.alignItems = 'center';
    row.innerHTML = `
        <div class="form-group" style="flex: 1; margin-bottom: 0;">
            <input type="text" class="neumorphic-input dynamic-field-key" placeholder="Tên chỉ số (vd: Glucose)" value="${key}">
        </div>
        <div class="form-group" style="flex: 1; margin-bottom: 0;">
            <input type="text" class="neumorphic-input dynamic-field-value" placeholder="Kết quả (vd: 5.5 mmol/L)" value="${value}">
        </div>
        <button type="button" class="icon-btn danger btn-remove-dynamic-field" style="padding: 10px; margin-top: 5px;">
            <span class="material-symbols-rounded">delete</span>
        </button>
    `;
    
    row.querySelector('.btn-remove-dynamic-field').addEventListener('click', () => {
        row.remove();
    });
    
    container.appendChild(row);
}

function reloadRecordsAndStats() {
    currentRecords = DataManager.getRecords(currentMemberId);
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
            (r.treatment && r.treatment.toLowerCase().includes(q))
        );
    }
    if (type !== 'all') {
        filtered = filtered.filter(r => r.type === type);
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
