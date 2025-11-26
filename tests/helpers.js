const fs = require('fs');
const path = require('path');

function loadDom() {
    const htmlPath = path.resolve(__dirname, '../src/index.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    const body = html.split('<body>')[1].split('</body>')[0];
    document.documentElement.innerHTML = `<body>${body}</body>`;
}

function bootstrapApp() {
    loadDom();
    // require after DOM is set
    require('../src/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
}

module.exports = { loadDom, bootstrapApp };
