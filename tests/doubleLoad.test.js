/**
 * Simulate the browser double-include pattern: logic.js, then app.js, then app.js again.
 * We expect no redeclaration errors (e.g., "Identifier 'Logic' has already been declared").
 */
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
    });

    test('loading logic then app twice does not throw', () => {
        require('../src/logic.js');
        expect(() => require('../src/app.js')).not.toThrow();
        // simulate accidental second include of app.js
        expect(() => require('../src/app.js')).not.toThrow();
    });
});
