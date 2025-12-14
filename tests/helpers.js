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
    // Clear localStorage to prevent state leaking between tests
    localStorage.clear();
    // Load logic before app so globals exist
    require('../src/logic.js');
    // require after DOM is set
    require('../src/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
}

module.exports = { loadDom, bootstrapApp };
