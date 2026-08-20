import { authoredRecipe } from '../constants/01'

export default authoredRecipe('teleport-hit', 'Teleport hit', 'Particle-first spatial arrival: descending column, bright ground hit, and a short residual debris field.', [
  {
    kind: 'particles', role: 'body', opacity: 0.96, scale: 1.22, phase: 'teleport-hit-particle-arrival-column',
    tuning: {
      motion: 'column-rise', sprite: 'streak', blend: 'additive', colorOverride: '#d8f6ff', ramp: 'pinned-hot',
      lifecycle: 'teleport-hit-particle-arrival', delay: 0, window: 0.12, lifeScale: 0.28,
      countScale: 0.62, speedScale: 1.8, speedJitter: 0.22, drag: 1.6, gravity: 0,
      spawnScale: 0.12, depthScale: 2.4, size: [0.16, 0.52, 0.1], spinScale: 0,
      stretch: 0.45, death: 'erode', ease: 'snap', turbulenceScale: 0.04, positionOffset: [0, 0.18, 0],
      referenceSource: 'teleport-hit-afterimage-spines-and-CC0-streak-sprite-language',
      referenceAdaptation: 'the twin mesh spines become a narrow additive arrival column that dies by scale',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'impact', opacity: 1, scale: 1.3, phase: 'teleport-hit-particle-ground-hit',
    tuning: {
      motion: 'shockwave-ground-burst', sprite: 'glow', blend: 'additive', colorOverride: '#54bfff', ramp: 'held',
      lifecycle: 'teleport-hit-particle-arrival', delay: 0.06, window: 0.16, lifeScale: 0.34,
      countScale: 0.7, speedScale: 2.4, speedJitter: 0.36, drag: 1.1, gravity: 0,
      spawnScale: 0.42, depthScale: 2.6, size: [0.22, 0.58, 0.16], spinScale: 0,
      stretch: 0, randomizeAzimuth: true, death: 'erode', ease: 'snap', turbulenceScale: 0.06,
      positionOffset: [0, -0.72, 0],
      referenceSource: 'teleport-hit-ground-aperture-and-CC0-glow-sprite-language',
      referenceAdaptation: 'the closed mesh ring becomes a broken expanding ground flash that dies by scale',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'volume', opacity: 0.78, scale: 1.16, phase: 'teleport-hit-particle-residual-field',
    tuning: {
      motion: 'radial-burst', sprite: 'debris', blend: 'alpha', colorOverride: '#8ecfff', ramp: 'pigment',
      lifecycle: 'teleport-hit-particle-arrival', delay: 0.1, window: 0.22, lifeScale: 0.58,
      countScale: 0.58, speedScale: 1.9, speedJitter: 0.48, drag: 1.2, gravity: -1.6,
      spawnScale: 0.28, depthScale: 2.8, size: [0.1, 0.28, 0.08], spinScale: 0.7,
      stretch: 0, randomizeAzimuth: true, death: 'erode', ease: 'snap', turbulenceScale: 0.08,
      positionOffset: [0, -0.58, 0],
      referenceSource: 'teleport-hit-radial-fractures-and-CC0-debris-sprite-language',
      referenceAdaptation: 'the mesh pylons become uneven debris arcs that rise, slow, and fall',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 1.22)
