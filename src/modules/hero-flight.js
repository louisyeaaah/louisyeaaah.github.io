/**
 * The opening title sequence.
 *
 * Timed like a title card rather than "a hero that fades up":
 *
 *   0.0s  the letterbox opens — the frame arrives before anything is in it
 *   0.5s  the kicker lands
 *   0.9s  the title resolves: 22px of blur clears while the tracking settles
 *         from wide to tight, which is the move that reads as *film*
 *   1.6s  the rule draws outward from centre
 *   1.9s  the credit block staggers up
 *   2.2s  the call to action
 *   2.7s  the scroll cue, last — the invitation comes after the introduction
 *
 * The camera's own lens settle (wide -> normal, plus a short push in) runs on
 * a parallel 2.8s ramp inside `scene/index.js`, so the lens and the type are
 * timed against each other without either driving the other.
 *
 * Scroll then takes over: the copy lifts and dissolves as the camera flies.
 */
import { gsap, ScrollTrigger } from '../lib/scroll.js';
import { all, one, prefersReducedMotion } from '../lib/prefs.js';

const EASE = 'power3.out';

export function initHeroFlight(scene, ui) {
  const track = one('#heroTrack');
  if (!track) return { destroy() {} };

  const inner = one('.hero-inner');
  const bars = all('.hero-bar');
  const kicker = one('.hero-kicker');
  const title = one('.hero-title');
  const rule = one('.hero-rule i');
  const credits = all('.hero-credits > div');
  const cta = one('.hero-cta');
  const cue = one('.hero-scrollcue');

  /* ── Reduced motion: show the finished frame, park the camera ── */
  if (prefersReducedMotion) {
    gsap.set([kicker, title, one('.hero-credits'), cta, cue], { opacity: 1, filter: 'none', y: 0 });
    gsap.set(bars, { scaleY: 1 });
    gsap.set(rule, { scaleX: 1 });
    scene?.setProgress(0.08);
    ui?.setProgress(0.08);
    return { destroy() {} };
  }

  // Release the FOUC hold so every tween has a real end value to reach.
  gsap.set(all('.hero-reveal'), { opacity: 1 });

  /* ── The title card ──────────────────────────────────────────── */
  const intro = gsap.timeline({ defaults: { ease: EASE }, delay: 0.15 });

  // 1 — the frame opens. scaleY(14) covers the viewport from the letterbox
  //     origin, so this reads as an aperture rather than a sliding panel.
  intro.fromTo(
    bars,
    { scaleY: 14 },
    { scaleY: 1, duration: 1.5, ease: 'expo.out' },
    0,
  );

  // 2 — kicker
  intro.fromTo(kicker, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.8 }, 0.45);

  // 3 — title. Blur clears while the tracking settles: the whole move.
  intro.fromTo(
    title,
    { opacity: 0, filter: 'blur(22px)', letterSpacing: '0.14em' },
    { opacity: 1, filter: 'blur(0px)', letterSpacing: '-0.012em', duration: 2.0 },
    0.85,
  );

  // 4 — the rule draws outward from centre
  intro.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: 'expo.out' }, 1.55);

  // 5 — credits
  intro.fromTo(
    credits,
    { opacity: 0, y: 16 },
    { opacity: 1, y: 0, duration: 0.75, stagger: 0.09 },
    1.85,
  );

  // 6 — call to action
  if (cta) {
    intro.fromTo(cta, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.8 }, 2.2);
  }

  // 7 — the invitation, last
  if (cue) {
    intro.fromTo(cue, { opacity: 0 }, { opacity: 1, duration: 1.0 }, 2.65);
  }

  /* ── Scroll → camera progress ────────────────────────────────── */
  const flight = ScrollTrigger.create({
    trigger: track,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      scene?.setProgress(self.progress);
      ui?.setProgress(self.progress);
    },
  });

  scene?.setProgress(0);
  ui?.setProgress(0);

  /* ── The copy lifts and dissolves as the camera flies in ─────── */
  let exit = null;
  if (inner) {
    exit = gsap.to(inner, {
      opacity: 0,
      y: -70,
      scale: 0.965,
      filter: 'blur(7px)',
      ease: 'none',
      scrollTrigger: {
        trigger: track,
        start: 'top top',
        end: '34% top',
        scrub: 0.5,
      },
    });
  }

  return {
    destroy() {
      flight.kill();
      intro.kill();
      exit?.scrollTrigger?.kill();
      exit?.kill();
    },
  };
}
