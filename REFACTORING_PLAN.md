# Real Estate Investment Simulator - Refactoring Plan

## Current Status (Updated: Dec 15, 2025)

| Phase | Description | Status | Notes |
|-------|-------------|--------|-------|
| 1 | Extract Translations | ✅ Complete | ~300 lines → src/i18n/ |
| 2 | Extract Constants | ✅ Complete | ~50 lines → src/config/ |
| 3 | Dead Code Removal | ✅ Complete | Removed unused recommendMix() |
| 4 | ES Modules Migration | ✅ Complete | Babel transpilation for Jest |
| 5 | Extract Charts | ✅ Complete | ~250 lines → src/charts/ |
| 6 | Extract Prepayments | ⏸️ Deferred | ~236 lines, needs state refactor |
| 7 | Extract Persistence | ⏸️ Deferred | ~115 lines, needs state refactor |
| 8 | Centralize State | ⏸️ Deferred | Major undertaking |

**app.js: 1928 → 1300 lines (33% reduction)**
**All 276 tests passing**

### Module Structure
```
src/
├── index.html          # Entry point
├── app.js              # Main app logic (1300 lines)
├── logic.js            # Simulation engine (774 lines)
├── styles.css          # Styling
├── i18n/
│   └── index.js        # Translation system
├── config/
│   └── index.js        # Constants & scenarios
└── charts/
    └── index.js        # Chart rendering
```

### Remaining Work
Phases 6-8 require centralizing state management:
- `prepayments` array used by 8+ functions
- `mode`, `surplusMode`, `horMode` etc. used throughout
- DOM element references scattered across functions

Options:
1. Create a state object passed to all functions
2. Use a simple pub/sub pattern
3. Keep as-is (functional, just not ideal)

---

## Overview

This document outlines a comprehensive refactoring plan for the Brickfolio real estate investment simulator. The goal is to improve code maintainability, testability, and developer experience while preserving all existing functionality.

### Current State

| File | Lines | Functions | Issues |
|------|-------|-----------|--------|
| app.js | 1928 | 59 | God object, mixed concerns |
| logic.js | 775 | 12 | Large simulate(), could be split |
| index.html | 523 | - | Inline handlers |
| styles.css | 1132 | - | Single file, manageable |

### Target State

```
src/
├── index.html           # Minimal, clean markup
├── styles.css           # Unchanged
├── main.js              # Entry point, bootstrap only (~100 lines)
├── i18n/
│   ├── index.js         # Translation system
│   ├── en.js            # English translations
│   └── he.js            # Hebrew translations
├── config/
│   ├── index.js         # Re-exports
│   ├── scenarios.js     # SCENARIOS constant
│   ├── tamheel.js       # TAMHEEL_PROFILES
│   ├── credit.js        # CREDIT_MATRIX, ANCHORS
│   └── limits.js        # LTV_MIN, TERM_MIN/MAX
├── state/
│   └── index.js         # Centralized state management
├── ui/
│   ├── index.js         # Re-exports
│   ├── formatters.js    # fmt, fmtNum, fmtVal
│   ├── dom.js           # DOM helpers, element getters
│   ├── sliders.js       # Slider sync, sweet spots
│   ├── mix.js           # Mortgage mix UI
│   └── rates.js         # Rate display/edit
├── charts/
│   ├── index.js         # Chart management
│   ├── wealth.js        # Wealth chart config
│   ├── flow.js          # Cash flow chart config
│   └── plugins.js       # Tax zone plugin
├── prepayments/
│   └── index.js         # Prepayment logic & UI
├── persistence/
│   └── index.js         # localStorage save/load
└── logic/
    ├── index.js         # Re-exports (public API)
    ├── simulate.js      # Core simulation engine
    ├── mortgage.js      # calcPmt, amortization
    ├── tax.js           # Purchase tax, Mas Shevach
    ├── optimizer.js     # searchSweetSpots
    └── historical.js    # Historical data arrays
```

### Guiding Principles

1. **One change at a time** - Each step is atomic and testable
2. **Tests must pass** - Run specified tests after each step
3. **No functionality changes** - Pure refactoring, behavior preserved
4. **Incremental commits** - Commit after each phase completion

---

## Phase Index

| Phase | Description | Status | Risk | Est. Time |
|-------|-------------|--------|------|-----------|
| [1](#phase-1-extract-translations) | Extract Translations | ✅ Done | Low | 45 min |
| [2](#phase-2-extract-constants) | Extract Constants | ✅ Done | Low | 30 min |
| [3](#phase-3-split-logicjs) | Split logic.js | ⏸️ Deferred | Low | 45 min |
| [4](#phase-4-extract-formatters) | Extract Formatters | ⏸️ Deferred | Low | 20 min |
| [5](#phase-5-extract-charts) | Extract Charts | ⏸️ Deferred | Medium | 60 min |
| [6](#phase-6-extract-prepayments) | Extract Prepayments | ⏸️ Deferred | Medium | 45 min |
| [7](#phase-7-extract-persistence) | Extract Persistence | ⏸️ Deferred | Low | 30 min |
| [8](#phase-8-centralize-state) | Centralize State | ⏸️ Deferred | Medium | 60 min |
| [9](#phase-9-extract-ui-modules) | Extract UI Modules | ⏸️ Deferred | Medium | 45 min |
| [10](#phase-10-cleanup) | Final Cleanup | ⏸️ Deferred | Low | 30 min |

**Completed: 2/10 phases | Remaining phases blocked by global dependencies**

---

## Pre-Refactoring Checklist

- [ ] All 276 tests passing: `npm test`
- [ ] Create `refactoring` branch: `git checkout -b refactoring`
- [ ] Backup current state: `git stash` or commit WIP
- [ ] Open app in browser for manual verification

---

## Phase 1: Extract Translations

**Goal:** Move all translation-related code to dedicated i18n module.

**Files affected:**
- `src/app.js` (remove ~350 lines)
- `src/i18n/index.js` (new)
- `src/i18n/en.js` (new)
- `src/i18n/he.js` (new)

### Step 1.1: Create i18n directory structure

```bash
mkdir -p src/i18n
```

**Test:** None (directory creation)

### Step 1.2: Extract English translations

Create `src/i18n/en.js`:
- Copy the `T.en` object from app.js (lines 6-155)
- Export as default

```javascript
// src/i18n/en.js
const en = {
    title: 'Brickfolio',
    startingCash: 'Starting Cash',
    // ... all EN translations
};
export default en;
```

**Test:** None (new file, not yet imported)

### Step 1.3: Extract Hebrew translations

Create `src/i18n/he.js`:
- Copy the `T.he` object from app.js (lines 156-310)
- Export as default

```javascript
// src/i18n/he.js
const he = {
    title: 'בריקפוליו',
    startingCash: 'הון עצמי',
    // ... all HE translations
};
export default he;
```

**Test:** None (new file, not yet imported)

### Step 1.4: Create i18n index module

Create `src/i18n/index.js`:
- Import en.js and he.js
- Recreate `T` object
- Move `t()` function
- Move `toggleLang()` function
- Move `applyTranslations()` function
- Export all

```javascript
// src/i18n/index.js
import en from './en.js';
import he from './he.js';

const T = { en, he };
let lang = localStorage.getItem('lang') || 'en';

export function t(key) {
    return T[lang][key] || T['en'][key] || key;
}

export function getLang() { return lang; }
export function setLang(l) { lang = l; }

export function toggleLang() {
    lang = lang === 'en' ? 'he' : 'en';
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    document.body.classList.toggle('rtl', lang === 'he');
}

export function applyTranslations(runSimCallback) {
    document.querySelectorAll('[data-t]').forEach(el => {
        // ... existing logic
    });
    if (runSimCallback) runSimCallback();
}
```

**Test:** None (not yet integrated)

### Step 1.5: Update index.html script loading

Add module script tag before app.js:
```html
<script type="module" src="./i18n/index.js"></script>
```

**Test:** Page loads without errors

### Step 1.6: Update app.js to import i18n

At top of app.js:
```javascript
import { t, getLang, setLang, toggleLang, applyTranslations } from './i18n/index.js';
```

Remove from app.js:
- `const T = { en: {...}, he: {...} };` (lines 5-310)
- `function t(key)` 
- `function toggleLang()`
- `function applyTranslations()`
- `let lang = ...` (use getLang/setLang instead)

Update references:
- Replace `lang` variable access with `getLang()`
- Replace `lang = ...` assignments with `setLang(...)`

**Test:** 
```bash
npm test -- --testPathPattern="app.test"
```
Manual: Toggle language, verify translations work

### Step 1.7: Commit Phase 1

```bash
git add src/i18n src/app.js src/index.html
git commit -m "refactor: Extract translations to i18n module"
```

**Test:** Full test suite
```bash
npm test
```

---

## Phase 2: Extract Constants

**Goal:** Move business constants to dedicated config modules.

**Files affected:**
- `src/app.js` (remove ~80 lines)
- `src/config/index.js` (new)
- `src/config/scenarios.js` (new)
- `src/config/tamheel.js` (new)
- `src/config/credit.js` (new)
- `src/config/limits.js` (new)

### Step 2.1: Create config directory

```bash
mkdir -p src/config
```

### Step 2.2: Extract SCENARIOS

Create `src/config/scenarios.js`:
```javascript
export const SCENARIOS = {
    bear: { sp: 7.0, app: 3.0, int: 5.0, inf: 3.5, yld: 2.5, drift: 1.0 },
    base: { sp: 9.5, app: 5.0, int: 4.25, inf: 2.5, yld: 2.8, drift: 0.5 },
    bull: { sp: 10.0, app: 7.0, int: 3.0, inf: 2.0, yld: 3.0, drift: -0.5 }
};
```

**Test:** None

### Step 2.3: Extract TAMHEEL_PROFILES

Create `src/config/tamheel.js`:
```javascript
export const TAMHEEL_PROFILES = {
    defaultEven: { p: 30, k: 40, z: 0, m: 30, mt: 0, tP: 30, tK: 20, tZ: 20, tM: 30, tMt: 15 },
    shield: { p: 25, k: 50, z: 0, m: 25, mt: 0, tP: 30, tK: 25, tZ: 25, tM: 30, tMt: 20 },
    investor: { p: 33, k: 34, z: 0, m: 0, mt: 33, tP: 30, tK: 20, tZ: 20, tM: 30, tMt: 20 },
    arbitrage: { p: 37, k: 33, z: 0, m: 30, mt: 0, tP: 30, tK: 12, tZ: 12, tM: 30, tMt: 10 }
};
```

**Test:** None

### Step 2.4: Extract CREDIT_MATRIX and ANCHORS

Create `src/config/credit.js`:
```javascript
export const ANCHORS = {
    prime: 1.50,
    kalats: 0.60,
    malatz: 0.51,
    katz: -1.30,
    matz: -1.05
};

export const CREDIT_MATRIX = {
    A: { range: [950, 1000], riskP: -0.95, riskK: -0.25, riskM: -0.20, riskZ: -0.20, maxLTV: 0.75 },
    // ... rest of matrix
};
```

**Test:** None

### Step 2.5: Extract LTV_MIN and TERM limits

Create `src/config/limits.js`:
```javascript
export const TERM_MIN = 1;
export const TERM_MAX = 30;

export const LTV_MIN = {
    first: 25,
    replacement: 30,
    investor: 50
};
```

**Test:** None

### Step 2.6: Create config index

Create `src/config/index.js`:
```javascript
export { SCENARIOS } from './scenarios.js';
export { TAMHEEL_PROFILES } from './tamheel.js';
export { ANCHORS, CREDIT_MATRIX } from './credit.js';
export { TERM_MIN, TERM_MAX, LTV_MIN } from './limits.js';
```

**Test:** None

### Step 2.7: Update app.js imports

Add to app.js:
```javascript
import { SCENARIOS, TAMHEEL_PROFILES, ANCHORS, CREDIT_MATRIX, TERM_MIN, TERM_MAX, LTV_MIN } from './config/index.js';
```

Remove from app.js:
- `const SCENARIOS = {...}` (lines ~348-358)
- `const TAMHEEL_PROFILES = {...}` (lines ~358-380)
- `const ANCHORS = {...}` (lines ~380-391)
- `const CREDIT_MATRIX = {...}` (lines ~391-403)
- `const TERM_MIN/MAX` and `const LTV_MIN`

**Test:**
```bash
npm test -- --testPathPattern="app.test"
```
Manual: Apply tamheel profile, change scenario, verify values

### Step 2.8: Commit Phase 2

```bash
git add src/config src/app.js
git commit -m "refactor: Extract constants to config module"
```

**Test:** Full suite
```bash
npm test
```

---

## Phase 3: Split logic.js

**Goal:** Split monolithic logic.js into focused modules.

**Files affected:**
- `src/logic.js` → `src/logic/` directory
- Tests may need path updates

### Step 3.1: Create logic directory

```bash
mkdir -p src/logic
```

### Step 3.2: Extract historical data

Create `src/logic/historical.js`:
```javascript
export const H_SP = [0.1088, 0.0491, ...];
export const H_RE = [-0.02, 0.04, ...];
export const H_EX = [4.48, 4.49, ...];
export const H_CPI = [0.012, 0.024, ...];
export const H_BOI = [0.041, 0.035, ...];

export function getH(arr, i) {
    return i < arr.length ? arr[i] : arr[arr.length - 1];
}
```

**Test:** None

### Step 3.3: Extract tax calculations

Create `src/logic/tax.js`:
```javascript
const PURCHASE_TAX_FIRST_HOME = [...];
const PURCHASE_TAX_ADDITIONAL = [...];
const MAS_SHEVACH_EXEMPTION_CAP = 5008000;

export function calcPurchaseTax(propertyValue, isFirstHome = true) {
    // ... existing implementation
}

export function calcMasShevach(salePrice, costBasis, exemptionType = 'single') {
    // ... existing implementation
}
```

**Test:**
```bash
npm test -- --testPathPattern="israeli_taxes"
```

### Step 3.4: Extract mortgage calculations

Create `src/logic/mortgage.js`:
```javascript
export function calcPmt(p, rAnn, m) {
    if (p <= 0.01) return 0;
    if (rAnn === 0) return p / m;
    let r = rAnn / 12;
    return p * (r * Math.pow(1 + r, m)) / (Math.pow(1 + r, m) - 1);
}

export function calcIRR(cashFlows, finalValue, totalMonths) {
    // ... existing implementation
}

export function calcBalanceAfterK(P, rAnn, n, k, method = 'spitzer') {
    // ... existing implementation
}

export function calcTotalInterest(P, rAnn, n, method = 'spitzer') {
    // ... existing implementation
}

export function generateSchedule(params) {
    // ... existing implementation
}
```

**Test:**
```bash
npm test -- --testPathPattern="amortization|calcPmt"
```

### Step 3.5: Extract optimizer

Create `src/logic/optimizer.js`:
```javascript
import { simulate } from './simulate.js';

export function calcCAGR(eq, downPct, mortDur, simDur, ...) {
    // ... existing implementation
}

export function searchSweetSpots(params) {
    // ... existing implementation
}
```

**Test:**
```bash
npm test -- --testPathPattern="sweetspot"
```

### Step 3.6: Extract simulate function

Create `src/logic/simulate.js`:
```javascript
import { getH, H_SP, H_RE, H_EX, H_CPI, H_BOI } from './historical.js';
import { calcPmt, calcIRR } from './mortgage.js';
import { calcMasShevach } from './tax.js';

export function simulate(params) {
    // ... existing implementation (~300 lines)
}
```

**Test:**
```bash
npm test -- --testPathPattern="logic.test|simulate"
```

### Step 3.7: Create logic index

Create `src/logic/index.js`:
```javascript
export { calcPmt, calcIRR, calcBalanceAfterK, calcTotalInterest, generateSchedule } from './mortgage.js';
export { calcPurchaseTax, calcMasShevach } from './tax.js';
export { calcCAGR, searchSweetSpots } from './optimizer.js';
export { simulate } from './simulate.js';
export { H_SP, H_RE, H_EX, H_CPI, H_BOI, getH } from './historical.js';

// Backward compatibility
const Logic = {
    calcPmt, calcCAGR, searchSweetSpots, simulate,
    H_SP, H_RE, H_EX, H_CPI, H_BOI, getH,
    generateSchedule, calcBalanceAfterK, calcTotalInterest,
    calcPurchaseTax, calcMasShevach
};

if (typeof module !== 'undefined') module.exports = Logic;
if (typeof window !== 'undefined') window.Logic = Logic;
```

**Test:** Full logic tests
```bash
npm test -- --testPathPattern="logic|amortization|tax|sweetspot"
```

### Step 3.8: Update old logic.js

Replace `src/logic.js` content with:
```javascript
// Redirect to new module structure
export * from './logic/index.js';
```

Or delete and update all imports.

**Test:** Full suite
```bash
npm test
```

### Step 3.9: Commit Phase 3

```bash
git add src/logic src/logic.js
git commit -m "refactor: Split logic.js into focused modules"
```

---

See [REFACTORING_PLAN_PART2.md](./REFACTORING_PLAN_PART2.md) for Phases 4-10.
