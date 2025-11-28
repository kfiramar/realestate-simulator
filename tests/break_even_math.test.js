/**
 * @jest-environment jsdom
 */

const Logic = require('../src/logic.js');

describe('Break-Even Equity Formula Verification', () => {

    // The User's Formula for Required Equity % to Break Even
    // Equity% = 1 - [ (Yield / 12) * ( ((1 + i)^n - 1) / (i * (1 + i)^n) ) ]
    function calculateRequiredEquity(yieldAnnual, interestAnnual, years) {
        const Y_mo = yieldAnnual / 12;
        const i_mo = interestAnnual / 12;
        const n = years * 12;
        
        // PV Factor part of the user's formula: ( (1+i)^n - 1 ) / ( i * (1+i)^n )
        // This is essentially 1 / SpitzerFactor
        const numerator = Math.pow(1 + i_mo, n) - 1;
        const denominator = i_mo * Math.pow(1 + i_mo, n);
        const pvFactor = numerator / denominator;
        
        const ltv = Y_mo * pvFactor;
        return 1 - ltv;
    }

    test('Logic.calcPmt aligns with Break-Even Formula', () => {
        // Scenario: 5.5% Interest, 3% Yield, 30 Years
        const interest = 0.055;
        const yieldRate = 0.03;
        const years = 30;
        const price = 1000000;

        // 1. Calculate Required Equity % using the User's Formula
        const reqEquityPct = calculateRequiredEquity(yieldRate, interest, years);
        
        // 2. Derive Loan Amount and Equity Amount
        const equity = price * reqEquityPct;
        const loan = price - equity;
        
        // 3. Calculate Monthly Rent (Income)
        const monthlyRent = (price * yieldRate) / 12;
        
        // 4. Calculate Monthly Mortgage Payment (Expense) using our App's Logic
        const monthlyPmt = Logic.calcPmt(loan, interest, years * 12);
        
        console.log(`Scenario: Int ${interest*100}%, Yld ${yieldRate*100}%`);
        console.log(`Formula Req Equity: ${(reqEquityPct*100).toFixed(2)}%`);
        console.log(`Derived Loan: ${loan.toFixed(2)}`);
        console.log(`Monthly Rent: ${monthlyRent.toFixed(2)}`);
        console.log(`Logic.calcPmt: ${monthlyPmt.toFixed(2)}`);

        // 5. ASSERT: Rent should exactly cover the Mortgage Payment
        // This proves that our calcPmt is mathematically consistent with the break-even formula
        expect(monthlyPmt).toBeCloseTo(monthlyRent, 2); // Accurate to 2 decimal places
    });

    test('Sensitivity Check: Higher Interest requires Higher Equity', () => {
        // 4% Interest
        const eqLowInt = calculateRequiredEquity(0.03, 0.04, 30);
        // 6% Interest
        const eqHighInt = calculateRequiredEquity(0.03, 0.06, 30);
        
        console.log(`Equity needed at 4%: ${(eqLowInt*100).toFixed(1)}%`);
        console.log(`Equity needed at 6%: ${(eqHighInt*100).toFixed(1)}%`);
        
        expect(eqHighInt).toBeGreaterThan(eqLowInt);
    });
});
