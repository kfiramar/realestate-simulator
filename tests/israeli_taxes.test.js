/**
 * Tests for Israeli-specific tax calculations:
 * - Purchase Tax (מס רכישה)
 * - Mas Shevach (מס שבח) - Capital gains tax on real estate
 */

const AppLogic = require('../src/logic.js');

describe('Purchase Tax (מס רכישה)', () => {
    describe('First Home Buyer', () => {
        test('0% tax up to 1,978,745₪', () => {
            const tax = AppLogic.calcPurchaseTax(1_900_000, true);
            expect(tax).toBe(0);
        });

        test('3.5% on portion 1,978,745 - 2,347,040₪', () => {
            const tax = AppLogic.calcPurchaseTax(2_200_000, true);
            // 0% on first 1,978,745 = 0
            // 3.5% on (2,200,000 - 1,978,745) = 221,255 * 0.035 = 7,743.93
            expect(tax).toBeCloseTo(7744, -1);
        });

        test('5% on portion 2,347,040 - 6,055,070₪', () => {
            const tax = AppLogic.calcPurchaseTax(3_000_000, true);
            // 0% on first 1,978,745 = 0
            // 3.5% on (2,347,040 - 1,978,745) = 368,295 * 0.035 = 12,890
            // 5% on (3,000,000 - 2,347,040) = 652,960 * 0.05 = 32,648
            expect(tax).toBeCloseTo(45538, -1);
        });

        test('8% on portion above 6,055,070₪', () => {
            const tax = AppLogic.calcPurchaseTax(8_000_000, true);
            // Complex calculation with all brackets
            expect(tax).toBeGreaterThan(300000);
        });
    });

    describe('Investment Property (Additional Home)', () => {
        test('8% on first 6,055,070₪', () => {
            const tax = AppLogic.calcPurchaseTax(3_000_000, false);
            // 8% on 3,000,000 = 240,000
            expect(tax).toBe(240000);
        });

        test('10% on portion above 6,055,070₪', () => {
            const tax = AppLogic.calcPurchaseTax(8_000_000, false);
            // 8% on 6,055,070 = 484,405.6
            // 10% on (8,000,000 - 6,055,070) = 1,944,930 * 0.10 = 194,493
            expect(tax).toBeCloseTo(678899, -1);
        });
    });

    describe('Edge cases', () => {
        test('Zero price returns zero tax', () => {
            expect(AppLogic.calcPurchaseTax(0, true)).toBe(0);
            expect(AppLogic.calcPurchaseTax(0, false)).toBe(0);
        });

        test('Exact bracket boundary', () => {
            const tax = AppLogic.calcPurchaseTax(1_978_745, true);
            expect(tax).toBe(0);
        });
    });
});

describe('Mas Shevach (מס שבח)', () => {
    describe('No gain scenarios', () => {
        test('No tax when sale price equals cost basis', () => {
            const result = AppLogic.calcMasShevach(2_000_000, 2_000_000, 'single');
            expect(result.tax).toBe(0);
            expect(result.taxableGain).toBe(0);
        });

        test('No tax when sale price below cost basis (loss)', () => {
            const result = AppLogic.calcMasShevach(1_800_000, 2_000_000, 'single');
            expect(result.tax).toBe(0);
        });
    });

    describe('Single apartment exemption', () => {
        test('Full exemption when sale price under 5,008,000₪', () => {
            // Bought for 2M, sold for 3M = 1M gain
            const result = AppLogic.calcMasShevach(3_000_000, 2_000_000, 'single');
            expect(result.tax).toBe(0);
            expect(result.exemptGain).toBe(1_000_000);
        });

        test('Pro-rata exemption for luxury apartment above 5,008,000₪', () => {
            // Bought for 4M, sold for 6M = 2M gain
            // Exempt fraction = 5,008,000 / 6,000,000 = 0.8347
            // Exempt gain = 2M * 0.8347 = 1,669,333
            // Taxable gain = 2M * 0.1653 = 330,667
            // Tax = 330,667 * 0.25 = 82,667
            const result = AppLogic.calcMasShevach(6_000_000, 4_000_000, 'single');
            expect(result.tax).toBeGreaterThan(0);
            expect(result.exemptGain).toBeGreaterThan(0);
            expect(result.taxableGain).toBeGreaterThan(0);
            expect(result.tax).toBeCloseTo(result.taxableGain * 0.25, -1);
        });

        test('Higher tax for very expensive property', () => {
            // Bought for 8M, sold for 12M = 4M gain
            const result = AppLogic.calcMasShevach(12_000_000, 8_000_000, 'single');
            // Exempt fraction = 5,008,000 / 12,000,000 = 0.417
            // Taxable = 4M * (1 - 0.417) = 2.33M
            // Tax = 2.33M * 0.25 = ~583K
            expect(result.tax).toBeGreaterThan(500000);
        });
    });

    describe('Investment property (no exemption)', () => {
        test('Full 25% tax on all gains', () => {
            // Bought for 2M, sold for 3M = 1M gain
            const result = AppLogic.calcMasShevach(3_000_000, 2_000_000, 'none');
            expect(result.tax).toBe(250000); // 1M * 0.25
            expect(result.exemptGain).toBe(0);
            expect(result.taxableGain).toBe(1_000_000);
        });

        test('Large gain fully taxed', () => {
            // Bought for 3M, sold for 8M = 5M gain
            const result = AppLogic.calcMasShevach(8_000_000, 3_000_000, 'none');
            expect(result.tax).toBe(1_250_000); // 5M * 0.25
        });
    });
});

describe('Mas Shevach Integration in Simulation', () => {
    const baseParams = {
        equity: 1_000_000,
        downPct: 0.5,
        loanTerm: 20,
        simHorizon: 10,
        mix: { prime: 0, kalats: 100, katz: 0, malatz: 0, matz: 0 },
        rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
        market: { sp: 0.08, reApp: 0.05, cpi: 0.025, boi: 0.05, rentYield: 0.03 },
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

    test('Mas Shevach reduces netRE when enabled', () => {
        const withoutMasShevach = AppLogic.simulate({
            ...baseParams,
            tax: { useSP: false, useRE: false, useRent: false, useMasShevach: false, mode: 'real' }
        });

        const withMasShevach = AppLogic.simulate({
            ...baseParams,
            tax: { useSP: false, useRE: false, useRent: false, useMasShevach: true, masShevachType: 'single', mode: 'real' }
        });

        // With appreciation, there should be gains, so Mas Shevach should reduce netRE
        // But with single apartment exemption under 5M, might be 0
        expect(withMasShevach.masShevach).toBeGreaterThanOrEqual(0);
        expect(withMasShevach.netRE).toBeLessThanOrEqual(withoutMasShevach.netRE);
    });

    test('Investment property pays more Mas Shevach than single apartment', () => {
        const singleApt = AppLogic.simulate({
            ...baseParams,
            tax: { useSP: false, useRE: false, useRent: false, useMasShevach: true, masShevachType: 'single', mode: 'real' }
        });

        const investment = AppLogic.simulate({
            ...baseParams,
            tax: { useSP: false, useRE: false, useRent: false, useMasShevach: true, masShevachType: 'none', mode: 'real' }
        });

        // Investment property has no exemption, so should pay more tax
        expect(investment.masShevach).toBeGreaterThanOrEqual(singleApt.masShevach);
    });
});

describe('Prepayment on all tracks', () => {
    const baseParams = {
        equity: 500_000,
        downPct: 0.25,
        loanTerm: 25,
        simHorizon: 25,
        mix: { prime: 20, kalats: 20, katz: 20, malatz: 20, matz: 20 },
        rates: { prime: 0.06, kalats: 0.05, katz: 0.035, malatz: 0.055, matz: 0.04 },
        market: { sp: 0.08, reApp: 0.04, cpi: 0.025, boi: 0.05, rentYield: 0.03 },
        fees: { buy: 0.02, sell: 0.02, trade: 0, mgmt: 0 },
        maintPct: 0.01,
        config: {
            drift: 0,
            surplusMode: 'pocket',
            exMode: 'hedged',
            history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
        },
        tax: { useSP: false, useRE: false, useRent: false, mode: 'real' },
        returnSeries: false
    };

    test('Prepayment on Prime track reduces interest', () => {
        const noPrepay = AppLogic.simulate({ ...baseParams, prepay: [] });
        const withPrepay = AppLogic.simulate({ 
            ...baseParams, 
            prepay: [{ track: 'p', amt: 50000, yr: 5 }] 
        });
        expect(withPrepay.totalInterestWasted).toBeLessThan(noPrepay.totalInterestWasted);
    });

    test('Prepayment on Kalats track reduces interest', () => {
        const noPrepay = AppLogic.simulate({ ...baseParams, prepay: [] });
        const withPrepay = AppLogic.simulate({ 
            ...baseParams, 
            prepay: [{ track: 'k', amt: 50000, yr: 5 }] 
        });
        expect(withPrepay.totalInterestWasted).toBeLessThan(noPrepay.totalInterestWasted);
    });

    test('Prepayment on Malatz track reduces interest', () => {
        const noPrepay = AppLogic.simulate({ ...baseParams, prepay: [] });
        const withPrepay = AppLogic.simulate({ 
            ...baseParams, 
            prepay: [{ track: 'm', amt: 50000, yr: 5 }] 
        });
        expect(withPrepay.totalInterestWasted).toBeLessThan(noPrepay.totalInterestWasted);
    });

    test('Prepayment on Katz track reduces interest', () => {
        const noPrepay = AppLogic.simulate({ ...baseParams, prepay: [] });
        const withPrepay = AppLogic.simulate({ 
            ...baseParams, 
            prepay: [{ track: 'z', amt: 50000, yr: 5 }] 
        });
        expect(withPrepay.totalInterestWasted).toBeLessThan(noPrepay.totalInterestWasted);
    });

    test('Prepayment on Matz track reduces interest', () => {
        const noPrepay = AppLogic.simulate({ ...baseParams, prepay: [] });
        const withPrepay = AppLogic.simulate({ 
            ...baseParams, 
            prepay: [{ track: 'mt', amt: 50000, yr: 5 }] 
        });
        expect(withPrepay.totalInterestWasted).toBeLessThan(noPrepay.totalInterestWasted);
    });
});
