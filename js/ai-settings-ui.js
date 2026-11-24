/**
 * AISettingsUI — giao diện "Cài đặt Trí tuệ nhân tạo": chọn quốc gia -> chỉ hiện các AI phù hợp,
 * 2 ô API Key (miễn phí / trả phí) cho mỗi AI, mô hình theo từng tác vụ (Tự động hoặc chọn tay),
 * và hạn mức trần chi phí API trả phí. Logic chính sách nằm ở js/ai-policy.js.
 */
const AISettingsUI = {
    draftKeys: {}, // khóa đã gõ nhưng chưa lưu (giữ lại khi đổi quốc gia qua lại)
    _bound: false,

    init() {
        if (this._bound) return;
        this._bound = true;
        document.getElementById('input-ai-region')?.addEventListener('change', () => {
            this.captureKeys();
            this.renderHint();
            this.renderKeys();
            this.renderTasks(this.collectTasks());
        });
    },

    /** Dựng lại toàn bộ khu vực cài đặt AI từ dữ liệu đã lưu (gọi mỗi lần mở Cài đặt). */
    render() {
        this.draftKeys = {};
        const region = document.getElementById('input-ai-region');
        if (region) region.value = AIConfig.getRegion();
        this.renderHint();
        this.renderKeys();
        this.renderTasks(DataManager.getSettings().aiTasks || {});
    },

    currentRegion() {
        const el = document.getElementById('input-ai-region');
        return (el && el.value) || AIConfig.getRegion();
    },

    renderHint() {
        const el = document.getElementById('ai-region-hint');
        if (!el) return;
        el.textContent = AIConfig.getGroup(this.currentRegion()) === 'cn'
            ? 'Đang hiển thị AI của Trung Quốc (DeepSeek, Zhipu GLM). Các AI quốc tế được ẩn cho gọn.'
            : 'Mặc định dùng Google Gemini. AI của Trung Quốc được ẩn cho gọn.';
    },

    captureKeys() {
        AIConfig.visibleProviders(this._renderedRegion).forEach(p => {
            const f = document.getElementById(`ai-key-${p}-free`);
            const d = document.getElementById(`ai-key-${p}-paid`);
            const c = document.getElementById(`ai-cap-${p}`);
            if (!f && !d) return;
            this.draftKeys[p] = { free: f ? f.value.trim() : undefined, paid: d ? d.value.trim() : undefined, cap: c ? c.value.trim() : undefined };
        });
    },

    renderKeys() {
        const box = document.getElementById('ai-keys-container');
        if (!box) return;
        const region = this.currentRegion();
        this._renderedRegion = region;
        box.innerHTML = '';
        AIConfig.visibleProviders(region).forEach(p => {
            const prov = AIConfig.PROVIDERS[p];
            const saved = AIConfig.getKeys(p, true);
            const draft = this.draftKeys[p] || {};
            const wrap = document.createElement('div');
            wrap.className = 'form-group';
            wrap.style.cssText = 'margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px dashed rgba(0,0,0,0.08);';

            const head = document.createElement('div');
            head.style.cssText = 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:5px; margin-bottom:6px;';
            const title = document.createElement('span');
            title.style.cssText = `font-weight:600; color:${prov.color};`;
            title.textContent = `${prov.name} — API Key`;
            const links = document.createElement('div');
            links.style.cssText = 'display:flex; gap:8px; font-size:12px;';
            const a1 = document.createElement('a');
            a1.href = prov.keyUrl; a1.target = '_blank'; a1.rel = 'noopener noreferrer';
            a1.style.cssText = `color:${prov.color}; font-weight:600; text-decoration:underline;`;
            a1.textContent = 'Lấy key ↗';
            const a2 = document.createElement('a');
            a2.href = '#'; a2.className = 'btn-create-key'; a2.dataset.provider = p;
            a2.style.cssText = 'color:var(--text-muted); text-decoration:underline;';
            a2.textContent = '(Hướng dẫn)';
            links.append(a1, a2);
            head.append(title, links);
            wrap.appendChild(head);

            const addInput = (slot, placeholder, value) => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex; gap:8px; align-items:center; margin-top:6px;';
                const tag = document.createElement('span');
                tag.style.cssText = `font-size:11.5px; font-weight:700; padding:3px 7px; border-radius:6px; white-space:nowrap; ${slot === 'free' ? 'background:rgba(16,185,129,0.15); color:#047857;' : 'background:rgba(245,158,11,0.18); color:#b45309;'}`;
                tag.textContent = slot === 'free' ? 'Miễn phí' : 'Trả phí';
                const input = document.createElement('input');
                input.type = 'password';
                input.id = `ai-key-${p}-${slot}`;
                input.className = 'neumorphic-input';
                input.placeholder = placeholder;
                input.autocomplete = 'off';
                input.style.flex = '1';
                input.value = value || '';
                input.addEventListener('input', () => this.renderQuotaStatus(p));
                // Công tắc BẬT/TẮT riêng cho key này: tắt = app không dùng key (key vẫn được giữ lại)
                const sw = document.createElement('label');
                sw.className = 'ai-key-switch';
                sw.title = 'Bật/tắt dùng API Key này. Tắt = app tạm không dùng key (key vẫn được giữ), bật lại khi cần.';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.id = `ai-key-${p}-${slot}-on`;
                cb.checked = !AIConfig.isKeyOff(p, slot);
                const track = document.createElement('span');
                track.className = 'ai-key-switch-track';
                const txt = document.createElement('span');
                txt.className = 'ai-key-switch-text';
                const paint = () => { txt.textContent = cb.checked ? 'Bật' : 'Tắt'; input.classList.toggle('ai-key-off', !cb.checked); };
                paint();
                cb.addEventListener('change', () => {
                    AIConfig.setKeyOff(p, slot, !cb.checked); // lưu ngay: đây là công tắc an toàn
                    paint();
                    this.renderQuotaStatus(p);
                    this.renderTasks(this.collectTasks());
                    showToast(`${cb.checked ? 'Đã BẬT' : 'Đã TẮT'} API Key ${slot === 'free' ? 'miễn phí' : 'trả phí'} của ${prov.short}.`, cb.checked ? 'success' : 'error');
                });
                sw.append(cb, track, txt);
                row.append(tag, sw, input);
                wrap.appendChild(row);
            };
            if (prov.freeSlot) {
                addInput('free', `Key miễn phí — được ưu tiên dùng trước (${prov.placeholder})`, draft.free !== undefined ? draft.free : saved.free);
                addInput('paid', 'Key trả phí — chỉ dùng khi bạn đồng ý', draft.paid !== undefined ? draft.paid : saved.paid);
            } else {
                addInput('paid', `Key trả phí (${prov.placeholder}) — chỉ dùng khi bạn đồng ý`, draft.paid !== undefined ? draft.paid : saved.paid);
            }
            wrap.appendChild(this.buildQuotaBox(p, prov, draft));
            wrap.appendChild(this.buildModelTools(p, prov));
            box.appendChild(wrap);
            this.renderModelList(p);
        });
    },

    /** Khung hạn mức của RIÊNG nhà cung cấp p: hạn mức miễn phí (nếu có) + hạn mức trần trả phí. */
    buildQuotaBox(p, prov, draft) {
        const box = document.createElement('div');
        box.id = `ai-quota-${p}`;
        box.style.cssText = 'margin-top:10px; padding:10px 12px; border-radius:10px; background:rgba(0,0,0,0.03); font-size:12.5px; line-height:1.55;';
        if (prov.freeSlot) {
            const free = document.createElement('div');
            free.id = `ai-free-${p}`;
            free.style.marginBottom = '8px';
            box.appendChild(free);
        }
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; gap:8px; flex-wrap:wrap;';
        const lab = document.createElement('label');
        lab.setAttribute('for', `ai-cap-${p}`);
        lab.style.cssText = 'font-weight:600; white-space:nowrap;';
        lab.textContent = 'Hạn mức trần trả phí / tháng (USD)';
        const input = document.createElement('input');
        input.type = 'number'; input.id = `ai-cap-${p}`;
        input.className = 'neumorphic-input';
        input.min = '0'; input.step = '0.5'; input.inputMode = 'decimal';
        input.style.cssText = 'max-width:110px; padding:6px 10px;';
        input.placeholder = prov.freeSlot ? String(AIConfig.DEFAULT_CAP_USD) : 'bắt buộc > 0';
        if (draft && draft.cap !== undefined) input.value = draft.cap;
        else if (AIConfig.hasOwnCap(p)) input.value = String(AIConfig.getCap(p));
        else input.value = prov.freeSlot ? String(AIConfig.getCap(p)) : '';
        input.addEventListener('input', () => this.renderQuotaStatus(p));
        row.append(lab, input);
        box.appendChild(row);
        const hint = document.createElement('div');
        hint.className = 'help-text';
        hint.style.cssText = 'margin:4px 0 0;';
        hint.textContent = prov.freeSlot
            ? 'Nhập 0 nếu không muốn app dùng API trả phí của AI này. Hết hạn mức trần thì app dừng dùng API trả phí của AI này.'
            : 'AI này không có gói miễn phí: chưa nhập hoặc nhập 0 thì API bị đóng, không dùng được. Hết hạn mức trần thì app dừng dùng AI này.';
        box.appendChild(hint);
        const spend = document.createElement('div');
        spend.id = `ai-spend-text-${p}`;
        spend.style.marginTop = '6px';
        box.appendChild(spend);
        const barWrap = document.createElement('div');
        barWrap.style.cssText = 'height:7px; border-radius:4px; background:rgba(0,0,0,0.08); margin-top:5px; overflow:hidden;';
        const bar = document.createElement('div');
        bar.id = `ai-spend-bar-${p}`;
        bar.style.cssText = 'height:100%; width:0; background:#10b981; transition:width 0.3s;';
        barWrap.appendChild(bar);
        box.appendChild(barWrap);
        const btns = document.createElement('div');
        btns.style.cssText = 'display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;';
        const reset = document.createElement('button');
        reset.type = 'button'; reset.className = 'secondary-btn neumorphic-btn';
        reset.style.cssText = 'font-size:12px; padding:5px 10px;';
        reset.textContent = 'Đặt lại số đã dùng tháng này';
        reset.addEventListener('click', async () => {
            if (await window.showConfirm(`Đặt lại số tiền ước tính đã dùng của ${prov.short} trong tháng này về 0?`)) {
                AIConfig.resetSpend(p);
                this.renderQuotaStatus(p);
            }
        });
        const allow = document.createElement('button');
        allow.type = 'button'; allow.id = `ai-allow-paid-${p}`;
        allow.className = 'secondary-btn neumorphic-btn hidden';
        allow.style.cssText = 'font-size:12px; padding:5px 10px;';
        allow.textContent = 'Cho phép dùng API trả phí tới lúc hạn mức miễn phí phục hồi';
        btns.append(reset, allow);
        box.appendChild(btns);
        queueMicrotask(() => this.renderQuotaStatus(p));
        return box;
    },

    /** Mở Cài đặt, mở mục AI, cuộn tới đúng ô (hạn mức trần / key trả phí của một AI) và làm nổi bật. */
    focusField(inputId) {
        const modal = document.getElementById('modal-settings');
        if (modal && modal.classList.contains('hidden')) document.getElementById('btn-settings')?.click();
        const go = (tries) => {
            const el = document.getElementById(inputId);
            if (!el) { if (tries > 0) setTimeout(() => go(tries - 1), 120); return; }
            let d = el.closest('details');
            while (d) { d.open = true; d = d.parentElement ? d.parentElement.closest('details') : null; }
            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
            el.focus({ preventScroll: true });
            el.classList.add('quota-highlight');
            setTimeout(() => el.classList.remove('quota-highlight'), 3000);
        };
        setTimeout(() => go(8), 150);
    },

    /** Hạn mức trần đang hiệu lực theo ô nhập (chưa lưu): AI không có gói miễn phí để trống = 0 = đóng. */
    _capFromInput(p) {
        const el = document.getElementById(`ai-cap-${p}`);
        const raw = el ? el.value.trim() : '';
        if (raw === '') return AIConfig.PROVIDERS[p].freeSlot ? AIConfig.DEFAULT_CAP_USD : 0;
        const v = Number(raw);
        return Number.isFinite(v) && v >= 0 ? v : 0;
    },

    /** Cập nhật dòng trạng thái hạn mức miễn phí + mức dùng/trần trả phí của nhà cung cấp p. */
    renderQuotaStatus(p) {
        const prov = AIConfig.PROVIDERS[p];
        const now = Date.now();
        const paidEl = document.getElementById(`ai-key-${p}-paid`);
        const paidOff = AIConfig.isKeyOff(p, 'paid');
        const paidKey = paidOff ? '' : (paidEl ? paidEl.value.trim() : AIConfig.getKeys(p).paid);
        const cap = this._capFromInput(p);
        const sp = AIConfig.getSpend(p);

        const free = document.getElementById(`ai-free-${p}`);
        const allow = document.getElementById(`ai-allow-paid-${p}`);
        if (allow) { allow.classList.add('hidden'); allow.onclick = null; }
        if (free) {
            free.dataset.provider = p;
            const rule = AIConfig.freeRule(p);
            const states = AIConfig.freeStatesOf(p, now);
            const blocked = states.filter(st => st.exhausted);
            const totalCalls = states.reduce((n, st) => n + (st.calls || 0), 0);
            free.innerHTML = '';
            const line = document.createElement('div');
            line.style.fontWeight = '600';
            if (blocked.length) {
                line.style.color = '#b91c1c';
                line.textContent = `⛔ API MIỄN PHÍ đang hết hạn mức (${blocked.length} mô hình):`;
            } else {
                line.style.color = '#047857';
                line.textContent = `✅ API miễn phí còn dùng được · app đã ghi nhận ${totalCalls} lượt miễn phí hôm nay.`;
            }
            free.appendChild(line);
            blocked.forEach(st => {
                const row = document.createElement('div');
                row.style.cssText = 'margin:3px 0 0 4px;';
                const name = AIConfig.modelLabel(p, st.model);
                row.append(`• ${name}: hết ${AIConfig.kindRule(p, st.kind).label} — phục hồi sau `);
                const cd = document.createElement('b');
                cd.className = 'quota-countdown-clock';
                cd.dataset.countdownTo = String(st.resetAt);
                cd.textContent = AIConfig.formatCountdown(st.resetAt - now);
                row.append(cd, ` (lúc ${AIConfig.formatResetAt(st.resetAt)})`);
                const mode = document.createElement('div');
                mode.style.cssText = 'margin-left:12px; color:var(--text-muted);';
                if (st.kind === 'minute') mode.textContent = 'Giới hạn ngắn hạn: app tự chờ rồi thử lại, không cần dùng API trả phí.';
                else if (paidOff) mode.textContent = 'API trả phí đang TẮT: app tạm dừng mô hình này tới lúc phục hồi rồi tự dùng lại. Bật công tắc API trả phí nếu muốn dùng tiếp ngay.';
                else if (!paidKey) mode.textContent = 'Chưa có API trả phí: app tạm dừng mô hình này tới lúc phục hồi rồi tự dùng lại.';
                else if (cap <= 0 || sp.usd >= cap) mode.textContent = 'API trả phí đang đóng (hạn mức trần = 0 hoặc đã chạm trần): app tạm dừng mô hình này tới lúc phục hồi.';
                else if (AIConfig._approved[AIConfig.freeKey(p, st.model)] === st.resetAt) mode.textContent = 'Đang dùng API trả phí theo sự đồng ý của bạn; tới giờ phục hồi app tự chuyển về API miễn phí.';
                else if (AIConfig._declined[AIConfig.freeKey(p, st.model)] === st.resetAt) {
                    mode.textContent = 'Bạn đã từ chối dùng API trả phí: app tạm dừng mô hình này tới lúc phục hồi.';
                    if (allow) {
                        allow.classList.remove('hidden');
                        allow.onclick = () => { AIConfig.allowPaidUntilReset(p, st.model); this.renderQuotaStatus(p); };
                    }
                } else mode.textContent = 'Khi cần dùng mô hình này, app sẽ hỏi bạn có đồng ý dùng API trả phí cho tới lúc phục hồi hay không.';
                free.append(row, mode);
            });
            if (rule) {
                const r = document.createElement('div');
                r.className = 'help-text';
                r.style.cssText = 'margin:4px 0 0;';
                r.textContent = rule.text;
                free.appendChild(r);
            }
            if (blocked.length) QuotaUI.startTicker();
        }

        const txt = document.getElementById(`ai-spend-text-${p}`);
        const bar = document.getElementById(`ai-spend-bar-${p}`);
        let pct = 0;
        if (txt) {
            if (cap <= 0) {
                txt.style.color = '#b91c1c';
                txt.textContent = prov.freeSlot
                    ? 'Hạn mức trần trả phí = 0: app không dùng API trả phí của AI này.'
                    : '⛔ Hết hạn mức API: chưa nhập hạn mức (hoặc = 0) nên API này đang đóng.';
                pct = 100;
            } else {
                const reached = sp.usd >= cap;
                txt.style.color = reached ? '#b91c1c' : '';
                txt.textContent = `Tháng ${sp.month}: đã dùng ước tính $${sp.usd.toFixed(2)} / trần $${cap.toFixed(2)} (${sp.calls || 0} lượt gọi trả phí).` + (reached ? ' ĐÃ CHẠM TRẦN — app không dùng API trả phí của AI này.' : '');
                pct = Math.min(100, (sp.usd / cap) * 100);
            }
        }
        if (bar) {
            bar.style.width = pct + '%';
            bar.style.background = pct >= 100 ? '#e11d48' : (pct >= 80 ? '#f59e0b' : '#10b981');
        }
    },

    /** Nút «Tải mô hình» + danh sách mô hình của RIÊNG nhà cung cấp p (đặt ngay dưới ô API Key của AI đó). */
    buildModelTools(p, prov) {
        const tools = document.createElement('div');
        tools.style.cssText = 'margin-top:10px;';
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; gap:10px; flex-wrap:wrap;';
        if (this.LISTABLE.includes(p)) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = `ai-load-models-${p}`;
            btn.className = 'secondary-btn neumorphic-btn';
            btn.style.cssText = 'padding:6px 12px; font-size:12.5px;';
            btn.dataset.helpTitle = `Tải mô hình ${prov.short}`;
            btn.dataset.helpDesc = `Kết nối tới ${prov.name} bằng API Key ở trên để tải danh sách các mô hình mới nhất mà key này dùng được.`;
            btn.innerHTML = '<span class="material-symbols-rounded" style="font-size:17px; margin-right:5px; vertical-align:text-bottom;">sync</span>Tải mô hình';
            btn.addEventListener('click', () => this.loadModels(p));
            row.appendChild(btn);
        } else {
            const note = document.createElement('span');
            note.className = 'help-text';
            note.style.margin = '0';
            note.textContent = `${prov.short} không có API liệt kê mô hình — dùng danh sách có sẵn bên dưới.`;
            row.appendChild(note);
        }
        const status = document.createElement('span');
        status.id = `ai-load-status-${p}`;
        status.style.cssText = 'font-size:12px; color:var(--text-muted);';
        row.appendChild(status);
        tools.appendChild(row);
        const list = document.createElement('details');
        list.id = `ai-models-${p}`;
        list.style.cssText = 'margin-top:8px;';
        tools.appendChild(list);
        return tools;
    },

    /** Vẽ danh sách mô hình của nhà cung cấp p (có sẵn + đã tải), mới nhất lên đầu. */
    renderModelList(p) {
        const box = document.getElementById(`ai-models-${p}`);
        if (!box) return;
        const prov = AIConfig.PROVIDERS[p];
        const st = DataManager.getSettings();
        const builtin = new Set(prov.models.map(m => m.id));
        const all = AIConfig.getModelsOf(p);
        const order = AIConfig.sortNewest(all.map(m => m.id));
        const byId = new Map(all.map(m => [m.id, m]));
        const at = (st.customModelsAt || {})[p];
        box.innerHTML = '';
        const sum = document.createElement('summary');
        sum.style.cssText = 'cursor:pointer; font-size:12.5px; font-weight:600; color:var(--text-muted);';
        const when = at ? ` · tải lúc ${new Date(at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}` : '';
        sum.textContent = `Mô hình của ${prov.short} (${all.length})${when}`;
        box.appendChild(sum);
        const ul = document.createElement('ul');
        ul.style.cssText = 'margin:6px 0 0; padding-left:18px; font-size:12.5px; line-height:1.7; max-height:220px; overflow:auto;';
        order.forEach(id => {
            const m = byId.get(id);
            const li = document.createElement('li');
            const name = document.createElement('b');
            name.textContent = m.label === id ? id : m.label;
            li.appendChild(name);
            if (m.label !== id) li.append(` (${id})`);
            const tag = document.createElement('span');
            tag.style.cssText = `margin-left:6px; font-size:11px; padding:1px 6px; border-radius:6px; ${m.paid ? 'background:rgba(245,158,11,0.18); color:#b45309;' : 'background:rgba(16,185,129,0.15); color:#047857;'}`;
            tag.textContent = m.paid ? 'trả phí' : 'miễn phí';
            li.appendChild(tag);
            if (!builtin.has(id)) {
                const nw = document.createElement('span');
                nw.style.cssText = 'margin-left:4px; font-size:11px; color:var(--primary-blue);';
                nw.textContent = 'đã tải';
                li.appendChild(nw);
            }
            ul.appendChild(li);
        });
        box.appendChild(ul);
    },

    collectTasks() {
        const out = {};
        AIConfig.TASKS.forEach(t => {
            const sel = document.getElementById(`ai-task-${t.id}`);
            if (sel) out[t.id] = sel.value;
        });
        return out;
    },

    renderTasks(current) {
        const box = document.getElementById('ai-tasks-container');
        if (!box) return;
        const region = this.currentRegion();
        box.innerHTML = '';
        AIConfig.TASKS.forEach(t => {
            const group = document.createElement('div');
            group.className = 'form-group';
            group.style.marginBottom = '10px';
            const label = document.createElement('label');
            label.setAttribute('for', `ai-task-${t.id}`);
            label.style.cssText = 'font-weight:600; font-size:13.5px; color:var(--primary-blue);';
            label.textContent = t.label;
            const sel = document.createElement('select');
            sel.id = `ai-task-${t.id}`;
            sel.className = 'neumorphic-input';
            sel.style.fontWeight = '500';
            const choices = AIConfig.choicesFor(t.id, region);
            choices.forEach(c => {
                const o = document.createElement('option');
                o.value = c.value;
                o.textContent = c.label;
                sel.appendChild(o);
            });
            const want = current && current[t.id];
            sel.value = want && choices.some(c => c.value === want) ? want : 'auto';
            group.append(label, sel);
            box.appendChild(group);
        });
    },

    /** Gom giá trị đang nhập thành object để lưu vào cài đặt. */
    collect() {
        this.captureKeys();
        const patch = { aiRegion: this.currentRegion(), aiTasks: this.collectTasks() };
        Object.keys(this.draftKeys).forEach(p => {
            const k = this.draftKeys[p];
            const prov = AIConfig.PROVIDERS[p];
            if (!prov) return;
            if (prov.freeSlot) {
                if (k.free !== undefined) Object.assign(patch, AIConfig.keyPatch(p, 'free', k.free));
                if (k.paid !== undefined) Object.assign(patch, AIConfig.keyPatch(p, 'paid', k.paid));
            } else if (k.paid !== undefined) {
                Object.assign(patch, AIConfig.keyPatch(p, 'paid', k.paid));
            }
        });
        // Hạn mức trần trả phí RIÊNG từng AI: để trống = chưa đặt (AI không có gói miễn phí sẽ bị đóng), số >= 0 = đã đặt
        const caps = Object.assign({}, DataManager.getSettings().aiCaps);
        Object.keys(this.draftKeys).forEach(p => {
            const raw = this.draftKeys[p].cap;
            if (raw === undefined || !AIConfig.PROVIDERS[p]) return;
            const v = parseFloat(raw);
            if (raw === '' || !Number.isFinite(v) || v < 0) delete caps[p];
            else caps[p] = Math.round(v * 100) / 100;
        });
        patch.aiCaps = caps;
        return patch;
    },

    // Nhà cung cấp có API liệt kê mô hình (Zhipu thì không).
    LISTABLE: ['gemini', 'openai', 'anthropic', 'deepseek'],

    /** Các key đang có của nhà cung cấp p (ô đang gõ trước, rồi key đã lưu), không trùng. */
    _keysFor(p) {
        this.captureKeys();
        const d = this.draftKeys[p] || {};
        const saved = AIConfig.getKeys(p, true);
        const list = [];
        if (!AIConfig.isKeyOff(p, 'free')) list.push(d.free !== undefined ? d.free : saved.free);
        if (!AIConfig.isKeyOff(p, 'paid')) list.push(d.paid !== undefined ? d.paid : saved.paid);
        return [...new Set(list.filter(Boolean))];
    },

    /** Tải danh sách mô hình mới nhất mà key của RIÊNG nhà cung cấp p dùng được, lưu và hiện ngay dưới AI đó. */
    async loadModels(p) {
        const prov = AIConfig.PROVIDERS[p];
        const btn = document.getElementById(`ai-load-models-${p}`);
        const status = document.getElementById(`ai-load-status-${p}`);
        const say = (text, ok) => {
            if (status) { status.textContent = text; status.style.color = ok ? '#047857' : '#e11d48'; }
        };
        const keys = this._keysFor(p);
        if (!keys.length) {
            say('Hãy nhập API Key của AI này trước.', false);
            return;
        }
        const orig = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.textContent = 'Đang tải...'; }
        say('', true);
        try {
            const found = new Set();
            let firstError = null;
            for (const key of keys) {
                try {
                    (await this._listModels(p, key)).forEach(id => found.add(id));
                } catch (e) {
                    firstError = firstError || e;
                }
            }
            if (!found.size) throw firstError || new Error('không có mô hình nào');
            const known = new Set(prov.models.map(m => m.id));
            const fresh = AIConfig.sortNewest([...found].filter(id => !known.has(id))).slice(0, 40);
            const custom = Object.assign({}, DataManager.getSettings().customModels, { [p]: fresh });
            const at = Object.assign({}, DataManager.getSettings().customModelsAt, { [p]: Date.now() });
            DataManager.saveSettings({ customModels: custom, customModelsAt: at });
            this.renderModelList(p);
            this.renderTasks(this.collectTasks());
            say(`Đã tải ${found.size} mô hình${firstError ? ' (một key bị lỗi: ' + firstError.message + ')' : ''}.`, true);
            showToast(`${prov.short}: đã tải ${found.size} mô hình`, 'success');
        } catch (e) {
            say(`Không tải được: ${e.message}`, false);
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = orig; }
        }
    },

    /** Trả về danh sách id mô hình dùng được với key (đọc hết các trang). Lỗi thì ném Error có lý do ngắn. */
    async _listModels(provider, key) {
        const getJson = async (url, headers) => {
            let res;
            try {
                res = await fetch(url, { headers });
            } catch {
                throw new Error('không kết nối được mạng');
            }
            if (!res.ok) throw new Error(res.status === 401 || res.status === 403 || res.status === 400 ? 'API Key không hợp lệ hoặc chưa được cấp quyền' : `máy chủ trả lỗi ${res.status}`);
            return res.json();
        };
        if (provider === 'gemini') {
            const out = [];
            let token = '';
            for (let page = 0; page < 10; page++) {
                const j = await getJson(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200${token ? '&pageToken=' + encodeURIComponent(token) : ''}`, { 'x-goog-api-key': key });
                (j.models || [])
                    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent') && /gemini/.test(m.name) && !/embed|tts|image|live|audio|robotics|computer/i.test(m.name))
                    .forEach(m => out.push(m.name.replace('models/', '')));
                token = j.nextPageToken || '';
                if (!token) break;
            }
            return out;
        }
        if (provider === 'openai') {
            const j = await getJson('https://api.openai.com/v1/models', { Authorization: `Bearer ${key}` });
            return (j.data || []).map(m => m.id)
                .filter(id => /^(gpt-|o1|o3|o4)/.test(id) && !/embed|audio|realtime|image|tts|transcribe|search|moderation|instruct/i.test(id));
        }
        if (provider === 'anthropic') {
            const j = await getJson('https://api.anthropic.com/v1/models?limit=1000', { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' });
            return (j.data || []).map(m => m.id).filter(id => /claude/.test(id));
        }
        if (provider === 'deepseek') {
            const j = await getJson('https://api.deepseek.com/models', { Authorization: `Bearer ${key}` });
            return (j.data || []).map(m => m.id);
        }
        throw new Error('nhà cung cấp này không có API liệt kê mô hình');
    }
};

/**
 * QuotaUI — thông báo hết hạn mức có ĐỒNG HỒ ĐẾM NGƯỢC tới lúc phục hồi, kèm nút dẫn tới đúng ô cài đặt.
 * Mọi phần tử có data-countdown-to="<mili-giây>" đều được cập nhật mỗi giây (cả trong Cài đặt).
 */
const QuotaUI = {
    _timer: null,

    startTicker() {
        if (!this._timer) this._timer = setInterval(() => this.tick(), 1000);
        this.tick();
    },

    tick() {
        const now = Date.now();
        const els = document.querySelectorAll('[data-countdown-to]');
        els.forEach(el => {
            const left = Number(el.dataset.countdownTo) - now;
            if (left > 0) {
                el.textContent = AIConfig.formatCountdown(left);
                return;
            }
            el.textContent = '00:00:00';
            el.removeAttribute('data-countdown-to');
            const notice = el.closest('.quota-notice');
            if (notice) this._markRecovered(notice);
            const status = el.closest('[data-provider]');
            if (status && typeof AISettingsUI !== 'undefined') AISettingsUI.renderQuotaStatus(status.dataset.provider);
        });
        if (!document.querySelector('[data-countdown-to]') && this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
    },

    isShown(key) {
        return [...document.querySelectorAll('#quota-notice-container .quota-notice')].some(n => n.dataset.key === key && !n.classList.contains('quota-notice-recovered'));
    },

    _markRecovered(notice) {
        const box = notice.querySelector('.quota-countdown');
        if (box) box.textContent = '✅ Đã phục hồi — có thể dùng lại AI này.';
        notice.classList.add('quota-notice-recovered');
        setTimeout(() => notice.remove(), 8000);
    },

    /** spec: { key, tone: 'free'|'paid'|'cap', title, lines[], resetAt?, actions[{label, run?|url?}], note? } */
    show(spec) {
        let box = document.getElementById('quota-notice-container');
        if (!box) {
            box = document.createElement('div');
            box.id = 'quota-notice-container';
            box.setAttribute('aria-live', 'polite');
            document.body.appendChild(box);
        }
        box.querySelectorAll('.quota-notice').forEach(n => { if (n.dataset.key === spec.key) n.remove(); });
        const el = document.createElement('div');
        el.className = `quota-notice quota-notice-${spec.tone || 'free'}`;
        el.dataset.key = spec.key || '';
        el.setAttribute('role', 'alert');
        const close = document.createElement('button');
        close.type = 'button'; close.className = 'quota-notice-close'; close.setAttribute('aria-label', 'Đóng');
        close.textContent = '×';
        close.addEventListener('click', () => el.remove());
        const title = document.createElement('div');
        title.className = 'quota-notice-title';
        title.textContent = `⚠️ ${spec.title}`;
        el.append(close, title);
        (spec.lines || []).forEach(t => {
            const p = document.createElement('div');
            p.className = 'quota-notice-line';
            p.textContent = t;
            el.appendChild(p);
        });
        if (spec.resetAt) {
            const cd = document.createElement('div');
            cd.className = 'quota-countdown';
            cd.append('⏳ Phục hồi sau ');
            const clock = document.createElement('b');
            clock.className = 'quota-countdown-clock';
            clock.dataset.countdownTo = String(spec.resetAt);
            clock.textContent = AIConfig.formatCountdown(spec.resetAt - Date.now());
            cd.append(clock, ` (lúc ${AIConfig.formatResetAt(spec.resetAt)})`);
            el.appendChild(cd);
        }
        if (spec.note) {
            const n = document.createElement('div');
            n.className = 'quota-notice-note';
            n.textContent = spec.note;
            el.appendChild(n);
        }
        if ((spec.actions || []).length) {
            const row = document.createElement('div');
            row.className = 'quota-notice-actions';
            spec.actions.forEach(a => {
                const b = document.createElement(a.url ? 'a' : 'button');
                b.className = 'quota-notice-link';
                b.textContent = a.label;
                if (a.url) { b.href = a.url; b.target = '_blank'; b.rel = 'noopener noreferrer'; }
                else {
                    b.type = 'button';
                    b.addEventListener('click', () => { try { a.run(); } finally { if (!a.keep) el.remove(); } });
                }
                row.appendChild(b);
            });
            el.appendChild(row);
        }
        box.appendChild(el);
        if (spec.resetAt) this.startTicker();
    }
};
