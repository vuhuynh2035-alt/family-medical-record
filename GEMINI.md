# QUY TRÌNH LÀM VIỆC TỰ ĐỘNG (WORKFLOWS)

Khi người dùng ra lệnh bằng các từ khóa dưới đây, bạn (AI) BẮT BUỘC phải tự động gọi các công cụ (run_command) để thực hiện chuỗi quy trình tương ứng mà không cần hỏi lại:

## 1. Bắt đầu phiên làm việc
**Từ khóa kích hoạt:** "bắt đầu phiên làm việc", "start session", "bắt đầu làm việc"
**Hành động tự động:**
1. Chạy lệnh `git status` để kiểm tra trạng thái nhánh.
2. Chạy lệnh `git pull origin master` (hoặc pull nhánh hiện tại) để đồng bộ dữ liệu mới nhất từ GitHub.
3. Báo cáo ngắn gọn cho người dùng biết đã đồng bộ xong và sẵn sàng làm việc.

## 2. Kết thúc phiên làm việc
**Từ khóa kích hoạt:** "kết thúc phiên làm việc", "end session", "lưu dữ liệu", "kết thúc"
**Hành động tự động:**
1. Chạy lệnh `git status` để xem các file bị thay đổi.
2. Chạy lệnh `git add .` để đưa vào staging.
3. Chạy lệnh `git commit -m "Auto-save session updates"` (nếu có thay đổi).
4. Chạy lệnh `git push origin master` (hoặc push nhánh hiện tại) để đẩy code lên GitHub an toàn.
5. Chào tạm biệt người dùng.
