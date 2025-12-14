const fs = require('fs');
const path = require('path');

function loadDom() {
    const htmlPath = path.resolve(__dirname, '../src/index.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const body = bodyMatch ? bodyMatch[1] : '';
    document.documentElement.innerHTML = `<body>${body}</body>`;
}

function loadI18n() {
    // Load i18n module which sets window.i18n
    const i18nPath = path.resolve(__dirname, '../src/i18n/index.js');
    const i18nCode = fs.readFileSync(i18nPath, 'utf-8');
    eval(i18nCode);
}

function bootstrapApp() {
    loadDom();
    // Clear localStorage to prevent state leaking between tests
    localStorage.clear();
    // Load i18n first (sets window.i18n)
    loadI18n();
    // Load logic before app so globals exist
    require('../src/logic.js');
    // require after DOM is set
    require('../src/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
}

module.exports = { loadDom, loadI18n, bootstrapApp };
