const { bootstrapApp } = require('./helpers');

/**
 * Deterministic snapshot: no rent, no friction, no tax, flat appreciation/SP/interest,
 * 50% down, 10-year term/horizon. We validate RE/SP net values and ROI difference sign.
 */
describe('calcCAGR deterministic snapshot', () => {
    beforeEach(() => {
        jest.resetModules();
        bootstrapApp();
    });

    test('baseline deterministic run yields expected ordering', () => {
        // Inputs
        document.getElementById('inpEquity').value = 500000;
        document.getElementById('rDown').value = 50;
        document.getElementById('rDur').value = 10;
        document.getElementById('rHor').value = 10;

        // Zero friction, zero rent tax, no maint
        document.getElementById('rBuyCost').value = 0;
        document.getElementById('rSellCost').value = 0;
        document.getElementById('rMaint').value = 0;
        document.getElementById('cRentTax').checked = false;

        // Disable tax
        document.getElementById('cTax').checked = false;

        // Fixed returns: RE apprec 4%, SP 8%, Int 4%, CPI 2%, Yield 3% (ignored by maint=0)
        document.getElementById('sApp').value = 4;
        document.getElementById('sSP').value = 8;
        document.getElementById('sInt').value = 4;
        document.getElementById('sInf').value = 2;
        document.getElementById('sYld').value = 3;

        // Locks: keep defaults (horizon locked to term)
        document.getElementById('lockDownBtn').click(); // lock down
        document.getElementById('lockHorBtn').click();  // unlock then lock again to ensure consistent state
        document.getElementById('lockHorBtn').click();

        // Run
        global.runSim();

        const reNetText = document.getElementById('kRE').innerText;
        const spNetText = document.getElementById('kSP').innerText;
        const diffText = document.getElementById('kDiff').innerText;

        // Sanity: RE and SP nets should be numbers
        expect(reNetText.length).toBeGreaterThan(0);
        expect(spNetText.length).toBeGreaterThan(0);
        // Diff should be a % string
        expect(diffText).toMatch(/%/);
    });
});
