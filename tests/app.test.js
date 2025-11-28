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

// Load App Code
const appJsContent = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');

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
            <input id="rBuyCost" value="2.0">
            <input id="rMaint" value="10">
            <input id="rSellCost" value="2.0">
            <input id="rTrade" value="0.1">
            <input id="rMer" value="0.05">
            
            <input id="pctPrime" value="33">
            <input id="ratePrime" value="5.75">
            <input id="termPrime" value="20">
            
            <input id="pctKalats" value="33">
            <input id="rateKalats" value="4.8">
            <input id="termKalats" value="20">
            
            <input id="pctKatz" value="34">
            <input id="rateKatz" value="3.2">
            <input id="termKatz" value="20">
            
            <!-- Surplus Pills -->
            <div id="surplusPills">
                <div id="surplusConsume" class="pill active"></div>
                <div id="surplusMatch" class="pill"></div>
                <div id="surplusInvest" class="pill"></div>
            </div>
            <div id="surplusDesc"></div>
            
            <input type="checkbox" id="cTax">
            <input type="checkbox" id="cRentTax">
            
            <!-- Outputs -->
            <div id="dDown"></div>
            <div id="dDur"></div>
            <div id="dHor"></div>
            <div id="vTrade"></div>
            <div id="vMer"></div>
            <div id="vBuyCost"></div>
            <div id="vMaint"></div>
            <div id="vSellCost"></div>
            <div id="valAsset"></div>
            <div id="valLev"></div>
            <div id="barLev"></div>
            
            <div id="kRE"></div>
            <div id="kSP"></div>
            <div id="kRECagr"></div>
            <div id="kSPCagr"></div>
            <div id="kInt"></div>
            <div id="kRent"></div>
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
        
        // Initialize App
        try {
            eval(appJsContent);
        } catch (e) {
            console.error("EVAL FAILED:", e);
        }
        // Manually trigger bootstrap if not auto-run
        // Note: The file adds event listener to DOMContentLoaded. In JSDOM this might have already fired.
        // We'll verify by checking if window.runSim exists.
    });

    test('applyTamheel updates inputs correctly', () => {
        // Apply 'arbitrage' (P:45, K:55, Z:0)
        window.applyTamheel('arbitrage');
        
        expect(document.getElementById('pctPrime').value).toBe("45");
        expect(document.getElementById('pctKalats').value).toBe("55");
        expect(document.getElementById('pctKatz').value).toBe("0");
        
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
        expect(document.getElementById('surplusDesc').innerText).toContain("Buy S&P");

        // Click Match
        const btnMatch = document.getElementById('surplusMatch');
        btnMatch.onclick = () => window.setSurplusMode('match');
        btnMatch.click();
        
        expect(document.getElementById('surplusMatch').classList.contains('active')).toBe(true);
        expect(document.getElementById('surplusInvest').classList.contains('active')).toBe(false);
    });
});
