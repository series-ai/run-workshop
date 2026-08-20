import { authoredRecipe } from '../constants/01'

export default authoredRecipe('jump-beam', 'Jump beam', 'Particle-first updraft: a small ground flash, a narrow lift stream, and a few rising motes.', [
  {
    kind: 'particles', role: 'impact', opacity: 0.82, scale: 1.55, phase: 'jump-beam-particle-ground-flash',
    tuning: {
      motion: 'shockwave-ground-burst', sprite: 'glow', blend: 'additive', colorOverride: '#9ee7ff', ramp: 'held',
      lifecycle: 'jump-beam-particle-lift', delay: 0, window: 0.12, lifeScale: 0.28,
      countScale: 0.55, speedScale: 2.2, speedJitter: 0.16, drag: 1.8, gravity: 0,
      spawnScale: 0.55, depthScale: 2.0, size: [0.1, 0.22, 0.08], spinScale: 0,
      stretch: 0, death: 'erode', ease: 'snap', turbulenceScale: 0.03, positionOffset: [0, 0, 0],
      referenceSource: 'jump-burst-takeoff-pop-and-CC0-glow-sprite-language',
      referenceAdaptation: 'the induction rings become a small cyan ground flash',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'body', opacity: 0.94, scale: 2.05, phase: 'jump-beam-particle-lift-streaks',
    tuning: {
      motion: 'jump-launch', sprite: 'streak', blend: 'additive', colorOverride: '#2f9dff', ramp: 'held',
      lifecycle: 'jump-beam-particle-lift', delay: 0.02, window: 0.72, lifeScale: 1.15,
      countScale: 1.6, speedScale: 8.4, speedJitter: 0.2, drag: 0.85, gravity: 0,
      spawnScale: 0.45, depthScale: 2.2, size: [0.06, 0.22, 0.06], spinScale: 0.06,
      stretch: 0.7, randomizeAzimuth: true, death: 'erode', flicker: 0.1, turbulenceScale: 0.04,
      positionOffset: [0, -0.5, 0],
      referenceSource: 'jump-burst-lift-stream-and-CC0-streak-sprite-language',
      referenceAdaptation: 'the mesh arrows become a narrow lift stream',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'trail', opacity: 0.7, scale: 1.85, phase: 'jump-beam-particle-sparkle-stream',
    tuning: {
      motion: 'column-rise', sprite: 'glow', blend: 'additive', colorOverride: '#d8f4ff', ramp: 'held',
      lifecycle: 'jump-beam-particle-lift', delay: 0.04, window: 0.7, lifeScale: 1.1,
      countScale: 1.1, speedScale: 6.8, speedJitter: 0.22, drag: 1.05, gravity: 0,
      spawnScale: 0.5, depthScale: 2.2, size: [0.05, 0.12, 0.05], spinScale: 0.1,
      stretch: 0, death: 'erode', flicker: 0.16, turbulenceScale: 0.05, positionOffset: [0, -0.42, 0],
      referenceSource: 'jump-burst-updraft-sparkles-and-CC0-glow-sprite-language',
      referenceAdaptation: 'the aperture becomes a few small rising motes instead of large stars',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 1.05)
