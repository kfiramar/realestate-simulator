const fs = require('fs');
const path = require('path');

function loadDom() {
    const htmlPath = path.resolve(__dirname, '../src/index.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const body = bodyMatch ? bodyMatch[1] : '';
    document.documentElement.innerHTML = `<body>${body}</body>`;
}

function bootstrapApp() {
    loadDom();
    localStorage.clear();
    // Load modules in order
    const i18nCode = fs.readFileSync(path.resolve(__dirname, '../src/i18n/index.js'), 'utf-8');
    eval(i18nCode);
    const configCode = fs.readFileSync(path.resolve(__dirname, '../src/config/index.js'), 'utf-8');
    eval(configCode);
    const chartsCode = fs.readFileSync(path.resolve(__dirname, '../src/charts/index.js'), 'utf-8');
    eval(chartsCode);
    const prepayCode = fs.readFileSync(path.resolve(__dirname, '../src/prepayments/index.js'), 'utf-8');
    eval(prepayCode);
    require('../src/logic.js');
    require('../src/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
}

module.exports = { loadDom, bootstrapApp };
