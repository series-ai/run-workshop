import { authoredRecipe } from '../constants/01'

export default authoredRecipe('dust-trail', 'Dust trail', 'Grounded dust trail for movement and dry impacts.', [
  { kind: 'particles', role: 'trail', opacity: 0.95, scale: 0.68, phase: 'dust-trail-wake-stream', tuning: { motion: 'trail-stream', sprite: 'puff', size: [0.6, 0.8, 0.5], colorOverride: '#b0761f', ramp: 'held', countScale: 0.7, lifeScale: 0.7, speedScale: 6, speedJitter: 0.4, streamSpread: 0.12, turbulenceScale: 0, gravity: 0, spinScale: 0, blend: 'alpha' } },
  { kind: 'particles', role: 'aura', opacity: 0.6, scale: 0.45, phase: 'dust-trail-stragglers', tuning: { sprite: 'glow', colorOverride: '#d9a94f', ramp: 'held', delay: 0.3, window: 0.55, lifeScale: 0.7, countScale: 0.12, speedScale: 0.4, spawnOffset: [-0.6, 0, 0], spawnScale: 0.2, turbulenceScale: 0.3, gravity: 0.2 } },
], 2, 1.1)
