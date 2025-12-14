/**
 * Comprehensive tests for searchSweetSpots covering ALL variables
 * Uses locks to reduce search space and speed up tests
 */

const AppLogic = require('../src/logic.js');

describe('searchSweetSpots - All Variables', () => {
    // Base params with locks to speed up tests
    const baseParams = {
        eq: 500000,
        curDown: 0.30,
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
        lockDown: true,  // Lock to speed up
        lockTerm: true,  // Lock to speed up
        lockHor: true,
        horMode: 'auto',
        cfg: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } },
        exMode: 'hedged',
        taxMode: 'real',
        surplusMode: 'pocket',
        termMix: null,
        purchaseTax: 0,
        useMasShevach: false,
        masShevachType: 'single',
        purchaseDiscount: 0
    };

    describe('Core Search', () => {
        test('Returns valid result with all locks', () => {
            const result = AppLogic.searchSweetSpots(baseParams);
            expect(result.d).toBe(30);
            expect(result.t).toBe(20);
            expect(typeof result.c).toBe('number');
        });

        test('Unlocked down payment searches range', () => {
            const result = AppLogic.searchSweetSpots({
                ...baseParams,
                lockDown: false
            });
            expect(result.d).toBeGreaterThanOrEqual(25);
            expect(result.d).toBeLessThanOrEqual(100);
        });

        test('Unlocked term searches range', () => {
            const result = AppLogic.searchSweetSpots({
                ...baseParams,
                lockTerm: false
            });
            expect(result.t).toBeGreaterThanOrEqual(10);
            expect(result.t).toBeLessThanOrEqual(30);
        });
    });

    describe('Tax Parameters', () => {
        test('useTaxSP affects CAGR', () => {
            const noTax = AppLogic.searchSweetSpots({ ...baseParams, useTaxSP: false });
            const withTax = AppLogic.searchSweetSpots({ ...baseParams, useTaxSP: true });
            expect(withTax.c).toBeLessThanOrEqual(noTax.c);
        });

        test('useTaxRE with invest mode', () => {
            const noTax = AppLogic.searchSweetSpots({ ...baseParams, useTaxRE: false, surplusMode: 'invest' });
            const withTax = AppLogic.searchSweetSpots({ ...baseParams, useTaxRE: true, surplusMode: 'invest' });
            expect(withTax.c).toBeLessThanOrEqual(noTax.c);
        });

        test('useRentTax', () => {
            const result = AppLogic.searchSweetSpots({ ...baseParams, useRentTax: true });
            expect(result.c).toBeDefined();
        });

        test('taxMode real vs nominal', () => {
            const real = AppLogic.searchSweetSpots({ ...baseParams, useTaxSP: true, taxMode: 'real' });
            const nominal = AppLogic.searchSweetSpots({ ...baseParams, useTaxSP: true, taxMode: 'nominal' });
            expect(real.c).toBeGreaterThanOrEqual(nominal.c);
        });

        test('useMasShevach', () => {
            const without = AppLogic.searchSweetSpots({ ...baseParams, useMasShevach: false });
            const with_ = AppLogic.searchSweetSpots({ ...baseParams, useMasShevach: true, masShevachType: 'single' });
            expect(with_.c).toBeLessThanOrEqual(without.c);
        });

        test('masShevachType single vs none', () => {
            const single = AppLogic.searchSweetSpots({ ...baseParams, useMasShevach: true, masShevachType: 'single' });
            const none = AppLogic.searchSweetSpots({ ...baseParams, useMasShevach: true, masShevachType: 'none' });
            expect(single.c).toBeGreaterThanOrEqual(none.c);
        });
    });

    describe('Fee Parameters', () => {
        test('tradeFee reduces CAGR', () => {
            const noFee = AppLogic.searchSweetSpots({ ...baseParams, tradeFee: 0 });
            const withFee = AppLogic.searchSweetSpots({ ...baseParams, tradeFee: 0.01 });
            expect(withFee.c).toBeLessThanOrEqual(noFee.c);
        });

        test('merFee reduces CAGR', () => {
            const noFee = AppLogic.searchSweetSpots({ ...baseParams, merFee: 0 });
            const withFee = AppLogic.searchSweetSpots({ ...baseParams, merFee: 0.01 });
            expect(withFee.c).toBeLessThanOrEqual(noFee.c);
        });

        test('buyCostPct reduces CAGR', () => {
            const noFee = AppLogic.searchSweetSpots({ ...baseParams, buyCostPct: 0 });
            const withFee = AppLogic.searchSweetSpots({ ...baseParams, buyCostPct: 0.05 });
            expect(withFee.c).toBeLessThanOrEqual(noFee.c);
        });

        test('maintPct reduces CAGR', () => {
            const noFee = AppLogic.searchSweetSpots({ ...baseParams, maintPct: 0 });
            const withFee = AppLogic.searchSweetSpots({ ...baseParams, maintPct: 0.02 });
            expect(withFee.c).toBeLessThanOrEqual(noFee.c);
        });

        test('sellCostPct reduces CAGR', () => {
            const noFee = AppLogic.searchSweetSpots({ ...baseParams, sellCostPct: 0 });
            const withFee = AppLogic.searchSweetSpots({ ...baseParams, sellCostPct: 0.03 });
            expect(withFee.c).toBeLessThanOrEqual(noFee.c);
        });

        test('purchaseTax reduces CAGR', () => {
            const noTax = AppLogic.searchSweetSpots({ ...baseParams, purchaseTax: 0 });
            const withTax = AppLogic.searchSweetSpots({ ...baseParams, purchaseTax: 50000 });
            expect(withTax.c).toBeLessThanOrEqual(noTax.c);
        });
    });

    describe('Mix Parameters', () => {
        test('Prime-only mix', () => {
            const result = AppLogic.searchSweetSpots({
                ...baseParams,
                mix: { prime: 100, kalats: 0, katz: 0, malatz: 0, matz: 0 }
            });
            expect(result.c).toBeDefined();
        });

        test('Kalats-only mix', () => {
            const result = AppLogic.searchSweetSpots({
                ...baseParams,
                mix: { prime: 0, kalats: 100, katz: 0, malatz: 0, matz: 0 }
            });
            expect(result.c).toBeDefined();
        });

        test('5-track mix', () => {
            const result = AppLogic.searchSweetSpots({
                ...baseParams,
                mix: { prime: 20, kalats: 20, katz: 20, malatz: 20, matz: 20 }
            });
            expect(result.c).toBeDefined();
        });
    });

    describe('Term Mix', () => {
        test('Custom term mix', () => {
            const result = AppLogic.searchSweetSpots({
                ...baseParams,
                termMix: { p: 15, k: 25, z: 20, m: 20, mt: 15 }
            });
            expect(result.c).toBeDefined();
        });
    });

    describe('Exchange Mode', () => {
        test('hedged mode', () => {
            const result = AppLogic.searchSweetSpots({ ...baseParams, exMode: 'hedged' });
            expect(result.c).toBeDefined();
        });

        test('forex mode', () => {
            const result = AppLogic.searchSweetSpots({ ...baseParams, exMode: 'forex' });
            expect(result.c).toBeDefined();
        });

        test('hist mode', () => {
            const result = AppLogic.searchSweetSpots({ ...baseParams, exMode: 'hist' });
            expect(result.c).toBeDefined();
        });
    });

    describe('Surplus Mode', () => {
        test('pocket mode', () => {
            const result = AppLogic.searchSweetSpots({ ...baseParams, surplusMode: 'pocket' });
            expect(result.c).toBeDefined();
        });

        test('invest mode', () => {
            const result = AppLogic.searchSweetSpots({ ...baseParams, surplusMode: 'invest' });
            expect(result.c).toBeDefined();
        });

        test('match mode', () => {
            const result = AppLogic.searchSweetSpots({ ...baseParams, surplusMode: 'match' });
            expect(result.c).toBeDefined();
        });
    });

    describe('Historical Config', () => {
        test('Historical SP', () => {
            const result = AppLogic.searchSweetSpots({
                ...baseParams,
                cfg: { SP: { is: true }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
            });
            expect(result.c).toBeDefined();
        });

        test('Historical App', () => {
            const result = AppLogic.searchSweetSpots({
                ...baseParams,
                cfg: { SP: { is: false }, App: { is: true }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
            });
            expect(result.c).toBeDefined();
        });

        test('Historical Int', () => {
            const result = AppLogic.searchSweetSpots({
                ...baseParams,
                cfg: { SP: { is: false }, App: { is: false }, Int: { is: true }, Inf: { is: false }, Yld: { is: false } }
            });
            expect(result.c).toBeDefined();
        });

        test('Historical Inf', () => {
            const result = AppLogic.searchSweetSpots({
                ...baseParams,
                cfg: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: true }, Yld: { is: false } }
            });
            expect(result.c).toBeDefined();
        });

        test('Historical Yld', () => {
            const result = AppLogic.searchSweetSpots({
                ...baseParams,
                cfg: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: true } }
            });
            expect(result.c).toBeDefined();
        });

        test('All historical', () => {
            const result = AppLogic.searchSweetSpots({
                ...baseParams,
                cfg: { SP: { is: true }, App: { is: true }, Int: { is: true }, Inf: { is: true }, Yld: { is: true } }
            });
            expect(result.c).toBeDefined();
        });
    });

    describe('Drift', () => {
        test('Positive drift', () => {
            const result = AppLogic.searchSweetSpots({ ...baseParams, drift: 0.02 });
            expect(result.c).toBeDefined();
        });

        test('Negative drift', () => {
            const result = AppLogic.searchSweetSpots({ ...baseParams, drift: -0.01 });
            expect(result.c).toBeDefined();
        });
    });

    describe('Overrides', () => {
        test('Market overrides', () => {
            const result = AppLogic.searchSweetSpots({
                ...baseParams,
                overrides: { sp: 0.12, reApp: 0.06 }
            });
            expect(result.c).toBeDefined();
        });
    });

    describe('Purchase Discount', () => {
        test('With discount', () => {
            const noDiscount = AppLogic.searchSweetSpots({ ...baseParams, purchaseDiscount: 0 });
            const withDiscount = AppLogic.searchSweetSpots({ ...baseParams, purchaseDiscount: 0.10 });
            expect(withDiscount.c).toBeGreaterThanOrEqual(noDiscount.c);
        });
    });

    describe('Equity', () => {
        test('Low equity', () => {
            const result = AppLogic.searchSweetSpots({ ...baseParams, eq: 200000 });
            expect(result.c).toBeDefined();
        });

        test('High equity', () => {
            const result = AppLogic.searchSweetSpots({ ...baseParams, eq: 1000000 });
            expect(result.c).toBeDefined();
        });
    });

    describe('Horizon Mode', () => {
        test('Auto mode returns valid horizon', () => {
            const result = AppLogic.searchSweetSpots({
                ...baseParams,
                horMode: 'auto',
                lockHor: false
            });
            expect(result.h).toBeGreaterThan(0);
        });

        test('Custom mode with unlocked horizon', () => {
            const result = AppLogic.searchSweetSpots({
                ...baseParams,
                horMode: 'custom',
                lockHor: false
            });
            expect(result.h).toBeGreaterThan(0);
        });
    });

    describe('Custom calcOverride', () => {
        test('Uses custom function', () => {
            const customFn = jest.fn().mockReturnValue(5.0);
            const result = AppLogic.searchSweetSpots({
                ...baseParams,
                calcOverride: customFn
            });
            expect(customFn).toHaveBeenCalled();
            expect(result.c).toBe(5.0);
        });
    });
});
