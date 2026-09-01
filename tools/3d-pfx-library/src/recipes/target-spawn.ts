import { authoredRecipe } from '../constants/01'

export default authoredRecipe('target-spawn', 'Target spawn', 'Particle-first acquisition: a ground reticle ring, a rising confirmation stream, and a short lock flash.', [
  {
    kind: 'particles', role: 'aura', opacity: 0.94, scale: 3.05, phase: 'target-spawn-particle-ground-reticle',
    tuning: {
      motion: 'ground-ring', sprite: 'sparkle', blend: 'additive', colorOverride: '#72d7ff', ramp: 'held',
      lifecycle: 'target-spawn-particle-acquire', delay: 0, window: 0.7, lifeScale: 1.15,
      countScale: 2.2, speedScale: 0.55, speedJitter: 0.18, drag: 1.8, gravity: 0,
      spawnScale: 1.65, depthScale: 2.2, size: [0.2, 0.48, 0.14], spinScale: 0.2,
      stretch: 0, death: 'erode', flicker: 0.28, turbulenceScale: 0.05, positionOffset: [0, 0, 0],
      referenceSource: 'target-spawn-acquisition-reticle-and-CC0-sparkle-sprite-language',
      referenceAdaptation: 'the mesh acquisition gates become a broken sparkle ground ring',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'body', opacity: 0.96, scale: 3.2, phase: 'target-spawn-particle-confirm-stream',
    tuning: {
      motion: 'column-rise', sprite: 'glow', blend: 'additive', colorOverride: '#e8f8ff', ramp: 'held',
      lifecycle: 'target-spawn-particle-acquire', delay: 0.12, window: 0.55, lifeScale: 1.05,
      countScale: 2.4, speedScale: 3.6, speedJitter: 0.26, drag: 1.2, gravity: 0,
      spawnScale: 1.4, depthScale: 2.4, size: [0.22, 0.64, 0.16], spinScale: 0.1,
      stretch: 0, death: 'erode', flicker: 0.2, turbulenceScale: 0.04, positionOffset: [0, -0.2, 0],
      referenceSource: 'target-spawn-confirmation-pin-and-CC0-glow-sprite-language',
      referenceAdaptation: 'the lifted confirmation pin becomes a short rising lock stream',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'impact', opacity: 1, scale: 2.7, phase: 'target-spawn-particle-lock-flash',
    tuning: {
      motion: 'impact-burst', sprite: 'sparkle', blend: 'additive', colorOverride: '#d8fbff', ramp: 'pinned-hot',
      lifecycle: 'target-spawn-particle-acquire', delay: 0.38, window: 0.18, lifeScale: 0.36,
      countScale: 1.1, speedScale: 2.2, speedJitter: 0.24, drag: 2.0, gravity: 0,
      spawnScale: 0.18, depthScale: 2.2, size: [0.28, 0.72, 0.16], spinScale: 0.25,
      stretch: 0, death: 'erode', ease: 'snap', turbulenceScale: 0.04, positionOffset: [0, 0.55, 0],
      referenceSource: 'target-spawn-lock-confirm-and-CC0-sparkle-sprite-language',
      referenceAdaptation: 'the pin tip becomes a short confirm flash that dies by scale',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 1.45)
