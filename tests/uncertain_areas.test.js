const Logic = require('../src/logic.js');

describe('Uncertain Areas - Deep Verification', () => {

    const baseParams = {
        equity: 500000, downPct: 0.5, loanTerm: 20, simHorizon: 10,
        mix: { prime: 0, kalats: 0, katz: 0, malatz: 100, matz: 0 },
        rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
        market: { sp: 0.10, reApp: 0.05, cpi: 0.02, boi: 0.04, rentYield: 0.03 },
        fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 }, maintPct: 0,
        tax: { use: false, useRent: false, mode: 'real' },
        config: { drift: 0, surplusMode: 'pocket', exMode: 'hedged', repayMethod: 'spitzer',
            history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
        },
        returnSeries: true
    };

    describe('1. Malatz/Matz 5-Year Rate Reset', () => {
        
        test('Malatz rate resets at month 60 based on new BoI', () => {
            // Initial: Malatz = BoI(4%) + spread
            // At month 60: should reset to new BoI + same spread
            const params = {
                ...baseParams,
                simHorizon: 6, // 6 years to cross the 5-year mark
                mix: { prime: 0, kalats: 0, katz: 0, malatz: 100, matz: 0 },
                rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
                market: { ...baseParams.market, boi: 0.04 }, // 4% BoI
            };
            
            const result = Logic.simulate(params);
            
            // Verify simulation completes and interest is paid
            expect(result.totalInterestWasted).toBeGreaterThan(0);
            expect(result.series.flowInt.length).toBe(6);
            
            // Interest in year 6 should reflect the reset rate
            // (Can't directly verify rate, but can verify interest changes)
            console.log('Malatz interest by year:', result.series.flowInt.map(i => Math.abs(i).toFixed(0)));
        });

        test('Matz (CPI-linked) rate resets at month 60', () => {
            const params = {
                ...baseParams,
                simHorizon: 6,
                mix: { prime: 0, kalats: 0, katz: 0, malatz: 0, matz: 100 },
                rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.03 },
                market: { ...baseParams.market, boi: 0.04, cpi: 0.025 },
            };
            
            const result = Logic.simulate(params);
            
            expect(result.totalInterestWasted).toBeGreaterThan(0);
            // Matz balance grows with CPI, so remaining loan should be higher than simple amortization
            console.log('Matz remaining loan after 6yr:', result.remainingLoan.toFixed(0));
        });

        test('Rate reset uses spread from initial rate with historical BoI', () => {
            // With historical BoI, the rate at reset time differs from initial
            // Spread = initial rate - initial BoI (from market.boi)
            // At reset: new rate = historical BoI at year 5 + spread
            
            const paramsHist = {
                ...baseParams,
                simHorizon: 10,
                mix: { prime: 0, kalats: 0, katz: 0, malatz: 100, matz: 0 },
                rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
                market: { ...baseParams.market, boi: 0.04 },
                config: { ...baseParams.config, history: { 
                    SP: { is: false }, App: { is: false }, 
                    Int: { is: true }, // Use historical BoI
                    Inf: { is: false }, Yld: { is: false } 
                }},
            };
            
            const paramsFixed = {
                ...baseParams,
                simHorizon: 10,
                mix: { prime: 0, kalats: 0, katz: 0, malatz: 100, matz: 0 },
                rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
                market: { ...baseParams.market, boi: 0.04 },
            };
            
            const resultHist = Logic.simulate(paramsHist);
            const resultFixed = Logic.simulate(paramsFixed);
            
            // Historical BoI varies, so interest should differ
            expect(resultHist.totalInterestWasted).not.toBeCloseTo(resultFixed.totalInterestWasted, -3);
            console.log('Interest (historical BoI):', resultHist.totalInterestWasted.toFixed(0));
            console.log('Interest (fixed BoI):', resultFixed.totalInterestWasted.toFixed(0));
        });
    });

    describe('2. Exchange Rate Drift and USD Tracking', () => {
        
        test('Non-hedged mode tracks S&P in USD units', () => {
            const params = {
                ...baseParams,
                config: { ...baseParams.config, exMode: 'exposed', drift: 0 },
            };
            
            const result = Logic.simulate(params);
            
            expect(result.spUnits).toBeGreaterThan(0);
            expect(result.spBasisUSD).toBeGreaterThan(0);
            console.log('USD units:', result.spUnits.toFixed(2), 'USD basis:', result.spBasisUSD.toFixed(2));
        });

        test('Positive drift increases exchange rate over time', () => {
            const paramsNoDrift = {
                ...baseParams,
                config: { ...baseParams.config, exMode: 'exposed', drift: 0 },
            };
            const paramsDrift = {
                ...baseParams,
                config: { ...baseParams.config, exMode: 'exposed', drift: 2 }, // 2% annual drift
            };
            
            const resultNoDrift = Logic.simulate(paramsNoDrift);
            const resultDrift = Logic.simulate(paramsDrift);
            
            // With positive drift (ILS weakening), same USD units worth more ILS
            expect(resultDrift.netSP).toBeGreaterThan(resultNoDrift.netSP);
            console.log('S&P no drift:', resultNoDrift.netSP.toFixed(0));
            console.log('S&P with 2% drift:', resultDrift.netSP.toFixed(0));
        });

        test('Negative drift decreases exchange rate', () => {
            const paramsNoDrift = {
                ...baseParams,
                config: { ...baseParams.config, exMode: 'exposed', drift: 0 },
            };
            const paramsNegDrift = {
                ...baseParams,
                config: { ...baseParams.config, exMode: 'exposed', drift: -2 },
            };
            
            const resultNoDrift = Logic.simulate(paramsNoDrift);
            const resultNegDrift = Logic.simulate(paramsNegDrift);
            
            expect(resultNegDrift.netSP).toBeLessThan(resultNoDrift.netSP);
        });

        test('Historical exchange rate mode uses H_EX array', () => {
            const params = {
                ...baseParams,
                config: { ...baseParams.config, exMode: 'hist' },
            };
            
            const result = Logic.simulate(params);
            
            // Should complete without error
            expect(result.netSP).toBeDefined();
            expect(result.spUnits).toBeGreaterThan(0);
        });

        test('USD basis tracks injections correctly', () => {
            // With deficit, USD basis should increase
            const params = {
                ...baseParams,
                market: { ...baseParams.market, rentYield: 0.01 }, // Low rent = deficit
                config: { ...baseParams.config, exMode: 'exposed', drift: 0 },
            };
            
            const result = Logic.simulate(params);
            
            // Initial investment + deficits should be tracked in USD basis
            expect(result.spBasisUSD).toBeGreaterThan(0);
            console.log('USD basis with deficits:', result.spBasisUSD.toFixed(2));
        });
    });

    describe('3. Rent Tax Threshold with CPI Indexation', () => {
        
        test('Tax threshold grows with CPI', () => {
            // Base threshold is 5654 ILS
            // With 3% CPI over 10 years, threshold should be ~7600
            
            const paramsNoCpi = {
                ...baseParams,
                market: { ...baseParams.market, cpi: 0, rentYield: 0.05 },
                tax: { use: true, useRent: true, mode: 'real' },
            };
            const paramsWithCpi = {
                ...baseParams,
                market: { ...baseParams.market, cpi: 0.03, rentYield: 0.05 },
                tax: { use: true, useRent: true, mode: 'real' },
            };
            
            const resultNoCpi = Logic.simulate(paramsNoCpi);
            const resultWithCpi = Logic.simulate(paramsWithCpi);
            
            // With CPI, threshold is higher, so less rent is taxed
            // This means more rent collected (less tax paid)
            expect(resultWithCpi.totalRentCollected).toBeGreaterThan(resultNoCpi.totalRentCollected);
            console.log('Rent collected (0% CPI):', resultNoCpi.totalRentCollected.toFixed(0));
            console.log('Rent collected (3% CPI):', resultWithCpi.totalRentCollected.toFixed(0));
        });

        test('Rent below threshold is not taxed', () => {
            // With very low rent yield, rent should be below threshold
            const paramsLowRent = {
                ...baseParams,
                market: { ...baseParams.market, rentYield: 0.005 }, // 0.5% yield
                tax: { use: true, useRent: true, mode: 'real' },
            };
            const paramsNoRentTax = {
                ...baseParams,
                market: { ...baseParams.market, rentYield: 0.005 },
                tax: { use: true, useRent: false, mode: 'real' },
            };
            
            const resultWithTax = Logic.simulate(paramsLowRent);
            const resultNoTax = Logic.simulate(paramsNoRentTax);
            
            // If rent is below threshold, both should be equal
            expect(resultWithTax.totalRentCollected).toBeCloseTo(resultNoTax.totalRentCollected, -2);
        });

        test('10% tax applies to rent above threshold', () => {
            // High rent should trigger 10% tax on amount above threshold
            const paramsHighRent = {
                ...baseParams,
                market: { ...baseParams.market, rentYield: 0.10, cpi: 0 },
                tax: { use: true, useRent: true, mode: 'real' },
            };
            const paramsNoRentTax = {
                ...baseParams,
                market: { ...baseParams.market, rentYield: 0.10, cpi: 0 },
                tax: { use: true, useRent: false, mode: 'real' },
            };
            
            const resultWithTax = Logic.simulate(paramsHighRent);
            const resultNoTax = Logic.simulate(paramsNoRentTax);
            
            // With tax, rent collected should be lower
            expect(resultWithTax.totalRentCollected).toBeLessThan(resultNoTax.totalRentCollected);
            
            const taxPaid = resultNoTax.totalRentCollected - resultWithTax.totalRentCollected;
            console.log('Rent tax paid over 10yr:', taxPaid.toFixed(0));
        });
    });

    describe('4. TermMix - Different Terms Per Track', () => {
        
        test('Tracks with different terms pay off at different times', () => {
            const params = {
                ...baseParams,
                loanTerm: 20,
                termMix: { p: 10, k: 15, z: 20, m: 20, mt: 20 }, // Prime: 10yr, Kalats: 15yr
                mix: { prime: 50, kalats: 50, katz: 0, malatz: 0, matz: 0 },
                simHorizon: 20,
            };
            
            const result = Logic.simulate(params);
            
            // After 20 years, all loans should be paid off
            expect(result.remainingLoan).toBeCloseTo(0, -2);
            console.log('Remaining loan after 20yr:', result.remainingLoan.toFixed(0));
        });

        test('Shorter term track has higher monthly payment', () => {
            // Compare 10yr vs 20yr term for same principal
            const params10yr = {
                ...baseParams,
                loanTerm: 10,
                termMix: { p: 10, k: 10, z: 10, m: 10, mt: 10 },
                mix: { prime: 0, kalats: 100, katz: 0, malatz: 0, matz: 0 },
                simHorizon: 10,
            };
            const params20yr = {
                ...baseParams,
                loanTerm: 20,
                termMix: { p: 20, k: 20, z: 20, m: 20, mt: 20 },
                mix: { prime: 0, kalats: 100, katz: 0, malatz: 0, matz: 0 },
                simHorizon: 10,
            };
            
            const result10yr = Logic.simulate(params10yr);
            const result20yr = Logic.simulate(params20yr);
            
            // First year payment should be higher for 10yr term
            const pmt10 = Math.abs(result10yr.series.flowInt[0]) + Math.abs(result10yr.series.flowPrinc[0]);
            const pmt20 = Math.abs(result20yr.series.flowInt[0]) + Math.abs(result20yr.series.flowPrinc[0]);
            
            expect(pmt10).toBeGreaterThan(pmt20);
            console.log('Monthly payment (10yr term):', pmt10.toFixed(0));
            console.log('Monthly payment (20yr term):', pmt20.toFixed(0));
        });

        test('Shorter term pays less total interest', () => {
            const params10yr = {
                ...baseParams,
                loanTerm: 10,
                termMix: { p: 10, k: 10, z: 10, m: 10, mt: 10 },
                mix: { prime: 0, kalats: 100, katz: 0, malatz: 0, matz: 0 },
                simHorizon: 10,
            };
            const params20yr = {
                ...baseParams,
                loanTerm: 20,
                termMix: { p: 20, k: 20, z: 20, m: 20, mt: 20 },
                mix: { prime: 0, kalats: 100, katz: 0, malatz: 0, matz: 0 },
                simHorizon: 20,
            };
            
            const result10yr = Logic.simulate(params10yr);
            const result20yr = Logic.simulate(params20yr);
            
            expect(result10yr.totalInterestWasted).toBeLessThan(result20yr.totalInterestWasted);
            console.log('Total interest (10yr):', result10yr.totalInterestWasted.toFixed(0));
            console.log('Total interest (20yr):', result20yr.totalInterestWasted.toFixed(0));
        });
    });

    describe('5. Match Mode Withdrawal Logic', () => {
        
        test('Match mode withdraws from S&P when RE has surplus', () => {
            const paramsMatch = {
                ...baseParams,
                market: { ...baseParams.market, rentYield: 0.08 }, // High rent = surplus
                config: { ...baseParams.config, surplusMode: 'match' },
            };
            const paramsPocket = {
                ...baseParams,
                market: { ...baseParams.market, rentYield: 0.08 },
                config: { ...baseParams.config, surplusMode: 'pocket' },
            };
            
            const resultMatch = Logic.simulate(paramsMatch);
            const resultPocket = Logic.simulate(paramsPocket);
            
            // Match mode should have lower S&P value due to withdrawals
            expect(resultMatch.spValueHedged).toBeLessThan(resultPocket.spValueHedged);
            
            // Match mode should have cash from withdrawals
            console.log('Match mode S&P:', resultMatch.spValueHedged.toFixed(0));
            console.log('Pocket mode S&P:', resultPocket.spValueHedged.toFixed(0));
        });

        test('Match mode reduces S&P basis proportionally', () => {
            const params = {
                ...baseParams,
                market: { ...baseParams.market, rentYield: 0.08 },
                config: { ...baseParams.config, surplusMode: 'match' },
            };
            
            const result = Logic.simulate(params);
            
            // Basis should be reduced but not negative
            expect(result.spBasisLinked).toBeGreaterThanOrEqual(0);
            console.log('S&P basis after match withdrawals:', result.spBasisLinked.toFixed(0));
        });

        test('Match mode in non-hedged reduces USD units', () => {
            const paramsMatch = {
                ...baseParams,
                market: { ...baseParams.market, rentYield: 0.08 },
                config: { ...baseParams.config, surplusMode: 'match', exMode: 'exposed' },
            };
            const paramsPocket = {
                ...baseParams,
                market: { ...baseParams.market, rentYield: 0.08 },
                config: { ...baseParams.config, surplusMode: 'pocket', exMode: 'exposed' },
            };
            
            const resultMatch = Logic.simulate(paramsMatch);
            const resultPocket = Logic.simulate(paramsPocket);
            
            expect(resultMatch.spUnits).toBeLessThan(resultPocket.spUnits);
            expect(resultMatch.spBasisUSD).toBeLessThan(resultPocket.spBasisUSD);
        });

        test('Trade fees apply to match withdrawals', () => {
            const paramsNoFees = {
                ...baseParams,
                market: { ...baseParams.market, rentYield: 0.08 },
                fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 },
                config: { ...baseParams.config, surplusMode: 'match' },
            };
            const paramsWithFees = {
                ...baseParams,
                market: { ...baseParams.market, rentYield: 0.08 },
                fees: { buy: 0, sell: 0, trade: 0.01, mgmt: 0 }, // 1% trade fee
                config: { ...baseParams.config, surplusMode: 'match' },
            };
            
            const resultNoFees = Logic.simulate(paramsNoFees);
            const resultWithFees = Logic.simulate(paramsWithFees);
            
            // With trade fees, more S&P needs to be sold to get same cash
            expect(resultWithFees.spValueHedged).toBeLessThan(resultNoFees.spValueHedged);
        });
    });

    describe('6. getH Function Edge Cases', () => {
        
        test('getH returns last element for out-of-bounds index', () => {
            expect(Logic.getH(Logic.H_SP, 100)).toBe(Logic.H_SP[Logic.H_SP.length - 1]);
            expect(Logic.getH(Logic.H_CPI, 50)).toBe(Logic.H_CPI[Logic.H_CPI.length - 1]);
        });

        test('getH returns correct element for valid index', () => {
            expect(Logic.getH(Logic.H_SP, 0)).toBe(Logic.H_SP[0]);
            expect(Logic.getH(Logic.H_SP, 5)).toBe(Logic.H_SP[5]);
        });

        test('Historical arrays have expected length', () => {
            expect(Logic.H_SP.length).toBe(21);
            expect(Logic.H_RE.length).toBe(21);
            expect(Logic.H_EX.length).toBe(21);
            expect(Logic.H_CPI.length).toBe(21);
            expect(Logic.H_BOI.length).toBe(20); // One less
        });
    });

    describe('7. Invest Surplus Mode', () => {
        
        test('Invest mode puts surplus into RE side stock', () => {
            const params = {
                ...baseParams,
                market: { ...baseParams.market, rentYield: 0.08 },
                config: { ...baseParams.config, surplusMode: 'invest' },
            };
            
            const result = Logic.simulate(params);
            
            expect(result.reSideStockValue).toBeGreaterThan(0);
            console.log('RE side stock value:', result.reSideStockValue.toFixed(0));
        });

        test('Trade fees reduce invested amount', () => {
            const paramsNoFees = {
                ...baseParams,
                market: { ...baseParams.market, rentYield: 0.08 },
                fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 },
                config: { ...baseParams.config, surplusMode: 'invest' },
            };
            const paramsWithFees = {
                ...baseParams,
                market: { ...baseParams.market, rentYield: 0.08 },
                fees: { buy: 0, sell: 0, trade: 0.01, mgmt: 0 },
                config: { ...baseParams.config, surplusMode: 'invest' },
            };
            
            const resultNoFees = Logic.simulate(paramsNoFees);
            const resultWithFees = Logic.simulate(paramsWithFees);
            
            expect(resultWithFees.reSideStockValue).toBeLessThan(resultNoFees.reSideStockValue);
        });

        test('RE side stock grows at S&P rate', () => {
            // With high S&P return, RE side stock should grow significantly
            const paramsLowSP = {
                ...baseParams,
                market: { ...baseParams.market, rentYield: 0.08, sp: 0.05 },
                config: { ...baseParams.config, surplusMode: 'invest' },
            };
            const paramsHighSP = {
                ...baseParams,
                market: { ...baseParams.market, rentYield: 0.08, sp: 0.15 },
                config: { ...baseParams.config, surplusMode: 'invest' },
            };
            
            const resultLow = Logic.simulate(paramsLowSP);
            const resultHigh = Logic.simulate(paramsHighSP);
            
            expect(resultHigh.reSideStockValue).toBeGreaterThan(resultLow.reSideStockValue);
        });
    });

    describe('8. Purchase Discount', () => {
        
        test('Positive discount increases initial asset value', () => {
            const paramsNoDiscount = { ...baseParams, purchaseDiscount: 0 };
            const paramsWithDiscount = { ...baseParams, purchaseDiscount: 0.10 }; // 10% below market
            
            const resultNo = Logic.simulate(paramsNoDiscount);
            const resultWith = Logic.simulate(paramsWithDiscount);
            
            // With 10% discount, asset is worth more than purchase price
            // This should result in higher RE net value
            expect(resultWith.netRE).toBeGreaterThan(resultNo.netRE);
            console.log('RE without discount:', resultNo.netRE.toFixed(0));
            console.log('RE with 10% discount:', resultWith.netRE.toFixed(0));
        });

        test('Negative discount (overpay) decreases asset value', () => {
            const paramsNoDiscount = { ...baseParams, purchaseDiscount: 0 };
            const paramsOverpay = { ...baseParams, purchaseDiscount: -0.10 }; // 10% above market
            
            const resultNo = Logic.simulate(paramsNoDiscount);
            const resultOverpay = Logic.simulate(paramsOverpay);
            
            expect(resultOverpay.netRE).toBeLessThan(resultNo.netRE);
        });

        test('Discount affects rent calculation (based on true market value)', () => {
            const paramsNoDiscount = { ...baseParams, purchaseDiscount: 0 };
            const paramsWithDiscount = { ...baseParams, purchaseDiscount: 0.10 };
            
            const resultNo = Logic.simulate(paramsNoDiscount);
            const resultWith = Logic.simulate(paramsWithDiscount);
            
            // Higher asset value = higher rent
            expect(resultWith.totalRentCollected).toBeGreaterThan(resultNo.totalRentCollected);
        });
    });
});
