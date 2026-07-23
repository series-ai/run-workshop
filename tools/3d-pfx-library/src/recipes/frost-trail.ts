import { authoredRecipe } from '../constants/01'

export default authoredRecipe('frost-trail', 'Frost trail', 'Soft frost trail for chilled movement and environmental wake.', [
  { kind: 'particles', role: 'trail', opacity: 0.95, scale: 0.68, phase: 'frost-trail-wake-stream', tuning: { motion: 'trail-stream', sprite: 'sparkle', size: [0.35, 0.5, 0.3], colorOverride: '#00aaff', ramp: 'held', countScale: 0.7, lifeScale: 0.7, speedScale: 6, speedJitter: 0.4, streamSpread: 0.12, turbulenceScale: 0, gravity: 0, spinScale: 0, blend: 'alpha' } },
  { kind: 'particles', role: 'aura', opacity: 0.6, scale: 0.45, phase: 'frost-trail-stragglers', tuning: { sprite: 'glow', colorOverride: '#eaf8ff', ramp: 'held', delay: 0.3, window: 0.55, lifeScale: 0.7, countScale: 0.12, speedScale: 0.4, spawnOffset: [-0.6, 0, 0], spawnScale: 0.2, turbulenceScale: 0.3, gravity: 0.2 } },
], 2, 1.2)
