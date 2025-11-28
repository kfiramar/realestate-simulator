const Logic = require('./src/logic.js');

const baseOverrides = { RateP:0, RateK:0, RateZ:0, SP:0, App:0, Int:0, Inf:0, Yld:0 };
const baseMix = { prime: 0, kalats: 100, katz: 0 };
const baseCfg = { SP:{is:false}, App:{is:false}, Int:{is:false}, Inf:{is:false}, Yld:{is:false} };

console.log("Debugging calcCAGR...");

// We need to mock getH if it's not exported or if it fails, but Logic exports it.
// Wait, Logic.js exports Logic object.

try {
    const cagr = Logic.calcCAGR(
        500000, 0.5, 20, 20, // Eq, Down, MortDur, SimDur
        false, 0, 0, 'hedged', 'real', // Tax, Fees
        baseCfg, baseOverrides, false, baseMix, // Cfg, Overrides, RentTax, Mix
        0, 0, 0, 0, false // Frictions, Drift, InvestSurplus
    );
    console.log("CAGR Result:", cagr);
    
    // To see internals, we'd need to log from inside logic.js, which we can't do easily without modifying it.
    // But let's check the inputs.
    // 500k Equity.
    // Asset = 1M.
    // Loan = 500k.
    // Payment = 500k / 240 = 2083.33
    // Rent = 0.
    // OOP = 2083.33
    // Total Cash = 500k + (2083.33 * 240) = 1M.
    // Net RE = 1M - 0 = 1M.
    // 1M / 1M = 1.
    // CAGR = 0.
    
    // Is it possible 'simDur' is being treated as 0? No, passed 20.
    // Is it possible 'loanMonths' is wrong? 240.
    
    // Wait! 'totalCashInvested' starts at 'eq + entryCosts'.
    // If buying friction is 0, it starts at 500k.
    
} catch (e) {
    console.error(e);
}
