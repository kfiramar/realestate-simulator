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
    // Babel transpiles ESM to CommonJS, so require works
    require('../src/i18n/index.js');
    require('../src/config/index.js');
    require('../src/logic.js');
    require('../src/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
}

module.exports = { loadDom, bootstrapApp };
