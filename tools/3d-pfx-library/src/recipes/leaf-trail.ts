import { authoredRecipe } from '../constants/01'

export default authoredRecipe('leaf-trail', 'Leaf trail', 'Cozy leaf trail for forest motion and environmental ambience.', [
  { kind: 'particles', role: 'trail', opacity: 0.95, scale: 0.68, phase: 'leaf-trail-wake-stream', tuning: { motion: 'trail-stream', sprite: 'debris', size: [0.45, 0.55, 0.3], colorOverride: '#3fb800', ramp: 'held', countScale: 0.7, lifeScale: 0.7, speedScale: 6, speedJitter: 0.4, streamSpread: 0.12, turbulenceScale: 0.5, gravity: -0.6, spinScale: 1.3, blend: 'alpha' } },
  { kind: 'particles', role: 'aura', opacity: 0.6, scale: 0.45, phase: 'leaf-trail-stragglers', tuning: { sprite: 'glow', colorOverride: '#baffc8', ramp: 'held', delay: 0.3, window: 0.55, lifeScale: 0.7, countScale: 0.12, speedScale: 0.4, spawnOffset: [-0.6, 0, 0], spawnScale: 0.2, turbulenceScale: 0.3, gravity: 0.2 } },
], 2, 1.0)
