const { JSDOM } = require('jsdom');
const dom = new JSDOM(`<!DOCTYPE html><body><div id='records-list'></div></body>`);
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = { getItem:()=>null, setItem:()=>{} };
global.navigator = { userAgent: '' };
global.location = { href: '' };
try {
    require('./js/app.js');
    console.log('Loaded successfully');
} catch (e) {
    console.error('Error:', e);
}
