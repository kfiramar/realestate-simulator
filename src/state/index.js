// Centralized State Management
(function() {
    const state = {
        mode: 'percent',
        exMode: 'hedged',
        taxMode: 'real',
        horMode: 'auto',
        lockDown: false,
        lockTerm: false,
        lockHor: true,
        buyerType: 'first',
        advancedTermMode: false,
        bootstrapping: false,
        creditScore: 900,
        surplusMode: 'match',
        repayMethod: 'spitzer',
        optimizeMode: 'outperform',
        rateEditMode: false
    };

    const listeners = [];

    function get(key) {
        return state[key];
    }

    function set(key, value) {
        if (state[key] !== value) {
            state[key] = value;
            notify(key, value);
        }
    }

    function getAll() {
        return { ...state };
    }

    function setAll(obj) {
        Object.keys(obj).forEach(k => {
            if (k in state) state[k] = obj[k];
        });
    }

    function subscribe(fn) {
        listeners.push(fn);
        return () => { const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); };
    }

    function notify(key, value) {
        listeners.forEach(fn => fn(key, value));
    }

    window.AppState = { get, set, getAll, setAll, subscribe };
})();
