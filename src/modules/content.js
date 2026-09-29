/**
 * Renders the document body from the same data module that feeds the 3D graph.
 *
 * One source of truth means a capability card and its node in the graph can
 * never disagree, and clicking either resolves to the same record.
 */
import { ROLES, CAPABILITIES } from '../data/graph.js';
import { one, all } from '../lib/prefs.js';

/** Filter categories per capability — drives the chip bar. */
const CATEGORIES = {
  agents: ['agents'],
  mcp: ['platform', 'data'],
  cloud: ['cloud'],
  observability: ['data', 'platform'],
  delivery: ['platform'],
  fullstack: ['product'],
};

const EDUCATION = [
  {
    meta: '2022 — 2024',
    title: 'Master of Computer Science',
    org: 'The University of Sydney · Sydney, Australia',
    body: 'Key courses: Machine Learning, Deep Learning, NLP, Multimedia Retrieval, Project Management.',
    capstone: {
      label: 'Capstone',
      text: '“Leveraging LLM for Decision Making” — an AI chatbot using LangChain and LLMs with real-time search integration and a decision-support system.',
    },
  },
  {
    meta: 'Macquarie Group · internal hackathon',
    title: 'Bastion — security assessment POC',
    org: 'Nominated for two awards',
    body: 'Nominated for Best Overall and Best Use of Data among 300+ submissions.',
    badges: ['🏆 Best Overall — nominated', '📊 Best Use of Data — nominated'],
  },
  {
    meta: 'Languages',
    title: 'Communication',
    langs: [
      ['Chinese (Mandarin)', 'Native'],
      ['English', 'Fluent'],
    ],
    body: 'References available on request.',
  },
];

const esc = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ── Experience timeline ─────────────────────────────────────── */

function renderTimeline() {
  const list = one('#timeline');
  if (!list) return;

  list.innerHTML = ROLES.map((role) => `
    <li class="tl-item" data-node="${esc(role.id)}">
      <button type="button" class="tl-body" aria-label="Open ${esc(role.label)} details">
        <div class="tl-left">
          <h3>${esc(role.subtitle)}</h3>
          <p class="tl-org">${esc(role.label)}</p>
          <span class="tl-period">${esc(role.period)} · ${esc(role.location)}</span>
          <span class="tl-open">open node →</span>
        </div>
        <div class="tl-right">
          <ul class="tl-points">
            ${role.points.map((point) => `<li>${esc(point)}</li>`).join('')}
          </ul>
          ${role.footnote ? `<p class="tl-foot">${esc(role.footnote)}</p>` : ''}
        </div>
      </button>
    </li>
  `).join('');
}

/* ── Capability grid ─────────────────────────────────────────── */

function renderCapabilities() {
  const grid = one('#capGrid');
  if (!grid) return;

  grid.innerHTML = CAPABILITIES.map((cap, index) => {
    const cats = (CATEGORIES[cap.id] || []).join(' ');
    const idx = String(index + 1).padStart(2, '0');
    return `
      <button type="button" class="cap-card reveal" data-node="${esc(cap.id)}" data-cat="${esc(cats)}"
              aria-label="Open ${esc(cap.label)} details">
        <div class="cap-top">
          <span class="cap-idx">${idx}</span>
          <span class="cap-open">open node →</span>
        </div>
        <h3>${esc(cap.label)}</h3>
        <p>${esc(cap.detail)}</p>
        <ul class="cap-tags">
          ${cap.tags.map((tag) => `<li>${esc(tag)}</li>`).join('')}
        </ul>
      </button>`;
  }).join('');
}

/* ── Education ───────────────────────────────────────────────── */

function renderEducation() {
  const grid = one('#eduGrid');
  if (!grid) return;

  grid.innerHTML = EDUCATION.map((item) => `
    <article class="edu-card reveal">
      <span class="edu-meta">${esc(item.meta)}</span>
      <h3>${esc(item.title)}</h3>
      <p class="edu-org">${esc(item.org)}</p>
      ${item.langs ? `
        <ul class="lang-list">
          ${item.langs.map(([name, level]) => `
            <li><span>${esc(name)}</span><span class="lang-level">${esc(level)}</span></li>`).join('')}
        </ul>` : ''}
      <p class="edu-body">${esc(item.body)}</p>
      ${item.capstone ? `
        <div class="capstone">
          <span class="mono">${esc(item.capstone.label)}</span>
          <p>${esc(item.capstone.text)}</p>
        </div>` : ''}
      ${item.badges ? `
        <div class="award-badges">
          ${item.badges.map((badge) => `<span class="badge">${esc(badge)}</span>`).join('')}
        </div>` : ''}
    </article>
  `).join('');
}

export function renderContent() {
  renderTimeline();
  renderCapabilities();
  renderEducation();
}

/** Every rendered element that maps to a graph node. */
export const nodeElements = () => all('[data-node]');
