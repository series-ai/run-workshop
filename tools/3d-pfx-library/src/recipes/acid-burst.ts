import { authoredRecipe } from '../constants/01'

export default authoredRecipe('acid-burst', 'Acid burst', 'Particle-first corrosive eruption: a grounded wet scuff, a low caustic vapor, and a narrow rising droplet column establish liquid behavior without a faceted rock crown.', [
  {
    kind: 'particles', role: 'impact', opacity: 0.92, scale: 1.04, phase: 'acid-burst-particle-grounded-wet-scuff',
    tuning: {
      motion: 'ground-scuff', sprite: 'splat', blend: 'alpha', colorOverride: '#557c26', ramp: 'pigment',
      lifecycle: 'acid-burst-particle-eruption', delay: 0, window: 0.26, lifeScale: 0.72,
      countScale: 0.54, speedScale: 1.55, speedJitter: 0.42, drag: 1.1, gravity: -1.7,
      spawnScale: 0.34, spawnLift: 0.02, depthScale: 2.8, size: [0.24, 0.56, 0.36],
      spinScale: 0.56, death: 'erode', ease: 'snap', turbulenceScale: 0.08, positionOffset: [0, -0.32, 0],
      referenceSource: 'acid-burst-sculpted-splash-crown-and-CC0-splat-sprite-language',
      referenceAdaptation: 'the wet crown becomes a low pigment scuff with a broad irregular footprint and fast collapse',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'volume', opacity: 0.68, scale: 1.18, phase: 'acid-burst-particle-caustic-vapor',
    tuning: {
      motion: 'drift-cloud', sprite: 'smoke-variants', blend: 'alpha', colorOverride: '#779b32', ramp: 'pigment',
      lifecycle: 'acid-burst-particle-eruption', delay: 0.07, window: 0.42, lifeScale: 0.98,
      countScale: 0.48, speedScale: 0.24, speedJitter: 0.42, drag: 1.45, gravity: 0.04,
      spawnScale: 0.84, depthScale: 3.1, size: [0.28, 0.66, 0.5], spinScale: 0.24,
      death: 'erode', turbulenceScale: 0.2, positionOffset: [0, -0.18, 0],
      referenceSource: 'acid-burst-corrosive-vapor-and-CC0-smoke-variants',
      referenceAdaptation: 'the low acid pool becomes a translucent, darkened vapor bed with slow billow rather than a neon solid blob',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'trail', opacity: 0.84, scale: 0.84, phase: 'acid-burst-particle-droplet-column',
    tuning: {
      motion: 'column-rise', sprite: 'bubble', blend: 'alpha', colorOverride: '#d3ed5a', ramp: 'held',
      lifecycle: 'acid-burst-particle-eruption', delay: 0.18, window: 0.34, lifeScale: 0.8,
      countScale: 0.32, speedScale: 1.08, speedJitter: 0.48, drag: 0.94, gravity: -0.08,
      spawnScale: 0.44, depthScale: 2.7, size: [0.08, 0.28, 0.12], spinScale: 0,
      death: 'erode', turbulenceScale: 0.18, positionOffset: [0, -0.12, 0],
      referenceSource: 'acid-burst-ballistic-droplet-volume-and-CC0-bubble-sprite-language',
      referenceAdaptation: 'hot droplets become a restrained rising caustic bubble column with uneven speed and depth',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 1.12)
