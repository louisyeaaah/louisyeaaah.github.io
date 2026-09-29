/**
 * The Context Window — the opening shot.
 *
 * Tokens stream in from the right and travel across a bounded frame. When the
 * window is full, the oldest token dissolves and falls away. Nothing is kept
 * because it matters; things are kept because they still fit.
 *
 * That is the whole idea: a model's memory is a fixed-size buffer, forgetting
 * is the default, and the engineering work is deciding what earns a slot.
 *
 * Canvas 2D rather than WebGL. Text is the entire point here, and after the
 * first version of this hero shipped with labels too small and too fast to
 * read, legibility beat shader tricks.
 */
import { one, prefersReducedMotion } from '../lib/prefs.js';

/** The vocabulary that fills the window — drawn from the work itself. */
const TOKENS = [
  'multi-agent systems',
  'MCP tooling',
  'observability',
  'incident triage',
  'agentic RAG',
  'code analysis',
  'LangGraph',
  'AWS EKS · Bedrock',
  'evaluation',
  'human handoff',
  'Pydantic AI',
  'telemetry',
];

const SLOTS = 5;          // tokens visible at once
const HOLD = 2.9;         // seconds before the window advances one slot
const TRAVEL = 0.72;      // fraction of a slot width covered while fading in

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function initContextWindow(canvas) {
  if (!canvas) return { destroy() {} };

  const ctx = canvas.getContext('2d');
  if (!ctx) return { destroy() {} };

  const state = {
    w: 0, h: 0, dpr: 1,
    time: 0,
    pointer: { x: -9999, y: -9999, active: false },
    cursorToken: -1,
  };

  /* ── sizing ──────────────────────────────────────────────────── */
  function resize() {
    const rect = canvas.getBoundingClientRect();
    state.w = Math.max(rect.width, 1);
    state.h = Math.max(rect.height, 1);
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(state.w * state.dpr);
    canvas.height = Math.round(state.h * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  }

  /* ── the frame the tokens live inside ────────────────────────── */
  function frame() {
    const padX = Math.max(28, state.w * 0.06);
    const bandH = clamp(state.h * 0.17, 76, 128);
    // Clear of the title card: the copy owns the upper two thirds.
    const cy = state.h * 0.845;
    return {
      x0: padX,
      x1: state.w - padX,
      y0: cy - bandH / 2,
      y1: cy + bandH / 2,
      cy,
    };
  }

  /**
   * Token i's position at time t.
   * Slots advance every HOLD seconds; each token enters at the right edge and
   * exits past the left one, so the window always shows exactly SLOTS tokens.
   */
  function tokenAt(index, time) {
    const box = frame();
    const slotW = (box.x1 - box.x0) / SLOTS;
    const phase = time / HOLD;                 // advances one slot per HOLD
    const position = index - phase;            // >0 = still to the right

    const x = box.x1 - (position + 0.5) * slotW;
    const span = box.x1 - box.x0;

    // Fade against the frame edges so nothing is ever legible outside the
    // window — the boundary is the whole point of the piece.
    const edge = Math.max((box.x1 - box.x0) * 0.13, slotW * 0.45);
    const alpha = Math.min(
      smoothstep(box.x1, box.x1 - edge, x),
      smoothstep(box.x0, box.x0 + edge, x),
    );

    return {
      x,
      y: box.cy,
      alpha: clamp(alpha, 0, 1),
      inWindow: x > box.x0 - slotW && x < box.x1 + slotW,
      slotW,
      span,
      age: position,
    };
  }

  /* ── attention: lines form toward whatever the pointer is near ── */
  function nearestTokenIndex(time) {
    if (!state.pointer.active) return -1;
    let best = -1;
    let bestDist = 220;
    for (let i = 0; i < TOKENS.length + SLOTS; i += 1) {
      const t = tokenAt(i, time);
      if (!t.inWindow || t.alpha < 0.25) continue;
      const d = Math.abs(t.x - state.pointer.x);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }

  function drawAttention(time) {
    const focus = state.cursorToken;
    if (focus < 0) return;
    const origin = tokenAt(focus, time);
    if (origin.alpha < 0.2) return;

    ctx.save();
    ctx.lineWidth = 1;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = focus - 2; i <= focus + 2; i += 1) {
      if (i === focus) continue;
      const other = tokenAt(i, time);
      if (!other.inWindow || other.alpha < 0.2) continue;

      const strength = (1 - Math.abs(i - focus) / 3) * other.alpha * origin.alpha;
      const bow = (i < focus ? -1 : 1) * 26;

      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y + 22);
      ctx.quadraticCurveTo(
        (origin.x + other.x) / 2, origin.y + 22 + bow,
        other.x, other.y + 22,
      );
      ctx.strokeStyle = `rgba(217,119,87,${(strength * 0.55).toFixed(3)})`;
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ── the frame chrome + capacity readout ─────────────────────── */
  function drawChrome(time, alpha) {
    const box = frame();
    const fill = ((time / HOLD) % SLOTS) / SLOTS;
    const capacity = 0.55 + 0.45 * Math.abs(Math.sin(time * 0.22));

    ctx.save();
    ctx.globalAlpha = alpha;

    // Hairline frame with corner ticks — a bounded buffer, drawn as one.
    ctx.strokeStyle = 'rgba(242,237,228,.13)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(box.x0, box.y0 + 12);
    ctx.lineTo(box.x0, box.y0);
    ctx.lineTo(box.x0 + 12, box.y0);
    ctx.moveTo(box.x1 - 12, box.y0);
    ctx.lineTo(box.x1, box.y0);
    ctx.lineTo(box.x1, box.y0 + 12);
    ctx.moveTo(box.x1, box.y1 - 12);
    ctx.lineTo(box.x1, box.y1);
    ctx.lineTo(box.x1 - 12, box.y1);
    ctx.moveTo(box.x0 + 12, box.y1);
    ctx.lineTo(box.x0, box.y1);
    ctx.lineTo(box.x0, box.y1 - 12);
    ctx.stroke();

    // Capacity rail: how full the window is right now.
    const railY = box.y0 - 30;
    ctx.fillStyle = 'rgba(242,237,228,.10)';
    ctx.fillRect(box.x0, railY, box.x1 - box.x0, 1);
    ctx.fillStyle = `rgba(217,119,87,${capacity.toFixed(2)})`;
    ctx.fillRect(box.x0, railY, (box.x1 - box.x0) * fill, 1);

    ctx.font = '11px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillStyle = 'rgba(168,162,154,.85)';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${SLOTS} / ${SLOTS} tokens`, box.x0, railY - 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(168,162,154,.5)';
    ctx.fillText('the oldest drops', box.x1, railY - 2);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  /* ── draw ────────────────────────────────────────────────────── */
  function draw() {
    if (!state.w) return;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.clearRect(0, 0, state.w, state.h);

    const box = frame();
    const slotW = (box.x1 - box.x0) / SLOTS;
    const fontSize = clamp(slotW * 0.13, 14, 26);

    // Everything inside the window is clipped to it.
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x0 - 2, box.y0 - 8, (box.x1 - box.x0) + 4, (box.y1 - box.y0) + 30);
    ctx.clip();

    drawAttention(state.time);

    // Tokens. Newest right, oldest left, dissolving across the left edge.
    for (let i = 0; i < TOKENS.length; i += 1) {
      const t = tokenAt(i, state.time);
      if (!t.inWindow || t.alpha <= 0.01) continue;

      const focus = i === state.cursorToken;
      const blur = (1 - t.alpha) * 4.5;

      ctx.save();
      ctx.globalAlpha = t.alpha * (focus ? 1 : 0.86);
      ctx.filter = blur > 0.2 ? `blur(${blur.toFixed(2)}px)` : 'none';
      ctx.font = `${focus ? 500 : 400} ${fontSize}px "Inter Tight", Inter, system-ui, sans-serif`;
      ctx.fillStyle = focus ? '#F2EDE4' : (i % 2 === 0 ? '#DEDCD1' : '#C9C6BD');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(TOKENS[i], t.x, t.y);
      ctx.restore();
    }
    ctx.restore();

    drawChrome(state.time, 1);
  }

  /* ── loop ────────────────────────────────────────────────────── */
  let rafId = null;
  let running = false;
  let last = performance.now();
  let visible = true;

  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    state.time += dt;
    state.cursorToken = state.pointer.active ? nearestTokenIndex(state.time) : -1;
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

  /* ── pointer ─────────────────────────────────────────────────── */
  function onPointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    state.pointer.x = event.clientX - rect.left;
    state.pointer.y = event.clientY - rect.top;
    state.pointer.active = true;
  }
  function onPointerLeave() {
    state.pointer.active = false;
    state.pointer.x = -9999;
    state.cursorToken = -1;
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('pointerleave', onPointerLeave);
  window.addEventListener('resize', resize, { passive: true });

  resize();

  if (prefersReducedMotion) {
    // One still frame: a full window, mid-cycle.
    state.time = HOLD * 2.5;
    draw();
    return { destroy() {} };
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
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('resize', resize);
    },
  };
}
