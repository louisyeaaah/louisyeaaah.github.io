/**
 * Side projects — interactive product demos.
 *
 * Two renderers behind one shell:
 *   • dashboards  live-simulated telemetry on a hand-rolled canvas chart
 *   • phones      a tappable iPhone frame running a mock SwiftUI app
 *
 * Everything is generated in the browser. No backend, nothing connected to the
 * real projects, and the chrome says so out loud.
 */
import { PROJECTS } from '../data/projects.js';
import { createLiveChart } from '../lib/live-chart.js';
import { all, one, prefersReducedMotion } from '../lib/prefs.js';

const FORMATTERS = {
  usd: (v) => `$${Math.round(v).toLocaleString('en-US')}`,
  pct: (v) => `${v.toFixed(1)}%`,
  pctOne: (v) => `${v.toFixed(1)}%`,
  pctSigned: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`,
  int: (v) => String(Math.round(v)),
  dec1: (v) => v.toFixed(1),
  dec2: (v) => v.toFixed(2),
};

const clockTime = (offset = 0) => {
  const d = new Date(Date.now() - offset * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const esc = (v) =>
  String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ── telemetry simulation (dashboards only) ──────────────────── */

function createSim(project) {
  const state = project.kpis.map((kpi) => ({ ...kpi, value: kpi.start, countdown: 0 }));
  const chart = { ...project.chart, series: [] };

  function nextSample() {
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
      return { o: open, c: close, h: Math.max(open, close) + spread, l: Math.min(open, close) - spread };
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

  function tick() {
    state.forEach((kpi) => {
      if (kpi.event) {
        kpi.countdown -= 0.016;
        if (kpi.countdown <= 0) {
          kpi.countdown = 4 + Math.random() * 11;
          kpi.value += 1;
        }
        return;
      }
      kpi.value += (kpi.drift || 0) * kpi.value
        + (Math.random() - 0.5) * 2 * kpi.vol * Math.abs(kpi.value || 1) * 0.1;
      if (kpi.clamp) kpi.value = Math.min(Math.max(kpi.value, kpi.clamp[0]), kpi.clamp[1]);
    });
  }

  return { state, chart, nextSample, tick };
}

/* ── module ──────────────────────────────────────────────────── */

export function initSideProjects() {
  const root = one('#projects');
  const list = one('#projectList');
  const panel = one('#projectPanel');
  if (!root || !list || !panel) return null;

  let activeId = PROJECTS[0].id;
  let kind = 'dashboard';
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

  /* — rail — */
  list.innerHTML = PROJECTS.map((project) => `
    <button type="button" class="proj-item" data-project="${project.id}" aria-pressed="false">
      <span class="proj-name">${esc(project.name)}</span>
      <span class="proj-tagline">${esc(project.tagline)}</span>
      <span class="proj-status mono">${esc(project.status)}</span>
    </button>
  `).join('');

  const shellHead = (project, extra = '') => `
    <header class="proj-head">
      <div class="proj-head-main">
        <h3 class="proj-title">${esc(project.name)}</h3>
        <p class="proj-sub">${esc(project.tagline)}</p>
      </div>
      <div class="proj-head-meta">${extra}
        <span class="proj-sim mono" title="Everything here runs in your browser">simulated demo</span>
      </div>
    </header>`;

  const stackFoot = (project) => `
    <footer class="proj-foot mono">
      ${project.stack.map((s) => `<span>${esc(s)}</span>`).join('')}
    </footer>`;

  /* ══════════════ dashboard renderer ══════════════ */

  function renderDashboard(project) {
    panel.innerHTML = `
      ${shellHead(project, '<span class="proj-live mono"><i></i>live</span>')}

      <dl class="proj-kpis">
        ${project.kpis.map((kpi) => `
          <div class="proj-kpi">
            <dt class="mono">${esc(kpi.label)}</dt>
            <dd id="kpi-${project.id}-${kpi.id}" class="mono">—</dd>
          </div>`).join('')}
      </dl>

      <div class="proj-chart-wrap">
        <div class="proj-chart-head">
          <span class="mono">${esc(project.chart.label)}</span>
          <div class="proj-range" role="group" aria-label="Chart window">
            <button type="button" class="proj-range-btn" data-range="60" aria-pressed="false">1H</button>
            <button type="button" class="proj-range-btn is-active" data-range="120" aria-pressed="true">1D</button>
            <button type="button" class="proj-range-btn" data-range="260" aria-pressed="false">1W</button>
          </div>
        </div>
        <canvas class="proj-chart" id="projectChart" aria-label="${esc(project.chart.label)} chart"></canvas>
      </div>

      <div class="proj-log">
        <div class="proj-log-head mono">
          <span>event log</span>
          <button type="button" class="proj-pause mono" id="projectPause" aria-pressed="false">pause</button>
        </div>
        <ul class="proj-log-list" id="projectLog"></ul>
      </div>
      ${stackFoot(project)}
    `;
  }

  function seedEvents(project) {
    const bag = [];
    project.events.forEach((event) => { for (let i = 0; i < event.w; i += 1) bag.push(event.t); });
    eventBag = bag;

    const log = one('#projectLog');
    if (!log) return;
    log.innerHTML = '';
    for (let i = 4; i >= 1; i -= 1) {
      const li = document.createElement('li');
      li.className = 'proj-log-item';
      li.innerHTML = `<span class="proj-log-time mono">${clockTime(i * 47)}</span>
        <span class="proj-log-text">${esc(bag[Math.floor(Math.random() * bag.length)])}</span>`;
      log.appendChild(li);
    }
  }

  function pushEvent(text) {
    const log = one('#projectLog');
    if (!log) return;
    const li = document.createElement('li');
    li.className = 'proj-log-item';
    li.innerHTML = `<span class="proj-log-time mono">${clockTime()}</span>
      <span class="proj-log-text">${esc(text)}</span>`;
    log.prepend(li);
    while (log.children.length > 7) log.lastElementChild.remove();
    li.animate?.(
      [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }],
      { duration: 320, easing: 'cubic-bezier(.165,.84,.44,1)' },
    );
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

  function bindDashboard(project) {
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

    const canvasEl = one('#projectChart');
    canvasEl?.addEventListener('pointermove', (event) => {
      const rect = canvasEl.getBoundingClientRect();
      chart?.setPointer(event.clientX - rect.left, event.clientY - rect.top);
    });
    canvasEl?.addEventListener('pointerleave', () => { chart?.setPointer(null); chart?.draw(); });

    chart = createLiveChart(canvasEl, {
      type: project.chart.type,
      bipolar: project.chart.bipolar,
      range: 120,
      capacity: 400,
      axisFormat: (v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(Math.abs(v) < 10 ? 1 : 0)),
      readout: (s) => (typeof s === 'number' ? s.toFixed(2) : s.v !== undefined ? s.v.toFixed(2) : s.c.toFixed(2)),
    });

    sim = createSim(project);
    for (let i = 0; i < 260; i += 1) {
      const sample = sim.nextSample();
      sim.chart.series.push(sample);
      chart.push(sample);
    }

    chart.resize();
    paintKpis();
    seedEvents(project);
    chart.draw();
  }

  /* ══════════════ phone renderer ══════════════ */

  function phoneShell(project, appHtml) {
    const p = project.phone;
    return `
      <div class="phone" data-theme="${p.theme}" style="--phone-tint:${p.tint}">
        <div class="phone-shell">
          <span class="phone-island" aria-hidden="true"></span>
          <div class="phone-screen">
            <div class="ios-status">
              <span>${esc(p.statusTime)}</span>
              <span class="ios-status-right" aria-hidden="true">
                <i class="ios-bars"></i><i class="ios-wifi"></i><i class="ios-batt"></i>
              </span>
            </div>
            ${appHtml}
          </div>
        </div>
      </div>`;
  }

  /* — Dop: a storyboard editor that plans shots on demand — */
  function renderStoryboardApp(project) {
    const p = project.phone;
    const beatRow = (beat) => `
        <span class="app-beat-main">
          <span class="app-beat-name">${esc(beat.name)}</span>
          <span class="app-beat-tone">${esc(beat.tone)}</span>
        </span>
        <span class="app-beat-num mono">${beat.shots}</span>
        <span class="app-beat-len mono">${esc(beat.len)}</span>`;

    const app = `
      <div class="app app--dop">
        <header class="app-nav"><span class="app-nav-title">${esc(p.title)}</span></header>
        <p class="app-meta mono">${esc(p.meta)}</p>

        <ul class="app-beats" id="dopBeats">
          ${p.beats.map((b) => `<li class="app-beat">${beatRow(b)}</li>`).join('')}
        </ul>

        <p class="app-hint" id="dopHint">The planner adds the coverage it thinks is missing.</p>
        <button type="button" class="app-cta" id="dopPlan">${esc(p.plan.label)}</button>
      </div>`;

    panel.innerHTML = `
      ${shellHead(project, '<span class="proj-live mono"><i></i>tappable</span>')}
      <div class="phone-stage">
        ${phoneShell(project, app)}
        <div class="phone-notes">
          <h4 class="phone-notes-title">What you&rsquo;re looking at</h4>
          <p>A storyboard editor for vlog shoots. The planner reads the beat sheet and proposes the coverage that is missing &mdash; inserts, cutaways, and a focus pull to close on.</p>
          <ul class="phone-notes-list">
            <li>Every beat carries a shot count, a runtime and a camera tone.</li>
            <li>The planner is simulated here; the real app runs CoreML on device.</li>
          </ul>
          <p class="phone-notes-hint mono">&uarr; tap &ldquo;${esc(p.plan.label)}&rdquo;</p>
        </div>
      </div>
      ${stackFoot(project)}
    `;

    const beats = one('#dopBeats');
    const hint = one('#dopHint');
    const cta = one('#dopPlan');
    let busy = false;

    cta?.addEventListener('click', () => {
      if (!busy) {
        busy = true;
        cta.classList.add('is-busy');
        cta.textContent = p.plan.working;
        if (hint) hint.textContent = 'Analysing pacing against the beat sheet&hellip;';
        all('.app-beat', beats).forEach((el) => el.classList.add('is-dim'));

        window.setTimeout(() => {
          all('.app-beat', beats).forEach((el) => el.classList.remove('is-dim'));
          p.plan.added.forEach((beat, index) => {
            const li = document.createElement('li');
            li.className = 'app-beat is-added';
            li.innerHTML = beatRow(beat);
            beats.appendChild(li);
            li.animate?.(
              [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
              { duration: 420, delay: index * 130, easing: 'cubic-bezier(.165,.84,.44,1)', fill: 'backwards' },
            );
          });
          cta.textContent = 'Reset';
          cta.classList.remove('is-busy');
          if (hint) hint.textContent = `${p.plan.added.length} shots added · 5 → 8 beats`;
        }, 900);
        return;
      }

      busy = false;
      all('.app-beat.is-added', beats).forEach((el) => el.remove());
      all('.app-beat.is-dim', beats).forEach((el) => el.classList.remove('is-dim'));
      cta.textContent = p.plan.label;
      cta.classList.remove('is-busy');
      if (hint) hint.textContent = 'The planner adds the coverage it thinks is missing.';
    });
  }

  /* — tap: a keyboard you can actually type on — */
  function renderKeyboardApp(project) {
    const p = project.phone;
    const key = (k) => `<button type="button" class="kb-key" data-key="${esc(k)}">${esc(k)}</button>`;

    const app = `
      <div class="app app--tap">
        <header class="app-nav"><span class="app-nav-title">${esc(p.title)}</span></header>

        <div class="tap-compose">
          <p class="tap-text"><span id="tapText">${esc(p.seed)}</span><i class="tap-caret"></i></p>
          <div class="tap-chip" id="tapChip">
            <span class="tap-chip-dot"></span><span id="tapChipText">listening for a pause&hellip;</span>
          </div>
        </div>

        <div class="tap-kb" id="tapKeyboard">
          ${p.rows.map((row) => `<div class="kb-row">${[...row].map(key).join('')}</div>`).join('')}
          <div class="kb-row kb-row--bottom">
            <button type="button" class="kb-key kb-key--wide" data-key=" ">space</button>
            <button type="button" class="kb-key kb-key--wide" data-key="__back">&#9003;</button>
          </div>
        </div>
      </div>`;

    panel.innerHTML = `
      ${shellHead(project, '<span class="proj-live mono"><i></i>type on it</span>')}
      <div class="phone-stage">
        ${phoneShell(project, app)}
        <div class="phone-notes">
          <h4 class="phone-notes-title">What you&rsquo;re looking at</h4>
          <p>A keyboard that keeps typing while you stop to think. It watches your cadence, and when you stall mid-sentence it commits what you said instead of dropping it.</p>
          <ul class="phone-notes-list">
            <li>Stop typing for a moment and watch the chip fire.</li>
            <li>Speech and cadence modelling are simulated here.</li>
          </ul>
          <p class="phone-notes-hint mono">&uarr; tap the keys</p>
        </div>
      </div>
      ${stackFoot(project)}
    `;

    const textEl = one('#tapText');
    const chip = one('#tapChip');
    const chipText = one('#tapChipText');
    let value = p.seed;
    let pauseTimer = null;
    let lastKeyAt = 0;
    let strokeCount = 0;

    function armPauseDetection() {
      if (pauseTimer) window.clearTimeout(pauseTimer);
      chip?.classList.remove('is-hot');
      pauseTimer = window.setTimeout(() => {
        if (performance.now() - lastKeyAt < 900) return;
        chip?.classList.add('is-hot');
        if (chipText) chipText.textContent = p.pauses[strokeCount % p.pauses.length];
      }, 950);
    }

    one('#tapKeyboard')?.addEventListener('click', (event) => {
      const btn = event.target.closest('.kb-key');
      if (!btn) return;
      const k = btn.dataset.key;

      if (k === '__back') value = value.slice(0, -1);
      else value += k;

      strokeCount += 1;
      lastKeyAt = performance.now();
      if (textEl) textEl.textContent = value;
      armPauseDetection();

      btn.animate?.(
        [{ transform: 'scale(1)' }, { transform: 'scale(0.88)' }, { transform: 'scale(1)' }],
        { duration: 160, easing: 'cubic-bezier(.165,.84,.44,1)' },
      );
    });

    armPauseDetection();
  }

  /* ══════════════ selection ══════════════ */

  function teardown() {
    running = false;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    chart?.destroy();
    chart = null;
    sim = null;
    paused = false;
    panel.classList.remove('is-paused');
  }

  function select(id) {
    const project = PROJECTS.find((p) => p.id === id);
    if (!project) return;

    teardown();
    activeId = id;
    kind = project.kind || 'dashboard';
    panel.dataset.kind = kind;

    all('.proj-item', list).forEach((el) => {
      const on = el.dataset.project === id;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-pressed', String(on));
    });

    if (kind === 'phone') {
      if (project.app === 'keyboard') renderKeyboardApp(project);
      else renderStoryboardApp(project);
      return;
    }

    renderDashboard(project);
    bindDashboard(project);
    if (visible && !prefersReducedMotion) start();
  }

  /* ══════════════ loop (dashboards only) ══════════════ */

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    if (!paused && kind === 'dashboard' && sim && chart) {
      sim.tick();

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
    if (running || !visible || kind !== 'dashboard') return;
    running = true;
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  /* ══════════════ events ══════════════ */

  list.addEventListener('click', (event) => {
    const btn = event.target.closest('.proj-item');
    if (btn) select(btn.dataset.project);
  });

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
    resizeTimer = window.setTimeout(() => { chart?.resize(); chart?.draw(); }, 180);
  }, { passive: true });

  if (prefersReducedMotion && kind === 'dashboard') {
    paintKpis();
    chart?.draw();
    stop();
  }

  return { destroy: stop, select };
}
