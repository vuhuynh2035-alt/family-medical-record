/**
 * i18n.js — Quản lý Đa ngôn ngữ (Multilingual Localization)
 * Hỗ trợ 4 ngôn ngữ: Tiếng Việt (vi), English (en), 日本語 (ja), 中文 (zh)
 */

const TRANSLATIONS = {
    "vi": {
        "app_title": "Health Care",
        "app_subtitle": "Hồ sơ Sức khỏe Gia đình",
        "nav_dashboard": "Trang chủ",
        "nav_back": "Quay lại",
        "btn_close": "Đóng",
        "btn_save": "Lưu",
        "btn_cancel": "Hủy",
        "btn_delete": "Xóa",
        "btn_edit": "Sửa",
        "btn_search": "Tìm kiếm",
        "btn_all": "Tất cả",
        "loading": "Đang tải...",
        "btn_add": "Thêm mới",
        "header_notifications": "Thông báo hệ thống",
        "header_help": "Trợ giúp & Hướng dẫn",
        "header_settings": "Cài đặt",
        "header_exit": "Đóng chương trình",
        "settings_title": "Cài đặt Hệ thống",
        "settings_language": "Ngôn ngữ hiển thị",
        "settings_language_desc": "Chọn ngôn ngữ hiển thị của ứng dụng (Anh / Nhật / Trung / Việt)",
        "settings_backup_restore": "Sao Lưu & Khôi Phục Dữ Liệu",
        "settings_backup_desc": "Lưu trữ toàn bộ hồ sơ y tế thành một file dự phòng, hoặc khôi phục dữ liệu từ file.",
        "settings_download_file": "Tải File",
        "settings_share": "Chia sẻ",
        "settings_restore": "Khôi Phục",
        "settings_auto_backups": "Bản lưu tự động",
        "settings_pin_security": "Bảo mật & Mã PIN",
        "settings_pin_desc": "Bảo vệ thông tin sức khỏe gia đình bằng mã khóa bảo mật.",
        "settings_change_pin": "Đổi mã PIN",
        "settings_enable_pin": "Bật khóa PIN",
        "settings_disable_pin": "Tắt khóa PIN",
        "settings_ai_config": "Cấu hình Trí tuệ Nhân tạo (AI)",
        "settings_factory_reset": "Khôi phục Cài đặt gốc",
        "settings_factory_reset_desc": "Xóa sạch toàn bộ hồ sơ y tế, thành viên và hình ảnh trên thiết bị này. Các cài đặt API Key sẽ được giữ lại. (Cần mã PIN để xác nhận).",
        "settings_btn_wipe": "Xóa sạch Dữ liệu Y tế",
        "settings_save_btn": "Lưu cài đặt",
        "china_notice_title": "Bạn đang ở Trung Quốc (hoặc không dùng VPN)?",
        "china_notice_desc": "Bấm nút bên cạnh để tự động chuyển tất cả các mục AI sang DeepSeek & Zhipu AI (GLM) không bị chặn mạng.",
        "china_btn_activate": "Dùng AI TQ",
        "search_member_placeholder": "Tìm kiếm theo tên, năm sinh...",
        "btn_add_member": "Thêm thành viên",
        "no_members": "Chưa có thành viên nào. Hãy thêm thành viên đầu tiên!",
        "member_age_suffix": "tuổi",
        "member_blood": "Nhóm máu",
        "member_conditions": "Bệnh nền",
        "tab_reminders": "Lịch hẹn",
        "tab_records": "Hồ sơ",
        "tab_info": "Thông tin",
        "tab_stats": "Thống kê",
        "btn_add_appointment": "+ Khám bệnh",
        "btn_add_medication": "+ Uống thuốc",
        "reminder_time_title": "Khung giờ uống thuốc của Lịch này",
        "med_morning": "Sáng",
        "med_noon": "Trưa",
        "med_afternoon": "Chiều",
        "med_evening": "Tối",
        "med_btn_taken": "Đã uống",
        "med_btn_snooze": "Nhắc lại sau 30 phút",
        "med_btn_skip": "Bỏ qua",
        "med_btn_edit": "Sửa lịch",
        "med_btn_delete": "Xóa lịch",
        "med_taken_done": "Đã uống cữ này",
        "med_detail_title": "Chi tiết Lịch uống thuốc",
        "med_usage_instructions": "Cách dùng & Công dụng",
        "med_contraindications": "Lưu ý / Chống chỉ định",
        "med_add_item": "+ Thêm thuốc",
        "no_reminders": "Chưa có lịch nhắc nhở nào.",
        "search_record_placeholder": "Tìm theo bệnh viện, bác sĩ, bệnh, thuốc...",
        "btn_add_record": "Thêm Lượt Khám",
        "btn_evaluate_trend": "Đánh giá xu hướng",
        "btn_smart_scan": "Quét thông minh bằng AI",
        "ocr_desc": "Tải lên hình ảnh phiếu kết quả/đơn thuốc để AI tự động điền thông tin và tạo báo cáo đánh giá.",
        "btn_gallery": "Thư viện ảnh",
        "btn_camera": "Chụp ảnh",
        "btn_pdf": "Tệp PDF",
        "btn_process_info": "Xử lý thông tin",
        "no_records": "Chưa có hồ sơ khám bệnh nào.",
        "record_exam_date": "Ngày khám",
        "record_hospital": "Bệnh viện/Phòng khám",
        "record_doctor": "Bác sĩ",
        "record_cost": "Chi phí",
        "record_disease": "Chẩn đoán bệnh",
        "record_symptoms": "Triệu chứng",
        "record_treatment": "Phương án điều trị / Đơn thuốc",
        "record_note": "Lời dặn / Ghi chú",
        "record_vitals": "Sinh hiệu",
        "record_btn_ai_eval": "Phân tích AI",
        "record_btn_search": "Tra cứu",
        "record_btn_chat": "Trao đổi chuyên sâu",
        "record_btn_images": "Xem ảnh",
        "stat_total_visits": "Số lần đi khám",
        "stat_total_cost": "Tổng chi phí y tế",
        "stat_chart_title": "Thống kê theo loại khám",
        "stat_no_data": "Chưa có dữ liệu thống kê.",
        "type_routine": "Khám sức khỏe tổng quát",
        "type_mild": "Bệnh lý cấp tính (Nhẹ)",
        "type_severe": "Bệnh lý cấp tính (Nặng/Cấp cứu)",
        "type_chronic": "Bệnh lý mạn tính",
        "type_prenatal": "Khám thai",
        "type_vaccine": "Tiêm chủng",
        "type_dental": "Nha khoa",
        "type_uncategorized": "Chưa phân loại",
        "modal_add_member_title": "Thêm thành viên mới",
        "modal_edit_member_title": "Chỉnh sửa thành viên",
        "modal_member_name": "Họ và tên *",
        "modal_member_gender": "Giới tính *",
        "modal_member_dob": "Ngày sinh *",
        "modal_member_blood": "Nhóm máu",
        "modal_member_relationship": "Mối quan hệ",
        "modal_member_conditions": "Tiền sử bệnh lý / Dị ứng",
        "lock_title": "Nhập mã PIN",
        "lock_enter_pin": "Nhập mã PIN để mở khóa",
        "lock_btn_unlock": "Mở khóa",
        "lock_forgot_pin": "Quên mã PIN? (Xóa toàn bộ dữ liệu)",
        "toast_lang_changed": "Đã chuyển ngôn ngữ sang Tiếng Việt",
        "toast_saved": "Đã lưu thành công!",
        "toast_deleted": "Đã xóa thành công!",
        "dashboard_family_members": "Thành viên gia đình",
        "dashboard_subtitle": "Quản lý hồ sơ sức khỏe",
        "forced_pin_title": "Bảo mật dữ liệu",
        "forced_pin_desc": "Để đảm bảo an toàn cho dữ liệu y tế, vui lòng tạo mã PIN (từ 4-6 số). Mã này được dùng để mở ứng dụng và xác nhận khi xoá dữ liệu.",
        "forced_pin_label": "Mã PIN (4-6 chữ số)",
        "forced_pin_confirm_label": "Xác nhận lại mã PIN",
        "forced_pin_submit": "Tạo mã PIN",
        "lock_desc": "Hồ sơ sức khỏe gia đình đã được khóa để bảo vệ riêng tư.",
        "lock_placeholder": "••••",
        "lock_error": "Mã PIN không đúng, vui lòng thử lại.",
        "confirm_exit_title": "Đóng chương trình",
        "confirm_exit_msg": "Bạn có chắc chắn muốn đóng chương trình không?",
        "btn_agree": "Đồng ý",
        "member_age": "Số tuổi",
        "record_diagnosis": "Chẩn đoán",
        "no_diagnosis_yet": "Chưa có kết luận chẩn đoán",
        "select_language": "Ngôn ngữ"
    },
    "en": {
        "app_title": "Health Care",
        "app_subtitle": "Family Health Record",
        "nav_dashboard": "Dashboard",
        "nav_back": "Back",
        "btn_close": "Close",
        "btn_save": "Save",
        "btn_cancel": "Cancel",
        "btn_delete": "Delete",
        "btn_edit": "Edit",
        "btn_search": "Search",
        "btn_all": "All",
        "loading": "Loading...",
        "btn_add": "Add New",
        "header_notifications": "System Notifications",
        "header_help": "Help & Guide",
        "header_settings": "Settings",
        "header_exit": "Exit App",
        "settings_title": "System Settings",
        "settings_language": "Display Language",
        "settings_language_desc": "Choose app language (English / Japanese / Chinese / Vietnamese)",
        "settings_backup_restore": "Backup & Restore Data",
        "settings_backup_desc": "Save all medical records as a backup file, or restore from a file.",
        "settings_download_file": "Download File",
        "settings_share": "Share",
        "settings_restore": "Restore",
        "settings_auto_backups": "Auto Backups",
        "settings_pin_security": "Security & PIN Code",
        "settings_pin_desc": "Protect family health records with a security passcode.",
        "settings_change_pin": "Change PIN",
        "settings_enable_pin": "Enable PIN Lock",
        "settings_disable_pin": "Disable PIN Lock",
        "settings_ai_config": "Artificial Intelligence (AI) Configuration",
        "settings_factory_reset": "Factory Reset",
        "settings_factory_reset_desc": "Erase all health records, members and photos on this device. API key settings will be preserved. (PIN required).",
        "settings_btn_wipe": "Erase All Medical Data",
        "settings_save_btn": "Save Settings",
        "china_notice_title": "Are you in China (or without VPN)?",
        "china_notice_desc": "Click the button to automatically switch all AI tasks to DeepSeek & Zhipu AI (GLM) for unblocked access.",
        "china_btn_activate": "Use China AI",
        "search_member_placeholder": "Search by name, birth year...",
        "btn_add_member": "Add Member",
        "no_members": "No members yet. Add your first family member!",
        "member_age_suffix": "years old",
        "member_blood": "Blood Type",
        "member_conditions": "Conditions",
        "tab_reminders": "Reminders",
        "tab_records": "Records",
        "tab_info": "Profile",
        "tab_stats": "Statistics",
        "btn_add_appointment": "+ Appointment",
        "btn_add_medication": "+ Medication",
        "reminder_time_title": "Medication Time Slots for This Plan",
        "med_morning": "Morning",
        "med_noon": "Noon",
        "med_afternoon": "Afternoon",
        "med_evening": "Evening",
        "med_btn_taken": "Taken",
        "med_btn_snooze": "Snooze 30 mins",
        "med_btn_skip": "Skip",
        "med_btn_edit": "Edit Plan",
        "med_btn_delete": "Delete Plan",
        "med_taken_done": "Already taken this dose",
        "med_detail_title": "Medication Plan Details",
        "med_usage_instructions": "Usage & Indication",
        "med_contraindications": "Precautions / Contraindications",
        "med_add_item": "+ Add Medication",
        "no_reminders": "No reminders scheduled yet.",
        "search_record_placeholder": "Search by hospital, doctor, disease, medicine...",
        "btn_add_record": "Add Record",
        "btn_evaluate_trend": "Health Trend",
        "btn_smart_scan": "AI Smart Scan",
        "ocr_desc": "Upload photos of exam reports/prescriptions for AI to autofill and generate health assessments.",
        "btn_gallery": "Photo Gallery",
        "btn_camera": "Take Photo",
        "btn_pdf": "PDF File",
        "btn_process_info": "Process Information",
        "no_records": "No medical records yet.",
        "record_exam_date": "Exam Date",
        "record_hospital": "Hospital / Clinic",
        "record_doctor": "Doctor",
        "record_cost": "Cost",
        "record_disease": "Diagnosis",
        "record_symptoms": "Symptoms",
        "record_treatment": "Treatment / Prescription",
        "record_note": "Doctor's Advice / Notes",
        "record_vitals": "Vital Signs",
        "record_btn_ai_eval": "AI Analysis",
        "record_btn_search": "Search Info",
        "record_btn_chat": "Ask AI",
        "record_btn_images": "View Attachments",
        "stat_total_visits": "Total Visits",
        "stat_total_cost": "Total Expenses",
        "stat_chart_title": "Statistics by Visit Type",
        "stat_no_data": "No statistical data available.",
        "type_routine": "General Health Checkup",
        "type_mild": "Acute Condition (Mild)",
        "type_severe": "Acute Condition (Severe)",
        "type_chronic": "Chronic Condition",
        "type_prenatal": "Prenatal Care",
        "type_vaccine": "Vaccination",
        "type_dental": "Dental",
        "type_uncategorized": "Uncategorized",
        "modal_add_member_title": "Add New Member",
        "modal_edit_member_title": "Edit Member",
        "modal_member_name": "Full Name *",
        "modal_member_gender": "Gender *",
        "modal_member_dob": "Date of Birth *",
        "modal_member_blood": "Blood Type",
        "modal_member_relationship": "Relationship",
        "modal_member_conditions": "Medical History / Allergies",
        "lock_title": "Enter PIN",
        "lock_enter_pin": "Enter PIN to unlock",
        "lock_btn_unlock": "Unlock",
        "lock_forgot_pin": "Forgot PIN? (Wipe all data)",
        "toast_lang_changed": "Language switched to English",
        "toast_saved": "Saved successfully!",
        "toast_deleted": "Deleted successfully!",
        "dashboard_family_members": "Family Members",
        "dashboard_subtitle": "Health Records Management",
        "forced_pin_title": "Security Setup",
        "forced_pin_desc": "To protect your medical privacy, please create a 4-6 digit PIN. This PIN is used to unlock the app and confirm data deletion.",
        "forced_pin_label": "PIN Code (4-6 digits)",
        "forced_pin_confirm_label": "Confirm PIN Code",
        "forced_pin_submit": "Create PIN",
        "lock_desc": "Family health records are locked for privacy.",
        "lock_placeholder": "••••",
        "lock_error": "Incorrect PIN, please try again.",
        "confirm_exit_title": "Exit App",
        "confirm_exit_msg": "Are you sure you want to exit the application?",
        "btn_agree": "Yes",
        "member_age": "Age",
        "record_diagnosis": "Diagnosis",
        "no_diagnosis_yet": "No diagnosis yet",
        "select_language": "Language"
    },
    "ja": {
        "app_title": "Health Care",
        "app_subtitle": "家族の健康手帳",
        "nav_dashboard": "ホーム",
        "nav_back": "戻る",
        "btn_close": "閉じる",
        "btn_save": "保存",
        "btn_cancel": "キャンセル",
        "btn_delete": "削除",
        "btn_edit": "編集",
        "btn_search": "検索",
        "btn_all": "すべて",
        "loading": "読み込み中...",
        "btn_add": "新規追加",
        "header_notifications": "システム通知",
        "header_help": "ヘルプ・ガイド",
        "header_settings": "設定",
        "header_exit": "アプリ終了",
        "settings_title": "システム設定",
        "settings_language": "表示言語",
        "settings_language_desc": "アプリの表示言語（英語・日本語・中国語・ベトナム語）",
        "settings_backup_restore": "データのバックアップと復元",
        "settings_backup_desc": "すべてのカルテをバックアップファイルとして保存、またはファイルから復元します。",
        "settings_download_file": "ファイル保存",
        "settings_share": "共有",
        "settings_restore": "復元",
        "settings_auto_backups": "自動バックアップ履歴",
        "settings_pin_security": "セキュリティと暗証番号",
        "settings_pin_desc": "暗証番号（PIN）で大切な家族の健康記録を保護します。",
        "settings_change_pin": "暗証番号を変更",
        "settings_enable_pin": "暗証番号ロックを有効化",
        "settings_disable_pin": "暗証番号ロックを無効化",
        "settings_ai_config": "人工知能（AI）の設定",
        "settings_factory_reset": "初期化（データ全削除）",
        "settings_factory_reset_desc": "端末内のすべての医療記録、メンバー、写真を消去します。APIキーの設定は保持されます。（暗証番号が必要）。",
        "settings_btn_wipe": "すべての医療データを消去",
        "settings_save_btn": "設定を保存",
        "china_notice_title": "中国国内でご利用（またはVPNなし）ですか？",
        "china_notice_desc": "ボタンを押すと、すべてのAI機能をDeepSeekおよび智譜AI（GLM）に自動設定し、安定して利用できます。",
        "china_btn_activate": "中国AIを使用",
        "search_member_placeholder": "氏名や生年で検索...",
        "btn_add_member": "メンバー追加",
        "no_members": "メンバーがまだ登録されていません。最初の家族を追加してください！",
        "member_age_suffix": "歳",
        "member_blood": "血液型",
        "member_conditions": "持病",
        "tab_reminders": "予定",
        "tab_records": "カルテ",
        "tab_info": "基本情報",
        "tab_stats": "統計",
        "btn_add_appointment": "+ 受診予約",
        "btn_add_medication": "+ お薬リマインダー",
        "reminder_time_title": "この服薬スケジュールの時間帯設定",
        "med_morning": "朝",
        "med_noon": "昼",
        "med_afternoon": "夕",
        "med_evening": "夜",
        "med_btn_taken": "服用済み",
        "med_btn_snooze": "30分後に再通知",
        "med_btn_skip": "スキップ",
        "med_btn_edit": "スケジュール編集",
        "med_btn_delete": "スケジュール削除",
        "med_taken_done": "この回は服用完了しました",
        "med_detail_title": "服薬スケジュール詳細",
        "med_usage_instructions": "用法・効能",
        "med_contraindications": "注意事項・禁忌",
        "med_add_item": "+ お薬を追加",
        "no_reminders": "リマインダーはまだありません。",
        "search_record_placeholder": "病院名、医師、診断名、処方薬で検索...",
        "btn_add_record": "受診記録を追加",
        "btn_evaluate_trend": "健康トレンド評価",
        "btn_smart_scan": "AIスマートスキャン",
        "ocr_desc": "検査結果や処方箋の写真をアップロードすると、AIが自動解析して入力します。",
        "btn_gallery": "写真ライブラリ",
        "btn_camera": "カメラで撮影",
        "btn_pdf": "PDFファイル",
        "btn_process_info": "情報を解析",
        "no_records": "受診記録がまだありません。",
        "record_exam_date": "受診日",
        "record_hospital": "病院・クリニック",
        "record_doctor": "担当医",
        "record_cost": "費用",
        "record_disease": "診断名",
        "record_symptoms": "自覚症状",
        "record_treatment": "治療方針・処方箋",
        "record_note": "医師の指示・注意事項",
        "record_vitals": "バイタルサイン",
        "record_btn_ai_eval": "AI分析",
        "record_btn_search": "疾患検索",
        "record_btn_chat": "AIと相談",
        "record_btn_images": "添付ファイル",
        "stat_total_visits": "受診回数",
        "stat_total_cost": "総医療費",
        "stat_chart_title": "受診種別ごとの統計",
        "stat_no_data": "統計データがありません。",
        "type_routine": "健康診断・総合検診",
        "type_mild": "急性疾患（軽度）",
        "type_severe": "急性疾患（重度・救急）",
        "type_chronic": "慢性疾患",
        "type_prenatal": "妊婦健診",
        "type_vaccine": "予防接種",
        "type_dental": "歯科",
        "type_uncategorized": "未分類",
        "modal_add_member_title": "新しいメンバーを追加",
        "modal_edit_member_title": "メンバー情報を編集",
        "modal_member_name": "氏名 *",
        "modal_member_gender": "性別 *",
        "modal_member_dob": "生年月日 *",
        "modal_member_blood": "血液型",
        "modal_member_relationship": "続柄",
        "modal_member_conditions": "既往歴・アレルギー",
        "lock_title": "暗証番号入力",
        "lock_enter_pin": "暗証番号を入力してください",
        "lock_btn_unlock": "ロック解除",
        "lock_forgot_pin": "暗証番号をお忘れですか？（全データ消去）",
        "toast_lang_changed": "言語を日本語に切り替えました",
        "toast_saved": "保存しました！",
        "toast_deleted": "削除しました！",
        "dashboard_family_members": "家族メンバー",
        "dashboard_subtitle": "健康記録管理",
        "forced_pin_title": "セキュリティ設定",
        "forced_pin_desc": "医療データのプライバシーを保護するため、4〜6桁の暗証番号を設定してください。アプリのロック解除およびデータ削除の確認に使用されます。",
        "forced_pin_label": "暗証番号（4〜6桁）",
        "forced_pin_confirm_label": "暗証番号の再確認",
        "forced_pin_submit": "暗証番号を設定",
        "lock_desc": "プライバシー保護のためロックされています。",
        "lock_placeholder": "••••",
        "lock_error": "暗証番号が正しくありません。もう一度お試しください。",
        "confirm_exit_title": "アプリ終了",
        "confirm_exit_msg": "本当にアプリを終了してもよろしいですか？",
        "btn_agree": "はい",
        "member_age": "年齢",
        "record_diagnosis": "診断",
        "no_diagnosis_yet": "診断未確定",
        "select_language": "言語"
    },
    "zh": {
        "app_title": "Health Care",
        "app_subtitle": "家庭健康档案",
        "nav_dashboard": "首页",
        "nav_back": "返回",
        "btn_close": "关闭",
        "btn_save": "保存",
        "btn_cancel": "取消",
        "btn_delete": "删除",
        "btn_edit": "编辑",
        "btn_search": "搜索",
        "btn_all": "全部",
        "loading": "正在加载...",
        "btn_add": "新建",
        "header_notifications": "系统通知",
        "header_help": "帮助与指南",
        "header_settings": "设置",
        "header_exit": "退出应用",
        "settings_title": "系统设置",
        "settings_language": "显示语言",
        "settings_language_desc": "选择应用程序界面语言（英语/日语/中文/越南语）",
        "settings_backup_restore": "数据备份与恢复",
        "settings_backup_desc": "将所有医疗健康档案导出为备份文件，或从文件中恢复数据。",
        "settings_download_file": "下载备份文件",
        "settings_share": "分享文件",
        "settings_restore": "恢复数据",
        "settings_auto_backups": "自动备份记录",
        "settings_pin_security": "安全密码锁",
        "settings_pin_desc": "使用安全PIN码保护家庭健康隐私。",
        "settings_change_pin": "修改PIN码",
        "settings_enable_pin": "开启密码锁",
        "settings_disable_pin": "关闭密码锁",
        "settings_ai_config": "人工智能（AI）设置",
        "settings_factory_reset": "恢复出厂设置",
        "settings_factory_reset_desc": "清除本设备上的所有病历、家庭成员和照片数据。API密钥设置将被保留。（需输入密码确认）。",
        "settings_btn_wipe": "清除所有医疗数据",
        "settings_save_btn": "保存设置",
        "china_notice_title": "您在中国大陆（或未使用VPN）？",
        "china_notice_desc": "点击旁边的按钮，可自动将全部AI模型切换至DeepSeek和智谱AI（GLM），无需VPN即可顺畅使用。",
        "china_btn_activate": "使用国内AI",
        "search_member_placeholder": "按姓名、出生年份搜索...",
        "btn_add_member": "添加成员",
        "no_members": "暂无家庭成员，请添加第一个成员！",
        "member_age_suffix": "岁",
        "member_blood": "血型",
        "member_conditions": "基础疾病",
        "tab_reminders": "日程提醒",
        "tab_records": "病历档案",
        "tab_info": "个人资料",
        "tab_stats": "统计图表",
        "btn_add_appointment": "+ 就医预约",
        "btn_add_medication": "+ 服药提醒",
        "reminder_time_title": "本服药计划的时间段设置",
        "med_morning": "早晨",
        "med_noon": "中午",
        "med_afternoon": "下午",
        "med_evening": "晚上",
        "med_btn_taken": "已服药",
        "med_btn_snooze": "30分钟后再提醒",
        "med_btn_skip": "跳过",
        "med_btn_edit": "修改计划",
        "med_btn_delete": "删除计划",
        "med_taken_done": "本次用药已完成",
        "med_detail_title": "服药计划详情",
        "med_usage_instructions": "用法用量与功效",
        "med_contraindications": "注意事项与禁忌",
        "med_add_item": "+ 添加药品",
        "no_reminders": "暂无待办提醒日程。",
        "search_record_placeholder": "按医院、医生、疾病、药物搜索...",
        "btn_add_record": "添加就诊记录",
        "btn_evaluate_trend": "健康趋势评估",
        "btn_smart_scan": "AI智能扫描",
        "ocr_desc": "上传化验单/处方单照片，AI将自动识别并填写表单与健康报告。",
        "btn_gallery": "相册选择",
        "btn_camera": "立即拍照",
        "btn_pdf": "PDF文件",
        "btn_process_info": "智能解析信息",
        "no_records": "暂无就诊病历记录。",
        "record_exam_date": "就诊日期",
        "record_hospital": "就诊医院/诊所",
        "record_doctor": "主治医生",
        "record_cost": "费用",
        "record_disease": "诊断结果",
        "record_symptoms": "主要症状",
        "record_treatment": "治疗方案/处方药品",
        "record_note": "医嘱/注意事项",
        "record_vitals": "生命体征",
        "record_btn_ai_eval": "AI分析报告",
        "record_btn_search": "疾病百科",
        "record_btn_chat": "AI问答咨询",
        "record_btn_images": "查看附件图片",
        "stat_total_visits": "就诊总次数",
        "stat_total_cost": "就医总支出",
        "stat_chart_title": "按就诊类型分类统计",
        "stat_no_data": "暂无统计数据。",
        "type_routine": "常规体检",
        "type_mild": "急性轻症",
        "type_severe": "急性重症/急诊",
        "type_chronic": "慢性病",
        "type_prenatal": "产检",
        "type_vaccine": "疫苗接种",
        "type_dental": "口腔科",
        "type_uncategorized": "未分类",
        "modal_add_member_title": "添加家庭成员",
        "modal_edit_member_title": "编辑成员信息",
        "modal_member_name": "姓名 *",
        "modal_member_gender": "性别 *",
        "modal_member_dob": "出生日期 *",
        "modal_member_blood": "血型",
        "modal_member_relationship": "家庭关系",
        "modal_member_conditions": "既往病史 / 过敏史",
        "lock_title": "输入PIN码",
        "lock_enter_pin": "输入安全密码以解锁",
        "lock_btn_unlock": "解锁",
        "lock_forgot_pin": "忘记PIN码？（清除所有数据）",
        "toast_lang_changed": "语言已切换为简体中文",
        "toast_saved": "保存成功！",
        "toast_deleted": "删除成功！",
        "dashboard_family_members": "家庭成员",
        "dashboard_subtitle": "健康档案管理",
        "forced_pin_title": "安全设置",
        "forced_pin_desc": "为确保医疗数据安全，请设置4-6位数字PIN码。该密码用于解锁应用程序以及确认删除数据。",
        "forced_pin_label": "PIN码（4-6位数字）",
        "forced_pin_confirm_label": "再次确认PIN码",
        "forced_pin_submit": "创建PIN码",
        "lock_desc": "家庭健康档案已锁定以保护隐私。",
        "lock_placeholder": "••••",
        "lock_error": "PIN码错误，请重试。",
        "confirm_exit_title": "退出应用",
        "confirm_exit_msg": "您确定要退出应用程序吗？",
        "btn_agree": "确定",
        "member_age": "年龄",
        "record_diagnosis": "诊断",
        "no_diagnosis_yet": "暂无诊断结论",
        "select_language": "语言"
    }
};

const I18n = {
    currentLang: 'vi',

    init() {
        let saved = 'vi';
        try {
            if (typeof DataManager !== 'undefined' && DataManager.getLanguage) {
                saved = DataManager.getLanguage() || 'vi';
            } else {
                const s = localStorage.getItem('family_settings');
                if (s) {
                    const parsed = JSON.parse(s);
                    if (parsed.language) saved = parsed.language;
                }
            }
        } catch (e) {
            console.warn('[I18n] Error reading saved language:', e);
        }
        this.currentLang = saved || 'vi';
        this.applyTranslations(document);
        this.bindEvents();
    },

    bindEvents() {
        const langSelectIds = ['home-language-select', 'setup-language-select', 'lock-language-select', 'input-language'];
        langSelectIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.value = this.currentLang;
                el.onchange = (e) => {
                    this.setLanguage(e.target.value);
                };
            }
        });
    },

    setLanguage(lang) {
        if (!TRANSLATIONS[lang]) lang = 'vi';
        this.currentLang = lang;
        try {
            if (typeof DataManager !== 'undefined' && DataManager.saveSettings) {
                DataManager.saveSettings({ language: lang });
            } else {
                const s = localStorage.getItem('family_settings');
                const parsed = s ? JSON.parse(s) : {};
                parsed.language = lang;
                localStorage.setItem('family_settings', JSON.stringify(parsed));
            }
        } catch (e) {
            console.warn('[I18n] Error saving language:', e);
        }

        // Đồng bộ toàn bộ các dropdown chọn ngôn ngữ trên toàn trang
        const langSelectIds = ['home-language-select', 'setup-language-select', 'lock-language-select', 'input-language'];
        langSelectIds.forEach(id => {
            const el = document.getElementById(id);
            if (el && el.value !== lang) {
                el.value = lang;
            }
        });

        this.applyTranslations(document);

        // Hiển thị toast thông báo đã đổi ngôn ngữ
        if (typeof showToast === 'function') {
            showToast(this.t('toast_lang_changed', 'Language updated'), 'success');
        }

        // Cập nhật lại giao diện động
        if (typeof initDashboard === 'function' && document.getElementById('view-dashboard')?.classList.contains('active')) {
            initDashboard();
        } else if (typeof reloadRecordsAndStats === 'function' && document.getElementById('view-member-detail')?.classList.contains('active')) {
            reloadRecordsAndStats();
        }
    },

    t(key, defaultText = '') {
        const langDict = TRANSLATIONS[this.currentLang] || TRANSLATIONS['vi'];
        if (langDict && langDict[key] !== undefined) {
            return langDict[key];
        }
        if (TRANSLATIONS['vi'] && TRANSLATIONS['vi'][key] !== undefined) {
            return TRANSLATIONS['vi'][key];
        }
        return defaultText || key;
    },

    applyTranslations(root = document) {
        if (!root) return;
        if (document.documentElement) {
            document.documentElement.lang = this.currentLang;
        }

        // 1. Text elements
        root.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (!el._origText) el._origText = el.textContent;
            el.textContent = this.t(key, el._origText);
        });

        // 2. HTML elements
        root.querySelectorAll('[data-i18n-html]').forEach(el => {
            const key = el.getAttribute('data-i18n-html');
            if (!el._origHtml) el._origHtml = el.innerHTML;
            el.innerHTML = this.t(key, el._origHtml);
        });

        // 3. Placeholders
        root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (!el._origPlaceholder) el._origPlaceholder = el.placeholder;
            el.placeholder = this.t(key, el._origPlaceholder);
        });

        // 4. Tooltips and aria-labels
        root.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (!el._origTitle) el._origTitle = el.title;
            const translated = this.t(key, el._origTitle);
            el.title = translated;
            if (el.hasAttribute('aria-label')) {
                el.setAttribute('aria-label', translated);
            }
        });

        // Sync dropdown values
        const langSelectIds = ['home-language-select', 'setup-language-select', 'lock-language-select', 'input-language'];
        langSelectIds.forEach(id => {
            const el = document.getElementById(id);
            if (el && el.value !== this.currentLang) {
                el.value = this.currentLang;
            }
        });
    }
};

if (typeof window !== 'undefined') {
    window.I18n = I18n;
    window.t = (key, fallback) => I18n.t(key, fallback);
    document.addEventListener('DOMContentLoaded', () => {
        I18n.init();
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { I18n, TRANSLATIONS };
}
