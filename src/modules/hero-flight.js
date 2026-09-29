/**
 * The opening title sequence.
 *
 * Timed like a title card, and deliberately unhurried — the first version of
 * this hero moved fast enough that nothing on screen could be read, which is
 * the single fastest way to make an animation feel like noise.
 *
 *   0.0s  the letterbox opens — the frame arrives before anything is in it
 *   0.7s  the kicker lands
 *   1.1s  the title resolves: 22px of blur clears while the tracking settles
 *         from wide to tight
 *   2.1s  the rule draws outward from centre
 *   2.5s  the credit block staggers up
 *   3.0s  the call to action
 *   3.6s  the scroll cue, last — the invitation comes after the introduction
 *
 * Scroll then takes over: the copy lifts and dissolves while the context
 * window below keeps streaming.
 */
import { gsap, ScrollTrigger } from '../lib/scroll.js';
import { all, one, prefersReducedMotion } from '../lib/prefs.js';

export function initHeroFlight() {
  const track = one('#heroTrack');
  if (!track) return { destroy() {} };

  const inner = one('.hero-inner');
  const bars = all('.hero-bar');
  const kicker = one('.hero-kicker');
  const title = one('.hero-title');
  const rule = one('.hero-rule i');
  const credits = all('.hero-credits > div');
  const cta = one('.hero-cta');

  if (prefersReducedMotion) {
    gsap.set([kicker, title, one('.hero-credits'), cta], { opacity: 1, filter: 'none', y: 0 });
    gsap.set(bars, { scaleY: 1 });
    gsap.set(rule, { scaleX: 1 });
    return { destroy() {} };
  }

  gsap.set(all('.hero-reveal'), { opacity: 1 });

  const intro = gsap.timeline({ defaults: { ease: 'power3.out' }, delay: 0.2 });

  // 1 — the frame opens. scaleY(14) covers the viewport from the letterbox
  //     origin, so this reads as an aperture rather than a sliding panel.
  intro.fromTo(bars, { scaleY: 14 }, { scaleY: 1, duration: 2.0, ease: 'expo.out' }, 0);

  // 2 — kicker
  intro.fromTo(kicker, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1.0 }, 0.7);

  // 3 — title. Blur clears while the tracking settles: the whole move.
  intro.fromTo(
    title,
    { opacity: 0, filter: 'blur(22px)', letterSpacing: '0.14em' },
    { opacity: 1, filter: 'blur(0px)', letterSpacing: '-0.012em', duration: 2.6 },
    1.1,
  );

  // 4 — the rule draws outward from centre
  intro.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 1.5, ease: 'expo.out' }, 2.1);

  // 5 — credits
  intro.fromTo(credits, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.95, stagger: 0.11 }, 2.45);

  // 6 — call to action
  if (cta) intro.fromTo(cta, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.95 }, 3.0);

  /* ── The plate drifts with the page ─────────────────────────────
     It is position:fixed, so without this it would sit perfectly still while
     everything scrolls over it and read as a static image. The travel is
     capped to stay inside the slack that scale() gives us.               */
  const plate = one('#heroVideo');
  let ticking = false;
  function driftPlate() {
    ticking = false;
    if (!plate) return;
    const y = Math.min(window.scrollY * 0.04, 58);
    plate.style.setProperty('--plate-y', `${y.toFixed(1)}px`);
  }
  if (plate && !prefersReducedMotion) {
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(driftPlate);
    }, { passive: true });
    driftPlate();
  }

  /* ── Scroll → camera progress (§ kept for the header state only) ── */
  const flight = ScrollTrigger.create({
    trigger: track,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      // The letterbox retracts as you leave the title card.
      const t = Math.min(self.progress / 0.6, 1);
      gsap.set(bars, { scaleY: 1 - t * 0.55 });
    },
  });

  /* ── The copy lifts and dissolves as the window takes over ───── */
  let exit = null;
  if (inner) {
    exit = gsap.to(inner, {
      opacity: 0,
      y: -70,
      scale: 0.97,
      filter: 'blur(7px)',
      ease: 'none',
      scrollTrigger: {
        trigger: track,
        start: 'top top',
        end: '30% top',
        scrub: 0.6,
      },
    });
  }

  return {
    destroy() {
      window.removeEventListener('scroll', driftPlate);
      flight.kill();
      intro.kill();
      exit?.scrollTrigger?.kill();
      exit?.kill();
    },
  };
}
