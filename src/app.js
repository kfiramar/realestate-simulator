const AppLogic = window.Logic || {};
const T = window.i18n?.T || { en: {}, he: {} };
const { SCENARIOS, TAMHEEL_PROFILES, ANCHORS, CREDIT_MATRIX, TERM_MIN, TERM_MAX, LTV_MIN } = window.AppConfig || {};

// --- TRANSLATIONS ---
let lang = window.i18n?.getLang() || 'en';

function t(key) { return (T[lang] && T[lang][key]) || (T['en'] && T['en'][key]) || key; }

function toggleLang() {
    lang = lang === 'en' ? 'he' : 'en';
    window.i18n?.setLang(lang);
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

// --- STATE (using AppState module) ---
const S = window.AppState || { get: () => null, set: () => {}, getAll: () => ({}), setAll: () => {} };

// Convenience getters/setters for backward compatibility
let mode, exMode, taxMode, horMode, lockDown, lockTerm, lockHor, buyerType, advancedTermMode, bootstrapping, creditScore, surplusMode, repayMethod, optimizeMode, rateEditMode;

function syncStateFromModule() {
    const s = S.getAll();
    mode = s.mode; exMode = s.exMode; taxMode = s.taxMode; horMode = s.horMode;
    lockDown = s.lockDown; lockTerm = s.lockTerm; lockHor = s.lockHor;
    buyerType = s.buyerType; advancedTermMode = s.advancedTermMode;
    bootstrapping = s.bootstrapping; creditScore = s.creditScore;
    surplusMode = s.surplusMode; repayMethod = s.repayMethod;
    optimizeMode = s.optimizeMode; rateEditMode = s.rateEditMode;
}
function setState(key, value) {
    S.set(key, value);
    // Update local variable
    switch(key) {
        case 'mode': mode = value; break;
        case 'exMode': exMode = value; break;
        case 'taxMode': taxMode = value; break;
        case 'horMode': horMode = value; break;
        case 'lockDown': lockDown = value; break;
        case 'lockTerm': lockTerm = value; break;
        case 'lockHor': lockHor = value; break;
        case 'buyerType': buyerType = value; break;
        case 'advancedTermMode': advancedTermMode = value; break;
        case 'bootstrapping': bootstrapping = value; break;
        case 'creditScore': creditScore = value; break;
        case 'surplusMode': surplusMode = value; break;
        case 'repayMethod': repayMethod = value; break;
        case 'optimizeMode': optimizeMode = value; break;
        case 'rateEditMode': rateEditMode = value; break;
    }
}
syncStateFromModule();

const cfg = {
    SP: { is: false, b: 'bSP', s: 'sSP', v: 'vSP', p: 'pSP' },
    App: { is: false, b: 'bApp', s: 'sApp', v: 'vApp', p: 'pApp' },
    Int: { is: false, b: 'bInt', s: 'sInt', v: 'vInt', p: 'pInt' },
    Yld: { is: false, b: 'bYld', s: 'sYld', v: 'vYld', p: 'pYld' },
    Inf: { is: false, b: 'bInf', s: 'sInf', v: 'vInf', p: 'pInf' }
};

// --- UI FUNCTIONS ---
function setMode(m, opts = {}) {
    setState('mode', m);
    // Alpine handles visibility and class toggling
    document.getElementById('equityBox')?.classList.toggle('show', m === 'currency');
    if (!opts.skipSim) runSim();
}
function tgl(k, h, opts = {}) {
    cfg[k].is = h;
    setState('hist' + k, h); // Sync to Alpine store
    // Keep for non-Alpine environments
    const pEl = document.getElementById(cfg[k].p);
    if (pEl) {
        pEl.children[0]?.classList.toggle('active', h);
        pEl.children[1]?.classList.toggle('active', !h);
    }
    document.getElementById(cfg[k].b)?.classList.toggle('show', !h);
    if (k === 'Inf') updMeter();
    if (!opts.skipSim) runSim();
}
function setGlobalMode(isHist, opts = {}) {
    setState('globalHistMode', isHist);
    // Keep for non-Alpine environments
    const pGlobal = document.getElementById('pGlobal');
    if (pGlobal) {
        pGlobal.children[0]?.classList.toggle('active', isHist);
        pGlobal.children[1]?.classList.toggle('active', !isHist);
    }
    document.getElementById('scenBox')?.classList.toggle('show', !isHist);
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
    setState('creditScore', parseInt(v, 10) || creditScore);
    updateCreditUI();
    applyLtvCaps();
    refreshRatesForProfile();
    updateRateLabels();
    runSim();
}

function tglHor(isAuto) {
    setState('horMode', isAuto ? 'auto' : 'custom');
    // Keep for non-Alpine environments (tests)
    const pHor = document.getElementById('pHor');
    if (pHor) {
        pHor.children[0]?.classList.toggle('active', isAuto);
        pHor.children[1]?.classList.toggle('active', !isAuto);
    }
    document.getElementById('bHor')?.classList.toggle('show', !isAuto);
    if (isAuto) { setState('lockHor', true); }
    runSim();
}

function setTaxMode(m) {
    setState('taxMode', m);
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
    if (target === 'down') setState('lockDown', !lockDown);
    if (target === 'term') setState('lockTerm', !lockTerm);
    if (target === 'hor') {
        if (horMode === 'auto' && lockHor) {
            setState('horMode', 'custom');
            document.getElementById('pHor').children[0].classList.remove('active');
            document.getElementById('pHor').children[1].classList.add('active');
            document.getElementById('bHor').classList.add('show');
        }
        setState('lockHor', !lockHor);
    }
    updateLockUI();
    runSim({ skipCharts: true });
}

function setBuyerType(type) {
    setState('buyerType', type);
    applyLtvCaps();
    runSim();
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
    setState('advancedTermMode', !advancedTermMode);
    // Alpine x-show handles visibility, keep for non-Alpine environments
    const advBox = document.getElementById('advancedTermBox');
    const basicBox = document.getElementById('basicTermBox');
    const btn = document.getElementById('btnAdvancedTerm');
    if (advBox) advBox.style.display = advancedTermMode ? 'block' : 'none';
    if (basicBox) basicBox.style.display = advancedTermMode ? 'none' : 'block';
    if (btn) btn.classList.toggle('active', advancedTermMode);
    syncTrackTermsToMain();
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
    window.Prepayments?.renderPrepayments(); // Update prepayment dropdowns when tracks change
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

function toggleRateEdit() {
    setState('rateEditMode', !rateEditMode);
    // Keep for non-Alpine environments
    const tracks = ['Prime', 'Kalats', 'Malatz', 'Katz', 'Matz'];
    tracks.forEach(track => {
        const lbl = document.getElementById('lblRate' + track);
        const inp = document.getElementById('rate' + track);
        if (lbl) lbl.style.display = rateEditMode ? 'none' : 'block';
        if (inp) inp.classList.toggle('show', rateEditMode);
        if (!rateEditMode && lbl && inp) {
            let suffix = (track === 'Katz' || track === 'Matz') ? '% ' + t('cpiSuffix') : '%';
            lbl.innerText = parseFloat(inp.value).toFixed(2) + suffix;
        }
    });
}

function togglePrepaySection() {
    // Alpine handles visibility via x-show, keep for non-Alpine environments
    const container = document.getElementById('prepayContainer');
    const arrow = document.getElementById('prepayArrow');
    const isOpen = container?.style.display !== 'none';
    if (container) container.style.display = isOpen ? 'none' : 'block';
    if (arrow) arrow.textContent = isOpen ? '+' : '−';
}

// Prepayments - delegated to module
function getPrepayments() { return window.Prepayments?.getPrepayments() || []; }

function syncPrime() {
    refreshRatesForProfile();
    updateRateLabels();
    runSim();
}

function setSurplusMode(m, opts = {}) {
    setState('surplusMode', m);
    // Class toggling for non-Alpine environments (tests)
    document.getElementById('surplusConsume')?.classList.toggle('active', m === 'consume');
    document.getElementById('surplusMatch')?.classList.toggle('active', m === 'match');
    document.getElementById('surplusInvest')?.classList.toggle('active', m === 'invest');
    const descEl = document.getElementById('surplusDescText') || document.getElementById('surplusDesc');
    if (descEl) {
        if (m === 'invest') descEl.innerText = t('surplusDescInvest');
        else if (m === 'consume') descEl.innerText = t('surplusDescConsume');
        else if (m === 'match') descEl.innerText = t('surplusDescMatch');
    }
    if (!opts.skipSim) runSim();
}

function setRepayMethod(m) {
    setState('repayMethod', m);
    // Alpine handles pill class toggling via :class binding
    runSim();
}

function setOptimizeMode(m) {
    setState('optimizeMode', m);
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
        prepay: getPrepayments(),
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
        window.Charts.drawCharts(res.series.labels, res.series.reDataVal, res.series.reDataPct, res.series.spDataVal, res.series.spDataPct,
            res.series.flowRent, res.series.flowInt, res.series.flowPrinc, res.series.flowNet,
            res.series.surplusVal, res.series.surplusPct,
            { reTax: res.totalRETax, spTax: res.spTax, netRE: res.netRE, netSP: res.netSP, invested: res.totalCashInvested,
              surplusTax: res.reSideTax, surplusGross: res.reSideStockValue },
            { mode, surplusMode, t, fmt, fmtNum });
    }
    saveState();
    document.body.classList.remove('loading');
}

// --- PERSISTENCE ---

// --- PERSISTENCE ---
const STORAGE_KEY = window.Persistence?.STORAGE_KEY || 'mortgageCalcState';
const P = window.Persistence || { save: () => {}, load: () => null, restore: () => null, clear: () => {} };

function saveState() {
    const stateVars = {
        horMode, surplusMode, repayMethod, creditScore, taxMode, exMode,
        lockDown, lockTerm, lockHor, buyerType, mode, advancedTermMode
    };
    P.save(stateVars, getPrepayments);
}

function loadState() {
    const saved = P.load();
    if (!saved) return false;
    const s = P.restore(saved);
    if (!s) return false;

    // Restore state vars
    if (s.horMode) setState('horMode', s.horMode);
    if (s.surplusMode) setState('surplusMode', s.surplusMode);
    if (s.repayMethod) setState('repayMethod', s.repayMethod);
    if (s.creditScore) setState('creditScore', s.creditScore);
    if (s.taxMode) setState('taxMode', s.taxMode);
    if (s.exMode) setState('exMode', s.exMode);
    if (s.lockDown != null) setState('lockDown', s.lockDown);
    if (s.lockTerm != null) setState('lockTerm', s.lockTerm);
    if (s.lockHor != null) setState('lockHor', s.lockHor);
    if (s.prepayments) window.Prepayments?.setPrepayments(s.prepayments);
    if (s.advancedTermMode != null) setState('advancedTermMode', s.advancedTermMode);
    if (s.buyerType) setState('buyerType', s.buyerType);
    if (s.mode) setState('mode', s.mode);

    return true;
}

function bootstrap() {
    bootstrapping = true;
    // Initialize prepayments module
    window.Prepayments?.init(runSim);
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
    window.Prepayments?.renderPrepayments();
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
    P.clear();
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
