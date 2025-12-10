/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const Logic = require('../src/logic.js');

global.window = window;
global.document = window.document;
global.Logic = Logic;

global.Chart = class {
    constructor() {}
    destroy() {}
    resize() {}
    update() {}
};

const appJsContent = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');

describe('Horizon Mode: Auto vs Custom Consistency', () => {
    
    beforeEach(() => {
        document.body.innerHTML = `
            <input id="inpEquity" value="400000">
            <input id="rDown" value="30">
            <input id="rDur" value="30">
            <input id="rHor" value="25">
            <input id="sInt" value="4.25">
            <input id="sSP" value="10">
            <input id="sApp" value="5">
            <input id="sInf" value="2.5">
            <input id="sYld" value="3.0">
            <input id="rDiscount" value="0">
            <input id="rBuyCost" value="2.0">
            <input id="rMaint" value="8">
            <input id="rSellCost" value="2.0">
            <input id="rTrade" value="0.1">
            <input id="rMer" value="0.05">
            
            <input id="pctPrime" value="33">
            <input id="ratePrime" value="5.15">
            <input id="termPrime" value="30">
            <input id="sliderPrime" type="range" value="33">
            <div id="dispPrime">33%</div>
            
            <input id="pctKalats" value="34">
            <input id="rateKalats" value="4.71">
            <input id="termKalats" value="30">
            <input id="sliderKalats" type="range" value="34">
            <div id="dispKalats">34%</div>
            
            <input id="pctKatz" value="0">
            <input id="rateKatz" value="3.15">
            <input id="termKatz" value="30">
            <input id="sliderKatz" type="range" value="0">
            <div id="dispKatz">0%</div>

            <input id="pctMalatz" value="33">
            <input id="rateMalatz" value="4.66">
            <input id="termMalatz" value="30">
            <input id="sliderMalatz" type="range" value="33">
            <div id="dispMalatz">33%</div>

            <input id="pctMatz" value="0">
            <input id="rateMatz" value="3.39">
            <input id="termMatz" value="30">
            <input id="sliderMatz" type="range" value="0">
            <div id="dispMatz">0%</div>
            
            <div id="surplusPills">
                <div id="surplusConsume" class="pill"></div>
                <div id="surplusMatch" class="pill active"></div>
                <div id="surplusInvest" class="pill"></div>
            </div>
            
            <div id="pHor">
                <div class="pill active">Auto</div>
                <div class="pill">Custom</div>
            </div>
            <div id="bHor" class="show"></div>
            
            <div id="kRE">0</div>
            <div id="kSP">0</div>
            <div id="kRECagr">0%</div>
            <div id="kSPCagr">0%</div>
            <div id="kDiff">0</div>
            <div id="kInt">0</div>
            <div id="kRent">0</div>
            <div id="kInvested">0</div>
            <div id="valAsset">0</div>
            <div id="valMortgage">0</div>
            <div id="valLev">0</div>
            <div id="barLev"></div>
            <div id="valPosCF">0</div>
            <div id="dDown">30%</div>
            <div id="dDur">30 Yr</div>
            <div id="dHor">Auto (30Y)</div>
            <div id="vTrade">0.1%</div>
            <div id="vMer">0.05%</div>
            <div id="vDiscount">0%</div>
            <div id="vBuyCost">2.0%</div>
            <div id="vMaint">8%</div>
            <div id="vSellCost">2.0%</div>
            <div id="vSP">10%</div>
            <div id="vApp">5%</div>
            <div id="vInt">4.25%</div>
            <div id="vInf">2.5%</div>
            <div id="vYld">3.0%</div>
            <div id="vTaxMode">Real</div>
            
            <input type="checkbox" id="cTax" checked>
            <input type="checkbox" id="cRentTax">
            
            <div id="chartsContainer"></div>
            <div id="chartsWarn" style="display:none;"></div>
            <div id="mixVisualBar"><div></div><div></div><div></div><div></div><div></div></div>
            <div id="valMixSum">100%</div>
            
            <div id="lockDownBtn">Locked</div>
            <div id="lockTermBtn">Locked</div>
            <div id="lockHorBtn">Locked</div>
            <div id="optModeLabel"></div>
            
            <div id="spotDown" class="sweet-spot"></div>
            <div id="spotDur" class="sweet-spot"></div>
            <div id="spotHor" class="sweet-spot"></div>
            
            <div id="scenBear" class="scen-btn"></div>
            <div id="scenBase" class="scen-btn active"></div>
            <div id="scenBull" class="scen-btn"></div>
            
            <div id="pGlobal"><div></div><div></div></div>
            <div id="scenBox"></div>
            
            <div id="lblRatePrime">5.15%</div>
            <div id="lblRateKalats">4.71%</div>
            <div id="lblRateKatz">3.15% + CPI</div>
            <div id="lblRateMalatz">4.66%</div>
            <div id="lblRateMatz">3.39% + CPI</div>
            
            <div id="creditScoreVal">900</div>
            <div id="creditTierLabel">Premium</div>
            <div id="creditWarn" style="display:none;"></div>
            <input id="creditScore" value="900">
            
            <canvas id="wealthChart"></canvas>
            <canvas id="flowChart"></canvas>
        `;
        
        eval(appJsContent);
    });

    test('auto mode sets rHor to effectiveMax', () => {
        // Run in auto mode first
        window.tglHor(true);
        window.runSim();
        
        // rHor should be set to effectiveMax (30 in this case)
        expect(document.getElementById('rHor').value).toBe('30');
    });

    test('switching from auto to custom preserves rHor value', () => {
        // First run in auto mode to set rHor
        window.tglHor(true);
        window.runSim();
        expect(document.getElementById('rHor').value).toBe('30');
        
        // Switch to custom mode
        window.tglHor(false);
        
        // rHor should still be 30
        expect(document.getElementById('rHor').value).toBe('30');
    });

    test('auto and custom mode with same horizon should produce identical results', () => {
        // Run in auto mode first
        window.tglHor(true);
        window.runSim();
        
        const autoRENet = document.getElementById('kRE').innerText;
        const autoSPNet = document.getElementById('kSP').innerText;
        const autoRECagr = document.getElementById('kRECagr').innerText;
        const autoSPCagr = document.getElementById('kSPCagr').innerText;
        
        // Switch to custom mode (rHor already has correct value from auto)
        window.tglHor(false);
        
        const customRENet = document.getElementById('kRE').innerText;
        const customSPNet = document.getElementById('kSP').innerText;
        const customRECagr = document.getElementById('kRECagr').innerText;
        const customSPCagr = document.getElementById('kSPCagr').innerText;
        
        // Results should be identical
        expect(customRENet).toBe(autoRENet);
        expect(customSPNet).toBe(autoSPNet);
        expect(customRECagr).toBe(autoRECagr);
        expect(customSPCagr).toBe(autoSPCagr);
    });

    test('changing mortgage term in auto mode updates simulation horizon', () => {
        window.tglHor(true);
        document.getElementById('rDur').value = '25';
        window.runSim();
        
        expect(document.getElementById('dHor').innerText).toContain('25');
    });

    test('custom mode allows different horizon than mortgage term', () => {
        window.tglHor(false);
        document.getElementById('rDur').value = '30';
        document.getElementById('rHor').value = '20';
        window.runSim();
        
        expect(document.getElementById('dHor').innerText).toBe('20 Yr');
    });

    test('simulation results change when horizon changes in custom mode', () => {
        window.tglHor(false);
        
        document.getElementById('rHor').value = '30';
        window.runSim();
        const results30 = {
            reNet: document.getElementById('kRE').innerText,
            spNet: document.getElementById('kSP').innerText
        };
        
        document.getElementById('rHor').value = '20';
        window.runSim();
        const results20 = {
            reNet: document.getElementById('kRE').innerText,
            spNet: document.getElementById('kSP').innerText
        };
        
        expect(results30.reNet).not.toBe(results20.reNet);
        expect(results30.spNet).not.toBe(results20.spNet);
    });

    test('switching back to auto from custom resets to mortgage term', () => {
        window.tglHor(false);
        document.getElementById('rHor').value = '15';
        window.runSim();
        
        expect(document.getElementById('dHor').innerText).toBe('15 Yr');
        
        window.tglHor(true);
        
        expect(document.getElementById('dHor').innerText).toContain('30');
    });
});

describe('Horizon Mode: CAGR Calculation Consistency', () => {
    test('CAGR calculation uses correct horizon', () => {
        const baseParams = {
            equity: 400000,
            downPct: 0.30,
            loanTerm: 30,
            mix: { prime: 33, kalats: 34, katz: 0, malatz: 33, matz: 0 },
            rates: { prime: 0.0515, kalats: 0.0471, katz: 0.0315, malatz: 0.0466, matz: 0.0339 },
            market: { sp: 0.10, reApp: 0.05, cpi: 0.025, boi: 0.0425, rentYield: 0.03 },
            fees: { buy: 0.02, sell: 0.02, trade: 0.001, mgmt: 0.0005 },
            tax: { use: true, useRent: false, mode: 'real' },
            config: { exMode: 'hedged', surplusMode: 'match', drift: 0 },
            maintPct: 0.08,
            returnSeries: false
        };
        
        const result30 = Logic.simulate({ ...baseParams, simHorizon: 30 });
        const result20 = Logic.simulate({ ...baseParams, simHorizon: 20 });
        
        expect(result30.cagrRE).not.toBeNull();
        expect(result30.cagrSP).not.toBeNull();
        expect(result20.cagrRE).not.toBeNull();
        expect(result20.cagrSP).not.toBeNull();
        
        expect(result30.netRE).toBeGreaterThan(result20.netRE);
        expect(result30.netSP).toBeGreaterThan(result20.netSP);
    });

    test('same horizon produces same results', () => {
        const baseParams = {
            equity: 400000,
            downPct: 0.30,
            loanTerm: 30,
            simHorizon: 25,
            mix: { prime: 33, kalats: 34, katz: 0, malatz: 33, matz: 0 },
            rates: { prime: 0.0515, kalats: 0.0471, katz: 0.0315, malatz: 0.0466, matz: 0.0339 },
            market: { sp: 0.10, reApp: 0.05, cpi: 0.025, boi: 0.0425, rentYield: 0.03 },
            fees: { buy: 0.02, sell: 0.02, trade: 0.001, mgmt: 0.0005 },
            tax: { use: true, useRent: false, mode: 'real' },
            config: { exMode: 'hedged', surplusMode: 'match', drift: 0 },
            maintPct: 0.08,
            returnSeries: false
        };
        
        const result1 = Logic.simulate(baseParams);
        const result2 = Logic.simulate(baseParams);
        
        expect(result1.netRE).toBe(result2.netRE);
        expect(result1.netSP).toBe(result2.netSP);
        expect(result1.cagrRE).toBe(result2.cagrRE);
        expect(result1.cagrSP).toBe(result2.cagrSP);
    });
});


describe('searchSweetSpots: Auto vs Custom mode consistency', () => {
    test('with lockHor=true, auto and custom modes should return same sweet spots', () => {
        const baseParams = {
            eq: 400000,
            curDown: 0.30,
            curDur: 25,
            simDur: 25,
            useTax: true,
            useRentTax: false,
            tradeFee: 0.001,
            merFee: 0.0005,
            buyCostPct: 0.02,
            maintPct: 0.08,
            sellCostPct: 0.02,
            overrides: {
                SP: 0.10, App: 0.05, Int: 0.0425, Inf: 0.025, Yld: 0.03,
                RateP: 0.0515, RateK: 0.0471, RateZ: 0.0315, RateM: 0.0466, RateMT: 0.0339
            },
            mix: { prime: 34, kalats: 33, katz: 0, malatz: 33, matz: 0 },
            drift: 0,
            lockDown: false,
            lockTerm: false,
            lockHor: true,  // KEY: horizon is locked
            cfg: {},
            exMode: 'hedged',
            taxMode: 'real',
            surplusMode: 'match'
        };

        // Auto mode
        const autoResult = Logic.searchSweetSpots({ ...baseParams, horMode: 'auto' });
        
        // Custom mode
        const customResult = Logic.searchSweetSpots({ ...baseParams, horMode: 'custom' });

        // With lockHor=true, both modes should produce identical results
        expect(customResult.d).toBe(autoResult.d);
        expect(customResult.t).toBe(autoResult.t);
        expect(customResult.h).toBe(autoResult.h);
        expect(customResult.c).toBeCloseTo(autoResult.c, 2);
    });

    test('with lockHor=false, auto mode ties horizon to term', () => {
        const baseParams = {
            eq: 400000,
            curDown: 0.30,
            curDur: 25,
            simDur: 25,
            useTax: true,
            useRentTax: false,
            tradeFee: 0.001,
            merFee: 0.0005,
            buyCostPct: 0.02,
            maintPct: 0.08,
            sellCostPct: 0.02,
            overrides: {
                SP: 0.10, App: 0.05, Int: 0.0425, Inf: 0.025, Yld: 0.03,
                RateP: 0.0515, RateK: 0.0471, RateZ: 0.0315, RateM: 0.0466, RateMT: 0.0339
            },
            mix: { prime: 34, kalats: 33, katz: 0, malatz: 33, matz: 0 },
            drift: 0,
            lockDown: true,  // Lock down to simplify
            lockTerm: false,
            lockHor: false,  // KEY: horizon is NOT locked
            horMode: 'auto',
            cfg: {},
            exMode: 'hedged',
            taxMode: 'real',
            surplusMode: 'match'
        };

        const result = Logic.searchSweetSpots(baseParams);

        // In auto mode with lockHor=false, horizon should equal term
        expect(result.h).toBe(result.t);
    });
});
