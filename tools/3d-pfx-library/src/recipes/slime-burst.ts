import { authoredRecipe } from '../constants/01'

export default authoredRecipe('slime-burst', 'Slime burst', 'Particle-first elastic splat: a sticky contact splat rebounds into bubbling upward droplets while a translucent ooze cloud lags behind the impact.', [
  {
    kind: 'particles', role: 'impact', opacity: 0.98, scale: 1.16, phase: 'slime-burst-particle-sticky-contact',
    tuning: {
      motion: 'impact-burst', sprite: 'splat', blend: 'alpha', colorOverride: '#3b9f52', ramp: 'pigment',
      lifecycle: 'slime-burst-particle-elasticity', delay: 0, window: 0.18, lifeScale: 0.48,
      countScale: 0.62, speedScale: 2.1, speedJitter: 0.46, drag: 1.8, gravity: -0.8,
      spawnScale: 0.12, depthScale: 3, size: [0.28, 0.64, 0.42], spinScale: 0.5,
      death: 'erode', ease: 'snap', turbulenceScale: 0.08, positionOffset: [0, -0.34, 0],
      referenceSource: 'slime-burst-sculpted-gel-crown-and-CC0-splat-sprite-language',
      referenceAdaptation: 'the closed gel crown becomes a short sticky contact splat with a broad translucent footprint',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'trail', opacity: 0.94, scale: 1.22, phase: 'slime-burst-particle-bubble-fountain',
    tuning: {
      motion: 'cone-fountain', sprite: 'bubble', blend: 'alpha', colorOverride: '#b8ff75', ramp: 'held',
      lifecycle: 'slime-burst-particle-elasticity', delay: 0.035, window: 0.38, lifeScale: 0.82,
      countScale: 0.86, speedScale: 2.4, speedJitter: 0.56, drag: 0.82, gravity: -2.1,
      spawnScale: 0.18, depthScale: 3.3, size: [0.14, 0.42, 0.18], spinScale: 0.4,
      randomizeAzimuth: true, death: 'erode', ease: 'snap', turbulenceScale: 0.08, positionOffset: [0, -0.22, 0],
      referenceSource: 'slime-burst-bubble-droplet-volume-and-CC0-bubble-sprite-language',
      referenceAdaptation: 'the bubble/string volume becomes unequal upward gel bubbles with independent lift, depth, and fall',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'volume', opacity: 0.64, scale: 1.3, phase: 'slime-burst-particle-ooze-cloud',
    tuning: {
      motion: 'drift-cloud', sprite: 'smoke-variants', blend: 'alpha', colorOverride: '#347447', ramp: 'pigment',
      lifecycle: 'slime-burst-particle-elasticity', delay: 0.16, window: 0.46, lifeScale: 0.98,
      countScale: 0.56, speedScale: 0.2, speedJitter: 0.44, drag: 1.4, gravity: 0.02,
      spawnScale: 0.76, spawnLift: -0.02, depthScale: 3.2, size: [0.38, 0.86, 0.66], spinScale: 0.25,
      death: 'erode', turbulenceScale: 0.24, positionOffset: [0, -0.34, 0],
      referenceSource: 'slime-burst-viscous-residue-and-CC0-smoke-variants',
      referenceAdaptation: 'the elastic tail becomes a delayed soft ooze bed that grounds the bubbles without a second mesh shell',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 1.15)
