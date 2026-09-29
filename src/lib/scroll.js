/**
 * Scroll system: Lenis (inertial smooth scrolling) driven by the GSAP ticker,
 * with GSAP ScrollTrigger kept in sync so scroll-driven animation never
 * fights the smooth-scroll interpolation.
 *
 * Also owns anchor-link navigation, because native `scroll-behavior: smooth`
 * conflicts with Lenis.
 */
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from './prefs.js';

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

let lenis = null;

/** The live Lenis instance (null when reduced-motion is on). */
export const getLenis = () => lenis;

export function initScroll({ navHeight = 68 } = {}) {
  const anchorOffset = -(navHeight + 16);

  if (prefersReducedMotion) {
    // Honour the OS setting: no inertial scrolling, native jumps only.
    document.documentElement.classList.add('no-smooth-scroll');
    return { lenis: null, destroy: () => {} };
  }

  lenis = new Lenis({
    duration: 1.05,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 1.7,
    gestureOrientation: 'vertical',
    autoRaf: false,
  });

  // Drive Lenis from the GSAP ticker so both share one rAF loop.
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  function tick(time) {
    lenis.raf(time * 1000);
  }

  // Anchor links -> Lenis, so they respect the easing and the fixed header.
  const onAnchorClick = (event) => {
    const link = event.target.closest?.('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href');
    if (!id || id === '#') return;
    const target = document.querySelector(id);
    if (!target) return;

    event.preventDefault();
    lenis.scrollTo(target, { offset: anchorOffset, duration: 1.15 });

    // Keep the URL shareable without triggering a second native jump.
    history.pushState(null, '', id);

    // Close the mobile menu if the click came from inside it.
    document.dispatchEvent(new CustomEvent('site:anchor-navigated'));
  };
  document.addEventListener('click', onAnchorClick);

  ScrollTrigger.refresh();

  return {
    lenis,
    destroy() {
      document.removeEventListener('click', onAnchorClick);
      gsap.ticker.remove(tick);
      lenis?.destroy();
      lenis = null;
    },
  };
}

/** Vertical scroll position, in pixels (works with or without Lenis). */
export function scrollY() {
  return lenis ? lenis.scroll : window.scrollY;
}

/** Scroll to the top of the document using whichever engine is active. */
export function scrollToTop() {
  if (lenis) lenis.scrollTo(0, { duration: 1.2 });
  else window.scrollTo({ top: 0, behavior: 'auto' });
}
