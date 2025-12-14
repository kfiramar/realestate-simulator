// Pure logic module: constants, calcPmt, calcCAGR, searchSweetSpots, and simulate.

// Purchase Tax (מס רכישה) brackets - valid 16.01.2024 to 15.01.2028
const PURCHASE_TAX_FIRST_HOME = [
    { limit: 1978745, rate: 0 },
    { limit: 2347040, rate: 0.035 },
    { limit: 6055070, rate: 0.05 },
    { limit: 20183565, rate: 0.08 },
    { limit: Infinity, rate: 0.10 }
];

const PURCHASE_TAX_ADDITIONAL = [
    { limit: 6055070, rate: 0.08 },
    { limit: Infinity, rate: 0.10 }
];

function calcPurchaseTax(propertyValue, isFirstHome = true) {
    const brackets = isFirstHome ? PURCHASE_TAX_FIRST_HOME : PURCHASE_TAX_ADDITIONAL;
    let tax = 0;
    let prevLimit = 0;
    
    for (const bracket of brackets) {
        if (propertyValue <= prevLimit) break;
        const taxableInBracket = Math.min(propertyValue, bracket.limit) - prevLimit;
        if (taxableInBracket > 0) {
            tax += taxableInBracket * bracket.rate;
        }
        prevLimit = bracket.limit;
    }
    
    return Math.round(tax);
}

// --- MAS SHEVACH (Capital Gains Tax) ---
const MAS_SHEVACH_EXEMPTION_CAP = 5008000; // 2024-2027

function calcMasShevach(salePrice, costBasis, exemptionType = 'single') {
    const realGain = salePrice - costBasis;
    if (realGain <= 0) return { tax: 0, exemptGain: 0, taxableGain: 0 };
    
    // 'none' = investment property, no exemption
    if (exemptionType === 'none') {
        return { tax: Math.round(realGain * 0.25), exemptGain: 0, taxableGain: realGain };
    }
    
    // 'single' = single apartment exemption with cap
    if (salePrice <= MAS_SHEVACH_EXEMPTION_CAP) {
        return { tax: 0, exemptGain: realGain, taxableGain: 0 };
    }
    
    // Luxury apartment: pro-rata split
    const exemptFraction = MAS_SHEVACH_EXEMPTION_CAP / salePrice;
    const exemptGain = realGain * exemptFraction;
    const taxableGain = realGain * (1 - exemptFraction);
    return { tax: Math.round(taxableGain * 0.25), exemptGain, taxableGain };
}

const H_SP = [0.1088, 0.0491, 0.1579, 0.0549, -0.3700, 0.2646, 0.1506, 0.0211, 0.1600, 0.3239, 0.1369, 0.0138, 0.1196, 0.2183, -0.0438, 0.3149, 0.1840, 0.2871, -0.1811, 0.2629, 0.2400];
const H_RE = [-0.02, 0.04, 0.00, 0.03, 0.06, 0.19, 0.15, 0.04, 0.05, 0.08, 0.06, 0.07, 0.05, 0.04, 0.01, 0.03, 0.04, 0.12, 0.18, 0.02, 0.05];
const H_EX = [4.48, 4.49, 4.45, 4.11, 3.59, 3.93, 3.73, 3.58, 3.85, 3.61, 3.58, 3.88, 3.84, 3.60, 3.59, 3.56, 3.44, 3.23, 3.36, 3.68, 3.75];
const H_CPI = [0.012, 0.024, -0.001, 0.034, 0.038, 0.039, 0.027, 0.022, 0.016, 0.018, -0.002, -0.010, -0.002, 0.004, 0.008, 0.006, -0.007, 0.028, 0.053, 0.030, 0.032];
const H_BOI = [0.041, 0.035, 0.050, 0.040, 0.035, 0.010, 0.015, 0.030, 0.025, 0.015, 0.0075, 0.001, 0.001, 0.001, 0.0025, 0.001, 0.001, 0.035, 0.045, 0.045];

function getH(arr, i) { return i < arr.length ? arr[i] : arr[arr.length - 1]; }

function calcPmt(p, rAnn, m) {
    if (p <= 0.01) return 0;
    if (rAnn === 0) return p / m;
    let r = rAnn / 12;
    return p * (r * Math.pow(1 + r, m)) / (Math.pow(1 + r, m) - 1);
}

// Calculate IRR (annualized) given cash flows and final value
// cashFlows: [{ month, amount }], finalValue: number, totalMonths: number
function calcIRR(cashFlows, finalValue, totalMonths) {
    // Newton-Raphson to find monthly rate r where:
    // sum(cf.amount * (1+r)^(totalMonths - cf.month)) = finalValue
    let r = 0.007; // Initial guess ~8.7% annual
    for (let i = 0; i < 50; i++) {
        let fv = 0, dfv = 0;
        for (const cf of cashFlows) {
            const n = totalMonths - cf.month;
            fv += cf.amount * Math.pow(1 + r, n);
            dfv += cf.amount * n * Math.pow(1 + r, n - 1);
        }
        const err = fv - finalValue;
        if (Math.abs(err) < 0.01) break;
        r -= err / dfv;
    }
    return (Math.pow(1 + r, 12) - 1) * 100; // Convert monthly to annual %
}

/**
 * Core Simulation Engine
 * Handles both optimizing (single value return) and charting (time series return).
 */
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

        // Apply prepayments at start of specified year (array format)
        if (prepay && Array.isArray(prepay)) {
            prepay.filter(p => p.yr - 1 === y && p.amt > 0).forEach(p => {
                let amt = 0;
                if (p.track === 'p') { amt = Math.min(p.amt, balP); balP -= amt; }
                else if (p.track === 'k') { amt = Math.min(p.amt, balK); balK -= amt; }
                else if (p.track === 'm') { amt = Math.min(p.amt, balM); balM -= amt; }
                else if (p.track === 'z') { amt = Math.min(p.amt, balZ); balZ -= amt; }
                else if (p.track === 'mt') { amt = Math.min(p.amt, balMT); balMT -= amt; }
                if (amt > 0) {
                    totalCashInvested += amt;
                    spCashFlows.push({ month: y * 12, amount: amt });
                    reCashFlows.push({ month: y * 12, amount: amt });
                    // Also invest same amount in S&P for fair comparison
                    spValueHedged += amt;
                    spInvestedILS += amt;
                    spBasisLinked += amt;
                    if (config.exMode !== 'hedged') {
                        spUnits += amt / currentEx;
                        spBasisUSD += amt / currentEx;
                    }
                }
            });
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
            const mlP = terms.p - globalM;
            const mlK = terms.k - globalM;
            const mlZ = terms.z - globalM;
            const mlM = terms.m - globalM;
            const mlMT = terms.mt - globalM;

            // Prime
            if (balP > 10 && mlP > 0) {
                let i = balP * (ratePrime / 12);
                let pr = repayMethod === 'equalPrincipal' ? initPrinc.p / terms.p : calcPmt(balP, ratePrime, mlP) - i;
                if (pr > balP) pr = balP;
                let p = pr + i;
                balP -= pr;
                pmtTotal += p; intTotal += i; princTotal += pr;
            }
            // Kalats (Fixed, Non-Linked)
            if (balK > 10 && mlK > 0) {
                let i = balK * (rateKalats / 12);
                let pr = repayMethod === 'equalPrincipal' ? initPrinc.k / terms.k : calcPmt(balK, rateKalats, mlK) - i;
                if (pr > balK) pr = balK;
                let p = pr + i;
                balK -= pr;
                pmtTotal += p; intTotal += i; princTotal += pr;
            }
            // Katz (Fixed, CPI-Linked) - calculate in real terms, then scale by CPI
            if (balZ > 10 && mlZ > 0) {
                // Real-terms calculation (balance already in real shekels)
                let realI = balZ * (rateKatz / 12);
                let realPr = repayMethod === 'equalPrincipal' ? initPrinc.z / terms.z : calcPmt(balZ, rateKatz, mlZ) - realI;
                if (realPr > balZ) realPr = balZ;
                balZ -= realPr;
                // Convert to nominal for cash flow
                let nomI = realI * cpiIndex;
                let nomPr = realPr * cpiIndex;
                let p = nomI + nomPr;
                pmtTotal += p; intTotal += nomI; princTotal += nomPr;
            }
            // Malatz (Var 5, Non-Linked)
            if (balM > 10 && mlM > 0) {
                let i = balM * (rateMalatz / 12);
                let pr = repayMethod === 'equalPrincipal' ? initPrinc.m / terms.m : calcPmt(balM, rateMalatz, mlM) - i;
                if (pr > balM) pr = balM;
                let p = pr + i;
                balM -= pr;
                pmtTotal += p; intTotal += i; princTotal += pr;
            }
            // Matz (Var 5, CPI-Linked) - calculate in real terms, then scale by CPI
            if (balMT > 10 && mlMT > 0) {
                // Real-terms calculation (balance already in real shekels)
                let realI = balMT * (rateMatz / 12);
                let realPr = repayMethod === 'equalPrincipal' ? initPrinc.mt / terms.mt : calcPmt(balMT, rateMatz, mlMT) - realI;
                if (realPr > balMT) realPr = balMT;
                balMT -= realPr;
                // Convert to nominal for cash flow
                let nomI = realI * cpiIndex;
                let nomPr = realPr * cpiIndex;
                let p = nomI + nomPr;
                pmtTotal += p; intTotal += nomI; princTotal += nomPr;
            }

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
                    const netInvest = surplus * (1 - fees.trade);
                    reSideStockValue += netInvest;
                    reSideStockBasis += netInvest;
                    reSideStockBasisLinked += netInvest;
                } else {
                    reSideCash += surplus;
                }

                if (mode === 'match') {
                    const grossTarget = surplus / (1 - fees.trade);
                    let withdrawn = 0;
                    if (config.exMode === 'hedged') {
                        const used = Math.min(spValueHedged, grossTarget);
                        spValueHedged -= used;
                        spBasisLinked = Math.max(0, spBasisLinked - used);
                        spInvestedILS = Math.max(0, spInvestedILS - used);
                        withdrawn = used;
                    } else {
                        const availableILS = spUnits * currentEx;
                        const usedILS = Math.min(availableILS, grossTarget);
                        const unitsSold = usedILS / currentEx;
                        spUnits -= unitsSold;
                        spBasisUSD = Math.max(0, spBasisUSD - unitsSold);
                        spBasisLinked = Math.max(0, spBasisLinked - usedILS);
                        withdrawn = usedILS;
                    }
                    spSideCash += withdrawn * (1 - fees.trade);
                }
            } else {
                // Deficit
                totalCashInvested += oop;
                spCashFlows.push({ month: globalM, amount: oop });
                reCashFlows.push({ month: globalM, amount: oop });
                spBasisLinked += oop;

                // S&P Injection
                let netInject = oop * (1 - fees.trade);
                if (config.exMode !== 'hedged') spBasisUSD += (oop / currentEx);
                if (config.exMode === 'hedged') {
                    spValueHedged += netInject;
                    spInvestedILS += oop;
                } else {
                    spUnits += (netInject / currentEx);
                }
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
                series.labels.push(y + 1);
                series.flowRent.push(firstMonthRent);
                series.flowInt.push(firstMonthInt * -1);
                series.flowPrinc.push(firstMonthPrinc * -1);
                series.flowNet.push(firstMonthNet);

                // Net Worth Calc at Snapshot (PRE-TAX for chart - tax only at exit)
                const exitVal = assetVal * (1 - fees.sell);
                const netRE = (exitVal - (balP + balK + balZ + balM + balMT)) + reSideStockValue + reSideCash;

                let spValILS = 0;
                if (config.exMode === 'hedged') spValILS = spValueHedged;
                else spValILS = spUnits * currentEx;

                const netSP = spValILS + spSideCash;

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
    const exitValue = assetVal * (1 - fees.sell);
    let reSideTax = 0;
    if (tax.useRE) {
        const reBasis = tax.mode === 'real' ? reSideStockBasisLinked : reSideStockBasis;
        if (reSideStockValue > reBasis) {
            reSideTax = (reSideStockValue - reBasis) * 0.25;
        }
    }
    
    // Mas Shevach on real estate appreciation
    let masShevach = 0;
    if (tax.useMasShevach) {
        const costBasisIndexed = assetPrice * cpiIndex; // CPI-adjusted cost basis
        const shevachResult = calcMasShevach(assetVal, costBasisIndexed, tax.masShevachType || 'single');
        masShevach = shevachResult.tax;
    }
    
    const netRE = (exitValue - masShevach - (balP + balK + balZ + balM + balMT)) + (reSideStockValue - reSideTax) + reSideCash;

    let spValILS = 0;
    if (config.exMode === 'hedged') spValILS = spValueHedged;
    else spValILS = spUnits * currentEx;

    let spTax = 0;
    if (tax.useSP) {
        if (tax.mode === 'real') {
            let profit = spValILS - spBasisLinked;
            if (profit > 0) spTax = profit * 0.25;
        } else {
            if (config.exMode === 'hedged') {
                let prof = spValILS - spInvestedILS;
                if (prof > 0) spTax = prof * 0.25;
            } else {
                let profUSD = spUnits - spBasisUSD;
                if (profUSD > 0) spTax = (profUSD * currentEx) * 0.25;
            }
        }
    }
    const netSP = spValILS - spTax + spSideCash;

    const totalMonths = simDur * 12;
    const cagrRE = calcIRR(reCashFlows, netRE, totalMonths);
    const cagrSP = calcIRR(spCashFlows, netSP, totalMonths);

    // Pre-tax values for chart visualization
    const grossRE = (exitValue - (balP + balK + balZ + balM + balMT)) + reSideStockValue + reSideCash;
    const grossSP = spValILS + spSideCash;
    const totalRETax = masShevach + reSideTax;

    return {
        netRE, netSP, cagrRE, cagrSP,
        grossRE, grossSP, totalRETax, reSideTax,
        totalCashInvested, totalInterestWasted, totalRentCollected,
        firstPosMonth,
        remainingLoan: balP + balK + balZ + balM + balMT,
        reSideStockValue,
        spValueHedged, spUnits, spBasisLinked, spBasisUSD,
        masShevach, spTax,
        series
    };
}

// Adapter for legacy calcCAGR callers (Optimizer & Tests)
function calcCAGR(eq, downPct, mortDur, simDur, useTaxSP, tradeFee, merFee, exModeCalc, taxModeCalc, cfgCalc, overrides, useRentTax, mix, buyCostPct, maintPct, sellCostPct, drift, surplusMode, useTaxRE, termMix, purchaseTax, useMasShevach, masShevachType, purchaseDiscount) {
    // Backward compat: if useTaxRE not provided, use same as useTaxSP
    const taxSP = useTaxSP ?? true;
    const taxRE = useTaxRE ?? taxSP;
    const params = {
        equity: eq,
        downPct: downPct,
        loanTerm: mortDur,
        simHorizon: simDur,
        termMix: termMix || { p: mortDur, k: mortDur, z: mortDur, m: mortDur, mt: mortDur },
        mix: mix,
        rates: {
            prime: overrides.RateP,
            kalats: overrides.RateK,
            katz: overrides.RateZ,
            malatz: overrides.RateM || 0,
            matz: overrides.RateMT || 0
        },
        market: {
            sp: overrides.SP,
            reApp: overrides.App,
            cpi: overrides.Inf,
            boi: overrides.Int,
            rentYield: overrides.Yld
        },
        fees: {
            buy: buyCostPct,
            sell: sellCostPct,
            trade: tradeFee,
            mgmt: merFee,
            purchaseTax: purchaseTax || 0
        },
        maintPct: maintPct,
        purchaseDiscount: purchaseDiscount || 0,
        tax: {
            useSP: taxSP,
            useRE: taxRE,
            useRent: useRentTax,
            useMasShevach: useMasShevach || false,
            masShevachType: masShevachType || 'single',
            mode: taxModeCalc
        },
        config: {
            drift: drift,
            surplusMode: surplusMode,
            exMode: exModeCalc,
            history: cfgCalc
        },
        returnSeries: false
    };

    const res = simulate(params);
    return res.cagrRE;
}

function searchSweetSpots(params) {
    const {
        eq, curDown, curDur, simDur, useTaxSP, useTaxRE, useRentTax, tradeFee, merFee,
        buyCostPct, maintPct, sellCostPct, overrides, mix, drift,
        lockDown, lockTerm, lockHor, horMode, cfg, exMode, taxMode, calcOverride,
        surplusMode, termMix, purchaseTax, useMasShevach, masShevachType, purchaseDiscount
    } = params;

    const cagrFn = calcOverride || calcCAGR;
    const downMin = 25, downMax = 100;
    const downVals = [];
    const termVals = [];
    const horVals = [];

    if (lockDown) downVals.push(curDown * 100); else for (let d = downMin; d <= downMax; d += 5) downVals.push(d);
    if (lockTerm) termVals.push(curDur); else for (let t = 10; t <= 30; t += 1) termVals.push(t);
    if (lockHor || horMode === 'auto') horVals.push(simDur); else for (let h = 5; h <= 50; h += 2) horVals.push(h);

    let best = { d: downVals[0], t: termVals[0], h: horVals[0], c: -Infinity };
    for (let d of downVals) {
        for (let t of termVals) {
            for (let h of horVals) {
                const simH = (horMode === 'auto' && !lockHor) ? t : h;
                let c = cagrFn(eq, d / 100, t, simH, useTaxSP, tradeFee, merFee, exMode, taxMode, cfg, overrides, useRentTax, mix, buyCostPct, maintPct, sellCostPct, drift, surplusMode, useTaxRE, termMix, purchaseTax, useMasShevach, masShevachType, purchaseDiscount);
                const isBetter = c > best.c;
                const isNearTie = Math.abs(c - best.c) < 0.05 && t > best.t;
                if (isBetter || isNearTie) best = { d, t, h: simH, c };
            }
        }
    }
    return best;
}

/**
 * Calculate balance after k payments (closed-form)
 * @param {number} P - Principal
 * @param {number} rAnn - Annual interest rate (decimal)
 * @param {number} n - Total months
 * @param {number} k - Payments made
 * @param {string} method - 'spitzer' or 'equalPrincipal'
 */
function calcBalanceAfterK(P, rAnn, n, k, method = 'spitzer') {
    if (k >= n) return 0;
    if (k <= 0) return P;
    if (method === 'equalPrincipal') {
        return P * (1 - k / n);
    }
    // Spitzer closed-form: B_k = P(1+r)^k - A * ((1+r)^k - 1) / r
    const r = rAnn / 12;
    if (r === 0) return P * (1 - k / n);
    const A = calcPmt(P, rAnn, n);
    const factor = Math.pow(1 + r, k);
    return P * factor - A * (factor - 1) / r;
}

/**
 * Calculate total interest over loan life (closed-form)
 * @param {number} P - Principal
 * @param {number} rAnn - Annual interest rate (decimal)
 * @param {number} n - Total months
 * @param {string} method - 'spitzer' or 'equalPrincipal'
 */
function calcTotalInterest(P, rAnn, n, method = 'spitzer') {
    if (method === 'equalPrincipal') {
        const r = rAnn / 12;
        return r * P * (n + 1) / 2;
    }
    // Spitzer: Total Interest = A * n - P
    const A = calcPmt(P, rAnn, n);
    return A * n - P;
}

/**
 * Generate full amortization schedule
 * @param {Object} params
 * @param {number} params.principal - Loan amount
 * @param {number} params.annualRate - Annual interest rate (decimal, e.g., 0.047 for 4.7%)
 * @param {number} params.termMonths - Loan term in months
 * @param {string} params.method - 'spitzer' or 'equalPrincipal'
 * @param {boolean} params.cpiLinked - Whether loan is CPI-linked
 * @param {number|number[]} params.cpiRate - Annual CPI rate(s) (decimal). Single value or array per year.
 * @param {Object[]} params.rateResets - Array of {month, newRate} for variable rate resets
 * @returns {Object} { schedule: [...], totalInterest, totalPayments }
 */
function generateSchedule(params) {
    const {
        principal: P,
        annualRate,
        termMonths: n,
        method = 'spitzer',
        cpiLinked = false,
        cpiRate = 0,
        rateResets = []
    } = params;

    const schedule = [];
    let balance = P;
    let currentRate = annualRate;
    let remainingMonths = n;
    let totalInterest = 0;
    let totalPayments = 0;

    // Sort resets by month
    const resets = [...rateResets].sort((a, b) => a.month - b.month);
    let resetIdx = 0;

    // For Spitzer, calculate initial payment
    let payment = method === 'spitzer' ? calcPmt(P, currentRate, n) : 0;

    for (let t = 1; t <= n; t++) {
        // Check for rate reset
        while (resetIdx < resets.length && resets[resetIdx].month === t) {
            currentRate = resets[resetIdx].newRate;
            remainingMonths = n - t + 1;
            if (method === 'spitzer') {
                payment = calcPmt(balance, currentRate, remainingMonths);
            }
            resetIdx++;
        }

        // CPI indexation (apply at start of month)
        let cpiFactor = 1;
        if (cpiLinked) {
            const yearIdx = Math.floor((t - 1) / 12);
            const annualCpi = Array.isArray(cpiRate) ? (cpiRate[yearIdx] ?? cpiRate[cpiRate.length - 1]) : cpiRate;
            cpiFactor = Math.pow(1 + annualCpi, 1 / 12);
            balance *= cpiFactor;
        }

        const r = currentRate / 12;
        const interest = balance * r;
        let principalPaid;

        if (method === 'equalPrincipal') {
            principalPaid = P / n;
            if (principalPaid > balance) principalPaid = balance;
            payment = principalPaid + interest;
        } else {
            // Spitzer - recalc payment if CPI-linked (payment grows with CPI)
            if (cpiLinked) {
                payment = calcPmt(balance, currentRate, n - t + 1);
            }
            principalPaid = payment - interest;
            if (principalPaid > balance) {
                principalPaid = balance;
                payment = principalPaid + interest;
            }
        }

        balance -= principalPaid;
        if (balance < 0.01) balance = 0;

        totalInterest += interest;
        totalPayments += payment;

        schedule.push({
            month: t,
            payment: Math.round(payment * 100) / 100,
            interest: Math.round(interest * 100) / 100,
            principal: Math.round(principalPaid * 100) / 100,
            balance: Math.round(balance * 100) / 100,
            cpiAdjustment: cpiLinked ? Math.round((cpiFactor - 1) * balance * 100) / 100 : 0
        });
    }

    return {
        schedule,
        totalInterest: Math.round(totalInterest * 100) / 100,
        totalPayments: Math.round(totalPayments * 100) / 100,
        method,
        principal: P,
        annualRate,
        termMonths: n
    };
}

const Logic = { calcPmt, calcCAGR, searchSweetSpots, simulate, H_SP, H_RE, H_EX, H_CPI, H_BOI, getH, generateSchedule, calcBalanceAfterK, calcTotalInterest, calcPurchaseTax, calcMasShevach };

if (typeof module !== 'undefined') {
    module.exports = Logic;
}
if (typeof window !== 'undefined') {
    window.Logic = Logic;
}