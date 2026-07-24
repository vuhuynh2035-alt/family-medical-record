const HelpService = {
    isHelpModeActive: false,
    
    init() {
        this.btnHelp = document.getElementById('btn-help');
        this.backdrop = document.getElementById('help-backdrop');
        this.layer = document.getElementById('help-layer');
        this.btnWorkflow = document.getElementById('btn-workflow-guide');
        this.modalWorkflow = document.getElementById('modal-workflow-guide');
        this.workflowContent = document.getElementById('workflow-guide-content');

        console.log("HelpService.init() called, btnHelp:", this.btnHelp, "backdrop:", this.backdrop);
        if (this.btnHelp) {
            this.btnHelp.addEventListener('click', (e) => {
                console.log("btn-help clicked!");
                this.toggleHelpMode();
            });
        }
        if (this.backdrop) {
            this.backdrop.addEventListener('click', () => this.toggleHelpMode()); // Click outside to close
        }
        if (this.btnWorkflow) {
            this.btnWorkflow.addEventListener('click', () => this.showWorkflowGuide());
        }
        
        // Modal close button
        if (this.modalWorkflow) {
            const closeBtn = this.modalWorkflow.querySelector('.close-modal');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.modalWorkflow.classList.add('hidden');
                });
            }
        }

        window.addEventListener('resize', () => {
            if (this.isHelpModeActive) {
                this.renderHelpElements();
            }
        });
    },

    toggleHelpMode() {
        console.log("toggleHelpMode called, isHelpModeActive was:", this.isHelpModeActive);
        this.isHelpModeActive = !this.isHelpModeActive;
        
        if (this.isHelpModeActive) {
            this.backdrop.classList.remove('hidden');
            
            // Force inline styles to override any potential external interference (e.g. adblockers)
            this.backdrop.style.setProperty('display', 'block', 'important');
            this.backdrop.style.setProperty('position', 'fixed', 'important');
            this.backdrop.style.setProperty('top', '0', 'important');
            this.backdrop.style.setProperty('left', '0', 'important');
            this.backdrop.style.setProperty('width', '100vw', 'important');
            this.backdrop.style.setProperty('height', '100vh', 'important');
            this.backdrop.style.setProperty('z-index', '9999', 'important');
            this.backdrop.style.setProperty('pointer-events', 'auto', 'important');
            
            const comp = window.getComputedStyle(this.backdrop);
            console.log("Backdrop Diagnostics:", {
                inDOM: document.body.contains(this.backdrop),
                display: comp.display,
                width: comp.width,
                height: comp.height,
                zIndex: comp.zIndex,
                pointerEvents: comp.pointerEvents,
                opacity: comp.opacity
            });

            this.layer.classList.remove('hidden');
            this.btnWorkflow.classList.remove('hidden');
            this.renderHelpElements();
        } else {
            this.backdrop.classList.add('hidden');
            this.backdrop.style.removeProperty('display');
            this.backdrop.style.removeProperty('position');
            this.backdrop.style.removeProperty('top');
            this.backdrop.style.removeProperty('left');
            this.backdrop.style.removeProperty('width');
            this.backdrop.style.removeProperty('height');
            this.backdrop.style.removeProperty('z-index');
            this.backdrop.style.removeProperty('pointer-events');
            this.layer.classList.add('hidden');
            this.btnWorkflow.classList.add('hidden');
            this.layer.innerHTML = '';
        }
    },

    renderHelpElements() {
        console.log("renderHelpElements called");
        this.layer.innerHTML = ''; // Clear previous
        this.backdrop.innerHTML = ''; // Clear previous canvas
        
        // Find active view
        const activeView = document.querySelector('.view.active');
        console.log("activeView is:", activeView ? activeView.id : 'null');
        if (!activeView) return;

        // Find all elements with data-help in this view
        const elements = activeView.querySelectorAll('[data-help-title]');
        console.log("Found help elements:", elements.length);
        
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
        console.log("Canvas appended to backdrop. Width:", canvas.width, "Height:", canvas.height);

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
            `;
        } else if (viewId === 'view-member-detail') {
            html = `
                <h3>Quy trình Chi tiết Hồ sơ Bệnh án</h3>
                <ol>
                    <li><strong>Hồ Sơ:</strong> Xem thông tin tổng quan. Có thể ấn nút Cây bút góc trên để sửa hoặc xoá thành viên.</li>
                    <li><strong>Lịch sử khám:</strong> Nơi lưu trữ các lần đi khám. 
                        <ul>
                            <li>Nhấn <strong>Thêm Lượt Khám</strong>.</li>
                            <li>Sử dụng chức năng <strong>Chọn tệp (Ảnh/PDF)</strong> để tải ảnh đơn thuốc/xét nghiệm.</li>
                            <li>Nhấn <strong>Xử lý thông tin</strong> để AI tự động đọc và phân tích toàn bộ bệnh án.</li>
                            <li>Kiểm tra lại kết quả và nhấn <strong>Lưu bệnh án</strong>.</li>
                        </ul>
                    </li>
                    <li><strong>Lịch hẹn:</strong> Đặt các lịch nhắc tái khám. Tới ngày, hệ thống sẽ báo chuông.</li>
                    <li><strong>Thống kê:</strong> Xem biểu đồ trực quan số lần đi khám của người này trong năm.</li>
                    <li><strong>Kết thúc:</strong> Nhấn nút mũi tên <strong>Quay lại</strong> ở góc trên trái để về lại Trang chủ.</li>
                </ol>
            `;
        } else {
            html = '<p>Chưa có hướng dẫn cho trang này.</p>';
        }
        
        this.workflowContent.innerHTML = html;
        this.modalWorkflow.classList.remove('hidden');
    }
};

// Initialize after DOM loads
document.addEventListener('DOMContentLoaded', () => {
    HelpService.init();
});
