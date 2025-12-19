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

    const { reTax = 0, spTax = 0, netRE = 0, netSP = 0, invested = 0, surplusTax = 0, surplusGross = 0, entryCosts = 0, equity = invested } = taxInfo;
    const reinvestActive = (surplusMode === 'invest');
    let yTxt = mode === 'percent' ? t('chartYAxisROI') : t('chartYAxisWealth');

    let plotR = mode === 'percent' ? rPct : rVal;
    let plotS = mode === 'percent' ? sPct : sVal;
    let plotSurp = mode === 'percent' ? surplusPctSeries : surplusValSeries;
    const lastIdx = plotR.length - 1;
    
    // Entry costs at start - use equity as starting point
    const hasEntryCosts = entryCosts > 0;
    const startVal = mode === 'percent' ? 0 : equity;
    const afterEntryRE = mode === 'percent' ? ((-entryCosts) / equity) * 100 : equity - entryCosts;
    
    // Exit tax at end
    const hasRETax = reTax > 0, hasSPTax = spTax > 0, hasSurplusTax = surplusTax > 0;
    const hasTax = hasRETax || hasSPTax || hasSurplusTax;

    // Build labels and data with matching lengths
    let labelsExt = [...l];
    let plotRFull = [...plotR], plotSFull = [...plotS], plotSurpFull = plotSurp ? [...plotSurp] : [];
    
    // Entry zone: 2 points, 2 labels
    if (hasEntryCosts) {
        labelsExt = ['', '', ...labelsExt];  // Empty labels for entry zone
        plotRFull = [startVal, afterEntryRE, ...plotR];
        plotSFull = [startVal, startVal, ...plotS];
        plotSurpFull = [0, 0, ...plotSurpFull];
    }
    
    // Tax zone: 1 point, 1 label
    if (hasTax) {
        labelsExt = [...labelsExt, ''];
        plotRFull.push(mode !== 'percent' ? (hasRETax ? netRE : plotR[lastIdx]) : (hasRETax ? ((netRE - invested) / invested) * 100 : plotR[lastIdx]));
        plotSFull.push(mode !== 'percent' ? (hasSPTax ? netSP : plotS[lastIdx]) : (hasSPTax ? ((netSP - invested) / invested) * 100 : plotS[lastIdx]));
        if (plotSurpFull.length > 0) {
            const surplusNet = surplusGross - surplusTax;
            plotSurpFull.push(mode !== 'percent' ? (hasSurplusTax ? surplusNet : plotSurp[lastIdx]) : (hasSurplusTax ? (surplusNet / invested) * 100 : plotSurp[lastIdx]));
        }
    }

    const entryEndIdx = hasEntryCosts ? 1 : -1;
    const taxStartIdx = hasTax ? plotRFull.length - 2 : -1;

    let datasets = [
        { label: t('chartRealEstate'), data: plotRFull, borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.05)', borderWidth: 3, fill: true,
          pointRadius: plotRFull.map((_, i) => (hasEntryCosts && i <= 1) || (hasTax && i >= taxStartIdx) ? 5 : 0), pointBackgroundColor: '#0d5c2a', pointHoverRadius: 6,
          segment: { 
            borderDash: ctx => (hasEntryCosts && ctx.p0DataIndex === 0) || (hasTax && ctx.p0DataIndex === taxStartIdx) ? [6, 4] : undefined,
            borderColor: ctx => (hasEntryCosts && ctx.p0DataIndex === 0) ? '#f97316' : undefined
          } },
        { label: t('chartSP500'), data: plotSFull, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.05)', borderWidth: 3, fill: true,
          pointRadius: plotSFull.map((_, i) => (hasEntryCosts && i <= 1) || (hasTax && i >= taxStartIdx) ? 5 : 0), pointBackgroundColor: '#1e40af', pointHoverRadius: 6,
          segment: { borderDash: ctx => (hasTax && ctx.p0DataIndex === taxStartIdx) ? [6, 4] : undefined } }
    ];

    if (reinvestActive && plotSurp && plotSurp.some(v => v > 0)) {
        datasets.push({ label: t('chartReinvested'), data: plotSurpFull, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.12)', borderWidth: 2, fill: true,
          pointRadius: plotSurpFull.map((_, i) => (hasTax && i >= taxStartIdx) ? 5 : 0), pointBackgroundColor: '#b45309', pointHoverRadius: 6,
          segment: { borderDash: () => [6, 4] } });
    }

    const plugins = [];
    if (hasEntryCosts) {
        plugins.push({
            id: 'entryZone',
            afterDraw: (chart) => {
                const { ctx, chartArea, scales } = chart;
                const startX = chartArea.left, entryEndX = scales.x.getPixelForValue(entryEndIdx);
                ctx.save();
                ctx.fillStyle = isDark ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.1)';
                ctx.fillRect(startX, chartArea.top, entryEndX - startX, chartArea.bottom - chartArea.top);
                ctx.strokeStyle = isDark ? 'rgba(249,115,22,0.6)' : 'rgba(249,115,22,0.5)';
                ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
                ctx.beginPath(); ctx.moveTo(entryEndX, chartArea.top); ctx.lineTo(entryEndX, chartArea.bottom); ctx.stroke();
                ctx.fillStyle = '#f97316'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
                const ecX = (startX + entryEndX) / 2;
                ctx.fillText('Entry', ecX, chartArea.bottom + 12);
                ctx.fillText('Costs', ecX, chartArea.bottom + 23);
                ctx.restore();
            }
        });
    }
    if (hasTax) {
        plugins.push({
            id: 'taxZone',
            afterDraw: (chart) => {
                const { ctx, chartArea, scales } = chart;
                const taxX = scales.x.getPixelForValue(taxStartIdx), endX = chartArea.right;
                ctx.save();
                ctx.fillStyle = isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)';
                ctx.fillRect(taxX, chartArea.top, endX - taxX, chartArea.bottom - chartArea.top);
                ctx.strokeStyle = isDark ? 'rgba(239,68,68,0.6)' : 'rgba(239,68,68,0.5)';
                ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
                ctx.beginPath(); ctx.moveTo(taxX, chartArea.top); ctx.lineTo(taxX, chartArea.bottom); ctx.stroke();
                ctx.fillStyle = '#dc2626'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
                ctx.fillText(t('taxDeduction') || 'Tax', (taxX + endX) / 2, chartArea.bottom - 10);
                ctx.restore();
            }
        });
    }

    wealthChart = new Chart(ctx1, {
        type: 'line',
        data: { labels: labelsExt, datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: c => {
                            const idx = c.dataIndex, lbl = c.dataset.label;
                            const offset = hasEntryCosts ? 2 : 0;
                            const dataIdx = idx - offset;
                            
                            if (lbl === t('chartRealEstate')) {
                                if (hasEntryCosts && idx === 0) return `${lbl}: ${fmt(equity)} ₪ (${t('beforeCosts') || 'before costs'})`;
                                if (hasEntryCosts && idx === 1) return `${lbl}: ${fmt(equity - entryCosts)} ₪ (−${fmt(entryCosts)} ₪ ${t('entryCosts') || 'entry costs'})`;
                                if (hasTax && idx === plotRFull.length - 1 && hasRETax) return `${lbl}: ${fmt(netRE)} ₪ (−${fmt(reTax)} ₪ ${t('taxPaid') || 'tax'})`;
                                return `${lbl}: ${fmt(rVal[dataIdx] ?? c.raw)} ₪`;
                            }
                            if (lbl === t('chartSP500')) {
                                if (hasEntryCosts && idx <= 1) return `${lbl}: ${fmt(equity)} ₪`;
                                if (hasTax && idx === plotSFull.length - 1 && hasSPTax) return `${lbl}: ${fmt(netSP)} ₪ (−${fmt(spTax)} ₪ ${t('taxPaid') || 'tax'})`;
                                return `${lbl}: ${fmt(sVal[dataIdx] ?? c.raw)} ₪`;
                            }
                            if (lbl === t('chartReinvested')) {
                                if (hasTax && idx === plotSurpFull.length - 1 && hasSurplusTax) return `${lbl}: ${fmt(surplusGross - surplusTax)} ₪ (−${fmt(surplusTax)} ₪ ${t('taxPaid') || 'tax'})`;
                                return `${lbl}: ${fmt(surplusValSeries[dataIdx] ?? 0)} ₪`;
                            }
                            return `${lbl}: ${fmt(c.raw)} ₪`;
                        }
                    }
                },
                legend: { labels: { color: textColor } }
            },
            scales: {
                y: { title: { display: true, text: yTxt, color: textColor }, ticks: { color: textColor, callback: v => mode === 'percent' ? v + '%' : fmt(v) }, grid: { color: gridColor } },
                x: { ticks: { color: textColor, maxRotation: 0, minRotation: 0 }, grid: { color: gridColor } }
            }
        },
        plugins
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
                        afterBody: (items) => items.length > 0 ? `${t('chartTotalMortgage')}: \u200E${fmtNum(totalMortgage[items[0].dataIndex])} ₪` : '',
                        label: c => {
                            let v = Math.abs(c.raw), lbl = c.dataset.label;
                            const num = n => '\u200E' + fmtNum(n);
                            if (lbl === t('chartRentMinusInt')) return `${t('tooltipRentMinusInt')}: ${num(c.raw)} ₪`;
                            if (lbl === t('chartInterest')) {
                                let iVal = Math.abs(c.chart.data.datasets[3].data[c.dataIndex]);
                                let pVal = Math.abs(c.chart.data.datasets[4].data[c.dataIndex]);
                                let total = iVal + pVal;
                                return `${t('tooltipInterest')}: ${num(iVal)} (${total > 0 ? ((iVal / total) * 100).toFixed(0) : 0}%)`;
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

if (typeof module !== 'undefined' && module.exports) module.exports = { drawCharts };
if (typeof window !== 'undefined') window.Charts = { drawCharts };
})();
