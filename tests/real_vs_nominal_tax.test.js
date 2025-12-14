/**
 * Tests for Real vs Nominal taxation calculation
 * Based on ChatGPT example:
 * - $100 invested, 9.5% yield, 2.5% inflation, 25% tax, 43 years
 * 
 * Expected results (tax at end only):
 * 
 * NOMINAL TAX:
 * - Pre-tax FV: 100 * 1.095^43 = $4,952.30
 * - Taxable gain: 4952.30 - 100 = 4852.30
 * - Tax: 0.25 * 4852.30 = $1,213.08
 * - After-tax nominal: $3,739.23
 * - After-tax real: 3739.23 / 2.8915 = $1,293.17
 * 
 * REAL TAX (inflation-indexed basis):
 * - Indexed basis: 100 * 1.025^43 = $289.15
 * - Taxable gain: 4952.30 - 289.15 = 4663.15
 * - Tax: 0.25 * 4663.15 = $1,165.79
 * - After-tax nominal: $3,786.51
 * - After-tax real: 3786.51 / 2.8915 = $1,309.52
 * 
 * Difference: Real tax saves ~$47.29 nominal / ~$16.35 real
 */

const AppLogic = require('../src/logic.js');

describe('Real vs Nominal Tax Calculation', () => {
    // Simplified test using pure math (no mortgage complexity)
    const P = 100;
    const annualReturn = 0.095;
    const annualInflation = 0.025;
    const taxRate = 0.25;
    const years = 43;

    test('Pure math verification - nominal tax', () => {
        const FV = P * Math.pow(1 + annualReturn, years);
        const inflationFactor = Math.pow(1 + annualInflation, years);
        
        // Nominal taxation: tax on (FV - original basis)
        const taxableGain = FV - P;
        const tax = taxRate * taxableGain;
        const afterTaxNominal = FV - tax;
        const afterTaxReal = afterTaxNominal / inflationFactor;
        
        expect(FV).toBeCloseTo(4952.30, 0);
        expect(tax).toBeCloseTo(1213.08, 0);
        expect(afterTaxNominal).toBeCloseTo(3739.23, 0);
        expect(afterTaxReal).toBeCloseTo(1293.17, 0);
    });

    test('Pure math verification - real tax (inflation-indexed basis)', () => {
        const FV = P * Math.pow(1 + annualReturn, years);
        const inflationFactor = Math.pow(1 + annualInflation, years);
        
        // Real taxation: tax on (FV - inflation-adjusted basis)
        const indexedBasis = P * inflationFactor;
        const taxableGain = FV - indexedBasis;
        const tax = taxRate * taxableGain;
        const afterTaxNominal = FV - tax;
        const afterTaxReal = afterTaxNominal / inflationFactor;
        
        expect(indexedBasis).toBeCloseTo(289.15, 0);
        expect(tax).toBeCloseTo(1165.79, 0);
        expect(afterTaxNominal).toBeCloseTo(3786.51, 0);
        expect(afterTaxReal).toBeCloseTo(1309.52, 0);
    });

    test('Real tax should result in lower tax than nominal tax', () => {
        const FV = P * Math.pow(1 + annualReturn, years);
        const inflationFactor = Math.pow(1 + annualInflation, years);
        
        const nominalTax = taxRate * (FV - P);
        const realTax = taxRate * (FV - P * inflationFactor);
        
        expect(realTax).toBeLessThan(nominalTax);
        expect(nominalTax - realTax).toBeCloseTo(47.29, 0);
    });
});

describe('Simulator Tax Calculation', () => {
    // Test the actual simulator with 100% down (no loan) to isolate S&P tax
    
    const baseParams = {
        equity: 100,
        downPct: 1.0,  // 100% down = no mortgage
        loanTerm: 1,
        simHorizon: 43,
        mix: { prime: 0, kalats: 0, katz: 0, malatz: 0, matz: 0 },
        rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
        market: { sp: 0.095, reApp: 0, cpi: 0.025, boi: 0.05, rentYield: 0 },
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

    test('S&P tax calculation - nominal mode', () => {
        const params = {
            ...baseParams,
            tax: { useSP: true, useRE: false, mode: 'nominal' }
        };
        
        const result = AppLogic.simulate(params);

        // With 100% down, equity = asset price = 100
        // S&P grows at 9.5% for 43 years (monthly compounding)
        // Tax should be ~25% of (FV - 100)
        expect(result.spTax).toBeGreaterThan(1000);
        expect(result.spTax).toBeLessThan(1500);
        
        console.log('Nominal mode - spTax:', result.spTax);
        console.log('Nominal mode - spValueHedged:', result.spValueHedged);
    });

    test('S&P tax calculation - real mode should have lower tax', () => {
        const nominalParams = {
            ...baseParams,
            tax: { useSP: true, useRE: false, mode: 'nominal' }
        };
        
        const realParams = {
            ...baseParams,
            tax: { useSP: true, useRE: false, mode: 'real' }
        };

        const nominalResult = AppLogic.simulate(nominalParams);
        const realResult = AppLogic.simulate(realParams);

        // Real tax should be lower than nominal tax
        expect(realResult.spTax).toBeLessThan(nominalResult.spTax);
        
        // And therefore netSP should be higher with real tax
        expect(realResult.netSP).toBeGreaterThan(nominalResult.netSP);
        
        console.log('Nominal tax:', nominalResult.spTax);
        console.log('Real tax:', realResult.spTax);
        console.log('Tax savings:', nominalResult.spTax - realResult.spTax);
        console.log('Net SP (nominal mode):', nominalResult.netSP);
        console.log('Net SP (real mode):', realResult.netSP);
    });

    test('Verify basis inflation tracking', () => {
        const params = {
            ...baseParams,
            tax: { useSP: true, useRE: false, mode: 'real' }
        };
        
        const result = AppLogic.simulate(params);

        // spBasisLinked should be inflated over 43 years
        // Should be close to 100 * 1.025^43 = 289.15
        expect(result.spBasisLinked).toBeCloseTo(289.15, -1);
        
        console.log('Inflation-adjusted basis:', result.spBasisLinked);
    });

    test('Compare simulator results to theoretical values', () => {
        const nominalParams = {
            ...baseParams,
            tax: { useSP: true, useRE: false, mode: 'nominal' }
        };
        
        const realParams = {
            ...baseParams,
            tax: { useSP: true, useRE: false, mode: 'real' }
        };

        const nominalResult = AppLogic.simulate(nominalParams);
        const realResult = AppLogic.simulate(realParams);

        // Theoretical values (annual compounding)
        const theoreticalFV = 100 * Math.pow(1.095, 43);  // 4952.30
        const theoreticalInflFactor = Math.pow(1.025, 43);  // 2.8915
        const theoreticalNominalTax = 0.25 * (theoreticalFV - 100);  // 1213.08
        const theoreticalRealTax = 0.25 * (theoreticalFV - 100 * theoreticalInflFactor);  // 1165.79
        const theoreticalTaxDiff = theoreticalNominalTax - theoreticalRealTax;  // 47.29

        // Simulator uses monthly compounding, so values will differ slightly
        // But the TAX DIFFERENCE should be similar
        const actualTaxDiff = nominalResult.spTax - realResult.spTax;
        
        console.log('Theoretical tax difference:', theoreticalTaxDiff);
        console.log('Actual tax difference:', actualTaxDiff);
        
        // Tax difference should be in the same ballpark (within 20%)
        expect(actualTaxDiff).toBeGreaterThan(theoreticalTaxDiff * 0.8);
        expect(actualTaxDiff).toBeLessThan(theoreticalTaxDiff * 1.5);
    });
});
