const UI = {
    // Format helpers
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
    
    getTypeInfo(type) {
        switch(type) {
            case 'routine': return { text: 'Khám định kỳ', class: 'type-routine' };
            case 'mild': return { text: 'Bệnh nhẹ', class: 'type-mild' };
            case 'severe': return { text: 'Bệnh nặng', class: 'type-severe' };
            case 'chronic': return { text: 'Bệnh mãn tính', class: 'type-chronic' };
            default: return { text: 'Khác', class: 'type-routine' };
        }
    },

    // 1. Render Members Dashboard
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
            const displayName = member.nickname ? member.nickname : member.name;
            card.innerHTML = `
                <img src="${member.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(displayName) + '&background=random'}" alt="${displayName}" class="member-avatar">
                <h3>${displayName}</h3>
                <div class="member-stats">
                    <span class="stat-badge">${totalRecords} hồ sơ</span>
                    <span class="stat-badge">Gần nhất: ${lastVisit}</span>
                </div>
            `;
            grid.appendChild(card);
        });
    },

    // 2. Render Member Profile
    renderMemberProfile(member) {
        const profileContainer = document.getElementById('tab-profile');
        
        let customFieldsHTML = '';
        if (member.customFields && member.customFields.length > 0) {
            member.customFields.forEach(field => {
                customFieldsHTML += `
                <div class="profile-item">
                    <label>${field.key}</label>
                    <p>${field.value}</p>
                </div>
                `;
            });
        }

        profileContainer.innerHTML = `
            <div class="profile-grid">
                <div class="profile-item">
                    <label>Họ và Tên</label>
                    <p>${member.name}</p>
                </div>
                <div class="profile-item">
                    <label>Ngày sinh / Năm sinh</label>
                    <p>${this.formatDate(member.dob)}</p>
                </div>
                <div class="profile-item">
                    <label>Nhóm máu</label>
                    <p>${member.blood || 'Chưa cập nhật'}</p>
                </div>
                <div class="profile-item">
                    <label>Chiều cao / Cân nặng</label>
                    <p>${member.height ? member.height + ' cm' : '--'} / ${member.weight ? member.weight + ' kg' : '--'}</p>
                </div>
                ${customFieldsHTML}
                <div class="profile-item" style="grid-column: 1 / -1;">
                    <label>Tiền sử bệnh / Dị ứng</label>
                    <p>${member.conditions || 'Không có ghi nhận'}</p>
                </div>
            </div>
        `;
    },

    // 3. Render Records List
    renderRecordsList(records) {
        const list = document.getElementById('records-list');
        list.innerHTML = '';

        if (records.length === 0) {
            list.innerHTML = `<div style="text-align: center; color: var(--text-muted); margin-top: 30px;">
                Chưa có hồ sơ khám bệnh nào.
            </div>`;
            return;
        }

        const typeLabels = {
            'routine': 'Khám định kỳ',
            'mild': 'Bệnh nhẹ',
            'severe': 'Bệnh nặng',
            'chronic': 'Bệnh mãn tính'
        };

        records.forEach(record => {
            const images = record.originalImages || (record.originalImage ? [record.originalImage] : []);
            let imgBtn = '';
            if (images.length > 0) {
                imgBtn = `<span title="Có ${images.length} tệp đính kèm" style="color: var(--text-muted); display: flex; align-items: center; font-size: 13px; margin-right: 10px;"><span class="material-symbols-rounded" style="font-size: 16px; margin-right: 3px;">attach_file</span>${images.length}</span>`;
            }
            const aiBtn = `<button class="icon-btn neumorphic-btn btn-ai-assessment" data-id="${record.id}" title="AI Phân tích tình trạng"><span class="material-symbols-rounded ai-sparkle">psychiatry</span></button>`;
            const searchBtn = `<button class="icon-btn neumorphic-btn btn-search-disease" data-disease="${record.disease}" title="Tra cứu chuyên sâu về bệnh này trên mạng"><span class="material-symbols-rounded" style="color: #9b59b6;">travel_explore</span></button>`;

            const el = document.createElement('div');
            el.className = 'record-item neumorphic-card';
            el.dataset.id = record.id;
            el.innerHTML = `
                <div class="record-header">
                    <span class="record-date">${this.formatDate(record.date)}</span>
                    <span class="type-badge ${this.getTypeInfo(record.type).class}">${this.getTypeInfo(record.type).text}</span>
                </div>
                <div class="record-body" style="grid-template-columns: 1fr; gap: 5px;">
                    <div class="record-detail" style="font-size: 16px;">
                        <strong>${record.hospital}</strong> - ${record.disease}
                    </div>
                    <div class="record-detail" style="color: var(--text-muted); font-size: 13px;">
                        Bác sĩ: ${record.doctor || 'N/A'} &nbsp;|&nbsp; Chi phí: ${this.formatCurrency(record.cost)}
                    </div>
                </div>
                <div class="record-actions" style="border-top: 1px solid rgba(0,0,0,0.05); padding-top: 10px;">
                    <span style="font-size: 12px; color: var(--primary-blue); flex: 1; text-align: left; align-self: center;">Nhấn vào thẻ để xem chi tiết</span>
                    ${searchBtn}
                    ${aiBtn}
                    ${imgBtn}
                    <button class="icon-btn neumorphic-btn btn-edit-record" data-id="${record.id}" title="Sửa"><span class="material-symbols-rounded">edit</span></button>
                </div>
            `;
            list.appendChild(el);
        });
    },

    async renderRecordDetailModal(record) {
        const typeInfo = this.getTypeInfo(record.type);
        let html = `
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom: 15px; margin-bottom: 15px;">
                <div>
                    <h4 style="color: var(--primary-blue); font-size: 20px; margin-bottom: 5px;">${record.hospital}</h4>
                    <p style="font-size: 14px;"><strong>Ngày khám:</strong> ${this.formatDate(record.date)}</p>
                    <p style="font-size: 14px;"><strong>Bác sĩ:</strong> ${record.doctor || 'N/A'}</p>
                </div>
                <div>
                    <span class="type-badge ${typeInfo.class}">${typeInfo.text}</span>
                </div>
            </div>
            
            <h4 style="color: var(--primary-blue); margin-bottom: 10px; font-size: 16px;"><span class="material-symbols-rounded" style="vertical-align: middle;">coronavirus</span> Chẩn đoán & Điều trị</h4>
            <div style="background: var(--bg-color); box-shadow: var(--shadow-inner); padding: 15px; border-radius: var(--radius-sm); margin-bottom: 20px;">
                <p style="margin-bottom: 10px;"><strong>Chẩn đoán:</strong> ${record.disease}</p>
                <p style="margin-bottom: 10px;"><strong>Điều trị/Thuốc:</strong><br>${record.treatment ? record.treatment.replace(/\\n/g, '<br>') : 'Không'}</p>
                ${record.note ? `<p style="margin-bottom: 10px; color: var(--danger);"><strong>Lời khuyên:</strong> ${record.note}</p>` : ''}
                <p><strong>Chi phí:</strong> <span style="color: var(--primary-blue); font-weight: bold;">${this.formatCurrency(record.cost)}</span></p>
            </div>
        `;

        if (record.bp || record.hr || record.temp || record.spo2) {
            html += `
            <h4 style="color: var(--primary-blue); margin-bottom: 10px; font-size: 16px;"><span class="material-symbols-rounded" style="vertical-align: middle;">favorite</span> Sinh hiệu (Vital Signs)</h4>
            <div style="background: rgba(52, 152, 219, 0.05); padding: 15px; border-radius: var(--radius-sm); margin-bottom: 20px; border-left: 4px solid var(--primary-blue);">
                ${record.bp ? `<strong>HA:</strong> ${record.bp} mmHg &nbsp;|&nbsp; ` : ''}
                ${record.hr ? `<strong>Nhịp tim:</strong> ${record.hr} bpm &nbsp;|&nbsp; ` : ''}
                ${record.temp ? `<strong>Nhiệt độ:</strong> ${record.temp}°C &nbsp;|&nbsp; ` : ''}
                ${record.spo2 ? `<strong>SpO2:</strong> ${record.spo2}%` : ''}
            </div>`;
        }

        if (record.symptoms || record.labs) {
            html += `<h4 style="color: var(--primary-blue); margin-bottom: 10px; font-size: 16px;"><span class="material-symbols-rounded" style="vertical-align: middle;">biotech</span> Lâm sàng & Cận lâm sàng</h4>
                     <div style="margin-bottom: 20px;">`;
            if (record.symptoms) html += `<p style="margin-bottom: 10px;"><strong>Triệu chứng:</strong><br>${record.symptoms.replace(/\\n/g, '<br>')}</p>`;
            if (record.labs) html += `<p style="margin-bottom: 10px;"><strong>Kết quả cận lâm sàng:</strong><br>${record.labs.replace(/\\n/g, '<br>')}</p>`;
            html += `</div>`;
        }

        if (record.dynamicFields && record.dynamicFields.length > 0) {
            html += `<h4 style="color: var(--primary-blue); margin-bottom: 10px; font-size: 16px;"><span class="material-symbols-rounded" style="vertical-align: middle;">science</span> Chi tiết xét nghiệm</h4>`;
            html += `<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; background: var(--bg-color); box-shadow: var(--shadow-outer); border-radius: var(--radius-sm); overflow: hidden;">
                        <tr style="background: var(--primary-blue); color: white;">
                            <th style="padding: 12px; text-align: left;">Chỉ số</th>
                            <th style="padding: 12px; text-align: left;">Kết quả</th>
                        </tr>`;
            record.dynamicFields.forEach((f, idx) => {
                const bg = idx % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent';
                html += `<tr style="background: ${bg}; border-bottom: 1px solid rgba(0,0,0,0.05);">
                            <td style="padding: 12px;">${f.key}</td>
                            <td style="padding: 12px; font-weight: 600; color: var(--primary-blue);">${f.value}</td>
                         </tr>`;
            });
            html += `</table>`;
        }

        const images = record.originalImages || (record.originalImage ? [record.originalImage] : []);
        if (images.length > 0) {
            html += `<h4 style="color: var(--primary-blue); margin-bottom: 10px; font-size: 16px;"><span class="material-symbols-rounded" style="vertical-align: middle;">image</span> Hình ảnh gốc đính kèm (${images.length})</h4>
                     <div style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 10px; margin-bottom: 20px;">`;
            
            for (let img of images) {
                let src = img;
                if (img.startsWith('img_')) {
                    src = await ImageStore.getImage(img);
                }
                html += `<img src="${src || ''}" class="btn-view-img" data-img="${img}" style="max-height: 200px; border-radius: var(--radius-sm); box-shadow: var(--shadow-outer); cursor: pointer;" title="Nhấn để phóng to">`;
            }
            html += `</div>`;
        }
        document.getElementById('view-record-form-data').innerHTML = html;
        const reportData = document.getElementById('view-record-report-data');
        if (record.comprehensiveReport) {
            reportData.style.display = 'block';
            reportData.innerHTML = marked.parse(record.comprehensiveReport);
        } else {
            reportData.style.display = 'none';
        }
    },

    // 4. Render Statistics
    renderStatistics(records) {
        const statsGrid = document.getElementById('stats-grid');
        const chartContainer = document.getElementById('stats-chart');
        
        if (!statsGrid || !chartContainer) return;
        
        if (records.length === 0) {
            statsGrid.innerHTML = `<div class="stat-card neumorphic-card" style="grid-column: 1 / -1;"><p>Chưa có dữ liệu thống kê.</p></div>`;
            chartContainer.innerHTML = '';
            return;
        }

        // --- Render Stats Cards ---
        const totalCost = records.reduce((sum, r) => sum + (parseInt(r.cost) || 0), 0);
        const totalVisits = records.length;
        
        statsGrid.innerHTML = `
            <div class="stat-card neumorphic-card cost">
                <h3>Tổng chi phí y tế</h3>
                <div class="stat-value">${this.formatCurrency(totalCost)}</div>
            </div>
            <div class="stat-card neumorphic-card">
                <h3>Số lần đi khám</h3>
                <div class="stat-value">${totalVisits}</div>
            </div>
        `;

        // --- Render Bar Chart (Thống kê theo loại bệnh) ---
        const typeCounts = {
            'routine': 0,
            'mild': 0,
            'severe': 0,
            'chronic': 0
        };
        records.forEach(r => {
            if (typeCounts[r.type] !== undefined) typeCounts[r.type]++;
        });

        const maxCount = Math.max(...Object.values(typeCounts), 1); // Avoid div by 0

        let barsHTML = '';
        const types = [
            { key: 'routine', label: 'Định kỳ', color: '#0277bd' },
            { key: 'mild', label: 'Bệnh nhẹ', color: '#33691e' },
            { key: 'severe', label: 'Bệnh nặng', color: '#bf360c' },
            { key: 'chronic', label: 'Mãn tính', color: '#4a148c' }
        ];

        types.forEach(t => {
            const count = typeCounts[t.key];
            const percent = (count / maxCount) * 100;
            barsHTML += `
                <div class="bar-row">
                    <div class="bar-label">${t.label} (${count})</div>
                    <div class="bar-track">
                        <div class="bar-fill" style="width: ${percent}%; background: ${t.color}"></div>
                    </div>
                </div>
            `;
        });

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

    // 5. Render Reminders
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
            
            const memberNameHtml = showMemberName ? `<strong>👤 ${rm.memberName}</strong><br>` : '';
            const statusHtml = rm.notified 
                ? `<span class="type-badge type-routine" style="background:#e0e0e0; color:#666;">Đã qua</span>` 
                : `<span class="type-badge type-severe" style="background:#f39c12; color:#fff;">Sắp tới</span>`;

            el.innerHTML = `
                <div class="record-header" style="margin-bottom: 5px;">
                    <span class="record-date" style="color: ${rm.notified ? 'var(--text-muted)' : 'var(--warning)'}">${this.formatDate(rm.date)} ${rm.time}</span>
                    ${statusHtml}
                </div>
                <div class="record-body" style="grid-template-columns: 1fr;">
                    <div class="record-detail">
                        ${memberNameHtml}
                        <span class="material-symbols-rounded">alarm</span> <strong>${rm.title}</strong>
                    </div>
                    ${rm.note ? `<div class="record-detail"><span class="material-symbols-rounded">notes</span> ${rm.note}</div>` : ''}
                </div>
                <div class="record-actions" style="margin-top: 10px;">
                    <label style="display:flex; align-items:center; gap:5px; cursor:pointer; color:var(--text-muted); font-size:13px; margin-right:auto;">
                        <input type="checkbox" class="chk-delete-reminder" data-id="${rm.id}"> Xóa
                    </label>
                    ${showMemberName ? `<button class="icon-btn neumorphic-btn btn-go-member" data-id="${rm.memberId}" title="Xem hồ sơ"><span class="material-symbols-rounded">person</span></button>` : ''}
                </div>
            `;
            container.appendChild(el);
        });
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
