const fs = require('fs');

global.window = {
    addEventListener: () => {},
    location: { href: '' },
    navigator: { userAgent: '' },
    speechSynthesis: {
        getVoices: () => []
    },
    localStorage: {
        getItem: () => null,
        setItem: () => {}
    },
    history: { replaceState: ()=>{}, pushState: ()=>{} }
};
global.document = {
    addEventListener: () => {},
    getElementById: () => ({ addEventListener: () => {} }),
    querySelectorAll: () => [],
    querySelector: () => ({ addEventListener: () => {} }),
    body: { classList: { remove:()=>{} } }
};
global.navigator = window.navigator;
global.localStorage = window.localStorage;
global.location = window.location;
global.history = window.history;

try {
    const code = fs.readFileSync('js/app.js', 'utf8');
    // evaluate the code
    eval(code);
    console.log("SUCCESS!");
} catch (e) {
    console.log("ERROR:", e);
}
