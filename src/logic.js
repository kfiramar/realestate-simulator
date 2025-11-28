// Pure logic module: constants, calcPmt, calcCAGR, and optimizer search.

const H_SP = [0.1088, 0.0491, 0.1579, 0.0549, -0.3700, 0.2646, 0.1506, 0.0211, 0.1600, 0.3239, 0.1369, 0.0138, 0.1196, 0.2183, -0.0438, 0.3149, 0.1840, 0.2871, -0.1811, 0.2629, 0.2400];
const H_RE = [-0.02, 0.04, 0.00, 0.03, 0.06, 0.19, 0.15, 0.04, 0.05, 0.08, 0.06, 0.07, 0.05, 0.04, 0.01, 0.03, 0.04, 0.12, 0.18, 0.02, 0.05];
const H_EX = [4.48, 4.49, 4.45, 4.11, 3.59, 3.93, 3.73, 3.58, 3.85, 3.61, 3.58, 3.88, 3.84, 3.60, 3.59, 3.56, 3.44, 3.23, 3.36, 3.68, 3.75];
const H_CPI = [0.012, 0.024, -0.001, 0.034, 0.038, 0.039, 0.027, 0.022, 0.016, 0.018, -0.002, -0.010, -0.002, 0.004, 0.008, 0.006, -0.007, 0.028, 0.053, 0.030, 0.032];
const H_BOI = [0.041, 0.035, 0.050, 0.040, 0.035, 0.010, 0.015, 0.030, 0.025, 0.015, 0.0075, 0.001, 0.001, 0.001, 0.0025, 0.001, 0.001, 0.035, 0.045, 0.045];

function getH(arr, i) { return i < arr.length ? arr[i] : arr[arr.length-1]; }

function calcPmt(p, rAnn, m) {
    if(p<=0.01) return 0;
    if(rAnn===0) return p/m;
    let r = rAnn/12;
    return p * (r * Math.pow(1+r, m)) / (Math.pow(1+r, m) - 1);
}

function calcCAGR(eq, downPct, mortDur, simDur, useTax, tradeFee, merFee, exModeCalc, taxModeCalc, cfgCalc, overrides, useRentTax, mix, buyCostPct, maintPct, sellCostPct, drift, surplusMode) {
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

    // RE Side Portfolio (Invest Mode)
    let reSideStockValue = 0;
    let reSideStockBasis = 0;
    // RE Side Cash (Pocket/Match Mode)
    let reSideCash = 0;

    let loanMonths = mortDur * 12;
    let cpiIndex = 1.0;
    let taxThreshold = 5690;

    // Spread based on overrides
    let spreadPrime = (overrides.RateP - overrides.Int);

    // Drift Setup
    let driftFactor = 1 + (drift / 100);
    let mDrift = Math.pow(driftFactor, 1/12) - 1;

    for(let y=0; y<simDur; y++) {
        let rSP = cfgCalc.SP.is ? getH(H_SP,y) : overrides.SP;
        let rApp = cfgCalc.App.is ? getH(H_RE,y) : overrides.App;
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
            let pmtP=0, intP=0, princP=0;
            let pmtK=0, intK=0, princK=0;
            let pmtZ=0, intZ=0, princZ=0;

            if(monthsLeft > 0) {
                if(balP > 10) {
                    pmtP = calcPmt(balP, ratePrime, monthsLeft);
                    intP = balP * (ratePrime/12);
                    princP = pmtP - intP;
                    if(princP>balP) { princP=balP; pmtP=balP+intP; }
                    balP -= princP;
                }
                if(balK > 10) {
                    pmtK = calcPmt(balK, rateKalats, monthsLeft);
                    intK = balK * (rateKalats/12);
                    princK = pmtK - intK;
                    if(princK>balK) { princK=balK; pmtK=balK+intK; }
                    balK -= princK;
                }
                if(balZ > 10) {
                    balZ *= (1+mInf);
                    pmtZ = calcPmt(balZ, rateKatz, monthsLeft);
                    intZ = balZ * (rateKatz/12);
                    princZ = pmtZ - intZ;
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

            // Surplus Handling
            if (outOfPocket < 0) {
                let surplus = Math.abs(outOfPocket);
                
                const investSurplus = (surplusMode === 'invest' || surplusMode === true);
                const matchSurplus = (surplusMode === 'match');

                if (investSurplus) {
                    let netInvest = surplus * (1 - tradeFee);
                    reSideStockValue += netInvest;
                    reSideStockBasis += netInvest;
                } else {
                    // Pocket or Match: RE investor keeps the cash (Mattress)
                    reSideCash += surplus;
                }
                
                // S&P Matching Logic (internal tracking)
                if (matchSurplus) {
                    // Withdraw from S&P to match RE cash
                    const grossTarget = surplus / (1 - tradeFee);
                    if(exModeCalc === 'hedged') {
                        const used = Math.min(spValueHedged, grossTarget);
                        spValueHedged -= used;
                        // spSideCash += used * (1-tradeFee); // Not returned, but logical
                    } else {
                        const availableILS = spUnits * currentEx;
                        const usedILS = Math.min(availableILS, grossTarget);
                        const unitsSold = usedILS / currentEx;
                        spUnits -= unitsSold;
                    }
                }
            } else {
                // Deficit: Standard Consumption Matching (Basis tracking)
                spBasisLinked += outOfPocket;
            }

            spBasisLinked *= (1+mInf);
            
            // S&P Deficit Injection
            if(outOfPocket > 0) {
                let netInject = outOfPocket;
                let trade = outOfPocket * tradeFee; // Wait, if outOfPocket is 2000, we pay 2000. 
                // Is trade fee ON TOP or Inclusive? 
                // Logic: netInject = outOfPocket * (1 - tradeFee).
                netInject = outOfPocket * (1 - tradeFee);
                
                if(exModeCalc === 'hedged') spValueHedged += netInject;
                else spUnits += (netInject / currentEx);
            }
            
            // Grow Portfolios
            if(exModeCalc === 'hedged') spValueHedged *= (1+mSP);
            else spUnits *= (1+mSP);
            
            reSideStockValue *= (1+mSP);
        }
    }

    let exitValue = assetVal * (1 - sellCostPct);
    
    // Tax on RE Side Stock
    let reSideTax = 0;
    if(useTax && reSideStockValue > reSideStockBasis) {
        reSideTax = (reSideStockValue - reSideStockBasis) * 0.25;
    }
    let netRE = (exitValue - (balP + balK + balZ)) + (reSideStockValue - reSideTax) + reSideCash;

    let cagr = (Math.pow(netRE / totalCashInvested, 1/simDur) - 1) * 100;
    return cagr;
}

function searchSweetSpots(params) {
    const {
        eq, curDown, curDur, simDur, useTax, useRentTax, tradeFee, merFee,
        buyCostPct, maintPct, sellCostPct, overrides, mix, drift,
        lockDown, lockTerm, lockHor, horMode, cfg, exMode, taxMode, calcOverride,
        surplusMode // Updated Param
    } = params;

    const cagrFn = calcOverride || calcCAGR;
    const downMin = 25, downMax = 100;
    const downVals = [];
    const termVals = [];
    const horVals = [];

    if(lockDown) downVals.push(curDown*100); else for(let d=downMin; d<=downMax; d+=5) downVals.push(d);
    if(lockTerm) termVals.push(curDur); else for(let t=10; t<=30; t+=1) termVals.push(t);
    if(lockHor || horMode==='auto') horVals.push(simDur); else for(let h=5; h<=50; h+=2) horVals.push(h);

    let best = { d: downVals[0], t: termVals[0], h: horVals[0], c: -Infinity };
    for(let d of downVals) {
        for(let t of termVals) {
            for(let h of horVals) {
                const simH = horMode === 'auto' ? t : h;
                // Pass surplusMode to cagrFn
                let c = cagrFn(eq, d/100, t, simH, useTax, tradeFee, merFee, exMode, taxMode, cfg, overrides, useRentTax, mix, buyCostPct, maintPct, sellCostPct, drift, surplusMode);
                const isBetter = c > best.c;
                const isNearTie = Math.abs(c - best.c) < 0.05 && t > best.t; // prefer longer terms when nearly equal
                if(isBetter || isNearTie) best = { d, t, h: simH, c };
            }
        }
    }
    return best;
}

const Logic = { calcPmt, calcCAGR, searchSweetSpots, H_SP, H_RE, H_EX, H_CPI, H_BOI, getH };

if (typeof module !== 'undefined') {
    module.exports = Logic;
}
if (typeof window !== 'undefined') {
    window.Logic = Logic;
}
