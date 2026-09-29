/**
 * Pointer micro-interactions.
 *
 * Restrained on purpose: the Anthropic reference hover state is almost always
 * just an opacity shift, so the only JS here is a light magnetic nudge on the
 * two hero buttons and the contact CTA. Everything else is CSS.
 */
import { all, hasFinePointer, prefersReducedMotion } from '../lib/prefs.js';

export function initInteractions() {
  if (!hasFinePointer || prefersReducedMotion) return;

  all('[data-magnetic]').forEach((el) => {
    let frame = null;
    let target = { x: 0, y: 0 };
    let current = { x: 0, y: 0 };

    const loop = () => {
      current.x += (target.x - current.x) * 0.18;
      current.y += (target.y - current.y) * 0.18;
      el.style.transform = `translate3d(${current.x.toFixed(2)}px, ${current.y.toFixed(2)}px, 0)`;

      if (Math.abs(target.x - current.x) > 0.1 || Math.abs(target.y - current.y) > 0.1) {
        frame = requestAnimationFrame(loop);
      } else {
        frame = null;
      }
    };

    const kick = () => {
      if (frame === null) frame = requestAnimationFrame(loop);
    };

    el.addEventListener('pointermove', (event) => {
      const rect = el.getBoundingClientRect();
      target = {
        x: (event.clientX - rect.left - rect.width / 2) * 0.16,
        y: (event.clientY - rect.top - rect.height / 2) * 0.22,
      };
      kick();
    }, { passive: true });

    el.addEventListener('pointerleave', () => {
      target = { x: 0, y: 0 };
      kick();
    });
  });
}
