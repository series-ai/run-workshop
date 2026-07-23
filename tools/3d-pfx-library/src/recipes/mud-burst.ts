import { authoredRecipe } from '../constants/01'

export default authoredRecipe('mud-burst', 'Mud burst', 'Particle-first wet-mud eruption adapted from the repo blood splash timing and Kenney CC0 smoke: low umber contact splats, wet bank volume, and settling silt flecks.', [
  {
    kind: 'particles', role: 'impact', opacity: 0.72, scale: 0.86, phase: 'mud-burst-reference-particle-splash',
    tuning: {
      motion: 'impact-burst', sprite: 'splat', blend: 'alpha', colorOverride: '#5b3a2d', ramp: 'pigment',
      window: 0.08, lifeScale: 0.62, countScale: 0.5, speedScale: 1.1, speedJitter: 0.25,
      drag: 1.7, gravity: -1.9, spawnScale: 0.16, depthScale: 2.4, size: [0.22, 0.36, 0.15],
      spinScale: 0.5, death: 'erode', ease: 'snap', turbulenceScale: 0.08, positionOffset: [0, -0.52, 0],
      lifecycle: 'mud-burst-grounded-eruption',
      referenceSource: 'blood-burst-particle-splash',
      referenceAdaptation: 'procedural-splat-particles-recolored-as-wet-umber-contact-mud',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'volume', opacity: 0.82, scale: 1, phase: 'mud-burst-reference-wet-bank',
    tuning: {
      motion: 'drift-cloud', sprite: 'smoke-variants', blend: 'alpha', colorOverride: '#4f3428', ramp: 'pigment',
      delay: 0.055, window: 0.28, lifeScale: 0.92, countScale: 1.35, speedScale: 0.36, speedJitter: 0.32,
      drag: 1.7, gravity: -0.2, spawnScale: 1.15, depthScale: 2.8, size: [0.56, 0.94, 0.76],
      spinScale: 0.24, death: 'erode', turbulenceScale: 0.2, positionOffset: [0, -0.58, 0],
      lifecycle: 'mud-burst-grounded-eruption',
      referenceSource: 'kenney-particle-pack-smoke-variants',
      referenceAdaptation: 'CC0-smoke-cells-tinted-as-wet-mud-bank',
      referenceLicense: 'CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'impact', opacity: 0.56, scale: 0.7, phase: 'mud-burst-reference-silt-residue',
    tuning: {
      motion: 'ground-scuff', sprite: 'debris', blend: 'alpha', colorOverride: '#3e2a24', ramp: 'dark',
      delay: 0.26, window: 0.18, lifeScale: 0.72, countScale: 0.35, speedScale: 1.3, speedJitter: 0.3,
      drag: 1.8, gravity: -0.75, spawnScale: 0.5, depthScale: 2.4, size: [0.14, 0.26, 0.1],
      spinScale: 0.4, stretch: 0, death: 'erode', turbulenceScale: 0.1, positionOffset: [0, -0.72, 0],
      lifecycle: 'mud-burst-grounded-eruption',
      referenceSource: 'blood-burst-particle-droplet-specks',
      referenceAdaptation: 'small-repo-particle-residue-recolored-as-silt',
      referenceLicense: 'repo-original',
    },
  },
], 2, 1.05)
