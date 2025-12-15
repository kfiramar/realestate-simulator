// Pure logic module

// Purchase Tax brackets (valid 16.01.2024 to 15.01.2028)
const PURCHASE_TAX_FIRST = [[1978745, 0], [2347040, 0.035], [6055070, 0.05], [20183565, 0.08], [Infinity, 0.10]];
const PURCHASE_TAX_ADD = [[6055070, 0.08], [Infinity, 0.10]];

function calcPurchaseTax(value, isFirst = true) {
    const brackets = isFirst ? PURCHASE_TAX_FIRST : PURCHASE_TAX_ADD;
    let tax = 0, prev = 0;
    for (const [limit, rate] of brackets) {
        if (value <= prev) break;
        tax += (Math.min(value, limit) - prev) * rate;
        prev = limit;
    }
    return Math.round(tax);
}

// Mas Shevach (Capital Gains Tax)
const MAS_SHEVACH_CAP = 5008000;

function calcMasShevach(salePrice, costBasis, type = 'single') {
    const gain = salePrice - costBasis;
    if (gain <= 0) return { tax: 0, exemptGain: 0, taxableGain: 0 };
    if (type === 'none') return { tax: Math.round(gain * 0.25), exemptGain: 0, taxableGain: gain };
    if (salePrice <= MAS_SHEVACH_CAP) return { tax: 0, exemptGain: gain, taxableGain: 0 };
    const exemptFrac = MAS_SHEVACH_CAP / salePrice;
    return { tax: Math.round(gain * (1 - exemptFrac) * 0.25), exemptGain: gain * exemptFrac, taxableGain: gain * (1 - exemptFrac) };
}

// Historical data
const H_SP = [0.1088, 0.0491, 0.1579, 0.0549, -0.3700, 0.2646, 0.1506, 0.0211, 0.1600, 0.3239, 0.1369, 0.0138, 0.1196, 0.2183, -0.0438, 0.3149, 0.1840, 0.2871, -0.1811, 0.2629, 0.2400];
const H_RE = [-0.02, 0.04, 0.00, 0.03, 0.06, 0.19, 0.15, 0.04, 0.05, 0.08, 0.06, 0.07, 0.05, 0.04, 0.01, 0.03, 0.04, 0.12, 0.18, 0.02, 0.05];
const H_EX = [4.48, 4.49, 4.45, 4.11, 3.59, 3.93, 3.73, 3.58, 3.85, 3.61, 3.58, 3.88, 3.84, 3.60, 3.59, 3.56, 3.44, 3.23, 3.36, 3.68, 3.75];
const H_CPI = [0.012, 0.024, -0.001, 0.034, 0.038, 0.039, 0.027, 0.022, 0.016, 0.018, -0.002, -0.010, -0.002, 0.004, 0.008, 0.006, -0.007, 0.028, 0.053, 0.030, 0.032];
const H_BOI = [0.041, 0.035, 0.050, 0.040, 0.035, 0.010, 0.015, 0.030, 0.025, 0.015, 0.0075, 0.001, 0.001, 0.001, 0.0025, 0.001, 0.001, 0.035, 0.045, 0.045];
const getH = (arr, i) => i < arr.length ? arr[i] : arr[arr.length - 1];

// Core calculations
function calcPmt(p, rAnn, m) {
    if (p <= 0.01) return 0;
    if (rAnn === 0) return p / m;
    const r = rAnn / 12;
    return p * (r * Math.pow(1 + r, m)) / (Math.pow(1 + r, m) - 1);
}

// IRR calculation (Newton-Raphson)
function calcIRR(cashFlows, finalValue, totalMonths) {
    let r = 0.007;
    for (let i = 0; i < 50; i++) {
        let fv = 0, dfv = 0;
        for (const cf of cashFlows) {
            const n = totalMonths - cf.month;
            fv += cf.amount * Math.pow(1 + r, n);
            dfv += cf.amount * n * Math.pow(1 + r, n - 1);
        }
        if (Math.abs(fv - finalValue) < 0.01) break;
        r -= (fv - finalValue) / dfv;
    }
    return (Math.pow(1 + r, 12) - 1) * 100;
}

// Core Simulation Engine
function simulate(params) {
    const {
        equity, downPct,
        loanTerm, // default term in years
        termMix, // { p, k, z, m, mt } (optional)
        mix, // { prime, kalats, katz, malatz, matz } (percentages)
        rates, // { prime, kalats, katz, malatz, matz } (decimal)
        market, // { sp, reApp, cpi, boi, rentYield } (decimals)
        fees, // { buy, sell, trade, mgmt }
        tax, // { use, useRent, mode }
        config, // { drift, surplusMode, exMode, history, repayMethod }
        prepay, // { p, k, m, z, mt } each with { amt, yr }
        returnSeries // boolean
    } = params;

    const repayMethod = config.repayMethod || 'spitzer';
    const purchaseDiscount = params.purchaseDiscount || 0;
    const assetPrice = equity / downPct;
    const totalLoan = assetPrice - equity;
    // If bought at discount, true market value is higher
    let assetVal = assetPrice / (1 - purchaseDiscount);

    // Terms
    const terms = {
        p: (termMix?.p || loanTerm) * 12,
        k: (termMix?.k || loanTerm) * 12,
        z: (termMix?.z || loanTerm) * 12,
        m: (termMix?.m || loanTerm) * 12,
        mt: (termMix?.mt || loanTerm) * 12
    };

    // Initial principals for equal principal method
    const initPrinc = {
        p: totalLoan * (mix.prime / 100),
        k: totalLoan * (mix.kalats / 100),
        z: totalLoan * (mix.katz / 100),
        m: totalLoan * ((mix.malatz || 0) / 100),
        mt: totalLoan * ((mix.matz || 0) / 100)
    };

    // Initialize Tracks
    let balP = initPrinc.p;
    let balK = initPrinc.k;
    let balZ = initPrinc.z;
    let balM = initPrinc.m;
    let balMT = initPrinc.mt;

    // Initial Costs
    const entryCosts = assetPrice * fees.buy + (fees.purchaseTax || 0);
    let totalCashInvested = equity + entryCosts;

    // Cash flow tracking for IRR: [{ month, amount }]
    const spCashFlows = [{ month: 0, amount: totalCashInvested }];
    const reCashFlows = [{ month: 0, amount: totalCashInvested }];

    // S&P Setup
    let spUnits = 0;
    let spBasisLinked = totalCashInvested;
    let spBasisUSD = 0;
    let spInvestedILS = totalCashInvested;
    let spValueHedged = totalCashInvested;

    const startEx = getH(H_EX, 0);
    let currentEx = startEx;
    if (config.exMode !== 'hedged') {
        spUnits = totalCashInvested / startEx;
        spBasisUSD = spUnits;
    }

    // RE Side Portfolios
    let reSideStockValue = 0;
    let reSideStockBasis = 0;        // Nominal basis
    let reSideStockBasisLinked = 0;  // Inflation-adjusted basis
    let reSideCash = 0;
    let spSideCash = 0;

    let totalInterestWasted = 0;
    let totalRentCollected = 0;
    let firstPosMonth = null;

    // Series Storage
    const series = {
        labels: [],
        reDataPct: [], spDataPct: [],
        reDataVal: [], spDataVal: [],
        surplusVal: [], surplusPct: [],
        flowMort: [], flowRent: [], flowNet: [], flowInt: [], flowPrinc: []
    };

    // Constants
    const taxThresholdBase = 5654;
    let cpiIndex = 1.0;

    // Spread Calculation (from Initial Rates vs Initial BoI)
    const spreadPrime = rates.prime - market.boi;
    const spreadMalatz = (rates.malatz || 0) - market.boi;
    const spreadMatz = (rates.matz || 0) - market.boi;

    // Dynamic Rates (Variable tracks)
    let ratePrime = rates.prime;
    let rateMalatz = rates.malatz || 0;
    let rateMatz = rates.matz || 0;

    const driftFactor = 1 + (config.drift / 100);
    const mDrift = Math.pow(driftFactor, 1 / 12) - 1;

    const simDur = params.simHorizon;

    for (let y = 0; y < simDur; y++) {
        // Determine Annual Rates (History vs Fixed)
        const useHist = config.history || {};

        const rSP = useHist.SP?.is ? getH(H_SP, y) : market.sp;
        const rApp = useHist.App?.is ? getH(H_RE, y) : market.reApp;
        const rInf = useHist.Inf?.is ? getH(H_CPI, y) : market.cpi;
        const baseBoI = useHist.Int?.is ? getH(H_BOI, y) : market.boi;

        // Update Floating Rate (Prime)
        ratePrime = baseBoI + spreadPrime;
        // Kalats/Katz are Fixed
        const rateKalats = rates.kalats;
        const rateKatz = rates.katz;

        let rYld = market.rentYield;
        if (useHist.Yld?.is) rYld = 0.042 - ((Math.min(y, 20) / 20) * (0.042 - 0.028));

        // Monthly Factors
        const mSP = Math.pow(1 + rSP - fees.mgmt, 1 / 12) - 1;
        const mApp = Math.pow(1 + rApp, 1 / 12) - 1;
        const mInf = Math.pow(1 + rInf, 1 / 12) - 1;

        // Annual Aggregates for Charts
        let yrRent = 0, yrNet = 0, yrInt = 0, yrPrinc = 0;
        let firstMonthRent = 0, firstMonthInt = 0, firstMonthPrinc = 0, firstMonthNet = 0;

        // Apply prepayments at start of specified year
        if (prepay && Array.isArray(prepay)) {
            const bals = { p: balP, k: balK, m: balM, z: balZ, mt: balMT };
            prepay.filter(p => p.yr - 1 === y && p.amt > 0).forEach(p => {
                const amt = Math.min(p.amt, bals[p.track] || 0);
                if (amt > 0) {
                    bals[p.track] -= amt;
                    totalCashInvested += amt;
                    spCashFlows.push({ month: y * 12, amount: amt });
                    reCashFlows.push({ month: y * 12, amount: amt });
                    spValueHedged += amt; spInvestedILS += amt; spBasisLinked += amt;
                    if (config.exMode !== 'hedged') { spUnits += amt / currentEx; spBasisUSD += amt / currentEx; }
                }
            });
            balP = bals.p; balK = bals.k; balM = bals.m; balZ = bals.z; balMT = bals.mt;
        }

        for (let m = 0; m < 12; m++) {
            const globalM = (y * 12) + m;

            // 5-Year Reset Logic for Malatz/Matz
            if (globalM > 0 && globalM % 60 === 0) {
                rateMalatz = baseBoI + spreadMalatz;
                rateMatz = baseBoI + spreadMatz;
            }

            const taxLimit = taxThresholdBase * cpiIndex;

            // Payments
            let pmtTotal = 0, intTotal = 0, princTotal = 0;

            // Track payment helper
            const processTrack = (bal, rate, ml, initP, term, cpiLinked) => {
                if (bal <= 10 || ml <= 0) return { bal, pmt: 0, int: 0, princ: 0 };
                const realI = bal * (rate / 12);
                const realPr = Math.min(bal, repayMethod === 'equalPrincipal' ? initP / term : calcPmt(bal, rate, ml) - realI);
                const newBal = bal - realPr;
                if (cpiLinked) {
                    return { bal: newBal, pmt: (realI + realPr) * cpiIndex, int: realI * cpiIndex, princ: realPr * cpiIndex };
                }
                return { bal: newBal, pmt: realI + realPr, int: realI, princ: realPr };
            };

            // Process all tracks
            let r;
            r = processTrack(balP, ratePrime, terms.p - globalM, initPrinc.p, terms.p, false);
            balP = r.bal; pmtTotal += r.pmt; intTotal += r.int; princTotal += r.princ;

            r = processTrack(balK, rateKalats, terms.k - globalM, initPrinc.k, terms.k, false);
            balK = r.bal; pmtTotal += r.pmt; intTotal += r.int; princTotal += r.princ;

            r = processTrack(balZ, rateKatz, terms.z - globalM, initPrinc.z, terms.z, true);
            balZ = r.bal; pmtTotal += r.pmt; intTotal += r.int; princTotal += r.princ;

            r = processTrack(balM, rateMalatz, terms.m - globalM, initPrinc.m, terms.m, false);
            balM = r.bal; pmtTotal += r.pmt; intTotal += r.int; princTotal += r.princ;

            r = processTrack(balMT, rateMatz, terms.mt - globalM, initPrinc.mt, terms.mt, true);
            balMT = r.bal; pmtTotal += r.pmt; intTotal += r.int; princTotal += r.princ;

            totalInterestWasted += intTotal;

            // Rent
            const grossRent = (assetVal * rYld) / 12;
            let rentTaxVal = 0;
            if (tax.useRent && grossRent > taxLimit) rentTaxVal = (grossRent - taxLimit) * 0.10;
            const netRent = (grossRent * (1 - params.maintPct)) - rentTaxVal;

            totalRentCollected += netRent;
            const oop = pmtTotal - netRent;

            yrRent += netRent;
            yrInt += intTotal;
            yrPrinc += princTotal;
            yrNet += (netRent - pmtTotal);

            if (m === 0) {
                firstMonthRent = netRent;
                firstMonthInt = intTotal;
                firstMonthPrinc = princTotal;
                firstMonthNet = netRent - pmtTotal;
            }

            if (firstPosMonth === null && oop < 0) firstPosMonth = globalM;

            // Surplus / Deficit
            if (oop < 0) {
                const surplus = Math.abs(oop);
                const mode = config.surplusMode;
                if (mode === 'invest' || mode === true) {
                    const net = surplus * (1 - fees.trade);
                    reSideStockValue += net; reSideStockBasis += net; reSideStockBasisLinked += net;
                } else reSideCash += surplus;

                if (mode === 'match') {
                    const grossTarget = surplus / (1 - fees.trade);
                    const isHedged = config.exMode === 'hedged';
                    const used = isHedged ? Math.min(spValueHedged, grossTarget) : Math.min(spUnits * currentEx, grossTarget);
                    if (isHedged) { spValueHedged -= used; spInvestedILS = Math.max(0, spInvestedILS - used); }
                    else { spUnits -= used / currentEx; spBasisUSD = Math.max(0, spBasisUSD - used / currentEx); }
                    spBasisLinked = Math.max(0, spBasisLinked - used);
                    spSideCash += used * (1 - fees.trade);
                }
            } else {
                // Deficit - inject into S&P
                totalCashInvested += oop;
                spCashFlows.push({ month: globalM, amount: oop });
                reCashFlows.push({ month: globalM, amount: oop });
                spBasisLinked += oop;
                const net = oop * (1 - fees.trade);
                if (config.exMode === 'hedged') { spValueHedged += net; spInvestedILS += oop; }
                else { spUnits += net / currentEx; spBasisUSD += oop / currentEx; }
            }

            spBasisLinked *= (1 + mInf);
            reSideStockBasisLinked *= (1 + mInf);

            // Growth
            if (config.exMode === 'hedged') spValueHedged *= (1 + mSP);
            else spUnits *= (1 + mSP);
            reSideStockValue *= (1 + mSP);

            // End-of-month appreciation/inflation/exchange updates
            cpiIndex *= (1 + mInf);
            assetVal *= (1 + mApp);
            if (config.exMode !== 'hist') currentEx *= (1 + mDrift);
            else currentEx = getH(H_EX, y);

            // Chart Data (End of Year)
            if (m === 11 && returnSeries) {
                const remainingLoan = balP + balK + balZ + balM + balMT;
                const exitVal = assetVal * (1 - fees.sell);
                const spValILS = config.exMode === 'hedged' ? spValueHedged : spUnits * currentEx;
                const netRE = exitVal - remainingLoan + reSideStockValue + reSideCash;
                const netSP = spValILS + spSideCash;

                series.labels.push(y + 1);
                series.flowRent.push(firstMonthRent);
                series.flowInt.push(-firstMonthInt);
                series.flowPrinc.push(-firstMonthPrinc);
                series.flowNet.push(firstMonthNet);
                series.reDataVal.push(netRE);
                series.spDataVal.push(netSP);
                series.reDataPct.push(((netRE - spInvestedILS) / spInvestedILS) * 100);
                series.spDataPct.push(((netSP - spInvestedILS) / spInvestedILS) * 100);
                series.surplusVal.push(reSideStockValue);
                series.surplusPct.push((reSideStockValue / spInvestedILS) * 100);
            }
        }
    }

    // Final Calculation
    const remainingLoan = balP + balK + balZ + balM + balMT;
    const exitValue = assetVal * (1 - fees.sell);
    const spValILS = config.exMode === 'hedged' ? spValueHedged : spUnits * currentEx;

    let reSideTax = 0;
    if (tax.useRE) {
        const reBasis = tax.mode === 'real' ? reSideStockBasisLinked : reSideStockBasis;
        if (reSideStockValue > reBasis) reSideTax = (reSideStockValue - reBasis) * 0.25;
    }
    
    const masShevach = tax.useMasShevach ? calcMasShevach(assetVal, assetPrice * cpiIndex, tax.masShevachType || 'single').tax : 0;
    const netRE = exitValue - masShevach - remainingLoan + (reSideStockValue - reSideTax) + reSideCash;

    let spTax = 0;
    if (tax.useSP) {
        const profit = tax.mode === 'real' ? spValILS - spBasisLinked
            : config.exMode === 'hedged' ? spValILS - spInvestedILS
            : (spUnits - spBasisUSD) * currentEx;
        if (profit > 0) spTax = profit * 0.25;
    }
    const netSP = spValILS - spTax + spSideCash;

    const totalMonths = simDur * 12;
    const cagrRE = calcIRR(reCashFlows, netRE, totalMonths);
    const cagrSP = calcIRR(spCashFlows, netSP, totalMonths);

    // Pre-tax values for chart visualization
    const grossRE = exitValue - remainingLoan + reSideStockValue + reSideCash;
    const grossSP = spValILS + spSideCash;
    const totalRETax = masShevach + reSideTax;

    return {
        netRE, netSP, cagrRE, cagrSP,
        grossRE, grossSP, totalRETax, reSideTax,
        totalCashInvested, totalInterestWasted, totalRentCollected,
        firstPosMonth, remainingLoan, reSideStockValue,
        spValueHedged, spUnits, spBasisLinked, spBasisUSD,
        masShevach, spTax, series
    };
}

// Adapter for legacy calcCAGR callers (Optimizer & Tests)
function calcCAGR(eq, downPct, mortDur, simDur, useTaxSP, tradeFee, merFee, exModeCalc, taxModeCalc, cfgCalc, overrides, useRentTax, mix, buyCostPct, maintPct, sellCostPct, drift, surplusMode, useTaxRE, termMix, purchaseTax, useMasShevach, masShevachType, purchaseDiscount) {
    const taxSP = useTaxSP ?? true, taxRE = useTaxRE ?? taxSP;
    return simulate({
        equity: eq, downPct, loanTerm: mortDur, simHorizon: simDur, mix, maintPct, purchaseDiscount: purchaseDiscount || 0,
        termMix: termMix || { p: mortDur, k: mortDur, z: mortDur, m: mortDur, mt: mortDur },
        rates: { prime: overrides.RateP, kalats: overrides.RateK, katz: overrides.RateZ, malatz: overrides.RateM || 0, matz: overrides.RateMT || 0 },
        market: { sp: overrides.SP, reApp: overrides.App, cpi: overrides.Inf, boi: overrides.Int, rentYield: overrides.Yld },
        fees: { buy: buyCostPct, sell: sellCostPct, trade: tradeFee, mgmt: merFee, purchaseTax: purchaseTax || 0 },
        tax: { useSP: taxSP, useRE: taxRE, useRent: useRentTax, useMasShevach: useMasShevach || false, masShevachType: masShevachType || 'single', mode: taxModeCalc },
        config: { drift, surplusMode, exMode: exModeCalc, history: cfgCalc },
        returnSeries: false
    }).cagrRE;
}

function searchSweetSpots(params) {
    const { eq, curDown, curDur, simDur, useTaxSP, useTaxRE, useRentTax, tradeFee, merFee, buyCostPct, maintPct, sellCostPct, overrides, mix, drift, lockDown, lockTerm, lockHor, horMode, cfg, exMode, taxMode, calcOverride, surplusMode, termMix, purchaseTax, useMasShevach, masShevachType, purchaseDiscount, optimizeMode } = params;

    const scoreFn = (d, t, h) => {
        const res = simulate({
            equity: eq, downPct: d / 100, loanTerm: t, simHorizon: h, mix, maintPct, purchaseDiscount: purchaseDiscount || 0,
            termMix: termMix || { p: t, k: t, z: t, m: t, mt: t },
            rates: { prime: overrides.RateP, kalats: overrides.RateK, katz: overrides.RateZ, malatz: overrides.RateM || 0, matz: overrides.RateMT || 0 },
            market: { sp: overrides.SP, reApp: overrides.App, cpi: overrides.Inf, boi: overrides.Int, rentYield: overrides.Yld },
            fees: { buy: buyCostPct, sell: sellCostPct, trade: tradeFee, mgmt: merFee, purchaseTax: purchaseTax || 0 },
            tax: { useSP: useTaxSP ?? true, useRE: useTaxRE ?? useTaxSP ?? true, useRent: useRentTax, useMasShevach: useMasShevach || false, masShevachType: masShevachType || 'single', mode: taxMode },
            config: { drift, surplusMode, exMode, history: cfg }, returnSeries: false
        });
        return optimizeMode === 'outperform' ? (res.netSP > 0 ? ((res.netRE - res.netSP) / res.netSP) * 100 : res.netRE) : res.cagrRE;
    };

    const range = (start, end, step) => { const r = []; for (let i = start; i <= end; i += step) r.push(i); return r; };
    const downVals = lockDown ? [curDown * 100] : range(25, 100, 5);
    const termVals = lockTerm ? [curDur] : range(10, 30, 1);
    const horVals = lockHor || horMode === 'auto' ? [simDur] : range(5, 50, 2);

    let best = { d: downVals[0], t: termVals[0], h: horVals[0], c: -Infinity };
    for (const d of downVals) {
        for (const t of termVals) {
            for (const h of horVals) {
                const simH = (horMode === 'auto' && !lockHor) ? t : h;
                const c = calcOverride ? calcOverride(eq, d / 100, t, simH, useTaxSP, tradeFee, merFee, exMode, taxMode, cfg, overrides, useRentTax, mix, buyCostPct, maintPct, sellCostPct, drift, surplusMode, useTaxRE, termMix, purchaseTax, useMasShevach, masShevachType, purchaseDiscount) : scoreFn(d, t, simH);
                if (c > best.c || (Math.abs(c - best.c) < 0.05 && t > best.t)) best = { d, t, h: simH, c };
            }
        }
    }
    return best;
}

// Balance after k payments (closed-form)
function calcBalanceAfterK(P, rAnn, n, k, method = 'spitzer') {
    if (k >= n) return 0;
    if (k <= 0) return P;
    if (method === 'equalPrincipal') return P * (1 - k / n);
    const r = rAnn / 12;
    if (r === 0) return P * (1 - k / n);
    const A = calcPmt(P, rAnn, n), factor = Math.pow(1 + r, k);
    return P * factor - A * (factor - 1) / r;
}

// Total interest over loan life (closed-form)
function calcTotalInterest(P, rAnn, n, method = 'spitzer') {
    if (method === 'equalPrincipal') return (rAnn / 12) * P * (n + 1) / 2;
    return calcPmt(P, rAnn, n) * n - P;
}

// Generate full amortization schedule
function generateSchedule(params) {
    const { principal: P, annualRate, termMonths: n, method = 'spitzer', cpiLinked = false, cpiRate = 0, rateResets = [] } = params;
    const schedule = [], resets = [...rateResets].sort((a, b) => a.month - b.month);
    let balance = P, currentRate = annualRate, totalInterest = 0, totalPayments = 0, resetIdx = 0;
    let payment = method === 'spitzer' ? calcPmt(P, currentRate, n) : 0;
    const round = v => Math.round(v * 100) / 100;

    for (let t = 1; t <= n; t++) {
        while (resetIdx < resets.length && resets[resetIdx].month === t) {
            currentRate = resets[resetIdx++].newRate;
            if (method === 'spitzer') payment = calcPmt(balance, currentRate, n - t + 1);
        }

        let cpiFactor = 1;
        if (cpiLinked) {
            const annualCpi = Array.isArray(cpiRate) ? (cpiRate[Math.floor((t - 1) / 12)] ?? cpiRate[cpiRate.length - 1]) : cpiRate;
            cpiFactor = Math.pow(1 + annualCpi, 1 / 12);
            balance *= cpiFactor;
        }

        const interest = balance * (currentRate / 12);
        let principalPaid = method === 'equalPrincipal' ? Math.min(P / n, balance) : (cpiLinked ? calcPmt(balance, currentRate, n - t + 1) : payment) - interest;
        if (principalPaid > balance) principalPaid = balance;
        payment = principalPaid + interest;
        balance = Math.max(0, balance - principalPaid);
        totalInterest += interest; totalPayments += payment;

        schedule.push({ month: t, payment: round(payment), interest: round(interest), principal: round(principalPaid), balance: round(balance), cpiAdjustment: cpiLinked ? round((cpiFactor - 1) * balance) : 0 });
    }

    return { schedule, totalInterest: round(totalInterest), totalPayments: round(totalPayments), method, principal: P, annualRate, termMonths: n };
}

const Logic = { calcPmt, calcCAGR, searchSweetSpots, simulate, H_SP, H_RE, H_EX, H_CPI, H_BOI, getH, generateSchedule, calcBalanceAfterK, calcTotalInterest, calcPurchaseTax, calcMasShevach };

if (typeof module !== 'undefined' && module.exports) module.exports = Logic;
if (typeof window !== 'undefined') window.Logic = Logic;