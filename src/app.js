const AppLogic = window.Logic || {};
const T = window.i18n?.T || { en: {}, he: {} };
const { SCENARIOS, TAMHEEL_PROFILES, ANCHORS, CREDIT_MATRIX, TERM_MIN, TERM_MAX, LTV_MIN } = window.AppConfig || {};

// --- DOM HELPERS ---
const $ = id => document.getElementById(id);
const $pct = id => parseFloat($(id)?.value || 0) / 100;
const $int = id => parseInt($(id)?.value || 0);
const $pill = (id, isFirst) => { const p = $(id); if (p) { p.children[0]?.classList.toggle('active', isFirst); p.children[1]?.classList.toggle('active', !isFirst); } };

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
    $('sSP').value = s.sp;
    $('sApp').value = s.app;
    $('sInt').value = s.int;
    $('sInf').value = s.inf;
    $('sYld').value = s.yld;

    $('scenBear')?.classList.toggle('active', type === 'bear');
    $('scenBase')?.classList.toggle('active', type === 'base');
    $('scenBull')?.classList.toggle('active', type === 'bull');

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
    const scoreEl = $('creditScoreVal');
    const tierEl = $('creditTierLabel');
    const warnEl = $('creditWarn');
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
    const base = parseFloat($('sInt').value) || 4.25;

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
    const setBtn = (id, locked) => {
        const el = document.getElementById(id);
        el.classList.toggle('locked', locked);
        el.innerText = locked ? t('locked') : t('free');
    };
    setBtn('lockDownBtn', lockDown);
    setBtn('lockTermBtn', lockTerm);
    setBtn('lockHorBtn', lockHor);
    const summaryEl = $('optModeLabel');
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
            $('pHor').children[0].classList.remove('active');
            $('pHor').children[1].classList.add('active');
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
    const dur = $('rDur').value;
    ['Prime','Kalats','Katz','Malatz','Matz'].forEach(t => {
        $('term' + t).value = dur;
        showTermVal('term' + t + 'Val', dur);
    });
}

function toggleAdvancedTerms() {
    setState('advancedTermMode', !advancedTermMode);
    // Alpine x-show handles visibility, keep for non-Alpine environments
    const advBox = $('advancedTermBox');
    const basicBox = $('basicTermBox');
    const btn = $('btnAdvancedTerm');
    if (advBox) advBox.style.display = advancedTermMode ? 'block' : 'none';
    if (basicBox) basicBox.style.display = advancedTermMode ? 'none' : 'block';
    if (btn) btn.classList.toggle('active', advancedTermMode);
    syncTrackTermsToMain();
    runSim();
}
function updMeter() {
    let v = parseFloat($('sInf').value);
    let s = $('infMeter').children;
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

// Update slider value display labels
function updateSliderLabels() {
    $('vTrade').innerText = parseFloat($('rTrade').value).toFixed(1) + '%';
    $('vMer').innerText = parseFloat($('rMer').value).toFixed(2) + '%';
    $('vDiscount').innerText = $('rDiscount').value + '%';
    $('vBuyCost').innerText = parseFloat($('rBuyCost').value).toFixed(1) + '%';
    $('vMaint').innerText = parseFloat($('rMaint').value).toFixed(0) + '%';
    $('vSellCost').innerText = parseFloat($('rSellCost').value).toFixed(1) + '%';
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
    const segs = bar.children;
    segs[0].style.width = p + '%';   // Prime
    segs[1].style.width = k + '%';   // Kalats
    segs[2].style.width = m + '%';   // Malatz
    segs[3].style.width = z + '%';   // Katz
    segs[4].style.width = mt + '%';  // Matz
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
    const altParams = { ...baseParams, config: { ...baseParams.config, repayMethod: altMethod }, returnSeries: false };
    const altRes = AppLogic.simulate(altParams);

    const starSpitzer = $('starSpitzer');
    const starEqual = $('starEqual');
    if (!starSpitzer || !starEqual) return;

    const spitzerCagr = repayMethod === 'spitzer' ? currentCagr : altRes.cagrRE;
    const equalCagr = repayMethod === 'equalPrincipal' ? currentCagr : altRes.cagrRE;

    starSpitzer.classList.remove('show');
    starEqual.classList.remove('show');
    if (spitzerCagr > equalCagr) starSpitzer.classList.add('show');
    else if (equalCagr > spitzerCagr) starEqual.classList.add('show');
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

    const spotDur = $('spotDur');
    if (advancedTermMode) {
        spotDur.classList.remove('visible');
    } else {
        setSpot('spotDur', posCalc(best.t, 1, 30));
    }

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
    const dDurEl = $('dDur');
    const dHorEl = $('dHor');
    if (lang === 'he') {
        dDurEl.innerHTML = '<span style="direction:ltr;display:inline-block">' + mortDur + ' ' + t('yrSuffix') + '</span>';
        dHorEl.innerHTML = horMode === 'auto' ? t('auto') + ' <span style="direction:ltr;display:inline-block">(' + mortDur + t('ySuffix') + ')</span>' : '<span style="direction:ltr;display:inline-block">' + simDur + ' ' + t('yrSuffix') + '</span>';
    } else {
        dDurEl.innerText = mortDur + ' ' + t('yrSuffix');
        dHorEl.innerText = horMode === 'auto' ? t('auto') + ' (' + mortDur + t('ySuffix') + ')' : simDur + ' ' + t('yrSuffix');
    }

    updateSliderLabels();

    let assetPriceStart = eq / downPct;
    let initialLoan = assetPriceStart - eq;
    const { purchaseTax } = updateDealDisplay(eq, downPct, initialLoan);

    for (let k in cfg) {
        let el = $(cfg[k].v);
        if (el) {
            if (cfg[k].is) el.innerText = 'Hist'; else el.innerText = $(cfg[k].s).value + '%';
        }
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
        if (lang === 'he') {
            $('dDur').innerHTML = '<span style="direction:ltr;display:inline-block">' + mortDur + ' ' + t('yrSuffix') + '</span>';
        } else {
            $('dDur').innerText = mortDur + ' ' + t('yrSuffix');
        }
    }

    const effectiveMax = Math.max(maxTrackYears, mortDur);
    if (horMode === 'auto') {
        $('rHor').value = effectiveMax;
        if (lang === 'he') {
            $('dHor').innerHTML = t('auto') + ' <span style="direction:ltr;display:inline-block">(' + effectiveMax + t('ySuffix') + ')</span>';
        } else {
            $('dHor').innerText = t('auto') + ' (' + effectiveMax + t('ySuffix') + ')';
        }
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
        mix: {
            prime: parseFloat($('pctPrime').value) || 0,
            kalats: parseFloat($('pctKalats').value) || 0,
            katz: parseFloat($('pctKatz').value) || 0,
            malatz: parseFloat($('pctMalatz').value) || 0,
            matz: parseFloat($('pctMatz').value) || 0
        },
        rates: {
            prime: $pct('ratePrime'), kalats: $pct('rateKalats'), katz: $pct('rateKatz'),
            malatz: $pct('rateMalatz'), matz: $pct('rateMatz')
        },
        market: {
            sp: $pct('sSP'), reApp: $pct('sApp'), cpi: $pct('sInf'), boi: $pct('sInt'), rentYield: $pct('sYld')
        },
        fees: {
            buy: $pct('rBuyCost'), sell: $pct('rSellCost'), trade: $pct('rTrade'), mgmt: $pct('rMer'), purchaseTax
        },
        maintPct: $pct('rMaint'),
        purchaseDiscount: $pct('rDiscount'),
        tax: {
            useSP: $('cTaxSP')?.checked ?? true,
            useRE: $('cTaxSP')?.checked ?? true,
            useRent: $('cRentTax')?.checked ?? false,
            useMasShevach: $('cMasShevach')?.checked ?? false,
            masShevachType: buyerType === 'investor' ? 'none' : 'single',
            mode: taxMode
        },
        config: { drift: activeDrift, surplusMode, exMode, history: cfg, repayMethod },
        prepay: getPrepayments(),
        returnSeries
    };
}

function updateKPIs(res, assetPriceStart, skipCharts, params) {
    const lRE = res.netRE;
    const lSP = res.netSP;
    $('kRE').innerText = fmtVal(mode === 'percent' ? (res.series ? res.series.reDataPct[res.series.reDataPct.length - 1] : 0) : lRE);
    $('kSP').innerText = fmtVal(mode === 'percent' ? (res.series ? res.series.spDataPct[res.series.spDataPct.length - 1] : 0) : lSP);

    const diff = lRE - lSP;
    const winnerIsRE = diff >= 0;
    const base = winnerIsRE ? lSP : lRE;
    const diffPct = base !== 0 ? (Math.abs(diff) / base) * 100 : 0;
    $('kDiff').innerText = diffPct.toFixed(1) + '%';
    $('kDiff').style.color = winnerIsRE ? "var(--success)" : "var(--primary)";

    $('kRECagr').innerText = res.cagrRE.toFixed(2) + '%';
    $('kSPCagr').innerText = res.cagrSP.toFixed(2) + '%';

    updateOptimalRepayMethod(params, res.cagrRE);

    let intPctOfAsset = (res.totalInterestWasted / assetPriceStart) * 100;
    $('kInt').innerText = fmt(res.totalInterestWasted) + ` ₪ (${intPctOfAsset.toFixed(0) + '%)'}`;
    $('kRent').innerText = fmt(res.totalRentCollected) + ' ₪';
    $('kInvested').innerText = fmt(res.totalCashInvested) + ' ₪';
    
    const kMasShevach = $('kMasShevach');
    if (kMasShevach) kMasShevach.innerText = fmt(res.masShevach || 0) + ' ₪';
    const kCapGains = $('kCapGains');
    if (kCapGains) kCapGains.innerText = fmt(res.spTax || 0) + ' ₪';

    const posYears = res.firstPosMonth === null ? null : (res.firstPosMonth / 12);
    const posTxt = res.firstPosMonth === null ? 'Never' : posYears.toFixed(1) + 'y';
    const valPosCF = $('valPosCF');
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
    ['horMode','surplusMode','repayMethod','creditScore','taxMode','exMode','lockDown','lockTerm','lockHor','advancedTermMode','buyerType','mode']
        .forEach(k => { if (s[k] != null) setState(k, s[k]); });
    if (s.prepayments) window.Prepayments?.setPrepayments(s.prepayments);

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
        $pill('pHor', false);
        $('bHor').classList.add('show');
    }
    checkMix();
    window.Prepayments?.renderPrepayments();
    if (advancedTermMode) {
        const panel = $('advancedTermBox');
        const basic = $('basicTermBox');
        const btn = $('btnAdvancedTerm');
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
