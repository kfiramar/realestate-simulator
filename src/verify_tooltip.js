
const assert = require('assert');

// Mock fmtNum
function fmtNum(v) { return v.toLocaleString('en-US', { maximumFractionDigits: 0 }); }

// Mock Chart context
const mockContext = {
    chart: {
        data: {
            datasets: [
                { label: 'Net Cashflow', data: [100] }, // 0
                { label: 'Rent minus Interest', data: [50] }, // 1
                { label: 'Revenue (Rent)', data: [200] }, // 2
                { label: 'Interest (Cost)', data: [-50] }, // 3
                { label: 'Principal (Equity)', data: [-150] } // 4
            ]
        }
    },
    dataIndex: 0,
    dataset: { label: 'Interest (Cost)' },
    raw: -50
};

// Extracted logic from app.js (with fix applied)
function getTooltipLabel(c) {
    let v = Math.abs(c.raw);
    let lbl = c.dataset.label;
    if (lbl.includes('Interest')) {
        let idx = c.dataIndex;
        // The fix: indices 3 and 4
        let iVal = Math.abs(c.chart.data.datasets[3].data[idx]);
        let pVal = Math.abs(c.chart.data.datasets[4].data[idx]);
        let total = iVal + pVal;
        let pct = total > 0 ? ((iVal / total) * 100).toFixed(0) : 0;
        return `Interest: ${fmtNum(iVal)} (${pct}%)`;
    }
    return '';
}

// Test
try {
    const result = getTooltipLabel(mockContext);
    console.log('Result:', result);

    // Expected: Interest is 50, Principal is 150. Total 200. Interest % = 50/200 = 25%.
    // Output should be "Interest: 50 (25%)"
    assert.strictEqual(result, 'Interest: 50 (25%)');
    console.log('Verification PASSED');
} catch (e) {
    console.error('Verification FAILED');
    console.error(e);
    process.exit(1);
}
