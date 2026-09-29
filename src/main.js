/**
 * Site orchestrator.
 *
 * Every subsystem is booted through `boot()` so a failure in one library can
 * never take the rest of the page down with it — a real risk when six
 * animation runtimes share a document. Each failure is surfaced in the console
 * (and collected on `window.__siteErrors`) instead of throwing.
 *
 * Boot order matters:
 *   1. scroll engine first (Lenis + ScrollTrigger), everything else measures
 *      against the scroll it establishes
 *   2. reveals / scroll effects (register triggers)
 *   3. UI chrome + pointer interactions
 *   4. heavy optional media (WebGL hero, tsParticles) — lazily
 */
import './styles.css';

import { initScroll, ScrollTrigger } from './lib/scroll.js';
import { all, one, prefersReducedMotion } from './lib/prefs.js';

const errors = [];
window.__siteErrors = errors;

function boot(name, fn) {
  try {
    return fn();
  } catch (error) {
    errors.push({ name, error: String(error?.message || error) });
    console.error(`[site] "${name}" failed to initialise:`, error);
    return null;
  }
}

async function bootAsync(name, fn) {
  try {
    return await fn();
  } catch (error) {
    errors.push({ name, error: String(error?.message || error) });
    console.error(`[site] "${name}" failed to initialise:`, error);
    return null;
  }
}

/* ── Preloader ───────────────────────────────────────────────── */

function setupLoader() {
  const loader = one('#loader');
  if (!loader) return;

  const remove = () => {
    loader.classList.add('done');
    window.setTimeout(() => loader.remove(), 700);
  };

  if (document.readyState === 'complete') window.setTimeout(remove, 260);
  else window.addEventListener('load', () => window.setTimeout(remove, 320));

  // Safety net: never leave the visitor staring at a loader.
  window.setTimeout(remove, 2800);
}

/* ── Footer year ─────────────────────────────────────────────── */

function setupYear() {
  const year = one('#year');
  if (year) year.textContent = String(new Date().getFullYear());
}

/* ── Boot ────────────────────────────────────────────────────── */

async function start() {
  setupLoader();
  setupYear();

  // Make the console state explicit for anyone inspecting the page.
  console.info(
    '%cZhipeng (Louis) Ye %c portfolio',
    'color:#a855f7;font-weight:600',
    'color:#8b94ab',
  );

  // 1. Scroll engine — must exist before anything registers triggers.
  const scroll = boot('scroll', () => initScroll({ navHeight: 68 }));

  // 2. Animation modules (static imports: they are cheap and above the fold).
  const [{ initReveals }, { initScrollFx }] = await Promise.all([
    import('./modules/reveals.js'),
    import('./modules/scroll-fx.js'),
  ]);

  boot('reveals', () => initReveals());
  boot('scrollFx', () => initScrollFx());

  // The FOUC guard can now stand down: reveals are registered and will
  // resolve. Without this, a slow module load would keep content hidden.
  window.__siteReady = true;

  // 3. Interaction + UI modules.
  const [
    { initNav },
    { initInteractions },
    { initSkillFilter },
    { initDiagram },
  ] = await Promise.all([
    import('./modules/nav.js'),
    import('./modules/interactions.js'),
    import('./modules/skills-filter.js'),
    import('./modules/diagram.js'),
  ]);

  const nav = boot('nav', () => initNav());
  boot('interactions', () => initInteractions());
  boot('skillsFilter', () => initSkillFilter());
  boot('diagram', () => initDiagram());

  // 4. Media modules — lazy, and skipped entirely where they'd be waste.
  const { initHero } = await import('./modules/hero.js');
  boot('hero', () => initHero(one('#heroCanvas')));

  const { initContactParticles } = await import('./modules/particles.js');
  boot('contactParticles', () => initContactParticles());

  // Vector assets are loaded only if their slots exist in the DOM.
  if (one('[data-lottie-slot]') || one('[data-rive-slot]')) {
    const { initVectorAssets } = await bootAsync('vectorAssetsImport', () =>
      import('./modules/vector-assets.js'),
    );
    if (initVectorAssets) {
      await bootAsync('vectorAssets', () => initVectorAssets());
    }
  }

  // 5. Keep everything honest after layout shifts.
  const refresh = () => {
    ScrollTrigger.refresh();
    nav?.refreshIndicator?.();
  };

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => window.setTimeout(refresh, 60));
  }

  let resizeTimer = null;
  window.addEventListener(
    'resize',
    () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(refresh, 240);
    },
    { passive: true },
  );

  // Reveal the loader removal only after the first paint of the hero.
  document.documentElement.dataset.ready = 'true';

  if (errors.length) {
    console.warn(`[site] ${errors.length} subsystem(s) degraded:`, errors);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}

/**
 * Vite HMR: tear the page down cleanly between edits so ScrollTriggers and
 * animation loops don't stack up during development.
 */
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    all('.reveal').forEach((el) => {
      el.style.opacity = '';
      el.style.transform = '';
    });
  });
}
