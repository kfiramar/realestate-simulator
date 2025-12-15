// Centralized State Management with Alpine.js integration
(function() {
    const state = {
        mode: 'percent', exMode: 'hedged', taxMode: 'real', horMode: 'auto',
        lockDown: false, lockTerm: false, lockHor: true, buyerType: 'first',
        advancedTermMode: false, bootstrapping: false, creditScore: 900,
        surplusMode: 'match', repayMethod: 'spitzer', optimizeMode: 'outperform',
        rateEditMode: false, prepayExpanded: false,
        globalHistMode: false, histSP: false, histApp: false, histInt: false, histYld: false, histInf: false
    };
    const listeners = [];

    const get = key => state[key];
    const set = (key, value) => { if (state[key] !== value) { state[key] = value; listeners.forEach(fn => fn(key, value)); } };
    const getAll = () => ({ ...state });
    const setAll = obj => Object.keys(obj).forEach(k => { if (k in state) state[k] = obj[k]; });
    const subscribe = fn => { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); }; };

    function registerAlpineStore() {
        if (typeof Alpine === 'undefined') return;
        Alpine.store('app', { ...state, set(k, v) { this[k] = v; set(k, v); } });
        subscribe((k, v) => { if (Alpine.store('app')) Alpine.store('app')[k] = v; });
    }

    document.addEventListener('alpine:init', registerAlpineStore);
    window.AppState = { get, set, getAll, setAll, subscribe, registerAlpineStore };
})();
