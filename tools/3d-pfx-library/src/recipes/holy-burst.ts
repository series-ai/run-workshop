import { authoredRecipe } from '../constants/01'

export default authoredRecipe('holy-burst', 'Holy burst', 'Particle-first blessing receipt adapted from the repo holy-charge grace motes and CC0 critical-hit spark language: a white-gold flare, orbiting sanctity halo, and blue cleansing ascent.', [
  {
    kind: 'particles', role: 'impact', opacity: 1, scale: 0.98, phase: 'holy-burst-reference-sun-flare',
    tuning: {
      motion: 'impact-burst', sprite: 'sparkle', blend: 'additive', colorOverride: '#fff9e6', ramp: 'pinned-hot',
      delay: 0.02, window: 0.13, lifeScale: 0.55, countScale: 0.75, speedScale: 1.8, speedJitter: 0.18,
      drag: 1.9, gravity: -0.2, spawnScale: 0.12, depthScale: 2.6, size: [0.34, 0.58, 0.2],
      stretch: 0.5, spinScale: 0, death: 'erode', ease: 'snap', turbulenceScale: 0,
      positionOffset: [0, 0.06, 0], lifecycle: 'holy-burst-consecration-release',
      referenceSource: 'holy-charge-grace-motes-and-repo-critical-hit-spark',
      referenceAdaptation: 'white-gold-impact-spark-particles-arranged-as-a-short-sanctity-flare',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'aura', opacity: 0.32, scale: 1.06, phase: 'holy-burst-reference-mandorla-halo',
    tuning: {
      motion: 'orbit-ring', sprite: 'glow', blend: 'alpha', colorOverride: '#ffc83d', ramp: 'held',
      delay: 0.03, window: 0.44, lifeScale: 0.9, countScale: 0.52, speedScale: 0.26, spawnScale: 1,
      depthScale: 2.4, size: [0.28, 0.46, 0.18], spinScale: 0, death: 'erode', turbulenceScale: 0.05,
      lifecycle: 'holy-burst-consecration-release',
      referenceSource: 'holy-release-radiant-mandorla',
      referenceAdaptation: 'repo-mandorla-beat-translated-to-a-spatial-gold-rune-orbit',
      referenceLicense: 'repo-original',
    },
  },
  {
    kind: 'particles', role: 'volume', opacity: 0.62, scale: 0.8, phase: 'holy-burst-reference-cleansing-rise',
    tuning: {
      motion: 'column-rise', sprite: 'sparkle', blend: 'additive', colorOverride: '#9edcff', ramp: 'held',
      delay: 0.22, window: 0.24, lifeScale: 0.7, countScale: 0.38, speedScale: 0.92, gravity: 0.02,
      drag: 1.2, depthScale: 2.8, size: [0.13, 0.24, 0.09], spinScale: 0, death: 'erode',
      turbulenceScale: 0.06, positionOffset: [0, 0.02, 0], lifecycle: 'holy-burst-consecration-release',
      referenceSource: 'repo-original-cleansing-spark-rise',
      referenceAdaptation: 'blue-CC0-sparkle-motes-used-as-a-narrow-upward-cleansing-column',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 0.82)
