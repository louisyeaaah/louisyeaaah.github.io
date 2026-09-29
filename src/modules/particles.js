/**
 * Contact-section particle layer — tsParticles.
 *
 * Verdict: tsParticles is a great fit *here* and the wrong tool for the hero.
 * The contact card wants a self-contained, pointer-reactive network with
 * linking, click-to-push and automatic visibility/blur pausing — all of which
 * the engine takes as a declarative config instead of ~150 lines of bespoke
 * canvas. The hero needed art direction the config model cannot express, so it
 * gets a purpose-built GLSL shader instead.
 *
 * Loaded lazily: neither the engine nor the plugins touch the network until the
 * contact section is close to the viewport.
 */
import { one, prefersReducedMotion, whenVisible } from '../lib/prefs.js';
import { getParticlesEngine, baseParticleOptions } from '../lib/particles-engine.js';

export function initContactParticles() {
  const host = one('#contactParticles');
  if (!host) return;

  whenVisible(
    host,
    async () => {
      const engine = await getParticlesEngine();

      await engine.load({
        id: 'contact-particles',
        element: host,
        options: baseParticleOptions({
          // Render a single static frame instead of animating.
          motion: { disable: prefersReducedMotion },
          particles: {
            ...baseParticleOptions().particles,
            number: { value: 44, density: { enable: true, width: 900, height: 500 } },
          },
        }),
      });
    },
    { rootMargin: '350px' },
  );
}
