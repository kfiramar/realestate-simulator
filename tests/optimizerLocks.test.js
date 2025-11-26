const { bootstrapApp } = require('./helpers');

describe('Optimizer lock behavior', () => {
    beforeEach(() => {
        jest.resetModules();
        bootstrapApp();
    });

    function lock(labelId) {
        document.getElementById(labelId).click();
    }

    test('locking down payment freezes down search', () => {
        // set custom values
        document.getElementById('rDown').value = 40;
        lock('lockDownBtn'); // lock down

        // mock calcCAGR to track inputs
        const calls = [];
        global.__calcCagrOverride = (...args) => {
            const down = args[1];
            const term = args[2];
            calls.push({ down, term });
            return -Math.abs(down - 0.4); // best at 40% to ensure lock is honored
        };

        global.updateSweetSpots();

        // all calls should use locked down=0.4
        expect(calls.length).toBeGreaterThan(0);
        calls.forEach(c => expect(c.down).toBeCloseTo(0.4, 5));
    });

    test('unlocking horizon switches to custom slider', () => {
        // horizon starts locked (auto)
        expect(document.getElementById('bHor').classList.contains('show')).toBe(false);
        document.getElementById('lockHorBtn').click(); // unlock -> should flip to custom
        expect(document.getElementById('bHor').classList.contains('show')).toBe(true);
    });
});
