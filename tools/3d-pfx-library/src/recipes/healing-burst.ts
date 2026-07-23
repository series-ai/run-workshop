import { authoredRecipe } from '../constants/01'

export default authoredRecipe('healing-burst', 'Healing burst', 'Particle-first restoration receipt adapted from the repo healing-charge spiral and CC0/repo glyph language: a sparse three-axis cross lattice, mint halo, and warm seed sparks.', [
  {
    kind: 'particles', role: 'body', opacity: 0.96, scale: 0.78, phase: 'healing-burst-reference-cross-motes',
    tuning: {
      motion: 'healing-cross', sprite: 'glow', blend: 'alpha', colorOverride: '#37d982', ramp: 'held',
      window: 0.3, lifeScale: 0.92, countScale: 0.9, speedScale: 0.24, drag: 3, gravity: 0,
      depthScale: 2.4, size: [0.3, 0.46, 0.22], spinScale: 0, death: 'erode', ease: 'snap', turbulenceScale: 0,
      positionOffset: [0, -0.08, 0], lifecycle: 'healing-burst-restoration-release',
      referenceSource: 'healing-charge-spiral-and-repo-healing-glyph-language',
      referenceAdaptation: 'three-axis-cross-rebuilt-as-an-analytic-particle-lattice-with-real-depth',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'aura', opacity: 0.32, scale: 1, phase: 'healing-burst-reference-sanctuary-halo',
    tuning: {
      motion: 'orbit-ring', sprite: 'glow', blend: 'additive', colorOverride: '#d7f8df', ramp: 'held',
      delay: 0.03, window: 0.5, lifeScale: 0.92, countScale: 0.5, speedScale: 0.22, spawnScale: 1,
      depthScale: 2.6, size: [0.24, 0.42, 0.18], spinScale: 0, death: 'erode', turbulenceScale: 0.08,
      lifecycle: 'healing-burst-restoration-release',
      referenceSource: 'healing-loop-renewal-helix',
      referenceAdaptation: 'repo-helix-timing-reduced-to-a-single-mint-particle-halo',
      referenceLicense: 'repo-original',
    },
  },
  {
    kind: 'particles', role: 'impact', opacity: 0.7, scale: 0.72, phase: 'healing-burst-reference-warm-seed-sparks',
    tuning: {
      motion: 'column-rise', sprite: 'sparkle', blend: 'additive', colorOverride: '#fff0b0', ramp: 'pinned-hot',
      delay: 0.28, window: 0.2, lifeScale: 0.58, countScale: 0.35, speedScale: 1.25, gravity: 0.05,
      drag: 1.4, depthScale: 2.2, size: [0.12, 0.22, 0.08], spinScale: 0, death: 'erode', ease: 'snap',
      turbulenceScale: 0.04, positionOffset: [0, -0.12, 0], lifecycle: 'healing-burst-restoration-release',
      referenceSource: 'repo-original-restoration-seed-sparks',
      referenceAdaptation: 'small-CC0-sparkle-motes-used-as-warm-healing-seeds',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 1.08)
