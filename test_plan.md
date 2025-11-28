# Test Plan: Ultimate Investment Dashboard (V25)

## 1. Executive Summary
This test plan aims to validate the mathematical integrity and functional correctness of the `src/logic.js` simulation engine and its integration with the `src/app.js` UI controller. Given the financial nature of the application, accuracy in amortization, linkage (CPI), and compounding is paramount.

## 2. Risk Assessment & Prioritization

| Priority | Component | Risk Description | Why? |
| :--- | :--- | :--- | :--- |
| **P0 (Critical)** | **Amortization Engine (Tamheel)** | Incorrect principal reduction, interest calculation, or linkage application. | Core value prop. If this is wrong, the tool is useless. |
| **P0 (Critical)** | **Surplus Reinvestment** | "Side Portfolio" math (compounding, tax, basis). | Major differentiator in V25. High complexity. |
| **P1 (High)** | **Friction Logic** | Buying/Selling costs not reducing equity correctly. | Affects "Net Wealth" accuracy significantly. |
| **P1 (High)** | **Drift Logic** | Exchange rate impact on S&P Unhedged. | Critical for "Bear" scenario accuracy. |
| **P2 (Medium)** | **Optimizer (Sweet Spot)** | Finding local maxima instead of global, or crashing. | UX feature, but misleading if wrong. |
| **P3 (Low)** | **UI Binding** | Labels not updating, sliders distinct from text. | Visual annoyance, easily spotted. |

## 3. Test Strategy

### 3.1 Unit Tests (`tests/logic.test.js`)
Focus on pure functions in `src/logic.js`.
*   **calcPmt:** Verify standard Spitzer formula against Excel `PMT` results.
*   **calcCAGR (Tamheel):**
    *   *Scenario:* **Negative Amortization.** Test a Katz loan where Inflation > Interest. Verify principal *increases*.
    *   *Scenario:* **Prime Shock.** Test a Prime loan where BoI rates jump. Verify monthly payment increases immediately.
*   **calcCAGR (Surplus):**
    *   *Scenario:* **Reinvest Verification.** Manually calculate a 1-year run with fixed surplus. Verify `reSideStockValue` matches `Surplus * (1-Fee) * (1+Growth)`.

### 3.2 Integration Tests (`tests/integration_v2.test.js`)
Focus on the end-to-end flow in `src/app.js`.
*   **Scenario Loading:** Verify that clicking "Bear" updates the sliders to the specific JSON values defined in the report.
*   **Result Consistency:** Run a full sim with known inputs and assert `kRE` and `kSP` match a "Truth Table".

## 4. Truth Table (Baseline for Testing)
We will use these manually calculated values to validate the engine.

**Baseline Case:**
*   **Loan:** 500k, 20 Years, 0% Interest, 0% Inflation.
*   **Asset:** 1M, 0% App, 0% Rent.
*   **Result:** Monthly Pmt = 2,083.33. Net RE = 1M. Total Cash = 1M.

**Inflation Case:**
*   **Loan:** 100k Katz, 20 Years, 0% Real Interest, 10% Annual Inflation.
*   **Result:** Principal should grow in Year 1.

## 5. Execution Plan
1.  Refactor `tests/logic.test.js` to include the P0 tests.
2.  Refactor `tests/surplus.test.js` to verify the specific compounding math.
3.  Run and fix any discrepancies.
