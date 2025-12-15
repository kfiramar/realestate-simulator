// i18n module - Translation system
// Languages are loaded from separate files for scalability
(function() {
    const isNode = typeof module !== 'undefined' && module.exports;
    
    let en, he;
    if (isNode) {
        // Node.js - use __dirname for correct path resolution
        const path = require('path');
        en = require(path.join(__dirname, 'en.js'));
        he = require(path.join(__dirname, 'he.js'));
    } else {
        // Browser - languages loaded via script tags
        en = window.i18n_en || {};
        he = window.i18n_he || {};
    }
    
    const T = { en, he };
    let lang = typeof localStorage !== 'undefined' ? (localStorage.getItem('lang') || 'en') : 'en';

    function t(key) {
        return T[lang]?.[key] || T['en']?.[key] || key;
    }

    function getLang() { return lang; }
    function setLang(l) { if (T[l]) lang = l; }
    function getAvailableLanguages() { return Object.keys(T); }

    const i18n = { T, t, getLang, setLang, getAvailableLanguages };
    
    if (isNode) module.exports = i18n;
    else window.i18n = i18n;
})();
