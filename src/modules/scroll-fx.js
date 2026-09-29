/**
 * Scroll-scrubbed effects.
 *
 * Unlike `reveals.js` (which fires once when something enters the viewport),
 * everything here is bound directly to scroll progress: it can be scrubbed
 * backwards and forwards.
 */
import { gsap, ScrollTrigger, getLenis } from '../lib/scroll.js';
import { all, one, prefersReducedMotion } from '../lib/prefs.js';

/* ── Reading-progress bar ────────────────────────────────────── */

function progressBar() {
  const bar = one('#scrollProgress');
  if (!bar) return;

  gsap.set(bar, { scaleX: 0, transformOrigin: 'left center' });
  gsap.to(bar, {
    scaleX: 1,
    ease: 'none',
    scrollTrigger: {
      trigger: document.documentElement,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.25,
    },
  });
}

/* ── Ambient background parallax ─────────────────────────────── */

function backgroundParallax() {
  const layers = [
    { el: one('.bg-aurora.a1'), y: -140, x: 70 },
    { el: one('.bg-aurora.a2'), y: 180, x: -90 },
    { el: one('.bg-aurora.a3'), y: -220, x: 40 },
    { el: one('.bg-grid'), y: 90, x: 0 },
  ].filter((layer) => layer.el);

  layers.forEach(({ el, y, x }) => {
    gsap.to(el, {
      xPercent: x / 10,
      yPercent: y / 10,
      ease: 'none',
      scrollTrigger: {
        trigger: document.body,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.6,
      },
    });
  });
}

/* ── Experience timeline ─────────────────────────────────────── */

function timelineScrub() {
  const timeline = one('.timeline');
  const line = one('.timeline-line');
  if (!timeline || !line) return;

  gsap.set(line, { scaleY: 0, transformOrigin: 'top center' });

  gsap.to(line, {
    scaleY: 1,
    ease: 'none',
    scrollTrigger: {
      trigger: timeline,
      start: 'top 72%',
      end: 'bottom 72%',
      scrub: 0.4,
    },
  });

  // Each node lights up as the progress line reaches it.
  all('.tl-node').forEach((node) => {
    ScrollTrigger.create({
      trigger: node,
      start: 'top 74%',
      once: true,
      onEnter: () => {
        gsap.timeline()
          .to(node, { scale: 1.45, borderColor: '#38bdf8', duration: 0.28, ease: 'power2.out' })
          .to(node, { scale: 1, duration: 0.45, ease: 'elastic.out(1, 0.5)' });
        gsap.fromTo(
          node,
          { boxShadow: '0 0 0 0 rgba(56,189,248,.55)' },
          { boxShadow: '0 0 0 16px rgba(56,189,248,0)', duration: 0.9, ease: 'power2.out' },
        );
      },
    });
  });

  // Cards lean in slightly as they pass.
  all('.tl-card').forEach((card) => {
    gsap.fromTo(
      card,
      { opacity: 0.55 },
      {
        opacity: 1,
        ease: 'none',
        scrollTrigger: { trigger: card, start: 'top 88%', end: 'top 45%', scrub: true },
      },
    );
  });
}

/* ── Velocity-reactive marquee ───────────────────────────────── */

function marquee() {
  const track = one('.marquee-track');
  if (!track) return;

  // Hand the loop over from the CSS fallback animation to GSAP.
  track.classList.add('marquee-track--gsap');

  const loop = gsap.to(track, {
    xPercent: -50,
    duration: 38,
    ease: 'none',
    repeat: -1,
  });

  let settle = null;
  ScrollTrigger.create({
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      const velocity = gsap.utils.clamp(-1, 1, self.getVelocity() / 1400);
      const speed = 1 + Math.abs(velocity) * 3.5;
      const direction = velocity < -0.02 ? -1 : 1;

      gsap.to(loop, { timeScale: direction * speed, duration: 0.35, overwrite: true });

      // Ease back to the resting speed once scrolling stops.
      settle?.kill();
      settle = gsap.delayedCall(0.5, () => {
        gsap.to(loop, { timeScale: direction, duration: 0.9, overwrite: true });
      });
    },
  });
}

/* ── Diagram / contact drift ─────────────────────────────────── */

function driftEffects() {
  const diagram = one('.diagram-card');
  if (diagram) {
    gsap.fromTo(
      diagram,
      { y: 34 },
      {
        y: -34,
        ease: 'none',
        scrollTrigger: { trigger: diagram, start: 'top bottom', end: 'bottom top', scrub: 0.8 },
      },
    );
  }

  // Subtle zoom on the profile card as the hero scrolls away.
  const heroCard = one('.hero-card');
  if (heroCard) {
    gsap.to(heroCard, {
      yPercent: -8,
      opacity: 0.35,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.5 },
    });
  }

  // Hero copy rises a touch faster than the scroll.
  const heroCopy = one('.hero-copy');
  if (heroCopy) {
    gsap.to(heroCopy, {
      yPercent: -12,
      opacity: 0.25,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.5 },
    });
  }
}

/* ── Public API ──────────────────────────────────────────────── */

export function initScrollFx() {
  if (prefersReducedMotion) return;

  progressBar();
  backgroundParallax();
  timelineScrub();
  marquee();
  driftEffects();

  // Lenis changes the scroll container while ScrollTrigger measures it.
  const lenis = getLenis();
  if (lenis) {
    lenis.on('scroll', ScrollTrigger.update);
  }
}
