// Charts module
(function() {
let wealthChart = null;
let flowChart = null;

function drawCharts(l, rVal, rPct, sVal, sPct, fRent, fInt, fPrinc, fNet, surplusValSeries, surplusPctSeries, taxInfo = {}, ctx) {
    const { mode, surplusMode, t, fmt, fmtNum } = ctx;
    const isDark = document.body.classList.contains('dark');
    const textColor = isDark ? '#e2e8f0' : '#666';
    const gridColor = isDark ? '#475569' : 'rgba(0,0,0,0.1)';

    const ctx1 = document.getElementById('wealthChart').getContext('2d');
    if (wealthChart) wealthChart.destroy();

    let plotR = mode === 'percent' ? rPct : rVal;
    let plotS = mode === 'percent' ? sPct : sVal;
    let plotSurp = mode === 'percent' ? surplusPctSeries : surplusValSeries;
    const reinvestActive = (surplusMode === 'invest');
    let yTxt = mode === 'percent' ? t('chartYAxisROI') : t('chartYAxisWealth');

    const { reTax = 0, spTax = 0, netRE = 0, netSP = 0, surplusTax = 0 } = taxInfo;
    const lastIdx = plotR.length - 1;

    let datasets = [
        { label: t('chartRealEstate'), data: plotR, borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.05)', borderWidth: 3, fill: true, pointRadius: 0, pointHoverRadius: 6 },
        { label: t('chartSP500'), data: plotS, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.05)', borderWidth: 3, fill: true, pointRadius: 0, pointHoverRadius: 6 }
    ];

    if (reinvestActive && plotSurp && plotSurp.some(v => v > 0)) {
        datasets.push({ label: t('chartReinvested'), data: plotSurp, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.12)', borderWidth: 2, fill: true, pointRadius: 0, pointHoverRadius: 6, borderDash: [6, 4] });
    }

    wealthChart = new Chart(ctx1, {
        type: 'line',
        data: { labels: l, datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: c => {
                            const idx = c.dataIndex;
                            const lbl = c.dataset.label;
                            const isLast = idx === lastIdx;
                            
                            if (lbl === t('chartRealEstate')) {
                                const val = rVal[idx], pct = rPct[idx];
                                let text = `${lbl}: ${fmt(val)} ₪ (${pct.toFixed(1)}%)`;
                                if (isLast && reTax > 0) text += ` | After tax: ${fmt(netRE)} ₪ (−${fmt(reTax)} tax)`;
                                return text;
                            }
                            if (lbl === t('chartReinvested')) {
                                const val = surplusValSeries[idx], pct = surplusPctSeries[idx];
                                let text = `${lbl}: ${fmt(val)} ₪ (${pct.toFixed(1)}%)`;
                                if (isLast && surplusTax > 0) text += ` | After tax: ${fmt(val - surplusTax)} ₪`;
                                return text;
                            }
                            // S&P 500
                            const val = sVal[idx], pct = sPct[idx];
                            let text = `${lbl}: ${fmt(val)} ₪ (${pct.toFixed(1)}%)`;
                            if (isLast && spTax > 0) text += ` | After tax: ${fmt(netSP)} ₪ (−${fmt(spTax)} tax)`;
                            return text;
                        }
                    }
                },
                legend: { labels: { color: textColor } }
            },
            scales: {
                y: { title: { display: true, text: yTxt, color: textColor }, ticks: { color: textColor, callback: v => mode === 'percent' ? v + '%' : fmt(v) }, grid: { color: gridColor } },
                x: { ticks: { color: textColor }, grid: { color: gridColor } }
            }
        }
    });

    const ctx2 = document.getElementById('flowChart').getContext('2d');
    if (flowChart) flowChart.destroy();

    const netRentAfterInt = fRent.map((v, i) => v + (fInt[i] || 0));
    const totalMortgage = fInt.map((v, i) => v + (fPrinc[i] || 0));

    flowChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: l,
            datasets: [
                { type: 'line', label: t('chartNetCashflow'), data: fNet, borderColor: isDark ? '#e2e8f0' : '#0f172a', borderWidth: 4, pointRadius: 3, tension: 0.3, order: 1, fill: false },
                { type: 'line', label: t('chartRentMinusInt'), data: netRentAfterInt, borderColor: '#f59e0b', borderWidth: 2, pointRadius: 0, tension: 0.2, order: 2, fill: false, borderDash: [6, 3] },
                { type: 'bar', label: t('chartRevenue'), data: fRent, backgroundColor: '#22c55e', stack: 'Stack 0', order: 3, borderWidth: 0 },
                { type: 'bar', label: t('chartInterest'), data: fInt, backgroundColor: '#ef4444', stack: 'Stack 0', order: 4, borderWidth: 0 },
                { type: 'bar', label: t('chartPrincipal'), data: fPrinc, backgroundColor: '#fca5a5', stack: 'Stack 0', order: 5, borderWidth: 0 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                tooltip: {
                    callbacks: {
                        afterBody: (items) => {
                            if (items.length > 0) {
                                const idx = items[0].dataIndex;
                                return `${t('chartTotalMortgage')}: \u200E${fmtNum(totalMortgage[idx])} ₪`;
                            }
                        },
                        label: c => {
                            let v = Math.abs(c.raw);
                            let lbl = c.dataset.label;
                            const num = n => '\u200E' + fmtNum(n);
                            if (lbl === t('chartRentMinusInt')) return `${t('tooltipRentMinusInt')}: ${num(c.raw)} ₪`;
                            if (lbl === t('chartInterest')) {
                                let idx = c.dataIndex;
                                let iVal = Math.abs(c.chart.data.datasets[3].data[idx]);
                                let pVal = Math.abs(c.chart.data.datasets[4].data[idx]);
                                let total = iVal + pVal;
                                let pct = total > 0 ? ((iVal / total) * 100).toFixed(0) : 0;
                                return `${t('tooltipInterest')}: ${num(iVal)} (${pct}%)`;
                            }
                            if (lbl === t('chartPrincipal')) return `${t('tooltipPrincipal')}: ${num(v)}`;
                            if (lbl === t('chartRevenue')) return `${t('tooltipRent')}: ${num(v)}`;
                            return `${t('tooltipNet')}: ${num(c.raw)}`;
                        }
                    }
                },
                legend: { labels: { color: textColor } }
            },
            scales: {
                y: { title: { display: true, text: t('chartYAxisMonthly'), color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } },
                x: { stacked: true, ticks: { color: textColor }, grid: { color: gridColor } }
            }
        }
    });
}

function destroyCharts() {
    if (wealthChart) { wealthChart.destroy(); wealthChart = null; }
    if (flowChart) { flowChart.destroy(); flowChart = null; }
}

window.Charts = { drawCharts, destroyCharts };
})();
