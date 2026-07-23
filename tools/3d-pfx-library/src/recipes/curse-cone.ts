import { authoredRecipe } from '../constants/01'

export default authoredRecipe('curse-cone', 'Curse cone', 'Particle-first directional curse: a thorn fan propagates through depth, a dark rupture punctuates the source, and rune motes climb the cone edge before dissolving.', [
  {
    kind: 'particles', role: 'trail', opacity: 0.92, scale: 1.08, phase: 'curse-cone-particle-thorn-fan',
    tuning: {
      motion: 'radial-burst', sprite: 'streak', blend: 'alpha', colorOverride: '#9d54dc', ramp: 'pigment',
      lifecycle: 'curse-cone-particle-propagation', delay: 0.01, window: 0.3, lifeScale: 0.7,
      countScale: 0.72, speedScale: 3.2, speedJitter: 0.42, drag: 0.9, gravity: 0,
      spawnScale: 0.12, depthScale: 2.8, size: [0.1, 0.42, 0.07], stretch: 1.25,
      spinScale: 0.4, death: 'erode', ease: 'snap', turbulenceScale: 0.04,
      impactVector: [1, 0.06, 0.08], spreadAngle: 0.34,
      referenceSource: 'curse-cone-twisted-thorn-fan-and-CC0-magic-sprite-language',
      referenceAdaptation: 'directional-thorn-mesh-translated-to-a-sparse-positive-X-streak-fan-with-real-depth',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'impact', opacity: 0.84, scale: 0.84, phase: 'curse-cone-particle-void-rupture',
    tuning: {
      motion: 'impact-burst', sprite: 'twirl', blend: 'additive', colorOverride: '#441563', ramp: 'dark',
      lifecycle: 'curse-cone-particle-propagation', delay: 0, window: 0.16, lifeScale: 0.48,
      countScale: 0.42, speedScale: 2.1, speedJitter: 0.36, drag: 2.1, gravity: -0.5,
      spawnScale: 0.08, depthScale: 2.5, size: [0.16, 0.3, 0.1], stretch: 0.45,
      spinScale: 1.1, death: 'erode', ease: 'snap', turbulenceScale: 0.02,
      referenceSource: 'curse-cone-void-knot-and-CC0-magic-sprite-language',
      referenceAdaptation: 'the source knot becomes a compact dark particle rupture that hands off into the fan',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'aura', opacity: 0.76, scale: 0.88, phase: 'curse-cone-particle-rune-rise',
    tuning: {
      motion: 'column-rise', sprite: 'rune', blend: 'additive', colorOverride: '#d5a8ff', ramp: 'held',
      lifecycle: 'curse-cone-particle-propagation', delay: 0.14, window: 0.34, lifeScale: 0.86,
      countScale: 0.34, speedScale: 0.68, speedJitter: 0.4, drag: 1.2, gravity: 0.02,
      spawnScale: 0.7, spawnLift: -0.08, depthScale: 2.9, size: [0.16, 0.34, 0.1],
      spinScale: 0.22, death: 'erode', turbulenceScale: 0.16, positionOffset: [0.18, 0.04, 0],
      referenceSource: 'repo-original-curse-rune-rise-and-CC0-magic-sprite-language',
      referenceAdaptation: 'endpoint barbs become a restrained upward rune witness layer instead of a second thorn mesh',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 0.95)
