/**
 * Minimal tsParticles engine.
 *
 * The `@tsparticles/slim` preset is convenient but registers a lot this site
 * never touches: emoji/image/polygon/square/star shapes, attract/bounce/bubble/
 * connect/destroy/parallax/remove/repulse/slow interactions, and the easing and
 * life/rotate/paint updaters. That measured at ~45 KB gzipped for a decorative
 * background effect.
 *
 * Composing the engine by hand from `@tsparticles/basic` plus exactly three
 * interactions cuts that roughly in half, and the feature set is identical for
 * what the site actually asks for:
 *   • circles that drift and bounce        (basic)
 *   • lines between nearby particles       (interaction-particles-links)
 *   • pointer "grab" linking + click push  (external-grab / external-push)
 *
 * Loaded once and memoised, so the main page and the lab share one engine.
 */
import { tsParticles } from '@tsparticles/engine';
import { loadBasic } from '@tsparticles/basic';
import { loadInteractivityPlugin } from '@tsparticles/plugin-interactivity';
import { loadExternalGrabInteraction } from '@tsparticles/interaction-external-grab';
import { loadExternalPushInteraction } from '@tsparticles/interaction-external-push';
import { loadParticlesLinksInteraction } from '@tsparticles/interaction-particles-links';

let loading = null;

/** Resolve the configured tsParticles engine, loading plugins on first use. */
export function getParticlesEngine() {
  if (!loading) {
    loading = (async () => {
      // The interactivity plugin is the host for every external interaction
      // (grab/push). `loadBasic` does not pull it in, and without it the engine
      // logs "Interactivity Plugin is not loaded" and silently ignores them.
      await loadInteractivityPlugin(tsParticles);
      await loadBasic(tsParticles);
      await loadExternalGrabInteraction(tsParticles);
      await loadExternalPushInteraction(tsParticles);
      await loadParticlesLinksInteraction(tsParticles);
      return tsParticles;
    })();
  }
  return loading;
}

/**
 * Shared visual configuration for the site's particle fields.
 * Both the contact card and the lab playground start from this.
 */
export function baseParticleOptions(overrides = {}) {
  return {
    fullScreen: { enable: false },
    background: { color: 'transparent' },
    fpsLimit: 60,
    detectRetina: true,
    pauseOnBlur: true,
    pauseOnOutsideViewport: true,
    interactivity: {
      detectsOn: 'window',
      events: {
        onHover: { enable: true, mode: 'grab' },
        onClick: { enable: true, mode: 'push' },
        resize: { enable: true },
      },
      modes: {
        grab: { distance: 150, links: { opacity: 0.4, color: '#38bdf8' } },
        push: { quantity: 3 },
      },
    },
    particles: {
      number: { value: 44, density: { enable: true, width: 900, height: 500 } },
      color: { value: ['#38bdf8', '#a855f7', '#f472b6'] },
      shape: { type: 'circle' },
      opacity: { value: { min: 0.2, max: 0.65 } },
      size: { value: { min: 1, max: 2.6 } },
      links: {
        enable: true,
        distance: 132,
        color: '#8b94ab',
        opacity: 0.22,
        width: 1,
      },
      move: {
        enable: true,
        speed: 0.55,
        direction: 'none',
        random: true,
        straight: false,
        outModes: { default: 'bounce' },
      },
    },
    ...overrides,
  };
}
