/**
 * Hero background — three.js.
 *
 * Two layers in one scene:
 *   1. A full-bleed shader plane running domain-warped fBm noise, mapped
 *      through the site palette (sky -> violet -> pink) with additive
 *      blending so it glows on top of the dark page background.
 *   2. A slowly drifting 3D point constellation with soft sprite dots.
 *
 * Both react to the pointer with a damped parallax. Rendering is suspended
 * whenever the hero leaves the viewport or the tab is hidden, and the whole
 * thing degrades to a lightweight 2D canvas field when WebGL is unavailable
 * or the visitor has asked for reduced motion.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from 'three';
import { hasFinePointer, isSlowConnection, prefersReducedMotion, supportsWebGL } from '../lib/prefs.js';

/* ── Shaders ─────────────────────────────────────────────────── */

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec2  uMouse;
  uniform vec2  uRes;
  uniform float uReveal;

  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = rot * p * 2.02;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    vec2 p  = uv * vec2(uRes.x / max(uRes.y, 1.0), 1.0);
    float t = uTime * 0.055;

    // Domain warping: feed fBm back into itself for organic, ribbon-like flow.
    float warp = fbm(p * 1.35 + vec2(t, -t * 0.65));
    float n1   = fbm(p * 2.05 + warp * 1.35 + vec2(-t * 1.15, t * 0.45));
    float n2   = fbm(p * 1.10 - warp * 0.85 + vec2(t * 0.75, t * 1.05));

    vec3 sky    = vec3(0.16, 0.62, 0.94);
    vec3 violet = vec3(0.58, 0.28, 0.95);
    vec3 pink   = vec3(0.95, 0.36, 0.68);

    vec3 col = mix(sky, violet, smoothstep(0.22, 0.78, n1));
    col = mix(col, pink, smoothstep(0.42, 0.92, n2) * 0.72);

    // Two drifting light sources that follow the pointer.
    float g1 = smoothstep(0.92, 0.06, length(uv - vec2(0.20, 0.80) - uMouse * 0.06));
    float g2 = smoothstep(0.86, 0.02, length(uv - vec2(0.86, 0.20) - uMouse * 0.04));
    float mask = max(g1 * 0.95, g2 * 0.78);

    // Keep the centre calm so foreground copy stays readable.
    float clarity = smoothstep(0.10, 0.95, length((uv - vec2(0.5, 0.52)) * vec2(1.05, 1.0)));

    col *= mask * clarity * 0.52 * uReveal;

    gl_FragColor = vec4(col, 1.0);
  }
`;

/* ── Soft round sprite for the point cloud ───────────────────── */

function makeDotTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(190,215,255,0.55)');
  grd.addColorStop(1, 'rgba(150,180,255,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/* ── Main entry ──────────────────────────────────────────────── */

export function initHero(canvas) {
  if (!canvas) return { destroy() {} };

  const useWebGL = supportsWebGL() && !isSlowConnection;

  // Reduced motion: draw a single static frame and never animate.
  if (prefersReducedMotion || !useWebGL) {
    if (!useWebGL) return startCanvasFallback(canvas);
    return startStaticFrame(canvas);
  }

  let renderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: false,
    });
  } catch {
    return startCanvasFallback(canvas);
  }
  if (!renderer) return startCanvasFallback(canvas);

  renderer.setClearAlpha(0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uniforms = {
    uTime: { value: 0 },
    uMouse: { value: new Vector2(0, 0) },
    uRes: { value: new Vector2(1, 1) },
    uReveal: { value: 0 },
  };

  const plane = new Mesh(
    new PlaneGeometry(2, 2),
    new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    }),
  );
  plane.frustumCulled = false;
  scene.add(plane);

  /* — point constellation — */
  const COUNT = window.innerWidth < 760 ? 500 : 1500;
  const positions = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i += 1) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 3.4;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 2.2;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 1.6;
  }
  const cloud = new BufferGeometry();
  cloud.setAttribute('position', new BufferAttribute(positions, 3));

  const points = new Points(
    cloud,
    new PointsMaterial({
      size: 0.022,
      map: makeDotTexture(),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: AdditiveBlending,
      sizeAttenuation: true,
    }),
  );
  scene.add(points);

  /* — state — */
  const target = new Vector2(0, 0);   // pointer, normalised -1..1
  const current = new Vector2(0, 0);  // damped pointer
  let elapsed = 0;
  let reveal = 0;
  let rafId = null;
  let running = false;

  const clock = { last: performance.now() };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(rect.width, 1);
    const h = Math.max(rect.height, 1);
    renderer.setSize(w, h, false);
    uniforms.uRes.value.set(w, h);
  }

  function frame(now) {
    const dt = Math.min((now - clock.last) / 1000, 0.05);
    clock.last = now;
    elapsed += dt;

    // Damped pointer parallax.
    current.x += (target.x - current.x) * 0.045;
    current.y += (target.y - current.y) * 0.045;

    uniforms.uTime.value = elapsed;
    uniforms.uMouse.value.set(current.x, current.y);
    uniforms.uReveal.value = reveal;

    points.rotation.y = elapsed * 0.035 + current.x * 0.16;
    points.rotation.x = Math.sin(elapsed * 0.12) * 0.05 - current.y * 0.12;
    points.position.x = current.x * 0.07;
    points.position.y = current.y * 0.05;

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    clock.last = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  /* — pointer — */
  if (hasFinePointer) {
    const hero = canvas.parentElement;
    hero.addEventListener(
      'pointermove',
      (event) => {
        const rect = canvas.getBoundingClientRect();
        target.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        target.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      },
      { passive: true },
    );
    hero.addEventListener(
      'pointerleave',
      () => {
        target.set(0, 0);
      },
      { passive: true },
    );
  }

  /* — visibility / resize — */
  let heroVisible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      ([entry]) => {
        heroVisible = entry.isIntersecting;
        if (heroVisible && !document.hidden) start();
        else stop();
      },
      { threshold: 0 },
    ).observe(canvas);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (heroVisible) start();
  });

  let resizeTimer = null;
  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      resize();
      renderer.render(scene, camera);
    }, 160);
  };
  window.addEventListener('resize', onResize, { passive: true });

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    stop();
  });

  resize();

  // Fade the shader in over ~1.4s so the page doesn't flash on load.
  const fadeStart = performance.now();
  const fade = () => {
    reveal = Math.min((performance.now() - fadeStart) / 1400, 1);
    if (reveal < 1) requestAnimationFrame(fade);
  };
  requestAnimationFrame(fade);

  start();

  return {
    destroy() {
      stop();
      window.removeEventListener('resize', onResize);
      plane.geometry.dispose();
      plane.material.dispose();
      cloud.dispose();
      points.material.map?.dispose();
      points.material.dispose();
      renderer.dispose();
    },
  };
}

/* ── Reduced motion: one static shader frame ─────────────────── */

function startStaticFrame(canvas) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false });
  } catch {
    return startCanvasFallback(canvas);
  }
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const rect = canvas.getBoundingClientRect();
  const uniforms = {
    uTime: { value: 12 },
    uMouse: { value: new Vector2(0, 0) },
    uRes: { value: new Vector2(Math.max(rect.width, 1), Math.max(rect.height, 1)) },
    uReveal: { value: 1 },
  };
  const mesh = new Mesh(
    new PlaneGeometry(2, 2),
    new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    }),
  );
  scene.add(mesh);
  renderer.setPixelRatio(1);
  renderer.setSize(uniforms.uRes.value.x, uniforms.uRes.value.y, false);
  renderer.setClearAlpha(0);
  renderer.render(scene, camera);
  return { destroy: () => renderer.dispose() };
}

/* ── No-WebGL fallback: 2D particle network ──────────────────── */

function startCanvasFallback(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { destroy() {} };

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const LINK = 132;
  let w = 0;
  let h = 0;
  let nodes = [];
  let rafId = null;
  const pointer = { x: -9999, y: -9999 };
  const hues = ['56,189,248', '168,85,247', '244,114,182'];

  function resize() {
    const rect = canvas.getBoundingClientRect();
    w = Math.max(rect.width, 1);
    h = Math.max(rect.height, 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.min(Math.round((w * h) / 19000), 88);
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.28,
      vy: (Math.random() - 0.5) * 0.28,
      r: Math.random() * 1.5 + 0.7,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > w) n.vx *= -1;
      if (n.y < 0 || n.y > h) n.vy *= -1;

      const dx = n.x - pointer.x;
      const dy = n.y - pointer.y;
      const d = Math.hypot(dx, dy);
      if (d < 128 && d > 0.01) {
        n.x += (dx / d) * 0.5;
        n.y += (dy / d) * 0.5;
      }

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(180,200,255,.5)';
      ctx.fill();
    }

    for (let a = 0; a < nodes.length; a += 1) {
      for (let b = a + 1; b < nodes.length; b += 1) {
        const dx = nodes[a].x - nodes[b].x;
        const dy = nodes[a].y - nodes[b].y;
        const d = Math.hypot(dx, dy);
        if (d < LINK) {
          ctx.strokeStyle = `rgba(${hues[(a + b) % 3]},${((1 - d / LINK) * 0.28).toFixed(3)})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(nodes[a].x, nodes[a].y);
          ctx.lineTo(nodes[b].x, nodes[b].y);
          ctx.stroke();
        }
      }
    }
    rafId = requestAnimationFrame(draw);
  }

  const hero = canvas.parentElement;
  hero.addEventListener(
    'pointermove',
    (event) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
    },
    { passive: true },
  );
  hero.addEventListener('pointerleave', () => {
    pointer.x = -9999;
    pointer.y = -9999;
  });

  let resizeTimer = null;
  window.addEventListener(
    'resize',
    () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 180);
    },
    { passive: true },
  );

  resize();

  if (prefersReducedMotion) {
    draw();
    if (rafId) cancelAnimationFrame(rafId);
    return { destroy() {} };
  }

  draw();
  return {
    destroy() {
      if (rafId) cancelAnimationFrame(rafId);
    },
  };
}
