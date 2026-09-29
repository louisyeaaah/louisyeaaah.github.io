/**
 * Side projects, rendered as interactive product demos.
 *
 * Two kinds of panel:
 *   kind: 'dashboard'  live telemetry for the data-shaped projects
 *   kind: 'phone'      a tappable iPhone simulator running a mock app UI
 *
 * Every number and every screen is generated in the browser. There is no
 * backend and nothing connects to the real projects; the chrome says so.
 */

export const PROJECTS = [
  /* ── dashboards ──────────────────────────────────────────────── */
  {
    id: 'hypora',
    kind: 'dashboard',
    name: 'hypora',
    tagline: 'AI quant lab — factor research and strategy search',
    status: 'research',
    stack: ['Python', 'Polars', 'MLflow'],
    chart: { type: 'bars', label: 'factor information coefficient', unit: 'IC', baseline: 0, vol: 0.16, drift: 0, bipolar: true },
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
    kind: 'dashboard',
    name: 'stockpulse',
    tagline: 'K-line pattern recognition, news-price correlation, multi-stock driver analysis',
    status: 'prototype',
    stack: ['Python', 'FastAPI', 'Next.js'],
    chart: { type: 'candles', label: 'price · 5m bars', unit: 'AUD', baseline: 41.2, vol: 0.006, drift: 0.0002 },
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

  /* ── phone simulators ────────────────────────────────────────── */
  {
    id: 'dop',
    kind: 'phone',
    app: 'storyboard',
    name: 'Dop',
    tagline: 'iOS vlog and storyboard app — SwiftUI with AI shot planning',
    status: 'beta · TestFlight',
    stack: ['SwiftUI', 'CoreML', 'CloudKit'],
    phone: {
      theme: 'dark',
      tint: '#D97757',
      statusTime: '9:41',
      title: 'Morning in Surry Hills',
      meta: '8 beats · 24 shots · 1:48',
      beats: [
        { name: 'Cold open — balcony', shots: 3, len: '0:12', tone: 'wide' },
        { name: 'Coffee, close', shots: 4, len: '0:19', tone: 'macro' },
        { name: 'Walk to the studio', shots: 5, len: '0:26', tone: 'handheld' },
        { name: 'Desk setup', shots: 4, len: '0:22', tone: 'locked' },
        { name: 'B-roll — street', shots: 5, len: '0:18', tone: 'cutaway' },
      ],
      plan: {
        label: 'Generate shot plan',
        working: 'Reading the beat sheet…',
        added: [
          { name: 'Insert — steam off cup', shots: 2, len: '0:07', tone: 'macro' },
          { name: 'Cutaway — tram passing', shots: 2, len: '0:09', tone: 'cutaway' },
          { name: 'Outro — pull focus', shots: 1, len: '0:06', tone: 'rack' },
        ],
      },
    },
  },
  {
    id: 'tap',
    kind: 'phone',
    app: 'keyboard',
    name: 'tap-ios',
    tagline: 'Talk And Pause — an iOS keyboard that types while you think',
    status: 'in development',
    stack: ['Swift', 'Speech', 'KeyboardKit'],
    phone: {
      theme: 'light',
      tint: '#6A9BCC',
      statusTime: '9:41',
      title: 'Messages',
      seed: 'Let me check the',
      rows: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'],
      pauses: [
        'pause detected · 1.4s · composing',
        'dictation committed · 6 words',
        'cadence model adapted · burst 240ms',
      ],
    },
  },
];

export const projectById = (id) => PROJECTS.find((p) => p.id === id) ?? null;
