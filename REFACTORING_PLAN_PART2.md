# Refactoring Plan - Part 2 (Phases 4-7)

Continuation of [REFACTORING_PLAN.md](./REFACTORING_PLAN.md)

---

## Phase 4: Extract Formatters

**Goal:** Move formatting utilities to dedicated module.

**Files affected:**
- `src/app.js` (remove ~20 lines)
- `src/ui/formatters.js` (new)

### Step 4.1: Create ui directory

```bash
mkdir -p src/ui
```

### Step 4.2: Extract formatting functions

Create `src/ui/formatters.js`:
```javascript
export function fmt(v) {
    if (Math.abs(v) >= 1000000) return (v / 1000000).toFixed(2) + 'M';
    if (Math.abs(v) >= 1000) return (v / 1000).toFixed(0) + 'k';
    return v.toFixed(0);
}

export function fmtNum(v) {
    return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// Note: fmtVal depends on mode state, handle via parameter
export function fmtVal(v, mode) {
    return mode === 'percent' ? v.toFixed(1) + '%' : fmt(v) + ' ₪';
}
```

**Test:** None (new file)

### Step 4.3: Update app.js

Add import:
```javascript
import { fmt, fmtNum, fmtVal } from './ui/formatters.js';
```

Remove from app.js:
- `function fmt(v) {...}`
- `function fmtNum(v) {...}`
- `function fmtVal(v) {...}`

Update `fmtVal` calls to pass `mode` parameter:
```javascript
// Before
fmtVal(value)
// After
fmtVal(value, mode)
```

**Test:**
```bash
npm test -- --testPathPattern="app.test"
```
Manual: Verify KPI values display correctly

### Step 4.4: Commit Phase 4

```bash
git add src/ui src/app.js
git commit -m "refactor: Extract formatters to ui module"
```

**Test:** Full suite
```bash
npm test
```

---

## Phase 5: Extract Charts

**Goal:** Move chart creation and configuration to dedicated module.

**Files affected:**
- `src/app.js` (remove ~250 lines)
- `src/charts/index.js` (new)
- `src/charts/wealth.js` (new)
- `src/charts/flow.js` (new)
- `src/charts/plugins.js` (new)

### Step 5.1: Create charts directory

```bash
mkdir -p src/charts
```

### Step 5.2: Extract tax zone plugin

Create `src/charts/plugins.js`:
```javascript
import { t } from '../i18n/index.js';

export function createTaxZonePlugin(lastIdx, hasTax, isDark) {
    if (!hasTax) return [];
    
    return [{
        id: 'taxZone',
        afterDraw: (chart) => {
            const { ctx, chartArea, scales } = chart;
            const xScale = scales.x;
            const lastX = xScale.getPixelForValue(lastIdx);
            const endX = chartArea.right;
            
            ctx.save();
            
            // Shaded background
            ctx.fillStyle = isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)';
            ctx.fillRect(lastX, chartArea.top, endX - lastX, chartArea.bottom - chartArea.top);
            
            // Vertical separator line
            ctx.strokeStyle = isDark ? 'rgba(239,68,68,0.6)' : 'rgba(239,68,68,0.5)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 3]);
            ctx.beginPath();
            ctx.moveTo(lastX, chartArea.top);
            ctx.lineTo(lastX, chartArea.bottom);
            ctx.stroke();
            
            // Centered label
            const centerX = (lastX + endX) / 2;
            const labelY = chartArea.bottom - 10;
            ctx.fillStyle = '#dc2626';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(t('taxDeduction') || 'Tax', centerX, labelY);
            
            ctx.restore();
        }
    }];
}
```

**Test:** None (new file)

### Step 5.3: Extract wealth chart configuration

Create `src/charts/wealth.js`:
```javascript
import { t } from '../i18n/index.js';
import { fmt } from '../ui/formatters.js';
import { createTaxZonePlugin } from './plugins.js';

export function createWealthChartConfig(params) {
    const {
        labels, plotR, plotS, plotSurp,
        mode, isDark, reinvestActive,
        taxInfo, lastIdx, hasTax
    } = params;
    
    const textColor = isDark ? '#e2e8f0' : '#666';
    const gridColor = isDark ? '#475569' : 'rgba(0,0,0,0.1)';
    const yTxt = mode === 'percent' ? t('chartYAxisROI') : t('chartYAxisWealth');
    
    // Build datasets array
    const datasets = buildWealthDatasets(params);
    
    return {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                tooltip: { callbacks: createWealthTooltipCallbacks(params) },
                legend: { labels: { color: textColor } }
            },
            scales: {
                y: {
                    title: { display: true, text: yTxt, color: textColor },
                    ticks: { color: textColor, callback: v => mode === 'percent' ? v + '%' : fmt(v) },
                    grid: { color: gridColor }
                },
                x: {
                    ticks: {
                        color: textColor,
                        maxRotation: 0,
                        callback: (val, idx) => {
                            if (idx === labels.length - 1 && hasTax) return '';
                            return labels[idx];
                        }
                    },
                    grid: { color: gridColor }
                }
            }
        },
        plugins: createTaxZonePlugin(lastIdx, hasTax, isDark)
    };
}

function buildWealthDatasets(params) {
    // ... extract dataset building logic from drawCharts
}

function createWealthTooltipCallbacks(params) {
    // ... extract tooltip callback logic
}
```

**Test:** None (new file)

### Step 5.4: Extract flow chart configuration

Create `src/charts/flow.js`:
```javascript
import { t } from '../i18n/index.js';
import { fmtNum } from '../ui/formatters.js';

export function createFlowChartConfig(params) {
    const {
        labels, fRent, fInt, fPrinc, fNet,
        isDark
    } = params;
    
    const textColor = isDark ? '#e2e8f0' : '#666';
    const gridColor = isDark ? '#475569' : 'rgba(0,0,0,0.1)';
    
    const netRentAfterInt = fRent.map((v, i) => v + (fInt[i] || 0));
    const totalMortgage = fInt.map((v, i) => v + (fPrinc[i] || 0));
    
    return {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { type: 'line', label: t('chartNetCashflow'), data: fNet, borderColor: isDark ? '#e2e8f0' : '#0f172a', borderWidth: 4, pointRadius: 3, tension: 0.3, order: 1, fill: false },
                { type: 'line', label: t('chartRentMinusInt'), data: netRentAfterInt, borderColor: '#f59e0b', borderWidth: 2, pointRadius: 0, tension: 0.2, order: 2, fill: false, borderDash: [6, 3] },
                { type: 'bar', label: t('chartRevenue'), data: fRent, backgroundColor: '#22c55e', stack: 'Stack 0', order: 3, borderWidth: 0 },
                { type: 'bar', label: t('chartInterest'), data: fInt, backgroundColor: '#ef4444', stack: 'Stack 0', order: 4, borderWidth: 0 },
                { type: 'bar', label: t('chartPrincipal'), data: fPrinc, backgroundColor: '#fca5a5', stack: 'Stack 0', order: 5, borderWidth: 0 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                tooltip: { callbacks: createFlowTooltipCallbacks(totalMortgage) },
                legend: { labels: { color: textColor } }
            },
            scales: {
                y: { title: { display: true, text: t('chartYAxisMonthly'), color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } },
                x: { stacked: true, ticks: { color: textColor }, grid: { color: gridColor } }
            }
        }
    };
}

function createFlowTooltipCallbacks(totalMortgage) {
    // ... extract tooltip logic
}
```

**Test:** None (new file)

### Step 5.5: Create charts index

Create `src/charts/index.js`:
```javascript
import { createWealthChartConfig } from './wealth.js';
import { createFlowChartConfig } from './flow.js';

let wealthChart = null;
let flowChart = null;

export function drawCharts(params) {
    const isDark = document.body.classList.contains('dark');
    
    // Destroy existing charts
    if (wealthChart) wealthChart.destroy();
    if (flowChart) flowChart.destroy();
    
    // Create wealth chart
    const ctx1 = document.getElementById('wealthChart').getContext('2d');
    const wealthConfig = createWealthChartConfig({ ...params, isDark });
    wealthChart = new Chart(ctx1, wealthConfig);
    
    // Create flow chart
    const ctx2 = document.getElementById('flowChart').getContext('2d');
    const flowConfig = createFlowChartConfig({ ...params, isDark });
    flowChart = new Chart(ctx2, flowConfig);
}

export function destroyCharts() {
    if (wealthChart) { wealthChart.destroy(); wealthChart = null; }
    if (flowChart) { flowChart.destroy(); flowChart = null; }
}

export function getCharts() {
    return { wealthChart, flowChart };
}
```

**Test:** None (new file)

### Step 5.6: Update app.js

Add import:
```javascript
import { drawCharts, destroyCharts } from './charts/index.js';
```

Remove from app.js:
- `let wealthChart = null;`
- `let flowChart = null;`
- `function drawCharts(...) {...}` (~200 lines)

Update `runSim()` to call new `drawCharts()` with proper params object.

**Test:**
```bash
npm test -- --testPathPattern="app.test"
```
Manual: 
- Verify wealth chart renders
- Verify flow chart renders
- Toggle dark mode, verify colors update
- Check tax zone appears when taxes enabled

### Step 5.7: Commit Phase 5

```bash
git add src/charts src/app.js
git commit -m "refactor: Extract chart rendering to charts module"
```

**Test:** Full suite
```bash
npm test
```

---

## Phase 6: Extract Prepayments

**Goal:** Move prepayment logic and UI to dedicated module.

**Files affected:**
- `src/app.js` (remove ~150 lines)
- `src/prepayments/index.js` (new)

### Step 6.1: Create prepayments directory

```bash
mkdir -p src/prepayments
```

### Step 6.2: Extract prepayment state and helpers

Create `src/prepayments/index.js`:
```javascript
let prepayments = [];
let prepayIdCounter = 0;

export function getPrepayments() {
    return prepayments;
}

export function setPrepayments(p) {
    prepayments = p;
}

export function getTrackInitialBalance(trackId, getEquity, getDownPct, getTrackPct) {
    const eq = getEquity();
    const downPct = getDownPct();
    const loan = eq / downPct - eq;
    const pct = getTrackPct(trackId);
    return loan * pct / 100;
}

export function getTrackBalanceAtYear(trackId, year, getInitialBalance, getRate, getTerm) {
    const initial = getInitialBalance(trackId);
    if (initial <= 0 || year <= 0) return initial;
    
    const rate = getRate(trackId);
    const termYears = getTerm(trackId);
    const monthlyRate = rate / 12;
    const totalMonths = termYears * 12;
    const paidMonths = year * 12;
    
    if (monthlyRate === 0) {
        return initial * (1 - paidMonths / totalMonths);
    }
    
    const factor = Math.pow(1 + monthlyRate, totalMonths);
    const paidFactor = Math.pow(1 + monthlyRate, paidMonths);
    const remaining = initial * (factor - paidFactor) / (factor - 1);
    
    return Math.max(0, remaining);
}

export function getRemainingForTrack(trackId, excludeId, atYear, getBalanceAtYear) {
    const p = excludeId !== null ? prepayments.find(x => x.id === excludeId) : null;
    const year = atYear !== null ? atYear : (p ? p.yr : 0);
    const balanceAtYear = year > 0 ? getBalanceAtYear(trackId, year) : getBalanceAtYear(trackId, 0);
    
    const used = prepayments
        .filter(pp => pp.track === trackId && pp.id !== excludeId && pp.yr <= year)
        .reduce((sum, pp) => sum + pp.amt, 0);
    
    return Math.max(0, balanceAtYear - used);
}

export function getMaxPrepayForTrack(trackId, year, excludeId, getBalanceAtYear) {
    const balanceAtYear = getBalanceAtYear(trackId, year);
    const otherPrepays = prepayments
        .filter(pp => pp.track === trackId && pp.id !== excludeId && pp.yr <= year)
        .reduce((sum, pp) => sum + pp.amt, 0);
    return Math.round(Math.max(0, balanceAtYear - otherPrepays));
}

export function addPrepayment(getActiveTracks, getRemainingForTrack) {
    const active = getActiveTracks();
    if (active.length === 0) {
        alert('No active tracks to prepay. Add allocation to at least one track first.');
        return false;
    }
    
    const trackWithBalance = active.find(t => getRemainingForTrack(t.id) > 0);
    if (!trackWithBalance) {
        alert('All track balances are fully allocated to existing prepayments.');
        return false;
    }
    
    const remaining = getRemainingForTrack(trackWithBalance.id);
    const id = prepayIdCounter++;
    prepayments.push({ id, track: trackWithBalance.id, amt: Math.min(100000, remaining), yr: 5 });
    return true;
}

export function removePrepayment(id) {
    prepayments = prepayments.filter(p => p.id !== id);
}

export function updatePrepayment(id, field, value, getMaxForTrack, renderCallback) {
    const p = prepayments.find(x => x.id === id);
    if (!p) return;
    
    let needsRender = false;
    
    if (field === 'yr') {
        const newYr = Math.max(1, Math.min(30, parseInt(value) || 1));
        if (newYr !== p.yr) {
            p.yr = newYr;
            const newMax = getMaxForTrack(p.track, p.yr, id);
            if (p.amt > newMax) p.amt = newMax;
            needsRender = true;
        }
    } else if (field === 'amt') {
        const requested = parseFloat(value) || 0;
        const max = getMaxForTrack(p.track, p.yr, id);
        p.amt = Math.round(Math.min(requested, max));
    } else if (field === 'track') {
        p.track = value;
        const max = getMaxForTrack(value, p.yr, id);
        if (p.amt > max) p.amt = max;
        needsRender = true;
    }
    
    if (needsRender && renderCallback) renderCallback();
}

export function maxPrepayment(id, getMaxForTrack, renderCallback) {
    const p = prepayments.find(x => x.id === id);
    if (!p) return;
    p.amt = getMaxForTrack(p.track, p.yr, id);
    if (renderCallback) renderCallback();
}

export function renderPrepayments(listElement, getActiveTracks, getBalanceAtYear, updateCallback, removeCallback, maxCallback) {
    if (!listElement) return;
    const active = getActiveTracks();
    
    listElement.innerHTML = prepayments.map(p => {
        const trackValid = active.some(t => t.id === p.track);
        if (!trackValid && active.length > 0) p.track = active[0].id;
        
        const balanceAtYear = getBalanceAtYear(p.track, p.yr);
        const otherPrepays = prepayments
            .filter(pp => pp.track === p.track && pp.id !== p.id && pp.yr <= p.yr)
            .reduce((sum, pp) => sum + pp.amt, 0);
        const maxVal = Math.max(0, balanceAtYear - otherPrepays);
        
        if (p.amt > maxVal) p.amt = maxVal;
        
        const options = active.map(t => 
            `<option value="${t.id}" ${p.track === t.id ? 'selected' : ''}>${t.name}</option>`
        ).join('');
        
        return `<div class="prepay-item">
            <select onchange="${updateCallback}(${p.id},'track',this.value)">${options}</select>
            <span class="prepay-label">₪</span>
            <div class="prepay-amt-group">
                <input type="number" value="${p.amt}" min="0" max="${maxVal}" step="10000" oninput="${updateCallback}(${p.id},'amt',this.value)">
                <span class="prepay-max-btn" onclick="${maxCallback}(${p.id})">MAX</span>
            </div>
            <span class="prepay-label">Yr</span>
            <input type="number" value="${p.yr}" min="1" max="30" style="width:45px" oninput="${updateCallback}(${p.id},'yr',this.value)">
            <span class="prepay-remove" onclick="${removeCallback}(${p.id})">✕</span>
        </div>`;
    }).join('');
}
```

**Test:** None (new file)

### Step 6.3: Update app.js

Add import:
```javascript
import * as Prepayments from './prepayments/index.js';
```

Remove from app.js:
- `let prepayments = [];`
- `let prepayIdCounter = 0;`
- All prepayment-related functions (~150 lines)

Update references to use `Prepayments.xxx()`.

**Test:**
```bash
npm test -- --testPathPattern="app.test|prepay"
```
Manual:
- Add prepayment
- Change track
- Change amount
- Change year
- Remove prepayment
- Verify MAX button works

### Step 6.4: Commit Phase 6

```bash
git add src/prepayments src/app.js
git commit -m "refactor: Extract prepayment logic to dedicated module"
```

**Test:** Full suite
```bash
npm test
```

---

## Phase 7: Extract Persistence

**Goal:** Move localStorage save/load to dedicated module.

**Files affected:**
- `src/app.js` (remove ~100 lines)
- `src/persistence/index.js` (new)

### Step 7.1: Create persistence directory

```bash
mkdir -p src/persistence
```

### Step 7.2: Extract persistence functions

Create `src/persistence/index.js`:
```javascript
const STORAGE_KEY = 'mortgageCalcState';

export function saveState(getStateCallback) {
    const state = getStateCallback();
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch(e) {
        console.warn('Failed to save state:', e);
    }
}

export function loadState(setStateCallback) {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return false;
        const state = JSON.parse(saved);
        setStateCallback(state);
        return true;
    } catch(e) {
        console.warn('Failed to load state:', e);
        return false;
    }
}

export function clearState() {
    localStorage.removeItem(STORAGE_KEY);
}

export function saveDarkMode(isDark) {
    localStorage.setItem('darkMode', isDark);
}

export function loadDarkMode() {
    return localStorage.getItem('darkMode') === 'true';
}
```

**Test:** None (new file)

### Step 7.3: Update app.js

Add import:
```javascript
import { saveState, loadState, clearState, saveDarkMode, loadDarkMode } from './persistence/index.js';
```

Remove from app.js:
- `const STORAGE_KEY = 'mortgageCalcState';`
- `function saveState() {...}`
- `function loadState() {...}`

Update `saveState()` calls to pass state getter callback.
Update `loadState()` calls to pass state setter callback.
Update `resetAll()` to use `clearState()`.
Update `toggleDarkMode()` to use `saveDarkMode()`.
Update `bootstrap()` to use `loadDarkMode()`.

**Test:**
```bash
npm test -- --testPathPattern="app.test"
```
Manual:
- Change settings, refresh page, verify restored
- Click reset, verify defaults restored
- Toggle dark mode, refresh, verify persisted

### Step 7.4: Commit Phase 7

```bash
git add src/persistence src/app.js
git commit -m "refactor: Extract persistence to dedicated module"
```

**Test:** Full suite
```bash
npm test
```

---

Continue to [REFACTORING_PLAN_PART3.md](./REFACTORING_PLAN_PART3.md) for Phases 8-10.
