import { authoredRecipe } from '../constants/01'

export default authoredRecipe('shadow-burst', 'Shadow burst', 'Particle-first shadow detonation adapted from the repo void-gather timing and Kenney CC0 slash/smoke cells: a five-finger slate claw fan, umbra residue, and a restrained rim.', [
  {
    kind: 'particles', role: 'impact', opacity: 1, scale: 0.94, phase: 'shadow-burst-reference-claw-fan',
    tuning: {
      motion: 'shadow-claw', sprite: 'streak', blend: 'alpha', colorOverride: '#344b58', ramp: 'dark',
      delay: 0.01, window: 0.16, lifeScale: 0.58, countScale: 0.82, speedScale: 1.6, speedJitter: 0.2,
      drag: 1.8, gravity: -0.4, spawnScale: 1, depthScale: 2.5, size: [0.28, 0.66, 0.2],
      stretch: 0.4, spinScale: 0.35, death: 'erode', ease: 'snap', turbulenceScale: 0.03,
      positionOffset: [0, -0.18, 0], lifecycle: 'shadow-burst-detonation',
      referenceSource: 'shadow-charge-void-gather-and-kenney-slash',
      referenceAdaptation: 'five-finger-spectral-fan-rebuilt-as-unequal-depth-particle-lanes',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'volume', opacity: 0.68, scale: 1, phase: 'shadow-burst-reference-umbra-residue',
    tuning: {
      motion: 'drift-cloud', sprite: 'smoke-variants', blend: 'alpha', colorOverride: '#263945', ramp: 'dark',
      delay: 0.1, window: 0.4, lifeScale: 0.95, countScale: 0.62, speedScale: 0.24, drag: 1.5,
      gravity: 0.05, spawnScale: 1.2, depthScale: 3, size: [0.46, 0.92, 0.72], spinScale: 0.3,
      death: 'erode', turbulenceScale: 0.18, positionOffset: [0, -0.52, 0], lifecycle: 'shadow-burst-detonation',
      referenceSource: 'kenney-particle-pack-smoke-variants',
      referenceAdaptation: 'CC0-smoke-cells-tinted-as-a-grounded-umbra-residue',
      referenceLicense: 'CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'aura', opacity: 0.58, scale: 0.68, phase: 'shadow-burst-reference-slate-rim',
    tuning: {
      motion: 'impact-burst', sprite: 'spark', blend: 'alpha', colorOverride: '#9bb5c4', ramp: 'held',
      delay: 0.03, window: 0.12, lifeScale: 0.45, countScale: 0.18, speedScale: 2.2, drag: 2.2,
      gravity: -0.3, spawnScale: 0.08, depthScale: 2.8, size: [0.14, 0.26, 0.1], spinScale: 0,
      stretch: 0.9, death: 'erode', turbulenceScale: 0.02, positionOffset: [0, -0.12, 0],
      lifecycle: 'shadow-burst-detonation', referenceSource: 'repo-original-slate-rim-flecks',
      referenceAdaptation: 'small-repo-spark-particles-used-as-a-readable-charcoal-edge-rim',
      referenceLicense: 'repo-original',
    },
  },
], 2, 0.82)
