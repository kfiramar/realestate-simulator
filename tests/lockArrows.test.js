const { bootstrapApp } = require('./helpers');

describe('Sweet spot arrows respect locks', () => {
    beforeEach(() => {
        jest.resetModules();
        bootstrapApp();
    });

    test('locking down payment keeps arrow fixed while term moves', () => {
        document.getElementById('rDown').value = 40;
        document.getElementById('lockDownBtn').click(); // lock down

        const calls = [];
        global.__calcCagrOverride = (_eq, downPct, mortDur) => {
            calls.push({ downPct, mortDur });
            // peak at 15-year term regardless of down
            return -Math.pow(mortDur - 15, 2);
        };

        global.updateSweetSpots();

        // Arrow position for down should stay at locked value
        const parseLeft = el => {
            const raw = el.style.left || '';
            const match = raw.match(/([0-9.]+)%/);
            return match ? parseFloat(match[1]) : NaN;
        };
        const downPos = parseLeft(document.getElementById('spotDown'));
        const expectedDown = ((40 - 25) / 75) * 100;
        expect(Math.abs(downPos - expectedDown)).toBeLessThan(1);

        // Term arrow should move toward 15 years (within slider range)
        const termPos = parseLeft(document.getElementById('spotDur'));
        const expectedTerm = ((15 - 10) / 20) * 100;
        expect(Math.abs(termPos - expectedTerm)).toBeLessThan(5);

        // ensure override was called with locked downPct
        calls.forEach(c => expect(c.downPct).toBeCloseTo(0.40, 5));
    });
});
