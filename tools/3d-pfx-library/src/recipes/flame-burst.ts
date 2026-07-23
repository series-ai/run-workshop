import { authoredRecipe } from '../constants/01'

export default authoredRecipe('flame-burst', 'Flame burst', 'Particle-first flame blossom: a short upward lick, hot radial cinders, and a dark smoke peel create a readable fire burst without a folded mesh tongue bundle.', [
  {
    kind: 'particles', role: 'impact', opacity: 0.96, scale: 0.94, phase: 'flame-burst-particle-upward-licks',
    tuning: {
      motion: 'cone-fountain', sprite: 'flame', blend: 'additive', colorOverride: '#ff7a18', ramp: 'hot',
      lifecycle: 'flame-burst-particle-ignite', delay: 0, window: 0.28, lifeScale: 0.7,
      countScale: 0.64, speedScale: 2.25, speedJitter: 0.44, drag: 1.15, gravity: -1.4,
      spawnScale: 0.16, depthScale: 2.8, size: [0.16, 0.46, 0.12], spinScale: 0.55,
      stretch: 0.32, flicker: 1.3, death: 'erode', ease: 'snap', turbulenceScale: 0.1, positionOffset: [0, 0.04, 0],
      referenceSource: 'flame-burst-folded-tongues-and-CC0-flame-sprite-language',
      referenceAdaptation: 'the blossom tongues become a staggered upward fountain of unequal flame cells with real depth',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'impact', opacity: 0.86, scale: 0.96, phase: 'flame-burst-particle-hot-cinders',
    tuning: {
      motion: 'radial-burst', sprite: 'ember', blend: 'additive', colorOverride: '#ffbd3d', ramp: 'pinned-hot',
      lifecycle: 'flame-burst-particle-ignite', delay: 0.08, window: 0.3, lifeScale: 0.68,
      countScale: 0.46, speedScale: 3.5, speedJitter: 0.52, drag: 0.88, gravity: -2.8,
      spawnScale: 0.12, depthScale: 3, size: [0.1, 0.28, 0.08], spinScale: 0.8,
      stretch: 0.22, flicker: 1.6, death: 'erode', ease: 'snap', turbulenceScale: 0.08, positionOffset: [0, 0.02, 0],
      referenceSource: 'flame-burst-char-front-and-CC0-ember-sprite-language',
      referenceAdaptation: 'peeling char becomes a sparse, uneven cinder fan that resolves the flame rather than adding another rigid surface',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'volume', opacity: 0.54, scale: 1.08, phase: 'flame-burst-particle-char-smoke',
    tuning: {
      motion: 'drift-cloud', sprite: 'smoke-variants', blend: 'alpha', colorOverride: '#733b2a', ramp: 'dark',
      lifecycle: 'flame-burst-particle-ignite', delay: 0.2, window: 0.42, lifeScale: 1.04,
      countScale: 0.38, speedScale: 0.24, speedJitter: 0.42, drag: 1.4, gravity: 0.05,
      spawnScale: 0.66, spawnLift: 0.04, depthScale: 3.2, size: [0.3, 0.72, 0.54],
      spinScale: 0.3, death: 'erode', turbulenceScale: 0.22, positionOffset: [0, 0.08, 0],
      referenceSource: 'repo-original-flame-char-residue-and-CC0-smoke-variants',
      referenceAdaptation: 'the char front becomes a delayed low smoke peel, preserving a cooling tail after the bright lick disappears',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 1.2)
