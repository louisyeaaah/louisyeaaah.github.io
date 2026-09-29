/**
 * Side projects, as live-telemetry panels.
 *
 * Every number here is generated in the browser — there is no backend and
 * nothing connects to the real projects. The config declares what each panel
 * shows and roughly how it behaves; `modules/side-projects.js` runs the
 * simulation. The dashboard chrome says so openly.
 */

export const PROJECTS = [
  {
    id: 'aitrading',
    name: 'AITrading',
    tagline: 'Self-improving multi-agent crypto trading research system',
    status: 'paper trading',
    stack: ['Python', 'LangGraph', 'CCXT'],
    chart: { type: 'area', label: 'paper equity', unit: 'USD', baseline: 100000, vol: 0.0055, drift: 0.0009 },
    kpis: [
      { id: 'equity', label: 'equity', start: 128420, format: 'usd', vol: 0.0016, drift: 0.00004 },
      { id: 'pnl', label: 'today', start: 2.31, format: 'pctSigned', vol: 0.06, drift: 0.0006 },
      { id: 'win', label: 'win rate', start: 61.2, format: 'pct', vol: 0.12, drift: 0.0001, clamp: [45, 78] },
      { id: 'open', label: 'open', start: 3, format: 'int', vol: 0, event: 'trade' },
    ],
    events: [
      { w: 3, t: 'regime classified · trending / low-vol' },
      { w: 3, t: 'strategy weights rebalanced · 4 agents' },
      { w: 2, t: 'entered BTC/USDT long · 0.4R · stop 62,140' },
      { w: 2, t: 'closed ETH/USDT · +1.8R · thesis exhausted' },
      { w: 1, t: 'reflection pass wrote 2 new heuristics' },
      { w: 1, t: 'drawdown guard armed · −6% trailing' },
      { w: 1, t: 'alpha decay detected on mean-revert sleeve' },
    ],
  },
  {
    id: 'hypora',
    name: 'hypora',
    tagline: 'AI quant lab — factor research and strategy search',
    status: 'research',
    stack: ['Python', 'Polars', 'MLflow'],
    chart: { type: 'bars', label: 'factor information coefficient', unit: 'IC', baseline: 0, vol: 0.16, drift: 0, bipolar: true, bars: 18 },
    kpis: [
      { id: 'sharpe', label: 'sharpe', start: 1.84, format: 'dec2', vol: 0.006, drift: 0.00002, clamp: [0.4, 3.2] },
      { id: 'dd', label: 'max dd', start: -8.2, format: 'pctOne', vol: 0.02, drift: -0.00002, clamp: [-24, -1] },
      { id: 'signals', label: 'signals', start: 14, format: 'int', vol: 0, event: 'signal' },
      { id: 'turnover', label: 'turnover', start: 0.42, format: 'dec2', vol: 0.004, drift: 0, clamp: [0.05, 1.4] },
    ],
    events: [
      { w: 3, t: 'rolling IC decay · momentum(20d) → 0.03' },
      { w: 2, t: 'new signal promoted · volume-imbalance v3' },
      { w: 2, t: 'walk-forward window rolled · 2026-Q1' },
      { w: 2, t: 'candidate rejected · IC 0.011 below gate' },
      { w: 1, t: 'sector-neutralisation applied to 6 factors' },
      { w: 1, t: 'ensemble weight search converged · 240 trials' },
    ],
  },
  {
    id: 'stockpulse',
    name: 'stockpulse',
    tagline: 'K-line pattern recognition, news-price correlation, multi-stock driver analysis',
    status: 'prototype',
    stack: ['Python', 'FastAPI', 'Next.js'],
    chart: { type: 'candles', label: 'price · 5m bars', unit: 'AUD', baseline: 41.2, vol: 0.006, drift: 0.0002, bars: 44 },
    kpis: [
      { id: 'patterns', label: 'patterns', start: 7, format: 'int', vol: 0, event: 'pattern' },
      { id: 'corr', label: 'news corr', start: 0.68, format: 'dec2', vol: 0.005, drift: 0, clamp: [-1, 1] },
      { id: 'coverage', label: 'coverage', start: 412, format: 'int', vol: 0.3, drift: 0.004, clamp: [0, 900] },
      { id: 'alerts', label: 'alerts', start: 3, format: 'int', vol: 0, event: 'alert' },
    ],
    events: [
      { w: 3, t: 'pattern · ascending triangle · CBA.AX' },
      { w: 2, t: 'news → price link · r=0.71 · 40m lag' },
      { w: 2, t: 'driver attribution · rates 38% / sector 24%' },
      { w: 2, t: 'divergence flagged · volume vs. close' },
      { w: 1, t: 'backfill complete · 412 instruments' },
      { w: 1, t: 'alert suppressed · duplicate news cluster' },
    ],
  },
  {
    id: 'dop',
    name: 'Dop',
    tagline: 'iOS vlog and storyboard app — SwiftUI with AI shot planning',
    status: 'beta · TestFlight',
    stack: ['SwiftUI', 'CoreML', 'CloudKit'],
    chart: { type: 'bars', label: 'planned shot duration', unit: 'sec', baseline: 3.2, vol: 0.22, drift: 0, bars: 20 },
    kpis: [
      { id: 'boards', label: 'storyboards', start: 12, format: 'int', vol: 0, event: 'board' },
      { id: 'shots', label: 'shots', start: 184, format: 'int', vol: 0.4, drift: 0.006 },
      { id: 'clip', label: 'avg clip', start: 3.4, format: 'dec1', vol: 0.01, drift: 0, clamp: [0.8, 9] },
      { id: 'accepted', label: 'accepted', start: 78, format: 'pct', vol: 0.15, drift: 0.0002, clamp: [40, 96] },
    ],
    events: [
      { w: 3, t: 'shot plan generated · 8 beats · 24 shots' },
      { w: 2, t: 'b-roll suggested · 3 cutaways' },
      { w: 2, t: 'pacing model trimmed 1.2s from beat 5' },
      { w: 2, t: 'storyboard synced · CloudKit' },
      { w: 1, t: 'suggestion accepted · golden-hour slot' },
      { w: 1, t: 'suggestion rejected · shot too tight' },
    ],
  },
  {
    id: 'tap',
    name: 'tap-ios',
    tagline: 'Talk And Pause — an iOS keyboard that types while you think',
    status: 'in development',
    stack: ['Swift', 'Speech', 'KeyboardKit'],
    chart: { type: 'line', label: 'inter-key interval', unit: 'ms', baseline: 180, vol: 0.14, drift: 0, seriesCount: 2 },
    kpis: [
      { id: 'wpm', label: 'wpm', start: 72, format: 'int', vol: 0.5, drift: 0.004, clamp: [20, 140] },
      { id: 'pauses', label: 'pauses', start: 38, format: 'int', vol: 0, event: 'pause' },
      { id: 'accuracy', label: 'accuracy', start: 97.2, format: 'pctOne', vol: 0.03, drift: 0.0001, clamp: [88, 99.8] },
      { id: 'sessions', label: 'sessions', start: 126, format: 'int', vol: 0.2, drift: 0.002 },
    ],
    events: [
      { w: 3, t: 'pause detected · 1.8s · composing' },
      { w: 2, t: 'dictation committed · 14 words' },
      { w: 2, t: 'cadence model adapted · burst threshold 240ms' },
      { w: 2, t: 'correction · "there" → "their"' },
      { w: 1, t: 'keyboard installed · full access off' },
      { w: 1, t: 'session ended · 312 words · 0 backtracks' },
    ],
  },
];

export const projectById = (id) => PROJECTS.find((p) => p.id === id) ?? null;
