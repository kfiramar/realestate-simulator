const AppLogic = window.Logic || {};

const SCENARIOS = {
    // Rates are BoI base; Prime will be base + 1.5%
    bear: { sp: 5.5, app: -1.0, int: 5.0, inf: 3.5, yld: 3.8, drift: 1.5 },
    base: { sp: 9.0, app: 3.5, int: 4.25, inf: 2.5, yld: 3.0, drift: 0.5 },
    bull: { sp: 10.5, app: 6.0, int: 2.0, inf: 1.8, yld: 2.8, drift: -0.5 }
};

const TAMHEEL_PROFILES = {
    // Percent mix only; rates are driven by BoI + credit tier matrix
    arbitrage: { p: 45, k: 55, z: 0 },
    shield: { p: 35, k: 65, z: 0 },
    investor: { p: 33, k: 27, z: 40 },
    defaultEven: { p: 33, k: 33, z: 34 }
};

// Underwriting matrix (tiers mapped from UI buckets)
const CREDIT_MATRIX = {
    A: { range: [850, 1000], spreadPrime: 1.15, spreadKalatz: 0.65, spreadKatz: -1.15, maxLTV: 0.75 },
    B: { range: [780, 849],  spreadPrime: 1.25, spreadKalatz: 0.85, spreadKatz: -0.95, maxLTV: 0.75 },
    C: { range: [720, 779],  spreadPrime: 1.45, spreadKalatz: 1.15, spreadKatz: -0.65, maxLTV: 0.70 },
    D: { range: [660, 719],  spreadPrime: 1.95, spreadKalatz: 1.60, spreadKatz: -0.15, maxLTV: 0.65 },
    F: { range: [0, 659],    spreadPrime: null, spreadKalatz: null, spreadKatz: null,  maxLTV: 0 }
};

// --- GLOBAL STATE ---
const LTV_MIN = { first: 25, replacement: 30, investor: 50 };
const cfg = {
    SP: {is:false, b:'bSP', s:'sSP', v:'vSP', p:'pSP'},
    App: {is:false, b:'bApp', s:'sApp', v:'vApp', p:'pApp'},
    Int: {is:false, b:'bInt', s:'sInt', v:'vInt', p:'pInt'},
    Yld: {is:false, b:'bYld', s:'sYld', v:'vYld', p:'pYld'},
    Inf: {is:false, b:'bInf', s:'sInf', v:'vInf', p:'pInf'}
};
const TERM_MIN = 10;
const TERM_MAX = 30;

let mode = 'percent';
let horMode = 'auto';
let advancedTermMode = false;
let lockDown = false;
let lockTerm = false;
let lockHor = true;
let buyerType = 'first';
let exMode = 'hedged'; // setEx removed as UI element removed, keeping exMode='hedged'
let taxMode = 'real';
let wealthChart = null;
let flowChart = null;
let creditScore = 900;
let currentTamheel = 'defaultEven';

function mapScoreToTierKey(score) {
    const s = score || 0;
    if (s >= 850) return 'A';
    if (s >= 780) return 'B';
    if (s >= 720) return 'C';
    if (s >= 660) return 'D';
    return 'F';
}

function getCreditTier(score) {
    const key = mapScoreToTierKey(score);
    const t = CREDIT_MATRIX[key];
    return { tier: key, ...t };
}

function applyLtvCaps() {
    const downSlider = document.getElementById('rDown');
    if (!downSlider) return;
    const tier = getCreditTier(creditScore);
    const buyerMinDown = LTV_MIN[buyerType] || 25; // regulatory min down
    if (tier.maxLTV === 0) return; // rejected state: no forced slider change

    const regCap = 1 - (buyerMinDown/100); // regulatory max LTV
    const tierCap = tier.maxLTV;           // credit-based max LTV
    const finalCap = Math.min(regCap, tierCap);
    const finalMinDown = 100 - (finalCap * 100);

    downSlider.min = finalMinDown;
    if (parseInt(downSlider.value, 10) < finalMinDown) {
        downSlider.value = finalMinDown;
    }
}

function updateCreditUI() {
    const scoreEl = document.getElementById('creditScoreVal');
    const tierEl = document.getElementById('creditTierLabel');
    const warnEl = document.getElementById('creditWarn');
    const tier = getCreditTier(creditScore);
    const step = 50;
    const lowRaw = creditScore;
    const highRaw = creditScore >= 950 ? 1000 : creditScore + step;
    const low = tier.maxLTV === 0 ? 660 : lowRaw;
    const high = tier.maxLTV === 0 ? 700 : highRaw;
    const displayScore = `${low}-${high}`;
    if (scoreEl) scoreEl.innerText = displayScore;
    if (tierEl) tierEl.innerText = `Risk Tier: ${tier.tier}`;
    if (warnEl) warnEl.style.display = tier.maxLTV === 0 ? 'block' : 'none';
}

function applyTamheel(type) {
    const t = TAMHEEL_PROFILES[type];
    // Only adjust mix percentages; rates are driven by base rate + credit tier anchors
    document.getElementById('pctPrime').value = t.p;
    document.getElementById('pctKalats').value = t.k;
    document.getElementById('pctKatz').value = t.z;
    checkMix();
}
function refreshRatesForProfile() {
    // Rates follow unified anchors (BoI + tier spreads), independent of Tamheel mix selection
    const tier = getCreditTier(creditScore);
    const base = parseFloat(document.getElementById('sInt').value) || 4.25;
    const primeEl = document.getElementById('ratePrime');
    const kalatsEl = document.getElementById('rateKalats');
    const katzEl = document.getElementById('rateKatz');
    const spreadP = tier.spreadPrime;
    const spreadK = tier.spreadKalatz;
    const spreadZ = tier.spreadKatz;
    if (primeEl && spreadP !== null) primeEl.value = (base + spreadP).toFixed(2);
    if (kalatsEl && spreadK !== null) kalatsEl.value = (base + spreadK).toFixed(2);
    if (katzEl && spreadZ !== null) katzEl.value = (base + spreadZ).toFixed(2);
}
function setCreditScore(v) {
    creditScore = parseInt(v, 10) || creditScore;
    updateCreditUI();
    applyLtvCaps();
    refreshRatesForProfile();
    runSim();
}
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
    pills[0].classList.toggle('active', h);
    pills[1].classList.toggle('active', !h);
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

    refreshRatesForProfile(); // Rates follow base + spread + credit tier
    updMeter();
    runSim();
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
    // Skip chart re-render; locks influence optimizer but shouldn't redraw graphs immediately
    runSim({ skipCharts: true });
}

function setBuyerType(type) {
    buyerType = type;
    applyLtvCaps();
    runSim();
}

function recommendMix() {
    const baseRate = parseFloat(document.getElementById('sInt').value) || 4.25;
    const cpi = parseFloat(document.getElementById('sInf').value) || 2.5;
    if(baseRate >= 4.5 || cpi >= 3.5) applyTamheel('shield');
    else if(baseRate >= 3.0 || cpi >= 2.5) applyTamheel('arbitrage');
    else applyTamheel('investor');
}

function showTermVal(elId, v) {
    const el = document.getElementById(elId);
    if(el) el.innerText = `${v}y`;
}

function syncTrackTermsToMain() {
    const dur = document.getElementById('rDur').value;
    document.getElementById('termPrime').value = dur;
    document.getElementById('termKalats').value = dur;
    document.getElementById('termKatz').value = dur;
    showTermVal('termPrimeVal', dur);
    showTermVal('termKalatsVal', dur);
    showTermVal('termKatzVal', dur);
}

function toggleAdvancedTerms() {
    advancedTermMode = !advancedTermMode;
    const advBox = document.getElementById('advancedTermBox');
    const basicBox = document.getElementById('basicTermBox');
    const btn = document.getElementById('btnAdvancedTerm');
    if(advancedTermMode) {
        advBox.style.display = 'block';
        basicBox.style.display = 'none';
        btn.classList.add('active');
        syncTrackTermsToMain();
    } else {
        advBox.style.display = 'none';
        basicBox.style.display = 'block';
        btn.classList.remove('active');
        syncTrackTermsToMain();
    }
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
function fmtNum(v) { return v.toLocaleString('en-US', {maximumFractionDigits:0}); }
function fmtVal(v) { return mode==='percent' ? v.toFixed(1)+'%' : fmt(v)+' ₪'; }

function updateTrackTermEnabled() {
    const primePct = parseFloat(document.getElementById('pctPrime').value) || 0;
    const kalatsPct = parseFloat(document.getElementById('pctKalats').value) || 0;
    const katzPct = parseFloat(document.getElementById('pctKatz').value) || 0;

    const setDisabled = (id, isDisabled) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.disabled = isDisabled;
    };

    setDisabled('termPrime', primePct <= 0);
    setDisabled('termKalats', kalatsPct <= 0);
    setDisabled('termKatz', katzPct <= 0);
}

function checkMix() {
    let p = parseInt(document.getElementById('pctPrime').value)||0;
    let k = parseInt(document.getElementById('pctKalats').value)||0;
    let z = parseInt(document.getElementById('pctKatz').value)||0;
    let sum = p+k+z;
    let el = document.getElementById('valMixSum');
    el.innerText = sum + "%";
    el.style.display = sum===100 ? 'none' : 'block';
    el.style.color = sum===100 ? '#16a34a' : '#ef4444';
    const warnEl = document.getElementById('mixWarn');
    if(warnEl) {
        warnEl.style.display = sum===100 ? 'none' : 'block';
    }
    const charts = document.getElementById('chartsContainer');
    const chartsWarn = document.getElementById('chartsWarn');
    const dimCharts = sum !== 100;
    if(charts) charts.classList.toggle('charts-dim', dimCharts);
    if(chartsWarn) chartsWarn.style.display = dimCharts ? 'block' : 'none';
    updateTrackTermEnabled();
    runSim();
}

function syncPrime() {
    let base = parseFloat(document.getElementById('sInt').value);
    refreshRatesForProfile();
    runSim();
}

// Global Surplus Mode State
let surplusMode = 'invest'; 

function setSurplusMode(m) {
    surplusMode = m;
    
    // Update UI
    document.getElementById('surplusConsume').classList.toggle('active', m==='consume');
    document.getElementById('surplusMatch').classList.toggle('active', m==='match');
    document.getElementById('surplusInvest').classList.toggle('active', m==='invest');
    
    // Update Description
    const descEl = document.getElementById('surplusDescText') || document.getElementById('surplusDesc');
    if (descEl) {
        if(m === 'invest') descEl.innerText = "Buy S&P (reinvests rent surplus into S&P 500)";
        else if(m === 'consume') descEl.innerText = "Keeps rent surplus as cash (Uninvested)";
        else if(m === 'match') descEl.innerText = "Sells S&P 500 to match rent surplus cashflow";
    }
    
    runSim();
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

    const best = AppLogic.searchSweetSpots({
        eq,
        curDown,
        curDur,
        simDur,
        useTax,
        useRentTax,
        tradeFee,
        merFee,
        buyCostPct,
        maintPct,
        sellCostPct,
        overrides,
        mix,
        drift: activeDrift,
        lockDown,
        lockTerm,
        lockHor,
        horMode,
        cfg,
        exMode,
        taxMode,
        calcOverride: window.__calcCagrOverride || undefined,
        surplusMode
    });

    const downMin = 25;
    const downMax = 100;

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


function runSim(opts = {}) {
    const skipCharts = !!opts.skipCharts;

    let eq = parseFloat(document.getElementById('inpEquity').value) || 400000;
    let downPct = parseInt(document.getElementById('rDown').value)/100;
    const mainTermSlider = document.getElementById('rDur');
    let mortDur = parseInt(mainTermSlider.value);
    let simDur = horMode === 'auto' ? mortDur : parseInt(document.getElementById('rHor').value);

    let useTax = document.getElementById('cTax')?.checked ?? true;
    let useRentTax = document.getElementById('cRentTax')?.checked ?? false;

    let tradeFee = parseFloat(document.getElementById('rTrade').value)/100;
    let merFee = parseFloat(document.getElementById('rMer').value)/100;

    let buyCostPct = parseFloat(document.getElementById('rBuyCost').value)/100;
    let maintPct = parseFloat(document.getElementById('rMaint').value)/100;
    let sellCostPct = parseFloat(document.getElementById('rSellCost').value)/100;
    
    // Logic Update: Use Global State
    const useSPWithdrawal = (surplusMode === 'match');
    const autoInvestSurplus = (surplusMode === 'invest');

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
    let posCFEl = document.getElementById('valPosCF');
    if (posCFEl) posCFEl.innerText = '--';
    // Credit/LTV feasibility warning
    const tierNow = getCreditTier(creditScore);
    const warnEl = document.getElementById('creditWarn');
    if (warnEl) {
        if (tierNow.maxLTV === 0) {
            warnEl.style.display = 'block';
            warnEl.innerText = 'Application rejected: score below 660';
        } else {
            const buyerMinDown = LTV_MIN[buyerType] || 25;
            const regCap = 1 - (buyerMinDown/100);
            const finalCap = Math.min(regCap, tierNow.maxLTV);
            const needDown = 100 - (finalCap*100);
            if ((downPct*100) < needDown) {
                warnEl.style.display = 'block';
                warnEl.innerText = `Max LTV ${(finalCap*100).toFixed(0)}% → increase down to at least ${needDown.toFixed(0)}%`;
            } else {
                warnEl.style.display = 'none';
            }
        }
    }
    
    let initialLoan = assetPriceStart - eq;
    const valMortgageEl = document.getElementById('valMortgage');
    if (valMortgageEl) valMortgageEl.innerText = fmt(initialLoan)+' ₪';

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

    // RE Side Stock Portfolio (The Fix)
    let reSideStockValue = 0;
    let reSideStockBasis = 0;

    let startEx = AppLogic.getH(AppLogic.H_EX,0);
    if(exMode === 'hedged') spValueHedged = totalCashInvested;
    else { spUnits = totalCashInvested / startEx; spBasisUSD = totalCashInvested / startEx; }

    let totalInterestWasted = 0;
    let totalRentCollected = 0;
    let firstPosMonth = null;

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
    const clampTerm = v => Math.max(TERM_MIN, Math.min(TERM_MAX, v));
    let termPYears = clampTerm(parseInt(document.getElementById('termPrime').value) || mortDur);
    let termKYears = clampTerm(parseInt(document.getElementById('termKalats').value) || mortDur);
    let termZYears = clampTerm(parseInt(document.getElementById('termKatz').value) || mortDur);

    if(!advancedTermMode) {
        termPYears = termKYears = termZYears = clampTerm(mortDur);
        document.getElementById('termPrime').value = termPYears;
        document.getElementById('termKalats').value = termKYears;
        document.getElementById('termKatz').value = termZYears;
        showTermVal('termPrimeVal', termPYears);
        showTermVal('termKalatsVal', termKYears);
        showTermVal('termKatzVal', termZYears);
    } else {
        document.getElementById('termPrime').value = termPYears;
        document.getElementById('termKalats').value = termKYears;
        document.getElementById('termKatz').value = termZYears;
    }

    let termPMonths = termPYears * 12;
    let termKMonths = termKYears * 12;
    let termZMonths = termZYears * 12;

    const activeTerms = [];
    if ((mix.prime || 0) > 0) activeTerms.push(termPYears);
    if ((mix.kalats || 0) > 0) activeTerms.push(termKYears);
    if ((mix.katz || 0) > 0) activeTerms.push(termZYears);
    if (activeTerms.length === 0) activeTerms.push(mortDur);

    const maxTrackYears = Math.max(...activeTerms);
    if (advancedTermMode) {
        mortDur = maxTrackYears;
        mainTermSlider.value = mortDur;
        document.getElementById('dDur').innerText = mortDur + ' Yr';
        document.getElementById('spotDur').style.left = ((mortDur - 10)/(30-10))*100 + '%';
    }

    const effectiveMax = Math.max(maxTrackYears, mortDur);
    if (horMode === 'auto') {
        document.getElementById('rHor').value = effectiveMax;
        document.getElementById('dHor').innerText = 'Auto ('+effectiveMax+'Y)';
        simDur = effectiveMax;
    }

    updateSweetSpots();

    let taxThresholdBase = 5654;

    let activeDrift = -0.5;
    if(document.getElementById('scenBear').classList.contains('active')) activeDrift = SCENARIOS.bear.drift;
    if(document.getElementById('scenBull').classList.contains('active')) activeDrift = SCENARIOS.bull.drift;

    let currentEx = startEx;
    let mDrift = Math.pow(1 + (activeDrift/100), 1/12) - 1;
    
    // Track status for UI
    let isCashflowPositive = false;

    for(let y=0; y<simDur; y++) {
        // ... (existing loop setup) ...
        let rSP = cfg.SP.is ? AppLogic.getH(AppLogic.H_SP,y) : parseFloat(document.getElementById('sSP').value)/100;
        let rApp = cfg.App.is ? AppLogic.getH(AppLogic.H_RE,y) : parseFloat(document.getElementById('sApp').value)/100;
        let rInt = cfg.Int.is ? (AppLogic.getH(AppLogic.H_BOI,y)+0.015) : parseFloat(document.getElementById('sInt').value)/100;
        let rInf = cfg.Inf.is ? AppLogic.getH(AppLogic.H_CPI,y) : parseFloat(document.getElementById('sInf').value)/100;
        let exRate = exMode==='hist' ? AppLogic.getH(AppLogic.H_EX,y) : 3.7;
        if(exMode === 'hist') exRate = AppLogic.getH(AppLogic.H_EX,y);

        let rYld = 0.032;
        if(cfg.Yld.is) rYld = 0.042 - ((y/20)*(0.042-0.028));
        else rYld = parseFloat(document.getElementById('sYld').value)/100;

        let mSP = Math.pow(1 + rSP - merFee, 1/12) - 1;
        let mApp = Math.pow(1+rApp, 1/12) - 1;
        let mInf = Math.pow(1+rInf, 1/12) - 1;

        let yrRent=0, yrNet=0, yrInt=0, yrPrinc=0;

        for(let m=0; m<12; m++) {
            // ... (existing inner loop code) ...
            cpiIndex *= (1+mInf);
            assetVal *= (1+mApp);
            let taxLimit = taxThresholdBase * cpiIndex;

            if(exMode !== 'hist') currentEx *= (1+mDrift); else currentEx = exRate;

            let pmtTotal = 0;
            let intTotal = 0;
            let princTotal = 0;

            let monthsLeftP = termPMonths - (y*12 + m);
            let monthsLeftK = termKMonths - (y*12 + m);
            let monthsLeftZ = termZMonths - (y*12 + m);

            if(balP > 10 && monthsLeftP > 0) {
                let p = AppLogic.calcPmt(balP, rateP, monthsLeftP);
                let i = balP * (rateP/12);
                let pr = p - i;
                if(pr>balP) { pr=balP; p=balP+i; }
                balP -= pr;
                pmtTotal += p;
                intTotal += i;
                princTotal += pr;
            }
            if(balK > 10 && monthsLeftK > 0) {
                let p = AppLogic.calcPmt(balK, rateK, monthsLeftK);
                let i = balK * (rateK/12);
                let pr = p - i;
                if(pr>balK) { pr=balK; p=balK+i; }
                balK -= pr;
                pmtTotal += p;
                intTotal += i;
                princTotal += pr;
            }
            if(balZ > 10 && monthsLeftZ > 0) {
                balZ *= (1+mInf);
                let p = AppLogic.calcPmt(balZ, rateZ, monthsLeftZ);
                let i = balZ * (rateZ/12);
                let pr = p - i;
                if(pr>balZ) { pr=balZ; p=balZ+i; }
                balZ -= pr;
                pmtTotal += p;
                intTotal += i;
                princTotal += pr;
            }

            totalInterestWasted += intTotal;

            let grossRent = (assetVal * rYld) / 12;
            let rentTaxVal = 0;
            if(useRentTax && grossRent > taxLimit) rentTaxVal = grossRent * 0.10;
            let netRent = (grossRent * (1 - maintPct)) - rentTaxVal;

            totalRentCollected += netRent;
            let oop = pmtTotal - netRent;
            
            // Check Initial Status
            if (y===0 && m===0) {
                isCashflowPositive = oop < 0;
                const pillsEl = document.getElementById('surplusPills');
                
                // Update Start Cashflow Metric
                const startCF = -oop;
                const cfEl = document.getElementById('valCashflow');
                if(cfEl) {
                    cfEl.innerText = (startCF >= 0 ? '+' : '') + fmtNum(startCF) + ' ₪';
                    cfEl.style.color = startCF >= 0 ? '#16a34a' : '#ef4444';
                }
                
                // Always enable pills so user can plan for future surplus
                if (pillsEl) {
                    pillsEl.style.opacity = "1";
                    pillsEl.style.pointerEvents = "auto";
                }
            }

            yrRent += netRent;
            yrInt += intTotal;
            yrPrinc += princTotal;
            yrNet += (netRent - pmtTotal);

            if(oop > 0) { spInvestedILS += oop; totalCashInvested += oop; }

            spBasisLinked *= (1+mInf);
            
            // --- SURPLUS / S&P LOGIC ---
            
            // 1. Handle Surplus (oop < 0)
            if (oop < 0) {
                const surplus = Math.abs(oop);
                
                if (autoInvestSurplus) {
                    // THE FIX: Invest in RE-Side Stock Portfolio
                    // RE Investor keeps cash, pays trade fee, buys S&P
                    const netInvest = surplus * (1 - tradeFee);
                    reSideStockValue += netInvest;
                    reSideStockBasis += netInvest;
                    // Note: We DO NOT reduce 'spBasisLinked' here because RE investor 'consumed' the cash (into stock)
                    // S&P investor must still 'spend' equivalent cash to match lifestyle?
                    // NO. If RE investor BUYS STOCK, that is SAVINGS.
                    // S&P investor should also SAVE that amount.
                    // So if oop < 0 (Surplus), both sides effectively save it.
                    // But since the S&P side *is* the Savings account, it stays in the S&P.
                    // The logic for S&P side: It naturally keeps its capital if we don't withdraw.
                    
                    // Current logic below handles S&P side:
                    // If oop < 0, and useSPWithdrawal=false... S&P side keeps the money.
                    // So we just need to make sure RE side *also* gets the asset.
                    
                    // reset oop to 0 for the "Matching" logic below, so we don't trigger basis reduction
                    // oop = 0; 
                    // Actually, if we don't touch oop, the block below "if(oop < 0)" handles basis.
                    // If we invest surplus, we act as if we consumed it? No.
                    // We treat it as accumulation.
                    
                } else if (useSPWithdrawal) {
                    // Sell S&P to match consumption
                    const grossTarget = surplus / (1 - tradeFee);
                    if(exMode === 'hedged') {
                        const used = Math.min(spValueHedged, grossTarget);
                        spValueHedged -= used;
                        spBasisLinked = Math.max(0, spBasisLinked - used);
                        spInvestedILS = Math.max(0, spInvestedILS - used);
                    } else {
                        const availableILS = spUnits * currentEx;
                        const usedILS = Math.min(availableILS, grossTarget);
                        const unitsSold = usedILS / currentEx;
                        spUnits -= unitsSold;
                        spBasisUSD = Math.max(0, spBasisUSD - unitsSold);
                        spBasisLinked = Math.max(0, spBasisLinked - usedILS);
                    }
                } else {
                    // Default: Consume surplus (Sushi). S&P side doesn't sell, but basis tracks it?
                    // Original logic: spBasisLinked += oop (negative).
                    spBasisLinked += oop;
                }
            }

            // 2. Handle Deficit (oop > 0)
            if (oop > 0) {
                let netInject = oop * (1 - tradeFee);
                spBasisLinked += oop;
                if(exMode !== 'hedged') spBasisUSD += (oop / currentEx);
                if(exMode === 'hedged') spValueHedged += netInject;
                else spUnits += (netInject / currentEx);
            }
            
            // 3. Grow Portfolios
            if(exMode === 'hedged') spValueHedged *= (1+mSP);
            else spUnits *= (1+mSP);
            
            reSideStockValue *= (1+mSP);

            if(firstPosMonth === null && oop < 0) {
                firstPosMonth = (y*12) + m;
            }

            if(m===11) {
                labels.push(y+1);
                flowRent.push( yrRent/12 );
                flowInt.push( (yrInt/12) * -1 );
                flowPrinc.push( (yrPrinc/12) * -1 );
                flowNet.push( yrNet/12 );

                let exitVal = assetVal * (1 - sellCostPct);
                
                // Tax on RE Side Stock
                let reSideTax = 0;
                if(useTax && reSideStockValue > reSideStockBasis) {
                    reSideTax = (reSideStockValue - reSideStockBasis) * 0.25;
                }
                
                let netRE = (exitVal - (balP + balK + balZ)) + (reSideStockValue - reSideTax);

                let spValILS = 0;
                if(exMode === 'hedged') spValILS = spValueHedged;
                else spValILS = spUnits * currentEx;

                let tax = 0;
                if(useTax) {
                    if(taxMode === 'real') {
                        let profit = spValILS - spBasisLinked;
                        if(profit > 0) tax = profit * 0.25;
                    } else {
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

    const posYears = firstPosMonth === null ? null : (firstPosMonth/12);
    const posTxt = firstPosMonth === null ? 'Never' : posYears.toFixed(1) + 'y';
    const posCFElFinal = document.getElementById('valPosCF');
    if (posCFElFinal) posCFElFinal.innerText = posTxt;

    if(!skipCharts) {
        if(typeof window !== 'undefined') {
            window.__lastSim = {
                spValueHedged,
                spUnits,
                spBasisLinked,
                spBasisUSD,
                flowNet: flowNet[flowNet.length-1],
                finalNetRE: lRE,
                finalNetSP: lSP,
                remainingLoan: balP + balK + balZ,
                reSideStockValue, // For test verification
                posCFYears: posYears
            };
        }
        drawCharts(labels, reDataVal, reDataPct, spDataVal, spDataPct, flowRent, flowInt, flowPrinc, flowNet);
    }
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
                { type: 'line', label: 'Net Cashflow', data: fNet, borderColor: '#0f172a', borderWidth: 4, pointRadius: 3, tension: 0.3, order: 1, fill: false },
                { type: 'bar', label: 'Revenue (Rent)', data: fRent, backgroundColor: '#22c55e', stack: 'Stack 0', order: 3, borderWidth: 0 },
                { type: 'bar', label: 'Interest (Cost)', data: fInt, backgroundColor: '#ef4444', stack: 'Stack 0', order: 4, borderWidth: 0 },
                { type: 'bar', label: 'Principal (Equity)', data: fPrinc, backgroundColor: '#fca5a5', stack: 'Stack 0', order: 5, borderWidth: 0 }
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
                    return `Interest: ${fmtNum(iVal)} (${pct}%)`;
                }
                if(lbl.includes('Principal')) return `Principal: ${fmtNum(v)}`;
                if(lbl.includes('Revenue')) return `Rent: ${fmtNum(v)}`;
                return `Net: ${fmtNum(c.raw)}`;
            }}}},
            scales: { y: { title: {display:true, text:'Monthly ₪'}, stacked: true }, x: { stacked: true } }
        }
    });
}

function bootstrap() {
    updMeter();
    updateLockUI();
    updateCreditUI();
    applyLtvCaps();
    refreshRatesForProfile();
    // Ensure we start on Fixed rates with scenarios visible
    setGlobalMode(false);
    applyScenario('base');
    setMode('currency');
    checkMix(); // initialize mix UI state (hide sum if 100%)
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
window.checkMix = checkMix;
window.syncPrime = syncPrime;
window.calcPmt = AppLogic.calcPmt;
window.calcCAGR = AppLogic.calcCAGR;
window.updateSweetSpots = updateSweetSpots;
window.runSim = runSim;
window.setCreditScore = setCreditScore;
window.toggleLock = toggleLock;
window.setBuyerType = setBuyerType;
window.recommendMix = recommendMix;
window.syncTrackTermsToMain = syncTrackTermsToMain;
window.showTermVal = showTermVal;
window.toggleAdvancedTerms = toggleAdvancedTerms;
window.setSurplusMode = setSurplusMode;

document.addEventListener('DOMContentLoaded', bootstrap);
