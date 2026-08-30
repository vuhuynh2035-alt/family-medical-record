const HelpService = {
    isHelpModeActive: false,
    
    init() {
        this.btnHelp = document.getElementById('btn-help');
        this.backdrop = document.getElementById('help-backdrop');
        this.layer = document.getElementById('help-layer');
        this.btnWorkflow = document.getElementById('btn-workflow-guide');
        this.btnAiHelp = document.getElementById('btn-ai-help-chat');
        this.modalWorkflow = document.getElementById('modal-workflow-guide');
        this.modalAiHelp = document.getElementById('modal-ai-help-chat');
        this.workflowContent = document.getElementById('workflow-guide-content');

        if (this.btnHelp) {
            this.btnHelp.addEventListener('click', () => this.toggleHelpMode());
        }
        if (this.backdrop) {
            this.backdrop.addEventListener('click', () => this.toggleHelpMode()); // Click outside to close
        }
        
        document.body.addEventListener('click', (e) => {
            if (e.target.closest('.btn-workflow-guide') || e.target.closest('#btn-workflow-guide')) {
                this.showWorkflowGuide();
            }
        });

        if (this.btnAiHelp) {
            this.btnAiHelp.addEventListener('click', () => this.showAiHelpChat());
        }
        
        // Modal close buttons
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const overlay = e.target.closest('.modal-overlay');
                if (overlay) overlay.classList.add('hidden');
            });
        });

        // AI Chat input handling
        const btnSendAiHelp = document.getElementById('btn-send-ai-help');
        const inputAiHelp = document.getElementById('input-ai-help-chat');
        if (btnSendAiHelp && inputAiHelp) {
            btnSendAiHelp.addEventListener('click', () => this.sendAiHelpMessage());
            inputAiHelp.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendAiHelpMessage();
            });
        }

        window.addEventListener('resize', () => {
            if (this.isHelpModeActive) {
                this.renderHelpElements();
            }
        });
    },

    toggleHelpMode() {
        this.isHelpModeActive = !this.isHelpModeActive;
        
        if (this.isHelpModeActive) {
            this.backdrop.classList.remove('hidden');
            this.layer.classList.remove('hidden');
            if (this.btnWorkflow) this.btnWorkflow.classList.remove('hidden');
            if (this.btnAiHelp) this.btnAiHelp.classList.remove('hidden');
            this.renderHelpElements();
        } else {
            this.backdrop.classList.add('hidden');
            this.layer.classList.add('hidden');
            if (this.btnWorkflow) this.btnWorkflow.classList.add('hidden');
            if (this.btnAiHelp) this.btnAiHelp.classList.add('hidden');
            if (this.modalAiHelp) this.modalAiHelp.classList.add('hidden');
            if (this.modalWorkflow) this.modalWorkflow.classList.add('hidden');
            this.layer.innerHTML = '';
        }
    },

    renderHelpElements() {
        this.layer.innerHTML = ''; // Clear previous
        this.backdrop.innerHTML = ''; // Clear previous canvas
        
        // Find active view
        const activeView = document.querySelector('.view.active');
        if (!activeView) return;

        // Find all elements with data-help in this view
        const elements = activeView.querySelectorAll('[data-help-title]');
        
        // Create canvas for the dark overlay with transparent holes
        const canvas = document.createElement('canvas');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        canvas.style.pointerEvents = 'none'; // let backdrop div handle clicks
        this.backdrop.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // Dark overlay color
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.globalCompositeOperation = 'destination-out';
        
        elements.forEach(el => {
            // Ignore hidden elements (e.g. tabs that are not visible)
            if (el.offsetParent === null) return;
            
            const rect = el.getBoundingClientRect();
            const title = el.getAttribute('data-help-title');
            const desc = el.getAttribute('data-help-desc');

            const padding = 6;
            
            // Draw transparent hole in canvas for the element
            const x = rect.left - padding;
            const y = rect.top - padding;
            const w = rect.width + padding * 2;
            const h = rect.height + padding * 2;
            const r = 8; // border radius
            
            ctx.fillStyle = 'rgba(255, 255, 255, 1)';
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.fill();

            // 1. Create Glowing Box
            const box = document.createElement('div');
            box.className = 'help-highlight-box';
            // Dùng chung biến `padding` đã khai báo ở trên (không khai báo `const padding` lần 2
            // trong cùng scope — bản gốc bị lỗi "Identifier 'padding' has already been declared",
            // khiến TOÀN BỘ file help.js không parse được, nút trợ giúp "?" không hoạt động).
            box.style.top = (rect.top - padding) + 'px';
            box.style.left = (rect.left - padding) + 'px';
            box.style.width = (rect.width + padding * 2) + 'px';
            box.style.height = (rect.height + padding * 2) + 'px';
            
            this.layer.appendChild(box);

            // 2. Create Tooltip
            const tooltip = document.createElement('div');
            tooltip.className = 'help-tooltip';
            tooltip.innerHTML = `
                <div class="help-tooltip-title"><span class="material-symbols-rounded">info</span> ${title}</div>
                <div class="help-tooltip-desc">${desc}</div>
            `;
            
            this.layer.appendChild(tooltip);

            // Calculate position for tooltip
            let tooltipTop = 0;
            let tooltipLeft = 0;
            let arrowClass = '';
            
            const pos = el.getAttribute('data-help-pos') || 'bottom';

            if (pos === 'right') {
                arrowClass = 'arrow-left';
                tooltipTop = rect.top + (rect.height / 2) - 30; // 30 is approx half tooltip height
                tooltipLeft = rect.right + padding + 15;
            } else if (pos === 'left') {
                arrowClass = 'arrow-right';
                tooltipTop = rect.top + (rect.height / 2) - 30;
                // We'll set a default left, but we might need to adjust after it's in DOM
                // since we don't know the exact width. We assume max-width 250px.
                tooltipLeft = rect.left - padding - 250 - 15; 
            } else if (pos === 'top') {
                arrowClass = 'arrow-down';
                tooltipTop = rect.top - padding - 80;
                tooltipLeft = rect.left + (rect.width / 2) - 30;
            } else { // bottom (default)
                arrowClass = 'arrow-up';
                tooltipTop = rect.bottom + padding + 15;
                tooltipLeft = rect.left + (rect.width / 2) - 30;
                
                // If it goes off screen bottom, place above
                if (tooltipTop + 100 > window.innerHeight) {
                    tooltipTop = rect.top - padding - 80;
                    arrowClass = 'arrow-down';
                }
            }
            
            // Boundary checks for top/left
            if (tooltipTop < 10) tooltipTop = 10;
            if (tooltipTop + 100 > window.innerHeight) tooltipTop = window.innerHeight - 100;
            if (tooltipLeft < 10) tooltipLeft = 10;
            if (tooltipLeft + 250 > window.innerWidth) tooltipLeft = window.innerWidth - 260;
            
            tooltip.classList.add(arrowClass);
            tooltip.style.top = tooltipTop + 'px';
            tooltip.style.left = tooltipLeft + 'px';
            
            // For 'left' position, if it's too wide, we fix it by forcing the right side
            if (pos === 'left') {
                tooltip.style.left = 'auto';
                tooltip.style.right = (window.innerWidth - rect.left + padding + 15) + 'px';
            }
        });
    },

    showWorkflowGuide() {
        const activeView = document.querySelector('.view.active');
        const viewId = activeView ? activeView.id : 'unknown';
        let html = '';
        const modalRecord = document.getElementById('modal-record');
        const modalVaccineReminder = document.getElementById('modal-vaccine-reminder-prompt');
        const modalVaccineConsultation = document.getElementById('modal-vaccine-consultation');
        
        if (modalRecord && !modalRecord.classList.contains('hidden')) {
            html = `
                <h3>Hướng dẫn Tạo Hồ sơ Khám bệnh</h3>
                <ol>
                    <li><strong>Điền thông tin cơ bản:</strong> Nhập ngày khám, nơi khám và chẩn đoán bệnh.</li>
                    <li><strong>Tải ảnh bệnh án:</strong> Nhấn chọn file hoặc chụp ảnh toa thuốc, kết quả xét nghiệm (hỗ trợ JPG, PNG, PDF).</li>
                    <li><strong>Trợ lý AI (Điền form & Kết luận):</strong> Sau khi chọn ảnh, nhấn nút này để AI tự động đọc hiểu hình ảnh, điền các chỉ số vào máy và tự động sinh ra một "Báo cáo phân tích chuyên sâu" về tình hình sức khỏe của bạn.</li>
                    <li><strong>Lưu lại:</strong> Nhấn nút Tạo hồ sơ để lưu. Hồ sơ sẽ xuất hiện trong Lịch sử khám.</li>
                </ol>
            `;
        } else if (modalVaccineReminder && !modalVaccineReminder.classList.contains('hidden')) {
            html = `
                <h3>Hướng dẫn Tạo Lịch Tiêm phòng</h3>
                <ol>
                    <li><strong>Gợi ý AI:</strong> Ứng dụng sẽ phân tích độ tuổi và lịch sử tiêm chủng để tự động gợi ý mũi tiêm tiếp theo.</li>
                    <li><strong>Chỉnh sửa thông tin:</strong> Bạn có thể sửa Tên mũi tiêm, Ngày giờ nhắc nhở theo ý muốn.</li>
                    <li><strong>Ghi chú:</strong> Điền thêm các dặn dò (VD: mang theo sổ tiêm chủng, kiểm tra trẻ không sốt).</li>
                    <li><strong>Lưu lịch:</strong> Nhấn "Thêm vào Lịch nhắc". Đến đúng ngày giờ, chuông báo sẽ reo và thông báo sẽ hiện trên biểu tượng ứng dụng.</li>
                </ol>
            `;
        } else if (modalVaccineConsultation && !modalVaccineConsultation.classList.contains('hidden')) {
            html = `
                <h3>Cẩm nang & Phác đồ Tiêm chủng</h3>
                <p>Nơi AI cung cấp toàn bộ kiến thức chuyên sâu về vắc-xin phù hợp với độ tuổi của thành viên này. Bạn có thể nhấn <strong>Tạo Lịch nhắc tiêm</strong> trực tiếp từ các gợi ý trong cẩm nang này.</p>
            `;
        } else if (viewId === 'view-dashboard') {
            html = `
                <h3>Quy trình Trang Chủ (Dashboard)</h3>
                <ol>
                    <li><strong>Bắt đầu:</strong> Nhấn nút <strong>Thêm thành viên</strong> để tạo hồ sơ mới.</li>
                    <li><strong>Xem hồ sơ:</strong> Nhấn trực tiếp vào thẻ thành viên để mở chi tiết bệnh án.</li>
                    <li><strong>Bảo mật PIN (Mới):</strong> Dữ liệu của bạn được khóa an toàn bằng mã PIN. Hãy thiết lập trong phần Cài đặt nếu bạn muốn đổi mã.</li>
                    <li><strong>Chia sẻ Backup (Mới):</strong> Trong Cài đặt, bạn có thể dễ dàng Chia sẻ file sao lưu qua Zalo, Messenger, AirDrop... để gửi cho người thân hoặc thiết bị khác.</li>
                </ol>
                <hr style="border: none; border-top: 1px dashed rgba(0,0,0,0.1); margin: 15px 0;">
                <h3 style="color: #27ae60;">Hướng dẫn lấy API Key Miễn phí (Google Gemini)</h3>
                <p style="font-size: 14px; line-height: 1.5; color: var(--text-color);">Để sử dụng tính năng Đọc ảnh và Phân tích AI, hãy tự lấy một API Key từ Google:</p>
                <ol style="font-size: 14px; line-height: 1.5; color: var(--text-color);">
                    <li>Truy cập <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color: #2980b9; font-weight: bold;">Google AI Studio</a>.</li>
                    <li>Nhấn nút <strong>"Create API key in new project"</strong>.</li>
                    <li>Copy đoạn mã đó, dán vào phần Cài đặt của ứng dụng này.</li>
                </ol>
            `;
        } else if (viewId === 'view-member-detail') {
            html = `
                <h3>Quy trình Chi tiết Bệnh án</h3>
                <ol>
                    <li><strong>Hồ Sơ:</strong> Nhấn nút Cây bút để sửa thông tin thành viên.</li>
                    <li><strong>Thêm lượt khám:</strong> Tải ảnh/PDF lên và sử dụng nút "Điền form & Kết luận" để AI tự động làm phần việc còn lại.</li>
                    <li><strong>Trao đổi & Đọc giọng nói (Mới):</strong> Bôi đen văn bản để hỏi AI, hoặc nhấn vào các nút Cây Loa màu xanh để ứng dụng đọc to nội dung (rất hữu ích cho người lớn tuổi).</li>
                    <li><strong>Tiêm chủng (Mới):</strong> Sử dụng nút "Cẩm nang Vắc xin" để AI tư vấn lịch tiêm chủng phù hợp cho lứa tuổi của thành viên này.</li>
                    <li><strong>Lịch hẹn:</strong> Tạo lịch tái khám. Ứng dụng sẽ hiện số đếm thông báo màu đỏ ngay trên icon ở màn hình điện thoại khi có lịch đến hạn.</li>
                </ol>
            `;
        } else {
            html = '<p>Chưa có hướng dẫn cho trang này.</p>';
        }
        
        this.workflowContent.innerHTML = html;
        this.modalWorkflow.classList.remove('hidden');
    },

    showAiHelpChat() {
        if (!this.modalAiHelp) return;
        this.modalAiHelp.classList.remove('hidden');
        const input = document.getElementById('input-ai-help-chat');
        if (input) input.focus();
    },

    async sendAiHelpMessage() {
        const input = document.getElementById('input-ai-help-chat');
        const messageContainer = document.getElementById('ai-help-chat-messages');
        if (!input || !messageContainer || !input.value.trim()) return;

        const userText = input.value.trim();
        input.value = '';

        // Add user message to chat
        const userMsg = document.createElement('div');
        userMsg.className = 'chat-message user-message';
        userMsg.style.cssText = 'align-self: flex-end; max-width: 85%; background: linear-gradient(135deg, #9b59b6, #8e44ad); color: white; padding: 12px 16px; border-radius: 15px 15px 0 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);';
        userMsg.innerHTML = `<div style="font-size: 12px; color: rgba(255,255,255,0.8); font-weight: bold; margin-bottom: 4px; display: flex; align-items: center; justify-content: flex-end; gap: 4px;">Bạn <span class="material-symbols-rounded" style="font-size: 14px;">person</span></div><div>${this.escapeHtml(userText)}</div>`;
        messageContainer.appendChild(userMsg);
        messageContainer.scrollTop = messageContainer.scrollHeight;

        // Add loading message
        const loadingMsg = document.createElement('div');
        loadingMsg.className = 'chat-message assistant-message';
        loadingMsg.style.cssText = 'align-self: flex-start; max-width: 85%; background: white; padding: 12px 16px; border-radius: 15px 15px 15px 0; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border: 1px solid rgba(0,0,0,0.05);';
        loadingMsg.innerHTML = `<div style="font-size: 12px; color: #9b59b6; font-weight: bold; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;"><span class="material-symbols-rounded" style="font-size: 14px;">smart_toy</span> AI Assistant</div><div class="loading-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
        messageContainer.appendChild(loadingMsg);
        messageContainer.scrollTop = messageContainer.scrollHeight;

        try {
            // Call AI Service (implemented in js/ai.js)
            const response = await AIService.askHelpAssistant(userText);
            
            // Remove loading and add actual response
            loadingMsg.remove();
            
            const aiMsg = document.createElement('div');
            aiMsg.className = 'chat-message assistant-message';
            aiMsg.style.cssText = 'align-self: flex-start; max-width: 85%; background: white; padding: 12px 16px; border-radius: 15px 15px 15px 0; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border: 1px solid rgba(0,0,0,0.05); font-size: 14px; line-height: 1.5;';
            aiMsg.innerHTML = `<div style="font-size: 12px; color: #9b59b6; font-weight: bold; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;"><span class="material-symbols-rounded" style="font-size: 14px;">smart_toy</span> AI Assistant</div><div>${DOMPurify.sanitize(marked.parse(response))}</div>`;
            messageContainer.appendChild(aiMsg);
            messageContainer.scrollTop = messageContainer.scrollHeight;
        } catch (error) {
            loadingMsg.remove();
            const errorMsg = document.createElement('div');
            errorMsg.className = 'chat-message assistant-message';
            errorMsg.style.cssText = 'align-self: flex-start; max-width: 85%; background: #fff1f0; color: #e74c3c; padding: 12px 16px; border-radius: 15px 15px 15px 0; border: 1px solid #ffccc7; font-size: 14px;';
            errorMsg.innerHTML = `<div style="font-size: 12px; font-weight: bold; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;"><span class="material-symbols-rounded" style="font-size: 14px;">error</span> Lỗi</div><div>Xin lỗi, tôi không thể xử lý câu hỏi lúc này: ${this.escapeHtml(error.message)}</div>`;
            messageContainer.appendChild(errorMsg);
            messageContainer.scrollTop = messageContainer.scrollHeight;
        }
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Initialize after DOM loads
document.addEventListener('DOMContentLoaded', () => {
    HelpService.init();
});
