with open('css/style.css', 'a', encoding='utf-8') as f:
    f.write('''\n/* Help Mode Styles (New Interactive Design) */
body.help-mode-active [data-help-title] {
    outline: 3px solid #ffcc00 !important;
    outline-offset: 2px !important;
    cursor: help !important;
    position: relative;
    z-index: 10000;
}
body.help-mode-active .help-highlight-active {
    outline: 4px solid #e67e22 !important;
    box-shadow: 0 0 15px rgba(230,126,34,0.6) !important;
}
body.help-mode-active #btn-help,
body.help-mode-active #btn-help-mobile {
    animation: helpBlink 1s infinite alternate !important;
    z-index: 10001;
}
@keyframes helpBlink {
    from { 
        outline: 3px solid #ffcc00;
        box-shadow: 0 0 15px #ffcc00; 
    }
    to { 
        outline: 3px solid transparent;
        box-shadow: none; 
    }
}
''')
