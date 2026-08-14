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
        if (this.btnWorkflow) {
            this.btnWorkflow.addEventListener('click', () => this.showWorkflowGuide());
        }
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
        
        if (viewId === 'view-dashboard') {
            html = `
                <h3>Quy trình Trang Chủ (Dashboard)</h3>
                <ol>
                    <li><strong>Bắt đầu:</strong> Nhấn nút <strong>Thêm thành viên</strong> để tạo hồ sơ mới cho người thân trong gia đình.</li>
                    <li><strong>Điền thông tin:</strong> Nhập Tên, Giới tính, Ngày sinh, Mối quan hệ và Lưu lại. Hệ thống tự động tính tuổi.</li>
                    <li><strong>Xem hồ sơ:</strong> Sau khi tạo xong, một thẻ đại diện cho thành viên sẽ hiện ra. Nhấn trực tiếp vào thẻ đó để mở chi tiết <strong>Hồ sơ Bệnh án</strong> của người này.</li>
                </ol>
                <hr style="border: none; border-top: 1px dashed rgba(0,0,0,0.1); margin: 15px 0;">
                <h3 style="color: #27ae60;">Hướng dẫn lấy API Key Miễn phí (Google Gemini)</h3>
                <p style="font-size: 14px; line-height: 1.5; color: var(--text-color);">Để sử dụng các tính năng AI trích xuất bệnh án và phân tích chuyên sâu, bạn cần tự lấy một mã API Key hoàn toàn miễn phí từ Google (chỉ mất 2 phút).</p>
                <ol style="font-size: 14px; line-height: 1.5; color: var(--text-color);">
                    <li>Truy cập trang web: <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color: #2980b9; font-weight: bold;">Google AI Studio</a> và đăng nhập bằng tài khoản Gmail của bạn.</li>
                    <li>Nhấn nút <strong>"Create API Key"</strong> màu xanh.</li>
                    <li>Nhấn tiếp <strong>"Create API key in new project"</strong>. Đợi vài giây, Google sẽ cấp cho bạn một đoạn mã dài khoảng 40 ký tự.</li>
                    <li>Copy đoạn mã đó. Quay lại ứng dụng này, bấm vào nút <strong>Cài đặt</strong> (Hình bánh răng ở góc trên bên phải màn hình).</li>
                    <li>Dán mã vừa copy vào ô <strong>"API Key (Gemini)"</strong> và bấm <strong>Lưu cấu hình</strong>. Xong! Bạn đã có thể dùng AI thoải mái.</li>
                </ol>
            `;
        } else if (viewId === 'view-member-detail') {
            html = `
                <h3>Quy trình Chi tiết Hồ sơ Bệnh án</h3>
                <ol>
                    <li><strong>Hồ Sơ:</strong> Xem thông tin tổng quan. Có thể ấn nút Cây bút góc trên để sửa hoặc xoá thành viên.</li>
                    <li><strong>Lịch sử khám:</strong> Nơi lưu trữ các lần đi khám. 
                        <ul>
                            <li>Nhấn <strong>Thêm Lượt Khám</strong> và tải ảnh/PDF lên.</li>
                            <li>Nhấn <strong>Xử lý thông tin</strong> để AI tự động trích xuất bệnh án.</li>
                            <li>Khi xem một bệnh án, bạn có thể <strong>nhấn vào các dòng chỉ số xét nghiệm</strong> để xem AI giải thích ngắn gọn ý nghĩa của chúng.</li>
                            <li><strong>Trao đổi chuyên sâu:</strong> Nhấn nút "Trao đổi chuyên sâu" dưới dòng giải thích hoặc bôi đen bất kỳ đoạn văn bản nào trên màn hình để mở Màn hình Chat với AI.</li>
                            <li><strong>Phân tích đơn thuốc:</strong> Nhấn nút "Phân tích đơn thuốc chuyên sâu" trong bệnh án để AI kiểm tra tương tác thuốc và tác dụng phụ.</li>
                        </ul>
                    </li>
                    <li><strong>Lịch hẹn:</strong> Đặt các lịch nhắc tái khám. Tới ngày, hệ thống sẽ báo chuông.</li>
                    <li><strong>Thống kê:</strong> Xem biểu đồ trực quan số lần đi khám của người này trong năm.</li>
                    <li><strong>Tùy chỉnh AI:</strong> Bạn có thể vào <strong>Cài đặt</strong> (bánh răng ở màn hình chính) để tự do lựa chọn AI (Gemini, ChatGPT, Claude) xử lý các tính năng trò chuyện, tra cứu.</li>
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
