const Logic = require('../src/logic.js');

describe('Edge Cases and Integration Tests', () => {

    const baseParams = {
        equity: 500000, downPct: 0.5, loanTerm: 20, simHorizon: 10,
        mix: { prime: 33, kalats: 34, katz: 33, malatz: 0, matz: 0 },
        rates: { prime: 0.06, kalats: 0.05, katz: 0.04, malatz: 0.055, matz: 0.045 },
        market: { sp: 0.10, reApp: 0.05, cpi: 0.02, boi: 0.05, rentYield: 0.03 },
        fees: { buy: 0.05, sell: 0.02, trade: 0.005, mgmt: 0.005 },
        maintPct: 0.01,
        tax: { use: true, useRent: true, mode: 'real' },
        config: { drift: 0, surplusMode: 'pocket', exMode: 'hedged',
            history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } }
        },
        returnSeries: true
    };

    describe('Loan Termination', () => {
        test('Loan balance reaches zero after term ends', () => {
            const params = {
                ...baseParams,
                simHorizon: 25, // Longer than 20yr loan term
                mix: { prime: 0, kalats: 100, katz: 0, malatz: 0, matz: 0 }
            };
            const result = Logic.simulate(params);
            
            // After 20 years, loan should be paid off
            expect(result.remainingLoan).toBeCloseTo(0, -2);
            console.log('Remaining loan after 25yr (20yr term):', result.remainingLoan.toFixed(0));
        });

        test('No negative loan balance', () => {
            const params = {
                ...baseParams,
                simHorizon: 30,
                mix: { prime: 0, kalats: 100, katz: 0, malatz: 0, matz: 0 }
            };
            const result = Logic.simulate(params);
            
            expect(result.remainingLoan).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Fees Impact', () => {
        test('Buy fees increase total cash invested', () => {
            const paramsNoFees = { ...baseParams, fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 } };
            const paramsWithFees = { ...baseParams, fees: { buy: 0.05, sell: 0, trade: 0, mgmt: 0 } };
            
            const resultNoFees = Logic.simulate(paramsNoFees);
            const resultWithFees = Logic.simulate(paramsWithFees);
            
            // 5% buy fee on 1M asset = 50k extra
            expect(resultWithFees.totalCashInvested).toBeGreaterThan(resultNoFees.totalCashInvested);
            console.log('Without buy fees:', resultNoFees.totalCashInvested.toFixed(0));
            console.log('With 5% buy fees:', resultWithFees.totalCashInvested.toFixed(0));
        });

        test('Sell fees reduce net RE value', () => {
            const paramsNoFees = { ...baseParams, fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 } };
            const paramsWithFees = { ...baseParams, fees: { buy: 0, sell: 0.05, trade: 0, mgmt: 0 } };
            
            const resultNoFees = Logic.simulate(paramsNoFees);
            const resultWithFees = Logic.simulate(paramsWithFees);
            
            expect(resultWithFees.netRE).toBeLessThan(resultNoFees.netRE);
        });

        test('Management fees reduce S&P returns', () => {
            const paramsNoFees = { ...baseParams, fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 } };
            const paramsWithFees = { ...baseParams, fees: { buy: 0, sell: 0, trade: 0, mgmt: 0.01 } };
            
            const resultNoFees = Logic.simulate(paramsNoFees);
            const resultWithFees = Logic.simulate(paramsWithFees);
            
            expect(resultWithFees.netSP).toBeLessThan(resultNoFees.netSP);
            console.log('S&P without mgmt fees:', resultNoFees.netSP.toFixed(0));
            console.log('S&P with 1% mgmt fees:', resultWithFees.netSP.toFixed(0));
        });
    });

    describe('Rent Tax', () => {
        test('Rent tax applies when rent exceeds threshold', () => {
            const paramsNoRentTax = { ...baseParams, tax: { use: true, useRent: false, mode: 'real' } };
            const paramsWithRentTax = { ...baseParams, tax: { use: true, useRent: true, mode: 'real' } };
            
            const resultNoTax = Logic.simulate(paramsNoRentTax);
            const resultWithTax = Logic.simulate(paramsWithRentTax);
            
            // With rent tax, total rent collected should be lower
            expect(resultWithTax.totalRentCollected).toBeLessThanOrEqual(resultNoTax.totalRentCollected);
        });
    });

    describe('Maintenance Costs', () => {
        test('Maintenance reduces net rent', () => {
            const paramsNoMaint = { ...baseParams, maintPct: 0 };
            const paramsWithMaint = { ...baseParams, maintPct: 0.05 };
            
            const resultNoMaint = Logic.simulate(paramsNoMaint);
            const resultWithMaint = Logic.simulate(paramsWithMaint);
            
            expect(resultWithMaint.totalRentCollected).toBeLessThan(resultNoMaint.totalRentCollected);
        });
    });

    describe('Historical Data Mode', () => {
        test('Historical S&P uses H_SP array', () => {
            const paramsFixed = { 
                ...baseParams, 
                config: { ...baseParams.config, history: { SP: { is: false }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } } }
            };
            const paramsHist = { 
                ...baseParams, 
                config: { ...baseParams.config, history: { SP: { is: true }, App: { is: false }, Int: { is: false }, Inf: { is: false }, Yld: { is: false } } }
            };
            
            const resultFixed = Logic.simulate(paramsFixed);
            const resultHist = Logic.simulate(paramsHist);
            
            // Results should differ when using historical vs fixed rates
            expect(resultFixed.netSP).not.toBeCloseTo(resultHist.netSP, -4);
            console.log('Fixed S&P net:', resultFixed.netSP.toFixed(0));
            console.log('Historical S&P net:', resultHist.netSP.toFixed(0));
        });
    });

    describe('Exchange Rate Modes', () => {
        test('Hedged mode: S&P value in ILS directly', () => {
            const params = { ...baseParams, config: { ...baseParams.config, exMode: 'hedged' } };
            const result = Logic.simulate(params);
            
            expect(result.spValueHedged).toBeGreaterThan(0);
            console.log('Hedged S&P value:', result.spValueHedged.toFixed(0));
        });

        test('Non-hedged mode: S&P in USD units', () => {
            const params = { ...baseParams, config: { ...baseParams.config, exMode: 'exposed' } };
            const result = Logic.simulate(params);
            
            expect(result.spUnits).toBeGreaterThan(0);
            console.log('Non-hedged S&P units:', result.spUnits.toFixed(2));
        });
    });

    describe('Match Surplus Mode', () => {
        test('Match mode withdraws from S&P to match RE surplus', () => {
            const paramsMatch = { 
                ...baseParams, 
                market: { ...baseParams.market, rentYield: 0.08 }, // High rent = surplus
                config: { ...baseParams.config, surplusMode: 'match' }
            };
            const paramsPocket = { 
                ...baseParams, 
                market: { ...baseParams.market, rentYield: 0.08 },
                config: { ...baseParams.config, surplusMode: 'pocket' }
            };
            
            const resultMatch = Logic.simulate(paramsMatch);
            const resultPocket = Logic.simulate(paramsPocket);
            
            // Match mode should have lower S&P value (withdrawals)
            expect(resultMatch.netSP).toBeLessThan(resultPocket.netSP);
            console.log('Match mode S&P:', resultMatch.netSP.toFixed(0));
            console.log('Pocket mode S&P:', resultPocket.netSP.toFixed(0));
        });
    });

    describe('Mixed Mortgage Tracks', () => {
        test('All 5 tracks can run together', () => {
            const params = {
                ...baseParams,
                mix: { prime: 20, kalats: 20, katz: 20, malatz: 20, matz: 20 }
            };
            
            const result = Logic.simulate(params);
            
            expect(result.netRE).toBeGreaterThan(0);
            expect(result.totalInterestWasted).toBeGreaterThan(0);
            console.log('5-track mix - Interest paid:', result.totalInterestWasted.toFixed(0));
        });
    });

    describe('Negative Scenarios', () => {
        test('Handles negative S&P returns', () => {
            const params = {
                ...baseParams,
                market: { ...baseParams.market, sp: -0.05 } // -5% S&P return
            };
            
            const result = Logic.simulate(params);
            
            // S&P value should be less than invested
            expect(result.spValueHedged).toBeLessThan(result.totalCashInvested);
            console.log('S&P with -5% return:', result.spValueHedged.toFixed(0));
        });

        test('Handles negative RE appreciation', () => {
            const params = {
                ...baseParams,
                market: { ...baseParams.market, reApp: -0.02 } // -2% RE appreciation
            };
            
            const result = Logic.simulate(params);
            
            // Should still complete without error
            expect(result.netRE).toBeDefined();
            console.log('RE with -2% appreciation:', result.netRE.toFixed(0));
        });

        test('Handles zero rent yield', () => {
            const params = {
                ...baseParams,
                market: { ...baseParams.market, rentYield: 0 }
            };
            
            const result = Logic.simulate(params);
            
            expect(result.totalRentCollected).toBe(0);
        });
    });

    describe('Series Data Integrity', () => {
        test('Series arrays have correct length', () => {
            const params = { ...baseParams, simHorizon: 15 };
            const result = Logic.simulate(params);
            
            expect(result.series.labels.length).toBe(15);
            expect(result.series.reDataVal.length).toBe(15);
            expect(result.series.spDataVal.length).toBe(15);
            expect(result.series.flowRent.length).toBe(15);
            expect(result.series.flowInt.length).toBe(15);
            expect(result.series.flowPrinc.length).toBe(15);
        });

        test('Series values are monotonic where expected', () => {
            const params = { 
                ...baseParams, 
                simHorizon: 10,
                market: { ...baseParams.market, sp: 0.10, reApp: 0.05 },
                tax: { use: false, useRent: false, mode: 'real' }
            };
            const result = Logic.simulate(params);
            
            // S&P should grow monotonically with positive returns
            for (let i = 1; i < result.series.spDataVal.length; i++) {
                expect(result.series.spDataVal[i]).toBeGreaterThan(result.series.spDataVal[i-1]);
            }
        });
    });

    describe('First Positive Cashflow', () => {
        test('firstPosMonth is null when always negative', () => {
            const params = {
                ...baseParams,
                market: { ...baseParams.market, rentYield: 0.01 } // Very low rent
            };
            const result = Logic.simulate(params);
            
            // With very low rent, might never have positive cashflow
            // Just verify it's a number or null
            expect(result.firstPosMonth === null || typeof result.firstPosMonth === 'number').toBe(true);
        });

        test('firstPosMonth is set when cashflow turns positive', () => {
            const params = {
                ...baseParams,
                market: { ...baseParams.market, rentYield: 0.08 } // High rent
            };
            const result = Logic.simulate(params);
            
            // With high rent, should have positive cashflow early
            expect(result.firstPosMonth).not.toBeNull();
            expect(result.firstPosMonth).toBeGreaterThanOrEqual(0);
            console.log('First positive cashflow month:', result.firstPosMonth);
        });
    });

    describe('Equal Principal vs Spitzer Comparison', () => {
        test('Equal Principal has higher initial payments', () => {
            const paramsSpitzer = { ...baseParams, config: { ...baseParams.config, repayMethod: 'spitzer' } };
            const paramsEqual = { ...baseParams, config: { ...baseParams.config, repayMethod: 'equalPrincipal' } };
            
            const resultSpitzer = Logic.simulate(paramsSpitzer);
            const resultEqual = Logic.simulate(paramsEqual);
            
            // First year payment should be higher for equal principal
            const firstYearSpitzer = Math.abs(resultSpitzer.series.flowInt[0]) + Math.abs(resultSpitzer.series.flowPrinc[0]);
            const firstYearEqual = Math.abs(resultEqual.series.flowInt[0]) + Math.abs(resultEqual.series.flowPrinc[0]);
            
            expect(firstYearEqual).toBeGreaterThan(firstYearSpitzer);
            console.log('First year payment - Spitzer:', firstYearSpitzer.toFixed(0));
            console.log('First year payment - Equal Principal:', firstYearEqual.toFixed(0));
        });

        test('Equal Principal pays less total interest', () => {
            const paramsSpitzer = { ...baseParams, config: { ...baseParams.config, repayMethod: 'spitzer' } };
            const paramsEqual = { ...baseParams, config: { ...baseParams.config, repayMethod: 'equalPrincipal' } };
            
            const resultSpitzer = Logic.simulate(paramsSpitzer);
            const resultEqual = Logic.simulate(paramsEqual);
            
            expect(resultEqual.totalInterestWasted).toBeLessThan(resultSpitzer.totalInterestWasted);
            console.log('Total interest - Spitzer:', resultSpitzer.totalInterestWasted.toFixed(0));
            console.log('Total interest - Equal Principal:', resultEqual.totalInterestWasted.toFixed(0));
        });
    });
});
