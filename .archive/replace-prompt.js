const fs = require('fs');
let code = fs.readFileSync('js/ai.js', 'utf8');

const oldText = `Vui lòng phân tích và xuất Báo cáo Đánh giá Xu hướng Sức khỏe gồm các phần sau:
1. **Tổng kết chung:** Tóm tắt ngắn gọn tình trạng sức khỏe của bệnh nhân qua các đợt khám (ví dụ: đang tốt lên, giữ nguyên, hay xấu đi).
2. **Biến động chỉ số (Đặc biệt chú ý Đường huyết & Huyết áp):** So sánh sự thay đổi của các chỉ số sinh tồn (Huyết áp, Nhịp tim...) và các chỉ số xét nghiệm (đặc biệt là Đường huyết, mỡ máu...) qua các lần khám. Nếu có chỉ số nào đang tăng dần/giảm dần, tiến sát hoặc vượt ngưỡng nguy hiểm, hãy phân tích chi tiết và nhấn mạnh ảnh hưởng của nó đến sức khỏe tổng thể. Có thể dùng bảng (table markdown) để so sánh các chỉ số nếu thấy cần thiết.
3. **Phân tích bệnh lý:** Các bệnh lý nào thường xuyên lặp lại hoặc có xu hướng tiến triển? Nguyên nhân có thể do đâu?
4. **Kế hoạch hành động:** Đưa ra lời khuyên thiết thực về cách theo dõi sức khỏe tại nhà, thay đổi chế độ dinh dưỡng, vận động, và lịch tái khám định kỳ để cải thiện tình hình sức khỏe hiện tại, tập trung vào việc ổn định huyết áp và đường huyết nếu bệnh nhân có tiền sử bất thường.`;

const newText = `Vui lòng phân tích và xuất Báo cáo Đánh giá Xu hướng Sức khỏe gồm các phần sau:
1. **Tổng kết chung:** Tóm tắt ngắn gọn tình trạng sức khỏe của bệnh nhân qua các đợt khám (ví dụ: đang tốt lên, giữ nguyên, hay xấu đi).
2. **Biến động chỉ số (Đặc biệt chú ý Đường huyết & Huyết áp):** So sánh sự thay đổi của các chỉ số sinh tồn (Huyết áp, Nhịp tim...) và các chỉ số xét nghiệm (đặc biệt là Đường huyết, mỡ máu...) qua các lần khám. Nếu có chỉ số nào đang tăng dần/giảm dần, tiến sát hoặc vượt ngưỡng nguy hiểm, hãy phân tích chi tiết và nhấn mạnh ảnh hưởng của nó đến sức khỏe tổng thể. Có thể dùng bảng (table markdown) để so sánh các chỉ số nếu thấy cần thiết. (QUAN TRỌNG: Ở bảng so sánh, tiêu đề cột chứa ngày tháng HÃY VIẾT THEO FORMAT RÚT GỌN dd/mm/yy, ví dụ: 25/06/25 thay vì 25/06/2025, để tiết kiệm diện tích hiển thị trên điện thoại).
3. **Phân tích bệnh lý:** Các bệnh lý nào thường xuyên lặp lại hoặc có xu hướng tiến triển? Nguyên nhân có thể do đâu?
4. **Kế hoạch hành động:** Đưa ra lời khuyên thiết thực về cách theo dõi sức khỏe tại nhà, thay đổi chế độ dinh dưỡng, vận động, và lịch tái khám định kỳ để cải thiện tình hình sức khỏe hiện tại, tập trung vào việc ổn định huyết áp và đường huyết nếu bệnh nhân có tiền sử bất thường.`;

if (code.includes(oldText)) {
    code = code.replace(oldText, newText);
    fs.writeFileSync('js/ai.js', code);
    console.log("Replaced successfully");
} else {
    console.log("Could not find exact text again");
    // Fallback: replace with regex
    const regex = /Có thể dùng bảng \(table markdown\) để so sánh các chỉ số nếu thấy cần thiết\./;
    if (regex.test(code)) {
        code = code.replace(regex, "Có thể dùng bảng (table markdown) để so sánh các chỉ số nếu thấy cần thiết. (QUAN TRỌNG: Ở bảng so sánh, tiêu đề cột chứa ngày tháng HÃY VIẾT THEO FORMAT RÚT GỌN dd/mm/yy, ví dụ: 25/06/25 thay vì 25/06/2025, để tiết kiệm diện tích hiển thị trên điện thoại).");
        fs.writeFileSync('js/ai.js', code);
        console.log("Replaced using Regex successfully");
    } else {
        console.log("Could not find using regex either!");
    }
}
