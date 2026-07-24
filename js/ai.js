/**
 * AIService — lớp bao (wrapper) gọi các nhà cung cấp AI (Google Gemini, OpenAI, Anthropic Claude)
 * để thực hiện OCR trích xuất dữ liệu từ ảnh/tài liệu y tế, tạo báo cáo tổng hợp, và tư vấn sức khỏe.
 *
 * LƯU Ý BẢO MẬT: Các API Key được gọi trực tiếp từ trình duyệt (client-side). Điều này phù hợp
 * với một ứng dụng cá nhân/gia đình chạy hoàn toàn cục bộ (không có backend), nhưng đồng nghĩa
 * là bất kỳ ai truy cập được thiết bị/trình duyệt này đều có thể đọc được các key đã lưu.
 * Không nên dùng chung thiết bị này với người không tin tưởng, và không nên triển khai kiến trúc
 * này cho một sản phẩm nhiều người dùng có backend dùng chung.
 */
const AIService = {
    // Thời gian chờ tối đa cho một lời gọi API trước khi tự hủy (tránh treo UI vô thời hạn)
    // Tăng lên 150s (2.5 phút) vì đọc nhiều trang PDF/Ảnh mất rất nhiều thời gian xử lý
    DEFAULT_TIMEOUT_MS: 150000,

    /**
     * fetch() có kèm timeout tự động hủy request bằng AbortController.
     * @param {string} url
     * @param {RequestInit} options
     * @param {number} timeoutMs
     */
    async _fetchWithTimeout(url, options = {}, timeoutMs = this.DEFAULT_TIMEOUT_MS) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, { ...options, signal: controller.signal });
        } catch (err) {
            if (err.name === 'AbortError') {
                throw new Error('Yêu cầu tới máy chủ AI đã hết thời gian chờ. Vui lòng kiểm tra kết nối mạng và thử lại.');
            }
            throw err;
        } finally {
            clearTimeout(timer);
        }
    },

    /**
     * Gọi Gemini API.
     * @param {number} temperature - Độ "ngẫu nhiên" khi sinh nội dung (0 = luôn chọn phương án
     * khả dĩ nhất, ổn định nhất giữa các lần gọi; càng cao càng đa dạng nhưng càng dễ cho kết quả
     * khác nhau giữa các lần gọi dù cùng 1 đầu vào). Mặc định thấp (0.2) vì đây là ứng dụng y tế,
     * ưu tiên tính nhất quán hơn là văn phong sáng tạo.
     */
    async callGeminiAPI(prompt, base64Images = null, isJson = false, overrideModel = null, temperature = 0.2) {
        const apiKey = DataManager.getGeminiApiKey();
        if (!apiKey) {
            throw new Error("Vui lòng thiết lập API Key trong phần Cài đặt trước khi sử dụng tính năng này.");
        }

        let model = overrideModel || DataManager.getGeminiModel();
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
                temperature: temperature,
            }
        };

        if (isJson) {
            body.generationConfig.responseMimeType = "application/json";
        }

        let attempts = 0;
        const maxAttempts = 2;

        while (attempts < maxAttempts) {
            try {
                const response = await this._fetchWithTimeout(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(body)
                });

                const data = await response.json();

                if (!response.ok) {
                    const apiMsg = data.error?.message || "Lỗi khi gọi Google Gemini API.";
                    // Google ngừng hỗ trợ (decommission) các model Gemini theo chu kỳ ~1 năm.
                    // Nếu model đã lưu trong Cài đặt bị ngừng, lỗi trả về thường là 404/NOT_FOUND
                    // với thông điệp chung chung "model not found" — rất khó hiểu với người dùng
                    // thường. Bắt đúng trường hợp này để đưa ra hướng dẫn cụ thể thay vì để lỗi thô.
                    const isModelNotFound = response.status === 404 || data.error?.status === 'NOT_FOUND' || (/model/i.test(apiMsg) && /not found|not supported|does not exist/i.test(apiMsg));
                    if (isModelNotFound) {
                        throw new Error(`Model AI "${model}" hiện không khả dụng (có thể đã bị Google ngừng hỗ trợ). Vào Cài đặt > mục Gemini > bấm "Tải danh sách" để chọn lại 1 model đang hoạt động từ chính tài khoản của bạn. (Chi tiết lỗi gốc: ${apiMsg})`);
                    }
                    throw new Error(apiMsg);
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

    async callOpenAI(prompt, temperature = 0.3) {
        const apiKey = DataManager.getOpenAIApiKey();
        if (!apiKey) throw new Error("Vui lòng thiết lập OpenAI API Key trong Cài đặt.");
        // Model có thể được người dùng ghi đè trong Cài đặt (xem DataManager.getOpenAIModel) —
        // OpenAI cũng thường xuyên ra bản mới, mã nguồn để mặc định "gpt-4o" nhưng khuyến khích
        // người dùng tự cập nhật tên model mới hơn khi có, thay vì phải chờ bản cập nhật ứng dụng.
        const model = DataManager.getOpenAIModel();
        const response = await this._fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: "user", content: prompt }],
                temperature: temperature
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "Lỗi khi gọi OpenAI API.");
        return data.choices[0].message.content;
    },

    async callAnthropic(prompt, temperature = 0.3) {
        const apiKey = DataManager.getAnthropicApiKey();
        if (!apiKey) throw new Error("Vui lòng thiết lập Anthropic API Key trong Cài đặt.");
        // Xem ghi chú tương tự ở callOpenAI() — model có thể được người dùng ghi đè trong Cài đặt.
        const model = DataManager.getAnthropicModel();
        const response = await this._fetchWithTimeout("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "anthropic-dangerous-direct-browser-access": "true"
            },
            body: JSON.stringify({
                model: model,
                max_tokens: 2048,
                temperature: temperature,
                messages: [{ role: "user", content: prompt }]
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "Lỗi khi gọi Anthropic API.");
        return data.content[0].text;
    },

    /**
     * 1. OCR & Trích xuất dữ liệu: đọc ảnh/PDF phiếu khám và trả về object dữ liệu hồ sơ dạng JSON.
     * Luôn dùng Gemini vì đây là nhà cung cấp duy nhất được cấu hình cho việc đọc file đính kèm.
     * @param {string[]|string} base64Images - danh sách (hoặc 1) data URI base64 của ảnh/PDF
     * @returns {Promise<object>} object dữ liệu hồ sơ đã trích xuất
     */
    async extractDataFromImage(base64Images) {
        const prompt = `Bạn là một trợ lý y tế chuyên nghiệp. Hãy đọc toàn bộ các hình ảnh đính kèm (phiếu kết quả xét nghiệm, hồ sơ khám bệnh, đơn thuốc, phim X-quang, v.v.) và tổng hợp trích xuất các thông tin sau. Nếu có nhiều ảnh, hãy kết hợp thông tin một cách logic.
TUYỆT ĐỐI CHỈ TRẢ VỀ JSON, KHÔNG THÊM BẤT KỲ ĐOẠN VĂN BẢN HAY LỜI CHÀO NÀO KHÁC. Trích xuất dữ liệu thành cấu trúc JSON nghiêm ngặt với các key sau:
- "date": Ngày khám bệnh (định dạng YYYY-MM-DD). Nếu không có, hãy để chuỗi rỗng "".
- "hospital": Tên bệnh viện hoặc phòng khám.
- "doctor": Tên bác sĩ điều trị.
- "type": Phân loại khám. BẮT BUỘC chọn ĐÚNG NGUYÊN VĂN một trong các giá trị sau (không tự đặt ra giá trị khác, không diễn giải lại bằng từ ngữ khác dù ý nghĩa tương đương — luôn chọn đúng 1 nhãn có sẵn dưới đây để cùng một loại hồ sơ luôn được phân loại nhất quán giữa các lần đọc khác nhau): "Khám sức khỏe tổng quát", "Bệnh lý cấp tính (Nhẹ)", "Bệnh lý cấp tính (Nặng)", "Bệnh lý mạn tính", "Khám thai", "Tiêm chủng", "Nha khoa". Nếu ảnh chỉ là phiếu kết quả xét nghiệm đơn thuần (chưa có chẩn đoán/kết luận của bác sĩ để xác định là cấp tính hay mạn tính), hãy chọn "Khám sức khỏe tổng quát".
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
- "dynamicFields": Mảng các chỉ số xét nghiệm chi tiết hoặc chuyên sâu. Mỗi phần tử là một object có "key" (Tên chỉ số, vd: "Glucose", "AST"), "value" (Kết quả kèm đơn vị, vd: "5.5 mmol/L"), và "isAbnormal" (boolean: true nếu kết quả nằm ngoài khoảng tham chiếu bình thường/bị đánh dấu bất thường, false nếu bình thường). Nếu không có, để mảng rỗng [].

Nếu bất kỳ thông tin nào không thể tìm thấy trong ảnh, hãy để chuỗi rỗng "" (hoặc 0 đối với số).`;

        // temperature = 0: đây là tác vụ trích xuất/phân loại dữ liệu (không phải viết văn), nên
        // ưu tiên tuyệt đối tính nhất quán — cùng 1 ảnh đọc nhiều lần nên ra cùng 1 kết quả, thay
        // vì "sáng tạo" ra các cách diễn đạt/phân loại khác nhau mỗi lần gọi.
        let result = await this.callGeminiAPI(prompt, base64Images, true, null, 0);
        try {
            let cleanResult = result.trim();
            // Try parsing directly first
            try {
                let parsed = JSON.parse(cleanResult);
                return Array.isArray(parsed) ? parsed[0] : parsed;
            } catch (directErr) {
                // Fallback: extract JSON from markdown if wrapped
                const firstBrace = cleanResult.indexOf('{');
                const lastBrace = cleanResult.lastIndexOf('}');
                const firstBracket = cleanResult.indexOf('[');
                const lastBracket = cleanResult.lastIndexOf(']');
                
                let extractObj = "";
                let extractArr = "";
                if (firstBrace !== -1 && lastBrace !== -1) {
                    extractObj = cleanResult.substring(firstBrace, lastBrace + 1);
                }
                if (firstBracket !== -1 && lastBracket !== -1) {
                    extractArr = cleanResult.substring(firstBracket, lastBracket + 1);
                }
                
                // Prefer the one that parses successfully
                try {
                    if (extractArr) {
                        let parsed = JSON.parse(extractArr);
                        return Array.isArray(parsed) ? parsed[0] : parsed;
                    }
                } catch(e) {}
                
                if (extractObj) {
                    let parsed = JSON.parse(extractObj);
                    return parsed;
                }
                throw new Error("No valid JSON found");
            }
        } catch (e) {
            console.error("Lỗi parse JSON từ AI:", result);
            throw new Error("Không thể trích xuất dữ liệu. AI trả về định dạng không đúng. Chi tiết: " + result.substring(0, 100));
        }
    },

    // 1.5. Khám Tổng Quát / Đa chuyên khoa (Comprehensive Report)
    async generateComprehensiveReport(base64Files, overrideModel = null) {
        const prompt = `Bạn là một hội đồng y khoa bác sĩ chuyên gia. Dưới đây là kết quả khám bệnh (dưới dạng ảnh hoặc tài liệu PDF) của một bệnh nhân. Đặc biệt lưu ý nếu đây là đợt Khám tổng quát, sẽ có rất nhiều hạng mục xét nghiệm và kiểm tra khác nhau.
Nhiệm vụ của bạn là: Hãy đọc CẨN THẬN TOÀN BỘ các file/hình ảnh đính kèm (không bỏ sót bất kỳ trang nào) và phân tích, đánh giá kết quả theo từng hạng mục xét nghiệm/chuyên khoa một cách chi tiết, rõ ràng nhất để tạo thành một "Báo cáo Đánh giá Sức khỏe Toàn diện".

Yêu cầu định dạng báo cáo (Sử dụng Markdown rõ ràng, đẹp mắt):
1. Phần Tổng Quan: Nhận định nhanh về tình trạng sức khỏe tổng thể.
2. Chi tiết từng chuyên khoa / hạng mục xét nghiệm (Mỗi hạng mục là một Heading 3 \`###\`):
   - Nêu rõ tên hạng mục kiểm tra/xét nghiệm (Ví dụ: ### Xét nghiệm máu sinh hóa, ### Siêu âm ổ bụng, ### Điện tâm đồ, ### Khám Mắt...)
   - Bác sĩ phụ trách / Nơi khám (nếu có).
   - Phân tích chi tiết các chỉ số/kết quả chính (đặc biệt nhấn mạnh giải thích các chỉ số bất thường).
   - Kết luận / Chẩn đoán cụ thể của hạng mục đó.
   - Hướng điều trị / Đơn thuốc / Lời khuyên cụ thể cho riêng hạng mục đó.
3. Phần Tổng Kết & Lời Khuyên Chung: Khuyên bệnh nhân nên làm gì tiếp theo, chế độ sinh hoạt, dinh dưỡng tổng thể.
4. Tài Liệu Tham Khảo: Cung cấp các đường link tham khảo đáng tin cậy về loại bệnh mắc phải, các phác đồ điều trị chuẩn y khoa hiện nay để bệnh nhân tự tìm hiểu thêm.

Chú ý: Trình bày nội dung cực kỳ chuyên nghiệp, dễ hiểu cho bệnh nhân, xuống dòng rõ ràng, sử dụng bullet points \`-\` hoặc in đậm \`**\` để làm nổi bật thông tin quan trọng.`;

        let result = "";
        if (overrideModel === 'chatgpt') {
            throw new Error("ChatGPT hiện chưa được hỗ trợ đọc tệp đính kèm trong tính năng này. Vui lòng chọn Gemini.");
        } else if (overrideModel === 'claude') {
            throw new Error("Claude hiện chưa được hỗ trợ đọc tệp đính kèm trong tính năng này. Vui lòng chọn Gemini.");
        } else {
            // overrideModel is 'gemini', use default model from settings.
            // temperature thấp (0.1) thay vì mặc định: đây là báo cáo tổng hợp SỐ LIỆU y khoa từ
            // tài liệu thật, cần ưu tiên tính nhất quán/trung thực với dữ liệu gốc hơn là văn phong
            // đa dạng — đọc lại đúng 1 bộ ảnh nên luôn ra kết luận giống nhau về mặt nội dung.
            result = await this.callGeminiAPI(prompt, base64Files, false, null, 0.1);
        }
        // Clean markdown block wrapper if AI mistakenly wraps standard text in ```markdown
        let cleanResult = result.trim();
        if (cleanResult.startsWith("```")) {
            cleanResult = cleanResult.replace(/^```(markdown)?\s*/i, "").replace(/\s*```$/i, "");
        }
        return cleanResult;
    },

    // 2. Health Assessment
    async generateHealthAssessment(recordData, memberProfile) {
        let extraInfo = '';
        if (recordData.bp || recordData.hr || recordData.temp || recordData.spo2) {
            extraInfo += `\n- Sinh hiệu: HA ${recordData.bp || '-'}, Nhịp tim ${recordData.hr || '-'}, Nhiệt độ ${recordData.temp || '-'}, SpO2 ${recordData.spo2 || '-'}%`;
        }
        if (recordData.symptoms) extraInfo += `\n- Triệu chứng: ${recordData.symptoms}`;
        if (recordData.labs) extraInfo += `\n- Cận lâm sàng: ${recordData.labs}`;
        if (recordData.dynamicFields && recordData.dynamicFields.length > 0) {
            extraInfo += `\n- Chỉ số chi tiết: ` + recordData.dynamicFields.map(f => `${f.key}: ${f.value} ${f.isAbnormal ? '(Bất thường)' : ''}`).join(', ');
        }

        const prompt = `Bạn là một bác sĩ gia đình tận tâm, thân thiện. Dựa vào hồ sơ dưới đây, hãy đưa ra nhận xét chuyên sâu về sức khỏe và lời khuyên y tế chi tiết.
Trình bày bằng định dạng Markdown rõ ràng, dễ đọc.
*LƯU Ý QUAN TRỌNG VỀ XƯNG HÔ:* Tên bệnh nhân có thể là các danh xưng trong gia đình (Ba, Mẹ, Vợ, Chồng, Anh, Em...). Tuyệt đối không tự ý ghép thêm từ "Bác", "Chú", "Cô" vào trước các danh xưng này (Ví dụ: Không gọi là "Bác Ba", "Cô Mẹ"). Hãy xưng là "Bác sĩ" và gọi bệnh nhân là "bạn", hoặc gọi trực tiếp bằng danh xưng gia đình đó một cách lịch sự.

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
- Phân loại: ${recordData.type}
- Phương án điều trị / Thuốc: ${recordData.treatment}${extraInfo}

Vui lòng phân tích và đưa ra nhận xét:
1. Đánh giá chi tiết về tình trạng hiện tại dựa trên chẩn đoán, triệu chứng, kết quả cận lâm sàng và bệnh lý nền.
2. Phân tích các chỉ số xét nghiệm/sinh hiệu bất thường (nếu có) và giải thích ý nghĩa của chúng.
3. Lời khuyên cụ thể về cách sinh hoạt, chế độ dinh dưỡng, vận động để cải thiện tình trạng.
4. Những dấu hiệu nguy hiểm cần theo dõi thêm và khi nào cần đi tái khám.`;

        const provider = DataManager.getActiveProvider();
        if (provider === 'openai') {
            return await this.callOpenAI(prompt);
        } else if (provider === 'anthropic') {
            return await this.callAnthropic(prompt);
        } else {
            // BUG ĐÃ SỬA: trước đây gọi callGeminiAPI(prompt, null, false, true) — tham số thứ 4
            // (overrideModel) bị truyền nhầm giá trị boolean `true` thay vì tên model/`null`.
            // Hệ quả: URL gọi API trở thành ".../models/true:generateContent" và luôn lỗi 404
            // mỗi khi dùng Gemini (nhà cung cấp mặc định) cho tính năng Nhận xét AI / Tra cứu bệnh.
            return await this.callGeminiAPI(prompt, null, false);
        }
    },

    // 3. Tra cứu chuyên sâu về bệnh
    async searchDiseaseInfo(diseaseName) {
        // Lưu ý: đầu vào có thể là một chẩn đoán chính thức ("Trào ngược dạ dày") HOẶC chỉ là
        // tóm tắt kết quả xét nghiệm/triệu chứng (khi hồ sơ chưa có kết luận của bác sĩ, ví dụ
        // phiếu xét nghiệm máu chưa được bác sĩ chẩn đoán) — nên prompt không mặc định đây đã
        // là một bệnh được chẩn đoán chính thức, để AI tự nhận diện và tra cứu phù hợp.
        const prompt = `Bạn là một Bác sĩ và Chuyên gia y khoa hàng đầu thế giới. Dưới đây là thông tin y tế của bệnh nhân (có thể là tên bệnh/chẩn đoán chính thức, hoặc chỉ là tóm tắt kết quả xét nghiệm/triệu chứng nếu hồ sơ chưa có kết luận chẩn đoán): "${diseaseName}".
Họ muốn tìm hiểu chuyên sâu về tình trạng này trên Internet để nắm rõ tình hình.
Nếu thông tin trên chưa phải một chẩn đoán cụ thể (chỉ là chỉ số/kết quả xét nghiệm), hãy dựa vào kiến thức y khoa để nêu các khả năng/tình trạng liên quan có thể gặp, trước khi đi vào các mục dưới đây.
Vui lòng cung cấp một bài viết tham khảo y khoa chi tiết, sử dụng định dạng Markdown rõ ràng, bao gồm:
1. **Tổng quan:** Đây là bệnh/tình trạng gì (hoặc kết quả xét nghiệm này có thể liên quan đến những vấn đề gì)? Nguyên nhân chính?
2. **Triệu chứng thường gặp:** Các dấu hiệu nhận biết từ nhẹ đến nặng.
3. **Biến chứng nguy hiểm:** Nếu không điều trị tốt sẽ dẫn đến hậu quả gì?
4. **Phương pháp điều trị hiện đại nhất hiện nay:** Thuốc, phẫu thuật, hoặc lối sống.
5. **Cách phòng ngừa và chăm sóc tại nhà:** (Dành cho bản thân người bệnh và gia đình).

Hãy viết với văn phong đồng cảm, khoa học, chính xác, nhưng dễ hiểu đối với người không có chuyên môn y tế. Nếu thông tin đầu vào chưa đủ để kết luận chắc chắn, hãy nói rõ đây chỉ là tham khảo và khuyên bệnh nhân gặp bác sĩ để có chẩn đoán chính xác.`;

        const provider = DataManager.getActiveProvider();
        if (provider === 'openai') {
            return await this.callOpenAI(prompt);
        } else if (provider === 'anthropic') {
            return await this.callAnthropic(prompt);
        } else {
            // BUG ĐÃ SỬA: trước đây gọi callGeminiAPI(prompt, null, false, true) — tham số thứ 4
            // (overrideModel) bị truyền nhầm giá trị boolean `true` thay vì tên model/`null`.
            // Hệ quả: URL gọi API trở thành ".../models/true:generateContent" và luôn lỗi 404
            // mỗi khi dùng Gemini (nhà cung cấp mặc định) cho tính năng Nhận xét AI / Tra cứu bệnh.
            return await this.callGeminiAPI(prompt, null, false);
        }
    }
};
