import { authoredRecipe } from '../constants/01'

export default authoredRecipe('laser-spray', 'Laser spray', 'Particle-first salvo: a hot muzzle flash, a fan of independent bolts, and endpoint sparks that stay attached to the spray.', [
  {
    kind: 'particles', role: 'body', opacity: 1, scale: 1.85, phase: 'laser-spray-particle-muzzle-flash',
    tuning: {
      motion: 'impact-burst', sprite: 'glow', blend: 'additive', colorOverride: '#8cf6ff', ramp: 'pinned-hot',
      lifecycle: 'laser-spray-particle-salvo', delay: 0, window: 0.12, lifeScale: 0.28,
      countScale: 0.7, speedScale: 1.8, speedJitter: 0.18, drag: 2.2, gravity: 0,
      spawnScale: 0.1, depthScale: 2.2, size: [0.24, 0.55, 0.16], spinScale: 0,
      stretch: 0, death: 'erode', ease: 'snap', turbulenceScale: 0, positionOffset: [-1.55, -0.12, 0],
      referenceSource: 'laser-spray-open-bore-nozzle-and-CC0-glow-sprite-language',
      referenceAdaptation: 'the faceted muzzle mesh becomes a compact additive ignition flash at the bore',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'trail', opacity: 0.98, scale: 3.35, phase: 'laser-spray-particle-salvo-streaks',
    tuning: {
      motion: 'radial-burst', sprite: 'streak', blend: 'additive', colorOverride: '#ff3d1f', ramp: 'pinned-hot',
      lifecycle: 'laser-spray-particle-salvo', delay: 0.03, window: 0.34, lifeScale: 0.58,
      countScale: 2.4, speedScale: 5.4, speedJitter: 0.42, drag: 0.7, gravity: 0,
      spawnScale: 0.22, depthScale: 2.8, size: [0.22, 0.86, 0.14], spinScale: 0.12,
      stretch: 0.88, randomizeAzimuth: true, impactVector: [1, 0.08, 0.12], spreadAngle: 0.62,
      death: 'erode', ease: 'snap', turbulenceScale: 0.04, positionOffset: [-1.15, -0.1, 0],
      referenceSource: 'laser-spray-bolt-rack-and-CC0-streak-sprite-language',
      referenceAdaptation: 'the sequenced bolt mesh becomes an uneven fan of independent laser streaks',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'impact', opacity: 0.92, scale: 2.85, phase: 'laser-spray-particle-endpoint-sparks',
    tuning: {
      motion: 'laser-spray-ricochet', sprite: 'sparkle', blend: 'additive', colorOverride: '#ffb23c', ramp: 'pinned-hot',
      lifecycle: 'laser-spray-particle-salvo', delay: 0.12, window: 0.28, lifeScale: 0.42,
      countScale: 1.4, speedScale: 2.6, speedJitter: 0.36, drag: 1.5, gravity: 0,
      spawnScale: 0.28, depthScale: 2.6, size: [0.22, 0.58, 0.14], spinScale: 0.35,
      stretch: 0.2, death: 'erode', flicker: 0.7, turbulenceScale: 0.06, positionOffset: [0.2, 0, 0],
      referenceSource: 'laser-spray-endpoint-energy-and-CC0-sparkle-sprite-language',
      referenceAdaptation: 'detached endpoint energy becomes spark pops that stay on the spray range',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 1.2)
