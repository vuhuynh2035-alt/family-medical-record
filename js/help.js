const HelpService = {
    isHelpModeActive: false,
    
    init() {
        this.btnHelp = document.getElementById('btn-help');
        this.btnHelpMobile = document.getElementById('btn-help-mobile');
        this.btnWorkflow = document.getElementById('btn-workflow-guide');
        this.btnAiHelp = document.getElementById('btn-ai-help-chat');
        this.modalWorkflow = document.getElementById('modal-workflow-guide');
        this.modalAiHelp = document.getElementById('modal-ai-help-chat');
        this.workflowContent = document.getElementById('workflow-guide-content');

        if (this.btnHelp) {
            this.btnHelp.addEventListener('click', () => this.toggleHelpMode());
        }
        if (this.btnHelpMobile) {
            this.btnHelpMobile.addEventListener('click', () => this.toggleHelpMode());
        }
        
        // Intercept clicks during help mode globally
        document.addEventListener('click', (e) => {
            if (!this.isHelpModeActive) return;
            
            // Allow clicks on help buttons to toggle it off
            if (e.target.closest('#btn-help') || e.target.closest('#btn-help-mobile')) {
                return;
            }
            // Allow clicks on the info panel itself
            if (e.target.closest('#help-info-panel')) {
                return;
            }
            // Allow clicks on workflow / ai help buttons
            if (e.target.closest('.btn-workflow-guide') || e.target.closest('#btn-ai-help-chat') || e.target.closest('.modal-overlay')) {
                return;
            }

            // In help mode, block all other interactions!
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            const helpEl = e.target.closest('[data-help-title]');
            if (helpEl) {
                // Highlight the element
                document.querySelectorAll('.help-highlight-active').forEach(el => el.classList.remove('help-highlight-active'));
                helpEl.classList.add('help-highlight-active');
                
                // Show info
                const title = helpEl.getAttribute('data-help-title');
                const desc = helpEl.getAttribute('data-help-desc');
                this.updateInfoPanel(title, desc);
            }
        }, true); // Use capture phase to run before other handlers

        document.body.addEventListener('click', (e) => {
            if (e.target.closest('.btn-workflow-guide') || e.target.closest('#btn-workflow-guide')) {
                this.toggleHelpMode();
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
    },
    
    toggleHelpMode() {
        this.isHelpModeActive = !this.isHelpModeActive;
        
        if (this.isHelpModeActive) {
            document.body.classList.add('help-mode-active');
            this.createInfoPanel();
            
            if (this.btnAiHelp) this.btnAiHelp.classList.remove('hidden');
        } else {
            document.body.classList.remove('help-mode-active');
            this.removeInfoPanel();
            
            if (this.btnAiHelp) this.btnAiHelp.classList.add('hidden');
            if (this.modalAiHelp) this.modalAiHelp.classList.add('hidden');
            if (this.modalWorkflow) this.modalWorkflow.classList.add('hidden');
            
            document.querySelectorAll('.help-highlight-active').forEach(el => el.classList.remove('help-highlight-active'));
        }
    },

    createInfoPanel() {
        this.removeInfoPanel();
        const infoPanel = document.createElement('div');
        infoPanel.id = 'help-info-panel';
        infoPanel.className = 'neumorphic-panel';
        infoPanel.style.cssText = `
            position: fixed;
            top: 75px;
            left: 50%;
            transform: translateX(-50%);
            width: 90%;
            max-width: 400px;
            background: white;
            z-index: 10005;
            padding: 15px 20px;
            border-radius: 16px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            display: flex;
            flex-direction: column;
            pointer-events: auto;
            transition: transform 0.15s ease;
        `;
        infoPanel.innerHTML = `
            <button id="btn-close-help-panel" style="position: absolute; right: 10px; top: 10px; background: rgba(0,0,0,0.05); border: none; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; color: #555; cursor: pointer; z-index: 10;">
                <span class="material-symbols-rounded" style="font-size: 18px;">close</span>
            </button>
            <div id="help-info-content">
                <div style="font-weight: 700; color: #e67e22; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0 20px;">
                    <span class="material-symbols-rounded">touch_app</span> Chế độ Hướng dẫn
                </div>
                <div style="font-size: 14px; color: #555; line-height: 1.5; margin-top: 8px;">
                    Chạm vào các ô viền vàng trên màn hình để xem giải thích chi tiết.<br>
                    <button id="btn-open-workflow-guide-from-panel" style="margin-top: 15px; background: #e67e22; color: white; border: none; border-radius: 8px; padding: 10px 15px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; width: 100%; font-size: 14px; box-shadow: 0 4px 6px rgba(230, 126, 34, 0.2);">
                        <span class="material-symbols-rounded" style="font-size: 18px;">menu_book</span> Xem Cẩm nang Quy trình
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(infoPanel);
        
        document.getElementById('btn-close-help-panel').addEventListener('click', () => {
            this.toggleHelpMode();
        });

        const btnWorkflow = document.getElementById('btn-open-workflow-guide-from-panel');
        if (btnWorkflow) {
            btnWorkflow.addEventListener('click', () => {
                this.toggleHelpMode(); // Tắt chế độ overlay
                this.showWorkflowGuide(); // Mở modal cẩm nang
            });
        }
    },
    
    updateInfoPanel(title, desc) {
        const content = document.getElementById('help-info-content');
        const infoPanel = document.getElementById('help-info-panel');
        if (content && infoPanel) {
            content.innerHTML = `
                <div style="font-weight: 700; color: #e67e22; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0 20px;">
                    <span class="material-symbols-rounded">info</span> ${title}
                </div>
                <div style="font-size: 14px; color: #333; line-height: 1.5; margin-top: 8px;">
                    ${desc}
                </div>
            `;
            infoPanel.style.transform = 'translateX(-50%) scale(1.05)';
            setTimeout(() => { if (infoPanel) infoPanel.style.transform = 'translateX(-50%) scale(1)'; }, 150);
        }
    },
    
    removeInfoPanel() {
        const p = document.getElementById('help-info-panel');
        if (p) p.remove();
    },

    showWorkflowGuide() {
        const activeView = document.querySelector('.view.active');
        const viewId = activeView ? activeView.id : 'unknown';
        let html = '';

        if (viewId === 'view-dashboard') {
            html = `
                <h3>Luồng 1: Tạo hồ sơ mới</h3>
                <ol>
                    <li>Bấm nút <strong>"Thêm thành viên"</strong> để tạo profile.</li>
                    <li>Điền tên, ngày sinh, và bấm <strong>"Lưu"</strong>.</li>
                    <li>Bấm vào tên người vừa tạo để vào trang chi tiết.</li>
                </ol>
            `;
        } else if (viewId === 'view-member-detail') {
            html = `
                <h3>Luồng 2: Nhập kết quả khám</h3>
                <ol>
                    <li>Trong tab <strong>"Hồ sơ"</strong>, bấm <strong>"Hồ sơ mới"</strong>.</li>
                    <li>Nhập tay thông tin hoặc bấm <strong>"AI quét ảnh"</strong>.</li>
                    <li>Nếu dùng AI: tải ảnh Đơn thuốc/Xét nghiệm lên, chờ 5-10 giây.</li>
                    <li>Sau khi AI đọc xong, kiểm tra lại thông tin và bấm <strong>"Lưu"</strong>.</li>
                </ol>
            `;
        } else {
            html = `
                <h3>Quy trình cơ bản</h3>
                <ol>
                    <li>Tạo thành viên ở Trang chủ.</li>
                    <li>Vào chi tiết thành viên để thêm hồ sơ khám bệnh.</li>
                    <li>Sử dụng AI để tự động đọc Đơn thuốc / Phiếu xét nghiệm.</li>
                    <li>Lưu lại lời nhắc nhở hệ thống gợi ý.</li>
                </ol>
            `;
        }

        if (this.workflowContent) this.workflowContent.innerHTML = html;
        if (this.modalWorkflow) this.modalWorkflow.classList.remove('hidden');
    },

    showAiHelpChat() {
        if (this.modalAiHelp) this.modalAiHelp.classList.remove('hidden');
    },

    async sendAiHelpMessage() {
        const input = document.getElementById('input-ai-help-chat');
        const chatMessages = document.getElementById('ai-help-messages');
        const text = input.value.trim();
        if (!text) return;

        // User message
        const userMsg = document.createElement('div');
        userMsg.className = 'chat-message user';
        userMsg.textContent = text;
        chatMessages.appendChild(userMsg);
        
        input.value = '';
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Loading message
        const aiMsg = document.createElement('div');
        aiMsg.className = 'chat-message ai';
        aiMsg.innerHTML = '<span class="material-symbols-rounded">sync</span> AI đang trả lời...';
        chatMessages.appendChild(aiMsg);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        try {
            const prompt = `Bạn là trợ lý AI hướng dẫn sử dụng phần mềm quản lý Sổ khám bệnh gia đình. 
Trả lời ngắn gọn, thân thiện câu hỏi sau của người dùng: "${text}"`;
            const responseText = await AIProcessor.processWithAI(null, prompt);
            aiMsg.innerHTML = responseText.replace(/\n/g, '<br>');
        } catch (e) {
            aiMsg.innerHTML = '<span style="color:red">Lỗi kết nối AI. Vui lòng thử lại.</span>';
        }
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
};

// Initialize after DOM loads
document.addEventListener('DOMContentLoaded', () => {
    HelpService.init();
});
