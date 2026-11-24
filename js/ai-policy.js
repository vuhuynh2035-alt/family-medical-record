/**
 * AIConfig — cấu hình & chính sách sử dụng AI:
 *  - Quốc gia  -> nhóm nhà cung cấp AI được hiển thị (Trung Quốc: DeepSeek/Zhipu; nơi khác: Gemini/OpenAI/Claude).
 *  - Mỗi nhà cung cấp có tối đa 2 API Key: MIỄN PHÍ (ưu tiên dùng trước) và TRẢ PHÍ.
 *  - Tác vụ AI để "Tự động" (app tự chọn mô hình phù hợp) hoặc người dùng chọn tay.
 *  - Khi cần dùng API trả phí (hết hạn mức miễn phí / mô hình chỉ có bản trả phí) -> hỏi xác nhận
 *    1 lần cho mỗi phiên mở app, và chặn khi chi phí ước tính tháng này chạm hạn mức trần.
 *
 * Lưu ý: chi phí chỉ là ƯỚC TÍNH dựa trên số token do nhà cung cấp trả về và bảng giá bên dưới
 * (làm tròn hơi cao để an toàn). Không thay thế hóa đơn thật của nhà cung cấp.
 */
const AIConfig = {
    TASKS: [
        { id: 'ocr', label: 'AI Quét thông minh & đọc ảnh hồ sơ', vision: true, deep: false },
        { id: 'assessment', label: 'AI Phân tích tình trạng bệnh án', vision: false, deep: true },
        { id: 'search', label: 'AI Tra cứu chuyên sâu & hỏi đáp', vision: false, deep: false },
        { id: 'trend', label: 'AI Đánh giá xu hướng sức khỏe', vision: false, deep: true },
        { id: 'chat', label: 'AI Trò chuyện & giải thích chuyên sâu', vision: false, deep: false }
    ],

    REGIONS: [
        { id: 'vn', name: 'Việt Nam', flag: '🇻🇳', group: 'global' },
        { id: 'jp', name: 'Nhật Bản', flag: '🇯🇵', group: 'global' },
        { id: 'us', name: 'Mỹ', flag: '🇺🇸', group: 'global' },
        { id: 'cn', name: 'Trung Quốc', flag: '🇨🇳', group: 'cn' },
        { id: 'other', name: 'Quốc gia khác', flag: '🌐', group: 'global' }
    ],

    // freeSlot: có ô API Key miễn phí riêng. Nhà cung cấp không có gói miễn phí chỉ có 1 ô key (trả phí).
    PROVIDERS: {
        gemini: {
            name: 'Google Gemini', short: 'Gemini', group: 'global', color: '#2563eb', freeSlot: true, vision: true,
            keyUrl: 'https://aistudio.google.com/app/apikey', placeholder: 'AIzaSy...',
            models: [
                { id: 'gemini-3.0-flash', label: 'Gemini 3.0 Flash', paid: false, tier: 'fast' },
                { id: 'gemini-flash-latest', label: 'Gemini Flash (mới nhất)', paid: false, tier: 'fast' },
                { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro', paid: true, tier: 'pro' }
            ]
        },
        openai: {
            name: 'OpenAI ChatGPT', short: 'ChatGPT', group: 'global', color: '#10a37f', freeSlot: false, vision: true,
            keyUrl: 'https://platform.openai.com/api-keys', placeholder: 'sk-...',
            models: [
                { id: 'gpt-4o-mini', label: 'GPT-4o mini', paid: true, tier: 'fast' },
                { id: 'gpt-4o', label: 'GPT-4o', paid: true, tier: 'pro' }
            ]
        },
        anthropic: {
            name: 'Anthropic Claude', short: 'Claude', group: 'global', color: '#d35400', freeSlot: false, vision: false,
            keyUrl: 'https://console.anthropic.com/settings/keys', placeholder: 'sk-ant-...',
            models: [
                { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', paid: true, tier: 'fast' },
                { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', paid: true, tier: 'pro' }
            ]
        },
        deepseek: {
            name: 'DeepSeek', short: 'DeepSeek', group: 'cn', color: '#1e40af', freeSlot: false, vision: false,
            keyUrl: 'https://platform.deepseek.com/api_keys', placeholder: 'sk-...',
            models: [
                { id: 'deepseek-chat', label: 'DeepSeek V3 (chat)', paid: true, tier: 'fast' },
                { id: 'deepseek-reasoner', label: 'DeepSeek R1 (suy luận sâu)', paid: true, tier: 'pro' }
            ]
        },
        zhipu: {
            name: 'Zhipu AI (GLM)', short: 'Zhipu GLM', group: 'cn', color: '#0284c7', freeSlot: true, vision: true,
            keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys', placeholder: 'Mã API Key Zhipu...',
            visionModel: { id: 'glm-4v-flash', label: 'GLM-4V Flash (đọc ảnh)', paid: false, tier: 'fast' },
            models: [
                { id: 'glm-4-flash', label: 'GLM-4 Flash', paid: false, tier: 'fast' },
                { id: 'glm-4-air', label: 'GLM-4 Air', paid: true, tier: 'fast' },
                { id: 'glm-4-plus', label: 'GLM-4 Plus', paid: true, tier: 'pro' }
            ]
        }
    },

    // Bảng giá ƯỚC TÍNH (USD / 1 triệu token: [vào, ra]) — làm tròn hơi cao để an toàn.
    PRICE_RULES: [
        [/gemini.*pro/i, [2.0, 12.0]],
        [/gemini/i, [0.3, 2.5]],
        [/gpt-4o-mini/i, [0.15, 0.6]],
        [/gpt-4o/i, [2.5, 10.0]],
        [/^(o1|o3|gpt-5)/i, [5.0, 20.0]],
        [/gpt/i, [5.0, 15.0]],
        [/opus/i, [15.0, 75.0]],
        [/sonnet/i, [3.0, 15.0]],
        [/haiku/i, [1.0, 5.0]],
        [/claude/i, [3.0, 15.0]],
        [/reasoner/i, [0.6, 2.5]],
        [/deepseek/i, [0.3, 1.1]],
        [/glm-4-plus/i, [0.8, 0.8]],
        [/glm.*(flash)/i, [0, 0]],
        [/glm/i, [0.2, 0.2]]
    ],
    DEFAULT_PRICE: [5.0, 15.0],
    DEFAULT_CAP_USD: 5,

    // Người dùng đã đồng ý dùng API trả phí trong phiên này (chỉ lưu trong bộ nhớ -> mở app lần sau hỏi lại)
    sessionApproved: false,
    _pendingApproval: null,

    // ---------------------------------------------------------------- Quốc gia / nhà cung cấp
    getRegion() {
        const s = DataManager.getSettings();
        if (s.aiRegion && this.REGIONS.some(r => r.id === s.aiRegion)) return s.aiRegion;
        // Chưa chọn: suy ra từ cấu hình cũ (đang dùng AI Trung Quốc) hoặc ngôn ngữ giao diện.
        if (s.providerAssessment === 'deepseek' || s.providerAssessment === 'zhipu') return 'cn';
        if (s.language === 'zh') return 'cn';
        if (s.language === 'ja') return 'jp';
        return 'vn';
    },
    getGroup(regionId) {
        const r = this.REGIONS.find(x => x.id === (regionId || this.getRegion()));
        return r ? r.group : 'global';
    },
    visibleProviders(regionId) {
        const g = this.getGroup(regionId);
        return Object.keys(this.PROVIDERS).filter(p => this.PROVIDERS[p].group === g);
    },

    // ---------------------------------------------------------------- Khóa API
    getKeys(provider) {
        const s = DataManager.getSettings();
        let free = (s[provider + 'ApiKey'] || '').trim();
        let paid = (s[provider + 'ApiKeyPaid'] || '').trim();
        if (!this.PROVIDERS[provider].freeSlot) { paid = paid || free; free = ''; }
        return { free, paid };
    },
    hasKey(provider) {
        const k = this.getKeys(provider);
        return !!(k.free || k.paid);
    },
    hasAnyKey(task) {
        const def = this.TASKS.find(t => t.id === task);
        return this.visibleProviders().some(p => this.hasKey(p) && (!def || !def.vision || this.PROVIDERS[p].vision));
    },
    /** Trả về object cài đặt để lưu 1 key vào đúng ô (free|paid). */
    keyPatch(provider, slot, value) {
        const patch = {};
        if (!this.PROVIDERS[provider].freeSlot) {
            patch[provider + 'ApiKeyPaid'] = value;
            patch[provider + 'ApiKey'] = ''; // dọn ô cũ để không bị hiểu nhầm
        } else {
            patch[provider + (slot === 'paid' ? 'ApiKeyPaid' : 'ApiKey')] = value;
        }
        return patch;
    },

    // ---------------------------------------------------------------- Mô hình
    guessPaid(provider, id) {
        if (provider === 'gemini') return !/flash|lite/i.test(id);
        if (provider === 'zhipu') return !/flash/i.test(id);
        return true;
    },
    getModelsOf(provider, forVision) {
        const p = this.PROVIDERS[provider];
        if (forVision && p.visionModel) return [p.visionModel];
        const list = p.models.slice();
        const custom = (DataManager.getSettings().customModels || {})[provider] || [];
        custom.forEach(id => {
            if (!list.some(m => m.id === id)) {
                list.push({ id, label: id, paid: this.guessPaid(provider, id), tier: /pro|reason|opus|sonnet|4o$|plus/i.test(id) ? 'pro' : 'fast' });
            }
        });
        return list;
    },
    findModel(provider, id, forVision) {
        return this.getModelsOf(provider, forVision).find(m => m.id === id) || null;
    },
    modelLabel(provider, id) {
        const m = this.findModel(provider, id) || this.findModel(provider, id, true);
        return m ? m.label : id;
    },

    // ---------------------------------------------------------------- Chọn mô hình cho từng tác vụ
    autoPick(task, regionId) {
        const def = this.TASKS.find(t => t.id === task) || { vision: false, deep: false };
        const group = this.getGroup(regionId);
        let order = group === 'cn'
            ? (def.deep ? ['deepseek', 'zhipu'] : ['zhipu', 'deepseek'])
            : ['gemini', 'openai', 'anthropic'];
        order = order.filter(p => !def.vision || this.PROVIDERS[p].vision);
        const provider = order.find(p => this.hasKey(p)) || order[0];
        const keys = this.getKeys(provider);
        const models = this.getModelsOf(provider, def.vision);
        let pick;
        if (def.deep && keys.paid) pick = models.find(m => m.tier === 'pro') || models[0];
        else if (keys.free || !keys.paid) pick = models.find(m => !m.paid) || models.find(m => m.tier === 'fast') || models[0];
        else pick = models.find(m => m.tier === 'fast') || models[0];
        return { provider, model: pick.id, paidOnly: !!pick.paid, auto: true, vision: !!def.vision };
    },
    resolve(task) {
        const def = this.TASKS.find(t => t.id === task) || { vision: false };
        const s = DataManager.getSettings();
        const choice = (s.aiTasks && s.aiTasks[task]) || 'auto';
        if (choice !== 'auto') {
            const [p, m] = choice.split('|');
            const prov = this.PROVIDERS[p];
            if (prov && prov.group === this.getGroup() && (!def.vision || prov.vision)) {
                const mi = this.findModel(p, m, def.vision);
                if (mi) return { provider: p, model: m, paidOnly: !!mi.paid, auto: false, vision: !!def.vision };
            }
        }
        return this.autoPick(task);
    },
    /** Danh sách lựa chọn cho <select> của 1 tác vụ. */
    choicesFor(task, regionId) {
        const def = this.TASKS.find(t => t.id === task);
        const auto = this.autoPick(task, regionId);
        const out = [{
            value: 'auto',
            label: `Tự động — ${this.modelLabel(auto.provider, auto.model)}${auto.paidOnly ? ' (trả phí)' : ' (miễn phí)'}`
        }];
        this.visibleProviders(regionId).forEach(p => {
            if (def.vision && !this.PROVIDERS[p].vision) return;
            this.getModelsOf(p, def.vision).forEach(m => {
                out.push({ value: `${p}|${m.id}`, label: `${m.label} · ${m.paid ? 'trả phí' : 'miễn phí'}` });
            });
        });
        return out;
    },
    /** Dùng khi người dùng chọn nhà cung cấp theo kiểu cũ (wizard): gán mô hình mặc định phù hợp. */
    setTaskProvider(task, provider) {
        const def = this.TASKS.find(t => t.id === task);
        const models = this.getModelsOf(provider, def && def.vision);
        const pick = models.find(m => !m.paid) || models[0];
        const tasks = Object.assign({}, DataManager.getSettings().aiTasks, { [task]: `${provider}|${pick.id}` });
        DataManager.saveSettings({ aiTasks: tasks });
    },

    // ---------------------------------------------------------------- Chi phí / hạn mức trần
    priceOf(model) {
        const rule = this.PRICE_RULES.find(r => r[0].test(model));
        return rule ? rule[1] : this.DEFAULT_PRICE;
    },
    estimateCost(model, inTok, outTok) {
        const [pi, po] = this.priceOf(model);
        return (inTok * pi + outTok * po) / 1e6;
    },
    monthKey() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    },
    getCap() {
        const v = Number(DataManager.getSettings().aiCapUsd);
        return Number.isFinite(v) && v >= 0 ? v : this.DEFAULT_CAP_USD;
    },
    getSpend() {
        const s = DataManager.getSettings().aiSpend;
        if (!s || s.month !== this.monthKey()) return { month: this.monthKey(), usd: 0, calls: 0 };
        return s;
    },
    resetSpend() {
        DataManager.saveSettings({ aiSpend: { month: this.monthKey(), usd: 0, calls: 0 } });
    },
    isCapReached() {
        return this.getSpend().usd >= this.getCap();
    },
    recordUsage(provider, model, usage) {
        if (!usage) return;
        const cost = this.estimateCost(model, usage.in || 0, usage.out || 0);
        const sp = this.getSpend();
        const next = { month: sp.month, usd: sp.usd + cost, calls: (sp.calls || 0) + 1 };
        DataManager.saveSettings({ aiSpend: next });
        if (next.usd >= this.getCap() && sp.usd < this.getCap() && typeof showToast === 'function') {
            showToast('⚠️ Đã chạm hạn mức trần API trả phí. App sẽ không dùng API trả phí nữa cho đến khi bạn nâng hạn mức.', 'error');
        }
    },
    capError() {
        const e = new Error(`Đã hết hạn mức trần API trả phí (đã dùng khoảng $${this.getSpend().usd.toFixed(2)} / $${this.getCap().toFixed(2)} trong tháng này). App không dùng API trả phí nữa. Muốn tiếp tục, hãy vào Cài đặt > Trí tuệ nhân tạo > "Hạn mức trần API trả phí" để nâng hạn mức.`);
        e.isCap = true;
        return e;
    },

    // ---------------------------------------------------------------- Xác nhận dùng API trả phí
    async authorizePaid(info) {
        if (this.isCapReached()) throw this.capError();
        if (this.sessionApproved) return;
        if (!this._pendingApproval) {
            this._pendingApproval = this._askPaidConsent(info).finally(() => { this._pendingApproval = null; });
        }
        const ok = await this._pendingApproval;
        if (!ok) {
            const e = new Error('Bạn đã từ chối dùng API trả phí nên tác vụ AI này không được thực hiện.');
            e.isDeclined = true;
            throw e;
        }
        if (this.isCapReached()) throw this.capError();
    },
    _askPaidConsent(info) {
        return new Promise(resolve => {
            const sp = this.getSpend();
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.style.zIndex = '10050';
            overlay.setAttribute('role', 'alertdialog');
            overlay.setAttribute('aria-modal', 'true');
            const box = document.createElement('div');
            box.className = 'modal-content neumorphic-modal';
            box.style.maxWidth = '420px';
            const h = document.createElement('h3');
            h.style.cssText = 'margin:0 0 10px;color:var(--primary-blue);';
            h.textContent = '💳 Cần dùng API trả phí';
            const p1 = document.createElement('p');
            p1.style.cssText = 'font-size:14px;line-height:1.5;margin:0 0 8px;';
            p1.textContent = info.reason === 'quota'
                ? `API miễn phí của ${info.providerName} đã hết hạn mức. Để tiếp tục, app cần dùng API trả phí của bạn.`
                : `Tác vụ này đang dùng mô hình "${info.modelLabel}" (${info.providerName}) chỉ có ở API trả phí.`;
            const p2 = document.createElement('p');
            p2.style.cssText = 'font-size:13px;color:var(--text-muted);line-height:1.5;margin:0 0 14px;';
            p2.textContent = `Tháng này đã dùng ước tính $${sp.usd.toFixed(2)} / hạn mức trần $${this.getCap().toFixed(2)}. Nếu đồng ý, app được dùng API trả phí cho các yêu cầu cần thiết đến khi bạn đóng app; lần mở sau sẽ hỏi lại.`;
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
            const no = document.createElement('button');
            no.type = 'button'; no.className = 'secondary-btn neumorphic-btn'; no.textContent = 'Không đồng ý';
            const yes = document.createElement('button');
            yes.type = 'button'; yes.className = 'primary-btn neumorphic-btn'; yes.textContent = 'Đồng ý dùng';
            const done = (val) => {
                if (val) this.sessionApproved = true;
                overlay.remove();
                resolve(val);
            };
            no.addEventListener('click', () => done(false));
            yes.addEventListener('click', () => done(true));
            row.append(no, yes);
            box.append(h, p1, p2, row);
            overlay.appendChild(box);
            document.body.appendChild(overlay);
            yes.focus();
        });
    }
};
