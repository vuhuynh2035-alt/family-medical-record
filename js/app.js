/**
 * app.js — điểm khởi tạo (bootstrap), gắn sự kiện (event listeners) và các hàm điều phối
 * (logic functions) nối UI (components.js), dữ liệu (data.js) và AI (ai.js) lại với nhau.
 * Không chứa logic hiển thị HTML trực tiếp — việc đó thuộc về `UI` trong components.js.
 */

let currentMemberId = null;
let currentRecords = [];
let deferredPrompt;
let cropper = null;

// Cấu hình worker cho pdf.js (dùng để tách từng trang PDF thành ảnh trước khi gửi AI đọc —
// xem trong xử lý #record-image-input bên dưới). Đặt ở đây (file .js ngoài, cùng gốc 'self')
// thay vì <script> nội tuyến trong index.html, vì Content-Security-Policy của trang không cho
// phép chạy script nội tuyến — đặt bằng script nội tuyến sẽ bị trình duyệt âm thầm chặn.
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

/**
 * Hiển thị một thông báo nhỏ, không chặn thao tác (toast), tự biến mất sau vài giây.
 * Dùng cho các phản hồi mang tính thông tin (vd: "Đã lưu cài đặt") thay vì alert() gây gián
 * đoạn trải nghiệm. Các xác nhận hành động phá hủy dữ liệu vẫn dùng confirm()/alert() như cũ
 * để đảm bảo người dùng phải chủ động đọc và xác nhận trước khi tiếp tục.
 * @param {string} message
 * @param {'success'|'error'} [type='success']
 */
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `app-toast app-toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    // Cho phép animation vào rồi mới thêm class hiển thị (giúp transition CSS chạy mượt)
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}
window.showConfirm = function(message) {
    return new Promise((resolve) => {
        let modal = document.getElementById('modal-custom-confirm');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-custom-confirm';
            modal.className = 'modal-overlay hidden';
            modal.style.zIndex = '100000';
            modal.style.background = 'rgba(0,0,0,0.5)';
            modal.style.display = 'flex';
            modal.innerHTML = `
                <div class="modal-content neumorphic-modal" style="max-width: 350px; width: 90%; text-align: center; border: 1px solid rgba(0,0,0,0.05); border-radius: 16px; margin: auto;">
                    <div style="margin-bottom: 20px;">
                        <span class="material-symbols-rounded" style="font-size: 48px; color: #f59e0b; margin-bottom: 10px; display: block;">warning</span>
                        <h3 style="margin: 0 0 10px 0; color: var(--text-dark); font-size: 18px;">Xác nhận</h3>
                        <p id="custom-confirm-message" style="margin: 0; color: var(--text-muted); font-size: 14px; line-height: 1.5;"></p>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button id="btn-custom-confirm-cancel" class="secondary-btn neumorphic-btn" style="flex: 1; padding: 12px; font-weight: 600;">Hủy bỏ</button>
                        <button id="btn-custom-confirm-ok" class="primary-btn neumorphic-btn" style="flex: 1; padding: 12px; font-weight: 600; background: #e11d48; color: white;">Đồng ý</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        document.getElementById('custom-confirm-message').innerText = message;
        modal.classList.remove('hidden');
        
        const btnCancel = document.getElementById('btn-custom-confirm-cancel');
        const btnOk = document.getElementById('btn-custom-confirm-ok');
        
        const newBtnCancel = btnCancel.cloneNode(true);
        const newBtnOk = btnOk.cloneNode(true);
        btnCancel.replaceWith(newBtnCancel);
        btnOk.replaceWith(newBtnOk);
        
        newBtnCancel.addEventListener('click', () => {
            modal.classList.add('hidden');
            resolve(false);
        });
        
        newBtnOk.addEventListener('click', () => {
            modal.classList.add('hidden');
            resolve(true);
        });
    });
};


// ==================== KHÓA MÀN HÌNH BẰNG MÃ PIN ====================
// Đây là một lớp khóa GIAO DIỆN nhằm tránh người khác vô tình xem được hồ sơ khi
// cầm/mượn thiết bị của bạn — KHÔNG mã hóa dữ liệu (xem ghi chú trong js/data.js).

/** Đồng bộ giao diện phần "Khóa PIN" trong Cài đặt + hiện/ẩn nút khóa nhanh trên header. */
function updatePinUIState() {
    const settings = DataManager.getSettings();
    const pinOn = !!(settings.pinEnabled && settings.pinHash);

    const statusOn = document.getElementById('pin-status-on');
    const statusOff = document.getElementById('pin-status-off');
    if (statusOn) statusOn.classList.toggle('hidden', !pinOn);
    if (statusOff) statusOff.classList.toggle('hidden', pinOn);


}



function showLockScreen() {
    const lockScreen = document.getElementById('lock-screen');
    lockScreen.classList.remove('hidden');
    document.getElementById('unlock-error').classList.add('hidden');
    const input = document.getElementById('input-unlock-pin');
    input.value = '';
    
    setTimeout(() => input.focus(), 50);
}

/** Ẩn màn hình khóa và tiếp tục các bước khởi tạo vốn bị trì hoãn khi app đang khóa. */
function unlockApp() {
    document.getElementById('lock-screen').classList.add('hidden');
    checkReminders();
    checkBackupReminder();
}

function showPinSetupForm() {
    const settings = DataManager.getSettings();
    const isChange = !!(settings.pinEnabled && settings.pinHash);
    const groupOldPin = document.getElementById('group-old-pin');
    if (groupOldPin) groupOldPin.classList.toggle('hidden', !isChange);
    
    document.getElementById('pin-setup-form').classList.remove('hidden');
    document.getElementById('input-old-pin').value = '';
    document.getElementById('input-new-pin').value = '';
    document.getElementById('input-confirm-pin').value = '';
    
    if (isChange) {
        setTimeout(() => document.getElementById('input-old-pin').focus(), 50);
    } else {
        setTimeout(() => document.getElementById('input-new-pin').focus(), 50);
    }
}

function hidePinSetupForm() {
    document.getElementById('pin-setup-form').classList.add('hidden');
}

function setupPinLockListeners() {
    document.getElementById('form-unlock').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('input-unlock-pin');
        const pin = input.value.trim();
        const errorEl = document.getElementById('unlock-error');
        try {
            const settings = DataManager.getSettings();
            const hash = await DataManager.sha256Hex(pin);
            if (hash === settings.pinHash) {
                unlockApp();
            } else {
                errorEl.classList.remove('hidden');
                input.value = '';
                input.focus();
            }
        } catch (err) {
            alert(err.message);
        }
    });

    document.getElementById('btn-forgot-pin-reset').addEventListener('click', () => {
        if (confirm('CẢNH BÁO NGUY HIỂM: Hành động này sẽ XÓA TOÀN BỘ dữ liệu hồ sơ bệnh án đang lưu trên máy này để khôi phục cài đặt gốc, giúp bạn vào lại ứng dụng. Bạn có chắc chắn muốn xóa mọi thứ không?')) {
            if (confirm('Đây là xác nhận cuối cùng. Mọi dữ liệu sẽ bị xóa VĨNH VIỄN và không thể khôi phục. Bạn vẫn muốn tiếp tục?')) {
                localStorage.clear();
                if (window.indexedDB) {
                    indexedDB.deleteDatabase('FamilyMedicalRecordDB');
                }
                alert('Đã xóa toàn bộ dữ liệu. Ứng dụng sẽ khởi động lại.');
                window.location.reload();
            }
        }
    });

    document.getElementById('btn-enable-pin').addEventListener('click', () => showPinSetupForm());
    document.getElementById('btn-change-pin').addEventListener('click', () => showPinSetupForm());
    document.getElementById('btn-cancel-pin-setup').addEventListener('click', () => hidePinSetupForm());

    document.getElementById('btn-save-pin').addEventListener('click', async () => {
        const settings = DataManager.getSettings();
        const isChange = !!(settings.pinEnabled && settings.pinHash);
        
        if (isChange) {
            const oldPin = document.getElementById('input-old-pin').value.trim();
            const oldHash = await DataManager.sha256Hex(oldPin);
            if (oldHash !== settings.pinHash) {
                alert('Mã PIN cũ không chính xác!');
                return;
            }
        }
        
        const pin = document.getElementById('input-new-pin').value.trim();
        const confirmPin = document.getElementById('input-confirm-pin').value.trim();

        if (!/^\d{4,6}$/.test(pin)) {
            alert('Mã PIN phải gồm 4-6 chữ số.');
            return;
        }
        if (pin !== confirmPin) {
            alert('Hai mã PIN nhập vào không khớp. Vui lòng thử lại.');
            return;
        }
        try {
            const hash = await DataManager.sha256Hex(pin);
            DataManager.saveSettings({ pinEnabled: true, pinHash: hash });
            hidePinSetupForm();
            updatePinUIState();
            showToast('Đã lưu mã PIN thành công.');
        } catch (err) {
            alert(err.message);
        }
    });

    document.getElementById('btn-disable-pin').addEventListener('click', async () => {
        if (await window.showConfirm('Tắt khóa PIN? Ứng dụng sẽ mở trực tiếp mà không cần nhập mã PIN nữa. (Mã PIN vẫn sẽ được dùng để xác nhận bảo mật khi xoá dữ liệu).')) {
            DataManager.saveSettings({ pinEnabled: false });
            updatePinUIState();
            showToast('Đã tắt yêu cầu mã PIN khi mở ứng dụng.');
        }
    });

    document.getElementById('form-forced-pin-setup').addEventListener('submit', async (e) => {
        e.preventDefault();
        const pin = document.getElementById('input-forced-pin').value.trim();
        const confirmPin = document.getElementById('input-forced-confirm-pin').value.trim();
        const errorEl = document.getElementById('forced-pin-error');
        
        if (!/^\d{4,6}$/.test(pin)) {
            errorEl.innerText = 'Mã PIN phải gồm từ 4 đến 6 chữ số.';
            errorEl.classList.remove('hidden');
            return;
        }
        if (pin !== confirmPin) {
            errorEl.innerText = 'Hai mã PIN không khớp.';
            errorEl.classList.remove('hidden');
            return;
        }
        
        try {
            const hash = await DataManager.sha256Hex(pin);
            DataManager.saveSettings({ pinEnabled: true, pinHash: hash });
            document.getElementById('forced-pin-setup-screen').classList.add('hidden');
            updatePinUIState();
            showToast('Đã tạo mã PIN thành công.');
            checkReminders();
            checkBackupReminder();
        } catch (err) {
            alert(err.message);
        }
    });


}

const CURRENT_APP_VERSION = 'v2.9.45';
const APP_CHANGELOG = {
    'v2.9.45': '• Cải tiến tính năng Chia sẻ dữ liệu: Hỗ trợ mở trực tiếp bảng chia sẻ gốc của điện thoại (để chọn gửi qua Zalo, Messenger, Email...) thay vì chỉ tải file về máy. Cho phép import lại file sao lưu dưới định dạng .txt để tương thích tốt hơn với các nền tảng chat.',
    'v2.9.45': '• Tối ưu hiển thị Lịch nhắc: Tự động gộp chung các chỉ định (siêu âm, xét nghiệm, tái khám...) của CÙNG MỘT bác sĩ vào chung 1 lịch hẹn cho gọn gàng. Chỉ tách riêng nếu các lịch hẹn đó thuộc về 2 bác sĩ / chuyên khoa khác nhau.',
    'v2.9.45': '• Sửa lỗi treo app (không hiện cảnh báo) khi điện thoại bị đầy bộ nhớ không thể lưu thêm ảnh (QuotaExceededError).',
    'v2.9.45': '• Nâng cấp AI Đọc hồ sơ: AI giờ đây đã biết tự động cộng trừ ngày tháng (vd: đọc "sau 3 tháng" sẽ tự tính ra ngày tái khám chính xác), đồng thời không còn bỏ sót lịch hẹn khi đọc nhiều đơn thuốc cùng lúc.',
    'v2.9.45': '• Tối ưu AI Đọc đơn thuốc: Ép buộc AI phải đọc và ghi chép tỉ mỉ từng loại thuốc, tuyệt đối không được tự ý tóm tắt đơn thuốc dài thành vài loại cơ bản.',
    'v2.9.45': '• Làm gọn giao diện: Tinh chỉnh lại bảng chỉ số xét nghiệm (ẩn chữ "Đỏ", thu nhỏ nút xóa thành dấu X) giúp màn hình gọn gàng, bớt rối mắt hơn trên điện thoại.',
    'v2.9.45': '• Sửa lỗi AI Nhắc lịch: Bắt buộc AI phải tách riêng từng lịch khám/xét nghiệm thành các mục độc lập, không được tự ý gộp chung lại làm mất chi tiết khi chúng trùng ngày.',
    'v2.9.45': '• Cải tiến AI (Smart Reminders): Khắc phục lỗi AI chỉ trích xuất được 1 lịch hẹn duy nhất và bỏ sót các lịch khác. Từ nay AI có thể đọc và đề xuất toàn bộ các lịch hẹn khám, xét nghiệm định kỳ có trong hồ sơ.',
    'v2.9.45': '• Dọn dẹp giao diện: Xóa bỏ nút Hướng dẫn (màu cam) khổng lồ choán chỗ ở góc phải bên dưới màn hình, vì nút Trợ giúp đã được chuyển lên thanh menu ở góc trên.',
    'v2.9.45': '• Gộp nút Hướng dẫn: Đơn giản hóa giao diện bằng cách gộp nút "Cẩm nang hướng dẫn" và "Trợ lý AI" vào chung 1 nút (dấu chấm hỏi). Khi bấm vào, Trợ lý AI sẽ hiện ra để bạn hỏi đáp trực tiếp, nếu muốn đọc cẩm nang, chỉ cần bấm nút "Cẩm nang" ngay góc trên của cửa sổ chat.',
    'v2.9.45': '• Cập nhật Giao diện: Tách đôi nút tạo lịch trên màn hình chính để thao tác nhanh hơn (Khám bệnh/Uống thuốc). Di chuyển nút Trợ lý AI (dấu ?) lên góc phải màn hình theo đúng thiết kế tiêu chuẩn.',
    'v2.9.45': '• Sửa lỗi (Bugfix): Khắc phục sự cố khi tạo hồ sơ bằng AI OCR (quét ảnh), hệ thống tự động sinh ra hàng loạt Lịch uống thuốc lẻ tẻ theo thiết kế cũ (bị trùng lặp với Kế hoạch nhắc thuốc thông minh).',
    'v2.9.45': '• Tối ưu giao diện Trợ lý AI: Thiết kế lại nút Trợ lý AI Hỏi đáp (trong Chế độ Hướng dẫn) thành biểu tượng dấu chấm hỏi nhỏ gọn, đặt ở góc trên cùng bên phải màn hình để không che khuất tầm nhìn và đồng bộ với giao diện chính.',
    'v2.9.45': '• Cải tiến thao tác tạo Lịch: Tách nút "Tạo lịch hẹn mới" thành 2 nút riêng biệt "+ Khám bệnh" và "+ Uống thuốc" đặt ngay bên ngoài màn hình danh sách, giúp thao tác nhanh hơn 1 bước và bố cục cân đối hơn.',
    'v2.9.45': '• Nâng cấp giao diện Xác nhận: Thay thế toàn bộ các thông báo xác nhận trắng đen (xóa, ghi đè dữ liệu, khôi phục) của trình duyệt bằng một giao diện Pop-up hiện đại, đẹp mắt và đồng bộ với thiết kế của ứng dụng.',
    'v2.9.45': '• Quản lý Tiến độ uống thuốc: Khi báo thức uống thuốc reo lên, bạn có thể chọn "Đã uống (Hoàn thành)", "Nhắc lại sau 30 phút", hoặc "Bỏ qua". Bổ sung thêm tính năng xem Báo cáo tuân thủ uống thuốc (dạng bảng lưới điểm danh) khi mở chi tiết Lịch uống thuốc, giúp bạn theo dõi chính xác mình có hay quên uống thuốc cữ nào không.',
    'v2.9.45': '• Tối ưu hoá hiển thị Chi tiết Lịch uống thuốc: Theo góp ý từ người dùng, màn hình chi tiết giờ đây sẽ hiển thị danh sách các buổi uống thuốc ở dạng thu gọn mặc định. Khi cần xem chi tiết buổi nào, bạn chỉ việc nhấn vào mục đó để mở bung ra (thay vì tự động mở buổi gần nhất như trước, giúp app nhẹ hơn và tránh bị rối mắt).',
    'v2.9.45': '• Sửa lỗi nghiêm trọng (Critical Bugfix): Khắc phục sự cố Lịch uống thuốc được tạo bằng tay bị lỗi không báo chuông và bị nhận nhầm thành lịch hẹn thông thường dẫn đến không hoạt động.',
    'v2.9.45': '• Bổ sung tính năng Sửa Lịch Uống Thuốc: Thêm nút Sửa (hình cây bút chì) trực tiếp trên các Lịch uống thuốc ở màn hình chính, giúp bạn dễ dàng vào điều chỉnh lại loại thuốc hoặc thời gian báo chuông cho từng lịch cũ.',
    'v2.9.45': '• Cải tiến Lịch uống thuốc: Bổ sung "Khung giờ uống thuốc của Lịch này". Thay vì phải dùng chung khung giờ cố định từ hệ thống, bạn giờ đây có thể tùy chỉnh giờ Sáng/Trưa/Chiều/Tối riêng biệt cho từng Lịch uống thuốc (phù hợp khi có thuốc uống trước ăn lúc 5h chiều, hoặc sau ăn lúc 8h tối).',
    'v2.9.45': '• Cải tiến hiển thị Thông báo: Nội dung cập nhật tính năng mới giờ đây sẽ hiển thị trực tiếp ngay trong bảng thông báo, giúp bạn không cần phải bấm thêm một bước "Xem thay đổi" như trước đây.',
    'v2.9.45': '• Cải tiến Lịch hẹn: Bổ sung thêm các tuỳ chọn báo chuông "Trước 1 giờ" và "Trước 3 giờ" để bạn có thời gian chuẩn bị linh hoạt hơn.',
    'v2.9.45': '• Tạo Lịch uống thuốc thủ công: Giờ đây bạn có thể tự mình tạo Lịch uống thuốc mà không cần thông qua AI phân tích. Trong màn hình tạo Lịch hẹn, chuyển sang tab "Lịch uống thuốc" để thêm từng loại thuốc, chọn cữ uống, cách dùng theo ý muốn.',
    'v2.9.17': '• Tối ưu Giao diện Lịch uống thuốc: Hiển thị tràn viền (full màn hình) giúp bạn dễ dàng đọc chi tiết hơn.\n• Tự động chọn giờ thông minh: Khi mở Lịch uống thuốc, hệ thống sẽ tự động phân tích thời gian thực và mở sẵn tab lịch uống thuốc tiếp theo trong ngày để bạn không cần tự tìm kiếm.\n• Đổi tên: Chuyển tên gọi từ "Kế hoạch uống thuốc" sang "Lịch uống thuốc" cho gần gũi và dễ hiểu hơn.',
    'v2.9.16': '• Tùy chỉnh Giờ uống thuốc: Bạn giờ đây có thể tự do thay đổi mốc giờ uống thuốc mặc định cho các buổi Sáng, Trưa, Chiều, Tối trong phần Cài đặt Hệ thống. AI sẽ tự động ưu tiên các khung giờ này khi lập kế hoạch.',
    'v2.9.15': '• Cải tiến Giao diện Lịch Uống Thuốc: Hiển thị danh sách các buổi trong ngày (Sáng/Trưa/Chiều/Tối) theo chiều dọc (dạng mở rộng accordion) để dễ đọc hơn.\n• Tra cứu nhanh thuốc: Nhấn vào tên thuốc để tìm kiếm ngay thông tin chi tiết trên Google.',
    'v2.9.14': '• Đại tu Tính năng Nhắc Thuốc: Tự động gom toàn bộ lộ trình uống thuốc thành 1 Kế hoạch duy nhất (Medication Plan) để không làm rối danh sách nhắc hẹn.\n• Hiển thị Hướng dẫn sử dụng thuốc: AI sẽ tự động phân tích và trích xuất chi tiết công dụng, chống chỉ định, cách dùng trước/sau ăn cho từng loại thuốc.\n• Nhắc nhở thông minh: Tự động báo chuông theo từng buổi trong ngày, khi chạm vào thông báo sẽ hiện chi tiết thuốc cần uống ngay lúc đó.',
    'v2.9.13': '• Sửa lỗi thuật toán quét dọn trùng lặp: Nhận diện chính xác và tự động xóa sạch các lịch hẹn rác sinh ra do lỗi từ phiên bản cũ.',
    'v2.9.12': '• Tối giản tối đa: Gộp chung "Chế độ Giải thích Giao diện" và "Cẩm nang Quy trình" vào cùng một nút Trợ giúp (?) duy nhất trên thanh tiêu đề.',
    'v2.9.11': '• Tối giản giao diện: Ẩn nút "Giải thích giao diện" trên thanh tiêu đề. Tính năng này được tích hợp chung vào bên trong Cẩm nang Hướng dẫn sử dụng.',
    'v2.9.10': '• Thêm nút "Xóa bỏ" ngay bên trong giao diện Sửa nhắc hẹn để dễ dàng xóa từng lịch hẹn.\n• Cập nhật thuật toán chống lỗi ngày tháng để đảm bảo sắp xếp lịch hẹn theo đúng trình tự thời gian.\n• Tự động dọn dẹp các lịch hẹn bị lưu trùng lặp từ trước.\n• Bổ sung tính năng "Xóa toàn bộ lịch hẹn" trong trang Hồ sơ cá nhân của từng thành viên.',
    'v2.9.8': '• Tối ưu hiển thị nhắc hẹn: Đưa các lịch hẹn đã hoàn thành vào một nhóm riêng ở cuối trang, chỉ hiển thị khi bạn nhấn vào (chuyển sang trang xem riêng). Các lịch quá hạn vẫn hiển thị nổi bật ở danh sách chính để nhắc nhở xử lý.',
    'v2.9.7': '• Thêm cơ chế chống trùng lặp tự động: Khi phân tích AI nhiều lần, hệ thống sẽ chỉ thêm các lịch hẹn mới và tự động bỏ qua các lịch đã tồn tại.',
    'v2.9.6': '• Tinh chỉnh thuật toán sắp xếp lịch hẹn theo đúng trình tự thời gian thực (Lịch quá hạn xếp trước, rồi đến lịch tương lai).\n• Thay đổi thiết kế Nút Hướng dẫn: thu gọn thành biểu tượng chấm hỏi ở góc phải trên cùng màn hình.',
    'v2.9.4': '• Nhắc hẹn uống thuốc giờ đây được gom gọn theo ngày.\n• Tách biệt thông báo hệ thống và nhắc hẹn.\n• Thêm tùy chọn tắt/bật chuông báo cho từng thành viên (trong Cài đặt Hệ thống).\n• Cải thiện âm lượng nghe thử chuông báo.\n• Thêm mục Cấp Quyền Đầy Đủ trong Cài đặt.',
    'v2.9.3': '• Thêm thông báo Cập nhật tính năng mới ngay trong bảng Chuông thông báo.',
    'v2.9.2': '• Khắc phục lỗi không thể xuất PDF Bảng đánh giá phân tích AI.\n• Sửa lỗi cấp phát sai ID khi lưu báo cáo nhiều lần liên tiếp.',
    'v2.9.1': '• Tự động lưu Báo cáo phân tích xu hướng AI ngay khi tạo để tránh mất dữ liệu nếu lỡ vuốt màn hình.\n• Cho phép nghe đọc Báo cáo (Text-to-Speech) theo từng phần nhỏ thay vì phải nghe từ đầu.\n• Thêm Lịch sử để xem lại các bản Đánh giá cũ.',
    'v2.8.6': '• Hỗ trợ nhập liệu bằng giọng nói (Voice-to-text) khi Chat với AI.\n• Sửa lỗi thao tác vuốt từ cạnh màn hình gây thoát ứng dụng.\n• Tối ưu định dạng ngày tháng trong bảng so sánh.'
};

let newWorker = null;
let latestDetectedVersion = '';

function getRunningAppVersion() {
    const tag = document.querySelector('.version-tag');
    return tag ? tag.innerText.trim() : CURRENT_APP_VERSION;
}

function showUpdateToast(newVersion) {
    const runningVer = getRunningAppVersion();
    if (!newVersion || newVersion === runningVer || newVersion === CURRENT_APP_VERSION) {
        document.getElementById('update-toast')?.classList.add('hidden');
        return;
    }
    
    latestDetectedVersion = newVersion;
    
    // Nếu người dùng đã chọn "Để sau" cho phiên bản này -> Không hiện lại
    if (localStorage.getItem('update_dismissed_' + latestDetectedVersion) === 'true') {
        return;
    }
    
    const updateToast = document.getElementById('update-toast');
    const title = document.getElementById('update-toast-title');
    if (title) {
        title.innerText = `Đã có bản cập nhật mới (${latestDetectedVersion})!`;
    }
    if (updateToast) {
        updateToast.classList.remove('hidden');
    }
}

function checkForRemoteUpdate() {
    const runningVer = getRunningAppVersion();
    // Kiểm tra version.json với no-cache để lấy phiên bản mới nhất từ server
    fetch('./version.json?t=' + Date.now(), { cache: 'no-store' })
        .then(res => {
            if (!res.ok) throw new Error('Cannot fetch version.json');
            return res.json();
        })
        .then(data => {
            if (data && data.version) {
                if (data.version === runningVer || data.version === CURRENT_APP_VERSION) {
                    // Đang ở phiên bản mới nhất -> Đóng thông báo ngay
                    document.getElementById('update-toast')?.classList.add('hidden');
                } else {
                    showUpdateToast(data.version);
                }
            }
        })
        .catch(err => {
            // Ngoại tuyến
        });
}

// Kiểm tra phiên bản ngay lập tức khi mã JS chạy, không cần đợi
checkForRemoteUpdate();
document.addEventListener('DOMContentLoaded', checkForRemoteUpdate);

// PWA Service Worker Registration & Reliable Update Detection
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => {
            console.log('Service Worker registered', reg);

            // Tự động kiểm tra bản cập nhật mới
            try { reg.update(); } catch(e){}

            // Tự động kiểm tra cập nhật mỗi 3 phút
            setInterval(() => {
                try { reg.update(); } catch(e){}
                checkForRemoteUpdate();
            }, 3 * 60 * 1000);

            // Kiểm tra cập nhật mỗi khi người dùng chuyển lại tab ứng dụng
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    try { reg.update(); } catch(e){}
                    checkForRemoteUpdate();
                }
            });
        }).catch(err => {
            console.log('Service Worker registration error: ', err);
        });
    });

    let isRefreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (isRefreshing) return;
        isRefreshing = true;
        window.location.reload();
    });
}

// Handle PWA Install Prompt
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('btn-install-app');
    if (installBtn) {
        installBtn.classList.remove('hidden');
        installBtn.addEventListener('click', () => {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                deferredPrompt = null;
                installBtn.classList.add('hidden');
            });
        });
    }
});

// ==================== KHỞI TẠO ỨNG DỤNG ====================
document.addEventListener('DOMContentLoaded', async () => {
    // ==================== BẪY THAO TÁC VUỐT BACK (PWA / MOBILE) ====================
    // Tạo lịch sử giả để bẫy sự kiện quay lại (swipe left to go back / hardware back button)
    // Tránh tình trạng vuốt nhầm làm thoát app hoàn toàn.
    let backPressCount = 0;
    let backPressTimer = null;
    
    history.replaceState({ appState: 'running' }, '');
    history.pushState({ appState: 'running' }, '');
    
    window.addEventListener('popstate', (e) => {
        // Luôn luôn pushState lại để chặn các lần back tiếp theo
        history.pushState({ appState: 'running' }, '');

        // 1. Đóng modal trên cùng (nếu có, và bỏ qua modal khóa PIN)
        const visibleModals = Array.from(document.querySelectorAll('.modal-overlay:not(.hidden)'));
        let hasOpenModal = false;
        if (visibleModals.length > 0) {
            const topModal = visibleModals[visibleModals.length - 1];
            if (topModal && topModal.id && topModal.id !== 'modal-pin-lock') {
                closeModal(topModal.id);
                hasOpenModal = true;
            }
        }
        
        // 2. Nếu không có modal, xử lý chuyển View
        if (!hasOpenModal) {
            const isDetailView = document.getElementById('view-member-detail')?.classList.contains('active');
            if (isDetailView) {
                switchView('view-dashboard');
                initDashboard();
            } else {
                // Đang ở trang chủ, yêu cầu back 2 lần liên tiếp để thoát ứng dụng
                backPressCount++;
                if (backPressCount >= 2) {
                    history.go(-2); // Thoát thật
                } else {
                    showToast('Vuốt/Nhấn Quay lại lần nữa để thoát', 'error');
                    clearTimeout(backPressTimer);
                    backPressTimer = setTimeout(() => { backPressCount = 0; }, 2000);
                }
            }
        }
    });

    // Tự động đồng bộ số phiên bản từ sw.js để tránh quên cập nhật giao diện
    try {
        const swText = await fetch('sw.js?t=' + Date.now()).then(r => r.text());
        const match = swText.match(/const SW_VERSION\s*=\s*['"](v[^'"]+)['"]/);
        if (match && match[1]) {
            const version = match[1];
            document.querySelectorAll('.version-tag').forEach(el => el.textContent = version);
            
            // Cập nhật text trong modal Settings (ví dụ: Phiên bản v2.2.6)
            const settingsContent = document.getElementById('modal-settings')?.innerHTML;
            if (settingsContent) {
                document.getElementById('modal-settings').innerHTML = settingsContent.replace(/Phiên bản <strong>v[^<]+<\/strong>/, `Phiên bản <strong>${version}</strong>`);
            }
        }
    } catch (e) {
        console.warn("Không thể tự động đồng bộ phiên bản", e);
    }

    initDashboard();
    setupEventListeners();
    setupPinLockListeners();
    
    // Set timer to automatically check reminders every 60 seconds
    setInterval(() => {
        checkReminders();
    }, 60000);
    updatePinUIState();
    UI.enhanceA11y(document); // Gán aria-label cho các nút chỉ có icon (tĩnh trong index.html)

    const btnUpdateApp = document.getElementById('btn-update-app');
    if (btnUpdateApp) {
        btnUpdateApp.addEventListener('click', async () => {
            btnUpdateApp.disabled = true;
            btnUpdateApp.innerText = 'Đang nạp...';
            
            // Ghi nhận đã cập nhật phiên bản này để không hiện lại
            if (latestDetectedVersion) {
                localStorage.setItem('update_dismissed_' + latestDetectedVersion, 'true');
                localStorage.setItem('app_installed_version', latestDetectedVersion);
            }
            document.getElementById('update-toast')?.classList.add('hidden');

            // Xóa cache cũ
            if ('caches' in window) {
                try {
                    const cacheKeys = await caches.keys();
                    await Promise.all(cacheKeys.map(k => caches.delete(k)));
                } catch(e){}
            }

            if (newWorker) {
                newWorker.postMessage('SKIP_WAITING');
            } else if ('serviceWorker' in navigator) {
                try {
                    const reg = await navigator.serviceWorker.getRegistration();
                    if (reg && reg.waiting) {
                        reg.waiting.postMessage('SKIP_WAITING');
                        return;
                    }
                } catch(e){}
            }

            // Tải lại trang sạch sẽ
            setTimeout(() => {
                window.location.replace(window.location.origin + window.location.pathname + '?t=' + Date.now());
            }, 250);
        });
    }

    const btnDismissUpdate = document.getElementById('btn-dismiss-update');
    if (btnDismissUpdate) {
        btnDismissUpdate.addEventListener('click', () => {
            if (latestDetectedVersion) {
                localStorage.setItem('update_dismissed_' + latestDetectedVersion, 'true');
            }
            document.getElementById('update-toast')?.classList.add('hidden');
        });
    }

    // Tự động nâng cấp cho người dùng cũ đang kẹt ở 1 model Gemini đã bị Google ngừng hỗ trợ
    // (ví dụ model mặc định cũ 'gemini-1.5-flash') mà không hề biết — xem DataManager để rõ danh
    // sách các model đã ngừng hoạt động. Phải chạy TRƯỚC khi đọc settings vào các ô input bên dưới.
    const modelUpgraded = DataManager.migrateDeprecatedGeminiModel();

    // Load Settings
    const settings = DataManager.getSettings();
    if (settings.geminiApiKey) document.getElementById('input-api-key').value = settings.geminiApiKey;
    if (settings.openaiApiKey) document.getElementById('input-openai-key').value = settings.openaiApiKey;
    if (settings.anthropicApiKey) document.getElementById('input-anthropic-key').value = settings.anthropicApiKey;
    
    if (settings.alarmSound && document.getElementById('input-alarm-sound')) {
        document.getElementById('input-alarm-sound').value = settings.alarmSound;
    }
    if (settings.providerAssessment) document.getElementById('input-ai-provider-assessment').value = settings.providerAssessment;
    else if (settings.activeProvider) document.getElementById('input-ai-provider-assessment').value = settings.activeProvider;
    
    if (settings.providerSearch) document.getElementById('input-ai-provider-search').value = settings.providerSearch;
    else if (settings.activeProvider) document.getElementById('input-ai-provider-search').value = settings.activeProvider;
    
    if (settings.providerTrend) document.getElementById('input-ai-provider-trend').value = settings.providerTrend;
    else if (settings.activeProvider) document.getElementById('input-ai-provider-trend').value = settings.activeProvider;

    if (settings.providerChat) document.getElementById('input-ai-provider-chat').value = settings.providerChat;
    else if (settings.activeProvider) document.getElementById('input-ai-provider-chat').value = settings.activeProvider;
    
    document.getElementById('input-med-time-morning').value = settings.medTimeMorning || '08:00';
    document.getElementById('input-med-time-noon').value = settings.medTimeNoon || '12:00';
    document.getElementById('input-med-time-afternoon').value = settings.medTimeAfternoon || '14:00';
    document.getElementById('input-med-time-evening').value = settings.medTimeEvening || '20:00';

    if (settings.geminiModel) {
        const select = document.getElementById('input-gemini-model');
        if (!Array.from(select.options).some(opt => opt.value === settings.geminiModel)) {
            const opt = document.createElement('option');
            opt.value = settings.geminiModel;
            opt.innerText = settings.geminiModel;
            select.appendChild(opt);
        }
        select.value = settings.geminiModel;
    }
    if (settings.openaiModel) {
        const select = document.getElementById('input-openai-model');
        if (select && !Array.from(select.options).some(opt => opt.value === settings.openaiModel)) {
            const opt = document.createElement('option');
            opt.value = settings.openaiModel;
            opt.innerText = settings.openaiModel;
            select.appendChild(opt);
        }
        if (select) select.value = settings.openaiModel;
    }
    if (settings.anthropicModel) {
        const select = document.getElementById('input-anthropic-model');
        if (select && !Array.from(select.options).some(opt => opt.value === settings.anthropicModel)) {
            const opt = document.createElement('option');
            opt.value = settings.anthropicModel;
            opt.innerText = settings.anthropicModel;
            select.appendChild(opt);
        }
        if (select) select.value = settings.anthropicModel;
    }
    if (modelUpgraded) {
        showToast(`Model AI (Gemini) đã được tự động cập nhật sang "${settings.geminiModel}" vì phiên bản cũ đã ngừng hoạt động. Bạn có thể đổi lại trong Cài đặt nếu muốn.`);
    }

    // Nếu khóa PIN đang bật: hiện màn hình khóa NGAY và trì hoãn việc kiểm tra/thông báo lịch hẹn
    // tới khi mở khóa thành công — tránh lộ nội dung nhắc hẹn qua hộp thoại alert() trước khi
    // người dùng xác thực (hộp thoại alert() của trình duyệt luôn hiện trên mọi lớp phủ z-index).
    // Nếu chưa có mã PIN, ép buộc tạo mã PIN (chặn không cho dùng app)
    ensureFirstRunTimestamp();
    if (!settings.pinHash) {
        document.getElementById('forced-pin-setup-screen').classList.remove('hidden');
        setTimeout(() => document.getElementById('input-forced-pin').focus(), 50);
    } else if (settings.pinEnabled) {
        showLockScreen();
    } else {
        checkReminders();
        checkBackupReminder();
    }
});

function initDashboard() {
    const members = DataManager.getMembers();
    UI.renderMembersList(members);
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    // Nút cuộn lên đầu trang chi tiết thành viên
    document.getElementById('btn-scroll-top-detail')?.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.querySelectorAll('.btn-scroll-modal-top').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalContent = btn.closest('.modal-content');
            if (modalContent) modalContent.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    // Modals Close
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal-overlay');
            if (modal) closeModal(modal.id);
        });
    });

    // Settings Modal
    document.getElementById('btn-settings').addEventListener('click', () => {
        const settings = DataManager.getSettings();
        
        // Add current model to dropdown if it doesn't exist
        if (settings.geminiModel) {
            const select = document.getElementById('input-gemini-model');
            if (!Array.from(select.options).some(opt => opt.value === settings.geminiModel)) {
                const opt = document.createElement('option');
                opt.value = settings.geminiModel;
                opt.innerText = settings.geminiModel;
                select.appendChild(opt);
            }
            select.value = settings.geminiModel;
        }
        if (settings.openaiModel) {
            const select = document.getElementById('input-openai-model');
            if (select && !Array.from(select.options).some(opt => opt.value === settings.openaiModel)) {
                const opt = document.createElement('option');
                opt.value = settings.openaiModel;
                opt.innerText = settings.openaiModel;
                select.appendChild(opt);
            }
            if (select) select.value = settings.openaiModel;
        }
        if (settings.anthropicModel) {
            const select = document.getElementById('input-anthropic-model');
            if (select && !Array.from(select.options).some(opt => opt.value === settings.anthropicModel)) {
                const opt = document.createElement('option');
                opt.value = settings.anthropicModel;
                opt.innerText = settings.anthropicModel;
                select.appendChild(opt);
            }
        if (select) select.value = settings.anthropicModel;
        }
        updatePinUIState();
        
        // Render danh sách thành viên cho Cài đặt Chuông báo
        const members = DataManager.getMembers();
        const alarmMembersContainer = document.getElementById('alarm-members-settings');
        if (alarmMembersContainer) {
            alarmMembersContainer.innerHTML = '';
            if (members.length === 0) {
                alarmMembersContainer.innerHTML = '<div style="font-size:13px; color:var(--text-muted);">Chưa có thành viên nào.</div>';
            } else {
                members.forEach(m => {
                    const isMuted = (settings.mutedMembers || []).includes(m.id);
                    const div = document.createElement('label');
                    div.style.display = 'flex';
                    div.style.alignItems = 'center';
                    div.style.gap = '8px';
                    div.style.cursor = 'pointer';
                    div.style.fontSize = '14px';
                    div.innerHTML = `
                        <input type="checkbox" class="chk-alarm-member" value="${m.id}" ${!isMuted ? 'checked' : ''} style="width:16px; height:16px;">
                        <span>${UI.escapeHtml(m.name)}</span>
                    `;
                    alarmMembersContainer.appendChild(div);
                });
            }
        }
        
        openModal('modal-settings');
    });
    
    document.getElementById('btn-fetch-models').addEventListener('click', async () => {
        const key = document.getElementById('input-api-key').value.trim();
        if (!key) return alert('Vui lòng nhập Google Gemini API Key trước!');
        
        const btn = document.getElementById('btn-fetch-models');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 18px; margin-right: 5px; vertical-align: text-bottom;">hourglass_empty</span>Đang tải...';
        
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
            if (!res.ok) throw new Error('API Key không hợp lệ hoặc lỗi mạng');
            const data = await res.json();
            
            const select = document.getElementById('input-gemini-model');
            const currentSelected = select.value || DataManager.getGeminiModel();
            select.innerHTML = '';
            
            let foundCount = 0;
            data.models.forEach(m => {
                // Only show models that support text generation
                if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent') && m.name.includes('gemini')) {
                    const modelId = m.name.replace('models/', '');
                    const opt = document.createElement('option');
                    opt.value = modelId;
                    opt.innerText = m.displayName || modelId;
                    select.appendChild(opt);
                    foundCount++;
                }
            });
            
            // Restore previous selection if it exists in the new list
            if (Array.from(select.options).some(opt => opt.value === currentSelected)) {
                select.value = currentSelected;
            }
            
            showToast(`Đã tải thành công ${foundCount} mô hình AI hỗ trợ sinh văn bản từ tài khoản của bạn!`);
        } catch (e) {
            alert('Lỗi: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 18px; margin-right: 5px; vertical-align: text-bottom;">sync</span>Tải danh sách';
        }
    });
    
    document.getElementById('btn-fetch-openai-models')?.addEventListener('click', async () => {
        const key = document.getElementById('input-openai-key').value.trim();
        if (!key) return alert('Vui lòng nhập OpenAI API Key trước!');
        
        const btn = document.getElementById('btn-fetch-openai-models');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 18px; margin-right: 5px; vertical-align: text-bottom;">hourglass_empty</span>Đang tải...';
        
        try {
            const res = await fetch('https://api.openai.com/v1/models', {
                headers: { 'Authorization': `Bearer ${key}` }
            });
            if (!res.ok) throw new Error('API Key không hợp lệ hoặc lỗi mạng');
            const data = await res.json();
            
            const select = document.getElementById('input-openai-model');
            const currentSelected = select.value || DataManager.getOpenAIModel();
            select.innerHTML = '';
            
            let foundCount = 0;
            const models = data.data.sort((a, b) => b.created - a.created); // Sort by created desc
            models.forEach(m => {
                if (m.id.includes('gpt') || m.id.includes('o1') || m.id.includes('o3')) {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.innerText = m.id;
                    select.appendChild(opt);
                    foundCount++;
                }
            });
            
            if (Array.from(select.options).some(opt => opt.value === currentSelected)) {
                select.value = currentSelected;
            } else if (currentSelected) {
                const opt = document.createElement('option');
                opt.value = currentSelected;
                opt.innerText = currentSelected;
                select.appendChild(opt);
                select.value = currentSelected;
            }
            showToast(`Đã tải thành công ${foundCount} mô hình ChatGPT từ tài khoản của bạn!`);
        } catch (e) {
            alert('Lỗi: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 18px; margin-right: 5px; vertical-align: text-bottom;">sync</span>Tải danh sách';
        }
    });

    document.getElementById('btn-fetch-anthropic-models')?.addEventListener('click', async () => {
        const key = document.getElementById('input-anthropic-key').value.trim();
        if (!key) return alert('Vui lòng nhập Anthropic API Key trước!');
        
        const btn = document.getElementById('btn-fetch-anthropic-models');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 18px; margin-right: 5px; vertical-align: text-bottom;">hourglass_empty</span>Đang tải...';
        
        try {
            const res = await fetch('https://api.anthropic.com/v1/models', {
                headers: { 
                    'x-api-key': key,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                }
            });
            if (!res.ok) throw new Error('API Key không hợp lệ hoặc bị lỗi mạng/CORS');
            const data = await res.json();
            
            const select = document.getElementById('input-anthropic-model');
            const currentSelected = select.value || DataManager.getAnthropicModel();
            select.innerHTML = '';
            
            let foundCount = 0;
            // anthropic returns { data: [{ type: "model", id: "...", display_name: "...", created_at: "..." }] }
            const models = data.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            models.forEach(m => {
                if (m.id.includes('claude')) {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.innerText = m.display_name ? `${m.display_name} (${m.id})` : m.id;
                    select.appendChild(opt);
                    foundCount++;
                }
            });
            
            if (Array.from(select.options).some(opt => opt.value === currentSelected)) {
                select.value = currentSelected;
            } else if (currentSelected) {
                const opt = document.createElement('option');
                opt.value = currentSelected;
                opt.innerText = currentSelected;
                select.appendChild(opt);
                select.value = currentSelected;
            }
            showToast(`Đã tải thành công ${foundCount} mô hình Claude từ tài khoản của bạn!`);
        } catch (e) {
            alert('Lỗi lấy model Claude: ' + e.message + '. (Lưu ý: API Anthropic có thể chặn trình duyệt).');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 18px; margin-right: 5px; vertical-align: text-bottom;">sync</span>Tải danh sách';
        }
    });
    
    document.getElementById('btn-test-alarm')?.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        if (currentAlarmAudio && !currentAlarmAudio.paused) {
            stopLoudBell();
            btn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 16px;">play_arrow</span> Nghe thử';
        } else {
            const soundUrl = document.getElementById('input-alarm-sound').value;
            playLoudBell(soundUrl);
            btn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 16px;">stop</span> Dừng nghe';
        }
    });

    document.getElementById('btn-request-all-permissions')?.addEventListener('click', async () => {
        let results = [];
        
        // 1. Quyền Thông báo
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            results.push(`- Thông báo nhắc hẹn: ${permission === 'granted' ? 'Đã cấp ✅' : 'Từ chối ❌'}`);
        } else {
            results.push(`- Thông báo nhắc hẹn: Không hỗ trợ ⚠️`);
        }
        
        // 2. Quyền Lưu trữ bền vững (Persistent Storage)
        if (navigator.storage && navigator.storage.persist) {
            const isPersisted = await navigator.storage.persist();
            results.push(`- Lưu trữ dữ liệu an toàn: ${isPersisted ? 'Đã cấp ✅' : 'Từ chối ❌'}`);
        } else {
            results.push(`- Lưu trữ dữ liệu an toàn: Không hỗ trợ ⚠️`);
        }
        
        alert("Trạng thái cấp quyền:\n" + results.join("\n"));
    });

    document.getElementById('btn-save-settings').addEventListener('click', () => {
        const geminiKey = document.getElementById('input-api-key').value.trim();
        const openaiKey = document.getElementById('input-openai-key').value.trim();
        const anthropicKey = document.getElementById('input-anthropic-key').value.trim();
        
        const providerAssessment = document.getElementById('input-ai-provider-assessment').value;
        const providerSearch = document.getElementById('input-ai-provider-search').value;
        const providerTrend = document.getElementById('input-ai-provider-trend').value;
        const providerChat = document.getElementById('input-ai-provider-chat').value;
        
        const geminiModel = document.getElementById('input-gemini-model').value;
        const openaiModel = document.getElementById('input-openai-model') ? document.getElementById('input-openai-model').value.trim() : '';
        const anthropicModel = document.getElementById('input-anthropic-model') ? document.getElementById('input-anthropic-model').value.trim() : '';

        const alarmSound = document.getElementById('input-alarm-sound') ? document.getElementById('input-alarm-sound').value : DEFAULT_ALARM_SOUND_URL;
        
        const mutedMembers = Array.from(document.querySelectorAll('.chk-alarm-member:not(:checked)')).map(cb => cb.value);

        const medTimeMorning = document.getElementById('input-med-time-morning').value || '08:00';
        const medTimeNoon = document.getElementById('input-med-time-noon').value || '12:00';
        const medTimeAfternoon = document.getElementById('input-med-time-afternoon').value || '14:00';
        const medTimeEvening = document.getElementById('input-med-time-evening').value || '20:00';

        DataManager.saveSettings({
            geminiApiKey: geminiKey,
            openaiApiKey: openaiKey,
            anthropicApiKey: anthropicKey,
            providerAssessment: providerAssessment,
            providerSearch: providerSearch,
            providerTrend: providerTrend,
            providerChat: providerChat,
            activeProvider: providerAssessment, // kept for backward compatibility
            geminiModel: geminiModel,
            openaiModel: openaiModel,
            anthropicModel: anthropicModel,
            alarmSound: alarmSound,
            mutedMembers: mutedMembers,
            medTimeMorning: medTimeMorning,
            medTimeNoon: medTimeNoon,
            medTimeAfternoon: medTimeAfternoon,
            medTimeEvening: medTimeEvening
        });

        closeModal('modal-settings');
        showToast("Đã lưu Cài đặt Hệ thống.");
    });

    // Helper tải file backup về máy
    function triggerDownloadBackup(jsonData, fileName) {
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function generateBackupFileName() {
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yy = String(now.getFullYear()).slice(-2);
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');
        return `medical_backup_${dd}${mm}${yy}_${hour}${minute}.json`;
    }

    // Backup & Restore
    document.getElementById('btn-export-data')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-export-data');
        const originalText = btn.innerHTML;
        try {
            btn.innerHTML = '<span class="material-symbols-rounded" style="vertical-align: text-bottom; font-size: 20px;">hourglass_empty</span> Đang tạo...';
            btn.disabled = true;

            const jsonData = await DataManager.exportData();
            const fileName = generateBackupFileName();
            triggerDownloadBackup(jsonData, fileName);

            // Ghi lại mốc backup gần nhất để tắt nhắc nhở định kỳ cho đến lần hạn tiếp theo
            DataManager.saveSettings({ lastBackupAt: Date.now(), backupReminderSnoozeUntil: null });
            hideBackupReminder();
            showToast('Đã tải file sao lưu về máy thành công!');
        } catch (e) {
            alert("Lỗi khi sao lưu dữ liệu: " + e.message);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });

    // Chia sẻ file backup trực tiếp qua Zalo, Email, Messenger, AirDrop...
    document.getElementById('btn-share-backup')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-share-backup');
        const originalText = btn.innerHTML;
        try {
            btn.innerHTML = '<span class="material-symbols-rounded" style="vertical-align: text-bottom; font-size: 20px;">hourglass_empty</span> Đang chuẩn bị...';
            btn.disabled = true;

            const jsonData = await DataManager.exportData();
            const fileName = generateBackupFileName();
            // Đổi đuôi thành .txt và mime type thành text/plain để Web Share API (như Zalo, Messenger) không bị chặn
            const shareFileName = fileName.replace('.json', '.txt');
            const file = new File([jsonData], shareFileName, { type: 'text/plain' });

            DataManager.saveSettings({ lastBackupAt: Date.now(), backupReminderSnoozeUntil: null });
            hideBackupReminder();

            // Kiểm tra hỗ trợ Web Share API (thường hoạt động tốt trên điện thoại & trình duyệt hiện đại)
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        title: 'Hồ sơ Y tế Gia đình',
                        text: 'File sao lưu hồ sơ y tế gia đình. Mở ứng dụng và bấm "Khôi Phục" để nạp dữ liệu.',
                        files: [file]
                    });
                    showToast('Đã mở bảng chia sẻ thành công!');
                } catch (shareErr) {
                    if (shareErr.name !== 'AbortError') {
                        triggerDownloadBackup(jsonData, fileName);
                        showToast('Đã tải file sao lưu về máy.');
                    }
                }
            } else {
                // Fallback cho trình duyệt máy tính không hỗ trợ gửi file trực tiếp
                triggerDownloadBackup(jsonData, fileName);
                alert(`Trình duyệt của bạn không hỗ trợ mở trực tiếp danh sách ứng dụng chia sẻ.\n\nFile sao lưu "${fileName}" đã được TẢI VỀ máy của bạn. Bạn chỉ cần đính kèm file này để gửi qua Zalo, Messenger hoặc Email!`);
            }
        } catch (e) {
            alert("Lỗi khi chia sẻ dữ liệu: " + e.message);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });

    document.getElementById('btn-import-data').addEventListener('click', () => {
        document.getElementById('input-import-data').click();
    });

    document.getElementById('input-import-data').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (await window.showConfirm("LƯU Ý: Quá trình này sẽ XÓA TOÀN BỘ dữ liệu hiện tại trên máy này và thay thế bằng dữ liệu từ file sao lưu. Bạn có chắc chắn muốn tiếp tục?")) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const btn = document.getElementById('btn-import-data');
                    btn.innerHTML = '<span class="material-symbols-rounded" style="vertical-align: text-bottom; font-size: 20px;">hourglass_empty</span> Đang khôi phục...';
                    btn.disabled = true;

                    await DataManager.importData(event.target.result);
                    alert("Khôi phục dữ liệu thành công! Ứng dụng sẽ tự động tải lại.");
                    window.location.reload();
                } catch (err) {
                    alert("Lỗi khôi phục: " + err.message);
                    document.getElementById('btn-import-data').disabled = false;
                    document.getElementById('btn-import-data').innerHTML = '<span class="material-symbols-rounded" style="vertical-align: text-bottom; font-size: 20px;">upload</span> Khôi Phục Dữ Liệu';
                }
            };
            reader.readAsText(file);
        }
        e.target.value = ''; // Reset input
    });

    // Wipe Data Button
    const btnWipeData = document.getElementById('btn-wipe-data');
    if (btnWipeData) {
        btnWipeData.addEventListener('click', () => {
            document.getElementById('input-confirm-action-pin').value = '';
            document.getElementById('confirm-pin-error').classList.add('hidden');
            document.getElementById('modal-confirm-pin').classList.remove('hidden');
            setTimeout(() => document.getElementById('input-confirm-action-pin').focus(), 50);
        });
    }

    const formConfirmPin = document.getElementById('form-confirm-pin');
    if (formConfirmPin) {
        formConfirmPin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('input-confirm-action-pin');
            const pin = input.value.trim();
            const errorEl = document.getElementById('confirm-pin-error');
            
            try {
                const settings = DataManager.getSettings();
                const hash = await DataManager.sha256Hex(pin);
                if (hash === settings.pinHash) {
                    // Valid PIN, execute wipe
                    document.getElementById('modal-confirm-pin').classList.add('hidden');
                    if (await window.showConfirm("CẢNH BÁO CUỐI: Hành động này sẽ xóa VĨNH VIỄN toàn bộ hồ sơ khám bệnh và thành viên. Bạn có chắc chắn?")) {
                        DataManager.wipeAllDataKeepSettings();
                        alert("Đã xóa sạch dữ liệu thành công! Ứng dụng sẽ tải lại.");
                        window.location.reload();
                    }
                } else {
                    errorEl.innerText = 'Mã PIN không đúng, vui lòng thử lại.';
                    errorEl.classList.remove('hidden');
                    input.value = '';
                    input.focus();
                }
            } catch (err) {
                alert(err.message);
            }
        });
    }

    const closeConfirmPinBtn = document.querySelector('#modal-confirm-pin .close-modal');
    if (closeConfirmPinBtn) {
        closeConfirmPinBtn.addEventListener('click', () => {
            document.getElementById('modal-confirm-pin').classList.add('hidden');
        });
    }

    // Exit App Logic
    const btnExitApp = document.getElementById('btn-exit-app');
    if (btnExitApp) {
        btnExitApp.addEventListener('click', () => {
            document.getElementById('modal-exit-app').classList.remove('hidden');
        });
    }

    const btnConfirmExit = document.getElementById('btn-confirm-exit');
    if (btnConfirmExit) {
        btnConfirmExit.addEventListener('click', async () => {
            try {
                // AUTO BACKUP LOGIC
                if (DataManager.isDataChanged) {
                    try {
                        const exportData = await DataManager.exportData();
                        await AutoBackupStore.saveAutoBackup(exportData);
                    } catch (err) {
                        console.error('Lỗi khi sao lưu tự động:', err);
                    }
                }

                // Trick để lừa trình duyệt cho phép đóng tab (hoạt động trên một số trình duyệt)
                window.open(location.href, '_self', '');
                window.close();
                
                // Dành cho PWA hoặc môi trường đặc biệt
                if (window.electron) {
                    window.close();
                } else if (navigator.app && navigator.app.exitApp) {
                    navigator.app.exitApp();
                }
                
                // Nếu trình duyệt vẫn chặn window.close() (đặc biệt là trên Cloud/Web)
                setTimeout(() => {
                    // Dọn dẹp DOM và hiển thị thông báo thoát an toàn đẹp mắt
                    document.body.innerHTML = `
                        <div style="display:flex; height:100vh; align-items:center; justify-content:center; flex-direction:column; background:var(--bg-body, #f0f2f5); font-family:'Outfit', sans-serif; color:var(--text-dark, #2d3436); text-align:center; padding: 20px;">
                            <span class="material-symbols-rounded" style="font-size: 64px; color: var(--primary-blue, #2980b9); margin-bottom: 20px;">check_circle</span>
                            <h2 style="margin-bottom: 10px; font-weight: 600;">Đã thoát chương trình an toàn</h2>
                            <p style="color: var(--text-muted, #636e72); margin-bottom: 30px; font-size: 15px;">Dữ liệu đã được lưu trữ cục bộ. Bạn có thể đóng thẻ trình duyệt này.</p>
                            <button onclick="window.close()" style="padding: 12px 24px; border: none; border-radius: 25px; background: var(--primary-blue, #2980b9); color: white; font-family: inherit; font-size: 15px; cursor: pointer; box-shadow: 0 4px 15px rgba(41,128,185,0.3);">
                                Đóng trang (hoặc bấm Ctrl + W)
                            </button>
                        </div>
                    `;
                }, 400);
            } catch(e) {
                console.error(e);
            }
        });
    }

    // Auto Backup UI Logic
    const btnShowAutoBackups = document.getElementById('btn-show-auto-backups');
    if (btnShowAutoBackups) {
        btnShowAutoBackups.addEventListener('click', async () => {
            try {
                const backups = await AutoBackupStore.getAllAutoBackups();
                const listEl = document.getElementById('auto-backup-list');
                if (backups.length === 0) {
                    listEl.innerHTML = '<div class="empty-state">Chưa có bản sao lưu tự động nào. Hãy thử thêm dữ liệu và đóng ứng dụng để hệ thống tự động tạo bản sao.</div>';
                } else {
                    listEl.innerHTML = backups.map(b => `
                        <div class="member-card neumorphic-card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding: 15px;">
                            <div>
                                <div style="font-weight: 500;">Bản sao lưu tự động</div>
                                <div style="font-size:12px; color:var(--text-muted);">${b.dateString}</div>
                            </div>
                            <button class="primary-btn neumorphic-btn btn-restore-auto" data-id="${b.id}" style="padding: 6px 12px; font-size:13px;">Khôi phục</button>
                        </div>
                    `).join('');
                    
                    listEl.querySelectorAll('.btn-restore-auto').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            const id = e.target.dataset.id;
                            if (await window.showConfirm('CẢNH BÁO: Hành động này sẽ GHI ĐÈ toàn bộ dữ liệu hiện tại (bao gồm cài đặt và hồ sơ) bằng bản sao lưu này. Không thể hoàn tác! Bạn có chắc chắn?')) {
                                try {
                                    const backup = await AutoBackupStore.getAutoBackupById(id);
                                    if (backup && backup.data) {
                                        const success = await DataManager.importData(backup.data);
                                        if (success) {
                                            alert('Đã khôi phục dữ liệu thành công!');
                                            location.reload();
                                        }
                                    }
                                } catch (err) {
                                    alert('Lỗi khôi phục: ' + err.message);
                                }
                            }
                        });
                    });
                }
                openModal('modal-auto-backup');
            } catch (err) {
                alert('Không thể tải lịch sử sao lưu: ' + err.message);
            }
        });
    }

    // Backup Reminder Banner
    document.getElementById('btn-backup-reminder-now').addEventListener('click', () => {
        updatePinUIState();
        openModal('modal-settings');
    });
    document.getElementById('btn-backup-reminder-later').addEventListener('click', () => {
        DataManager.saveSettings({ backupReminderSnoozeUntil: Date.now() + BACKUP_REMINDER_SNOOZE_MS });
        hideBackupReminder();
    });

    // Notifications Modal
    document.getElementById('btn-notifications').addEventListener('click', () => openNotifications());



    // DOB Toggle Logic
    document.getElementById('toggle-dob-type').addEventListener('click', (e) => {
        const isYearOnly = document.getElementById('member-dob-full').classList.contains('hidden');
        if (isYearOnly) {
            document.getElementById('member-dob-full').classList.remove('hidden');
            document.getElementById('member-dob-year').classList.add('hidden');
            e.target.innerText = 'Chỉ nhập Năm';
        } else {
            document.getElementById('member-dob-full').classList.add('hidden');
            document.getElementById('member-dob-year').classList.remove('hidden');
            e.target.innerText = 'Nhập chi tiết ngày';
        }
    });

    // Member Modal
    document.getElementById('btn-add-member').addEventListener('click', () => {
        document.getElementById('form-member').reset();
        document.getElementById('member-id').value = '';
        document.getElementById('member-nickname').value = '';
        document.getElementById('member-avatar-preview').src = UI.getAvatarUrl(null);
        document.getElementById('modal-member-title').innerText = 'Thêm thành viên';
        document.getElementById('custom-fields-container').innerHTML = ''; // Clear custom fields
        
        document.getElementById('member-dob-full').classList.remove('hidden');
        document.getElementById('member-dob-year').classList.add('hidden');
        document.getElementById('toggle-dob-type').innerText = 'Chỉ nhập Năm';
        
        document.getElementById('btn-delete-member').classList.add('hidden');
        
        openModal('modal-member');
    });

    // Avatar Upload
    document.getElementById('btn-upload-avatar').addEventListener('click', () => {
        document.getElementById('member-avatar-input').click();
    });
    document.getElementById('member-avatar-input').addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            const imageToCrop = document.getElementById('image-to-crop');
            imageToCrop.src = url;
            
            openModal('modal-crop');
            
            if (cropper) {
                cropper.destroy();
            }
            
            setTimeout(() => {
                cropper = new Cropper(imageToCrop, {
                    aspectRatio: 1,
                    viewMode: 1,
                    dragMode: 'move',
                    autoCropArea: 1,
                    restore: false,
                    guides: true,
                    center: true,
                    highlight: false,
                    cropBoxMovable: true,
                    cropBoxResizable: true,
                    toggleDragModeOnDblclick: false,
                });
            }, 100);
            
            e.target.value = '';
        }
    });

    document.getElementById('btn-save-crop').addEventListener('click', () => {
        if (!cropper) return;
        const canvas = cropper.getCroppedCanvas({
            width: 300,
            height: 300
        });
        
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        document.getElementById('member-avatar-preview').src = base64;
        closeModal('modal-crop');
    });

    // Custom Fields
    document.getElementById('btn-add-custom-field').addEventListener('click', () => {
        const container = document.getElementById('custom-fields-container');
        const fieldRow = document.createElement('div');
        fieldRow.style.display = 'flex';
        fieldRow.style.gap = '10px';
        fieldRow.className = 'custom-field-row';
        fieldRow.innerHTML = `
            <input type="text" class="neumorphic-input custom-field-key" placeholder="Tên mục (VD: Cân nặng)" style="flex: 1;">
            <input type="text" class="neumorphic-input custom-field-value" placeholder="Nội dung (VD: 65kg)" style="flex: 2;">
            <button type="button" class="icon-btn neumorphic-btn danger btn-remove-custom-field" style="padding: 10px;" aria-label="Xóa mục thông tin bổ sung này"><span class="material-symbols-rounded">delete</span></button>
        `;
        container.appendChild(fieldRow);
        
        fieldRow.querySelector('.btn-remove-custom-field').addEventListener('click', () => {
            fieldRow.remove();
        });
    });

    // Save Member
    document.getElementById('form-member').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const customFields = [];
        document.querySelectorAll('.custom-field-row').forEach(row => {
            const key = row.querySelector('.custom-field-key').value.trim();
            const value = row.querySelector('.custom-field-value').value.trim();
            if (key && value) {
                customFields.push({ key, value });
            }
        });

        const memberData = {
            id: document.getElementById('member-id').value,
            name: document.getElementById('member-name').value,
            nickname: document.getElementById('member-nickname').value,
            dob: document.getElementById('member-dob-full').classList.contains('hidden') ? 
                 document.getElementById('member-dob-year').value : 
                 (document.getElementById('member-dob-full').value ? document.getElementById('member-dob-full').value.split('-').reverse().join('/') : ''),
            blood: document.getElementById('member-blood').value,
            height: document.getElementById('member-height').value,
            weight: document.getElementById('member-weight').value,
            conditions: document.getElementById('member-conditions').value,
            avatar: document.getElementById('member-avatar-preview').src,
            customFields: customFields
        };
        DataManager.saveMember(memberData);
        closeModal('modal-member');
        
        if (currentMemberId === memberData.id) {
            loadMemberDetail(currentMemberId); // Đang ở trang detail thì reload detail
        } else {
            initDashboard(); // Reload dashboard
        }
    });

    // Click on Member Card
    document.getElementById('members-grid').addEventListener('click', (e) => {
        const card = e.target.closest('.member-card');
        if (card) {
            const id = card.dataset.id;
            loadMemberDetail(id);
        }
    });

    // Member Actions (Edit / Delete)
    document.getElementById('btn-edit-member').addEventListener('click', () => {
        const member = DataManager.getMemberById(currentMemberId);
        if (member) {
            document.getElementById('member-id').value = member.id;
            document.getElementById('member-name').value = member.name;
            document.getElementById('member-nickname').value = member.nickname || '';
            const dob = member.dob || '';
            if (dob.includes('/')) {
                document.getElementById('member-dob-full').value = dob.split('/').reverse().join('-');
                document.getElementById('member-dob-full').classList.remove('hidden');
                document.getElementById('member-dob-year').classList.add('hidden');
                document.getElementById('toggle-dob-type').innerText = 'Chỉ nhập Năm';
            } else {
                document.getElementById('member-dob-year').value = dob;
                document.getElementById('member-dob-full').classList.add('hidden');
                document.getElementById('member-dob-year').classList.remove('hidden');
                document.getElementById('toggle-dob-type').innerText = 'Nhập chi tiết ngày';
            }
            document.getElementById('member-blood').value = member.blood || '';
            document.getElementById('member-height').value = member.height || '';
            document.getElementById('member-weight').value = member.weight || '';
            document.getElementById('member-conditions').value = member.conditions || '';
            document.getElementById('member-avatar-preview').src = UI.getAvatarUrl(member);
            document.getElementById('modal-member-title').innerText = 'Sửa thông tin thành viên';
            
            const container = document.getElementById('custom-fields-container');
            container.innerHTML = '';
            if (member.customFields && member.customFields.length > 0) {
                member.customFields.forEach(field => {
                    const fieldRow = document.createElement('div');
                    fieldRow.style.display = 'flex';
                    fieldRow.style.gap = '10px';
                    fieldRow.className = 'custom-field-row';
                    fieldRow.innerHTML = `
                        <input type="text" class="neumorphic-input custom-field-key" placeholder="Tên mục" value="${field.key}" style="flex: 1;">
                        <input type="text" class="neumorphic-input custom-field-value" placeholder="Nội dung" value="${field.value}" style="flex: 2;">
                        <button type="button" class="icon-btn neumorphic-btn danger btn-remove-custom-field" style="padding: 10px;" aria-label="Xóa mục thông tin bổ sung này"><span class="material-symbols-rounded">delete</span></button>
                    `;
                    container.appendChild(fieldRow);
                    fieldRow.querySelector('.btn-remove-custom-field').addEventListener('click', () => {
                        fieldRow.remove();
                    });
                });
            }

            document.getElementById('btn-delete-member').classList.remove('hidden');

            openModal('modal-member');
        }
    });

    document.getElementById('btn-delete-member').addEventListener('click', async () => {
        if (await window.showConfirm("Bạn có chắc chắn muốn xóa thành viên này và toàn bộ hồ sơ khám bệnh liên quan?")) {
            const records = DataManager.getRecords(currentMemberId);
            for (let record of records) {
                const images = record.originalImages || (record.originalImage ? [record.originalImage] : []);
                for (let imgId of images) {
                    if (imgId.startsWith('img_')) await ImageStore.deleteImage(imgId);
                }
            }
            DataManager.deleteMember(currentMemberId);
            closeModal('modal-member');
            switchView('view-dashboard');
            initDashboard();
        }
    });

    // Tabs in Detail View
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove active classes
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => {
                p.classList.remove('active', 'rotate-in-next', 'rotate-in-prev');
            });

            // Add active class
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');

            // Đổi tab hiển thị nội dung khác hẳn (Hồ sơ / Lịch sử khám / Thống kê / Lịch hẹn) —
            // luôn cuộn về đầu trang để người dùng thấy ngay nội dung mới thay vì vẫn đứng ở vị
            // trí cuộn cũ của tab trước (đặc biệt rõ khi tab trước dài, tab sau ngắn hơn nhiều).
            window.scrollTo(0, 0);
        });
    });

    // Xử lý vuốt chuyển tab xoay vòng (3D Carousel effect)
    const tabContents = document.querySelector('.tab-contents');
    if (tabContents) {
        let touchStartX = 0;
        let touchEndX = 0;
        let touchStartY = 0;
        let touchEndY = 0;
        
        tabContents.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        }, {passive: true});
        
        tabContents.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;
            handleTabSwipe();
        }, {passive: true});
        
        function handleTabSwipe() {
            const swipeThresholdX = 50; // Quét ít nhất 50px ngang mới tính
            const swipeThresholdY = 50; // Quét quá 50px dọc thì bỏ qua (chắc là cuộn trang)
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;
            
            if (Math.abs(deltaX) > swipeThresholdX && Math.abs(deltaY) < swipeThresholdY) {
                const tabs = Array.from(document.querySelectorAll('.tab-btn'));
                if (tabs.length === 0) return;
                
                const activeIndex = tabs.findIndex(btn => btn.classList.contains('active'));
                if (activeIndex === -1) return;
                
                let nextIndex = activeIndex;
                let directionClass = '';
                
                if (deltaX < 0) {
                    // Vuốt sang trái -> Trang tiếp theo
                    nextIndex = (activeIndex + 1) % tabs.length;
                    directionClass = 'rotate-in-next';
                } else {
                    // Vuốt sang phải -> Trang trước đó
                    nextIndex = (activeIndex - 1 + tabs.length) % tabs.length;
                    directionClass = 'rotate-in-prev';
                }
                
                // Chuyển tab
                tabs[nextIndex].click();
                
                // Gắn class hiệu ứng 3D
                const targetPane = document.getElementById(tabs[nextIndex].dataset.target);
                if (targetPane) {
                    // Buộc trình duyệt reflow để chạy lại animation
                    void targetPane.offsetWidth;
                    targetPane.classList.add(directionClass);
                }
            }
        }
    }

    // Format helpers for UI
    function formatDateShort(isoString) {
        if (!isoString) return '';
        const d = new Date(isoString);
        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }

    // Evaluate Health Trend Action
    document.getElementById('btn-evaluate-trend').addEventListener('click', () => {
        if (!currentMemberId) return;
        const records = DataManager.getRecords(currentMemberId);
        if (!records || records.length === 0) {
            alert('Thành viên này chưa có hồ sơ khám bệnh nào để đánh giá.');
            return;
        }
        
        renderTrendReportsList();
        openModal('modal-trend-history');
    });

    function renderTrendReportsList() {
        const container = document.getElementById('trend-reports-list');
        const reports = DataManager.getTrendReports(currentMemberId);
        container.innerHTML = '';
        if (!reports || reports.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); font-size: 14px; text-align: center;">Chưa có bản đánh giá nào được lưu.</p>';
            return;
        }

        reports.forEach(r => {
            const div = document.createElement('div');
            div.className = 'neumorphic-panel clickable-row';
            div.style.padding = '12px';
            div.style.borderRadius = '12px';
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <div style="font-weight: 600; color: var(--primary-blue); font-size: 14px;">${r.title || 'Đánh giá xu hướng'}</div>
                        <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">${formatDateShort(r.date)}</div>
                        <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${r.comparedRecordsSummary || ''}</div>
                    </div>
                    <button class="icon-btn danger btn-del-trend" data-id="${r.id}" style="padding: 4px;"><span class="material-symbols-rounded" style="font-size: 18px;">delete</span></button>
                </div>
            `;
            
            // Xoá
            div.querySelector('.btn-del-trend').addEventListener('click', async (e) => {
                e.stopPropagation();
                if (await window.showConfirm('Xóa bản đánh giá này?')) {
                    DataManager.deleteTrendReport(currentMemberId, r.id);
                    renderTrendReportsList();
                }
            });

            // Mở xem lại
            div.addEventListener('click', () => {
                document.querySelector('#modal-ai-assessment .modal-header h3').innerHTML = `<span class="material-symbols-rounded ai-sparkle">history</span> Đánh giá xu hướng sức khỏe (Đã lưu)`;
                document.getElementById('ai-assessment-loading').classList.add('hidden');
                document.getElementById('ai-assessment-content').innerHTML = UI.renderMarkdown(r.content);
                // Gắn metadata để lúc lưu PDF biết tên
                window.currentTrendMetadata = r; 
                openModal('modal-ai-assessment');
            });
            container.appendChild(div);
        });
    }

    document.getElementById('btn-create-new-trend').addEventListener('click', async () => {
        const records = DataManager.getRecords(currentMemberId);
        const member = DataManager.getMembers().find(m => m.id === currentMemberId);
        const activeProvider = DataManager.getProviderTrend();
        const pName = activeProvider === 'openai' ? 'ChatGPT' : (activeProvider === 'anthropic' ? 'Claude' : 'Gemini');
        
        document.querySelector('#modal-ai-assessment .modal-header h3').innerHTML = `<span class="material-symbols-rounded ai-sparkle">auto_awesome</span> ${pName} Đánh giá xu hướng sức khỏe`;
        openModal('modal-ai-assessment');
        const loading = document.getElementById('ai-assessment-loading');
        const content = document.getElementById('ai-assessment-content');
        
        loading.innerHTML = `<span class="loading-spinner"></span> ${pName} đang phân tích toàn bộ lịch sử khám bệnh...`;
        loading.classList.remove('hidden');
        content.innerHTML = '';
        
        try {
            const mdText = await AIService.evaluateHealthTrend(records, member);
            loading.classList.add('hidden');
            content.innerHTML = UI.renderMarkdown(mdText);
            
            // Inject TTS buttons to all headings so users can read section by section
            content.querySelectorAll('h2, h3').forEach(heading => {
                const playBtn = document.createElement('button');
                playBtn.className = 'icon-btn tts-speak-btn';
                playBtn.style.cssText = 'font-size: 12px; padding: 2px 8px; margin-left: 8px; vertical-align: middle; color: #8e44ad; background: rgba(142,68,173,0.1); border-radius: 12px;';
                playBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 14px; vertical-align: middle;">volume_up</span> Nghe phần này';
                playBtn.title = 'Nghe phần này';
                
                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (window.TTSService && TTSService.isPlaying && TTSService.activeBtnElement === playBtn) {
                        TTSService.stop();
                        return;
                    }
                    
                    let textToRead = heading.innerText.replace('Nghe phần này', '').trim() + '\n';
                    let nextEl = heading.nextElementSibling;
                    const stopTags = ['H1', 'H2', 'H3'];
                    while(nextEl && !stopTags.includes(nextEl.tagName)) {
                        textToRead += nextEl.innerText + '\n';
                        nextEl = nextEl.nextElementSibling;
                    }
                    
                    if (window.TTSService) {
                        TTSService.speak(textToRead.trim(), heading.innerText.replace('volume_up', '').replace('Nghe phần này', '').trim(), playBtn, 'assessment', '#ai-assessment-content');
                    }
                });
                heading.appendChild(playBtn);
            });
            
            // Tạo metadata chờ người dùng bấm Lưu
            const dates = records.map(r => r.date).sort();
            const summary = dates.length > 0 ? `Từ ${dates[0]} đến ${dates[dates.length-1]} (${dates.length} hồ sơ)` : '';
            window.currentTrendMetadata = {
                title: 'Đánh giá xu hướng sức khỏe',
                date: new Date().toISOString(),
                recordIds: records.map(r => r.id),
                comparedRecordsSummary: summary,
                content: mdText
            };
            
            // TỰ ĐỘNG LƯU ĐỂ TRÁNH MẤT KHI VUỐT ĐÓNG
            window.currentTrendMetadata.id = 'tr_' + Date.now();
            DataManager.saveTrendReport(currentMemberId, window.currentTrendMetadata);
            renderTrendReportsList();
        } catch (err) {
            loading.classList.add('hidden');
            content.innerHTML = `<p style="color:var(--danger);">Lỗi khi liên hệ AI: ${err.message}</p>`;
        }
    });

    // Record Modal & Actions
    document.getElementById('btn-add-record').addEventListener('click', () => {
        document.getElementById('form-record').reset();
        document.getElementById('record-id').value = '';
        if(document.getElementById('ocr-preview-container')) {
            document.getElementById('ocr-preview-container').style.display = 'none';
            document.getElementById('ocr-preview-container').innerHTML = '';
        }
        if (document.getElementById('btn-scan-analyze')) {
            document.getElementById('btn-scan-analyze').disabled = true;
        }

        document.getElementById('dynamic-fields-container').innerHTML = '';
        if (document.getElementById('record-comprehensive-report-data')) {
            document.getElementById('record-comprehensive-report-data').value = '';
            document.getElementById('btn-view-ai-report').classList.add('hidden');
        }
        document.getElementById('btn-delete-record-modal').classList.add('hidden');
        
        openModal('modal-record');
    });

    // Save Record
    document.getElementById('form-record').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Save images to ImageStore
        const imgElements = document.querySelectorAll('#ocr-preview-container img');
        const imageIds = [];
        try {
            for (let img of imgElements) {
                if (img.dataset.imgId) {
                    imageIds.push(img.dataset.imgId); // Already saved
                } else if (img.src && img.src.startsWith('data:image')) {
                    const id = await ImageStore.saveImage(img.src);
                    imageIds.push(id);
                }
            }
        } catch (imgErr) {
            console.error("Lỗi khi lưu ảnh:", imgErr);
            alert("Bộ nhớ thiết bị đã đầy hoặc không thể lưu thêm ảnh (QuotaExceededError). Chỉ có " + imageIds.length + " ảnh được lưu. Hãy thử xóa bớt hồ sơ cũ hoặc dọn rác điện thoại.");
            // Vẫn tiếp tục lưu hồ sơ với số ảnh đã lưu thành công
        }
        
        const recordData = {
            id: document.getElementById('record-id').value,
            date: document.getElementById('record-date').value,
            type: document.getElementById('record-type').value,
            hospital: document.getElementById('record-hospital').value,
            doctor: document.getElementById('record-doctor').value,
            disease: document.getElementById('record-disease').value,
            cost: document.getElementById('record-cost').value || 0,
            treatment: document.getElementById('record-treatment').value,
            // New EMR fields
            bp: document.getElementById('record-bp').value,
            hr: document.getElementById('record-hr').value,
            temp: document.getElementById('record-temp').value,
            spo2: document.getElementById('record-spo2').value,
            symptoms: document.getElementById('record-symptoms').value,
            labs: document.getElementById('record-labs').value,
            note: document.getElementById('record-note').value,
            comprehensiveReport: document.getElementById('record-comprehensive-report-data') ? document.getElementById('record-comprehensive-report-data').value : '',
            originalImages: imageIds
        };
        
        const dynamicFieldRows = document.querySelectorAll('.dynamic-field-row');
        const dynamicFields = [];
        dynamicFieldRows.forEach(row => {
            const k = row.querySelector('.dynamic-field-key').value.trim();
            const v = row.querySelector('.dynamic-field-value').value.trim();
            const isAbnormal = row.querySelector('.dynamic-field-abnormal') ? row.querySelector('.dynamic-field-abnormal').checked : false;
            if(k) {
                dynamicFields.push({ key: k, value: v, isAbnormal: isAbnormal });
            }
        });
        recordData.dynamicFields = dynamicFields;
        
        DataManager.saveRecord(currentMemberId, recordData);
        closeModal('modal-record');
        reloadRecordsAndStats();

        const hasTreatment = !!recordData.treatment;
        const hasDisease = !!recordData.disease;
        const hasNote = !!recordData.note;
        const isVaccine = recordData.type === 'Tiêm chủng' || 
                          (recordData.type && recordData.type.toLowerCase().includes('tiêm')) || 
                          (typeof AIService !== 'undefined' && AIService.findVaccineInfo(recordData.disease + ' ' + recordData.treatment + ' ' + recordData.symptoms));
        
        if ((isVaccine || hasTreatment || (hasDisease && (hasNote || hasTreatment))) && typeof AIService !== 'undefined') {
            setTimeout(() => {
                promptSmartRemindersModal(currentMemberId, recordData, isVaccine);
            }, 350);
        }
    });

    // Delete Modal Record logic
    document.getElementById('btn-delete-record-modal').addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (id && await window.showConfirm("Bạn có chắc chắn muốn xóa hồ sơ khám bệnh này? Dữ liệu không thể khôi phục.")) {
            const record = currentRecords.find(r => r.id === id);
            if (record && record.originalImages) {
                for (let imgId of record.originalImages) {
                    if (imgId.startsWith('img_')) await ImageStore.deleteImage(imgId);
                }
            }
            if (record && record.originalImage && record.originalImage.startsWith('img_')) {
                await ImageStore.deleteImage(record.originalImage);
            }
            
            DataManager.deleteRecord(currentMemberId, id);
            closeModal('modal-record');
            reloadRecordsAndStats();
        }
    });

    // Edit / Delete Record / AI / Image View (Event Delegation)
    document.getElementById('records-list').addEventListener('click', async (e) => {
        const btnEdit = e.target.closest('.btn-edit-record');
        if (btnEdit) {
            try {
                const id = btnEdit.dataset.id;
                const record = currentRecords.find(r => r.id === id);
                if (record) {
                    document.getElementById('record-id').value = record.id;
                document.getElementById('record-date').value = record.date;
                document.getElementById('record-type').value = record.type;
                document.getElementById('record-hospital').value = record.hospital;
                document.getElementById('record-doctor').value = record.doctor || '';
                document.getElementById('record-disease').value = record.disease;
                document.getElementById('record-cost').value = record.cost || '';
                document.getElementById('record-treatment').value = record.treatment || '';
                
                // New EMR fields
                document.getElementById('record-bp').value = record.bp || '';
                document.getElementById('record-hr').value = record.hr || '';
                document.getElementById('record-temp').value = record.temp || '';
                document.getElementById('record-spo2').value = record.spo2 || '';
                document.getElementById('record-symptoms').value = record.symptoms || '';
                document.getElementById('record-labs').value = record.labs || '';
                document.getElementById('record-note').value = record.note || '';
                if (document.getElementById('record-comprehensive-report-data')) {
                    document.getElementById('record-comprehensive-report-data').value = record.comprehensiveReport || '';
                    if (record.comprehensiveReport) {
                        document.getElementById('btn-view-ai-report').classList.remove('hidden');
                    } else {
                        document.getElementById('btn-view-ai-report').classList.add('hidden');
                    }
                }

                if (document.getElementById('ocr-preview-container')) {
                    const container = document.getElementById('ocr-preview-container');
                    container.innerHTML = '';
                    
                    const images = record.originalImages || (record.originalImage ? [record.originalImage] : []);
                    if (images.length > 0) {
                        for (let imgData of images) {
                            if (imgData.startsWith('img_')) {
                                try {
                                    const base64 = await ImageStore.getImage(imgData);
                                    if(base64) addImageToPreview(base64, imgData);
                                } catch(err) {
                                    console.error("Lỗi khi tải ảnh đính kèm:", err);
                                }
                            } else {
                                addImageToPreview(imgData); // Legacy base64
                            }
                        }
                    } else {
                        container.style.display = 'none';
                        if (document.getElementById('btn-scan-analyze')) {
                            document.getElementById('btn-scan-analyze').disabled = true;
                        }
                    }
                }
                
                document.getElementById('dynamic-fields-container').innerHTML = '';
                if (record.dynamicFields && record.dynamicFields.length > 0) {
                    record.dynamicFields.forEach(f => {
                        addDynamicFieldRow(f.key, f.value, f.isAbnormal);
                    });
                }
                
                    document.getElementById('btn-delete-record-modal').classList.remove('hidden');
                    document.getElementById('btn-delete-record-modal').dataset.id = record.id;
                    
                    openModal('modal-record');
                }
            } catch (err) {
                console.error("Lỗi khi mở form sửa:", err);
                alert("Đã xảy ra lỗi khi mở hồ sơ: " + err.message);
            }
            return;
        }
        
        const btnView = e.target.closest('.record-item');
        if (btnView && !e.target.closest('.record-actions')) {
            const id = btnView.dataset.id;
            const record = currentRecords.find(r => r.id === id);
            if (record) {
                await UI.renderRecordDetailModal(record);
                openModal('modal-view-record');
            }
            return;
        }
        
        const btnViewImg = e.target.closest('.btn-view-img');
        if (btnViewImg) {
            let src = btnViewImg.dataset.img;
            if (src && src.startsWith('img_')) {
                src = await ImageStore.getImage(src);
            }
            const imgEl = document.getElementById('viewer-image');
            if (imgEl && src) {
                imgEl.src = src;
                viewerZoomScale = 1;
                imgEl.style.transform = 'scale(1)';
            }
            openModal('modal-image-viewer');
            return;
        }
        
        const btnAi = e.target.closest('.btn-ai-assessment') || e.target.closest('.btn-ai-eval');
        if (btnAi) {
            const id = btnAi.dataset.id;
            const record = currentRecords.find(r => r.id === id);
            const member = DataManager.getMemberById(currentMemberId);
            
            if (record && member) {
                const activeProvider = DataManager.getProviderAssessment();
                const pName = activeProvider === 'openai' ? 'ChatGPT' : (activeProvider === 'anthropic' ? 'Claude' : 'Gemini');
                
                document.querySelector('#modal-ai-assessment .modal-header h3').innerHTML = `<span class="material-symbols-rounded ai-sparkle">psychiatry</span> ${pName} Nhận xét tình trạng`;
                openModal('modal-ai-assessment');
                const loading = document.getElementById('ai-assessment-loading');
                const content = document.getElementById('ai-assessment-content');
                
                loading.innerHTML = `<span class="loading-spinner"></span> ${pName} đang tổng hợp và phân tích hồ sơ...`;
                loading.classList.remove('hidden');
                content.innerHTML = '';
                
                try {
                    const mdText = await AIService.generateHealthAssessment(record, member);
                    content.innerHTML = UI.renderMarkdown(mdText);
            
            // Inject TTS buttons to all headings so users can read section by section
            content.querySelectorAll('h2, h3').forEach(heading => {
                const playBtn = document.createElement('button');
                playBtn.className = 'icon-btn tts-speak-btn';
                playBtn.style.cssText = 'font-size: 12px; padding: 2px 8px; margin-left: 8px; vertical-align: middle; color: #8e44ad; background: rgba(142,68,173,0.1); border-radius: 12px;';
                playBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 14px; vertical-align: middle;">volume_up</span> Nghe phần này';
                playBtn.title = 'Nghe phần này';
                
                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (window.TTSService && TTSService.isPlaying && TTSService.activeBtnElement === playBtn) {
                        TTSService.stop();
                        return;
                    }
                    
                    let textToRead = heading.innerText.replace('Nghe phần này', '').trim() + '\n';
                    let nextEl = heading.nextElementSibling;
                    const stopTags = ['H1', 'H2', 'H3'];
                    while(nextEl && !stopTags.includes(nextEl.tagName)) {
                        textToRead += nextEl.innerText + '\n';
                        nextEl = nextEl.nextElementSibling;
                    }
                    
                    if (window.TTSService) {
                        TTSService.speak(textToRead.trim(), heading.innerText.replace('volume_up', '').replace('Nghe phần này', '').trim(), playBtn, 'assessment', '#ai-assessment-content');
                    }
                });
                heading.appendChild(playBtn);
            });
                } catch (err) {
                    content.innerHTML = `<p style="color:var(--danger);">Lỗi khi liên hệ AI: ${err.message}</p>`;
                } finally {
                    loading.classList.add('hidden');
                }
            }
            return;
        }

        const btnSearch = e.target.closest('.btn-search-disease');
        if (btnSearch) {
            const disease = btnSearch.dataset.disease;
            if (!disease) return;
            
            const activeProvider = DataManager.getProviderSearch();
            const pName = activeProvider === 'openai' ? 'ChatGPT' : (activeProvider === 'anthropic' ? 'Claude' : 'Gemini');
            
            document.querySelector('#modal-ai-assessment .modal-header h3').innerHTML = `<span class="material-symbols-rounded ai-sparkle">travel_explore</span> Tra cứu chuyên sâu (${pName})`;
            openModal('modal-ai-assessment');
            const loading = document.getElementById('ai-assessment-loading');
            const content = document.getElementById('ai-assessment-content');
            
            loading.innerHTML = `<span class="loading-spinner"></span> ${pName} đang tra cứu chuyên sâu về "${disease}"... Xin vui lòng chờ.`;
            loading.classList.remove('hidden');
            content.innerHTML = '';
            try {
                const aiResult = await AIService.searchDiseaseInfo(disease);
                loading.classList.add('hidden');
                content.innerHTML = UI.renderMarkdown(aiResult);
            } catch (err) {
                loading.classList.add('hidden');
                content.innerHTML = `<p style="color:var(--danger);">Lỗi khi liên hệ AI: ${err.message}</p>`;
            }
            return;
        }
    });

    // AI OCR Handling
    document.getElementById('btn-select-ocr-img').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('record-image-input').click();
    });

    document.getElementById('record-image-input').addEventListener('change', async (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const btnScan = document.getElementById('btn-scan-analyze');
            const originalScanText = btnScan.innerHTML;
            const files = e.target.files;

            btnScan.innerHTML = `<span class="material-symbols-rounded" style="vertical-align: middle;">hourglass_empty</span> Đang tải...`;
            btnScan.disabled = true;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                try {
                    if (file.type === 'application/pdf') {
                        btnScan.innerHTML = `<span class="material-symbols-rounded" style="vertical-align: middle;">hourglass_empty</span> Đang đọc PDF...`;
                        await new Promise(r => setTimeout(r, 50));
                        
                        const arrayBuffer = await file.arrayBuffer();
                        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                        
                        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                            btnScan.innerHTML = `<span class="material-symbols-rounded" style="vertical-align: middle;">hourglass_empty</span> Tách trang ${pageNum}/${pdf.numPages}...`;
                            await new Promise(r => setTimeout(r, 50));
                            
                            const page = await pdf.getPage(pageNum);
                            const viewport = page.getViewport({ scale: 1.5 });
                            const canvas = document.createElement('canvas');
                            const context = canvas.getContext('2d');
                            canvas.height = viewport.height;
                            canvas.width = viewport.width;
                            
                            await page.render({ canvasContext: context, viewport: viewport }).promise;
                            
                            const base64 = canvas.toDataURL('image/jpeg', 0.8);
                            addImageToPreview(base64);
                        }
                    } else {
                        btnScan.innerHTML = `<span class="material-symbols-rounded" style="vertical-align: middle;">hourglass_empty</span> Đang tải ảnh ${i + 1}/${files.length}...`;
                        await new Promise(r => setTimeout(r, 50));
                        const base64 = await DataManager.fileToBase64(file);
                        if (base64) {
                            addImageToPreview(base64);
                        }
                    }
                } catch (err) {
                    console.error("Lỗi khi tải file:", err);
                    alert("Có lỗi khi xử lý file " + file.name + ": " + err.message);
                }
            }

            e.target.value = '';
            setTimeout(() => {
                btnScan.innerHTML = originalScanText;
            }, 500);
        }
    });

    // Điền form & Tạo báo cáo đánh giá (1 nút duy nhất, gộp từ 2 nút cũ "Điền form" và
    // "Kết luận"). Bấm 1 lần sẽ chạy đồng thời 2 lệnh gọi AI độc lập trên cùng bộ ảnh đã chọn:
    // (1) trích xuất dữ liệu để tự động điền vào form, và (2) tạo báo cáo đánh giá tổng hợp.
    // Dùng Promise.allSettled thay vì Promise.all để nếu 1 trong 2 lệnh gọi AI bị lỗi (hết
    // quota, mạng chập chờn...) thì lệnh còn lại vẫn được xử lý và hiển thị kết quả bình
    // thường, thay vì mất trắng cả hai chỉ vì một lệnh lỗi.
    document.getElementById('btn-scan-analyze').addEventListener('click', async (e) => {
        e.preventDefault();
        const checkedImgs = Array.from(document.querySelectorAll('#ocr-preview-container > div')).filter(div => {
            const cb = div.querySelector('.ai-select-checkbox');
            return !cb || cb.checked;
        }).map(div => {
            const img = div.querySelector('img');
            return img ? (img.dataset.pdfData || img.src) : null;
        }).filter(src => src);

        if (checkedImgs.length === 0) {
            alert("Vui lòng chọn ít nhất một ảnh để phân tích!");
            return;
        }

        if (!DataManager.getGeminiApiKey()) {
            alert("Vui lòng vào cài đặt nhập API Key của Gemini trước!");
            return;
        }

        const base64Images = checkedImgs;
        const btn = document.getElementById('btn-scan-analyze');
        const loading = document.getElementById('ocr-loading');
        const loadingText = document.getElementById('ocr-loading-text');
        const loadingPercent = document.getElementById('ocr-loading-percent');
        const loadingBar = document.getElementById('ocr-loading-bar');

        btn.disabled = true;
        loading.classList.remove('hidden');
        loadingBar.style.width = '0%';
        loadingPercent.innerText = '0%';
        loadingText.innerText = `Đang phân tích ảnh: vừa điền form vừa tạo báo cáo đánh giá...`;

        let progress = 0;
        const progressInterval = setInterval(() => {
            if (progress < 90) {
                progress += Math.random() * 6;
                if (progress > 90) progress = 90;
                loadingBar.style.width = progress + '%';
                loadingPercent.innerText = Math.round(progress) + '%';
            }
        }, 600);

        const openReportViewer = (reportMarkdown) => {
            document.getElementById('record-comprehensive-report-data').value = reportMarkdown;
            document.getElementById('btn-view-ai-report').classList.remove('hidden');
            const preview = document.getElementById('report-preview-mode');
            const editor = document.getElementById('report-edit-mode');
            preview.innerHTML = UI.renderMarkdown(reportMarkdown);
            editor.value = reportMarkdown;
            preview.classList.remove('hidden');
            editor.classList.add('hidden');
            document.getElementById('btn-save-report-editor').classList.add('hidden');
            openModal('modal-ai-report-editor');
        };

        const [autofillResult, reportResult] = await Promise.allSettled([
            AIService.extractDataFromImage(base64Images),
            AIService.generateComprehensiveReport(base64Images, 'gemini')
        ]);

        clearInterval(progressInterval);

        let autofillOk = false;
        if (autofillResult.status === 'fulfilled') {
            const data = autofillResult.value;
            if (data.date) document.getElementById('record-date').value = data.date;
            if (data.hospital) document.getElementById('record-hospital').value = data.hospital;
            if (data.doctor) document.getElementById('record-doctor').value = data.doctor;
            // Lưu ý: "disease" (chẩn đoán/kết luận) có thể để trống nếu ảnh chỉ là phiếu kết
            // quả xét nghiệm chưa có kết luận của bác sĩ — trường này không còn bắt buộc.
            if (data.disease) document.getElementById('record-disease').value = data.disease;
            if (data.treatment) document.getElementById('record-treatment').value = data.treatment;
            if (data.cost !== undefined) document.getElementById('record-cost').value = data.cost;
            if (data.type) {
                document.getElementById('record-type').value = data.type;
            }
            if (data.bp) document.getElementById('record-bp').value = data.bp;
            if (data.hr) document.getElementById('record-hr').value = data.hr;
            if (data.temp) document.getElementById('record-temp').value = data.temp;
            if (data.spo2) document.getElementById('record-spo2').value = data.spo2;
            if (data.symptoms) document.getElementById('record-symptoms').value = data.symptoms;
            if (data.labs) document.getElementById('record-labs').value = data.labs;
            if (data.note) document.getElementById('record-note').value = data.note;

            document.getElementById('dynamic-fields-container').innerHTML = '';
            if (data.dynamicFields && data.dynamicFields.length > 0) {
                data.dynamicFields.forEach(f => {
                    addDynamicFieldRow(f.key, f.value, f.isAbnormal);
                });
            }
            
            

            autofillOk = true;
        } else {
            console.error("Lỗi khi điền form từ ảnh:", autofillResult.reason);
        }

        let reportOk = false;
        let reportMarkdown = '';
        if (reportResult.status === 'fulfilled') {
            reportMarkdown = reportResult.value;
            reportOk = true;
        } else {
            console.error("Lỗi khi tạo báo cáo đánh giá:", reportResult.reason);
        }

        loadingBar.style.width = '100%';
        loadingPercent.innerText = '100%';

        if (autofillOk && reportOk) {
            loadingText.innerText = 'Hoàn tất: đã điền form & tạo báo cáo!';
            showToast("Đã điền form và tạo báo cáo đánh giá thành công!");
            openReportViewer(reportMarkdown);
        } else if (autofillOk && !reportOk) {
            loadingText.innerText = 'Đã điền form, nhưng tạo báo cáo thất bại';
            const msg = (reportResult.reason && reportResult.reason.message) || 'Lỗi không xác định';
            showToast("Đã điền thông tin form, nhưng tạo báo cáo đánh giá bị lỗi: " + msg, 'error');
        } else if (!autofillOk && reportOk) {
            loadingText.innerText = 'Đã tạo báo cáo, nhưng điền form thất bại';
            const msg = (autofillResult.reason && autofillResult.reason.message) || 'Lỗi không xác định';
            showToast("Đã tạo báo cáo đánh giá, nhưng điền thông tin form bị lỗi: " + msg, 'error');
            openReportViewer(reportMarkdown);
        } else {
            loadingBar.style.width = '0%';
            loadingPercent.innerText = 'Lỗi';
            loadingText.innerText = 'Phân tích thất bại';
            const errMsg = (autofillResult.reason && autofillResult.reason.message) || (reportResult.reason && reportResult.reason.message) || 'Lỗi không xác định';
            alert("Lỗi khi phân tích ảnh: " + errMsg);
        }

        btn.disabled = false;
        setTimeout(() => { loading.classList.add('hidden'); }, 3000);
    });

    async function getPdfOpt(element, filename) {
        // Tính toán scale an toàn dựa trên chiều cao để tránh lỗi quá giới hạn Canvas của WebGL (thường là 16384px trên mobile)
        const docHeight = element.scrollHeight;
        let safeScale = 2; // Mặc định chất lượng cao nhất
        if (docHeight * safeScale > 14000) safeScale = 1.5;
        if (docHeight * safeScale > 14000) safeScale = 1; // Hạ xuống scale thấp hơn nếu file quá dài

        return {
            margin:       0.5,
            filename:     filename,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { 
                scale: safeScale,
                useCORS: true,
                scrollY: 0,
                scrollX: 0
            },
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
        };
    }

    async function withExpandedModal(element, callback) {
        const modalContent = element.closest('.modal-content');
        let originalMaxHeight = '';
        let originalOverflow = '';
        const originalScrollY = window.scrollY;
        const originalScrollX = window.scrollX;
        
        // Mở rộng modal để không bị giới hạn 90vh (nguyên nhân gây cắt chữ)
        if (modalContent) {
            originalMaxHeight = modalContent.style.maxHeight;
            originalOverflow = modalContent.style.overflowY;
            modalContent.style.maxHeight = 'none';
            modalContent.style.overflowY = 'visible';
        }

        // Đưa màn hình về góc trên cùng để html2canvas không bị lệch tọa độ
        window.scrollTo(0, 0);
        
        // Đảm bảo hình ảnh đính kèm đã tải xong hoàn toàn
        const imgs = Array.from(element.querySelectorAll('img'));
        await Promise.all(imgs.map(img => new Promise(resolve => {
            if (img.complete) resolve();
            else { img.onload = resolve; img.onerror = resolve; }
        })));
        
        // Đợi DOM cập nhật layout
        await new Promise(r => setTimeout(r, 500)); 
        
        await callback();
        
        // Khôi phục lại modal như cũ
        if (modalContent) {
            modalContent.style.maxHeight = originalMaxHeight;
            modalContent.style.overflowY = originalOverflow;
        }
        window.scrollTo(originalScrollX, originalScrollY);
    }

    async function downloadPdf(element, filename) {
        await withExpandedModal(element, async () => {
            const opt = await getPdfOpt(element, filename);
            await html2pdf().set(opt).from(element).save();
        });
    }

    async function sharePdf(element, filename) {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (!(isMobile && navigator.share && typeof navigator.canShare === 'function')) {
            alert('Trình duyệt hoặc thiết bị của bạn không hỗ trợ tính năng chia sẻ. Đang chuyển sang tải xuống...');
            return downloadPdf(element, filename);
        }

        const loadingOverlay = document.createElement('div');
        loadingOverlay.style.position = 'fixed';
        loadingOverlay.style.top = '0';
        loadingOverlay.style.left = '0';
        loadingOverlay.style.width = '100vw';
        loadingOverlay.style.height = '100vh';
        loadingOverlay.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        loadingOverlay.style.zIndex = '999999';
        loadingOverlay.style.display = 'flex';
        loadingOverlay.style.flexDirection = 'column';
        loadingOverlay.style.justifyContent = 'center';
        loadingOverlay.style.alignItems = 'center';
        loadingOverlay.style.color = '#2563eb';
        loadingOverlay.style.fontSize = '18px';
        loadingOverlay.innerHTML = '<div class="loading-spinner" style="width:40px;height:40px;margin-bottom:15px;border:4px solid #2563eb;border-top-color:transparent;"></div> Đang chuẩn bị tệp để chia sẻ...';
        document.body.appendChild(loadingOverlay);

        try {
            await withExpandedModal(element, async () => {
                const opt = await getPdfOpt(element, filename);
                const pdfBlob = await html2pdf().set(opt).from(element).output('blob');
                const file = new File([pdfBlob], filename, { type: 'application/pdf' });
                
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: 'Tài liệu Y khoa',
                        files: [file]
                    });
                }
            });
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.warn('Lỗi khi chia sẻ:', e);
                alert('Có lỗi xảy ra khi chia sẻ.');
            }
        } finally {
            if (document.body.contains(loadingOverlay)) loadingOverlay.remove();
        }
    }

    document.getElementById('btn-download-pdf').addEventListener('click', async () => {
        const element = document.getElementById('report-preview-mode');
        await downloadPdf(element, 'Bao_Cao_Y_Khoa.pdf');
    });

    document.getElementById('btn-download-record-pdf').addEventListener('click', async () => {
        const element = document.getElementById('view-record-content');
        await downloadPdf(element, 'Chi_Tiet_Ho_So.pdf');
    });

    // Thêm nút chia sẻ cho Chi Tiết Hồ Sơ
    document.getElementById('btn-share-record').addEventListener('click', async () => {
        const element = document.getElementById('view-record-content');
        await sharePdf(element, 'Chi_Tiet_Ho_So.pdf');
    });

    document.getElementById('btn-download-assessment-pdf').addEventListener('click', async () => {
        const element = document.getElementById('ai-assessment-content');
        let rawTitle = document.querySelector('#modal-ai-assessment .modal-header h3').innerText.trim();
        const titleText = rawTitle.replace(/psychiatry|travel_explore|auto_awesome|history/g, '').trim() || 'AI_Assessment';
        
        // Save locally if this is a trend evaluation
        if (window.currentTrendMetadata) {
            // Check if already saved by id
            const existing = DataManager.getTrendReports(currentMemberId).find(x => x.id === window.currentTrendMetadata.id);
            if (!existing) {
                // If it doesn't have an ID yet, it's newly created. Save it.
                DataManager.saveTrendReport(currentMemberId, window.currentTrendMetadata);
                showToast('Đã lưu bản đánh giá vào hồ sơ!');
                // We don't have the exact ID returned since saveTrendReport assigns it, 
                // but we can set a dummy id to prevent saving again.
                window.currentTrendMetadata.id = 'saved'; 
            }
        }
        
        await downloadPdf(element, `${titleText}.pdf`.replace(/\s+/g, '_'));
    });

    // Thêm nút chia sẻ cho Đánh Giá AI
    document.getElementById('btn-share-assessment').addEventListener('click', async () => {
        const element = document.getElementById('ai-assessment-content');
        let rawTitle = document.querySelector('#modal-ai-assessment .modal-header h3').innerText.trim();
        const titleText = rawTitle.replace(/psychiatry|travel_explore|auto_awesome/g, '').trim() || 'AI_Assessment';
        await sharePdf(element, `${titleText}.pdf`.replace(/\s+/g, '_'));
    });

    // Image Viewer Logic
    document.getElementById('btn-download-viewer-image').addEventListener('click', () => {
        const src = document.getElementById('viewer-image').src;
        if (!src) return;
        const link = document.createElement('a');
        link.href = src;
        link.download = 'hinh_anh_y_khoa.jpg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    document.getElementById('btn-share-viewer-image').addEventListener('click', async () => {
        const src = document.getElementById('viewer-image').src;
        if (!src) return;
        
        if (navigator.share && navigator.canShare) {
            try {
                const res = await fetch(src);
                const blob = await res.blob();
                const file = new File([blob], 'hinh_anh_y_khoa.jpg', { type: blob.type || 'image/jpeg' });
                
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: 'Hình ảnh Y khoa',
                        files: [file]
                    });
                    return;
                }
            } catch (e) {
                console.warn('Không thể chia sẻ ảnh:', e);
            }
        }
        // Fallback: Tải xuống bình thường
        document.getElementById('btn-download-viewer-image').click();
    });

    // Report Editor Modal Logic
    document.getElementById('btn-view-ai-report').addEventListener('click', () => {
        const reportData = document.getElementById('record-comprehensive-report-data').value;
        const preview = document.getElementById('report-preview-mode');
        const editor = document.getElementById('report-edit-mode');
        
        preview.innerHTML = UI.renderMarkdown(reportData || '*Chưa có báo cáo nào.*');
        editor.value = reportData || '';
        
        preview.classList.remove('hidden');
        editor.classList.add('hidden');
        document.getElementById('btn-save-report-editor').classList.add('hidden');
        
        openModal('modal-ai-report-editor');
    });

    document.getElementById('btn-toggle-report-edit').addEventListener('click', () => {
        const preview = document.getElementById('report-preview-mode');
        const editor = document.getElementById('report-edit-mode');
        const saveBtn = document.getElementById('btn-save-report-editor');
        
        if (editor.classList.contains('hidden')) {
            editor.classList.remove('hidden');
            preview.classList.add('hidden');
            saveBtn.classList.remove('hidden');
        } else {
            editor.classList.add('hidden');
            preview.classList.remove('hidden');
            saveBtn.classList.add('hidden');
            preview.innerHTML = UI.renderMarkdown(editor.value || '*Chưa có báo cáo nào.*');
        }
    });

    document.getElementById('btn-save-report-editor').addEventListener('click', () => {
        const editor = document.getElementById('report-edit-mode');
        document.getElementById('record-comprehensive-report-data').value = editor.value;
        closeModal('modal-ai-report-editor');
    });

    // Search and Filter
    document.getElementById('search-history').addEventListener('input', applyFilters);
    document.getElementById('filter-type').addEventListener('change', applyFilters);
    document.getElementById('filter-month').addEventListener('change', applyFilters);

    window.openMedicationPlanModal = function(plan) {
        const modal = document.getElementById('modal-medication-plan-details');
        if (!modal) return;
        
        document.getElementById('medplan-title').innerText = plan.title || 'Lịch Uống Thuốc';
        document.getElementById('medplan-desc').innerText = `Lộ trình ${plan.totalDays} ngày. Hãy tuân thủ đúng giờ để đạt hiệu quả tốt nhất.`;
        document.getElementById('medplan-dates').innerText = `${UI.formatDate(plan.startDate)} - ${UI.formatDate(plan.endDate)}`;
        document.getElementById('medplan-times').innerText = `${plan.times.length} lần/ngày`;

        const container = document.getElementById('medplan-accordion-container');
        container.innerHTML = '';

        // (Đã loại bỏ logic tự động mở accordion theo yêu cầu)

        // Báo cáo tuân thủ
        const reportContainer = document.getElementById('medplan-report-container');
        if (reportContainer) {
            let reportHtml = `<div style="overflow-x: auto;"><table class="report-table" style="width:100%; border-collapse: collapse; margin-bottom: 15px; font-size: 13px; text-align: center;">`;
            
            reportHtml += `<tr><th style="border: 1px solid #cbd5e1; padding: 5px; background: #f8fafc; position: sticky; left: 0; z-index: 1;">Ngày</th>`;
            plan.times.forEach(t => {
                reportHtml += `<th style="border: 1px solid #cbd5e1; padding: 5px; background: #f8fafc;">${t}</th>`;
            });
            reportHtml += `</tr>`;
            
            const startD = new Date(plan.startDate);
            if (!plan.dose_status) plan.dose_status = {};
            
            for (let d_i = 0; d_i < plan.totalDays; d_i++) {
                const d = new Date(startD.getTime() + d_i * 24 * 60 * 60 * 1000);
                const dStr = d.toISOString().split('T')[0];
                const displayDate = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}`;
                
                reportHtml += `<tr><td style="border: 1px solid #cbd5e1; padding: 5px; background: #f8fafc; font-weight: bold; position: sticky; left: 0; z-index: 1;">${displayDate}</td>`;
                
                plan.times.forEach(t => {
                    const timeKey = `${dStr}_${t}`;
                    const status = plan.dose_status[timeKey];
                    let cellContent = '';
                    let bgColor = 'white';
                    let fgColor = 'var(--text-color)';
                    
                    if (status === 'taken') {
                        cellContent = '✅';
                        bgColor = '#dcfce7';
                    } else if (status === 'skipped') {
                        cellContent = ''; 
                        bgColor = 'white';
                    } else {
                        // pending
                        cellContent = '';
                    }
                    
                    reportHtml += `<td class="dose-cell" data-key="${timeKey}" style="border: 1px solid #cbd5e1; padding: 8px; background: ${bgColor}; color: ${fgColor}; cursor: pointer; user-select: none;">${cellContent}</td>`;
                });
                reportHtml += `</tr>`;
            }
            reportHtml += `</table></div>`;
            
            reportContainer.innerHTML = `
                <details class="neumorphic-card" style="padding: 0; overflow: hidden; border-left: 4px solid #10b981;">
                    <summary style="padding: 15px; cursor: pointer; font-weight: 700; color: #047857; display: flex; align-items: center; justify-content: space-between; background: var(--bg-color); outline: none;">
                        <span style="display: flex; align-items: center; gap: 8px;">
                            <span class="material-symbols-rounded">analytics</span> Tiến độ uống thuốc
                        </span>
                        <span class="material-symbols-rounded expand-icon" style="transition: transform 0.2s;">expand_more</span>
                    </summary>
                    <div style="padding: 15px; background: white; border-top: 1px solid rgba(0,0,0,0.05);">
                        <p style="font-size: 12px; margin: 0 0 10px 0; color: #64748b; background: #f1f5f9; padding: 6px 10px; border-radius: 6px;">💡 Nhấn vào các ô vuông bên dưới để điểm danh bù thủ công.</p>
                        ${reportHtml}
                    </div>
                </details>
            `;
            
            reportContainer.querySelectorAll('.dose-cell').forEach(cell => {
                cell.addEventListener('click', function() {
                    const key = this.dataset.key;
                    if (plan.dose_status[key] === 'taken') {
                        plan.dose_status[key] = 'skipped';
                    } else {
                        plan.dose_status[key] = 'taken';
                    }
                    DataManager.saveReminder(plan);
                    window.openMedicationPlanModal(plan);
                });
            });
        }

        // Render các tab accordion chọn giờ (Sáng/Trưa/Chiều/Tối)
        plan.times.forEach((time, index) => {
            // Hàm chuyển đổi giờ thành buổi
            let label = time;
            const hour = parseInt(time.split(':')[0]);
            let icon = 'wb_twilight'; // Sáng sớm
            if (hour >= 5 && hour < 11) { label = 'Buổi sáng (' + time + ')'; icon = 'light_mode'; }
            else if (hour >= 11 && hour < 14) { label = 'Buổi trưa (' + time + ')'; icon = 'sunny'; }
            else if (hour >= 14 && hour < 18) { label = 'Buổi chiều (' + time + ')'; icon = 'wb_twilight'; }
            else { label = 'Buổi tối (' + time + ')'; icon = 'dark_mode'; }

            const meds = plan.medications.filter(m => m.times && m.times.includes(time));
            
            const detailsEl = document.createElement('details');
            detailsEl.className = 'neumorphic-card';
            detailsEl.style.padding = '0';
            detailsEl.style.overflow = 'hidden';
            detailsEl.style.borderLeft = '4px solid #3b82f6';
            // detailsEl.open bị loại bỏ để mặc định tất cả đều đóng

            const summaryEl = document.createElement('summary');
            summaryEl.style.padding = '15px';
            summaryEl.style.cursor = 'pointer';
            summaryEl.style.fontWeight = '700';
            summaryEl.style.color = '#1e40af';
            summaryEl.style.display = 'flex';
            summaryEl.style.alignItems = 'center';
            summaryEl.style.justifyContent = 'space-between';
            summaryEl.style.background = 'var(--bg-color)';
            summaryEl.style.outline = 'none';
            summaryEl.innerHTML = `
                <span style="display: flex; align-items: center; gap: 8px;">
                    <span class="material-symbols-rounded">${icon}</span> ${label}
                </span>
                <span class="material-symbols-rounded expand-icon" style="transition: transform 0.2s;">expand_more</span>
            `;

            const contentEl = document.createElement('div');
            contentEl.style.padding = '15px';
            contentEl.style.borderTop = '1px solid rgba(0,0,0,0.05)';
            contentEl.style.background = '#ffffff';

            if (meds.length === 0) {
                contentEl.innerHTML = `<div style="text-align:center; padding: 10px; color: var(--text-muted);">Không có thuốc nào ở mốc giờ này.</div>`;
            } else {
                const listWrapper = document.createElement('div');
                listWrapper.style.display = 'flex';
                listWrapper.style.flexDirection = 'column';
                listWrapper.style.gap = '15px';

                meds.forEach(med => {
                    const usesHtml = med.purpose ? `<div style="font-size: 13px; color: #475569; margin-top: 5px;"><strong>Công dụng:</strong> ${UI.escapeHtml(med.purpose)}</div>` : '';
                    const usageHtml = med.usage ? `<div style="font-size: 13px; color: #15803d; margin-top: 5px;"><strong>Cách dùng:</strong> ${UI.escapeHtml(med.usage)}</div>` : '';
                    const contraHtml = med.contraindications ? `<div style="font-size: 13px; color: #b91c1c; margin-top: 5px;"><strong>Lưu ý:</strong> ${UI.escapeHtml(med.contraindications)}</div>` : '';
                    
                    const card = document.createElement('div');
                    card.style.background = '#f8fafc';
                    card.style.padding = '12px';
                    card.style.borderRadius = '8px';
                    
                    // Nút bấm tìm kiếm thông tin thuốc
                    const medNameBtn = document.createElement('button');
                    medNameBtn.className = 'neumorphic-btn';
                    medNameBtn.style.padding = '6px 12px';
                    medNameBtn.style.borderRadius = '20px';
                    medNameBtn.style.background = '#eff6ff';
                    medNameBtn.style.color = '#1d4ed8';
                    medNameBtn.style.border = '1px solid #bfdbfe';
                    medNameBtn.style.display = 'inline-flex';
                    medNameBtn.style.alignItems = 'center';
                    medNameBtn.style.gap = '4px';
                    medNameBtn.style.fontSize = '14px';
                    medNameBtn.style.fontWeight = '700';
                    medNameBtn.style.cursor = 'pointer';
                    medNameBtn.style.width = '100%';
                    medNameBtn.style.justifyContent = 'flex-start';
                    medNameBtn.title = 'Tra cứu thông tin thuốc trên Google';
                    medNameBtn.innerHTML = `<span class="material-symbols-rounded" style="font-size: 18px;">search</span> ${UI.escapeHtml(med.name)}`;
                    
                    medNameBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        window.open(`https://www.google.com/search?q=${encodeURIComponent(med.name + ' thuốc')}`, '_blank');
                    });
                    
                    const infoDiv = document.createElement('div');
                    infoDiv.style.marginTop = '10px';
                    infoDiv.innerHTML = `${usageHtml}${usesHtml}${contraHtml}`;

                    card.appendChild(medNameBtn);
                    card.appendChild(infoDiv);
                    listWrapper.appendChild(card);
                });
                contentEl.appendChild(listWrapper);
            }

            detailsEl.appendChild(summaryEl);
            detailsEl.appendChild(contentEl);
            
            // CSS cho mũi tên xoay
            detailsEl.addEventListener('toggle', () => {
                const iconEl = summaryEl.querySelector('.expand-icon');
                if (iconEl) {
                    iconEl.style.transform = detailsEl.open ? 'rotate(180deg)' : 'rotate(0deg)';
                }
            });

            container.appendChild(detailsEl);
        });

        openModal('modal-medication-plan-details');
    };

    // Add Reminder (Member View)
    function initNewReminder(type) {
        document.getElementById('form-reminder').reset();
        document.getElementById('form-medplan').reset();
        document.getElementById('medplan-items-container').innerHTML = '';
        document.getElementById('reminder-id').value = '';
        document.getElementById('medplan-id').value = '';
        
        const settings = DataManager.getSettings();
        document.getElementById('medplan-time-morning').value = settings.medTimeMorning || '08:00';
        document.getElementById('medplan-time-noon').value = settings.medTimeNoon || '12:00';
        document.getElementById('medplan-time-afternoon').value = settings.medTimeAfternoon || '14:00';
        document.getElementById('medplan-time-evening').value = settings.medTimeEvening || '20:00';

        document.querySelectorAll('input[name="reminder_offsets"]').forEach(cb => cb.checked = false);
        const cb0 = document.querySelector('input[name="reminder_offsets"][value="0"]');
        if (cb0) cb0.checked = true;
        document.getElementById('modal-reminder-title').innerText = 'Tạo lịch mới';
        
        const deleteBtn = document.getElementById('btn-delete-reminder');
        if (deleteBtn) deleteBtn.classList.add('hidden');
        
        const tabNormal = document.getElementById('tab-reminder-normal');
        const tabMedplan = document.getElementById('tab-reminder-medplan');
        if (type === 'normal' && tabNormal) tabNormal.click();
        else if (type === 'medplan' && tabMedplan) tabMedplan.click();
        
        openModal('modal-reminder');
    }

    document.getElementById('btn-add-reminder-appointment')?.addEventListener('click', () => initNewReminder('normal'));
    document.getElementById('btn-add-reminder-medication')?.addEventListener('click', () => initNewReminder('medplan'));

    document.getElementById('btn-delete-reminder')?.addEventListener('click', async () => {
        const id = document.getElementById('reminder-id').value;
        if (!id) return;
        if (await window.showConfirm('Bạn có chắc chắn muốn xóa lịch hẹn này không?')) {
            DataManager.deleteReminder(id);
            closeModal('modal-reminder');
            reloadRecordsAndStats();
            checkReminders();
            showToast('Đã xóa lịch hẹn thành công!', 'success');
        }
    });

    document.getElementById('btn-delete-all-reminders')?.addEventListener('click', async () => {
        if (await window.showConfirm('⚠️ Bạn có chắc chắn muốn XÓA TOÀN BỘ lịch hẹn của thành viên này? Hành động này không thể hoàn tác!')) {
            DataManager.deleteAllReminders(currentMemberId);
            reloadRecordsAndStats();
            checkReminders();
            showToast('Đã xóa toàn bộ lịch hẹn thành công!', 'success');
        }
    });

    // Dynamic Fields Logic
    document.getElementById('btn-add-dynamic-field').addEventListener('click', () => {
        addDynamicFieldRow();
    });

    // Bắt sự kiện tắt chuông báo thức
    document.getElementById('btn-stop-alarm').addEventListener('click', () => {
        stopLoudBell();
        document.getElementById('modal-alarm').classList.add('hidden');
    });

    
    let currentReminderTab = 'normal';
    const tabNormal = document.getElementById('tab-reminder-normal');
    const tabMedplan = document.getElementById('tab-reminder-medplan');
    const formReminder = document.getElementById('form-reminder');
    const formMedplan = document.getElementById('form-medplan');

    if (tabNormal && tabMedplan) {
        tabNormal.addEventListener('click', () => {
            currentReminderTab = 'normal';
            tabNormal.style.background = '#3b82f6';
            tabNormal.style.color = 'white';
            tabMedplan.style.background = 'transparent';
            tabMedplan.style.color = 'var(--text-color)';
            formReminder.classList.remove('hidden');
            formMedplan.classList.add('hidden');
        });
        tabMedplan.addEventListener('click', () => {
            currentReminderTab = 'medplan';
            tabMedplan.style.background = '#3b82f6';
            tabMedplan.style.color = 'white';
            tabNormal.style.background = 'transparent';
            tabNormal.style.color = 'var(--text-color)';
            formMedplan.classList.remove('hidden');
            formReminder.classList.add('hidden');
            if (!document.getElementById('medplan-start-date').value) {
                document.getElementById('medplan-start-date').value = new Date().toISOString().split('T')[0];
            }
        });
    }

    document.getElementById('btn-add-med-item')?.addEventListener('click', () => {
        const container = document.getElementById('medplan-items-container');
        const id = Date.now();
        const settings = DataManager.getSettings();
        const html = `
            <div class="neumorphic-card medplan-item" data-id="${id}" style="padding: 15px; border-left: 3px solid #3b82f6; position: relative;">
                <button type="button" class="icon-btn btn-remove-med-item" style="position: absolute; top: 10px; right: 10px; color: #e11d48; width: 30px; height: 30px; font-size: 18px;"><span class="material-symbols-rounded">close</span></button>
                <div class="form-group" style="margin-bottom: 10px;">
                    <label>Tên thuốc *</label>
                    <input type="text" class="neumorphic-input med-name" placeholder="VD: Paracetamol 500mg" required>
                </div>
                <div class="form-group" style="margin-bottom: 10px;">
                    <label>Cách dùng</label>
                    <input type="text" class="neumorphic-input med-usage" placeholder="VD: Uống sau ăn">
                </div>
                <div class="form-group" style="margin-bottom: 10px;">
                    <label>Công dụng / Lưu ý</label>
                    <input type="text" class="neumorphic-input med-purpose" placeholder="VD: Giảm đau, hạ sốt">
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label>Chọn cữ uống *</label>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 5px;">
                        <label style="display:flex; align-items:center; gap:5px;"><input type="checkbox" class="med-time-chk" value="morning"> Sáng</label>
                        <label style="display:flex; align-items:center; gap:5px;"><input type="checkbox" class="med-time-chk" value="noon"> Trưa</label>
                        <label style="display:flex; align-items:center; gap:5px;"><input type="checkbox" class="med-time-chk" value="afternoon"> Chiều</label>
                        <label style="display:flex; align-items:center; gap:5px;"><input type="checkbox" class="med-time-chk" value="evening"> Tối</label>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
        container.lastElementChild.querySelector('.btn-remove-med-item').addEventListener('click', function() {
            this.closest('.medplan-item').remove();
        });
    });

    document.getElementById('btn-save-reminder-action')?.addEventListener('click', () => {
        if (currentReminderTab === 'normal') {
            if (!document.getElementById('reminder-title').value || !document.getElementById('reminder-date').value || !document.getElementById('reminder-time').value) {
                alert('Vui lòng nhập đầy đủ Tiêu đề, Ngày và Giờ hẹn.');
                return;
            }
            const datetime = `${document.getElementById('reminder-date').value}T${document.getElementById('reminder-time').value}`;
            const rmData = {
                id: document.getElementById('reminder-id').value,
                memberId: currentMemberId,
                title: document.getElementById('reminder-title').value,
                date: document.getElementById('reminder-date').value,
                time: document.getElementById('reminder-time').value,
                note: document.getElementById('reminder-note').value,
                datetime,
                selected_offsets: Array.from(document.querySelectorAll('input[name="reminder_offsets"]:checked')).map(cb => cb.value),
                notified_offsets: {} 
            };
            if (new Date(datetime) > new Date()) {
                rmData.notified = false;
                rmData.notified_offsets = {};
            }
            DataManager.saveReminder(rmData);
        } else {
            const startDate = document.getElementById('medplan-start-date').value;
            const totalDays = parseInt(document.getElementById('medplan-total-days').value) || 1;
            if (!startDate) { alert('Vui lòng chọn ngày bắt đầu.'); return; }
            const items = document.querySelectorAll('.medplan-item');
            if (items.length === 0) { alert('Vui lòng thêm ít nhất 1 loại thuốc.'); return; }
            let medications = [];
            let allTimes = new Set();
            let isValid = true;
            
            const timeMap = {
                'morning': document.getElementById('medplan-time-morning').value,
                'noon': document.getElementById('medplan-time-noon').value,
                'afternoon': document.getElementById('medplan-time-afternoon').value,
                'evening': document.getElementById('medplan-time-evening').value
            };

            items.forEach(item => {
                const name = item.querySelector('.med-name').value.trim();
                const usage = item.querySelector('.med-usage').value.trim();
                const purpose = item.querySelector('.med-purpose').value.trim();
                const timeChks = Array.from(item.querySelectorAll('.med-time-chk:checked')).map(cb => cb.value);
                
                if (!name || timeChks.length === 0) isValid = false;
                
                const realTimes = [];
                timeChks.forEach(sess => {
                    const t = timeMap[sess];
                    if (t) {
                        realTimes.push(t);
                        allTimes.add(t);
                    }
                });
                
                medications.push({ name, usage, purpose, contraindications: '', times: realTimes, days: totalDays });
            });
            if (!isValid) { alert('Vui lòng nhập tên thuốc và chọn ít nhất 1 cữ uống cho mỗi loại thuốc.'); return; }
            const startD = new Date(startDate);
            const endD = new Date(startD);
            endD.setDate(startD.getDate() + totalDays - 1);
            const medplanId = document.getElementById('medplan-id').value || DataManager.generateId();
            const existingPlan = DataManager.getReminders().find(r => r.id === medplanId);
            DataManager.saveReminder({
                id: medplanId,
                memberId: currentMemberId,
                title: '💊 Lịch uống thuốc',
                isPlan: true,
                type: 'medication_plan',
                startDate: startDate,
                endDate: endD.toISOString().split('T')[0],
                totalDays: totalDays,
                times: Array.from(allTimes).sort(),
                medications: medications,
                notified_times: (existingPlan && existingPlan.notified_times) ? existingPlan.notified_times : {}
            });
        }
        closeModal('modal-reminder');
        reloadRecordsAndStats();
        checkReminders();
        showToast('Đã lưu lịch thành công!');
    });
}

// --- LOGIC FUNCTIONS ---
function updateFloatingBackButtonState() {
    const floatingBackBtn = document.getElementById('btn-floating-back');
    if (!floatingBackBtn) return;

    // Kiểm tra xem có modal nào đang mở không hoặc đang ở màn hình Chi tiết Thành viên
    const visibleModals = document.querySelectorAll('.modal-overlay:not(.hidden)');
    const isDetailView = document.getElementById('view-member-detail')?.classList.contains('active');

    if (visibleModals.length > 0 || isDetailView) {
        floatingBackBtn.classList.remove('hidden');
    } else {
        floatingBackBtn.classList.add('hidden');
    }
}

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    // Mỗi khi chuyển sang 1 "trang" mới (Trang chủ <-> Chi tiết thành viên), luôn đưa vị trí
    // xem về đầu trang — tránh trường hợp trang mới hiển thị ngay tại vị trí cuộn dở dang của
    // trang trước đó (vì đây là ứng dụng 1 trang - SPA - nên trình duyệt không tự cuộn lại).
    window.scrollTo(0, 0);
    updateFloatingBackButtonState();
}

function addImageToPreview(src, id = null) {
    const container = document.getElementById('ocr-preview-container');
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';
    
    const img = document.createElement('img');
    const isPDF = src && src.startsWith('data:application/pdf');
    if (isPDF) {
        img.src = 'https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg';
        img.dataset.pdfData = src;
        img.style.padding = '10px';
        img.style.background = 'white';
        img.title = 'Tài liệu PDF';
    } else {
        img.src = src || '';
        img.style.cursor = 'zoom-in';
        img.title = 'Nhấn để phóng to';
        img.addEventListener('click', () => {
            document.getElementById('lightbox-img').src = src;
            openModal('modal-lightbox');
        });
    }
    
    if (id) img.dataset.imgId = id;
    img.style.maxHeight = '100px';
    img.style.borderRadius = '8px';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'ai-select-checkbox';
    checkbox.checked = true;
    checkbox.title = 'Chọn gửi ảnh này cho AI đọc';
    checkbox.style.position = 'absolute';
    checkbox.style.top = '5px';
    checkbox.style.left = '5px';
    checkbox.style.zIndex = '2';
    checkbox.style.width = '18px';
    checkbox.style.height = '18px';
    checkbox.style.cursor = 'pointer';
    checkbox.style.zIndex = '10';
    checkbox.style.accentColor = 'var(--primary-blue)';
    checkbox.title = 'Chọn ảnh này để AI phân tích';
    
    const delBtn = document.createElement('button');
    delBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 14px;">close</span>';
    delBtn.className = 'icon-btn';
    delBtn.style.position = 'absolute';
    delBtn.style.top = '-5px';
    delBtn.style.right = '-5px';
    delBtn.style.background = 'var(--danger)';
    delBtn.style.color = 'white';
    delBtn.style.width = '20px';
    delBtn.style.height = '20px';
    delBtn.style.padding = '0';
    delBtn.style.display = 'flex';
    delBtn.style.alignItems = 'center';
    delBtn.style.justifyContent = 'center';
    delBtn.style.border = '2px solid white';
    delBtn.style.opacity = '0'; // Ẩn mặc định
    delBtn.style.transition = 'opacity 0.2s';
    
    // Hiển thị nút X khi di chuột vào ảnh
    wrapper.onmouseenter = () => delBtn.style.opacity = '1';
    wrapper.onmouseleave = () => delBtn.style.opacity = '0';
    
    delBtn.onclick = (e) => {
        e.preventDefault();
        wrapper.remove();
        if (container.querySelectorAll('img').length === 0) {
            if (document.getElementById('btn-scan-analyze')) {
                document.getElementById('btn-scan-analyze').disabled = true;
            }
            container.style.display = 'none';
        }
    };
    
    wrapper.appendChild(img);
    wrapper.appendChild(checkbox);
    wrapper.appendChild(delBtn);
    container.appendChild(wrapper);
    container.style.display = 'flex';
    if (document.getElementById('btn-scan-analyze')) {
        document.getElementById('btn-scan-analyze').disabled = false;
    }
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('hidden');
    // Mỗi lần mở hộp thoại (kể cả mở lại hộp thoại vừa đóng lúc đang cuộn dở, ví dụ sửa hồ sơ
    // dài rồi mở hồ sơ khác), luôn hiển thị từ đầu nội dung thay vì giữ nguyên vị trí cuộn cũ.
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) modalContent.scrollTop = 0;
    updateFloatingBackButtonState();
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
    if (typeof TTSService !== 'undefined' && TTSService.isPlaying) {
        TTSService.stop();
    }
    updateFloatingBackButtonState();
}

function loadMemberDetail(id) {
    currentMemberId = id;
    const member = DataManager.getMemberById(id);
    if (!member) return;

    // Reset tabs
    document.querySelectorAll('.tab-btn')[0].click();

    // Set Header
    const nameDesktop = document.querySelector('#current-member-name .name-desktop');
    const nameMobile = document.querySelector('#current-member-name .name-mobile');
    if (nameDesktop && nameMobile) {
        nameDesktop.innerText = member.name;
        nameMobile.innerText = member.nickname || member.name;
    } else {
        document.getElementById('current-member-name').innerText = member.name;
    }
    document.getElementById('detail-member-avatar').src = member.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(member.name) + '&background=random';

    // Render Profile
    UI.renderMemberProfile(member);
    
    // Load & Render Records/Stats
    reloadRecordsAndStats();

    switchView('view-member-detail');
}

function addDynamicFieldRow(key = '', value = '', isAbnormal = false) {
    const container = document.getElementById('dynamic-fields-container');
    const row = document.createElement('div');
    row.className = 'form-group-row dynamic-field-row';
    row.style.alignItems = 'center';
    row.innerHTML = `
        <div class="form-group" style="flex: 1; margin-bottom: 0;">
            <input type="text" class="neumorphic-input dynamic-field-key" placeholder="Tên chỉ số (vd: Glucose)" value="${key}">
        </div>
        <div class="form-group" style="flex: 1; margin-bottom: 0;">
            <input type="text" class="neumorphic-input dynamic-field-value" placeholder="Kết quả (vd: 5.5 mmol/L)" value="${value}" style="${isAbnormal ? 'color: #e74c3c; font-weight: bold;' : ''}">
        </div>
        <label style="display:flex; align-items:center; justify-content: center; margin:0 5px; cursor:pointer;" title="Đánh dấu kết quả bất thường">
              <input type="checkbox" class="dynamic-field-abnormal" ${isAbnormal ? 'checked' : ''} style="margin: 0; width: 18px; height: 18px; accent-color: #e74c3c;">
          </label>
          <button type="button" class="btn-remove-dynamic-field" style="background: none; border: none; color: #e74c3c; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7" title="Xóa dòng này">
              <span class="material-symbols-rounded" style="font-size: 20px;">close</span>
          </button>
    `;
    
    row.querySelector('.btn-remove-dynamic-field').addEventListener('click', () => {
        row.remove();
    });
    
    container.appendChild(row);
}

// Danh mục "Loại khám" mặc định gợi ý cho ô nhập tự do (khớp với danh mục mà AI được yêu cầu
// dùng khi trích xuất dữ liệu, xem js/ai.js -> extractDataFromImage).
const DEFAULT_RECORD_TYPES = [
    'Khám sức khỏe tổng quát',
    'Bệnh lý cấp tính (Nhẹ)',
    'Bệnh lý cấp tính (Nặng)',
    'Bệnh lý mạn tính',
    'Khám thai',
    'Tiêm chủng',
    'Nha khoa'
];

/**
 * Cập nhật gợi ý tự động (datalist) cho ô "Loại khám" trong form hồ sơ, và danh sách lựa chọn
 * của bộ lọc "Loại khám" trong tab Lịch sử khám, dựa trên các hồ sơ hiện có của thành viên.
 *
 * BUG ĐÃ SỬA: trước đây thẻ <datalist id="record-type-list"> không bao giờ được điền option nào,
 * và <select id="filter-type"> chỉ có mỗi lựa chọn "Tất cả" — khiến bộ lọc theo loại khám không
 * thể sử dụng được trên giao diện.
 */
function updateTypeAutocomplete(records) {
    const usedTypes = [...new Set(
        records.map(r => UI.getTypeInfo(r.type).text).filter(t => t && t !== 'Chưa phân loại')
    )].sort((a, b) => a.localeCompare(b, 'vi'));

    const allTypes = [...new Set([...DEFAULT_RECORD_TYPES, ...usedTypes])];
    UI.populateDatalist('record-type-list', allTypes);

    const filterSelect = document.getElementById('filter-type');
    if (!filterSelect) return;
    const previousValue = filterSelect.value;
    filterSelect.innerHTML = '<option value="all">Tất cả</option>';
    usedTypes.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        filterSelect.appendChild(opt);
    });
    // Giữ lại lựa chọn hiện tại nếu vẫn còn hợp lệ sau khi danh sách được làm mới
    if (Array.from(filterSelect.options).some(o => o.value === previousValue)) {
        filterSelect.value = previousValue;
    }
}

function reloadRecordsAndStats() {
    currentRecords = DataManager.getRecords(currentMemberId);
    updateTypeAutocomplete(currentRecords);
    applyFilters(); // Render with current filters
    UI.renderStatistics(currentRecords);

    // Xóa trùng lặp tự động mỗi khi load hồ sơ
    if (DataManager.deduplicateReminders()) {
        console.log("Đã tự động dọn dẹp các lịch hẹn bị trùng lặp.");
    }
    
    // Tải lại sau khi dọn dẹp
    const memberReminders = DataManager.getReminders().filter(r => r.memberId === currentMemberId);
    
    const now = new Date();
    const group1 = [], group2 = [], group3 = [];
    
    const parseTime = (dateStr) => {
        let t = new Date(dateStr).getTime();
        if (isNaN(t)) {
            // Thử parse định dạng DD/MM/YYYYT... nếu bị lỗi
            const parts = String(dateStr).split('T');
            if (parts.length === 2 && parts[0].includes('/')) {
                const [d, m, y] = parts[0].split('/');
                t = new Date(`${y}-${m}-${d}T${parts[1]}`).getTime();
            }
        }
        return isNaN(t) ? 0 : t;
    };

    memberReminders.forEach(rm => {
        if (rm.completed) {
            group3.push(rm);
        } else if (parseTime(rm.datetime) < now.getTime()) {
            group2.push(rm);
        } else {
            group1.push(rm);
        }
    });
    
    group1.sort((a, b) => parseTime(a.datetime) - parseTime(b.datetime)); // Sắp tới: tăng dần thời gian
    group2.sort((a, b) => parseTime(a.datetime) - parseTime(b.datetime)); // Quá hạn: tăng dần thời gian
    group3.sort((a, b) => parseTime(b.datetime) - parseTime(a.datetime)); // Đã xong: mới hoàn thành xếp trước
    
    // Gộp theo thứ tự: Quá hạn -> Sắp tới -> Đã hoàn thành
    const sortedReminders = [...group2, ...group1, ...group3];
    
    UI.renderRemindersList(sortedReminders, 'member-reminders-list', false);
}

function applyFilters() {
    const q = document.getElementById('search-history').value.toLowerCase();
    const type = document.getElementById('filter-type').value;
    const month = document.getElementById('filter-month').value; // YYYY-MM

    let filtered = currentRecords;

    if (q) {
        filtered = filtered.filter(r =>
            r.disease.toLowerCase().includes(q) ||
            r.hospital.toLowerCase().includes(q) ||
            (r.doctor && r.doctor.toLowerCase().includes(q)) ||
            (r.treatment && r.treatment.toLowerCase().includes(q)) ||
            (r.symptoms && r.symptoms.toLowerCase().includes(q)) ||
            (r.labs && r.labs.toLowerCase().includes(q)) ||
            (r.note && r.note.toLowerCase().includes(q))
        );
    }
    if (type !== 'all') {
        // BUG ĐÃ SỬA: trước đây gọi "Components.getTypeInfo" nhưng không tồn tại object nào tên
        // "Components" trong ứng dụng (object thực tế tên là "UI"), khiến việc lọc theo loại khám
        // luôn ném lỗi ReferenceError và làm hỏng luồng lọc/tìm kiếm hồ sơ.
        filtered = filtered.filter(r => UI.getTypeInfo(r.type).text === type);
    }
    if (month) {
        filtered = filtered.filter(r => r.date.startsWith(month));
    }

    UI.renderRecordsList(filtered);
}

// --- REMINDERS LOGIC ---
const DEFAULT_ALARM_SOUND_URL = 'https://actions.google.com/sounds/v1/alarms/mechanical_clock_ring.ogg';

function getOffsetMs(val, unit) {
    if (!val || !unit) return 0;
    const v = parseInt(val);
    if (isNaN(v) || v <= 0) return 0;
    if (unit === 'minutes') return v * 60 * 1000;
    if (unit === 'hours') return v * 60 * 60 * 1000;
    if (unit === 'days') return v * 24 * 60 * 60 * 1000;
    if (unit === 'weeks') return v * 7 * 24 * 60 * 60 * 1000;
    return 0;
}

function checkReminders() {
    const allReminders = DataManager.getReminders();
    const now = new Date();
    
    // Auto-delete logic: > 3 months (90 days) and either completed or overdue
    const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;
    const toDeleteIds = [];
    allReminders.forEach(rm => {
        const rmDate = new Date(rm.datetime);
        if ((rm.completed || rmDate < now) && (now - rmDate > THREE_MONTHS_MS)) {
            toDeleteIds.push(rm.id);
        }
    });
    if (toDeleteIds.length > 0) {
        toDeleteIds.forEach(id => DataManager.deleteReminder(id));
        // Need to fetch fresh data after deletion
        return checkReminders();
    }

    const settings = DataManager.getSettings();
    const mutedMembers = settings.mutedMembers || [];
    let alarmTriggered = null;
    let modified = false;

    allReminders.forEach(rm => {
        if (rm.completed) return; // Skip checking alarms for completed reminders

        if (rm.type === 'medication_plan') {
            const todayStr = now.toISOString().split('T')[0];
            const start = new Date(rm.startDate);
            const end = new Date(rm.endDate);
            const todayDate = new Date(todayStr);

            if (todayDate >= start && todayDate <= end) {
                if (!rm.notified_times) rm.notified_times = {};
                if (!rm.dose_status) rm.dose_status = {};
                if (!rm.snoozed_doses) rm.snoozed_doses = {};

                rm.times.forEach(t => {
                    const timeKey = `${todayStr}_${t}`;
                    const triggerTime = new Date(`${todayStr}T${t}:00`);
                    
                    if (rm.dose_status[timeKey]) return; // Đã xong hoặc bỏ qua

                    let shouldRing = false;

                    if (!rm.notified_times[timeKey] && now >= triggerTime) {
                        if (now - triggerTime < 2 * 60 * 60 * 1000) {
                            shouldRing = true;
                        } else {
                            // Expired
                            rm.notified_times[timeKey] = true;
                            modified = true;
                        }
                    } else if (rm.snoozed_doses[timeKey] && now.getTime() >= rm.snoozed_doses[timeKey]) {
                        shouldRing = true;
                    }

                    if (shouldRing) {
                        rm.notified_times[timeKey] = true;
                        delete rm.snoozed_doses[timeKey];
                        if (!mutedMembers.includes(rm.memberId)) {
                            alarmTriggered = rm;
                            alarmTriggered.isPlan = true;
                            alarmTriggered.triggerTimeStr = t;
                            alarmTriggered.timeKey = timeKey;
                        }
                        modified = true;
                    }
                });
            }
        } else {
            const rmDate = new Date(rm.datetime);
            let offsets = [];
            if (rm.selected_offsets && Array.isArray(rm.selected_offsets)) {
                offsets = rm.selected_offsets.map(ms => ({ id: 'ms_' + ms, ms: parseInt(ms) }));
            } else {
                offsets = [
                    { id: 'offset1', ms: getOffsetMs(rm.offset1_val, rm.offset1_unit) },
                    { id: 'offset2', ms: getOffsetMs(rm.offset2_val, rm.offset2_unit) },
                    { id: '0', ms: 0 }
                ];
            }

            if (!rm.notified_offsets) rm.notified_offsets = {};
            
            offsets.forEach(offset => {
                if (offset.ms > 0 || offset.id === '0') {
                    const triggerTime = new Date(rmDate.getTime() - offset.ms);
                    if (now >= triggerTime && !rm.notified_offsets[offset.id]) {
                        if (!mutedMembers.includes(rm.memberId)) {
                            alarmTriggered = rm;
                        }
                        rm.notified_offsets[offset.id] = true;
                        modified = true;
                    }
                }
            });
        }
    });

    if (modified) {
        localStorage.setItem('family_reminders', JSON.stringify(allReminders));
    }

    let pendingCount = 0;
    const runningVer = getRunningAppVersion();
    if (localStorage.getItem('last_seen_changelog') !== runningVer && APP_CHANGELOG[runningVer]) {
        hasSystemNotif = true;
        const changelogText = APP_CHANGELOG[runningVer];
        const updateDiv = document.createElement('div');
        updateDiv.className = 'neumorphic-panel';
        updateDiv.style.padding = '12px';
        updateDiv.style.marginBottom = '10px';
        updateDiv.style.borderLeft = '4px solid var(--primary-blue)';
        updateDiv.style.background = 'rgba(41, 128, 185, 0.05)';
        
        const listHtml = '<ul style="margin: 0; padding-left: 20px; font-size: 13px; color: var(--text-color); margin-bottom: 15px; line-height: 1.4;">' + changelogText.split('\n').map(line => `<li style="margin-bottom: 8px;">${line.replace('• ', '')}</li>`).join('') + '</ul>';

        updateDiv.innerHTML = `
            <h4 style="color: var(--primary-blue); margin: 0 0 10px 0; font-size: 15px; display: flex; align-items: center; gap: 5px;"><span class="material-symbols-rounded">new_releases</span> Đã cập nhật lên ${runningVer}!</h4>
            ${listHtml}
            <button id="btn-dismiss-changelog" class="primary-btn neumorphic-btn" style="font-size: 13px; padding: 8px 12px; width: 100%;">Đã hiểu</button>
        `;
        
        notifList.appendChild(updateDiv);
        
        updateDiv.querySelector('#btn-dismiss-changelog').addEventListener('click', () => {
            updateDiv.remove();
            localStorage.setItem('last_seen_changelog', runningVer);
            checkReminders(); // Cập nhật lại số lượng chuông
            if (notifList.children.length === 0) {
                notifList.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px 0;"><span class="material-symbols-rounded" style="font-size: 32px; display: block; margin-bottom: 10px; opacity: 0.5;">notifications_paused</span>Không có thông báo chung nào từ hệ thống.</div>';
            }
        });
    }

    if (!hasSystemNotif) {
        notifList.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px 0;"><span class="material-symbols-rounded" style="font-size: 32px; display: block; margin-bottom: 10px; opacity: 0.5;">notifications_paused</span>Không có thông báo chung nào từ hệ thống.</div>';
    }

    openModal('modal-notifications');
}

// --- BACKUP REMINDER LOGIC ---
const BACKUP_REMINDER_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000; // 30 ngày
const BACKUP_REMINDER_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;    // "Để sau" 3 ngày

/** Ghi lại mốc "lần đầu dùng ứng dụng" một lần duy nhất, làm điểm tham chiếu khi chưa từng backup. */
function ensureFirstRunTimestamp() {
    const settings = DataManager.getSettings();
    if (!settings.firstRunAt) {
        DataManager.saveSettings({ firstRunAt: Date.now() });
    }
}

/**
 * Nhắc người dùng sao lưu dữ liệu nếu đã quá lâu (mặc định 30 ngày) kể từ lần backup gần nhất
 * (hoặc từ lần đầu dùng ứng dụng nếu chưa từng backup lần nào), và không đang trong thời gian
 * "tạm ẩn" do người dùng bấm "Để sau". Chỉ nhắc khi đã có ít nhất 1 thành viên (có gì để backup).
 */
function checkBackupReminder() {
    const members = DataManager.getMembers();
    if (members.length === 0) return;

    const settings = DataManager.getSettings();
    const now = Date.now();

    if (settings.backupReminderSnoozeUntil && now < settings.backupReminderSnoozeUntil) return;

    const reference = settings.lastBackupAt || settings.firstRunAt || now;
    if (now - reference >= BACKUP_REMINDER_INTERVAL_MS) {
        document.getElementById('backup-reminder-toast').classList.remove('hidden');
    }
}

function hideBackupReminder() {
    document.getElementById('backup-reminder-toast').classList.add('hidden');
}

// Event Delegation for Delete/Go to Member
document.addEventListener('change', (e) => {
    if (e.target.classList.contains('chk-complete-reminder')) {
        const id = e.target.dataset.id;
        const isCompleted = e.target.checked;
        const reminders = DataManager.getReminders();
        const rm = reminders.find(r => r.id === id);
        if (rm) {
            rm.completed = isCompleted;
            DataManager.saveReminder(rm);
        }
        
        if (!document.getElementById('modal-notifications').classList.contains('hidden')) {
            openNotifications();
        }
        if (currentMemberId) {
            reloadRecordsAndStats();
        }
        checkReminders();
    }
});

document.addEventListener('click', (e) => {
    const btnGo = e.target.closest('.btn-go-member');
    if (btnGo) {
        closeModal('modal-notifications');
        const id = btnGo.dataset.id;
        loadMemberDetail(id);
    }
});

// Sửa lịch hẹn: điền lại form với dữ liệu của lịch hẹn đã chọn rồi mở modal ở chế độ chỉnh sửa.
document.addEventListener('click', (e) => {
    const btnEditReminder = e.target.closest('.btn-edit-reminder');
    if (btnEditReminder) {
        const id = btnEditReminder.dataset.id;
        const reminder = DataManager.getReminders().find(r => r.id === id);
        if (!reminder) return;

        const tabNormal = document.getElementById('tab-reminder-normal');
        const tabMedplan = document.getElementById('tab-reminder-medplan');
        const deleteBtn = document.getElementById('btn-delete-reminder');
        if (deleteBtn) deleteBtn.classList.remove('hidden');

        document.getElementById('modal-reminder-title').innerText = 'Sửa lịch hẹn';

        if (reminder.isPlan) {
            if (tabMedplan) tabMedplan.click();
            document.getElementById('medplan-id').value = reminder.id;
            document.getElementById('medplan-start-date').value = reminder.startDate || '';
            document.getElementById('medplan-total-days').value = reminder.totalDays || 7;
            
            const settings = DataManager.getSettings();
            let morningTime = settings.medTimeMorning || '08:00';
            let noonTime = settings.medTimeNoon || '12:00';
            let afternoonTime = settings.medTimeAfternoon || '14:00';
            let eveningTime = settings.medTimeEvening || '20:00';

            // Phân loại các mốc thời gian có trong reminder.times vào các buổi
            if (reminder.times && Array.isArray(reminder.times)) {
                reminder.times.forEach(t => {
                    const hr = parseInt(t.split(':')[0]);
                    if (hr < 11) morningTime = t;
                    else if (hr < 14) noonTime = t;
                    else if (hr < 18) afternoonTime = t;
                    else eveningTime = t;
                });
            }

            document.getElementById('medplan-time-morning').value = morningTime;
            document.getElementById('medplan-time-noon').value = noonTime;
            document.getElementById('medplan-time-afternoon').value = afternoonTime;
            document.getElementById('medplan-time-evening').value = eveningTime;
            
            const container = document.getElementById('medplan-items-container');
            container.innerHTML = '';
            
            if (reminder.medications && Array.isArray(reminder.medications)) {
                reminder.medications.forEach(med => {
                    // Map back specific times to sessions
                    let sessMorning = false, sessNoon = false, sessAfternoon = false, sessEvening = false;
                    med.times.forEach(t => {
                        const hr = parseInt(t.split(':')[0]);
                        if (hr < 11) sessMorning = true;
                        else if (hr < 14) sessNoon = true;
                        else if (hr < 18) sessAfternoon = true;
                        else sessEvening = true;
                    });

                    const html = `
                        <div class="neumorphic-card medplan-item" data-id="${Date.now() + Math.random()}" style="padding: 15px; border-left: 3px solid #3b82f6; position: relative;">
                            <button type="button" class="icon-btn btn-remove-med-item" style="position: absolute; top: 10px; right: 10px; color: #e11d48; width: 30px; height: 30px; font-size: 18px;"><span class="material-symbols-rounded">close</span></button>
                            <div class="form-group" style="margin-bottom: 10px;">
                                <label>Tên thuốc *</label>
                                <input type="text" class="neumorphic-input med-name" value="${med.name || ''}" placeholder="VD: Paracetamol 500mg" required>
                            </div>
                            <div class="form-group" style="margin-bottom: 10px;">
                                <label>Cách dùng</label>
                                <input type="text" class="neumorphic-input med-usage" value="${med.usage || ''}" placeholder="VD: Uống sau ăn">
                            </div>
                            <div class="form-group" style="margin-bottom: 10px;">
                                <label>Công dụng / Lưu ý</label>
                                <input type="text" class="neumorphic-input med-purpose" value="${med.purpose || ''}" placeholder="VD: Giảm đau, hạ sốt">
                            </div>
                            <div class="form-group" style="margin-bottom: 0;">
                                <label>Chọn cữ uống *</label>
                                <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 5px;">
                                    <label style="display:flex; align-items:center; gap:5px;"><input type="checkbox" class="med-time-chk" value="morning" ${sessMorning ? 'checked' : ''}> Sáng</label>
                                    <label style="display:flex; align-items:center; gap:5px;"><input type="checkbox" class="med-time-chk" value="noon" ${sessNoon ? 'checked' : ''}> Trưa</label>
                                    <label style="display:flex; align-items:center; gap:5px;"><input type="checkbox" class="med-time-chk" value="afternoon" ${sessAfternoon ? 'checked' : ''}> Chiều</label>
                                    <label style="display:flex; align-items:center; gap:5px;"><input type="checkbox" class="med-time-chk" value="evening" ${sessEvening ? 'checked' : ''}> Tối</label>
                                </div>
                            </div>
                        </div>
                    `;
                    container.insertAdjacentHTML('beforeend', html);
                });
                
                container.querySelectorAll('.btn-remove-med-item').forEach(btn => {
                    btn.addEventListener('click', function() {
                        this.closest('.medplan-item').remove();
                    });
                });
            }
        } else {
            if (tabNormal) tabNormal.click();
            document.getElementById('reminder-id').value = reminder.id;
            document.getElementById('reminder-title').value = reminder.title || '';
            document.getElementById('reminder-date').value = reminder.date || '';
            document.getElementById('reminder-time').value = reminder.time || '';
            document.getElementById('reminder-note').value = reminder.note || '';
            // Clear all checkboxes first
            document.querySelectorAll('input[name="reminder_offsets"]').forEach(cb => cb.checked = false);
            
            if (reminder.selected_offsets && Array.isArray(reminder.selected_offsets)) {
                reminder.selected_offsets.forEach(val => {
                    const cb = document.querySelector(`input[name="reminder_offsets"][value="${val}"]`);
                    if (cb) cb.checked = true;
                });
            } else {
                // Fallback for old reminders or default
                const cb0 = document.querySelector('input[name="reminder_offsets"][value="0"]');
                if (cb0) cb0.checked = true;
            }
        }

        openModal('modal-reminder');
        return;
    }
});

// --- AI Medication Analysis & Chatbot Events ---
document.addEventListener('click', async (e) => {
    // 1. Phân tích thuốc chuyên sâu
    const btnAnalyzeMeds = e.target.closest('.btn-analyze-meds');
    if (btnAnalyzeMeds) {
        const id = btnAnalyzeMeds.dataset.id;
        const record = currentRecords.find(r => r.id === id);
        if (record && record.treatment) {
            btnAnalyzeMeds.innerHTML = `<span class="loading-spinner" style="width: 14px; height: 14px; border-width: 2px; margin-right: 5px;"></span> Đang phân tích...`;
            btnAnalyzeMeds.disabled = true;
            try {
                const analysis = await AIService.analyzeMedications(record.treatment);
                record.medicationAnalysis = analysis;
                DataManager.saveRecord(currentMemberId, record); // Lưu vào DB
                await UI.renderRecordDetailModal(record); // Render lại form
            } catch (err) {
                alert("Lỗi khi phân tích thuốc: " + err.message);
                btnAnalyzeMeds.innerHTML = `<span class="material-symbols-rounded ai-sparkle" style="font-size: 16px;">medication</span> Phân tích đơn thuốc chuyên sâu (AI)`;
                btnAnalyzeMeds.disabled = false;
            }
        }
        return;
    }

    // 2. Toggle Chat
    const btnToggleChat = e.target.closest('#btn-toggle-chat');
    if (btnToggleChat) {
        const chatContainer = document.getElementById('view-record-chat-container');
        chatContainer.classList.toggle('hidden');
        if (!chatContainer.classList.contains('hidden')) {
            // Scroll to chat
            chatContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
            document.getElementById('chat-input').focus();
        }
        return;
    }

    // 3. Send Chat
    const btnChatSend = e.target.closest('#btn-chat-send');
    if (btnChatSend) {
        handleSendChat();
        return;
    }
});

// Handle Enter key for Deep Chat Input
document.addEventListener('keypress', (e) => {
    if (e.target.id === 'deep-chat-input' && e.key === 'Enter') {
        handleDeepChatSend();
    }
});

async function handleDeepChatSend(initialMessage = null) {
    const input = document.getElementById('deep-chat-input');
    const msg = initialMessage || input.value.trim();
    if (!msg) return;

    const modal = document.getElementById('modal-view-record');
    const recordId = modal.dataset.id;
    const record = currentRecords.find(r => r.id === recordId);
    if (!record) return;

    const chatMessages = document.getElementById('deep-chat-messages');
    
    // Nếu là tin nhắn đầu tiên (tự động hỏi)
    if (initialMessage) {
        chatMessages.innerHTML = `
            <div class="chat-message assistant">
                <p>Chào bạn, tôi đang phân tích chuyên sâu hồ sơ này...</p>
            </div>
        `;
    }

    // Hiển thị tin nhắn user
    chatMessages.innerHTML += `
        <div class="chat-message user">
            <p>${UI.escapeHtml(msg)}</p>
        </div>
    `;
    input.value = '';
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Hiển thị typing indicator
    const typingId = 'typing-' + Date.now();
    chatMessages.innerHTML += `
        <div id="${typingId}" class="chat-message assistant chat-typing">
            <p>AI đang suy nghĩ...</p>
        </div>
    `;
    chatMessages.scrollTop = chatMessages.scrollHeight;

    const btnSend = document.getElementById('btn-deep-chat-send');
    btnSend.disabled = true;
    input.disabled = true;

    try {
        if (!window.currentDeepChatHistory) window.currentDeepChatHistory = [];
        const reply = await AIService.chatWithRecord(record, window.currentDeepChatHistory, msg);
        
        // Xóa typing
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();

        // Hiển thị reply
        chatMessages.innerHTML += `
            <div class="chat-message assistant">
                <div class="markdown-body" style="background: none; padding: 0;">${UI.renderMarkdown(reply)}</div>
                <div style="font-size: 11px; color: var(--danger); margin-top: 10px; font-style: italic; border-top: 1px solid rgba(0,0,0,0.05); padding-top: 5px;">* Lưu ý: Thông tin chỉ mang tính tham khảo. Hãy tham khảo ý kiến Bác sĩ.</div>
            </div>
        `;
        
        // Lưu lịch sử
        window.currentDeepChatHistory.push({ role: 'user', content: msg });
        window.currentDeepChatHistory.push({ role: 'assistant', content: reply });
        
    } catch (err) {
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();
        chatMessages.innerHTML += `
            <div class="chat-message assistant" style="color: var(--danger);">
                <p>Lỗi: ${err.message}</p>
            </div>
        `;
    } finally {
        btnSend.disabled = false;
        input.disabled = false;
        if (!initialMessage) input.focus();
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// --- UX Tương tác AI Nâng cao ---
let currentSelectedText = "";
const floatingBtn = document.getElementById('floating-ai-btn');

document.addEventListener('selectionchange', () => {
    const modal = document.getElementById('modal-view-record');
    if (!modal || modal.classList.contains('hidden')) return;

    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text.length > 0 && text.length < 150) {
        currentSelectedText = text;
        try {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) return;
            
            let top = rect.top - 40;
            if (top < 10) top = rect.bottom + 10;
            
            floatingBtn.style.top = `${top}px`;
            floatingBtn.style.left = `${rect.left + (rect.width / 2) - 40}px`;
            floatingBtn.classList.remove('hidden');
            floatingBtn.classList.add('visible');
        } catch (e) {}
    } else {
        setTimeout(() => {
            const currentText = window.getSelection().toString().trim();
            if (currentText.length === 0) {
                floatingBtn.classList.remove('visible');
                setTimeout(() => {
                    if (!floatingBtn.classList.contains('visible')) {
                        floatingBtn.classList.add('hidden');
                    }
                }, 200);
            }
        }, 100);
    }
});

function openDeepChatModal(keyword = null) {
    document.getElementById('modal-deep-chat').classList.remove('hidden');
    
    // Khởi tạo lịch sử chat mới
    window.currentDeepChatHistory = [];
    document.getElementById('deep-chat-messages').innerHTML = '';
    
    if (keyword) {
        handleDeepChatSend(`Hãy phân tích chuyên sâu cho tôi về: "${keyword}"`);
    } else {
        document.getElementById('deep-chat-messages').innerHTML = `
            <div class="chat-message assistant">
                <p>Chào bạn, tôi là Trợ lý Y tế AI. Bạn muốn trao đổi chuyên sâu về vấn đề gì trong hồ sơ này?</p>
            </div>
        `;
    }
}

document.addEventListener('click', async (e) => {
    // 1. Phân tích thuốc chuyên sâu
    const btnAnalyzeMeds = e.target.closest('.btn-analyze-meds');
    if (btnAnalyzeMeds) {
        const id = btnAnalyzeMeds.dataset.id;
        const record = currentRecords.find(r => r.id === id);
        if (record && record.treatment) {
            btnAnalyzeMeds.innerHTML = `<span class="loading-spinner" style="width: 14px; height: 14px; border-width: 2px; margin-right: 5px;"></span> Đang phân tích...`;
            btnAnalyzeMeds.disabled = true;
            try {
                const analysis = await AIService.analyzeMedications(record.treatment);
                record.medicationAnalysis = analysis;
                DataManager.saveRecord(currentMemberId, record);
                await UI.renderRecordDetailModal(record);
            } catch (err) {
                alert("Lỗi khi phân tích thuốc: " + err.message);
                btnAnalyzeMeds.innerHTML = `<span class="material-symbols-rounded ai-sparkle" style="font-size: 16px;">medication</span> Phân tích đơn thuốc chuyên sâu (AI)`;
                btnAnalyzeMeds.disabled = false;
            }
        }
        return;
    }

    // 2. Toggle Chat (Hỏi AI chung) -> Mở Deep Chat
    const btnToggleChat = e.target.closest('#btn-toggle-chat');
    if (btnToggleChat) {
        openDeepChatModal();
        return;
    }

    // 3. Send Deep Chat
    const btnDeepChatSend = e.target.closest('#btn-deep-chat-send');
    if (btnDeepChatSend) {
        handleDeepChatSend();
        return;
    }

    // 4. Bôi đen văn bản (Floating Button) -> Mở Deep Chat
    if (e.target.closest('#floating-ai-btn')) {
        if (currentSelectedText) {
            openDeepChatModal(currentSelectedText);
            
            window.getSelection().removeAllRanges();
            floatingBtn.classList.remove('visible');
            setTimeout(() => floatingBtn.classList.add('hidden'), 200);
        }
    }

    // 5. Clickable Row (Mở Inline Info)
    const clickableRow = e.target.closest('.clickable-row');
    if (clickableRow) {
        const nextRow = clickableRow.nextElementSibling;
        if (nextRow && nextRow.classList.contains('inline-info-row')) {
            // Toggle
            if (nextRow.classList.contains('hidden')) {
                nextRow.classList.remove('hidden');
                
                const contentDiv = nextRow.querySelector('.inline-info-content');
                if (contentDiv.innerHTML.includes('Loaded by JS') || contentDiv.innerHTML.trim() === '') {
                    // Lấy record hiện tại
                    const modal = document.getElementById('modal-view-record');
                    const record = currentRecords.find(r => r.id === modal.dataset.id);
                    const keyword = clickableRow.dataset.keyword;
                    const fieldIndex = record.dynamicFields.findIndex(f => f.key === keyword);
                    const field = record.dynamicFields[fieldIndex];

                    const renderExplanation = (text) => `
                        <div style="margin-bottom: 12px; line-height: 1.5;">${UI.renderMarkdown(text)}</div>
                        <button class="secondary-btn btn-open-deep-chat" data-keyword="${UI.escapeHtml(keyword)}" style="font-size: 12px; padding: 5px 10px; color: #8e44ad; border-color: #8e44ad;">
                            <span class="material-symbols-rounded" style="font-size: 14px; vertical-align: middle; margin-right: 4px;">forum</span> Trao đổi chuyên sâu
                        </button>
                    `;

                    if (field && field.explanation) {
                        contentDiv.innerHTML = renderExplanation(field.explanation);
                    } else {
                        contentDiv.innerHTML = `<div style="display: flex; align-items: center; gap: 8px; color: #8e44ad;"><span class="loading-spinner" style="width: 14px; height: 14px; border-width: 2px; border-color: #8e44ad; border-right-color: transparent;"></span> Đang lấy thông tin tóm tắt...</div>`;
                        
                        try {
                            const explanation = await AIService.getShortExplanation(keyword, record?.disease, record?.treatment);
                            
                            // Lưu lại offline để lần sau mở nhanh hơn (nếu tìm thấy field)
                            if (field) {
                                field.explanation = explanation;
                                DataManager.saveRecord(currentMemberId, record);
                            }

                            contentDiv.innerHTML = renderExplanation(explanation);
                        } catch (err) {
                            contentDiv.innerHTML = `<span style="color: var(--danger);">Không thể lấy thông tin: ${err.message}</span>`;
                        }
                    }
                }
            } else {
                nextRow.classList.add('hidden');
            }
        }
        return;
    }
    
    // 6. Nút "Trao đổi chuyên sâu" bên trong Inline Info
    const btnOpenDeepChat = e.target.closest('.btn-open-deep-chat');
    if (btnOpenDeepChat) {
        const keyword = btnOpenDeepChat.dataset.keyword;
        openDeepChatModal(keyword);
    }
    // 7. Nút "Cách tạo Key"
    const btnCreateKey = e.target.closest('.btn-create-key');
    if (btnCreateKey) {
        e.preventDefault();
        const provider = btnCreateKey.dataset.provider;
        const modal = document.getElementById('modal-api-key-guide');
        const titleEl = document.getElementById('api-key-guide-title');
        const contentEl = document.getElementById('api-key-guide-content');
        
        if (provider === 'gemini') {
            titleEl.innerHTML = '<span style="color: #27ae60;">Hướng dẫn tạo API Key Google Gemini (Miễn phí)</span>';
            contentEl.innerHTML = `
                <p>Google Gemini là AI mặc định và bắt buộc phải có để đọc ảnh bệnh án. Hiện tại Google cho phép dùng hoàn toàn miễn phí.</p>
                <ol style="margin-left: 20px;">
                    <li style="margin-bottom: 10px;">Mở trang <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color: #2980b9; font-weight: bold;">Google AI Studio</a> và đăng nhập bằng tài khoản Gmail của bạn.</li>
                    <li style="margin-bottom: 10px;">Bấm nút <strong>"Create API Key"</strong> màu xanh.</li>
                    <li style="margin-bottom: 10px;">Chọn <strong>"Create API key in new project"</strong>. Quá trình tạo mất vài giây.</li>
                    <li style="margin-bottom: 10px;">Bạn sẽ thấy một chuỗi ký tự dài (thường bắt đầu bằng <code>AIzaSy...</code>). Bấm nút Copy (Sao chép).</li>
                    <li>Quay lại màn hình Cài đặt của phần mềm này, dán chuỗi đó vào ô <strong>Google Gemini API Key</strong> rồi lưu lại.</li>
                </ol>
            `;
        } else if (provider === 'openai') {
            titleEl.innerHTML = '<span style="color: #10a37f;">Hướng dẫn tạo API Key OpenAI (ChatGPT)</span>';
            contentEl.innerHTML = `
                <p>OpenAI (nhà phát triển của ChatGPT) cung cấp API rất thông minh nhưng yêu cầu nạp tiền trả trước (Pay-as-you-go).</p>
                <ol style="margin-left: 20px;">
                    <li style="margin-bottom: 10px;">Mở trang <a href="https://platform.openai.com/api-keys" target="_blank" style="color: #2980b9; font-weight: bold;">OpenAI Platform</a> và đăng nhập.</li>
                    <li style="margin-bottom: 10px;">(Nếu đây là lần đầu dùng API, bạn cần vào mục <strong>Settings > Billing</strong> để thêm thẻ thanh toán và nạp tối thiểu 5$).</li>
                    <li style="margin-bottom: 10px;">Tại mục <strong>API Keys</strong>, bấm nút <strong>"Create new secret key"</strong>.</li>
                    <li style="margin-bottom: 10px;">Nhập tên tùy ý (ví dụ "App So Kham") rồi bấm Create.</li>
                    <li style="margin-bottom: 10px;">Copy chuỗi ký tự hiển thị ra (bắt đầu bằng <code>sk-proj-...</code>). <em>Lưu ý: Mã này chỉ hiện ra 1 lần duy nhất.</em></li>
                    <li>Dán mã đó vào ô <strong>OpenAI API Key</strong> của phần mềm và lưu lại.</li>
                </ol>
            `;
        } else if (provider === 'anthropic') {
            titleEl.innerHTML = '<span style="color: #d35400;">Hướng dẫn tạo API Key Anthropic (Claude)</span>';
            contentEl.innerHTML = `
                <p>Claude của Anthropic nổi tiếng với khả năng đọc hiểu lập luận dài và ngôn ngữ mượt mà. Giống như OpenAI, bạn cần nạp tiền trả trước.</p>
                <ol style="margin-left: 20px;">
                    <li style="margin-bottom: 10px;">Mở trang <a href="https://console.anthropic.com/settings/keys" target="_blank" style="color: #2980b9; font-weight: bold;">Anthropic Console</a> và đăng nhập.</li>
                    <li style="margin-bottom: 10px;">Vào mục <strong>Billing</strong> để nạp tiền vào tài khoản (thường tối thiểu 5$).</li>
                    <li style="margin-bottom: 10px;">Quay lại mục <strong>API Keys</strong>, bấm nút <strong>"Create Key"</strong>.</li>
                    <li style="margin-bottom: 10px;">Đặt tên cho key và copy đoạn mã (thường bắt đầu bằng <code>sk-ant-...</code>).</li>
                    <li>Dán mã đó vào ô <strong>Anthropic API Key</strong> của phần mềm và lưu lại.</li>
                </ol>
            `;
        }
        modal.classList.remove('hidden');
    }
});

// ==================== VACCINE REMINDERS & CONSULTATION CONTROLLER ====================

let currentSmartRemindersToSave = [];

async function promptSmartRemindersModal(memberId, recordData) {
    const modal = document.getElementById('modal-smart-reminders-prompt');
    if (!modal) return;
    
    modal.dataset.memberId = memberId;
    document.getElementById('smart-reminders-loading').classList.remove('hidden');
    document.getElementById('smart-reminders-content').classList.add('hidden');
    document.getElementById('smart-reminders-empty').classList.add('hidden');
    document.getElementById('btn-save-smart-reminders').classList.add('hidden');
    document.getElementById('smart-reminders-list').innerHTML = '';
    
    openModal('modal-smart-reminders-prompt');

    currentSmartRemindersToSave = [];
    const parsedReminders = [];

    const now = new Date();
    const baseDateStr = recordData.date || new Date().toISOString().split('T')[0];
    const baseDate = new Date(baseDateStr);

    try {
        const aiResult = await AIService.extractSmartReminders(recordData);
        
        if (aiResult) {
            if (aiResult.medications && Array.isArray(aiResult.medications) && aiResult.medications.length > 0) {
                // Nhóm tất cả các loại thuốc vào chung một Kế hoạch (Medication Plan)
                let maxDays = 0;
                let allTimes = new Set();
                let validDosesCount = 0;

                aiResult.medications.forEach(med => {
                    const days = med.days || 5;
                    if (days > maxDays) maxDays = days;
                    if (med.times) {
                        med.times.forEach(t => allTimes.add(t));
                    }
                });
                
                // Tính toán endDate dựa vào maxDays
                const endDate = new Date(baseDate.getTime() + (maxDays - 1) * 24 * 60 * 60 * 1000);
                const sortedTimes = Array.from(allTimes).sort();

                // Kiểm tra xem plan này có hiệu lực trong tương lai không
                if (endDate >= new Date(now.setHours(0,0,0,0))) {
                    parsedReminders.push({
                        type: 'medication_plan',
                        title: '💊 Lịch Uống thuốc',
                        desc: `Gồm ${aiResult.medications.length} loại thuốc. Lộ trình ${maxDays} ngày, mỗi ngày ${sortedTimes.length} lần (${sortedTimes.join(', ')}).`,
                        planData: {
                            medications: aiResult.medications,
                            startDate: baseDateStr,
                            endDate: endDate.toISOString().split('T')[0],
                            times: sortedTimes,
                            totalDays: maxDays
                        }
                    });
                }
            }
            
            if (aiResult.followups && Array.isArray(aiResult.followups)) {
                aiResult.followups.forEach(fu => {
                    if (fu.date) {
                        if (new Date(fu.date + 'T08:00:00') > now) {
                            parsedReminders.push({
                                type: 'followup',
                                title: fu.title || 'Tái khám',
                                desc: `Ngày hẹn: ${UI.formatDate(fu.date)} - Ghi chú: ${fu.note || 'Không có'}`,
                                date: fu.date,
                                note: fu.note
                            });
                        }
                    }
                });
            } else if (aiResult.followup && aiResult.followup.date) {
                // Backward compatibility just in case
                if (new Date(aiResult.followup.date + 'T08:00:00') > now) {
                    parsedReminders.push({
                        type: 'followup',
                        title: 'Tái khám',
                        desc: `Ngày hẹn: ${UI.formatDate(aiResult.followup.date)} - Ghi chú: ${aiResult.followup.note || 'Không có'}`,
                        date: aiResult.followup.date,
                        note: aiResult.followup.note
                    });
                }
            }
        }
    } catch (e) {
        console.error("Lỗi khi trích xuất thông minh:", e);
    }

    const isVaccine = recordData.type === 'Tiêm chủng' || 
                      (recordData.type && recordData.type.toLowerCase().includes('tiêm')) || 
                      (typeof AIService !== 'undefined' && AIService.findVaccineInfo(recordData.disease + ' ' + recordData.treatment + ' ' + recordData.symptoms));
    
    if (isVaccine && typeof AIService !== 'undefined') {
        const vInfo = AIService.calculateNextVaccineDose(recordData.disease || recordData.treatment || recordData.symptoms || '', recordData.date);
        if (vInfo && vInfo.nextDoseDate) {
            if (new Date(`${vInfo.nextDoseDate}T08:00:00`) > now) {
                parsedReminders.push({
                    type: 'vaccine',
                    title: vInfo.nextDoseTitle || `Tiêm mũi tiếp theo (${vInfo.vaccineName || 'Vắc xin'})`,
                    desc: `Ngày hẹn: ${UI.formatDate(vInfo.nextDoseDate)} - Bệnh phòng ngừa: ${vInfo.diseaseTarget}`,
                    date: vInfo.nextDoseDate,
                    note: vInfo.defaultNote
                });
            }
        }
    }

    document.getElementById('smart-reminders-loading').classList.add('hidden');
    
    if (parsedReminders.length === 0) {
        document.getElementById('smart-reminders-empty').classList.remove('hidden');
    } else {
        currentSmartRemindersToSave = parsedReminders;
        const listContainer = document.getElementById('smart-reminders-list');
        parsedReminders.forEach((rm, index) => {
            const id = 'chk_sr_' + index;
            const div = document.createElement('div');
            div.style.cssText = "background: rgba(41, 128, 185, 0.05); padding: 12px; border-radius: 8px; display: flex; align-items: flex-start; gap: 10px;";
            div.innerHTML = `
                <input type="checkbox" id="${id}" value="${index}" checked class="chk-smart-reminder-item" style="margin-top: 3px; width: 18px; height: 18px; cursor: pointer;">
                <label for="${id}" style="cursor: pointer; flex: 1;">
                    <div style="font-weight: 600; color: var(--primary-blue); font-size: 14px; margin-bottom: 3px;">${UI.escapeHtml(rm.title)}</div>
                    <div style="font-size: 13px; color: var(--text-color);">${UI.escapeHtml(rm.desc)}</div>
                </label>
            `;
            listContainer.appendChild(div);
        });
        
        document.getElementById('smart-reminders-content').classList.remove('hidden');
        document.getElementById('btn-save-smart-reminders').classList.remove('hidden');
    }
}

document.getElementById('btn-save-smart-reminders')?.addEventListener('click', () => {
    const modal = document.getElementById('modal-smart-reminders-prompt');
    const memberId = modal.dataset.memberId || currentMemberId;

    const checkboxes = document.querySelectorAll('.chk-smart-reminder-item:checked');
    if (checkboxes.length === 0) {
        alert("Vui lòng chọn ít nhất một mục để tạo lịch nhắc!");
        return;
    }

    const now = new Date();
    const baseDateStr = document.getElementById('record-date')?.value || new Date().toISOString().split('T')[0];
    const baseDate = new Date(baseDateStr);
    
    // Lấy danh sách nhắc nhở hiện có để lọc trùng lặp
    const existingReminders = DataManager.getReminders().filter(r => r.memberId === memberId);
    let addedCount = 0;
    let duplicateCount = 0;

    checkboxes.forEach(chk => {
        const index = parseInt(chk.value);
        const rmData = currentSmartRemindersToSave[index];
        if (!rmData) return;

        if (rmData.type === 'medication_plan') {
            const plan = rmData.planData;
            // Kiểm tra trùng lặp: Nếu đã có plan nào cùng startDate, endDate và times
            const isDup = existingReminders.some(r => r.type === 'medication_plan' && r.startDate === plan.startDate && r.endDate === plan.endDate);
            if (!isDup) {
                DataManager.saveReminder({
                    memberId: memberId,
                    type: 'medication_plan',
                    title: rmData.title,
                    startDate: plan.startDate,
                    endDate: plan.endDate,
                    times: plan.times,
                    medications: plan.medications,
                    totalDays: plan.totalDays,
                    completed: false
                });
                addedCount++;
            } else {
                duplicateCount++;
            }
        } else if (rmData.type === 'vaccine' || rmData.type === 'followup') {
            const dt = new Date(`${rmData.date}T08:00:00`);
            if (dt > now) {
                // Kiểm tra trùng lặp
                const isDup = existingReminders.some(r => r.title === rmData.title && r.date === rmData.date);
                if (!isDup) {
                    DataManager.saveReminder({
                        memberId: memberId,
                        title: rmData.title,
                        date: rmData.date,
                        time: '08:00',
                        datetime: `${rmData.date}T08:00:00`,
                        note: rmData.note,
                        selected_offsets: ["0", "86400000", "259200000"], // Nhắc trước 3 ngày, 1 ngày, và đúng lúc
                        completed: false
                    });
                    addedCount++;
                } else {
                    duplicateCount++;
                }
            }
        }
    });

    closeModal('modal-smart-reminders-prompt');
    
    if (addedCount > 0) {
        showToast(`Đã thêm ${addedCount} lịch nhắc mới! ${duplicateCount > 0 ? `(Bỏ qua ${duplicateCount} lịch đã có sẵn)` : ''}`, 'success');
    } else if (duplicateCount > 0) {
        showToast(`Tất cả ${duplicateCount} lịch nhắc này đã tồn tại từ trước!`, 'error');
    }
    
    checkReminders();
    reloadRecordsAndStats();
    
    // Tự động chuyển sang Tab Lịch hẹn để người dùng thấy ngay kết quả
    const tabReminders = document.querySelector('.tab-btn[data-target="tab-reminders"]');
    if (tabReminders) tabReminders.click();
});

// Xử lý nút "Cẩm nang Vắc xin" trong Chi tiết Hồ sơ
document.getElementById('btn-view-vaccine-guide')?.addEventListener('click', (e) => {
    const vaccineText = e.currentTarget.dataset.vaccineText || 'Tiêm chủng';
    const date = e.currentTarget.dataset.date || '';
    openVaccineConsultation(vaccineText, date);
});
function openReminderModalForVaccine(memberId, vInfo) {
    document.getElementById('reminder-id').value = '';
    document.getElementById('reminder-title').value = vInfo.nextDoseTitle || `Tiêm mũi tiếp theo (${vInfo.vaccineName || 'Vắc xin'})`;
    document.getElementById('reminder-date').value = vInfo.nextDoseDate || '';
    document.getElementById('reminder-time').value = '08:00';
    document.getElementById('reminder-note').value = vInfo.defaultNote || `Lịch hẹn tiêm vắc xin ${vInfo.vaccineName || ''}. Mang theo sổ tiêm chủng.`;
    
    // Check offsets mặc định (0, 1 ngày, 3 ngày)
    document.querySelectorAll('.reminder-offset-cb').forEach(cb => cb.checked = false);
    const cb0 = document.querySelector('.reminder-offset-cb[value="0"]');
    const cb1 = document.querySelector('.reminder-offset-cb[value="86400000"]');
    const cb3 = document.querySelector('.reminder-offset-cb[value="259200000"]');
    if (cb0) cb0.checked = true;
    if (cb1) cb1.checked = true;
    if (cb3) cb3.checked = true;

    openModal('modal-reminder');
}

// Xử lý nút "Tra cứu Vắc xin" trên thanh banner nhanh trong form nhập hồ sơ
document.getElementById('btn-quick-vaccine-guide')?.addEventListener('click', () => {
    const disease = document.getElementById('record-disease')?.value.trim() || '';
    const treatment = document.getElementById('record-treatment')?.value.trim() || '';
    const date = document.getElementById('record-date')?.value || '';
    const vaccineText = disease || treatment || 'Vắc xin tiêm phòng';
    openVaccineConsultation(vaccineText, date);
});

// Xử lý nút "Tạo Lịch nhắc tiêm" từ trong Modal Cẩm nang
document.getElementById('btn-create-reminder-from-guide')?.addEventListener('click', () => {
    const modal = document.getElementById('modal-vaccine-consultation');
    const vaccineText = modal?.dataset.vaccineText || 'Tiêm chủng';
    const date = modal?.dataset.date || '';
    closeModal('modal-vaccine-consultation');

    const vInfo = AIService.calculateNextVaccineDose(vaccineText, date) || {
        isVaccine: true,
        vaccineName: vaccineText,
        currentDose: 1,
        nextDoseTitle: `Tiêm mũi tiếp theo (${vaccineText})`,
        nextDoseDate: '',
        defaultNote: `Lịch nhắc tiêm vắc xin ${vaccineText}. Mang theo sổ tiêm chủng.`
    };
    openReminderModalForVaccine(currentMemberId, vInfo);
});

// Xử lý nút đặt lịch nhắc nhanh từ khối thông tin vắc xin trong Chi tiết hồ sơ (event delegation)
document.addEventListener('click', (e) => {
    const btnInline = e.target.closest('.btn-create-vaccine-reminder-inline');
    if (btnInline) {
        const title = btnInline.dataset.title || 'Tiêm mũi tiếp theo';
        const date = btnInline.dataset.date || '';
        const note = btnInline.dataset.note || '';
        const vInfo = {
            nextDoseTitle: title,
            nextDoseDate: date,
            defaultNote: note,
            vaccineName: title,
            currentDose: 1,
            diseaseTarget: 'Phòng ngừa bệnh truyền nhiễm',
            schedule: 'Theo phác đồ chuẩn'
        };
        openReminderModalForVaccine(currentMemberId, vInfo);
    }
});

// Tự động bật/tắt banner gợi ý vắc xin trong form nhập hồ sơ
function updateVaccineBannerState() {
    const typeVal = document.getElementById('record-type')?.value || '';
    const diseaseVal = document.getElementById('record-disease')?.value || '';
    const treatmentVal = document.getElementById('record-treatment')?.value || '';
    const banner = document.getElementById('vaccine-quick-banner');
    if (!banner) return;

    const isVac = typeVal === 'Tiêm chủng' || 
                  typeVal.toLowerCase().includes('tiêm') || 
                  (typeof AIService !== 'undefined' && AIService.findVaccineInfo(diseaseVal + ' ' + treatmentVal));
    
    if (isVac) {
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }
}

document.getElementById('record-type')?.addEventListener('input', updateVaccineBannerState);
document.getElementById('record-type')?.addEventListener('change', updateVaccineBannerState);
document.getElementById('record-disease')?.addEventListener('input', updateVaccineBannerState);
document.getElementById('record-treatment')?.addEventListener('input', updateVaccineBannerState);

// ==================== IMAGE VIEWER ZOOM & PRINT CONTROLS ====================
let viewerZoomScale = 1;

function updateViewerZoom() {
    const imgEl = document.getElementById('viewer-image');
    if (imgEl) {
        imgEl.style.transform = `scale(${viewerZoomScale})`;
    }
}

document.getElementById('btn-viewer-zoom-in')?.addEventListener('click', () => {
    viewerZoomScale = Math.min(viewerZoomScale + 0.25, 3.5);
    updateViewerZoom();
});

document.getElementById('btn-viewer-zoom-out')?.addEventListener('click', () => {
    viewerZoomScale = Math.max(viewerZoomScale - 0.25, 0.5);
    updateViewerZoom();
});

document.getElementById('btn-viewer-zoom-reset')?.addEventListener('click', () => {
    viewerZoomScale = 1;
    updateViewerZoom();
});

// In ảnh đang hiển thị trong modal viewer
document.getElementById('btn-print-viewer-image')?.addEventListener('click', () => {
    const imgEl = document.getElementById('viewer-image');
    if (imgEl && imgEl.src) {
        printMedicalImages([imgEl.src], 'Tài liệu y tế gốc');
    }
});

// Tải ảnh về máy từ modal viewer
document.getElementById('btn-download-viewer-image')?.addEventListener('click', () => {
    const imgEl = document.getElementById('viewer-image');
    if (imgEl && imgEl.src) {
        const a = document.createElement('a');
        a.href = imgEl.src;
        a.download = `Tai_lieu_y_te_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('Đang tải hình ảnh về thiết bị...', 'success');
    }
});

// Chia sẻ ảnh từ modal viewer
document.getElementById('btn-share-viewer-image')?.addEventListener('click', async () => {
    const imgEl = document.getElementById('viewer-image');
    if (!imgEl || !imgEl.src) return;

    if (navigator.share) {
        try {
            // Chuyển base64 sang Blob nếu cần chia sẻ file
            const res = await fetch(imgEl.src);
            const blob = await res.blob();
            const file = new File([blob], `Ho_so_y_te_${Date.now()}.png`, { type: blob.type });
            await navigator.share({
                title: 'Hồ sơ y tế',
                text: 'Hình ảnh tài liệu hồ sơ y tế gia đình',
                files: [file]
            });
        } catch (err) {
            if (err.name !== 'AbortError') {
                showToast('Không thể chia sẻ: ' + err.message, 'error');
            }
        }
    } else {
        showToast('Trình duyệt không hỗ trợ Web Share API.', 'error');
    }
});

/**
 * Hàm in ấn một hoặc nhiều hình ảnh tài liệu y tế chuẩn
 */
function printMedicalImages(imageSrcs, title = 'Tài liệu hồ sơ y tế') {
    if (!imageSrcs || imageSrcs.length === 0) {
        showToast('Không tìm thấy hình ảnh nào để in.', 'error');
        return;
    }

    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow.document;
    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>${title}</title>
            <style>
                @page { margin: 10mm; size: auto; }
                body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; }
                .print-page { page-break-after: always; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 96vh; }
                .print-page:last-child { page-break-after: avoid; }
                img { max-width: 100%; max-height: 90vh; object-fit: contain; box-shadow: none; }
                .print-caption { margin-top: 10px; font-size: 13px; color: #555; }
            </style>
        </head>
        <body>
            ${imageSrcs.map((src, idx) => `
                <div class="print-page">
                    <img src="${src}" alt="${title}">
                    <div class="print-caption">${title} (Trang ${idx + 1}/${imageSrcs.length})</div>
                </div>
            `).join('')}
        </body>
        </html>
    `);
    doc.close();

    printFrame.contentWindow.focus();
    setTimeout(() => {
        printFrame.contentWindow.print();
        setTimeout(() => {
            if (document.body.contains(printFrame)) {
                document.body.removeChild(printFrame);
            }
        }, 1500);
    }, 600);
}

// Xử lý sự kiện bấm In một ảnh riêng lẻ từ Gallery / Thu gọn tài liệu
document.addEventListener('click', async (e) => {
    // 0. Đóng/mở mục Tài liệu đính kèm ở cuối trang
    const toggleDocsBtn = e.target.closest('#btn-toggle-attached-docs');
    if (toggleDocsBtn) {
        const body = document.getElementById('attached-docs-body');
        const icon = document.getElementById('attached-docs-toggle-icon');
        const text = document.getElementById('attached-docs-toggle-text');
        if (body) {
            const isHidden = body.classList.contains('hidden');
            if (isHidden) {
                body.classList.remove('hidden');
                if (icon) icon.style.transform = 'rotate(180deg)';
                if (text) text.innerText = 'Thu gọn';
            } else {
                body.classList.add('hidden');
                if (icon) icon.style.transform = 'rotate(0deg)';
                if (text) text.innerText = 'Xem tài liệu';
            }
        }
        return;
    }

    // 1. Mở xem ảnh phóng to từ bất kỳ phần tử nào có class .btn-view-img
    const btnView = e.target.closest('.btn-view-img');
    if (btnView && !btnView.closest('#records-list')) {
        let src = btnView.dataset.img;
        if (src && src.startsWith('img_')) {
            src = await ImageStore.getImage(src);
        }
        const imgEl = document.getElementById('viewer-image');
        if (imgEl && src) {
            imgEl.src = src;
            viewerZoomScale = 1;
            imgEl.style.transform = 'scale(1)';
            openModal('modal-image-viewer');
        }
        return;
    }

    // 2. In 1 tài liệu đơn lẻ
    const btnPrintSingle = e.target.closest('.btn-print-single-doc');
    if (btnPrintSingle) {
        let src = btnPrintSingle.dataset.img;
        if (src && src.startsWith('img_')) {
            src = await ImageStore.getImage(src);
        }
        if (src) {
            printMedicalImages([src], 'Tài liệu y tế gốc');
        }
        return;
    }

    // 3. In toàn bộ tài liệu đính kèm của hồ sơ
    const btnPrintAll = e.target.closest('.btn-print-all-docs');
    if (btnPrintAll) {
        const recordId = btnPrintAll.dataset.recordId;
        const record = currentRecords.find(r => r.id === recordId);
        if (record) {
            const images = record.originalImages || (record.originalImage ? [record.originalImage] : []);
            if (images.length === 0) {
                showToast('Hồ sơ này không có tài liệu hình ảnh nào đính kèm.', 'error');
                return;
            }
            const resolvedSrcs = [];
            for (let img of images) {
                let s = img;
                if (img.startsWith('img_')) {
                    s = await ImageStore.getImage(img);
                }
                if (s) resolvedSrcs.push(s);
            }
            printMedicalImages(resolvedSrcs, `Hồ sơ ${record.hospital || 'Khám bệnh'} (${record.date || ''})`);
        }
    }
});

// ==================== NÚT NỔI "QUAY VỀ" (FLOATING LEFT BACK BUTTON) ====================
document.getElementById('btn-floating-back')?.addEventListener('click', () => {
    // 1. Nếu có modal đang mở -> Đóng modal trên cùng
    const visibleModals = Array.from(document.querySelectorAll('.modal-overlay:not(.hidden)'));
    if (visibleModals.length > 0) {
        const topModal = visibleModals[visibleModals.length - 1];
        if (topModal && topModal.id) {
            closeModal(topModal.id);
            return;
        }
    }

    // 2. Nếu đang ở màn hình Chi tiết Thành viên -> Quay về Dashboard (Danh sách thành viên)
    const isDetailView = document.getElementById('view-member-detail')?.classList.contains('active');
    if (isDetailView) {
        switchView('view-dashboard');
        initDashboard();
    }
});

// ==================== HỆ THỐNG ĐỌC GIỌNG NÓI CHO NGƯỜI LỚN TUỔI (TEXT-TO-SPEECH) ====================
const TTSService = {
    chunks: [],
    currentChunkIndex: 0,
    isPlaying: false,
    isPaused: false,
    currentType: null,
    activeBtnElement: null,
    activeContainerElement: null,
    speed: 0.9, // Tốc độ đọc từ tốn, ấm áp, rõ ràng cho người lớn tuổi
    pitch: 1.05, // Cao độ giọng nữ êm dịu
    audioFallback: null,
    currentUtterance: null,
    voiceProvider: localStorage.getItem('tts_voice_provider') || 'system',

    getVietnameseFemaleVoice() {
        if (!('speechSynthesis' in window)) return null;
        const voices = window.speechSynthesis.getVoices() || [];
        const viVoices = voices.filter(v => 
            v.lang === 'vi-VN' || v.lang === 'vi_VN' || (v.lang && v.lang.toLowerCase().startsWith('vi'))
        );
        if (viVoices.length === 0) return null;

        // Ưu tiên giọng nữ tiếng Việt êm dịu, tự nhiên:
        // 1. Microsoft HoaiMy Online (Edge Natural)
        // 2. Google Tiếng Việt (Chrome / Android)
        // 3. Linh / Mai (iOS / macOS Enhanced)
        const femaleKeywords = ['hoaimy', 'linh', 'mai', 'female', 'tiếng việt', 'vietnam', 'vi-vn'];
        for (let kw of femaleKeywords) {
            const found = viVoices.find(v => (v.name || '').toLowerCase().includes(kw));
            if (found) return found;
        }
        return viVoices[0];
    },

    cleanTextForSpeech(rawText) {
        if (!rawText) return '';
        let t = rawText
            .replace(/<[^>]*>/g, ' ') // Xóa thẻ HTML
            .replace(/[*#_`>~]/g, ' ') // Xóa ký tự markdown
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Giữ lại text trong markdown link
            .replace(/\bmg\b/gi, ' miligam ')
            .replace(/\bml\b/gi, ' mililit ')
            .replace(/\bkg\b/gi, ' kilogam ')
            .replace(/\bcm\b/gi, ' xentimét ')
            .replace(/\bmmhg\b/gi, ' milimét thủy ngân ')
            .replace(/\bmmol\/l\b/gi, ' milimol trên lít ')
            .replace(/\bui\/l\b/gi, ' đơn vị trên lít ')
            .replace(/\bbpm\b/gi, ' nhịp một phút ')
            .replace(/\bHA\b/g, ' Huyết áp ')
            .replace(/\bSpO2\b/gi, ' Độ bão hòa oxy SpO2 ')
            .replace(/\blần\/ngày\b/gi, ' lần một ngày ')
            .replace(/\bviên\/ngày\b/gi, ' viên một ngày ')
            .replace(/\bĐ\/C\b/gi, ' Địa chỉ ')
            .replace(/\bBS\b/g, ' Bác sĩ ')
            .replace(/\bBV\b/g, ' Bệnh viện ')
            .replace(/\s+/g, ' ')
            .trim();
        return t;
    },

    splitIntoChunks(text, maxChunkLength = 100) {
        // Tách văn bản thành các câu ngắn để không bao giờ bị đứng/treo trên điện thoại
        const rawSentences = text.split(/([.,;!?\n]+)/);
        const chunks = [];
        let cur = '';

        for (let i = 0; i < rawSentences.length; i++) {
            const piece = (rawSentences[i] || '').trim();
            if (!piece) continue;
            if ((cur + ' ' + piece).length <= maxChunkLength) {
                cur += (cur ? ' ' : '') + piece;
            } else {
                if (cur) chunks.push(cur);
                cur = piece;
            }
        }
        if (cur) chunks.push(cur);
        
        // Đảm bảo tuyệt đối không có chunk nào vượt quá maxChunkLength (nếu câu thiếu dấu câu)
        const finalChunks = [];
        for (let c of chunks) {
            if (c.length > maxChunkLength) {
                const words = c.split(' ');
                let temp = '';
                for (let w of words) {
                    if ((temp + ' ' + w).length <= maxChunkLength) {
                        temp += (temp ? ' ' : '') + w;
                    } else {
                        if (temp) finalChunks.push(temp);
                        temp = w;
                    }
                }
                if (temp) finalChunks.push(temp);
            } else {
                finalChunks.push(c);
            }
        }
        return finalChunks.filter(c => c.length > 1);
    },

    buildRecordSpokenText(record) {
        if (!record) return '';
        let parts = [];
        parts.push(`Hồ sơ khám bệnh tại ${record.hospital || 'bệnh viện'}.`);
        if (record.date) {
            const [y, m, d] = record.date.split('-');
            parts.push(`Ngày khám: ngày ${parseInt(d)} tháng ${parseInt(m)} năm ${y}.`);
        }
        if (record.doctor) parts.push(`Bác sĩ phụ trách: ${record.doctor}.`);
        if (record.type) parts.push(`Phân loại: ${record.type}.`);
        if (record.disease) parts.push(`Chẩn đoán kết luận: ${record.disease}.`);

        if (record.treatment) {
            parts.push(`Chỉ định điều trị và đơn thuốc: ${record.treatment}.`);
        }

        if (record.medicationAnalysis) {
            parts.push(`Phân tích đơn thuốc chuyên sâu: ${record.medicationAnalysis}.`);
        }

        if (record.note) parts.push(`Lời khuyên dặn dò của bác sĩ: ${record.note}.`);
        if (record.cost) parts.push(`Chi phí khám chữa bệnh: ${UI.formatCurrency ? UI.formatCurrency(record.cost) : record.cost + ' đồng'}.`);

        const vitals = [];
        if (record.bp) vitals.push(`Huyết áp: ${record.bp} milimét thủy ngân`);
        if (record.hr) vitals.push(`Nhịp tim: ${record.hr} nhịp một phút`);
        if (record.temp) vitals.push(`Thân nhiệt: ${record.temp} độ C`);
        if (record.spo2) vitals.push(`Độ bão hòa oxy máu: ${record.spo2} phần trăm`);
        if (vitals.length > 0) {
            parts.push(`Chỉ số sinh hiệu cơ thể: ${vitals.join(', ')}.`);
        }

        if (record.symptoms) parts.push(`Triệu chứng ghi nhận: ${record.symptoms}.`);
        if (record.labs) parts.push(`Kết quả cận lâm sàng: ${record.labs}.`);

        if (record.dynamicFields && record.dynamicFields.length > 0) {
            const abnormalFields = record.dynamicFields.filter(f => f.isAbnormal);
            const normalFields = record.dynamicFields.filter(f => !f.isAbnormal);
            if (abnormalFields.length > 0) {
                parts.push(`Cảnh báo các chỉ số xét nghiệm bất thường: ${abnormalFields.map(f => f.key + ' là ' + f.value).join(', ')}.`);
            }
            if (normalFields.length > 0) {
                parts.push(`Các chỉ số xét nghiệm bình thường: ${normalFields.map(f => f.key + ' là ' + f.value).join(', ')}.`);
            }
        }

        if (record.comprehensiveReport) {
            parts.push(`Báo cáo nhận xét chuyên sâu từ trí tuệ nhân tạo: ${record.comprehensiveReport}.`);
        }

        return parts.join(' ');
    },

    speak(text, title = 'Đang đọc nội dung...', btnTarget = null, type = null, containerTarget = null) {
        this.stop();

        // Mở khóa âm thanh cho trình duyệt di động
        if ('speechSynthesis' in window) {
            try {
                window.speechSynthesis.resume();
            } catch(e){}
        }

        const clean = this.cleanTextForSpeech(text);
        if (!clean) {
            showToast('Không có nội dung văn bản để đọc.', 'error');
            return;
        }

        this.chunks = this.splitIntoChunks(clean);
        if (this.chunks.length === 0) return;

        this.currentChunkIndex = 0;
        this.isPlaying = true;
        this.isPaused = false;
        this.currentType = type;

        // Resolve Button Element
        if (typeof btnTarget === 'string') {
            this.activeBtnElement = document.querySelector(btnTarget);
        } else {
            this.activeBtnElement = btnTarget;
        }

        // Resolve Container Element
        if (typeof containerTarget === 'string') {
            this.activeContainerElement = document.querySelector(containerTarget);
        } else {
            this.activeContainerElement = containerTarget;
        }

        this.showPlayerUI(title);
        this.setButtonState(true);
        this.setContainerHighlight(true);

        this.playNextChunk();
    },

    playNextChunk() {
        if (!this.isPlaying || this.isPaused) return;

        if (this.currentChunkIndex >= this.chunks.length) {
            this.stop();
            showToast('Đã đọc xong toàn bộ nội dung.', 'success');
            return;
        }

        const chunkText = this.chunks[this.currentChunkIndex];
        this.updatePlayerSubtitle(chunkText);

        if (this.voiceProvider === 'google_translate') {
            this.playChunkWithAudioFallback(chunkText);
            return;
        }

        const voice = this.getVietnameseFemaleVoice();
        const hasNativeVi = 'speechSynthesis' in window && (voice || !/Android/i.test(navigator.userAgent));

        if (hasNativeVi && 'speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(chunkText);
            utterance.lang = 'vi-VN';
            utterance.rate = this.speed;
            utterance.pitch = this.pitch;
            if (voice) utterance.voice = voice;

            utterance.onend = () => {
                if (this.isPlaying && !this.isPaused) {
                    this.currentChunkIndex++;
                    setTimeout(() => this.playNextChunk(), 120);
                }
            };

            utterance.onerror = (e) => {
                console.warn('SpeechSynthesis error, fallback to audio stream:', e);
                this.playChunkWithAudioFallback(chunkText);
            };

            this.currentUtterance = utterance;
            window.speechSynthesis.speak(utterance);
        } else {
            this.playChunkWithAudioFallback(chunkText);
        }
    },

    playChunkWithAudioFallback(chunkText) {
        if (!this.isPlaying || this.isPaused) return;
        const encoded = encodeURIComponent(chunkText);
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encoded}`;

        if (!this.audioFallback) {
            this.audioFallback = new Audio();
        }
        this.audioFallback.src = url;
        this.audioFallback.playbackRate = this.speed;

        this.audioFallback.onended = () => {
            if (this.isPlaying && !this.isPaused) {
                this.currentChunkIndex++;
                setTimeout(() => this.playNextChunk(), 120);
            }
        };

        this.audioFallback.onerror = () => {
            this.currentChunkIndex++;
            setTimeout(() => this.playNextChunk(), 120);
        };

        this.audioFallback.play().catch(err => {
            console.warn('Audio play fallback error:', err);
            this.currentChunkIndex++;
            setTimeout(() => this.playNextChunk(), 150);
        });
    },

    pauseResume() {
        if (!this.isPlaying) return;
        const icon = document.getElementById('tts-pause-icon');
        if (this.isPaused) {
            this.isPaused = false;
            if (icon) icon.innerText = 'pause';
            if (this.audioFallback && !this.audioFallback.paused) {
                this.audioFallback.play();
            } else if ('speechSynthesis' in window) {
                window.speechSynthesis.resume();
            }
            this.playNextChunk();
            showToast('Tiếp tục đọc');
        } else {
            this.isPaused = true;
            if (icon) icon.innerText = 'play_arrow';
            if (this.audioFallback) {
                this.audioFallback.pause();
            }
            if ('speechSynthesis' in window) {
                window.speechSynthesis.pause();
            }
            showToast('Đã tạm dừng đọc');
        }
    },

    stop() {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        if (this.audioFallback) {
            this.audioFallback.pause();
            this.audioFallback.currentTime = 0;
        }
        this.isPlaying = false;
        this.isPaused = false;
        this.currentType = null;
        this.chunks = [];
        this.currentChunkIndex = 0;
        this.hidePlayerUI();
        this.setButtonState(false);
        this.setContainerHighlight(false);
        this.activeBtnElement = null;
        this.activeContainerElement = null;
    },

    toggleSpeed() {
        const speeds = [0.8, 0.9, 1.1];
        const labels = ['0.8x', '0.9x', '1.1x'];
        const desc = ['Rất chậm', 'Êm dịu chuẩn', 'Nhanh hơn'];
        let idx = speeds.indexOf(this.speed);
        if (idx === -1) idx = 1;
        idx = (idx + 1) % speeds.length;
        this.speed = speeds[idx];
        const btn = document.getElementById('btn-tts-speed');
        if (btn) btn.innerText = labels[idx];
        showToast(`Tốc độ đọc: ${labels[idx]} (${desc[idx]})`);
    },

    showPlayerUI(title) {
        const bar = document.getElementById('tts-player-bar');
        const titleEl = document.getElementById('tts-player-title');
        const pauseIcon = document.getElementById('tts-pause-icon');
        if (titleEl) titleEl.innerText = title;
        if (pauseIcon) pauseIcon.innerText = 'pause';
        if (bar) bar.classList.remove('hidden');
    },

    updatePlayerSubtitle(text) {
        const titleEl = document.getElementById('tts-player-title');
        if (titleEl) {
            titleEl.innerText = `Đang đọc: "${text}"`;
            titleEl.title = text;
        }
    },

    hidePlayerUI() {
        const bar = document.getElementById('tts-player-bar');
        if (bar) bar.classList.add('hidden');
    },

    setContainerHighlight(isHighlight) {
        document.querySelectorAll('.reading-active-container').forEach(el => {
            el.classList.remove('reading-active-container');
        });
        if (isHighlight && this.activeContainerElement) {
            this.activeContainerElement.classList.add('reading-active-container');
        }
    },

    setButtonState(isSpeaking) {
        document.querySelectorAll('.tts-speak-btn').forEach(btn => {
            btn.classList.remove('speaking');
            const isAllBtn = btn.id === 'btn-speak-record';
            btn.innerHTML = `
                <span class="material-symbols-rounded" style="font-size: ${isAllBtn ? 16 : 14}px;">volume_up</span>
                <span>${isAllBtn ? 'Đọc tất cả' : 'Đọc'}</span>
            `;
        });

        if (isSpeaking && this.activeBtnElement) {
            this.activeBtnElement.classList.add('speaking');
            this.activeBtnElement.innerHTML = `
                <div class="sound-wave-bars">
                    <span class="bar b1"></span>
                    <span class="bar b2"></span>
                    <span class="bar b3"></span>
                    <span class="bar b4"></span>
                    <span class="bar b5"></span>
                </div>
                <span>Dừng</span>
            `;
        }
    }
};

// Đảm bảo tải trước danh sách giọng nói tiếng Việt khi trình duyệt sẵn sàng
if ('speechSynthesis' in window) {
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => TTSService.getVietnameseFemaleVoice();
    }
}

// 1. Đọc Chi tiết Toàn bộ Hồ sơ
document.getElementById('btn-speak-record')?.addEventListener('click', (e) => {
    const btn = document.getElementById('btn-speak-record');
    if (TTSService.isPlaying && TTSService.activeBtnElement === btn) {
        TTSService.stop();
        return;
    }
    const modal = document.getElementById('modal-view-record');
    const recordId = modal.dataset.id;
    const record = currentRecords.find(r => r.id === recordId);
    if (!record) return showToast('Không tìm thấy thông tin hồ sơ.', 'error');

    let spokenText = TTSService.buildRecordSpokenText(record);
    TTSService.speak(spokenText, `Hồ sơ: ${record.disease || record.hospital || 'Khám bệnh'}`, btn, 'record-all', '#view-record-content');
});

// 2. Đọc Từng Khung Nội dung Riêng biệt (.btn-speak-section)
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-speak-section');
    if (!btn) return;

    if (TTSService.isPlaying && TTSService.activeBtnElement === btn) {
        TTSService.stop();
        return;
    }

    const targetSelector = btn.dataset.target;
    const sectionName = btn.dataset.sectionName || 'Nội dung mục';
    const container = targetSelector ? document.querySelector(targetSelector) : btn.closest('.detail-section-card');

    if (!container) return;

    // Clone container và xóa các nút điều khiển để chỉ đọc văn bản nội dung sạch
    const clone = container.cloneNode(true);
    clone.querySelectorAll('button, .attached-doc-actions, script, style, .material-symbols-rounded').forEach(el => el.remove());
    const text = clone.innerText || '';

    if (!text.trim()) {
        showToast('Mục này chưa có nội dung văn bản để đọc.', 'info');
        return;
    }

    TTSService.speak(text, sectionName, btn, 'section', container);
});

// 3. Đọc AI Nhận xét
document.getElementById('btn-speak-assessment')?.addEventListener('click', () => {
    const btn = document.getElementById('btn-speak-assessment');
    if (TTSService.isPlaying && TTSService.activeBtnElement === btn) {
        TTSService.stop();
        return;
    }
    const content = document.getElementById('ai-assessment-content')?.innerText;
    if (!content || !content.trim()) return showToast('Chưa có nội dung nhận xét để đọc.', 'error');

    TTSService.speak(content, 'AI Nhận xét sức khỏe', btn, 'assessment', '#ai-assessment-content');
});

// 4. Đọc Cẩm nang Vắc xin
document.getElementById('btn-speak-vaccine-guide')?.addEventListener('click', () => {
    const btn = document.getElementById('btn-speak-vaccine-guide');
    if (TTSService.isPlaying && TTSService.activeBtnElement === btn) {
        TTSService.stop();
        return;
    }
    const content = document.getElementById('vaccine-consultation-content')?.innerText;
    if (!content || !content.trim()) return showToast('Chưa có nội dung cẩm nang để đọc.', 'error');

    TTSService.speak(content, 'Cẩm nang Tiêm chủng', btn, 'vaccine', '#vaccine-consultation-content');
});

// 5. Các nút điều khiển trên Mini Player
document.getElementById('btn-tts-pause-resume')?.addEventListener('click', () => TTSService.pauseResume());
document.getElementById('btn-tts-stop')?.addEventListener('click', () => TTSService.stop());
document.getElementById('btn-tts-speed')?.addEventListener('click', () => TTSService.toggleSpeed());

// 6. Cài đặt Giọng đọc
document.getElementById('btn-tts-settings')?.addEventListener('click', () => {
    const provider = TTSService.voiceProvider;
    const radio = document.querySelector(`input[name="tts_voice_provider"][value="${provider}"]`);
    if (radio) radio.checked = true;
    document.getElementById('modal-tts-settings').classList.remove('hidden');
});

document.querySelectorAll('input[name="tts_voice_provider"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const val = e.target.value;
        TTSService.voiceProvider = val;
        localStorage.setItem('tts_voice_provider', val);
        showToast('Đã lưu cài đặt giọng đọc.');
        setTimeout(() => document.getElementById('modal-tts-settings').classList.add('hidden'), 500);
    });
});


