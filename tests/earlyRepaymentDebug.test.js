/**
 * @jest-environment jsdom
 */
const Logic = require('../src/logic.js');

describe('Early Repayment Debug - All Years', () => {
    
    test('Output penalty for years 1-25 with ACTUAL default mix (30% Prime, 40% Kalatz, 30% Malatz)', () => {
        // ACTUAL default values from index.html
        const equity = 400000;
        const downPct = 0.30;
        const loanTerm = 25;
        const totalLoan = equity / downPct - equity;
        
        // ACTUAL default mix: 30% Prime, 40% Kalatz, 30% Malatz
        const mix = { prime: 30, kalatz: 40, katz: 0, malatz: 30, matz: 0 };
        const rates = { prime: 0.06, kalats: 0.055, kalatz: 0.055, katz: 0.035, malatz: 0.05, matz: 0.03 };
        const boiRate = 0.0425;
        const boiAvgRate = boiRate - 0.005; // 3.75%
        
        console.log('\n=== EARLY REPAYMENT PENALTY BY EXIT YEAR ===');
        console.log(`Loan: ${(totalLoan/1000).toFixed(0)}k`);
        console.log(`Mix: ${mix.prime}% Prime + ${mix.kalatz}% Kalatz + ${mix.malatz}% Malatz`);
        console.log(`Rates: Prime ${(rates.prime*100).toFixed(1)}%, Kalatz ${(rates.kalatz*100).toFixed(1)}%, Malatz ${(rates.malatz*100).toFixed(1)}%`);
        console.log(`BOI Avg Rate: ${(boiAvgRate*100).toFixed(2)}%`);
        console.log('');
        console.log('Note: Malatz has 5-year reset - penalty only calculated until next reset');
        console.log('');
        
        for (let exitYear = 1; exitYear <= 25; exitYear++) {
            // Calculate remaining balance at exit year using simulate
            const simResult = Logic.simulate({
                equity,
                downPct,
                loanTerm,
                simHorizon: exitYear,
                mix: { prime: mix.prime, kalats: mix.kalatz, katz: mix.katz, malatz: mix.malatz, matz: mix.matz },
                rates: { prime: rates.prime, kalats: rates.kalatz, katz: rates.katz, malatz: rates.malatz, matz: rates.matz },
                market: { sp: 0.07, reApp: 0.03, cpi: 0.025, boi: boiRate, rentYield: 0.03 },
                fees: { buy: 0.02, sell: 0.02, trade: 0.005, mgmt: 0.005 },
                tax: { useSP: false, useRE: false, useRent: false, useMasShevach: false },
                config: { drift: -0.5, surplusMode: 'match', exMode: 'hedged', history: {} },
                termMix: { p: loanTerm, k: loanTerm, z: loanTerm, m: loanTerm, mt: loanTerm },
                returnSeries: false
            });
            
            const bal = simResult.balances || { p: 0, k: 0, z: 0, m: 0, mt: 0 };
            
            // Calculate remaining months
            const remainingMonths = {
                prime: Math.max(0, (loanTerm - exitYear) * 12),
                kalatz: Math.max(0, (loanTerm - exitYear) * 12),
                malatz: Math.max(0, (loanTerm - exitYear) * 12),
                katz: Math.max(0, (loanTerm - exitYear) * 12),
                matz: Math.max(0, (loanTerm - exitYear) * 12)
            };
            
            const originalTermMonths = {
                prime: loanTerm * 12,
                kalatz: loanTerm * 12,
                malatz: loanTerm * 12,
                katz: loanTerm * 12,
                matz: loanTerm * 12
            };
            
            // Months to next 5-year reset (THIS IS THE KEY!)
            const monthsToReset = {
                malatz: remainingMonths.malatz > 0 ? (60 - (exitYear * 12) % 60) % 60 : 0,
                matz: remainingMonths.matz > 0 ? (60 - (exitYear * 12) % 60) % 60 : 0
            };
            
            const fees = Logic.calcTotalEarlyRepaymentFees({
                balances: { prime: bal.p, kalatz: bal.k, malatz: bal.m, katz: bal.z, matz: bal.mt },
                rates: { prime: rates.prime, kalatz: rates.kalatz, malatz: rates.malatz, katz: rates.katz, matz: rates.matz },
                boiAvgRate,
                remainingMonths,
                originalTermMonths,
                monthsToReset,
                cpiIndex: simResult.cpiIndex || 1,
                prepayDay: 20,
                avgCpiChange12m: 0.025 / 12
            });
            
            const loanAge = exitYear;
            const discountPct = loanAge >= 5 ? 30 : loanAge >= 3 ? 20 : 0;
            
            // Show Malatz-specific info
            const malatzInfo = monthsToReset.malatz === 0 ? 'ON RESET' : `${monthsToReset.malatz}mo to reset`;
            
            console.log(
                `Year ${exitYear.toString().padStart(2)}: ` +
                `P=${(bal.p/1000).toFixed(0).padStart(3)}k K=${(bal.k/1000).toFixed(0).padStart(3)}k M=${(bal.m/1000).toFixed(0).padStart(3)}k | ` +
                `Malatz: ${malatzInfo.padStart(12)} | ` +
                `${discountPct}% off | ` +
                `Fee: ${Math.round(fees.total).toString().padStart(5)} ₪`
            );
            
            // Show breakdown for interesting years
            if (exitYear >= 8 && exitYear <= 13) {
                console.log(`        Breakdown: Prime=${fees.byTrack.prime?.discounting?.toFixed(0) || 0}, Kalatz=${fees.byTrack.kalatz?.discounting?.toFixed(0) || 0}, Malatz=${fees.byTrack.malatz?.discounting?.toFixed(0) || 0}`);
            }
        }
    });
});
