// i18n module - Translation system
// Languages are loaded from separate files for scalability
(function() {
    let en, he;
    
    // In browser/jsdom: use window globals (set by en.js/he.js script tags)
    if (typeof window !== 'undefined' && (window.i18n_en || window.i18n_he)) {
        en = window.i18n_en || {};
        he = window.i18n_he || {};
    }
    // In Node.js require context: load files directly
    else if (typeof require !== 'undefined' && typeof __filename !== 'undefined' && __filename.includes('i18n')) {
        const path = require('path');
        en = require(path.join(__dirname, 'en.js'));
        he = require(path.join(__dirname, 'he.js'));
    }
    // Fallback (eval context without window globals)
    else {
        en = {};
        he = {};
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
    
    if (typeof module !== 'undefined' && module.exports) module.exports = i18n;
    if (typeof window !== 'undefined') window.i18n = i18n;
})();
