const AppLogic = window.Logic || {};

// --- TRANSLATIONS (loaded from i18n/index.js, with fallback for tests) ---
if (!window.i18n) {
    // Minimal fallback for test environment
    window.i18n = {
        T: { en: {}, he: {} },
        getLang: () => 'en',
        setLang: () => {}
    };
}
const T = window.i18n.T;
let lang = window.i18n.getLang();

function t(key) { return (T[lang] && T[lang][key]) || (T['en'] && T['en'][key]) || key; }

function toggleLang() {
    lang = lang === 'en' ? 'he' : 'en';
    window.i18n.setLang(lang);
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    document.body.classList.toggle('rtl', lang === 'he');
    applyTranslations();
}

function applyTranslations() {
    document.querySelectorAll('[data-t]').forEach(el => {
        if (el.tagName === 'OPTION') {
            el.textContent = t(el.dataset.t);
        } else if (el.children.length === 0 || el.classList.contains('card-lbl')) {
            const lockChild = el.querySelector('.lock-toggle');
            if (lockChild) {
                const textNode = el.firstChild;
                if (textNode && textNode.nodeType === 3) {
                    textNode.textContent = t(el.dataset.t);
                }
            } else {
                el.textContent = t(el.dataset.t);
            }
        } else {
            el.textContent = t(el.dataset.t);
        }
    });
    document.querySelectorAll('[data-t-placeholder]').forEach(el => {
        el.placeholder = t(el.dataset.tPlaceholder);
    });
    updateLockUI();
    setSurplusMode(surplusMode, { skipSim: true });
    updateRateLabels();
    runSim();
}

const SCENARIOS = {
    // Based on CBS official data (2018-2024 district indices, 2023 rent tables)
    // RE appreciation: ~5-6% nominal, Rent yield: ~2.5-3% gross, S&P: ~7-10% nominal
    bear: { sp: 7.0, app: 3.0, int: 5.0, inf: 3.5, yld: 2.5, drift: 1.0 },
    base: { sp: 9.5, app: 5.0, int: 4.25, inf: 2.5, yld: 2.8, drift: 0.5 },
    bull: { sp: 10.0, app: 7.0, int: 3.0, inf: 2.0, yld: 3.0, drift: -0.5 }
};

// Common Israeli mortgage mixes (תמהיל משכנתא) - Dec 2025
// All comply with BoI rules: ≥33% fixed, ≤66% variable
const TAMHEEL_PROFILES = {
    // Mix 1: "2025 Balanced Base" - most common modern recommendation
    // 30% Prime + 40% KLATZ + 30% MALATZ - balanced exposure
    defaultEven: { p: 30, k: 40, z: 0, m: 30, mt: 0, tP: 30, tK: 20, tZ: 20, tM: 30, tMt: 15 },
    
    // Mix 2: "High Stability" - risk-averse, payment predictability
    // 25% Prime + 50% KLATZ + 25% MALATZ
    shield: { p: 25, k: 50, z: 0, m: 25, mt: 0, tP: 30, tK: 25, tZ: 25, tM: 30, tMt: 20 },
    
    // Mix 3: "Classic Thirds with CPI" - lower initial payment, CPI risk
    // 33% Prime + 34% KLATZ + 33% Variable CPI-linked
    investor: { p: 33, k: 34, z: 0, m: 0, mt: 33, tP: 30, tK: 20, tZ: 20, tM: 30, tMt: 20 },
    
    // Mix 4: "Rate-Cuts Thesis" - max flexibility for refinancing
    // 37% Prime + 33% KALATZ + 30% MALATZ
    arbitrage: { p: 37, k: 33, z: 0, m: 30, mt: 0, tP: 30, tK: 12, tZ: 12, tM: 30, tMt: 10 }
};

// Base Spreads (Anchors) relative to BoI rate
// Dec 2025 market data: BoI 4.25%, Prime 5.75% (BoI+1.5%), 5Y gov yield ~3.75%
// Market ranges (LTV 60-75%): Prime 4.70-5.00%, MALATZ 4.45-4.75%, KLATZ 4.60-4.80%
// CPI-Linked: Katz, Matz | Non-Linked: Prime, Kalatz, Malatz
const ANCHORS = {
    prime: 1.50,    // Prime = BoI + 1.5% (fixed by law), discount applied via risk
    kalats: 0.60,   // Fixed, Non-Linked (KLATZ): target 4.60-4.70% for top tier
    malatz: 0.51,   // Var 5yr, Non-Linked (MALATZ): ~5Y gov 3.75% + spread
    katz: -1.30,    // Fixed, CPI-Linked: ~2.70% real rate for top tier
    matz: -1.05     // Var 5yr, CPI-Linked: ~2.95% real rate for top tier
};

// Risk Premiums by credit tier (added to BoI + Anchor)
// Prime discount ranges: P-0.95 (elite) to P-0.32 (good) to P+0.40 (poor)
// Market avg ~P-0.39, so tier C/D is "market average"
const CREDIT_MATRIX = {
    A: { range: [950, 1000], riskP: -0.95, riskK: -0.25, riskM: -0.20, riskZ: -0.20, maxLTV: 0.75 }, // Elite: P-0.95 → 4.80%
    B: { range: [900, 949], riskP: -0.80, riskK: -0.15, riskM: -0.10, riskZ: -0.10, maxLTV: 0.75 },  // Strong: P-0.80 → 4.95%
    C: { range: [850, 899], riskP: -0.60, riskK: -0.05, riskM: 0.00, riskZ: 0.00, maxLTV: 0.75 },    // Good: P-0.60 → 5.15%
    D: { range: [800, 849], riskP: -0.40, riskK: 0.05, riskM: 0.10, riskZ: 0.10, maxLTV: 0.75 },     // OK: P-0.40 → 5.35%
    E: { range: [750, 799], riskP: -0.20, riskK: 0.20, riskM: 0.25, riskZ: 0.25, maxLTV: 0.70 },     // Weak: P-0.20 → 5.55%
    F: { range: [700, 749], riskP: 0.00, riskK: 0.40, riskM: 0.40, riskZ: 0.40, maxLTV: 0.65 },      // Bad: P+0.00 → 5.75%
    G: { range: [660, 699], riskP: 0.25, riskK: 0.65, riskM: 0.60, riskZ: 0.60, maxLTV: 0.60 },      // Poor
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
let bootstrapping = false;
let creditScore = 900;
let surplusMode = 'match';
let repayMethod = 'spitzer';
let optimizeMode = 'outperform';

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
function setMode(m, opts = {}) {
    mode = m;
    document.getElementById('btnCurr').classList.toggle('active', m === 'currency');
    document.getElementById('btnPct').classList.toggle('active', m === 'percent');
    document.getElementById('equityBox').classList.toggle('show', m === 'currency');
    if (!opts.skipSim) runSim();
}
function tgl(k, h, opts = {}) {
    cfg[k].is = h;
    const pills = document.getElementById(cfg[k].p).children;
    pills[0].classList.toggle('active', h); pills[1].classList.toggle('active', !h);
    document.getElementById(cfg[k].b).classList.toggle('show', !h);
    if (k === 'Inf') updMeter();
    if (!opts.skipSim) runSim();
}
function setGlobalMode(isHist, opts = {}) {
    const globalPills = document.getElementById('pGlobal').children;
    globalPills[0].classList.toggle('active', isHist);
    globalPills[1].classList.toggle('active', !isHist);
    document.getElementById('scenBox').classList.toggle('show', !isHist);
    for (let k in cfg) { tgl(k, isHist, opts); }
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
    updateRateLabels();
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
    // Set term years per track
    document.getElementById('termPrime').value = t.tP;
    document.getElementById('termKalats').value = t.tK;
    document.getElementById('termKatz').value = t.tZ;
    document.getElementById('termMalatz').value = t.tM;
    document.getElementById('termMatz').value = t.tMt;
    ['termPrimeVal','termKalatsVal','termKatzVal','termMalatzVal','termMatzVal'].forEach((id, i) => {
        document.getElementById(id).textContent = [t.tP, t.tK, t.tZ, t.tM, t.tMt][i] + 'y';
    });
    // Open advanced terms tab
    if (!advancedTermMode) toggleAdvancedTerms();
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
    updateRateLabels();
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
        el.innerText = locked ? t('locked') : t('free');
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
        summaryEl.innerText = locks.length ? locks.join(' & ') : t('free');
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
    if (el) {
        if (lang === 'he') {
            el.innerHTML = '<span style="direction:ltr;display:inline-block">' + v + ' ' + t('ySuffix') + '</span>';
        } else {
            el.innerHTML = v + t('ySuffix');
        }
    }
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
    runSim();
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
    renderPrepayments(); // Update prepayment dropdowns when tracks change
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
    tracks.forEach(track => {
        const lbl = document.getElementById('lblRate' + track);
        const inp = document.getElementById('rate' + track);
        if (rateEditMode) {
            lbl.style.display = 'none';
            inp.classList.add('show');
        } else {
            lbl.style.display = 'block';
            inp.classList.remove('show');
            // Sync label with input value
            let suffix = (track === 'Katz' || track === 'Matz') ? '% ' + t('cpiSuffix') : '%';
            lbl.innerText = parseFloat(inp.value).toFixed(2) + suffix;
        }
    });
}

function togglePrepaySection() {
    const container = document.getElementById('prepayContainer');
    const arrow = document.getElementById('prepayArrow');
    if (container.style.display === 'none') {
        container.style.display = 'block';
        arrow.classList.add('open');
    } else {
        container.style.display = 'none';
        arrow.classList.remove('open');
    }
}

let prepayments = [];
let prepayIdCounter = 0;

function getActiveTracksForPrepay() {
    const tracks = [
        { id: 'p', name: 'Prime', pct: parseFloat(document.getElementById('pctPrime').value) || 0 },
        { id: 'k', name: 'Kalats', pct: parseFloat(document.getElementById('pctKalats').value) || 0 },
        { id: 'm', name: 'Malatz', pct: parseFloat(document.getElementById('pctMalatz').value) || 0 },
        { id: 'z', name: 'Katz', pct: parseFloat(document.getElementById('pctKatz').value) || 0 },
        { id: 'mt', name: 'Matz', pct: parseFloat(document.getElementById('pctMatz').value) || 0 }
    ];
    return tracks.filter(t => t.pct > 0);
}

function addPrepayment() {
    const active = getActiveTracksForPrepay();
    if (active.length === 0) {
        alert('No active tracks to prepay. Add allocation to at least one track first.');
        return;
    }
    // Find first track with remaining balance
    const trackWithBalance = active.find(t => getRemainingForTrack(t.id) > 0);
    if (!trackWithBalance) {
        alert('All track balances are fully allocated to existing prepayments.');
        return;
    }
    const remaining = getRemainingForTrack(trackWithBalance.id);
    const id = prepayIdCounter++;
    prepayments.push({ id, track: trackWithBalance.id, amt: Math.min(100000, remaining), yr: 5 });
    renderPrepayments();
    runSim();
}

function removePrepayment(id) {
    prepayments = prepayments.filter(p => p.id !== id);
    renderPrepayments();
    runSim();
}

function getTrackInitialBalance(trackId) {
    const eq = parseFloat(document.getElementById('inpEquity')?.value) || 0;
    const downPct = (parseFloat(document.getElementById('rDown')?.value) || 25) / 100;
    const loan = eq / downPct - eq;
    const pctMap = { p: 'Prime', k: 'Kalats', m: 'Malatz', z: 'Katz', mt: 'Matz' };
    const elId = pctMap[trackId];
    if (!elId) return 0;
    const pct = parseFloat(document.getElementById('pct' + elId)?.value) || 0;
    return loan * pct / 100;
}

function getTrackBalanceAtYear(trackId, year) {
    const initial = getTrackInitialBalance(trackId);
    if (initial <= 0 || year <= 0) return initial;

    const rateMap = { p: 'Prime', k: 'Kalats', m: 'Malatz', z: 'Katz', mt: 'Matz' };
    const termMap = { p: 'Prime', k: 'Kalats', m: 'Malatz', z: 'Katz', mt: 'Matz' };
    const rateName = rateMap[trackId];
    const termName = termMap[trackId];

    const rate = (parseFloat(document.getElementById('rate' + rateName)?.value) || 5) / 100;
    const termYears = parseInt(document.getElementById('term' + termName)?.value) ||
                      parseInt(document.getElementById('rDur')?.value) || 25;

    // Calculate remaining balance using amortization formula
    const monthlyRate = rate / 12;
    const totalMonths = termYears * 12;
    const paidMonths = year * 12;

    if (monthlyRate === 0) {
        // Simple linear payoff
        return initial * (1 - paidMonths / totalMonths);
    }

    // Remaining balance formula: P * [(1+r)^n - (1+r)^p] / [(1+r)^n - 1]
    const factor = Math.pow(1 + monthlyRate, totalMonths);
    const paidFactor = Math.pow(1 + monthlyRate, paidMonths);
    const remaining = initial * (factor - paidFactor) / (factor - 1);

    return Math.max(0, remaining);
}

function getRemainingForTrack(trackId, excludeId = null, atYear = null) {
    // Get balance at the specified year (or initial if no year)
    const p = excludeId !== null ? prepayments.find(x => x.id === excludeId) : null;
    const year = atYear !== null ? atYear : (p ? p.yr : 0);

    const balanceAtYear = year > 0 ? getTrackBalanceAtYear(trackId, year) : getTrackInitialBalance(trackId);

    // Subtract other prepayments on this track that happen before or at this year
    const used = prepayments
        .filter(pp => pp.track === trackId && pp.id !== excludeId && pp.yr <= year)
        .reduce((sum, pp) => sum + pp.amt, 0);

    return Math.max(0, balanceAtYear - used);
}

function getMaxPrepayForTrack(trackId, year, excludeId) {
    const balanceAtYear = getTrackBalanceAtYear(trackId, year);
    const otherPrepays = prepayments
        .filter(pp => pp.track === trackId && pp.id !== excludeId && pp.yr <= year)
        .reduce((sum, pp) => sum + pp.amt, 0);
    return Math.round(Math.max(0, balanceAtYear - otherPrepays));
}

function updatePrepayment(id, field, value) {
    const p = prepayments.find(x => x.id === id);
    if (!p) return;

    let needsRender = false;

    if (field === 'yr') {
        const newYr = Math.max(1, Math.min(30, parseInt(value) || 1));
        if (newYr !== p.yr) {
            const oldMax = getMaxPrepayForTrack(p.track, p.yr, id);
            const wasAtMax = p.amt >= oldMax - 1; // tolerance for rounding
            p.yr = newYr;
            const newMax = getMaxPrepayForTrack(p.track, p.yr, id);
            if (wasAtMax) {
                p.amt = newMax; // Keep at max
            } else if (p.amt > newMax) {
                p.amt = newMax; // Cap if exceeds
            }
            needsRender = true;
        }
    } else if (field === 'amt') {
        const requested = parseFloat(value) || 0;
        const max = getMaxPrepayForTrack(p.track, p.yr, id);
        p.amt = Math.round(Math.min(requested, max));
        // Update display without full re-render
        const items = document.querySelectorAll('.prepay-item');
        const idx = prepayments.findIndex(x => x.id === id);
        if (items[idx]) {
            items[idx].querySelector('.prepay-max').textContent = `/ ${Math.round(max/1000)}K`;
            const inp = items[idx].querySelector('input[type="number"]');
            if (inp && requested >= max) {
                inp.value = p.amt;
                inp.blur(); // Kick out when max reached
            }
        }
    } else if (field === 'track') {
        p.track = value;
        const max = getMaxPrepayForTrack(value, p.yr, id);
        if (p.amt > max) p.amt = max;
        needsRender = true;
    }

    if (needsRender) renderPrepayments();
    runSim();
}

function renderPrepayments() {
    const list = document.getElementById('prepayList');
    if (!list) return;
    const active = getActiveTracksForPrepay();

    list.innerHTML = prepayments.map(p => {
        const trackValid = active.some(t => t.id === p.track);
        if (!trackValid && active.length > 0) p.track = active[0].id;

        // Max is balance at year minus other prepayments (not including this one's current value)
        const balanceAtYear = getTrackBalanceAtYear(p.track, p.yr);
        const otherPrepays = prepayments
            .filter(pp => pp.track === p.track && pp.id !== p.id && pp.yr <= p.yr)
            .reduce((sum, pp) => sum + pp.amt, 0);
        const maxVal = Math.max(0, balanceAtYear - otherPrepays);

        // Cap current amount if it exceeds max
        if (p.amt > maxVal) p.amt = maxVal;

        const options = active.map(t => {
            return `<option value="${t.id}" ${p.track === t.id ? 'selected' : ''}>${t.name}</option>`;
        }).join('');

        return `<div class="prepay-item">
            <select onchange="updatePrepayment(${p.id},'track',this.value)">${options}</select>
            <span class="prepay-label">₪</span>
            <div class="prepay-amt-group">
                <input type="number" value="${p.amt}" min="0" max="${maxVal}" step="10000" oninput="updatePrepayment(${p.id},'amt',this.value)">
                <span class="prepay-max-btn" onclick="maxPrepayment(${p.id})">MAX</span>
            </div>
            <span class="prepay-label">Yr</span>
            <input type="number" value="${p.yr}" min="1" max="30" style="width:45px" oninput="updatePrepayment(${p.id},'yr',this.value)">
            <span class="prepay-remove" onclick="removePrepayment(${p.id})">✕</span>
        </div>`;
    }).join('');
}

function maxPrepayment(id) {
    const p = prepayments.find(x => x.id === id);
    if (!p) return;
    p.amt = getMaxPrepayForTrack(p.track, p.yr, id);
    renderPrepayments();
    runSim();
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
        if (m === 'invest') descEl.innerText = t('surplusDescInvest');
        else if (m === 'consume') descEl.innerText = t('surplusDescConsume');
        else if (m === 'match') descEl.innerText = t('surplusDescMatch');
    }
    if (!opts.skipSim) runSim();
}

function setRepayMethod(m) {
    repayMethod = m;
    document.getElementById('repaySpitzer').classList.toggle('active', m === 'spitzer');
    document.getElementById('repayEqualPrincipal').classList.toggle('active', m === 'equalPrincipal');
    runSim();
}

function setOptimizeMode(m) {
    optimizeMode = m;
    document.getElementById('optRoi').classList.toggle('active', m === 'roi');
    document.getElementById('optOutperf').classList.toggle('active', m === 'outperform');
    updateSweetSpots();
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
    
    // Calculate purchase tax for optimizer
    const assetPrice = eq / curDown;
    const isFirstHome = buyerType === 'first';
    const includePurchaseTax = document.getElementById('cPurchaseTax')?.checked ?? true;
    const purchaseTax = includePurchaseTax ? AppLogic.calcPurchaseTax(assetPrice, isFirstHome) : 0;

    const params = {
        eq, curDown, curDur, simDur,
        useTaxSP: document.getElementById('cTaxSP')?.checked ?? true,
        useTaxRE: document.getElementById('cTaxSP')?.checked ?? true,
        useRentTax: document.getElementById('cRentTax')?.checked ?? false,
        useMasShevach: document.getElementById('cMasShevach')?.checked ?? false,
        masShevachType: buyerType === 'investor' ? 'none' : 'single',
        purchaseTax,
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
        },
        mix: {
            prime: parseFloat(document.getElementById('pctPrime').value),
            kalats: parseFloat(document.getElementById('pctKalats').value),
            katz: parseFloat(document.getElementById('pctKatz').value),
            malatz: parseFloat(document.getElementById('pctMalatz').value),
            matz: parseFloat(document.getElementById('pctMatz').value)
        },
        termMix: {
            p: parseInt(document.getElementById('termPrime').value) || curDur,
            k: parseInt(document.getElementById('termKalats').value) || curDur,
            z: parseInt(document.getElementById('termKatz').value) || curDur,
            m: parseInt(document.getElementById('termMalatz').value) || curDur,
            mt: parseInt(document.getElementById('termMatz').value) || curDur
        },
        drift: -0.5,
        lockDown, lockTerm, lockHor, horMode, cfg, exMode, taxMode,
        calcOverride: window.__calcCagrOverride || undefined,
        surplusMode,
        purchaseDiscount: parseFloat(document.getElementById('rDiscount').value) / 100,
        optimizeMode
    };

    const best = AppLogic.searchSweetSpots(params);

    const downMin = 25;
    const downMax = 100;
    let posDown = ((best.d - downMin) / (downMax - downMin)) * 100;
    if (lang === 'he') posDown = 100 - posDown;
    document.getElementById('spotDown').style.left = `calc(${posDown}% + (8px - (0.16px * ${posDown})))`;
    document.getElementById('spotDown').classList.add('visible');

    let posDur = ((best.t - 1) / (30 - 1)) * 100;
    if (lang === 'he') posDur = 100 - posDur;
    const spotDur = document.getElementById('spotDur');
    if (advancedTermMode) {
        // In advanced mode, each track has its own term - hide the single term sweet spot
        spotDur.classList.remove('visible');
    } else {
        spotDur.style.left = `calc(${posDur}% + (8px - (0.16px * ${posDur})))`;
        spotDur.classList.add('visible');
    }

    if (horMode === 'custom' || lockHor) {
        let posHor = ((best.h - 1) / (50 - 1)) * 100;
        if (lang === 'he') posHor = 100 - posHor;
        let spotH = document.getElementById('spotHor');
        spotH.style.left = `calc(${posHor}% + (8px - (0.16px * ${posHor})))`;
        spotH.classList.add('visible');
        spotH.title = `Best CAGR at ${best.h} Years`;
    } else {
        document.getElementById('spotHor').classList.remove('visible');
    }
}

function runSim(opts = {}) {
    if (bootstrapping) return;
    const skipCharts = !!opts.skipCharts;

    let eq = parseFloat(document.getElementById('inpEquity').value) || 400000;
    let downPct = parseInt(document.getElementById('rDown').value) / 100;
    const mainTermSlider = document.getElementById('rDur');
    let mortDur = parseInt(mainTermSlider.value);
    let simDur = horMode === 'auto' ? mortDur : parseInt(document.getElementById('rHor').value);

    document.getElementById('dDown').innerText = (downPct * 100).toFixed(0) + '%';
    const dDurEl = document.getElementById('dDur');
    const dHorEl = document.getElementById('dHor');
    if (lang === 'he') {
        dDurEl.innerHTML = '<span style="direction:ltr;display:inline-block">' + mortDur + ' ' + t('yrSuffix') + '</span>';
        dHorEl.innerHTML = horMode === 'auto' ? t('auto') + ' <span style="direction:ltr;display:inline-block">(' + mortDur + t('ySuffix') + ')</span>' : '<span style="direction:ltr;display:inline-block">' + simDur + ' ' + t('yrSuffix') + '</span>';
    } else {
        dDurEl.innerText = mortDur + ' ' + t('yrSuffix');
        dHorEl.innerText = horMode === 'auto' ? t('auto') + ' (' + mortDur + t('ySuffix') + ')' : simDur + ' ' + t('yrSuffix');
    }

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

    // Purchase tax calculation
    const isFirstHome = buyerType === 'first';
    const includePurchaseTax = document.getElementById('cPurchaseTax')?.checked ?? true;
    const purchaseTax = includePurchaseTax ? AppLogic.calcPurchaseTax(assetPriceStart, isFirstHome) : 0;
    const taxEl = document.getElementById('valPurchaseTax');
    if (taxEl) taxEl.innerText = fmt(purchaseTax) + ' ₪';

    // Update track percentage displays with amounts
    const tracks = ['Prime','Kalats','Malatz','Katz','Matz'];
    tracks.forEach(t => {
        const pct = parseFloat(document.getElementById('pct'+t).value) || 0;
        const el = document.getElementById('disp'+t);
        if (el) {
            const amt = initialLoan * pct / 100;
            el.innerHTML = `${pct}%<br><span style="font-size:0.55rem;color:#64748b;font-weight:400">₪${Math.round(amt/1000)}K</span>`;
        }
    });

    for (let k in cfg) {
        let el = document.getElementById(cfg[k].v);
        if (el) {
            if (cfg[k].is) el.innerText = 'Hist'; else el.innerText = document.getElementById(cfg[k].s).value + '%';
        }
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
        if (lang === 'he') {
            document.getElementById('dDur').innerHTML = '<span style="direction:ltr;display:inline-block">' + mortDur + ' ' + t('yrSuffix') + '</span>';
        } else {
            document.getElementById('dDur').innerText = mortDur + ' ' + t('yrSuffix');
        }
    }

    const effectiveMax = Math.max(maxTrackYears, mortDur);
    if (horMode === 'auto') {
        document.getElementById('rHor').value = effectiveMax;
        if (lang === 'he') {
            document.getElementById('dHor').innerHTML = t('auto') + ' <span style="direction:ltr;display:inline-block">(' + effectiveMax + t('ySuffix') + ')</span>';
        } else {
            document.getElementById('dHor').innerText = t('auto') + ' (' + effectiveMax + t('ySuffix') + ')';
        }
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
            mgmt: parseFloat(document.getElementById('rMer').value) / 100,
            purchaseTax: purchaseTax
        },
        maintPct: parseFloat(document.getElementById('rMaint').value) / 100,
        purchaseDiscount: parseFloat(document.getElementById('rDiscount').value) / 100,
        tax: {
            useSP: document.getElementById('cTaxSP')?.checked ?? true,
            useRE: document.getElementById('cTaxSP')?.checked ?? true,
            useRent: document.getElementById('cRentTax')?.checked ?? false,
            useMasShevach: document.getElementById('cMasShevach')?.checked ?? false,
            masShevachType: buyerType === 'investor' ? 'none' : 'single',
            mode: taxMode
        },
        config: {
            drift: activeDrift,
            surplusMode: surplusMode,
            exMode: exMode,
            history: cfg,
            repayMethod: repayMethod
        },
        prepay: prepayments,
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
    
    const kMasShevach = document.getElementById('kMasShevach');
    if (kMasShevach) kMasShevach.innerText = fmt(res.masShevach || 0) + ' ₪';
    const kCapGains = document.getElementById('kCapGains');
    if (kCapGains) kCapGains.innerText = fmt(res.spTax || 0) + ' ₪';

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
            res.series.surplusVal, res.series.surplusPct,
            { reTax: res.totalRETax, spTax: res.spTax, netRE: res.netRE, netSP: res.netSP, invested: res.totalCashInvested,
              surplusTax: res.reSideTax, surplusGross: res.reSideStockValue });
    }
    saveState();
    document.body.classList.remove('loading');
}

function drawCharts(l, rVal, rPct, sVal, sPct, fRent, fInt, fPrinc, fNet, surplusValSeries, surplusPctSeries, taxInfo = {}) {
    const isDark = document.body.classList.contains('dark');
    const textColor = isDark ? '#e2e8f0' : '#666';
    const gridColor = isDark ? '#475569' : 'rgba(0,0,0,0.1)';

    const ctx1 = document.getElementById('wealthChart').getContext('2d');
    if (wealthChart) wealthChart.destroy();

    let plotR = mode === 'percent' ? rPct : rVal;
    let plotS = mode === 'percent' ? sPct : sVal;
    let plotSurp = mode === 'percent' ? surplusPctSeries : surplusValSeries;
    const reinvestActive = (surplusMode === 'invest');
    let yTxt = mode === 'percent' ? t('chartYAxisROI') : t('chartYAxisWealth');

    // Tax visualization - show after-tax as dashed extension at end
    const { reTax = 0, spTax = 0, netRE = 0, netSP = 0, invested = 0, surplusTax = 0, surplusGross = 0 } = taxInfo;
    const lastIdx = plotR.length - 1;
    const hasRETax = reTax > 0;
    const hasSPTax = spTax > 0;
    const hasSurplusTax = surplusTax > 0;

    // Create extended data with after-tax final point
    let plotRWithTax = [...plotR];
    let plotSWithTax = [...plotS];
    
    if (mode !== 'percent') {
        if (hasRETax) plotRWithTax.push(netRE);
        else plotRWithTax.push(plotR[lastIdx]);
        if (hasSPTax) plotSWithTax.push(netSP);
        else plotSWithTax.push(plotS[lastIdx]);
    } else {
        if (hasRETax) plotRWithTax.push(((netRE - invested) / invested) * 100);
        else plotRWithTax.push(plotR[lastIdx]);
        if (hasSPTax) plotSWithTax.push(((netSP - invested) / invested) * 100);
        else plotSWithTax.push(plotS[lastIdx]);
    }
    
    // Extended labels with "Tax" zone
    const hasTax = hasRETax || hasSPTax || hasSurplusTax;
    const labelsExt = hasTax ? [...l, t('taxDeduction') || 'Tax'] : l;

    let datasets = [
        { 
            label: t('chartRealEstate'), 
            data: plotRWithTax, 
            borderColor: '#16a34a', 
            backgroundColor: 'rgba(22,163,74,0.05)', 
            borderWidth: 3, 
            fill: true, 
            pointRadius: plotRWithTax.map((_, i) => i === plotRWithTax.length - 1 && hasRETax ? 5 : 0),
            pointBackgroundColor: '#0d5c2a',
            pointHoverRadius: 6,
            segment: {
                borderDash: ctx => ctx.p0DataIndex === lastIdx ? [6, 4] : undefined,
                borderColor: ctx => ctx.p0DataIndex === lastIdx && hasRETax ? '#0d5c2a' : undefined
            }
        },
        { 
            label: t('chartSP500'), 
            data: plotSWithTax, 
            borderColor: '#2563eb', 
            backgroundColor: 'rgba(37,99,235,0.05)', 
            borderWidth: 3, 
            fill: true, 
            pointRadius: plotSWithTax.map((_, i) => i === plotSWithTax.length - 1 && hasSPTax ? 5 : 0),
            pointBackgroundColor: '#1e40af',
            pointHoverRadius: 6,
            segment: {
                borderDash: ctx => ctx.p0DataIndex === lastIdx ? [6, 4] : undefined,
                borderColor: ctx => ctx.p0DataIndex === lastIdx && hasSPTax ? '#1e40af' : undefined
            }
        }
    ];

    // Reinvested surplus with tax drop
    if (reinvestActive && plotSurp && plotSurp.some(v => v > 0)) {
        const surplusNet = surplusGross - surplusTax;
        let plotSurpWithTax = [...plotSurp];
        if (hasTax) {
            if (mode !== 'percent') {
                plotSurpWithTax.push(hasSurplusTax ? surplusNet : plotSurp[lastIdx]);
            } else {
                plotSurpWithTax.push(hasSurplusTax ? (surplusNet / invested) * 100 : plotSurp[lastIdx]);
            }
        }
        datasets.push({ 
            label: t('chartReinvested'), 
            data: plotSurpWithTax, 
            borderColor: '#f59e0b', 
            backgroundColor: 'rgba(245,158,11,0.12)', 
            borderWidth: 2, 
            fill: true, 
            pointRadius: plotSurpWithTax.map((_, i) => i === plotSurpWithTax.length - 1 && hasSurplusTax ? 5 : 0),
            pointBackgroundColor: '#b45309',
            pointHoverRadius: 6, 
            segment: {
                borderDash: ctx => ctx.p0DataIndex === lastIdx && hasSurplusTax ? [4, 3] : [6, 4],
                borderColor: ctx => ctx.p0DataIndex === lastIdx && hasSurplusTax ? '#b45309' : undefined
            }
        });
    }

    wealthChart = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: labelsExt,
            datasets: datasets
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: c => {
                            const idx = c.dataIndex;
                            const lbl = c.dataset.label;
                            const isLastPoint = idx === plotRWithTax.length - 1 && hasTax;
                            
                            if (lbl === t('chartRealEstate')) {
                                if (isLastPoint && hasRETax) {
                                    return `${lbl}: ${fmt(netRE)} ₪ (−${fmt(reTax)} ₪ ${t('taxPaid') || 'tax'})`;
                                }
                                return `${lbl}: ${fmt(rVal[idx] || netRE)} ₪`;
                            }
                            if (lbl === t('chartSP500')) {
                                if (isLastPoint && hasSPTax) {
                                    return `${lbl}: ${fmt(netSP)} ₪ (−${fmt(spTax)} ₪ ${t('taxPaid') || 'tax'})`;
                                }
                                return `${lbl}: ${fmt(sVal[idx] || netSP)} ₪`;
                            }
                            if (lbl === t('chartReinvested')) {
                                if (isLastPoint && hasSurplusTax) {
                                    const surplusNet = surplusGross - surplusTax;
                                    return `${lbl}: ${fmt(surplusNet)} ₪ (−${fmt(surplusTax)} ₪ ${t('taxPaid') || 'tax'})`;
                                }
                                return `${lbl}: ${fmt(surplusValSeries[idx] || 0)} ₪`;
                            }
                            return `${lbl}: ${fmt(c.raw)} ₪`;
                        }
                    }
                },
                legend: { labels: { color: textColor } }
            },
            scales: {
                y: { title: { display: true, text: yTxt, color: textColor }, ticks: { color: textColor, callback: v => mode === 'percent' ? v + '%' : fmt(v) }, grid: { color: gridColor } },
                x: { 
                    ticks: { 
                        color: textColor,
                        maxRotation: 0,
                        minRotation: 0,
                        callback: (val, idx) => {
                            if (idx === labelsExt.length - 1 && hasTax) return ''; // Hide tax label (drawn manually)
                            return labelsExt[idx];
                        }
                    }, 
                    grid: { color: gridColor } 
                }
            }
        },
        plugins: hasTax ? [{
            id: 'taxZone',
            afterDraw: (chart) => {
                const { ctx, chartArea, scales } = chart;
                const xScale = scales.x;
                const lastX = xScale.getPixelForValue(lastIdx);
                const endX = chartArea.right;
                ctx.save();
                // Shaded background
                ctx.fillStyle = isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)';
                ctx.fillRect(lastX, chartArea.top, endX - lastX, chartArea.bottom - chartArea.top);
                // Vertical separator line
                ctx.strokeStyle = isDark ? 'rgba(239,68,68,0.6)' : 'rgba(239,68,68,0.5)';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 3]);
                ctx.beginPath();
                ctx.moveTo(lastX, chartArea.top);
                ctx.lineTo(lastX, chartArea.bottom);
                ctx.stroke();
                // Centered label inside chart (above x-axis)
                const centerX = (lastX + endX) / 2;
                const labelY = chartArea.bottom - 10;
                ctx.fillStyle = '#dc2626';
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(t('taxDeduction') || 'Tax', centerX, labelY);
                ctx.restore();
            }
        }] : []
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
                { type: 'line', label: t('chartNetCashflow'), data: fNet, borderColor: isDark ? '#e2e8f0' : '#0f172a', borderWidth: 4, pointRadius: 3, tension: 0.3, order: 1, fill: false },
                { type: 'line', label: t('chartRentMinusInt'), data: netRentAfterInt, borderColor: '#f59e0b', borderWidth: 2, pointRadius: 0, tension: 0.2, order: 2, fill: false, borderDash: [6, 3] },
                { type: 'bar', label: t('chartRevenue'), data: fRent, backgroundColor: '#22c55e', stack: 'Stack 0', order: 3, borderWidth: 0 },
                { type: 'bar', label: t('chartInterest'), data: fInt, backgroundColor: '#ef4444', stack: 'Stack 0', order: 4, borderWidth: 0 },
                { type: 'bar', label: t('chartPrincipal'), data: fPrinc, backgroundColor: '#fca5a5', stack: 'Stack 0', order: 5, borderWidth: 0 }
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
                                return `${t('chartTotalMortgage')}: \u200E${fmtNum(totalMortgage[idx])} ₪`;
                            }
                        },
                        label: c => {
                            let v = Math.abs(c.raw);
                            let lbl = c.dataset.label;
                            const num = n => '\u200E' + fmtNum(n);
                            if (lbl === t('chartRentMinusInt')) return `${t('tooltipRentMinusInt')}: ${num(c.raw)} ₪`;
                            if (lbl === t('chartInterest')) {
                                let idx = c.dataIndex;
                                let iVal = Math.abs(c.chart.data.datasets[3].data[idx]);
                                let pVal = Math.abs(c.chart.data.datasets[4].data[idx]);
                                let total = iVal + pVal;
                                let pct = total > 0 ? ((iVal / total) * 100).toFixed(0) : 0;
                                return `${t('tooltipInterest')}: ${num(iVal)} (${pct}%)`;
                            }
                            if (lbl === t('chartPrincipal')) return `${t('tooltipPrincipal')}: ${num(v)}`;
                            if (lbl === t('chartRevenue')) return `${t('tooltipRent')}: ${num(v)}`;
                            return `${t('tooltipNet')}: ${num(c.raw)}`;
                        }
                    }
                },
                legend: { labels: { color: textColor } }
            },
            scales: {
                y: { title: { display: true, text: t('chartYAxisMonthly'), color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } },
                x: { stacked: true, ticks: { color: textColor }, grid: { color: gridColor } }
            }
        }
    });
}

// --- PERSISTENCE ---
const STORAGE_KEY = 'mortgageCalcState';

function saveState() {
    const state = {
        // Sliders
        equity: document.getElementById('inpEquity')?.value,
        down: document.getElementById('rDown')?.value,
        dur: document.getElementById('rDur')?.value,
        hor: document.getElementById('rHor')?.value,
        // Mix
        pctPrime: document.getElementById('pctPrime')?.value,
        pctKalats: document.getElementById('pctKalats')?.value,
        pctMalatz: document.getElementById('pctMalatz')?.value,
        pctKatz: document.getElementById('pctKatz')?.value,
        pctMatz: document.getElementById('pctMatz')?.value,
        // Rates
        ratePrime: document.getElementById('ratePrime')?.value,
        rateKalats: document.getElementById('rateKalats')?.value,
        rateMalatz: document.getElementById('rateMalatz')?.value,
        rateKatz: document.getElementById('rateKatz')?.value,
        rateMatz: document.getElementById('rateMatz')?.value,
        // Advanced terms
        termPrime: document.getElementById('termPrime')?.value,
        termKalats: document.getElementById('termKalats')?.value,
        termMalatz: document.getElementById('termMalatz')?.value,
        termKatz: document.getElementById('termKatz')?.value,
        termMatz: document.getElementById('termMatz')?.value,
        advancedTermMode,
        // Market assumptions
        sSP: document.getElementById('sSP')?.value,
        sApp: document.getElementById('sApp')?.value,
        sInf: document.getElementById('sInf')?.value,
        sInt: document.getElementById('sInt')?.value,
        sYld: document.getElementById('sYld')?.value,
        // Fees
        rBuyCost: document.getElementById('rBuyCost')?.value,
        rSellCost: document.getElementById('rSellCost')?.value,
        rTrade: document.getElementById('rTrade')?.value,
        rMer: document.getElementById('rMer')?.value,
        rMaint: document.getElementById('rMaint')?.value,
        rDiscount: document.getElementById('rDiscount')?.value,
        // State
        horMode, surplusMode, repayMethod, creditScore, taxMode, exMode,
        lockDown, lockTerm, lockHor, buyerType, mode,
        prepayments,
        usePurchaseTax: document.getElementById('cPurchaseTax')?.checked ?? true,
        useMasShevach: document.getElementById('cMasShevach')?.checked ?? false
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e) {}
}

function loadState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return false;
        const s = JSON.parse(saved);

        // Restore inputs
        const setVal = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
        setVal('inpEquity', s.equity);
        setVal('rDown', s.down);
        setVal('rDur', s.dur);
        setVal('rHor', s.hor);
        setVal('pctPrime', s.pctPrime); setVal('sliderPrime', s.pctPrime);
        setVal('pctKalats', s.pctKalats); setVal('sliderKalats', s.pctKalats);
        setVal('pctMalatz', s.pctMalatz); setVal('sliderMalatz', s.pctMalatz);
        setVal('pctKatz', s.pctKatz); setVal('sliderKatz', s.pctKatz);
        setVal('pctMatz', s.pctMatz); setVal('sliderMatz', s.pctMatz);
        setVal('ratePrime', s.ratePrime);
        setVal('rateKalats', s.rateKalats);
        setVal('rateMalatz', s.rateMalatz);
        setVal('rateKatz', s.rateKatz);
        setVal('rateMatz', s.rateMatz);
        setVal('termPrime', s.termPrime);
        setVal('termKalats', s.termKalats);
        setVal('termMalatz', s.termMalatz);
        setVal('termKatz', s.termKatz);
        setVal('termMatz', s.termMatz);
        setVal('sSP', s.sSP);
        setVal('sApp', s.sApp);
        setVal('sInf', s.sInf);
        setVal('sInt', s.sInt);
        setVal('sYld', s.sYld);
        setVal('rBuyCost', s.rBuyCost);
        setVal('rSellCost', s.rSellCost);
        setVal('rTrade', s.rTrade);
        setVal('rMer', s.rMer);
        setVal('rMaint', s.rMaint);
        setVal('rDiscount', s.rDiscount);

        // Restore state vars
        if (s.horMode) horMode = s.horMode;
        if (s.surplusMode) surplusMode = s.surplusMode;
        if (s.repayMethod) repayMethod = s.repayMethod;
        if (s.creditScore) creditScore = s.creditScore;
        if (s.taxMode) taxMode = s.taxMode;
        if (s.exMode) exMode = s.exMode;
        if (s.lockDown != null) lockDown = s.lockDown;
        if (s.lockTerm != null) lockTerm = s.lockTerm;
        if (s.lockHor != null) lockHor = s.lockHor;
        if (s.prepayments) prepayments = s.prepayments;
        if (s.advancedTermMode != null) advancedTermMode = s.advancedTermMode;
        if (s.buyerType) buyerType = s.buyerType;
        if (s.mode) mode = s.mode;
        if (s.usePurchaseTax != null) {
            const el = document.getElementById('cPurchaseTax');
            if (el) el.checked = s.usePurchaseTax;
        }
        if (s.useMasShevach != null) {
            const el = document.getElementById('cMasShevach');
            if (el) el.checked = s.useMasShevach;
        }

        return true;
    } catch(e) { return false; }
}

function bootstrap() {
    bootstrapping = true;
    // Restore dark mode first (before any rendering)
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark');
    }
    // Restore language
    if (lang === 'he') {
        document.documentElement.lang = 'he';
        document.documentElement.dir = 'rtl';
        document.body.classList.add('rtl');
    }
    applyTranslations();
    const hadSaved = loadState();
    updMeter();
    updateLockUI();
    updateCreditUI();
    applyLtvCaps();
    if (!hadSaved) refreshRatesForProfile();
    updateRateLabels();
    setSurplusMode(surplusMode, { skipSim: true });
    setGlobalMode(false, { skipSim: true });
    if (!hadSaved) applyScenario('base', { skipSim: true });
    setMode(hadSaved && mode ? mode : 'currency', { skipSim: true });
    // Restore horMode UI
    if (horMode === 'custom') {
        document.getElementById('pHor').children[0].classList.remove('active');
        document.getElementById('pHor').children[1].classList.add('active');
        document.getElementById('bHor').classList.add('show');
    }
    checkMix();
    renderPrepayments();
    if (advancedTermMode) {
        const panel = document.getElementById('advancedTermBox');
        const basic = document.getElementById('basicTermBox');
        const btn = document.getElementById('btnAdvancedTerm');
        if (panel) panel.style.display = 'block';
        if (basic) basic.style.display = 'none';
        if (btn) btn.classList.add('active');
        // Update term display values
        ['Prime','Kalats','Malatz','Katz','Matz'].forEach(t => {
            const inp = document.getElementById('term' + t);
            if (inp) showTermVal('term' + t + 'Val', inp.value);
        });
    }
    bootstrapping = false;
    runSim();
}

function updateRateLabels() {
    const tracks = ['Prime', 'Kalats', 'Malatz', 'Katz', 'Matz'];
    tracks.forEach(track => {
        const lbl = document.getElementById('lblRate' + track);
        const inp = document.getElementById('rate' + track);
        if (lbl && inp) {
            let suffix = (track === 'Katz' || track === 'Matz') ? '% ' + t('cpiSuffix') : '%';
            lbl.innerText = parseFloat(inp.value).toFixed(2) + suffix;
        }
    });
}

// --- UTILITY FUNCTIONS ---
function resetAll() {
    if (!confirm('Reset all settings to defaults?')) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
}

function toggleDarkMode() {
    document.body.classList.toggle('dark');
    localStorage.setItem('darkMode', document.body.classList.contains('dark'));
    runSim(); // Redraw charts with new colors
}

function printResults() {
    window.print();
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
window.toggleLang = toggleLang;
window.resetAll = resetAll;
window.toggleDarkMode = toggleDarkMode;
window.printResults = printResults;

document.addEventListener('DOMContentLoaded', bootstrap);
