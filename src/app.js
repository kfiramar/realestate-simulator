const AppLogic = window.Logic || {};
const T = window.i18n?.T || { en: {}, he: {} };
const { SCENARIOS, TAMHEEL_PROFILES, ANCHORS, CREDIT_MATRIX, TERM_MIN, TERM_MAX, LTV_MIN } = window.AppConfig || {};

const TRACKS = ['Prime', 'Kalats', 'Katz', 'Malatz', 'Matz'];
const $ = id => document.getElementById(id);
const $pct = id => parseFloat($(id)?.value || 0) / 100;
const $int = id => parseInt($(id)?.value || 0);
const $pill = (id, isFirst) => { const p = $(id); if (p) { p.children[0]?.classList.toggle('active', isFirst); p.children[1]?.classList.toggle('active', !isFirst); } };
const $ltr = txt => lang === 'he' ? `<span style="direction:ltr;display:inline-block">${txt}</span>` : txt;
const getMix = () => ({ prime: $int('pctPrime'), kalats: $int('pctKalats'), katz: $int('pctKatz'), malatz: $int('pctMalatz'), matz: $int('pctMatz') });
const getRates = () => ({ prime: $pct('ratePrime'), kalats: $pct('rateKalats'), katz: $pct('rateKatz'), malatz: $pct('rateMalatz'), matz: $pct('rateMatz') });

let lang = window.i18n?.getLang() || 'en';

function t(key) { return (T[lang] && T[lang][key]) || (T['en'] && T['en'][key]) || key; }

function toggleLang() {
    lang = lang === 'en' ? 'he' : 'en'; window.i18n?.setLang(lang); localStorage.setItem('lang', lang);
    const isHe = lang === 'he'; document.documentElement.lang = lang; document.documentElement.dir = isHe ? 'rtl' : 'ltr'; document.body.classList.toggle('rtl', isHe);
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

const S = window.AppState || { get: () => null, set: () => { }, getAll: () => ({}), setAll: () => { } };

let mode, exMode, taxMode, horMode, lockDown, lockTerm, lockHor, buyerType, advancedTermMode, bootstrapping, creditScore, surplusMode, repayMethod, optimizeMode, rateEditMode;

const syncState = () => ({ mode, exMode, taxMode, horMode, lockDown, lockTerm, lockHor, buyerType, advancedTermMode, bootstrapping, creditScore, surplusMode, repayMethod, optimizeMode, rateEditMode } = S.getAll());
const setState = (k, v) => { S.set(k, v); syncState(); };
syncState();

const cfg = Object.fromEntries(['SP', 'App', 'Int', 'Yld', 'Inf'].map(k => [k, { is: false, b: 'b' + k, s: 's' + k, v: 'v' + k, p: 'p' + k }]));

function setMode(m, opts = {}) {
    setState('mode', m);
    $('equityBox')?.classList.toggle('show', m === 'currency');
    if (!opts.skipSim) runSim();
}
function tgl(k, h, opts = {}) {
    cfg[k].is = h;
    setState('hist' + k, h);
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
    ['SP', 'App', 'Int', 'Inf', 'Yld'].forEach(k => $('s' + k).value = s[k.toLowerCase()]);
    ['bear', 'base', 'bull'].forEach(t => $('scen' + t.charAt(0).toUpperCase() + t.slice(1))?.classList.toggle('active', type === t));
    refreshRatesForProfile(); updateRateLabels(); updateCreditUI(); applyLtvCaps(); updMeter();
    if (!opts.skipSim) runSim();
}

function applyTamheel(type) {
    const p = TAMHEEL_PROFILES[type], map = { Prime: ['p', 'tP'], Kalats: ['k', 'tK'], Katz: ['z', 'tZ'], Malatz: ['m', 'tM'], Matz: ['mt', 'tMt'] };
    Object.entries(map).forEach(([track, [pctKey, termKey]]) => { $('pct' + track).value = p[pctKey] || 0; $('term' + track).value = p[termKey]; $('term' + track + 'Val').textContent = p[termKey] + 'y'; });
    if (!advancedTermMode) toggleAdvancedTerms();
    checkMix();
}

function mapScoreToTierKey(score) {
    const thresholds = [[950, 'A'], [900, 'B'], [850, 'C'], [800, 'D'], [750, 'E'], [700, 'F'], [660, 'G']];
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
    const tier = getCreditTier(creditScore), warnEl = $('creditWarn');
    $('creditScoreVal')?.innerText && ($('creditScoreVal').innerText = tier.range[0] + '-' + tier.range[1]);
    $('creditTierLabel')?.innerText && ($('creditTierLabel').innerText = `Risk Tier: ${tier.tier}`);
    if (warnEl) { warnEl.style.display = tier.maxLTV === 0 ? 'block' : 'none'; if (tier.maxLTV === 0) warnEl.innerText = 'Application rejected: score below 660'; }
}

function refreshRatesForProfile() {
    const tier = getCreditTier(parseInt(creditScore, 10)), base = parseFloat($('sInt').value) || 4.25;
    Object.entries({ Prime: ['prime', 'riskP'], Kalats: ['kalats', 'riskK'], Malatz: ['malatz', 'riskK'], Katz: ['katz', 'riskZ'], Matz: ['matz', 'riskZ'] }).forEach(([track, [anchor, risk]]) => { const el = $('rate' + track); if (el && tier[risk] !== null) el.value = Math.max(0.1, base + ANCHORS[anchor] + tier[risk]).toFixed(2); });
}

function setCreditScore(v) {
    setState('creditScore', parseInt(v, 10) || creditScore);
    updateCreditUI(); applyLtvCaps(); refreshRatesForProfile(); updateRateLabels(); runSim();
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
    $('vTaxMode')?.innerText && ($('vTaxMode').innerText = m === 'real' ? 'Real' : 'Nominal');
    runSim();
}
function updateLockUI() {
    const locks = { Down: lockDown, Term: lockTerm, Hor: lockHor };
    Object.entries(locks).forEach(([k, v]) => { const el = $('lock' + k + 'Btn'); if (el) { el.classList.toggle('locked', v); el.innerText = v ? t('locked') : t('free'); } });
    const summaryEl = $('optModeLabel');
    if (summaryEl) summaryEl.innerText = Object.entries(locks).filter(([, v]) => v).map(([k]) => k === 'Hor' ? 'Horizon' : k).join(' & ') || t('free');
}
function toggleLock(target) {
    const map = { down: ['lockDown', lockDown], term: ['lockTerm', lockTerm], hor: ['lockHor', lockHor] };
    const [key, val] = map[target] || [];
    if (!key) return;
    if (target === 'hor' && horMode === 'auto' && lockHor) { setState('horMode', 'custom'); $pill('pHor', false); $('bHor').classList.add('show'); }
    setState(key, !val);
    updateLockUI();
    runSim();
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
    TRACKS.forEach(t => { $('term' + t).value = dur; showTermVal('term' + t + 'Val', dur); });
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

function fmt(v) { return Math.abs(v) >= 1000000 ? (v / 1000000).toFixed(2) + 'M' : Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toFixed(0); }
function fmtNum(v) { return v.toLocaleString('en-US', { maximumFractionDigits: 0 }); }
function fmtVal(v) { return mode === 'percent' ? v.toFixed(1) + '%' : fmt(v) + ' ₪'; }

function updateSliderLabels() {
    Object.entries({ Trade: 1, Mer: 2, Discount: 0, BuyCost: 1, Maint: 0, SellCost: 1 }).forEach(([k, dec]) => $('v' + k).innerText = parseFloat($('r' + k).value).toFixed(dec) + '%');
}

function updateDealDisplay(eq, downPct, initialLoan) {
    const entryCostsFromEquity = $('cEntryCostsFromEquity')?.checked ?? false;
    const buyCostPct = $pct('rBuyCost') || 0;

    let assetPriceStart, effectiveLoan;
    const purchaseTaxEnabled = $('cPurchaseTax')?.checked ?? true;

    if (entryCostsFromEquity) {
        // Entry costs come from equity - need to solve for asset price
        // First estimate without purchase tax to get asset price
        const estAsset = eq / (downPct + buyCostPct);
        const purchaseTax = purchaseTaxEnabled ? AppLogic.calcPurchaseTax(estAsset, buyerType === 'first') : 0;
        // Now solve: equity = assetPrice * downPct + purchaseTax + assetPrice * buyCostPct
        // assetPrice = (equity - purchaseTax) / (downPct + buyCostPct)
        assetPriceStart = (eq - purchaseTax) / (downPct + buyCostPct);
        const effectiveDown = eq - purchaseTax - (assetPriceStart * buyCostPct);
        effectiveLoan = assetPriceStart - effectiveDown;
    } else {
        assetPriceStart = eq / downPct;
        effectiveLoan = initialLoan;
    }

    const lev = assetPriceStart / eq;
    $('valAsset').dataset.initial = assetPriceStart; // Store for later
    $('valAsset').innerText = fmt(assetPriceStart) + ' ₪';
    $('valLev').innerText = 'x' + lev.toFixed(1);
    $('barLev').style.width = Math.min(((lev - 1) / 4) * 100, 100) + '%';
    $('valMortgage').innerText = fmt(effectiveLoan) + ' ₪';

    const purchaseTax = purchaseTaxEnabled ? AppLogic.calcPurchaseTax(assetPriceStart, buyerType === 'first') : 0;
    const entryCosts = purchaseTax + (assetPriceStart * buyCostPct);
    $('valPurchaseTax')?.innerText && ($('valPurchaseTax').innerText = fmt(purchaseTax) + ' ₪');
    $('valEntryCosts')?.innerText && ($('valEntryCosts').innerText = fmt(entryCosts) + ' ₪');

    // Show equity split: down payment vs entry costs
    const equitySplit = $('equitySplit');
    if (equitySplit) {
        const downPayment = entryCostsFromEquity ? (eq - entryCosts) : eq;
        equitySplit.innerHTML = `↳ ${fmt(downPayment)} ₪ ${t('downPayment')} + ${fmt(entryCosts)} ₪ ${t('entryCosts')}`;
    }

    TRACKS.forEach(track => { const pct = parseFloat($('pct' + track)?.value) || 0, el = $('disp' + track), amt = effectiveLoan * pct / 100; if (el) el.innerHTML = `${pct}%<br><span style="font-size:0.55rem;color:#64748b;font-weight:400">₪${fmt(amt)}</span>`; });
    return { assetPriceStart, purchaseTax };
}

function updateTrackTermEnabled() {
    TRACKS.forEach(t => { const el = $('term' + t); if (el) el.disabled = ($int('pct' + t) || 0) <= 0; });
}

function syncMixInput(track) {
    const slider = $('slider' + track);
    const othersSum = TRACKS.filter(t => t !== track).reduce((sum, t) => sum + $int('pct' + t), 0);
    const maxAllowed = 100 - othersSum, newVal = Math.min(parseInt(slider.value) || 0, maxAllowed);

    if (parseInt(slider.value) > maxAllowed) showMaxTooltip(slider, maxAllowed);
    slider.value = newVal;
    $('pct' + track).value = newVal;
    $('disp' + track).innerText = newVal + '%';
    checkMix();
    window.Prepayments?.renderPrepayments();
}

function showMaxTooltip(el, maxVal) {
    let tip = $('maxTip');
    if (!tip) { tip = document.createElement('div'); tip.id = 'maxTip'; tip.innerHTML = '<span></span><div style="position:absolute;left:50%;bottom:-4px;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:5px solid #ef4444;"></div>'; tip.style.cssText = 'position:fixed;background:#ef4444;color:#fff;padding:3px 6px;border-radius:4px;font-size:0.65rem;font-weight:500;z-index:999;pointer-events:none;box-shadow:0 1px 4px rgba(0,0,0,0.2);transform:translateX(-50%);transition:opacity 0.2s;'; document.body.appendChild(tip); }
    tip.querySelector('span').textContent = '⚠️ Max 100%';
    const rect = el.getBoundingClientRect();
    Object.assign(tip.style, { left: (rect.left + (maxVal / 100) * rect.width) + 'px', top: (rect.top - 28) + 'px', opacity: '1', display: 'block' });
    clearTimeout(tip._timeout);
    tip._timeout = setTimeout(() => { tip.style.opacity = '0'; setTimeout(() => tip.style.display = 'none', 100); }, 150);
}

function updateVisualBar(p, k, m, z, mt) {
    const bar = $('mixVisualBar');
    if (!bar) return;
    [p, k, m, z, mt].forEach((v, i) => bar.children[i].style.width = v + '%');
}

function checkMix() {
    const vals = TRACKS.map(t => $int('pct' + t));
    const [p, k, z, m, mt] = vals;

    TRACKS.forEach((t, i) => { $('slider' + t).value = vals[i]; $('disp' + t).innerText = vals[i] + '%'; });
    updateVisualBar(p, k, m, z, mt);

    const sum = vals.reduce((a, b) => a + b, 0), fixedOk = (k + z) >= 33;
    const el = $('valMixSum');
    el.innerText = sum + "%";
    el.style.display = sum === 100 ? 'none' : 'block';
    el.style.color = sum === 100 ? '#16a34a' : '#ef4444';

    $('mixWarn')?.style && ($('mixWarn').style.display = sum === 100 ? 'none' : 'block');
    $('chartsContainer')?.classList.toggle('charts-dim', sum !== 100 || !fixedOk);
    const chartsWarn = $('chartsWarn'), msg = sum !== 100 ? t('mixWarning') : !fixedOk ? t('fixedRateWarning') : '';
    if (chartsWarn) { chartsWarn.textContent = msg; chartsWarn.style.display = msg ? 'block' : 'none'; }
    updateTrackTermEnabled();
    runSim();
}

function toggleRateEdit() {
    setState('rateEditMode', !rateEditMode);
    TRACKS.forEach(track => { const lbl = $('lblRate' + track), inp = $('rate' + track); if (lbl) lbl.style.display = rateEditMode ? 'none' : 'block'; if (inp) inp.classList.toggle('show', rateEditMode); if (!rateEditMode && lbl && inp) lbl.innerText = parseFloat(inp.value).toFixed(2) + ((track === 'Katz' || track === 'Matz') ? '% ' + t('cpiSuffix') : '%'); });
}

function togglePrepaySection() {
    const container = $('prepayContainer'), arrow = $('prepayArrow');
    const isOpen = container?.style.display !== 'none';
    if (container) container.style.display = isOpen ? 'none' : 'block';
    if (arrow) arrow.textContent = isOpen ? '+' : '−';
}

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
    starSpitzer.classList.toggle('show', spitzerCagr > equalCagr); starEqual.classList.toggle('show', equalCagr > spitzerCagr);
}

let sweetSpotWorker = null;
try { sweetSpotWorker = new Worker('sweetSpotWorker.js'); sweetSpotWorker.onmessage = (e) => updateSweetSpotMarkers(e.data); } catch (e) { /* fallback to sync */ }

function updateSweetSpots() {
    const eq = parseFloat($('inpEquity').value) || 400000, curDown = $int('rDown') / 100, curDur = $int('rDur');
    const simDur = horMode === 'auto' ? curDur : $int('rHor');
    const assetPrice = eq / curDown;
    const purchaseTax = ($('cPurchaseTax')?.checked ?? true) ? AppLogic.calcPurchaseTax(assetPrice, buyerType === 'first') : 0;

    const params = {
        eq, curDown, curDur, simDur, purchaseTax,
        useTaxSP: $('cTaxSP')?.checked ?? true, useTaxRE: $('cTaxSP')?.checked ?? true,
        useRentTax: $('cRentTax')?.checked ?? false, useMasShevach: $('cMasShevach')?.checked ?? false,
        masShevachType: buyerType === 'investor' ? 'none' : 'single',
        tradeFee: $pct('rTrade'), merFee: $pct('rMer'), buyCostPct: $pct('rBuyCost'), maintPct: $pct('rMaint'), sellCostPct: $pct('rSellCost'),
        overrides: {
            SP: $pct('sSP'), App: $pct('sApp'), Int: $pct('sInt'), Inf: $pct('sInf'), Yld: $pct('sYld'),
            RateP: $pct('ratePrime'), RateK: $pct('rateKalats'), RateZ: $pct('rateKatz'), RateM: $pct('rateMalatz'), RateMT: $pct('rateMatz')
        },
        mix: getMix(),
        termMix: { p: $int('termPrime') || curDur, k: $int('termKalats') || curDur, z: $int('termKatz') || curDur, m: $int('termMalatz') || curDur, mt: $int('termMatz') || curDur },
        drift: -0.5, lockDown, lockTerm, lockHor, horMode, cfg, exMode, taxMode,
        calcOverride: window.__calcCagrOverride, surplusMode, purchaseDiscount: $pct('rDiscount'), optimizeMode
    };
    if (sweetSpotWorker) sweetSpotWorker.postMessage(params);
    else updateSweetSpotMarkers(AppLogic.searchSweetSpots(params));
}

function updateSweetSpotMarkers(best) {
    const posCalc = (val, min, max) => { const pos = ((val - min) / (max - min)) * 100; return lang === 'he' ? 100 - pos : pos; };
    const setSpot = (id, pos) => { const el = $(id); if (!el) return; el.style.left = `calc(${pos}% + (8px - (0.16px * ${pos})))`; el.classList.add('visible'); };
    setSpot('spotDown', posCalc(best.d, 25, 100));
    advancedTermMode ? $('spotDur').classList.remove('visible') : setSpot('spotDur', posCalc(best.t, 1, 30));
    if (horMode === 'custom' || lockHor) { setSpot('spotHor', posCalc(best.h, 1, 50)); $('spotHor').title = `Best CAGR at ${best.h} Years`; }
    else $('spotHor').classList.remove('visible');
}

function runSim(opts = {}) {
    if (bootstrapping) return;
    const skipCharts = !!opts.skipCharts;

    const eq = parseFloat($('inpEquity').value) || 400000, downPct = parseInt($('rDown').value) / 100;
    const mainTermSlider = $('rDur');
    let mortDur = parseInt(mainTermSlider.value), simDur = horMode === 'auto' ? mortDur : parseInt($('rHor').value);

    $('dDown').innerText = (downPct * 100).toFixed(0) + '%';
    $('dDur').innerHTML = $ltr(mortDur + ' ' + t('yrSuffix'));
    $('dHor').innerHTML = horMode === 'auto' ? t('auto') + ' ' + $ltr('(' + mortDur + t('ySuffix') + ')') : $ltr(simDur + ' ' + t('yrSuffix'));

    updateSliderLabels();

    const initialAsset = eq / downPct, initialLoan = initialAsset - eq;
    const { assetPriceStart, purchaseTax } = updateDealDisplay(eq, downPct, initialLoan);

    for (let k in cfg) { const el = $(cfg[k].v); if (el) el.innerText = cfg[k].is ? 'Hist' : $(cfg[k].s).value + '%'; }

    const clampTerm = v => Math.max(TERM_MIN, Math.min(TERM_MAX, v));
    let [termP, termK, termZ, termM, termMT] = TRACKS.map(t => clampTerm(parseInt($('term' + t).value) || mortDur));

    if (!advancedTermMode) {
        termP = termK = termZ = termM = termMT = clampTerm(mortDur);
        TRACKS.forEach(t => { $('term' + t).value = termP; showTermVal('term' + t + 'Val', termP); });
    }

    const termMap = { Prime: termP, Kalats: termK, Katz: termZ, Malatz: termM, Matz: termMT };
    const activeTerms = Object.entries(termMap).filter(([t]) => $pct('pct' + t) > 0).map(([, v]) => v);
    if (activeTerms.length === 0) activeTerms.push(mortDur);

    const maxTrackYears = Math.max(...activeTerms);
    if (advancedTermMode) { mortDur = maxTrackYears; mainTermSlider.value = mortDur; $('dDur').innerHTML = $ltr(mortDur + ' ' + t('yrSuffix')); }

    const effectiveMax = Math.max(maxTrackYears, mortDur);
    if (horMode === 'auto') { $('rHor').value = effectiveMax; $('dHor').innerHTML = t('auto') + ' ' + $ltr('(' + effectiveMax + t('ySuffix') + ')'); simDur = effectiveMax; }

    if (!opts.skipSweetSpots) updateSweetSpots();

    const params = buildSimParams(eq, downPct, mortDur, simDur, termP, termK, termZ, termM, termMT, purchaseTax, !skipCharts);
    const res = AppLogic.simulate(params);
    updateKPIs(res, assetPriceStart, skipCharts, params);
    saveState();
    document.body.classList.remove('loading');
}

function buildSimParams(eq, downPct, mortDur, simDur, termP, termK, termZ, termM, termMT, purchaseTax, returnSeries) {
    const activeDrift = $('scenBear')?.classList.contains('active') ? SCENARIOS.bear.drift : $('scenBull')?.classList.contains('active') ? SCENARIOS.bull.drift : -0.5;
    const entryCostsFromEquity = $('cEntryCostsFromEquity')?.checked ?? false;
    return {
        equity: eq, downPct, loanTerm: mortDur, simHorizon: simDur,
        termMix: { p: termP, k: termK, z: termZ, m: termM, mt: termMT },
        mix: getMix(), rates: getRates(),
        market: { sp: $pct('sSP'), reApp: $pct('sApp'), cpi: $pct('sInf'), boi: $pct('sInt'), rentYield: $pct('sYld') },
        fees: { buy: $pct('rBuyCost'), sell: $pct('rSellCost'), trade: $pct('rTrade'), mgmt: $pct('rMer'), purchaseTax },
        maintPct: $pct('rMaint'), purchaseDiscount: $pct('rDiscount'),
        entryCostsFromEquity,
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

    // Update asset price to show initial → final
    const valAsset = $('valAsset');
    if (valAsset) valAsset.innerText = fmt(assetPriceStart) + ' → ' + fmt(res.finalAssetValue) + ' ₪';

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
    [['kMasShevach', res.masShevach], ['kCapGains', res.spTax]].forEach(([id, val]) => { const el = $(id); if (el) el.innerText = fmt(val || 0) + ' ₪'; });

    // Early repayment penalty - only applies if selling BEFORE loan term ends
    // Penalty = discounting fee when BOI avg rate < contract rate (locked into higher rate)
    const simHorizon = params.simHorizon;
    const tm = params.termMix;
    const remainingMonthsAtExit = {
        prime: Math.max(0, (tm.p - simHorizon) * 12),
        kalatz: Math.max(0, (tm.k - simHorizon) * 12),
        malatz: Math.max(0, (tm.m - simHorizon) * 12),
        katz: Math.max(0, (tm.z - simHorizon) * 12),
        matz: Math.max(0, (tm.mt - simHorizon) * 12)
    };
    const originalTermMonths = {
        prime: tm.p * 12, kalatz: tm.k * 12, malatz: tm.m * 12, katz: tm.z * 12, matz: tm.mt * 12
    };
    // Months to next 5-year reset. If exactly on reset (0), keep as 0 for minimal fee
    const monthsToReset = {
        malatz: remainingMonthsAtExit.malatz > 0 ? (60 - (simHorizon * 12) % 60) % 60 : 0,
        matz: remainingMonthsAtExit.matz > 0 ? (60 - (simHorizon * 12) % 60) % 60 : 0
    };
    // BOI avg rate is typically close to contract rates; use BOI base - 0.5% as approximation
    const boiAvgRate = Math.max(0.02, params.market.boi - 0.005);
    const bal = res.balances || { p: 0, k: 0, z: 0, m: 0, mt: 0 };
    const r = params.rates;
    const earlyRepayFees = AppLogic.calcTotalEarlyRepaymentFees({
        balances: { prime: bal.p, kalatz: bal.k, malatz: bal.m, katz: bal.z, matz: bal.mt },
        rates: { prime: r.prime, kalatz: r.kalats, malatz: r.malatz, katz: r.katz, matz: r.matz },
        boiAvgRate,
        remainingMonths: remainingMonthsAtExit,
        originalTermMonths,
        monthsToReset,
        cpiIndex: res.cpiIndex || 1,
        prepayDay: 20,
        avgCpiChange12m: params.market.cpi / 12
    });
    const kEarlyRepay = $('kEarlyRepay');
    if (kEarlyRepay) kEarlyRepay.innerText = fmt(earlyRepayFees.total) + ' ₪';

    const posYears = res.firstPosMonth === null ? null : (res.firstPosMonth / 12);
    $('valPosCF')?.innerText && ($('valPosCF').innerText = res.firstPosMonth === null ? 'Never' : posYears.toFixed(1) + 'y');

    if (!skipCharts && series) {
        const entryCosts = (params.fees.purchaseTax || 0) + (assetPriceStart * (params.fees.buy || 0));
        const equity = parseFloat($('inpEquity').value) || 400000;
        window.__lastSim = { ...res, finalNetRE: lRE, finalNetSP: lSP, flowNet: series.flowNet[series.flowNet.length - 1], posCFYears: posYears };
        window.Charts.drawCharts(series.labels, series.reDataVal, series.reDataPct, series.spDataVal, series.spDataPct,
            series.flowRent, series.flowInt, series.flowPrinc, series.flowNet, series.surplusVal, series.surplusPct,
            { reTax: res.totalRETax, spTax: res.spTax, netRE: lRE, netSP: lSP, invested: res.totalCashInvested, surplusTax: res.reSideTax, surplusGross: res.reSideStockValue, entryCosts, equity },
            { mode, surplusMode, t, fmt, fmtNum });
        updateMobileCharts();
    }

    // Always update mobile (elements exist even if hidden)
    updateMobileKpis({
        reCAGR: res.cagrRE / 100,
        spCAGR: res.cagrSP / 100,
        reNet: lRE,
        spNet: lSP,
        totalInterest: res.totalInterestWasted,
        totalRent: res.totalRentCollected,
        assetPrice: assetPriceStart,
        mortgage: params.mortgage,
        leverage: params.mortgage / (parseFloat($('inpEquity').value) || 400000),
        entryCosts: (params.fees.purchaseTax || 0) + (assetPriceStart * (params.fees.buy || 0))
    });
    syncDesktopToMobile();
}

// ========== MOBILE FUNCTIONS ==========
function detectMobile() {
    const isMobile = window.innerWidth <= 768;
    document.body.classList.toggle('is-mobile', isMobile);
    return isMobile;
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.dataset.tab === tabName));
    localStorage.setItem('activeTab', tabName);
    if (tabName === 'charts') setTimeout(initMobileCharts, 100); // Delay for DOM
}

function toggleAccordion(section) {
    const el = document.querySelector(`.accordion-section[data-section="${section}"]`);
    if (!el) return;
    const wasOpen = el.classList.contains('open');
    document.querySelectorAll('.accordion-section').forEach(s => s.classList.remove('open'));
    if (!wasOpen) el.classList.add('open');
}

function toggleMobileSecondaryKpis() {
    const el = $('mobileSecondaryKpis');
    const btn = document.querySelector('.mobile-more-kpis-btn');
    if (el) {
        const isShowing = el.classList.toggle('show');
        if (btn) btn.innerHTML = `<span data-t="moreDetails">${t('moreDetails')}</span> ${isShowing ? '▲' : '▼'}`;
    }
}

function syncMobileSlider(desktopId, value) {
    const el = $(desktopId);
    if (el) { el.value = value; el.dispatchEvent(new Event('input')); }
    updateMobileDisplays();
}

function syncMobileMix(track, value) {
    const slider = $('slider' + track);
    const pct = $('pct' + track);
    if (slider) slider.value = value;
    if (pct) pct.value = value;
    syncMixInput(track);
    updateMobileDisplays();
}

function syncMobileCheckbox(desktopId, checked) {
    const el = $(desktopId);
    if (el) { el.checked = checked; el.dispatchEvent(new Event('change')); }
}

function syncMobileToDesktop() {
    // Sync buyer type
    const mBuyer = $('mBuyerType');
    const dBuyer = $('buyerType');
    if (mBuyer && dBuyer) dBuyer.value = mBuyer.value;
}

function syncDesktopToMobile() {
    // Sync equity
    const equity = $('inpEquity'), mEquity = $('mInpEquity');
    if (equity && mEquity) mEquity.value = equity.value;

    // Sync sliders
    const syncSlider = (dId, mId) => { const d = $(dId), m = $(mId); if (d && m) m.value = d.value; };
    syncSlider('rDown', 'mRDown');
    syncSlider('rDur', 'mRDur');
    syncSlider('sApp', 'mSApp');
    syncSlider('sSP', 'mSSP');
    syncSlider('sInf', 'mSInf');
    syncSlider('rBuyCost', 'mRBuyCost');
    syncSlider('rSellCost', 'mRSellCost');
    syncSlider('rMaint', 'mRMaint');

    // Sync mix
    ['Prime', 'Kalats', 'Malatz'].forEach(t => {
        const pct = $('pct' + t), m = $('mSlider' + t), disp = $('mDisp' + t);
        if (pct && m) m.value = pct.value;
        if (disp && pct) disp.textContent = pct.value + '%';
    });

    // Sync checkboxes
    const syncChk = (dId, mId) => { const d = $(dId), m = $(mId); if (d && m) m.checked = d.checked; };
    syncChk('cTaxSP', 'mCTaxSP');
    syncChk('cPurchaseTax', 'mCPurchaseTax');
    syncChk('cRentTax', 'mCRentTax');

    // Sync buyer type
    const dBuyer = $('buyerType'), mBuyer = $('mBuyerType');
    if (dBuyer && mBuyer) mBuyer.value = dBuyer.value;

    updateMobileDisplays();
}

function updateMobileDisplays() {
    // Update display values
    const setDisp = (id, val, suffix = '') => { const el = $(id); if (el) el.textContent = val + suffix; };
    setDisp('mDDown', $('rDown')?.value || 30, '%');
    setDisp('mDDur', $('rDur')?.value || 25, ' Yr');
    setDisp('mVApp', $('sApp')?.value || 4, '%');
    setDisp('mVSP', $('sSP')?.value || 9, '%');
    setDisp('mVInf', $('sInf')?.value || 2.5, '%');
    setDisp('mVBuy', $('rBuyCost')?.value || 2, '%');
    setDisp('mVSell', $('rSellCost')?.value || 2, '%');
    setDisp('mVMaint', $('rMaint')?.value || 8, '%');

    // Mix displays
    ['Prime', 'Kalats', 'Malatz'].forEach(t => {
        setDisp('mDisp' + t, $('pct' + t)?.value || 0, '%');
    });
}

function updateMobileKpis(data) {
    if (!data) return;

    // Safe number formatting
    const safeNum = v => (typeof v === 'number' && !isNaN(v) && isFinite(v)) ? v : 0;
    const fmtPct = v => safeNum(v * 100).toFixed(1) + '%';
    const fmtMoney = v => {
        const n = safeNum(v);
        if (Math.abs(n) >= 1000000) return '₪' + (n / 1000000).toFixed(2) + 'M';
        return '₪' + Math.round(n / 1000) + 'k';
    };

    const setKpi = (id, val) => { const el = $(id); if (el) el.textContent = val; };

    // Primary KPIs
    setKpi('mKpiReRoiVal', fmtPct(data.reCAGR));
    setKpi('mKpiSpRoiVal', fmtPct(data.spCAGR));
    setKpi('mKpiReNet', fmtMoney(data.reNet));
    setKpi('mKpiSpNet', fmtMoney(data.spNet));

    // Secondary KPIs
    setKpi('mKpiDiff', fmtPct(safeNum(data.reCAGR) - safeNum(data.spCAGR)));
    setKpi('mKpiInt', fmtMoney(data.totalInterest));
    setKpi('mKpiRent', fmtMoney(data.totalRent));

    // Deal summary
    setKpi('mValAsset', fmtMoney(data.assetPrice));
    setKpi('mValMortgage', fmtMoney(data.mortgage));
    setKpi('mValLev', 'x' + safeNum(data.leverage).toFixed(1));
    setKpi('mValEntry', fmtMoney(data.entryCosts));
}

let mWealthChart, mFlowChart;

function initMobileCharts() {
    const wCtx = $('mWealthChart')?.getContext('2d');
    const fCtx = $('mFlowChart')?.getContext('2d');
    if (!wCtx || !fCtx) return;
    if (!window.wealthChartInstance || !window.flowChartInstance) return;

    if (mWealthChart) mWealthChart.destroy();
    if (mFlowChart) mFlowChart.destroy();

    mWealthChart = new Chart(wCtx, {
        type: 'line',
        data: JSON.parse(JSON.stringify(window.wealthChartInstance.data)),
        options: { responsive: true, maintainAspectRatio: false }
    });

    mFlowChart = new Chart(fCtx, {
        type: 'bar',
        data: JSON.parse(JSON.stringify(window.flowChartInstance.data)),
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function updateMobileCharts() {
    if (!window.wealthChartInstance || !window.flowChartInstance) return;
    if (!mWealthChart || !mFlowChart) { initMobileCharts(); return; }

    mWealthChart.data = JSON.parse(JSON.stringify(window.wealthChartInstance.data));
    mWealthChart.update('none');
    mFlowChart.data = JSON.parse(JSON.stringify(window.flowChartInstance.data));
    mFlowChart.update('none');
}

function switchMobileChart(chartName) {
    document.querySelectorAll('.mobile-chart').forEach(c => c.classList.toggle('active', c.dataset.chart === chartName));
    document.querySelectorAll('.chart-dot').forEach(d => d.classList.toggle('active', d.dataset.chart === chartName));
}

function initMobileSwipe() {
    const container = document.querySelector('.mobile-chart-container');
    if (!container) return;
    let startX;
    container.addEventListener('touchstart', e => startX = e.touches[0].clientX);
    container.addEventListener('touchend', e => {
        const diff = startX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) switchMobileChart(diff > 0 ? 'flow' : 'wealth');
    });
}

const STORAGE_KEY = 'mortgageCalcState';

function saveState() {
    if (bootstrapping) return;
    const state = {
        equity: $('inpEquity')?.value, down: $('rDown')?.value, dur: $('rDur')?.value, hor: $('rHor')?.value,
        pctPrime: $('pctPrime')?.value, pctKalats: $('pctKalats')?.value, pctMalatz: $('pctMalatz')?.value, pctKatz: $('pctKatz')?.value, pctMatz: $('pctMatz')?.value,
        ratePrime: $('ratePrime')?.value, rateKalats: $('rateKalats')?.value, rateMalatz: $('rateMalatz')?.value, rateKatz: $('rateKatz')?.value, rateMatz: $('rateMatz')?.value,
        termPrime: $('termPrime')?.value, termKalats: $('termKalats')?.value, termMalatz: $('termMalatz')?.value, termKatz: $('termKatz')?.value, termMatz: $('termMatz')?.value,
        sSP: $('sSP')?.value, sApp: $('sApp')?.value, sInf: $('sInf')?.value, sInt: $('sInt')?.value, sYld: $('sYld')?.value,
        rBuyCost: $('rBuyCost')?.value, rSellCost: $('rSellCost')?.value, rTrade: $('rTrade')?.value, rMer: $('rMer')?.value, rMaint: $('rMaint')?.value, rDiscount: $('rDiscount')?.value,
        horMode, surplusMode, repayMethod, creditScore, taxMode, exMode, lockDown, lockTerm, lockHor, buyerType, mode, advancedTermMode,
        prepayments: getPrepayments(),
        usePurchaseTax: $('cPurchaseTax')?.checked ?? true, useMasShevach: $('cMasShevach')?.checked ?? false,
        useTaxSP: $('cTaxSP')?.checked ?? true, useRentTax: $('cRentTax')?.checked ?? false, entryCostsFromEquity: $('cEntryCostsFromEquity')?.checked ?? true
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { }
}

function loadState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return false;
        const s = JSON.parse(saved);
        const setVal = (id, val) => { const el = $(id); if (el && val != null) el.value = val; };
        const setChk = (id, val) => { const el = $(id); if (el && val != null) el.checked = val; };
        setVal('inpEquity', s.equity); setVal('rDown', s.down); setVal('rDur', s.dur); setVal('rHor', s.hor);
        setVal('pctPrime', s.pctPrime); setVal('sliderPrime', s.pctPrime);
        setVal('pctKalats', s.pctKalats); setVal('sliderKalats', s.pctKalats);
        setVal('pctMalatz', s.pctMalatz); setVal('sliderMalatz', s.pctMalatz);
        setVal('pctKatz', s.pctKatz); setVal('sliderKatz', s.pctKatz);
        setVal('pctMatz', s.pctMatz); setVal('sliderMatz', s.pctMatz);
        setVal('ratePrime', s.ratePrime); setVal('rateKalats', s.rateKalats); setVal('rateMalatz', s.rateMalatz); setVal('rateKatz', s.rateKatz); setVal('rateMatz', s.rateMatz);
        setVal('termPrime', s.termPrime); setVal('termKalats', s.termKalats); setVal('termMalatz', s.termMalatz); setVal('termKatz', s.termKatz); setVal('termMatz', s.termMatz);
        setVal('sSP', s.sSP); setVal('sApp', s.sApp); setVal('sInf', s.sInf); setVal('sInt', s.sInt); setVal('sYld', s.sYld);
        setVal('rBuyCost', s.rBuyCost); setVal('rSellCost', s.rSellCost); setVal('rTrade', s.rTrade); setVal('rMer', s.rMer); setVal('rMaint', s.rMaint); setVal('rDiscount', s.rDiscount);
        setChk('cPurchaseTax', s.usePurchaseTax); setChk('cMasShevach', s.useMasShevach);
        setChk('cTaxSP', s.useTaxSP); setChk('cRentTax', s.useRentTax); setChk('cEntryCostsFromEquity', s.entryCostsFromEquity);
        if (s.horMode) setState('horMode', s.horMode);
        if (s.surplusMode) setState('surplusMode', s.surplusMode);
        if (s.repayMethod) setState('repayMethod', s.repayMethod);
        if (s.creditScore) setState('creditScore', s.creditScore);
        if (s.taxMode) setState('taxMode', s.taxMode);
        if (s.exMode) setState('exMode', s.exMode);
        if (s.lockDown != null) setState('lockDown', s.lockDown);
        if (s.lockTerm != null) setState('lockTerm', s.lockTerm);
        if (s.lockHor != null) setState('lockHor', s.lockHor);
        if (s.advancedTermMode != null) setState('advancedTermMode', s.advancedTermMode);
        if (s.buyerType) setState('buyerType', s.buyerType);
        if (s.mode) setState('mode', s.mode);
        if (s.prepayments) window.Prepayments?.setPrepayments(s.prepayments);
        return true;
    } catch (e) { return false; }
}

function bootstrap() {
    S.set('bootstrapping', true);
    bootstrapping = true;

    // Mobile detection
    detectMobile();
    window.addEventListener('resize', () => { detectMobile(); syncDesktopToMobile(); });

    window.Prepayments?.init(runSim);
    if (localStorage.getItem('darkMode') === 'true') document.body.classList.add('dark');
    if (lang === 'he') { document.documentElement.lang = 'he'; document.documentElement.dir = 'rtl'; document.body.classList.add('rtl'); }
    const hadSaved = loadState();
    applyTranslations();
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
    if (advancedTermMode) { $('advancedTermBox').style.display = 'block'; $('basicTermBox').style.display = 'none'; $('btnAdvancedTerm')?.classList.add('active'); TRACKS.forEach(t => showTermVal('term' + t + 'Val', $('term' + t)?.value)); }

    // Mobile init
    syncDesktopToMobile();
    initMobileSwipe();
    const savedTab = localStorage.getItem('activeTab');
    if (savedTab) switchTab(savedTab);

    S.set('bootstrapping', false);
    bootstrapping = false;
    runSim();

    // Init mobile charts after first render
    setTimeout(initMobileCharts, 500);
}

function updateRateLabels() {
    TRACKS.forEach(track => { const lbl = $('lblRate' + track), inp = $('rate' + track); if (lbl && inp) lbl.innerText = parseFloat(inp.value).toFixed(2) + ((track === 'Katz' || track === 'Matz') ? '% ' + t('cpiSuffix') : '%'); });
}

function resetAll() { if (confirm('Reset all settings to defaults?')) { localStorage.removeItem(STORAGE_KEY); location.reload(); } }
function toggleDarkMode() { document.body.classList.toggle('dark'); localStorage.setItem('darkMode', document.body.classList.contains('dark')); runSim({ skipSweetSpots: true }); }
function printResults() { window.print(); }

Object.assign(window, {
    setMode, tgl, setGlobalMode, applyScenario, applyTamheel, tglHor, setTaxMode, updMeter, checkMix, syncPrime,
    calcPmt: AppLogic.calcPmt, calcCAGR: AppLogic.calcCAGR, updateSweetSpots, runSim, setCreditScore, toggleLock,
    setBuyerType, syncTrackTermsToMain, showTermVal, toggleAdvancedTerms, setSurplusMode, syncMixInput,
    toggleRateEdit, toggleLang, resetAll, toggleDarkMode, printResults,
    // Mobile functions
    switchTab, toggleAccordion, toggleMobileSecondaryKpis, syncMobileSlider, syncMobileMix, syncMobileCheckbox,
    syncMobileToDesktop, switchMobileChart
});

document.addEventListener('DOMContentLoaded', bootstrap);
