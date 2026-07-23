import { authoredRecipe } from '../constants/01'

export default authoredRecipe('electric-critical', 'Electric critical', 'Particle-first electric critical: a white contact crack, a seeded cyan fork fan, and rising charge motes make the discharge irregular without a rigid voltage cage.', [
  {
    kind: 'particles', role: 'impact', opacity: 0.98, scale: 0.88, phase: 'electric-critical-particle-contact-crack',
    tuning: {
      motion: 'impact-burst', sprite: 'streak', blend: 'additive', colorOverride: '#eafcff', ramp: 'pinned-hot',
      lifecycle: 'electric-critical-particle-discharge', delay: 0, window: 0.12, lifeScale: 0.34,
      countScale: 0.2, speedScale: 3.2, speedJitter: 0.5, drag: 2.3, gravity: 0,
      spawnScale: 0.08, depthScale: 3, stretch: 0.9, size: [0.12, 0.38, 0.08],
      spinScale: 0.4, death: 'erode', ease: 'snap', turbulenceScale: 0.03,
      referenceSource: 'electric-critical-voltage-cage-and-CC0-streak-sprite-language',
      referenceAdaptation: 'the contact nexus becomes a short white crackle pop that hands the eye to the irregular fork fan',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'impact', opacity: 0.94, scale: 1.08, phase: 'electric-critical-particle-fork-fan',
    tuning: {
      motion: 'radial-burst', sprite: 'streak', blend: 'additive', colorOverride: '#5eeaff', ramp: 'held',
      lifecycle: 'electric-critical-particle-discharge', delay: 0.025, window: 0.34, lifeScale: 0.62,
      countScale: 0.24, speedScale: 3.4, speedJitter: 0.56, drag: 0.9, gravity: -0.35,
      spawnScale: 0.12, depthScale: 3.4, stretch: 0.46, size: [0.08, 0.34, 0.06],
      spinScale: 0.7, death: 'erode', ease: 'snap', turbulenceScale: 0.1,
      impactVector: [1, 0.08, 0.04], spreadAngle: 0.72,
      referenceSource: 'electric-critical-six-ray-discharge-and-CC0-streak-sprite-language',
      referenceAdaptation: 'six rays and Y-forks become uneven seeded fork directions with speed jitter instead of repeated rigid branches',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'aura', opacity: 0.72, scale: 0.92, phase: 'electric-critical-particle-charge-rise',
    tuning: {
      motion: 'column-rise', sprite: 'glow', blend: 'alpha', colorOverride: '#ffd45a', ramp: 'held',
      lifecycle: 'electric-critical-particle-discharge', delay: 0.12, window: 0.36, lifeScale: 0.84,
      countScale: 0.1, speedScale: 0.76, speedJitter: 0.46, drag: 1.15, gravity: 0,
      spawnScale: 0.62, depthScale: 3.2, size: [0.08, 0.24, 0.08], spinScale: 0,
      flicker: 1.8, death: 'erode', turbulenceScale: 0.18, positionOffset: [0, 0.04, 0],
      referenceSource: 'electric-critical-crown-nexus-and-CC0-spark-sprite-language',
      referenceAdaptation: 'gold crown accents become sparse rising charge motes that break the cyan mass and keep side views alive',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 1.5)
