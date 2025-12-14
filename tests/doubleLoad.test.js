/**
 * Simulate the browser double-include pattern: logic.js, then app.js, then app.js again.
 * We expect no redeclaration errors (e.g., "Identifier 'Logic' has already been declared").
 */
const fs = require('fs');
const path = require('path');

describe('Double script load resilience', () => {
    beforeEach(() => {
        jest.resetModules();
        global.window = {};
        global.document = {
            addEventListener: jest.fn(),
            getElementById: jest.fn(() => ({
                style:{}, classList:{add:()=>{},remove:()=>{},toggle:()=>{}}, children:[], innerText:'', value:'', checked:false
            })),
        };
        global.Chart = class { constructor() {} destroy() {} update() {} };
        // Load required modules
        const i18nCode = fs.readFileSync(path.resolve(__dirname, '../src/i18n/index.js'), 'utf8');
        eval(i18nCode);
        const configCode = fs.readFileSync(path.resolve(__dirname, '../src/config/index.js'), 'utf8');
        eval(configCode);
        const stateCode = fs.readFileSync(path.resolve(__dirname, '../src/state/index.js'), 'utf8');
        eval(stateCode);
        const chartsCode = fs.readFileSync(path.resolve(__dirname, '../src/charts/index.js'), 'utf8');
        eval(chartsCode);
        const prepayCode = fs.readFileSync(path.resolve(__dirname, '../src/prepayments/index.js'), 'utf8');
        eval(prepayCode);
const persistCode = fs.readFileSync(path.resolve(__dirname, "../src/persistence/index.js"), "utf8");
eval(persistCode);
    });

    test('loading logic then app twice does not throw', () => {
        require('../src/logic.js');
        expect(() => require('../src/app.js')).not.toThrow();
        // simulate accidental second include of app.js
        expect(() => require('../src/app.js')).not.toThrow();
    });
});
