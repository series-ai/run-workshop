import { authoredRecipe } from '../constants/01'

export default authoredRecipe('curse-column', 'Curse column', 'Particle-first dark binding: a tight rune lock, a narrow rising stream, and a close falling rune veil.', [
  {
    kind: 'particles', role: 'aura', opacity: 0.86, scale: 1.95, phase: 'curse-column-particle-ground-seal',
    tuning: {
      motion: 'ground-ring', sprite: 'rune', blend: 'additive', colorOverride: '#e9ceff', ramp: 'pinned-hot',
      lifecycle: 'curse-column-particle-binding', delay: 0, window: 1, lifeScale: 1.45,
      countScale: 2.2, speedScale: 0.32, speedJitter: 0.1, drag: 2.0, gravity: 0,
      spawnScale: 0.78, depthScale: 2.0, size: [0.08, 0.16, 0.08], spinScale: 0.16,
      stretch: 0, death: 'erode', flicker: 0.12, turbulenceScale: 0.04, positionOffset: [0, 0, 0],
      referenceSource: 'curse-column-binding-seal-and-CC0-rune-sprite-language',
      referenceAdaptation: 'the mesh seal becomes a tight rune ground ring',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'body', opacity: 0.96, scale: 2.55, phase: 'curse-column-particle-torment-stream',
    tuning: {
      motion: 'column-rise', sprite: 'streak', blend: 'additive', colorOverride: '#8534d4', ramp: 'held',
      lifecycle: 'curse-column-particle-binding', delay: 0, window: 0.96, lifeScale: 1.65,
      countScale: 4.0, speedScale: 8.4, speedJitter: 0.18, drag: 0.9, gravity: 0,
      spawnScale: 0.3, depthScale: 2.2, size: [0.1, 0.32, 0.1], spinScale: 0.08,
      stretch: 0.7, death: 'erode', flicker: 0.12, turbulenceScale: 0.04, positionOffset: [0, -0.28, 0],
      referenceSource: 'curse-column-twisted-spire-and-CC0-streak-sprite-language',
      referenceAdaptation: 'the torment pillar becomes a narrow rising purple stream',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'volume', opacity: 0.72, scale: 2.15, phase: 'curse-column-particle-falling-runes',
    tuning: {
      motion: 'drift-cloud', sprite: 'rune', blend: 'additive', colorOverride: '#c483ff', ramp: 'held',
      lifecycle: 'curse-column-particle-binding', delay: 0.06, window: 0.88, lifeScale: 1.15,
      countScale: 1.4, speedScale: 0.45, speedJitter: 0.2, drag: 1.35, gravity: -1.4,
      spawnScale: 0.7, depthScale: 2.2, size: [0.1, 0.2, 0.1], spinScale: 0.22,
      stretch: 0, death: 'erode', turbulenceScale: 0.08, positionOffset: [0, 0.38, 0],
      referenceSource: 'curse-column-falling-rune-volume-and-CC0-rune-sprite-language',
      referenceAdaptation: 'falling runes stay close to the stream instead of scattering',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 1)
