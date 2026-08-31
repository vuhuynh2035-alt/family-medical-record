const SpeechService = {
    recognitions: new Map(),

    init() {
        this.setupMicButton('btn-deep-chat-mic', 'deep-chat-input');
        this.setupMicButton('btn-help-chat-mic', 'input-ai-help-chat');
    },

    setupMicButton(btnId, inputId) {
        const btn = document.getElementById(btnId);
        const input = document.getElementById(inputId);
        if (!btn || !input) return;

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleSpeechRecognition(btnId, inputId);
        });
    },

    toggleSpeechRecognition(btnId, inputId) {
        const btn = document.getElementById(btnId);
        const input = document.getElementById(inputId);
        if (!btn || !input) return;

        // If already recording, stop it
        if (this.recognitions.has(btnId)) {
            const recognition = this.recognitions.get(btnId);
            recognition.stop();
            return;
        }

        // Check browser support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Trình duyệt của bạn không hỗ trợ tính năng Nhận diện giọng nói. Vui lòng sử dụng Chrome/Safari bản mới nhất.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'vi-VN'; // Vietnamese
        recognition.interimResults = true; // Show results while speaking
        recognition.continuous = false; // Stop when the user stops speaking

        let finalTranscript = '';

        recognition.onstart = () => {
            btn.classList.add('recording');
            btn.querySelector('.material-symbols-rounded').textContent = 'mic_external_on';
            input.placeholder = 'Đang nghe...';
            this.recognitions.set(btnId, recognition);
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            finalTranscript = ''; // Reset and rebuild from event.results

            for (let i = 0; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            // Update input value with what we have so far
            input.value = finalTranscript + interimTranscript;
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            if (event.error === 'not-allowed') {
                alert("Vui lòng cấp quyền sử dụng Micro cho trình duyệt để dùng tính năng này.");
            }
            this.stopRecordingUI(btnId, inputId, input);
        };

        recognition.onend = () => {
            this.stopRecordingUI(btnId, inputId, input);
            // Optional: Auto-focus the input after recording
            input.focus();
            
            // Optional: Fire an input event so any listeners know the value changed
            input.dispatchEvent(new Event('input', { bubbles: true }));
        };

        try {
            recognition.start();
        } catch (e) {
            console.error(e);
            this.stopRecordingUI(btnId, inputId, input);
        }
    },

    stopRecordingUI(btnId, inputId, input) {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.classList.remove('recording');
            btn.querySelector('.material-symbols-rounded').textContent = 'mic';
        }
        if (input) {
            if (inputId === 'deep-chat-input') {
                input.placeholder = 'Nhập câu hỏi chuyên sâu...';
            } else {
                input.placeholder = 'Nhập câu hỏi của bạn (VD: Làm sao đổi mã PIN?)...';
            }
        }
        this.recognitions.delete(btnId);
    }
};

window.addEventListener('DOMContentLoaded', () => {
    SpeechService.init();
});
