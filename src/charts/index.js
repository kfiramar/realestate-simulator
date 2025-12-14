// Charts module - extracted from app.js
let wealthChart = null;
let flowChart = null;

export function drawCharts(l, rVal, rPct, sVal, sPct, fRent, fInt, fPrinc, fNet, surplusValSeries, surplusPctSeries, taxInfo = {}, ctx) {
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

    const { reTax = 0, spTax = 0, netRE = 0, netSP = 0, invested = 0, surplusTax = 0, surplusGross = 0 } = taxInfo;
    const lastIdx = plotR.length - 1;
    const hasRETax = reTax > 0;
    const hasSPTax = spTax > 0;
    const hasSurplusTax = surplusTax > 0;

    let plotRWithTax = [...plotR];
    let plotSWithTax = [...plotS];
    
    if (mode !== 'percent') {
        if (hasRETax) plotRWithTax.push(netRE);
        else plotRWithTax.push(plotR[lastIdx]);
        if (hasSPTax) plotSWithTax.push(netSP);
        else plotSWithTax.push(plotS[lastIdx]);
    } else {
        if (hasRETax) plotRWithTax.push(((netRE - invested) / invested) * 100);
        else plotRWithTax.push(plotR[lastIdx]);
        if (hasSPTax) plotSWithTax.push(((netSP - invested) / invested) * 100);
        else plotSWithTax.push(plotS[lastIdx]);
    }
    
    const hasTax = hasRETax || hasSPTax || hasSurplusTax;
    const labelsExt = hasTax ? [...l, t('taxDeduction') || 'Tax'] : l;

    let datasets = [
        { 
            label: t('chartRealEstate'), 
            data: plotRWithTax, 
            borderColor: '#16a34a', 
            backgroundColor: 'rgba(22,163,74,0.05)', 
            borderWidth: 3, 
            fill: true, 
            pointRadius: plotRWithTax.map((_, i) => i === plotRWithTax.length - 1 && hasRETax ? 5 : 0),
            pointBackgroundColor: '#0d5c2a',
            pointHoverRadius: 6,
            segment: {
                borderDash: c => c.p0DataIndex === lastIdx ? [6, 4] : undefined,
                borderColor: c => c.p0DataIndex === lastIdx && hasRETax ? '#0d5c2a' : undefined
            }
        },
        { 
            label: t('chartSP500'), 
            data: plotSWithTax, 
            borderColor: '#2563eb', 
            backgroundColor: 'rgba(37,99,235,0.05)', 
            borderWidth: 3, 
            fill: true, 
            pointRadius: plotSWithTax.map((_, i) => i === plotSWithTax.length - 1 && hasSPTax ? 5 : 0),
            pointBackgroundColor: '#1e40af',
            pointHoverRadius: 6,
            segment: {
                borderDash: c => c.p0DataIndex === lastIdx ? [6, 4] : undefined,
                borderColor: c => c.p0DataIndex === lastIdx && hasSPTax ? '#1e40af' : undefined
            }
        }
    ];

    if (reinvestActive && plotSurp && plotSurp.some(v => v > 0)) {
        const surplusNet = surplusGross - surplusTax;
        let plotSurpWithTax = [...plotSurp];
        if (hasTax) {
            if (mode !== 'percent') {
                plotSurpWithTax.push(hasSurplusTax ? surplusNet : plotSurp[lastIdx]);
            } else {
                plotSurpWithTax.push(hasSurplusTax ? (surplusNet / invested) * 100 : plotSurp[lastIdx]);
            }
        }
        datasets.push({ 
            label: t('chartReinvested'), 
            data: plotSurpWithTax, 
            borderColor: '#f59e0b', 
            backgroundColor: 'rgba(245,158,11,0.12)', 
            borderWidth: 2, 
            fill: true, 
            pointRadius: plotSurpWithTax.map((_, i) => i === plotSurpWithTax.length - 1 && hasSurplusTax ? 5 : 0),
            pointBackgroundColor: '#b45309',
            pointHoverRadius: 6, 
            segment: {
                borderDash: c => c.p0DataIndex === lastIdx && hasSurplusTax ? [4, 3] : [6, 4],
                borderColor: c => c.p0DataIndex === lastIdx && hasSurplusTax ? '#b45309' : undefined
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
                            const idx = c.dataIndex;
                            const lbl = c.dataset.label;
                            const isLastPoint = idx === plotRWithTax.length - 1 && hasTax;
                            
                            if (lbl === t('chartRealEstate')) {
                                if (isLastPoint && hasRETax) return `${lbl}: ${fmt(netRE)} ₪ (−${fmt(reTax)} ₪ ${t('taxPaid') || 'tax'})`;
                                return `${lbl}: ${fmt(rVal[idx] || netRE)} ₪`;
                            }
                            if (lbl === t('chartSP500')) {
                                if (isLastPoint && hasSPTax) return `${lbl}: ${fmt(netSP)} ₪ (−${fmt(spTax)} ₪ ${t('taxPaid') || 'tax'})`;
                                return `${lbl}: ${fmt(sVal[idx] || netSP)} ₪`;
                            }
                            if (lbl === t('chartReinvested')) {
                                if (isLastPoint && hasSurplusTax) {
                                    const sNet = surplusGross - surplusTax;
                                    return `${lbl}: ${fmt(sNet)} ₪ (−${fmt(surplusTax)} ₪ ${t('taxPaid') || 'tax'})`;
                                }
                                return `${lbl}: ${fmt(surplusValSeries[idx] || 0)} ₪`;
                            }
                            return `${lbl}: ${fmt(c.raw)} ₪`;
                        }
                    }
                },
                legend: { labels: { color: textColor } }
            },
            scales: {
                y: { title: { display: true, text: yTxt, color: textColor }, ticks: { color: textColor, callback: v => mode === 'percent' ? v + '%' : fmt(v) }, grid: { color: gridColor } },
                x: { 
                    ticks: { 
                        color: textColor,
                        maxRotation: 0,
                        minRotation: 0,
                        callback: (val, idx) => {
                            if (idx === labelsExt.length - 1 && hasTax) return '';
                            return labelsExt[idx];
                        }
                    }, 
                    grid: { color: gridColor } 
                }
            }
        },
        plugins: hasTax ? [{
            id: 'taxZone',
            afterDraw: (chart) => {
                const { ctx: chartCtx, chartArea, scales } = chart;
                const xScale = scales.x;
                const lastX = xScale.getPixelForValue(lastIdx);
                const endX = chartArea.right;
                chartCtx.save();
                chartCtx.fillStyle = isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)';
                chartCtx.fillRect(lastX, chartArea.top, endX - lastX, chartArea.bottom - chartArea.top);
                chartCtx.strokeStyle = isDark ? 'rgba(239,68,68,0.6)' : 'rgba(239,68,68,0.5)';
                chartCtx.lineWidth = 2;
                chartCtx.setLineDash([5, 3]);
                chartCtx.beginPath();
                chartCtx.moveTo(lastX, chartArea.top);
                chartCtx.lineTo(lastX, chartArea.bottom);
                chartCtx.stroke();
                const centerX = (lastX + endX) / 2;
                const labelY = chartArea.bottom - 10;
                chartCtx.fillStyle = '#dc2626';
                chartCtx.font = 'bold 12px sans-serif';
                chartCtx.textAlign = 'center';
                chartCtx.fillText(t('taxDeduction') || 'Tax', centerX, labelY);
                chartCtx.restore();
            }
        }] : []
    });

    const ctx2 = document.getElementById('flowChart').getContext('2d');
    if (flowChart) flowChart.destroy();

    const rentMinusInt = fRent.map((r, i) => r + fInt[i]);
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

export function destroyCharts() {
    if (wealthChart) { wealthChart.destroy(); wealthChart = null; }
    if (flowChart) { flowChart.destroy(); flowChart = null; }
}
