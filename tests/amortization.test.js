const Logic = require('../src/logic.js');

describe('Amortization Schedule', () => {
    // Test case from the spec: P=900,000, 4.7% annual, 300 months
    const P = 900000;
    const rate = 0.047;
    const n = 300;

    describe('Spitzer (Annuity)', () => {
        test('calcPmt matches expected payment', () => {
            const pmt = Logic.calcPmt(P, rate, n);
            expect(pmt).toBeCloseTo(5105.21, 0);
        });

        test('generateSchedule first 3 months match spec', () => {
            const result = Logic.generateSchedule({
                principal: P,
                annualRate: rate,
                termMonths: n,
                method: 'spitzer'
            });

            // Month 1: I=3525.00, K=1580.21, B=898419.79
            expect(result.schedule[0].interest).toBeCloseTo(3525, 0);
            expect(result.schedule[0].principal).toBeCloseTo(1580.21, 0);
            expect(result.schedule[0].balance).toBeCloseTo(898419.79, 0);

            // Month 2: I=3518.81, K=1586.40, B=896833.40
            expect(result.schedule[1].interest).toBeCloseTo(3518.81, 0);
            expect(result.schedule[1].balance).toBeCloseTo(896833.40, 0);

            // Month 3
            expect(result.schedule[2].balance).toBeCloseTo(895240.79, 0);
        });

        test('total interest matches spec', () => {
            const totalInt = Logic.calcTotalInterest(P, rate, n, 'spitzer');
            expect(totalInt).toBeCloseTo(631562.24, 0);
        });

        test('calcBalanceAfterK closed-form matches iterative', () => {
            const result = Logic.generateSchedule({
                principal: P,
                annualRate: rate,
                termMonths: n,
                method: 'spitzer'
            });

            // Check balance after 120 payments (10 years)
            const closedForm = Logic.calcBalanceAfterK(P, rate, n, 120, 'spitzer');
            expect(closedForm).toBeCloseTo(result.schedule[119].balance, 0);

            // Check balance after 180 payments (15 years)
            const closedForm180 = Logic.calcBalanceAfterK(P, rate, n, 180, 'spitzer');
            expect(closedForm180).toBeCloseTo(result.schedule[179].balance, 0);
        });

        test('schedule ends with zero balance', () => {
            const result = Logic.generateSchedule({
                principal: P,
                annualRate: rate,
                termMonths: n,
                method: 'spitzer'
            });
            expect(result.schedule[n - 1].balance).toBeLessThan(1);
        });
    });

    describe('Equal Principal (קרן שווה)', () => {
        test('constant principal each month', () => {
            const result = Logic.generateSchedule({
                principal: P,
                annualRate: rate,
                termMonths: n,
                method: 'equalPrincipal'
            });

            const expectedPrincipal = P / n; // 3000
            expect(result.schedule[0].principal).toBeCloseTo(expectedPrincipal, 0);
            expect(result.schedule[100].principal).toBeCloseTo(expectedPrincipal, 0);
            expect(result.schedule[200].principal).toBeCloseTo(expectedPrincipal, 0);
        });

        test('first 3 months match spec', () => {
            const result = Logic.generateSchedule({
                principal: P,
                annualRate: rate,
                termMonths: n,
                method: 'equalPrincipal'
            });

            // Month 1: I=3525.00, A=6525.00, B=897000
            expect(result.schedule[0].interest).toBeCloseTo(3525, 0);
            expect(result.schedule[0].payment).toBeCloseTo(6525, 0);
            expect(result.schedule[0].balance).toBeCloseTo(897000, 0);

            // Month 2: I=3513.25, A=6513.25, B=894000
            expect(result.schedule[1].interest).toBeCloseTo(3513.25, 0);
            expect(result.schedule[1].balance).toBeCloseTo(894000, 0);

            // Month 3: B=891000
            expect(result.schedule[2].balance).toBeCloseTo(891000, 0);
        });

        test('total interest matches spec', () => {
            const totalInt = Logic.calcTotalInterest(P, rate, n, 'equalPrincipal');
            expect(totalInt).toBeCloseTo(530512.50, 0);
        });

        test('calcBalanceAfterK closed-form', () => {
            // B_k = P * (1 - k/n)
            const b120 = Logic.calcBalanceAfterK(P, rate, n, 120, 'equalPrincipal');
            expect(b120).toBeCloseTo(P * (1 - 120 / n), 0);

            const b180 = Logic.calcBalanceAfterK(P, rate, n, 180, 'equalPrincipal');
            expect(b180).toBeCloseTo(P * (1 - 180 / n), 0);
        });

        test('payments decline over time', () => {
            const result = Logic.generateSchedule({
                principal: P,
                annualRate: rate,
                termMonths: n,
                method: 'equalPrincipal'
            });

            expect(result.schedule[0].payment).toBeGreaterThan(result.schedule[100].payment);
            expect(result.schedule[100].payment).toBeGreaterThan(result.schedule[200].payment);
        });
    });

    describe('Rate Resets', () => {
        test('payment recalculates after rate reset', () => {
            const result = Logic.generateSchedule({
                principal: P,
                annualRate: 0.05,
                termMonths: 120,
                method: 'spitzer',
                rateResets: [{ month: 61, newRate: 0.04 }]
            });

            // Payment should change at month 61
            const pmtBefore = result.schedule[59].payment;
            const pmtAfter = result.schedule[60].payment;
            expect(pmtBefore).not.toBeCloseTo(pmtAfter, 0);

            // New payment should be lower (rate dropped)
            expect(pmtAfter).toBeLessThan(pmtBefore);
        });
    });

    describe('CPI-Linked', () => {
        test('balance grows with CPI', () => {
            const resultUnlinked = Logic.generateSchedule({
                principal: P,
                annualRate: 0.03,
                termMonths: 120,
                method: 'spitzer',
                cpiLinked: false
            });

            const resultLinked = Logic.generateSchedule({
                principal: P,
                annualRate: 0.03,
                termMonths: 120,
                method: 'spitzer',
                cpiLinked: true,
                cpiRate: 0.025
            });

            // With positive CPI, total payments should be higher
            expect(resultLinked.totalPayments).toBeGreaterThan(resultUnlinked.totalPayments);
        });

        test('CPI array applies different rates per year', () => {
            const result = Logic.generateSchedule({
                principal: 100000,
                annualRate: 0.03,
                termMonths: 36,
                method: 'spitzer',
                cpiLinked: true,
                cpiRate: [0.02, 0.03, 0.04] // Year 1: 2%, Year 2: 3%, Year 3: 4%
            });

            expect(result.schedule.length).toBe(36);
            expect(result.totalPayments).toBeGreaterThan(100000);
        });
    });

    describe('Edge Cases', () => {
        test('zero interest rate', () => {
            const result = Logic.generateSchedule({
                principal: 12000,
                annualRate: 0,
                termMonths: 12,
                method: 'spitzer'
            });

            expect(result.schedule[0].payment).toBe(1000);
            expect(result.totalInterest).toBe(0);
        });

        test('calcBalanceAfterK at boundaries', () => {
            expect(Logic.calcBalanceAfterK(P, rate, n, 0, 'spitzer')).toBe(P);
            expect(Logic.calcBalanceAfterK(P, rate, n, n, 'spitzer')).toBe(0);
            expect(Logic.calcBalanceAfterK(P, rate, n, n + 10, 'spitzer')).toBe(0);
        });
    });
});
