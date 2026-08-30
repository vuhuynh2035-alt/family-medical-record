import sys

with open('js/help.js', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = '            // 1. Create Glowing Box'
end_marker = '        });\n    },\n\n    showWorkflowGuide()'

idx_start = content.find(start_marker)
idx_end = content.find(end_marker)

if idx_start == -1 or idx_end == -1:
    print('Failed to find markers')
    sys.exit(1)

new_code = '''            // 1. Create Glowing Box
            const box = document.createElement('div');
            box.className = 'help-highlight-box';
            box.style.top = (rect.top - padding) + 'px';
            box.style.left = (rect.left - padding) + 'px';
            box.style.width = (rect.width + padding * 2) + 'px';
            box.style.height = (rect.height + padding * 2) + 'px';
            box.style.cursor = 'pointer';
            box.style.pointerEvents = 'auto';

            box.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Highlight active box
                document.querySelectorAll('.help-highlight-box').forEach(b => {
                    b.style.boxShadow = '0 0 0 2px #e67e22, 0 0 15px rgba(230,126,34,0.5)';
                });
                box.style.boxShadow = '0 0 0 4px #fff, 0 0 25px rgba(230,126,34,1)';
                
                // Update Info Panel
                const infoPanel = document.getElementById('help-info-panel');
                if (infoPanel) {
                    infoPanel.innerHTML = \
                        <div style="font-weight: 700; color: #e67e22; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 6px;">
                            <span class="material-symbols-rounded">info</span> \
                        </div>
                        <div style="font-size: 14px; color: #333; line-height: 1.5; margin-top: 8px;">
                            \
                        </div>
                    \;
                    infoPanel.style.transform = 'translateX(-50%) scale(1.05)';
                    setTimeout(() => infoPanel.style.transform = 'translateX(-50%) scale(1)', 150);
                }
            });
            
            this.layer.appendChild(box);
'''

info_panel_code = '''
        // Create Info Panel
        const infoPanel = document.createElement('div');
        infoPanel.id = 'help-info-panel';
        infoPanel.className = 'neumorphic-panel';
        infoPanel.style.cssText = \
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            width: 90%;
            max-width: 400px;
            background: white;
            z-index: 9005;
            padding: 15px 20px;
            border-radius: 16px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            display: flex;
            flex-direction: column;
            pointer-events: auto;
            transition: transform 0.15s ease;
        \;
        infoPanel.innerHTML = \
            <div style="font-weight: 700; color: #e67e22; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 6px;">
                <span class="material-symbols-rounded">touch_app</span> Hướng dẫn tính năng
            </div>
            <div style="font-size: 14px; color: #555; line-height: 1.5; margin-top: 8px;">
                Chạm vào các ô sáng trên màn hình để xem giải thích chi tiết. Chạm ra ngoài để thoát.
            </div>
        \;
        
        // Prevent clicks on info panel from closing help mode
        infoPanel.addEventListener('click', (e) => e.stopPropagation());
        
        this.layer.appendChild(infoPanel);
'''

new_content = content[:idx_start] + new_code + end_marker[:11] + info_panel_code + end_marker[11:]
with open('js/help.js', 'w', encoding='utf-8') as f:
    f.write(new_content)
print('Done')
