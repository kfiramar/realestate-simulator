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
| 7 | State Management | ✅ Complete | 54 lines → src/state/ |
| 8 | Extract Persistence | ✅ Complete | 132 lines → src/persistence/ |
| 9 | Extract UI Formatters | ⏭️ Skipped | Too small (7 lines), state-coupled |

**app.js: 1928 → 1046 lines (46% reduction)**
**Total source: 2813 lines across 8 files**
**All 276 tests passing**

## Module Structure
```
src/
├── index.html              # Entry point
├── app.js                  # Main app logic (1046 lines)
├── logic.js                # Simulation engine (771 lines)
├── styles.css              # Styling
├── i18n/index.js           # Translations (318 lines)
├── config/index.js         # Constants (35 lines)
├── state/index.js          # State management (54 lines)
├── charts/index.js         # Chart rendering (250 lines)
├── prepayments/index.js    # Prepayment logic (207 lines)
└── persistence/index.js    # localStorage save/load (132 lines)
```

## What Remains in app.js (1046 lines)
The remaining code is tightly coupled and includes:
- **50 DOM handler functions**: All use getElementById extensively
- **Mix validation**: checkMix, syncMixInput, updateVisualBar
- **Rate management**: toggleRateEdit, updateRateLabels
- **runSim**: Core simulation orchestration (~240 lines)
- **updateSweetSpots**: Optimization logic (~90 lines)
- **bootstrap**: Initialization sequence (~50 lines)

## Why Further Extraction Has Diminishing Returns
1. Remaining functions are heavily DOM-coupled (276 getElementById calls)
2. Circular dependencies (runSim ↔ updateSweetSpots ↔ checkMix)
3. State variables accessed directly by most functions
4. Extraction would add complexity without significant benefit

## Future Improvements (if needed)
1. Consider a lightweight framework (Alpine.js, Preact) for DOM binding
2. Use event delegation instead of direct getElementById
3. Implement proper dependency injection for testability
