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
global.Chart = class { constructor() {} destroy() {} resize() {} update() {} };

const appJsContent = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');

describe('Surplus Logic: Deep Dive', () => {
    
    beforeEach(() => {
        // Updated DOM setup with PILLS
        document.body.innerHTML = `
            <input id="inpEquity" value="1000000">
            <input id="rDown" value="80">
            <input id="rDur" value="30">
            <input id="rHor" value="30">
            <input id="sInt" value="2.0">
            <input id="sSP" value="10">
            <input id="sApp" value="4">
            <input id="sInf" value="0">
            <input id="sYld" value="10.0">
            
            <!-- Configs -->
            <input id="rDiscount" value="0"><input id="rBuyCost" value="0"><input id="rMaint" value="0"><input id="rSellCost" value="0"><input id="rTrade" value="0"><input id="rMer" value="0">
            <input id="pctPrime" value="100"><input id="ratePrime" value="2.0"><input id="termPrime" value="30">
            <input id="pctKalats" value="0"><input id="rateKalats" value="0"><input id="termKalats" value="30">
            <input id="pctKatz" value="0"><input id="rateKatz" value="0"><input id="termKatz" value="30">
            <input id="pctMalatz" value="0"><input id="rateMalatz" value="0"><input id="termMalatz" value="30">
            <input id="pctMatz" value="0"><input id="rateMatz" value="0"><input id="termMatz" value="30">
            
            <!-- Surplus Pills -->
            <div id="surplusPills">
                <div id="surplusConsume" class="pill active"></div>
                <div id="surplusMatch" class="pill"></div>
                <div id="surplusInvest" class="pill"></div>
            </div>
            <div id="surplusDesc"></div>
            <div id="surplusDescText"></div>
            
            <input type="checkbox" id="cTax">
            <input type="checkbox" id="cRentTax">
            
            <!-- Credit Inputs -->
            <input id="creditScore" value="750">
            <div id="creditScoreVal"></div>
            <div id="creditTierLabel"></div>
            <div id="creditWarn"></div>

            <!-- Outputs -->
            <div id="dDown"></div><div id="dDur"></div><div id="dHor"></div><div id="vTrade"></div><div id="vMer"></div>
            <div id="vDiscount"></div><div id="vBuyCost"></div><div id="vMaint"></div><div id="vSellCost"></div><div id="valAsset"></div><div id="valLev"></div><div id="barLev"></div>
            <div id="valPosCF"></div><div id="valMortgage"></div><div id="valCashflow"></div>
            <div id="kRE"></div><div id="kSP"></div><div id="kRECagr"></div><div id="kSPCagr"></div><div id="kInt"></div><div id="kRent"></div><div id="kInvested"></div><div id="kDiff"></div><div id="valMixSum"></div>
            <div id="scenBear" class=""></div><div id="scenBase" class=""></div><div id="scenBull" class=""></div><div id="pGlobal"><div></div><div></div></div><div id="scenBox"></div>
            <div id="btnCurr"></div><div id="btnPct"></div><div id="equityBox"></div><div id="pHor"><div></div><div></div></div><div id="bHor"></div>
            <div id="infMeter"><div></div><div></div><div></div></div><div id="txReal"></div><div id="txForex"></div><div id="spotDown"></div><div id="spotDur"></div><div id="spotHor"></div>
            <canvas id="wealthChart"></canvas><canvas id="flowChart"></canvas>
            
            <!-- Mock Config Elements -->
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
        eval(appJsContent);
    });

    test('Baseline: Huge Surplus exists', () => {
        window.runSim();
        const snap = window.__lastSim;
        expect(snap.flowNet).toBeGreaterThan(0);
    });

    test('Feature Check: Auto-Invest increases Side Portfolio', () => {
        // 1. Run Consume Mode
        window.setSurplusMode('consume');
        window.runSim();
        const snapConsume = window.__lastSim;
        
        // 2. Run Invest Mode
        window.setSurplusMode('invest');
        window.runSim();
        const snapInvest = window.__lastSim;
        
        // In Invest mode, reSideStockValue should be > 0
        expect(snapInvest.reSideStockValue).toBeGreaterThan(0);
        // In Consume mode, it should be 0
        expect(snapConsume.reSideStockValue).toBe(0);
        
        // Net RE should be higher in Invest mode
        expect(snapInvest.finalNetRE).toBeGreaterThan(snapConsume.finalNetRE);
    });

    test('Feature Check: Match Mode reduces S&P Value', () => {
        // 1. Run Consume Mode (S&P stays intact, RE consumes surplus)
        window.setSurplusMode('consume');
        window.runSim();
        const snapConsume = window.__lastSim;
        
        // 2. Run Match Mode (S&P sells to match RE consumption)
        window.setSurplusMode('match');
        window.runSim();
        const snapMatch = window.__lastSim;
        
        // S&P Value should be lower in Match mode
        expect(snapMatch.spValueHedged).toBeLessThan(snapConsume.spValueHedged);
    });

});