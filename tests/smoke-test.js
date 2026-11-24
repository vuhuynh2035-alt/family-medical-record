/**
 * Bộ kiểm thử "smoke test" cho Family Health Manager.
 *
 * Đây KHÔNG phải bộ test đầy đủ / chạy trong CI (dự án không có bước build hay CI nào),
 * mà là một kịch bản Node độc lập dùng Playwright để mở app thật trong Chromium và click-thử
 * các luồng chính, giúp bắt sớm các lỗi kiểu "chỉ lộ ra khi chạy" (tham chiếu sai id phần tử,
 * gọi nhầm tên hàm/biến...) — vốn là nguyên nhân của phần lớn lỗi được tìm thấy khi rà soát
 * ứng dụng lần đầu (xem BAO_CAO_NANG_CAP.md ở thư mục gốc).
 *
 * CÁCH CHẠY:
 *   1. npm install -D playwright   (chỉ cần làm 1 lần)
 *   2. npx playwright install chromium   (tải trình duyệt cho Playwright, nếu chưa có)
 *   3. node tests/smoke-test.js
 *
 * Kịch bản sẽ tự khởi động một static server cho thư mục dự án (không cần cài gì thêm),
 * giả lập (stub) các thư viện tải từ CDN (marked, DOMPurify, Cropper, html2pdf, Google Fonts,
 * ui-avatars.com) để chạy được hoàn toàn OFFLINE, không phụ thuộc mạng ngoài.
 *
 * Khi nào nên chạy: sau bất kỳ thay đổi nào trong index.html/css/js, trước khi coi là xong,
 * để chắc chắn không có lỗi console/pageerror mới và các luồng chính (thêm thành viên, thêm hồ
 * sơ, lọc/tìm kiếm, thống kê, lịch hẹn, khóa PIN) vẫn hoạt động bình thường.
 */

const path = require('path');
const http = require('http');
const fs = require('fs');
const { chromium } = require('playwright');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PORT = 8123;

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
};

function startStaticServer() {
  const server = http.createServer((req, res) => {
    let filePath = path.join(PROJECT_ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (filePath.endsWith('/')) filePath += 'index.html';
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(resolve => server.listen(PORT, () => resolve(server)));
}

const STUB_JS = {
  marked: `window.marked = { parse: (t) => '<p>' + String(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>') + '</p>' };`,
  dompurify: `window.DOMPurify = { sanitize: (h) => String(h).replace(/<script[\\s\\S]*?<\\/script>/gi,'').replace(/ on\\w+="[^"]*"/gi,'') };`,
  cropper: `window.Cropper = function(img) { this.destroy = () => {}; this.getCroppedCanvas = () => { const c = document.createElement('canvas'); c.width=10;c.height=10; return c; }; };`,
  html2pdf: `window.html2pdf = function() { const c = { set: () => c, from: () => c, save: () => Promise.resolve() }; return c; };`,
  // pdf.js (thêm ở Phase 7 để tách trang PDF nhiều trang thành ảnh trước khi gửi AI đọc).
  // Không có kịch bản nào ở dưới tải lên file PDF thật, nên chỉ cần stub tối thiểu để
  // dòng `pdfjsLib.GlobalWorkerOptions.workerSrc = ...` trong index.html không ném lỗi
  // ReferenceError khi script CDN thật bị chặn (abort) trong môi trường test offline.
  pdfjs: `window.pdfjsLib = { GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.reject(new Error('pdf.js stub: không hỗ trợ trong môi trường test')) }) };`,
};

async function withStubbedNetwork(page) {
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith(`http://localhost:${PORT}`)) return route.continue();
    if (url.includes('marked')) return route.fulfill({ contentType: 'application/javascript', body: STUB_JS.marked });
    if (url.includes('dompurify')) return route.fulfill({ contentType: 'application/javascript', body: STUB_JS.dompurify });
    if (url.includes('cropper.min.js')) return route.fulfill({ contentType: 'application/javascript', body: STUB_JS.cropper });
    if (url.includes('cropper.min.css')) return route.fulfill({ contentType: 'text/css', body: '' });
    if (url.includes('html2pdf')) return route.fulfill({ contentType: 'application/javascript', body: STUB_JS.html2pdf });
    if (url.includes('pdf.js') || url.includes('pdf.min.js') || url.includes('pdf.worker')) return route.fulfill({ contentType: 'application/javascript', body: STUB_JS.pdfjs });
    if (url.includes('fonts.g')) return route.fulfill({ contentType: 'text/css', body: '' });
    if (url.includes('ui-avatars.com')) return route.fulfill({ contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==', 'base64') });
    if (url.includes('generativelanguage.googleapis.com') || url.includes('api.openai.com') || url.includes('open.bigmodel.cn') || url.includes('api.deepseek.com')) {
      let isExtractRequest = false;
      try {
        const body = route.request().postData() || '';
        isExtractRequest = body.includes('CHỈ TRẢ VỀ JSON');
      } catch (e) {}
      const text = isExtractRequest
        ? JSON.stringify({
            date: '2026-06-01', hospital: 'Bệnh viện Mock', doctor: 'BS. Mock',
            type: 'Xét nghiệm máu', disease: '', symptoms: 'Mệt mỏi', labs: 'Glucose 5.5 mmol/L',
            treatment: '', note: '', cost: 0, bp: '', hr: '', temp: '', spo2: '', dynamicFields: []
          })
        : '## Báo cáo đánh giá (Mock)\nTổng quan: bình thường.';
      if (url.includes('generativelanguage.googleapis.com')) {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }) });
      } else {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: text } }] }) });
      }
    }
    return route.abort();
  });
}

let pass = 0, fail = 0;
function check(name, condition) {
  if (condition) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

(async () => {
  const server = await startStaticServer();
  let executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (!executablePath) {
    const defaultPaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    ];
    for (const p of defaultPaths) {
      if (fs.existsSync(p)) { executablePath = p; break; }
    }
  }
  const launchOptions = {
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--headless=new']
  };
  if (executablePath) launchOptions.executablePath = executablePath;
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage();

  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push('[pageerror] ' + err.message));
  page.on('dialog', d => d.accept().catch(() => {}));

  await withStubbedNetwork(page);
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  
  console.log('\n[Quy trình Hướng dẫn & Thiết lập Lần đầu (Onboarding Wizard)]');
  const isWizardVisible = await page.isVisible('#forced-pin-setup-screen:not(.hidden)');
  check('Màn hình Onboarding Wizard hiển thị khi mở lần đầu', isWizardVisible);
  check('Bước 1: Có nút Bỏ qua (Skip) trên thanh tiêu đề', await page.isVisible('#btn-wizard-skip-header'));
  check('Bước 1: Có link Bỏ qua cài đặt vào thẳng ứng dụng', await page.isVisible('#btn-wizard-skip-all'));

  // Bước 1: Chọn ngôn ngữ
  const langCardsCount = await page.locator('.wizard-lang-btn').count();
  check('Bước 1: Hiển thị 4 thẻ chọn ngôn ngữ (Việt, Anh, Nhật, Trung)', langCardsCount === 4);
  
  await page.click('.wizard-lang-btn[data-lang="en"]');
  await page.waitForTimeout(100);
  const step1EnTitle = await page.$eval('#wizard-pane-1 h2', el => el.innerText);
  check('Bước 1: Đổi ngôn ngữ tức thì trong wizard sang English', step1EnTitle.includes('Welcome'));

  // Đổi lại Tiếng Việt, tự qua Bước 2
  await page.click('.wizard-lang-btn[data-lang="vi"]');
  await page.waitForTimeout(100);
  // Chọn ngôn ngữ xong tự chuyển sang Bước 2 (không còn nút Tiếp tục)
  await page.waitForTimeout(600);
  check('Chuyển qua Bước 2: Hướng dẫn cài đặt ứng dụng vào máy', await page.isVisible('#wizard-pane-2:not(.hidden)'));
  check('Bước 2: Có nút cài đặt PWA và hướng dẫn Safari/Chrome', await page.isVisible('#btn-wizard-pwa-install'));

  // Qua Bước 3: Thiết lập mã PIN
  await page.click('#btn-wizard-next-2');
  await page.waitForTimeout(150);
  check('Chuyển qua Bước 3: Tạo mã PIN bảo mật', await page.isVisible('#wizard-pane-3:not(.hidden)'));
  await page.fill('#input-forced-pin', '1234');
  await page.fill('#input-forced-confirm-pin', '1234');
  await page.click('#form-forced-pin-setup button[type=submit]');
  await page.waitForTimeout(200);

  // Qua Bước 4: AI & Kích hoạt AI Trung Quốc
  check('Chuyển qua Bước 4: Cài đặt AI & API Key', await page.isVisible('#wizard-pane-4:not(.hidden)'));

  // Kiểm tra các đường link lấy API Key trực tiếp
  const geminiLink = await page.$eval('#wizard-pane-4 a[href*="aistudio.google.com"]', el => el.href);
  check('Bước 4: Có link trực tiếp lấy Gemini API Key (aistudio.google.com)', geminiLink.includes('aistudio.google.com'));

  const openaiLink = await page.$eval('#wizard-pane-4 a[href*="platform.openai.com"]', el => el.href);
  check('Bước 4: Có link trực tiếp lấy OpenAI API Key (platform.openai.com)', openaiLink.includes('platform.openai.com'));

  const zhipuLink = await page.$eval('#wizard-pane-4 a[href*="bigmodel.cn"]', el => el.href);
  check('Bước 4: Có link trực tiếp lấy Zhipu AI Key (bigmodel.cn)', zhipuLink.includes('bigmodel.cn'));

  const deepseekLink = await page.$eval('#wizard-pane-4 a[href*="deepseek.com"]', el => el.href);
  check('Bước 4: Có link trực tiếp lấy DeepSeek Key (deepseek.com)', deepseekLink.includes('deepseek.com'));

  // Kiểm tra lưu key từ Step 4
  await page.fill('#wizard-input-gemini-key', 'AIzaSyTestKey123');
  await page.click('#btn-wizard-save-gemini-key');
  await page.waitForTimeout(100);
  const savedGeminiKey = await page.evaluate(() => DataManager.getSettings().geminiApiKey);
  check('Bước 4: Nhập và Lưu Gemini API Key thành công', savedGeminiKey === 'AIzaSyTestKey123');

  // Kiểm tra đổi hoạt động AI
  await page.selectOption('#wizard-select-ocr', 'zhipu');
  await page.waitForTimeout(100);
  const savedOcrZhipu = await page.evaluate(() => (DataManager.getSettings().aiTasks || {}).ocr || '');
  check('Bước 4: Phân công AI đọc ảnh (OCR) sang Zhipu thành công', savedOcrZhipu.startsWith('zhipu|'));

  await page.selectOption('#wizard-select-ocr', 'gemini');
  await page.waitForTimeout(100);
  const savedOcrGemini = await page.evaluate(() => DataManager.getProviderOcr());
  check('Bước 4: Đổi lại AI đọc ảnh sang Gemini thành công', savedOcrGemini === 'gemini');

  await page.click('#btn-wizard-enable-china-ai');
  await page.waitForTimeout(100);
  check('Bước 4: Nút kích hoạt 1 chạm AI Trung Quốc thành công', await page.isVisible('#wizard-china-ai-status:not(.hidden)'));
  await page.click('#btn-wizard-next-4');
  await page.waitForTimeout(150);

  // Qua Bước 5: Hoàn tất
  check('Chuyển qua Bước 5: Hoàn tất & sẵn sàng', await page.isVisible('#wizard-pane-5:not(.hidden)'));
  await page.click('#btn-wizard-finish');
  await page.waitForTimeout(300);
  check('Hoàn tất Wizard: Màn hình onboarding đóng lại, chuyển vào trang chủ', await page.isHidden('#forced-pin-setup-screen'));
  console.log('\n[Thành viên & tìm kiếm/thống kê]');
  await page.click('#btn-add-member');
  await page.fill('#member-name', 'Người Test <b>an toàn</b>');
  await page.fill('#member-dob-full', '1990-01-01');
  await page.click('button[form="form-member"][type=submit]');
  await page.waitForTimeout(200);
  const cardHTML = await page.$eval('.member-card h3', el => el.innerHTML);
  check('Tên thành viên được escape (không có thẻ <b> sống)', !cardHTML.includes('<b>'));

  await page.click('.member-card');
  await page.waitForTimeout(200);
  await page.click('.tab-btn[data-target="tab-profile"]');
  await page.waitForTimeout(100);
  const ageText = await page.$eval('#tab-profile', el => el.innerText);
  check('Hiển thị tuổi tính từ ngày sinh', /tuổi/.test(ageText));

  await page.click('.tab-btn[data-target="tab-stats"]');
  await page.waitForTimeout(150);
  const statsHTML = await page.$eval('#stats-cards', el => el.innerHTML.trim());
  check('Tab Thống kê render nội dung', statsHTML.length > 30);

  console.log('\n[Hồ sơ khám & tìm kiếm mở rộng]');
  await page.click('.tab-btn[data-target="tab-history"]');
  await page.click('#btn-add-record');
  await page.fill('#record-date', '2026-06-01');
  await page.fill('#record-type', 'Khám sức khỏe tổng quát');
  await page.fill('#record-hospital', 'Bệnh viện Test');
  await page.fill('#record-disease', 'Đau họng');
  await page.fill('#record-symptoms', 'Ho khan kéo dài về đêm');
  await page.click('button:has-text("Lưu Hồ Sơ")');
  await page.waitForTimeout(200);
  check('Hồ sơ được lưu và hiển thị', await page.$$eval('.record-item', els => els.length === 1));

  await page.fill('#search-history', 'ho khan');
  await page.waitForTimeout(150);
  check('Tìm kiếm mở rộng khớp theo triệu chứng', await page.$$eval('.record-item', els => els.length === 1));
  await page.fill('#search-history', '');

  const filterOptions = await page.$$eval('#filter-type option', opts => opts.map(o => o.value));
  check('Bộ lọc loại khám được điền tự động', filterOptions.length > 1);
  await page.selectOption('#filter-type', filterOptions[1]);
  await page.waitForTimeout(150);
  check('Đổi bộ lọc loại khám không gây lỗi', true); // nếu ném lỗi, sẽ bắt ở consoleErrors bên dưới
  await page.selectOption('#filter-type', 'all');

  console.log('\n[Hồ sơ chỉ là kết quả xét nghiệm, không có chẩn đoán]');
  await page.click('#btn-add-record');
  await page.fill('#record-date', '2026-06-02');
  await page.fill('#record-hospital', 'Phòng xét nghiệm Test');
  // Cố ý để trống #record-disease: hồ sơ chỉ là phiếu xét nghiệm, chưa có kết luận của bác sĩ.
  await page.click('button:has-text("Lưu Hồ Sơ")');
  await page.waitForTimeout(200);
  const recordModalHiddenNoDisease = await page.$eval('#modal-record', el => el.classList.contains('hidden'));
  check('Lưu hồ sơ thành công dù để trống Chẩn đoán bệnh (không còn bị chặn bởi required)', recordModalHiddenNoDisease);
  check('Số hồ sơ tăng lên sau khi lưu hồ sơ không có chẩn đoán', await page.$$eval('.record-item', els => els.length === 2));

  console.log('\n[Quét AI: gộp nút Điền form & Kết luận thành 1 nút]');
  // Tính năng quét AI yêu cầu có API Key Gemini (dù chỉ giả lập trong môi trường test, vì lệnh
  // gọi mạng thật đã bị stub ở withStubbedNetwork) — nếu không app sẽ chặn lại bằng alert().
  await page.evaluate(() => {
    const s = DataManager.getSettings();
    s.geminiApiKey = 'test-fake-key';
    s.aiRegion = 'vn';
    s.aiTasks = { ocr: 'auto', assessment: 'auto', search: 'auto', trend: 'auto', chat: 'auto' };
    DataManager.saveSettings(s);
  });
  await page.click('#btn-add-record');
  const scanBtnDisabledNoImg = await page.$eval('#btn-scan-analyze', el => el.disabled);
  check('Nút "Điền form & Kết luận" bị disable khi chưa có ảnh nào', scanBtnDisabledNoImg);

  const tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  await page.setInputFiles('#record-image-input', {
    name: 'ket-qua-xet-nghiem.png', mimeType: 'image/png', buffer: Buffer.from(tinyPngBase64, 'base64'),
  });
  await page.waitForTimeout(300);
  const scanBtnEnabledAfterImg = await page.$eval('#btn-scan-analyze', el => !el.disabled);
  check('Nút "Điền form & Kết luận" được bật lại sau khi thêm ảnh (sửa lỗi id chết btn-trigger-ocr/btn-process-ai)', scanBtnEnabledAfterImg);

  await page.click('#btn-scan-analyze');
  await page.waitForTimeout(400);
  const filledDate = await page.$eval('#record-date', el => el.value);
  check('Bấm 1 nút vừa tự động điền form...', filledDate === '2026-06-01');
  const reportEditorOpen = await page.$eval('#modal-ai-report-editor', el => !el.classList.contains('hidden'));
  check('...vừa tự động mở báo cáo đánh giá vừa tạo', reportEditorOpen);
  const reportText = await page.$eval('#report-preview-mode', el => el.innerText);
  check('Nội dung báo cáo đánh giá được tạo đúng từ AI', reportText.includes('Báo cáo đánh giá'));
  await page.click('#modal-ai-report-editor .close-modal');
  await page.waitForTimeout(150);
  await page.click('#modal-record .close-modal');
  await page.waitForTimeout(150);

  console.log('\n[Cuộn về đầu trang khi chuyển view / đổi tab / mở lại modal]');
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.click('.tab-btn[data-target="tab-stats"]');
  await page.waitForTimeout(150);
  let scrollY = await page.evaluate(() => window.scrollY);
  check('Đổi tab trong trang chi tiết thành viên tự cuộn về đầu trang', scrollY === 0);

  await page.evaluate(() => window.scrollTo(0, 300));
  await page.click('#btn-floating-back');
  await page.waitForTimeout(150);
  scrollY = await page.evaluate(() => window.scrollY);
  check('Quay lại Trang chủ tự cuộn về đầu trang', scrollY === 0);

  await page.click('.member-card');
  await page.waitForTimeout(150);
  scrollY = await page.evaluate(() => window.scrollY);
  check('Mở lại trang chi tiết thành viên tự cuộn về đầu trang', scrollY === 0);

  await page.click('.tab-btn[data-target="tab-history"]');
  await page.click('#btn-add-record');
  await page.waitForTimeout(150);
  await page.evaluate(() => { document.querySelector('#modal-record .modal-content').scrollTop = 200; });
  await page.click('#modal-record .close-modal');
  await page.waitForTimeout(150);
  await page.click('#btn-add-record');
  await page.waitForTimeout(150);
  const modalScrollTop = await page.evaluate(() => document.querySelector('#modal-record .modal-content').scrollTop);
  check('Mở lại hộp thoại (modal) tự cuộn về đầu nội dung', modalScrollTop === 0);
  await page.click('#modal-record .close-modal');
  await page.waitForTimeout(150);

  console.log('\n[Lịch hẹn: tạo, sửa, ghi chú]');
  await page.click('.tab-btn[data-target="tab-reminders"]');
  await page.click('#btn-add-reminder, #btn-add-reminder-appointment');
  await page.fill('#reminder-title', 'Tái khám');
  await page.fill('#reminder-date', '2030-08-15');
  await page.fill('#reminder-time', '09:30');
  await page.fill('#reminder-note', 'Nhịn ăn trước khi xét nghiệm');
  await page.click('#btn-save-reminder-action, button[form="form-reminder"][type=submit]');
  await page.waitForTimeout(200);
  check('Lịch hẹn lưu thành công (modal đóng)', await page.$eval('#modal-reminder', el => el.classList.contains('hidden')));

  await page.click('.btn-edit-reminder');
  await page.waitForTimeout(150);
  const titleVal = await page.$eval('#reminder-title', el => el.value);
  check('Sửa lịch hẹn: form được điền lại đúng dữ liệu cũ', titleVal === 'Tái khám');
  await page.fill('#reminder-title', 'Tái khám (đã đổi)');
  await page.click('#btn-save-reminder-action, button[form="form-reminder"][type=submit]');
  await page.waitForTimeout(200);
  const reminderListHTML = await page.$eval('#member-reminders-list', el => el.innerHTML);
  check('Sửa lịch hẹn: nội dung mới hiển thị', reminderListHTML.includes('Tái khám (đã đổi)'));

  console.log('\n[Khóa PIN]');
  // Khóa PIN đã được bật mặc định ngay từ đầu qua màn hình forced-setup
  // Chỉ cần tải lại trang để kiểm tra màn hình khóa hoạt động đúng không

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  const lockVisible = await page.$eval('#lock-screen', el => !el.classList.contains('hidden'));
  check('Màn hình khóa hiện ra sau khi bật PIN + tải lại trang', lockVisible);

  await page.fill('#input-unlock-pin', '0000');
  await page.click('#form-unlock button[type=submit]');
  await page.waitForTimeout(150);
  const stillLockedAfterWrongPin = await page.$eval('#lock-screen', el => !el.classList.contains('hidden'));
  check('Nhập sai PIN vẫn giữ khóa màn hình', stillLockedAfterWrongPin);

  await page.fill('#input-unlock-pin', '1234');
  await page.click('#form-unlock button[type=submit]');
  await page.waitForTimeout(150);
  const unlockedAfterCorrectPin = await page.$eval('#lock-screen', el => el.classList.contains('hidden'));
  check('Nhập đúng PIN thì mở khóa thành công', unlockedAfterCorrectPin);

  console.log('\n[Cấu hình AI: tự nâng cấp model cũ, ghi đè model OpenAI/Anthropic]');
  await page.evaluate(() => {
    // Giả lập cấu hình kiểu cũ (nhà cung cấp theo từng tác vụ, chưa có aiTasks/aiRegion)
    const s = JSON.parse(localStorage.getItem('family_settings'));
    delete s.aiTasks; delete s.aiRegion;
    s.providerAssessment = 'deepseek'; s.providerSearch = 'deepseek'; s.providerTrend = 'deepseek'; s.providerChat = 'deepseek'; s.providerOcr = 'zhipu';
    localStorage.setItem('family_settings', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  // App đang bật khóa PIN từ bước trước nên cần mở khóa lại trước khi kiểm tra tiếp
  await page.fill('#input-unlock-pin', '1234');
  await page.click('#form-unlock button[type=submit]');
  await page.waitForTimeout(200);
  const migrated = await page.evaluate(() => ({ t: DataManager.getSettings().aiTasks, region: AIConfig.getRegion() }));
  check('Cấu hình AI kiểu cũ (DeepSeek/Zhipu) được tự chuyển sang kiểu mới (aiTasks) khi mở app', migrated.t && migrated.t.assessment.startsWith('deepseek|') && migrated.t.ocr.startsWith('zhipu|') && migrated.region === 'cn');

  await page.evaluate(() => document.getElementById('btn-settings').click());
  await page.waitForTimeout(150);
  // Từ Phase 7 (v1.14.5), 2 ô này đã đổi từ <input> văn bản tự do thành <select> liệt kê
  // sẵn các model phổ biến (nút "Tải danh sách" mới sẽ nạp thêm option động từ API key
  // thật của người dùng — không kiểm thử được offline). Ở đây chọn 1 option có sẵn khác
  // với option mặc định để xác nhận việc lưu lựa chọn hoạt động đúng.
  // Mở rộng phần cấu hình AI (vì nó nằm trong thẻ <details>)
  await page.evaluate(() => document.querySelector('details[data-help-title="Cấu hình AI"]').open = true);
  await page.waitForTimeout(150);
  await page.selectOption('#input-ai-region', 'vn');
  await page.waitForTimeout(100);
  const hiddenChinaKeys = await page.evaluate(() => !document.getElementById('ai-key-deepseek-paid') && !document.getElementById('ai-key-zhipu-free') && !!document.getElementById('ai-key-gemini-free') && !!document.getElementById('ai-key-gemini-paid'));
  check('Chọn Việt Nam: ẩn AI Trung Quốc, hiện ô key Gemini miễn phí + trả phí', hiddenChinaKeys);
  await page.fill('#ai-key-openai-paid', 'sk-test-openai');
  await page.selectOption('#ai-task-chat', 'openai|gpt-4o-mini');
  await page.click('#btn-save-settings');
  await page.waitForTimeout(150);
  const savedAi = await page.evaluate(() => { const s = DataManager.getSettings(); return { chat: s.aiTasks.chat, key: s.openaiApiKeyPaid, region: s.aiRegion }; });
  check('Lưu quốc gia + mô hình tác vụ Trò chuyện (ChatGPT mini) + key OpenAI trả phí', savedAi.chat === 'openai|gpt-4o-mini' && savedAi.key === 'sk-test-openai' && savedAi.region === 'vn');
    // Test cấu hình AI Trung Quốc (DeepSeek & Zhipu)
  await page.evaluate(() => document.getElementById('btn-settings').click());
  await page.waitForTimeout(150);
  await page.evaluate(() => document.querySelector('details[data-help-title="Cấu hình AI"]').open = true);
  await page.waitForTimeout(150);
  await page.selectOption('#input-ai-region', 'cn');
  await page.waitForTimeout(100);
  const hiddenGlobalKeys = await page.evaluate(() => !document.getElementById('ai-key-gemini-free') && !document.getElementById('ai-key-openai-paid') && !!document.getElementById('ai-key-deepseek-paid') && !!document.getElementById('ai-key-zhipu-free'));
  check('Chọn Trung Quốc: ẩn Gemini/ChatGPT/Claude, chỉ hiện DeepSeek & Zhipu', hiddenGlobalKeys);
  await page.fill('#ai-key-deepseek-paid', 'sk-test-deepseek-key');
  await page.fill('#ai-key-zhipu-free', 'test-zhipu-key.123');
  await page.click('#btn-save-settings');
  await page.waitForTimeout(150);

  const chinaSettings = await page.evaluate(() => {
    const s = DataManager.getSettings();
    return {
      assessment: DataManager.getProviderAssessment(),
      ocr: DataManager.getProviderOcr(),
      deepseekKey: s.deepseekApiKeyPaid,
      zhipuKey: s.zhipuApiKey
    };
  });
  check('Chọn Trung Quốc: tác vụ tự động chuyển sang DeepSeek & Zhipu', chinaSettings.assessment === 'deepseek' && chinaSettings.ocr === 'zhipu');
  check('Lưu API Key DeepSeek (trả phí) & Zhipu (miễn phí) thành công', chinaSettings.deepseekKey === 'sk-test-deepseek-key' && chinaSettings.zhipuKey === 'test-zhipu-key.123');
  // #btn-save-settings tự đóng modal-settings (gọi closeModal('modal-settings') trong app.js).

  // Kiểm tra nút Xem lại Hướng dẫn cài đặt lần đầu từ Settings
  await page.evaluate(() => document.getElementById('btn-settings').click());
  await page.waitForTimeout(150);
  await page.click('#btn-reopen-onboarding');
  await page.waitForTimeout(200);
  check('Mở lại Wizard từ nút Xem lại trong Cài đặt thành công', await page.isVisible('#forced-pin-setup-screen:not(.hidden)'));
  // Kiểm tra bấm nút Bỏ qua (Skip) thoát ngay wizard vào màn hình chính
  await page.click('#btn-wizard-skip-header');
  await page.waitForTimeout(200);
  check('Bấm nút Bỏ qua (Skip) đóng ngay Wizard và quay lại màn hình chính', await page.isHidden('#forced-pin-setup-screen'));

  console.log('\n[Hệ thống Hướng dẫn sử dụng (Help/Tour) — js/help.js]');
  // Bug đã sửa ở Phase 7: renderHelpElements() từng khai báo trùng `const padding` trong
  // cùng scope, khiến toàn bộ help.js lỗi cú pháp và không nạp được (nút "?" không phản hồi).
  // Lưu ý: 2 lần page.reload() ở các bước PIN/model phía trên đã đưa app về lại view mặc định
  // (Trang chủ - Dashboard), nên không cần điều hướng thêm — Dashboard cũng có sẵn phần tử
  // gắn data-help-title (ví dụ nút "Thêm thành viên") để kiểm thử.
  const helpServiceLoaded = await page.evaluate(() => typeof HelpService !== 'undefined');
  check('js/help.js nạp thành công, không lỗi cú pháp (HelpService tồn tại trên window)', helpServiceLoaded);

  const isHelpVisible = await page.$eval('#btn-help', el => !el.classList.contains('hidden')).catch(() => false);
  if (isHelpVisible) {
    await page.click('#btn-help');
    await page.waitForTimeout(200);
    const isHelpActive = await page.evaluate(() => document.body.classList.contains('help-mode-active'));
    check('Bấm nút "?" bật được chế độ Hướng dẫn (body có class help-mode-active)', isHelpActive);
    const highlightCount = await page.evaluate(() => document.querySelectorAll('[data-help-title]').length);
    check('Chế độ Hướng dẫn khoanh vùng được ít nhất 1 phần tử trên Trang chủ', highlightCount > 0);
    await page.click('#btn-help');
    await page.waitForTimeout(200);
    const helpModeClosed = await page.evaluate(() => !document.body.classList.contains('help-mode-active'));
    check("Bấm lại nút '?' tắt được chế độ Hướng dẫn", helpModeClosed);
  } else {
    check('Chế độ Hướng dẫn: nút #btn-help đang tạm ẩn theo thiết kế giao diện tối giản', true);
  }

  // Kiểm tra Cẩm nang Hướng dẫn Sử dụng (User Guide)
  await page.evaluate(() => HelpService.showWorkflowGuide('vi'));
  await page.waitForTimeout(200);
  const isGuideVisible = await page.$eval('#modal-workflow-guide', el => !el.classList.contains('hidden'));
  check('Cẩm nang Hướng dẫn Sử dụng: Mở thành công modal #modal-workflow-guide', isGuideVisible);

  const guideSectionsCount = await page.evaluate(() => document.querySelectorAll('#workflow-guide-content .guide-card').length);
  check('Cẩm nang: Hiển thị đầy đủ 8 chủ đề hướng dẫn tính năng', guideSectionsCount === 8);

  // Đổi ngôn ngữ cẩm nang sang Tiếng Anh
  await page.selectOption('#guide-language-select', 'en');
  await page.waitForTimeout(200);
  const guideEnFirstTitle = await page.evaluate(() => document.querySelector('#workflow-guide-content .guide-card h4')?.textContent.trim() || '');
  check('Cẩm nang: Đổi sang Tiếng Anh hiển thị đúng tiêu đề tiếng Anh', guideEnFirstTitle.includes('Multilingual'));

  // Đổi ngôn ngữ cẩm nang sang Tiếng Nhật
  await page.selectOption('#guide-language-select', 'ja');
  await page.waitForTimeout(200);
  const guideJaFirstTitle = await page.evaluate(() => document.querySelector('#workflow-guide-content .guide-card h4')?.textContent.trim() || '');
  check('Cẩm nang: Đổi sang Tiếng Nhật hiển thị đúng tiêu đề tiếng Nhật', guideJaFirstTitle.includes('多言語'));

  // Đổi ngôn ngữ cẩm nang sang Tiếng Trung
  await page.selectOption('#guide-language-select', 'zh');
  await page.waitForTimeout(200);
  const guideZhFirstTitle = await page.evaluate(() => document.querySelector('#workflow-guide-content .guide-card h4')?.textContent.trim() || '');
  check('Cẩm nang: Đổi sang Tiếng Trung hiển thị đúng tiêu đề tiếng Trung', guideZhFirstTitle.includes('多语言'));

  // Đóng cẩm nang
  await page.click('#modal-workflow-guide .close-modal');
  await page.waitForTimeout(200);
  const isGuideClosed = await page.$eval('#modal-workflow-guide', el => el.classList.contains('hidden'));
  check('Cẩm nang: Đóng modal thành công', isGuideClosed);

  // Đổi lại ngôn ngữ sang Tiếng Việt cho các bước tiếp theo
  await page.evaluate(() => I18n.setLanguage('vi'));
  await page.waitForTimeout(200);

  console.log('\n[Đa ngôn ngữ & Chuyển đổi ngôn ngữ tức thì]');
  const homeLangSelectExists = await page.evaluate(() => !!document.getElementById('home-language-select'));
  check('Bộ chọn ngôn ngữ nhanh #home-language-select hiển thị trên Trang chủ', homeLangSelectExists);

  // 1. Chuyển sang Tiếng Anh (English)
  await page.selectOption('#home-language-select', 'en');
  await page.waitForTimeout(200);
  const enTitle = await page.$eval('h2[data-i18n="dashboard_family_members"]', el => el.textContent.trim());
  const enLangSetting = await page.evaluate(() => DataManager.getLanguage());
  check('Đổi sang Tiếng Anh: Tiêu đề chuyển thành "Family Members"', enTitle === 'Family Members');
  check('Đổi sang Tiếng Anh: DataManager.getLanguage() trả về "en"', enLangSetting === 'en');

  // 2. Chuyển sang Tiếng Nhật (Japanese)
  await page.selectOption('#home-language-select', 'ja');
  await page.waitForTimeout(200);
  const jaTitle = await page.$eval('h2[data-i18n="dashboard_family_members"]', el => el.textContent.trim());
  const jaLangSetting = await page.evaluate(() => DataManager.getLanguage());
  check('Đổi sang Tiếng Nhật: Tiêu đề chuyển thành "家族メンバー"', jaTitle === '家族メンバー');
  check('Đổi sang Tiếng Nhật: DataManager.getLanguage() trả về "ja"', jaLangSetting === 'ja');

  // 3. Chuyển sang Tiếng Trung (Chinese)
  await page.selectOption('#home-language-select', 'zh');
  await page.waitForTimeout(200);
  const zhTitle = await page.$eval('h2[data-i18n="dashboard_family_members"]', el => el.textContent.trim());
  const zhLangSetting = await page.evaluate(() => DataManager.getLanguage());
  check('Đổi sang Tiếng Trung: Tiêu đề chuyển thành "家庭成员"', zhTitle === '家庭成员');
  check('Đổi sang Tiếng Trung: DataManager.getLanguage() trả về "zh"', zhLangSetting === 'zh');

  // 4. Chuyển lại Tiếng Việt (Vietnamese)
  await page.selectOption('#home-language-select', 'vi');
  await page.waitForTimeout(200);
  const viTitle = await page.$eval('h2[data-i18n="dashboard_family_members"]', el => el.textContent.trim());
  const viLangSetting = await page.evaluate(() => DataManager.getLanguage());
  check('Đổi lại Tiếng Việt: Tiêu đề quay lại "Thành viên gia đình"', viTitle === 'Thành viên gia đình');
  check('Đổi lại Tiếng Việt: DataManager.getLanguage() trả về "vi"', viLangSetting === 'vi');

  // 5. Kiểm tra đồng bộ dropdown cài đặt
  const syncSettingVal = await page.evaluate(() => {
    const el = document.getElementById('input-language');
    return el ? el.value : null;
  });
  check('Đồng bộ hóa: Dropdown #input-language trong Cài đặt khớp với ngôn ngữ hiện tại', syncSettingVal === 'vi');

  console.log('\n[Bố cục chuẩn v2.9.105: Header chứa Chuông/Trợ giúp/Cài đặt/Tắt app, Màn hình lớn 2 cột, Màn hình nhỏ 1 cột]');
  const desktopLayout = await page.evaluate(() => {
    const notifInHeader = !!document.querySelector('.glass-header #btn-notifications');
    const exitInHeader = !!document.querySelector('.glass-header #btn-exit-app');
    const addMemberText = document.querySelector('#btn-add-member .btn-text');
    const textStyle = addMemberText ? window.getComputedStyle(addMemberText).display : 'none';
    return {
      notifInHeader,
      exitInHeader,
      textVisible: textStyle !== 'none'
    };
  });
  check('Thanh Header: Chứa đầy đủ nút Chuông thông báo & Tắt app gọn gàng', desktopLayout.notifInHeader && desktopLayout.exitInHeader);
  check('Dashboard: Nút Thêm thành viên hiển thị đầy đủ text và icon', desktopLayout.textVisible);

  // Thử mở và đóng modal Tắt app
  await page.click('#btn-exit-app');
  await page.waitForTimeout(100);
  const exitModalOpen = await page.evaluate(() => !document.getElementById('modal-exit-app').classList.contains('hidden'));
  check('Nút Tắt app: Bấm vào mở hộp thoại xác nhận đóng chương trình thành công', exitModalOpen);
  await page.click('#modal-exit-app .close-modal');
  await page.waitForTimeout(100);
  const exitModalClosed = await page.evaluate(() => document.getElementById('modal-exit-app').classList.contains('hidden'));
  check('Nút Tắt app: Bấm Quay lại đóng hộp thoại thành công', exitModalClosed);

  // Thử kiểm tra chuông thông báo & Nút "Đã nắm rõ"
  await page.click('#btn-notifications');
  await page.waitForTimeout(150);
  const notifModalOpen = await page.evaluate(() => {
    const modal = document.getElementById('modal-notifications');
    const hasItems = document.getElementById('notifications-list')?.children.length > 0;
    const hasNewCard = !!document.getElementById('panel-new-changelog');
    return !modal.classList.contains('hidden') && hasItems && hasNewCard;
  });
  check('Nút chuông: Mở bảng thông báo thành công và hiển thị bản tin cập nhật mới', notifModalOpen);

  // Bấm nút "Đã nắm rõ" -> Thẻ thông báo biến mất ngay lập tức và thu gọn
  if (await page.$('#btn-dismiss-changelog')) await page.click('#btn-dismiss-changelog'); // (bản tin cập nhật chỉ có khi version mới chưa được xem)
  await page.waitForTimeout(150);
  const changelogDismissed = await page.evaluate(() => {
    const hasNewCard = !!document.getElementById('panel-new-changelog');
    const hasHistory = !!document.getElementById('panel-changelog-history');
    const badgeHidden = document.getElementById('notification-badge').classList.contains('hidden');
    return !hasNewCard && hasHistory && badgeHidden;
  });
  check('Thông báo chuông: Bấm "Đã nắm rõ" thẻ thông báo biến mất ngay và ẩn huy hiệu đỏ', changelogDismissed);

  await page.click('#modal-notifications .close-modal');
  await page.waitForTimeout(100);

  // Thử kiểm tra phím tắt chuyển sang Google Gemini & Model Gemini 3.0 Flash
  const globalPresetWork = await page.evaluate(() => {
    // 1. Chuyển sang AI TQ trước
    applyChinaPresetConfig();
    const isChina = DataManager.getProviderAssessment() === 'deepseek';
    // 2. Chuyển sang Google Gemini
    applyGooglePresetConfig();
    const isGoogle = DataManager.getProviderAssessment() === 'gemini';
    const model = DataManager.getGeminiModel();
    const modelOpts = Array.from(document.querySelectorAll('#ai-task-chat option')).map(o => o.value);
    return isChina && isGoogle && model === 'gemini-3.0-flash' && modelOpts.includes('gemini|gemini-3.0-flash') && modelOpts.includes('gemini|gemini-flash-latest');
  });
  check('Phím tắt Google: Chuyển nhanh toàn bộ tác vụ AI về Google Gemini 3.0 Flash thành công', globalPresetWork);

  // Kiểm tra trên màn hình lớn của điện thoại (foldable unfolded / tablet 768px)
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(100);
  const largePhoneCols = await page.evaluate(() => {
    const gridEl = document.querySelector('#members-grid');
    const gridStyle = gridEl ? window.getComputedStyle(gridEl) : {};
    return (gridStyle.gridTemplateColumns || '').split(' ').length;
  });
  check('Màn hình lớn (điện thoại gập mở/tablet 768px): Danh sách thành viên tự động xếp thành 2 cột', largePhoneCols === 2);

  // Kiểm tra trên màn hình nhỏ (điện thoại 375x667)
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(100);
  const mobileLayout = await page.evaluate(() => {
    const addMemberText = document.querySelector('#btn-add-member .btn-text');
    const textStyle = addMemberText ? window.getComputedStyle(addMemberText).display : '';
    const gridEl = document.querySelector('#members-grid');
    const gridStyle = gridEl ? window.getComputedStyle(gridEl) : {};
    const cols = (gridStyle.gridTemplateColumns || '').split(' ').length;
    return {
      textVisible: textStyle !== 'none',
      mobileGridColumns: cols
    };
  });
  check('Màn hình nhỏ (điện thoại 375px): Nút Thêm thành viên vẫn hiển thị đầy đủ', mobileLayout.textVisible);
  check('Màn hình nhỏ (điện thoại 375px): Danh sách thành viên hiển thị 1 cột rộng rãi, dễ nhìn', mobileLayout.mobileGridColumns === 1);
  // Khôi phục lại viewport desktop
  await page.setViewportSize({ width: 1280, height: 720 });

  // Kiểm tra banner Nhắc nhở sao lưu & nút Sao lưu ngay
  console.log('\n[Nhắc nhở sao lưu: Bấm Sao lưu ngay đóng banner và cập nhật mốc sao lưu]');
  await page.evaluate(() => {
    document.getElementById('backup-reminder-toast').classList.remove('hidden');
  });
  await page.waitForTimeout(100);
  const bannerShown = await page.evaluate(() => !document.getElementById('backup-reminder-toast').classList.contains('hidden'));
  check('Banner nhắc nhở sao lưu hiển thị thành công', bannerShown);

  await page.click('#btn-backup-reminder-now');
  await page.waitForTimeout(150);
  await page.click('#btn-backup-options-ok');
  await page.waitForTimeout(300);
  const bannerHiddenAfterBackup = await page.evaluate(() => {
    const isHidden = document.getElementById('backup-reminder-toast').classList.contains('hidden');
    const lastBackup = DataManager.getSettings().lastBackupAt;
    return isHidden && (Date.now() - lastBackup < 5000);
  });
  check('Bấm "Sao lưu ngay": Banner tự động ẩn và ghi nhận thời điểm sao lưu thành công', bannerHiddenAfterBackup);

  console.log('\n[Chính sách AI: key miễn phí/trả phí, xác nhận trả phí, hạn mức trần]');
  const policy = await page.evaluate(async () => {
    const out = {};
    const keep = JSON.stringify(DataManager.getSettings());
    const reset = (patch) => { localStorage.setItem('family_settings', keep); DataManager.saveSettings(patch); AIConfig.sessionApproved = false; };
    const realFetch = window.fetch;
    const calls = [];
    window.fetch = async (url, opt) => {
      calls.push({ url: String(url), key: opt && opt.headers && (opt.headers['x-goog-api-key'] || '') });
      const free = (opt.headers['x-goog-api-key'] || '').startsWith('FREE');
      if (free && window.__freeQuota) {
        return { ok: false, status: 429, json: async () => ({ error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded for requests per day' } }) };
      }
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'ok' }] } }], usageMetadata: { promptTokenCount: 1000000, candidatesTokenCount: 0 } }) };
    };
    // Tự bấm "Đồng ý"/"Không đồng ý" khi hộp thoại xác nhận xuất hiện
    const autoAnswer = (yes) => new Promise(r => setTimeout(() => { const b = [...document.querySelectorAll('.modal-overlay button')].find(x => x.textContent.includes(yes ? 'Đồng ý dùng' : 'Không đồng ý')); if (b) b.click(); r(!!b); }, 50));
    try {
      // a) Key miễn phí được ưu tiên, không hỏi
      reset({ aiRegion: 'vn', aiTasks: { chat: 'auto', assessment: 'auto', search: 'auto', trend: 'auto', ocr: 'auto' }, geminiApiKey: 'FREE-1', geminiApiKeyPaid: 'PAID-1', aiCapUsd: 5, aiSpend: null });
      window.__freeQuota = false; calls.length = 0;
      await AIService.route('chat', 'xin chao');
      out.freeFirst = calls.length === 1 && calls[0].key === 'FREE-1' && !document.querySelector('.modal-overlay[role=alertdialog]');
      // b) Hết hạn mức miễn phí -> hỏi xác nhận -> đồng ý -> dùng key trả phí
      window.__freeQuota = true; calls.length = 0;
      const ans = autoAnswer(true);
      const t = await AIService.route('chat', 'xin chao');
      out.askedOnQuota = await ans;
      out.paidAfterConsent = t === 'ok' && calls.map(c => c.key).join() === 'FREE-1,PAID-1';
      out.spendRecorded = AIConfig.getSpend().usd > 0.2; // 1M token vào x $0.3
      // c) Đã đồng ý trong phiên: lần sau không hỏi lại
      calls.length = 0;
      await AIService.route('chat', 'lan 2');
      out.noAskTwice = calls.length === 2 && !document.querySelector('.modal-overlay[role=alertdialog]');
      // d) Không đồng ý -> từ chối, không gọi key trả phí
      reset({ aiRegion: 'vn', geminiApiKey: 'FREE-1', geminiApiKeyPaid: 'PAID-1', aiSpend: null }); calls.length = 0;
      const ans2 = autoAnswer(false);
      let declined = false;
      try { await AIService.route('chat', 'x'); } catch (e) { declined = !!e.isDeclined; }
      await ans2;
      out.declined = declined && !calls.some(c => c.key === 'PAID-1');
      // e) Chạm hạn mức trần -> chặn, không gọi API trả phí
      reset({ aiRegion: 'vn', geminiApiKey: 'FREE-1', geminiApiKeyPaid: 'PAID-1', aiCapUsd: 0.1, aiSpend: { month: AIConfig.monthKey(), usd: 0.5, calls: 3 } });
      AIConfig.sessionApproved = true; calls.length = 0;
      let capped = false;
      try { await AIService.route('chat', 'x'); } catch (e) { capped = !!e.isCap; }
      out.capBlocks = capped && !calls.some(c => c.key === 'PAID-1');
      // f) Mô hình Pro chỉ có ở trả phí: chọn tay Gemini Pro khi chỉ có key miễn phí -> báo lỗi rõ ràng
      reset({ aiRegion: 'vn', geminiApiKey: 'FREE-1', geminiApiKeyPaid: '', aiTasks: { chat: 'gemini|gemini-3.1-pro' }, aiSpend: null });
      let proErr = '';
      try { await AIService.route('chat', 'x'); } catch (e) { proErr = e.message; }
      out.proNeedsPaidKey = /chỉ có ở API trả phí/.test(proErr);
      // g) Tự động: có key trả phí thì tác vụ "sâu" (phân tích) chọn Pro, tác vụ thường chọn Flash
      reset({ aiRegion: 'vn', geminiApiKey: 'FREE-1', geminiApiKeyPaid: 'PAID-1', aiTasks: { chat: 'auto', assessment: 'auto' } });
      out.autoPick = AIConfig.resolve('assessment').model === 'gemini-3.1-pro' && AIConfig.resolve('chat').model === 'gemini-3.0-flash';
      // h) Trung Quốc: chỉ chọn nhà cung cấp Trung Quốc
      reset({ aiRegion: 'cn', aiTasks: { chat: 'gemini|gemini-3.0-flash' } });
      out.cnOnly = ['zhipu', 'deepseek'].includes(AIConfig.resolve('chat').provider) && AIConfig.visibleProviders().every(p => AIConfig.PROVIDERS[p].group === 'cn');
    } finally {
      window.fetch = realFetch;
      localStorage.setItem('family_settings', keep);
      AIConfig.sessionApproved = false;
    }
    return out;
  });
  check('Key miễn phí được ưu tiên dùng trước và không hỏi gì', policy.freeFirst);
  check('Hết hạn mức miễn phí: app hiện hộp thoại xác nhận dùng API trả phí', policy.askedOnQuota);
  check('Đồng ý: app chuyển sang key trả phí và ghi nhận chi phí ước tính', policy.paidAfterConsent && policy.spendRecorded);
  check('Đã đồng ý trong phiên: không hỏi lại ở các lần gọi sau', policy.noAskTwice);
  check('Không đồng ý: app không dùng key trả phí', policy.declined);
  check('Chạm hạn mức trần: app chặn API trả phí', policy.capBlocks);
  check('Chọn mô hình chỉ có bản trả phí mà thiếu key trả phí: báo lỗi rõ ràng', policy.proNeedsPaidKey);
  check('Chế độ Tự động: tác vụ sâu dùng Pro khi có key trả phí, tác vụ thường dùng Flash', policy.autoPick);
  check('Quốc gia Trung Quốc: chỉ dùng AI Trung Quốc', policy.cnOnly);

  console.log('\n[Sao lưu chọn lọc: dữ liệu / cài đặt / API Key]');
  const backup = await page.evaluate(async () => {
    const out = {};
    const keep = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('family_')) keep[k] = localStorage.getItem(k); }
    try {
      DataManager.saveSettings({ geminiApiKey: 'KEY-GEMINI', openaiApiKeyPaid: 'KEY-OPENAI', pinHash: 'HASH-PIN', medTimeMorning: '07:15' });
      const noKeys = JSON.parse(await DataManager.exportData({ data: true, settings: true, apiKeys: false }));
      const st = JSON.parse(noKeys.localStorage.family_settings);
      out.noKeysClean = !JSON.stringify(st).includes('KEY-GEMINI') && !JSON.stringify(st).includes('KEY-OPENAI') && !st.pinHash && st.medTimeMorning === '07:15' && !!noKeys.localStorage.family_members;
      const keysOnly = JSON.parse(await DataManager.exportData({ data: false, settings: false, apiKeys: true }));
      const ko = JSON.parse(keysOnly.localStorage.family_settings);
      out.keysOnly = ko.geminiApiKey === 'KEY-GEMINI' && ko.openaiApiKeyPaid === 'KEY-OPENAI' && !('medTimeMorning' in ko) && !keysOnly.localStorage.family_members && keysOnly.meta.contains.data === false;
      // Nhập file KHÔNG có key: key hiện tại trên máy phải được giữ nguyên, cài đặt được áp dụng
      DataManager.saveSettings({ medTimeMorning: '09:00' });
      await DataManager.importData(JSON.stringify(noKeys));
      const after = DataManager.getSettings();
      out.importKeepsKeys = after.geminiApiKey === 'KEY-GEMINI' && after.medTimeMorning === '07:15';
      // File lỗi không được làm mất dữ liệu hiện tại
      const before = localStorage.getItem('family_members');
      let rejected = false;
      try { await DataManager.importData('{"localStorage":{"family_members":"{hong"}}'); } catch (e) { rejected = true; }
      out.badFileSafe = rejected && localStorage.getItem('family_members') === before;
    } finally {
      Object.keys(localStorage).filter(k => k.startsWith('family_')).forEach(k => localStorage.removeItem(k));
      Object.keys(keep).forEach(k => localStorage.setItem(k, keep[k]));
    }
    return out;
  });
  check('Sao lưu KHÔNG chọn API Key: file không chứa key/PIN nhưng vẫn có cài đặt + dữ liệu', backup.noKeysClean);
  check('Sao lưu CHỈ chọn API Key: file chỉ chứa key/PIN', backup.keysOnly);
  check('Khôi phục file không có key: key hiện có trên máy được giữ nguyên', backup.importKeepsKeys);
  check('Khôi phục file lỗi: bị từ chối và dữ liệu hiện tại không bị mất', backup.badFileSafe);

  console.log('\n[Chuông nhắc: hàng đợi nhiều báo thức, giờ không chuẩn]');
  const alarm = await page.evaluate(async () => {
    const out = {};
    const keepR = localStorage.getItem('family_reminders');
    try {
      out.timeParse = !isNaN(parseTimeToday('2026-01-01', '8:05').getTime()) && !isNaN(parseTimeToday('2026-01-01', '08:05').getTime()) && isNaN(parseTimeToday('2026-01-01', 'abc').getTime());
      const now = new Date(Date.now() - 60000);
      const pad = (n) => String(n).padStart(2, '0');
      const today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
      const t = now.getHours() + ':' + pad(now.getMinutes()); // cố ý KHÔNG đệm số 0 ở giờ (vd "8:05")
      const mk = (id, mem) => ({ id, type: 'medication_plan', memberId: mem, title: 'Thuốc ' + id, startDate: today, endDate: today, times: [t], datetime: today + 'T00:00', medications: [{ name: 'Thuốc ' + id, times: [t] }] });
      localStorage.setItem('family_reminders', JSON.stringify([mk('a1', 'm1'), mk('a2', 'm2')]));
      closeModal('modal-alarm');
      pendingAlarmQueue.length = 0;
      checkReminders();
      const modal = document.getElementById('modal-alarm');
      out.firstShown = !modal.classList.contains('hidden') && pendingAlarmQueue.length === 1;
      stopLoudBell(); closeModal('modal-alarm');
      await new Promise(r => setTimeout(r, 700));
      out.secondShown = !modal.classList.contains('hidden') && pendingAlarmQueue.length === 0;
      stopLoudBell(); closeModal('modal-alarm');
    } finally {
      localStorage.setItem('family_reminders', keepR === null ? '[]' : keepR);
      stopLoudBell();
    }
    return out;
  });
  check('Giờ dạng "8:05" (không đệm số 0) được đọc đúng, giờ sai không làm hỏng', alarm.timeParse);
  check('2 báo thức cùng giờ: hiện cái đầu và giữ cái thứ hai trong hàng đợi', alarm.firstShown);
  check('Tắt báo thức đầu: báo thức thứ hai tự hiện (không bị mất)', alarm.secondShown);

  console.log('\n[Đọc báo cáo (TTS): chọn mục đọc không bị im lặng/đọc chồng]');
  const tts = await page.evaluate(async () => {
    const out = {};
    const chunks = TTSService.splitIntoChunks(TTSService.cleanTextForSpeech('Kết luận chung.\nUống đủ nước\nNgủ sớm đúng giờ'));
    out.keepsTail = chunks.join(' ').includes('Ngủ sớm đúng giờ') && chunks.join(' ').includes('Uống đủ nước');
    out.noTextRejected = (() => { let toasted = false; const orig = window.showToast; window.showToast = () => { toasted = true; }; TTSService.speak('   ', 't'); window.showToast = orig; return toasted && !TTSService.isPlaying; })();

    // Giả lập speechSynthesis để kiểm tra lỗi "canceled" của đoạn cũ không được kích hoạt giọng dự phòng
    const captured = [];
    const fake = { speak(u) { captured.push(u); }, cancel() {}, resume() {}, pause() {}, getVoices() { return []; }, speaking: false, pending: false };
    Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
    let fallbackCalls = 0;
    const origFailure = TTSService.handleChunkFailure;
    TTSService.handleChunkFailure = function () { fallbackCalls++; };
    try {
      const b1 = document.createElement('button'), b2 = document.createElement('button');
      TTSService.speak('Phần một. Nội dung của phần một.', 'Phần 1', b1, 'section', null);
      await new Promise(r => setTimeout(r, 400));
      const u1 = captured[captured.length - 1];
      TTSService.speak('Phần hai. Nội dung của phần hai.', 'Phần 2', b2, 'section', null); // chuyển mục: app cancel() đoạn cũ
      await new Promise(r => setTimeout(r, 400));
      if (u1 && u1.onerror) u1.onerror({ error: 'canceled' }); // trình duyệt báo lỗi "bị hủy" của đoạn cũ
      if (u1 && u1.onerror) u1.onerror({ error: 'interrupted' });
      out.staleErrorIgnored = fallbackCalls === 0;
      const u2 = captured[captured.length - 1];
      out.newChunkQueued = !!u2 && u2 !== u1 && TTSService.isPlaying;
      if (u2 && u2.onerror) u2.onerror({ error: 'synthesis-failed' }); // lỗi thật của đoạn đang đọc -> phải được xử lý (thử lại/báo lỗi)
      out.realErrorFallsBack = fallbackCalls === 1;
    } finally {
      TTSService.stop();
      TTSService.handleChunkFailure = origFailure;
      delete window.speechSynthesis;
    }
    return out;
  });
  check('Tách đoạn đọc không làm rơi phần cuối/dòng không có dấu chấm', tts.keepsTail);
  check('Nội dung rỗng: báo rõ ràng thay vì im lặng', tts.noTextRejected);
  check('Chuyển mục: lỗi "canceled" của đoạn cũ KHÔNG bị coi là lỗi (không đọc chồng/không báo lỗi giả)', tts.staleErrorIgnored);
  check('Chuyển mục: đoạn mới được đưa vào hàng đọc', tts.newChunkQueued);
  check('Lỗi thật của giọng đọc máy vẫn được xử lý (thử lại rồi báo rõ nguyên nhân)', tts.realErrorFallsBack);

  console.log(`\n[Lỗi console/pageerror bắt được: ${consoleErrors.length}]`);
  consoleErrors.forEach(e => console.log('  ! ' + e));

  console.log(`\n=== KẾT QUẢ: ${pass} đạt / ${fail} lỗi (${consoleErrors.length} console error) ===`);

  await browser.close();
  server.close();
  process.exit(fail > 0 ? 1 : 0);
})();
