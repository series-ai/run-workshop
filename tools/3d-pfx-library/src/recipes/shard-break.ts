import { authoredRecipe } from '../constants/01'

export default authoredRecipe('shard-break', 'Shard break', 'Particle-first crystal despawn: a white ignition flash, tumbling debris, and cooling chips.', [
  {
    kind: 'particles', role: 'impact', opacity: 1, scale: 3.05, phase: 'shard-break-particle-ignition-flash',
    tuning: {
      motion: 'impact-burst', sprite: 'glow', blend: 'additive', colorOverride: '#ecfdff', ramp: 'pinned-hot',
      lifecycle: 'shard-break-particle-fracture', delay: 0, window: 0.12, lifeScale: 0.32,
      countScale: 1.2, speedScale: 2.4, speedJitter: 0.2, drag: 2.2, gravity: 0,
      spawnScale: 0.12, depthScale: 2.4, size: [0.48, 1.15, 0.24], spinScale: 0,
      stretch: 0, death: 'erode', ease: 'snap', turbulenceScale: 0, positionOffset: [0, -0.18, 0],
      referenceSource: 'shard-break-ignition-core-and-CC0-glow-sprite-language',
      referenceAdaptation: 'the faceted ignition seed becomes a compact white-hot fracture flash',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'impact', opacity: 0.96, scale: 3.25, phase: 'shard-break-particle-crystal-debris',
    tuning: {
      motion: 'radial-burst', sprite: 'debris', blend: 'alpha', colorOverride: '#bfe8ff', ramp: 'pigment',
      lifecycle: 'shard-break-particle-fracture', delay: 0.02, window: 0.22, lifeScale: 0.82,
      countScale: 2.2, speedScale: 4.6, speedJitter: 0.48, drag: 0.85, gravity: -3.4,
      spawnScale: 0.16, depthScale: 3.2, size: [0.22, 0.58, 0.16], spinScale: 1.05,
      stretch: 0, randomizeAzimuth: true, death: 'erode', ease: 'snap', turbulenceScale: 0.04,
      positionOffset: [0, -0.16, 0],
      referenceSource: 'shard-break-crystal-fragments-and-CC0-debris-sprite-language',
      referenceAdaptation: 'the closed crystal chunks become tumbling debris with independent fall',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'trail', opacity: 0.88, scale: 2.85, phase: 'shard-break-particle-cooling-chips',
    tuning: {
      motion: 'radial-burst', sprite: 'sparkle', blend: 'additive', colorOverride: '#e3fbff', ramp: 'pinned-hot',
      lifecycle: 'shard-break-particle-fracture', delay: 0.06, window: 0.18, lifeScale: 0.55,
      countScale: 1.5, speedScale: 3.8, speedJitter: 0.4, drag: 1.1, gravity: 0,
      spawnScale: 0.14, depthScale: 2.8, size: [0.16, 0.42, 0.1], spinScale: 0.45,
      stretch: 0.22, randomizeAzimuth: true, death: 'erode', ease: 'snap', turbulenceScale: 0.05,
      positionOffset: [0, -0.12, 0],
      referenceSource: 'shard-break-cooling-chips-and-CC0-sparkle-sprite-language',
      referenceAdaptation: 'the cooling chips become fast spark pops that die by scale',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 1.4)
