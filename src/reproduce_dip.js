
const Logic = require('./logic.js');

// Mock params to simulate a scenario where rent crosses the threshold
// Threshold is 5654.
// Let's start with Rent = 4500.
// Growth = 3.5% (App) - 2.5% (Inf) = ~1% real growth relative to threshold?
// Actually Threshold grows by Inf. Rent grows by App.
// Let's simulate just the rent and tax logic.

const taxThresholdBase = 5654;
const rApp = 0.035;
const rInf = 0.025;
const rYld = 0.03;
const maintPct = 0.10; // Default in app.js is 10%?
// In app.js: maintPct: parseFloat(document.getElementById('rMaint').value) / 100
// Default value in HTML is 10.

let assetVal = 1800000; // 1.8M from previous screenshot
let cpiIndex = 1.0;

console.log('Year | Gross Rent | Threshold | Tax | Net Rent');
console.log('-----|------------|-----------|-----|---------');

for (let y = 0; y < 50; y++) {
    const mApp = Math.pow(1 + rApp, 1 / 12) - 1;
    const mInf = Math.pow(1 + rInf, 1 / 12) - 1;

    // Simulate 12 months
    for (let m = 0; m < 12; m++) {
        cpiIndex *= (1 + mInf);
        assetVal *= (1 + mApp);
    }

    // Check at end of year (simplified)
    const grossRent = (assetVal * rYld) / 12;
    const taxLimit = taxThresholdBase * cpiIndex;

    let rentTaxVal = 0;
    // Logic from logic.js:
    // if (tax.useRent && grossRent > taxLimit) rentTaxVal = grossRent * 0.10;
    if (grossRent > taxLimit) rentTaxVal = grossRent * 0.10;

    const netRent = (grossRent * (1 - maintPct)) - rentTaxVal;

    if (y > 30 && y < 45) {
        console.log(`${y + 1}   | ${grossRent.toFixed(0)}       | ${taxLimit.toFixed(0)}      | ${rentTaxVal.toFixed(0)} | ${netRent.toFixed(0)}`);
    }
}
