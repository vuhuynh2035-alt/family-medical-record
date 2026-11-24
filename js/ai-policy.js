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
    /**
     * Các key đang dùng được của một AI. Key đang TẮT (công tắc trong Cài đặt) coi như không có.
     * raw=true: trả cả key đang tắt (dùng cho giao diện, để không làm mất key đã nhập).
     */
    getKeys(provider, raw = false) {
        const s = DataManager.getSettings();
        let free = (s[provider + 'ApiKey'] || '').trim();
        let paid = (s[provider + 'ApiKeyPaid'] || '').trim();
        if (!this.PROVIDERS[provider].freeSlot) { paid = paid || free; free = ''; }
        if (!raw) {
            const off = s.aiKeyOff || {};
            if (off[provider + ':free']) free = '';
            if (off[provider + ':paid']) paid = '';
        }
        return { free, paid };
    },
    isKeyOff(provider, slot) {
        return !!(DataManager.getSettings().aiKeyOff || {})[`${provider}:${slot}`];
    },
    setKeyOff(provider, slot, off) {
        const m = Object.assign({}, DataManager.getSettings().aiKeyOff);
        if (off) m[`${provider}:${slot}`] = true; else delete m[`${provider}:${slot}`];
        DataManager.saveSettings({ aiKeyOff: m });
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
    /** Số phiên bản trong tên mô hình ("gemini-3.1-pro" -> 3.1, "claude-sonnet-5-5" -> 5.5). Không có số (vd. "-latest") -> 0. */
    versionRank(id) {
        const m = String(id || '').match(/(\d+)(?:[.-](\d{1,2})(?!\d))?/);
        if (!m || /latest/i.test(id)) return 0;
        return parseFloat(`${m[1]}.${m[2] || 0}`);
    },
    /** Sắp mô hình mới nhất lên đầu (theo số phiên bản, rồi theo tên). */
    sortNewest(ids) {
        return ids.slice().sort((a, b) => (this.versionRank(b) - this.versionRank(a)) || (a < b ? -1 : a > b ? 1 : 0));
    },
    /** Mô hình có phiên bản cao nhất trong danh sách (bỏ qua bản thử nghiệm "exp" nếu còn lựa chọn khác; hòa thì giữ cái đứng trước). */
    newest(list) {
        const stable = list.filter(m => !/(^|[-_])exp(\b|[-_])/i.test(m.id));
        const pool = stable.length ? stable : list;
        return pool.reduce((best, m) => (!best || this.versionRank(m.id) > this.versionRank(best.id) ? m : best), null);
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
        // Trong nhóm phù hợp, lấy mô hình có số phiên bản CAO NHẤT (mô hình mới tải về cũng được xét).
        let pick;
        if (def.deep && keys.paid) pick = this.newest(models.filter(m => m.tier === 'pro')) || models[0];
        else if (keys.free || !keys.paid) pick = this.newest(models.filter(m => !m.paid)) || this.newest(models.filter(m => m.tier === 'fast')) || models[0];
        else pick = this.newest(models.filter(m => m.tier === 'fast')) || models[0];
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
            label: `Tự động — ${this.modelLabel(auto.provider, auto.model)}${auto.paidOnly ? ' (trả phí)' : ' (miễn phí)'}${this._noteOf(auto.provider, auto.model)}`
        }];
        this.visibleProviders(regionId).forEach(p => {
            if (def.vision && !this.PROVIDERS[p].vision) return;
            this.getModelsOf(p, def.vision).forEach(m => {
                out.push({ value: `${p}|${m.id}`, label: `${m.label} · ${m.paid ? 'trả phí' : 'miễn phí'}${this._noteOf(p, m.id)}` });
            });
        });
        return out;
    },
    _noteOf(provider, model) {
        const a = this.availability(provider, model);
        return a.note ? ` · ⛔ ${a.note}` : '';
    },
    /** Dùng khi người dùng chọn nhà cung cấp theo kiểu cũ (wizard): gán mô hình mặc định phù hợp. */
    setTaskProvider(task, provider) {
        const def = this.TASKS.find(t => t.id === task);
        const models = this.getModelsOf(provider, def && def.vision);
        const pick = models.find(m => !m.paid) || models[0];
        const tasks = Object.assign({}, DataManager.getSettings().aiTasks, { [task]: `${provider}|${pick.id}` });
        DataManager.saveSettings({ aiTasks: tasks });
    },

    // ---------------------------------------------------------------- Chi phí / hạn mức trần (RIÊNG TỪNG AI)
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
    /** Người dùng đã nhập hạn mức trần riêng cho AI này chưa (số >= 0)? */
    hasOwnCap(provider) {
        const v = (DataManager.getSettings().aiCaps || {})[provider];
        return v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0;
    },
    /**
     * Hạn mức trần trả phí (USD/tháng) của một AI.
     *  - AI KHÔNG có gói miễn phí (ChatGPT, Claude, DeepSeek): phải do người dùng nhập; chưa nhập hoặc = 0 thì hạn mức là 0 -> API đóng.
     *  - AI có gói miễn phí (Gemini, Zhipu): chưa nhập thì dùng giá trị chung cũ/mặc định cho phần trả phí dự phòng; nhập 0 thì không dùng trả phí.
     */
    getCap(provider) {
        if (this.hasOwnCap(provider)) return Number(DataManager.getSettings().aiCaps[provider]);
        if (this.PROVIDERS[provider] && !this.PROVIDERS[provider].freeSlot) return 0;
        const legacy = Number(DataManager.getSettings().aiCapUsd);
        return Number.isFinite(legacy) && legacy >= 0 ? legacy : this.DEFAULT_CAP_USD;
    },
    getSpend(provider) {
        const all = DataManager.getSettings().aiSpendBy || {};
        const s = all[provider];
        if (!s || s.month !== this.monthKey()) return { month: this.monthKey(), usd: 0, calls: 0 };
        return s;
    },
    resetSpend(provider) {
        const all = Object.assign({}, DataManager.getSettings().aiSpendBy);
        all[provider] = { month: this.monthKey(), usd: 0, calls: 0 };
        DataManager.saveSettings({ aiSpendBy: all });
    },
    /** Hết hạn mức trả phí: chạm trần, hoặc trần = 0 (chưa nhập / nhập 0) -> API trả phí của AI này bị đóng. */
    isCapReached(provider) {
        const cap = this.getCap(provider);
        return cap <= 0 || this.getSpend(provider).usd >= cap;
    },
    recordUsage(provider, model, usage) {
        if (!usage) return;
        const cost = this.estimateCost(model, usage.in || 0, usage.out || 0);
        const sp = this.getSpend(provider);
        const cap = this.getCap(provider);
        const all = Object.assign({}, DataManager.getSettings().aiSpendBy);
        all[provider] = { month: sp.month, usd: sp.usd + cost, calls: (sp.calls || 0) + 1 };
        DataManager.saveSettings({ aiSpendBy: all });
        if (all[provider].usd >= cap && sp.usd < cap && typeof showToast === 'function') {
            showToast(`⚠️ ${this.PROVIDERS[provider].short} đã chạm hạn mức trần trả phí. App sẽ không dùng API trả phí của AI này nữa cho đến khi bạn nâng hạn mức.`, 'error');
        }
    },
    capError(provider) {
        const prov = this.PROVIDERS[provider];
        if (this.getCap(provider) <= 0) {
            const e0 = new Error(`Hết hạn mức API ${prov.name}: bạn chưa đặt hạn mức sử dụng (hoặc đang đặt 0) nên API này đang đóng. Hãy vào Cài đặt > Trí tuệ nhân tạo, mục ${prov.short}, nhập hạn mức trần (USD/tháng) lớn hơn 0 để mở lại.`);
            e0.isCap = true;
            return e0;
        }
        const e = new Error(`${prov.name} đã hết hạn mức trần API trả phí (đã dùng khoảng $${this.getSpend(provider).usd.toFixed(2)} / $${this.getCap(provider).toFixed(2)} trong tháng này). App không dùng API trả phí của AI này nữa. Muốn tiếp tục, hãy vào Cài đặt > Trí tuệ nhân tạo, mục ${prov.short}, và nâng hạn mức trần.`);
        e.isCap = true;
        return e;
    },

    // ---------------------------------------------------------------- Hạn mức MIỄN PHÍ: ghi nhận, thời gian phục hồi
    // Mỗi nhà cung cấp có NHIỀU kiểu giới hạn, mỗi kiểu phục hồi khác nhau, và tính RIÊNG cho từng mô hình:
    //  - kind 'day'    : hạn mức theo ngày -> 'daily-pt' = phục hồi lúc 00:00 giờ Thái Bình Dương (Gemini, theo tài liệu Google).
    //  - kind 'minute' : giới hạn theo phút/tần suất (RPM/TPM) -> phục hồi sau thời gian chờ nhà cung cấp báo (retryDelay), mặc định defaultSec.
    //  - kind 'unknown': nhà cung cấp trả 429 nhưng không nói rõ loại -> tạm nghỉ defaultSec rồi thử lại.
    // Nhà cung cấp đổi chính sách thì chỉnh ở đây.
    FREE_RULES: {
        gemini: {
            docUrl: 'https://aistudio.google.com/rate-limit',
            text: 'Google tính giới hạn miễn phí RIÊNG cho từng mô hình và theo dự án (project): theo phút (RPM/TPM) và theo ngày (RPD, một số mô hình còn giới hạn token/ngày). Hạn mức theo ngày phục hồi lúc 00:00 giờ Thái Bình Dương; giới hạn theo phút phục hồi sau khoảng 1 phút. Mức cụ thể của từng mô hình xem trong Google AI Studio.',
            kinds: {
                day: { reset: 'daily-pt', label: 'hạn mức theo ngày (RPD)' },
                minute: { reset: 'cooldown', defaultSec: 60, label: 'giới hạn theo phút (RPM/TPM)' },
                unknown: { reset: 'cooldown', defaultSec: 900, label: 'giới hạn (Google không nói rõ loại)' }
            }
        },
        zhipu: {
            docUrl: 'https://open.bigmodel.cn/',
            text: 'Mô hình miễn phí GLM-4 Flash giới hạn theo tần suất/đồng thời; nhà cung cấp không công bố mốc reset cố định. Khi bị chặn app tạm nghỉ rồi tự thử lại (giới hạn tần suất khoảng 1 phút, loại khác khoảng 30 phút).',
            kinds: {
                day: { reset: 'cooldown', defaultSec: 1800, label: 'hạn mức' },
                minute: { reset: 'cooldown', defaultSec: 60, label: 'giới hạn tần suất' },
                unknown: { reset: 'cooldown', defaultSec: 1800, label: 'giới hạn' }
            }
        }
    },
    freeRule(provider) {
        return this.FREE_RULES[provider] || null;
    },
    kindRule(provider, kind) {
        const r = this.freeRule(provider);
        return (r && (r.kinds[kind] || r.kinds.unknown)) || { reset: 'cooldown', defaultSec: 900, label: 'giới hạn' };
    },
    _ptParts(ms) {
        const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const o = {};
        f.formatToParts(new Date(ms)).forEach(p => { o[p.type] = p.value; });
        return o;
    },
    /** Mốc 00:00 kế tiếp theo giờ Thái Bình Dương (có tính giờ mùa hè), tính bằng mili-giây UTC. */
    nextMidnightPT(now) {
        const p = this._ptParts(now);
        const wall = (q) => Date.UTC(+q.year, +q.month - 1, +q.day, +q.hour, +q.minute, +q.second);
        const target = Date.UTC(+p.year, +p.month - 1, +p.day + 1, 0, 0, 0);
        let guess = target - (wall(p) - Math.floor(now / 1000) * 1000);
        guess += target - wall(this._ptParts(guess)); // chỉnh lại nếu ngày đó đổi giờ mùa hè
        return guess;
    },
    /** Khóa "ngày" để đếm lượt miễn phí: theo ngày Thái Bình Dương nếu AI có hạn mức theo ngày PT, ngược lại theo ngày máy. */
    _freeDayKey(provider, now) {
        const r = this.freeRule(provider);
        if (r && r.kinds.day && r.kinds.day.reset === 'daily-pt') { const p = this._ptParts(now); return `${p.year}-${p.month}-${p.day}`; }
        const d = new Date(now);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },
    /** Khóa theo dõi: giới hạn tính riêng từng mô hình. */
    freeKey(provider, model) {
        return `${provider}|${model || '*'}`;
    },
    /** Mốc phục hồi (mili-giây) của một kiểu giới hạn. info.retryMs = thời gian chờ nhà cung cấp báo (nếu có). */
    computeReset(provider, kind, info, now = Date.now()) {
        const kr = this.kindRule(provider, kind);
        if (kr.reset === 'daily-pt') return this.nextMidnightPT(now);
        const ms = info && info.retryMs > 0 ? info.retryMs : (kr.defaultSec || 900) * 1000;
        return now + ms + 1000;
    },
    /** Trạng thái hạn mức miễn phí của (AI, mô hình): { exhausted, resetAt, kind, calls }. Tự gỡ "hết" khi đã tới giờ phục hồi. */
    getFreeState(provider, model, now = Date.now()) {
        const all = DataManager.getSettings().aiFreeState || {};
        const k = this.freeKey(provider, model);
        const st = all[k] || {};
        const calls = st.day === this._freeDayKey(provider, now) ? (st.calls || 0) : 0;
        if (st.resetAt && now < st.resetAt) return { exhausted: true, resetAt: st.resetAt, kind: st.kind || 'unknown', exhaustedAt: st.exhaustedAt || null, calls, model };
        if (st.resetAt) { // đã tới giờ phục hồi -> dùng lại API miễn phí
            DataManager.saveSettings({ aiFreeState: Object.assign({}, all, { [k]: { day: st.day, calls: st.day === this._freeDayKey(provider, now) ? (st.calls || 0) : 0 } }) });
        }
        return { exhausted: false, resetAt: null, kind: null, calls, model };
    },
    /** Mọi mô hình đã theo dõi của một AI: [{ model, exhausted, resetAt, kind, calls }]. */
    freeStatesOf(provider, now = Date.now()) {
        const all = DataManager.getSettings().aiFreeState || {};
        return Object.keys(all).filter(k => k.startsWith(provider + '|')).map(k => this.getFreeState(provider, k.slice(provider.length + 1), now));
    },
    /** Ghi nhận API miễn phí vừa hết hạn mức của (AI, mô hình) và tính mốc phục hồi theo đúng kiểu giới hạn. */
    markFreeExhausted(provider, model, info, now = Date.now()) {
        const kind = (info && info.kind) || 'unknown';
        const resetAt = this.computeReset(provider, kind, info, now);
        const all = Object.assign({}, DataManager.getSettings().aiFreeState);
        const k = this.freeKey(provider, model);
        const prev = all[k] || {};
        const day = this._freeDayKey(provider, now);
        all[k] = { day, calls: prev.day === day ? (prev.calls || 0) : 0, exhaustedAt: now, resetAt, kind };
        DataManager.saveSettings({ aiFreeState: all });
        return { resetAt, kind };
    },
    recordFreeUse(provider, model, now = Date.now()) {
        const all = Object.assign({}, DataManager.getSettings().aiFreeState);
        const k = this.freeKey(provider, model);
        const prev = all[k] || {};
        const day = this._freeDayKey(provider, now);
        all[k] = Object.assign({}, prev, { day, calls: (prev.day === day ? (prev.calls || 0) : 0) + 1 });
        DataManager.saveSettings({ aiFreeState: all });
    },
    /** "14:00 ngày 25/11 (còn 5 giờ 3 phút)" */
    formatReset(resetAt, now = Date.now()) {
        const d = new Date(resetAt);
        const pad = (n) => String(n).padStart(2, '0');
        const mins = Math.max(0, Math.ceil((resetAt - now) / 60000));
        const left = mins >= 60 ? `${Math.floor(mins / 60)} giờ ${mins % 60} phút` : `${mins} phút`;
        return `${pad(d.getHours())}:${pad(d.getMinutes())} ngày ${pad(d.getDate())}/${pad(d.getMonth() + 1)} (còn ${left})`;
    },
    /** "14:00 ngày 25/11" (không kèm thời gian còn lại — dùng cùng đồng hồ đếm ngược). */
    formatResetAt(resetAt) {
        const d = new Date(resetAt);
        const pad = (n) => String(n).padStart(2, '0');
        return `${pad(d.getHours())}:${pad(d.getMinutes())} ngày ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
    },
    /** "HH:MM:SS" cho đồng hồ đếm ngược. */
    formatCountdown(ms) {
        const t = Math.max(0, Math.ceil(ms / 1000));
        const pad = (n) => String(n).padStart(2, '0');
        return `${pad(Math.floor(t / 3600))}:${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}`;
    },
    /** "14:00 25/11" — gọn, dùng trong nhãn ô chọn. */
    formatResetShort(resetAt) {
        const d = new Date(resetAt);
        const pad = (n) => String(n).padStart(2, '0');
        return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
    },
    /** API trả phí của AI này có dùng được không (có key trả phí và chưa chạm/chưa bị đóng hạn mức trần)? */
    paidUsable(provider) {
        return !!this.getKeys(provider).paid && !this.isCapReached(provider);
    },
    /**
     * AI + mô hình này có đang bị chặn vì hạn mức không? { ok, note }.
     * ok=false: app sẽ không gọi AI này (hết hạn mức miễn phí mà không có trả phí dùng được, chưa đặt/đã chạm hạn mức trần).
     */
    availability(provider, model) {
        const k = this.getKeys(provider);
        const prov = this.PROVIDERS[provider];
        if (!k.free && !k.paid) return { ok: true, note: '' };
        if (prov.freeSlot && k.free) {
            const st = this.getFreeState(provider, model);
            if (st.exhausted) {
                if (st.kind !== 'minute' && this.paidUsable(provider)) return { ok: true, note: 'hết hạn mức miễn phí — sẽ hỏi dùng trả phí' };
                return { ok: false, note: `hết hạn mức, dùng lại lúc ${this.formatResetShort(st.resetAt)}` };
            }
            return { ok: true, note: '' };
        }
        if (this.isCapReached(provider)) return { ok: false, note: this.getCap(provider) <= 0 ? 'chưa đặt hạn mức trần' : 'đã chạm hạn mức trần' };
        return { ok: true, note: '' };
    },
    /** Câu mô tả rõ API NÀO hết hạn mức, kiểu giới hạn gì, bao giờ phục hồi. */
    freeExhaustedMessage(provider, model, st) {
        const prov = this.PROVIDERS[provider];
        const label = this.kindRule(provider, st.kind).label;
        return `API MIỄN PHÍ của ${prov.name}${model ? ` (mô hình ${this.modelLabel(provider, model)})` : ''} đã hết ${label}. Phục hồi lúc ${this.formatReset(st.resetAt)}.`;
    },
    /**
     * Lỗi "AI tạm dừng vì hết hạn mức miễn phí". reason: 'nopaid' (không có API trả phí dùng được) | 'declined' (người dùng từ chối trả phí) | 'short' (giới hạn ngắn hạn theo phút).
     * e.notice mang dữ liệu để hiện thông báo có đồng hồ đếm ngược.
     */
    pausedError(provider, model, st, reason) {
        const prov = this.PROVIDERS[provider];
        const base = this.freeExhaustedMessage(provider, model, st);
        const tail = reason === 'paidoff'
            ? ` API trả phí của ${prov.short} đang TẮT nên app tạm dừng ${prov.short} tới lúc đó, rồi tự dùng lại API miễn phí. Muốn dùng tiếp ngay, hãy bật lại công tắc API trả phí trong Cài đặt > Trí tuệ nhân tạo.`
            : reason === 'declined'
            ? ` Bạn đã từ chối dùng API trả phí nên app tạm dừng ${prov.short} tới lúc đó, rồi tự dùng lại API miễn phí.`
            : reason === 'short'
                ? ' Đây là giới hạn ngắn hạn: app tạm chờ rồi tự thử lại, không cần dùng API trả phí.'
                : ` Chưa có API trả phí dùng được nên app tạm dừng ${prov.short} tới lúc đó, rồi tự dùng lại. Muốn dùng tiếp ngay, hãy thêm API Key trả phí và đặt hạn mức trần trong Cài đặt > Trí tuệ nhân tạo.`;
        const e = new Error(base + tail);
        e.isPaused = true;
        e.isDeclined = reason === 'declined';
        e.resumeAt = st.resetAt;
        e.notice = { tone: 'free', provider, model, kind: st.kind, resetAt: st.resetAt, reason };
        return e;
    },

    // ---------------------------------------------------------------- Xác nhận dùng API trả phí (theo từng AI + mô hình)
    // _approved[khóa]: mốc phục hồi mà người dùng đã đồng ý dùng trả phí tới đó (lý do 'quota') hoặc 'session' (lý do 'model').
    // _declined[khóa]: mốc phục hồi mà người dùng đã từ chối -> không hỏi lại cho tới lúc đó.
    // Chỉ lưu trong bộ nhớ: mở app lần sau sẽ hỏi lại.
    _approved: {},
    _declined: {},
    resetApprovals() {
        this._approved = {};
        this._declined = {};
        this._pending = {};
        this.sessionApproved = false;
    },
    /** Cho phép dùng API trả phí của AI/mô hình này tới khi hạn mức miễn phí phục hồi (nút bấm sau khi đã từ chối). */
    allowPaidUntilReset(provider, model) {
        const st = this.getFreeState(provider, model);
        if (st.exhausted) { const ak = this.freeKey(provider, model); this._approved[ak] = st.resetAt; delete this._declined[ak]; }
    },
    async authorizePaid(info) {
        const p = info.provider;
        if (this.isCapReached(p)) throw this.capError(p);
        if (this.sessionApproved) return;
        const ak = this.freeKey(p, info.model);
        const isQuota = info.reason === 'quota' && info.resetAt;
        const quotaSt = isQuota ? { resetAt: info.resetAt, kind: info.kind || 'day' } : null;
        if (isQuota) {
            if (this._approved[ak] === info.resetAt) return;
            if (this._declined[ak] === info.resetAt) throw this.pausedError(p, info.model, quotaSt, 'declined');
        } else if (this._approved[ak] === 'session') {
            return;
        }
        this._pending = this._pending || {};
        const pk = ak + '|' + (isQuota ? info.resetAt : 'model');
        if (!this._pending[pk]) {
            this._pending[pk] = this._askPaidConsent(info).finally(() => { delete this._pending[pk]; });
        }
        const ok = await this._pending[pk];
        if (!ok) {
            if (isQuota) {
                this._declined[ak] = info.resetAt;
                throw this.pausedError(p, info.model, quotaSt, 'declined');
            }
            const e = new Error('Bạn đã từ chối dùng API trả phí nên tác vụ AI này không được thực hiện.');
            e.isDeclined = true;
            throw e;
        }
        this._approved[ak] = isQuota ? info.resetAt : 'session';
        if (this.isCapReached(p)) throw this.capError(p);
    },
    _askPaidConsent(info) {
        return new Promise(resolve => {
            const sp = this.getSpend(info.provider);
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
            if (info.reason === 'quota') {
                p1.textContent = `API MIỄN PHÍ của ${info.providerName} đã hết ${this.kindRule(info.provider, info.kind || 'day').label}. Hạn mức miễn phí sẽ phục hồi lúc ${this.formatReset(info.resetAt)}. Bạn có đồng ý dùng API TRẢ PHÍ của ${info.providerName} cho tới lúc đó không?`;
            } else if (info.reason === 'freeoff') {
                p1.textContent = `API MIỄN PHÍ của ${info.providerName} đang TẮT. Tác vụ này sẽ dùng API TRẢ PHÍ của ${info.providerName} (mô hình "${info.modelLabel}"). Bạn có đồng ý không?`;
            } else {
                p1.textContent = `Tác vụ này đang dùng mô hình "${info.modelLabel}" (${info.providerName}) chỉ có ở API trả phí.`;
            }
            const p2 = document.createElement('p');
            p2.style.cssText = 'font-size:13px;color:var(--text-muted);line-height:1.5;margin:0 0 14px;';
            p2.textContent = info.reason === 'quota'
                ? `Tháng này ${info.providerName} đã dùng ước tính $${sp.usd.toFixed(2)} / trần $${this.getCap(info.provider).toFixed(2)}. Nếu đồng ý, app dùng API trả phí cho tới khi hạn mức miễn phí phục hồi rồi tự chuyển về API miễn phí. Nếu không, app dừng dùng ${info.providerName} tới lúc phục hồi.`
                : `Tháng này ${info.providerName} đã dùng ước tính $${sp.usd.toFixed(2)} / trần $${this.getCap(info.provider).toFixed(2)}. Nếu đồng ý, app được dùng API trả phí cho các yêu cầu cần thiết đến khi bạn đóng app; lần mở sau sẽ hỏi lại.`;
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
            const no = document.createElement('button');
            no.type = 'button'; no.className = 'secondary-btn neumorphic-btn'; no.textContent = 'Không đồng ý';
            const yes = document.createElement('button');
            yes.type = 'button'; yes.className = 'primary-btn neumorphic-btn'; yes.textContent = 'Đồng ý dùng';
            const done = (val) => {
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
