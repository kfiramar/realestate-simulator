# 🏠 Real Estate Investment Simulator

A comprehensive Israeli real estate vs. stock market investment simulator that helps you make informed decisions about buying property with a mortgage versus investing in index funds.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![JavaScript](https://img.shields.io/badge/javascript-ES6+-yellow.svg)
![Tests](https://img.shields.io/badge/tests-144%20passing-green.svg)

## 🎯 Overview

This simulator compares two investment strategies over time:
- **Real Estate Path**: Buy property with a mortgage, collect rent, build equity
- **S&P 500 Path**: Invest the same equity in index funds, rent a similar property

The tool accounts for Israeli-specific factors including mortgage track types (Prime, Kalatz, Malatz, Katz, Matz), CPI-linked loans, rental income taxation, and Bank of Israel regulations.

## ✨ Features

### Mortgage Simulation
- **5 Track Types**: Prime, Kalatz (fixed), Malatz (variable), Katz (CPI-linked fixed), Matz (CPI-linked variable)
- **Custom Mix**: Allocate percentages across tracks (must sum to 100%)
- **Bank of Israel Compliance**: Enforces 33% minimum fixed-rate requirement
- **Flexible Terms**: Set different durations per track (5-30 years)
- **Prepayment Modeling**: Schedule lump-sum prepayments on any track

### Investment Comparison
- **Side-by-Side Analysis**: Real estate equity vs. S&P 500 portfolio growth
- **CAGR Calculation**: Compound annual growth rate for both paths
- **Break-Even Analysis**: Find when real estate outperforms stocks
- **Cash Flow Visualization**: Monthly rent income vs. mortgage payments

### Economic Assumptions
- **Historical or Custom Rates**: Use historical averages or set your own
- **Inflation Modeling**: CPI affects rent, property value, and CPI-linked loans
- **Currency Modes**: View results in ILS or USD
- **Multiple Scenarios**: Base, Optimistic, Pessimistic presets

### Advanced Features
- **Credit Score Integration**: Rates adjust based on credit tier (A-H)
- **LTV Caps**: Automatic enforcement based on property type
- **Tax Calculation**: Rental income tax with ₪5,654/month exemption
- **Transaction Costs**: Purchase tax, selling costs, agent fees
- **Dark Mode**: Full dark theme support

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ (for running tests)
- Any modern web browser

### Installation

```bash
# Clone the repository
git clone https://github.com/kfiramar/realestate-simulator.git
cd realestate-simulator

# Install dependencies (for testing only)
npm install

# Open in browser
open src/index.html
# Or simply double-click src/index.html
```

### Running Tests

```bash
npm test
```

## 📊 How It Works

### The Simulation

1. **Input Parameters**:
   - Equity (down payment amount)
   - Down payment percentage (determines property value)
   - Mortgage duration and track mix
   - Expected rates for appreciation, inflation, rent yield, S&P returns

2. **Monthly Calculations**:
   - Mortgage payments (principal + interest) for each track
   - Rental income (property value × yield ÷ 12)
   - Property appreciation and CPI adjustments
   - S&P portfolio growth with surplus reinvestment

3. **Output Metrics**:
   - Final equity/portfolio values
   - CAGR for each investment path
   - Total interest paid
   - Monthly cash flow over time

### Key Formulas

**Mortgage Payment (Spitzer/Shpitzer)**:
```
PMT = P × [r(1+r)^n] / [(1+r)^n - 1]
```

**CPI-Linked Balance Adjustment**:
```
Balance_new = Balance × (1 + monthly_inflation)
```

**Real Estate CAGR**:
```
CAGR = (Final_Equity / Initial_Equity)^(1/years) - 1
```

## 🏗️ Project Structure

```
├── src/
│   ├── index.html      # Main UI
│   ├── app.js          # Application logic, UI handlers
│   ├── logic.js        # Core simulation engine
│   └── styles.css      # Styling with dark mode
├── tests/
│   ├── logic.test.js   # Core calculation tests
│   ├── amortization.test.js
│   ├── taxation.test.js
│   └── ...             # 21 test suites
├── package.json
└── README.md
```

## 🧮 Mortgage Track Types

| Track | Hebrew | Rate Type | CPI-Linked | Description |
|-------|--------|-----------|------------|-------------|
| Prime | פריים | Variable | No | Bank prime rate + margin |
| Kalatz | קל"צ | Fixed | No | Fixed rate, no CPI |
| Malatz | מל"צ | Variable | No | Variable rate, no CPI |
| Katz | ק"צ | Fixed | Yes | Fixed rate + CPI adjustment |
| Matz | מ"צ | Variable | Yes | Variable rate + CPI adjustment |

## ⚙️ Configuration Options

### Scenarios
- **Base**: Moderate assumptions (3% appreciation, 2.5% inflation)
- **Optimistic**: Higher growth (5% appreciation, 8% S&P)
- **Pessimistic**: Conservative (1% appreciation, 4% S&P)

### Display Modes
- **Currency**: Show values in ₪ or $
- **Percentage**: Show as % of initial equity
- **Surplus**: Focus on net cash flow analysis

## 🧪 Testing

The project includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run specific test file
npm test -- --testPathPattern="logic"

# Run with coverage
npm test -- --coverage
```

**Test Categories**:
- Unit tests for mortgage calculations
- Amortization schedule verification
- Tax calculation accuracy
- Edge cases (0% tracks, early payoff, etc.)
- Integration tests for full simulations

## 📱 Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This tool is for educational and planning purposes only. It does not constitute financial advice. Actual investment returns may vary significantly from simulated results. Always consult with a qualified financial advisor before making investment decisions.

## 🙏 Acknowledgments

- Bank of Israel for mortgage regulation guidelines
- Historical data sources for rate assumptions
- Chart.js for visualization
