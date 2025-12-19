/**
 * @jest-environment jsdom
 */
const Logic = require('../src/logic.js');

describe('Early Repayment Fee Calculation', () => {
    
    describe('calcEarlyRepaymentFee - Basic Fee Components', () => {
        
        test('Operational fee is always 60 NIS', () => {
            const fees = Logic.calcEarlyRepaymentFee({
                track: 'kalatz',
                balance: 500000,
                contractRate: 0.05,
                boiAvgRate: 0.05, // Same rate = no discounting
                remainingMonths: 240,
                cpiLinked: false,
                prepayDay: 20
            });
            expect(fees.operational).toBe(60);
        });

        test('Prime track: ONLY operational fee, never discounting', () => {
            // Even with huge rate difference, Prime has no discounting fee
            const fees = Logic.calcEarlyRepaymentFee({
                track: 'prime',
                balance: 1000000,
                contractRate: 0.08, // 8% contract
                boiAvgRate: 0.02,   // 2% BOI avg - huge difference
                remainingMonths: 300,
                cpiLinked: false,
                prepayDay: 20
            });
            
            expect(fees.operational).toBe(60);
            expect(fees.discounting).toBe(0);
            expect(fees.cpiAverage).toBe(0);
            expect(fees.total).toBe(60);
        });
    });

    describe('calcEarlyRepaymentFee - Discounting Fee (Fixed Rate Tracks)', () => {
        
        test('Kalatz: discounting fee when BOI avg < contract rate', () => {
            const fees = Logic.calcEarlyRepaymentFee({
                track: 'kalatz',
                balance: 500000,
                contractRate: 0.06,  // 6%
                boiAvgRate: 0.04,    // 4% - 2% difference
                remainingMonths: 240, // 20 years
                cpiLinked: false,
                prepayDay: 20
            });
            
            expect(fees.discounting).toBeGreaterThan(0);
            // With 2% rate diff over 20 years on 500k, expect significant fee
            expect(fees.discounting).toBeGreaterThan(50000);
            console.log('Kalatz 500k, 2% diff, 20yr:', Math.round(fees.discounting));
        });

        test('Kalatz: NO discounting fee when BOI avg >= contract rate', () => {
            const fees = Logic.calcEarlyRepaymentFee({
                track: 'kalatz',
                balance: 500000,
                contractRate: 0.04,
                boiAvgRate: 0.05, // BOI higher than contract
                remainingMonths: 240,
                cpiLinked: false,
                prepayDay: 20
            });
            
            expect(fees.discounting).toBe(0);
        });

        test('Kalatz: NO discounting fee when rates are equal', () => {
            const fees = Logic.calcEarlyRepaymentFee({
                track: 'kalatz',
                balance: 500000,
                contractRate: 0.05,
                boiAvgRate: 0.05,
                remainingMonths: 240,
                cpiLinked: false,
                prepayDay: 20
            });
            
            expect(fees.discounting).toBe(0);
        });

        test('Katz (CPI-linked fixed): discounting fee applies', () => {
            const fees = Logic.calcEarlyRepaymentFee({
                track: 'katz',
                balance: 500000,
                contractRate: 0.04,
                boiAvgRate: 0.02,
                remainingMonths: 240,
                cpiLinked: true,
                prepayDay: 20
            });
            
            expect(fees.discounting).toBeGreaterThan(0);
        });

        test('Discounting fee increases with rate difference', () => {
            const fees1pct = Logic.calcEarlyRepaymentFee({
                track: 'kalatz', balance: 500000, contractRate: 0.05,
                boiAvgRate: 0.04, remainingMonths: 240, cpiLinked: false, prepayDay: 20
            });
            
            const fees2pct = Logic.calcEarlyRepaymentFee({
                track: 'kalatz', balance: 500000, contractRate: 0.06,
                boiAvgRate: 0.04, remainingMonths: 240, cpiLinked: false, prepayDay: 20
            });
            
            expect(fees2pct.discounting).toBeGreaterThan(fees1pct.discounting);
        });

        test('Discounting fee increases with remaining term', () => {
            const fees10yr = Logic.calcEarlyRepaymentFee({
                track: 'kalatz', balance: 500000, contractRate: 0.06,
                boiAvgRate: 0.04, remainingMonths: 120, cpiLinked: false, prepayDay: 20
            });
            
            const fees20yr = Logic.calcEarlyRepaymentFee({
                track: 'kalatz', balance: 500000, contractRate: 0.06,
                boiAvgRate: 0.04, remainingMonths: 240, cpiLinked: false, prepayDay: 20
            });
            
            expect(fees20yr.discounting).toBeGreaterThan(fees10yr.discounting);
        });

        test('Discounting fee increases with balance', () => {
            const fees250k = Logic.calcEarlyRepaymentFee({
                track: 'kalatz', balance: 250000, contractRate: 0.06,
                boiAvgRate: 0.04, remainingMonths: 240, cpiLinked: false, prepayDay: 20
            });
            
            const fees500k = Logic.calcEarlyRepaymentFee({
                track: 'kalatz', balance: 500000, contractRate: 0.06,
                boiAvgRate: 0.04, remainingMonths: 240, cpiLinked: false, prepayDay: 20
            });
            
            // Should be roughly proportional
            expect(fees500k.discounting).toBeCloseTo(fees250k.discounting * 2, -3);
        });
    });

    describe('calcEarlyRepaymentFee - Variable Rate Tracks (Malatz/Matz)', () => {
        
        test('Malatz: discounting only until next reset, not full term', () => {
            const feesFixed = Logic.calcEarlyRepaymentFee({
                track: 'kalatz', // Fixed for comparison
                balance: 500000, contractRate: 0.06, boiAvgRate: 0.04,
                remainingMonths: 240, cpiLinked: false, prepayDay: 20
            });

            const feesVariable = Logic.calcEarlyRepaymentFee({
                track: 'malatz',
                balance: 500000, contractRate: 0.06, boiAvgRate: 0.04,
                remainingMonths: 240,
                monthsToReset: 36, // Only 3 years to next reset
                cpiLinked: false, prepayDay: 20
            });
            
            // Variable should be MUCH lower (3yr vs 20yr)
            expect(feesVariable.discounting).toBeLessThan(feesFixed.discounting * 0.5);
            console.log('Fixed 20yr:', Math.round(feesFixed.discounting));
            console.log('Variable 3yr to reset:', Math.round(feesVariable.discounting));
        });

        test('Malatz: only operational fee when prepaying ON reset date', () => {
            const fees = Logic.calcEarlyRepaymentFee({
                track: 'malatz',
                balance: 500000, contractRate: 0.06, boiAvgRate: 0.04,
                remainingMonths: 240,
                monthsToReset: 0, // Exactly on reset date
                cpiLinked: false, prepayDay: 20
            });
            
            expect(fees.discounting).toBe(0);
            expect(fees.total).toBe(60);
        });

        test('Matz (CPI-linked variable): discounting until reset + CPI fee possible', () => {
            const fees = Logic.calcEarlyRepaymentFee({
                track: 'matz',
                balance: 500000, contractRate: 0.04, boiAvgRate: 0.02,
                remainingMonths: 240,
                monthsToReset: 48,
                cpiLinked: true,
                prepayDay: 10, // Day 1-15 triggers CPI fee
                avgCpiChange12m: 0.003
            });
            
            expect(fees.discounting).toBeGreaterThan(0);
            expect(fees.cpiAverage).toBeGreaterThan(0);
        });
    });

    describe('calcEarlyRepaymentFee - CPI Average Fee', () => {
        
        test('CPI fee applies on days 1-15 for CPI-linked tracks', () => {
            const feesDay5 = Logic.calcEarlyRepaymentFee({
                track: 'katz', balance: 500000, contractRate: 0.04, boiAvgRate: 0.04,
                remainingMonths: 240, cpiLinked: true,
                prepayDay: 5, avgCpiChange12m: 0.003
            });
            
            expect(feesDay5.cpiAverage).toBeGreaterThan(0);
            // Formula: balance * 0.5 * avgCpiChange = 500000 * 0.5 * 0.003 = 750
            expect(feesDay5.cpiAverage).toBeCloseTo(750, 0);
        });

        test('CPI fee does NOT apply on days 16-31', () => {
            const feesDay20 = Logic.calcEarlyRepaymentFee({
                track: 'katz', balance: 500000, contractRate: 0.04, boiAvgRate: 0.04,
                remainingMonths: 240, cpiLinked: true,
                prepayDay: 20, avgCpiChange12m: 0.003
            });
            
            expect(feesDay20.cpiAverage).toBe(0);
        });

        test('CPI fee does NOT apply to non-CPI tracks', () => {
            const fees = Logic.calcEarlyRepaymentFee({
                track: 'kalatz', balance: 500000, contractRate: 0.04, boiAvgRate: 0.04,
                remainingMonths: 240, cpiLinked: false,
                prepayDay: 5, avgCpiChange12m: 0.003
            });
            
            expect(fees.cpiAverage).toBe(0);
        });

        test('CPI fee scales with balance', () => {
            const fees1M = Logic.calcEarlyRepaymentFee({
                track: 'katz', balance: 1000000, contractRate: 0.04, boiAvgRate: 0.04,
                remainingMonths: 240, cpiLinked: true,
                prepayDay: 10, avgCpiChange12m: 0.004
            });
            
            // 1M * 0.5 * 0.004 = 2000
            expect(fees1M.cpiAverage).toBeCloseTo(2000, 0);
        });
    });

    describe('calcEarlyRepaymentFee - Partial Prepayment', () => {
        
        test('Partial prepayment: discounting fee is pro-rata', () => {
            const feesFull = Logic.calcEarlyRepaymentFee({
                track: 'kalatz', balance: 500000, contractRate: 0.06, boiAvgRate: 0.04,
                remainingMonths: 240, cpiLinked: false, prepayDay: 20,
                isPartial: false
            });

            const feesPartial = Logic.calcEarlyRepaymentFee({
                track: 'kalatz', balance: 500000, contractRate: 0.06, boiAvgRate: 0.04,
                remainingMonths: 240, cpiLinked: false, prepayDay: 20,
                isPartial: true, partialAmount: 100000 // 20%
            });
            
            expect(feesPartial.discounting).toBeCloseTo(feesFull.discounting * 0.2, -2);
        });

        test('Partial prepayment: CPI fee is on partial amount only', () => {
            const fees = Logic.calcEarlyRepaymentFee({
                track: 'katz', balance: 500000, contractRate: 0.04, boiAvgRate: 0.04,
                remainingMonths: 240, cpiLinked: true,
                prepayDay: 10, avgCpiChange12m: 0.003,
                isPartial: true, partialAmount: 200000
            });
            
            // 200000 * 0.5 * 0.003 = 300
            expect(fees.cpiAverage).toBeCloseTo(300, 0);
        });
    });

    describe('calcEarlyRepaymentFee - Edge Cases', () => {
        
        test('Zero balance returns only operational fee', () => {
            const fees = Logic.calcEarlyRepaymentFee({
                track: 'kalatz', balance: 0, contractRate: 0.06, boiAvgRate: 0.04,
                remainingMonths: 240, cpiLinked: false, prepayDay: 20
            });
            
            // Function should handle gracefully - no fees if no balance
            expect(fees.discounting).toBe(0);
        });

        test('Zero remaining months returns only operational fee', () => {
            const fees = Logic.calcEarlyRepaymentFee({
                track: 'kalatz', balance: 500000, contractRate: 0.06, boiAvgRate: 0.04,
                remainingMonths: 0, cpiLinked: false, prepayDay: 20
            });
            
            expect(fees.discounting).toBe(0);
        });

        test('Very small rate difference still calculates fee', () => {
            const fees = Logic.calcEarlyRepaymentFee({
                track: 'kalatz', balance: 500000,
                contractRate: 0.0501, boiAvgRate: 0.05, // 0.01% difference
                remainingMonths: 240, cpiLinked: false, prepayDay: 20
            });
            
            expect(fees.discounting).toBeGreaterThan(0);
        });
    });

    describe('calcTotalEarlyRepaymentFees - Multi-Track Calculation', () => {
        
        test('Sums fees from all active tracks', () => {
            const totalFees = Logic.calcTotalEarlyRepaymentFees({
                balances: { prime: 100000, kalatz: 200000, malatz: 0, katz: 150000, matz: 0 },
                rates: { prime: 0.06, kalatz: 0.055, malatz: 0.05, katz: 0.04, matz: 0.035 },
                boiAvgRate: 0.03,
                remainingMonths: { prime: 180, kalatz: 180, malatz: 180, katz: 180, matz: 180 },
                monthsToReset: { malatz: 36, matz: 36 },
                cpiIndex: 1.0,
                prepayDay: 20,
                avgCpiChange12m: 0.003
            });
            
            // Should have 3 tracks with balance
            expect(Object.keys(totalFees.byTrack).length).toBe(3);
            expect(totalFees.byTrack.prime).toBeDefined();
            expect(totalFees.byTrack.kalatz).toBeDefined();
            expect(totalFees.byTrack.katz).toBeDefined();
            expect(totalFees.byTrack.malatz).toBeUndefined();
            expect(totalFees.byTrack.matz).toBeUndefined();
            
            // Operational: 3 tracks * 60 = 180
            expect(totalFees.operational).toBe(180);
            
            // Prime has no discounting, but kalatz and katz should
            expect(totalFees.byTrack.prime.discounting).toBe(0);
            expect(totalFees.byTrack.kalatz.discounting).toBeGreaterThan(0);
            expect(totalFees.byTrack.katz.discounting).toBeGreaterThan(0);
        });

        test('CPI tracks use nominal balance (real * cpiIndex)', () => {
            const cpiIndex = 1.25; // 25% inflation
            
            const fees = Logic.calcTotalEarlyRepaymentFees({
                balances: { prime: 0, kalatz: 0, malatz: 0, katz: 100000, matz: 0 },
                rates: { prime: 0, kalatz: 0, malatz: 0, katz: 0.05, matz: 0 },
                boiAvgRate: 0.03,
                remainingMonths: { prime: 0, kalatz: 0, malatz: 0, katz: 120, matz: 0 },
                cpiIndex,
                prepayDay: 10,
                avgCpiChange12m: 0.004
            });
            
            // CPI fee on nominal: 100000 * 1.25 * 0.5 * 0.004 = 250
            expect(fees.byTrack.katz.cpiAverage).toBeCloseTo(250, 0);
        });

        test('Handles all tracks with balance', () => {
            const totalFees = Logic.calcTotalEarlyRepaymentFees({
                balances: { prime: 50000, kalatz: 50000, malatz: 50000, katz: 50000, matz: 50000 },
                rates: { prime: 0.06, kalatz: 0.055, malatz: 0.05, katz: 0.04, matz: 0.035 },
                boiAvgRate: 0.03,
                remainingMonths: { prime: 120, kalatz: 120, malatz: 120, katz: 120, matz: 120 },
                monthsToReset: { malatz: 24, matz: 24 },
                cpiIndex: 1.1,
                prepayDay: 20,
                avgCpiChange12m: 0.003
            });
            
            expect(Object.keys(totalFees.byTrack).length).toBe(5);
            expect(totalFees.operational).toBe(300); // 5 * 60
        });

        test('Empty balances returns zero fees', () => {
            const totalFees = Logic.calcTotalEarlyRepaymentFees({
                balances: { prime: 0, kalatz: 0, malatz: 0, katz: 0, matz: 0 },
                rates: { prime: 0.06, kalatz: 0.055, malatz: 0.05, katz: 0.04, matz: 0.035 },
                boiAvgRate: 0.03,
                remainingMonths: { prime: 120, kalatz: 120, malatz: 120, katz: 120, matz: 120 },
                monthsToReset: { malatz: 24, matz: 24 },
                cpiIndex: 1.0,
                prepayDay: 20,
                avgCpiChange12m: 0.003
            });
            
            expect(totalFees.total).toBe(0);
            expect(Object.keys(totalFees.byTrack).length).toBe(0);
        });
    });

    describe('calcEarlyRepaymentFee - Section 8 Statutory Discounts', () => {
        
        test('Loan < 3 years old: no discount', () => {
            const fees = Logic.calcEarlyRepaymentFee({
                track: 'kalatz', balance: 500000, contractRate: 0.06, boiAvgRate: 0.04,
                remainingMonths: 264, // 22 years remaining of 24 year loan = 2 years old
                originalTermMonths: 288,
                cpiLinked: false, prepayDay: 20
            });
            
            expect(fees.statutoryDiscount).toBe(0);
        });

        test('Loan 3-5 years old: 20% discount', () => {
            const fees = Logic.calcEarlyRepaymentFee({
                track: 'kalatz', balance: 500000, contractRate: 0.06, boiAvgRate: 0.04,
                remainingMonths: 204, // 17 years remaining of 21 year loan = 4 years old
                originalTermMonths: 252,
                cpiLinked: false, prepayDay: 20
            });
            
            // statutoryDiscount should be 20% of raw fee
            // discounting = raw * 0.80, statutoryDiscount = raw * 0.20
            const rawFee = fees.discounting + fees.statutoryDiscount;
            expect(fees.statutoryDiscount).toBeCloseTo(rawFee * 0.20, -2);
            expect(fees.discounting).toBeCloseTo(rawFee * 0.80, -2);
            console.log('4yr old loan: raw fee', Math.round(rawFee), '→ after 20% discount:', Math.round(fees.discounting));
        });

        test('Loan 5+ years old: 30% discount', () => {
            const fees = Logic.calcEarlyRepaymentFee({
                track: 'kalatz', balance: 500000, contractRate: 0.06, boiAvgRate: 0.04,
                remainingMonths: 180, // 15 years remaining of 25 year loan = 10 years old
                originalTermMonths: 300,
                cpiLinked: false, prepayDay: 20
            });
            
            // statutoryDiscount should be 30% of raw fee
            const rawFee = fees.discounting + fees.statutoryDiscount;
            expect(fees.statutoryDiscount).toBeCloseTo(rawFee * 0.30, -2);
            expect(fees.discounting).toBeCloseTo(rawFee * 0.70, -2);
            console.log('10yr old loan: raw fee', Math.round(rawFee), '→ after 30% discount:', Math.round(fees.discounting));
        });

        test('Discount applies to discounting fee only, not operational/CPI', () => {
            const fees = Logic.calcEarlyRepaymentFee({
                track: 'katz', balance: 500000, contractRate: 0.06, boiAvgRate: 0.04,
                remainingMonths: 180, originalTermMonths: 300, // 10 years old
                cpiLinked: true, prepayDay: 10, avgCpiChange12m: 0.003
            });
            
            // Operational should still be 60
            expect(fees.operational).toBe(60);
            // CPI fee should be unaffected
            expect(fees.cpiAverage).toBeCloseTo(500000 * 0.5 * 0.003, 0);
            // But discounting should have 30% discount applied
            expect(fees.statutoryDiscount).toBeGreaterThan(0);
        });
    });

    describe('calcTotalEarlyRepaymentFees - Realistic Scenarios', () => {
        
        test('Scenario: 100% Kalatz, exit after 10 years of 25 year loan', () => {
            // Loan: 1M, 25 years, 5.5% rate
            // Exit: after 10 years, ~700k remaining
            // BOI avg: 4%
            const totalFees = Logic.calcTotalEarlyRepaymentFees({
                balances: { prime: 0, kalatz: 700000, malatz: 0, katz: 0, matz: 0 },
                rates: { prime: 0, kalatz: 0.055, malatz: 0, katz: 0, matz: 0 },
                boiAvgRate: 0.04,
                remainingMonths: { prime: 0, kalatz: 180, malatz: 0, katz: 0, matz: 0 }, // 15 years left
                monthsToReset: {},
                cpiIndex: 1.0,
                prepayDay: 20,
                avgCpiChange12m: 0
            });
            
            console.log('Scenario 100% Kalatz, 15yr remaining, 1.5% diff:');
            console.log('  Discounting fee:', Math.round(totalFees.discounting));
            console.log('  Total fee:', Math.round(totalFees.total));
            
            expect(totalFees.discounting).toBeGreaterThan(50000);
            expect(totalFees.operational).toBe(60);
        });

        test('Scenario: 100% Prime, any exit = minimal fee', () => {
            const totalFees = Logic.calcTotalEarlyRepaymentFees({
                balances: { prime: 700000, kalatz: 0, malatz: 0, katz: 0, matz: 0 },
                rates: { prime: 0.06, kalatz: 0, malatz: 0, katz: 0, matz: 0 },
                boiAvgRate: 0.03,
                remainingMonths: { prime: 180, kalatz: 0, malatz: 0, katz: 0, matz: 0 },
                monthsToReset: {},
                cpiIndex: 1.0,
                prepayDay: 20,
                avgCpiChange12m: 0
            });
            
            expect(totalFees.discounting).toBe(0);
            expect(totalFees.total).toBe(60);
        });

        test('Scenario: Mixed 33% Kalatz + 67% Prime', () => {
            const totalFees = Logic.calcTotalEarlyRepaymentFees({
                balances: { prime: 470000, kalatz: 230000, malatz: 0, katz: 0, matz: 0 },
                rates: { prime: 0.06, kalatz: 0.055, malatz: 0, katz: 0, matz: 0 },
                boiAvgRate: 0.04,
                remainingMonths: { prime: 180, kalatz: 180, malatz: 0, katz: 0, matz: 0 },
                monthsToReset: {},
                cpiIndex: 1.0,
                prepayDay: 20,
                avgCpiChange12m: 0
            });
            
            console.log('Scenario 33% Kalatz + 67% Prime:');
            console.log('  Prime fee:', totalFees.byTrack.prime.total);
            console.log('  Kalatz fee:', Math.round(totalFees.byTrack.kalatz.total));
            console.log('  Total:', Math.round(totalFees.total));
            
            // Only Kalatz contributes discounting fee
            expect(totalFees.byTrack.prime.discounting).toBe(0);
            expect(totalFees.byTrack.kalatz.discounting).toBeGreaterThan(0);
        });

        test('Scenario: CPI-linked Katz with high inflation, day 10 exit', () => {
            const totalFees = Logic.calcTotalEarlyRepaymentFees({
                balances: { prime: 0, kalatz: 0, malatz: 0, katz: 500000, matz: 0 },
                rates: { prime: 0, kalatz: 0, malatz: 0, katz: 0.035, matz: 0 },
                boiAvgRate: 0.025,
                remainingMonths: { prime: 0, kalatz: 0, malatz: 0, katz: 180, matz: 0 },
                monthsToReset: {},
                cpiIndex: 1.3, // 30% inflation since start
                prepayDay: 10, // Triggers CPI fee
                avgCpiChange12m: 0.005 // 0.5% monthly avg
            });
            
            // Nominal balance: 500k * 1.3 = 650k
            // CPI fee: 650k * 0.5 * 0.005 = 1625
            expect(totalFees.byTrack.katz.cpiAverage).toBeCloseTo(1625, -1);
            expect(totalFees.byTrack.katz.discounting).toBeGreaterThan(0);
            
            console.log('Scenario Katz with CPI fee:');
            console.log('  Discounting:', Math.round(totalFees.byTrack.katz.discounting));
            console.log('  CPI fee:', Math.round(totalFees.byTrack.katz.cpiAverage));
        });

        test('Scenario: Malatz exit 1 year before reset = small fee', () => {
            const totalFees = Logic.calcTotalEarlyRepaymentFees({
                balances: { prime: 0, kalatz: 0, malatz: 500000, katz: 0, matz: 0 },
                rates: { prime: 0, kalatz: 0, malatz: 0.05, katz: 0, matz: 0 },
                boiAvgRate: 0.03,
                remainingMonths: { prime: 0, kalatz: 0, malatz: 180, katz: 0, matz: 0 },
                monthsToReset: { malatz: 12 }, // Only 1 year to reset
                cpiIndex: 1.0,
                prepayDay: 20,
                avgCpiChange12m: 0
            });
            
            console.log('Scenario Malatz 1yr to reset:', Math.round(totalFees.discounting));
            
            // Should be relatively small (only 1 year of discounting)
            expect(totalFees.discounting).toBeLessThan(20000);
        });
    });
});
