/**
 * Entrance animation choreography — GSAP timelines + ScrollTrigger,
 * with headings split into lines/words by SplitType.
 *
 * Everything here is scroll-driven rather than observer-driven so the
 * animation state can never drift out of sync with the (Lenis-smoothed)
 * scroll position.
 *
 * NOTE ON THE `opacity: 0` FOUC GUARD
 * -----------------------------------
 * `styles.css` hides `.reveal` elements while the `js` class is present, so
 * nothing flashes before GSAP boots. That means end states must be stated
 * *explicitly* (`fromTo`, or `set(..., {opacity: 1})` first): a plain
 * `gsap.from(el, { opacity: 0 })` reads its end value from the computed style
 * and would animate 0 -> 0.
 *
 * Ownership is strictly partitioned so nothing is animated twice:
 *   hero            -> heroIntro()
 *   .section-head   -> sectionHeadings()      (eyebrow + split title words)
 *   every other .reveal -> bodyReveals()      (one batched ScrollTrigger)
 *   .count          -> counters()
 */
import { gsap, ScrollTrigger } from '../lib/scroll.js';
import { splitText } from '../lib/split.js';
import { all, one, prefersReducedMotion } from '../lib/prefs.js';

/** Wrap every `.split-line` so words can be masked as they rise into view. */
function maskLines(lines) {
  lines.forEach((line) => line.classList.add('split-line-mask'));
}

/* ── Hero intro ──────────────────────────────────────────────── */

function heroIntro() {
  const title = one('.hero-title');
  const card = one('.hero-card');
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' }, delay: 0.12 });

  // Release the CSS hold state on everything we are about to animate.
  gsap.set(all('.hero .reveal'), { opacity: 1 });

  if (title) {
    const { words, lines } = splitText(title, { types: 'lines,words' });
    maskLines(lines);
    tl.fromTo(
      words,
      { yPercent: 118, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: 1.05, stagger: 0.028 },
      0,
    );
  }

  // Everything in the hero except the title (its own masked word reveal)
  // and the profile card (which gets a bigger, later entrance).
  const sequenced = all('.hero [data-reveal]').filter((el) => el !== title && el !== card);

  sequenced.forEach((el, index) => {
    tl.fromTo(
      el,
      { y: 22, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' },
      0.26 + index * 0.085,
    );
  });

  if (card) {
    tl.fromTo(
      card,
      { y: 34, opacity: 0 },
      { y: 0, opacity: 1, duration: 1.0, ease: 'expo.out' },
      0.34,
    );
  }

  return tl;
}

/* ── Section headings ────────────────────────────────────────── */

function sectionHeadings() {
  // Heading blocks are held at opacity 0 by the FOUC guard, but their
  // children animate individually — release the parents first.
  gsap.set(all('.section-head'), { opacity: 1 });

  all('.section-title').forEach((title) => {
    const { words, lines } = splitText(title, { types: 'lines,words' });
    maskLines(lines);

    gsap.fromTo(
      words,
      { yPercent: 115, opacity: 0 },
      {
        yPercent: 0,
        opacity: 1,
        duration: 0.85,
        stagger: 0.05,
        ease: 'expo.out',
        scrollTrigger: { trigger: title, start: 'top 88%', once: true },
      },
    );
  });

  all('.eyebrow').forEach((eyebrow) => {
    gsap.fromTo(
      eyebrow,
      { x: -14, opacity: 0 },
      {
        x: 0,
        opacity: 1,
        duration: 0.6,
        ease: 'power3.out',
        scrollTrigger: { trigger: eyebrow, start: 'top 92%', once: true },
      },
    );
  });
}

/* ── Generic reveal elements ─────────────────────────────────── */

function bodyReveals() {
  const items = all('.reveal').filter(
    (el) => !el.closest('.hero') && !el.matches('.section-head'),
  );
  if (!items.length) return;

  gsap.set(items, { opacity: 0, y: 26 });

  // One batched trigger: items entering together stagger into place, which
  // is what gives every grid its rhythm without per-group configuration.
  ScrollTrigger.batch(items, {
    start: 'top 88%',
    once: true,
    batchMax: 6,
    onEnter: (batch) =>
      gsap.to(batch, {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.08,
        ease: 'power3.out',
        overwrite: true,
      }),
  });
}

/* ── Stat counters ───────────────────────────────────────────── */

function counters() {
  all('.count').forEach((el) => {
    const target = parseFloat(el.dataset.count || '0');
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const state = { value: 0 };

    gsap.to(state, {
      value: target,
      duration: 1.6,
      ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 92%', once: true },
      onUpdate() {
        el.textContent = `${prefix}${Math.round(state.value)}${suffix}`;
      },
    });
  });
}

/* ── Public API ──────────────────────────────────────────────── */

export function initReveals() {
  if (prefersReducedMotion) {
    // Nothing to animate — drop the guard class so everything is visible.
    document.documentElement.classList.remove('js');

    // Counters must still show their real values. Without this they would sit
    // at their initial "0" forever, which reads as broken content rather than
    // a skipped animation.
    all('.count').forEach((el) => {
      el.textContent = `${el.dataset.prefix || ''}${el.dataset.count || '0'}${el.dataset.suffix || ''}`;
    });
    return;
  }

  heroIntro();
  sectionHeadings();
  bodyReveals();
  counters();

  // Web fonts change line breaks; re-measure once they land.
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
  window.addEventListener('load', () => ScrollTrigger.refresh());
}
