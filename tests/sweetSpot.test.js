const { bootstrapApp } = require('./helpers');

describe('Sweet spot positioning', () => {
    beforeEach(() => {
        jest.resetModules();
        bootstrapApp();
    });

    test('down payment and duration arrows align with mocked optimum', () => {
        // Mock calcCAGR to peak at 50% down and 18-year term
        global.__calcCagrOverride = jest.fn((_, downPct, mortDur) => {
            const downDiff = Math.abs(downPct - 0.5) * 100;
            const durDiff = Math.abs(mortDur - 18);
            return -Math.pow(downDiff, 2) - Math.pow(durDiff, 2);
        });

        global.updateSweetSpots();

        const parseLeft = el => {
            const raw = el.style.left || '';
            const match = raw.match(/([0-9.]+)%/);
            return match ? parseFloat(match[1]) : NaN;
        };
        const downPos = parseLeft(document.getElementById('spotDown'));
        const durPos = parseLeft(document.getElementById('spotDur'));

        const expectedDown = ((50 - 25) / 75) * 100;
        const expectedDur = ((18 - 10) / 20) * 100;

        expect(Math.abs(downPos - expectedDown)).toBeLessThan(1);
        expect(Math.abs(durPos - expectedDur)).toBeLessThan(1);
    });
});
