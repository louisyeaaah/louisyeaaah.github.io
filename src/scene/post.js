/**
 * Post-processing chain — the "filmed" half of the look.
 *
 * Geometry alone never reads as cinema. What sells it is a lens: depth of
 * field, halation around highlights, a little smearing when the camera moves
 * fast, film grain, gate weave and a vignette. All of that lives here.
 *
 * Order matters and is deliberate:
 *
 *   RenderPass    linear HDR scene
 *   BokehPass     depth of field — needs the raw depth buffer, so it must run
 *                 on the scene render, before anything composites over it
 *   Bloom         on the *defocused* image, which is what makes bokeh glow
 *   Afterimage    frame accumulation in linear space, for camera-speed smear
 *   OutputPass    tone mapping + sRGB (must precede anything needing sRGB)
 *   Grade         grain, halation, vignette, aberration, gate weave in display
 *                 space, where a colourist would actually put them
 */
import { Vector2 } from 'three';

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/* ── Final grade ─────────────────────────────────────────────── */

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: [1, 1] },
    uGrain: { value: 0.042 },
    uVignette: { value: 1.15 },
    uAberration: { value: 0.0024 },
    uHalo: { value: 1.0 },
    uWeave: { value: 1.0 },
    uLift: { value: 0.006 },
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
    uniform float uHalo;
    uniform float uWeave;
    uniform float uLift;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      // Gate weave: the sub-pixel jitter of film travelling through a
      // projector. Two incommensurate frequencies so it never visibly loops.
      float weaveX = sin(uTime * 1.70) * 0.00022 + sin(uTime * 0.61) * 0.00013;
      float weaveY = cos(uTime * 1.31) * 0.00019 + sin(uTime * 0.43) * 0.00011;
      vec2 uv = vUv + vec2(weaveX, weaveY) * uWeave;

      vec2 centered = uv - 0.5;
      float r2 = dot(centered, centered);

      // Radial chromatic aberration — sharp in the centre of frame.
      float amount = uAberration * (0.25 + r2 * 2.2);
      vec2 dir = normalize(centered + vec2(1e-6));

      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir * amount).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir * amount).b;

      // Anamorphic halation: a horizontal streak bled out of the highlights
      // and weighted warm, the way a real lens coating behaves.
      if (uHalo > 0.001) {
        vec3 streak = vec3(0.0);
        float wsum = 0.0;
        for (int i = -4; i <= 4; i++) {
          float fi = float(i);
          float w = 1.0 - abs(fi) / 5.0;
          vec3 s = texture2D(tDiffuse, uv + vec2(fi * 0.0038, 0.0)).rgb;
          float bright = max(max(s.r, s.g), s.b);
          streak += s * w * smoothstep(0.52, 1.0, bright);
          wsum += w;
        }
        col += (streak / max(wsum, 1.0)) * uHalo * vec3(1.0, 0.84, 0.72) * 0.55;
      }

      // Film grain, eased off in the highlights so it never crawls over them.
      float n = hash(uv * uResolution + fract(uTime) * 431.0);
      col += (n - 0.5) * uGrain * (1.0 - smoothstep(0.4, 1.0, max(max(col.r, col.g), col.b)));

      // A whisper of lift — film blacks are never a true void.
      col += uLift;

      float vig = smoothstep(1.05, 0.28, length(centered * vec2(1.08, 1.0)));
      col *= mix(1.0, vig, uVignette);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

/* ── Composer ────────────────────────────────────────────────── */

export function createComposer({ renderer, scene, camera, quality = 'high', width, height }) {
  const film = quality === 'high';

  const composer = new EffectComposer(renderer);
  composer.setSize(width, height);

  composer.addPass(new RenderPass(scene, camera));

  let bokeh = null;
  if (film) {
    bokeh = new BokehPass(scene, camera, {
      focus: 24,
      aperture: 0.00042,
      maxblur: 0.0085,
      width,
      height,
    });
    composer.addPass(bokeh);
  }

  const bloom = new UnrealBloomPass(
    new Vector2(width, height),
    film ? 0.46 : 0.28,
    film ? 0.92 : 0.70,
    0.60,
  );
  composer.addPass(bloom);

  // Camera-speed smear. Damped back to 0 at rest so a still frame is crisp.
  let afterimage = null;
  if (film) {
    afterimage = new AfterimagePass(0);
    composer.addPass(afterimage);
  }

  composer.addPass(new OutputPass());

  const grade = new ShaderPass(GradeShader);
  grade.uniforms.uResolution.value = [width, height];
  grade.uniforms.uGrain.value = film ? 0.042 : 0.022;
  grade.uniforms.uAberration.value = film ? 0.0024 : 0.0012;
  grade.uniforms.uHalo.value = film ? 1.0 : 0.0;
  grade.uniforms.uWeave.value = film ? 1.0 : 0.0;
  grade.renderToScreen = true;
  composer.addPass(grade);

  return {
    composer,
    bloom,
    grade,
    bokeh,

    /** Focus distance in world units — the rack-focus control. */
    setFocus(distance) {
      if (bokeh) bokeh.uniforms.focus.value = distance;
    },

    /** How much motion smear: 0 (crisp) .. 0.92 (long trail). */
    setSmear(amount) {
      if (afterimage) afterimage.uniforms.damp.value = Math.max(0, Math.min(amount, 0.92));
    },

    setSize(w, h) {
      composer.setSize(w, h);
      bloom.setSize(w, h);
      bokeh?.setSize(w, h);
      grade.uniforms.uResolution.value = [w, h];
    },

    update(dt) {
      grade.uniforms.uTime.value += dt;
    },

    dispose() {
      composer.dispose?.();
      bokeh?.dispose?.();
      afterimage?.dispose?.();
    },
  };
}
