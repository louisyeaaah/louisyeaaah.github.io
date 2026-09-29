/**
 * UI shell: the node panel, the command palette, the HUD and nav state.
 *
 * Every piece of chrome is plain DOM — searchable, focusable and readable by
 * assistive tech, with the animated layers kept strictly decorative.
 */
import { ROLES, CAPABILITIES, nodeById } from '../data/graph.js';
import { one, all } from '../lib/prefs.js';

const esc = (v) =>
  String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const SECTIONS = [
  { id: 'about', label: 'About' },
  { id: 'map', label: 'Capability map' },
  { id: 'experience', label: 'Experience' },
  { id: 'capabilities', label: 'Capabilities' },
  { id: 'education', label: 'Education' },
  { id: 'contact', label: 'Contact' },
];

/** Progress ranges for the HUD's zone readout. */
const ZONES = [
  [0.00, 'approach'],
  [0.16, 'discovery'],
  [0.34, 'tool layer'],
  [0.52, 'inference'],
  [0.70, 'telemetry'],
  [0.86, 'core'],
];

export function initUI() {
  const panel = one('#panel');
  const scrim = one('#scrim');
  const palette = one('#palette');
  const paletteInput = one('#paletteInput');
  const paletteList = one('#paletteList');
  const hud = one('#hud');
  const navWrap = one('#navWrap');
  const lightChapter = one('.chapter-light');

  let openId = null;
  let lastFocused = null;

  /* ── Node panel ─────────────────────────────────────────────── */

  function nodeToPanel(id) {
    const node = nodeById(id);
    if (!node) return null;
    const isRole = Boolean(node.subtitle);
    return {
      kind: isRole ? 'experience' : 'capability',
      title: node.label,
      sub: isRole ? node.subtitle : '',
      meta: isRole ? `${node.period} · ${node.location}` : node.tags.join(' · '),
      points: isRole ? node.points : [node.detail],
      footnote: node.footnote || '',
      tags: isRole ? [] : node.tags,
      section: node.section,
    };
  }

  function openPanel(id, { focus = true } = {}) {
    const data = nodeToPanel(id);
    if (!data || !panel) return;

    openId = id;
    lastFocused = document.activeElement;

    one('#panelKind').textContent = data.kind;
    one('#panelTitle').textContent = data.title;
    one('#panelSub').textContent = data.sub;
    one('#panelSub').hidden = !data.sub;
    one('#panelMeta').textContent = data.meta;

    one('#panelBody').innerHTML = `
      <ul class="panel-points">
        ${data.points.map((p) => `<li>${esc(p)}</li>`).join('')}
      </ul>
      ${data.footnote ? `<p class="edu-body" style="margin-bottom:24px">${esc(data.footnote)}</p>` : ''}
      ${data.tags.length ? `<ul class="panel-tags">${data.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    `;

    panel.classList.add('on');
    panel.setAttribute('aria-hidden', 'false');
    scrim?.classList.add('on');

    // Reflect selection in the document body too.
    all('[data-node]').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.node === id);
    });

    if (focus) one('#panelClose')?.focus({ preventScroll: true });
  }

  function closePanel({ restoreFocus = true } = {}) {
    if (!openId) return;
    openId = null;
    panel?.classList.remove('on');
    panel?.setAttribute('aria-hidden', 'true');
    scrim?.classList.remove('on');
    all('[data-node]').forEach((el) => el.classList.remove('is-active'));
    if (restoreFocus && lastFocused instanceof HTMLElement) {
      lastFocused.focus({ preventScroll: true });
    }
  }

  one('#panelClose')?.addEventListener('click', () => closePanel());
  scrim?.addEventListener('click', () => {
    closePalette();
    closePanel();
  });

  /* ── Clicking any [data-node] opens its panel ───────────────── */

  document.addEventListener('click', (event) => {
    const target = event.target.closest?.('[data-node]');
    if (!target) return;
    event.preventDefault();
    openPanel(target.dataset.node);
  });

  /* ── Command palette ────────────────────────────────────────── */

  // `keywords` carries the aliases people actually type. Without them the
  // obvious query "agents" missed the node labelled "Multi-Agent Systems".
  const PALETTE_ITEMS = [
    ...ROLES.map((role) => ({
      kind: 'Experience',
      label: role.label,
      hint: role.period,
      node: role.id,
      keywords: `${role.short} ${role.subtitle} ${role.location} ${role.period} ${role.caps.join(' ')}`,
    })),
    ...CAPABILITIES.map((cap) => ({
      kind: 'Capability',
      label: cap.label,
      hint: cap.tags[0],
      node: cap.id,
      keywords: `${cap.short} ${cap.tags.join(' ')} ${cap.detail}`,
    })),
    ...SECTIONS.map((section) => ({
      kind: 'Section',
      label: section.label,
      hint: `#${section.id}`,
      section: section.id,
      keywords: `${section.id} jump go`,
    })),
    { kind: 'Link', label: 'Animation lab', hint: '/lab.html', href: '/lab.html', keywords: 'demo libraries evaluation' },
    { kind: 'Link', label: 'Email — zhipengye927@gmail.com', hint: 'mailto', href: 'mailto:zhipengye927@gmail.com', keywords: 'contact hire reach' },
    { kind: 'Link', label: 'LinkedIn', hint: 'external', href: 'https://www.linkedin.com/in/zhipeng-ye', keywords: 'contact profile social' },
  ];

  /** Every whitespace-separated term must appear somewhere in the item. */
  function matchesQuery(item, query) {
    const haystack = `${item.label} ${item.kind} ${item.hint ?? ''} ${item.keywords ?? ''}`.toLowerCase();
    return query.split(/\s+/).filter(Boolean).every((term) => haystack.includes(term));
  }

  let paletteItems = PALETTE_ITEMS;
  let selectedIndex = 0;
  let paletteOpen = false;

  function renderPalette(query = '') {
    const q = query.trim().toLowerCase();
    paletteItems = q ? PALETTE_ITEMS.filter((item) => matchesQuery(item, q)) : PALETTE_ITEMS;

    selectedIndex = 0;

    if (!paletteItems.length) {
      paletteList.innerHTML = '<li class="palette-empty">No matches. Try “agents”, “cloud” or “contact”.</li>';
      return;
    }

    paletteList.innerHTML = paletteItems.map((item, index) => `
      <li class="palette-item${index === 0 ? ' is-sel' : ''}" role="option" data-index="${index}"
          aria-selected="${index === 0}">
        <span class="palette-item-kind">${esc(item.kind)}</span>
        <span class="palette-item-label">${esc(item.label)}</span>
        <span class="palette-item-hint">${esc(item.hint ?? '')}</span>
      </li>
    `).join('');
  }

  function moveSelection(delta) {
    if (!paletteItems.length) return;
    selectedIndex = (selectedIndex + delta + paletteItems.length) % paletteItems.length;
    all('.palette-item', paletteList).forEach((el, index) => {
      const isSel = index === selectedIndex;
      el.classList.toggle('is-sel', isSel);
      el.setAttribute('aria-selected', String(isSel));
      if (isSel) el.scrollIntoView({ block: 'nearest' });
    });
  }

  function choose(index = selectedIndex) {
    const item = paletteItems[index];
    if (!item) return;
    closePalette();

    if (item.node) {
      openPanel(item.node);
    } else if (item.section) {
      scrollTo(`#${item.section}`);
    } else if (item.href) {
      if (item.href.startsWith('http')) window.open(item.href, '_blank', 'noopener');
      else window.location.href = item.href;
    }
  }

  function openPalette() {
    paletteOpen = true;
    palette?.classList.add('on');
    palette?.setAttribute('aria-hidden', 'false');
    paletteInput.value = '';
    renderPalette('');
    paletteInput.focus();
  }

  function closePalette() {
    if (!paletteOpen) return;
    paletteOpen = false;
    palette?.classList.remove('on');
    palette?.setAttribute('aria-hidden', 'true');
  }

  one('#paletteOpen')?.addEventListener('click', openPalette);
  paletteInput?.addEventListener('input', (event) => renderPalette(event.target.value));
  paletteList?.addEventListener('click', (event) => {
    const item = event.target.closest('.palette-item');
    if (item) choose(Number(item.dataset.index));
  });

  document.addEventListener('keydown', (event) => {
    const metaK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
    if (metaK) {
      event.preventDefault();
      paletteOpen ? closePalette() : openPalette();
      return;
    }
    if (event.key === 'Escape') {
      if (paletteOpen) return closePalette();
      if (openId) return closePanel();
    }
    if (paletteOpen) {
      if (event.key === 'ArrowDown') { event.preventDefault(); moveSelection(1); }
      if (event.key === 'ArrowUp') { event.preventDefault(); moveSelection(-1); }
      if (event.key === 'Enter') { event.preventDefault(); choose(); }
    }
  });

  /* ── Nav: light/dark state + active section ─────────────────── */

  if (lightChapter && 'IntersectionObserver' in window) {
    new IntersectionObserver(
      ([entry]) => navWrap?.classList.toggle('on-light', entry.isIntersecting),
      { rootMargin: '-72px 0px 0px 0px', threshold: 0 },
    ).observe(lightChapter);
  }

  const sectionEls = all('.chapter-light section[id]');
  const navAnchors = all('#navLinks a');
  if (sectionEls.length && navAnchors.length && 'IntersectionObserver' in window) {
    const activeObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          navAnchors.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${id}`));
        });
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 },
    );
    sectionEls.forEach((section) => activeObserver.observe(section));
  }

  // Sticky nav chrome.
  let stuck = false;
  window.addEventListener('scroll', () => {
    const next = window.scrollY > 24;
    if (next !== stuck) {
      stuck = next;
      navWrap?.classList.toggle('stuck', next);
    }
  }, { passive: true });

  return {
    openPanel,
    closePanel,
    get openId() { return openId; },
  };
}
