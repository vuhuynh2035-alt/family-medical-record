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
        document.getElementById('input-ai-cap')?.addEventListener('input', () => this.renderBudget(true));
        document.getElementById('btn-ai-reset-spend')?.addEventListener('click', async () => {
            if (await window.showConfirm('Đặt lại số tiền ước tính đã dùng trong tháng này về 0?')) {
                AIConfig.resetSpend();
                this.renderBudget();
            }
        });
        document.getElementById('btn-ai-refresh-models')?.addEventListener('click', () => this.refreshModels());
    },

    /** Dựng lại toàn bộ khu vực cài đặt AI từ dữ liệu đã lưu (gọi mỗi lần mở Cài đặt). */
    render() {
        this.draftKeys = {};
        const region = document.getElementById('input-ai-region');
        if (region) region.value = AIConfig.getRegion();
        this.renderHint();
        this.renderKeys();
        this.renderTasks(DataManager.getSettings().aiTasks || {});
        this.renderBudget();
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
            if (!f && !d) return;
            this.draftKeys[p] = { free: f ? f.value.trim() : undefined, paid: d ? d.value.trim() : undefined };
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
            const saved = AIConfig.getKeys(p);
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
                row.append(tag, input);
                wrap.appendChild(row);
            };
            if (prov.freeSlot) {
                addInput('free', `Key miễn phí — được ưu tiên dùng trước (${prov.placeholder})`, draft.free !== undefined ? draft.free : saved.free);
                addInput('paid', 'Key trả phí — chỉ dùng khi bạn đồng ý', draft.paid !== undefined ? draft.paid : saved.paid);
            } else {
                addInput('paid', `Key trả phí (${prov.placeholder}) — chỉ dùng khi bạn đồng ý`, draft.paid !== undefined ? draft.paid : saved.paid);
            }
            box.appendChild(wrap);
        });
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

    renderBudget(fromInput) {
        const capEl = document.getElementById('input-ai-cap');
        if (!capEl) return;
        if (!fromInput) capEl.value = String(AIConfig.getCap());
        const cap = parseFloat(capEl.value);
        const effectiveCap = Number.isFinite(cap) && cap >= 0 ? cap : AIConfig.getCap();
        const sp = AIConfig.getSpend();
        const pct = effectiveCap > 0 ? Math.min(100, (sp.usd / effectiveCap) * 100) : 100;
        const txt = document.getElementById('ai-spend-text');
        if (txt) {
            txt.textContent = `Tháng ${sp.month}: đã dùng ước tính $${sp.usd.toFixed(2)} / trần $${effectiveCap.toFixed(2)} (${sp.calls || 0} lượt gọi trả phí).` +
                (sp.usd >= effectiveCap ? ' ĐÃ CHẠM TRẦN — app không dùng API trả phí.' : '');
        }
        const bar = document.getElementById('ai-spend-bar');
        if (bar) {
            bar.style.width = pct + '%';
            bar.style.background = pct >= 100 ? '#e11d48' : (pct >= 80 ? '#f59e0b' : '#10b981');
        }
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
        const cap = parseFloat(document.getElementById('input-ai-cap')?.value);
        if (Number.isFinite(cap) && cap >= 0) patch.aiCapUsd = Math.round(cap * 100) / 100;
        return patch;
    },

    /** Tải thêm danh sách mô hình mới từ tài khoản của người dùng (các nhà cung cấp có API liệt kê). */
    async refreshModels() {
        this.captureKeys();
        const btn = document.getElementById('btn-ai-refresh-models');
        const orig = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.textContent = 'Đang tải...'; }
        const custom = Object.assign({}, DataManager.getSettings().customModels);
        const report = [];
        try {
            for (const p of AIConfig.visibleProviders(this.currentRegion())) {
                const d = this.draftKeys[p] || {};
                const saved = AIConfig.getKeys(p);
                const key = d.free || d.paid || saved.free || saved.paid;
                if (!key) continue;
                try {
                    const ids = await this._listModels(p, key);
                    if (ids === null) continue;
                    const known = AIConfig.PROVIDERS[p].models.map(m => m.id);
                    custom[p] = ids.filter(id => !known.includes(id)).slice(0, 25);
                    report.push(`${AIConfig.PROVIDERS[p].short}: ${ids.length}`);
                } catch (e) {
                    report.push(`${AIConfig.PROVIDERS[p].short}: lỗi (${e.message})`);
                }
            }
            DataManager.saveSettings({ customModels: custom });
            this.renderTasks(this.collectTasks());
            showToast(report.length ? 'Đã cập nhật mô hình — ' + report.join('; ') : 'Chưa có API Key nào để tải danh sách mô hình.', report.length ? 'success' : 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = orig; }
        }
    },

    async _listModels(provider, key) {
        const getJson = async (url, headers) => {
            const res = await fetch(url, { headers });
            if (!res.ok) throw new Error(res.status === 401 || res.status === 403 || res.status === 400 ? 'API Key không hợp lệ' : 'lỗi mạng/máy chủ');
            return res.json();
        };
        if (provider === 'gemini') {
            const j = await getJson('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { 'x-goog-api-key': key });
            return (j.models || [])
                .filter(m => (m.supportedGenerationMethods || []).includes('generateContent') && /gemini/.test(m.name) && !/embed|tts|image|live|audio|robotics|computer/i.test(m.name))
                .map(m => m.name.replace('models/', ''));
        }
        if (provider === 'openai') {
            const j = await getJson('https://api.openai.com/v1/models', { Authorization: `Bearer ${key}` });
            return (j.data || []).sort((a, b) => b.created - a.created).map(m => m.id)
                .filter(id => /^(gpt-|o1|o3|o4)/.test(id) && !/embed|audio|realtime|image|tts|transcribe|search|moderation|instruct/i.test(id));
        }
        if (provider === 'anthropic') {
            const j = await getJson('https://api.anthropic.com/v1/models', { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' });
            return (j.data || []).map(m => m.id).filter(id => /claude/.test(id));
        }
        if (provider === 'deepseek') {
            const j = await getJson('https://api.deepseek.com/models', { Authorization: `Bearer ${key}` });
            return (j.data || []).map(m => m.id);
        }
        return null; // Zhipu không có API liệt kê công khai
    }
};
