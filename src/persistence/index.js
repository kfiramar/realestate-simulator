// Persistence Module - localStorage save/load
(function() {
    const STORAGE_KEY = 'mortgageCalcState';

    function getVal(id) {
        const el = document.getElementById(id);
        return el ? el.value : null;
    }

    function getChecked(id) {
        const el = document.getElementById(id);
        return el ? el.checked : null;
    }

    function setVal(id, val) {
        const el = document.getElementById(id);
        if (el && val != null) el.value = val;
    }

    function setChecked(id, val) {
        const el = document.getElementById(id);
        if (el && val != null) el.checked = val;
    }

    function collectState(stateVars, getPrepayments) {
        return {
            // Sliders
            equity: getVal('inpEquity'),
            down: getVal('rDown'),
            dur: getVal('rDur'),
            hor: getVal('rHor'),
            // Mix
            pctPrime: getVal('pctPrime'),
            pctKalats: getVal('pctKalats'),
            pctMalatz: getVal('pctMalatz'),
            pctKatz: getVal('pctKatz'),
            pctMatz: getVal('pctMatz'),
            // Rates
            ratePrime: getVal('ratePrime'),
            rateKalats: getVal('rateKalats'),
            rateMalatz: getVal('rateMalatz'),
            rateKatz: getVal('rateKatz'),
            rateMatz: getVal('rateMatz'),
            // Advanced terms
            termPrime: getVal('termPrime'),
            termKalats: getVal('termKalats'),
            termMalatz: getVal('termMalatz'),
            termKatz: getVal('termKatz'),
            termMatz: getVal('termMatz'),
            // Market assumptions
            sSP: getVal('sSP'),
            sApp: getVal('sApp'),
            sInf: getVal('sInf'),
            sInt: getVal('sInt'),
            sYld: getVal('sYld'),
            // Fees
            rBuyCost: getVal('rBuyCost'),
            rSellCost: getVal('rSellCost'),
            rTrade: getVal('rTrade'),
            rMer: getVal('rMer'),
            rMaint: getVal('rMaint'),
            rDiscount: getVal('rDiscount'),
            // Checkboxes
            usePurchaseTax: getChecked('cPurchaseTax') ?? true,
            useMasShevach: getChecked('cMasShevach') ?? false,
            // State vars
            ...stateVars,
            // Prepayments
            prepayments: getPrepayments ? getPrepayments() : []
        };
    }

    function save(stateVars, getPrepayments) {
        const state = collectState(stateVars, getPrepayments);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e) {}
    }

    function load() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return null;
            return JSON.parse(saved);
        } catch(e) { return null; }
    }

    function restore(data) {
        if (!data) return false;
        const s = data;

        // Restore inputs
        setVal('inpEquity', s.equity);
        setVal('rDown', s.down);
        setVal('rDur', s.dur);
        setVal('rHor', s.hor);
        setVal('pctPrime', s.pctPrime); setVal('sliderPrime', s.pctPrime);
        setVal('pctKalats', s.pctKalats); setVal('sliderKalats', s.pctKalats);
        setVal('pctMalatz', s.pctMalatz); setVal('sliderMalatz', s.pctMalatz);
        setVal('pctKatz', s.pctKatz); setVal('sliderKatz', s.pctKatz);
        setVal('pctMatz', s.pctMatz); setVal('sliderMatz', s.pctMatz);
        setVal('ratePrime', s.ratePrime);
        setVal('rateKalats', s.rateKalats);
        setVal('rateMalatz', s.rateMalatz);
        setVal('rateKatz', s.rateKatz);
        setVal('rateMatz', s.rateMatz);
        setVal('termPrime', s.termPrime);
        setVal('termKalats', s.termKalats);
        setVal('termMalatz', s.termMalatz);
        setVal('termKatz', s.termKatz);
        setVal('termMatz', s.termMatz);
        setVal('sSP', s.sSP);
        setVal('sApp', s.sApp);
        setVal('sInf', s.sInf);
        setVal('sInt', s.sInt);
        setVal('sYld', s.sYld);
        setVal('rBuyCost', s.rBuyCost);
        setVal('rSellCost', s.rSellCost);
        setVal('rTrade', s.rTrade);
        setVal('rMer', s.rMer);
        setVal('rMaint', s.rMaint);
        setVal('rDiscount', s.rDiscount);
        setChecked('cPurchaseTax', s.usePurchaseTax);
        setChecked('cMasShevach', s.useMasShevach);

        return s; // Return parsed state for caller to handle state vars
    }

    function clear() {
        try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
    }

    window.Persistence = { save, load, restore, clear, STORAGE_KEY };
})();
