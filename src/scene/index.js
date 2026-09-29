/**
 * Scene orchestrator.
 *
 * Owns the renderer, the camera rig, the post chain, the pointer controls and
 * the HTML labels, and exposes a small imperative API the page drives:
 *
 *   scene.setProgress(0..1)   scroll position -> camera position on the flight path
 *   scene.select(id)          open a node (also triggered by clicking it)
 *   scene.setOrbit(y, p)      look offset, also driven by dragging
 *   scene.onSelect(fn)        called when the visitor clicks a node
 *
 * The camera rig is the interesting part: scroll drives a position along a
 * Catmull-Rom curve, while dragging adds a look-direction offset on top. The
 * two are kept in separate accumulators so they can never fight each other.
 */
import {
  ACESFilmicToneMapping,
  AmbientLight,
  CatmullRomCurve3,
  Color,
  DirectionalLight,
  FogExp2,
  PerspectiveCamera,
  PointLight,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';

import { createGraph } from './graph.js';
import { createComposer } from './post.js';
import { HEX } from './palette.js';
import { CAPABILITIES, ROLES, EDGES } from '../data/graph.js';
import { prefersReducedMotion, supportsWebGL, isSlowConnection } from '../lib/prefs.js';

const NODES = [...ROLES, ...CAPABILITIES];

/** The flight path. The graph lays its nodes out relative to this curve. */
const PATH = [
  [-5, 4, -62],
  [9, -3, -46],
  [-10, 6, -30],
  [7, 7, -14],
  [-8, -5, 2],
  [10, 3, 18],
  [-6, 7, 34],
  [8, -2, 50],
  [-4, 6, 66],
  [3, 0, 82],
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function createScene(canvas, { labelLayer } = {}) {
  /* ── capability detection ──────────────────────────────────── */
  if (!supportsWebGL()) return createFallback(canvas, 'no-webgl');

  let renderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
  } catch {
    return createFallback(canvas, 'no-context');
  }

  const isSmall = window.innerWidth < 760;
  const quality = isSmall || isSlowConnection ? 'low' : 'high';
  const dprCap = quality === 'high' ? 1.75 : 1.25;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.setClearColor(new Color(HEX.ink), 1);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new Scene();
  scene.fog = new FogExp2(new Color(HEX.ink).getHex(), 0.0075);

  const camera = new PerspectiveCamera(60, 1, 0.1, 600);
  camera.position.set(0, 6, -110);

  /* ── lighting: key + rim + a cold fill ─────────────────────── */
  scene.add(new AmbientLight(new Color(HEX.stone), 0.55));

  const key = new DirectionalLight(new Color(HEX.cream), 2.6);
  key.position.set(-24, 30, -18);
  scene.add(key);

  const rim = new DirectionalLight(new Color(HEX.clay), 2.1);
  rim.position.set(28, -10, 26);
  scene.add(rim);

  const fill = new PointLight(new Color(HEX.sky), 260, 220, 2);
  fill.position.set(0, 14, 10);
  scene.add(fill);

  /* ── graph ─────────────────────────────────────────────────── */
  const curve = new CatmullRomCurve3(
    PATH.map(([x, y, z]) => new Vector3(x, y, z)),
    false,
    'catmullrom',
    0.4,
  );

  const graph = createGraph({ nodes: NODES, edges: EDGES, curve, quality });

  scene.add(graph.group);

  /* ── post ──────────────────────────────────────────────────── */
  const size = { w: 1, h: 1 };
  const post = createComposer({ renderer, scene, camera, quality, width: 1, height: 1 });

  /* ── camera rig ────────────────────────────────────────────── */
  const rig = {
    progress: 0,
    eased: 0,
    targetOrbitYaw: 0,
    targetOrbitPitch: 0,
    orbitYaw: 0,
    orbitPitch: 0,
    parallaxX: 0,
    parallaxY: 0,
    targetParallaxX: 0,
    targetParallaxY: 0,
  };

  const up = new Vector3(0, 1, 0);
  const lookTarget = new Vector3();

  // Ease progress so scroll jitter never becomes camera jitter.
  function updateCamera(dt) {
    rig.eased += (rig.progress - rig.eased) * Math.min(dt * 3.4, 1);
    const t = clamp(rig.eased, 0, 1);

    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();

    rig.orbitYaw += (rig.targetOrbitYaw - rig.orbitYaw) * Math.min(dt * 5, 1);
    rig.orbitPitch += (rig.targetOrbitPitch - rig.orbitPitch) * Math.min(dt * 5, 1);
    rig.parallaxX += (rig.targetParallaxX - rig.parallaxX) * Math.min(dt * 2.6, 1);
    rig.parallaxY += (rig.targetParallaxY - rig.parallaxY) * Math.min(dt * 2.6, 1);

    // Look direction = forward along the path, rotated by the drag offset.
    const dir = tangent.clone()
      .applyAxisAngle(up, rig.orbitYaw)
      .applyAxisAngle(new Vector3(1, 0, 0), rig.orbitPitch)
      .normalize();

    // Slight lateral offset from the pointer so the world feels alive.
    const side = new Vector3().crossVectors(tangent, up).normalize();
    camera.position.copy(point)
      .addScaledVector(side, rig.parallaxX * 2.6)
      .addScaledVector(up, rig.parallaxY * 1.8);

    lookTarget.copy(camera.position).addScaledVector(dir, 26);
    camera.lookAt(lookTarget);

    // Bank into the curve — the detail that makes it feel like a flight.
    camera.rotateZ(-tangent.x * 0.22 + rig.orbitYaw * 0.18);
  }

  /* ── labels ────────────────────────────────────────────────── */
  const labels = new Map();
  if (labelLayer) {
    graph.features.forEach((feature) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'scene-label';
      el.dataset.nodeId = feature.id;
      el.innerHTML =
        `<span class="scene-label-dot"></span>` +
        `<span class="scene-label-text">${feature.short}</span>`;
      el.setAttribute('aria-label', `${feature.label} — open details`);
      labelLayer.appendChild(el);
      labels.set(feature.id, el);
    });
  }

  const projected = new Vector3();

  function updateLabels() {
    if (!labelLayer) return;
    const w = size.w;
    const h = size.h;

    graph.features.forEach((feature) => {
      const el = labels.get(feature.id);
      if (!el) return;

      projected.copy(feature.position);
      projected.y += feature.currentScale ? feature.currentScale * 1.9 : 2;

      const distance = camera.position.distanceTo(projected);
      projected.project(camera);

      const behind = projected.z > 1;
      const onScreen = projected.x > -1.1 && projected.x < 1.1 && projected.y > -1.1 && projected.y < 1.1;

      // Only label what is close enough to be worth reading.
      // Labels only earn their place once the copy has moved out of the way,
      // otherwise they sit on top of the headline.
      const budget = smoothstep(0.18, 0.34, rig.eased);
      const visibility = behind || !onScreen
        ? 0
        : smoothstep(58, 16, distance) * smoothstep(4, 12, distance) * budget;

      if (visibility <= 0.01) {
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
        return;
      }

      el.style.opacity = String(visibility);
      el.style.pointerEvents = 'auto';
      el.style.transform =
        `translate3d(${((projected.x + 1) / 2) * w}px, ${((1 - projected.y) / 2) * h}px, 0) translate(-50%, -50%)`;
    });
  }

  /* ── pointer: hover, click, drag-orbit ─────────────────────── */
  const raycaster = new Raycaster();
  const pointer = new Vector2(-10, -10);
  let pointerInside = false;

  const drag = { active: false, moved: false, startX: 0, startY: 0, yaw: 0, pitch: 0 };

  const interactiveSelector = 'a, button, input, textarea, select, [data-no-orbit]';

  function toNdc(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pick() {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(graph.mesh, false);
    if (!hits.length) return null;
    const { instanceId } = hits[0];
    return graph.features.find((feature) => feature.instanceIndex === instanceId) ?? null;
  }

  const onPointerMove = (event) => {
    if (!pointerInside) pointerInside = true;
    toNdc(event);

    // Parallax from raw pointer position.
    rig.targetParallaxX = clamp(pointer.x, -1, 1) * 0.5;
    rig.targetParallaxY = clamp(pointer.y, -1, 1) * 0.35;

    if (drag.active) {
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) > 7) {
        drag.moved = true;
        document.body.classList.add('is-orbiting');
      }
      if (drag.moved) {
        rig.targetOrbitYaw = drag.yaw - dx * 0.0042;
        rig.targetOrbitPitch = clamp(drag.pitch + dy * 0.0032, -0.55, 0.55);
      }
    }
  };

  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    if (event.target.closest?.(interactiveSelector)) return;
    drag.active = true;
    drag.moved = false;
    drag.startX = event.clientX;
    drag.startY = event.clientY;
    drag.yaw = rig.targetOrbitYaw;
    drag.pitch = rig.targetOrbitPitch;
  };

  const onPointerUp = (event) => {
    const wasDragging = drag.active;
    const moved = drag.moved;
    drag.active = false;
    drag.moved = false;
    document.body.classList.remove('is-orbiting');

    // A click on a node selects it — but only if it was not a drag.
    if (!wasDragging || moved) return;
    if (event.target.closest?.(interactiveSelector)) return;
    toNdc(event);
    const hit = pick();
    if (hit) {
      select(hit.id, { fromScene: true });
    }
  };

  const onPointerLeave = () => {
    pointerInside = false;
    pointer.x = -10;
    pointer.y = -10;
    rig.targetParallaxX = 0;
    rig.targetParallaxY = 0;
    drag.active = false;
    document.body.classList.remove('is-orbiting');
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  document.addEventListener('pointerleave', onPointerLeave);

  /* ── selection ─────────────────────────────────────────────── */
  let selectedId = null;
  const selectHandlers = new Set();

  function select(id, meta = {}) {
    selectedId = id;
    graph.setSelected(id);
    selectHandlers.forEach((fn) => fn(id, meta));
  }

  /* ── render loop ───────────────────────────────────────────── */
  let rafId = null;
  let running = false;
  let visible = true;
  let last = performance.now();
  let elapsed = 0;
  let hoverThrottle = 0;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    elapsed += dt;

    updateCamera(dt);
    graph.update(dt, camera);
    post.update(dt);

    // Hover picking does not need to run every frame.
    hoverThrottle += dt;
    if (hoverThrottle > 0.05 && pointerInside && !drag.moved) {
      hoverThrottle = 0;
      const hit = pick();
      graph.setHover(hit ? hit.id : null);
    }

    updateLabels();
    post.composer.render();

    if (running) rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  /* ── sizing ────────────────────────────────────────────────── */
  function resize() {
    const w = Math.max(window.innerWidth, 1);
    const h = Math.max(window.innerHeight, 1);
    size.w = w;
    size.h = h;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    post.setSize(w, h);
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (visible) start();
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !document.hidden) start();
      else stop();
    }, { threshold: 0 }).observe(canvas);
  }

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    stop();
  });

  /* ── reduced motion: one clean frame, no loop ──────────────── */
  if (prefersReducedMotion) {
    rig.progress = 0.04;
    rig.eased = 0.04;
    updateCamera(1);
    graph.update(0.016, camera);
    updateLabels();
    renderer.render(scene, camera);
  } else {
    start();
  }

  /* ── public API ────────────────────────────────────────────── */
  return {
    scene,
    camera,
    graph,
    renderer,

    setProgress(value) {
      rig.progress = clamp(value, 0, 1);
      if (prefersReducedMotion) {
        rig.eased = rig.progress;
        updateCamera(1);
        updateLabels();
        renderer.render(scene, camera);
      }
    },

    setOrbit(yaw, pitch = 0) {
      rig.targetOrbitYaw = yaw;
      rig.targetOrbitPitch = clamp(pitch, -0.55, 0.55);
    },

    resetOrbit() {
      rig.targetOrbitYaw = 0;
      rig.targetOrbitPitch = 0;
      rig.targetParallaxX = 0;
      rig.targetParallaxY = 0;
    },

    select: (id) => select(id),

    hover(id) {
      graph.setHover(id);
    },

    onSelect(fn) {
      selectHandlers.add(fn);
      return () => selectHandlers.delete(fn);
    },

    get selectedId() {
      return selectedId;
    },

    dispose() {
      stop();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointerleave', onPointerLeave);
      graph.dispose();
      post.dispose();
      renderer.dispose();
    },
  };
}

/* ── Fallback when WebGL is unavailable ──────────────────────── */

function createFallback(canvas, reason) {
  document.documentElement.dataset.sceneFallback = reason;
  canvas.style.display = 'none';
  return {
    setProgress() {},
    setOrbit() {},
    resetOrbit() {},
    select() {},
    hover() {},
    onSelect() { return () => {}; },
    selectedId: null,
    dispose() {},
  };
}
