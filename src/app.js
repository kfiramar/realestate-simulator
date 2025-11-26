// --- CONSTANTS ---
const H_SP = [0.1088, 0.0491, 0.1579, 0.0549, -0.3700, 0.2646, 0.1506, 0.0211, 0.1600, 0.3239, 0.1369, 0.0138, 0.1196, 0.2183, -0.0438, 0.3149, 0.1840, 0.2871, -0.1811, 0.2629, 0.2400];
const H_RE = [-0.02, 0.04, 0.00, 0.03, 0.06, 0.19, 0.15, 0.04, 0.05, 0.08, 0.06, 0.07, 0.05, 0.04, 0.01, 0.03, 0.04, 0.12, 0.18, 0.02, 0.05];
const H_EX = [4.48, 4.49, 4.45, 4.11, 3.59, 3.93, 3.73, 3.58, 3.85, 3.61, 3.58, 3.88, 3.84, 3.60, 3.59, 3.56, 3.44, 3.23, 3.36, 3.68, 3.75];
const H_CPI = [0.012, 0.024, -0.001, 0.034, 0.038, 0.039, 0.027, 0.022, 0.016, 0.018, -0.002, -0.010, -0.002, 0.004, 0.008, 0.006, -0.007, 0.028, 0.053, 0.030, 0.032];
const H_BOI = [0.041, 0.035, 0.050, 0.040, 0.035, 0.010, 0.015, 0.030, 0.025, 0.015, 0.0075, 0.001, 0.001, 0.001, 0.0025, 0.001, 0.001, 0.035, 0.045, 0.045];

const SCENARIOS = {
    bear: { sp: 6.0, app: 4.0, int: 5.5, inf: 4.5, yld: 4.8, drift: 2.5 },
    base: { sp: 8.5, app: 5.5, int: 3.75, inf: 2.2, yld: 3.5, drift: -0.5 },
    bull: { sp: 11.0, app: 8.0, int: 2.5, inf: 1.5, yld: 2.8, drift: -2.0 }
};

const TAMHEEL_PROFILES = {
    arbitrage: { p: 45, k: 55, z: 0, rP: 5.60, rK: 4.83, rZ: 0 },
    shield: { p: 35, k: 65, z: 0, rP: 5.70, rK: 5.13, rZ: 0 },
    investor: { p: 33, k: 27, z: 40, rP: 5.90, rK: 4.90, rZ: 3.10 }
};

function getH(arr, i) { return i < arr.length ? arr[i] : arr[arr.length-1]; }

// --- STATE ---
let mode = 'percent';
let exMode = 'hedged';
let taxMode = 'real';
let horMode = 'auto';
let wealthChart = null;
let flowChart = null;
let lockDown = false;
let lockTerm = false;
let lockHor = true;

const cfg = {
    SP: {is:false, b:'bSP', s:'sSP', v:'vSP', p:'pSP'},
    App: {is:false, b:'bApp', s:'sApp', v:'vApp', p:'pApp'},
    Int: {is:false, b:'bInt', s:'sInt', v:'vInt', p:'pInt'},
    Yld: {is:false, b:'bYld', s:'sYld', v:'vYld', p:'pYld'},
    Inf: {is:false, b:'bInf', s:'sInf', v:'vInf', p:'pInf'}
};

// --- UI FUNCTIONS ---
function setMode(m) {
    mode = m;
    document.getElementById('btnCurr').classList.toggle('active', m==='currency');
    document.getElementById('btnPct').classList.toggle('active', m==='percent');
    document.getElementById('equityBox').classList.toggle('show', m==='currency');
    runSim();
}
function tgl(k, h) {
    cfg[k].is = h;
    const pills = document.getElementById(cfg[k].p).children;
    pills[0].classList.toggle('active', h); pills[1].classList.toggle('active', !h);
    document.getElementById(cfg[k].b).classList.toggle('show', !h);
    if(k==='Inf') updMeter();
    runSim();
}
function setGlobalMode(isHist) {
    const globalPills = document.getElementById('pGlobal').children;
    globalPills[0].classList.toggle('active', isHist);
    globalPills[1].classList.toggle('active', !isHist);
    document.getElementById('scenBox').classList.toggle('show', !isHist);
    for(let k in cfg) { tgl(k, isHist); }
}
function applyScenario(type) {
    const s = SCENARIOS[type];
    document.getElementById('sSP').value = s.sp;
    document.getElementById('sApp').value = s.app;
    document.getElementById('sInt').value = s.int;
    document.getElementById('sInf').value = s.inf;
    document.getElementById('sYld').value = s.yld;

    document.getElementById('scenBear').classList.toggle('active', type==='bear');
    document.getElementById('scenBase').classList.toggle('active', type==='base');
    document.getElementById('scenBull').classList.toggle('active', type==='bull');

    document.getElementById('ratePrime').value = (s.int + 1.5).toFixed(2); // Auto sync Prime
    updMeter();
    runSim();
}
function applyTamheel(type) {
    const t = TAMHEEL_PROFILES[type];
    document.getElementById('pctPrime').value = t.p;
    document.getElementById('ratePrime').value = t.rP;
    document.getElementById('pctKalats').value = t.k;
    document.getElementById('rateKalats').value = t.rK;
    document.getElementById('pctKatz').value = t.z;
    document.getElementById('rateKatz').value = t.rZ;
    checkMix();
}
function tglHor(isAuto) {
    horMode = isAuto ? 'auto' : 'custom';
    document.getElementById('pHor').children[0].classList.toggle('active', isAuto);
    document.getElementById('pHor').children[1].classList.toggle('active', !isAuto);
    document.getElementById('bHor').classList.toggle('show', !isAuto);
    // default lock horizon; unlock only when custom
    if (isAuto) { lockHor = true; }
    runSim();
}
// setEx removed as UI element removed, keeping exMode='hedged'
function setTaxMode(m) {
    taxMode = m;
    document.getElementById('txReal').classList.toggle('active', m==='real');
    document.getElementById('txForex').classList.toggle('active', m==='forex');
    runSim();
}
function updateLockUI() {
    const setBtn = (id, locked) => {
        const el = document.getElementById(id);
        el.classList.toggle('locked', locked);
        el.innerText = locked ? 'Locked' : 'Free';
    };
    setBtn('lockDownBtn', lockDown);
    setBtn('lockTermBtn', lockTerm);
    setBtn('lockHorBtn', lockHor);
    const summaryEl = document.getElementById('optModeLabel');
    if(summaryEl) {
        const locks = [];
        if(lockDown) locks.push('Down');
        if(lockTerm) locks.push('Term');
        if(lockHor) locks.push('Horizon');
        summaryEl.innerText = locks.length ? locks.join(' & ') : 'Free';
    }
}
function toggleLock(target) {
    if(target === 'down') lockDown = !lockDown;
    if(target === 'term') lockTerm = !lockTerm;
    if(target === 'hor') {
        // If currently auto and user wants to unlock, also switch to custom so slider is usable.
        if(horMode === 'auto' && lockHor) {
            horMode = 'custom';
            document.getElementById('pHor').children[0].classList.remove('active');
            document.getElementById('pHor').children[1].classList.add('active');
            document.getElementById('bHor').classList.add('show');
        }
        lockHor = !lockHor;
    }
    updateLockUI();
    runSim();
}
function updMeter() {
    let v = parseFloat(document.getElementById('sInf').value);
    let s = document.getElementById('infMeter').children;
    s[0].style.opacity = v<2 ? 1 : 0.2;
    s[1].style.opacity = (v>=2 && v<4) ? 1 : 0.2;
    s[2].style.opacity = v>=4 ? 1 : 0.2;
}

function fmt(v) {
    if(Math.abs(v)>=1000000) return (v/1000000).toFixed(2)+'M';
    if(Math.abs(v)>=1000) return (v/1000).toFixed(0)+'k';
    return v.toFixed(0);
}
function fmtVal(v) { return mode==='percent' ? v.toFixed(1)+'%' : fmt(v)+' ₪'; }

function calcPmt(p, rAnn, m) {
    if(p<=0.01) return 0;
    if(rAnn===0) return p/m;
    let r = rAnn/12;
    return p * (r * Math.pow(1+r, m)) / (Math.pow(1+r, m) - 1);
}

function checkMix() {
    let p = parseInt(document.getElementById('pctPrime').value)||0;
    let k = parseInt(document.getElementById('pctKalats').value)||0;
    let z = parseInt(document.getElementById('pctKatz').value)||0;
    let sum = p+k+z;
    let el = document.getElementById('valMixSum');
    el.innerText = sum + "%";
    el.style.color = sum===100 ? '#16a34a' : '#ef4444';
    runSim();
}

function syncPrime() {
    let base = parseFloat(document.getElementById('sInt').value);
    document.getElementById('ratePrime').value = (base + 1.5).toFixed(2);
    runSim();
}

// --- CORE ENGINE ---
function calcCAGR(eq, downPct, mortDur, simDur, useTax, tradeFee, merFee, exModeCalc, taxModeCalc, cfgCalc, overrides, useRentTax, mix, buyCostPct, maintPct, sellCostPct, drift) {
    let assetPrice = eq / downPct;
    let totalLoan = assetPrice - eq;
    let assetVal = assetPrice;

    // Initialize 3 Tracks
    let balP = totalLoan * (mix.prime/100);
    let balK = totalLoan * (mix.kalats/100);
    let balZ = totalLoan * (mix.katz/100);

    // Apply Buying Friction (Entry)
    let entryCosts = assetPrice * buyCostPct;
    let totalCashInvested = eq + entryCosts;

    let spUnits = 0;
    let spBasisLinked = totalCashInvested;
    let spBasisUSD = 0;
    let spValueHedged = totalCashInvested;
    let startEx = getH(H_EX,0);
    let currentEx = startEx;
    if(exModeCalc !== 'hedged') { spUnits = totalCashInvested / startEx; spBasisUSD = spUnits; }

    let loanMonths = mortDur * 12;
    let cpiIndex = 1.0;
    let taxThreshold = 5690;

    // FIX: Spread is always based on User Input vs User Base
    let spreadPrime = (overrides.RateP - overrides.Int);

    // Drift Setup
    let driftFactor = 1 + (drift / 100);
    let mDrift = Math.pow(driftFactor, 1/12) - 1;

    for(let y=0; y<simDur; y++) {
        let rSP = cfgCalc.SP.is ? getH(H_SP,y) : overrides.SP;
        let rApp = cfgCalc.App.is ? getH(H_RE,y) : overrides.App;
        let rInt = cfgCalc.Int.is ? (getH(H_BOI,y)+0.015) : overrides.Int;
        let rInf = cfgCalc.Inf.is ? getH(H_CPI,y) : overrides.Inf;
        let baseBoI = cfgCalc.Int.is ? getH(H_BOI,y) : overrides.Int;

        let ratePrime = baseBoI + spreadPrime;
        let rateKalats = overrides.RateK;
        let rateKatz = overrides.RateZ;

        let rYld = overrides.Yld;
        if(cfgCalc.Yld.is) rYld = 0.042 - ((y/20)*(0.042-0.028));

        let mSP = Math.pow(1 + rSP - merFee, 1/12) - 1;
        let mApp = Math.pow(1+rApp, 1/12) - 1;
        let mInf = Math.pow(1+rInf, 1/12) - 1;

        for(let m=0; m<12; m++) {
            let globalM = (y*12)+m;
            let monthsLeft = loanMonths - globalM;
            cpiIndex *= (1+mInf);
            assetVal *= (1+mApp);
            let taxLimit = taxThreshold * cpiIndex;

            // Apply Drift
            if(exModeCalc !== 'hist') {
                currentEx *= (1+mDrift);
            } else {
                currentEx = getH(H_EX, y);
            }

            // --- MORTGAGE PAYMENT ---
            let pmtP=0, pmtK=0, pmtZ=0;
            if(monthsLeft > 0) {
                if(balP > 10) {
                    pmtP = calcPmt(balP, ratePrime, monthsLeft);
                    let intP = balP * (ratePrime/12);
                    let princP = pmtP - intP;
                    if(princP>balP) { princP=balP; pmtP=balP+intP; }
                    balP -= princP;
                }
                if(balK > 10) {
                    pmtK = calcPmt(balK, rateKalats, monthsLeft);
                    let intK = balK * (rateKalats/12);
                    let princK = pmtK - intK;
                    if(princK>balK) { princK=balK; pmtK=balK+intK; }
                    balK -= princK;
                }
                if(balZ > 10) {
                    balZ *= (1+mInf);
                    pmtZ = calcPmt(balZ, rateKatz, monthsLeft);
                    let intZ = balZ * (rateKatz/12);
                    let princZ = pmtZ - intZ;
                    if(princZ>balZ) { princZ=balZ; pmtZ=balZ+intZ; }
                    balZ -= princZ;
                }
            } else { balP=0; balK=0; balZ=0; }

            let totalPmt = pmtP + pmtK + pmtZ;
            let grossRent = (assetVal * rYld) / 12;
            let rentTaxVal = 0;
            if(useRentTax && grossRent > taxLimit) rentTaxVal = grossRent * 0.10;

            let netRent = (grossRent * (1 - maintPct)) - rentTaxVal;

            let outOfPocket = totalPmt - netRent;
            if(outOfPocket > 0) { totalCashInvested += outOfPocket; }

            spBasisLinked *= (1+mInf);
            if(Math.abs(outOfPocket) > 0.01) {
                let netInject = outOfPocket;
                if(outOfPocket > 0) {
                    netInject = outOfPocket * (1 - tradeFee);
                    spBasisLinked += outOfPocket;
                    if(exModeCalc !== 'hedged') spBasisUSD += (outOfPocket / currentEx);
                } else { spBasisLinked += outOfPocket; }

                if(exModeCalc === 'hedged') spValueHedged += netInject;
                else spUnits += (netInject / currentEx);
            }
            if(exModeCalc === 'hedged') spValueHedged *= (1+mSP);
            else spUnits *= (1+mSP);
        }
    }

    let exitValue = assetVal * (1 - sellCostPct);
    let netRE = exitValue - (balP + balK + balZ);

    let cagr = (Math.pow(netRE / totalCashInvested, 1/simDur) - 1) * 100;
    return cagr;
}

function updateSweetSpots() {
    let eq = parseFloat(document.getElementById('inpEquity').value) || 400000;
    let curDown = parseInt(document.getElementById('rDown').value)/100;
    let curDur = parseInt(document.getElementById('rDur').value);
    let simDur = horMode === 'auto' ? curDur : parseInt(document.getElementById('rHor').value);
    let useTax = document.getElementById('cTax') ? document.getElementById('cTax').checked : false;
    let useRentTax = document.getElementById('cRentTax') ? document.getElementById('cRentTax').checked : false;
    let tradeFee = parseFloat(document.getElementById('rTrade').value)/100;
    let merFee = parseFloat(document.getElementById('rMer').value)/100;

    let buyCostPct = parseFloat(document.getElementById('rBuyCost').value)/100;
    let maintPct = parseFloat(document.getElementById('rMaint').value)/100;
    let sellCostPct = parseFloat(document.getElementById('rSellCost').value)/100;

    const cagrFn = window.__calcCagrOverride || calcCAGR;

    let overrides = {
        SP: parseFloat(document.getElementById('sSP').value)/100,
        App: parseFloat(document.getElementById('sApp').value)/100,
        Int: parseFloat(document.getElementById('sInt').value)/100,
        Inf: parseFloat(document.getElementById('sInf').value)/100,
        Yld: parseFloat(document.getElementById('sYld').value)/100,
        RateP: parseFloat(document.getElementById('ratePrime').value)/100,
        RateK: parseFloat(document.getElementById('rateKalats').value)/100,
        RateZ: parseFloat(document.getElementById('rateKatz').value)/100
    };

    let mix = {
        prime: parseFloat(document.getElementById('pctPrime').value),
        kalats: parseFloat(document.getElementById('pctKalats').value),
        katz: parseFloat(document.getElementById('pctKatz').value)
    };

    // Determine Drift
    let activeDrift = -0.5;
    if(document.getElementById('scenBear').classList.contains('active')) activeDrift = SCENARIOS.bear.drift;
    if(document.getElementById('scenBull').classList.contains('active')) activeDrift = SCENARIOS.bull.drift;

    // Build search grids based on optimizer mode
    const downVals = [];
    const downMin = 25;
    const downMax = 100;
    const termVals = [];
    const horVals = [];
    if(lockDown) downVals.push(curDown*100); else for(let d=downMin; d<=downMax; d+=5) downVals.push(d);
    if(lockTerm) termVals.push(curDur); else for(let t=10; t<=30; t+=1) termVals.push(t);
    if(lockHor || horMode==='auto') horVals.push(simDur); else for(let h=5; h<=50; h+=2) horVals.push(h);

    let best = { d: downVals[0], t: termVals[0], h: horVals[0], c: -Infinity };
    for(let d of downVals) {
        for(let t of termVals) {
            for(let h of horVals) {
                // respect auto/custom: if horMode auto, align sim horizon with term unless lockHor
                const simH = horMode === 'auto' ? t : h;
                let c = cagrFn(eq, d/100, t, simH, useTax, tradeFee, merFee, exMode, taxMode, cfg, overrides, useRentTax, mix, buyCostPct, maintPct, sellCostPct, activeDrift);
                if(c > best.c) best = { d, t, h: simH, c };
            }
        }
    }

    let posDown = ((best.d - downMin) / (downMax - downMin)) * 100;
    document.getElementById('spotDown').style.left = `${posDown}%`;
    document.getElementById('spotDown').classList.add('visible');

    let posDur = ((best.t - 10) / (30 - 10)) * 100;
    document.getElementById('spotDur').style.left = `${posDur}%`;
    document.getElementById('spotDur').classList.add('visible');

    if (horMode === 'custom' || lockHor) {
        let posHor = ((best.h - 5) / (50 - 5)) * 100;
        let spotH = document.getElementById('spotHor');
        spotH.style.left = `${posHor}%`;
        spotH.classList.add('visible');
        spotH.title = `Best CAGR at ${best.h} Years`;
    } else {
        document.getElementById('spotHor').classList.remove('visible');
    }
}


function runSim() {
    updateSweetSpots();

    let eq = parseFloat(document.getElementById('inpEquity').value) || 400000;
    let downPct = parseInt(document.getElementById('rDown').value)/100;
    let mortDur = parseInt(document.getElementById('rDur').value);
    let simDur = horMode === 'auto' ? mortDur : parseInt(document.getElementById('rHor').value);

    let useTax = document.getElementById('cTax')?.checked ?? true;
    let useRentTax = document.getElementById('cRentTax')?.checked ?? false;

    let tradeFee = parseFloat(document.getElementById('rTrade').value)/100;
    let merFee = parseFloat(document.getElementById('rMer').value)/100;

    let buyCostPct = parseFloat(document.getElementById('rBuyCost').value)/100;
    let maintPct = parseFloat(document.getElementById('rMaint').value)/100;
    let sellCostPct = parseFloat(document.getElementById('rSellCost').value)/100;

    document.getElementById('dDown').innerText = (downPct*100).toFixed(0)+'%';
    document.getElementById('dDur').innerText = mortDur+' Yr';
    document.getElementById('dHor').innerText = horMode === 'auto' ? 'Auto ('+mortDur+'Y)' : simDur+' Yr';
    document.getElementById('vTrade').innerText = (tradeFee*100).toFixed(1)+'%';
    document.getElementById('vMer').innerText = (merFee*100).toFixed(2)+'%';

    document.getElementById('vBuyCost').innerText = (buyCostPct*100).toFixed(1)+'%';
    document.getElementById('vMaint').innerText = (maintPct*100).toFixed(0)+'%';
    document.getElementById('vSellCost').innerText = (sellCostPct*100).toFixed(1)+'%';

    let assetPriceStart = eq / downPct;
    let lev = 1/downPct;
    document.getElementById('valAsset').innerText = fmt(assetPriceStart)+' ₪';
    document.getElementById('valLev').innerText = 'x'+lev.toFixed(1);
    document.getElementById('barLev').style.width = Math.min(((lev-1)/4)*100, 100) + '%';

    for(let k in cfg) {
        let el = document.getElementById(cfg[k].v);
        if(cfg[k].is) el.innerText='Hist'; else el.innerText=document.getElementById(cfg[k].s).value+'%';
    }

    // 2. MAIN LOGIC
    let entryCosts = assetPriceStart * buyCostPct;
    let totalLoan = assetPriceStart - eq;
    let totalCashInvested = eq + entryCosts;

    // Initialize Loan Tracks
    let mix = {
        prime: parseFloat(document.getElementById('pctPrime').value),
        kalats: parseFloat(document.getElementById('pctKalats').value),
        katz: parseFloat(document.getElementById('pctKatz').value)
    };

    let balP = totalLoan * (mix.prime/100);
    let balK = totalLoan * (mix.kalats/100);
    let balZ = totalLoan * (mix.katz/100);

    let assetVal = assetPriceStart;

    // S&P Setup
    let spUnits = 0;
    let spBasisLinked = totalCashInvested;
    let spBasisUSD = totalCashInvested;
    let spInvestedILS = totalCashInvested;
    let spValueHedged = totalCashInvested;

    let startEx = getH(H_EX,0);
    if(exMode === 'hedged') spValueHedged = totalCashInvested;
    else { spUnits = totalCashInvested / startEx; spBasisUSD = totalCashInvested / startEx; }

    let totalInterestWasted = 0;
    let totalRentCollected = 0;

    let labels=[], reDataPct=[], spDataPct=[], reDataVal=[], spDataVal=[];
    let flowMort=[], flowRent=[], flowNet=[], flowInt=[], flowPrinc=[];
    let loanMonths = mortDur * 12;
    let cpiIndex = 1.0;
    let finalNetRE = 0;
    let finalNetSP = 0;

    // Rates
    let rateP = parseFloat(document.getElementById('ratePrime').value)/100;
    let rateK = parseFloat(document.getElementById('rateKalats').value)/100;
    let rateZ = parseFloat(document.getElementById('rateKatz').value)/100;

    // Tax Threshold
    let taxThresholdBase = 5690;

    // Drift Logic
    let activeDrift = -0.5;
    if(document.getElementById('scenBear').classList.contains('active')) activeDrift = SCENARIOS.bear.drift;
    if(document.getElementById('scenBull').classList.contains('active')) activeDrift = SCENARIOS.bull.drift;

    let currentEx = startEx;
    let mDrift = Math.pow(1 + (activeDrift/100), 1/12) - 1;

    for(let y=0; y<simDur; y++) {
        // Factors
        let rSP = cfg.SP.is ? getH(H_SP,y) : parseFloat(document.getElementById('sSP').value)/100;
        let rApp = cfg.App.is ? getH(H_RE,y) : parseFloat(document.getElementById('sApp').value)/100;
        let rInt = cfg.Int.is ? (getH(H_BOI,y)+0.015) : parseFloat(document.getElementById('sInt').value)/100;
        let rInf = cfg.Inf.is ? getH(H_CPI,y) : parseFloat(document.getElementById('sInf').value)/100;
        let exRate = exMode==='hist' ? getH(H_EX,y) : 3.7;
        if(exMode === 'hist') exRate = getH(H_EX,y);

        let rYld = 0.032;
        if(cfg.Yld.is) rYld = 0.042 - ((y/20)*(0.042-0.028));
        else rYld = parseFloat(document.getElementById('sYld').value)/100;

        // Monthly Rates
        let mSP = Math.pow(1 + rSP - merFee, 1/12) - 1;
        let mApp = Math.pow(1+rApp, 1/12) - 1;
        let mInf = Math.pow(1+rInf, 1/12) - 1;

        // Accumulators
        let yrRent=0, yrNet=0, yrInt=0, yrPrinc=0;

        for(let m=0; m<12; m++) {
            let monthsLeft = loanMonths - (y*12 + m);
            cpiIndex *= (1+mInf);
            assetVal *= (1+mApp);
            let taxLimit = taxThresholdBase * cpiIndex;

            // Drift Ex
            if(exMode !== 'hist') currentEx *= (1+mDrift); else currentEx = exRate;

            // Mortgage Pmt
            let pmtTotal = 0;
            let intTotal = 0;
            let princTotal = 0;

            // Prime (Variable, Unlinked)
            if(balP > 10 && monthsLeft > 0) {
                let p = calcPmt(balP, rateP, monthsLeft);
                let i = balP * (rateP/12);
                let pr = p - i;
                if(pr>balP) { pr=balP; p=balP+i; }
                balP -= pr;
                pmtTotal += p;
                intTotal += i;
                princTotal += pr;
            }
            // Kalats (Fixed, Unlinked)
            if(balK > 10 && monthsLeft > 0) {
                let p = calcPmt(balK, rateK, monthsLeft);
                let i = balK * (rateK/12);
                let pr = p - i;
                if(pr>balK) { pr=balK; p=balK+i; }
                balK -= pr;
                pmtTotal += p;
                intTotal += i;
                princTotal += pr;
            }
            // Katz (Fixed, Linked)
            if(balZ > 10 && monthsLeft > 0) {
                balZ *= (1+mInf); // Linkage
                let p = calcPmt(balZ, rateZ, monthsLeft); // Recalc
                let i = balZ * (rateZ/12);
                let pr = p - i;
                if(pr>balZ) { pr=balZ; p=balZ+i; }
                balZ -= pr;
                pmtTotal += p;
                intTotal += i;
                princTotal += pr;
            }

            totalInterestWasted += intTotal;

            // Cashflow
            let grossRent = (assetVal * rYld) / 12;
            let rentTaxVal = 0;
            if(useRentTax && grossRent > taxLimit) rentTaxVal = grossRent * 0.10;
            let netRent = (grossRent * (1 - maintPct)) - rentTaxVal;

            totalRentCollected += netRent;
            let oop = pmtTotal - netRent;

            yrRent += netRent;
            yrInt += intTotal;
            yrPrinc += princTotal;
            yrNet += (netRent - pmtTotal);

            if(oop > 0) { spInvestedILS += oop; totalCashInvested += oop; }

            // S&P
            spBasisLinked *= (1+mInf);
            if(Math.abs(oop) > 0.01) {
                let netInject = oop;
                if(oop > 0) {
                    netInject = oop * (1 - tradeFee);
                    spBasisLinked += oop;
                    if(exMode !== 'hedged') spBasisUSD += (oop / currentEx);
                } else {
                    spBasisLinked += oop;
                }

                if(exMode === 'hedged') spValueHedged += netInject;
                else spUnits += (netInject / currentEx);
            }

            if(exMode === 'hedged') spValueHedged *= (1+mSP);
            else spUnits *= (1+mSP);

            if(m===11) {
                labels.push(y+1);
                flowRent.push( yrRent/12 );
                flowInt.push( (yrInt/12) * -1 );
                flowPrinc.push( (yrPrinc/12) * -1 );
                flowNet.push( yrNet/12 );

                let exitVal = assetVal * (1 - sellCostPct);
                let netRE = exitVal - (balP + balK + balZ);

                let spValILS = 0;
                if(exMode === 'hedged') spValILS = spValueHedged;
                else spValILS = spUnits * currentEx;

                let tax = 0;
                if(useTax) {
                    if(taxMode === 'real') {
                        let profit = spValILS - spBasisLinked;
                        if(profit > 0) tax = profit * 0.25;
                    } else {
                        // Nominal
                        if(exMode === 'hedged') {
                            let prof = spValILS - spInvestedILS;
                            if(prof > 0) tax = prof * 0.25;
                        } else {
                            let valUSD = spUnits;
                            let profUSD = valUSD - spBasisUSD;
                            if(profUSD > 0) tax = (profUSD * currentEx) * 0.25;
                        }
                    }
                }
                let finalSP = spValILS - tax;
                finalNetRE = netRE; finalNetSP = finalSP;

                reDataPct.push(((netRE-spInvestedILS)/spInvestedILS)*100);
                spDataPct.push(((finalSP-spInvestedILS)/spInvestedILS)*100);
                reDataVal.push(netRE);
                spDataVal.push(finalSP);
            }
        }
    }

    const lRE = reDataVal[reDataVal.length-1];
    const lSP = spDataVal[spDataVal.length-1];
    const diff = lRE - lSP;
    const winnerIsRE = diff >= 0;
    const base = winnerIsRE ? lSP : lRE;
    const diffAbs = Math.abs(diff);
    const diffPct = base !== 0 ? (diffAbs/base)*100 : 0;

    document.getElementById('kRE').innerText = fmtVal(mode === 'percent' ? reDataPct[reDataPct.length-1] : lRE);
    document.getElementById('kSP').innerText = fmtVal(mode === 'percent' ? spDataPct[spDataPct.length-1] : lSP);

    let reCagr = (Math.pow(finalNetRE / totalCashInvested, 1/simDur) - 1) * 100;
    document.getElementById('kRECagr').innerText = reCagr.toFixed(2) + '%';
    let spCagr = (Math.pow(finalNetSP / totalCashInvested, 1/simDur) - 1) * 100;
    document.getElementById('kSPCagr').innerText = spCagr.toFixed(2) + '%';

    let intPctOfAsset = (totalInterestWasted / assetPriceStart) * 100;
    document.getElementById('kInt').innerText = fmt(totalInterestWasted)+` ₪ (${intPctOfAsset.toFixed(0)+'%)'}`;
    document.getElementById('kRent').innerText = fmt(totalRentCollected)+' ₪';

    let dStr = diffPct.toFixed(1)+'%';
    document.getElementById('kDiff').innerText = dStr;
    document.getElementById('kDiff').style.color = winnerIsRE ? "var(--success)" : "var(--primary)";

    drawCharts(labels, reDataVal, reDataPct, spDataVal, spDataPct, flowRent, flowInt, flowPrinc, flowNet);
}

function drawCharts(l, rVal, rPct, sVal, sPct, fRent, fInt, fPrinc, fNet) {
    const ctx1 = document.getElementById('wealthChart').getContext('2d');
    if(wealthChart) wealthChart.destroy();

    let plotR = mode === 'percent' ? rPct : rVal;
    let plotS = mode === 'percent' ? sPct : sVal;
    let yTxt = mode==='percent' ? 'Cumulative ROI (%)' : 'Net Wealth (₪)';

    wealthChart = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: l,
            datasets: [
                { label: 'Real Estate', data: plotR, borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.05)', borderWidth: 3, fill: true, pointRadius: 0, pointHoverRadius: 6 },
                { label: 'S&P 500', data: plotS, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.05)', borderWidth: 3, fill: true, pointRadius: 0, pointHoverRadius: 6 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { tooltip: { callbacks: { label: c => {
                let idx = c.dataIndex;
                let val = 0, pct = 0;
                if(c.dataset.label === 'Real Estate') { val = rVal[idx]; pct = rPct[idx]; }
                else { val = sVal[idx]; pct = sPct[idx]; }
                return `${c.dataset.label}: ${fmt(val)} ₪ (${pct.toFixed(1)}%)`;
            }}}},
            scales: { y: { title: {display:true, text:yTxt}, ticks: { callback: v => mode==='percent'?v+'%':fmt(v) } } }
        }
    });

    const ctx2 = document.getElementById('flowChart').getContext('2d');
    if(flowChart) flowChart.destroy();

    flowChart = new Chart(ctx2, {
        data: {
            labels: l,
            datasets: [
                { type: 'line', label: 'Net Profit/Loss', data: fNet, borderColor: '#0f172a', borderWidth: 3, pointRadius: 2, tension: 0.3, order: 1 },
                { type: 'bar', label: 'Revenue (Rent)', data: fRent, backgroundColor: '#22c55e', stack: 'Stack 0', order: 2 },
                { type: 'bar', label: 'Interest (Cost)', data: fInt, backgroundColor: '#ef4444', stack: 'Stack 0', order: 3 },
                { type: 'bar', label: 'Principal (Equity)', data: fPrinc, backgroundColor: '#fca5a5', stack: 'Stack 0', order: 4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { tooltip: { callbacks: { label: c => {
                let v = Math.abs(c.raw);
                let lbl = c.dataset.label;
                if(lbl.includes('Interest')) {
                    let idx = c.dataIndex;
                    let iVal = Math.abs(c.chart.data.datasets[2].data[idx]);
                    let pVal = Math.abs(c.chart.data.datasets[3].data[idx]);
                    let total = iVal + pVal;
                    let pct = total > 0 ? ((iVal/total)*100).toFixed(0) : 0;
                    return `Interest: ${fmt(iVal)} (${pct}%)`;
                }
                if(lbl.includes('Principal')) return `Principal: ${fmt(v)}`;
                if(lbl.includes('Revenue')) return `Rent: ${fmt(v)}`;
                return `Net: ${fmt(c.raw)}`;
            }}}},
            scales: { y: { title: {display:true, text:'Monthly ₪'}, stacked: true }, x: { stacked: true } }
        }
    });
}

function bootstrap() {
    updMeter();
    updateLockUI();
    setMode('currency');
    runSim();
}

// Expose functions for inline handlers and tests
window.setMode = setMode;
window.tgl = tgl;
window.setGlobalMode = setGlobalMode;
window.applyScenario = applyScenario;
window.applyTamheel = applyTamheel;
window.tglHor = tglHor;
window.setTaxMode = setTaxMode;
window.updMeter = updMeter;
window.calcPmt = calcPmt;
window.checkMix = checkMix;
window.syncPrime = syncPrime;
window.calcCAGR = calcCAGR;
window.updateSweetSpots = updateSweetSpots;
window.runSim = runSim;
window.toggleLock = toggleLock;

document.addEventListener('DOMContentLoaded', bootstrap);
