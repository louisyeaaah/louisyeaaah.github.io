/**
 * Pick a capability, see the evidence.
 *
 * This replaced a force-directed graph of roles and capabilities. The graph was
 * technically fine and conceptually useless: it drew a line between "Macquarie
 * Group" and "AI Observability" and left the visitor to guess what that line
 * meant. A line is a claim with the evidence removed.
 *
 * Here, choosing a capability shows the actual sentences from the roles where
 * it was used. Interaction exists to reveal information, not to be interacted
 * with — there is no physics, no drag, nothing to fiddle with. You click, and
 * you learn something you did not know a second ago.
 */
import { ROLES, CAPABILITIES, capabilityWeight } from '../data/graph.js';

const esc = (v) =>
  String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function initCapabilityExplorer() {
  const root = document.querySelector('#capabilityExplorer');
  if (!root) return null;

  const tabsEl = root.querySelector('#cxTabs');
  const panelEl = root.querySelector('#cxPanel');
  if (!tabsEl || !panelEl) return null;

  // Only capabilities that actually appear somewhere in the history.
  const caps = CAPABILITIES.filter((c) => capabilityWeight(c.id) > 0);
  let active = caps[0]?.id ?? null;

  /* ── the tabs ─────────────────────────────────────────────────── */
  tabsEl.innerHTML = caps.map((cap) => {
    const n = capabilityWeight(cap.id);
    return `<button type="button" role="tab" class="cx-tab" data-cap="${esc(cap.id)}"
              aria-selected="false" id="tab-${esc(cap.id)}"
              aria-controls="cxPanel">
        <span class="cx-tab-label">${esc(cap.label)}</span>
        <span class="cx-tab-count mono">${n} role${n === 1 ? '' : 's'}</span>
      </button>`;
  }).join('');

  /* ── the evidence ─────────────────────────────────────────────── */
  function render(id) {
    const cap = CAPABILITIES.find((c) => c.id === id);
    if (!cap) return;

    const where = ROLES.filter((role) => role.caps.includes(id));
    const total = where.reduce((sum, role) => sum + role.points.length, 0);

    panelEl.innerHTML = `
      <div class="cx-intro">
        <p class="cx-detail">${esc(cap.detail)}</p>
        <ul class="cx-tags" aria-label="Tools">
          ${(cap.tags || []).map((t) => `<li class="mono">${esc(t)}</li>`).join('')}
        </ul>
      </div>

      <p class="cx-summary mono">
        Used in ${where.length} of ${ROLES.length} roles &nbsp;·&nbsp; ${total} pieces of work below
      </p>

      <ol class="cx-roles">
        ${where.map((role) => `
          <li class="cx-role">
            <header class="cx-role-head">
              <h3 class="cx-role-name">${esc(role.label)}</h3>
              <p class="cx-role-meta mono">${esc(role.subtitle)} &nbsp;·&nbsp; ${esc(role.period)}</p>
            </header>
            <ul class="cx-points">
              ${role.points.map((p) => `<li>${esc(p)}</li>`).join('')}
            </ul>
          </li>`).join('')}
      </ol>
    `;

    // Let the new evidence arrive rather than snap.
    panelEl.querySelectorAll('.cx-role').forEach((el, i) => {
      el.animate?.(
        [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
        { duration: 380, delay: i * 70, easing: 'cubic-bezier(.165,.84,.44,1)', fill: 'backwards' },
      );
    });
  }

  /* ── selection ────────────────────────────────────────────────── */
  function select(id, { focus = false } = {}) {
    if (!CAPABILITIES.some((c) => c.id === id)) return;
    active = id;

    tabsEl.querySelectorAll('.cx-tab').forEach((tab) => {
      const on = tab.dataset.cap === id;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      if (on && focus) tab.focus();
    });

    render(id);
  }

  tabsEl.addEventListener('click', (event) => {
    const tab = event.target.closest('.cx-tab');
    if (tab) select(tab.dataset.cap);
  });

  // Standard tablist keyboard behaviour: arrows move, Home/End jump.
  tabsEl.addEventListener('keydown', (event) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const at = caps.findIndex((c) => c.id === active);
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? caps.length - 1
      : (event.key === 'ArrowRight' || event.key === 'ArrowDown')
        ? (at + 1) % caps.length
        : (at - 1 + caps.length) % caps.length;
    select(caps[next].id, { focus: true });
  });

  select(active);

  return {
    select,
    /** Called when a capability card elsewhere on the page is clicked. */
    open(id) {
      select(id);
      root.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
  };
}
