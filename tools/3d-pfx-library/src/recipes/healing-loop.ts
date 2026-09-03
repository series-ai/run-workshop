import { authoredRecipe } from '../constants/01'

export default authoredRecipe('healing-loop', 'Healing loop', 'Particle-first renewal: a mint ground ring, thin rising strands, and small warm seeds.', [
  {
    kind: 'particles', role: 'aura', opacity: 0.7, scale: 2.05, phase: 'healing-loop-particle-sanctuary-ring',
    tuning: {
      motion: 'ground-ring', sprite: 'glow', blend: 'additive', colorOverride: '#7ef0b0', ramp: 'held',
      lifecycle: 'healing-loop-particle-renewal', delay: 0, window: 1, lifeScale: 1.5,
      countScale: 2.6, speedScale: 0.28, speedJitter: 0.08, drag: 2.0, gravity: 0,
      spawnScale: 1.05, depthScale: 2.0, size: [0.08, 0.16, 0.08], spinScale: 0,
      stretch: 0, death: 'erode', turbulenceScale: 0.04, positionOffset: [0, 0, 0],
      referenceSource: 'healing-loop-sanctuary-torus-and-CC0-glow-sprite-language',
      referenceAdaptation: 'the sanctuary torus becomes a stable mint ground ring with an open center',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'body', opacity: 0.88, scale: 2.25, phase: 'healing-loop-particle-renewal-strands',
    tuning: {
      motion: 'healing-spiral', sprite: 'sparkle', blend: 'additive', colorOverride: '#41e985', ramp: 'held',
      lifecycle: 'healing-loop-particle-renewal', delay: 0, window: 1, lifeScale: 1.55,
      countScale: 2.6, speedScale: 2.8, speedJitter: 0.12, drag: 1.1, gravity: 0,
      spawnScale: 0.9, depthScale: 2.2, size: [0.08, 0.18, 0.08], spinScale: 0.12,
      stretch: 0, death: 'erode', flicker: 0.12, turbulenceScale: 0.04, positionOffset: [0, 0.08, 0],
      referenceSource: 'healing-loop-renewal-helix-and-CC0-sparkle-sprite-language',
      referenceAdaptation: 'the helix becomes two thin rising strands with low bloom',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'impact', opacity: 0.76, scale: 1.95, phase: 'healing-loop-particle-warm-seeds',
    tuning: {
      motion: 'column-rise', sprite: 'sparkle', blend: 'additive', colorOverride: '#fff0b0', ramp: 'pinned-hot',
      lifecycle: 'healing-loop-particle-renewal', delay: 0.1, window: 0.85, lifeScale: 1.2,
      countScale: 1.2, speedScale: 1.6, speedJitter: 0.2, drag: 1.3, gravity: 0,
      spawnScale: 0.5, depthScale: 2.0, size: [0.06, 0.14, 0.06], spinScale: 0.16,
      stretch: 0, death: 'erode', flicker: 0.22, turbulenceScale: 0.04, positionOffset: [0, -0.18, 0],
      referenceSource: 'repo-original-restoration-seed-sparks-and-CC0-sparkle-sprite-language',
      referenceAdaptation: 'warm seed sparks stay small and rise through the strands',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 0.6)
