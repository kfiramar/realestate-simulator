/**
 * Tests for remaining uncovered branches in logic.js
 */

const AppLogic = require('../src/logic.js');

describe('Historical Yield Mode', () => {
    test('Historical yield mode uses declining yield curve', () => {
        const result = AppLogic.simulate({
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
            config: {
                drift: 0,
                surplusMode: 'pocket',
                exMode: 'hedged',
                history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: true } }
            },
            returnSeries: false
        });

        expect(result.totalRentCollected).toBeGreaterThan(0);
    });
});

describe('Historical Inflation Mode', () => {
    test('Historical CPI mode uses H_CPI data', () => {
        const result = AppLogic.simulate({
            equity: 500_000,
            downPct: 0.25,
            loanTerm: 15,
            simHorizon: 15,
            mix: { prime: 0, kalats: 0, katz: 100, malatz: 0, matz: 0 },
            rates: { prime: 0.06, kalats: 0.05, katz: 0.035, malatz: 0.055, matz: 0.04 },
            market: { sp: 0.08, reApp: 0.04, cpi: 0.025, boi: 0.05, rentYield: 0.03 },
            fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 },
            maintPct: 0,
            tax: { useSP: false, useRE: false, useRent: false, mode: 'real' },
            config: {
                drift: 0,
                surplusMode: 'pocket',
                exMode: 'hedged',
                history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: true }, Yld: { is: false } }
            },
            returnSeries: false
        });

        expect(result.totalInterestWasted).toBeGreaterThan(0);
    });
});

describe('Nominal Tax Mode with Forex', () => {
    test('Nominal tax in forex mode taxes USD gains', () => {
        const result = AppLogic.simulate({
            equity: 500_000,
            downPct: 0.25,
            loanTerm: 10,
            simHorizon: 10,
            mix: { prime: 50, kalats: 50, katz: 0, malatz: 0, matz: 0 },
            rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
            market: { sp: 0.10, reApp: 0.04, cpi: 0.025, boi: 0.05, rentYield: 0.03 },
            fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 },
            maintPct: 0,
            tax: { useSP: true, useRE: false, useRent: false, mode: 'nominal' },
            config: {
                drift: 0,
                surplusMode: 'pocket',
                exMode: 'forex',
                history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
            },
            returnSeries: false
        });

        expect(result.spTax).toBeGreaterThan(0);
        expect(result.spUnits).toBeGreaterThan(0);
    });

    test('No tax when USD profit is negative', () => {
        const result = AppLogic.simulate({
            equity: 500_000,
            downPct: 0.25,
            loanTerm: 10,
            simHorizon: 10,
            mix: { prime: 50, kalats: 50, katz: 0, malatz: 0, matz: 0 },
            rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
            market: { sp: -0.05, reApp: 0.04, cpi: 0.025, boi: 0.05, rentYield: 0.03 },
            fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 },
            maintPct: 0,
            tax: { useSP: true, useRE: false, useRent: false, mode: 'nominal' },
            config: {
                drift: 0,
                surplusMode: 'pocket',
                exMode: 'forex',
                history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
            },
            returnSeries: false
        });

        expect(result.spTax).toBe(0);
    });
});

describe('Zero Interest Rate Edge Case', () => {
    test('calcBalanceAfterK handles zero rate', () => {
        const balance = AppLogic.calcBalanceAfterK(1000000, 0, 240, 120);
        // With 0% rate, balance decreases linearly
        expect(balance).toBeCloseTo(500000, -2);
    });
});

describe('Generate Schedule with Rate Resets', () => {
    test('Schedule handles rate resets', () => {
        const noReset = AppLogic.generateSchedule({
            principal: 1000000,
            annualRate: 0.05,
            termMonths: 120,
            method: 'spitzer'
        });

        const withReset = AppLogic.generateSchedule({
            principal: 1000000,
            annualRate: 0.05,
            termMonths: 120,
            method: 'spitzer',
            rateResets: [
                { month: 60, newRate: 0.08 } // Big rate jump
            ]
        });

        expect(withReset.schedule).toHaveLength(120);
        // Higher rate after reset = more total interest
        expect(withReset.totalInterest).toBeGreaterThan(noReset.totalInterest);
    });

    test('Schedule handles multiple rate resets', () => {
        const schedule = AppLogic.generateSchedule({
            principal: 1000000,
            annualRate: 0.04,
            termMonths: 180,
            method: 'spitzer',
            rateResets: [
                { month: 60, newRate: 0.05 },
                { month: 120, newRate: 0.06 }
            ]
        });

        expect(schedule.schedule).toHaveLength(180);
    });
});

describe('Generate Schedule with Array CPI Rates', () => {
    test('CPI-linked schedule with varying annual rates', () => {
        const schedule = AppLogic.generateSchedule({
            principal: 1000000,
            annualRate: 0.035,
            termMonths: 60,
            method: 'spitzer',
            cpiLinked: true,
            cpiRate: [0.02, 0.025, 0.03, 0.035, 0.04] // Different rate each year
        });

        expect(schedule.schedule).toHaveLength(60);
        expect(schedule.totalInterest).toBeGreaterThan(0);
    });
});

describe('Equal Principal with Balance Cap', () => {
    test('Principal payment capped at remaining balance', () => {
        // Short term with high principal payments
        const schedule = AppLogic.generateSchedule({
            principal: 100000,
            annualRate: 0.05,
            termMonths: 12,
            method: 'equalPrincipal'
        });

        expect(schedule.schedule).toHaveLength(12);
        // Last payment should clear the balance
        expect(schedule.schedule[11].balance).toBeCloseTo(0, 0);
    });
});

describe('Search Sweet Spots with All Locks', () => {
    test('All parameters locked returns current values', () => {
        const result = AppLogic.searchSweetSpots({
            eq: 500000,
            curDown: 0.25,
            curDur: 20,
            simDur: 20,
            useTaxSP: false,
            useTaxRE: false,
            useRentTax: false,
            tradeFee: 0,
            merFee: 0,
            buyCostPct: 0,
            maintPct: 0,
            sellCostPct: 0,
            overrides: {},
            mix: { prime: 50, kalats: 50, katz: 0, malatz: 0, matz: 0 },
            drift: 0,
            lockDown: true,
            lockTerm: true,
            lockHor: true,
            horMode: 'custom',
            cfg: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } },
            exMode: 'hedged',
            taxMode: 'real',
            surplusMode: 'pocket'
        });

        expect(result.d).toBe(25); // Current down * 100
        expect(result.t).toBe(20); // Current term
    });

    test('Custom horizon mode searches horizon values', () => {
        const result = AppLogic.searchSweetSpots({
            eq: 500000,
            curDown: 0.25,
            curDur: 20,
            simDur: 20,
            useTaxSP: false,
            useTaxRE: false,
            useRentTax: false,
            tradeFee: 0,
            merFee: 0,
            buyCostPct: 0,
            maintPct: 0,
            sellCostPct: 0,
            overrides: {},
            mix: { prime: 50, kalats: 50, katz: 0, malatz: 0, matz: 0 },
            drift: 0,
            lockDown: true,
            lockTerm: true,
            lockHor: false,
            horMode: 'custom',
            cfg: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } },
            exMode: 'hedged',
            taxMode: 'real',
            surplusMode: 'pocket'
        });

        expect(result.h).toBeGreaterThan(0);
    });
});

describe('Matz Track with Equal Principal', () => {
    test('Matz with equal principal method', () => {
        const result = AppLogic.simulate({
            equity: 500_000,
            downPct: 0.25,
            loanTerm: 20,
            simHorizon: 20,
            mix: { prime: 0, kalats: 0, katz: 0, malatz: 0, matz: 100 },
            rates: { prime: 0.06, kalats: 0.05, katz: 0.035, malatz: 0.055, matz: 0.04 },
            market: { sp: 0.08, reApp: 0.04, cpi: 0.03, boi: 0.05, rentYield: 0.03 },
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

        expect(result.totalInterestWasted).toBeGreaterThan(0);
        expect(result.remainingLoan).toBeCloseTo(0, -2);
    });
});

describe('RE Side Tax in Nominal Mode', () => {
    test('RE side stock taxed nominally', () => {
        const result = AppLogic.simulate({
            equity: 500_000,
            downPct: 0.25,
            loanTerm: 20,
            simHorizon: 20,
            mix: { prime: 50, kalats: 50, katz: 0, malatz: 0, matz: 0 },
            rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
            market: { sp: 0.10, reApp: 0.04, cpi: 0.025, boi: 0.05, rentYield: 0.04 },
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

        expect(result.reSideStockValue).toBeGreaterThan(0);
        expect(result.reSideTax).toBeGreaterThan(0);
    });
});

describe('Default Parameter Values', () => {
    test('calcPurchaseTax defaults to first home', () => {
        const tax = AppLogic.calcPurchaseTax(2000000);
        // Should use first home brackets (0% up to ~1.98M)
        expect(tax).toBeLessThan(50000);
    });

    test('calcMasShevach defaults to single exemption', () => {
        const result = AppLogic.calcMasShevach(3000000, 2000000);
        // Should use single apartment exemption
        expect(result.tax).toBe(0); // Under 5M cap
    });
});

describe('Module Exports', () => {
    test('All expected functions are exported', () => {
        expect(typeof AppLogic.calcPmt).toBe('function');
        expect(typeof AppLogic.calcCAGR).toBe('function');
        expect(typeof AppLogic.searchSweetSpots).toBe('function');
        expect(typeof AppLogic.simulate).toBe('function');
        expect(typeof AppLogic.generateSchedule).toBe('function');
        expect(typeof AppLogic.calcBalanceAfterK).toBe('function');
        expect(typeof AppLogic.calcTotalInterest).toBe('function');
        expect(typeof AppLogic.calcPurchaseTax).toBe('function');
        expect(typeof AppLogic.calcMasShevach).toBe('function');
    });

    test('Historical data arrays are exported', () => {
        expect(Array.isArray(AppLogic.H_SP)).toBe(true);
        expect(Array.isArray(AppLogic.H_RE)).toBe(true);
        expect(Array.isArray(AppLogic.H_EX)).toBe(true);
        expect(Array.isArray(AppLogic.H_CPI)).toBe(true);
        expect(Array.isArray(AppLogic.H_BOI)).toBe(true);
    });

    test('getH function is exported', () => {
        expect(typeof AppLogic.getH).toBe('function');
        // Test getH with valid index
        expect(AppLogic.getH(AppLogic.H_SP, 0)).toBe(AppLogic.H_SP[0]);
        // Test getH with out of bounds index (should wrap)
        expect(AppLogic.getH(AppLogic.H_SP, 100)).toBeDefined();
    });
});
