import { authoredRecipe } from '../constants/01'

// STANDARD-tier impact exemplar (Notion: Impact VFX Spec). Keep the hit
// confirm readable through a compact white-hot contact, an uneven seeded
// gold fan, and a short ember resolution beat. The fan deliberately uses
// independent azimuths: impact particles should not form a perfect radial
// star every time the same hit lands.
export default authoredRecipe('hit-spark', 'Contact spark burst', 'Particle-first hit confirm: compact contact pop, irregular gold fan, and ember resolution.', [
  {
    kind: 'particles', role: 'impact', opacity: 0.98, scale: 0.86, phase: 'hit-spark-particle-contact-pop',
    tuning: {
      motion: 'impact-burst', sprite: 'glow', blend: 'additive', colorOverride: '#fff4cc', ramp: 'pinned-hot',
      lifecycle: 'hit-spark-particle-confirm', delay: 0, window: 0.12, lifeScale: 0.36,
      countScale: 0.32, speedScale: 2.8, speedJitter: 0.38, drag: 2.4, gravity: 0,
      spawnScale: 0.06, depthScale: 2.8, size: [0.18, 0.42, 0.14], spinScale: 0,
      stretch: 0.18, death: 'erode', ease: 'snap', turbulenceScale: 0.02, positionOffset: [0, 0, 0],
      referenceSource: 'hit-spark-faceted-star-and-CC0-glow-sprite-language',
      referenceAdaptation: 'the closed spike core becomes a brief hot contact pop that anchors the irregular fan',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'impact', opacity: 0.96, scale: 1.12, phase: 'hit-spark-particle-random-fan',
    tuning: {
      motion: 'radial-burst', sprite: 'streak', blend: 'additive', colorOverride: '#ffd45e', ramp: 'pinned-hot',
      lifecycle: 'hit-spark-particle-confirm', delay: 0.06, window: 0.28, lifeScale: 0.62,
      countScale: 0.86, speedScale: 3.8, speedJitter: 0.58, drag: 0.82, gravity: 0,
      spawnScale: 0.12, depthScale: 3.2, size: [0.12, 0.38, 0.08], spinScale: 0.7,
      stretch: 0.42, randomizeAzimuth: true, death: 'erode', ease: 'snap', turbulenceScale: 0.04,
      impactVector: [1, 0.18, 0.22], spreadAngle: 0.7, positionOffset: [0, 0.02, 0],
      referenceSource: 'hit-spark-spike-fan-and-CC0-streak-sprite-language',
      referenceAdaptation: 'the rigid star becomes uneven seeded streaks with real depth and a forward-biased attack vector',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'trail', opacity: 0.78, scale: 0.92, phase: 'hit-spark-particle-ember-resolve',
    tuning: {
      motion: 'radial-burst', sprite: 'ember', blend: 'alpha', colorOverride: '#ff9a2f', ramp: 'pigment',
      lifecycle: 'hit-spark-particle-confirm', delay: 0.14, window: 0.34, lifeScale: 0.82,
      countScale: 0.34, speedScale: 1.25, speedJitter: 0.64, drag: 2.2, gravity: -1.4,
      spawnScale: 0.14, depthScale: 3, size: [0.1, 0.22, 0.06], spinScale: 0.8,
      stretch: 0.18, randomizeAzimuth: true, death: 'erode', ease: 'snap', turbulenceScale: 0.04,
      impactVector: [1, 0.15, 0.28], spreadAngle: 0.82,
      referenceSource: 'hit-spark-ember-resolution-and-CC0-ember-sprite-language',
      referenceAdaptation: 'the old fixed ember pips become a sparse uneven resolution layer after the contact fan clears',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 1.7)
