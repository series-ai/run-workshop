import { authoredRecipe } from '../constants/01'

export default authoredRecipe('slime-trail', 'Slime trail', 'Sticky slime trail with bubble motes and pooled wake.', [
  { kind: 'particles', role: 'trail', opacity: 0.95, scale: 0.68, phase: 'slime-trail-wake-stream', tuning: { motion: 'trail-stream', sprite: 'splat', size: [0.55, 0.7, 0.4], colorOverride: '#00d926', ramp: 'pigment', countScale: 0.7, lifeScale: 0.7, speedScale: 6, speedJitter: 0.65, streamSpread: 0.12, turbulenceScale: 0, gravity: -1, spinScale: 0.85 } },
  { kind: 'particles', role: 'aura', opacity: 0.6, scale: 0.45, phase: 'slime-trail-stragglers', tuning: { sprite: 'glow', colorOverride: '#baffc8', ramp: 'held', delay: 0.3, window: 0.55, lifeScale: 0.7, countScale: 0.12, speedScale: 0.4, spawnOffset: [-0.6, 0, 0], spawnScale: 0.2, turbulenceScale: 0.3, gravity: 0.2 } },
], 2, 1.0)
