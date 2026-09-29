/**
 * Site orchestrator.
 *
 * Boot order matters: content is rendered from data first (so the graph and the
 * document agree), then the scroll engine exists (everything measures against
 * it), then the 3D scene, then the UI that talks to it.
 *
 * Every subsystem is wrapped so one failing library cannot take the page down —
 * a real risk when six animation runtimes share a document. Failures land on
 * `window.__siteErrors` instead of throwing.
 */
import './styles.css';

import { one, all } from './lib/prefs.js';
import { initScroll, ScrollTrigger } from './lib/scroll.js';
import { renderContent } from './modules/content.js';

const errors = [];
window.__siteErrors = errors;

function boot(name, fn) {
  try {
    return fn();
  } catch (error) {
    errors.push({ name, error: String(error?.message || error) });
    console.error(`[site] "${name}" failed:`, error);
    return null;
  }
}

async function bootAsync(name, fn) {
  try {
    return await fn();
  } catch (error) {
    errors.push({ name, error: String(error?.message || error) });
    console.error(`[site] "${name}" failed:`, error);
    return null;
  }
}

/* ── Loader ──────────────────────────────────────────────────── */

function setupLoader() {
  const loader = one('#loader');
  const bar = one('#loaderBar');
  if (bar) requestAnimationFrame(() => { bar.style.width = '70%'; });

  const remove = () => {
    if (bar) bar.style.width = '100%';
    window.setTimeout(() => {
      loader?.classList.add('done');
      window.setTimeout(() => loader?.remove(), 700);
    }, 260);
  };

  if (document.readyState === 'complete') remove();
  else window.addEventListener('load', remove, { once: true });
  window.setTimeout(remove, 3200);
}

/* ── Boot ────────────────────────────────────────────────────── */

async function start() {
  setupLoader();

  const year = one('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  // 1. Content first — the document and the 3D graph read the same data.
  boot('content', () => renderContent());

  // 2. Scroll engine, before anything registers a trigger against it.
  boot('scroll', () => initScroll({ navHeight: 72 }));

  // 3. The scene. Heavy, so it comes in behind a guard.
  const canvas = one('#scene');
  const labelLayer = one('#sceneLabels');
  const { createScene } = await bootAsync('sceneImport', () => import('./scene/index.js')) ?? {};
  const scene = createScene && canvas ? boot('scene', () => createScene(canvas, { labelLayer })) : null;

  // 4. UI shell talks to the scene in both directions.
  const { initUI } = await import('./modules/ui.js');
  const ui = boot('ui', () => initUI({ scene }));

  // 5. Scroll-driven chapters.
  const { initHeroFlight } = await import('./modules/hero-flight.js');
  boot('heroFlight', () => initHeroFlight(scene, ui));

  // Reveals are registered after content render so every card is observed.
  const { initReveals } = await import('./modules/reveals.js');
  boot('reveals', () => initReveals());

  // The FOUC guard can stand down: reveals are live and will resolve.
  window.__siteReady = true;

  // 6. Interaction + secondary modules.
  const [{ initInteractions }, { initCapFilter }] = await Promise.all([
    import('./modules/interactions.js'),
    import('./modules/cap-filter.js'),
  ]);

  boot('interactions', () => initInteractions());
  boot('capFilter', () => initCapFilter());

  // 7. Keep measurements honest after fonts and images settle.
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => window.setTimeout(() => ScrollTrigger.refresh(), 60));
  }
  window.addEventListener('load', () => window.setTimeout(() => ScrollTrigger.refresh(), 60));

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => ScrollTrigger.refresh(), 220);
  }, { passive: true });

  // The HUD appears only once the scene is actually running.
  window.setTimeout(() => one('#hud')?.classList.add('ready'), 900);

  if (errors.length) console.warn(`[site] ${errors.length} subsystem(s) degraded:`, errors);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    all('.reveal').forEach((el) => {
      el.style.opacity = '';
      el.style.transform = '';
    });
  });
}
