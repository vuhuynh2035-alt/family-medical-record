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

                    // Bắt lỗi Hết hạn mức / Quá giới hạn request (429 RESOURCE_EXHAUSTED)
                    const isQuotaExceeded = response.status === 429 || data.error?.status === 'RESOURCE_EXHAUSTED' || /quota|rate limit|resource_exhausted/i.test(apiMsg);
                    if (isQuotaExceeded) {
                        const isPerMinute = /minute|rpm|per minute/i.test(apiMsg);
                        if (isPerMinute) {
                            throw new Error(`Đã đạt giới hạn gửi yêu cầu/phút của Google Gemini (Rate Limit). Vui lòng đợi khoảng 1 phút rồi thử lại.`);
                        }
                        throw new Error(`Hết hạn mức sử dụng (Quota Exceeded) từ tài khoản Google Gemini. Vui lòng tạo API Key mới từ tài khoản Google khác và dán vào Cài đặt > "Lưu cài đặt", hoặc chuyển sang ChatGPT/Claude để dự phòng.`);
                    }

                    // Bắt lỗi Quá tải máy chủ (503 / High Demand)
                    const isOverloadStatus = response.status === 503 || /high demand|overloaded|unavailable/i.test(apiMsg);
                    if (isOverloadStatus) {
                        throw new Error(`Hệ thống AI của Google hiện đang bị quá tải tạm thời (503 High Demand). Vui lòng đợi 1-2 phút rồi thử lại, hoặc vào Cài đặt để đổi sang ChatGPT/Claude.`);
                    }

                    throw new Error(apiMsg);
                }

                if (data.candidates && data.candidates.length > 0) {
                    return data.candidates[0].content.parts[0].text;
                } else {
                    throw new Error("Không nhận được phản hồi hợp lệ từ AI.");
                }
            } catch (error) {
                const isOverloaded = error.message.includes("quá tải") || error.message.includes("high demand") || error.message.includes("503") || error.message.includes("overloaded");
                attempts++;
                if (isOverloaded && attempts < maxAttempts) {
                    console.warn(`Gemini API overloaded. Retrying in 2 seconds... (Attempt ${attempts}/${maxAttempts})`);
                    await new Promise(r => setTimeout(r, 2000));
                } else {
                    console.error("Gemini API Error:", error);
                    throw error;
                }
            }
        }
    },

    async callOpenAI(prompt, temperature = 0.3) {
        const apiKey = DataManager.getOpenAIApiKey();
        if (!apiKey) throw new Error("Vui lòng thiết lập OpenAI API Key trong Cài đặt.");
        const model = DataManager.getOpenAIModel();
        
        let bodyObj = {
            model: model.trim(),
            messages: [{ role: "user", content: prompt }]
        };
        
        // Các model dòng o1/o3 của OpenAI không hỗ trợ tùy chỉnh temperature
        const lowerModel = bodyObj.model.toLowerCase();
        if (!lowerModel.startsWith('o1') && !lowerModel.startsWith('o3')) {
            bodyObj.temperature = temperature;
        }

        const callApi = async (bodyPayload) => {
            const response = await this._fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify(bodyPayload)
            });
            const data = await response.json();
            return { response, data };
        };

        let { response, data } = await callApi(bodyObj);

        // Fallback tự động nếu API từ chối tham số temperature (ví dụ model là o1 nhưng tên bị đặt khác đi hoặc API thay đổi chính sách)
        if (!response.ok && data.error && data.error.message && data.error.message.includes('temperature') && data.error.message.includes('supported')) {
            console.warn("OpenAI API rejected the temperature parameter. Retrying without temperature...");
            delete bodyObj.temperature;
            const retry = await callApi(bodyObj);
            response = retry.response;
            data = retry.data;
        }

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
        const prompt = `Bạn là một trợ lý y tế chuyên nghiệp. Hãy đọc toàn bộ các hình ảnh đính kèm (phiếu kết quả xét nghiệm, hồ sơ khám bệnh, sổ tiêm chủng, đơn thuốc, phim X-quang, v.v.) và tổng hợp trích xuất các thông tin sau. Nếu có nhiều ảnh, hãy kết hợp thông tin một cách logic.
TUYỆT ĐỐI CHỈ TRẢ VỀ JSON, KHÔNG THÊM BẤT KỲ ĐOẠN VĂN BẢN HAY LỜI CHÀO NÀO KHÁC. Trích xuất dữ liệu thành cấu trúc JSON nghiêm ngặt với các key sau:
- "date": Ngày khám/tiêm chủng (định dạng YYYY-MM-DD). Nếu không có, hãy để chuỗi rỗng "".
- "hospital": Tên bệnh viện, trạm y tế hoặc trung tâm tiêm chủng.
- "doctor": Tên bác sĩ điều trị/người tiêm.
- "type": Phân loại khám. BẮT BUỘC chọn ĐÚNG NGUYÊN VĂN một trong các giá trị sau (không tự đặt ra giá trị khác, không diễn giải lại bằng từ ngữ khác dù ý nghĩa tương đương — luôn chọn đúng 1 nhãn có sẵn dưới đây để cùng một loại hồ sơ luôn được phân loại nhất quán giữa các lần đọc khác nhau): "Khám sức khỏe tổng quát", "Bệnh lý cấp tính (Nhẹ)", "Bệnh lý cấp tính (Nặng)", "Bệnh lý mạn tính", "Khám thai", "Tiêm chủng", "Nha khoa". Nếu là phiếu/sổ tiêm phòng vắc xin, BẮT BUỘC chọn "Tiêm chủng". Nếu ảnh chỉ là phiếu kết quả xét nghiệm đơn thuần, chọn "Khám sức khỏe tổng quát".
- "bp": Huyết áp (vd: "120/80").
- "hr": Nhịp tim (vd: 80 - số nguyên).
- "temp": Nhiệt độ (vd: 37.0 - số thực).
- "spo2": Nồng độ oxy trong máu (vd: 98 - số nguyên).
- "symptoms": Lý do khám hoặc các triệu chứng lâm sàng.
- "labs": Tóm tắt các kết quả xét nghiệm cận lâm sàng (máu, X-Quang, siêu âm...).
- "disease": Chẩn đoán bệnh hoặc tên vắc xin tiêm chủng (kèm số mũi, vd: "Tiêm vắc xin 6 trong 1 (Hexaxim) mũi 1").
- "treatment": Phương án điều trị. NẾU CÓ ĐƠN THUỐC, BẮT BUỘC PHẢI GHI CHÉP LẠI ĐẦY ĐỦ VÀ CHI TIẾT TOÀN BỘ CÁC LOẠI THUỐC, LIỀU LƯỢNG, CÁCH DÙNG, SỐ NGÀY UỐNG (TUYỆT ĐỐI KHÔNG ĐƯỢC TÓM TẮT HAY BỎ SÓT BẤT KỲ LOẠI THUỐC NÀO DÙ CÓ NHIỀU ĐƠN THUỐC ĐI KÈM). Nếu là vắc xin thì ghi tên, số lô, đường tiêm.
- "note": Lời khuyên của bác sĩ, kiêng cữ. NẾU CÓ NHIỀU ẢNH HOẶC NHIỀU ĐƠN THUỐC, BẮT BUỘC TỔNG HỢP VÀ GHI RÕ NGÀY THÁNG CỦA **TẤT CẢ** CÁC LỊCH HẸN TÁI KHÁM, XÉT NGHIỆM TỪ TẤT CẢ CÁC TRANG VÀO ĐÂY (không được bỏ sót lịch hẹn nào).
- "cost": Tổng chi phí (chỉ lấy con số, ví dụ 500000. Nếu không thấy, trả về 0).
- "dynamicFields": Mảng các chỉ số xét nghiệm chi tiết hoặc chuyên sâu. Mỗi phần tử là một object có "key" (Tên chỉ số, vd: "Glucose"), "value" (Kết quả kèm đơn vị), "isAbnormal" (boolean: true/false), và "explanation" (Giải thích siêu ngắn 1 câu về ý nghĩa của chỉ số này để hiển thị nhanh cho người dùng, vd: "Đường huyết, dùng để theo dõi bệnh tiểu đường"). Nếu không có, để mảng rỗng [].
- "vaccineInfo": Nếu đây là hồ sơ tiêm chủng, trả về object: { "name": string, "dose": number/string, "diseaseTarget": string, "nextDoseDate": "YYYY-MM-DD", "nextDoseTitle": string, "careInstructions": string, "sideEffects": string }. Nếu không phải tiêm chủng, để null.

Nếu bất kỳ thông tin nào không thể tìm thấy trong ảnh, hãy để chuỗi rỗng "" (hoặc 0 đối với số, [] đối với mảng, null đối với vaccineInfo).`;

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

        const provider = DataManager.getProviderAssessment();
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

    // Đánh giá xu hướng sức khỏe từ toàn bộ hồ sơ
    async evaluateHealthTrend(records, memberProfile) {
        // Sắp xếp records theo thời gian tăng dần
        const sortedRecords = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        let recordsText = '';
        sortedRecords.forEach((recordData, index) => {
            let extraInfo = '';
            if (recordData.bp || recordData.hr || recordData.temp || recordData.spo2) {
                extraInfo += `\n- Sinh hiệu: HA ${recordData.bp || '-'}, Nhịp tim ${recordData.hr || '-'}, Nhiệt độ ${recordData.temp || '-'}, SpO2 ${recordData.spo2 || '-'}%`;
            }
            if (recordData.symptoms) extraInfo += `\n- Triệu chứng: ${recordData.symptoms}`;
            if (recordData.labs) extraInfo += `\n- Cận lâm sàng: ${recordData.labs}`;
            if (recordData.dynamicFields && recordData.dynamicFields.length > 0) {
                extraInfo += `\n- Chỉ số chi tiết: ` + recordData.dynamicFields.map(f => `${f.key}: ${f.value} ${f.isAbnormal ? '(Bất thường)' : ''}`).join(', ');
            }
            recordsText += `
--- Lần khám ${index + 1} (${recordData.date}) ---
- Bệnh viện/Phòng khám: ${recordData.hospital}
- Chẩn đoán: ${recordData.disease}
- Phương án điều trị / Thuốc: ${recordData.treatment}${extraInfo}
`;
        });

        const prompt = `Bạn là một bác sĩ gia đình tận tâm và chuyên gia phân tích dữ liệu y tế. Dưới đây là toàn bộ lịch sử khám bệnh của bệnh nhân từ trước đến nay, được sắp xếp theo thời gian tăng dần. Hãy phân tích và đưa ra đánh giá xu hướng sức khỏe tổng thể.
Trình bày bằng định dạng Markdown rõ ràng, dễ đọc.
*LƯU Ý QUAN TRỌNG VỀ XƯNG HÔ:* Tên bệnh nhân có thể là các danh xưng trong gia đình (Ba, Mẹ, Vợ, Chồng, Anh, Em...). Tuyệt đối không tự ý ghép thêm từ "Bác", "Chú", "Cô" vào trước các danh xưng này (Ví dụ: Không gọi là "Bác Ba", "Cô Mẹ"). Hãy xưng là "Bác sĩ" và gọi bệnh nhân là "bạn", hoặc gọi trực tiếp bằng danh xưng gia đình đó một cách lịch sự.

[Thông tin Bệnh nhân]
- Tên: ${memberProfile.name}
- Ngày sinh: ${memberProfile.dob}
- Nhóm máu: ${memberProfile.blood || "Chưa rõ"}
- Bệnh lý nền: ${memberProfile.conditions || "Không có"}

[Lịch sử khám bệnh]
${recordsText}

Vui lòng phân tích và xuất Báo cáo Đánh giá Xu hướng Sức khỏe gồm các phần sau:
1. **Tổng kết chung:** Tóm tắt ngắn gọn tình trạng sức khỏe của bệnh nhân qua các đợt khám (ví dụ: đang tốt lên, giữ nguyên, hay xấu đi).
2. **Biến động chỉ số (Đặc biệt chú ý Đường huyết & Huyết áp):** So sánh sự thay đổi của các chỉ số sinh tồn (Huyết áp, Nhịp tim...) và các chỉ số xét nghiệm (đặc biệt là Đường huyết, mỡ máu...) qua các lần khám. Nếu có chỉ số nào đang tăng dần/giảm dần, tiến sát hoặc vượt ngưỡng nguy hiểm, hãy phân tích chi tiết và nhấn mạnh ảnh hưởng của nó đến sức khỏe tổng thể. Có thể dùng bảng (table markdown) để so sánh các chỉ số nếu thấy cần thiết. (QUAN TRỌNG: Ở bảng so sánh, tiêu đề cột chứa ngày tháng HÃY VIẾT THEO FORMAT RÚT GỌN dd/mm/yy, ví dụ: 25/06/25 thay vì 25/06/2025, để tiết kiệm diện tích hiển thị trên điện thoại).
3. **Phân tích bệnh lý:** Các bệnh lý nào thường xuyên lặp lại hoặc có xu hướng tiến triển? Nguyên nhân có thể do đâu?
4. **Kế hoạch hành động:** Đưa ra lời khuyên thiết thực về cách theo dõi sức khỏe tại nhà, thay đổi chế độ dinh dưỡng, vận động, và lịch tái khám định kỳ để cải thiện tình hình sức khỏe hiện tại, tập trung vào việc ổn định huyết áp và đường huyết nếu bệnh nhân có tiền sử bất thường.`;

        const provider = DataManager.getProviderTrend();
        if (provider === 'openai') {
            return await this.callOpenAI(prompt);
        } else if (provider === 'anthropic') {
            return await this.callAnthropic(prompt);
        } else {
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

        const provider = DataManager.getProviderSearch();
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

    /**
     * 4. Trợ lý AI Hướng dẫn sử dụng phần mềm
     */
    async askHelpAssistant(userQuestion) {
        const systemInstruction = `Bạn là Trợ lý AI Chăm sóc khách hàng của ứng dụng "Hồ sơ Sức khỏe Gia đình" (Medical Record App). 
Nhiệm vụ của bạn là hướng dẫn người dùng cách sử dụng các tính năng trong phần mềm này. 
Đây là một ứng dụng web chạy hoàn toàn offline (dữ liệu lưu trên LocalStorage của trình duyệt).

Các tính năng chính của phần mềm:
1. Quản lý thành viên: Thêm, sửa, xóa thành viên gia đình ở Trang chủ. Hệ thống tự tính tuổi.
2. Hồ sơ bệnh án: Trong chi tiết từng người, có thể thêm hồ sơ khám bệnh mới. Tính năng "Quét thông minh bằng AI" (biểu tượng phép thuật màu xanh) cho phép người dùng tải lên ảnh phiếu khám/xét nghiệm để hệ thống (Gemini 1.5 Flash) tự động đọc và điền Form, kèm theo tạo báo cáo y khoa.
3. Phân tích AI & Tra cứu: Mỗi hồ sơ có nút "Phân tích AI" để giải thích các chỉ số xét nghiệm phức tạp. Ngoài ra có nút "Tra cứu" để tìm hiểu chuyên sâu về một loại bệnh trên mạng. Cần phải thiết lập API Key (Gemini, OpenAI, Anthropic) trong Cài đặt để sử dụng.
4. Đánh giá xu hướng: Ở mục Hồ sơ, nút "Đánh giá xu hướng" sẽ gửi toàn bộ lịch sử bệnh án cho AI để tìm ra các rủi ro sức khỏe tiềm ẩn.
5. Nhắc nhở (Lịch hẹn): Lên lịch khám lại, uống thuốc. Đến ngày hệ thống sẽ có chấm đỏ ở quả chuông.
6. Bảo mật & Cài đặt: Có thể cài mã PIN (4-6 số) để bảo vệ dữ liệu. Hỗ trợ mở khóa bằng Sinh trắc học (Vân tay/Khuôn mặt) qua WebAuthn. Trong Cài đặt cũng có nút Khôi phục cài đặt gốc để xóa sạch mọi thứ. Có thể Tải danh sách model mới của OpenAI/Anthropic để cập nhật model AI.

Hãy trả lời câu hỏi sau của người dùng một cách ngắn gọn, dễ hiểu, thân thiện, và định dạng bằng Markdown (in đậm, danh sách) để dễ đọc:
Câu hỏi của người dùng: "${userQuestion}"`;

        const provider = DataManager.getProviderSearch(); // Sử dụng chung provider của tính năng Tra cứu
        if (provider === 'openai') {
            return await this.callOpenAI(systemInstruction);
        } else if (provider === 'anthropic') {
            return await this.callAnthropic(systemInstruction);
        } else {
            return await this.callGeminiAPI(systemInstruction, null, false);
        }
    },

    // 5. Phân tích thuốc chuyên sâu
    async analyzeMedications(treatmentText) {
        const prompt = `Bạn là một dược sĩ lâm sàng giàu kinh nghiệm. Dưới đây là nội dung phần "Điều trị / Thuốc" trích xuất từ một hồ sơ khám bệnh:
"${treatmentText}"

Hãy phân tích chuyên sâu về các loại thuốc (nếu có) trong nội dung trên. Yêu cầu định dạng bằng Markdown rõ ràng, dễ đọc, với các mục sau cho mỗi loại thuốc:
- **Tên thuốc & Tác dụng chính:** Thuốc này dùng để chữa gì?
- **Tác dụng phụ thường gặp:** Những triệu chứng cần lưu ý.
- **Tương tác thuốc & Lưu ý khi dùng:** Có kiêng kỵ thức ăn nào không? Uống lúc no hay đói?

Nếu văn bản trên không chứa tên thuốc rõ ràng hoặc chỉ là lời khuyên chung chung, hãy giải thích ngắn gọn ý nghĩa của lời khuyên đó.
*LƯU Ý QUAN TRỌNG:* Cuối bài, luôn thêm dòng cảnh báo in nghiêng: "*Lưu ý: Thông tin trên chỉ mang tính chất tham khảo. Vui lòng luôn tuân thủ chính xác liều lượng và chỉ định của Bác sĩ điều trị. Không tự ý ngưng thuốc.*"`;

        const provider = DataManager.getProviderChat(); // Phân tích thuốc dùng chung provider với Chat
        if (provider === 'openai') {
            return await this.callOpenAI(prompt);
        } else if (provider === 'anthropic') {
            return await this.callAnthropic(prompt);
        } else {
            return await this.callGeminiAPI(prompt, null, false);
        }
    },

    // 6. Hỏi đáp AI với Hồ sơ bệnh án
    async chatWithRecord(record, chatHistory, userMessage) {
        // Chuẩn bị context hồ sơ
        let recordContext = `THÔNG TIN HỒ SƠ KHÁM BỆNH:
- Ngày khám: ${record.date || 'Không rõ'}
- Nơi khám: ${record.hospital || 'Không rõ'}
- Chẩn đoán: ${record.disease || 'Không rõ'}
- Điều trị/Thuốc: ${record.treatment || 'Không'}
- Ghi chú/Lời khuyên: ${record.note || 'Không'}
- Triệu chứng: ${record.symptoms || 'Không'}
- Cận lâm sàng: ${record.labs || 'Không'}
- Sinh hiệu: HA ${record.bp || '-'}, Nhịp tim ${record.hr || '-'}, Nhiệt độ ${record.temp || '-'}, SpO2 ${record.spo2 || '-'}
`;
        if (record.dynamicFields && record.dynamicFields.length > 0) {
            recordContext += "- Các chỉ số xét nghiệm chi tiết:\n";
            record.dynamicFields.forEach(f => {
                recordContext += `  + ${f.key}: ${f.value} ${f.isAbnormal ? '(BẤT THƯỜNG)' : ''}\n`;
            });
        }

        const systemPrompt = `Bạn là một trợ lý y tế AI. Dựa vào DUY NHẤT [THÔNG TIN HỒ SƠ KHÁM BỆNH] được cung cấp dưới đây, hãy trả lời câu hỏi của người bệnh một cách ngắn gọn, thân thiện và dễ hiểu.
Nếu câu hỏi vượt ra ngoài phạm vi thông tin của hồ sơ, hãy dựa vào kiến thức y khoa nền tảng nhưng phải nói rõ: "Dựa vào kiến thức y khoa chung...".
TUYỆT ĐỐI KHÔNG kê đơn thuốc mới, KHÔNG khuyên đổi liều thuốc, KHÔNG đưa ra chẩn đoán thay thế bác sĩ. 
Nếu người dùng hỏi ý kiến chẩn đoán nghiêm trọng, hãy khuyên họ tái khám.

[THÔNG TIN HỒ SƠ KHÁM BỆNH]
${recordContext}
`;
        
        let fullPrompt = systemPrompt + "\n\n[LỊCH SỬ TRÒ CHUYỆN]\n";
        if (chatHistory && chatHistory.length > 0) {
            chatHistory.forEach(msg => {
                const roleName = msg.role === 'user' ? 'Bệnh nhân' : 'Trợ lý AI';
                fullPrompt += `${roleName}: ${msg.content}\n`;
            });
        } else {
            fullPrompt += "(Chưa có)\n";
        }
        
        fullPrompt += `\nBệnh nhân vừa hỏi: "${userMessage}"\nHãy đóng vai Trợ lý AI để trả lời câu hỏi trên ngay lập tức. Đừng lặp lại câu hỏi.`;

        const provider = DataManager.getProviderChat();
        if (provider === 'openai') {
            return await this.callOpenAI(fullPrompt, 0.4);
        } else if (provider === 'anthropic') {
            return await this.callAnthropic(fullPrompt, 0.4);
        } else {
            return await this.callGeminiAPI(fullPrompt, null, false, null, 0.4);
        }
    },

    async getShortExplanation(keyword, disease, treatment) {
        
        let prompt = `Bạn là chuyên gia y tế. Bệnh nhân đang được chẩn đoán: "${disease || 'Không rõ'}". Đơn thuốc: "${treatment || 'Không có'}".
Hãy giải thích SIÊU NGẮN GỌN (chỉ 2-3 câu) về chỉ số/thuật ngữ y khoa sau: "${keyword}".
Không cần lời chào hỏi, đi thẳng vào giải thích ý nghĩa.`;

        const provider = DataManager.getProviderChat();
        if (provider === 'openai') {
            return await this.callOpenAI(prompt, 0.2);
        } else if (provider === 'anthropic') {
            return await this.callAnthropic(prompt, 0.2);
        } else {
            return await this.callGeminiAPI(prompt, null, false, null, 0.2);
        }
    },

    async extractSmartReminders(recordData) {
        const settings = DataManager.getSettings();
        const tMorning = settings.medTimeMorning || '08:00';
        const tNoon = settings.medTimeNoon || '12:00';
        const tAfternoon = settings.medTimeAfternoon || '14:00';
        const tEvening = settings.medTimeEvening || '20:00';

        const prompt = `Hôm nay là: ${recordData.date}. Dựa vào hồ sơ dưới đây, hãy trích xuất lịch hẹn thông minh.
- Chẩn đoán: ${recordData.disease || 'Không rõ'}
- Đơn thuốc/Điều trị: ${recordData.treatment || 'Không rõ'}
- Ghi chú: ${recordData.note || 'Không rõ'}
- Loại hồ sơ: ${recordData.type || 'Không rõ'}

Nhiệm vụ của bạn là phân tích và trả về ĐÚNG 1 ĐỐI TƯỢNG JSON ĐƠN THUẦN (không bọc trong \`\`\`json markdown), có định dạng sau:
{
  "medications": [
    {
      "name": "Tên thuốc",
      "days": 5, // số ngày uống (số nguyên, mặc định 5 nếu không rõ)
      "times": ["${tMorning}", "${tEvening}"], // mảng các giờ uống tự suy luận logic. Tham khảo giờ mặc định: Sáng=${tMorning}, Trưa=${tNoon}, Chiều=${tAfternoon}, Tối=${tEvening}.
      "usage": "Uống trước khi ăn", // Cách dùng (trước ăn/sau ăn/ngậm/thoa...)
      "purpose": "Giảm đau, hạ sốt", // Công dụng (ngắn gọn)
      "contraindications": "Không dùng chung với rượu bia" // Chống chỉ định hoặc lưu ý quan trọng (nếu có)
    }
  ],
  "followups": [
      {
        "title": "Tên lịch hẹn (vd: Tái khám, Xét nghiệm máu, Siêu âm, Nhắc nhở tiêm)",
        "date": "YYYY-MM-DD", // ngày hẹn. NẾU BÁC SĨ CHỈ GHI "sau 3 tháng" HAY "sau 1 tuần", HÃY TỰ TÍNH TOÁN RA NGÀY YYYY-MM-DD CHÍNH XÁC TỪ NGÀY KHÁM.
          "note": "Ghi chú hẹn chi tiết (BẮT BUỘC giữ lại ĐẦY ĐỦ các chỉ định xét nghiệm, siêu âm...)"
        }
    ]
  }
  
  Chú ý quan trọng về Lịch hẹn (followups):
  - BẮT BUỘC TÁCH RIÊNG từng mục khám/xét nghiệm thành một lịch hẹn độc lập trong mảng `followups`. Ví dụ: nếu bác sĩ dặn "Sau 3 tháng tái khám, xét nghiệm máu, siêu âm", bạn PHẢI tạo 3 object riêng biệt (1 cái Tái khám, 1 cái Xét nghiệm máu, 1 cái Siêu âm), TUYỆT ĐỐI KHÔNG gộp chung lại thành 1 lịch dù chúng diễn ra cùng ngày!
}

Chú ý:
- Nếu hồ sơ KHÔNG CÓ đơn thuốc, trả về "medications": [].
- Hãy đoán giờ uống hợp lý. Nếu bác sĩ ghi rõ giờ thì lấy đúng giờ đó. Nếu chỉ nói "uống 2 lần" hoặc "sáng tối", hãy dùng đúng mốc giờ mặc định: Sáng=${tMorning}, Tối=${tEvening}.`;

        try {
            let resText = '';
            const provider = DataManager.getProviderAssessment();
            if (provider === 'openai') {
                resText = await this.callOpenAI(prompt, 0.1, true);
            } else if (provider === 'anthropic') {
                resText = await this.callAnthropic(prompt, 0.1);
            } else {
                resText = await this.callGeminiAPI(prompt, null, true, null, 0.1);
            }

            let cleanResult = resText.trim();
            if (cleanResult.startsWith("```json")) cleanResult = cleanResult.replace(/^```json/, "");
            else if (cleanResult.startsWith("```")) cleanResult = cleanResult.replace(/^```/, "");
            if (cleanResult.endsWith("```")) cleanResult = cleanResult.replace(/```$/, "");
            
            return JSON.parse(cleanResult.trim());
        } catch (err) {
            console.error("Smart Reminder extraction error:", err);
            return null;
        }
    },

    // ==================== 7. VACCINE INTELLIGENCE (HỖ TRỢ TIÊM CHỦNG THÔNG MINH) ====================
    VACCINE_DATABASE: [
        {
            id: '6in1',
            keywords: ['6 trong 1', '6in1', '6 in 1', 'hexaxim', 'infanrix hexa', 'bạch hầu, ho gà, uốn ván, bại liệt, hib, viêm gan b'],
            name: 'Vắc xin 6 trong 1 (Hexaxim / Infanrix Hexa)',
            disease: 'Phòng 6 bệnh nguy hiểm: Bạch hầu, Ho gà, Uốn ván, Bại liệt, Viêm gan B và các bệnh do vi khuẩn Hib (Viêm phổi, Viêm màng não mủ).',
            schedule: 'Phác đồ 3 mũi cơ bản (2, 3, 4 tháng tuổi - mỗi mũi cách nhau 1 tháng), mũi 4 nhắc lại lúc 16-18 tháng tuổi.',
            totalDoses: 4,
            nextDoseRules: {
                1: { nextDose: 2, intervalDays: 30, title: 'Tiêm mũi 2 vắc xin 6 trong 1 (Hexaxim/Infanrix)' },
                2: { nextDose: 3, intervalDays: 30, title: 'Tiêm mũi 3 vắc xin 6 trong 1 (Hexaxim/Infanrix)' },
                3: { nextDose: 4, intervalDays: 365, title: 'Tiêm mũi 4 nhắc lại vắc xin 6 trong 1 (lúc 16-18 tháng tuổi)' }
            },
            sideEffects: 'Sốt nhẹ 37.5°C - 38.5°C (thường trong 24-48h đầu), sưng đỏ, đau tại vị trí tiêm, quấy khóc nhẹ, biếng ăn thoáng qua.',
            careInstructions: 'Mặc quần áo thoáng mát, thấm hút mồ hôi. Chườm mát (khăn sạch thấm nước mát) tại vị trí tiêm để giảm sưng đau, tuyệt đối KHÔNG đắp khoai tây hay chanh lên vết tiêm. Cho bú nhiều lần hoặc uống nhiều nước. Dùng hạ sốt Paracetamol (10-15mg/kg/lần) nếu sốt >= 38.5°C.',
            warningSigns: 'Sốt cao liên tục >= 39°C không đáp ứng thuốc hạ sốt, co giật, khóc thét liên tục > 3 giờ, khó thở, thở rít, tím tái quanh môi, li bì khó đánh thức, phát ban toàn thân.'
        },
        {
            id: '5in1',
            keywords: ['5 trong 1', '5in1', '5 in 1', 'pentaxim', 'quinvaxem', 'sii'],
            name: 'Vắc xin 5 trong 1 (Pentaxim / SII)',
            disease: 'Phòng 5 bệnh: Bạch hầu, Ho gà, Uốn ván, Bại liệt (hoặc Viêm gan B), và Hib.',
            schedule: 'Phác đồ 3 mũi cơ bản (2, 3, 4 tháng tuổi - mỗi mũi cách 1 tháng), mũi 4 nhắc lại lúc 16-18 tháng.',
            totalDoses: 4,
            nextDoseRules: {
                1: { nextDose: 2, intervalDays: 30, title: 'Tiêm mũi 2 vắc xin 5 trong 1' },
                2: { nextDose: 3, intervalDays: 30, title: 'Tiêm mũi 3 vắc xin 5 trong 1' },
                3: { nextDose: 4, intervalDays: 365, title: 'Tiêm mũi 4 nhắc lại vắc xin 5 trong 1' }
            },
            sideEffects: 'Sốt nhẹ, quấy khóc, sưng đỏ vết tiêm trong 1-2 ngày.',
            careInstructions: 'Theo dõi nhiệt độ mỗi 2-4h, cho trẻ bú nhiều, dùng thuốc hạ sốt theo chỉ định khi sốt >= 38.5°C.',
            warningSigns: 'Sốt cao liên tục, co giật, thở gấp, tím tái.'
        },
        {
            id: 'pneumo',
            keywords: ['phế cầu', 'synflorix', 'prevenar', 'prevenar 13', 'streptococcus pneumoniae'],
            name: 'Vắc xin Phế cầu (Synflorix / Prevenar 13)',
            disease: 'Phòng ngừa Viêm phổi, Viêm màng não, Viêm tai giữa cấp và Nhiễm trùng huyết do phế cầu khuẩn Streptococcus pneumoniae.',
            schedule: 'Trẻ nhỏ: 3 mũi cơ bản (cách nhau 1 tháng) + 1 mũi nhắc lại sau mũi 3 ít nhất 6 tháng (lúc 11-15 tháng tuổi). Người lớn/người già: 1 liều duy nhất.',
            totalDoses: 4,
            nextDoseRules: {
                1: { nextDose: 2, intervalDays: 30, title: 'Tiêm mũi 2 vắc xin Phế cầu (Synflorix/Prevenar)' },
                2: { nextDose: 3, intervalDays: 30, title: 'Tiêm mũi 3 vắc xin Phế cầu' },
                3: { nextDose: 4, intervalDays: 180, title: 'Tiêm mũi 4 nhắc lại vắc xin Phế cầu' }
            },
            sideEffects: 'Đau, sưng cứng tại chỗ tiêm, sốt nhẹ, chán ăn, quấy khóc trong 24-48h.',
            careInstructions: 'Chườm mát chỗ tiêm, cho trẻ bú nhiều, không xoa dầu nóng vào vết tiêm.',
            warningSigns: 'Sốt cao >= 39°C, phát ban, thở rít, co giật.'
        },
        {
            id: 'rota',
            keywords: ['rota', 'rotarix', 'rotateq', 'rotavin'],
            name: 'Vắc xin ngừa Rota Virus (Rotarix / Rotateq / Rotavin)',
            disease: 'Phòng ngừa Viêm dạ dày - ruột cấp tính và Tiêu chảy mất nước nặng do Rotavirus.',
            schedule: 'Rotarix (uống 2 liều, cách 1 tháng, hoàn thành trước 6 tháng tuổi). Rotateq (uống 3 liều, cách 1 tháng, hoàn thành trước 8 tháng tuổi).',
            totalDoses: 2,
            nextDoseRules: {
                1: { nextDose: 2, intervalDays: 30, title: 'Uống liều 2 vắc xin ngừa Rota Virus' },
                2: { nextDose: 3, intervalDays: 30, title: 'Uống liều 3 vắc xin Rota (nếu dùng phác đồ Rotateq 3 liều)' }
            },
            sideEffects: 'Nôn trớ nhẹ, đi ngoài phân lỏng nhẹ trong 1-2 ngày.',
            careInstructions: 'Cho uống từng thìa nhỏ, không cho bú quá no ngay sau khi uống vắc xin 15-30 phút.',
            warningSigns: 'Nôn ói liên tục, tiêu chảy phân có máu, khóc thắt từng cơn do đau bụng.'
        },
        {
            id: 'flu',
            keywords: ['cúm', 'vaxigrip', 'vaxigrip tetra', 'influvac', 'gc flu', 'influenza'],
            name: 'Vắc xin Cúm mùa (Vaxigrip Tetra / Influvac Tetra)',
            disease: 'Phòng ngừa Cúm mùa do các chủng virus cúm A (H1N1, H3N2) và cúm B.',
            schedule: 'Trẻ 6 tháng - dưới 9 tuổi chưa từng tiêm cúm: 2 mũi cách nhau 1 tháng. Trẻ >= 9 tuổi và người lớn: 1 mũi/năm (tiêm nhắc định kỳ hàng năm).',
            totalDoses: 2,
            nextDoseRules: {
                1: { nextDose: 2, intervalDays: 30, title: 'Tiêm mũi 2 vắc xin Cúm mùa (hoặc tiêm nhắc hàng năm)' },
                2: { nextDose: 'Nhắc lại hàng năm', intervalDays: 365, title: 'Tiêm nhắc lại vắc xin Cúm mùa định kỳ hàng năm' }
            },
            sideEffects: 'Đau mỏi cơ, sưng nhẹ bắp tay, sốt nhẹ hoặc ớn lạnh thoáng qua trong 24h.',
            careInstructions: 'Nghỉ ngơi, uống đủ nước, vận động nhẹ nhàng cánh tay để giảm ê ẩm.',
            warningSigns: 'Khó thở, phát ban nổi mề đay toàn thân, sưng mặt hoặc môi.'
        },
        {
            id: 'hpv',
            keywords: ['hpv', 'gardasil', 'gardasil 9', 'gardasil 4', 'ung thư cổ tử cung', 'sùi mào gà'],
            name: 'Vắc xin HPV (Gardasil 9 / Gardasil 4)',
            disease: 'Phòng ngừa Ung thư cổ tử cung, ung thư âm hộ/âm đạo/hậu môn, ung thư vòm họng và sùi mào gà sinh dục do virus HPV.',
            schedule: 'Từ 9 - 14 tuổi: Phác đồ 2 mũi (0 - 6 tháng). Từ 15 - 45 tuổi: Phác đồ 3 mũi (0 - 2 - 6 tháng: mũi 2 cách mũi 1 là 2 tháng, mũi 3 cách mũi 2 là 4 tháng).',
            totalDoses: 3,
            nextDoseRules: {
                1: { nextDose: 2, intervalDays: 60, title: 'Tiêm mũi 2 vắc xin HPV (Gardasil)' },
                2: { nextDose: 3, intervalDays: 120, title: 'Tiêm mũi 3 vắc xin HPV (Gardasil)' }
            },
            sideEffects: 'Đau nhức bắp tay chỗ tiêm, sưng đỏ, sốt nhẹ, mệt mỏi hoặc đau đầu thoáng qua.',
            careInstructions: 'Ngồi nghỉ tại chỗ theo dõi ít nhất 30 phút sau tiêm để phòng ngừa phản xạ choáng ngất.',
            warningSigns: 'Choáng ngất kéo dài, nổi mề đay, khó thở, thở rít.'
        },
        {
            id: 'varicella',
            keywords: ['thủy đậu', 'varivax', 'varicella', 'varilrix', 'trái rạ'],
            name: 'Vắc xin Thủy đậu (Varivax / Varicella / Varilrix)',
            disease: 'Phòng bệnh Thủy đậu (Trái rạ) và các biến chứng nguy hiểm như viêm phổi, viêm não, nhiễm trùng da.',
            schedule: 'Trẻ em từ 9-12 tháng trở lên: 2 mũi. Trẻ nhỏ: Mũi 2 cách mũi 1 ít nhất 3 tháng (hoặc lúc 4-6 tuổi). Người lớn/trẻ >= 13 tuổi: Mũi 2 cách mũi 1 ít nhất 1 tháng.',
            totalDoses: 2,
            nextDoseRules: {
                1: { nextDose: 2, intervalDays: 90, title: 'Tiêm mũi 2 vắc xin Thủy đậu' }
            },
            sideEffects: 'Sưng đau vết tiêm, có thể nổi vài nốt ban dạng phỏng nước nhẹ sau 1-2 tuần.',
            careInstructions: 'Giữ vệ sinh da sạch sẽ, không chà xát hoặc làm vỡ các nốt ban nếu có.',
            warningSigns: 'Sốt cao, nốt phỏng mưng mủ lan rộng toàn thân, lơ mơ.'
        },
        {
            id: 'mmr',
            keywords: ['sởi', 'quai bị', 'rubella', 'mmr', 'mmr ii', 'priorix', 'sởi - quai bị - rubella'],
            name: 'Vắc xin Sởi - Quai bị - Rubella (MMR II / Priorix)',
            disease: 'Phòng 3 bệnh truyền nhiễm nguy hiểm: Sởi (viêm phổi, viêm não), Quai bị (viêm tinh hoàn/buồng trứng), và Rubella (hội chứng Rubella bẩm sinh).',
            schedule: 'Mũi 1 lúc 9 hoặc 12 tháng tuổi, mũi 2 nhắc lại sau 3-5 năm (lúc 4-6 tuổi) hoặc cách mũi 1 ít nhất 1 tháng đối với người lớn.',
            totalDoses: 2,
            nextDoseRules: {
                1: { nextDose: 2, intervalDays: 365 * 3, title: 'Tiêm mũi 2 nhắc lại vắc xin Sởi - Quai bị - Rubella (MMR)' }
            },
            sideEffects: 'Sốt nhẹ, phát ban dạng sởi thoáng qua sau 7-12 ngày, sưng nhẹ tuyến mang tai.',
            careInstructions: 'Theo dõi thân nhiệt, uống nhiều nước ấm, nghỉ ngơi.',
            warningSigns: 'Sốt cao liên tục, phát ban dày đặc kèm ho rũ rượi, co giật.'
        },
        {
            id: 'je',
            keywords: ['viêm não nhật bản', 'imojev', 'jevax'],
            name: 'Vắc xin Viêm não Nhật Bản (Imojev / Jevax)',
            disease: 'Phòng bệnh Viêm não Nhật Bản B do virus truyền qua muỗi Culex gây tổn thương hệ thần kinh trung ương vĩnh viễn.',
            schedule: 'Imojev: Mũi 1 lúc 9 tháng tuổi, mũi 2 sau mũi 1 là 1 năm. Jevax: Mũi 1, mũi 2 sau 1-2 tuần, mũi 3 sau 1 năm, sau đó mỗi 3 năm tiêm nhắc 1 lần.',
            totalDoses: 2,
            nextDoseRules: {
                1: { nextDose: 2, intervalDays: 365, title: 'Tiêm mũi 2 vắc xin Viêm não Nhật Bản (Imojev)' }
            },
            sideEffects: 'Đau chỗ tiêm, sốt nhẹ, mệt mỏi trong 1-2 ngày.',
            careInstructions: 'Cho trẻ nghỉ ngơi, uống nhiều nước, chườm mát khi cần.',
            warningSigns: 'Sốt cao, co giật, nôn vọt, đau đầu dữ dội, li bì.'
        },
        {
            id: 'tetanus',
            keywords: ['uốn ván', 'vat', 'tetavax', 'td', 'boostrix'],
            name: 'Vắc xin Uốn ván (VAT / Boostrix / Td)',
            disease: 'Phòng bệnh Uốn ván do độc tố trực khuẩn Clostridium tetani xâm nhập qua vết thương trầy xước, rách da.',
            schedule: 'Phụ nữ mang thai: Mũi 1 khi thai > 20 tuần, mũi 2 cách ít nhất 1 tháng (trước sinh 1 tháng). Người có vết thương: tiêm ngay + mũi nhắc sau 1 tháng và 6 tháng. Tiêm nhắc định kỳ 10 năm/lần.',
            totalDoses: 3,
            nextDoseRules: {
                1: { nextDose: 2, intervalDays: 30, title: 'Tiêm mũi 2 vắc xin Uốn ván' },
                2: { nextDose: 3, intervalDays: 180, title: 'Tiêm mũi 3 nhắc lại vắc xin Uốn ván' }
            },
            sideEffects: 'Đau buốt, sưng cứng tại bắp tay tiêm (rất phổ biến), sốt nhẹ.',
            careInstructions: 'Không xoa bóp bắp tay, có thể chườm mát nhẹ nhàng để giảm nhức.',
            warningSigns: 'Cứng hàm, co cứng cơ, sưng nề lan rộng toàn cánh tay.'
        },
        {
            id: 'rabies',
            keywords: ['dại', 'verorab', 'abhayrab', 'rabies', 'chó cắn', 'mèo cắn'],
            name: 'Vắc xin phòng Bệnh Dại (Verorab / Abhayrab)',
            disease: 'Phòng bệnh Dại sau khi bị động vật (chó, mèo, dơi...) cắn, cào hoặc liếm vào vết thương hở.',
            schedule: 'Phác đồ tiêm bắp 5 mũi sau phơi nhiễm: Ngày 0 - 3 - 7 - 14 - 28. Phác đồ tiêm trong da 4 lần: Ngày 0, 3, 7, 28.',
            totalDoses: 5,
            nextDoseRules: {
                1: { nextDose: 2, intervalDays: 3, title: 'Tiêm mũi 2 vắc xin phòng Dại (Ngày 3)' },
                2: { nextDose: 3, intervalDays: 4, title: 'Tiêm mũi 3 vắc xin phòng Dại (Ngày 7)' },
                3: { nextDose: 4, intervalDays: 7, title: 'Tiêm mũi 4 vắc xin phòng Dại (Ngày 14)' },
                4: { nextDose: 5, intervalDays: 14, title: 'Tiêm mũi 5 vắc xin phòng Dại (Ngày 28)' }
            },
            sideEffects: 'Đau tại chỗ tiêm, sốt nhẹ, đau đầu, mệt mỏi.',
            careInstructions: 'Tuyệt đối KHÔNG bỏ dở phác đồ, phải tiêm đúng ngày hẹn để đảm bảo kháng thể.',
            warningSigns: 'Sốt cao, co giật, sợ gió, sợ nước.'
        },
        {
            id: 'hepb',
            keywords: ['viêm gan b', 'engerix b', 'euvax b', 'gene-hbvax'],
            name: 'Vắc xin Viêm gan B (Engerix B / Euvax B)',
            disease: 'Phòng bệnh Viêm gan virus B mạn tính, xơ gan và ung thư gan nguyên phát.',
            schedule: 'Người lớn/trẻ em: Phác đồ 3 mũi (0 - 1 - 6 tháng: mũi 2 cách mũi 1 là 1 tháng, mũi 3 cách mũi 2 là 5 tháng).',
            totalDoses: 3,
            nextDoseRules: {
                1: { nextDose: 2, intervalDays: 30, title: 'Tiêm mũi 2 vắc xin Viêm gan B' },
                2: { nextDose: 3, intervalDays: 150, title: 'Tiêm mũi 3 vắc xin Viêm gan B' }
            },
            sideEffects: 'Đau nhẹ tại chỗ tiêm, sốt nhẹ thoáng qua.',
            careInstructions: 'Nghỉ ngơi, ăn uống đầy đủ dinh dưỡng.',
            warningSigns: 'Dị ứng, mề đay toàn thân, khó thở.'
        },
        {
            id: 'hepa',
            keywords: ['viêm gan a', 'avaxim', 'havax', 'mepaquin'],
            name: 'Vắc xin Viêm gan A (Avaxim / Havax)',
            disease: 'Phòng bệnh Viêm gan virus A lây truyền qua đường ăn uống, nước sinh hoạt.',
            schedule: 'Phác đồ 2 liều cách nhau 6 - 12 tháng.',
            totalDoses: 2,
            nextDoseRules: {
                1: { nextDose: 2, intervalDays: 180, title: 'Tiêm mũi 2 nhắc lại vắc xin Viêm gan A' }
            },
            sideEffects: 'Đau chỗ tiêm, mệt mỏi nhẹ.',
            careInstructions: 'Uống đủ nước, ăn chín uống sôi.',
            warningSigns: 'Vàng da, sốt cao kéo dài.'
        },
        {
            id: 'meningo',
            keywords: ['não mô cầu', 'menactra', 'bexsero', 'mengoc bc', 'neisseria meningitidis'],
            name: 'Vắc xin Não mô cầu (Menactra / Bexsero / Mengoc BC)',
            disease: 'Phòng Viêm màng não mủ và Nhiễm khuẩn huyết tối cấp do vi khuẩn não mô cầu nhóm A, C, Y, W-135 hoặc nhóm B.',
            schedule: 'Menactra (ACWY): Trẻ 9-23 tháng tiêm 2 liều cách 3 tháng; trẻ >= 2 tuổi tiêm 1 liều. Bexsero (nhóm B): 2 liều cách nhau 1-2 tháng. Mengoc BC (nhóm B+C): 2 liều cách 6-8 tuần.',
            totalDoses: 2,
            nextDoseRules: {
                1: { nextDose: 2, intervalDays: 60, title: 'Tiêm mũi 2 vắc xin Não mô cầu' }
            },
            sideEffects: 'Đau nhức chỗ tiêm, sốt, cáu kỉnh ở trẻ nhỏ.',
            careInstructions: 'Chườm mát, cho trẻ bú nhiều, theo dõi thân nhiệt.',
            warningSigns: 'Sốt cao, xuất hiện các nốt ban xuất huyết hoại tử trên da, nôn vọt, cứng gáy.'
        }
    ],

    /**
     * Tìm thông tin vắc xin phù hợp trong từ điển dựa vào văn bản
     * @param {string} text - tên bệnh, đơn thuốc, ghi chú
     * @returns {object|null}
     */
    findVaccineInfo(text) {
        if (!text) return null;
        const lower = text.toLowerCase();
        for (const vac of this.VACCINE_DATABASE) {
            if (vac.keywords.some(kw => lower.includes(kw))) {
                return vac;
            }
        }
        return null;
    },

    /**
     * Trích xuất số mũi tiêm hiện tại từ văn bản (VD: "mũi 1", "mũi 2", "liều 1", "dose 1")
     * @param {string} text
     * @returns {number}
     */
    extractDoseNumber(text) {
        if (!text) return 1;
        const match = text.match(/mũi\s*(\d+)|liều\s*(\d+)|lần\s*(\d+)|dose\s*(\d+)/i);
        if (match) {
            return parseInt(match[1] || match[2] || match[3] || match[4], 10);
        }
        if (/nhắc lại|tiêm nhắc/i.test(text)) return 4;
        return 1;
    },

    /**
     * Tính toán ngày hẹn và thông tin mũi tiêm tiếp theo
     * @param {string} vaccineText - Tên vắc xin / chẩn đoán / ghi chú
     * @param {string} injectedDate - Ngày tiêm (YYYY-MM-DD)
     * @param {number} [overrideDose] - Mũi số mấy nếu đã biết
     * @returns {object|null}
     */
    calculateNextVaccineDose(vaccineText, injectedDate, overrideDose = null) {
        const vac = this.findVaccineInfo(vaccineText);
        const currentDose = overrideDose || this.extractDoseNumber(vaccineText);
        const baseDate = injectedDate ? new Date(injectedDate) : new Date();
        if (isNaN(baseDate.getTime())) return null;

        if (vac && vac.nextDoseRules && vac.nextDoseRules[currentDose]) {
            const rule = vac.nextDoseRules[currentDose];
            const nextDate = new Date(baseDate.getTime() + rule.intervalDays * 24 * 60 * 60 * 1000);
            const nextDateStr = nextDate.toISOString().split('T')[0];

            return {
                isVaccine: true,
                vaccineId: vac.id,
                vaccineName: vac.name,
                diseaseTarget: vac.disease,
                currentDose: currentDose,
                nextDose: rule.nextDose,
                nextDoseTitle: rule.title,
                nextDoseDate: nextDateStr,
                intervalDays: rule.intervalDays,
                schedule: vac.schedule,
                sideEffects: vac.sideEffects,
                careInstructions: vac.careInstructions,
                warningSigns: vac.warningSigns,
                defaultNote: `Nhắc lịch tiêm: ${rule.title}. Mang theo sổ tiêm chủng, kiểm tra sức khỏe tốt trước khi tiêm.`
            };
        }

        // Nếu là tiêm chủng nhưng không khớp vắc xin cụ thể, mặc định gợi ý mũi sau 30 ngày
        const isGenericVaccine = /tiêm phòng|tiêm chủng|vắc xin|vaccine/i.test(vaccineText);
        if (isGenericVaccine) {
            const nextDate = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
            const nextDateStr = nextDate.toISOString().split('T')[0];
            return {
                isVaccine: true,
                vaccineId: 'generic',
                vaccineName: vaccineText,
                diseaseTarget: 'Phòng ngừa bệnh truyền nhiễm',
                currentDose: currentDose,
                nextDose: currentDose + 1,
                nextDoseTitle: `Tiêm mũi ${currentDose + 1} (${vaccineText})`,
                nextDoseDate: nextDateStr,
                intervalDays: 30,
                schedule: 'Tham khảo lịch hẹn trên sổ tiêm chủng hoặc tư vấn của bác sĩ.',
                sideEffects: 'Sốt nhẹ, sưng đau vị trí tiêm trong 24-48h.',
                careInstructions: 'Theo dõi thân nhiệt, chườm mát chỗ tiêm, uống nhiều nước.',
                warningSigns: 'Sốt cao liên tục >= 39°C, co giật, khó thở, phát ban toàn thân.',
                defaultNote: `Nhắc lịch tiêm: Tiêm mũi tiếp theo. Mang theo sổ tiêm chủng.`
            };
        }

        return null;
    },

    /**
     * Tạo bài viết tư vấn chuyên sâu về Vắc xin (dùng từ điển chuẩn + AI)
     * @param {string} vaccineText - Tên vắc xin / chẩn đoán
     * @param {string} injectedDate - Ngày tiêm
     * @param {string} [memberName] - Tên người tiêm
     * @returns {Promise<string>} Markdown bài viết tư vấn
     */
    async getVaccineConsultation(vaccineText, injectedDate = '', memberName = '') {
        const info = this.calculateNextVaccineDose(vaccineText, injectedDate);
        if (info && info.vaccineId !== 'generic') {
            return `### 💉 Cẩm nang Y khoa: ${info.vaccineName}

#### 1. Bệnh phòng ngừa
- **Tác dụng:** ${info.diseaseTarget}

#### 2. Phác đồ tiêm chủng chuẩn
- **Lịch tiêm:** ${info.schedule}
${info.nextDoseDate ? `- **Dự kiến mũi tiếp theo (${info.nextDoseTitle}):** Ngày **${info.nextDoseDate}** (cách mũi vừa tiêm khoảng ${info.intervalDays} ngày).` : ''}

#### 3. Phản ứng phụ thường gặp sau tiêm
- ${info.sideEffects}

#### 4. Hướng dẫn chăm sóc tại nhà
- ${info.careInstructions}

#### 5. 🚨 Dấu hiệu nguy hiểm cần đưa đi khám ngay
- ${info.warningSigns}

---
*Lưu ý: Thông tin trên mang tính chất tham khảo chuẩn y khoa. Vui lòng luôn mang theo Sổ tiêm chủng và tuân thủ chỉ định của Bác sĩ tại cơ sở tiêm chủng.*`;
        }

        // Nếu là loại vắc xin chưa có trong từ điển, gọi AI tra cứu chuyên sâu
        const prompt = `Bạn là một bác sĩ chuyên gia tiêm chủng vắc xin hàng đầu. Bệnh nhân${memberName ? ' ' + memberName : ''} vừa tiêm loại vắc xin sau: "${vaccineText}" vào ngày ${injectedDate || 'gần đây'}.
Hãy cung cấp một bài viết hướng dẫn chuyên sâu chi tiết bằng định dạng Markdown rõ ràng, bao gồm:
1. **Thông tin loại Vắc xin & Tác dụng:** Vắc xin này phòng ngừa bệnh gì? Hiệu quả bảo vệ?
2. **Phác đồ tiêm chuẩn:** Cần tiêm bao nhiêu mũi? Khoảng cách giữa các mũi là bao lâu? (Gợi ý cụ thể ngày tiêm mũi tiếp theo nếu có ngày tiêm).
3. **Phản ứng phụ thường gặp:** Sốt, sưng đau, quấy khóc... và thời gian kéo dài.
4. **Hướng dẫn chăm sóc & Hạ sốt:** Cách chườm vết tiêm, dùng thuốc hạ sốt an toàn, dinh dưỡng.
5. **Dấu hiệu cảnh báo cấp cứu:** Những biểu hiện bất thường nào cần đưa ngay đến bệnh viện?

Viết với văn phong khoa học, chuẩn y khoa, ân cần và dễ hiểu.`;

        const provider = DataManager.getProviderSearch();
        if (provider === 'openai') {
            return await this.callOpenAI(prompt, 0.2);
        } else if (provider === 'anthropic') {
            return await this.callAnthropic(prompt, 0.2);
        } else {
            return await this.callGeminiAPI(prompt, null, false, null, 0.2);
        }
    }
};

