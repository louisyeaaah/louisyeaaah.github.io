/**
 * Pointer-driven micro-interactions.
 *
 * All of these are springs rather than tweens: the value is continuously
 * retargeted while the pointer moves, which is exactly what Motion's spring
 * solver is good at and what GSAP timelines are not.
 */
import { animate } from 'motion';
import { all, one, hasFinePointer, prefersReducedMotion } from '../lib/prefs.js';

const SOFT_SPRING = { type: 'spring', stiffness: 320, damping: 30, mass: 0.6 };
const TILT_SPRING = { type: 'spring', stiffness: 260, damping: 26, mass: 0.8 };

/* ── Cursor spotlight ────────────────────────────────────────── */

function initCursor() {
  const glow = one('#cursorGlow');
  if (!glow || !hasFinePointer) return;

  animate(glow, { transformPerspective: 900 }, { duration: 0 });

  let queued = null;
  let visible = false;

  const flush = () => {
    queued = null;
    if (!pending) return;
    animate(glow, { x: pending.x - 230, y: pending.y - 230 }, SOFT_SPRING);
  };
  let pending = null;

  document.addEventListener(
    'pointermove',
    (event) => {
      pending = { x: event.clientX, y: event.clientY };
      if (!visible) {
        visible = true;
        glow.classList.add('on');
      }
      if (queued === null) queued = requestAnimationFrame(flush);
    },
    { passive: true },
  );

  // Grow the spotlight over interactive things.
  const interactive = 'a, button, .skill-card, .tl-card, .panel';
  document.addEventListener(
    'pointerover',
    (event) => {
      if (!event.target.closest?.(interactive)) return;
      animate(glow, { scale: 1.45 }, { duration: 0.4, ease: [0.16, 1, 0.3, 1] });
    },
    { passive: true },
  );
  document.addEventListener(
    'pointerout',
    (event) => {
      if (!event.target.closest?.(interactive)) return;
      animate(glow, { scale: 1 }, { duration: 0.5, ease: [0.16, 1, 0.3, 1] });
    },
    { passive: true },
  );

  document.addEventListener('pointerleave', () => {
    visible = false;
    glow.classList.remove('on');
  });
}

/* ── 3D tilt + spotlight on cards ────────────────────────────── */

function initTilt() {
  if (!hasFinePointer) return;

  all('[data-tilt]').forEach((card) => {
    animate(card, { transformPerspective: 950 }, { duration: 0 });

    card.addEventListener(
      'pointermove',
      (event) => {
        const rect = card.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width;
        const py = (event.clientY - rect.top) / rect.height;

        card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
        card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);

        animate(
          card,
          {
            rotateY: (px - 0.5) * 8,
            rotateX: (0.5 - py) * 8,
            scale: 1.012,
          },
          TILT_SPRING,
        );
      },
      { passive: true },
    );

    card.addEventListener('pointerleave', () => {
      animate(card, { rotateY: 0, rotateX: 0, scale: 1 }, TILT_SPRING);
    });
  });
}

/* ── Magnetic buttons ────────────────────────────────────────── */

function initMagnetic() {
  if (!hasFinePointer) return;

  all('[data-magnetic]').forEach((el) => {
    el.addEventListener(
      'pointermove',
      (event) => {
        const rect = el.getBoundingClientRect();
        const mx = event.clientX - rect.left - rect.width / 2;
        const my = event.clientY - rect.top - rect.height / 2;
        animate(
          el,
          { x: mx * 0.18, y: my * 0.24 - 1 },
          { type: 'spring', stiffness: 300, damping: 22, mass: 0.5 },
        );
      },
      { passive: true },
    );

    el.addEventListener('pointerleave', () => {
      animate(el, { x: 0, y: 0 }, { type: 'spring', stiffness: 260, damping: 20 });
    });
  });
}

/* ── Chip / tag pop ──────────────────────────────────────────── */

function initTagPop() {
  if (!hasFinePointer) return;
  all('.tags li, .badge, .chip').forEach((chip) => {
    chip.addEventListener('pointerenter', () => {
      animate(chip, { y: -2.5, scale: 1.045 }, { type: 'spring', stiffness: 420, damping: 24 });
    });
    chip.addEventListener('pointerleave', () => {
      animate(chip, { y: 0, scale: 1 }, { type: 'spring', stiffness: 380, damping: 26 });
    });
  });
}

/* ── Typewriter ──────────────────────────────────────────────── */

function initTypewriter() {
  const el = one('#typewriter');
  if (!el) return;

  const phrases = [
    'AI Engineer',
    'Multi-agent systems',
    'MCP tool integrations',
    'LLM observability',
    'Platform engineering',
    'Agentic RAG',
  ];

  if (prefersReducedMotion) {
    el.textContent = phrases[0];
    return;
  }

  let phraseIndex = 0;
  let charIndex = 0;
  let deleting = false;

  const tick = () => {
    const word = phrases[phraseIndex];
    charIndex += deleting ? -1 : 1;
    el.textContent = word.slice(0, charIndex);

    let wait = deleting ? 42 : 78;
    if (!deleting && charIndex === word.length) {
      deleting = true;
      wait = 1750;
    } else if (deleting && charIndex === 0) {
      deleting = false;
      phraseIndex = (phraseIndex + 1) % phrases.length;
      wait = 320;
    }
    window.setTimeout(tick, wait);
  };

  // Start once the hero fade-in has finished.
  window.setTimeout(tick, 900);
}

export function initInteractions() {
  if (prefersReducedMotion) {
    const tw = one('#typewriter');
    if (tw) tw.textContent = 'AI Engineer';
    return;
  }
  if (hasFinePointer) {
    initCursor();
    initTilt();
    initMagnetic();
    initTagPop();
  }
  initTypewriter();
}
