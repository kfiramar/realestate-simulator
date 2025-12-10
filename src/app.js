const AppLogic = window.Logic || {};

const SCENARIOS = {
    // Based on CBS official data (2018-2024 district indices, 2023 rent tables)
    // RE appreciation: ~5-6% nominal, Rent yield: ~2.5-3% gross, S&P: ~7-10% nominal
    bear: { sp: 7.0, app: 3.0, int: 5.0, inf: 3.5, yld: 2.5, drift: 1.0 },
    base: { sp: 9.5, app: 5.0, int: 4.25, inf: 2.5, yld: 2.8, drift: 0.5 },
    bull: { sp: 10.0, app: 7.0, int: 3.0, inf: 2.0, yld: 3.0, drift: -0.5 }
};

const TAMHEEL_PROFILES = {
    // Mix percentages only. Rates are driven by Credit Score + Base Rate.
    arbitrage: { p: 45, k: 55, z: 0, m: 0, mt: 0 },
    shield: { p: 35, k: 65, z: 0, m: 0, mt: 0 },
    investor: { p: 33, k: 27, z: 40, m: 0, mt: 0 },
    defaultEven: { p: 33, k: 33, z: 34, m: 0, mt: 0 }
};

// Base Spreads (Anchors) relative to BoI rate
// Oct 2025 BoI averages: Prime 5.36%, Kalatz 4.81%, Katz 3.20%, Matz 3.44%, Malatz 4.76%
// BoI rate: 4.25%, Prime: 5.75%
// CPI-Linked: Katz, Matz | Non-Linked: Prime, Kalatz, Malatz
const ANCHORS = {
    prime: 1.50,    // Prime = BoI + 1.5% (fixed by law), then subtract discount
    kalats: 0.56,   // Fixed, Non-Linked: ~4.81% avg
    malatz: 0.51,   // Var 5yr, Non-Linked: ~4.76% avg
    katz: -1.05,    // Fixed, CPI-Linked: ~3.20% real avg
    matz: -0.81     // Var 5yr, CPI-Linked: ~3.44% real avg
};

// Risk Premiums by credit tier (added to BoI + Anchor)
// Banks price P-0.32% to P-0.95%; ~0.10-0.60% swing by credit tier
const CREDIT_MATRIX = {
    A: { range: [950, 1000], riskP: -0.95, riskK: -0.20, riskM: -0.15, riskZ: -0.15, maxLTV: 0.75 }, // Elite: P-0.95
    B: { range: [900, 949], riskP: -0.60, riskK: -0.10, riskM: -0.05, riskZ: -0.05, maxLTV: 0.75 },  // Premium: P-0.60
    C: { range: [850, 899], riskP: -0.40, riskK: 0.00, riskM: 0.05, riskZ: 0.05, maxLTV: 0.75 },     // Very Good: P-0.40
    D: { range: [800, 849], riskP: -0.32, riskK: 0.10, riskM: 0.15, riskZ: 0.15, maxLTV: 0.75 },     // Good: P-0.32
    E: { range: [750, 799], riskP: -0.10, riskK: 0.30, riskM: 0.30, riskZ: 0.30, maxLTV: 0.70 },     // Average
    F: { range: [700, 749], riskP: 0.15, riskK: 0.50, riskM: 0.45, riskZ: 0.45, maxLTV: 0.65 },      // Below Avg
    G: { range: [660, 699], riskP: 0.40, riskK: 0.80, riskM: 0.70, riskZ: 0.70, maxLTV: 0.60 },      // Poor
    H: { range: [0, 659], riskP: null, riskK: null, riskM: null, riskZ: null, maxLTV: 0 }            // Reject
};

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
let buyerType = 'first';
let advancedTermMode = false;
let creditScore = 900;
let surplusMode = 'match';
let repayMethod = 'spitzer';

const TERM_MIN = 1;
const TERM_MAX = 30;

const LTV_MIN = {
    first: 25,
    replacement: 30,
    investor: 50
};

const cfg = {
    SP: { is: false, b: 'bSP', s: 'sSP', v: 'vSP', p: 'pSP' },
    App: { is: false, b: 'bApp', s: 'sApp', v: 'vApp', p: 'pApp' },
    Int: { is: false, b: 'bInt', s: 'sInt', v: 'vInt', p: 'pInt' },
    Yld: { is: false, b: 'bYld', s: 'sYld', v: 'vYld', p: 'pYld' },
    Inf: { is: false, b: 'bInf', s: 'sInf', v: 'vInf', p: 'pInf' }
};

// --- UI FUNCTIONS ---
function setMode(m) {
    mode = m;
    document.getElementById('btnCurr').classList.toggle('active', m === 'currency');
    document.getElementById('btnPct').classList.toggle('active', m === 'percent');
    document.getElementById('equityBox').classList.toggle('show', m === 'currency');
    runSim();
}
function tgl(k, h) {
    cfg[k].is = h;
    const pills = document.getElementById(cfg[k].p).children;
    pills[0].classList.toggle('active', h); pills[1].classList.toggle('active', !h);
    document.getElementById(cfg[k].b).classList.toggle('show', !h);
    if (k === 'Inf') updMeter();
    runSim();
}
function setGlobalMode(isHist) {
    const globalPills = document.getElementById('pGlobal').children;
    globalPills[0].classList.toggle('active', isHist);
    globalPills[1].classList.toggle('active', !isHist);
    document.getElementById('scenBox').classList.toggle('show', !isHist);
    for (let k in cfg) { tgl(k, isHist); }
}
function applyScenario(type, opts = {}) {
    const s = SCENARIOS[type];
    document.getElementById('sSP').value = s.sp;
    document.getElementById('sApp').value = s.app;
    document.getElementById('sInt').value = s.int;
    document.getElementById('sInf').value = s.inf;
    document.getElementById('sYld').value = s.yld;

    document.getElementById('scenBear').classList.toggle('active', type === 'bear');
    document.getElementById('scenBase').classList.toggle('active', type === 'base');
    document.getElementById('scenBull').classList.toggle('active', type === 'bull');

    refreshRatesForProfile();
    updateCreditUI();
    applyLtvCaps();
    updMeter();
    if (!opts.skipSim) runSim();
}

function applyTamheel(type) {
    const t = TAMHEEL_PROFILES[type];
    document.getElementById('pctPrime').value = t.p;
    document.getElementById('pctKalats').value = t.k;
    document.getElementById('pctKatz').value = t.z;
    document.getElementById('pctMalatz').value = t.m || 0;
    document.getElementById('pctMatz').value = t.mt || 0;
    checkMix();
}

function mapScoreToTierKey(score) {
    const s = score || 0;
    if (s >= 950) return 'A';
    if (s >= 900) return 'B';
    if (s >= 850) return 'C';
    if (s >= 800) return 'D';
    if (s >= 750) return 'E';
    if (s >= 700) return 'F';
    if (s >= 660) return 'G';
    return 'H';
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
    const buyerMinDown = LTV_MIN[buyerType] || 25;
    if (tier.maxLTV === 0) return;

    const regCap = 1 - (buyerMinDown / 100);
    const tierCap = tier.maxLTV;
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
    const displayScore = tier.range[0] + '-' + tier.range[1];

    if (scoreEl) scoreEl.innerText = displayScore;
    if (tierEl) tierEl.innerText = `Risk Tier: ${tier.tier}`;
    if (warnEl) {
        warnEl.style.display = tier.maxLTV === 0 ? 'block' : 'none';
        if (tier.maxLTV === 0) warnEl.innerText = 'Application rejected: score below 660';
    }
}

function refreshRatesForProfile() {
    const tier = getCreditTier(parseInt(creditScore, 10));
    const base = parseFloat(document.getElementById('sInt').value) || 4.25;

    const setVal = (id, anchor, risk) => {
        const el = document.getElementById(id);
        if (el && risk !== null) {
            el.value = Math.max(0.1, base + anchor + risk).toFixed(2);
        }
    };

    setVal('ratePrime', ANCHORS.prime, tier.riskP);
    setVal('rateKalats', ANCHORS.kalats, tier.riskK);
    setVal('rateMalatz', ANCHORS.malatz, tier.riskK); // Malatz non-linked, same risk as Kalats
    setVal('rateKatz', ANCHORS.katz, tier.riskZ);
    setVal('rateMatz', ANCHORS.matz, tier.riskZ); // Matz CPI-linked, same risk as Katz
}

function setCreditScore(v) {
    creditScore = parseInt(v, 10) || creditScore;
    updateCreditUI();
    applyLtvCaps();
    refreshRatesForProfile();
    runSim();
}

function tglHor(isAuto) {
    horMode = isAuto ? 'auto' : 'custom';
    document.getElementById('pHor').children[0].classList.toggle('active', isAuto);
    document.getElementById('pHor').children[1].classList.toggle('active', !isAuto);
    document.getElementById('bHor').classList.toggle('show', !isAuto);
    if (isAuto) { lockHor = true; }
    runSim();
}

function setTaxMode(m) {
    taxMode = m;
    document.getElementById('txReal').classList.toggle('active', m === 'real');
    document.getElementById('txForex').classList.toggle('active', m === 'forex');
    const label = m === 'real' ? 'Real' : 'Nominal';
    const vTaxMode = document.getElementById('vTaxMode');
    if (vTaxMode) vTaxMode.innerText = label;
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
    if (summaryEl) {
        const locks = [];
        if (lockDown) locks.push('Down');
        if (lockTerm) locks.push('Term');
        if (lockHor) locks.push('Horizon');
        summaryEl.innerText = locks.length ? locks.join(' & ') : 'Free';
    }
}
function toggleLock(target) {
    if (target === 'down') lockDown = !lockDown;
    if (target === 'term') lockTerm = !lockTerm;
    if (target === 'hor') {
        if (horMode === 'auto' && lockHor) {
            horMode = 'custom';
            document.getElementById('pHor').children[0].classList.remove('active');
            document.getElementById('pHor').children[1].classList.add('active');
            document.getElementById('bHor').classList.add('show');
        }
        lockHor = !lockHor;
    }
    updateLockUI();
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
    if (baseRate >= 4.5 || cpi >= 3.5) applyTamheel('shield');
    else if (baseRate >= 3.0 || cpi >= 2.5) applyTamheel('arbitrage');
    else applyTamheel('investor');
}

function showTermVal(elId, v) {
    const el = document.getElementById(elId);
    if (el) el.innerText = `${v}y`;
}

function syncTrackTermsToMain() {
    const dur = document.getElementById('rDur').value;
    document.getElementById('termPrime').value = dur;
    document.getElementById('termKalats').value = dur;
    document.getElementById('termKatz').value = dur;
    document.getElementById('termMalatz').value = dur;
    document.getElementById('termMatz').value = dur;
    showTermVal('termPrimeVal', dur);
    showTermVal('termKalatsVal', dur);
    showTermVal('termKatzVal', dur);
    showTermVal('termMalatzVal', dur);
    showTermVal('termMatzVal', dur);
}

function toggleAdvancedTerms() {
    advancedTermMode = !advancedTermMode;
    const advBox = document.getElementById('advancedTermBox');
    const basicBox = document.getElementById('basicTermBox');
    const btn = document.getElementById('btnAdvancedTerm');
    if (advancedTermMode) {
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
    s[0].style.opacity = v < 2 ? 1 : 0.2;
    s[1].style.opacity = (v >= 2 && v < 4) ? 1 : 0.2;
    s[2].style.opacity = v >= 4 ? 1 : 0.2;
}

function fmt(v) {
    if (Math.abs(v) >= 1000000) return (v / 1000000).toFixed(2) + 'M';
    if (Math.abs(v) >= 1000) return (v / 1000).toFixed(0) + 'k';
    return v.toFixed(0);
}
function fmtNum(v) { return v.toLocaleString('en-US', { maximumFractionDigits: 0 }); }
function fmtVal(v) { return mode === 'percent' ? v.toFixed(1) + '%' : fmt(v) + ' ₪'; }

function updateTrackTermEnabled() {
    const pP = parseFloat(document.getElementById('pctPrime').value) || 0;
    const pK = parseFloat(document.getElementById('pctKalats').value) || 0;
    const pZ = parseFloat(document.getElementById('pctKatz').value) || 0;
    const pM = parseFloat(document.getElementById('pctMalatz').value) || 0;
    const pMT = parseFloat(document.getElementById('pctMatz').value) || 0;

    const setDisabled = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.disabled = val <= 0;
    };

    setDisabled('termPrime', pP);
    setDisabled('termKalats', pK);
    setDisabled('termKatz', pZ);
    setDisabled('termMalatz', pM);
    setDisabled('termMatz', pMT);
}

function syncMixInput(track) {
    const slider = document.getElementById('slider' + track);
    const hidden = document.getElementById('pct' + track);
    const disp = document.getElementById('disp' + track);

    // Calculate sum of other tracks
    const tracks = ['Prime', 'Kalats', 'Katz', 'Malatz', 'Matz'];
    let othersSum = 0;
    tracks.forEach(t => {
        if (t !== track) othersSum += parseInt(document.getElementById('pct' + t).value) || 0;
    });

    // Cap this slider so total doesn't exceed 100
    const maxAllowed = 100 - othersSum;
    const requested = parseInt(slider.value) || 0;
    const newVal = Math.min(requested, maxAllowed);

    // Show tooltip if capped
    if (requested > maxAllowed) {
        showMaxTooltip(slider, maxAllowed);
    }

    slider.value = newVal;
    hidden.value = newVal;
    disp.innerText = newVal + '%';

    checkMix();
}

function showMaxTooltip(el, maxVal) {
    let tip = document.getElementById('maxTip');
    if (!tip) {
        tip = document.createElement('div');
        tip.id = 'maxTip';
        tip.innerHTML = '<span></span><div style="position:absolute;left:50%;bottom:-4px;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:5px solid #ef4444;"></div>';
        tip.style.cssText = 'position:fixed;background:#ef4444;color:#fff;padding:3px 6px;border-radius:4px;font-size:0.65rem;font-weight:500;z-index:999;pointer-events:none;box-shadow:0 1px 4px rgba(0,0,0,0.2);transform:translateX(-50%);transition:opacity 0.2s;';
        document.body.appendChild(tip);
    }
    tip.querySelector('span').textContent = '⚠️ Max 100%';
    const rect = el.getBoundingClientRect();
    const thumbPos = rect.left + (maxVal / 100) * rect.width;
    tip.style.left = thumbPos + 'px';
    tip.style.top = (rect.top - 28) + 'px';
    tip.style.opacity = '1';
    tip.style.display = 'block';
    clearTimeout(tip._timeout);
    tip._timeout = setTimeout(() => { tip.style.opacity = '0'; setTimeout(() => tip.style.display = 'none', 100); }, 150);
}

function updateVisualBar(p, k, m, z, mt) {
    const bar = document.getElementById('mixVisualBar');
    if (!bar) return;
    const segs = bar.children;
    segs[0].style.width = p + '%';   // Prime
    segs[1].style.width = k + '%';   // Kalats
    segs[2].style.width = m + '%';   // Malatz
    segs[3].style.width = z + '%';   // Katz
    segs[4].style.width = mt + '%';  // Matz
}

function checkMix() {
    let p = parseInt(document.getElementById('pctPrime').value) || 0;
    let k = parseInt(document.getElementById('pctKalats').value) || 0;
    let z = parseInt(document.getElementById('pctKatz').value) || 0;
    let m = parseInt(document.getElementById('pctMalatz').value) || 0;
    let mt = parseInt(document.getElementById('pctMatz').value) || 0;

    // Sync sliders if called externally (e.g. presets)
    document.getElementById('sliderPrime').value = p;
    document.getElementById('dispPrime').innerText = p + '%';
    document.getElementById('sliderKalats').value = k;
    document.getElementById('dispKalats').innerText = k + '%';
    document.getElementById('sliderKatz').value = z;
    document.getElementById('dispKatz').innerText = z + '%';
    document.getElementById('sliderMalatz').value = m;
    document.getElementById('dispMalatz').innerText = m + '%';
    document.getElementById('sliderMatz').value = mt;
    document.getElementById('dispMatz').innerText = mt + '%';

    updateVisualBar(p, k, m, z, mt);

    let sum = p + k + z + m + mt;
    const fixedPct = k + z; // Kalatz + Katz = fixed rate tracks
    const fixedOk = fixedPct >= 33;

    let el = document.getElementById('valMixSum');
    el.innerText = sum + "%";
    el.style.display = sum === 100 ? 'none' : 'block';
    el.style.color = sum === 100 ? '#16a34a' : '#ef4444';
    const warnEl = document.getElementById('mixWarn');
    if (warnEl) {
        warnEl.style.display = sum === 100 ? 'none' : 'block';
    }
    const charts = document.getElementById('chartsContainer');
    const chartsWarn = document.getElementById('chartsWarn');
    const dimCharts = sum !== 100 || !fixedOk;
    if (charts) charts.classList.toggle('charts-dim', dimCharts);
    if (chartsWarn) {
        if (sum !== 100) {
            chartsWarn.textContent = 'Mix must total 100% of mortgage to view charts';
            chartsWarn.style.display = 'block';
        } else if (!fixedOk) {
            chartsWarn.textContent = 'Min 33% fixed rate required (Kalatz/ Katz)';
            chartsWarn.style.display = 'block';
        } else {
            chartsWarn.style.display = 'none';
        }
    }
    updateTrackTermEnabled();
    runSim();
}

let rateEditMode = false;
function toggleRateEdit() {
    rateEditMode = !rateEditMode;
    const tracks = ['Prime', 'Kalats', 'Malatz', 'Katz', 'Matz'];
    tracks.forEach(t => {
        const lbl = document.getElementById('lblRate' + t);
        const inp = document.getElementById('rate' + t);
        if (rateEditMode) {
            lbl.style.display = 'none';
            inp.classList.add('show');
        } else {
            lbl.style.display = 'block';
            inp.classList.remove('show');
            // Sync label with input value
            let suffix = (t === 'Katz' || t === 'Matz') ? '% + CPI' : '%';
            lbl.innerText = parseFloat(inp.value).toFixed(2) + suffix;
        }
    });
}

function syncPrime() {
    refreshRatesForProfile();
    updateRateLabels();
    runSim();
}

function setSurplusMode(m, opts = {}) {
    surplusMode = m;
    document.getElementById('surplusConsume').classList.toggle('active', m === 'consume');
    document.getElementById('surplusMatch').classList.toggle('active', m === 'match');
    document.getElementById('surplusInvest').classList.toggle('active', m === 'invest');
    const descEl = document.getElementById('surplusDescText') || document.getElementById('surplusDesc');
    if (descEl) {
        if (m === 'invest') descEl.innerText = "Buy S&P (reinvests rent surplus into S&P 500)";
        else if (m === 'consume') descEl.innerText = "Keeps rent surplus as cash (Uninvested)";
        else if (m === 'match') descEl.innerText = "Sells S&P 500 to match rent surplus cashflow";
    }
    if (!opts.skipSim) runSim();
}

function setRepayMethod(m) {
    repayMethod = m;
    document.getElementById('repaySpitzer').classList.toggle('active', m === 'spitzer');
    document.getElementById('repayEqualPrincipal').classList.toggle('active', m === 'equalPrincipal');
    runSim();
}

function updateOptimalRepayMethod(baseParams, currentCagr) {
    const altMethod = repayMethod === 'spitzer' ? 'equalPrincipal' : 'spitzer';
    const altParams = { ...baseParams, config: { ...baseParams.config, repayMethod: altMethod }, returnSeries: false };
    const altRes = AppLogic.simulate(altParams);

    const starSpitzer = document.getElementById('starSpitzer');
    const starEqual = document.getElementById('starEqual');
    if (!starSpitzer || !starEqual) return;

    const spitzerCagr = repayMethod === 'spitzer' ? currentCagr : altRes.cagrRE;
    const equalCagr = repayMethod === 'equalPrincipal' ? currentCagr : altRes.cagrRE;

    starSpitzer.classList.remove('show');
    starEqual.classList.remove('show');
    if (spitzerCagr > equalCagr) starSpitzer.classList.add('show');
    else if (equalCagr > spitzerCagr) starEqual.classList.add('show');
}

function updateSweetSpots() {
    // Optimizer currently only optimizes Down/Term assuming existing mix
    // We pass existing inputs to the optimizer
    let eq = parseFloat(document.getElementById('inpEquity').value) || 400000;
    let curDown = parseInt(document.getElementById('rDown').value) / 100;
    let curDur = parseInt(document.getElementById('rDur').value);
    let simDur = horMode === 'auto' ? curDur : parseInt(document.getElementById('rHor').value);

    const params = {
        eq, curDown, curDur, simDur,
        useTax: document.getElementById('cTax')?.checked ?? true,
        useRentTax: document.getElementById('cRentTax')?.checked ?? false,
        tradeFee: parseFloat(document.getElementById('rTrade').value) / 100,
        merFee: parseFloat(document.getElementById('rMer').value) / 100,
        buyCostPct: parseFloat(document.getElementById('rBuyCost').value) / 100,
        maintPct: parseFloat(document.getElementById('rMaint').value) / 100,
        sellCostPct: parseFloat(document.getElementById('rSellCost').value) / 100,
        overrides: {
            SP: parseFloat(document.getElementById('sSP').value) / 100,
            App: parseFloat(document.getElementById('sApp').value) / 100,
            Int: parseFloat(document.getElementById('sInt').value) / 100,
            Inf: parseFloat(document.getElementById('sInf').value) / 100,
            Yld: parseFloat(document.getElementById('sYld').value) / 100,
            RateP: parseFloat(document.getElementById('ratePrime').value) / 100,
            RateK: parseFloat(document.getElementById('rateKalats').value) / 100,
            RateZ: parseFloat(document.getElementById('rateKatz').value) / 100,
            RateM: parseFloat(document.getElementById('rateMalatz').value) / 100,
            RateMT: parseFloat(document.getElementById('rateMatz').value) / 100,
            // Optimizer (calcCAGR) defaults M/MT to 0 currently, which is fine as sweet spot is about structure
        },
        mix: {
            prime: parseFloat(document.getElementById('pctPrime').value),
            kalats: parseFloat(document.getElementById('pctKalats').value),
            katz: parseFloat(document.getElementById('pctKatz').value),
            malatz: parseFloat(document.getElementById('pctMalatz').value),
            matz: parseFloat(document.getElementById('pctMatz').value)
        },
        drift: -0.5, // Simplified drift for sweet spot visual
        lockDown, lockTerm, lockHor, horMode, cfg, exMode, taxMode,
        calcOverride: window.__calcCagrOverride || undefined,
        surplusMode
    };

    const best = AppLogic.searchSweetSpots(params);

    const downMin = 25;
    const downMax = 100;
    let posDown = ((best.d - downMin) / (downMax - downMin)) * 100;
    document.getElementById('spotDown').style.left = `calc(${posDown}% + (8px - (0.16px * ${posDown})))`;
    document.getElementById('spotDown').classList.add('visible');

    let posDur = ((best.t - 10) / (30 - 10)) * 100;
    document.getElementById('spotDur').style.left = `calc(${posDur}% + (8px - (0.16px * ${posDur})))`;
    document.getElementById('spotDur').classList.add('visible');

    if (horMode === 'custom' || lockHor) {
        let posHor = ((best.h - 5) / (50 - 5)) * 100;
        let spotH = document.getElementById('spotHor');
        spotH.style.left = `calc(${posHor}% + (8px - (0.16px * ${posHor})))`;
        spotH.classList.add('visible');
        spotH.title = `Best CAGR at ${best.h} Years`;
    } else {
        document.getElementById('spotHor').classList.remove('visible');
    }
}

function runSim(opts = {}) {
    const skipCharts = !!opts.skipCharts;

    let eq = parseFloat(document.getElementById('inpEquity').value) || 400000;
    let downPct = parseInt(document.getElementById('rDown').value) / 100;
    const mainTermSlider = document.getElementById('rDur');
    let mortDur = parseInt(mainTermSlider.value);
    let simDur = horMode === 'auto' ? mortDur : parseInt(document.getElementById('rHor').value);

    document.getElementById('dDown').innerText = (downPct * 100).toFixed(0) + '%';
    document.getElementById('dDur').innerText = mortDur + ' Yr';
    document.getElementById('dHor').innerText = horMode === 'auto' ? 'Auto (' + mortDur + 'Y)' : simDur + ' Yr';

    // ... Update other UI labels ...
    document.getElementById('vTrade').innerText = parseFloat(document.getElementById('rTrade').value).toFixed(1) + '%';
    document.getElementById('vMer').innerText = parseFloat(document.getElementById('rMer').value).toFixed(2) + '%';
    document.getElementById('vDiscount').innerText = document.getElementById('rDiscount').value + '%';
    document.getElementById('vBuyCost').innerText = parseFloat(document.getElementById('rBuyCost').value).toFixed(1) + '%';
    document.getElementById('vMaint').innerText = parseFloat(document.getElementById('rMaint').value).toFixed(0) + '%';
    document.getElementById('vSellCost').innerText = parseFloat(document.getElementById('rSellCost').value).toFixed(1) + '%';

    let assetPriceStart = eq / downPct;
    let lev = 1 / downPct;
    document.getElementById('valAsset').innerText = fmt(assetPriceStart) + ' ₪';
    document.getElementById('valLev').innerText = 'x' + lev.toFixed(1);
    document.getElementById('barLev').style.width = Math.min(((lev - 1) / 4) * 100, 100) + '%';
    let initialLoan = assetPriceStart - eq;
    document.getElementById('valMortgage').innerText = fmt(initialLoan) + ' ₪';

    // Update track percentage displays with amounts
    const tracks = ['Prime','Kalats','Malatz','Katz','Matz'];
    tracks.forEach(t => {
        const pct = parseFloat(document.getElementById('pct'+t).value) || 0;
        const el = document.getElementById('disp'+t);
        if (el) {
            const amt = initialLoan * pct / 100;
            el.innerHTML = `${pct}%<span style="font-size:0.6rem;color:#64748b;font-weight:400"> ₪${Math.round(amt/1000)}K</span>`;
        }
    });

    for (let k in cfg) {
        let el = document.getElementById(cfg[k].v);
        if (cfg[k].is) el.innerText = 'Hist'; else el.innerText = document.getElementById(cfg[k].s).value + '%';
    }

    // Terms
    const clampTerm = v => Math.max(TERM_MIN, Math.min(TERM_MAX, v));
    let termP = clampTerm(parseInt(document.getElementById('termPrime').value) || mortDur);
    let termK = clampTerm(parseInt(document.getElementById('termKalats').value) || mortDur);
    let termZ = clampTerm(parseInt(document.getElementById('termKatz').value) || mortDur);
    let termM = clampTerm(parseInt(document.getElementById('termMalatz').value) || mortDur);
    let termMT = clampTerm(parseInt(document.getElementById('termMatz').value) || mortDur);

    if (!advancedTermMode) {
        termP = termK = termZ = termM = termMT = clampTerm(mortDur);
        // UI Sync
        document.getElementById('termPrime').value = termP;
        document.getElementById('termKalats').value = termK;
        document.getElementById('termKatz').value = termZ;
        document.getElementById('termMalatz').value = termM;
        document.getElementById('termMatz').value = termMT;
        showTermVal('termPrimeVal', termP);
        showTermVal('termKalatsVal', termK);
        showTermVal('termKatzVal', termZ);
        showTermVal('termMalatzVal', termM);
        showTermVal('termMatzVal', termMT);
    }

    // Logic restored to sync horizon/terms
    const activeTerms = [];
    const getPct = (id) => parseFloat(document.getElementById(id).value) || 0;
    if (getPct('pctPrime') > 0) activeTerms.push(termP);
    if (getPct('pctKalats') > 0) activeTerms.push(termK);
    if (getPct('pctKatz') > 0) activeTerms.push(termZ);
    if (getPct('pctMalatz') > 0) activeTerms.push(termM);
    if (getPct('pctMatz') > 0) activeTerms.push(termMT);

    if (activeTerms.length === 0) activeTerms.push(mortDur);

    const maxTrackYears = Math.max(...activeTerms);
    if (advancedTermMode) {
        mortDur = maxTrackYears;
        mainTermSlider.value = mortDur;
        document.getElementById('dDur').innerText = mortDur + ' Yr';
    }

    const effectiveMax = Math.max(maxTrackYears, mortDur);
    if (horMode === 'auto') {
        document.getElementById('rHor').value = effectiveMax;
        document.getElementById('dHor').innerText = 'Auto (' + effectiveMax + 'Y)';
        simDur = effectiveMax;
    }

    if (!opts.skipSweetSpots) updateSweetSpots();

    let activeDrift = -0.5;
    if (document.getElementById('scenBear').classList.contains('active')) activeDrift = SCENARIOS.bear.drift;
    if (document.getElementById('scenBull').classList.contains('active')) activeDrift = SCENARIOS.bull.drift;

    const params = {
        equity: eq,
        downPct: downPct,
        loanTerm: mortDur,
        simHorizon: simDur,
        termMix: { p: termP, k: termK, z: termZ, m: termM, mt: termMT },
        mix: {
            prime: parseFloat(document.getElementById('pctPrime').value) || 0,
            kalats: parseFloat(document.getElementById('pctKalats').value) || 0,
            katz: parseFloat(document.getElementById('pctKatz').value) || 0,
            malatz: parseFloat(document.getElementById('pctMalatz').value) || 0,
            matz: parseFloat(document.getElementById('pctMatz').value) || 0
        },
        rates: {
            prime: parseFloat(document.getElementById('ratePrime').value) / 100,
            kalats: parseFloat(document.getElementById('rateKalats').value) / 100,
            katz: parseFloat(document.getElementById('rateKatz').value) / 100,
            malatz: parseFloat(document.getElementById('rateMalatz').value) / 100,
            matz: parseFloat(document.getElementById('rateMatz').value) / 100
        },
        market: {
            sp: parseFloat(document.getElementById('sSP').value) / 100,
            reApp: parseFloat(document.getElementById('sApp').value) / 100,
            cpi: parseFloat(document.getElementById('sInf').value) / 100,
            boi: parseFloat(document.getElementById('sInt').value) / 100,
            rentYield: parseFloat(document.getElementById('sYld').value) / 100
        },
        fees: {
            buy: parseFloat(document.getElementById('rBuyCost').value) / 100,
            sell: parseFloat(document.getElementById('rSellCost').value) / 100,
            trade: parseFloat(document.getElementById('rTrade').value) / 100,
            mgmt: parseFloat(document.getElementById('rMer').value) / 100
        },
        maintPct: parseFloat(document.getElementById('rMaint').value) / 100,
        purchaseDiscount: parseFloat(document.getElementById('rDiscount').value) / 100,
        tax: {
            use: document.getElementById('cTax')?.checked ?? true,
            useRent: document.getElementById('cRentTax')?.checked ?? false,
            mode: taxMode
        },
        config: {
            drift: activeDrift,
            surplusMode: surplusMode,
            exMode: exMode,
            history: cfg,
            repayMethod: repayMethod
        },
        returnSeries: !skipCharts
    };

    const res = AppLogic.simulate(params);

    // ... UPDATE UI KPIs ...
    const lRE = res.netRE;
    const lSP = res.netSP;
    document.getElementById('kRE').innerText = fmtVal(mode === 'percent' ? (res.series ? res.series.reDataPct[res.series.reDataPct.length - 1] : 0) : lRE);
    document.getElementById('kSP').innerText = fmtVal(mode === 'percent' ? (res.series ? res.series.spDataPct[res.series.spDataPct.length - 1] : 0) : lSP);

    const diff = lRE - lSP;
    const winnerIsRE = diff >= 0;
    const base = winnerIsRE ? lSP : lRE;
    const diffPct = base !== 0 ? (Math.abs(diff) / base) * 100 : 0;
    document.getElementById('kDiff').innerText = diffPct.toFixed(1) + '%';
    document.getElementById('kDiff').style.color = winnerIsRE ? "var(--success)" : "var(--primary)";

    document.getElementById('kRECagr').innerText = res.cagrRE.toFixed(2) + '%';
    document.getElementById('kSPCagr').innerText = res.cagrSP.toFixed(2) + '%';

    // Highlight optimal repay method
    updateOptimalRepayMethod(params, res.cagrRE);

    let intPctOfAsset = (res.totalInterestWasted / assetPriceStart) * 100;
    document.getElementById('kInt').innerText = fmt(res.totalInterestWasted) + ` ₪ (${intPctOfAsset.toFixed(0) + '%)'}`;
    document.getElementById('kRent').innerText = fmt(res.totalRentCollected) + ' ₪';
    document.getElementById('kInvested').innerText = fmt(res.totalCashInvested) + ' ₪';

    const posYears = res.firstPosMonth === null ? null : (res.firstPosMonth / 12);
    const posTxt = res.firstPosMonth === null ? 'Never' : posYears.toFixed(1) + 'y';
    const valPosCF = document.getElementById('valPosCF');
    if (valPosCF) valPosCF.innerText = posTxt;

    if (!skipCharts && res.series) {
        if (typeof window !== 'undefined') {
            window.__lastSim = {
                ...res,
                finalNetRE: res.netRE,
                finalNetSP: res.netSP,
                flowNet: res.series.flowNet[res.series.flowNet.length - 1],
                posCFYears: posYears
            };
        }
        drawCharts(res.series.labels, res.series.reDataVal, res.series.reDataPct, res.series.spDataVal, res.series.spDataPct,
            res.series.flowRent, res.series.flowInt, res.series.flowPrinc, res.series.flowNet,
            res.series.surplusVal, res.series.surplusPct);
    }
}

function drawCharts(l, rVal, rPct, sVal, sPct, fRent, fInt, fPrinc, fNet, surplusValSeries, surplusPctSeries) {
    const ctx1 = document.getElementById('wealthChart').getContext('2d');
    if (wealthChart) wealthChart.destroy();

    let plotR = mode === 'percent' ? rPct : rVal;
    let plotS = mode === 'percent' ? sPct : sVal;
    let plotSurp = mode === 'percent' ? surplusPctSeries : surplusValSeries;
    const reinvestActive = (surplusMode === 'invest');
    let yTxt = mode === 'percent' ? 'Cumulative ROI (%)' : 'Net Wealth (₪)';

    let datasets = [
        { label: 'Real Estate', data: plotR, borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.05)', borderWidth: 3, fill: true, pointRadius: 0, pointHoverRadius: 6 },
        { label: 'S&P 500', data: plotS, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.05)', borderWidth: 3, fill: true, pointRadius: 0, pointHoverRadius: 6 }
    ];

    if (reinvestActive && plotSurp && plotSurp.some(v => v > 0)) {
        datasets.push({ label: 'Reinvested Surplus', data: plotSurp, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.12)', borderWidth: 2, fill: true, pointRadius: 0, pointHoverRadius: 6, borderDash: [6, 4] });
    }

    wealthChart = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: l,
            datasets: datasets
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: c => {
                            let idx = c.dataIndex;
                            let val = 0, pct = 0;
                            if (c.dataset.label === 'Real Estate') { val = rVal[idx]; pct = rPct[idx]; }
                            else if (c.dataset.label === 'Reinvested Surplus') { val = surplusValSeries[idx]; pct = surplusPctSeries[idx]; }
                            else { val = sVal[idx]; pct = sPct[idx]; }
                            return `${c.dataset.label}: ${fmt(val)} ₪ (${pct.toFixed(1)}%)`;
                        }
                    }
                }
            },
            scales: { y: { title: { display: true, text: yTxt }, ticks: { callback: v => mode === 'percent' ? v + '%' : fmt(v) } } }
        }
    });

    const ctx2 = document.getElementById('flowChart').getContext('2d');
    if (flowChart) flowChart.destroy();

    // Rent minus Interest for tooltip
    const rentMinusInt = fRent.map((r, i) => r + fInt[i]);

    const netRentAfterInt = fRent.map((v, i) => v + (fInt[i] || 0)); // net rent minus interest cost
    const totalMortgage = fInt.map((v, i) => v + (fPrinc[i] || 0)); // total mortgage payment (both negative)

    flowChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: l,
            datasets: [
                { type: 'line', label: 'Net Cashflow', data: fNet, borderColor: '#0f172a', borderWidth: 4, pointRadius: 3, tension: 0.3, order: 1, fill: false },
                { type: 'line', label: 'Rent minus Interest', data: netRentAfterInt, borderColor: '#f59e0b', borderWidth: 2, pointRadius: 0, tension: 0.2, order: 2, fill: false, borderDash: [6, 3] },
                { type: 'bar', label: 'Revenue (Rent)', data: fRent, backgroundColor: '#22c55e', stack: 'Stack 0', order: 3, borderWidth: 0 },
                { type: 'bar', label: 'Interest (Cost)', data: fInt, backgroundColor: '#ef4444', stack: 'Stack 0', order: 4, borderWidth: 0 },
                { type: 'bar', label: 'Principal (Equity)', data: fPrinc, backgroundColor: '#fca5a5', stack: 'Stack 0', order: 5, borderWidth: 0 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                tooltip: {
                    callbacks: {
                        afterBody: (items) => {
                            if (items.length > 0) {
                                const idx = items[0].dataIndex;
                                return `Total Mortgage: ${fmtNum(totalMortgage[idx])} ₪`;
                            }
                        },
                        label: c => {
                            let v = Math.abs(c.raw);
                            let lbl = c.dataset.label;
                            if (lbl.includes('Rent minus Interest')) return `Rent - Interest: ${fmtNum(c.raw)} ₪`;
                            if (lbl.includes('Interest')) {
                                let idx = c.dataIndex;
                                let iVal = Math.abs(c.chart.data.datasets[3].data[idx]);
                                let pVal = Math.abs(c.chart.data.datasets[4].data[idx]);
                                let total = iVal + pVal;
                                let pct = total > 0 ? ((iVal / total) * 100).toFixed(0) : 0;
                                return `Interest: ${fmtNum(iVal)} (${pct}%)`;
                            }
                            if (lbl.includes('Principal')) return `Principal: ${fmtNum(v)}`;
                            if (lbl.includes('Revenue')) return `Rent: ${fmtNum(v)}`;
                            return `Net: ${fmtNum(c.raw)}`;
                        }
                    }
                }
            },
            scales: { y: { title: { display: true, text: 'Monthly ₪' } }, x: { stacked: true } }
        }
    });
}

function bootstrap() {
    updMeter();
    updateLockUI();
    updateCreditUI();
    applyLtvCaps();
    refreshRatesForProfile();
    updateRateLabels();
    // Ensure we start on Fixed rates with scenarios visible; set surplus mode before first sim
    setSurplusMode(surplusMode, { skipSim: true });
    setGlobalMode(false);
    applyScenario('base', { skipSim: true });
    setMode('currency');
    checkMix(); // initialize mix UI state (hide sum if 100%)
    runSim();
}

function updateRateLabels() {
    const tracks = ['Prime', 'Kalats', 'Malatz', 'Katz', 'Matz'];
    tracks.forEach(t => {
        const lbl = document.getElementById('lblRate' + t);
        const inp = document.getElementById('rate' + t);
        if (lbl && inp) {
            let suffix = (t === 'Katz' || t === 'Matz') ? '% + CPI' : '%';
            lbl.innerText = parseFloat(inp.value).toFixed(2) + suffix;
        }
    });
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
window.syncMixInput = syncMixInput;
window.toggleRateEdit = toggleRateEdit;

document.addEventListener('DOMContentLoaded', bootstrap);
