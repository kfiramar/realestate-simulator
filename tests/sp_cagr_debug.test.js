const AppLogic = require('../src/logic.js');

describe('S&P CAGR (IRR) Debug', () => {
    test('100% equity - should get exactly 10%', () => {
        const params = {
            equity: 1000000,
            downPct: 1.0,
            loanTerm: 20,
            simHorizon: 10,
            mix: { prime: 0, kalats: 100, katz: 0, malatz: 0, matz: 0 },
            rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
            market: { sp: 0.10, reApp: 0.05, cpi: 0.02, boi: 0.05, rentYield: 0.03 },
            fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 },
            maintPct: 0,
            tax: { use: false, useRent: false, mode: 'real' },
            config: { 
                drift: 0, 
                surplusMode: 'pocket', 
                exMode: 'hedged',
                history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
            },
            returnSeries: true
        };
        
        const result = AppLogic.simulate(params);
        expect(result.cagrSP).toBeCloseTo(10, 1);
    });

    test('50% down with deficit - IRR still shows 10% (timing-adjusted)', () => {
        const params = {
            equity: 500000,
            downPct: 0.5,
            loanTerm: 20,
            simHorizon: 10,
            mix: { prime: 0, kalats: 100, katz: 0, malatz: 0, matz: 0 },
            rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
            market: { sp: 0.10, reApp: 0.05, cpi: 0.02, boi: 0.05, rentYield: 0.03 },
            fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 },
            maintPct: 0,
            tax: { use: false, useRent: false, mode: 'real' },
            config: { 
                drift: 0, 
                surplusMode: 'pocket',
                exMode: 'hedged',
                history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
            },
            returnSeries: true
        };
        
        const result = AppLogic.simulate(params);
        
        // Extra cash invested over time, but IRR accounts for timing
        expect(result.totalCashInvested).toBeGreaterThan(500000);
        expect(result.cagrSP).toBeCloseTo(10, 1);  // IRR = 10%
    });
});
