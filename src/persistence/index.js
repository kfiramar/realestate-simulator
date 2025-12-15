// Persistence Module - localStorage save/load
(function() {
    const STORAGE_KEY = 'mortgageCalcState';
    const $ = id => document.getElementById(id);
    const getVal = id => $(id)?.value ?? null;
    const getChecked = id => $(id)?.checked ?? null;
    const setVal = (id, val) => { const el = $(id); if (el && val != null) el.value = val; };
    const setChecked = (id, val) => { const el = $(id); if (el && val != null) el.checked = val; };

    const FIELDS = ['inpEquity', 'rDown', 'rDur', 'rHor', 'pctPrime', 'pctKalats', 'pctMalatz', 'pctKatz', 'pctMatz',
        'ratePrime', 'rateKalats', 'rateMalatz', 'rateKatz', 'rateMatz', 'termPrime', 'termKalats', 'termMalatz', 'termKatz', 'termMatz',
        'sSP', 'sApp', 'sInf', 'sInt', 'sYld', 'rBuyCost', 'rSellCost', 'rTrade', 'rMer', 'rMaint', 'rDiscount'];
    const SLIDERS = ['Prime', 'Kalats', 'Malatz', 'Katz', 'Matz'];
    const CHECKS = [['cPurchaseTax', 'usePurchaseTax', true], ['cMasShevach', 'useMasShevach', false]];

    function save(stateVars, getPrepayments) {
        const state = { ...stateVars, prepayments: getPrepayments?.() || [] };
        FIELDS.forEach(id => state[id] = getVal(id));
        CHECKS.forEach(([id, key, def]) => state[key] = getChecked(id) ?? def);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e) {}
    }

    function load() {
        try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : null; } catch(e) { return null; }
    }

    function restore(s) {
        if (!s) return false;
        FIELDS.forEach(id => setVal(id, s[id]));
        SLIDERS.forEach(t => setVal('slider' + t, s['pct' + t]));
        CHECKS.forEach(([id, key]) => setChecked(id, s[key]));
        return s;
    }

    function clear() { try { localStorage.removeItem(STORAGE_KEY); } catch(e) {} }

    window.Persistence = { save, load, restore, clear, STORAGE_KEY };
})();
