/**
 * Capability filtering — @formkit/auto-animate.
 *
 * The one place the DOM genuinely changes shape at runtime. AutoAnimate diffs
 * child positions across the mutation and FLIP-animates the reflow, which is
 * precisely what a timeline-based library is bad at and a DOM-diffing one is
 * good at.
 */
import autoAnimate from '@formkit/auto-animate';
import { all, one, prefersReducedMotion } from '../lib/prefs.js';

export function initCapFilter() {
  const grid = one('#capGrid');
  const bar = one('.filter-bar');
  if (!grid || !bar) return null;

  const chips = all('.filter-chip', bar);
  const cards = all('.cap-card', grid);

  const controller = autoAnimate(grid, {
    duration: prefersReducedMotion ? 0 : 300,
    easing: 'ease-out',
    disrespectUserMotionPreference: false,
  });

  function apply(filter) {
    let shown = 0;

    cards.forEach((card) => {
      const match = filter === 'all' || (card.dataset.cat || '').split(' ').includes(filter);
      card.hidden = !match;
      if (match) shown += 1;
    });

    chips.forEach((chip) => {
      const active = chip.dataset.filter === filter;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', String(active));
    });

    const live = one('#filterStatus');
    if (live) {
      const label = chips.find((c) => c.dataset.filter === filter)?.dataset.filter || filter;
      live.textContent = `${shown} ${shown === 1 ? 'capability' : 'capabilities'} shown${filter === 'all' ? '' : ` for ${label}`}`;
    }
  }

  chips.forEach((chip) => chip.addEventListener('click', () => apply(chip.dataset.filter || 'all')));

  bar.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const index = chips.indexOf(document.activeElement);
    if (index === -1) return;
    event.preventDefault();
    const next = event.key === 'ArrowRight'
      ? (index + 1) % chips.length
      : (index - 1 + chips.length) % chips.length;
    chips[next].focus();
    chips[next].click();
  });

  apply('all');

  return { destroy: () => controller.destroy() };
}
