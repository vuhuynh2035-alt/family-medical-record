/**
 * UI — tập hợp các hàm hiển thị (render) và tiện ích định dạng dùng chung cho toàn bộ ứng dụng.
 * Quy ước: mọi dữ liệu do người dùng nhập (tên, ghi chú, chẩn đoán...) phải đi qua
 * `UI.escapeHtml()` trước khi được chèn vào chuỗi HTML bằng template literal, để tránh
 * lỗi hiển thị vỡ layout hoặc chèn mã HTML/script không mong muốn (XSS lưu trữ).
 * Nội dung do AI trả về (định dạng Markdown) phải đi qua `UI.renderMarkdown()` thay vì
 * gọi `marked.parse()` trực tiếp, vì hàm này khử trùng (sanitize) kết quả bằng DOMPurify.
 */
const UI = {
    // ==================== TIỆN ÍCH CHUNG ====================

    /**
     * Chuyển các ký tự đặc biệt HTML thành entity tương ứng để chèn an toàn vào innerHTML.
     * @param {*} value - giá trị bất kỳ (sẽ được ép kiểu chuỗi)
     * @returns {string}
     */
    escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    /**
     * Escape HTML rồi chuyển ký tự xuống dòng thành thẻ <br>.
     * Hỗ trợ cả xuống dòng thật (\n, từ textarea) lẫn chuỗi "\n" hai ký tự
     * (đôi khi xuất hiện trong dữ liệu do AI trả về dưới dạng JSON string).
     * @param {string} text
     * @returns {string}
     */
    nl2br(text) {
        if (!text) return '';
        return this.escapeHtml(text)
            .replace(/\\n/g, '\n')
            .replace(/\r\n|\r|\n/g, '<br>');
    },

    /**
     * Render Markdown (từ AI) thành HTML đã được khử trùng (sanitize) bằng DOMPurify.
     * Luôn dùng hàm này thay vì gọi marked.parse() trực tiếp khi chèn vào innerHTML.
     * @param {string} text - nội dung Markdown
     * @returns {string} HTML an toàn để gán vào innerHTML
     */
    renderMarkdown(text) {
        if (!text) return '';
        let raw;
        if (typeof marked !== 'undefined') {
            raw = marked.parse(text);
        } else {
            console.warn('Thư viện marked chưa tải được — hiển thị văn bản thô.');
            raw = this.nl2br(text);
        }
        if (typeof DOMPurify !== 'undefined') {
            return DOMPurify.sanitize(raw);
        }
        console.warn('Thư viện DOMPurify chưa tải được — nội dung AI KHÔNG được khử trùng trước khi hiển thị.');
        return raw;
    },

    /**
     * Trả về URL ảnh đại diện: dùng ảnh đã lưu nếu có, nếu không thì tạo ảnh chữ cái
     * đầu tự động (thay cho đường dẫn cục bộ 'assets/default-avatar.png' vốn không tồn tại
     * trong dự án, gây lỗi ảnh vỡ trước đây).
     * @param {{name?: string, nickname?: string, avatar?: string}|null} member
     * @returns {string}
     */
    getAvatarUrl(member) {
        if (member && member.avatar) return member.avatar;
        const label = (member && (member.nickname || member.name)) || '?';
        return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(label) + '&background=random';
    },

    /**
     * Copy thuộc tính title -> aria-label cho các phần tử chưa có aria-label, để hỗ trợ
     * trình đọc màn hình (screen reader) hiểu được các nút chỉ có icon, không có chữ.
     * @param {ParentNode} [scope] - phạm vi tìm kiếm, mặc định toàn bộ document
     */
    enhanceA11y(scope) {
        (scope || document).querySelectorAll('[title]:not([aria-label])').forEach(el => {
            el.setAttribute('aria-label', el.getAttribute('title'));
        });
    },

    /**
     * Điền danh sách <option> cho một <datalist>.
     * @param {string} id - id của phần tử <datalist>
     * @param {string[]} values
     */
    populateDatalist(id, values) {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = '';
        values.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            el.appendChild(opt);
        });
    },

    // ==================== ĐỊNH DẠNG ====================

    formatDate(dateString) {
        if (!dateString) return "";
        const parts = dateString.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateString;
    },
    formatCurrency(amount) {
        if (!amount) return "0 VNĐ";
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    },

    /**
     * Ước tính tuổi từ ngày sinh (member.dob). Hỗ trợ cả 2 định dạng đang được lưu:
     * - "dd/mm/yyyy" (khi người dùng nhập ngày sinh đầy đủ)
     * - "yyyy" (khi người dùng chỉ nhập năm sinh, chế độ "Chỉ nhập Năm")
     * @param {string} dob
     * @returns {{label: string}|null} null nếu không có/không đọc được ngày sinh
     */
    calculateAge(dob) {
        if (!dob) return null;

        // Chỉ có năm sinh -> chỉ ước tính theo năm, không tính chính xác theo ngày/tháng
        if (/^\d{4}$/.test(dob)) {
            const years = new Date().getFullYear() - parseInt(dob, 10);
            if (isNaN(years) || years < 0 || years > 130) return null;
            return { label: `~${years} tuổi` };
        }

        let birthDate;
        if (dob.includes('/')) {
            const [dd, mm, yyyy] = dob.split('/');
            birthDate = new Date(`${yyyy}-${mm}-${dd}`);
        } else {
            birthDate = new Date(dob);
        }
        if (isNaN(birthDate.getTime())) return null;

        const today = new Date();
        let years = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            years--;
        }
        if (years < 0 || years > 130) return null;
        return { label: `${years} tuổi` };
    },

    /**
     * Chuẩn hoá & phân loại "Loại khám" (type) thành nhãn hiển thị + màu sắc.
     * Nhận diện các giá trị cũ/hệ thống (routine/mild/severe/chronic...) lẫn các giá trị
     * tự do người dùng/AI nhập vào, sinh màu ổn định theo hash cho các loại chưa biết.
     */
    getTypeInfo(type) {
        if (!type) return { text: 'Chưa phân loại', style: 'background: #f5f5f5; color: #7f8c8d;' };

        // Handle legacy/standard strings
        const typeLower = type.toLowerCase().trim();
        if (typeLower === 'routine' || typeLower === 'khám sức khỏe tổng quát' || typeLower === 'định kỳ')
            return { text: 'Khám sức khỏe tổng quát', style: 'background: #e1f5fe; color: #0277bd;' };
        if (typeLower === 'mild' || typeLower === 'bệnh lý cấp tính (nhẹ)' || typeLower === 'nhẹ')
            return { text: 'Bệnh lý cấp tính (Nhẹ)', style: 'background: #f1f8e9; color: #33691e;' };
        if (typeLower === 'severe' || typeLower === 'bệnh lý cấp tính (nặng)' || typeLower === 'nặng')
            return { text: 'Bệnh lý cấp tính (Nặng/Cấp cứu)', style: 'background: #fbe9e7; color: #bf360c;' };
        if (typeLower === 'chronic' || typeLower === 'bệnh lý mạn tính' || typeLower === 'mãn tính')
            return { text: 'Bệnh lý mạn tính', style: 'background: #f3e5f5; color: #4a148c;' };

        // Dynamic types
        const hue = this._hashHue(type);
        return {
            text: type,
            style: `background: hsla(${hue}, 70%, 90%, 1); color: hsl(${hue}, 80%, 30%);`
        };
    },

    /** Trả về một mã màu đặc (solid) ổn định ứng với một nhãn "Loại khám", dùng cho biểu đồ cột. */
    getTypeColor(type) {
        const known = {
            'Khám sức khỏe tổng quát': '#0277bd',
            'Bệnh lý cấp tính (Nhẹ)': '#33691e',
            'Bệnh lý cấp tính (Nặng/Cấp cứu)': '#bf360c',
            'Bệnh lý mạn tính': '#4a148c',
            'Chưa phân loại': '#7f8c8d'
        };
        const label = this.getTypeInfo(type).text;
        if (known[label]) return known[label];
        return `hsl(${this._hashHue(label)}, 65%, 42%)`;
    },

    _hashHue(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return Math.abs(hash) % 360;
    },

    // ==================== 1. Render Members Dashboard ====================
    renderMembersList(members) {
        const grid = document.getElementById('members-grid');
        grid.innerHTML = '';

        if (members.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">
                <span class="material-symbols-rounded" style="font-size: 48px; margin-bottom: 10px; display: block;">group</span>
                Chưa có thành viên nào. Hãy thêm thành viên mới!
            </div>`;
            return;
        }

        members.forEach(member => {
            const records = DataManager.getRecords(member.id);
            const totalRecords = records.length;
            const lastVisit = records.length > 0 ? this.formatDate(records[0].date) : 'Chưa khám';

            const card = document.createElement('div');
            card.className = 'member-card';
            card.dataset.id = member.id;
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            const displayNameRaw = member.nickname ? member.nickname : member.name;
            const displayName = this.escapeHtml(displayNameRaw);
            card.setAttribute('aria-label', `Xem hồ sơ của ${displayNameRaw}`);
            card.innerHTML = `
                <img src="${this.escapeHtml(this.getAvatarUrl(member))}" alt="${displayName}" class="member-avatar">
                <h3>${displayName}</h3>
                <div class="member-stats">
                    <span class="stat-badge">${totalRecords} hồ sơ</span>
                    <span class="stat-badge">${this.escapeHtml(lastVisit)}</span>
                </div>
            `;
            grid.appendChild(card);
        });

        this.enhanceA11y(grid);
    },

    // ==================== 2. Render Member Profile ====================
    renderMemberProfile(member) {
        const profileContainer = document.getElementById('tab-profile');

        let customFieldsHTML = '';
        if (member.customFields && member.customFields.length > 0) {
            member.customFields.forEach(field => {
                customFieldsHTML += `
                <div class="profile-item">
                    <label>${this.escapeHtml(field.key)}</label>
                    <p>${this.escapeHtml(field.value)}</p>
                </div>
                `;
            });
        }

        const ageInfo = this.calculateAge(member.dob);

        profileContainer.innerHTML = `
            <div class="profile-grid">
                <div class="profile-item">
                    <label>Họ và Tên</label>
                    <p>${this.escapeHtml(member.name)}</p>
                </div>
                <div class="profile-item">
                    <label>Ngày sinh / Năm sinh</label>
                    <p>${this.escapeHtml(this.formatDate(member.dob))}</p>
                </div>
                <div class="profile-item">
                    <label>Số tuổi</label>
                    <p>${ageInfo ? this.escapeHtml(ageInfo.label) : 'Chưa xác định'}</p>
                </div>
                <div class="profile-item">
                    <label>Nhóm máu</label>
                    <p>${this.escapeHtml(member.blood) || 'Chưa cập nhật'}</p>
                </div>
                <div class="profile-item">
                    <label>Chiều cao / Cân nặng</label>
                    <p>${member.height ? this.escapeHtml(member.height) + ' cm' : '--'} / ${member.weight ? this.escapeHtml(member.weight) + ' kg' : '--'}</p>
                </div>
                ${customFieldsHTML}
                <div class="profile-item">
                    <label>Tiền sử bệnh / Dị ứng</label>
                    <p>${this.escapeHtml(member.conditions) || 'Không có ghi nhận'}</p>
                </div>
            </div>
        `;
    },

    // ==================== 3. Render Records List ====================
    renderRecordsList(records) {
        const list = document.getElementById('records-list');
        list.innerHTML = '';

        if (records.length === 0) {
            list.innerHTML = `<div style="text-align: center; color: var(--text-muted); margin-top: 30px;">
                Chưa có hồ sơ khám bệnh nào.
            </div>`;
            return;
        }

        records.forEach(record => {
            const images = record.originalImages || (record.originalImage ? [record.originalImage] : []);
            let imgBtn = '';
            if (images.length > 0) {
                imgBtn = `<span title="Có ${images.length} tệp đính kèm" style="color: var(--text-muted); display: flex; align-items: center; font-size: 13px; margin-right: 10px; flex-shrink: 0;"><span class="material-symbols-rounded" style="font-size: 16px; margin-right: 3px;">attach_file</span>${images.length}</span>`;
            }
            const aiBtn = `<button class="neumorphic-btn btn-ai-assessment" data-id="${this.escapeHtml(record.id)}" title="AI Phân tích tình trạng" data-help-title="Phân tích bệnh án" data-help-desc="AI sẽ đọc chi tiết hồ sơ này, giải thích các chỉ số và đưa ra lời khuyên dễ hiểu." style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px; font-size: 13px;"><span class="material-symbols-rounded ai-sparkle" style="font-size: 18px;">psychiatry</span> Phân tích AI</button>`;
            // Hồ sơ chỉ là phiếu xét nghiệm (chưa có chẩn đoán/kết luận của bác sĩ) vẫn cần tra cứu được:
            // dùng chẩn đoán nếu có, nếu không thì lùi về kết quả xét nghiệm/triệu chứng/loại khám.
            const searchQuery = (record.disease || record.labs || record.symptoms || record.type || '').trim();
            const searchBtn = searchQuery
                ? `<button class="neumorphic-btn btn-search-disease" data-disease="${this.escapeHtml(searchQuery)}" title="Tra cứu chuyên sâu về ${record.disease ? 'bệnh này' : 'kết quả này'} trên mạng" data-help-title="Tra cứu chuyên sâu" data-help-desc="Sử dụng AI để tìm kiếm thông tin chi tiết và kiến thức y khoa mở rộng về loại bệnh hoặc triệu chứng này." style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px; font-size: 13px;"><span class="material-symbols-rounded" style="color: #9b59b6; font-size: 18px;">travel_explore</span> Tra cứu</button>`
                : '';

            const el = document.createElement('div');
            el.className = 'record-item neumorphic-card';
            el.dataset.id = record.id;
            const typeInfo = this.getTypeInfo(record.type);
            el.innerHTML = `
                <div class="record-header">
                    <span class="record-date">${this.escapeHtml(this.formatDate(record.date))}</span>
                    <span class="type-badge" style="${typeInfo.style}">${this.escapeHtml(typeInfo.text)}</span>
                </div>
                <div class="record-body" style="grid-template-columns: 1fr; gap: 5px;">
                    <div class="record-detail" style="font-size: 16px;">
                        <strong>${this.escapeHtml(record.hospital)}</strong> - ${this.escapeHtml(record.disease)}
                    </div>
                    <div class="record-detail" style="color: var(--text-muted); font-size: 13px;">
                        Bác sĩ: ${this.escapeHtml(record.doctor) || 'N/A'} &nbsp;|&nbsp; Chi phí: ${this.formatCurrency(record.cost)}
                    </div>
                </div>
                <div class="record-actions" style="border-top: 1px solid rgba(0,0,0,0.05); padding-top: 10px; display: flex; gap: 10px; align-items: center;">
                    ${searchBtn}
                    ${aiBtn}
                    ${imgBtn}
                    <button class="icon-btn neumorphic-btn btn-edit-record" data-id="${this.escapeHtml(record.id)}" title="Sửa" style="flex-shrink: 0;"><span class="material-symbols-rounded">edit</span></button>
                </div>
            `;
            list.appendChild(el);
        });

        this.enhanceA11y(list);
    },

    async renderRecordDetailModal(record) {
        const typeInfo = this.getTypeInfo(record.type);
        
        // 1. Header chi tiết hồ sơ (Tối ưu co giãn, không bị chật hẹp)
        let html = `
            <div class="record-detail-header" style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 12px; border-bottom: 1px solid rgba(0,0,0,0.08); padding-bottom: 15px; margin-bottom: 18px;">
                <div style="flex: 1; min-width: 220px;">
                    <h4 style="color: var(--primary-blue); font-size: 21px; margin: 0 0 6px 0; word-break: break-word; line-height: 1.35; font-weight: 700;">${this.escapeHtml(record.hospital)}</h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 14px; font-size: 13.5px; color: var(--text-color);">
                        <span><strong>Ngày khám:</strong> ${this.escapeHtml(this.formatDate(record.date))}</span>
                        <span><strong>Bác sĩ:</strong> ${this.escapeHtml(record.doctor) || 'Chưa cập nhật'}</span>
                    </div>
                </div>
                <div style="flex-shrink: 0;">
                    <span class="type-badge" style="${typeInfo.style}; white-space: nowrap; font-size: 13px; padding: 6px 14px; display: inline-block; box-shadow: 0 2px 5px rgba(0,0,0,0.05); font-weight: 600;">${this.escapeHtml(typeInfo.text)}</span>
                </div>
            </div>
        `;

        // 2. Lưới 2 cột mở rộng chiều ngang (giảm chiều dài cuộn trang)
        html += `<div class="record-detail-grid">`;

        // --- CỘT 1: Chẩn đoán & Điều trị + Lời khuyên + Chi phí ---
        html += `
            <div class="record-detail-col-main" style="display: flex; flex-direction: column; gap: 14px;">
                <div class="detail-section-card" style="background: var(--bg-color); box-shadow: var(--shadow-inner); padding: 16px; border-radius: var(--radius-sm); border-left: 4px solid var(--primary-blue);">
                    <h4 style="color: var(--primary-blue); margin: 0 0 10px 0; font-size: 15.5px; display: flex; align-items: center; gap: 6px;">
                        <span class="material-symbols-rounded" style="font-size: 18px;">coronavirus</span> Chẩn đoán & Điều trị
                    </h4>
                    <div style="font-size: 14px; line-height: 1.6;">
                        <p style="margin: 0 0 8px 0;"><strong>Chẩn đoán:</strong> ${record.disease ? this.escapeHtml(record.disease) : '<em style="color:var(--text-muted);">(Chưa có kết luận chẩn đoán)</em>'}</p>
                        <div style="margin-bottom: 8px;">
                            <strong>Điều trị / Đơn thuốc:</strong><br>${record.treatment ? this.nl2br(record.treatment) : '<span style="color:var(--text-muted);">Không có đơn thuốc</span>'}
                            
                            ${record.treatment && !record.medicationAnalysis ? `
                            <div style="margin-top: 8px;">
                                <button type="button" class="neumorphic-btn btn-analyze-meds" data-id="${this.escapeHtml(record.id)}" style="font-size: 12px; color: #d35400; display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border: 1px solid rgba(211,84,0,0.3); background: white;">
                                    <span class="material-symbols-rounded ai-sparkle" style="font-size: 15px;">medication</span> Phân tích đơn thuốc chuyên sâu (AI)
                                </button>
                            </div>` : ''}
                            
                            ${record.medicationAnalysis ? `
                            <div style="margin-top: 10px; padding: 12px; background: rgba(211, 84, 0, 0.05); border-left: 3px solid #d35400; border-radius: 8px;">
                                <h5 style="color: #d35400; margin: 0 0 8px 0; font-size: 13.5px; display: flex; align-items: center; gap: 5px;"><span class="material-symbols-rounded" style="font-size: 16px;">medication</span> Phân tích thuốc chuyên sâu</h5>
                                <div class="markdown-body" style="font-size: 13px;">${this.renderMarkdown(record.medicationAnalysis)}</div>
                            </div>` : ''}
                        </div>
                        ${record.note ? `<p style="margin: 0 0 8px 0; color: var(--danger);"><strong>Lời khuyên:</strong> ${this.escapeHtml(record.note)}</p>` : ''}
                        <p style="margin: 0;"><strong>Chi phí:</strong> <span style="color: var(--primary-blue); font-weight: 700; font-size: 15px;">${this.formatCurrency(record.cost)}</span></p>
                    </div>
                </div>
            </div>
        `;

        // --- CỘT 2: Sinh hiệu & Lâm sàng / Cận lâm sàng / Tiêm chủng ---
        html += `
            <div class="record-detail-col-side" style="display: flex; flex-direction: column; gap: 14px;">
        `;

        if (record.bp || record.hr || record.temp || record.spo2) {
            html += `
                <div class="detail-section-card" style="background: rgba(52, 152, 219, 0.05); padding: 14px 16px; border-radius: var(--radius-sm); border-left: 4px solid var(--primary-blue);">
                    <h4 style="color: var(--primary-blue); margin: 0 0 10px 0; font-size: 15px; display: flex; align-items: center; gap: 6px;">
                        <span class="material-symbols-rounded" style="font-size: 18px;">favorite</span> Sinh hiệu (Vital Signs)
                    </h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 12px; font-size: 13.5px;">
                        ${record.bp ? `<span><strong>HA:</strong> ${this.escapeHtml(record.bp)} mmHg</span>` : ''}
                        ${record.hr ? `<span><strong>Nhịp tim:</strong> ${this.escapeHtml(record.hr)} bpm</span>` : ''}
                        ${record.temp ? `<span><strong>Nhiệt độ:</strong> ${this.escapeHtml(record.temp)}°C</span>` : ''}
                        ${record.spo2 ? `<span><strong>SpO2:</strong> ${this.escapeHtml(record.spo2)}%</span>` : ''}
                    </div>
                </div>
            `;
        }

        if (record.symptoms || record.labs) {
            html += `
                <div class="detail-section-card" style="background: rgba(142, 68, 173, 0.04); padding: 14px 16px; border-radius: var(--radius-sm); border-left: 4px solid #8e44ad;">
                    <h4 style="color: #8e44ad; margin: 0 0 10px 0; font-size: 15px; display: flex; align-items: center; gap: 6px;">
                        <span class="material-symbols-rounded" style="font-size: 18px;">biotech</span> Lâm sàng & Cận lâm sàng
                    </h4>
                    <div style="font-size: 13.5px; line-height: 1.55;">
                        ${record.symptoms ? `<p style="margin: 0 0 6px 0;"><strong>Triệu chứng:</strong><br>${this.nl2br(record.symptoms)}</p>` : ''}
                        ${record.labs ? `<p style="margin: 0;"><strong>Kết quả cận lâm sàng:</strong><br>${this.nl2br(record.labs)}</p>` : ''}
                    </div>
                </div>
            `;
        }

        // Kiểm tra thông tin tiêm chủng & phác đồ
        const isVaccineRecord = record.type === 'Tiêm chủng' || (record.type && record.type.toLowerCase().includes('tiêm')) || (typeof AIService !== 'undefined' && AIService.findVaccineInfo(record.disease || record.treatment));
        const btnVaccineGuide = document.getElementById('btn-view-vaccine-guide');
        if (btnVaccineGuide) {
            if (isVaccineRecord) {
                btnVaccineGuide.classList.remove('hidden');
                btnVaccineGuide.dataset.vaccineText = record.disease || record.treatment || 'Tiêm chủng';
                btnVaccineGuide.dataset.date = record.date || '';
            } else {
                btnVaccineGuide.classList.add('hidden');
            }
        }

        if (isVaccineRecord && typeof AIService !== 'undefined') {
            const vInfo = AIService.calculateNextVaccineDose(record.disease || record.treatment || record.symptoms || '', record.date);
            if (vInfo) {
                html += `
                <div class="vaccine-detail-card detail-section-card" style="background: linear-gradient(135deg, rgba(39, 174, 96, 0.06), rgba(22, 160, 133, 0.06)); border: 1px solid rgba(39, 174, 96, 0.25); border-radius: var(--radius-sm); padding: 14px 16px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid rgba(39, 174, 96, 0.15); padding-bottom: 8px;">
                        <h4 style="color: #27ae60; margin: 0; font-size: 15px; display: flex; align-items: center; gap: 6px;">
                            <span class="material-symbols-rounded" style="font-size: 18px;">vaccines</span> Thông tin & Phác đồ Tiêm chủng
                        </h4>
                        <span style="background: #27ae60; color: white; padding: 2px 9px; border-radius: 20px; font-size: 11.5px; font-weight: 600;">Mũi ${vInfo.currentDose}</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 6px; font-size: 13.5px;">
                        <p style="margin: 0;"><strong>Tên vắc xin:</strong> ${this.escapeHtml(vInfo.vaccineName)}</p>
                        <p style="margin: 0;"><strong>Phòng bệnh:</strong> ${this.escapeHtml(vInfo.diseaseTarget)}</p>
                        <p style="margin: 0;"><strong>Phác đồ chuẩn:</strong> ${this.escapeHtml(vInfo.schedule)}</p>
                        ${vInfo.nextDoseDate ? `
                        <div style="background: white; border: 1px solid #27ae60; border-radius: 8px; padding: 8px 12px; margin-top: 4px; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
                            <div>
                                <strong style="color: #27ae60;"><span class="material-symbols-rounded" style="vertical-align: middle; font-size: 16px;">event</span> Mũi tiếp theo:</strong>
                                <span style="font-weight: 700; color: var(--text-color); margin-left: 4px;">${this.formatDate(vInfo.nextDoseDate)}</span>
                            </div>
                            <button type="button" class="btn-create-vaccine-reminder-inline neumorphic-btn" data-title="${this.escapeHtml(vInfo.nextDoseTitle)}" data-date="${this.escapeHtml(vInfo.nextDoseDate)}" data-note="${this.escapeHtml(vInfo.defaultNote)}" style="font-size: 11.5px; padding: 4px 10px; color: #27ae60; background: rgba(39,174,96,0.1); border: 1px solid #27ae60; font-weight: 600;">
                                + Đặt lịch nhắc
                            </button>
                        </div>
                        ` : ''}
                    </div>
                </div>
                `;
            }
        }

        html += `</div>`; // Đóng cột 2
        html += `</div>`; // Đóng lưới 2 cột

        // 3. Bảng Chi tiết Xét nghiệm (Full width phía dưới)
        if (record.dynamicFields && record.dynamicFields.length > 0) {
            html += `
                <div style="margin-top: 18px; border-top: 1px solid rgba(0,0,0,0.06); padding-top: 15px;">
                    <h4 style="color: var(--primary-blue); margin-bottom: 10px; font-size: 15.5px; display: flex; align-items: center; gap: 6px;">
                        <span class="material-symbols-rounded" style="font-size: 18px;">science</span> Chi tiết chỉ số xét nghiệm (${record.dynamicFields.length})
                    </h4>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; background: var(--bg-color); box-shadow: var(--shadow-outer); border-radius: var(--radius-sm); overflow: hidden;">
                        <tr style="background: var(--primary-blue); color: white;">
                            <th style="padding: 10px 12px; text-align: left; font-size: 13.5px;">Chỉ số</th>
                            <th style="padding: 10px 12px; text-align: left; font-size: 13.5px;">Kết quả</th>
                        </tr>`;
            record.dynamicFields.forEach((f, idx) => {
                const bg = idx % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent';
                const color = f.isAbnormal ? '#e74c3c' : 'var(--primary-blue)';
                html += `<tr class="clickable-row" data-keyword="${this.escapeHtml(f.key)}" title="Bấm để xem giải thích ngắn" style="background: ${bg}; border-bottom: 1px solid rgba(0,0,0,0.05);">
                            <td style="padding: 10px 12px; font-size: 13.5px;">${this.escapeHtml(f.key)}</td>
                            <td style="padding: 10px 12px; font-weight: 600; color: ${color}; font-size: 13.5px;">${this.escapeHtml(f.value)}</td>
                         </tr>
                         <tr class="inline-info-row hidden" id="inline-info-${idx}">
                            <td colspan="2" style="padding: 0;">
                                <div class="inline-info-content" id="inline-info-content-${idx}">
                                    <!-- Loaded by JS -->
                                </div>
                            </td>
                         </tr>`;
            });
            html += `</table>
                </div>`;
        }

        // 4. Tài liệu & Hình ảnh gốc đính kèm (Collapsible Accordion ở cuối trang)
        const images = record.originalImages || (record.originalImage ? [record.originalImage] : []);
        if (images.length > 0) {
            html += `
                <div class="attached-docs-collapsible" style="margin-top: 18px; border: 1px solid rgba(0,0,0,0.1); border-radius: 10px; overflow: hidden; background: var(--bg-color); box-shadow: var(--shadow-outer);">
                    <button type="button" id="btn-toggle-attached-docs" class="btn-toggle-attached-docs" style="width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: rgba(52, 152, 219, 0.08); border: none; cursor: pointer; text-align: left; transition: background 0.2s;">
                        <span style="font-size: 14px; font-weight: 600; color: var(--primary-blue); display: flex; align-items: center; gap: 6px;">
                            <span class="material-symbols-rounded" style="font-size: 20px;">folder_open</span>
                            Tài liệu & Hình ảnh gốc đính kèm (${images.length})
                        </span>
                        <span style="display: flex; align-items: center; gap: 4px; font-size: 12.5px; color: var(--primary-blue); font-weight: 600;">
                            <span id="attached-docs-toggle-text">Xem tài liệu</span>
                            <span class="material-symbols-rounded" id="attached-docs-toggle-icon" style="font-size: 20px; transition: transform 0.3s ease;">expand_more</span>
                        </span>
                    </button>
                    
                    <div id="attached-docs-body" class="hidden" style="padding: 14px; background: white; border-top: 1px solid rgba(0,0,0,0.06); animation: slideDown 0.25s ease-out;">
                        <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
                            <button type="button" class="btn-print-all-docs neumorphic-btn" data-record-id="${this.escapeHtml(record.id)}" style="font-size: 12px; padding: 5px 12px; color: #27ae60; border: 1px solid #27ae60; background: white; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                                <span class="material-symbols-rounded" style="font-size: 16px;">print</span> In toàn bộ tài liệu
                            </button>
                        </div>
                        <div class="attached-docs-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px;">
            `;

            for (let i = 0; i < images.length; i++) {
                const img = images[i];
                let src = img;
                if (img.startsWith('img_')) {
                    src = await ImageStore.getImage(img);
                }
                const safeSrc = src || '';
                
                html += `
                    <div class="attached-doc-card" data-img="${this.escapeHtml(img)}" data-index="${i + 1}">
                        <div class="attached-doc-thumb-wrap btn-view-img" data-img="${this.escapeHtml(img)}" title="Bấm để xem phóng to chi tiết">
                            <span class="attached-doc-badge">Trang ${i + 1}</span>
                            <img src="${this.escapeHtml(safeSrc)}" class="attached-doc-thumb" alt="Tài liệu gốc ${i + 1}">
                        </div>
                        <div class="attached-doc-actions">
                            <button type="button" class="attached-doc-btn btn-view-img" data-img="${this.escapeHtml(img)}" title="Phóng to xem nét">
                                <span class="material-symbols-rounded" style="font-size: 15px;">zoom_in</span> Xem
                            </button>
                            <button type="button" class="attached-doc-btn print-btn btn-print-single-doc" data-img="${this.escapeHtml(img)}" title="In tài liệu này">
                                <span class="material-symbols-rounded" style="font-size: 15px;">print</span> In
                            </button>
                        </div>
                    </div>
                `;
            }

            html += `
                        </div>
                    </div>
                </div>
            `;
        }

        document.getElementById('view-record-form-data').innerHTML = html;
        this.enhanceA11y(document.getElementById('view-record-form-data'));
        
        // Save current record id to the modal for chat/actions reference
        document.getElementById('modal-view-record').dataset.id = record.id;
        
        // Reset deep chat state just in case
        document.getElementById('modal-deep-chat').classList.add('hidden');
        window.currentDeepChatHistory = [];

        const reportData = document.getElementById('view-record-report-data');
        if (record.comprehensiveReport) {
            reportData.style.display = 'block';
            reportData.innerHTML = this.renderMarkdown(record.comprehensiveReport);
        } else {
            reportData.style.display = 'none';
        }
    },

    // ==================== 4. Render Statistics ====================
    /**
     * Vẽ 2 thẻ tổng quan (tổng chi phí, số lần khám) và biểu đồ cột phân loại theo "Loại khám".
     * Phân loại được nhóm theo nhãn CHUẨN HOÁ (qua getTypeInfo) thay vì so khớp trực tiếp
     * chuỗi 'routine'/'mild'/'severe'/'chronic' như phiên bản cũ — vì trường "Loại khám" trong
     * form là văn bản tự do (datalist gợi ý) nên hầu như không còn khớp các khoá cũ đó nữa.
     */
    renderStatistics(records) {
        const statsCards = document.getElementById('stats-cards');
        const chartContainer = document.getElementById('stats-chart');

        if (!statsCards || !chartContainer) return;

        if (records.length === 0) {
            statsCards.innerHTML = `<div class="stat-card neumorphic-card" style="grid-column: 1 / -1;"><p>Chưa có dữ liệu thống kê.</p></div>`;
            chartContainer.innerHTML = '';
            return;
        }

        // --- Render Stats Cards ---
        const totalCost = records.reduce((sum, r) => sum + (parseInt(r.cost) || 0), 0);
        const totalVisits = records.length;

        statsCards.innerHTML = `
            <div class="stat-card neumorphic-card cost">
                <h3>Tổng chi phí y tế</h3>
                <div class="stat-value">${this.formatCurrency(totalCost)}</div>
            </div>
            <div class="stat-card neumorphic-card">
                <h3>Số lần đi khám</h3>
                <div class="stat-value">${totalVisits}</div>
            </div>
        `;

        // --- Render Bar Chart (Thống kê theo loại khám, nhóm động theo nhãn chuẩn hoá) ---
        const counts = {};
        records.forEach(r => {
            const label = this.getTypeInfo(r.type).text;
            counts[label] = (counts[label] || 0) + 1;
        });

        const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const barsHTML = entries
            .map(([label, count]) => this.createBarRow(this.escapeHtml(label), count, totalVisits, this.getTypeColor(label)))
            .join('');

        chartContainer.innerHTML = `
            <div class="neumorphic-card">
                <h3>Thống kê theo loại khám</h3>
                <div class="bar-chart">
                    ${barsHTML}
                </div>
            </div>
        `;
    },

    createBarRow(label, count, total, color) {
        const percent = total > 0 ? Math.round((count / total) * 100) : 0;
        return `
            <div class="bar-row">
                <div class="bar-label">${label} (${count})</div>
                <div class="bar-track">
                    <div class="bar-fill" style="width: ${percent}%; background: ${color};"></div>
                </div>
                <div style="font-size: 12px; width: 40px; text-align: right;">${percent}%</div>
            </div>
        `;
    },

    // ==================== 5. Render Reminders ====================
    renderRemindersList(reminders, containerId, showMemberName = false) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';

        if (reminders.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">Không có lịch hẹn nào.</div>`;
            return;
        }

        reminders.forEach(rm => {
            const el = document.createElement('div');
            el.className = 'record-item'; // Reuse record-item style
            el.style.borderLeft = rm.notified ? '4px solid var(--text-muted)' : '4px solid var(--warning)';

            const memberNameHtml = showMemberName ? `<strong>👤 ${this.escapeHtml(rm.memberName)}</strong><br>` : '';
            const statusHtml = rm.notified
                ? `<span class="type-badge type-routine" style="background:#e0e0e0; color:#666;">Đã qua</span>`
                : `<span class="type-badge type-severe" style="background:#f39c12; color:#fff;">Sắp tới</span>`;

            el.innerHTML = `
                <div class="record-header" style="margin-bottom: 5px;">
                    <span class="record-date" style="color: ${rm.notified ? 'var(--text-muted)' : 'var(--warning)'}">${this.escapeHtml(this.formatDate(rm.date))} ${this.escapeHtml(rm.time)}</span>
                    ${statusHtml}
                </div>
                <div class="record-body" style="grid-template-columns: 1fr;">
                    <div class="record-detail">
                        ${memberNameHtml}
                        <span class="material-symbols-rounded">alarm</span> <strong>${this.escapeHtml(rm.title)}</strong>
                    </div>
                    ${rm.note ? `<div class="record-detail"><span class="material-symbols-rounded">notes</span> ${this.escapeHtml(rm.note)}</div>` : ''}
                </div>
                <div class="record-actions" style="margin-top: 10px;">
                    <label style="display:flex; align-items:center; gap:5px; cursor:pointer; color:var(--text-muted); font-size:13px; margin-right:auto;">
                        <input type="checkbox" class="chk-delete-reminder" data-id="${this.escapeHtml(rm.id)}" aria-label="Xóa lịch hẹn: ${this.escapeHtml(rm.title)}"> Xóa
                    </label>
                    ${!showMemberName ? '' : `<button class="icon-btn neumorphic-btn btn-go-member" data-id="${this.escapeHtml(rm.memberId)}" title="Xem hồ sơ"><span class="material-symbols-rounded">person</span></button>`}
                    ${showMemberName ? '' : `<button class="icon-btn neumorphic-btn btn-edit-reminder" data-id="${this.escapeHtml(rm.id)}" title="Sửa lịch hẹn"><span class="material-symbols-rounded">edit</span></button>`}
                </div>
            `;
            container.appendChild(el);
        });

        this.enhanceA11y(container);
    },

    updateNotificationBadge(count) {
        const badge = document.getElementById('notification-badge');
        if (count > 0) {
            badge.innerText = count;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }
};
