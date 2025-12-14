const AppLogic = window.Logic || {};
const T = window.i18n?.T || { en: {}, he: {} };
const { SCENARIOS, TAMHEEL_PROFILES, ANCHORS, CREDIT_MATRIX, TERM_MIN, TERM_MAX, LTV_MIN } = window.AppConfig || {};

// --- DOM HELPERS ---
const $ = id => document.getElementById(id);
const $pct = id => parseFloat($(id)?.value || 0) / 100;
const $int = id => parseInt($(id)?.value || 0);
const $pill = (id, isFirst) => { const p = $(id); if (p) { p.children[0]?.classList.toggle('active', isFirst); p.children[1]?.classList.toggle('active', !isFirst); } };
const $ltr = txt => lang === 'he' ? `<span style="direction:ltr;display:inline-block">${txt}</span>` : txt;

// --- TRANSLATIONS ---
let lang = window.i18n?.getLang() || 'en';

function t(key) { return (T[lang] && T[lang][key]) || (T['en'] && T['en'][key]) || key; }

function toggleLang() {
    lang = lang === 'en' ? 'he' : 'en';
    window.i18n?.setLang(lang);
    localStorage.setItem('lang', lang);
    const isHe = lang === 'he';
    document.documentElement.lang = lang;
    document.documentElement.dir = isHe ? 'rtl' : 'ltr';
    document.body.classList.toggle('rtl', isHe);
    applyTranslations();
}

function applyTranslations() {
    document.querySelectorAll('[data-t]').forEach(el => {
        const lockChild = el.querySelector('.lock-toggle');
        if (lockChild) {
            if (el.firstChild?.nodeType === 3) el.firstChild.textContent = t(el.dataset.t);
        } else {
            el.textContent = t(el.dataset.t);
        }
    });
    document.querySelectorAll('[data-t-placeholder]').forEach(el => el.placeholder = t(el.dataset.tPlaceholder));
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

const stateVars = { mode: v => mode = v, exMode: v => exMode = v, taxMode: v => taxMode = v, horMode: v => horMode = v,
    lockDown: v => lockDown = v, lockTerm: v => lockTerm = v, lockHor: v => lockHor = v, buyerType: v => buyerType = v,
    advancedTermMode: v => advancedTermMode = v, bootstrapping: v => bootstrapping = v, creditScore: v => creditScore = v,
    surplusMode: v => surplusMode = v, repayMethod: v => repayMethod = v, optimizeMode: v => optimizeMode = v, rateEditMode: v => rateEditMode = v };

function setState(key, value) {
    S.set(key, value);
    stateVars[key]?.(value);
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
    $('equityBox')?.classList.toggle('show', m === 'currency');
    if (!opts.skipSim) runSim();
}
function tgl(k, h, opts = {}) {
    cfg[k].is = h;
    setState('hist' + k, h); // Sync to Alpine store
    $pill(cfg[k].p, h);
    $(cfg[k].b)?.classList.toggle('show', !h);
    if (k === 'Inf') updMeter();
    if (!opts.skipSim) runSim();
}
function setGlobalMode(isHist, opts = {}) {
    setState('globalHistMode', isHist);
    $pill('pGlobal', isHist);
    $('scenBox')?.classList.toggle('show', !isHist);
    for (let k in cfg) { tgl(k, isHist, opts); }
}
function applyScenario(type, opts = {}) {
    const s = SCENARIOS[type];
    ['SP','App','Int','Inf','Yld'].forEach(k => $('s' + k).value = s[k.toLowerCase()]);
    ['bear','base','bull'].forEach(t => $('scen' + t.charAt(0).toUpperCase() + t.slice(1))?.classList.toggle('active', type === t));

    refreshRatesForProfile();
    updateRateLabels();
    updateCreditUI();
    applyLtvCaps();
    updMeter();
    if (!opts.skipSim) runSim();
}

function applyTamheel(type) {
    const p = TAMHEEL_PROFILES[type];
    const map = {Prime: ['p','tP'], Kalats: ['k','tK'], Katz: ['z','tZ'], Malatz: ['m','tM'], Matz: ['mt','tMt']};
    Object.entries(map).forEach(([track, [pctKey, termKey]]) => {
        $('pct' + track).value = p[pctKey] || 0;
        $('term' + track).value = p[termKey];
        $('term' + track + 'Val').textContent = p[termKey] + 'y';
    });
    if (!advancedTermMode) toggleAdvancedTerms();
    checkMix();
}

function mapScoreToTierKey(score) {
    const thresholds = [[950,'A'],[900,'B'],[850,'C'],[800,'D'],[750,'E'],[700,'F'],[660,'G']];
    return thresholds.find(([t]) => (score || 0) >= t)?.[1] || 'H';
}

function getCreditTier(score) {
    const key = mapScoreToTierKey(score);
    const t = CREDIT_MATRIX[key];
    return { tier: key, ...t };
}

function applyLtvCaps() {
    const downSlider = $('rDown');
    if (!downSlider) return;
    const tier = getCreditTier(creditScore);
    if (tier.maxLTV === 0) return;

    const finalMinDown = 100 - Math.min(1 - (LTV_MIN[buyerType] || 25) / 100, tier.maxLTV) * 100;
    downSlider.min = finalMinDown;
    if (parseInt(downSlider.value, 10) < finalMinDown) downSlider.value = finalMinDown;
}

function updateCreditUI() {
    const tier = getCreditTier(creditScore);
    $('creditScoreVal')?.innerText && ($('creditScoreVal').innerText = tier.range[0] + '-' + tier.range[1]);
    $('creditTierLabel')?.innerText && ($('creditTierLabel').innerText = `Risk Tier: ${tier.tier}`);
    const warnEl = $('creditWarn');
    if (warnEl) {
        warnEl.style.display = tier.maxLTV === 0 ? 'block' : 'none';
        if (tier.maxLTV === 0) warnEl.innerText = 'Application rejected: score below 660';
    }
}

function refreshRatesForProfile() {
    const tier = getCreditTier(parseInt(creditScore, 10));
    const base = parseFloat($('sInt').value) || 4.25;
    const rateMap = {Prime: ['prime', 'riskP'], Kalats: ['kalats', 'riskK'], Malatz: ['malatz', 'riskK'], Katz: ['katz', 'riskZ'], Matz: ['matz', 'riskZ']};
    Object.entries(rateMap).forEach(([track, [anchor, risk]]) => {
        const el = $('rate' + track);
        if (el && tier[risk] !== null) el.value = Math.max(0.1, base + ANCHORS[anchor] + tier[risk]).toFixed(2);
    });
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
    $pill('pHor', isAuto);
    $('bHor')?.classList.toggle('show', !isAuto);
    if (isAuto) { setState('lockHor', true); }
    runSim();
}

function setTaxMode(m) {
    setState('taxMode', m);
    $('txReal').classList.toggle('active', m === 'real');
    $('txForex').classList.toggle('active', m === 'forex');
    const label = m === 'real' ? 'Real' : 'Nominal';
    const vTaxMode = $('vTaxMode');
    if (vTaxMode) vTaxMode.innerText = label;
    runSim();
}
function updateLockUI() {
    const locks = {Down: lockDown, Term: lockTerm, Hor: lockHor};
    Object.entries(locks).forEach(([k, v]) => {
        const el = $('lock' + k + 'Btn');
        if (el) { el.classList.toggle('locked', v); el.innerText = v ? t('locked') : t('free'); }
    });
    const summaryEl = $('optModeLabel');
    if (summaryEl) {
        const active = Object.entries(locks).filter(([,v]) => v).map(([k]) => k === 'Hor' ? 'Horizon' : k);
        summaryEl.innerText = active.length ? active.join(' & ') : t('free');
    }
}
function toggleLock(target) {
    if (target === 'down') setState('lockDown', !lockDown);
    if (target === 'term') setState('lockTerm', !lockTerm);
    if (target === 'hor') {
        if (horMode === 'auto' && lockHor) {
            setState('horMode', 'custom');
            $pill('pHor', false);
            $('bHor').classList.add('show');
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
    const el = $(elId);
    if (el) el.innerHTML = $ltr(v + ' ' + t('ySuffix'));
}

function syncTrackTermsToMain() {
    const dur = $('rDur').value;
    ['Prime','Kalats','Katz','Malatz','Matz'].forEach(t => {
        $('term' + t).value = dur;
        showTermVal('term' + t + 'Val', dur);
    });
}

function toggleAdvancedTerms() {
    setState('advancedTermMode', !advancedTermMode);
    $('advancedTermBox').style.display = advancedTermMode ? 'block' : 'none';
    $('basicTermBox').style.display = advancedTermMode ? 'none' : 'block';
    $('btnAdvancedTerm')?.classList.toggle('active', advancedTermMode);
    syncTrackTermsToMain();
    runSim();
}
function updMeter() {
    const v = parseFloat($('sInf').value), s = $('infMeter').children;
    [v < 2, v >= 2 && v < 4, v >= 4].forEach((active, i) => s[i].style.opacity = active ? 1 : 0.2);
}

function fmt(v) {
    if (Math.abs(v) >= 1000000) return (v / 1000000).toFixed(2) + 'M';
    if (Math.abs(v) >= 1000) return (v / 1000).toFixed(0) + 'k';
    return v.toFixed(0);
}
function fmtNum(v) { return v.toLocaleString('en-US', { maximumFractionDigits: 0 }); }
function fmtVal(v) { return mode === 'percent' ? v.toFixed(1) + '%' : fmt(v) + ' ₪'; }

// Update slider value display labels
function updateSliderLabels() {
    const sliders = {Trade: 1, Mer: 2, Discount: 0, BuyCost: 1, Maint: 0, SellCost: 1};
    Object.entries(sliders).forEach(([k, dec]) => $('v' + k).innerText = parseFloat($('r' + k).value).toFixed(dec) + '%');
}

// Update deal structure display (asset, leverage, mortgage, tax)
function updateDealDisplay(eq, downPct, initialLoan) {
    const assetPriceStart = eq / downPct;
    const lev = 1 / downPct;
    $('valAsset').innerText = fmt(assetPriceStart) + ' ₪';
    $('valLev').innerText = 'x' + lev.toFixed(1);
    $('barLev').style.width = Math.min(((lev - 1) / 4) * 100, 100) + '%';
    $('valMortgage').innerText = fmt(initialLoan) + ' ₪';

    const isFirstHome = buyerType === 'first';
    const includePurchaseTax = $('cPurchaseTax')?.checked ?? true;
    const purchaseTax = includePurchaseTax ? AppLogic.calcPurchaseTax(assetPriceStart, isFirstHome) : 0;
    const taxEl = $('valPurchaseTax');
    if (taxEl) taxEl.innerText = fmt(purchaseTax) + ' ₪';

    // Update track percentage displays with amounts
    ['Prime','Kalats','Malatz','Katz','Matz'].forEach(track => {
        const pct = parseFloat($('pct'+track)?.value) || 0;
        const el = $('disp'+track);
        if (el) {
            const amt = initialLoan * pct / 100;
            el.innerHTML = `${pct}%<br><span style="font-size:0.55rem;color:#64748b;font-weight:400">₪${Math.round(amt/1000)}K</span>`;
        }
    });

    return { assetPriceStart, purchaseTax };
}

function updateTrackTermEnabled() {
    const tracks = {Prime: 'pctPrime', Kalats: 'pctKalats', Katz: 'pctKatz', Malatz: 'pctMalatz', Matz: 'pctMatz'};
    Object.entries(tracks).forEach(([t, pctId]) => {
        const el = $('term' + t);
        if (el) el.disabled = (parseFloat($(pctId).value) || 0) <= 0;
    });
}

function syncMixInput(track) {
    const slider = $('slider' + track);
    const tracks = ['Prime', 'Kalats', 'Katz', 'Malatz', 'Matz'];
    const othersSum = tracks.filter(t => t !== track).reduce((sum, t) => sum + $int('pct' + t), 0);
    const maxAllowed = 100 - othersSum;
    const newVal = Math.min(parseInt(slider.value) || 0, maxAllowed);

    if (parseInt(slider.value) > maxAllowed) showMaxTooltip(slider, maxAllowed);
    slider.value = newVal;
    $('pct' + track).value = newVal;
    $('disp' + track).innerText = newVal + '%';

    checkMix();
    window.Prepayments?.renderPrepayments();
}

function showMaxTooltip(el, maxVal) {
    let tip = $('maxTip');
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
    const bar = $('mixVisualBar');
    if (!bar) return;
    [p, k, m, z, mt].forEach((v, i) => bar.children[i].style.width = v + '%');
}

function checkMix() {
    const tracks = ['Prime', 'Kalats', 'Katz', 'Malatz', 'Matz'];
    const vals = tracks.map(t => $int('pct' + t));
    const [p, k, z, m, mt] = vals;

    // Sync sliders
    tracks.forEach((t, i) => {
        $('slider' + t).value = vals[i];
        $('disp' + t).innerText = vals[i] + '%';
    });

    updateVisualBar(p, k, m, z, mt);

    const sum = vals.reduce((a, b) => a + b, 0);
    const fixedPct = k + z;
    const fixedOk = fixedPct >= 33;

    const el = $('valMixSum');
    el.innerText = sum + "%";
    el.style.display = sum === 100 ? 'none' : 'block';
    el.style.color = sum === 100 ? '#16a34a' : '#ef4444';
    
    $('mixWarn')?.style && ($('mixWarn').style.display = sum === 100 ? 'none' : 'block');
    
    const dimCharts = sum !== 100 || !fixedOk;
    $('chartsContainer')?.classList.toggle('charts-dim', dimCharts);
    
    const chartsWarn = $('chartsWarn');
    if (chartsWarn) {
        const msg = sum !== 100 ? 'Mix must total 100% of mortgage to view charts' : !fixedOk ? 'Min 33% fixed rate required (Kalatz/ Katz)' : '';
        chartsWarn.textContent = msg;
        chartsWarn.style.display = msg ? 'block' : 'none';
    }
    updateTrackTermEnabled();
    runSim();
}

function toggleRateEdit() {
    setState('rateEditMode', !rateEditMode);
    ['Prime', 'Kalats', 'Malatz', 'Katz', 'Matz'].forEach(track => {
        const lbl = $('lblRate' + track), inp = $('rate' + track);
        if (lbl) lbl.style.display = rateEditMode ? 'none' : 'block';
        if (inp) inp.classList.toggle('show', rateEditMode);
        if (!rateEditMode && lbl && inp) lbl.innerText = parseFloat(inp.value).toFixed(2) + ((track === 'Katz' || track === 'Matz') ? '% ' + t('cpiSuffix') : '%');
    });
}

function togglePrepaySection() {
    // Alpine handles visibility via x-show, keep for non-Alpine environments
    const container = $('prepayContainer');
    const arrow = $('prepayArrow');
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
    ['consume', 'match', 'invest'].forEach(mode => $('surplus' + mode.charAt(0).toUpperCase() + mode.slice(1))?.classList.toggle('active', m === mode));
    const descEl = $('surplusDescText') || $('surplusDesc');
    if (descEl) descEl.innerText = t('surplusDesc' + m.charAt(0).toUpperCase() + m.slice(1));
    if (!opts.skipSim) runSim();
}

function setRepayMethod(m) {
    setState('repayMethod', m);
    // Alpine handles pill class toggling via :class binding
    runSim();
}

function setOptimizeMode(m) {
    setState('optimizeMode', m);
    $('optRoi').classList.toggle('active', m === 'roi');
    $('optOutperf').classList.toggle('active', m === 'outperform');
    updateSweetSpots();
}

function updateOptimalRepayMethod(baseParams, currentCagr) {
    const altMethod = repayMethod === 'spitzer' ? 'equalPrincipal' : 'spitzer';
    const altRes = AppLogic.simulate({ ...baseParams, config: { ...baseParams.config, repayMethod: altMethod }, returnSeries: false });

    const starSpitzer = $('starSpitzer'), starEqual = $('starEqual');
    if (!starSpitzer || !starEqual) return;

    const [spitzerCagr, equalCagr] = repayMethod === 'spitzer' ? [currentCagr, altRes.cagrRE] : [altRes.cagrRE, currentCagr];
    starSpitzer.classList.toggle('show', spitzerCagr > equalCagr);
    starEqual.classList.toggle('show', equalCagr > spitzerCagr);
}

function updateSweetSpots() {
    let eq = parseFloat($('inpEquity').value) || 400000;
    let curDown = $int('rDown') / 100;
    let curDur = $int('rDur');
    let simDur = horMode === 'auto' ? curDur : $int('rHor');
    
    const assetPrice = eq / curDown;
    const isFirstHome = buyerType === 'first';
    const includePurchaseTax = $('cPurchaseTax')?.checked ?? true;
    const purchaseTax = includePurchaseTax ? AppLogic.calcPurchaseTax(assetPrice, isFirstHome) : 0;

    const params = {
        eq, curDown, curDur, simDur,
        useTaxSP: $('cTaxSP')?.checked ?? true,
        useTaxRE: $('cTaxSP')?.checked ?? true,
        useRentTax: $('cRentTax')?.checked ?? false,
        useMasShevach: $('cMasShevach')?.checked ?? false,
        masShevachType: buyerType === 'investor' ? 'none' : 'single',
        purchaseTax,
        tradeFee: $pct('rTrade'), merFee: $pct('rMer'), buyCostPct: $pct('rBuyCost'),
        maintPct: $pct('rMaint'), sellCostPct: $pct('rSellCost'),
        overrides: {
            SP: $pct('sSP'), App: $pct('sApp'), Int: $pct('sInt'), Inf: $pct('sInf'), Yld: $pct('sYld'),
            RateP: $pct('ratePrime'), RateK: $pct('rateKalats'), RateZ: $pct('rateKatz'),
            RateM: $pct('rateMalatz'), RateMT: $pct('rateMatz'),
        },
        mix: { prime: $int('pctPrime'), kalats: $int('pctKalats'), katz: $int('pctKatz'), malatz: $int('pctMalatz'), matz: $int('pctMatz') },
        termMix: { p: $int('termPrime') || curDur, k: $int('termKalats') || curDur, z: $int('termKatz') || curDur, m: $int('termMalatz') || curDur, mt: $int('termMatz') || curDur },
        drift: -0.5, lockDown, lockTerm, lockHor, horMode, cfg, exMode, taxMode,
        calcOverride: window.__calcCagrOverride || undefined,
        surplusMode, purchaseDiscount: $pct('rDiscount'), optimizeMode
    };

    const best = AppLogic.searchSweetSpots(params);
    updateSweetSpotMarkers(best);
}

function updateSweetSpotMarkers(best) {
    const posCalc = (val, min, max) => {
        let pos = ((val - min) / (max - min)) * 100;
        return lang === 'he' ? 100 - pos : pos;
    };
    const setSpot = (id, pos) => {
        const el = $(id);
        el.style.left = `calc(${pos}% + (8px - (0.16px * ${pos})))`;
        el.classList.add('visible');
    };

    setSpot('spotDown', posCalc(best.d, 25, 100));
    advancedTermMode ? $('spotDur').classList.remove('visible') : setSpot('spotDur', posCalc(best.t, 1, 30));

    if (horMode === 'custom' || lockHor) {
        setSpot('spotHor', posCalc(best.h, 1, 50));
        $('spotHor').title = `Best CAGR at ${best.h} Years`;
    } else {
        $('spotHor').classList.remove('visible');
    }
}

function runSim(opts = {}) {
    if (bootstrapping) return;
    const skipCharts = !!opts.skipCharts;

    let eq = parseFloat($('inpEquity').value) || 400000;
    let downPct = parseInt($('rDown').value) / 100;
    const mainTermSlider = $('rDur');
    let mortDur = parseInt(mainTermSlider.value);
    let simDur = horMode === 'auto' ? mortDur : parseInt($('rHor').value);

    $('dDown').innerText = (downPct * 100).toFixed(0) + '%';
    $('dDur').innerHTML = $ltr(mortDur + ' ' + t('yrSuffix'));
    $('dHor').innerHTML = horMode === 'auto' ? t('auto') + ' ' + $ltr('(' + mortDur + t('ySuffix') + ')') : $ltr(simDur + ' ' + t('yrSuffix'));

    updateSliderLabels();

    let assetPriceStart = eq / downPct;
    let initialLoan = assetPriceStart - eq;
    const { purchaseTax } = updateDealDisplay(eq, downPct, initialLoan);

    for (let k in cfg) {
        const el = $(cfg[k].v);
        if (el) el.innerText = cfg[k].is ? 'Hist' : $(cfg[k].s).value + '%';
    }

    // Terms
    const clampTerm = v => Math.max(TERM_MIN, Math.min(TERM_MAX, v));
    const trackTerms = ['Prime','Kalats','Katz','Malatz','Matz'].map(t => clampTerm(parseInt($('term' + t).value) || mortDur));
    let [termP, termK, termZ, termM, termMT] = trackTerms;

    if (!advancedTermMode) {
        termP = termK = termZ = termM = termMT = clampTerm(mortDur);
        ['Prime','Kalats','Katz','Malatz','Matz'].forEach(t => {
            $('term' + t).value = termP;
            showTermVal('term' + t + 'Val', termP);
        });
    }

    // Logic restored to sync horizon/terms
    const termMap = {Prime: termP, Kalats: termK, Katz: termZ, Malatz: termM, Matz: termMT};
    const activeTerms = Object.entries(termMap).filter(([t]) => $pct('pct' + t) > 0).map(([,v]) => v);
    if (activeTerms.length === 0) activeTerms.push(mortDur);

    const maxTrackYears = Math.max(...activeTerms);
    if (advancedTermMode) {
        mortDur = maxTrackYears;
        mainTermSlider.value = mortDur;
        $('dDur').innerHTML = $ltr(mortDur + ' ' + t('yrSuffix'));
    }

    const effectiveMax = Math.max(maxTrackYears, mortDur);
    if (horMode === 'auto') {
        $('rHor').value = effectiveMax;
        $('dHor').innerHTML = t('auto') + ' ' + $ltr('(' + effectiveMax + t('ySuffix') + ')');
        simDur = effectiveMax;
    }

    if (!opts.skipSweetSpots) updateSweetSpots();

    const params = buildSimParams(eq, downPct, mortDur, simDur, termP, termK, termZ, termM, termMT, purchaseTax, !skipCharts);
    const res = AppLogic.simulate(params);
    updateKPIs(res, assetPriceStart, skipCharts, params);
    saveState();
    document.body.classList.remove('loading');
}

function buildSimParams(eq, downPct, mortDur, simDur, termP, termK, termZ, termM, termMT, purchaseTax, returnSeries) {
    let activeDrift = -0.5;
    if ($('scenBear')?.classList.contains('active')) activeDrift = SCENARIOS.bear.drift;
    if ($('scenBull')?.classList.contains('active')) activeDrift = SCENARIOS.bull.drift;

    return {
        equity: eq,
        downPct: downPct,
        loanTerm: mortDur,
        simHorizon: simDur,
        termMix: { p: termP, k: termK, z: termZ, m: termM, mt: termMT },
        mix: { prime: $int('pctPrime'), kalats: $int('pctKalats'), katz: $int('pctKatz'), malatz: $int('pctMalatz'), matz: $int('pctMatz') },
        rates: { prime: $pct('ratePrime'), kalats: $pct('rateKalats'), katz: $pct('rateKatz'), malatz: $pct('rateMalatz'), matz: $pct('rateMatz') },
        market: { sp: $pct('sSP'), reApp: $pct('sApp'), cpi: $pct('sInf'), boi: $pct('sInt'), rentYield: $pct('sYld') },
        fees: { buy: $pct('rBuyCost'), sell: $pct('rSellCost'), trade: $pct('rTrade'), mgmt: $pct('rMer'), purchaseTax },
        maintPct: $pct('rMaint'),
        purchaseDiscount: $pct('rDiscount'),
        tax: {
            useSP: $('cTaxSP')?.checked ?? true, useRE: $('cTaxSP')?.checked ?? true,
            useRent: $('cRentTax')?.checked ?? false, useMasShevach: $('cMasShevach')?.checked ?? false,
            masShevachType: buyerType === 'investor' ? 'none' : 'single', mode: taxMode
        },
        config: { drift: activeDrift, surplusMode, exMode, history: cfg, repayMethod },
        prepay: getPrepayments(),
        returnSeries
    };
}

function updateKPIs(res, assetPriceStart, skipCharts, params) {
    const { netRE: lRE, netSP: lSP, series } = res;
    $('kRE').innerText = fmtVal(mode === 'percent' ? (series?.reDataPct[series.reDataPct.length - 1] || 0) : lRE);
    $('kSP').innerText = fmtVal(mode === 'percent' ? (series?.spDataPct[series.spDataPct.length - 1] || 0) : lSP);

    const diff = lRE - lSP, winnerIsRE = diff >= 0, base = winnerIsRE ? lSP : lRE;
    $('kDiff').innerText = (base !== 0 ? (Math.abs(diff) / base) * 100 : 0).toFixed(1) + '%';
    $('kDiff').style.color = winnerIsRE ? "var(--success)" : "var(--primary)";

    $('kRECagr').innerText = res.cagrRE.toFixed(2) + '%';
    $('kSPCagr').innerText = res.cagrSP.toFixed(2) + '%';

    updateOptimalRepayMethod(params, res.cagrRE);

    $('kInt').innerText = fmt(res.totalInterestWasted) + ` ₪ (${((res.totalInterestWasted / assetPriceStart) * 100).toFixed(0)}%)`;
    $('kRent').innerText = fmt(res.totalRentCollected) + ' ₪';
    $('kInvested').innerText = fmt(res.totalCashInvested) + ' ₪';
    
    const setKPI = (id, val) => { const el = $(id); if (el) el.innerText = fmt(val || 0) + ' ₪'; };
    setKPI('kMasShevach', res.masShevach);
    setKPI('kCapGains', res.spTax);

    const posYears = res.firstPosMonth === null ? null : (res.firstPosMonth / 12);
    $('valPosCF')?.innerText && ($('valPosCF').innerText = res.firstPosMonth === null ? 'Never' : posYears.toFixed(1) + 'y');

    if (!skipCharts && series) {
        window.__lastSim = { ...res, finalNetRE: lRE, finalNetSP: lSP, flowNet: series.flowNet[series.flowNet.length - 1], posCFYears: posYears };
        window.Charts.drawCharts(series.labels, series.reDataVal, series.reDataPct, series.spDataVal, series.spDataPct,
            series.flowRent, series.flowInt, series.flowPrinc, series.flowNet, series.surplusVal, series.surplusPct,
            { reTax: res.totalRETax, spTax: res.spTax, netRE: lRE, netSP: lSP, invested: res.totalCashInvested, surplusTax: res.reSideTax, surplusGross: res.reSideStockValue },
            { mode, surplusMode, t, fmt, fmtNum });
    }
}

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
    ['horMode','surplusMode','repayMethod','creditScore','taxMode','exMode','lockDown','lockTerm','lockHor','advancedTermMode','buyerType','mode']
        .forEach(k => { if (s[k] != null) setState(k, s[k]); });
    if (s.prepayments) window.Prepayments?.setPrepayments(s.prepayments);

    return true;
}

function bootstrap() {
    bootstrapping = true;
    window.Prepayments?.init(runSim);
    if (localStorage.getItem('darkMode') === 'true') document.body.classList.add('dark');
    if (lang === 'he') { document.documentElement.lang = 'he'; document.documentElement.dir = 'rtl'; document.body.classList.add('rtl'); }
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
    if (horMode === 'custom') { $pill('pHor', false); $('bHor').classList.add('show'); }
    checkMix();
    window.Prepayments?.renderPrepayments();
    if (advancedTermMode) {
        $('advancedTermBox').style.display = 'block';
        $('basicTermBox').style.display = 'none';
        $('btnAdvancedTerm')?.classList.add('active');
        ['Prime','Kalats','Malatz','Katz','Matz'].forEach(t => showTermVal('term' + t + 'Val', $('term' + t)?.value));
    }
    bootstrapping = false;
    runSim();
}

function updateRateLabels() {
    ['Prime', 'Kalats', 'Malatz', 'Katz', 'Matz'].forEach(track => {
        const lbl = $('lblRate' + track), inp = $('rate' + track);
        if (lbl && inp) lbl.innerText = parseFloat(inp.value).toFixed(2) + ((track === 'Katz' || track === 'Matz') ? '% ' + t('cpiSuffix') : '%');
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
Object.assign(window, {
    setMode, tgl, setGlobalMode, applyScenario, applyTamheel, tglHor, setTaxMode, updMeter, checkMix, syncPrime,
    calcPmt: AppLogic.calcPmt, calcCAGR: AppLogic.calcCAGR, updateSweetSpots, runSim, setCreditScore, toggleLock,
    setBuyerType, syncTrackTermsToMain, showTermVal, toggleAdvancedTerms, setSurplusMode, syncMixInput,
    toggleRateEdit, toggleLang, resetAll, toggleDarkMode, printResults
});

document.addEventListener('DOMContentLoaded', bootstrap);
