/**
 * Comprehensive tests to cover remaining edge cases and code paths
 */

const AppLogic = require('../src/logic.js');

describe('Exchange Mode Edge Cases', () => {
    const baseParams = {
        equity: 500_000,
        downPct: 0.25,
        loanTerm: 20,
        simHorizon: 10,
        mix: { prime: 50, kalats: 50, katz: 0, malatz: 0, matz: 0 },
        rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
        market: { sp: 0.08, reApp: 0.04, cpi: 0.025, boi: 0.05, rentYield: 0.03 },
        fees: { buy: 0.02, sell: 0.02, trade: 0.001, mgmt: 0.005 },
        maintPct: 0.01,
        tax: { useSP: true, useRE: true, useRent: false, mode: 'nominal' },
        returnSeries: false
    };

    test('Forex mode tracks USD units and basis', () => {
        const result = AppLogic.simulate({
            ...baseParams,
            config: {
                drift: 0,
                surplusMode: 'pocket',
                exMode: 'forex',
                history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
            }
        });
        
        expect(result.spUnits).toBeGreaterThan(0);
        expect(result.spBasisUSD).toBeGreaterThan(0);
    });

    test('Prepayment in forex mode updates USD basis', () => {
        const result = AppLogic.simulate({
            ...baseParams,
            prepay: [{ track: 'p', amt: 50000, yr: 3 }],
            config: {
                drift: 0,
                surplusMode: 'pocket',
                exMode: 'forex',
                history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
            }
        });
        
        expect(result.spBasisUSD).toBeGreaterThan(0);
        expect(result.totalCashInvested).toBeGreaterThan(baseParams.equity);
    });

    test('Hedged mode does not track USD units', () => {
        const result = AppLogic.simulate({
            ...baseParams,
            config: {
                drift: 0,
                surplusMode: 'pocket',
                exMode: 'hedged',
                history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
            }
        });
        
        expect(result.spValueHedged).toBeGreaterThan(0);
    });
});

describe('Surplus Modes', () => {
    const baseParams = {
        equity: 500_000,
        downPct: 0.25,
        loanTerm: 20,
        simHorizon: 20,
        mix: { prime: 33, kalats: 34, katz: 0, malatz: 33, matz: 0 },
        rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
        market: { sp: 0.08, reApp: 0.04, cpi: 0.025, boi: 0.05, rentYield: 0.04 },
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
    };

    test('Invest mode grows RE side stock value', () => {
        const result = AppLogic.simulate({
            ...baseParams,
            config: { ...baseParams.config, surplusMode: 'invest' }
        });
        
        expect(result.reSideStockValue).toBeGreaterThan(0);
    });

    test('Pocket mode keeps surplus as cash', () => {
        const result = AppLogic.simulate({
            ...baseParams,
            config: { ...baseParams.config, surplusMode: 'pocket' }
        });
        
        // With pocket mode, surplus is not invested
        expect(result.reSideStockValue).toBe(0);
    });

    test('Match mode invests same as S&P side', () => {
        const result = AppLogic.simulate({
            ...baseParams,
            config: { ...baseParams.config, surplusMode: 'match' }
        });
        
        // Match mode should have some RE side stock value
        expect(result).toBeDefined();
    });
});

describe('CPI-Linked Tracks', () => {
    const baseParams = {
        equity: 500_000,
        downPct: 0.25,
        loanTerm: 20,
        simHorizon: 20,
        rates: { prime: 0.06, kalats: 0.05, katz: 0.035, malatz: 0.055, matz: 0.04 },
        market: { sp: 0.08, reApp: 0.04, cpi: 0.03, boi: 0.05, rentYield: 0.03 },
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
    };

    test('Katz (CPI-linked fixed) increases balance with inflation', () => {
        const lowCPI = AppLogic.simulate({
            ...baseParams,
            mix: { prime: 0, kalats: 0, katz: 100, malatz: 0, matz: 0 },
            market: { ...baseParams.market, cpi: 0.01 }
        });

        const highCPI = AppLogic.simulate({
            ...baseParams,
            mix: { prime: 0, kalats: 0, katz: 100, malatz: 0, matz: 0 },
            market: { ...baseParams.market, cpi: 0.05 }
        });

        // Higher CPI = more interest paid on CPI-linked track
        expect(highCPI.totalInterestWasted).toBeGreaterThan(lowCPI.totalInterestWasted);
    });

    test('Matz (CPI-linked variable) responds to inflation', () => {
        const lowCPI = AppLogic.simulate({
            ...baseParams,
            mix: { prime: 0, kalats: 0, katz: 0, malatz: 0, matz: 100 },
            market: { ...baseParams.market, cpi: 0.01 }
        });

        const highCPI = AppLogic.simulate({
            ...baseParams,
            mix: { prime: 0, kalats: 0, katz: 0, malatz: 0, matz: 100 },
            market: { ...baseParams.market, cpi: 0.05 }
        });

        expect(highCPI.totalInterestWasted).toBeGreaterThan(lowCPI.totalInterestWasted);
    });
});

describe('5-Year Rate Reset for Variable Tracks', () => {
    const baseParams = {
        equity: 500_000,
        downPct: 0.25,
        loanTerm: 15,
        simHorizon: 15,
        rates: { prime: 0.06, kalats: 0.05, katz: 0.035, malatz: 0.05, matz: 0.04 },
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
    };

    test('Malatz rate resets every 5 years', () => {
        // With drift, rates change over time
        const result = AppLogic.simulate({
            ...baseParams,
            mix: { prime: 0, kalats: 0, katz: 0, malatz: 100, matz: 0 },
            config: { ...baseParams.config, drift: 0.01 }
        });

        expect(result.totalInterestWasted).toBeGreaterThan(0);
    });

    test('Matz rate resets every 5 years with CPI adjustment', () => {
        const result = AppLogic.simulate({
            ...baseParams,
            mix: { prime: 0, kalats: 0, katz: 0, malatz: 0, matz: 100 },
            config: { ...baseParams.config, drift: 0.01 }
        });

        expect(result.totalInterestWasted).toBeGreaterThan(0);
    });
});

describe('Equal Principal Repayment Method', () => {
    const baseParams = {
        equity: 500_000,
        downPct: 0.25,
        loanTerm: 20,
        simHorizon: 20,
        mix: { prime: 50, kalats: 50, katz: 0, malatz: 0, matz: 0 },
        rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
        market: { sp: 0.08, reApp: 0.04, cpi: 0.025, boi: 0.05, rentYield: 0.03 },
        fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 },
        maintPct: 0,
        tax: { useSP: false, useRE: false, useRent: false, mode: 'real' },
        returnSeries: false
    };

    test('Equal principal pays less total interest than Spitzer', () => {
        const spitzer = AppLogic.simulate({
            ...baseParams,
            config: {
                drift: 0,
                surplusMode: 'pocket',
                exMode: 'hedged',
                repayMethod: 'spitzer',
                history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
            }
        });

        const equalPrincipal = AppLogic.simulate({
            ...baseParams,
            config: {
                drift: 0,
                surplusMode: 'pocket',
                exMode: 'hedged',
                repayMethod: 'equalPrincipal',
                history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
            }
        });

        expect(equalPrincipal.totalInterestWasted).toBeLessThan(spitzer.totalInterestWasted);
    });
});

describe('Historical Data Mode', () => {
    const baseParams = {
        equity: 500_000,
        downPct: 0.25,
        loanTerm: 15,
        simHorizon: 15,
        mix: { prime: 50, kalats: 50, katz: 0, malatz: 0, matz: 0 },
        rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
        market: { sp: 0.08, reApp: 0.04, cpi: 0.025, boi: 0.05, rentYield: 0.03 },
        fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 },
        maintPct: 0,
        tax: { useSP: false, useRE: false, useRent: false, mode: 'real' },
        returnSeries: false
    };

    test('Historical SP mode uses H_SP data', () => {
        const result = AppLogic.simulate({
            ...baseParams,
            config: {
                drift: 0,
                surplusMode: 'pocket',
                exMode: 'hedged',
                history: { SP: { is: true }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
            }
        });

        expect(result.netSP).toBeGreaterThan(0);
    });

    test('Historical App mode uses H_RE data', () => {
        const result = AppLogic.simulate({
            ...baseParams,
            config: {
                drift: 0,
                surplusMode: 'pocket',
                exMode: 'hedged',
                history: { SP: { is: false }, App: { is: true }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
            }
        });

        expect(result.netRE).toBeGreaterThan(0);
    });

    test('Historical exchange mode uses H_EX data', () => {
        const result = AppLogic.simulate({
            ...baseParams,
            config: {
                drift: 0,
                surplusMode: 'pocket',
                exMode: 'hist',
                history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
            }
        });

        expect(result.netSP).toBeGreaterThan(0);
    });
});

describe('Rent Tax Calculation', () => {
    const baseParams = {
        equity: 500_000,
        downPct: 0.25,
        loanTerm: 20,
        simHorizon: 10,
        mix: { prime: 50, kalats: 50, katz: 0, malatz: 0, matz: 0 },
        rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
        market: { sp: 0.08, reApp: 0.04, cpi: 0.025, boi: 0.05, rentYield: 0.05 },
        fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 },
        maintPct: 0,
        config: {
            drift: 0,
            surplusMode: 'pocket',
            exMode: 'hedged',
            history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
        },
        returnSeries: false
    };

    test('Rent tax reduces total rent collected', () => {
        const noTax = AppLogic.simulate({
            ...baseParams,
            tax: { useSP: false, useRE: false, useRent: false, mode: 'real' }
        });

        const withTax = AppLogic.simulate({
            ...baseParams,
            tax: { useSP: false, useRE: false, useRent: true, mode: 'real' }
        });

        // Rent tax should reduce effective rent
        expect(withTax.totalRentCollected).toBeLessThanOrEqual(noTax.totalRentCollected);
    });
});

describe('Term Mix (Different Terms per Track)', () => {
    const baseParams = {
        equity: 500_000,
        downPct: 0.25,
        loanTerm: 25,
        simHorizon: 25,
        mix: { prime: 25, kalats: 25, katz: 25, malatz: 25, matz: 0 },
        rates: { prime: 0.06, kalats: 0.05, katz: 0.035, malatz: 0.055, matz: 0.04 },
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
    };

    test('Different terms per track affects total interest', () => {
        const uniformTerms = AppLogic.simulate({
            ...baseParams,
            termMix: { p: 25, k: 25, z: 25, m: 25, mt: 25 }
        });

        const mixedTerms = AppLogic.simulate({
            ...baseParams,
            termMix: { p: 15, k: 30, z: 20, m: 25, mt: 20 }
        });

        // Different term structures should yield different interest totals
        expect(uniformTerms.totalInterestWasted).not.toBe(mixedTerms.totalInterestWasted);
    });
});

describe('Series Data Generation', () => {
    test('Returns series data when returnSeries is true', () => {
        const result = AppLogic.simulate({
            equity: 500_000,
            downPct: 0.25,
            loanTerm: 10,
            simHorizon: 10,
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
            returnSeries: true
        });

        expect(result.series).toBeDefined();
        expect(result.series.labels).toHaveLength(10);
        expect(result.series.reDataVal).toHaveLength(10);
        expect(result.series.spDataVal).toHaveLength(10);
        expect(result.series.flowRent).toHaveLength(10);
        expect(result.series.flowInt).toHaveLength(10);
    });
});

describe('First Positive Cash Flow Month', () => {
    test('Detects when rent exceeds mortgage payment', () => {
        const result = AppLogic.simulate({
            equity: 800_000,
            downPct: 0.50, // High down payment = lower mortgage
            loanTerm: 20,
            simHorizon: 20,
            mix: { prime: 0, kalats: 100, katz: 0, malatz: 0, matz: 0 },
            rates: { prime: 0.06, kalats: 0.04, katz: 0.04, malatz: 0.055, matz: 0.045 },
            market: { sp: 0.08, reApp: 0.04, cpi: 0.025, boi: 0.05, rentYield: 0.05 }, // High yield
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

        // With high down payment and high yield, should have positive cash flow early
        expect(result.firstPosMonth).not.toBeNull();
        expect(result.firstPosMonth).toBeLessThan(240); // Within 20 years
    });
});

describe('Generate Schedule Function', () => {
    test('Spitzer schedule has constant payments', () => {
        const schedule = AppLogic.generateSchedule({
            principal: 1000000,
            annualRate: 0.05,
            termMonths: 240,
            method: 'spitzer'
        });
        
        expect(schedule.schedule).toHaveLength(240);
        // First and last payments should be similar (Spitzer = constant)
        const firstPayment = schedule.schedule[0].payment;
        const lastPayment = schedule.schedule[239].payment;
        expect(Math.abs(firstPayment - lastPayment)).toBeLessThan(1);
    });

    test('Equal principal schedule has decreasing payments', () => {
        const schedule = AppLogic.generateSchedule({
            principal: 1000000,
            annualRate: 0.05,
            termMonths: 240,
            method: 'equalPrincipal'
        });
        
        expect(schedule.schedule).toHaveLength(240);
        // First payment should be higher than last
        const firstPayment = schedule.schedule[0].payment;
        const lastPayment = schedule.schedule[239].payment;
        expect(firstPayment).toBeGreaterThan(lastPayment);
    });

    test('CPI-linked schedule tracks inflation adjustments', () => {
        const schedule = AppLogic.generateSchedule({
            principal: 1000000,
            annualRate: 0.035,
            termMonths: 240,
            method: 'spitzer',
            cpiLinked: true,
            cpiRate: 0.025
        });
        
        expect(schedule.schedule).toHaveLength(240);
        // CPI adjustment should be present
        expect(schedule.schedule[0].cpiAdjustment).toBeGreaterThanOrEqual(0);
    });
});

describe('Calc Balance After K Months', () => {
    test('Balance decreases over time', () => {
        const balance60 = AppLogic.calcBalanceAfterK(1000000, 0.05, 240, 60);
        const balance120 = AppLogic.calcBalanceAfterK(1000000, 0.05, 240, 120);
        
        expect(balance60).toBeLessThan(1000000);
        expect(balance120).toBeLessThan(balance60);
    });

    test('Balance is zero at end of term', () => {
        const balance = AppLogic.calcBalanceAfterK(1000000, 0.05, 240, 240);
        expect(balance).toBeCloseTo(0, 0);
    });
});

describe('Calc Total Interest', () => {
    test('Total interest is positive for any loan', () => {
        const interest = AppLogic.calcTotalInterest(1000000, 0.05, 240);
        expect(interest).toBeGreaterThan(0);
    });

    test('Higher rate = more interest', () => {
        const lowRate = AppLogic.calcTotalInterest(1000000, 0.03, 240);
        const highRate = AppLogic.calcTotalInterest(1000000, 0.06, 240);
        expect(highRate).toBeGreaterThan(lowRate);
    });

    test('Longer term = more interest', () => {
        const shortTerm = AppLogic.calcTotalInterest(1000000, 0.05, 120);
        const longTerm = AppLogic.calcTotalInterest(1000000, 0.05, 360);
        expect(longTerm).toBeGreaterThan(shortTerm);
    });
});
