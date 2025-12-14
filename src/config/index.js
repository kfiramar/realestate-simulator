// Configuration constants for the mortgage simulator
(function() {
    const SCENARIOS = {
        bear: { sp: 7.0, app: 3.0, int: 5.0, inf: 3.5, yld: 2.5, drift: 1.0 },
        base: { sp: 9.5, app: 5.0, int: 4.25, inf: 2.5, yld: 2.8, drift: 0.5 },
        bull: { sp: 10.0, app: 7.0, int: 3.0, inf: 2.0, yld: 3.0, drift: -0.5 }
    };

    const TAMHEEL_PROFILES = {
        defaultEven: { p: 30, k: 40, z: 0, m: 30, mt: 0, tP: 30, tK: 20, tZ: 20, tM: 30, tMt: 15 },
        shield: { p: 25, k: 50, z: 0, m: 25, mt: 0, tP: 30, tK: 25, tZ: 25, tM: 30, tMt: 20 },
        investor: { p: 33, k: 34, z: 0, m: 0, mt: 33, tP: 30, tK: 20, tZ: 20, tM: 30, tMt: 20 },
        arbitrage: { p: 37, k: 33, z: 0, m: 30, mt: 0, tP: 30, tK: 12, tZ: 12, tM: 30, tMt: 10 }
    };

    const ANCHORS = {
        prime: 1.50,
        kalats: 0.60,
        malatz: 0.51,
        katz: -1.30,
        matz: -1.05
    };

    const CREDIT_MATRIX = {
        A: { range: [950, 1000], riskP: -0.95, riskK: -0.25, riskM: -0.20, riskZ: -0.20, maxLTV: 0.75 },
        B: { range: [900, 949], riskP: -0.80, riskK: -0.15, riskM: -0.10, riskZ: -0.10, maxLTV: 0.75 },
        C: { range: [850, 899], riskP: -0.60, riskK: -0.05, riskM: 0.00, riskZ: 0.00, maxLTV: 0.75 },
        D: { range: [800, 849], riskP: -0.40, riskK: 0.05, riskM: 0.10, riskZ: 0.10, maxLTV: 0.75 },
        E: { range: [750, 799], riskP: -0.20, riskK: 0.20, riskM: 0.25, riskZ: 0.25, maxLTV: 0.70 },
        F: { range: [700, 749], riskP: 0.00, riskK: 0.40, riskM: 0.40, riskZ: 0.40, maxLTV: 0.65 },
        G: { range: [660, 699], riskP: 0.25, riskK: 0.65, riskM: 0.60, riskZ: 0.60, maxLTV: 0.60 },
        H: { range: [0, 659], riskP: null, riskK: null, riskM: null, riskZ: null, maxLTV: 0 }
    };

    const TERM_MIN = 1;
    const TERM_MAX = 30;

    const LTV_MIN = {
        first: 25,
        replacement: 30,
        investor: 50
    };

    // Expose globally
    window.AppConfig = {
        SCENARIOS,
        TAMHEEL_PROFILES,
        ANCHORS,
        CREDIT_MATRIX,
        TERM_MIN,
        TERM_MAX,
        LTV_MIN
    };
})();
