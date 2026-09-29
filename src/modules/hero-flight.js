/**
 * The dark chapter: scroll drives the camera, and the hero copy gets out of
 * the way.
 *
 * The hero is a 240vh track with a sticky 100lvh stage, which is the
 * ScrollTrigger equivalent of Anthropic's `height: 190vh` + `position: sticky`
 * launch hero — the browser pins it in the compositor and all we supply is a
 * 0..1 progress scalar.
 *
 * The entrance is a blur-in, again matching their `fx-title-in`: opacity 0 ->
 * 1 with a 26px blur resolving, staggered across the four hero elements.
 */
import { gsap, ScrollTrigger } from '../lib/scroll.js';
import { all, one, prefersReducedMotion } from '../lib/prefs.js';

export function initHeroFlight(scene, ui) {
  const track = one('#heroTrack');
  if (!track) return { destroy() {} };

  const copy = one('.hero-inner');
  const items = all('.hero-reveal');

  /* ── Reduced motion: park the camera and show everything ─────── */
  if (prefersReducedMotion) {
    scene?.setProgress(0.08);
    ui?.setProgress(0.08);
    gsap.set(items, { opacity: 1, filter: 'none' });
    return { destroy() {} };
  }

  // Release the FOUC hold so the timeline has real end values to reach.
  gsap.set(items, { opacity: 1, filter: 'none' });

  /* ── Entrance ────────────────────────────────────────────────── */
  const intro = gsap.timeline({ delay: 0.35, defaults: { ease: 'power2.out' } });

  items.forEach((el, index) => {
    const isTitle = el.classList.contains('hero-title');
    intro.fromTo(
      el,
      { opacity: 0, filter: isTitle ? 'blur(26px)' : 'blur(12px)', y: isTitle ? 0 : 26 },
      {
        opacity: 1,
        filter: 'blur(0px)',
        y: 0,
        duration: isTitle ? 1.5 : 1.0,
      },
      index * 0.15,
    );
  });

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

  // Prime the first frame so the camera is never at t=0 on load.
  scene?.setProgress(0);
  ui?.setProgress(0);

  /* ── The copy leaves as you fly in ───────────────────────────── */
  let copyTween = null;
  if (copy) {
    copyTween = gsap.to(copy, {
      opacity: 0,
      y: -46,
      ease: 'none',
      scrollTrigger: {
        trigger: track,
        start: 'top top',
        end: '32% top',
        scrub: 0.4,
      },
    });
  }

  return {
    destroy() {
      flight.kill();
      intro.kill();
      copyTween?.scrollTrigger?.kill();
      copyTween?.kill();
    },
  };
}
