/**
 * Post-processing chain.
 *
 * This is where the "game engine" feel actually comes from — the geometry is
 * simple, but bloom, film grain, a vignette and edge-weighted chromatic
 * aberration together read as a rendered frame rather than a web page.
 *
 * Order matters:
 *   RenderPass  -> linear HDR scene
 *   Bloom       -> needs linear HDR input to look like light, not paint
 *   OutputPass  -> tone mapping + sRGB conversion
 *   Grade       -> grain/vignette/aberration in display space, where they
 *                  behave the way a colourist expects
 */
import {
  Vector2,
} from 'three';

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/* ── Final grade: grain + vignette + chromatic aberration ────── */

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: [1, 1] },
    uGrain: { value: 0.038 },
    uVignette: { value: 1.15 },
    uAberration: { value: 0.0022 },
    uScan: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2  uResolution;
    uniform float uGrain;
    uniform float uVignette;
    uniform float uAberration;
    uniform float uScan;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float r2 = dot(centered, centered);

      // Aberration is weighted by radius so the frame centre stays sharp.
      float amount = uAberration * (0.25 + r2 * 2.2);
      vec2 dir = normalize(centered + vec2(1e-6));

      vec3 col;
      col.r = texture2D(tDiffuse, vUv + dir * amount).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - dir * amount).b;

      // Animated film grain.
      float n = hash(vUv * uResolution + fract(uTime) * 431.0);
      col += (n - 0.5) * uGrain;

      // Very light CRT-style scanline, off by default.
      col *= 1.0 - uScan * step(0.5, fract(vUv.y * uResolution.y * 0.5));

      // Vignette.
      float vig = smoothstep(1.05, 0.28, length(centered * vec2(1.08, 1.0)));
      col *= mix(1.0, vig, uVignette);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

/* ── Composer ────────────────────────────────────────────────── */

export function createComposer({ renderer, scene, camera, quality = 'high', width, height }) {
  const composer = new EffectComposer(renderer);
  composer.setSize(width, height);

  composer.addPass(new RenderPass(scene, camera));

  const highQuality = quality === 'high';
  const bloom = new UnrealBloomPass(
    new Vector2(width, height),
    highQuality ? 0.42 : 0.28,  // strength — restrained; this is not a rave
    highQuality ? 0.85 : 0.7,   // radius
    0.62,                        // threshold — only genuine highlights bloom
  );
  composer.addPass(bloom);

  composer.addPass(new OutputPass());

  const grade = new ShaderPass(GradeShader);
  grade.uniforms.uResolution.value = [width, height];
  grade.uniforms.uGrain.value = highQuality ? 0.038 : 0.022;
  grade.renderToScreen = true;
  composer.addPass(grade);

  return {
    composer,
    bloom,
    grade,
    setSize(w, h) {
      composer.setSize(w, h);
      bloom.setSize(w, h);
      grade.uniforms.uResolution.value = [w, h];
    },
    update(dt) {
      grade.uniforms.uTime.value += dt;
    },
    dispose() {
      composer.dispose?.();
    },
  };
}
