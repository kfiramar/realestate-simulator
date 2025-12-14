const AppLogic = require('../src/logic.js');

describe('S&P Taxation', () => {
    const baseParams = {
        equity: 1000000,
        downPct: 1.0,  // 100% equity, no mortgage
        loanTerm: 20,
        simHorizon: 10,
        mix: { prime: 0, kalats: 100, katz: 0, malatz: 0, matz: 0 },
        rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
        market: { sp: 0.10, reApp: 0.05, cpi: 0.03, boi: 0.05, rentYield: 0.10 }, // 3% inflation
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

    describe('Real (Inflation-Adjusted) Mode', () => {
        test('No tax when no real gains (growth = inflation)', () => {
            // S&P grows at 3% = inflation, so no real gain
            const params = {
                ...baseParams,
                market: { ...baseParams.market, sp: 0.03, cpi: 0.03 }, // SP = inflation
                tax: { useSP: true, useRE: true, useRent: false, mode: 'real' }
            };
            
            const result = AppLogic.simulate(params);
            
            // After 10 years at 3%: 1M * 1.03^10 = 1,343,916
            const expectedFV = 1000000 * Math.pow(1.03, 10);
            expect(result.spValueHedged).toBeCloseTo(expectedFV, -2);
            
            // Basis also grew at 3%, so profit should be ~0
            expect(result.spBasisLinked).toBeCloseTo(expectedFV, -2);
            
            // Net should equal gross (no tax)
            expect(result.netSP).toBeCloseTo(result.spValueHedged, -2);
        });

        test('Tax only on real gains above inflation', () => {
            // S&P grows at 10%, inflation at 3%, real gain = ~7%
            const params = {
                ...baseParams,
                market: { ...baseParams.market, sp: 0.10, cpi: 0.03 },
                tax: { useSP: true, useRE: true, useRent: false, mode: 'real' }
            };
            
            const result = AppLogic.simulate(params);
            
            // After 10 years at 10%: 1M * 1.10^10 = 2,593,742
            const expectedFV = 1000000 * Math.pow(1.10, 10);
            expect(result.spValueHedged).toBeCloseTo(expectedFV, -3);
            
            // Basis grew at 3%: 1M * 1.03^10 = 1,343,916
            const expectedBasis = 1000000 * Math.pow(1.03, 10);
            expect(result.spBasisLinked).toBeCloseTo(expectedBasis, -3);
            
            // Real profit = 2,593,742 - 1,343,916 = 1,249,826
            // Tax = 1,249,826 * 0.25 = 312,456
            const realProfit = expectedFV - expectedBasis;
            const expectedTax = realProfit * 0.25;
            const expectedNet = expectedFV - expectedTax;
            
            expect(result.netSP).toBeCloseTo(expectedNet, -3);
            console.log('Real mode: FV=' + expectedFV.toFixed(0) + ', Basis=' + expectedBasis.toFixed(0) + ', Tax=' + expectedTax.toFixed(0));
        });

        test('No tax when S&P underperforms inflation', () => {
            // S&P grows at 1%, inflation at 3%, real loss
            const params = {
                ...baseParams,
                market: { ...baseParams.market, sp: 0.01, cpi: 0.03 },
                tax: { useSP: true, useRE: true, useRent: false, mode: 'real' }
            };
            
            const result = AppLogic.simulate(params);
            
            // FV < Basis, so no tax
            expect(result.spValueHedged).toBeLessThan(result.spBasisLinked);
            expect(result.netSP).toBeCloseTo(result.spValueHedged, -2);
        });
    });

    describe('Nominal Mode (Hedged)', () => {
        test('Tax on all nominal gains', () => {
            // S&P grows at 10%, tax on full 10% gain
            const params = {
                ...baseParams,
                market: { ...baseParams.market, sp: 0.10, cpi: 0.03 },
                tax: { useSP: true, useRE: true, useRent: false, mode: 'nominal' }
            };
            
            const result = AppLogic.simulate(params);
            
            // After 10 years at 10%: 1M * 1.10^10 = 2,593,742
            const expectedFV = 1000000 * Math.pow(1.10, 10);
            expect(result.spValueHedged).toBeCloseTo(expectedFV, -3);
            
            // Nominal profit = 2,593,742 - 1,000,000 = 1,593,742
            // Tax = 1,593,742 * 0.25 = 398,435
            const nominalProfit = expectedFV - 1000000;
            const expectedTax = nominalProfit * 0.25;
            const expectedNet = expectedFV - expectedTax;
            
            expect(result.netSP).toBeCloseTo(expectedNet, -3);
            console.log('Nominal mode: FV=' + expectedFV.toFixed(0) + ', Profit=' + nominalProfit.toFixed(0) + ', Tax=' + expectedTax.toFixed(0));
        });

        test('Nominal tax is higher than real tax when inflation exists', () => {
            const paramsReal = {
                ...baseParams,
                market: { ...baseParams.market, sp: 0.10, cpi: 0.03 },
                tax: { useSP: true, useRE: true, useRent: false, mode: 'real' }
            };
            const paramsNominal = {
                ...baseParams,
                market: { ...baseParams.market, sp: 0.10, cpi: 0.03 },
                tax: { useSP: true, useRE: true, useRent: false, mode: 'nominal' }
            };
            
            const resultReal = AppLogic.simulate(paramsReal);
            const resultNominal = AppLogic.simulate(paramsNominal);
            
            // Same gross value
            expect(resultReal.spValueHedged).toBeCloseTo(resultNominal.spValueHedged, -2);
            
            // Real mode should have higher net (less tax)
            expect(resultReal.netSP).toBeGreaterThan(resultNominal.netSP);
            
            const taxDiff = resultReal.netSP - resultNominal.netSP;
            console.log('Tax savings with real mode: ' + taxDiff.toFixed(0) + ' ₪');
        });
    });

    describe('No Tax Mode', () => {
        test('No tax deducted when tax.use is false', () => {
            const params = {
                ...baseParams,
                market: { ...baseParams.market, sp: 0.10, cpi: 0.03 },
                tax: { useSP: false, useRE: false, useRent: false, mode: 'real' }
            };
            
            const result = AppLogic.simulate(params);
            
            // Net should equal gross
            expect(result.netSP).toBeCloseTo(result.spValueHedged, -2);
        });
    });
});

describe('RE Side Stock Taxation', () => {
    // Scenario: 50% down, high rent yield creates surplus that gets invested
    const baseParams = {
        equity: 500000,
        downPct: 0.5,  // 50% down = 1M asset
        loanTerm: 20,
        simHorizon: 10,
        mix: { prime: 0, kalats: 100, katz: 0, malatz: 0, matz: 0 },
        rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
        market: { sp: 0.10, reApp: 0.05, cpi: 0.03, boi: 0.05, rentYield: 0.08 }, // High rent = surplus
        fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 },
        maintPct: 0,
        config: { 
            drift: 0, 
            surplusMode: 'invest',  // Invest surplus into stocks
            exMode: 'hedged',
            history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
        },
        returnSeries: false
    };

    test('RE side stock has value when surplus is invested', () => {
        const params = {
            ...baseParams,
            tax: { useSP: false, useRE: false, useRent: false, mode: 'real' }
        };
        
        const result = AppLogic.simulate(params);
        
        // With high rent yield and invest mode, should have side stock value
        expect(result.reSideStockValue).toBeGreaterThan(0);
        console.log('RE side stock value: ' + result.reSideStockValue.toFixed(0));
    });

    test('Real mode: RE side stock taxed on inflation-adjusted gains', () => {
        const paramsReal = {
            ...baseParams,
            tax: { useSP: true, useRE: true, useRent: false, mode: 'real' }
        };
        const paramsNoTax = {
            ...baseParams,
            tax: { useSP: false, useRE: false, useRent: false, mode: 'real' }
        };
        
        const resultReal = AppLogic.simulate(paramsReal);
        const resultNoTax = AppLogic.simulate(paramsNoTax);
        
        // With tax, netRE should be less than without tax
        expect(resultReal.netRE).toBeLessThan(resultNoTax.netRE);
        
        const taxPaid = resultNoTax.netRE - resultReal.netRE;
        console.log('RE side stock tax (real mode): ' + taxPaid.toFixed(0));
    });

    test('Nominal mode: RE side stock taxed on full nominal gains', () => {
        const paramsNominal = {
            ...baseParams,
            tax: { useSP: true, useRE: true, useRent: false, mode: 'nominal' }
        };
        const paramsNoTax = {
            ...baseParams,
            tax: { useSP: false, useRE: false, useRent: false, mode: 'nominal' }
        };
        
        const resultNominal = AppLogic.simulate(paramsNominal);
        const resultNoTax = AppLogic.simulate(paramsNoTax);
        
        // With tax, netRE should be less than without tax
        expect(resultNominal.netRE).toBeLessThan(resultNoTax.netRE);
        
        const taxPaid = resultNoTax.netRE - resultNominal.netRE;
        console.log('RE side stock tax (nominal mode): ' + taxPaid.toFixed(0));
    });

    test('Real mode pays less tax than nominal mode on RE side stock', () => {
        const paramsReal = {
            ...baseParams,
            tax: { useSP: true, useRE: true, useRent: false, mode: 'real' }
        };
        const paramsNominal = {
            ...baseParams,
            tax: { useSP: true, useRE: true, useRent: false, mode: 'nominal' }
        };
        
        const resultReal = AppLogic.simulate(paramsReal);
        const resultNominal = AppLogic.simulate(paramsNominal);
        
        // Real mode should have higher netRE (less tax)
        expect(resultReal.netRE).toBeGreaterThan(resultNominal.netRE);
        
        const taxSavings = resultReal.netRE - resultNominal.netRE;
        console.log('RE side stock tax savings (real vs nominal): ' + taxSavings.toFixed(0));
    });
});


describe('Inflation Impact on Real Taxation', () => {
    const baseParams = {
        equity: 1000000,
        downPct: 1.0,
        loanTerm: 20,
        simHorizon: 10,
        mix: { prime: 0, kalats: 100, katz: 0, malatz: 0, matz: 0 },
        rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
        market: { sp: 0.10, reApp: 0.05, boi: 0.05, rentYield: 0.10 },
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

    test('Higher inflation = higher basis = less tax in real mode', () => {
        const result0 = AppLogic.simulate({
            ...baseParams, 
            market: {...baseParams.market, cpi: 0}, 
            tax: { useSP: true, useRE: true, useRent: false, mode: 'real' }
        });
        const result6 = AppLogic.simulate({
            ...baseParams, 
            market: {...baseParams.market, cpi: 0.06}, 
            tax: { useSP: true, useRE: true, useRent: false, mode: 'real' }
        });
        
        // Same gross value (S&P doesn't depend on inflation)
        expect(result0.spValueHedged).toBeCloseTo(result6.spValueHedged, -2);
        
        // Higher inflation = higher basis
        expect(result6.spBasisLinked).toBeGreaterThan(result0.spBasisLinked);
        
        // Higher inflation = higher net (less tax)
        expect(result6.netSP).toBeGreaterThan(result0.netSP);
        
        // Significant difference (should be ~0.9% CAGR, not 0.02%)
        const cagrDiff = result6.cagrSP - result0.cagrSP;
        expect(cagrDiff).toBeGreaterThan(0.5); // At least 0.5% difference
        
        console.log('0% inflation CAGR:', result0.cagrSP.toFixed(2) + '%');
        console.log('6% inflation CAGR:', result6.cagrSP.toFixed(2) + '%');
        console.log('CAGR difference:', cagrDiff.toFixed(2) + '%');
    });

    test('Inflation has no effect in nominal mode', () => {
        const result0 = AppLogic.simulate({
            ...baseParams, 
            market: {...baseParams.market, cpi: 0}, 
            tax: { useSP: true, useRE: true, useRent: false, mode: 'nominal' }
        });
        const result6 = AppLogic.simulate({
            ...baseParams, 
            market: {...baseParams.market, cpi: 0.06}, 
            tax: { useSP: true, useRE: true, useRent: false, mode: 'nominal' }
        });
        
        // Same net value regardless of inflation (nominal doesn't adjust for inflation)
        expect(result0.netSP).toBeCloseTo(result6.netSP, -2);
    });
});
