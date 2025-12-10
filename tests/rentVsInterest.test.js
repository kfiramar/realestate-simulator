const AppLogic = require('../src/logic.js');

describe('Rent vs Interest Line', () => {
    test('rentVsInt = rent + interest (interest is negative)', () => {
        const params = {
            equity: 500000,
            downPct: 0.5,
            loanTerm: 20,
            simHorizon: 5,
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
        const { flowRent, flowInt } = result.series;
        
        // Verify we have data
        expect(flowRent.length).toBe(5);
        expect(flowInt.length).toBe(5);
        
        // Calculate rentVsInt the same way as app.js
        const rentVsInt = flowRent.map((r, i) => r + flowInt[i]);
        
        // Rent should be positive, Interest should be negative
        expect(flowRent[0]).toBeGreaterThan(0);
        expect(flowInt[0]).toBeLessThan(0);
        
        // rentVsInt = rent - |interest|, so it's rent minus interest cost
        // With 3% yield and 5% rate on 500k loan, rent < interest initially
        expect(rentVsInt[0]).toBeLessThan(flowRent[0]); // Less than rent alone
        expect(rentVsInt[0]).toBeGreaterThan(flowInt[0]); // Greater than interest alone
    });
});
