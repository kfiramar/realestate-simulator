// Mortgage track types
type TrackType = 'Prime' | 'Kalatz' | 'Malatz' | 'Katz' | 'Matz';

interface Track {
  type: TrackType;
  pct: number;
  rate: number;
  term: number;
}

interface Prepayment {
  id: number;
  track: TrackType;
  month: number;
  amount: number;
}

interface SimulationParams {
  equity: number;
  downPct: number;
  duration: number;
  horizon: number;
  tracks: Track[];
  prepayments: Prepayment[];
  spReturn: number;
  appreciation: number;
  inflation: number;
  rentYield: number;
  buyCost: number;
  sellCost: number;
  maintenance: number;
  spFee: number;
  fxSpread: number;
  discount: number;
}

interface MonthlyData {
  month: number;
  reEquity: number;
  spEquity: number;
  rent: number;
  mortgagePayment: number;
  interest: number;
  principal: number;
  netCashflow: number;
  propertyValue: number;
  remainingBalance: number;
}

interface SimulationResult {
  months: MonthlyData[];
  finalREEquity: number;
  finalSPEquity: number;
  reCAGR: number;
  spCAGR: number;
  totalInterest: number;
  breakEvenMonth: number | null;
}

interface EarlyRepaymentFee {
  discountingFee: number;
  cpiAverageFee: number;
  operationalFee: number;
  total: number;
}

// Global Logic object
declare const Logic: {
  simulate(params: SimulationParams): SimulationResult;
  calcMonthlyPayment(principal: number, annualRate: number, months: number): number;
  calcEarlyRepaymentFee(track: Track, remainingBalance: number, remainingMonths: number, boiRate: number, dayOfMonth: number, cpiIndex: number, originalTermMonths: number): EarlyRepaymentFee;
  calcTotalEarlyRepaymentFees(tracks: Track[], balances: number[], month: number, boiRate: number, dayOfMonth: number, cpiIndex: number): number;
};
