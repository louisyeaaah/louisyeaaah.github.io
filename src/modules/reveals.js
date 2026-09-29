/**
 * Scroll reveals — deliberately dependency-free.
 *
 * This is Anthropic's `contentFadeUp` pattern: an IntersectionObserver adds a
 * class, and a CSS transition does the work. Cheaper than a JS tween, immune to
 * layout drift, and it survives the bundle being slow to boot.
 */
import { all, prefersReducedMotion } from '../lib/prefs.js';

export function initReveals() {
  const items = all('.reveal');
  if (!items.length) return;

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-inview'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-inview');
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );

  items.forEach((el) => observer.observe(el));

  return () => observer.disconnect();
}
