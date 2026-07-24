const AIService = {
    // API endpoint cho model gemini-1.5-flash (Nhanh và tốt cho OCR/Vision)
    // Có thể dùng gemini-3.5-pro nếu cần suy luận y khoa sâu hơn, flash cho tác vụ cơ bản.
    async callGeminiAPI(prompt, base64Images = null, isJson = false, usePro = false) {
        const apiKey = DataManager.getGeminiApiKey();
        if (!apiKey) {
            throw new Error("Vui lòng thiết lập API Key trong phần Cài đặt trước khi sử dụng tính năng này.");
        }

        let model = DataManager.getGeminiModel();
        // Không ép buộc tên model nữa, dùng chính xác model người dùng đã chọn
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        let parts = [{ text: prompt }];
        
        if (base64Images) {
            const imagesArray = Array.isArray(base64Images) ? base64Images : [base64Images];
            imagesArray.forEach(img => {
                if (img.includes('base64,')) {
                    const base64Data = img.split(',')[1];
                    
                    // Lấy chính xác mimeType từ data URI (hỗ trợ image/jpeg, image/png, application/pdf...)
                    const mimeTypeMatches = img.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
                    let mimeType = 'image/jpeg';
                    if (mimeTypeMatches) {
                        mimeType = mimeTypeMatches[1];
                    }
                    
                    parts.push({
                        inlineData: {
                            data: base64Data,
                            mimeType: mimeType
                        }
                    });
                }
            });
        }
        
        let contents = [{
            role: "user",
            parts: parts
        }];

        const body = {
            contents: contents,
            generationConfig: {
                temperature: 0.2,
            }
        };

        if (isJson) {
            body.generationConfig.responseMimeType = "application/json";
        }

        let attempts = 0;
        const maxAttempts = 2;

        while (attempts < maxAttempts) {
            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(body)
                });

                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error?.message || "Lỗi khi gọi Google Gemini API.");
                }

                if (data.candidates && data.candidates.length > 0) {
                    return data.candidates[0].content.parts[0].text;
                } else {
                    throw new Error("Không nhận được phản hồi hợp lệ từ AI.");
                }
            } catch (error) {
                const isOverloaded = error.message.includes("high demand") || error.message.includes("503");
                attempts++;
                if (isOverloaded && attempts < maxAttempts) {
                    console.warn(`Gemini API overloaded. Retrying in 2 seconds... (Attempt ${attempts}/${maxAttempts})`);
                    await new Promise(r => setTimeout(r, 2000));
                } else {
                    console.error("Gemini API Error:", error);
                    if (isOverloaded) {
                        throw new Error("Hệ thống AI của Google hiện đang bị quá tải (High Demand). Vui lòng đợi vài phút rồi thử lại. Bạn cũng có thể vào Cài đặt để thêm API Key của ChatGPT/Claude để dự phòng nhé!");
                    }
                    throw error;
                }
            }
        }
    },

    async callOpenAI(prompt) {
        const apiKey = DataManager.getOpenAIApiKey();
        if (!apiKey) throw new Error("Vui lòng thiết lập OpenAI API Key trong Cài đặt.");
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.5
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "Lỗi khi gọi OpenAI API.");
        return data.choices[0].message.content;
    },

    async callAnthropic(prompt) {
        const apiKey = DataManager.getAnthropicApiKey();
        if (!apiKey) throw new Error("Vui lòng thiết lập Anthropic API Key trong Cài đặt.");
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "anthropic-dangerous-direct-browser-access": "true"
            },
            body: JSON.stringify({
                model: "claude-3-5-sonnet-20240620",
                max_tokens: 2048,
                messages: [{ role: "user", content: prompt }]
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "Lỗi khi gọi Anthropic API.");
        return data.content[0].text;
    },

    // 1. OCR & Data Extraction
    async extractDataFromImage(base64Images) {
        const prompt = `Bạn là một trợ lý y tế chuyên nghiệp. Hãy đọc toàn bộ các hình ảnh đính kèm (phiếu kết quả xét nghiệm, hồ sơ khám bệnh, đơn thuốc, phim X-quang, v.v.) và tổng hợp trích xuất các thông tin sau. Nếu có nhiều ảnh, hãy kết hợp thông tin một cách logic.
Trích xuất dữ liệu thành cấu trúc JSON nghiêm ngặt (không có markdown formatting, chỉ trả về JSON thuần túy) với các key sau:
- "date": Ngày khám bệnh (định dạng YYYY-MM-DD). Nếu không có, hãy để chuỗi rỗng "".
- "hospital": Tên bệnh viện hoặc phòng khám.
- "doctor": Tên bác sĩ điều trị.
- "type": Phân loại khám bệnh (Chọn một trong các giá trị: "routine", "mild", "severe", "chronic").
- "bp": Huyết áp (vd: "120/80").
- "hr": Nhịp tim (vd: 80 - số nguyên).
- "temp": Nhiệt độ (vd: 37.0 - số thực).
- "spo2": Nồng độ oxy trong máu (vd: 98 - số nguyên).
- "symptoms": Lý do khám hoặc các triệu chứng lâm sàng.
- "labs": Tóm tắt các kết quả xét nghiệm cận lâm sàng (máu, X-Quang, siêu âm...).
- "disease": Chẩn đoán bệnh hoặc kết luận chính xác.
- "treatment": Phương án điều trị hoặc đơn thuốc chi tiết.
- "note": Lời khuyên của bác sĩ (kiêng cữ, ăn uống...).
- "cost": Tổng chi phí (chỉ lấy con số, ví dụ 500000. Nếu không thấy, trả về 0).
- "dynamicFields": Mảng các chỉ số xét nghiệm chi tiết hoặc chuyên sâu. Mỗi phần tử là một object có "key" (Tên chỉ số, vd: "Glucose", "AST") và "value" (Kết quả kèm đơn vị, vd: "5.5 mmol/L"). Nếu không có, để mảng rỗng [].

Nếu bất kỳ thông tin nào không thể tìm thấy trong ảnh, hãy để chuỗi rỗng "" (hoặc 0 đối với số).`;

        let result = await this.callGeminiAPI(prompt, base64Images, true);
        try {
            // Làm sạch dữ liệu: Đôi khi các mô hình mới tự thêm markdown ```json ... ``` dù đã yêu cầu trả về JSON thuần túy
            let cleanResult = result.trim();
            if (cleanResult.startsWith("```")) {
                cleanResult = cleanResult.replace(/^```(json)?\s*/i, "").replace(/\s*```$/i, "");
            }
            const jsonData = JSON.parse(cleanResult);
            return jsonData;
        } catch (e) {
            console.error("Lỗi parse JSON từ AI:", result);
            throw new Error("Không thể trích xuất dữ liệu. AI trả về định dạng không đúng.");
        }
    },

    // 1.5. Khám Tổng Quát / Đa chuyên khoa (Comprehensive Report)
    async generateComprehensiveReport(base64Files) {
        const prompt = `Bạn là một hội đồng y khoa bác sĩ chuyên gia. Dưới đây là nhiều trang kết quả khám bệnh (dưới dạng ảnh hoặc tài liệu PDF) của một bệnh nhân, có thể đến từ nhiều chuyên khoa khác nhau (ví dụ: tim mạch, hô hấp, xét nghiệm máu...).
Hãy đọc cẩn thận toàn bộ các tài liệu này và tổng hợp thành một "Báo cáo Đánh giá Sức khỏe Toàn diện", phân chia rõ ràng theo từng hạng mục.

Yêu cầu định dạng báo cáo (Sử dụng Markdown rõ ràng, đẹp mắt):
1. Phần Tổng Quan: Nhận định nhanh về tình trạng sức khỏe tổng thể.
2. Chi tiết từng chuyên khoa/hạng mục (Mỗi hạng mục là một Heading 3 \`###\`):
   - Nêu rõ tên hạng mục (Ví dụ: ### Tim mạch, ### Phổi, ### Sinh hóa máu...)
   - Bác sĩ phụ trách / Nơi khám (nếu có).
   - Tóm tắt kết quả chính hoặc bất thường.
   - Kết luận / Chẩn đoán của hạng mục đó.
   - Hướng điều trị / Đơn thuốc / Lời khuyên cụ thể cho hạng mục đó.
3. Phần Tổng Kết & Lời Khuyên Chung: Khuyên bệnh nhân nên làm gì tiếp theo, chế độ sinh hoạt, dinh dưỡng.

Chú ý: Trình bày nội dung cực kỳ chuyên nghiệp, dễ đọc, xuống dòng rõ ràng, sử dụng bullet points \`-\` hoặc in đậm \`**\` để làm nổi bật thông tin quan trọng.`;

        let result = await this.callGeminiAPI(prompt, base64Files, false);
        // Clean markdown block wrapper if AI mistakenly wraps standard text in ```markdown
        let cleanResult = result.trim();
        if (cleanResult.startsWith("```")) {
            cleanResult = cleanResult.replace(/^```(markdown)?\s*/i, "").replace(/\s*```$/i, "");
        }
        return cleanResult;
    },

    // 2. Health Assessment
    async generateHealthAssessment(recordData, memberProfile) {
        const prompt = `Bạn là một bác sĩ gia đình tận tâm, thân thiện. Dựa vào hồ sơ dưới đây, hãy đưa ra nhận xét sức khỏe và lời khuyên y tế.
Trình bày định dạng Markdown, ngắn gọn (3-4 đoạn).
*LƯU Ý QUAN TRỌNG VỀ XƯNG HÔ:* Tên bệnh nhân có thể là các danh xưng trong gia đình (Ba, Mẹ, Vợ, Chồng, Anh, Em...). Tuyệt đối không tự ý ghép thêm từ "Bác", "Chú", "Cô" vào trước các danh xưng này (Ví dụ: Không gọi là "Bác Ba", "Cô Mẹ"). Hãy xưng là "Bác sĩ" và gọi bệnh nhân là "bạn", hoặc gọi trực tiếp bằng danh xưng gia đình đó một cách lịch sự (ví dụ: "Chào Ba của bạn", "Đối với tình trạng của Mẹ...").

[Thông tin Bệnh nhân]
- Tên: ${memberProfile.name}
- Ngày sinh: ${memberProfile.dob}
- Nhóm máu: ${memberProfile.blood || "Chưa rõ"}
- Bệnh lý nền: ${memberProfile.conditions || "Không có"}

[Hồ sơ khám bệnh hiện tại]
- Ngày khám: ${recordData.date}
- Bệnh viện/Phòng khám: ${recordData.hospital}
- Bác sĩ: ${recordData.doctor || "Chưa rõ"}
- Chẩn đoán: ${recordData.disease}
- Phân loại: ${recordData.type === 'routine' ? 'Khám định kỳ' : recordData.type === 'mild' ? 'Bệnh nhẹ' : recordData.type === 'severe' ? 'Bệnh nặng' : 'Bệnh mãn tính'}
- Phương án điều trị / Thuốc: ${recordData.treatment}

Vui lòng đưa ra nhận xét:
1. Đánh giá sơ bộ về tình trạng hiện tại dựa trên chẩn đoán và bệnh lý nền.
2. Lời khuyên về cách sinh hoạt, ăn uống hoặc uống thuốc theo toa.
3. Những lưu ý cần theo dõi thêm.`;

        const provider = DataManager.getActiveProvider();
        if (provider === 'openai') {
            return await this.callOpenAI(prompt);
        } else if (provider === 'anthropic') {
            return await this.callAnthropic(prompt);
        } else {
            return await this.callGeminiAPI(prompt, null, false, true);
        }
    },

    // 3. Tra cứu chuyên sâu về bệnh
    async searchDiseaseInfo(diseaseName) {
        const prompt = `Bạn là một Bác sĩ và Chuyên gia y khoa hàng đầu thế giới. Bệnh nhân của bạn vừa được chẩn đoán mắc bệnh/tình trạng: "${diseaseName}". 
Họ muốn tìm hiểu chuyên sâu về căn bệnh này trên Internet để nắm rõ tình hình.
Vui lòng cung cấp một bài viết tham khảo y khoa chi tiết, sử dụng định dạng Markdown rõ ràng, bao gồm:
1. **Tổng quan về bệnh:** Bệnh này là gì? Nguyên nhân chính?
2. **Triệu chứng thường gặp:** Các dấu hiệu nhận biết từ nhẹ đến nặng.
3. **Biến chứng nguy hiểm:** Nếu không điều trị tốt sẽ dẫn đến hậu quả gì?
4. **Phương pháp điều trị hiện đại nhất hiện nay:** Thuốc, phẫu thuật, hoặc lối sống.
5. **Cách phòng ngừa và chăm sóc tại nhà:** (Dành cho bản thân người bệnh và gia đình).

Hãy viết với văn phong đồng cảm, khoa học, chính xác, nhưng dễ hiểu đối với người không có chuyên môn y tế.`;

        const provider = DataManager.getActiveProvider();
        if (provider === 'openai') {
            return await this.callOpenAI(prompt);
        } else if (provider === 'anthropic') {
            return await this.callAnthropic(prompt);
        } else {
            return await this.callGeminiAPI(prompt, null, false, true);
        }
    }
};
