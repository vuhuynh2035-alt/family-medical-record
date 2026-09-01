with open('css/style.css', 'a', encoding='utf-8') as f:
    f.write('''\n/* Chat Microphone Button */
.chat-btn-mic {
    background: #f1f3f5;
    color: #555;
    border: none;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    margin-right: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    flex-shrink: 0;
}
.chat-btn-mic:hover {
    background: #e9ecef;
}
.chat-btn-mic.recording {
    background: #e74c3c !important;
    color: white !important;
    animation: pulseMic 1.5s infinite;
}
@keyframes pulseMic {
    0% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.4); }
    70% { box-shadow: 0 0 0 10px rgba(231, 76, 60, 0); }
    100% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0); }
}
''')
