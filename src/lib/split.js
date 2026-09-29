/**
 * Thin SplitType wrapper.
 *
 * Accessibility is the whole point of this file: naively splitting a heading
 * into characters makes screen readers announce it letter by letter. So after
 * splitting we (1) put the original text on the container as `aria-label`,
 * (2) mark the generated fragments `aria-hidden`, and (3) expose helpers that
 * return the created parts for GSAP to animate.
 */
import SplitType from 'split-type';

const registry = [];

/**
 * @param {HTMLElement} el
 * @param {object} [options]
 * @param {string} [options.types='lines,words,chars']
 * @returns {{el: HTMLElement, lines: HTMLElement[], words: HTMLElement[], chars: HTMLElement[], revert: () => void}}
 */
export function splitText(el, options = {}) {
  if (!el) return emptyHandle(el);

  const original = el.textContent.replace(/\s+/g, ' ').trim();

  const split = new SplitType(el, {
    types: options.types || 'lines,words,chars',
    tagName: 'span',
    lineClass: 'split-line',
    wordClass: 'split-word',
    charClass: 'split-char',
    absolute: false,
  });

  // Preserve the readable text for assistive tech, hide the fragments.
  el.setAttribute('aria-label', original);
  [split.lines, split.words, split.chars].forEach((group) => {
    (group || []).forEach((node) => node.setAttribute('aria-hidden', 'true'));
  });

  const handle = {
    el,
    lines: split.lines || [],
    words: split.words || [],
    chars: split.chars || [],
    revert() {
      split.revert();
      el.removeAttribute('aria-label');
    },
  };

  registry.push(handle);
  return handle;
}

function emptyHandle(el) {
  return { el, lines: [], words: [], chars: [], revert() {} };
}

/**
 * Re-split every registered heading after a resize settles — line breaks
 * change with width, so stale line splits would animate the wrong things.
 * SplitType has no built-in "re-split", so we revert and split again.
 */
export function autoResplit(callback) {
  let timer = null;
  let lastWidth = window.innerWidth;

  window.addEventListener('resize', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;

      const targets = registry.map((handle) => ({
        el: handle.el,
        types: handle.chars.length ? 'lines,words,chars' : 'lines,words',
      }));

      revertAll();
      targets.forEach(({ el, types }) => {
        const handle = splitText(el, { types });
        callback?.(handle);
      });
    }, 220);
  });
}

export function revertAll() {
  while (registry.length) registry.pop().revert();
}
