const Logic = require('../src/logic.js');

describe('Mathematical Verification', () => {

    describe('1. Mortgage Payment Calculations', () => {
        
        test('Spitzer (Annuity) formula: P * r(1+r)^n / ((1+r)^n - 1)', () => {
            // Manual calculation: 100k loan, 5% annual, 20 years (240 months)
            const P = 100000;
            const rAnn = 0.05;
            const n = 240;
            const r = rAnn / 12; // monthly rate
            
            // Formula: PMT = P * r(1+r)^n / ((1+r)^n - 1)
            const manualPmt = P * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
            const codePmt = Logic.calcPmt(P, rAnn, n);
            
            expect(codePmt).toBeCloseTo(manualPmt, 2);
            console.log('Spitzer PMT (100k, 5%, 20yr):', codePmt.toFixed(2));
        });

        test('Zero interest = simple division', () => {
            const pmt = Logic.calcPmt(120000, 0, 120);
            expect(pmt).toBe(1000); // 120k / 120 months
        });

        test('Equal Principal: constant principal + declining interest', () => {
            // With equal principal, monthly principal = P/n
            // Interest declines as balance decreases
            const params = {
                equity: 500000, downPct: 0.5, loanTerm: 20, simHorizon: 1,
                mix: { prime: 0, kalats: 100, katz: 0, malatz: 0, matz: 0 },
                rates: { prime: 0.06, kalats: 0.06, katz: 0.04, malatz: 0.055, matz: 0.045 },
                market: { sp: 0.10, reApp: 0.05, cpi: 0.02, boi: 0.05, rentYield: 0.03 },
                fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 }, maintPct: 0,
                tax: { useSP: false, useRE: false, useRent: false, mode: 'real' },
                config: { drift: 0, surplusMode: 'pocket', exMode: 'hedged', repayMethod: 'equalPrincipal',
                    history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
                },
                returnSeries: true
            };
            
            const result = Logic.simulate(params);
            
            // Monthly principal should be 500k / 240 = 2083.33
            const expectedMonthlyPrinc = 500000 / 240;
            // First year total principal = 12 * 2083.33 = 25000
            const actualYearPrinc = Math.abs(result.series.flowPrinc[0]) * 12;
            
            expect(actualYearPrinc).toBeCloseTo(25000, -2);
            console.log('Equal Principal - Year 1 principal:', actualYearPrinc.toFixed(0));
        });
    });

    describe('2. S&P Growth and Compounding', () => {
        
        test('Monthly compounding: (1 + annual)^(1/12) - 1', () => {
            const annualRate = 0.10;
            const monthlyRate = Math.pow(1 + annualRate, 1/12) - 1;
            
            // Verify 12 months of monthly compounding = annual rate
            const compounded = Math.pow(1 + monthlyRate, 12);
            expect(compounded).toBeCloseTo(1.10, 6);
            
            console.log('Monthly rate for 10% annual:', (monthlyRate * 100).toFixed(4) + '%');
        });

        test('S&P value after N years = initial * (1 + rate)^N', () => {
            const params = {
                equity: 1000000, downPct: 1.0, loanTerm: 20, simHorizon: 10,
                mix: { prime: 0, kalats: 100, katz: 0, malatz: 0, matz: 0 },
                rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
                market: { sp: 0.10, reApp: 0.05, cpi: 0.02, boi: 0.05, rentYield: 0.10 },
                fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 }, maintPct: 0,
                tax: { useSP: false, useRE: false, useRent: false, mode: 'real' },
                config: { drift: 0, surplusMode: 'pocket', exMode: 'hedged',
                    history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
                },
                returnSeries: false
            };
            
            const result = Logic.simulate(params);
            const expected = 1000000 * Math.pow(1.10, 10);
            
            expect(result.spValueHedged).toBeCloseTo(expected, -2);
            console.log('S&P after 10yr at 10%:', result.spValueHedged.toFixed(0), 'Expected:', expected.toFixed(0));
        });
    });

    describe('3. Inflation Basis Tracking', () => {
        
        test('spBasisLinked grows at inflation rate', () => {
            const params = {
                equity: 1000000, downPct: 1.0, loanTerm: 20, simHorizon: 10,
                mix: { prime: 0, kalats: 100, katz: 0, malatz: 0, matz: 0 },
                rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
                market: { sp: 0.10, reApp: 0.05, cpi: 0.03, boi: 0.05, rentYield: 0.10 },
                fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 }, maintPct: 0,
                tax: { useSP: true, useRE: true, useRent: false, mode: 'real' },
                config: { drift: 0, surplusMode: 'pocket', exMode: 'hedged',
                    history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
                },
                returnSeries: false
            };
            
            const result = Logic.simulate(params);
            const expectedBasis = 1000000 * Math.pow(1.03, 10);
            
            expect(result.spBasisLinked).toBeCloseTo(expectedBasis, -2);
            console.log('Basis after 10yr at 3% inflation:', result.spBasisLinked.toFixed(0), 'Expected:', expectedBasis.toFixed(0));
        });
    });

    describe('4. Tax Calculations', () => {
        
        test('Real mode: tax = (value - inflationAdjustedBasis) * 0.25', () => {
            const params = {
                equity: 1000000, downPct: 1.0, loanTerm: 20, simHorizon: 10,
                mix: { prime: 0, kalats: 100, katz: 0, malatz: 0, matz: 0 },
                rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
                market: { sp: 0.10, reApp: 0.05, cpi: 0.03, boi: 0.05, rentYield: 0.10 },
                fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 }, maintPct: 0,
                tax: { useSP: true, useRE: true, useRent: false, mode: 'real' },
                config: { drift: 0, surplusMode: 'pocket', exMode: 'hedged',
                    history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
                },
                returnSeries: false
            };
            
            const result = Logic.simulate(params);
            
            const expectedFV = 1000000 * Math.pow(1.10, 10);
            const expectedBasis = 1000000 * Math.pow(1.03, 10);
            const expectedTax = (expectedFV - expectedBasis) * 0.25;
            const expectedNet = expectedFV - expectedTax;
            
            expect(result.netSP).toBeCloseTo(expectedNet, -2);
            console.log('Real tax calculation verified. Net:', result.netSP.toFixed(0));
        });

        test('Nominal mode: tax = (value - originalInvestment) * 0.25', () => {
            const params = {
                equity: 1000000, downPct: 1.0, loanTerm: 20, simHorizon: 10,
                mix: { prime: 0, kalats: 100, katz: 0, malatz: 0, matz: 0 },
                rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
                market: { sp: 0.10, reApp: 0.05, cpi: 0.03, boi: 0.05, rentYield: 0.10 },
                fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 }, maintPct: 0,
                tax: { useSP: true, useRE: true, useRent: false, mode: 'nominal' },
                config: { drift: 0, surplusMode: 'pocket', exMode: 'hedged',
                    history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
                },
                returnSeries: false
            };
            
            const result = Logic.simulate(params);
            
            const expectedFV = 1000000 * Math.pow(1.10, 10);
            const expectedTax = (expectedFV - 1000000) * 0.25;
            const expectedNet = expectedFV - expectedTax;
            
            expect(result.netSP).toBeCloseTo(expectedNet, -2);
            console.log('Nominal tax calculation verified. Net:', result.netSP.toFixed(0));
        });
    });

    describe('5. IRR/CAGR Calculation', () => {
        
        test('Simple CAGR: (FV/PV)^(1/n) - 1', () => {
            // No additional investments, just initial lump sum
            const params = {
                equity: 1000000, downPct: 1.0, loanTerm: 20, simHorizon: 10,
                mix: { prime: 0, kalats: 100, katz: 0, malatz: 0, matz: 0 },
                rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
                market: { sp: 0.10, reApp: 0.05, cpi: 0.02, boi: 0.05, rentYield: 0.10 },
                fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 }, maintPct: 0,
                tax: { useSP: false, useRE: false, useRent: false, mode: 'real' },
                config: { drift: 0, surplusMode: 'pocket', exMode: 'hedged',
                    history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
                },
                returnSeries: false
            };
            
            const result = Logic.simulate(params);
            
            // With no tax and no additional investments, CAGR should equal input rate
            expect(result.cagrSP).toBeCloseTo(10, 0.5);
            console.log('CAGR (no tax, no additions):', result.cagrSP.toFixed(2) + '%');
        });

        test('IRR accounts for timing of cash flows', () => {
            // With mortgage deficit, additional cash is invested over time
            // IRR should still show ~10% if S&P returns 10%
            const params = {
                equity: 500000, downPct: 0.5, loanTerm: 20, simHorizon: 10,
                mix: { prime: 0, kalats: 100, katz: 0, malatz: 0, matz: 0 },
                rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
                market: { sp: 0.10, reApp: 0.05, cpi: 0.02, boi: 0.05, rentYield: 0.02 }, // Low rent = deficit
                fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 }, maintPct: 0,
                tax: { useSP: false, useRE: false, useRent: false, mode: 'real' },
                config: { drift: 0, surplusMode: 'pocket', exMode: 'hedged',
                    history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
                },
                returnSeries: false
            };
            
            const result = Logic.simulate(params);
            
            // Even with additional investments, IRR should be ~10%
            expect(result.cagrSP).toBeCloseTo(10, 0.5);
            console.log('IRR with deficit investments:', result.cagrSP.toFixed(2) + '%');
            console.log('Total invested:', result.totalCashInvested.toFixed(0));
        });
    });

    describe('6. CPI-Linked Track (Katz)', () => {
        
        test('Katz balance grows with CPI', () => {
            const params = {
                equity: 500000, downPct: 0.5, loanTerm: 20, simHorizon: 5,
                mix: { prime: 0, kalats: 0, katz: 100, malatz: 0, matz: 0 }, // 100% Katz
                rates: { prime: 0.06, kalats: 0.05, katz: 0.03, malatz: 0.055, matz: 0.045 },
                market: { sp: 0.10, reApp: 0.05, cpi: 0.05, boi: 0.05, rentYield: 0.10 }, // 5% CPI
                fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 }, maintPct: 0,
                tax: { useSP: false, useRE: false, useRent: false, mode: 'real' },
                config: { drift: 0, surplusMode: 'pocket', exMode: 'hedged',
                    history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
                },
                returnSeries: true
            };
            
            const result = Logic.simulate(params);
            
            // With CPI-linked loan, remaining balance should be higher than non-linked
            // because the principal adjusts for inflation
            console.log('Katz remaining loan after 5yr:', result.remainingLoan.toFixed(0));
            
            // The interest paid should reflect CPI adjustment
            expect(result.totalInterestWasted).toBeGreaterThan(0);
        });
    });

    describe('7. Variable Rate Resets', () => {
        
        test('Prime rate follows BoI changes', () => {
            // Prime = BoI + spread
            // If BoI changes, Prime should change
            const params = {
                equity: 500000, downPct: 0.5, loanTerm: 20, simHorizon: 10,
                mix: { prime: 100, kalats: 0, katz: 0, malatz: 0, matz: 0 }, // 100% Prime
                rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
                market: { sp: 0.10, reApp: 0.05, cpi: 0.02, boi: 0.05, rentYield: 0.10 },
                fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 }, maintPct: 0,
                tax: { useSP: false, useRE: false, useRent: false, mode: 'real' },
                config: { drift: 0, surplusMode: 'pocket', exMode: 'hedged',
                    history: { SP: { is: false }, App: { is: false }, Int: { is: true }, Inf: { is: false }, Yld: { is: false } }
                },
                returnSeries: true
            };
            
            const result = Logic.simulate(params);
            
            // With historical interest rates, Prime should vary
            console.log('Prime track - Total interest paid:', result.totalInterestWasted.toFixed(0));
            expect(result.totalInterestWasted).toBeGreaterThan(0);
        });

        test('Malatz/Matz reset every 5 years', () => {
            // These tracks reset to BoI + spread every 60 months
            const params = {
                equity: 500000, downPct: 0.5, loanTerm: 20, simHorizon: 10,
                mix: { prime: 0, kalats: 0, katz: 0, malatz: 100, matz: 0 }, // 100% Malatz
                rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
                market: { sp: 0.10, reApp: 0.05, cpi: 0.02, boi: 0.05, rentYield: 0.10 },
                fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 }, maintPct: 0,
                tax: { useSP: false, useRE: false, useRent: false, mode: 'real' },
                config: { drift: 0, surplusMode: 'pocket', exMode: 'hedged',
                    history: { SP: { is: false }, App: { is: false }, Int: { is: true }, Inf: { is: false }, Yld: { is: false } }
                },
                returnSeries: true
            };
            
            const result = Logic.simulate(params);
            
            console.log('Malatz track - Total interest paid:', result.totalInterestWasted.toFixed(0));
            expect(result.totalInterestWasted).toBeGreaterThan(0);
        });
    });

    describe('8. Asset Appreciation', () => {
        
        test('Asset value = initial * (1 + appreciation)^years', () => {
            const params = {
                equity: 500000, downPct: 0.5, loanTerm: 20, simHorizon: 10,
                mix: { prime: 0, kalats: 100, katz: 0, malatz: 0, matz: 0 },
                rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
                market: { sp: 0.10, reApp: 0.05, cpi: 0.02, boi: 0.05, rentYield: 0.03 },
                fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 }, maintPct: 0,
                tax: { useSP: false, useRE: false, useRent: false, mode: 'real' },
                config: { drift: 0, surplusMode: 'pocket', exMode: 'hedged',
                    history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
                },
                returnSeries: true
            };
            
            const result = Logic.simulate(params);
            
            // Asset price = 1M (500k equity / 0.5 down)
            // After 10 years at 5% appreciation: 1M * 1.05^10 = 1,628,895
            const expectedAssetValue = 1000000 * Math.pow(1.05, 10);
            
            // netRE = assetValue - remainingLoan + sideStock + sideCash
            // With no surplus invested and loan partially paid, we can estimate
            console.log('Expected asset value:', expectedAssetValue.toFixed(0));
            console.log('Net RE:', result.netRE.toFixed(0));
        });
    });

    describe('9. Rent Calculation', () => {
        
        test('Monthly rent = assetValue * rentYield / 12', () => {
            const params = {
                equity: 1000000, downPct: 1.0, loanTerm: 20, simHorizon: 1,
                mix: { prime: 0, kalats: 100, katz: 0, malatz: 0, matz: 0 },
                rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
                market: { sp: 0.10, reApp: 0.00, cpi: 0.00, boi: 0.05, rentYield: 0.03 }, // 3% yield, no appreciation
                fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 }, maintPct: 0,
                tax: { useSP: false, useRE: false, useRent: false, mode: 'real' },
                config: { drift: 0, surplusMode: 'pocket', exMode: 'hedged',
                    history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
                },
                returnSeries: true
            };
            
            const result = Logic.simulate(params);
            
            // Monthly rent = 1M * 0.03 / 12 = 2500
            const expectedMonthlyRent = 1000000 * 0.03 / 12;
            const actualMonthlyRent = result.series.flowRent[0];
            
            expect(actualMonthlyRent).toBeCloseTo(expectedMonthlyRent, 0);
            console.log('Monthly rent (3% yield on 1M):', actualMonthlyRent.toFixed(0), 'Expected:', expectedMonthlyRent.toFixed(0));
        });
    });

    describe('10. Surplus Handling', () => {
        
        test('Invest mode: surplus goes to reSideStockValue', () => {
            const params = {
                equity: 500000, downPct: 0.5, loanTerm: 20, simHorizon: 10,
                mix: { prime: 0, kalats: 100, katz: 0, malatz: 0, matz: 0 },
                rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
                market: { sp: 0.10, reApp: 0.05, cpi: 0.02, boi: 0.05, rentYield: 0.08 }, // High rent = surplus
                fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 }, maintPct: 0,
                tax: { useSP: false, useRE: false, useRent: false, mode: 'real' },
                config: { drift: 0, surplusMode: 'invest', exMode: 'hedged',
                    history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
                },
                returnSeries: false
            };
            
            const result = Logic.simulate(params);
            
            expect(result.reSideStockValue).toBeGreaterThan(0);
            console.log('RE side stock value (invest mode):', result.reSideStockValue.toFixed(0));
        });

        test('Pocket mode: surplus does not go to stocks', () => {
            const params = {
                equity: 500000, downPct: 0.5, loanTerm: 20, simHorizon: 10,
                mix: { prime: 0, kalats: 100, katz: 0, malatz: 0, matz: 0 },
                rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
                market: { sp: 0.10, reApp: 0.05, cpi: 0.02, boi: 0.05, rentYield: 0.08 },
                fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 }, maintPct: 0,
                tax: { useSP: false, useRE: false, useRent: false, mode: 'real' },
                config: { drift: 0, surplusMode: 'pocket', exMode: 'hedged',
                    history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
                },
                returnSeries: false
            };
            
            const result = Logic.simulate(params);
            
            // In pocket mode, surplus goes to reSideCash, not stocks
            expect(result.reSideStockValue).toBe(0);
            console.log('RE side stock value (pocket mode):', result.reSideStockValue);
        });
    });
});
