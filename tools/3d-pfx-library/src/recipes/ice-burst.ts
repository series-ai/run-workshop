import { authoredRecipe } from '../constants/01'

export default authoredRecipe('ice-burst', "Ice burst", "Particle-first cold impact: a hard rime contact, a fan of irregular crystal motes, and a soft frost haze make the small burst readable without a ring and cloud mesh stack.", [
  {
    kind: 'particles', role: 'impact', opacity: 0.9, scale: 0.9, phase: 'ice-burst-particle-rime-contact',
    tuning: {
      motion: 'impact-burst', sprite: 'twirl', blend: 'alpha', colorOverride: '#bfe8ff', ramp: 'held',
      lifecycle: 'ice-burst-particle-impact', delay: 0, window: 0.16, lifeScale: 0.46,
      countScale: 0.46, speedScale: 2.8, speedJitter: 0.48, drag: 2.1, gravity: -1.8,
      spawnScale: 0.1, depthScale: 2.8, size: [0.12, 0.38, 0.1], spinScale: 0.8,
      stretch: 0.38, death: 'erode', ease: 'snap', turbulenceScale: 0.03, positionOffset: [0, -0.26, 0],
      referenceSource: 'ice-burst-grounded-splinters-and-CC0-twirl-sprite-language',
      referenceAdaptation: 'the small crystal cluster becomes a hard rime contact with uneven depth instead of a tiny flat shard mesh',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'impact', opacity: 0.82, scale: 0.96, phase: 'ice-burst-particle-crystal-fan',
    tuning: {
      motion: 'cone-fountain', sprite: 'sparkle', blend: 'additive', colorOverride: '#edfaff', ramp: 'pinned-hot',
      lifecycle: 'ice-burst-particle-impact', delay: 0.06, window: 0.32, lifeScale: 0.7,
      countScale: 0.58, speedScale: 2.7, speedJitter: 0.52, drag: 0.92, gravity: -2.4,
      spawnScale: 0.14, depthScale: 3.2, size: [0.1, 0.32, 0.08], spinScale: 0.9,
      stretch: 0.18, death: 'erode', ease: 'snap', turbulenceScale: 0.06, positionOffset: [0, -0.1, 0],
      referenceSource: 'ice-burst-airborne-chips-and-CC0-sparkle-sprite-language',
      referenceAdaptation: 'faceted chips become staggered crystal sparks with varied lift and gravity-driven descent',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'volume', opacity: 0.46, scale: 1.12, phase: 'ice-burst-particle-frost-haze',
    tuning: {
      motion: 'drift-cloud', sprite: 'smoke', blend: 'alpha', colorOverride: '#8fc9df', ramp: 'pigment',
      lifecycle: 'ice-burst-particle-impact', delay: 0.14, window: 0.42, lifeScale: 1.02,
      countScale: 0.4, speedScale: 0.24, speedJitter: 0.4, drag: 1.45, gravity: 0.02,
      spawnScale: 0.76, spawnLift: 0.02, depthScale: 3.2, size: [0.3, 0.7, 0.54],
      spinScale: 0.28, death: 'erode', turbulenceScale: 0.2, positionOffset: [0, -0.12, 0],
      referenceSource: 'ice-burst-frost-mist-and-CC0-smoke-sprite-language',
      referenceAdaptation: 'the cold boundary becomes a low translucent frost haze that supports the crystals without a generic shockwave',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 1.3)
