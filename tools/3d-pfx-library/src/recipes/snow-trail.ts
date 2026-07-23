import { authoredRecipe } from '../constants/01'

export default authoredRecipe('snow-trail', 'Snow trail', 'Soft snow trail with falling flakes and a faint wind wake.', [
  { kind: 'particles', role: 'trail', opacity: 0.95, scale: 0.68, phase: 'snow-trail-wake-stream', tuning: { motion: 'trail-stream', sprite: 'sparkle', size: [0.35, 0.5, 0.3], colorOverride: '#5ab8ff', ramp: 'held', countScale: 0.7, lifeScale: 0.7, speedScale: 6, speedJitter: 0.4, streamSpread: 0.12, turbulenceScale: 0, gravity: -0.5, spinScale: 0, blend: 'alpha' } },
  { kind: 'particles', role: 'aura', opacity: 0.6, scale: 0.45, phase: 'snow-trail-stragglers', tuning: { sprite: 'glow', colorOverride: '#ffffff', ramp: 'held', delay: 0.3, window: 0.55, lifeScale: 0.7, countScale: 0.12, speedScale: 0.4, spawnOffset: [-0.6, 0, 0], spawnScale: 0.2, turbulenceScale: 0.3, gravity: 0.2 } },
], 2, 1.0)
