
const logic = require('./logic.js');

// Mock data based on app.js defaults
const mockParams = {
    equity: 400000,
    downPct: 0.3,
    loanTerm: 25,
    simHorizon: 25,
    mix: { prime: 33, kalats: 34, katz: 0, malatz: 33, matz: 0 },
    rates: { prime: 0.0575, kalats: 0.0495, katz: 0.032, malatz: 0.045, matz: 0.0215 },
    market: { sp: 0.09, reApp: 0.04, cpi: 0.025, boi: 0.0425, rentYield: 0.03 },
    fees: { buy: 0.02, sell: 0.02, trade: 0.001, mgmt: 0.0015 }, // Adjusted trade/mgmt to decimal
    maintPct: 0.08,
    purchaseDiscount: 0.01,
    tax: { use: true, useRent: true, mode: 'real' },
    config: { drift: -0.5, surplusMode: 'match', exMode: 'hedged', history: {}, repayMethod: 'spitzer' },
    returnSeries: false
};

console.log("--- TEST 1: Main Simulation Consistency ---");
// Test 1: Run simulation with 25y term, 25y horizon (Auto equivalent)
const resAuto = logic.simulate({ ...mockParams, loanTerm: 25, simHorizon: 25 });

// Test 2: Run simulation with 25y term, 25y horizon (Custom equivalent)
const resCustom = logic.simulate({ ...mockParams, loanTerm: 25, simHorizon: 25 });

console.log(`Auto(25y) RE CAGR: ${resAuto.cagrRE.toFixed(4)}%`);
console.log(`Custom(25y) RE CAGR: ${resCustom.cagrRE.toFixed(4)}%`);

if (Math.abs(resAuto.cagrRE - resCustom.cagrRE) > 0.0001) {
    console.error("FAIL: Results differ for identical parameters!");
} else {
    console.log("PASS: Results are identical for identical parameters.");
}

console.log("\n--- TEST 2: Optimizer Behavior ---");

// Mock params for sweet spot search
// We need to construct the args for calcCAGR adapter
const p = mockParams;
/*
function calcCAGR(eq, downPct, mortDur, simDur, useTax, tradeFee, merFee, exModeCalc, taxModeCalc, cfgCalc, overrides, useRentTax, mix, buyCostPct, maintPct, sellCostPct, drift, surplusMode)
*/
const argsBase = [
    p.equity, p.downPct, 25, 25,
    p.tax.use, p.fees.trade, p.fees.mgmt,
    p.config.exMode, p.tax.mode, p.config.history,
    { // overrides
        SP: p.market.sp, App: p.market.reApp, Inf: p.market.cpi, Int: p.market.boi, Yld: p.market.rentYield,
        RateP: p.rates.prime, RateK: p.rates.kalats, RateZ: p.rates.katz, RateM: p.rates.malatz, RateMT: p.rates.matz
    },
    p.tax.useRent, p.mix,
    p.fees.buy, p.maintPct, p.fees.sell,
    p.config.drift, p.config.surplusMode
];

// Replicate searchSweetSpots loop logic for a single point (Term=15)
// In Auto mode: Horizon = Term = 15
const cagrAuto15 = logic.calcCAGR(...[...argsBase.slice(0, 2), 15, 15, ...argsBase.slice(4)]);

// In Custom mode: Horizon = Fixed (e.g. 25), Term = 15
const cagrCustom15 = logic.calcCAGR(...[...argsBase.slice(0, 2), 15, 25, ...argsBase.slice(4)]);

console.log(`Auto Mode (Term=15, Horizon=15) RE CAGR: ${cagrAuto15.toFixed(4)}%`);
console.log(`Custom Mode (Term=15, Horizon=25) RE CAGR: ${cagrCustom15.toFixed(4)}%`);

const diff = cagrCustom15 - cagrAuto15;
console.log(`Difference: ${diff.toFixed(4)}%`);
if (Math.abs(diff) > 0.5) {
    console.log("Significant difference observed (Expected behavior for different horizons).");
} else {
    console.log("Little difference observed.");
}
