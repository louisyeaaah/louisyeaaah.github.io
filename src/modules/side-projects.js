/**
 * Side projects — live telemetry panels.
 *
 * Everything here is generated in the browser. No backend, no connection to
 * the real projects; the simulation is a seeded random walk per metric plus a
 * weighted event vocabularly. The chrome says "simulated" out loud, which is
 * both honest and, on a portfolio, the more professional choice.
 *
 * One rAF loop drives whichever panel is active, and it stops entirely when
 * the section scrolls away.
 */
import { PROJECTS } from '../data/projects.js';
import { createLiveChart } from '../lib/live-chart.js';
import { all, one, prefersReducedMotion, whenVisible } from '../lib/prefs.js';

const FORMATTERS = {
  usd: (v) => `$${Math.round(v).toLocaleString('en-US')}`,
  pct: (v) => `${v.toFixed(1)}%`,
  pctOne: (v) => `${v.toFixed(1)}%`,
  pctSigned: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`,
  int: (v) => String(Math.round(v)),
  dec1: (v) => v.toFixed(1),
  dec2: (v) => v.toFixed(2),
};

const clockTime = (offsetSeconds = 0) => {
  const d = new Date(Date.now() - offsetSeconds * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
};

/* ── simulation ──────────────────────────────────────────────── */

function createSim(project) {
  const state = project.kpis.map((kpi) => ({ ...kpi, value: kpi.start, countdown: 0 }));
  const chart = { ...project.chart, series: [] };

  /** One chart sample, shaped for the panel's render mode. */
  function nextSample() {
    // History can be empty on the very first call, so every branch has to
    // fall back to the configured baseline.
    const prev = chart.series.at(-1);
    const base = prev === undefined ? chart.baseline
      : typeof prev === 'number' ? prev
      : chart.type === 'candles' ? prev.c
      : chart.type === 'line' ? (prev.values?.[0] ?? chart.baseline)
      : prev.v ?? chart.baseline;

    const step = () => (Math.random() - 0.5) * 2 * chart.vol * Math.abs(base || chart.baseline || 1);

    if (chart.type === 'candles') {
      const open = base;
      const close = open + step() + (chart.drift || 0) * base;
      const spread = Math.abs(step()) * 0.9;
      return {
        o: open,
        c: close,
        h: Math.max(open, close) + spread,
        l: Math.min(open, close) - spread,
      };
    }

    if (chart.type === 'line') {
      const count = chart.seriesCount || 2;
      return {
        values: [
          base + step() + (chart.drift || 0) * base,
          (prev?.values?.[1] ?? chart.baseline * 1.35) + (Math.random() - 0.5) * 2 * chart.vol * chart.baseline,
        ].slice(0, count),
      };
    }

    return { v: base + step() + (chart.drift || 0) * (base || chart.baseline) };
  }

  /** Advance the headline metrics; returns an event key if one fired. */
  function tick(dt) {
    let fired = null;
    state.forEach((kpi) => {
      if (kpi.event) {
        kpi.countdown -= dt;
        if (kpi.countdown <= 0) {
          kpi.countdown = 4 + Math.random() * 11;
          kpi.value += 1;
          fired = fired ?? kpi.event;
        }
        return;
      }
      const drift = (kpi.drift || 0) * kpi.value;
      const noise = (Math.random() - 0.5) * 2 * kpi.vol * Math.abs(kpi.value || 1) * 0.1;
      kpi.value += drift + noise;
      if (kpi.clamp) kpi.value = Math.min(Math.max(kpi.value, kpi.clamp[0]), kpi.clamp[1]);
    });
    return fired;
  }

  return { state, chart, nextSample, tick };
}

/* ── module ──────────────────────────────────────────────────── */

export function initSideProjects() {
  const root = one('#projects');
  if (!root) return null;

  const list = one('#projectList');
  const panel = one('#projectPanel');
  if (!list || !panel) return null;

  let activeId = PROJECTS[0].id;
  let sim = null;
  let chart = null;
  let rafId = null;
  let running = false;
  let visible = false;
  let last = 0;
  let sampleClock = 0;
  let eventClock = 0;
  let eventBag = [];
  let paused = false;

  /* — the project rail — */
  list.innerHTML = PROJECTS.map((project) => `
    <button type="button" class="proj-item" data-project="${project.id}" aria-pressed="false">
      <span class="proj-name">${project.name}</span>
      <span class="proj-tagline">${project.tagline}</span>
      <span class="proj-status mono">${project.status}</span>
    </button>
  `).join('');

  /* — panel chrome, rebuilt per project — */
  function renderPanel(project) {
    panel.innerHTML = `
      <header class="proj-head">
        <div class="proj-head-main">
          <h3 class="proj-title">${project.name}</h3>
          <p class="proj-sub">${project.tagline}</p>
        </div>
        <div class="proj-head-meta">
          <span class="proj-live mono"><i></i>live</span>
          <span class="proj-sim mono" title="This dashboard is a browser-side simulation">simulated demo</span>
        </div>
      </header>

      <dl class="proj-kpis">
        ${project.kpis.map((kpi) => `
          <div class="proj-kpi">
            <dt class="mono">${kpi.label}</dt>
            <dd id="kpi-${project.id}-${kpi.id}" class="mono">—</dd>
          </div>`).join('')}
      </dl>

      <div class="proj-chart-wrap">
        <div class="proj-chart-head">
          <span class="mono">${project.chart.label}</span>
          <div class="proj-range" role="group" aria-label="Chart window">
            <button type="button" class="proj-range-btn" data-range="60" aria-pressed="false">1H</button>
            <button type="button" class="proj-range-btn is-active" data-range="120" aria-pressed="true">1D</button>
            <button type="button" class="proj-range-btn" data-range="260" aria-pressed="false">1W</button>
          </div>
        </div>
        <canvas class="proj-chart" id="projectChart" aria-label="${project.chart.label} chart"></canvas>
      </div>

      <div class="proj-log">
        <div class="proj-log-head mono">
          <span>event log</span>
          <button type="button" class="proj-pause mono" id="projectPause" aria-pressed="false">pause</button>
        </div>
        <ul class="proj-log-list" id="projectLog"></ul>
      </div>

      <footer class="proj-foot mono">
        ${project.stack.map((s) => `<span>${s}</span>`).join('')}
      </footer>
    `;
  }

  /* — selection — */
  function select(id) {
    const project = PROJECTS.find((p) => p.id === id);
    if (!project) return;
    activeId = id;

    all('.proj-item', list).forEach((el) => {
      const on = el.dataset.project === id;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-pressed', String(on));
    });

    renderPanel(project);
    sim = createSim(project);
    eventBag = [];

    const canvas = one('#projectChart');
    chart = createLiveChart(canvas, {
      type: project.chart.type,
      bipolar: project.chart.bipolar,
      range: 120,
      capacity: 400,
      axisFormat: (v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(Math.abs(v) < 10 ? 1 : 0)),
      readout: (s) => (typeof s === 'number' ? s.toFixed(2) : s.v !== undefined ? s.v.toFixed(2) : s.c.toFixed(2)),
    });

    chart.resize();
    // A screenful of history so the panel never opens empty.
    for (let i = 0; i < 260; i += 1) sim.chart.series.push(sim.nextSample());
    sim.chart.series.forEach((s) => chart.push(s));

    bindChartControls(project);
    paintKpis();
    seedLog(project);
    chart.draw();
  }

  function bindChartControls(project) {
    all('.proj-range-btn', panel).forEach((btn) => {
      btn.addEventListener('click', () => {
        all('.proj-range-btn', panel).forEach((b) => {
          const on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', String(on));
        });
        chart?.setRange(Number(btn.dataset.range));
        chart?.draw();
      });
    });

    const pause = one('#projectPause');
    pause?.addEventListener('click', () => {
      paused = !paused;
      pause.textContent = paused ? 'resume' : 'pause';
      pause.setAttribute('aria-pressed', String(paused));
      panel.classList.toggle('is-paused', paused);
    });

    const canvas = one('#projectChart');
    canvas?.addEventListener('pointermove', (event) => {
      const rect = canvas.getBoundingClientRect();
      chart?.setPointer(event.clientX - rect.left, event.clientY - rect.top);
    });
    canvas?.addEventListener('pointerleave', () => {
      chart?.setPointer(null);
      chart?.draw();
    });
  }

  function paintKpis() {
    const project = PROJECTS.find((p) => p.id === activeId);
    if (!project || !sim) return;
    sim.state.forEach((kpi) => {
      const el = one(`#kpi-${project.id}-${kpi.id}`);
      if (!el) return;
      const next = (FORMATTERS[kpi.format] || String)(kpi.value);
      if (el.textContent !== next) el.textContent = next;
    });
  }

  function pushEvent(text) {
    const log = one('#projectLog');
    if (!log) return;
    const li = document.createElement('li');
    li.className = 'proj-log-item';
    li.innerHTML = `
      <span class="proj-log-time mono">${clockTime()}</span>
      <span class="proj-log-text">${text}</span>
    `;
    log.prepend(li);
    while (log.children.length > 7) log.lastElementChild.remove();
    li.animate?.(
      [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }],
      { duration: 320, easing: 'cubic-bezier(.165,.84,.44,1)' },
    );
  }

  /** Weighted event pick, without immediately repeating the last one. */
  function seedLog(project) {
    const bag = [];
    project.events.forEach((event) => {
      for (let i = 0; i < event.w; i += 1) bag.push(event.t);
    });
    eventBag = bag;
    const log = one('#projectLog');
    if (log) log.innerHTML = '';
    for (let i = 4; i >= 1; i -= 1) {
      const text = bag[Math.floor(Math.random() * bag.length)];
      const li = document.createElement('li');
      li.className = 'proj-log-item';
      li.innerHTML = `
        <span class="proj-log-time mono">${clockTime(i * 47)}</span>
        <span class="proj-log-text">${text}</span>
      `;
      one('#projectLog')?.appendChild(li);
    }
  }

  /* — the live loop — */
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    if (!paused && sim && chart) {
      sim.tick(dt);

      sampleClock += dt;
      if (sampleClock > 0.55) {
        sampleClock = 0;
        const sample = sim.nextSample();
        sim.chart.series.push(sample);
        if (sim.chart.series.length > 400) sim.chart.series.shift();
        chart.push(sample);
      }

      eventClock += dt;
      if (eventClock > 2.6) {
        eventClock = 0;
        if (eventBag.length) pushEvent(eventBag[Math.floor(Math.random() * eventBag.length)]);
      }

      paintKpis();
      chart.draw();
    }

    if (running) rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (running || !visible) return;
    running = true;
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  list.addEventListener('click', (event) => {
    const btn = event.target.closest('.proj-item');
    if (btn) select(btn.dataset.project);
  });

  // Keyboard: arrow keys walk the rail.
  list.addEventListener('keydown', (event) => {
    if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const items = all('.proj-item', list);
    const index = items.indexOf(document.activeElement);
    if (index === -1) return;
    event.preventDefault();
    const next = event.key === 'ArrowDown'
      ? (index + 1) % items.length
      : (index - 1 + items.length) % items.length;
    items[next].focus();
    items[next].click();
  });

  select(activeId);

  // Only simulate while the section is on screen.
  whenVisible(root, () => { visible = true; start(); }, { rootMargin: '200px', once: false });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !document.hidden) start();
      else stop();
    }, { threshold: 0 }).observe(root);
  } else {
    visible = true;
    start();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (visible) start();
  });

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      chart?.resize();
      chart?.draw();
    }, 180);
  }, { passive: true });

  if (prefersReducedMotion) {
    // Render one frame and leave it — no ticking numbers, no log churn.
    paintKpis();
    chart?.draw();
    stop();
  }

  return { destroy: stop, select };
}
