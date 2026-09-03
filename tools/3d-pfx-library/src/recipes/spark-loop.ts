import { authoredRecipe } from '../constants/01'

export default authoredRecipe('spark-loop', 'Spark loop', 'Particle-first contact electricity: a hot source pop, a snapping streak fork, and recovering pips.', [
  {
    kind: 'particles', role: 'body', opacity: 1, scale: 2.85, phase: 'spark-loop-particle-source-pop',
    tuning: {
      motion: 'impact-burst', sprite: 'glow', blend: 'additive', colorOverride: '#fff1ad', ramp: 'pinned-hot',
      lifecycle: 'spark-loop-particle-contact', delay: 0, window: 0.22, lifeScale: 0.38,
      countScale: 1.1, speedScale: 2.2, speedJitter: 0.22, drag: 2.2, gravity: 0,
      spawnScale: 0.1, depthScale: 2.4, size: [0.4, 0.95, 0.22], spinScale: 0,
      stretch: 0, death: 'erode', flicker: 0.8, turbulenceScale: 0, positionOffset: [0, 0.28, 0],
      referenceSource: 'spark-gap-contact-core-and-CC0-glow-sprite-language',
      referenceAdaptation: 'the held contact orb becomes a hot source pop that starts the snap cadence',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'body', opacity: 0.98, scale: 3.35, phase: 'spark-loop-particle-fork-snap',
    tuning: {
      motion: 'radial-burst', sprite: 'streak', blend: 'additive', colorOverride: '#ffb000', ramp: 'pinned-hot',
      lifecycle: 'spark-loop-particle-contact', delay: 0.02, window: 0.28, lifeScale: 0.48,
      countScale: 2.2, speedScale: 4.8, speedJitter: 0.46, drag: 0.75, gravity: 0,
      spawnScale: 0.16, depthScale: 3.2, size: [0.2, 0.78, 0.12], spinScale: 0.4,
      stretch: 0.85, randomizeAzimuth: true, death: 'erode', flicker: 1.4, turbulenceScale: 0.05,
      positionOffset: [0, 0.28, 0],
      referenceSource: 'spark-gap-fork-volume-and-CC0-streak-sprite-language',
      referenceAdaptation: 'the closed zig-zag fork becomes independent snapping streaks with real depth',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'impact', opacity: 0.9, scale: 2.7, phase: 'spark-loop-particle-contact-pips',
    tuning: {
      motion: 'radial-burst', sprite: 'glow', blend: 'additive', colorOverride: '#fff1ad', ramp: 'pinned-hot',
      lifecycle: 'spark-loop-particle-contact', delay: 0.1, window: 0.34, lifeScale: 0.55,
      countScale: 1.4, speedScale: 2.4, speedJitter: 0.4, drag: 1.8, gravity: 0,
      spawnScale: 0.18, depthScale: 2.6, size: [0.18, 0.42, 0.12], spinScale: 0,
      stretch: 0, death: 'erode', flicker: 2.2, turbulenceScale: 0.08, positionOffset: [0, 0.28, 0],
      referenceSource: 'spark-gap-contact-pips-and-CC0-glow-sprite-language',
      referenceAdaptation: 'the contact pips remain as recovering hot dots after the fork snap',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 1)
