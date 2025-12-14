// Centralized State Management with Alpine.js integration
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
        rateEditMode: false,
        prepayExpanded: false
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

    // Alpine.js store registration (called after Alpine loads)
    function registerAlpineStore() {
        if (typeof Alpine === 'undefined') return;
        Alpine.store('app', {
            ...state,
            set(key, value) {
                this[key] = value;
                set(key, value);
            }
        });
        // Sync AppState changes to Alpine store
        subscribe((key, value) => {
            if (Alpine.store('app')) {
                Alpine.store('app')[key] = value;
            }
        });
    }

    // Register when Alpine is ready
    document.addEventListener('alpine:init', registerAlpineStore);

    window.AppState = { get, set, getAll, setAll, subscribe, registerAlpineStore };
})();
