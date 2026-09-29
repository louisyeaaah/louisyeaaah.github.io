/**
 * Skills grid filtering — @formkit/auto-animate.
 *
 * Filtering is the one place on this site where the DOM genuinely changes
 * shape at runtime, which is precisely the problem AutoAnimate solves: it
 * diffs child positions before/after a mutation and FLIP-animates the reflow.
 * A library is a better fit here than hand-rolled FLIP because the reflow is
 * caused by an external trigger (the filter click) rather than by a timeline.
 */
import autoAnimate from '@formkit/auto-animate';
import { all, one, prefersReducedMotion } from '../lib/prefs.js';

export function initSkillFilter() {
  const grid = one('.skill-grid');
  const bar = one('.filter-bar');
  if (!grid || !bar) return;

  const chips = all('.filter-chip', bar);
  const cards = all('.skill-card', grid);

  // FLIP the grid whenever its children are added/removed/reordered.
  const controller = autoAnimate(grid, {
    duration: prefersReducedMotion ? 0 : 320,
    easing: 'ease-out',
    disrespectUserMotionPreference: false,
  });

  function apply(filter) {
    let shown = 0;

    cards.forEach((card) => {
      const categories = (card.dataset.cat || '').split(' ');
      const match = filter === 'all' || categories.includes(filter);
      card.hidden = !match;
      if (match) shown += 1;
    });

    chips.forEach((chip) => {
      const isActive = chip.dataset.filter === filter;
      chip.classList.toggle('is-active', isActive);
      chip.setAttribute('aria-pressed', String(isActive));
    });

    const live = one('#filterStatus');
    if (live) {
      const label = chips.find((c) => c.dataset.filter === filter)?.dataset.label || filter;
      live.textContent = `${shown} ${shown === 1 ? 'capability' : 'capabilities'} shown${filter === 'all' ? '' : ` for ${label}`}`;
    }
  }

  chips.forEach((chip) => {
    chip.addEventListener('click', () => apply(chip.dataset.filter || 'all'));
  });

  // Keyboard: arrow keys move between chips, like a real tablist.
  bar.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const index = chips.indexOf(document.activeElement);
    if (index === -1) return;
    event.preventDefault();
    const next = event.key === 'ArrowRight' ? (index + 1) % chips.length : (index - 1 + chips.length) % chips.length;
    chips[next].focus();
    chips[next].click();
  });

  apply('all');

  return {
    destroy() {
      controller.destroy();
    },
  };
}
