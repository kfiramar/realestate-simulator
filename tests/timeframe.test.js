const { bootstrapApp } = require('./helpers');

describe('Simulation timeframe sync', () => {
    beforeEach(() => {
        jest.resetModules();
        bootstrapApp();
    });

    function stubSearchSweetSpots() {
        const spy = jest.fn(({ simDur }) => ({
            d: 30, t: simDur, h: simDur, c: 1
        }));
        window.Logic.searchSweetSpots = spy;
        // AppLogic is captured at load time; update it too.
        window.AppLogic = window.Logic;
        return spy;
    }

    test('basic term slider drives simulation horizon in auto mode', () => {
        const spy = stubSearchSweetSpots();
        spy.mockClear();

        const term = document.getElementById('rDur');
        const hor = document.getElementById('rHor');

        term.value = 15;
        term.dispatchEvent(new Event('input'));

        expect(hor.value).toBe('15');
        expect(document.getElementById('dHor').innerText).toContain('15');
        const lastCall = spy.mock.calls.pop();
        expect(lastCall[0].simDur).toBe(15);
    });

    test('advanced track terms extend horizon to longest track', () => {
        const spy = stubSearchSweetSpots();
        spy.mockClear();

        document.getElementById('btnAdvancedTerm').click(); // enable advanced mode
        const termPrime = document.getElementById('termPrime');
        const hor = document.getElementById('rHor');
        const mainTerm = document.getElementById('rDur');

        termPrime.value = 30;
        termPrime.dispatchEvent(new Event('input'));

        expect(hor.value).toBe('30');
        expect(mainTerm.value).toBe('30'); // main term mirrors longest track in advanced
        const lastCall = spy.mock.calls.pop();
        expect(lastCall[0].simDur).toBe(30);
    });

    test('zero-percent track does not force horizon when set to long term', () => {
        const spy = stubSearchSweetSpots();
        spy.mockClear();

        document.getElementById('btnAdvancedTerm').click(); // advanced mode

        // Set Prime to 0% with a long term
        document.getElementById('pctPrime').value = 0;
        document.getElementById('termPrime').value = 30;

        // Keep Kalats/Katz at 25y and active
        document.getElementById('pctKalats').value = 50;
        document.getElementById('termKalats').value = 25;
        document.getElementById('pctKatz').value = 50;
        document.getElementById('termKatz').value = 25;

        checkMix(); // updates disabled state and runs sim

        const hor = document.getElementById('rHor');
        expect(hor.value).toBe('25');
        const lastCall = spy.mock.calls.pop();
        expect(lastCall[0].simDur).toBe(25);
    });
});
