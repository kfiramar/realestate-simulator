const { bootstrapApp } = require('./helpers');

describe('Slider bounds and labels', () => {
    beforeEach(() => {
        jest.resetModules();
        bootstrapApp();
    });

    test('down payment slider enforces min 25%', () => {
        const down = document.getElementById('rDown');
        down.value = 10;
        down.dispatchEvent(new Event('input'));
        expect(parseInt(down.value, 10)).toBeGreaterThanOrEqual(25);
    });

    test('term slider steps by 1 year', () => {
        const term = document.getElementById('rDur');
        term.value = 13;
        term.dispatchEvent(new Event('input'));
        expect(term.step).toBe('1');
    });

    test('mgmt fee default reflects 0.15%', () => {
        const mer = document.getElementById('rMer');
        expect(parseFloat(mer.value)).toBeCloseTo(0.15, 2);
        const vMer = document.getElementById('vMer');
        // runSim already executed at bootstrap
        expect(vMer.innerText).toContain('0.15');
    });
});
