import { authoredRecipe } from '../constants/01'

export default authoredRecipe('holy-release', 'Holy release', 'Particle-first cleansing punctuation: a wide white core flash, a large gold wave, and rising sparkle residue.', [
  {
    kind: 'particles', role: 'impact', opacity: 1, scale: 3.15, phase: 'holy-release-particle-core-flash',
    tuning: {
      motion: 'impact-burst', sprite: 'glow', blend: 'additive', colorOverride: '#fff9e6', ramp: 'pinned-hot',
      lifecycle: 'holy-release-particle-cleansing', delay: 0, window: 0.16, lifeScale: 0.42,
      countScale: 1.5, speedScale: 2.4, speedJitter: 0.22, drag: 1.8, gravity: 0,
      spawnScale: 0.18, depthScale: 2.4, size: [0.55, 1.35, 0.28], spinScale: 0,
      stretch: 0, death: 'erode', ease: 'snap', turbulenceScale: 0, positionOffset: [0, 0.06, 0],
      referenceSource: 'holy-burst-sun-flare-and-CC0-glow-sprite-language',
      referenceAdaptation: 'the faceted mesh nucleus becomes a wide additive release flash',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'impact', opacity: 0.94, scale: 3.4, phase: 'holy-release-particle-cleansing-wave',
    tuning: {
      motion: 'radial-burst', sprite: 'streak', blend: 'additive', colorOverride: '#ffd95a', ramp: 'held',
      lifecycle: 'holy-release-particle-cleansing', delay: 0.04, window: 0.28, lifeScale: 0.62,
      countScale: 2.6, speedScale: 4.8, speedJitter: 0.36, drag: 0.82, gravity: 0,
      spawnScale: 0.28, depthScale: 3, size: [0.26, 0.92, 0.16], spinScale: 0.22,
      stretch: 0.62, randomizeAzimuth: true, death: 'erode', ease: 'snap', turbulenceScale: 0.05,
      positionOffset: [0, 0.04, 0],
      referenceSource: 'holy-release-cross-axis-rays-and-CC0-streak-sprite-language',
      referenceAdaptation: 'the rigid mesh rays become a wide expanding gold wave that dies by scale',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'volume', opacity: 0.78, scale: 2.9, phase: 'holy-release-particle-upward-finish',
    tuning: {
      motion: 'column-rise', sprite: 'sparkle', blend: 'additive', colorOverride: '#ffe08a', ramp: 'held',
      lifecycle: 'holy-release-particle-cleansing', delay: 0.12, window: 0.36, lifeScale: 0.78,
      countScale: 1.4, speedScale: 2.2, speedJitter: 0.32, drag: 1.15, gravity: 0,
      spawnScale: 1.8, depthScale: 2.6, size: [0.2, 0.52, 0.12], spinScale: 0.35,
      stretch: 0, death: 'erode', ease: 'snap', turbulenceScale: 0.08, positionOffset: [0, 0.08, 0],
      referenceSource: 'holy-burst-cleansing-rise-and-CC0-sparkle-sprite-language',
      referenceAdaptation: 'the mesh rays become rising sparkle residue with independent lifetimes',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 1.15)
