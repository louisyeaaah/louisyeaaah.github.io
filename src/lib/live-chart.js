/**
 * A small live chart on a 2D canvas.
 *
 * Hand-rolled on purpose. `lightweight-charts` would have been the obvious
 * pick for the trading panels, but it is ~45 KB gzip and heavily opinionated
 * about its own theme; this is ~5 KB and matches the design system exactly.
 * Four render modes cover every panel: area, candles, bars, line.
 *
 * Data is a ring buffer, so pushing a sample is O(1) and memory is flat no
 * matter how long the panel runs.
 */

const FONT = '11px "JetBrains Mono", ui-monospace, monospace';

export function createLiveChart(canvas, options = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const state = {
    type: options.type || 'area',
    capacity: options.capacity || 400,
    range: options.range || 120,      // points visible
    data: [],
    head: 0,
    count: 0,
    min: Infinity,
    max: -Infinity,
    pointer: null,
    dpr: Math.min(window.devicePixelRatio || 1, 2),
    w: 0,
    h: 0,
    padding: { t: 16, r: 12, b: 18, l: 44 },
  };

  const palette = {
    ink: '#141413',
    stone: '#87867F',
    rule: 'rgba(20,20,19,.09)',
    clay: '#D97757',
    claySoft: 'rgba(217,119,87,.14)',
    sage: '#5F9E8B',
    sky: '#6A9BCC',
    paper: '#FAF9F5',
  };

  /* ── ring buffer ─────────────────────────────────────────────── */

  function push(sample) {
    if (state.data.length < state.capacity) {
      state.data.push(sample);
    } else {
      state.data[state.head] = sample;
      state.head = (state.head + 1) % state.capacity;
    }
    state.count = Math.min(state.count + 1, state.capacity);
  }

  function seed(samples) {
    state.data = [];
    state.head = 0;
    state.count = 0;
    samples.forEach(push);
  }

  /** Visible samples, oldest -> newest. */
  function visible() {
    const n = Math.min(state.count, state.range);
    const out = new Array(n);
    for (let i = 0; i < n; i += 1) {
      // Walk backwards from the newest sample.
      let idx = (state.head - 1 - (n - 1 - i) + state.capacity * 2) % state.capacity;
      if (state.count < state.capacity) idx = state.count - n + i;
      out[i] = state.data[((idx % state.capacity) + state.capacity) % state.capacity];
    }
    return out;
  }

  /* ── value extraction per mode ───────────────────────────────── */

  function extents(samples) {
    let min = Infinity;
    let max = -Infinity;
    const consider = (v) => {
      if (typeof v !== 'number' || !Number.isFinite(v)) return;
      if (v < min) min = v;
      if (v > max) max = v;
    };

    samples.forEach((s) => {
      if (state.type === 'candles') {
        consider(s.l); consider(s.h); consider(s.c);
      } else if (state.type === 'line') {
        s.values?.forEach(consider);
        consider(s);
      } else {
        consider(typeof s === 'number' ? s : s.v);
      }
    });

    if (!Number.isFinite(min) || !Number.isFinite(max)) { min = 0; max = 1; }
    if (min === max) { min -= 1; max += 1; }

    // Bipolar bar charts must keep zero on the axis.
    if (state.type === 'bars' && options.bipolar) {
      const span = Math.max(Math.abs(min), Math.abs(max));
      min = -span; max = span;
    }

    const pad = (max - min) * 0.12;
    state.min = min - pad;
    state.max = max + pad;
    return { min: state.min, max: state.max };
  }

  /* ── geometry ────────────────────────────────────────────────── */

  const plot = () => ({
    x0: state.padding.l,
    y0: state.padding.t,
    x1: state.w - state.padding.r,
    y1: state.h - state.padding.b,
  });

  const yOf = (v, box) => box.y1 - ((v - state.min) / (state.max - state.min)) * (box.y1 - box.y0);
  const xOf = (i, n, box) => (n <= 1 ? box.x0 : box.x0 + (i / (n - 1)) * (box.x1 - box.x0));

  /* ── renderers ───────────────────────────────────────────────── */

  function drawGrid(box) {
    const lines = 4;
    ctx.save();
    ctx.strokeStyle = palette.rule;
    ctx.lineWidth = 1;
    ctx.font = FONT;
    ctx.fillStyle = palette.stone;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= lines; i += 1) {
      const t = i / lines;
      const y = Math.round(box.y0 + t * (box.y1 - box.y0)) + 0.5;
      if (i > 0 && i < lines) {
        ctx.beginPath();
        ctx.moveTo(box.x0, y);
        ctx.lineTo(box.x1, y);
        ctx.stroke();
      }
      const value = state.max - t * (state.max - state.min);
      if (value !== 0 || state.type !== 'bars') {
        ctx.fillText(options.axisFormat ? options.axisFormat(value) : value.toFixed(0), box.x0 - 8, y);
      }
    }
    ctx.restore();
  }

  function drawArea(samples, box) {
    const n = samples.length;
    if (n < 2) return;
    const pts = samples.map((s, i) => [xOf(i, n, box), yOf(typeof s === 'number' ? s : s.v, box)]);

    // Functional gradient: encodes magnitude toward the baseline.
    const grad = ctx.createLinearGradient(0, box.y0, 0, box.y1);
    grad.addColorStop(0, palette.claySoft);
    grad.addColorStop(1, 'rgba(217,119,87,0)');

    ctx.beginPath();
    ctx.moveTo(pts[0][0], box.y1);
    pts.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(pts[n - 1][0], box.y1);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = palette.clay;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.stroke();

    liveDot(pts[n - 1], palette.clay);
  }

  function drawLine(samples, box) {
    const n = samples.length;
    if (n < 2) return;
    const seriesCount = Array.isArray(samples[0]?.values) ? samples[0].values.length : 1;
    const colors = [palette.ink, palette.sky, palette.clay];

    for (let s = 0; s < seriesCount; s += 1) {
      const pts = samples.map((sample, i) => {
        const v = seriesCount > 1
        ? (sample.values?.[s] ?? sample.values?.[0] ?? 0)
        : (typeof sample === 'number' ? sample : sample.v ?? 0);
        return [xOf(i, n, box), yOf(v, box)];
      });
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = colors[s % colors.length];
      ctx.lineWidth = s === 0 ? 1.6 : 1.2;
      ctx.globalAlpha = s === 0 ? 1 : 0.7;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (s === 0) liveDot(pts[n - 1], colors[0]);
    }
  }

  function drawCandles(samples, box) {
    const n = samples.length;
    if (!n) return;
    const slot = (box.x1 - box.x0) / n;
    const body = Math.max(1.5, Math.min(slot * 0.62, 9));

    samples.forEach((s, i) => {
      const x = box.x0 + (i + 0.5) * slot;
      const up = s.c >= s.o;
      const color = up ? palette.sage : palette.clay;

      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, yOf(s.h, box));
      ctx.lineTo(x, yOf(s.l, box));
      ctx.stroke();

      const yo = yOf(s.o, box);
      const yc = yOf(s.c, box);
      const top = Math.min(yo, yc);
      const height = Math.max(Math.abs(yc - yo), 1);
      ctx.fillStyle = color;
      ctx.fillRect(x - body / 2, top, body, height);
    });
  }

  function drawBars(samples, box) {
    const n = samples.length;
    if (!n) return;
    const slot = (box.x1 - box.x0) / n;
    const bar = Math.max(2, Math.min(slot * 0.58, 16));
    const zero = yOf(0, box);

    samples.forEach((s, i) => {
      const v = typeof s === 'number' ? s : s.v;
      const x = box.x0 + (i + 0.5) * slot;
      const y = yOf(v, box);
      const positive = v >= 0;
      ctx.fillStyle = positive ? palette.sage : palette.clay;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x - bar / 2, Math.min(y, zero), bar, Math.max(Math.abs(y - zero), 1));
      ctx.globalAlpha = 1;
    });
  }

  function liveDot([x, y], color) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.16;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 2.4, 0, Math.PI * 2);
    ctx.globalAlpha = 1;
    ctx.fill();
    ctx.restore();
  }

  /* ── crosshair ───────────────────────────────────────────────── */

  function drawCrosshair(box, samples) {
    const p = state.pointer;
    if (!p || !samples.length) return;
    if (p.x < box.x0 || p.x > box.x1) return;

    const n = samples.length;
    const t = (p.x - box.x0) / Math.max(box.x1 - box.x0, 1);
    const index = Math.max(0, Math.min(n - 1, Math.round(t * (n - 1))));
    const sample = samples[index];
    const value = state.type === 'candles' ? (sample.c ?? sample.close ?? 0)
      : state.type === 'line' ? (sample.values?.[0] ?? 0)
      : (typeof sample === 'number' ? sample : sample.v ?? 0);

    const x = xOf(index, n, box);
    const y = yOf(value, box);

    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = 'rgba(20,20,19,.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, box.y0);
    ctx.lineTo(x, box.y1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(box.x0, y);
    ctx.lineTo(box.x1, y);
    ctx.stroke();
    ctx.restore();

    // Read-out chip, flipped to stay inside the plot.
    const label = options.readout ? options.readout(sample) : value.toFixed(2);
    ctx.save();
    ctx.font = FONT;
    const w = ctx.measureText(label).width + 14;
    const bx = Math.min(x + 8, box.x1 - w);
    const by = Math.max(y - 11, box.y0 + 2);
    ctx.fillStyle = palette.ink;
    ctx.fillRect(bx, by, w, 20);
    ctx.fillStyle = palette.paper;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + 7, by + 10);
    ctx.restore();
  }

  /* ── public draw ─────────────────────────────────────────────── */

  function draw() {
    if (!state.w || !state.h) return;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.clearRect(0, 0, state.w, state.h);

    const samples = visible();
    if (!samples.length) return;
    extents(samples);
    const box = plot();

    drawGrid(box);
    if (state.type === 'candles') drawCandles(samples, box);
    else if (state.type === 'bars') drawBars(samples, box);
    else if (state.type === 'line') drawLine(samples, box);
    else drawArea(samples, box);

    drawCrosshair(box, samples);
  }

  /* ── sizing ──────────────────────────────────────────────────── */

  function resize() {
    const rect = canvas.getBoundingClientRect();
    state.w = Math.max(rect.width, 1);
    state.h = Math.max(rect.height, 1);
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(state.w * state.dpr);
    canvas.height = Math.round(state.h * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  }

  function setPointer(x, y) {
    state.pointer = x === null ? null : { x, y };
  }

  function destroy() {
    state.data = [];
  }

  return {
    push,
    seed,
    draw,
    resize,
    setPointer,
    destroy,
    setType(t) { state.type = t; },
    setRange(r) { state.range = r; },
    get range() { return state.range; },
    get type() { return state.type; },
    get latest() {
      if (!state.count) return null;
      return state.data[((state.head - 1) + state.capacity) % state.capacity];
    },
  };
}
