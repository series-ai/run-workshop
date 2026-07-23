import { authoredRecipe } from '../constants/01'

export default authoredRecipe('pickup-burst', 'Pickup burst', 'Particle-first reward receipt: a bright collect pop, a short upward payout, and a thin receipt orbit resolve the handoff without a giant token mesh.', [
  {
    kind: 'particles', role: 'impact', opacity: 0.98, scale: 0.82, phase: 'pickup-burst-particle-collect-pop',
    tuning: {
      motion: 'impact-burst', sprite: 'sparkle', blend: 'additive', colorOverride: '#fff0a8', ramp: 'pinned-hot',
      lifecycle: 'pickup-burst-particle-receipt', delay: 0, window: 0.13, lifeScale: 0.42,
      countScale: 0.5, speedScale: 3.5, speedJitter: 0.46, drag: 2.3, gravity: -0.2,
      spawnScale: 0.08, depthScale: 2.6, size: [0.18, 0.4, 0.14], spinScale: 0.8,
      stretch: 0.35, death: 'erode', ease: 'snap', turbulenceScale: 0.02,
      referenceSource: 'coin-pickup-reward-burst-and-CC0-star-sprite-language',
      referenceAdaptation: 'the old token silhouette becomes a compact collect-pop made of uneven receipt sparks',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'body', opacity: 0.9, scale: 0.9, phase: 'pickup-burst-particle-payout-rise',
    tuning: {
      motion: 'column-rise', sprite: 'sparkle', blend: 'additive', colorOverride: '#ffd14a', ramp: 'pigment',
      lifecycle: 'pickup-burst-particle-receipt', delay: 0.08, window: 0.38, lifeScale: 0.8,
      countScale: 0.62, speedScale: 1.18, speedJitter: 0.42, drag: 1.15, gravity: 0.12,
      spawnScale: 0.58, spawnLift: -0.06, depthScale: 2.8, size: [0.12, 0.32, 0.16],
      spinScale: 0.14, death: 'erode', turbulenceScale: 0.12, positionOffset: [0, 0.02, 0],
      referenceSource: 'repo-original-reward-payout-rise-and-CC0-star-sprite-language',
      referenceAdaptation: 'rising gems become a staggered vertical payout stream with depth-separated sparkle motes',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'aura', opacity: 0.72, scale: 0.84, phase: 'pickup-burst-particle-receipt-orbit',
    tuning: {
      motion: 'orbit-ring', sprite: 'glow', blend: 'alpha', colorOverride: '#f5a91b', ramp: 'held',
      lifecycle: 'pickup-burst-particle-receipt', delay: 0.15, window: 0.42, lifeScale: 0.92,
      countScale: 0.34, speedScale: 0.5, speedJitter: 0.28, drag: 1.3, gravity: 0,
      spawnScale: 0.72, depthScale: 2.5, size: [0.1, 0.24, 0.08], spinScale: 0,
      death: 'erode', turbulenceScale: 0.08, positionOffset: [0, 0.06, 0],
      referenceSource: 'repo-original-reward-receipt-orbit-and-CC0-spark-sprite-language',
      referenceAdaptation: 'a small depth-bearing orbit confirms collection without a screen-facing badge or token slab',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 1.3)
