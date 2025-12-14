# Real Estate Investment Simulator - Refactoring Plan

## Final Status (Dec 15, 2025)

| Phase | Description | Status | Notes |
|-------|-------------|--------|-------|
| 1 | Extract Translations | ✅ Complete | 318 lines → src/i18n/ |
| 2 | Extract Constants | ✅ Complete | 35 lines → src/config/ |
| 3 | Dead Code Removal | ✅ Complete | Removed unused recommendMix() |
| 4 | Extract Charts | ✅ Complete | 250 lines → src/charts/ |
| 5 | Extract Prepayments | ✅ Complete | 207 lines → src/prepayments/ |
| 6 | Browser Compatibility | ✅ Complete | IIFE pattern for file:// |
| 7 | State Management | ✅ Complete | 83 lines → src/state/ |
| 8 | Extract Persistence | ✅ Complete | 132 lines → src/persistence/ |
| 9 | Alpine.js Adoption | ✅ Complete | Full reactive UI bindings |

**app.js: 1928 → 1046 lines (46% reduction)**
**Total source: 2071 lines across 8 modules (excl. logic.js)**
**All 276 tests passing**

## Module Structure
```
src/
├── index.html              # Entry point with Alpine.js bindings
├── app.js                  # Main app logic (1046 lines)
├── logic.js                # Simulation engine (771 lines)
├── styles.css              # Styling
├── i18n/index.js           # Translations (318 lines)
├── config/index.js         # Constants (35 lines)
├── state/index.js          # State management + Alpine store (83 lines)
├── charts/index.js         # Chart rendering (250 lines)
├── prepayments/index.js    # Prepayment logic (207 lines)
└── persistence/index.js    # localStorage save/load (132 lines)
```

## Alpine.js Integration

### Converted Elements (20+ bindings)
**Toggle States (`:class`)**
- Mode toggles (currency/percent)
- Surplus mode pills (invest/consume/match)
- Repay method pills (spitzer/equalPrincipal)
- Optimize mode pills (outperform/roi)
- Horizon mode pills (auto/custom)
- Tax mode toggles (real/forex)
- Global hist/fixed toggle
- Market variable toggles (SP, App, Int, Yld, Inf)

**Lock Toggles (`:class` + `x-text`)**
- Down payment lock
- Term lock
- Horizon lock

**Conditional Visibility (`x-show`)**
- equityBox (currency mode)
- basicTermBox / advancedTermBox
- bHor (horizon slider)
- prepayContainer
- Rate label/input pairs
- Market variable input boxes
- Scenario box

**Two-way Binding (`x-model`)**
- Buyer type select

### State Variables (22 total)
```javascript
{
    mode, exMode, taxMode, horMode,
    lockDown, lockTerm, lockHor,
    buyerType, advancedTermMode, creditScore,
    surplusMode, repayMethod, optimizeMode,
    rateEditMode, prepayExpanded, bootstrapping,
    globalHistMode, histSP, histApp, histInt, histYld, histInf
}
```

## What Remains in app.js (1046 lines)
- **~40 DOM handler functions**: Mix validation, rate management
- **runSim**: Core simulation orchestration (~240 lines)
- **updateSweetSpots**: Optimization logic (~90 lines)
- **bootstrap**: Initialization sequence (~50 lines)
- **cfg object**: Legacy structure (kept for backward compatibility)

## Architecture Benefits
1. **Declarative UI** - State drives UI via Alpine bindings
2. **Single source of truth** - AppState syncs with Alpine store
3. **Test compatibility** - JS fallbacks for non-Alpine environments
4. **Minimal overhead** - Alpine.js is ~7kB gzipped
5. **No build step** - Works with file:// protocol
