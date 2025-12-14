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
| 7 | State Management | ✅ Complete | 76 lines → src/state/ |
| 8 | Extract Persistence | ✅ Complete | 132 lines → src/persistence/ |
| 9 | Alpine.js Adoption | ✅ Complete | Reactive UI bindings |

**app.js: 1928 → 1037 lines (46% reduction)**
**Total source: 2826 lines across 8 files**
**All 276 tests passing**

## Module Structure
```
src/
├── index.html              # Entry point with Alpine.js bindings
├── app.js                  # Main app logic (1037 lines)
├── logic.js                # Simulation engine (771 lines)
├── styles.css              # Styling
├── i18n/index.js           # Translations (318 lines)
├── config/index.js         # Constants (35 lines)
├── state/index.js          # State management + Alpine store (76 lines)
├── charts/index.js         # Chart rendering (250 lines)
├── prepayments/index.js    # Prepayment logic (207 lines)
└── persistence/index.js    # localStorage save/load (132 lines)
```

## Alpine.js Integration

### Converted Elements
- Mode toggles (currency/percent) - `:class` binding
- Surplus mode pills - `:class` binding
- Repay method pills - `:class` binding
- Optimize mode pills - `:class` binding
- Horizon mode pills - `:class` binding
- Lock toggles (down/term/horizon) - `:class` and `x-text` bindings
- Buyer type select - `x-model` binding
- Advanced term toggle - `:class` binding
- Tax mode toggles - `:class` binding
- Rate edit mode - `x-show` for label/input toggle
- basicTermBox/advancedTermBox - `x-show` visibility
- bHor (horizon slider) - `x-show` visibility
- equityBox - `x-show` visibility
- prepayContainer - `x-show` visibility

### Architecture
- Alpine store (`$store.app`) syncs with AppState module
- Both `onclick` and `@click` handlers for test compatibility
- JS functions still manipulate DOM for non-Alpine environments (tests)

### State Variables
```javascript
{
    mode: 'percent',
    exMode: 'hedged',
    taxMode: 'real',
    horMode: 'auto',
    lockDown: false,
    lockTerm: false,
    lockHor: true,
    buyerType: 'first',
    advancedTermMode: false,
    creditScore: 900,
    surplusMode: 'match',
    repayMethod: 'spitzer',
    optimizeMode: 'outperform',
    rateEditMode: false,
    prepayExpanded: false
}
```

## What Remains in app.js (1037 lines)
- **~45 DOM handler functions**: Mix validation, rate management
- **runSim**: Core simulation orchestration (~240 lines)
- **updateSweetSpots**: Optimization logic (~90 lines)
- **bootstrap**: Initialization sequence (~50 lines)
- **cfg object**: Historical mode state for market variables

## Future Improvements
1. Convert `cfg` (historical mode) to Alpine store
2. Use Alpine `x-for` for repetitive elements (mix rows)
3. Consider Alpine plugins for more complex interactions
