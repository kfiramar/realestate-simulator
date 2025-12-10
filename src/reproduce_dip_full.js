
const Logic = require('./logic.js');

// Base Scenario
const params = {
    equity: 400000,
    downPct: 0.3,
    loanTerm: 25, // Default is 25
    simHorizon: 50,
    termMix: { p: 25, k: 25, z: 25, m: 25, mt: 25 }, // 25 years
    mix: { prime: 33, kalats: 33, katz: 34, malatz: 0, matz: 0 },
    rates: {
        prime: 0.0575, // 4.25 + 1.5
        kalats: 0.0495, // 4.25 + 0.7
        katz: 0.032, // 4.25 - 1.05
        malatz: 0.045,
        matz: 0.0215
    },
    market: {
        sp: 0.09,
        reApp: 0.035,
        cpi: 0.025,
        boi: 0.0425,
        rentYield: 0.03
    },
    fees: {
        buy: 0.02,
        sell: 0.03,
        trade: 0.001,
        mgmt: 0.0015
    },
    tax: { use: true, useRent: true, mode: 'real' },
    config: {
        drift: 0.5,
        surplusMode: 'match',
        exMode: 'hedged',
        history: {
            SP: { is: false },
            App: { is: false },
            Int: { is: false },
            Yld: { is: false },
            Inf: { is: false }
        },
        repayMethod: 'spitzer'
    },
    returnSeries: true,
    maintPct: 0.10
};

const res = Logic.simulate(params);

console.log('Year | Rent | Interest | Principal | Net Flow | Rent-Int');
console.log('-----|------|----------|-----------|----------|---------');

for (let i = 30; i < 45; i++) {
    const rent = res.series.flowRent[i];
    const int = res.series.flowInt[i]; // Negative
    const princ = res.series.flowPrinc[i]; // Negative
    const net = res.series.flowNet[i];
    const rentMinusInt = rent + int;

    console.log(`${i + 1}   | ${rent.toFixed(0)} | ${int.toFixed(0)}      | ${princ.toFixed(0)}      | ${net.toFixed(0)}    | ${rentMinusInt.toFixed(0)}`);
}
