/**
 * Animation lab — every candidate library wired up and running for real.
 *
 * This page is the evidence behind the verdict table: each library is
 * exercised in isolation so its behaviour can be judged independently of the
 * main page's composition. Sizes are read from a JSON file produced by
 * `tools/report-sizes.mjs` against an actual production build.
 */
import './lab.css';

import { gsap, ScrollTrigger, initScroll, getLenis, scrollToTop } from './lib/scroll.js';
import { one, all, prefersReducedMotion, hasFinePointer } from './lib/prefs.js';
import { animate as motionAnimate } from 'motion';
import {
  animate as animeAnimate,
  createTimeline,
  createDrawable,
  createMotionPath,
  scrambleText,
  stagger as animeStagger,
} from 'animejs';
import SplitType from 'split-type';
import autoAnimate from '@formkit/auto-animate';
import sizeData from './lib/bundle-sizes.json';

/* ── Shared setup ────────────────────────────────────────────── */

function setupShell() {
  const lenis = initScroll({ navHeight: 68 });

  // Scroll progress bar.
  const bar = one('#scrollProgress');
  if (bar) {
    gsap.set(bar, { scaleX: 0, transformOrigin: 'left center' });
    gsap.to(bar, {
      scaleX: 1,
      ease: 'none',
      scrollTrigger: { trigger: document.documentElement, start: 'top top', end: 'bottom bottom', scrub: 0.2 },
    });
  }

  // Cursor glow, reusing the same approach as the main page.
  const glow = one('#cursorGlow');
  if (glow && hasFinePointer && !prefersReducedMotion) {
    let tx = 0;
    let ty = 0;
    document.addEventListener(
      'pointermove',
      (event) => {
        glow.classList.add('on');
        motionAnimate(glow, { x: event.clientX - 230, y: event.clientY - 230 }, { type: 'spring', stiffness: 320, damping: 30, mass: 0.6 });
      },
      { passive: true },
    );
  }

  const year = one('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  return { lenis };
}

/* ── Bundle size table ───────────────────────────────────────── */

const VERDICT_LABELS = {
  adopted: ['verdict-adopted', 'Adopted'],
  'adopted-heavy': ['verdict-heavy', 'Adopted · heavy'],
  'adopted-scoped': ['verdict-scoped', 'Adopted · scoped'],
  'adopted-with-caveat': ['verdict-scoped', 'Adopted · caveat'],
  'blocked-on-asset': ['verdict-lab', 'Lab only'],
  'lab-only': ['verdict-lab', 'Lab only'],
};

function fmt(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function renderSizes() {
  const body = one('#sizeTableBody');
  const foot = one('#sizeTableFoot');
  const generated = one('#sizeGenerated');
  if (!body) return;

  const libs = sizeData.libraries;

  body.innerHTML = libs
    .map((lib) => {
      const [cls, label] = VERDICT_LABELS[lib.verdict] || ['verdict-scoped', lib.verdict];
      return `
        <tr>
          <td>${lib.name}<span class="lib-ver">v${lib.version}</span></td>
          <td><span class="verdict ${cls}">${label}</span></td>
          <td class="num">${fmt(lib.raw)}</td>
          <td class="num">${fmt(lib.gzip)}</td>
          <td class="num">${fmt(lib.brotli)}</td>
          <td>
            <span class="lib-role">${lib.role}</span>
            <span class="lib-why">${lib.why}</span>
          </td>
        </tr>`;
    })
    .join('');

  const sum = (key) => libs.reduce((acc, lib) => acc + (lib[key] || 0), 0);
  const measured = libs.filter((lib) => lib.gzip !== null);

  if (foot) {
    foot.innerHTML = `
      <tr>
        <td colspan="2">Total — ${measured.length} of ${libs.length} libraries measured</td>
        <td class="num">${fmt(sum('raw'))}</td>
        <td class="num">${fmt(sum('gzip'))}</td>
        <td class="num">${fmt(sum('brotli'))}</td>
        <td>Sum of the per-library vendor chunks</td>
      </tr>`;
  }

  if (generated) {
    generated.textContent = sizeData.generatedAt
      ? `Measured from a production build on ${sizeData.generatedAt}`
      : 'Sizes not yet measured — run: npm run build && npm run size';
  }

  // Headline summary tiles.
  const summary = one('#labSummary');
  if (summary) {
    const heaviest = measured.slice().sort((a, b) => (b.gzip || 0) - (a.gzip || 0))[0];
    const adopted = libs.filter((lib) => lib.verdict.startsWith('adopted')).length;
    const tiles = [
      ['Libraries evaluated', String(libs.length)],
      ['Shipped on the main page', String(adopted)],
      ['Total vendor JS (gzip)', fmt(sum('gzip'))],
      ['Heaviest dependency', heaviest ? `${heaviest.name.split(' ')[0]} · ${fmt(heaviest.gzip)}` : '—'],
    ];
    summary.innerHTML = tiles
      .map(([dt, dd]) => `<div><dt>${dt}</dt><dd>${dd}</dd></div>`)
      .join('');
  }
}

/* ── GSAP ────────────────────────────────────────────────────── */

function demoGsap() {
  const bars = all('#gsapBars span');
  if (!bars.length) return;

  const timeline = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });

  timeline.to(bars, {
    height: () => `${28 + Math.random() * 68}%`,
    duration: 0.55,
    stagger: { each: 0.055, from: 'start' },
  });

  timeline.addLabel('settled', '>-0.1');
  timeline.to(bars, {
    backgroundColor: '#a855f7',
    duration: 0.4,
    stagger: { each: 0.04, from: 'end' },
  }, 'settled');

  const reset = () => gsap.set(bars, { height: '22%', backgroundColor: '' });
  reset();
  timeline.play();

  one('[data-gsap="replay"]')?.addEventListener('click', () => {
    reset();
    timeline.restart();
  });
  one('[data-gsap="reverse"]')?.addEventListener('click', () => timeline.reverse());

  return timeline;
}

/* ── Lenis ───────────────────────────────────────────────────── */

function demoLenis({ lenis }) {
  const velocity = one('#lenisVelocity');
  const progress = one('#lenisProgress');

  const update = () => {
    const inst = getLenis();
    if (!inst) return;
    if (velocity) velocity.textContent = inst.velocity.toFixed(2);
    if (progress) progress.textContent = `${Math.round(inst.progress * 100)}%`;
  };
  gsap.ticker.add(update);

  one('#lenisDown')?.addEventListener('click', () => {
    getLenis()?.scrollTo('bottom', { duration: 2.4 });
  });
  one('#lenisTop')?.addEventListener('click', () => scrollToTop());

  void lenis;
}

/* ── SplitType ───────────────────────────────────────────────── */

function demoSplit() {
  const target = one('#splitTarget');
  const count = one('#splitCount');
  if (!target) return;

  let current = null;

  function recount() {
    if (!count) return;
    const chars = target.querySelectorAll('.split-char').length;
    const words = target.querySelectorAll('.split-word').length;
    const lines = target.querySelectorAll('.split-line').length;
    count.textContent = `${chars} chars · ${words} words · ${lines} lines`;
  }

  function apply(mode) {
    current?.revert();
    target.removeAttribute('aria-label');

    if (mode === 'revert') {
      current = null;
      if (count) count.textContent = 'reverted to plain text';
      return;
    }

    current = new SplitType(target, { types: mode });
    target.setAttribute('aria-label', 'Ship the interface, not just the model.');
    ['chars', 'words', 'lines'].forEach((group) => {
      (current[group] || []).forEach((node) => node.setAttribute('aria-hidden', 'true'));
    });
    recount();

    const parts = current[mode] || [];
    if (prefersReducedMotion) return;

    animeAnimate(parts, {
      opacity: [0, 1],
      y: mode === 'lines' ? [14, 0] : [10, 0],
      rotateX: mode === 'chars' ? [-70, 0] : [0, 0],
      delay: animeStagger(12),
      duration: 600,
      ease: 'outExpo',
    });
  }

  all('[data-split]').forEach((btn) => {
    btn.addEventListener('click', () => {
      all('[data-split]').forEach((b) => b.classList.toggle('is-active', b === btn && btn.dataset.split !== 'revert'));
      apply(btn.dataset.split);
    });
  });

  // Default view.
  current = new SplitType(target, { types: 'words' });
  recount();
}

/* ── Motion ──────────────────────────────────────────────────── */

function demoMotion() {
  const spring = one('#motionSpring');
  const tween = one('#motionTween');
  if (!spring || !tween) return;

  const span = () => Math.max((spring.parentElement.clientWidth - 24), 40);

  function fire(dot, options) {
    const target = Math.random() * span();
    motionAnimate(dot, { x: target }, options);
  }

  const run = () => {
    fire(spring, { type: 'spring', stiffness: 220, damping: 12, mass: 0.9 });
    fire(tween, { duration: 0.85, ease: 'easeInOut' });
  };

  spring.parentElement.addEventListener('click', run);
  tween.parentElement.addEventListener('click', run);
  one('#motionRun')?.addEventListener('click', run);

  if (!prefersReducedMotion) window.setTimeout(run, 600);
}

/* ── anime.js ────────────────────────────────────────────────── */

function demoAnime() {
  const line = one('#animeLine');
  const track = one('#animeTrack');
  const dot = one('#animeDot');
  const row = all('.anime-stagger circle');
  const caption = one('#animeScramble');
  if (!line) return;

  const drawable = createDrawable(line);
  animeAnimate(drawable, { draw: '0 0' }, { duration: 0 });
  animeAnimate(row, { opacity: 0.15, scale: 0.6 }, { duration: 0 });
  animeAnimate(dot, { opacity: 0 }, { duration: 0 });

  const captionText = caption?.textContent ?? '';

  function play() {
    const timeline = createTimeline({ defaults: { ease: 'outExpo' } });

    timeline.add(drawable, { draw: ['0 0', '0 1'], duration: 1200, ease: 'inOutQuad' }, 0);
    timeline.add(row, { opacity: [0.15, 1], scale: [0.6, 1], duration: 600, delay: animeStagger(70) }, 120);
    timeline.add(dot, { opacity: [0, 1], duration: 300 }, 900);

    if (track && dot) {
      const { translateX, translateY } = createMotionPath(track);
      timeline.add(dot, { translateX, translateY, duration: 1600, loop: true, ease: 'linear' }, 1000);
    }

    if (caption) {
      timeline.add(caption, {
        text: scrambleText({ chars: 'blocks', from: 'left' }),
        duration: 1100,
      }, 400);
    }

    return timeline;
  }

  let timeline = null;
  const replay = () => {
    timeline?.pause();
    animeAnimate(drawable, { draw: '0 0' }, { duration: 0 });
    animeAnimate(row, { opacity: 0.15, scale: 0.6 }, { duration: 0 });
    animeAnimate(dot, { opacity: 0 }, { duration: 0 });
    if (caption) caption.textContent = captionText;
    timeline = play();
  };

  one('#animePlay')?.addEventListener('click', replay);

  // Start when scrolled into view.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timeline = play();
        }
      },
      { threshold: 0.35 },
    ).observe(one('#lab-anime'));
  } else {
    timeline = play();
  }
}

/* ── three.js ────────────────────────────────────────────────── */

async function demoThree() {
  const canvas = one('#threeStage');
  if (!canvas) return;

  const {
    WebGLRenderer, Scene, PerspectiveCamera, IcosahedronGeometry,
    EdgesGeometry, LineSegments, LineBasicMaterial, Color,
  } = await import('three');

  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    canvas.replaceWith(Object.assign(document.createElement('p'), {
      className: 'lab-hint',
      textContent: 'WebGL unavailable on this device — the main page would fall back to its 2D canvas hero.',
    }));
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 3.4;

  const geo = new EdgesGeometry(new IcosahedronGeometry(1.15, 1));
  const lines = new LineSegments(geo, new LineBasicMaterial({ color: new Color('#38bdf8'), transparent: true, opacity: 0.85 }));
  scene.add(lines);

  const inner = new LineSegments(
    new EdgesGeometry(new IcosahedronGeometry(0.62, 1)),
    new LineBasicMaterial({ color: new Color('#f472b6'), transparent: true, opacity: 0.8 }),
  );
  scene.add(inner);

  const fpsEl = one('#threeFps');
  const callsEl = one('#threeCalls');
  const rendererEl = one('#threeRenderer');
  if (rendererEl) {
    rendererEl.textContent = renderer.capabilities.isWebGL2 ? 'WebGL2' : 'WebGL1';
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(rect.width, 1);
    const h = Math.max(rect.height, 1);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  let frames = 0;
  let sampleStart = performance.now();
  let last = performance.now();
  let rafId = null;
  let running = true;

  function frame(now) {
    const dt = (now - last) / 1000;
    last = now;

    lines.rotation.y += dt * 0.42;
    lines.rotation.x += dt * 0.19;
    inner.rotation.y -= dt * 0.68;
    inner.rotation.z += dt * 0.24;

    renderer.render(scene, camera);

    // Sample over a real time window — dividing by a single frame's delta
    // would report a meaningless instantaneous number.
    frames += 1;
    const elapsed = (now - sampleStart) / 1000;
    if (elapsed >= 0.5) {
      if (fpsEl) fpsEl.textContent = String(Math.round(frames / elapsed));
      if (callsEl) callsEl.textContent = String(renderer.info.render.calls);
      frames = 0;
      sampleStart = now;
    }
    if (running) rafId = requestAnimationFrame(frame);
  }

  resize();
  rafId = requestAnimationFrame(frame);

  window.addEventListener('resize', resize, { passive: true });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !running) {
        running = true;
        last = performance.now();
        rafId = requestAnimationFrame(frame);
      } else if (!entry.isIntersecting && running) {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
      }
    }, { threshold: 0 }).observe(canvas);
  }
}

/* ── tsParticles ─────────────────────────────────────────────── */

async function demoTsParticles() {
  const host = one('#tsparticlesStage');
  if (!host) return;

  const { getParticlesEngine, baseParticleOptions } = await import('./lib/particles-engine.js');
  const engine = await getParticlesEngine();

  // Three configurations over the SAME minimal engine, so the demo shows what
  // actually ships rather than features the bundle does not contain.
  const PRESETS = {
    grab: {
      label: 'pointer links + click push — the configuration the site ships',
      options: baseParticleOptions({ motion: { disable: prefersReducedMotion } }),
    },
    burst: {
      label: 'click-only: hover interactions off, larger click burst',
      options: baseParticleOptions({
        motion: { disable: prefersReducedMotion },
        interactivity: {
          detectsOn: 'window',
          events: {
            onHover: { enable: false, mode: 'grab' },
            onClick: { enable: true, mode: 'push' },
            resize: { enable: true },
          },
          modes: { grab: { distance: 150, links: { opacity: 0.4 } }, push: { quantity: 10 } },
        },
      }),
    },
    dense: {
      label: 'denser field, longer link distance, no interactivity',
      options: baseParticleOptions({
        motion: { disable: prefersReducedMotion },
        interactivity: { detectsOn: 'window', events: { onHover: { enable: false }, onClick: { enable: false }, resize: { enable: true } }, modes: {} },
        particles: {
          ...baseParticleOptions().particles,
          number: { value: 90, density: { enable: true, width: 900, height: 400 } },
          links: { enable: true, distance: 150, color: '#a855f7', opacity: 0.3, width: 1 },
        },
      }),
    },
  };

  let container = await engine.load({ id: 'lab-particles', element: host, options: PRESETS.grab.options });

  all('[data-tsparticles]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const preset = PRESETS[btn.dataset.tsparticles];
      if (!preset) return;
      all('[data-tsparticles]').forEach((b) => b.classList.toggle('is-active', b === btn));
      container?.destroy();
      container = await engine.load({ id: 'lab-particles', element: host, options: preset.options });
    });
  });
}

/* ── Lottie + Rive ───────────────────────────────────────────── */

async function demoVectorAssets() {
  const { initVectorAssets } = await import('./modules/vector-assets.js');
  const result = await initVectorAssets();

  // Lottie controls drive the first player (the site's own asset).
  const player = result.lottie?.[0];
  const toggle = one('#lottieToggle');
  const slow = one('#lottieSlow');
  const fast = one('#lottieFast');

  if (player) {
    let playing = !prefersReducedMotion;
    toggle?.addEventListener('click', () => {
      playing = !playing;
      if (playing) player.play();
      else player.pause();
      if (toggle) toggle.textContent = playing ? 'Pause' : 'Play';
    });
    slow?.addEventListener('click', () => player.setSpeed(0.5));
    fast?.addEventListener('click', () => player.setSpeed(2));
    if (prefersReducedMotion && toggle) toggle.textContent = 'Play';
  } else if (toggle) {
    toggle.disabled = true;
  }

  // Rive status panel — report exactly what happened.
  const status = one('#riveStatus');
  if (status) {
    const slot = one('[data-rive-slot]');
    const ready = slot?.dataset.riveReady === 'true';
    const error = slot?.dataset.riveError;

    if (ready) {
      status.innerHTML =
        '<strong>Runtime OK — asset loaded.</strong><br>' +
        'Playing the MIT-licensed <code>rating.riv</code> through the real ' +
        '<code>@rive-app/canvas</code> runtime. Hover the stars and click to rate: ' +
        'the whole interaction is a state machine inside the file, with zero logic ' +
        'written in JavaScript.';
    } else {
      status.innerHTML =
        '<strong>Runtime loaded, asset unavailable.</strong><br>' +
        (error ? `Reason: ${error}. ` : '') +
        'This is the demonstration of the asset gate described in the notes below.';
    }
  }

  void ScrollTrigger;
}

/* ── AutoAnimate ─────────────────────────────────────────────── */

function demoAutoAnimate() {
  const list = one('#aaList');
  if (!list) return;

  const controller = autoAnimate(list, {
    duration: prefersReducedMotion ? 0 : 320,
    easing: 'ease-out',
    disrespectUserMotionPreference: false,
  });

  const NOTES = [
    'hero intro timeline', 'heading reveals', 'scrubbed timeline',
    'stat counters', 'marquee velocity', 'background parallax',
    'nav indicator spring', 'mobile menu', 'cursor spotlight',
    'card tilt', 'magnetic buttons', 'camera flight',
    'skills filter reflow', 'contact particles', 'agent-core badge',
  ];
  let seed = 0;

  function item(label) {
    const li = document.createElement('li');
    const text = document.createElement('span');
    text.textContent = label;
    const tag = document.createElement('span');
    tag.className = 'aa-i mono';
    tag.textContent = `#${String(++seed).padStart(2, '0')}`;
    li.append(text, tag);
    return li;
  }

  const populate = (n) => {
    list.replaceChildren();
    for (let i = 0; i < n; i += 1) {
      list.appendChild(item(NOTES[i % NOTES.length]));
    }
  };

  populate(4);

  one('#aaAdd')?.addEventListener('click', () => {
    const next = list.children.length;
    list.appendChild(item(NOTES[next % NOTES.length]));
  });

  one('#aaRemove')?.addEventListener('click', () => {
    if (list.lastElementChild) list.lastElementChild.remove();
  });

  one('#aaShuffle')?.addEventListener('click', () => {
    const children = Array.from(list.children);
    for (let i = children.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [children[i], children[j]] = [children[j], children[i]];
    }
    children.forEach((child) => list.appendChild(child));
  });

  return controller;
}

/* ── Boot ────────────────────────────────────────────────────── */

function boot(name, fn) {
  try {
    return fn();
  } catch (error) {
    console.error(`[lab] "${name}" failed:`, error);
    return null;
  }
}

async function start() {
  renderSizes();

  const shell = boot('shell', () => setupShell());

  boot('gsap', demoGsap);
  boot('lenis', () => demoLenis(shell || {}));
  boot('split', demoSplit);
  boot('motion', demoMotion);
  boot('anime', demoAnime);
  boot('autoAnimate', demoAutoAnimate);

  // Async demos each own their failure so one broken library cannot stop the rest.
  await Promise.all([safe('three', demoThree), safe('tsparticles', demoTsParticles), safe('vectorAssets', demoVectorAssets)]);

  if (document.fonts?.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh());
}

/** Await an async demo, logging (never throwing) on failure. */
async function safe(name, fn) {
  try {
    return await fn();
  } catch (error) {
    console.error(`[lab] "${name}" failed:`, error);
    return null;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
