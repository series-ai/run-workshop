import { authoredRecipe } from '../constants/01'

export default authoredRecipe('jump-burst', 'Jump burst', 'Particle-first launch feedback: a ground pop compresses into a narrow lift stream while a soft dust handoff keeps the takeoff anchored.', [
  {
    kind: 'particles', role: 'impact', opacity: 0.98, scale: 1.1, phase: 'jump-burst-particle-takeoff-pop',
    tuning: {
      motion: 'impact-burst', sprite: 'glow', blend: 'additive', colorOverride: '#fff0a6', ramp: 'pinned-hot',
      lifecycle: 'jump-burst-particle-launch', delay: 0, window: 0.12, lifeScale: 0.4,
      countScale: 0.48, speedScale: 2.6, speedJitter: 0.42, drag: 2.2, gravity: 0.2,
      spawnScale: 0.12, depthScale: 2.8, size: [0.22, 0.48, 0.16], spinScale: 0,
      death: 'erode', ease: 'snap', turbulenceScale: 0.02, positionOffset: [0, -0.72, 0],
      referenceSource: 'jump-burst-lift-column-and-CC0-glow-sprite-language',
      referenceAdaptation: 'the empty beam becomes a compact hot takeoff pop at the foot anchor',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'body', opacity: 0.98, scale: 1.28, phase: 'jump-burst-particle-lift-stream',
    tuning: {
      motion: 'jump-launch', sprite: 'sparkle', blend: 'additive', colorOverride: '#f4fbff', ramp: 'pinned-hot',
      lifecycle: 'jump-burst-particle-launch', delay: 0.02, window: 0.34, lifeScale: 0.72,
      countScale: 0.86, speedScale: 2.8, speedJitter: 0.5, drag: 0.9, gravity: 0.3,
      spawnScale: 0.18, depthScale: 3.2, size: [0.14, 0.42, 0.1], spinScale: 0.4,
      randomizeAzimuth: true, death: 'erode', ease: 'snap', turbulenceScale: 0.06, positionOffset: [0, -0.64, 0],
      referenceSource: 'jump-burst-updraft-and-CC0-sparkle-sprite-language',
      referenceAdaptation: 'the vertical column becomes a short depth-bearing stream of lift motes with a seeded uneven launch',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'volume', opacity: 0.58, scale: 1.24, phase: 'jump-burst-particle-dust-handoff',
    tuning: {
      motion: 'drift-cloud', sprite: 'puff', blend: 'alpha', colorOverride: '#8a8171', ramp: 'dark',
      lifecycle: 'jump-burst-particle-launch', delay: 0.12, window: 0.4, lifeScale: 0.9,
      countScale: 0.52, speedScale: 0.24, speedJitter: 0.42, drag: 1.5, gravity: -0.08,
      spawnScale: 0.72, spawnLift: -0.02, depthScale: 3, size: [0.36, 0.78, 0.62], spinScale: 0.24,
      death: 'erode', turbulenceScale: 0.2, positionOffset: [0, -0.78, 0],
      referenceSource: 'jump-burst-takeoff-dust-and-CC0-puff-sprite-language',
      referenceAdaptation: 'the pad ring becomes a restrained soft dust handoff that stays at the launch footprint',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 1.25)
