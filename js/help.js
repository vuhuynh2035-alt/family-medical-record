/**
 * help.js — Hệ thống Cẩm nang Hướng dẫn Sử dụng & Trợ lý AI
 * Hỗ trợ Đa ngôn ngữ (Tiếng Việt, English, 日本語, 中文)
 */

const GUIDE_DATA = {
    vi: {
        title: "Cẩm nang Hướng dẫn Sử dụng Toàn diện",
        subtitle: "Khám phá tất cả tính năng quản lý sức khỏe gia đình & Trí tuệ Nhân tạo",
        search_placeholder: "Tìm kiếm hướng dẫn (VD: quét ảnh, uống thuốc, mã PIN...)",
        all_topics: "Tất cả",
        sections: [
            {
                id: "i18n",
                icon: "language",
                badge: "Mới v2.9.94",
                title: "1. Chuyển đổi Đa ngôn ngữ",
                desc: "Hỗ trợ 4 ngôn ngữ: Tiếng Việt, Tiếng Anh (English), Tiếng Nhật (日本語) và Tiếng Trung (中文).",
                steps: [
                    "<strong>Đổi ngôn ngữ ngay tại Trang chủ:</strong> Bấm vào bộ chọn ngôn ngữ có biểu tượng quả địa cầu <code>🌐</code> ở thanh tiêu đề trên cùng.",
                    "<strong>Đổi tại Màn hình Tạo PIN lần đầu:</strong> Nếu là người dùng mới, bạn có thể chọn ngôn ngữ ngay trên màn hình thiết lập bảo mật trước khi nhập PIN.",
                    "<strong>Đổi trong Cài đặt:</strong> Vào <em>Cài đặt Hệ thống</em> > <em>Ngôn ngữ hiển thị</em> để chuyển đổi bất kỳ lúc nào.",
                    "<strong>Tự động đồng bộ AI:</strong> Khi đổi sang Tiếng Anh, Nhật hoặc Trung, toàn bộ các phản hồi phân tích của AI sẽ tự động viết bằng ngôn ngữ đó."
                ]
            },
            {
                id: "profile",
                icon: "family_restroom",
                badge: "Cơ bản",
                title: "2. Quản lý Thành viên & Hồ sơ Gia đình",
                desc: "Tạo và theo dõi hồ sơ sức khỏe độc lập cho từng người thân trong gia đình.",
                steps: [
                    "<strong>Thêm thành viên mới:</strong> Bấm nút <em>'Thêm thành viên'</em> trên Trang chủ, điền Họ tên, Ngày sinh, Giới tính, Nhóm máu và Tiền sử bệnh lý/dị ứng.",
                    "<strong>Hệ thống tự tính tuổi:</strong> Ứng dụng tự động tính số tuổi chính xác theo ngày tháng năm sinh hoặc năm sinh ước tính.",
                    "<strong>Xem chi tiết:</strong> Nhấn vào thẻ của bất kỳ thành viên nào để vào trang quản lý lịch sử khám, đơn thuốc và lịch hẹn riêng của người đó.",
                    "<strong>Chỉnh sửa/Xóa:</strong> Bấm biểu tượng cây bút chì ở góc trên trang cá nhân để chỉnh sửa thông tin hoặc xóa hồ sơ (yêu cầu mã PIN)."
                ]
            },
            {
                id: "ocr",
                icon: "document_scanner",
                badge: "AI OCR",
                title: "3. Quét thông minh bằng AI (OCR Đơn thuốc & Kết quả)",
                desc: "Tải ảnh hoặc PDF tài liệu y tế để AI tự động trích xuất thông tin, điền form và lập lịch hẹn.",
                steps: [
                    "Trong trang hồ sơ thành viên, chuyển sang tab <em>'Hồ sơ'</em> và bấm <strong>'Hồ sơ mới'</strong>.",
                    "Tại khu vực <strong>'Quét thông minh bằng AI'</strong>, bạn có 3 lựa chọn:",
                    "• <strong>🖼️ Thư viện ảnh:</strong> Chọn ảnh đơn thuốc, phiếu xét nghiệm đã lưu trên điện thoại.<br>• <strong>📷 Chụp ảnh:</strong> Mở camera chụp trực tiếp giấy khám bệnh.<br>• <strong>📄 Tệp PDF:</strong> Tải tệp kết quả khám PDF nhiều trang (hệ thống tự tách từng trang cho AI đọc).",
                    "Bấm nút <strong>'Xử lý thông tin'</strong> và chờ vài giây. AI sẽ tự động điền Tên bệnh viện, Bác sĩ, Ngày khám, Chẩn đoán, Chỉ số xét nghiệm, Sinh hiệu và Đơn thuốc.",
                    "Sau khi AI xử lý xong, bạn có thể kiểm tra lại thông tin và bấm <strong>'Lưu hồ sơ'</strong>."
                ]
            },
            {
                id: "trend",
                icon: "trending_up",
                badge: "Nâng cao",
                title: "4. Đánh giá Xu hướng Sức khỏe & Báo cáo PDF",
                desc: "AI tổng hợp toàn bộ lịch sử bệnh án để đánh giá tiến trình, cảnh báo sớm và xuất báo cáo PDF.",
                steps: [
                    "Bấm nút <strong>'Đánh giá xu hướng'</strong> (biểu tượng lấp lánh) tại màn hình danh sách Hồ sơ.",
                    "<strong>Tự động lưu lịch sử:</strong> Báo cáo đánh giá sau khi tạo được tự động lưu lại trong hệ thống, bạn có thể xem lại bất kỳ lúc nào mà không lo bị mất dữ liệu khi lỡ vuốt màn hình.",
                    "<strong>Xuất tệp PDF:</strong> Bấm nút <em>'Lưu PDF'</em> để tải về báo cáo định dạng PDF chuẩn y khoa, tiện lợi khi cần chia sẻ cho bác sĩ điều trị.",
                    "<strong>Nghe đọc từng đoạn (TTS):</strong> Cho phép bấm nút 'Đọc' ở từng mục nhỏ trong báo cáo thay vì phải nghe từ đầu, kèm hiệu ứng Karaoke đánh dấu từng từ đang đọc."
                ]
            },
            {
                id: "medication",
                icon: "alarm",
                badge: "Nhắc nhở",
                title: "5. Lịch Uống Thuốc & Báo Thức Thông Minh",
                desc: "Tự động gom đơn thuốc, báo chuông nhắc giờ uống và đồng bộ vào Lịch điện thoại.",
                steps: [
                    "Bấm nút <strong>'+ Uống thuốc'</strong> hoặc để AI tự động trích xuất kế hoạch uống thuốc từ đơn thuốc.",
                    "Toàn bộ đơn thuốc được gom gọn thành một lộ trình duy nhất chia theo 4 buổi: <strong>Sáng - Trưa - Chiều - Tối</strong>. Bạn có thể tùy chỉnh giờ uống riêng cho từng lịch.",
                    "<strong>Chuông báo thức Web Audio Synthesizer:</strong> Báo chuông to rõ ràng ngay cả khi thiết bị mất kết nối mạng Internet.",
                    "<strong>Điểm danh uống thuốc:</strong> Khi chuông reo, chọn <em>'Đã uống'</em>, <em>'Nhắc lại sau 30 phút'</em> hoặc <em>'Bỏ qua'</em>. Bạn có thể bấm vào lịch để xem bảng lưới điểm danh tuân thủ uống thuốc.",
                    "<strong>Đồng bộ Lịch điện thoại:</strong> Tải tệp <code>.ics</code> chuẩn RFC 5545 hoặc mở trực tiếp trên Google Calendar để kích hoạt báo thức của điện thoại."
                ]
            },
            {
                id: "china",
                icon: "hub",
                badge: "Mới v2.9.93",
                title: "6. Dùng AI tại Trung Quốc không cần VPN",
                desc: "Tích hợp sẵn DeepSeek và Zhipu AI hoạt động mượt mà tại Trung Quốc không bị chặn mạng.",
                steps: [
                    "Nếu bạn ở Trung Quốc hoặc không sử dụng mạng riêng ảo (VPN), mở <strong>Cài đặt Hệ thống</strong>.",
                    "Bấm nút <strong>'Dùng AI TQ'</strong> để hệ thống tự động cấu hình toàn bộ ứng dụng sang DeepSeek và Zhipu AI (GLM-4-Flash miễn phí 100%, GLM-4V đọc ảnh).",
                    "Nhập API Key của DeepSeek và Zhipu AI vào các ô tương ứng rồi bấm <strong>'Lưu cài đặt'</strong>.",
                    "Tất cả tính năng Quét OCR, Đánh giá xu hướng và Chat tư vấn sẽ kết nối trực tiếp, mượt mà tại Trung Quốc."
                ]
            },
            {
                id: "security",
                icon: "lock",
                badge: "Bảo mật",
                title: "7. Khóa Mã PIN & Bảo Mật Quyền Riêng Tư",
                desc: "Bảo vệ thông tin bệnh án bằng mã PIN. Dữ liệu lưu 100% trên thiết bị của bạn.",
                steps: [
                    "<strong>Cài đặt mã PIN:</strong> Bật khóa PIN (4-6 chữ số) trong <em>Cài đặt Hệ thống</em> hoặc màn hình thiết lập lần đầu.",
                    "<strong>Khóa màn hình:</strong> Khi bật khóa PIN, ứng dụng sẽ yêu cầu nhập mã PIN mỗi khi mở lên để tránh người khác xem lén dữ liệu riêng tư.",
                    "<strong>Xác nhận thao tác nguy hiểm:</strong> Mọi thao tác xóa hồ sơ y tế hoặc khôi phục cài đặt gốc đều bắt buộc phải nhập đúng mã PIN.",
                    "<strong>Bảo mật Offline-First:</strong> Toàn bộ dữ liệu bệnh án, hình ảnh chụp đều được lưu trữ trực tiếp trên bộ nhớ máy (LocalStorage), không bao giờ tự ý tải lên máy chủ ngoài."
                ]
            },
            {
                id: "backup",
                icon: "cloud_sync",
                badge: "Dữ liệu",
                title: "8. Sao Lưu, Chia Sẻ & Khôi Phục Dữ Liệu",
                desc: "Lưu trữ dự phòng và chuyển đổi dữ liệu dễ dàng giữa các điện thoại.",
                steps: [
                    "<strong>Tải file dự phòng:</strong> Vào <em>Cài đặt</em> > bấm <strong>'Tải File'</strong> để lưu toàn bộ hồ sơ y tế thành tệp <code>.json</code>.",
                    "<strong>Chia sẻ trực tiếp:</strong> Bấm <strong>'Chia sẻ'</strong> để gửi tệp sao lưu qua Zalo, Messenger, Email hoặc AirDrop.",
                    "<strong>Khôi phục dữ liệu:</strong> Khi đổi sang điện thoại mới, vào Cài đặt > bấm <strong>'Khôi Phục'</strong> và chọn tệp sao lưu cũ để nạp lại dữ liệu trong vài giây.",
                    "<strong>Bản lưu tự động:</strong> Hệ thống tự động ghi nhớ tối đa 10 bản sao lưu gần nhất khi bạn đóng chương trình, giúp bạn yên tâm không lo mất dữ liệu."
                ]
            }
        ]
    },
    en: {
        title: "Comprehensive User Guide & Manual",
        subtitle: "Explore all family healthcare management and Artificial Intelligence capabilities",
        search_placeholder: "Search guide (e.g., smart scan, medication, PIN code...)",
        all_topics: "All",
        sections: [
            {
                id: "i18n",
                icon: "language",
                badge: "New v2.9.94",
                title: "1. Multilingual Support & Instant Switcher",
                desc: "Full support for 4 languages: Vietnamese, English, Japanese, and Chinese.",
                steps: [
                    "<strong>Switch directly from Home screen:</strong> Tap the language selector with the globe icon <code>🌐</code> in the top header.",
                    "<strong>First-run PIN setup screen:</strong> New users can select their preferred language directly on the security setup dialog before creating a PIN.",
                    "<strong>Inside Settings:</strong> Navigate to <em>System Settings</em> > <em>Display Language</em> anytime to switch languages.",
                    "<strong>Automatic AI sync:</strong> When switching to English, Japanese, or Chinese, all AI health evaluations and analyses automatically respond in that language."
                ]
            },
            {
                id: "profile",
                icon: "family_restroom",
                badge: "Core",
                title: "2. Family Members & Medical Profiles",
                desc: "Create and maintain individual medical profiles for every member of your family.",
                steps: [
                    "<strong>Add a new member:</strong> Tap <em>'Add Member'</em> on the dashboard. Enter full name, date of birth, gender, blood group, and medical history or allergies.",
                    "<strong>Automated age calculation:</strong> The application accurately calculates years and months based on the date of birth.",
                    "<strong>View details:</strong> Tap any member's card to access their personal exam records, medication schedules, and health charts.",
                    "<strong>Edit or Delete:</strong> Tap the pencil icon at the top of the profile to update details or remove a profile (PIN confirmation required)."
                ]
            },
            {
                id: "ocr",
                icon: "document_scanner",
                badge: "AI OCR",
                title: "3. AI Smart Scan (Prescriptions & Test Results)",
                desc: "Upload medical photos or PDFs for AI to automatically extract data, fill forms, and suggest schedules.",
                steps: [
                    "In a member's profile, switch to the <em>'Records'</em> tab and tap <strong>'New Record'</strong>.",
                    "In the <strong>'Smart Scan with AI'</strong> area, choose from 3 options:",
                    "• <strong>🖼️ Photo Gallery:</strong> Upload saved medical photos from your phone.<br>• <strong>📷 Direct Camera:</strong> Open your camera to capture clear photos of prescriptions.<br>• <strong>📄 PDF File:</strong> Upload multi-page medical test PDFs (automatically parsed page-by-page).",
                    "Tap <strong>'Process Information'</strong>. In a few seconds, AI extracts the hospital, doctor, exam date, diagnosis, vitals, test parameters, and prescribed medications.",
                    "Review the auto-filled information and tap <strong>'Save Record'</strong>."
                ]
            },
            {
                id: "trend",
                icon: "trending_up",
                badge: "Advanced",
                title: "4. Health Trend Evaluation & Medical PDF Export",
                desc: "AI synthesizes your historical records to detect trends, alert potential risks, and generate PDF reports.",
                steps: [
                    "Tap <strong>'Evaluate Trend'</strong> (sparkle icon) on the Records screen.",
                    "<strong>Automatic history saving:</strong> Generated evaluation reports are automatically preserved in the history list to prevent loss upon navigation.",
                    "<strong>Export PDF:</strong> Tap <em>'Save PDF'</em> to download a professional medical report ready to share with your physician.",
                    "<strong>Section-by-section TTS:</strong> Listen to individual report sections with real-time karaoke text highlighting."
                ]
            },
            {
                id: "medication",
                icon: "alarm",
                badge: "Reminders",
                title: "5. Smart Medication Plans & Loud Alarms",
                desc: "Consolidate prescriptions into a unified schedule with synthesized buzzer alarms and calendar sync.",
                steps: [
                    "Tap <strong>'+ Medication'</strong> or let AI automatically extract schedules from prescription records.",
                    "Medications are organized into 4 dose periods: <strong>Morning - Noon - Afternoon - Evening</strong>. Customize specific hours per schedule.",
                    "<strong>Synthesized Web Audio Buzzer:</strong> Powerful digital buzzer alarm triggers reliably even when offline.",
                    "<strong>Dose tracking:</strong> When an alarm triggers, choose <em>'Taken'</em>, <em>'Snooze 30 mins'</em>, or <em>'Skip'</em>. Tap the plan to review the full attendance grid.",
                    "<strong>Phone calendar sync:</strong> Download RFC 5545 <code>.ics</code> files or open Google Calendar with 1 tap to set native device alarms."
                ]
            },
            {
                id: "china",
                icon: "hub",
                badge: "New v2.9.93",
                title: "6. AI Services in China without VPN",
                desc: "Integrated with DeepSeek and Zhipu AI for high-speed access in China without firewall issues.",
                steps: [
                    "If you are located in China or not using a VPN, open <strong>System Settings</strong>.",
                    "Tap <strong>'Use China AI'</strong> to automatically switch all AI features to DeepSeek and Zhipu AI (GLM-4-Flash 100% free, GLM-4V vision OCR).",
                    "Enter your DeepSeek and Zhipu API Keys into the corresponding fields and tap <strong>'Save Settings'</strong>.",
                    "OCR scanning, trend evaluations, and health consultations will connect smoothly without requiring a VPN."
                ]
            },
            {
                id: "security",
                icon: "lock",
                badge: "Privacy",
                title: "7. PIN Code Security & Offline-First Privacy",
                desc: "Secure health records with a PIN code. All data is kept 100% on your local device.",
                steps: [
                    "<strong>Set up PIN:</strong> Enable a 4-6 digit PIN in <em>System Settings</em> or during first-run setup.",
                    "<strong>Lock screen protection:</strong> When enabled, entering your PIN is required upon launching the app to prevent unauthorized access.",
                    "<strong>Deletion safety check:</strong> Deleting medical records or resetting the application requires PIN authentication.",
                    "<strong>Offline-First Privacy:</strong> All medical records and photos are stored strictly in your browser's local memory (LocalStorage). Private data is never transmitted to cloud servers."
                ]
            },
            {
                id: "backup",
                icon: "cloud_sync",
                badge: "Data",
                title: "8. Backup, Sharing & Data Restoration",
                desc: "Easily backup and transfer your family medical records across devices.",
                steps: [
                    "<strong>Download backup:</strong> In <em>Settings</em>, tap <strong>'Download File'</strong> to save your database as a <code>.json</code> file.",
                    "<strong>Direct sharing:</strong> Tap <strong>'Share'</strong> to send backups via WhatsApp, Messenger, Email, or AirDrop.",
                    "<strong>Restore database:</strong> When setting up a new device, tap <strong>'Restore'</strong> and select your backup file to reload all records in seconds.",
                    "<strong>Automatic snapshots:</strong> The app automatically preserves up to 10 recent revisions when closed."
                ]
            }
        ]
    },
    ja: {
        title: "総合利用ガイド・操作マニュアル",
        subtitle: "家族の健康管理と人工知能（AI）機能を最大限に活用する方法",
        search_placeholder: "ガイドを検索（例：画像スキャン、服薬、暗証番号...）",
        all_topics: "すべて",
        sections: [
            {
                id: "i18n",
                icon: "language",
                badge: "新機能 v2.9.94",
                title: "1. 多言語切り替え（4言語対応）",
                desc: "日本語、英語、ベトナム語、中国語の4言語に完全対応。",
                steps: [
                    "<strong>ホーム画面から即座に切り替え:</strong> 画面上部のヘッダーにある地球儀アイコン <code>🌐</code> からいつでも変更できます。",
                    "<strong>初回暗証番号設定画面:</strong> 初回起動時のセキュリティ設定画面でも、PINを設定する前に言語を選択可能です。",
                    "<strong>設定画面から変更:</strong> <em>システム設定</em> > <em>表示言語</em> からいつでも切り替えられます。",
                    "<strong>AI回答の自動連動:</strong> 言語を日本語に切り替えると、AIによる健康評価やアドバイスもすべて自然な日本語で生成されます。"
                ]
            },
            {
                id: "profile",
                icon: "family_restroom",
                badge: "基本",
                title: "2. 家族メンバー・プロフィール管理",
                desc: "家族一人ひとりの健康プロフィールを独立して作成・管理できます。",
                steps: [
                    "<strong>メンバー追加:</strong> ホーム画面の<em>「メンバー追加」</em>をタップし、氏名、生年月日、性別、血液型、既往歴・アレルギーを入力します。",
                    "<strong>年齢自動計算:</strong> 生年月日から現在の年齢を自動的に計算して表示します。",
                    "<strong>詳細表示:</strong> メンバーのカードをタップすると、個別の受診履歴、服薬予定、健康統計グラフを確認できます。",
                    "<strong>編集・削除:</strong> プロフィール上部の鉛筆アイコンから情報を更新または削除できます（暗証番号の入力が必要）。"
                ]
            },
            {
                id: "ocr",
                icon: "document_scanner",
                badge: "AI OCR",
                title: "3. AIスマートスキャン（処方箋・検査結果の自動読み取り）",
                desc: "医療書類の写真やPDFをアップロードすると、AIが情報を自動抽出して登録します。",
                steps: [
                    "メンバー詳細の<em>「記録」</em>タブを開き、<strong>「新規記録」</strong>をタップします。",
                    "<strong>「AIスマートスキャン」</strong>エリアで3つの入力方法を選択できます:",
                    "• <strong>🖼️ 写真ライブラリ:</strong> 端末に保存されている処方箋や検査結果を選択。<br>• <strong>📷 カメラ撮影:</strong> スマートフォンのカメラを起動して直接書類を撮影。<br>• <strong>📄 PDFファイル:</strong> 複数ページの医療検査結果PDFをアップロード（ページごとに自動解析）。",
                    "<strong>「情報処理」</strong>を押すと数秒で病院名、医師名、受診日、診断、バイタルサイン、検査値、処方薬が自動入力されます。",
                    "入力内容を確認し、<strong>「保存」</strong>をタップします。"
                ]
            },
            {
                id: "trend",
                icon: "trending_up",
                badge: "高度分析",
                title: "4. 健康トレンド評価・医療PDF出力",
                desc: "AIが過去すべての受診履歴を総合分析し、健康リスクの早期発見とPDF出力を行います。",
                steps: [
                    "記録一覧画面の<strong>「トレンド評価」</strong>ボタン（キラキラアイコン）をタップします。",
                    "<strong>履歴自動保存:</strong> 生成された評価レポートは自動的に履歴に保存され、誤って画面を閉じても失われません。",
                    "<strong>PDF出力:</strong> <em>「PDF保存」</em>を押すと、医師への相談に最適な医療レポートPDFがダウンロードされます。",
                    "<strong>セクション別音声読み上げ（TTS）:</strong> 項目ごとに音声で聞くことができ、カラオケ風に読んでいる箇所がハイライトされます。"
                ]
            },
            {
                id: "medication",
                icon: "alarm",
                badge: "アラーム",
                title: "5. スマート服薬管理・大音量アラーム",
                desc: "処方薬を朝・昼・夕・夜にまとめ、確実に通知するアラームとカレンダー同期を提供。",
                steps: [
                    "<strong>「+ 服薬」</strong>をタップするか、AI処方箋読み取りから自動で服薬スケジュールを作成します。",
                    "処方薬は1つの計画にまとめられ、<strong>朝・昼・夕・夜</strong>に自動分類されます。時間帯は自由にカスタマイズ可能です。",
                    "<strong>Web Audio電子ブザーアラーム:</strong> インターネット接続がないオフライン環境でも大音量で確実に鳴動します。",
                    "<strong>服用チェック:</strong> アラーム時に<em>「服用完了」</em>、<em>「30分後再通知」</em>、<em>「スキップ」</em>を選択可能。達成度カレンダーで確認できます。",
                    "<strong>スマホカレンダー同期:</strong> RFC 5545 <code>.ics</code> ファイルのダウンロードまたはGoogleカレンダーにワンタップで予定を追加できます。"
                ]
            },
            {
                id: "china",
                icon: "hub",
                badge: "新機能 v2.9.93",
                title: "6. 中国国内でのAI利用（VPN不要）",
                desc: "中国国内からVPNなしで直結できるDeepSeekとZhipu AI（智譜AI）を標準統合。",
                steps: [
                    "中国国内からのアクセス、またはVPNを使用しない場合は、<strong>システム設定</strong>を開きます。",
                    "<strong>「中国AIを使用」</strong>ボタンを押すと、すべてのAI機能がDeepSeekおよびZhipu AI（GLM-4-Flash完全無料、GLM-4V画像認識）に自動設定されます。",
                    "APIキーを入力して<strong>「設定を保存」</strong>を押します。",
                    "OCRスキャン、トレンド評価、AI相談が中国国内から快適かつ高速に利用できます。"
                ]
            },
            {
                id: "security",
                icon: "lock",
                badge: "プライバシー",
                title: "7. 暗証番号セキュリティ＆完全ローカル保存",
                desc: "暗証番号でデータを保護。医療情報はすべて端末内に保存され外部には送信されません。",
                steps: [
                    "<strong>暗証番号設定:</strong> <em>システム設定</em>または初回起動画面で4〜6桁の暗証番号を設定します。",
                    "<strong>画面ロック:</strong> PINロックを有効にすると、アプリ起動時に暗証番号が要求されプライバシーが守られます。",
                    "<strong>重要操作の保護:</strong> データの削除や初期化を行う際は、必ず暗証番号の確認が求められます。",
                    "<strong>オフラインファースト設計:</strong> すべての受診データや写真は端末内（LocalStorage）のみに保存され、第三者のサーバーに送信されることはありません。"
                ]
            },
            {
                id: "backup",
                icon: "cloud_sync",
                badge: "データ",
                title: "8. データのバックアップ・共有・復元",
                desc: "安心のデータ保存と機種変更時の簡単なデータ移行。",
                steps: [
                    "<strong>バックアップダウンロード:</strong> <em>設定</em> > <strong>「ファイル保存」</strong>から全データを <code>.json</code> ファイルとして書き出します。",
                    "<strong>直接共有:</strong> <strong>「共有」</strong>を押してメール、LINE、AirDropなどでバックアップファイルを送信できます。",
                    "<strong>データ復元:</strong> 新しいスマートフォンで<strong>「復元」</strong>を押し、保存したファイルを選択するだけで即座に全データが復元されます。",
                    "<strong>自動履歴保存:</strong> アプリ終了時に最大10件の自動バックアップが保持されます。"
                ]
            }
        ]
    },
    zh: {
        title: "全方位使用指南与操作手册",
        subtitle: "全面掌握家庭健康档案管理与人工智能（AI）实用功能",
        search_placeholder: "搜索使用指南（例如：扫描识图、用药提醒、PIN密码...）",
        all_topics: "全部",
        sections: [
            {
                id: "i18n",
                icon: "language",
                badge: "新版本 v2.9.94",
                title: "1. 多语言即时切换（支持4国语言）",
                desc: "全面支持简体中文、英语（English）、日语（日本語）和越南语（Tiếng Việt）。",
                steps: [
                    "<strong>首页直接切换：</strong> 点击首页顶部标题栏右侧的地球仪图标 <code>🌐</code> 即可随时一键切换语言。",
                    "<strong>首次PIN密码设置界面：</strong> 新用户在首次启动创建安全密码前，可直接在弹窗顶部选择首选语言。",
                    "<strong>在设置中调整：</strong> 进入<em>系统设置</em> > <em>显示语言</em>随时更改。",
                    "<strong>AI智能响应同步：</strong> 语言切换为中文后，AI健康评估、处方解析和咨询答复均会自动使用中文生成。"
                ]
            },
            {
                id: "profile",
                icon: "family_restroom",
                badge: "核心",
                title: "2. 家庭成员与健康档案管理",
                desc: "为每位家庭成员创建独立的医疗健康档案，全面追踪健康数据。",
                steps: [
                    "<strong>添加新成员：</strong> 在首页点击<em>“添加成员”</em>，输入姓名、出生日期、性别、血型、既往病史及药物过敏史。",
                    "<strong>智能年龄计算：</strong> 系统根据出生日期自动精准推算实际周岁与月龄。",
                    "<strong>查看专属详情：</strong> 点击任意成员卡片进入其个人就医历史、用药日历和健康图表统计。",
                    "<strong>编辑与删除：</strong> 点击成员主页上方的铅笔图标可修改资料或删除档案（需要验证PIN密码）。"
                ]
            },
            {
                id: "ocr",
                icon: "document_scanner",
                badge: "AI识图",
                title: "3. AI智能扫描识别（处方与化验单OCR）",
                desc: "上传病历照片或PDF文档，AI自动提取关键信息并生成结构化表单。",
                steps: [
                    "在成员详情中切换至<em>“就医档案”</em>标签，点击<strong>“新建档案”</strong>。",
                    "在<strong>“AI智能扫描识别”</strong>区域提供3种便捷录入方式：",
                    "• <strong>🖼️ 图片图库：</strong> 选取手机中已拍摄保存的化验单或处方照片。<br>• <strong>📷 即时拍照：</strong> 启动手机高清相机直接拍摄纸质报告。<br>• <strong>📄 PDF文档：</strong> 上传多页PDF格式的体检报告（系统自动分页处理供AI阅读）。",
                    "点击<strong>“处理信息”</strong>按钮，AI在数秒内自动提取医院、医生、日期、诊断结果、生命体征及用药清单。",
                    "核对信息无误后，点击底部的<strong>“保存档案”</strong>。"
                ]
            },
            {
                id: "trend",
                icon: "trending_up",
                badge: "深度分析",
                title: "4. 健康趋势评估与医疗PDF导出",
                desc: "AI综合分析历次就医记录，评估病情演进走向，出具PDF报告。",
                steps: [
                    "在就医档案页面点击<strong>“评估趋势”</strong>（带有星光图标的按钮）。",
                    "<strong>历史自动保存：</strong> 生成的评估报告会自动归档到历史记录中，防止误触返回导致内容丢失。",
                    "<strong>导出PDF报告：</strong> 点击<em>“保存PDF”</em>下载规范排版的医疗分析报告，方便就诊时向医师出示。",
                    "<strong>分段语音朗读（TTS）：</strong> 支持按段落播放语音并带有卡拉OK式高亮跟读效果。"
                ]
            },
            {
                id: "medication",
                icon: "alarm",
                badge: "用药闹钟",
                title: "5. 智能服药计划与响亮蜂鸣闹钟",
                desc: "归拢多份处方形成统一日程，配备离线大音量闹钟并支持同步至手机日历。",
                steps: [
                    "点击<strong>“+ 用药”</strong>或通过AI处方自动提炼生成用药计划。",
                    "所有药品归整至同一个日程，划分为<strong>早、中、晚、睡前</strong>四个服药时段，支持按需自定义时间点。",
                    "<strong>Web Audio数字蜂鸣闹钟：</strong> 即使在离线无网络状态下，也能准时发出清晰响亮的蜂鸣提示。",
                    "<strong>服药打卡记录：</strong> 闹钟响起时可快捷选择<em>“已服药”</em>、<em>“30分钟后提醒”</em>或<em>“跳过”</em>，可随时查看依从性打卡日历。",
                    "<strong>手机系统日历同步：</strong> 导出符合RFC 5545标准的 <code>.ics</code> 日历文件，或一键调起Google日历设置系统级闹钟。"
                ]
            },
            {
                id: "china",
                icon: "hub",
                badge: "新版本 v2.9.93",
                title: "6. 中国大陆免VPN直联AI服务",
                desc: "内置深度求索DeepSeek与智谱AI，国内直连畅通无阻，无需翻墙加速器。",
                steps: [
                    "若您在中国大陆使用或未连接VPN网络，请打开<strong>系统设置</strong>。",
                    "点击<strong>“使用中国AI”</strong>快捷按钮，系统自动将全局AI配置切换至DeepSeek和智谱AI（GLM-4-Flash完全免费，GLM-4V视觉识图）。",
                    "输入您的DeepSeek和智谱API密钥后，点击<strong>“保存设置”</strong>。",
                    "OCR扫描、趋势分析与AI健康问答均可实现国内高速直连。"
                ]
            },
            {
                id: "security",
                icon: "lock",
                badge: "安全隐私",
                title: "7. PIN码安全锁与完全本地化隐私",
                desc: "PIN密码保护病历隐私，所有健康数据100%保存在用户设备本地。",
                steps: [
                    "<strong>设置PIN码：</strong> 在<em>系统设置</em>或首次启动界面中启用4-6位数字安全密码。",
                    "<strong>锁屏防窥保护：</strong> 启用后每次重新打开应用均需输入密码，有效防止他人借用手机时窥见隐私。",
                    "<strong>高危操作二次验证：</strong> 删除就医档案或恢复出厂设置时强制要求输入PIN密码确认。",
                    "<strong>离线优先（Offline-First）：</strong> 所有病历照片、健康记录均保存在手机本地内存（LocalStorage），绝不上传至任何第三方云端服务器。"
                ]
            },
            {
                id: "backup",
                icon: "cloud_sync",
                badge: "数据归档",
                title: "8. 数据备份、分享与一键还原",
                desc: "安全可靠的数据归档方案，轻松实现跨设备与更换新手机时的数据迁移。",
                steps: [
                    "<strong>下载本地备份：</strong> 进入<em>系统设置</em> > 点击<strong>“下载文件”</strong>，将全部档案导出为标准的 <code>.json</code> 格式文件。",
                    "<strong>快捷分享备份：</strong> 点击<strong>“分享”</strong>直接通过微信、QQ、邮件或AirDrop发送备份文件。",
                    "<strong>一键恢复数据：</strong> 更换新手机时，在新设备打开应用进入设置点击<strong>“恢复”</strong>，选择旧备份文件即可瞬间还原全部档案。",
                    "<strong>智能快照保护：</strong> 每次关闭应用时，系统自动安全轮换保存最近10份历史快照。"
                ]
            }
        ]
    }
};

const HelpService = {
    isHelpModeActive: false,
    currentFilter: 'all',

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

            if (e.target.closest('#btn-help') || e.target.closest('#btn-help-mobile') || e.target.closest('#help-info-panel') || e.target.closest('.btn-workflow-guide') || e.target.closest('#btn-ai-help-chat') || e.target.closest('.modal-overlay')) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            const helpEl = e.target.closest('[data-help-title]');
            if (helpEl) {
                document.querySelectorAll('.help-highlight-active').forEach(el => el.classList.remove('help-highlight-active'));
                helpEl.classList.add('help-highlight-active');
                const title = helpEl.getAttribute('data-help-title');
                const desc = helpEl.getAttribute('data-help-desc');
                this.updateInfoPanel(title, desc);
            }
        }, true);

        document.body.addEventListener('click', (e) => {
            if (e.target.closest('.btn-workflow-guide')) {
                this.showWorkflowGuide();
            }
        });

        if (this.btnAiHelp) {
            this.btnAiHelp.addEventListener('click', () => {
                this.showAiHelpChat();
            });
        }

        const btnOpenWorkflowFromChat = document.getElementById('btn-open-workflow-from-chat');
        if (btnOpenWorkflowFromChat) {
            btnOpenWorkflowFromChat.addEventListener('click', () => {
                if (this.modalAiHelp) this.modalAiHelp.classList.add('hidden');
                this.showWorkflowGuide();
            });
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

        // Guide Language Selector
        const guideLangSelect = document.getElementById('guide-language-select');
        if (guideLangSelect) {
            guideLangSelect.addEventListener('change', (e) => {
                const lang = e.target.value;
                if (typeof I18n !== 'undefined' && I18n.setLanguage) {
                    I18n.setLanguage(lang);
                }
                this.renderWorkflowGuide(lang);
            });
        }
    },

    toggleHelpMode() {
        this.isHelpModeActive = !this.isHelpModeActive;

        if (this.isHelpModeActive) {
            document.body.classList.add('help-mode-active');
            this.createInfoPanel();
        } else {
            document.body.classList.remove('help-mode-active');
            this.removeInfoPanel();
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
                        <span class="material-symbols-rounded" style="font-size: 18px;">menu_book</span> Xem Cẩm nang Sử dụng
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
                this.toggleHelpMode();
                this.showWorkflowGuide();
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

    showWorkflowGuide(targetLang = null) {
        let lang = targetLang;
        if (!lang) {
            lang = (typeof I18n !== 'undefined' && I18n.currentLang) ? I18n.currentLang : (typeof DataManager !== 'undefined' && DataManager.getLanguage ? DataManager.getLanguage() : 'vi');
        }
        if (!GUIDE_DATA[lang]) lang = 'vi';

        // Sync guide language dropdown
        const select = document.getElementById('guide-language-select');
        if (select && select.value !== lang) {
            select.value = lang;
        }

        this.renderWorkflowGuide(lang);
        if (this.modalWorkflow) this.modalWorkflow.classList.remove('hidden');
    },

    renderWorkflowGuide(lang = 'vi', filter = 'all') {
        const guide = GUIDE_DATA[lang] || GUIDE_DATA['vi'];
        const container = document.getElementById('workflow-guide-content');
        if (!container) return;

        this.currentFilter = filter;

        // Render topic category pills
        const pillsHtml = `
            <div class="guide-pills-bar" style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 12px; margin-bottom: 15px; -webkit-overflow-scrolling: touch;">
                <button type="button" class="guide-pill-btn ${filter === 'all' ? 'active' : ''}" data-filter="all" style="white-space: nowrap; padding: 6px 14px; border-radius: 20px; border: 1px solid rgba(0,0,0,0.1); background: ${filter === 'all' ? 'var(--primary-blue, #2980b9)' : '#f8f9fa'}; color: ${filter === 'all' ? 'white' : 'var(--text-color, #333)'}; font-size: 13px; font-weight: 500; cursor: pointer;">
                    ${guide.all_topics}
                </button>
                ${guide.sections.map(s => `
                    <button type="button" class="guide-pill-btn ${filter === s.id ? 'active' : ''}" data-filter="${s.id}" style="white-space: nowrap; padding: 6px 12px; border-radius: 20px; border: 1px solid rgba(0,0,0,0.1); background: ${filter === s.id ? 'var(--primary-blue, #2980b9)' : '#f8f9fa'}; color: ${filter === s.id ? 'white' : 'var(--text-color, #333)'}; font-size: 13px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                        <span class="material-symbols-rounded" style="font-size: 16px;">${s.icon}</span> ${s.title.split('. ')[1] || s.title}
                    </button>
                `).join('')}
            </div>
        `;

        // Filter sections
        const filteredSections = filter === 'all' 
            ? guide.sections 
            : guide.sections.filter(s => s.id === filter);

        const sectionsHtml = filteredSections.map((s) => `
            <div class="guide-card neumorphic-card" style="margin-bottom: 16px; padding: 16px 18px; border-radius: 14px; border-left: 4px solid var(--primary-blue, #2980b9); background: var(--bg-card, #ffffff);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <h4 style="margin: 0; color: var(--primary-blue, #2980b9); font-size: 15.5px; display: flex; align-items: center; gap: 8px;">
                        <span class="material-symbols-rounded" style="font-size: 20px; color: var(--primary-blue, #2980b9);">${s.icon}</span>
                        ${s.title}
                    </h4>
                    <span style="font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px; background: rgba(41, 128, 185, 0.1); color: var(--primary-blue, #2980b9);">${s.badge}</span>
                </div>
                <p style="font-size: 13.5px; color: var(--text-muted, #7f8c8d); margin: 0 0 12px 0; line-height: 1.45;">${s.desc}</p>
                <div style="background: rgba(0,0,0,0.02); border-radius: 10px; padding: 12px 14px; border: 1px solid rgba(0,0,0,0.04);">
                    <ol style="margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.6; color: var(--text-color, #2c3e50);">
                        ${s.steps.map(step => `<li style="margin-bottom: 6px;">${step}</li>`).join('')}
                    </ol>
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div style="padding: 0 4px;">
                <p style="font-size: 13px; color: var(--text-muted, #7f8c8d); margin: 0 0 14px 0;">${guide.subtitle}</p>
                ${pillsHtml}
                <div class="guide-cards-list">
                    ${sectionsHtml}
                </div>
            </div>
        `;

        // Attach event listeners to pills
        container.querySelectorAll('.guide-pill-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetFilter = e.currentTarget.dataset.filter;
                this.renderWorkflowGuide(lang, targetFilter);
            });
        });
    },

    showAiHelpChat() {
        if (this.modalAiHelp) this.modalAiHelp.classList.remove('hidden');
    },

    async sendAiHelpMessage() {
        const input = document.getElementById('input-ai-help-chat');
        const chatMessages = document.getElementById('ai-help-chat-messages') || document.getElementById('ai-help-messages');
        const text = input ? input.value.trim() : '';
        if (!text || !chatMessages) return;

        // User message
        const userMsg = document.createElement('div');
        userMsg.className = 'chat-message user-message';
        userMsg.style.cssText = 'align-self: flex-end; max-width: 85%; background: linear-gradient(135deg, #9b59b6, #8e44ad); color: white; padding: 12px 16px; border-radius: 15px 15px 0 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); font-size: 14px; line-height: 1.5;';
        userMsg.textContent = text;
        chatMessages.appendChild(userMsg);

        input.value = '';
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Loading message
        const aiMsg = document.createElement('div');
        aiMsg.className = 'chat-message assistant-message';
        aiMsg.style.cssText = 'align-self: flex-start; max-width: 85%; background: white; padding: 12px 16px; border-radius: 15px 15px 15px 0; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border: 1px solid rgba(0,0,0,0.05); font-size: 14px; line-height: 1.5;';
        aiMsg.innerHTML = `
            <div style="font-size: 12px; color: #9b59b6; font-weight: bold; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                <span class="material-symbols-rounded" style="font-size: 14px;">smart_toy</span> AI Assistant
            </div>
            <div style="display: flex; align-items: center; gap: 6px; color: #7f8c8d;">
                <span class="material-symbols-rounded ai-sparkle" style="font-size: 16px;">sync</span> ${(typeof I18n !== 'undefined' ? I18n.t('ai_thinking', 'AI đang trả lời...') : 'AI đang trả lời...')}
            </div>
        `;
        chatMessages.appendChild(aiMsg);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        try {
            let responseText = '';
            if (typeof AIService !== 'undefined' && AIService.askHelpAssistant) {
                responseText = await AIService.askHelpAssistant(text);
            } else {
                responseText = 'Vui lòng cấu hình API Key trong mục Cài đặt để sử dụng Trợ lý AI.';
            }

            const formattedHtml = (typeof marked !== 'undefined') 
                ? (typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(marked.parse(responseText)) : marked.parse(responseText))
                : responseText.replace(/\n/g, '<br>');

            aiMsg.innerHTML = `
                <div style="font-size: 12px; color: #9b59b6; font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
                    <span class="material-symbols-rounded" style="font-size: 14px;">smart_toy</span> AI Assistant
                </div>
                <div class="ai-response-content" style="font-size: 13.5px; line-height: 1.55; color: var(--text-color, #2c3e50);">
                    ${formattedHtml}
                </div>
            `;
        } catch (e) {
            aiMsg.innerHTML = `
                <div style="font-size: 12px; color: #e74c3c; font-weight: bold; margin-bottom: 4px;">Lỗi kết nối AI</div>
                <div style="font-size: 13px; color: #c0392b;">${e.message || 'Không thể kết nối máy chủ AI. Vui lòng kiểm tra lại API Key trong phần Cài đặt.'}</div>
            `;
        }
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
};

if (typeof window !== 'undefined') {
    window.HelpService = HelpService;
    window.GUIDE_DATA = GUIDE_DATA;
    document.addEventListener('DOMContentLoaded', () => {
        HelpService.init();
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HelpService, GUIDE_DATA };
}
