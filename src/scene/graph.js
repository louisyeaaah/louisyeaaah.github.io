/**
 * The 3D agent graph.
 *
 * A volumetric constellation the camera flies through. Three layers:
 *   1. featured nodes   — the 11 résumé records, as instanced low-poly solids
 *   2. edges            — the role↔capability wiring, as an animated line cloud
 *   3. ambient dust     — thousands of points for depth and atmosphere
 * plus a receding game-style grid floor for spatial grounding.
 *
 * Everything is one draw call per layer so the whole graph costs four draw
 * calls; the cost is in the post-processing, not the geometry.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  EdgesGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  RingGeometry,
  ShaderMaterial,
  Vector3,
} from 'three';

import { HEX, RGB } from './palette.js';

/** Order the camera encounters the nodes — deliberately interleaved. */
export const FLIGHT_ORDER = [
  'macquarie', 'agents',
  'synogize', 'mcp',
  'nuvc', 'cloud',
  'xiaobing', 'observability',
  'usyd', 'delivery',
  'fullstack',
];

/* ── Edge shader ─────────────────────────────────────────────── */

const EDGE_VERT = /* glsl */ `
  attribute float aT;        // 0 at one end, 1 at the other
  attribute float aActive;   // 0 = dim, 1 = connected to the focus node
  varying float vT;
  varying float vActive;
  varying float vFog;
  void main() {
    vT = aT;
    vActive = aActive;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vFog = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const EDGE_FRAG = /* glsl */ `
  precision mediump float;
  uniform float uTime;
  uniform vec3  uBase;
  uniform vec3  uAccent;
  uniform float uFocus;      // 0..1 — how much the whole graph is lit
  varying float vT;
  varying float vActive;
  varying float vFog;

  void main() {
    // Depth fade keeps distant wiring from turning into soup.
    float depth = smoothstep(120.0, 18.0, vFog);

    // A packet travelling from "from" to "to" along every edge.
    float head = fract(uTime * 0.22);
    float pulse = smoothstep(0.09, 0.0, abs(vT - head));

    float base = 0.10 + vActive * 0.55 + pulse * (0.35 + vActive * 0.65);
    vec3 col = mix(uBase, uAccent, clamp(vActive * 0.85 + pulse * 0.8, 0.0, 1.0));

    gl_FragColor = vec4(col, base * depth * uFocus);
  }
`;

/* ── Dust shader ─────────────────────────────────────────────────
   Additive blending ignores scene fog entirely (fog is a shader chunk,
   not a pass), so distant motes would read *brighter* than near ones.
   Depth fade is therefore explicit here — and all motion lives in the
   vertex shader so nothing is uploaded per frame.                     */

const DUST_VERT = /* glsl */ `
  attribute float aPhase;
  attribute float aScale;
  uniform float uTime;
  uniform float uSize;
  varying float vFade;
  void main() {
    vec3 p = position;
    p.y += sin(uTime * 0.11 + aPhase) * 2.4;
    p.x += cos(uTime * 0.08 + aPhase * 1.37) * 1.9;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = -mv.z;
    // Point size is in device pixels. Unclamped this reached ~90px per mote
    // close to the camera, which read as a snowstorm rather than depth.
    gl_PointSize = clamp(uSize * aScale * (28.0 / max(dist, 0.1)), 0.6, 4.5);

    vFade = clamp(1.0 - dist / 190.0, 0.0, 1.0) * smoothstep(6.0, 30.0, dist);
    gl_Position = projectionMatrix * mv;
  }
`;

const DUST_FRAG = /* glsl */ `
  precision mediump float;
  uniform sampler2D uMap;
  uniform vec3  uColor;
  uniform float uOpacity;
  varying float vFade;
  void main() {
    vec4 sprite = texture2D(uMap, gl_PointCoord);
    float a = sprite.a * vFade * uOpacity;
    if (a < 0.012) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

/* ── Grid shader ─────────────────────────────────────────────── */

const GRID_VERT = /* glsl */ `
  varying vec2 vXZ;
  varying float vFog;
  void main() {
    vXZ = position.xz;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vFog = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const GRID_FRAG = /* glsl */ `
  precision mediump float;
  uniform float uTime;
  uniform vec3  uColor;
  varying vec2 vXZ;
  varying float vFog;

  float gridLine(vec2 p, float scale) {
    vec2 g = abs(fract(p / scale - 0.5) - 0.5) / fwidth(p / scale);
    return 1.0 - min(min(g.x, g.y), 1.0);
  }

  void main() {
    float minor = gridLine(vXZ, 4.0);
    float major = gridLine(vXZ, 20.0);

    // Fade the floor out with distance so it reads as space, not a table.
    float radial = smoothstep(120.0, 6.0, length(vXZ));
    float depth  = smoothstep(160.0, 10.0, vFog);

    float a = (minor * 0.055 + major * 0.13) * radial * depth;
    if (a < 0.002) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

/* ── Soft round sprite for dust ──────────────────────────────── */

function dotTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

/* ── Graph ───────────────────────────────────────────────────── */

export function createGraph({ nodes, edges, curve, quality = 'high' }) {
  const group = new Group();

  const highQuality = quality === 'high';
  const DUST = highQuality ? 2600 : 900;

  /* — lay the featured nodes out along the camera's own path — */
  const up = new Vector3(0, 1, 0);
  const placed = new Map();

  FLIGHT_ORDER.forEach((id, index) => {
    const record = nodes.find((node) => node.id === id);
    if (!record) return;

    const t = FLIGHT_ORDER.length === 1 ? 0.5 : index / (FLIGHT_ORDER.length - 1);
    // Inset from the extremes so no node sits on the very end of the path.
    const along = 0.02 + t * 0.96;

    const point = curve.getPointAt(along);
    const tangent = curve.getTangentAt(along).normalize();
    const side = new Vector3().crossVectors(tangent, up).normalize();

    const isRole = Boolean(record.subtitle);
    const distance = isRole ? 7.5 : 11.5;
    const sign = index % 2 === 0 ? -1 : 1;

    const position = point.clone()
      .addScaledVector(side, sign * distance)
      .addScaledVector(up, (index % 3 - 1) * 3.2 + (isRole ? 2.4 : -1.2));

    placed.set(id, { ...record, position, isRole, index, along });
  });

  const features = [...placed.values()].sort((a, b) => a.index - b.index);

  /* — instanced node solids — */
  const geometry = new IcosahedronGeometry(1, highQuality ? 1 : 0);

  const nodeMaterial = new MeshStandardMaterial({
    roughness: 0.34,
    metalness: 0.06,
    emissive: new Color(HEX.ink),
    emissiveIntensity: 0,
    flatShading: true,
  });

  const mesh = new InstancedMesh(geometry, nodeMaterial, features.length);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);

  const dummy = new Object3D();
  const roleColor = new Color(HEX.cream);
  const capColor = new Color(HEX.sage);
  const baseColors = [];

  features.forEach((feature, i) => {
    const scale = feature.isRole ? 1.55 : 0.95;
    dummy.position.copy(feature.position);
    dummy.scale.setScalar(scale);
    dummy.rotation.set(i * 0.7, i * 1.3, i * 0.4);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    const color = (feature.isRole ? roleColor : capColor).clone();
    baseColors.push(color.clone());
    mesh.setColorAt(i, color);
    feature.baseScale = scale;
    feature.instanceIndex = i;
  });

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  // Instances are rescaled every frame for the hover pop, which invalidates the
  // cached bounding sphere — three.js does not recompute it for you, and a stale
  // sphere silently culls the whole graph. The camera also lives *inside* this
  // volume, so frustum culling could never help anyway.
  mesh.frustumCulled = false;
  group.add(mesh);

  /* — ambient satellites: unfocusable set dressing that gives the corridor
       its density. One extra draw call, no interaction, no CPU work. — */
  const SATELLITES = highQuality ? 190 : 70;
  const satMesh = new InstancedMesh(
    new IcosahedronGeometry(1, 0),
    new MeshStandardMaterial({
      roughness: 0.5,
      metalness: 0.1,
      color: new Color(HEX.stone),
      flatShading: true,
    }),
    SATELLITES,
  );
  const satColors = [new Color(HEX.stone), new Color(HEX.stone2), new Color(HEX.stone)];
  for (let i = 0; i < SATELLITES; i += 1) {
    const along = Math.random();
    const point = curve.getPointAt(along);
    const tangent = curve.getTangentAt(along).normalize();
    const side = new Vector3().crossVectors(tangent, up).normalize();
    const radius = 4 + Math.pow(Math.random(), 1.6) * 26;

    dummy.position.copy(point)
      .addScaledVector(side, (Math.random() - 0.5) * 2 * radius)
      .addScaledVector(up, (Math.random() - 0.5) * radius * 1.3);
    dummy.scale.setScalar(0.09 + Math.pow(Math.random(), 2) * 0.34);
    dummy.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    dummy.updateMatrix();
    satMesh.setMatrixAt(i, dummy.matrix);
    satMesh.setColorAt(i, satColors[i % satColors.length]);
  }
  satMesh.instanceMatrix.needsUpdate = true;
  if (satMesh.instanceColor) satMesh.instanceColor.needsUpdate = true;
  satMesh.frustumCulled = false;
  group.add(satMesh);

  /* — highlight cage, moved onto whatever is hovered / selected — */
  const cageGeometry = new IcosahedronGeometry(1, 0);
  const cage = new LineSegments(
    new EdgesGeometry(cageGeometry),
    new LineBasicMaterial({ color: new Color(HEX.clay), transparent: true, opacity: 0 }),
  );
  group.add(cage);

  const halo = new Mesh(
    new RingGeometry(1.9, 2.05, 64),
    new MeshBasicMaterial({
      color: new Color(HEX.clay),
      transparent: true,
      opacity: 0,
      side: DoubleSide,
      depthWrite: false,
    }),
  );
  group.add(halo);

  /* — edges — */
  const edgePairs = [];
  edges.forEach(({ from, to }) => {
    const a = placed.get(from);
    const b = placed.get(to);
    if (a && b) edgePairs.push([a, b]);
  });
  // A spine along the flight path so the graph reads as one connected system.
  for (let i = 0; i < features.length - 1; i += 1) {
    edgePairs.push([features[i], features[i + 1]]);
  }

  const vertexCount = edgePairs.length * 2;
  const positions = new Float32Array(vertexCount * 3);
  const aT = new Float32Array(vertexCount);
  const aActive = new Float32Array(vertexCount);

  edgePairs.forEach(([a, b], i) => {
    const o = i * 6;
    positions[o + 0] = a.position.x; positions[o + 1] = a.position.y; positions[o + 2] = a.position.z;
    positions[o + 3] = b.position.x; positions[o + 4] = b.position.y; positions[o + 5] = b.position.z;
    aT[i * 2] = 0; aT[i * 2 + 1] = 1;
  });

  const edgeGeometry = new BufferGeometry();
  edgeGeometry.setAttribute('position', new BufferAttribute(positions, 3));
  edgeGeometry.setAttribute('aT', new BufferAttribute(aT, 1));
  edgeGeometry.setAttribute('aActive', new BufferAttribute(aActive, 1));

  const edgeMaterial = new ShaderMaterial({
    vertexShader: EDGE_VERT,
    fragmentShader: EDGE_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uBase: { value: new Vector3(...RGB.stone) },
      uAccent: { value: new Vector3(...RGB.clay) },
      uFocus: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  group.add(new LineSegments(edgeGeometry, edgeMaterial));

  /* — ambient dust — */
  const dustPositions = new Float32Array(DUST * 3);
  const dustPhase = new Float32Array(DUST);
  const dustScale = new Float32Array(DUST);
  for (let i = 0; i < DUST; i += 1) {
    const r = 24 + Math.random() * 78;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    dustPositions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta) * 0.75;
    dustPositions[i * 3 + 1] = r * Math.cos(phi) * 0.5;
    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 250;
    dustPhase[i] = Math.random() * Math.PI * 2;
    dustScale[i] = 0.35 + Math.random() * 0.75;
  }

  const dustGeometry = new BufferGeometry();
  dustGeometry.setAttribute('position', new BufferAttribute(dustPositions, 3));
  dustGeometry.setAttribute('aPhase', new BufferAttribute(dustPhase, 1));
  dustGeometry.setAttribute('aScale', new BufferAttribute(dustScale, 1));

  const dustMaterial = new ShaderMaterial({
    vertexShader: DUST_VERT,
    fragmentShader: DUST_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: 3.2 },
      uOpacity: { value: 0.22 },
      uMap: { value: dotTexture() },
      uColor: { value: new Vector3(...RGB.cream) },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  const dust = new Points(dustGeometry, dustMaterial);
  // Positions are animated in the shader, so the CPU-side bounds are stale.
  dust.frustumCulled = false;
  group.add(dust);

  /* — grid floor — */
  const gridGeometry = new PlaneGeometry(420, 420, 1, 1);
  const grid = new Mesh(
    gridGeometry,
    new ShaderMaterial({
      vertexShader: GRID_VERT,
      fragmentShader: GRID_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new Vector3(...RGB.sage) },
      },
      transparent: true,
      depthWrite: false,
    }),
  );
  grid.rotation.x = -Math.PI / 2;
  grid.position.y = -26;
  group.add(grid);

  /* ── interaction state ─────────────────────────────────────── */

  let hovered = null;   // feature object
  let selected = null;
  let focusAmount = 0;  // 0..1, eased

  const byId = new Map(features.map((f) => [f.id, f]));

  function connectedTo(id) {
    const set = new Set([id]);
    edges.forEach(({ from, to }) => {
      if (from === id) set.add(to);
      if (to === id) set.add(from);
    });
    features.forEach((feature, i) => {
      if (i > 0 && features[i - 1].id === id) set.add(feature.id);
      if (i < features.length - 1 && features[i + 1].id === id) set.add(feature.id);
    });
    return set;
  }

  function applyEdgeHighlight() {
    const focus = hovered || selected;
    if (!focus) {
      aActive.fill(0);
    } else {
      const linked = connectedTo(focus.id);
      edgePairs.forEach(([a, b], i) => {
        const active = linked.has(a.id) && linked.has(b.id) ? 1 : 0;
        aActive[i * 2] = active;
        aActive[i * 2 + 1] = active;
      });
    }
    edgeGeometry.attributes.aActive.needsUpdate = true;
  }

  function setHover(id) {
    const next = id ? byId.get(id) ?? null : null;
    if (next === hovered) return;
    hovered = next;
    applyEdgeHighlight();
  }

  function setSelected(id) {
    selected = id ? byId.get(id) ?? null : null;
    applyEdgeHighlight();
  }

  /* ── per-frame update ──────────────────────────────────────── */

  const clock = { t: 0 };

  function update(dt, camera) {
    clock.t += dt;
    edgeMaterial.uniforms.uTime.value = clock.t;
    dustMaterial.uniforms.uTime.value = clock.t;
    grid.material.uniforms.uTime.value = clock.t;

    // Ease the whole graph up as the visitor commits to scrolling.
    const targetFocus = hovered || selected ? 1 : 0.55;
    focusAmount += (targetFocus - focusAmount) * (1 - Math.exp(-dt * 3));
    edgeMaterial.uniforms.uFocus.value = focusAmount;
    dustMaterial.uniforms.uOpacity.value = 0.16 + focusAmount * 0.10;

    // Slow rotation gives the constellation a life of its own.
    satMesh.rotation.y += dt * 0.004;
    dust.rotation.y += dt * 0.006;
    dust.rotation.z += dt * 0.002;

    // Node idle animation + hover pop.
    features.forEach((feature, i) => {
      const isFocus = hovered === feature || selected === feature;
      const targetScale = feature.baseScale * (isFocus ? 1.5 : 1);
      feature.currentScale = feature.currentScale ?? feature.baseScale;
      feature.currentScale += (targetScale - feature.currentScale) * Math.min(dt * 9, 1);

      dummy.position.copy(feature.position);
      dummy.scale.setScalar(feature.currentScale);
      dummy.rotation.set(
        i * 0.7 + clock.t * 0.12,
        i * 1.3 + clock.t * 0.18,
        i * 0.4,
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const dim = hovered || selected;
      const linked = !dim || isFocus;
      const base = baseColors[i];
      const color = mesh.instanceColor;
      color.setXYZ(
        i,
        base.r * (linked ? 1 : 0.32),
        base.g * (linked ? 1 : 0.32),
        base.b * (linked ? 1 : 0.32),
      );
      if (isFocus) {
        color.setXYZ(i, Math.min(base.r * 1.4 + 0.25, 1), Math.min(base.g * 1.1 + 0.14, 1), Math.min(base.b * 1.0 + 0.1, 1));
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    // Move the selection cage / halo.
    const focusNode = hovered || selected;
    const cageTarget = focusNode ? focusNode.currentScale * 1.75 : 1;
    cage.position.copy(focusNode ? focusNode.position : new Vector3(0, -9999, 0));
    cage.scale.setScalar(cageTarget);
    cage.rotation.y += dt * 0.6;
    cage.material.opacity += ((focusNode ? 0.75 : 0) - cage.material.opacity) * Math.min(dt * 8, 1);

    halo.position.copy(cage.position);
    halo.position.y -= 0.1;
    halo.scale.setScalar(focusNode ? focusNode.currentScale * 1.05 : 0.001);
    halo.lookAt(camera.position);
    halo.material.opacity += ((focusNode ? 0.5 : 0) - halo.material.opacity) * Math.min(dt * 6, 1);
  }

  return {
    group,
    features,
    byId,
    mesh,
    curve,
    setHover,
    setSelected,
    update,
    get hovered() { return hovered; },
    get selected() { return selected; },
    dispose() {
      geometry.dispose();
      nodeMaterial.dispose();
      cageGeometry.dispose();
      cage.geometry.dispose();
      cage.material.dispose();
      halo.geometry.dispose();
      halo.material.dispose();
      edgeGeometry.dispose();
      edgeMaterial.dispose();
      dustGeometry.dispose();
      dust.material.map?.dispose();
      dust.material.dispose();
      satMesh.geometry.dispose();
      satMesh.material.dispose();
      gridGeometry.dispose();
      grid.material.dispose();
    },
  };
}
