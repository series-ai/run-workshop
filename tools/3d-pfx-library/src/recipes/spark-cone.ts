import { authoredRecipe } from '../constants/01'

export default authoredRecipe('spark-cone', 'Spark cone', 'Particle-first directional spark cone: a hot source pop feeds an upward fan of uneven streaks while a smoky cooling handoff carries the cone through depth.', [
  {
    kind: 'particles', role: 'impact', opacity: 0.98, scale: 1, phase: 'spark-cone-particle-source-pop',
    tuning: {
      motion: 'impact-burst', sprite: 'soft', blend: 'additive', colorOverride: '#fff3c4', ramp: 'pinned-hot',
      lifecycle: 'spark-cone-particle-release', delay: 0, window: 0.08, lifeScale: 0.38,
      countScale: 0.24, speedScale: 2.8, speedJitter: 0.3, drag: 2.2, gravity: 0,
      spawnScale: 0.04, depthScale: 3, size: [0.18, 0.38, 0.12], spinScale: 0, stretch: 0.05,
      death: 'erode', ease: 'snap', turbulenceScale: 0, positionOffset: [0, -0.68, 0],
      referenceSource: 'spark-cone-source-ignition-and-CC0-soft-sprite-language',
      referenceAdaptation: 'the nozzle becomes a compact white-hot source pop that hands off immediately to the directional fan',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'impact', opacity: 0.98, scale: 1.45, phase: 'spark-cone-particle-directional-fan',
    tuning: {
      motion: 'cone-fountain', sprite: 'streak', blend: 'additive', colorOverride: '#ffb33f', ramp: 'pinned-hot',
      lifecycle: 'spark-cone-particle-release', delay: 0.015, window: 0.36, lifeScale: 0.72,
      countScale: 0.98, speedScale: 4.4, speedJitter: 0.5, drag: 0.68, gravity: -3.6,
      spawnScale: 0.12, depthScale: 3.8, size: [0.16, 0.46, 0.1], spinScale: 0.6, stretch: 0.38,
      death: 'erode', ease: 'snap', turbulenceScale: 0.03, impactVector: [1, 0.18, 0.08], spreadAngle: 0.58, positionOffset: [0, -0.68, 0],
      referenceSource: 'spark-cone-streak-prisms-and-CC0-streak-sprite-language',
      referenceAdaptation: 'the rigid prism fan becomes unequal velocity-stretched spark lanes with a declared forward cone and gravity-driven cooling',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'volume', opacity: 0.6, scale: 1.24, phase: 'spark-cone-particle-cooling-smoke',
    tuning: {
      motion: 'drift-cloud', sprite: 'smoke-variants', blend: 'alpha', colorOverride: '#76462f', ramp: 'dark',
      lifecycle: 'spark-cone-particle-release', delay: 0.18, window: 0.44, lifeScale: 0.96,
      countScale: 0.5, speedScale: 0.22, speedJitter: 0.42, drag: 1.4, gravity: 0.03,
      spawnScale: 0.66, spawnLift: 0.02, depthScale: 3.4, size: [0.36, 0.9, 0.64], spinScale: 0.24,
      death: 'erode', turbulenceScale: 0.2, positionOffset: [0, -0.58, 0],
      referenceSource: 'spark-cone-cooling-residue-and-CC0-smoke-variants',
      referenceAdaptation: 'the dark cooling tail becomes a low smoky handoff instead of a second rigid streak mesh',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 1.35)
