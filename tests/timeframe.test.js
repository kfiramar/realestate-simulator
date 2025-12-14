const { bootstrapApp } = require('./helpers');

describe('Simulation timeframe sync', () => {
    beforeEach(() => {
        jest.resetModules();
        bootstrapApp();
    });

    test('basic term slider drives simulation horizon in auto mode', () => {
        const term = document.getElementById('rDur');
        const hor = document.getElementById('rHor');

        term.value = 15;
        term.dispatchEvent(new Event('input'));

        expect(hor.value).toBe('15');
        expect(document.getElementById('dHor').innerText).toContain('15');
        // Verify simulation ran successfully
        expect(window.__lastSim).toBeDefined();
        expect(window.__lastSim.netRE).toBeDefined();
    });

    test('advanced track terms extend horizon to longest track', () => {
        document.getElementById('btnAdvancedTerm').click(); // enable advanced mode
        const termPrime = document.getElementById('termPrime');
        const hor = document.getElementById('rHor');
        const mainTerm = document.getElementById('rDur');

        termPrime.value = 30;
        termPrime.dispatchEvent(new Event('input'));

        expect(hor.value).toBe('30');
        expect(mainTerm.value).toBe('30'); // main term mirrors longest track in advanced
        expect(window.__lastSim).toBeDefined();
    });

    test('zero-percent track does not force horizon when set to long term', () => {
        document.getElementById('btnAdvancedTerm').click(); // advanced mode

        // Set Prime to 0% with a long term
        document.getElementById('pctPrime').value = 0;
        document.getElementById('termPrime').value = 30;

        // Keep Kalats/Katz at 25y and active
        document.getElementById('pctKalats').value = 50;
        document.getElementById('termKalats').value = 25;
        document.getElementById('pctKatz').value = 50;
        document.getElementById('termKatz').value = 25;

        // Set Malatz/Matz to 0% (they have defaults that could interfere)
        document.getElementById('pctMalatz').value = 0;
        document.getElementById('pctMatz').value = 0;

        window.checkMix(); // updates disabled state and runs sim

        const hor = document.getElementById('rHor');
        expect(hor.value).toBe('25');
        expect(window.__lastSim).toBeDefined();
    });
});
