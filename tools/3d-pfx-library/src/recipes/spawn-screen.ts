import { authoredRecipe } from '../constants/01'

export default authoredRecipe('spawn-screen', 'Spawn screen marker', 'Particle-first screen spawn: a cyan bloom, converging data, and confirmation sparks.', [
  {
    kind: 'particles', role: 'screen', opacity: 0.86, scale: 3.15, phase: 'spawn-screen-particle-acquisition-bloom',
    tuning: {
      motion: 'radial-burst', sprite: 'glow', blend: 'additive', colorOverride: '#2bbde8', ramp: 'held',
      lifecycle: 'spawn-screen-particle-transition', delay: 0, window: 0.4, lifeScale: 0.7,
      countScale: 1.6, speedScale: 2.2, speedJitter: 0.22, drag: 1.8, gravity: 0,
      spawnScale: 0.22, depthScale: 1.4, size: [0.42, 1.05, 0.28], spinScale: 0,
      stretch: 0, death: 'erode', ease: 'snap', turbulenceScale: 0.04, positionOffset: [0, 0, 0],
      referenceSource: 'spawn-screen-acquisition-bloom-and-CC0-glow-sprite-language',
      referenceAdaptation: 'the mesh bloom card becomes a cyan additive pop that dies by scale',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'screen', opacity: 0.96, scale: 3.25, phase: 'spawn-screen-particle-converging-data',
    tuning: {
      motion: 'converge-center', sprite: 'debris', blend: 'additive', colorOverride: '#a8f1ff', ramp: 'pinned-hot',
      lifecycle: 'spawn-screen-particle-transition', delay: 0.06, window: 0.5, lifeScale: 0.85,
      countScale: 2.2, speedScale: 2.4, speedJitter: 0.2, drag: 1.1, gravity: 0,
      spawnScale: 1.35, depthScale: 1.6, size: [0.22, 0.5, 0.14], spinScale: 0.22,
      stretch: 0, death: 'erode', turbulenceScale: 0, positionOffset: [0, 0, 0],
      referenceSource: 'spawn-screen-converging-data-fragments-and-CC0-debris-sprite-language',
      referenceAdaptation: 'the avatar lattice becomes converging data fragments that assemble at center',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'screen', opacity: 0.9, scale: 2.85, phase: 'spawn-screen-particle-confirm-sparks',
    tuning: {
      motion: 'radial-burst', sprite: 'sparkle', blend: 'additive', colorOverride: '#35d8ff', ramp: 'pinned-hot',
      lifecycle: 'spawn-screen-particle-transition', delay: 0.28, window: 0.24, lifeScale: 0.42,
      countScale: 1.4, speedScale: 2.6, speedJitter: 0.3, drag: 1.6, gravity: 0,
      spawnScale: 0.2, depthScale: 1.5, size: [0.2, 0.52, 0.12], spinScale: 0.3,
      stretch: 0, death: 'erode', ease: 'snap', flicker: 0.45, turbulenceScale: 0.04, positionOffset: [0, 0, 0],
      referenceSource: 'spawn-screen-confirmation-sparks-and-CC0-sparkle-sprite-language',
      referenceAdaptation: 'the reticle confirm becomes short spark pops that finish the spawn ping',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 1.1)
