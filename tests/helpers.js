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
    const i18nPath = path.resolve(__dirname, '../src/i18n/index.js');
    const i18nCode = fs.readFileSync(i18nPath, 'utf-8');
    eval(i18nCode);
}

function loadConfig() {
    const configPath = path.resolve(__dirname, '../src/config/index.js');
    const configCode = fs.readFileSync(configPath, 'utf-8');
    eval(configCode);
}

function bootstrapApp() {
    loadDom();
    localStorage.clear();
    loadI18n();
    loadConfig();
    require('../src/logic.js');
    require('../src/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
}

module.exports = { loadDom, loadI18n, loadConfig, bootstrapApp };
