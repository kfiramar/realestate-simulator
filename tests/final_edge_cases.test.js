/**
 * Final edge case tests for remaining uncovered branches
 */

const AppLogic = require('../src/logic.js');

describe('Purchase Tax Edge Cases', () => {
    test('Property value exactly at bracket boundary', () => {
        // Exactly at first bracket limit
        const tax1 = AppLogic.calcPurchaseTax(1978745, true);
        expect(tax1).toBe(0);
        
        // Well above first bracket to ensure tax
        const tax2 = AppLogic.calcPurchaseTax(2000000, true);
        expect(tax2).toBeGreaterThan(0);
    });

    test('Very high property value hits all brackets', () => {
        const tax = AppLogic.calcPurchaseTax(25000000, true);
        // Should hit 10% bracket
        expect(tax).toBeGreaterThan(1500000);
    });

    test('Taxable in bracket is zero when at exact limit', () => {
        // This tests the taxableInBracket > 0 branch
        const tax = AppLogic.calcPurchaseTax(0, true);
        expect(tax).toBe(0);
    });
});

describe('Prepayment in Forex Mode', () => {
    test('Prepayment updates USD basis in forex mode', () => {
        const result = AppLogic.simulate({
            equity: 500_000,
            downPct: 0.25,
            loanTerm: 20,
            simHorizon: 20,
            mix: { prime: 100, kalats: 0, katz: 0, malatz: 0, matz: 0 },
            rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
            market: { sp: 0.08, reApp: 0.04, cpi: 0.025, boi: 0.05, rentYield: 0.03 },
            fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 },
            maintPct: 0,
            tax: { useSP: false, useRE: false, useRent: false, mode: 'real' },
            prepay: [{ track: 'p', amt: 100000, yr: 5 }],
            config: {
                drift: 0,
                surplusMode: 'pocket',
                exMode: 'forex',
                history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
            },
            returnSeries: false
        });

        expect(result.spBasisUSD).toBeGreaterThan(0);
        expect(result.spUnits).toBeGreaterThan(0);
    });

    test('Multiple prepayments on different tracks in forex mode', () => {
        const result = AppLogic.simulate({
            equity: 500_000,
            downPct: 0.25,
            loanTerm: 20,
            simHorizon: 20,
            mix: { prime: 25, kalats: 25, katz: 25, malatz: 25, matz: 0 },
            rates: { prime: 0.06, kalats: 0.05, katz: 0.035, malatz: 0.055, matz: 0.04 },
            market: { sp: 0.08, reApp: 0.04, cpi: 0.025, boi: 0.05, rentYield: 0.03 },
            fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 },
            maintPct: 0,
            tax: { useSP: false, useRE: false, useRent: false, mode: 'real' },
            prepay: [
                { track: 'p', amt: 50000, yr: 3 },
                { track: 'k', amt: 50000, yr: 5 },
                { track: 'z', amt: 50000, yr: 7 },
                { track: 'm', amt: 50000, yr: 9 }
            ],
            config: {
                drift: 0,
                surplusMode: 'pocket',
                exMode: 'forex',
                history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
            },
            returnSeries: false
        });

        expect(result.totalCashInvested).toBeGreaterThan(500000);
    });
});

describe('Matz Balance Cap Edge Case', () => {
    test('Matz principal payment capped at remaining balance', () => {
        // Short term to force high principal payments
        const result = AppLogic.simulate({
            equity: 100_000,
            downPct: 0.50,
            loanTerm: 5,
            simHorizon: 5,
            mix: { prime: 0, kalats: 0, katz: 0, malatz: 0, matz: 100 },
            rates: { prime: 0.06, kalats: 0.05, katz: 0.035, malatz: 0.055, matz: 0.03 },
            market: { sp: 0.08, reApp: 0.04, cpi: 0.02, boi: 0.05, rentYield: 0.03 },
            fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 },
            maintPct: 0,
            tax: { useSP: false, useRE: false, useRent: false, mode: 'real' },
            config: {
                drift: 0,
                surplusMode: 'pocket',
                exMode: 'hedged',
                repayMethod: 'equalPrincipal',
                history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
            },
            returnSeries: false
        });

        expect(result.remainingLoan).toBeCloseTo(0, -1);
    });
});

describe('Tax Profit Edge Cases', () => {
    test('No S&P tax when profit is zero', () => {
        const result = AppLogic.simulate({
            equity: 100_000,
            downPct: 1.0, // 100% down = no mortgage
            loanTerm: 1,
            simHorizon: 1,
            mix: { prime: 0, kalats: 0, katz: 0, malatz: 0, matz: 0 },
            rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
            market: { sp: 0, reApp: 0, cpi: 0, boi: 0.05, rentYield: 0 }, // 0% return
            fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 },
            maintPct: 0,
            tax: { useSP: true, useRE: false, useRent: false, mode: 'nominal' },
            config: {
                drift: 0,
                surplusMode: 'pocket',
                exMode: 'hedged',
                history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
            },
            returnSeries: false
        });

        expect(result.spTax).toBe(0);
    });

    test('No RE side tax when no profit', () => {
        const result = AppLogic.simulate({
            equity: 500_000,
            downPct: 0.25,
            loanTerm: 5,
            simHorizon: 5,
            mix: { prime: 50, kalats: 50, katz: 0, malatz: 0, matz: 0 },
            rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
            market: { sp: -0.10, reApp: 0.04, cpi: 0.025, boi: 0.05, rentYield: 0.05 }, // Negative S&P
            fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 },
            maintPct: 0,
            tax: { useSP: false, useRE: true, useRent: false, mode: 'nominal' },
            config: {
                drift: 0,
                surplusMode: 'invest',
                exMode: 'hedged',
                history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
            },
            returnSeries: false
        });

        // With negative returns, RE side stock should have no taxable profit
        expect(result.reSideTax).toBe(0);
    });
});

describe('Generate Schedule Edge Cases', () => {
    test('Schedule with zero CPI rate', () => {
        const schedule = AppLogic.generateSchedule({
            principal: 500000,
            annualRate: 0.04,
            termMonths: 120,
            method: 'spitzer',
            cpiLinked: true,
            cpiRate: 0
        });

        expect(schedule.schedule).toHaveLength(120);
        // With 0% CPI, adjustments should be 0
        expect(schedule.schedule[0].cpiAdjustment).toBe(0);
    });

    test('Equal principal with CPI linking', () => {
        const schedule = AppLogic.generateSchedule({
            principal: 500000,
            annualRate: 0.035,
            termMonths: 60,
            method: 'equalPrincipal',
            cpiLinked: true,
            cpiRate: 0.03
        });

        expect(schedule.schedule).toHaveLength(60);
        expect(schedule.totalInterest).toBeGreaterThan(0);
    });

    test('CPI array longer than loan term', () => {
        const schedule = AppLogic.generateSchedule({
            principal: 500000,
            annualRate: 0.04,
            termMonths: 24, // 2 years
            method: 'spitzer',
            cpiLinked: true,
            cpiRate: [0.02, 0.025, 0.03, 0.035, 0.04] // 5 years of rates
        });

        expect(schedule.schedule).toHaveLength(24);
    });

    test('CPI array shorter than loan term uses last value', () => {
        const schedule = AppLogic.generateSchedule({
            principal: 500000,
            annualRate: 0.04,
            termMonths: 60, // 5 years
            method: 'spitzer',
            cpiLinked: true,
            cpiRate: [0.02, 0.03] // Only 2 years of rates
        });

        expect(schedule.schedule).toHaveLength(60);
    });
});

describe('Katz Balance Cap Edge Case', () => {
    test('Katz principal payment capped at remaining balance', () => {
        const result = AppLogic.simulate({
            equity: 100_000,
            downPct: 0.50,
            loanTerm: 5,
            simHorizon: 5,
            mix: { prime: 0, kalats: 0, katz: 100, malatz: 0, matz: 0 },
            rates: { prime: 0.06, kalats: 0.05, katz: 0.025, malatz: 0.055, matz: 0.04 },
            market: { sp: 0.08, reApp: 0.04, cpi: 0.02, boi: 0.05, rentYield: 0.03 },
            fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 },
            maintPct: 0,
            tax: { useSP: false, useRE: false, useRent: false, mode: 'real' },
            config: {
                drift: 0,
                surplusMode: 'pocket',
                exMode: 'hedged',
                repayMethod: 'equalPrincipal',
                history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
            },
            returnSeries: false
        });

        expect(result.remainingLoan).toBeCloseTo(0, -1);
    });
});

describe('Deficit Handling in Match Mode', () => {
    test('Match mode handles deficit by withdrawing from S&P', () => {
        const result = AppLogic.simulate({
            equity: 500_000,
            downPct: 0.25,
            loanTerm: 20,
            simHorizon: 10,
            mix: { prime: 50, kalats: 50, katz: 0, malatz: 0, matz: 0 },
            rates: { prime: 0.08, kalats: 0.07, katz: 0.04, malatz: 0.055, matz: 0.045 }, // High rates
            market: { sp: 0.08, reApp: 0.04, cpi: 0.025, boi: 0.05, rentYield: 0.02 }, // Low yield
            fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 },
            maintPct: 0,
            tax: { useSP: false, useRE: false, useRent: false, mode: 'real' },
            config: {
                drift: 0,
                surplusMode: 'match',
                exMode: 'hedged',
                history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
            },
            returnSeries: false
        });

        // Match mode should work even with deficits
        expect(result.netSP).toBeGreaterThan(0);
    });

    test('Match mode in forex mode handles deficit', () => {
        const result = AppLogic.simulate({
            equity: 500_000,
            downPct: 0.25,
            loanTerm: 20,
            simHorizon: 10,
            mix: { prime: 50, kalats: 50, katz: 0, malatz: 0, matz: 0 },
            rates: { prime: 0.08, kalats: 0.07, katz: 0.04, malatz: 0.055, matz: 0.045 },
            market: { sp: 0.08, reApp: 0.04, cpi: 0.025, boi: 0.05, rentYield: 0.02 },
            fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 },
            maintPct: 0,
            tax: { useSP: false, useRE: false, useRent: false, mode: 'real' },
            config: {
                drift: 0,
                surplusMode: 'match',
                exMode: 'forex',
                history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
            },
            returnSeries: false
        });

        expect(result.spUnits).toBeGreaterThan(0);
    });
});

describe('Historical BoI Mode', () => {
    test('Historical BoI affects Prime rate', () => {
        const fixedBoI = AppLogic.simulate({
            equity: 500_000,
            downPct: 0.25,
            loanTerm: 15,
            simHorizon: 15,
            mix: { prime: 100, kalats: 0, katz: 0, malatz: 0, matz: 0 },
            rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
            market: { sp: 0.08, reApp: 0.04, cpi: 0.025, boi: 0.05, rentYield: 0.03 },
            fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 },
            maintPct: 0,
            tax: { useSP: false, useRE: false, useRent: false, mode: 'real' },
            config: {
                drift: 0,
                surplusMode: 'pocket',
                exMode: 'hedged',
                history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
            },
            returnSeries: false
        });

        const histBoI = AppLogic.simulate({
            equity: 500_000,
            downPct: 0.25,
            loanTerm: 15,
            simHorizon: 15,
            mix: { prime: 100, kalats: 0, katz: 0, malatz: 0, matz: 0 },
            rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
            market: { sp: 0.08, reApp: 0.04, cpi: 0.025, boi: 0.05, rentYield: 0.03 },
            fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 },
            maintPct: 0,
            tax: { useSP: false, useRE: false, useRent: false, mode: 'real' },
            config: {
                drift: 0,
                surplusMode: 'pocket',
                exMode: 'hedged',
                history: { SP: { is: false }, App: { is: false }, Int: { is: true }, Inf: { is: false }, Yld: { is: false } }
            },
            returnSeries: false
        });

        // Historical BoI should produce different interest
        expect(histBoI.totalInterestWasted).not.toBe(fixedBoI.totalInterestWasted);
    });
});

describe('All Historical Modes Combined', () => {
    test('All historical modes enabled', () => {
        const result = AppLogic.simulate({
            equity: 500_000,
            downPct: 0.25,
            loanTerm: 15,
            simHorizon: 15,
            mix: { prime: 25, kalats: 25, katz: 25, malatz: 25, matz: 0 },
            rates: { prime: 0.06, kalats: 0.05, katz: 0.035, malatz: 0.055, matz: 0.04 },
            market: { sp: 0.08, reApp: 0.04, cpi: 0.025, boi: 0.05, rentYield: 0.03 },
            fees: { buy: 0.02, sell: 0.02, trade: 0.001, mgmt: 0.005 },
            maintPct: 0.01,
            tax: { useSP: true, useRE: true, useRent: true, mode: 'real' },
            config: {
                drift: 0,
                surplusMode: 'invest',
                exMode: 'hist',
                history: { SP: { is: true }, App: { is: true }, Int: { is: true }, Inf: { is: true }, Yld: { is: true } }
            },
            returnSeries: true
        });

        expect(result.netRE).toBeGreaterThan(0);
        expect(result.netSP).toBeGreaterThan(0);
        expect(result.series).toBeDefined();
    });
});

describe('Very Short and Very Long Terms', () => {
    test('1 year mortgage term', () => {
        const result = AppLogic.simulate({
            equity: 100_000,
            downPct: 0.50,
            loanTerm: 1,
            simHorizon: 1,
            mix: { prime: 50, kalats: 50, katz: 0, malatz: 0, matz: 0 },
            rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
            market: { sp: 0.08, reApp: 0.04, cpi: 0.025, boi: 0.05, rentYield: 0.03 },
            fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 },
            maintPct: 0,
            tax: { useSP: false, useRE: false, useRent: false, mode: 'real' },
            config: {
                drift: 0,
                surplusMode: 'pocket',
                exMode: 'hedged',
                history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
            },
            returnSeries: false
        });

        expect(result.remainingLoan).toBeCloseTo(0, -1);
    });

    test('30 year mortgage term', () => {
        const result = AppLogic.simulate({
            equity: 500_000,
            downPct: 0.25,
            loanTerm: 30,
            simHorizon: 30,
            mix: { prime: 33, kalats: 34, katz: 0, malatz: 33, matz: 0 },
            rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
            market: { sp: 0.08, reApp: 0.04, cpi: 0.025, boi: 0.05, rentYield: 0.03 },
            fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 },
            maintPct: 0,
            tax: { useSP: false, useRE: false, useRent: false, mode: 'real' },
            config: {
                drift: 0,
                surplusMode: 'pocket',
                exMode: 'hedged',
                history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
            },
            returnSeries: false
        });

        expect(result.remainingLoan).toBeCloseTo(0, -1);
        expect(result.totalInterestWasted).toBeGreaterThan(500000);
    });
});
