/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const Logic = require('../src/logic.js');

// Mock Global Environment
global.window = window;
global.document = window.document;
global.Logic = Logic;

// Mock Chart.js
global.Chart = class {
    constructor() {}
    destroy() {}
    resize() {}
    update() {}
};

// Load i18n, config, charts
const i18nCode = fs.readFileSync(path.resolve(__dirname, '../src/i18n/index.js'), 'utf8');
eval(i18nCode);
const configCode = fs.readFileSync(path.resolve(__dirname, '../src/config/index.js'), 'utf8');
eval(configCode);
const chartsCode = fs.readFileSync(path.resolve(__dirname, '../src/charts/index.js'), 'utf8');
eval(chartsCode);
const prepayCode = fs.readFileSync(path.resolve(__dirname, '../src/prepayments/index.js'), 'utf8');
eval(prepayCode);

describe('App Logic: UI Interaction', () => {
    
    beforeEach(() => {
        // Setup Minimal DOM required for app.js
        document.body.innerHTML = `
            <input id="inpEquity" value="400000">
            <input id="rDown" value="30">
            <input id="rDur" value="20">
            <input id="rHor" value="20">
            <input id="sInt" value="4.25">
            <input id="sSP" value="10">
            <input id="sApp" value="4">
            <input id="sInf" value="2.5">
            <input id="sYld" value="3.2">
            <input id="rDiscount" value="1">
            <input id="rBuyCost" value="2.0">
            <input id="rMaint" value="10">
            <input id="rSellCost" value="2.0">
            <input id="rTrade" value="0.1">
            <input id="rMer" value="0.05">
            
            <input id="pctPrime" value="33">
            <input id="ratePrime" value="5.75">
            <input id="termPrime" value="20">
            <span id="termPrimeVal">20y</span>
            <input id="sliderPrime" type="range" value="33">
            <div id="dispPrime">33%</div>
            
            <input id="pctKalats" value="33">
            <input id="rateKalats" value="4.8">
            <input id="termKalats" value="20">
            <span id="termKalatsVal">20y</span>
            <input id="sliderKalats" type="range" value="33">
            <div id="dispKalats">33%</div>
            
            <input id="pctKatz" value="34">
            <input id="rateKatz" value="3.2">
            <input id="termKatz" value="20">
            <span id="termKatzVal">20y</span>
            <input id="sliderKatz" type="range" value="34">
            <div id="dispKatz">34%</div>

            <!-- New Tracks -->
            <input id="pctMalatz" value="0">
            <input id="rateMalatz" value="4.5">
            <input id="termMalatz" value="20">
            <span id="termMalatzVal">20y</span>
            <input id="sliderMalatz" type="range" value="0">
            <div id="dispMalatz">0%</div>

            <input id="pctMatz" value="0">
            <input id="rateMatz" value="2.15">
            <input id="termMatz" value="20">
            <span id="termMatzVal">20y</span>
            <input id="sliderMatz" type="range" value="0">
            <div id="dispMatz">0%</div>
            
            <!-- Surplus Pills -->
            <div id="surplusPills">
                <div id="surplusConsume" class="pill active"></div>
                <div id="surplusMatch" class="pill"></div>
                <div id="surplusInvest" class="pill"></div>
            </div>
            <div id="surplusDesc"></div>
            
            <!-- Repay Method Toggle -->
            <div id="pRepayMethod">
                <div id="repaySpitzer" class="pill active"></div>
                <div id="repayEqualPrincipal" class="pill"></div>
            </div>
            <div id="surplusDescText"></div>
            
            <input type="checkbox" id="cTaxSP">
            <input type="checkbox" id="cRentTax">
            
            <!-- Advanced Term Mode -->
            <div id="advancedTermBox" style="display:none"></div>
            <div id="basicTermBox"></div>
            <div id="btnAdvancedTerm"></div>
            
            <!-- Credit Inputs -->
            <input id="creditScore" value="750">
            <div id="creditScoreVal"></div>
            <div id="creditTierLabel"></div>
            <div id="creditWarn"></div>

            <!-- Outputs -->
            <div id="dDown"></div>
            <div id="dDur"></div>
            <div id="dHor"></div>
            <div id="vTrade"></div>
            <div id="vMer"></div>
            <div id="vDiscount"></div>
            <div id="vBuyCost"></div>
            <div id="vMaint"></div>
            <div id="vSellCost"></div>
            <div id="valAsset"></div>
            <div id="valLev"></div>
            <div id="barLev"></div>
            <div id="valPosCF"></div>
            <div id="valMortgage"></div>
            <div id="valCashflow"></div>
            
            <div id="kRE"></div>
            <div id="kSP"></div>
            <div id="kRECagr"></div>
            <div id="kSPCagr"></div>
            <div id="kInt"></div>
            <div id="kRent"></div>
            <div id="kInvested"></div>
            <div id="kDiff"></div>
            
            <div id="valMixSum"></div>
            
            <!-- Scenarios -->
            <div id="scenBear" class=""></div>
            <div id="scenBase" class=""></div>
            <div id="scenBull" class=""></div>
            <div id="pGlobal"><div></div><div></div></div>
            <div id="scenBox"></div>
            
            <!-- Toggles -->
            <div id="btnCurr"></div>
            <div id="btnPct"></div>
            <div id="equityBox"></div>
            <div id="pHor"><div></div><div></div></div>
            <div id="bHor"></div>
            
            <div id="infMeter"><div></div><div></div><div></div></div>
            <div id="txReal"></div>
            <div id="txForex"></div>
            
            <!-- Sweet Spots -->
            <div id="spotDown"></div>
            <div id="spotDur"></div>
            <div id="spotHor"></div>
            
            <!-- Canvas -->
            <canvas id="wealthChart"></canvas>
            <canvas id="flowChart"></canvas>
            
            <!-- Config -->
            <div id="vSP"></div><input id="bSP">
            <div id="vApp"></div><input id="bApp">
            <div id="vInt"></div><input id="bInt">
            <div id="vInf"></div><input id="bInf">
            <div id="vYld"></div><input id="bYld">
            <div id="pSP"><div></div><div></div></div>
            <div id="pApp"><div></div><div></div></div>
            <div id="pInt"><div></div><div></div></div>
            <div id="pInf"><div></div><div></div></div>
            <div id="pYld"><div></div><div></div></div>
        `;
        
        // Initialize App - use require (Babel transpiles ESM to CommonJS)
        jest.resetModules();
        require('../src/i18n/index.js');
        require('../src/config/index.js');
        require('../src/app.js');
        // Manually trigger bootstrap if not auto-run
        // Note: The file adds event listener to DOMContentLoaded. In JSDOM this might have already fired.
        // We'll verify by checking if window.runSim exists.
    });

    test('applyTamheel updates inputs correctly', () => {
        // Apply 'arbitrage' (P:37, K:33, Z:0, M:30, MT:0)
        window.applyTamheel('arbitrage');
        
        expect(document.getElementById('pctPrime').value).toBe("37");
        expect(document.getElementById('pctKalats').value).toBe("33");
        expect(document.getElementById('pctKatz').value).toBe("0");
        expect(document.getElementById('pctMalatz').value).toBe("30");
        
        // Check if it triggered mix sum update
        expect(document.getElementById('valMixSum').innerText).toBe("100%");
    });

    test('setBuyerType enforces LTV limits', () => {
        const slider = document.getElementById('rDown');
        
        // Default Min is 25
        window.setBuyerType('first');
        expect(slider.min).toBe("25");
        
        // Investor Min is 50
        window.setBuyerType('investor');
        expect(slider.min).toBe("50");
        
        // If current value is 30, it should be forced to 50
        expect(slider.value).toBe("50");
    });

    test('runSim populates KPIs', () => {
        window.runSim();
        const kRE = document.getElementById('kRE').innerText;
        expect(kRE.length).toBeGreaterThan(0);
    });
    
    test('Scenario Buttons Toggle Classes', () => {
        window.applyScenario('bear');
        expect(document.getElementById('scenBear').classList.contains('active')).toBe(true);
        expect(document.getElementById('scenBase').classList.contains('active')).toBe(false);
        
        window.applyScenario('bull');
        expect(document.getElementById('scenBull').classList.contains('active')).toBe(true);
        expect(document.getElementById('scenBear').classList.contains('active')).toBe(false);
    });

    test('Surplus Mode Toggles', () => {
        // Click Invest
        const btnInvest = document.getElementById('surplusInvest');
        btnInvest.onclick = () => window.setSurplusMode('invest'); // Bind manually if eval didn't catch it
        btnInvest.click();
        
        expect(document.getElementById('surplusInvest').classList.contains('active')).toBe(true);
        expect(document.getElementById('surplusConsume').classList.contains('active')).toBe(false);
        
        const descText = document.getElementById('surplusDescText').innerText || document.getElementById('surplusDesc').innerText;
        expect(descText).toContain("Buy S&P");

        // Click Match
        const btnMatch = document.getElementById('surplusMatch');
        btnMatch.onclick = () => window.setSurplusMode('match');
        btnMatch.click();
        
        expect(document.getElementById('surplusMatch').classList.contains('active')).toBe(true);
        expect(document.getElementById('surplusInvest').classList.contains('active')).toBe(false);
    });
});
