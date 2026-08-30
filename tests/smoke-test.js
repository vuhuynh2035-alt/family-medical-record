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
    if (url.includes('generativelanguage.googleapis.com')) {
      // Phân biệt 2 loại lời gọi Gemini theo nội dung prompt để mock đúng định dạng phản hồi:
      // - extractDataFromImage() yêu cầu trả về JSON thuần (điền form)
      // - generateComprehensiveReport() yêu cầu trả về Markdown (báo cáo đánh giá)
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
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }) });
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
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH; // tùy chọn: chỉ định thủ công nếu cần
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage();

  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push('[pageerror] ' + err.message));
  page.on('dialog', d => d.accept().catch(() => {}));

  await withStubbedNetwork(page);
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  
  // Bỏ qua màn hình thiết lập PIN bắt buộc
  await page.fill('#input-forced-pin', '1234');
  await page.fill('#input-forced-confirm-pin', '1234');
  await page.click('#form-forced-pin-setup button[type=submit]');
  await page.waitForTimeout(300);
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
  await page.click('#btn-back-dashboard');
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
  await page.click('#btn-add-reminder');
  await page.fill('#reminder-title', 'Tái khám');
  await page.fill('#reminder-date', '2030-08-15');
  await page.fill('#reminder-time', '09:30');
  await page.fill('#reminder-note', 'Nhịn ăn trước khi xét nghiệm');
  await page.click('button[form="form-reminder"][type=submit]');
  await page.waitForTimeout(200);
  check('Lịch hẹn lưu thành công (modal đóng)', await page.$eval('#modal-reminder', el => el.classList.contains('hidden')));

  await page.click('.btn-edit-reminder');
  await page.waitForTimeout(150);
  const titleVal = await page.$eval('#reminder-title', el => el.value);
  check('Sửa lịch hẹn: form được điền lại đúng dữ liệu cũ', titleVal === 'Tái khám');
  await page.fill('#reminder-title', 'Tái khám (đã đổi)');
  await page.click('button[form="form-reminder"][type=submit]');
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
    const s = DataManager.getSettings();
    s.geminiModel = 'gemini-1.5-flash'; // model cũ đã bị Google ngừng hỗ trợ (decommissioned)
    DataManager.saveSettings(s);
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  // App đang bật khóa PIN từ bước trước nên cần mở khóa lại trước khi kiểm tra tiếp
  await page.fill('#input-unlock-pin', '1234');
  await page.click('#form-unlock button[type=submit]');
  await page.waitForTimeout(200);
  const migratedModel = await page.evaluate(() => DataManager.getSettings().geminiModel);
  check('Model Gemini đã ngừng hoạt động được tự động nâng cấp khi tải lại trang', migratedModel === 'gemini-3.1-pro');

  await page.click('#btn-settings');
  await page.waitForTimeout(150);
  // Từ Phase 7 (v1.14.5), 2 ô này đã đổi từ <input> văn bản tự do thành <select> liệt kê
  // sẵn các model phổ biến (nút "Tải danh sách" mới sẽ nạp thêm option động từ API key
  // thật của người dùng — không kiểm thử được offline). Ở đây chọn 1 option có sẵn khác
  // với option mặc định để xác nhận việc lưu lựa chọn hoạt động đúng.
  // Mở rộng phần cấu hình AI (vì nó nằm trong thẻ <details>)
  await page.click('details[data-help-title="Cấu hình AI"] summary');
  await page.waitForTimeout(150);
  await page.selectOption('#input-openai-model', 'gpt-4o-mini');
  await page.selectOption('#input-anthropic-model', 'claude-3-haiku-20240307');
  await page.click('#btn-save-settings');
  await page.waitForTimeout(150);
  const savedModels = await page.evaluate(() => {
    const s = DataManager.getSettings();
    return { openai: s.openaiModel, anthropic: s.anthropicModel };
  });
  check('Lưu lựa chọn model OpenAI thành công', savedModels.openai === 'gpt-4o-mini');
  check('Lưu lựa chọn model Anthropic thành công', savedModels.anthropic === 'claude-3-haiku-20240307');
  // #btn-save-settings tự đóng modal-settings (gọi closeModal('modal-settings') trong app.js).

  console.log('\n[Hệ thống Hướng dẫn sử dụng (Help/Tour) — js/help.js]');
  // Bug đã sửa ở Phase 7: renderHelpElements() từng khai báo trùng `const padding` trong
  // cùng scope, khiến toàn bộ help.js lỗi cú pháp và không nạp được (nút "?" không phản hồi).
  // Lưu ý: 2 lần page.reload() ở các bước PIN/model phía trên đã đưa app về lại view mặc định
  // (Trang chủ - Dashboard), nên không cần điều hướng thêm — Dashboard cũng có sẵn phần tử
  // gắn data-help-title (ví dụ nút "Thêm thành viên") để kiểm thử.
  const helpServiceLoaded = await page.evaluate(() => typeof HelpService !== 'undefined');
  check('js/help.js nạp thành công, không lỗi cú pháp (HelpService tồn tại trên window)', helpServiceLoaded);

  await page.click('#btn-help');
  await page.waitForTimeout(200);
  const helpModeActive = await page.evaluate(() => !document.getElementById('help-backdrop').classList.contains('hidden'));
  check('Bấm nút "?" bật được chế độ Hướng dẫn (help-backdrop hiển thị)', helpModeActive);

  const highlightCount = await page.evaluate(() => document.querySelectorAll('.help-highlight-box').length);
  check('Chế độ Hướng dẫn khoanh vùng được ít nhất 1 phần tử trên Trang chủ', highlightCount > 0);

  // help-backdrop phủ toàn màn hình (position: fixed, z-index cao) khi đang bật, nên che luôn
  // nút "?" — đúng theo thiết kế "bấm ra ngoài để đóng" (xem HelpService.init() trong help.js),
  // vì vậy đóng bằng cách bấm vào chính lớp phủ thay vì bấm lại nút "?".
  await page.click('#help-backdrop');
  await page.waitForTimeout(200);
  const helpModeClosed = await page.evaluate(() => document.getElementById('help-backdrop').classList.contains('hidden'));
  check('Bấm ra ngoài (help-backdrop) tắt được chế độ Hướng dẫn', helpModeClosed);

  console.log(`\n[Lỗi console/pageerror bắt được: ${consoleErrors.length}]`);
  consoleErrors.forEach(e => console.log('  ! ' + e));

  console.log(`\n=== KẾT QUẢ: ${pass} đạt / ${fail} lỗi (${consoleErrors.length} console error) ===`);

  await browser.close();
  server.close();
  process.exit(fail > 0 ? 1 : 0);
})();
