/**
 * Shared environment / motion-preference helpers.
 *
 * Every module in the site reads its capabilities from here so the
 * accessibility contract is enforced in exactly one place.
 */

/** User has asked the OS to reduce motion. */
export const prefersReducedMotion =
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Device has a real hovering pointer (mouse / trackpad) — not a touchscreen. */
export const hasFinePointer =
  window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/** Connection is slow enough that we should skip optional heavy work. */
export const isSlowConnection = (() => {
  const conn = navigator.connection;
  if (!conn) return false;
  if (conn.saveData) return true;
  return ['slow-2g', '2g', '3g'].includes(conn.effectiveType);
})();

/** True when WebGL2 or WebGL1 can actually be initialised. */
export function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    );
  } catch {
    return false;
  }
}

/**
 * Run `fn` on every element matching `selector`.
 * Throws away the noise of Array.from(document.querySelectorAll(...)).
 */
export function all(selector, scope = document) {
  return Array.from(scope.querySelectorAll(selector));
}

export function one(selector, scope = document) {
  return scope.querySelector(selector);
}

/** Only run `fn` when the element is in (or near) the viewport. */
export function whenVisible(target, fn, { rootMargin = '200px', once = true } = {}) {
  if (!target) return () => {};
  if (!('IntersectionObserver' in window)) {
    fn(target);
    return () => {};
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        fn(entry.target);
        if (once) observer.unobserve(entry.target);
      });
    },
    { rootMargin },
  );
  observer.observe(target);
  return () => observer.disconnect();
}

/** Round to `n` decimal places — used when writing transform strings. */
export const round = (value, n = 2) => Number(value.toFixed(n));
