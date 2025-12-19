const Logic = require('../src/logic.js');

// Shared Test Data
const baseOverrides = { RateP:0, RateK:0, RateZ:0, SP:0, App:0, Int:0, Inf:0, Yld:0 };
const baseMix = { prime: 0, kalats: 100, katz: 0 }; // Pure fixed
const baseCfg = { SP:{is:false}, App:{is:false}, Int:{is:false}, Inf:{is:false}, Yld:{is:false} };

describe('Logic Module: Core Financial Math', () => {

    describe('calcPmt (Spitzer Mortgage Payment)', () => {
        test('Standard Calculation: 100k, 5%, 20 Years', () => {
            // Manual: 100,000 * (0.004166 / (1 - (1.004166)^-240))
            // Approx 659.96
            const pmt = Logic.calcPmt(100000, 0.05, 240);
            expect(pmt).toBeCloseTo(659.95, 1);
        });

        test('Zero Interest Edge Case', () => {
            // 120k / 120 months = 1000
            const pmt = Logic.calcPmt(120000, 0, 120);
            expect(pmt).toBe(1000);
        });

        test('Zero Principal Edge Case', () => {
            const pmt = Logic.calcPmt(0, 0.05, 120);
            expect(pmt).toBe(0);
        });
    });

    describe('calcCAGR (Return on Equity)', () => {
        // Standard baseline: 1M Asset, 50% Down (500k Eq), 20Y, Fixed 0% Growth, 0% Rates
        // Net RE should be 500k (Loan paid off, price same)
        // CAGR should be 0%
        const baseOverrides = { RateP:0, RateK:0, RateZ:0, SP:0, App:0, Int:0, Inf:0, Yld:0 };
        const baseMix = { prime: 0, kalats: 100, katz: 0 }; // Pure fixed
        const baseCfg = { SP:{is:false}, App:{is:false}, Int:{is:false}, Inf:{is:false}, Yld:{is:false} };

        test('Baseline: Zero Growth, Zero Rates -> 0% CAGR', () => {
            const cagr = Logic.calcCAGR(
                500000, 0.5, 20, 20, // Eq, Down, MortDur, SimDur
                false, 0, 0, 'hedged', 'real', // Tax, Fees
                baseCfg, baseOverrides, false, baseMix, // Cfg, Overrides, RentTax, Mix
                0, 0, 0, 0 // Frictions: Buy, Maint, Sell, Drift
            );
            // In reality, you pay principal, so your equity grows from 500k to 1M.
            // Total Invested: 500k (Down) + 500k (Principal Payments over time) = 1M.
            // Exit Equity: 1M.
            // CAGR should be ~0%.
            expect(cagr).toBeCloseTo(0, 1);
        });

        test('Friction Impact: Buying Costs', () => {
            // Buy costs reduce RE net value (paid from equity, not added to investment)
            const paramsNoCosts = {
                equity: 500000, downPct: 0.5, loanTerm: 20, simHorizon: 20,
                mix: { prime: 0, kalats: 100, katz: 0, malatz: 0, matz: 0 }, maintPct: 0,
                rates: { prime: 0.05, kalats: 0.05, katz: 0.035, malatz: 0, matz: 0 },
                market: { sp: 0.07, reApp: 0.03, cpi: 0, boi: 0.04, rentYield: 0.03 },
                fees: { buy: 0, sell: 0, trade: 0, mgmt: 0 },
                tax: { useSP: false, useRE: false, useRent: false, useMasShevach: false },
                config: { drift: 0, surplusMode: 'invest', exMode: 'hedged', history: {} },
                returnSeries: false
            };
            const paramsWithCosts = { ...paramsNoCosts, fees: { ...paramsNoCosts.fees, buy: 0.05 } };
            
            const resNoCosts = Logic.simulate(paramsNoCosts);
            const resWithCosts = Logic.simulate(paramsWithCosts);
            
            // Same starting equity, but buy costs reduce RE returns
            expect(resWithCosts.totalCashInvested).toBe(resNoCosts.totalCashInvested);
            // RE with buy costs should have lower CAGR
            expect(resWithCosts.cagrRE).toBeLessThan(resNoCosts.cagrRE);
        });

        test('Drift Impact: S&P Unhedged', () => {
            // If Shekel devalues (Drift +), S&P Unhedged should go UP.
            // But wait, calcCAGR returns RE CAGR. 
            // Ah, calcCAGR logic calculates NetRE. Does it calculate S&P?
            // Looking at logic.js: It calculates spUnits/spValueHedged but returns ONLY 'cagr' which is based on netRE.
            
            // CRITICAL FINDING: calcCAGR only returns RE CAGR!
            // Optimization relies on this. If the optimizer is maximizing RE CAGR, it ignores S&P.
            // BUT, looking at searchSweetSpots in logic.js...
            // It optimizes 'c'. 'c' is the result of cagrFn (calcCAGR).
            
            // IF calcCAGR only returns RE CAGR, then the 'Drift' parameter passed to it is USELESS for the return value?
            // Let's check logic.js code...
            
            /*
            if(exModeCalc !== 'hedged') { spUnits = totalCashInvested / startEx; spBasisUSD = spUnits; }
            ...
            if(exModeCalc === 'hedged') spValueHedged *= (1+mSP);
            else spUnits *= (1+mSP);
            ...
            let cagr = (Math.pow(netRE / totalCashInvested, 1/simDur) - 1) * 100;
            return cagr;
            */
           
           // CONFIRMED: calcCAGR in logic.js *calculates* S&P side but *returns* only RE CAGR.
           // This means the 'Sweet Spot' optimizer is currently maximizing REAL ESTATE RETURN only.
           // It does NOT compare against S&P.
           // The Drift parameter affects S&P balance tracking inside the function, but that variable is never used in the return statement.
           
           // THIS IS A LOGIC GAP. The optimizer currently finds the best RE deal, regardless of whether S&P beats it.
           // Is this intended? "Sweet Spot" usually implies "Best Mortgage Structure".
           // If so, Drift shouldn't matter for RE (unless we assume RE prices are linked to USD, which is not in this model).
           
           // Verification: Drift affects 'currentEx' which affects 'outOfPocket' conversion to USD if 'unhedged'.
           // BUT 'outOfPocket' comes from RE cashflow.
           // Does Drift affect RE? No.
           // So 'Drift' parameter in calcCAGR is effectively dead code for the *return value* (RE CAGR).
           
           // I will test this hypothesis.
           const cagrDrift0 = Logic.calcCAGR(
                500000, 0.5, 20, 20, false, 0, 0, 'unhedged', 'real',
                baseCfg, baseOverrides, false, baseMix, 0, 0, 0, 0.0
            );
            const cagrDrift10 = Logic.calcCAGR(
                500000, 0.5, 20, 20, false, 0, 0, 'unhedged', 'real',
                baseCfg, baseOverrides, false, baseMix, 0, 0, 0, 10.0
            );
            
            // Expectation: They should be identical if Drift only hits S&P side.
            expect(cagrDrift0).toBeCloseTo(cagrDrift10, 5);
        });
    });

    describe('calcCAGR (Tamheel Dynamics)', () => {
        test('P0: Negative Amortization (Katz Track)', () => {
            // Scenario: 100k Loan, 100% Katz.
            // Interest: 0%. Inflation: 10% (High).
            // Monthly Pmt should cover Principal, BUT Inflation adds to Principal.
            // Net result: Loan Balance should GROW or decrease much slower than normal.
            
            // 1. Normal Case (0% Inf)
            const resNormal = Logic.calcCAGR(
                200000, 0.5, 20, 1, // 1 Year sim
                false, 0, 0, 'hedged', 'real',
                baseCfg, baseOverrides, false, 
                {prime:0, kalats:0, katz:100}, // 100% Katz
                0, 0, 0, 0
            );
            
            // 2. High Inflation Case (10% Inf)
            const overridesHighInf = { ...baseOverrides, Inf: 0.10 };
            const resHighInf = Logic.calcCAGR(
                200000, 0.5, 20, 1,
                false, 0, 0, 'hedged', 'real',
                baseCfg, overridesHighInf, false,
                {prime:0, kalats:0, katz:100},
                0, 0, 0, 0
            );
            
            // CAGR is based on Net Equity (Asset - Loan).
            // In High Inf, Loan grows (bad). But Asset also grows (good) via Inflation?
            // Wait, calcCAGR logic: assetVal *= (1+mApp).
            // If we set App=0, asset stays 200k.
            // So High Inf -> Loan grows -> Equity shrinks -> Lower CAGR.
            
            console.log(`Katz CAGR (0% Inf): ${resNormal.toFixed(2)}%`);
            console.log(`Katz CAGR (10% Inf): ${resHighInf.toFixed(2)}%`);
            
            expect(resHighInf).toBeLessThan(resNormal);
        });
    });

    describe('searchSweetSpots (Optimizer)', () => {
        test('Finds Optimal Duration', () => {
            // Scenario: Low Rates (2%), High App(5%).
            // Longer duration (30Y) should be better because leverage is cheap and asset grows.
            const overrides = { RateP:0.02, RateK:0.02, RateZ:0.02, Int:0.01, SP:0, App:0.05, Inf:0, Yld:0.03 };
            const mix = { prime:100, kalats:0, katz:0 };
            
            const res = Logic.searchSweetSpots({
                eq: 500000, curDown: 0.5, curDur: 20, simDur: 30,
                useTax: false, useRentTax: false, tradeFee:0, merFee:0,
                buyCostPct:0, maintPct:0, sellCostPct:0,
                overrides, mix, drift:0,
                lockDown: true, lockTerm: false, lockHor: true, horMode: 'custom', // Lock everything except Term
                cfg: {SP:{is:false}, App:{is:false}, Int:{is:false}, Inf:{is:false}, Yld:{is:false}}
            });

            // Should prefer longer duration (leverage is positive carry)
            expect(res.t).toBeGreaterThan(20);
        });
    });
});
