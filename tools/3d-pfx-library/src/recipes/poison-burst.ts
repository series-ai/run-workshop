import { authoredRecipe } from '../constants/01'

export default authoredRecipe('poison-burst', 'Poison burst', 'Particle-first toxic rupture: a low bruise cloud spreads, green spores climb through it, and a dark splat punctuates the release without the slime-burst blob grammar.', [
  {
    kind: 'particles', role: 'volume', opacity: 0.82, scale: 1.08, phase: 'poison-burst-particle-bruised-cloud',
    tuning: {
      motion: 'drift-cloud', sprite: 'smoke-variants', blend: 'alpha', colorOverride: '#52285f', ramp: 'pigment',
      lifecycle: 'poison-burst-particle-rupture', delay: 0.02, window: 0.44, lifeScale: 1.04,
      countScale: 0.62, speedScale: 0.34, speedJitter: 0.46, drag: 1.35, gravity: -0.08,
      spawnScale: 0.84, spawnLift: 0.02, depthScale: 3.1, size: [0.32, 0.78, 0.6],
      spinScale: 0.28, death: 'erode', turbulenceScale: 0.24, positionOffset: [0, -0.18, 0],
      referenceSource: 'poison-burst-vapor-lobe-cluster-and-CC0-smoke-variants',
      referenceAdaptation: 'the welded purple seed becomes a low, fused poison cloud with visible growth instead of a rounded mesh blob',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'trail', opacity: 0.88, scale: 1.02, phase: 'poison-burst-particle-spore-rise',
    tuning: {
      motion: 'column-rise', sprite: 'bubble', blend: 'alpha', colorOverride: '#b8f25a', ramp: 'held',
      lifecycle: 'poison-burst-particle-rupture', delay: 0.18, window: 0.4, lifeScale: 1.02,
      countScale: 0.48, speedScale: 0.86, speedJitter: 0.5, drag: 0.9, gravity: 0.02,
      spawnScale: 0.76, depthScale: 3.2, size: [0.1, 0.34, 0.14], spinScale: 0,
      flicker: 0.34, death: 'erode', turbulenceScale: 0.28, positionOffset: [0, -0.12, 0],
      referenceSource: 'poison-burst-spore-pod-volume-and-CC0-bubble-sprite-language',
      referenceAdaptation: 'spore pods become uneven upward bubbles with staggered height and depth, not a second radial lobe mesh',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'impact', opacity: 0.86, scale: 0.92, phase: 'poison-burst-particle-toxic-splat',
    tuning: {
      motion: 'impact-burst', sprite: 'splat', blend: 'alpha', colorOverride: '#8dbb36', ramp: 'dark',
      lifecycle: 'poison-burst-particle-rupture', delay: 0.01, window: 0.2, lifeScale: 0.52,
      countScale: 0.34, speedScale: 2.8, speedJitter: 0.48, drag: 1.6, gravity: -1.9,
      spawnScale: 0.18, depthScale: 2.8, size: [0.16, 0.34, 0.12], spinScale: 0.6,
      stretch: 0.2, death: 'erode', ease: 'snap', turbulenceScale: 0.03, positionOffset: [0, -0.14, 0],
      referenceSource: 'repo-original-toxic-splat-and-CC0-splat-sprite-language',
      referenceAdaptation: 'the rupture edge becomes a sparse dirty splat that separates poison from the adjacent slime vocabulary',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 1.05)
