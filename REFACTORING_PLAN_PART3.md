# Refactoring Plan - Part 3 (Phases 8-10)

Continuation of [REFACTORING_PLAN_PART2.md](./REFACTORING_PLAN_PART2.md)

---

## Phase 8: Centralize State

**Goal:** Replace scattered global variables with centralized state management.

**Files affected:**
- `src/app.js` (major refactor)
- `src/state/index.js` (new)

### Step 8.1: Create state directory

```bash
mkdir -p src/state
```

### Step 8.2: Define state shape

Create `src/state/index.js`:
```javascript
// Initial state - all current globals consolidated
const initialState = {
    // Display mode
    mode: 'percent',           // 'percent' | 'currency'
    
    // Tax & FX modes
    exMode: 'hedged',          // 'hedged' | 'exposed'
    taxMode: 'real',           // 'real' | 'forex'
    
    // Horizon mode
    horMode: 'auto',           // 'auto' | 'custom'
    
    // Locks for optimizer
    lockDown: false,
    lockTerm: false,
    lockHor: true,
    
    // User profile
    buyerType: 'first',        // 'first' | 'replacement' | 'investor'
    creditScore: 900,
    
    // UI modes
    advancedTermMode: false,
    rateEditMode: false,
    
    // Calculation modes
    surplusMode: 'match',      // 'match' | 'invest' | 'consume'
    repayMethod: 'spitzer',    // 'spitzer' | 'equalPrincipal'
    optimizeMode: 'outperform', // 'outperform' | 'roi'
    
    // History toggles
    cfg: {
        SP: { is: false },
        App: { is: false },
        Int: { is: false },
        Yld: { is: false },
        Inf: { is: false }
    },
    
    // Runtime flags
    bootstrapping: false
};

// Current state (mutable)
let state = { ...initialState };

// Subscribers for reactivity (optional)
const subscribers = new Set();

export function getState() {
    return state;
}

export function get(key) {
    return state[key];
}

export function set(key, value) {
    state[key] = value;
    notifySubscribers();
}

export function setState(partial) {
    state = { ...state, ...partial };
    notifySubscribers();
}

export function resetState() {
    state = { ...initialState };
    notifySubscribers();
}

export function subscribe(callback) {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
}

function notifySubscribers() {
    subscribers.forEach(cb => cb(state));
}

// Convenience getters for common access patterns
export const mode = () => state.mode;
export const exMode = () => state.exMode;
export const taxMode = () => state.taxMode;
export const horMode = () => state.horMode;
export const lockDown = () => state.lockDown;
export const lockTerm = () => state.lockTerm;
export const lockHor = () => state.lockHor;
export const buyerType = () => state.buyerType;
export const creditScore = () => state.creditScore;
export const advancedTermMode = () => state.advancedTermMode;
export const rateEditMode = () => state.rateEditMode;
export const surplusMode = () => state.surplusMode;
export const repayMethod = () => state.repayMethod;
export const optimizeMode = () => state.optimizeMode;
export const cfg = () => state.cfg;
export const bootstrapping = () => state.bootstrapping;
```

**Test:** None (new file)

### Step 8.3: Update app.js - Remove global variables

Remove these lines from app.js:
```javascript
// REMOVE ALL OF THESE:
let mode = 'percent';
let exMode = 'hedged';
let taxMode = 'real';
let horMode = 'auto';
let wealthChart = null;  // moved to charts module
let flowChart = null;    // moved to charts module
let lockDown = false;
let lockTerm = false;
let lockHor = true;
let buyerType = 'first';
let advancedTermMode = false;
let bootstrapping = false;
let creditScore = 900;
let surplusMode = 'match';
let repayMethod = 'spitzer';
let optimizeMode = 'outperform';
let rateEditMode = false;
const cfg = {...};
```

**Test:** None (will break until next step)

### Step 8.4: Update app.js - Add state imports

Add at top of app.js:
```javascript
import * as State from './state/index.js';
```

### Step 8.5: Update app.js - Replace variable reads

Search and replace pattern (do one at a time, test after each):

| Old Pattern | New Pattern |
|-------------|-------------|
| `mode ===` | `State.mode() ===` |
| `exMode ===` | `State.exMode() ===` |
| `taxMode ===` | `State.taxMode() ===` |
| `horMode ===` | `State.horMode() ===` |
| `lockDown` (read) | `State.lockDown()` |
| `lockTerm` (read) | `State.lockTerm()` |
| `lockHor` (read) | `State.lockHor()` |
| `buyerType ===` | `State.buyerType() ===` |
| `creditScore` (read) | `State.creditScore()` |
| `advancedTermMode` (read) | `State.advancedTermMode()` |
| `rateEditMode` (read) | `State.rateEditMode()` |
| `surplusMode ===` | `State.surplusMode() ===` |
| `repayMethod ===` | `State.repayMethod() ===` |
| `optimizeMode` (read) | `State.optimizeMode()` |
| `bootstrapping` (read) | `State.bootstrapping()` |
| `cfg[k]` | `State.cfg()[k]` |

**Test after each replacement:**
```bash
npm test -- --testPathPattern="app.test"
```

### Step 8.6: Update app.js - Replace variable writes

| Old Pattern | New Pattern |
|-------------|-------------|
| `mode = 'percent'` | `State.set('mode', 'percent')` |
| `exMode = 'hedged'` | `State.set('exMode', 'hedged')` |
| `taxMode = 'real'` | `State.set('taxMode', 'real')` |
| `horMode = 'auto'` | `State.set('horMode', 'auto')` |
| `lockDown = true` | `State.set('lockDown', true)` |
| `lockTerm = true` | `State.set('lockTerm', true)` |
| `lockHor = true` | `State.set('lockHor', true)` |
| `buyerType = 'first'` | `State.set('buyerType', 'first')` |
| `creditScore = 900` | `State.set('creditScore', 900)` |
| `advancedTermMode = true` | `State.set('advancedTermMode', true)` |
| `rateEditMode = true` | `State.set('rateEditMode', true)` |
| `surplusMode = 'match'` | `State.set('surplusMode', 'match')` |
| `repayMethod = 'spitzer'` | `State.set('repayMethod', 'spitzer')` |
| `optimizeMode = 'roi'` | `State.set('optimizeMode', 'roi')` |
| `bootstrapping = true` | `State.set('bootstrapping', true)` |
| `cfg[k].is = true` | `State.set('cfg', {...State.cfg(), [k]: {...State.cfg()[k], is: true}})` |

**Test after each replacement:**
```bash
npm test -- --testPathPattern="app.test"
```

### Step 8.7: Update persistence to use state

Update `src/persistence/index.js` to work with state module:
```javascript
import * as State from '../state/index.js';

export function saveState() {
    const state = State.getState();
    // Also gather DOM values...
    const fullState = {
        ...state,
        // DOM values
        equity: document.getElementById('inpEquity')?.value,
        // ... etc
    };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fullState));
    } catch(e) {}
}

export function loadState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return false;
        const s = JSON.parse(saved);
        
        // Restore state module
        State.setState({
            mode: s.mode || 'percent',
            exMode: s.exMode || 'hedged',
            // ... etc
        });
        
        // Restore DOM values
        // ... existing logic
        
        return true;
    } catch(e) { return false; }
}
```

**Test:**
```bash
npm test -- --testPathPattern="app.test"
```
Manual: Change settings, refresh, verify restored

### Step 8.8: Commit Phase 8

```bash
git add src/state src/app.js src/persistence
git commit -m "refactor: Centralize state management"
```

**Test:** Full suite
```bash
npm test
```

---

## Phase 9: Extract UI Modules

**Goal:** Extract remaining UI helper functions to dedicated modules.

**Files affected:**
- `src/app.js` (remove ~300 lines)
- `src/ui/dom.js` (new)
- `src/ui/sliders.js` (new)
- `src/ui/mix.js` (new)
- `src/ui/rates.js` (new)
- `src/ui/credit.js` (new)
- `src/ui/index.js` (new)

### Step 9.1: Extract DOM helpers

Create `src/ui/dom.js`:
```javascript
// Element getters with null safety
export function getEl(id) {
    return document.getElementById(id);
}

export function getValue(id, defaultVal = '') {
    const el = document.getElementById(id);
    return el ? el.value : defaultVal;
}

export function getNumValue(id, defaultVal = 0) {
    const el = document.getElementById(id);
    return el ? (parseFloat(el.value) || defaultVal) : defaultVal;
}

export function getIntValue(id, defaultVal = 0) {
    const el = document.getElementById(id);
    return el ? (parseInt(el.value, 10) || defaultVal) : defaultVal;
}

export function getChecked(id, defaultVal = false) {
    const el = document.getElementById(id);
    return el ? el.checked : defaultVal;
}

export function setValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
}

export function setInnerText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

export function setInnerHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

export function toggleClass(id, className, force) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle(className, force);
}

export function setDisplay(id, display) {
    const el = document.getElementById(id);
    if (el) el.style.display = display;
}
```

**Test:** None (new file)

### Step 9.2: Extract slider helpers

Create `src/ui/sliders.js`:
```javascript
import { t, getLang } from '../i18n/index.js';

export function showTermVal(elId, v) {
    const el = document.getElementById(elId);
    if (el) {
        if (getLang() === 'he') {
            el.innerHTML = '<span style="direction:ltr;display:inline-block">' + v + ' ' + t('ySuffix') + '</span>';
        } else {
            el.innerHTML = v + t('ySuffix');
        }
    }
}

export function positionSweetSpot(spotId, value, min, max, isRTL) {
    const el = document.getElementById(spotId);
    if (!el) return;
    
    let pos = ((value - min) / (max - min)) * 100;
    if (isRTL) pos = 100 - pos;
    
    el.style.left = `calc(${pos}% + (8px - (0.16px * ${pos})))`;
    el.classList.add('visible');
}

export function hideSweetSpot(spotId) {
    const el = document.getElementById(spotId);
    if (el) el.classList.remove('visible');
}
```

**Test:** None (new file)

### Step 9.3: Extract mix UI helpers

Create `src/ui/mix.js`:
```javascript
export function updateVisualBar(p, k, m, z, mt) {
    const bar = document.getElementById('mixVisualBar');
    if (!bar) return;
    const segs = bar.children;
    segs[0].style.width = p + '%';   // Prime
    segs[1].style.width = k + '%';   // Kalats
    segs[2].style.width = m + '%';   // Malatz
    segs[3].style.width = z + '%';   // Katz
    segs[4].style.width = mt + '%';  // Matz
}

export function showMaxTooltip(el, maxVal) {
    let tip = document.getElementById('maxTip');
    if (!tip) {
        tip = document.createElement('div');
        tip.id = 'maxTip';
        tip.innerHTML = '<span></span><div style="position:absolute;left:50%;bottom:-4px;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:5px solid #ef4444;"></div>';
        tip.style.cssText = 'position:fixed;background:#ef4444;color:#fff;padding:3px 6px;border-radius:4px;font-size:0.65rem;font-weight:500;z-index:999;pointer-events:none;box-shadow:0 1px 4px rgba(0,0,0,0.2);transform:translateX(-50%);transition:opacity 0.2s;';
        document.body.appendChild(tip);
    }
    tip.querySelector('span').textContent = '⚠️ Max 100%';
    const rect = el.getBoundingClientRect();
    const thumbPos = rect.left + (maxVal / 100) * rect.width;
    tip.style.left = thumbPos + 'px';
    tip.style.top = (rect.top - 28) + 'px';
    tip.style.opacity = '1';
    tip.style.display = 'block';
    clearTimeout(tip._timeout);
    tip._timeout = setTimeout(() => {
        tip.style.opacity = '0';
        setTimeout(() => tip.style.display = 'none', 100);
    }, 150);
}

export function syncSliderToHidden(track) {
    const slider = document.getElementById('slider' + track);
    const hidden = document.getElementById('pct' + track);
    const disp = document.getElementById('disp' + track);
    
    if (slider && hidden) {
        hidden.value = slider.value;
    }
    if (disp) {
        disp.innerText = slider.value + '%';
    }
}
```

**Test:** None (new file)

### Step 9.4: Extract rate UI helpers

Create `src/ui/rates.js`:
```javascript
import { t } from '../i18n/index.js';
import * as State from '../state/index.js';

export function updateRateLabels() {
    const tracks = ['Prime', 'Kalats', 'Malatz', 'Katz', 'Matz'];
    tracks.forEach(track => {
        const lbl = document.getElementById('lblRate' + track);
        const inp = document.getElementById('rate' + track);
        if (lbl && inp) {
            let suffix = (track === 'Katz' || track === 'Matz') ? '% ' + t('cpiSuffix') : '%';
            lbl.innerText = parseFloat(inp.value).toFixed(2) + suffix;
        }
    });
}

export function toggleRateEdit() {
    const newMode = !State.rateEditMode();
    State.set('rateEditMode', newMode);
    
    const tracks = ['Prime', 'Kalats', 'Malatz', 'Katz', 'Matz'];
    tracks.forEach(track => {
        const lbl = document.getElementById('lblRate' + track);
        const inp = document.getElementById('rate' + track);
        if (newMode) {
            lbl.style.display = 'none';
            inp.classList.add('show');
        } else {
            lbl.style.display = 'block';
            inp.classList.remove('show');
            let suffix = (track === 'Katz' || track === 'Matz') ? '% ' + t('cpiSuffix') : '%';
            lbl.innerText = parseFloat(inp.value).toFixed(2) + suffix;
        }
    });
}
```

**Test:** None (new file)

### Step 9.5: Extract credit UI helpers

Create `src/ui/credit.js`:
```javascript
import { CREDIT_MATRIX, ANCHORS } from '../config/index.js';

export function mapScoreToTierKey(score) {
    const s = score || 0;
    if (s >= 950) return 'A';
    if (s >= 900) return 'B';
    if (s >= 850) return 'C';
    if (s >= 800) return 'D';
    if (s >= 750) return 'E';
    if (s >= 700) return 'F';
    if (s >= 660) return 'G';
    return 'H';
}

export function getCreditTier(score) {
    const key = mapScoreToTierKey(score);
    const t = CREDIT_MATRIX[key];
    return { tier: key, ...t };
}

export function updateCreditUI(creditScore) {
    const scoreEl = document.getElementById('creditScoreVal');
    const tierEl = document.getElementById('creditTierLabel');
    const warnEl = document.getElementById('creditWarn');
    const tier = getCreditTier(creditScore);
    const displayScore = tier.range[0] + '-' + tier.range[1];

    if (scoreEl) scoreEl.innerText = displayScore;
    if (tierEl) tierEl.innerText = `Risk Tier: ${tier.tier}`;
    if (warnEl) {
        warnEl.style.display = tier.maxLTV === 0 ? 'block' : 'none';
        if (tier.maxLTV === 0) warnEl.innerText = 'Application rejected: score below 660';
    }
}

export function refreshRatesForProfile(creditScore, baseRate) {
    const tier = getCreditTier(creditScore);

    const setVal = (id, anchor, risk) => {
        const el = document.getElementById(id);
        if (el && risk !== null) {
            el.value = Math.max(0.1, baseRate + anchor + risk).toFixed(2);
        }
    };

    setVal('ratePrime', ANCHORS.prime, tier.riskP);
    setVal('rateKalats', ANCHORS.kalats, tier.riskK);
    setVal('rateMalatz', ANCHORS.malatz, tier.riskK);
    setVal('rateKatz', ANCHORS.katz, tier.riskZ);
    setVal('rateMatz', ANCHORS.matz, tier.riskZ);
}
```

**Test:** None (new file)

### Step 9.6: Create UI index

Create `src/ui/index.js`:
```javascript
export { fmt, fmtNum, fmtVal } from './formatters.js';
export { getEl, getValue, getNumValue, getIntValue, getChecked, setValue, setInnerText, setInnerHTML, toggleClass, setDisplay } from './dom.js';
export { showTermVal, positionSweetSpot, hideSweetSpot } from './sliders.js';
export { updateVisualBar, showMaxTooltip, syncSliderToHidden } from './mix.js';
export { updateRateLabels, toggleRateEdit } from './rates.js';
export { mapScoreToTierKey, getCreditTier, updateCreditUI, refreshRatesForProfile } from './credit.js';
```

**Test:** None (new file)

### Step 9.7: Update app.js to use UI modules

Add import:
```javascript
import * as UI from './ui/index.js';
```

Remove from app.js all functions now in UI modules:
- `fmt`, `fmtNum`, `fmtVal`
- `showTermVal`
- `updateVisualBar`, `showMaxTooltip`
- `updateRateLabels`, `toggleRateEdit`
- `mapScoreToTierKey`, `getCreditTier`, `updateCreditUI`, `refreshRatesForProfile`

Update all calls to use `UI.xxx()` prefix.

**Test:**
```bash
npm test -- --testPathPattern="app.test"
```
Manual:
- Verify rate labels update
- Verify credit tier displays
- Verify mix visual bar updates
- Verify term values display correctly

### Step 9.8: Commit Phase 9

```bash
git add src/ui src/app.js
git commit -m "refactor: Extract UI helpers to dedicated modules"
```

**Test:** Full suite
```bash
npm test
```

---

## Phase 10: Final Cleanup

**Goal:** Clean up app.js, update exports, verify everything works.

### Step 10.1: Review app.js structure

After all extractions, app.js should contain only:
- Imports
- `runSim()` function (main orchestrator)
- `updateSweetSpots()` function
- `bootstrap()` function
- Event handler setup
- Window exports for inline handlers

Target: ~400-500 lines

### Step 10.2: Create main.js entry point (optional)

If desired, create `src/main.js` as the entry point:
```javascript
// Main entry point
import './i18n/index.js';
import './config/index.js';
import './state/index.js';
import './ui/index.js';
import './charts/index.js';
import './prepayments/index.js';
import './persistence/index.js';
import './logic/index.js';
import './app.js';
```

Update `index.html`:
```html
<script type="module" src="./main.js"></script>
```

**Test:** Page loads and functions correctly

### Step 10.3: Update test imports

Review all test files and update imports if needed:
```javascript
// Before
const Logic = require('../src/logic.js');

// After (if using ES modules in tests)
import * as Logic from '../src/logic/index.js';
```

**Test:**
```bash
npm test
```

### Step 10.4: Add JSDoc comments

Add documentation to key exported functions:
```javascript
/**
 * Run the main simulation and update UI
 * @param {Object} opts - Options
 * @param {boolean} opts.skipCharts - Skip chart rendering
 * @param {boolean} opts.skipSweetSpots - Skip sweet spot calculation
 */
export function runSim(opts = {}) {
    // ...
}
```

**Test:** None (documentation only)

### Step 10.5: Final verification

Run complete test suite:
```bash
npm test
```

Manual testing checklist:
- [ ] Page loads without errors
- [ ] Language toggle works (EN/HE)
- [ ] Dark mode toggle works
- [ ] All sliders respond
- [ ] Mix allocation works
- [ ] Tamheel presets apply correctly
- [ ] Scenarios change values
- [ ] Charts render correctly
- [ ] Tax zone appears when enabled
- [ ] Prepayments can be added/removed
- [ ] Sweet spots calculate and display
- [ ] State persists across refresh
- [ ] Reset clears state
- [ ] Print function works

### Step 10.6: Update README

Add architecture section to README.md:
```markdown
## Architecture

The codebase is organized into focused modules:

- `src/i18n/` - Internationalization (EN/HE)
- `src/config/` - Business constants and configuration
- `src/state/` - Centralized state management
- `src/ui/` - UI helpers and DOM manipulation
- `src/charts/` - Chart.js configuration and rendering
- `src/prepayments/` - Prepayment logic and UI
- `src/persistence/` - localStorage save/load
- `src/logic/` - Core simulation engine
- `src/app.js` - Main application orchestrator
```

### Step 10.7: Final commit

```bash
git add .
git commit -m "refactor: Complete modularization of codebase"
```

### Step 10.8: Create PR

```bash
git push origin refactoring
gh pr create --title "refactor: Modularize codebase" --body "## Summary

Complete refactoring of the codebase into focused modules.

### Changes
- Extract translations to i18n module
- Extract constants to config module
- Split logic.js into focused modules
- Extract chart rendering
- Extract prepayment logic
- Extract persistence
- Centralize state management
- Extract UI helpers

### Testing
- All 276 tests passing
- Manual testing completed

### Before/After
| Metric | Before | After |
|--------|--------|-------|
| app.js lines | 1928 | ~500 |
| logic.js lines | 775 | Split into 5 files |
| Modules | 2 | 8+ |
"
```

---

## Post-Refactoring Improvements (Future)

Once the refactoring is complete, consider these enhancements:

### TypeScript Migration
- Add `.d.ts` type definitions
- Gradually convert to `.ts` files
- Enable strict type checking

### Build System
- Add Vite or esbuild
- Enable tree-shaking
- Add source maps
- Minify for production

### Testing Improvements
- Add integration tests for modules
- Add E2E tests with Playwright
- Increase branch coverage

### Code Quality
- Add ESLint configuration
- Add Prettier for formatting
- Add pre-commit hooks

---

## Troubleshooting

### Tests fail after extraction
1. Check import paths are correct
2. Verify exports match what tests expect
3. Check for circular dependencies

### UI breaks after state centralization
1. Verify all state reads use getter functions
2. Check state writes use `State.set()`
3. Ensure initial state matches old defaults

### Charts don't render
1. Check Chart.js is loaded before modules
2. Verify canvas elements exist
3. Check for console errors

### Translations missing
1. Verify all keys exist in both EN and HE
2. Check `t()` function is imported
3. Verify `applyTranslations()` is called

---

## Rollback Plan

If critical issues arise:
```bash
git checkout feature/hebrew-support
git branch -D refactoring
```

Or revert specific commits:
```bash
git revert <commit-hash>
```
