/**
 * Agent-architecture diagram — anime.js v4.
 *
 * anime.js owns this section because it is pure SVG work:
 *   • `svg.createDrawable`  sets up stroke-dasharray/dashoffset for path drawing
 *   • `svg.createMotionPath` converts a <path> into animatable translate values
 *   • `scrambleText`         is a property-value function that decodes a label
 *
 * GSAP could do the same job, but it would take DrawSVG + MotionPath plugins'
 * worth of code; anime.js ships it in the box.
 */
import {
  animate,
  createDrawable,
  createMotionPath,
  createTimeline,
  scrambleText,
  stagger,
} from 'animejs';
import { all, one, whenVisible, prefersReducedMotion } from '../lib/prefs.js';

export function initDiagram() {
  const root = one('.diagram');
  if (!root) return;

  const nodes = all('.diagram-node', root);
  const edges = all('.diagram-edge', root);
  const pulses = all('.diagram-pulse', root);
  const captions = all('.diagram-caption', root);
  const scramble = one('.diagram-scramble', root);

  /* ── Reduced motion: present the finished diagram, no motion ── */
  if (prefersReducedMotion) {
    animate(nodes, { opacity: 1, scale: 1 }, { duration: 0 });
    animate(captions, { opacity: 1 }, { duration: 0 });
    animate(pulses, { opacity: 0 }, { duration: 0 });
    return;
  }

  // Hide at rest so nothing flashes before the section is reached.
  animate(nodes, { opacity: 0, scale: 0.92 }, { duration: 0 });
  animate(captions, { opacity: 0 }, { duration: 0 });
  animate(pulses, { opacity: 0 }, { duration: 0 });

  const drawables = createDrawable(edges);
  animate(drawables, { draw: '0 0' }, { duration: 0 });

  let pulsesRunning = false;

  /** Traffic dots travelling the edges, forever, once the draw-in finishes. */
  function startPulses() {
    if (pulsesRunning) return;
    pulsesRunning = true;

    pulses.forEach((pulse, index) => {
      const edge = edges[index % edges.length];
      if (!edge) return;

      const { translateX, translateY } = createMotionPath(edge);

      animate(pulse, {
        translateX,
        translateY,
        opacity: [
          { to: 1, duration: 200 },
          { to: 1, duration: 800 },
          { to: 0, duration: 200 },
        ],
        duration: 1200,
        delay: index * 300,
        loop: true,
        ease: 'linear',
      });
    });
  }

  whenVisible(
    root,
    () => {
      const timeline = createTimeline({
        defaults: { ease: 'outExpo' },
        onComplete: startPulses,
      });

      // 1 — nodes pop in
      timeline.add(
        nodes,
        { opacity: [0, 1], scale: [0.92, 1], duration: 620, delay: stagger(65) },
        0,
      );

      // 2 — edges draw themselves
      timeline.add(
        drawables,
        { draw: ['0 0', '0 1'], duration: 850, delay: stagger(105), ease: 'inOutQuad' },
        240,
      );

      // 3 — captions fade in
      timeline.add(
        captions,
        { opacity: [0, 1], duration: 480, delay: stagger(55) },
        880,
      );

      // 4 — the heading decodes from scrambled glyphs
      if (scramble) {
        timeline.add(
          scramble,
          {
            text: scrambleText({ chars: 'blocks', from: 'left' }),
            duration: 1300,
          },
          1000,
        );
      }
    },
    { rootMargin: '0px 0px -10% 0px' },
  );
}
