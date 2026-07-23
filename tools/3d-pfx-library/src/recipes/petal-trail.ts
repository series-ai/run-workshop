import { authoredRecipe } from '../constants/01'

export default authoredRecipe('petal-trail', 'Petal trail', 'Gentle petal trail for cozy reward and garden effects.', [
  { kind: 'particles', role: 'trail', opacity: 0.95, scale: 0.68, phase: 'petal-trail-wake-stream', tuning: { motion: 'trail-stream', sprite: 'debris', size: [0.45, 0.55, 0.3], colorOverride: '#ff3d8a', ramp: 'held', countScale: 0.7, lifeScale: 0.7, speedScale: 6, speedJitter: 0.4, streamSpread: 0.12, turbulenceScale: 0.5, gravity: -0.4, spinScale: 1.2, blend: 'alpha' } },
  { kind: 'particles', role: 'aura', opacity: 0.6, scale: 0.45, phase: 'petal-trail-stragglers', tuning: { sprite: 'glow', colorOverride: '#ffd8e8', ramp: 'held', delay: 0.3, window: 0.55, lifeScale: 0.7, countScale: 0.12, speedScale: 0.4, spawnOffset: [-0.6, 0, 0], spawnScale: 0.2, turbulenceScale: 0.3, gravity: 0.2 } },
], 2, 0.95)
