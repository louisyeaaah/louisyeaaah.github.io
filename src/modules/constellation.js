/**
 * The capability map — the second screen.
 *
 * A bipartite force graph: roles on the left, what they actually required on
 * the right, the work joining them. Every node is draggable and springs home.
 *
 * The reason this is a graph and not something more exotic: the previous
 * version of this site drew the same relationships in 3D, where the labels
 * flew past faster than anyone could read them. Here you are holding the
 * layout, so a label is exactly where you left it.
 *
 * Canvas 2D at 60fps for ~11 nodes and ~18 edges, which is nothing, and the
 * labels stay real DOM-quality text instead of texture atlas guesswork.
 */
import { ROLES, CAPABILITIES, EDGES } from '../data/graph.js';
import { prefersReducedMotion } from '../lib/prefs.js';

const SPRING = 26;        // pull back toward the resting layout
const DAMPING = 5.2;      // velocity decay
const REPULSION = 5200;   // node-node push, so nothing overlaps
const GRAB_RADIUS = 30;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Which capabilities a role touches, and how many roles a capability needs. */
function build() {
  const nodes = new Map();
  const edges = [];

  ROLES.forEach((role) => {
    nodes.set(role.id, {
      id: role.id, label: role.label || role.short || role.id,
      short: role.short || role.label, kind: 'role',
      x: 0, y: 0, vx: 0, vy: 0, hx: 0, hy: 0,
      r: 6.5, label_: role.label,
    });
  });

  CAPABILITIES.forEach((cap) => {
    nodes.set(cap.id, {
      id: cap.id, label: cap.label, short: cap.short,
      kind: 'cap',
      x: 0, y: 0, vx: 0, vy: 0, hx: 0, hy: 0,
      r: 4.5,
    });
  });

  EDGES.forEach((edge) => {
    if (nodes.has(edge.from) && nodes.has(edge.to)) {
      edges.push({ a: edge.from, b: edge.to });
    }
  });

  return { nodes: [...nodes.values()], edges };
}

export function initConstellation(canvas) {
  if (!canvas) return { destroy() {} };
  const ctx = canvas.getContext('2d');
  if (!ctx) return { destroy() {} };

  const { nodes, edges } = build();
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Neighbour lookup, so hovering one node can dim everything unrelated.
  const neighbours = new Map(nodes.map((n) => [n.id, new Set([n.id])]));
  edges.forEach(({ a, b }) => {
    neighbours.get(a)?.add(b);
    neighbours.get(b)?.add(a);
  });

  const state = {
    w: 0, h: 0, dpr: 1, time: 0,
    px: -9999, py: -9999,
    hover: null,
    drag: null,
    pointerDown: false,
  };

  /* ── layout: a bipartite pair of columns, which reads instantly ─── */
  function layout() {
    const padX = clamp(state.w * 0.24, 130, 260);
    const roles = nodes.filter((n) => n.kind === 'role');
    const caps = nodes.filter((n) => n.kind === 'cap');

    roles.forEach((n, i) => {
      n.hx = padX;
      n.hy = state.h * (0.20 + (0.62 * i) / Math.max(roles.length - 1, 1));
    });
    caps.forEach((n, i) => {
      n.hx = state.w - padX;
      n.hy = state.h * (0.16 + (0.68 * i) / Math.max(caps.length - 1, 1));
    });

    // Only seed positions on first layout; afterwards let physics settle.
    nodes.forEach((n) => {
      if (n.x === 0 && n.y === 0) { n.x = n.hx; n.y = n.hy; }
    });
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    state.w = Math.max(rect.width, 1);
    state.h = Math.max(rect.height, 1);
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(state.w * state.dpr);
    canvas.height = Math.round(state.h * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    layout();
  }

  /* ── physics ────────────────────────────────────────────────────── */
  function step(dt) {
    // Repulsion first, so a dragged node parts the field around it.
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) { d2 = 1; dx = 0.01; dy = 0.01; }
        if (d2 > 180 * 180) continue;
        const f = REPULSION / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * f * dt;
        const fy = (dy / d) * f * dt;
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;
      }
    }

    nodes.forEach((n) => {
      if (state.drag === n) return;
      // Spring home, plus damping. Frame-rate independent.
      n.vx += (n.hx - n.x) * SPRING * dt;
      n.vy += (n.hy - n.y) * SPRING * dt;
      const decay = Math.exp(-DAMPING * dt);
      n.vx *= decay;
      n.vy *= decay;
      n.x += n.vx * dt;
      n.y += n.vy * dt;
    });
  }

  /* ── drawing ────────────────────────────────────────────────────── */
  function nodeAt(x, y) {
    let best = null;
    let bestD = GRAB_RADIUS;
    nodes.forEach((n) => {
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < bestD) { bestD = d; best = n; }
    });
    return best;
  }

  function drawEdge(edge, focus, t) {
    const a = byId.get(edge.a);
    const b = byId.get(edge.b);
    if (!a || !b) return;

    const related = !focus || neighbours.get(focus.id)?.has(a.id) || neighbours.get(focus.id)?.has(b.id);
    const lit = focus && (a.id === focus.id || b.id === focus.id);
    const alpha = focus ? (related ? (lit ? 0.85 : 0.22) : 0.06) : 0.20;

    const mx = (a.x + b.x) / 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.bezierCurveTo(mx, a.y, mx, b.y, b.x, b.y);
    ctx.strokeStyle = lit ? `rgba(217,119,87,${alpha})` : `rgba(242,237,228,${alpha})`;
    ctx.lineWidth = lit ? 1.4 : 1;
    ctx.stroke();

    // A slow packet travelling the edge, so the map feels wired up rather than
    // drawn. Only on the lit edges — everywhere else it would be noise.
    if (lit) {
      const p = (t * 0.28 + (a.id.length * 0.13) % 1) % 1;
      const it = 1 - p;
      const px = it * it * it * a.x + 3 * it * it * p * mx + 3 * it * p * p * mx + p * p * p * b.x;
      const py = it * it * it * a.y + 3 * it * it * p * a.y + 3 * it * p * p * b.y + p * p * p * b.y;
      const g = ctx.createRadialGradient(px, py, 0, px, py, 9);
      g.addColorStop(0, 'rgba(255,196,150,.95)');
      g.addColorStop(1, 'rgba(217,119,87,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawNode(n, focus, t) {
    const related = !focus || neighbours.get(focus.id)?.has(n.id);
    const isFocus = focus === n;
    const alpha = focus ? (related ? 1 : 0.22) : 1;

    // Breathing halo.
    const pulse = 1 + 0.10 * Math.sin(t * 1.1 + n.x * 0.01);
    const radius = (n.kind === 'role' ? 15 : 11) * pulse;
    const accent = n.kind === 'role' ? [242, 237, 228] : [217, 119, 87];

    const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, radius * 3.2);
    g.addColorStop(0, `rgba(${accent.join(',')},${0.55 * alpha})`);
    g.addColorStop(0.35, `rgba(${accent.join(',')},${0.16 * alpha})`);
    g.addColorStop(1, `rgba(${accent.join(',')},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(n.x, n.y, radius * 3.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r * (isFocus ? 1.25 : 1), 0, Math.PI * 2);
    ctx.fillStyle = isFocus ? '#FFFFFF' : `rgba(${accent.join(',')},${alpha})`;
    ctx.fill();

    // Roles get a ring so the two columns are distinguishable at a glance.
    if (n.kind === 'role') {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r + 5, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(242,237,228,${0.28 * alpha})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Labels: outside the columns, so nothing overlaps the edges.
    const isRole = n.kind === 'role';
    const lx = n.x + (isRole ? -(n.r + 14) : n.r + 14);
    ctx.textAlign = isRole ? 'right' : 'left';
    ctx.textBaseline = 'middle';

    ctx.font = `${isFocus ? 500 : 400} 14px "Inter Tight", Inter, system-ui, sans-serif`;
    ctx.fillStyle = `rgba(242,237,228,${(isFocus ? 1 : 0.88) * alpha})`;
    ctx.fillText(n.label, lx, n.y - (isRole ? 0 : 7));

    ctx.font = '10px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillStyle = `rgba(168,162,154,${0.75 * alpha})`;
    ctx.fillText(isRole ? 'role' : (n.short || 'capability'), lx, n.y + (isRole ? 14 : 7));
  }

  function draw() {
    if (!state.w) return;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.clearRect(0, 0, state.w, state.h);

    const focus = state.drag || state.hover;

    edges.forEach((e) => drawEdge(e, focus, state.time));
    nodes.forEach((n) => drawNode(n, focus, state.time));
  }

  /* ── loop ───────────────────────────────────────────────────────── */
  let rafId = null;
  let running = false;
  let visible = true;
  let last = performance.now();

  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    state.time += dt;
    step(dt);
    draw();
    if (running) rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (running || !visible) return;
    running = true;
    last = performance.now();
    rafId = requestAnimationFrame(tick);
  }
  function stop() {
    running = false;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  /* ── pointer ────────────────────────────────────────────────────── */
  function toLocal(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function onMove(event) {
    const { x, y } = toLocal(event);
    state.px = x; state.py = y;
    if (state.drag) {
      state.drag.x = x; state.drag.y = y;
      state.drag.vx = 0; state.drag.vy = 0;
      canvas.style.cursor = 'grabbing';
      return;
    }
    const hit = nodeAt(x, y);
    state.hover = hit;
    canvas.style.cursor = hit ? 'grab' : 'default';
  }

  function onDown(event) {
    const { x, y } = toLocal(event);
    const hit = nodeAt(x, y);
    if (!hit) return;
    state.drag = hit;
    state.pointerDown = true;
    canvas.setPointerCapture?.(event.pointerId);
    canvas.style.cursor = 'grabbing';
  }

  function onUp(event) {
    if (state.drag) {
      // Hand the drag velocity back to the physics, so a flick throws it.
      const { x, y } = toLocal(event);
      state.drag.vx = (x - state.drag.x) * 2.5;
      state.drag.vy = (y - state.drag.y) * 2.5;
      state.drag = null;
    }
    state.pointerDown = false;
    canvas.releasePointerCapture?.(event.pointerId);
    canvas.style.cursor = state.hover ? 'grab' : 'default';
  }

  function onClick(event) {
    const { x, y } = toLocal(event);
    const hit = nodeAt(x, y);
    // A click opens the same detail panel the rest of the page uses.
    if (hit) {
      window.dispatchEvent(new CustomEvent('node:open', { detail: { id: hit.id } }));
      canvas.dispatchEvent(new CustomEvent('constellation:select', { detail: { id: hit.id }, bubbles: true }));
      document.querySelector(`[data-node="${hit.id}"]`)?.click?.();
    }
  }

  canvas.addEventListener('pointermove', onMove, { passive: true });
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', () => {
    if (!state.drag) { state.hover = null; canvas.style.cursor = 'default'; }
  });
  canvas.addEventListener('click', onClick);
  window.addEventListener('resize', resize, { passive: true });

  resize();

  if (prefersReducedMotion) {
    // Settle the layout analytically, then draw one still frame.
    for (let i = 0; i < 240; i += 1) step(1 / 60);
    draw();
    return { destroy() { window.removeEventListener('resize', resize); } };
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !document.hidden) start();
      else stop();
    }, { threshold: 0 }).observe(canvas);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (visible) start();
  });

  start();

  return {
    destroy() {
      stop();
      window.removeEventListener('resize', resize);
    },
  };
}
