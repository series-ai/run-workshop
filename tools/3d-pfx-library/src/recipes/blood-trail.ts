import { authoredRecipe } from '../constants/01'

export default authoredRecipe('blood-trail', 'Blood trail', 'Controlled danger trail with droplets and a fading ground mark.', [
  { kind: 'particles', role: 'trail', opacity: 0.95, scale: 0.68, phase: 'blood-trail-wake-stream', tuning: { motion: 'trail-stream', sprite: 'splat', size: [0.55, 0.7, 0.4], colorOverride: '#a80d18', ramp: 'pigment', countScale: 0.7, lifeScale: 0.7, speedScale: 6, speedJitter: 0.65, streamSpread: 0.12, turbulenceScale: 0, gravity: -1.8, spinScale: 0.85, blend: 'alpha' } },
  { kind: 'particles', role: 'aura', opacity: 0.6, scale: 0.45, phase: 'blood-trail-stragglers', tuning: { sprite: 'glow', colorOverride: '#e02535', ramp: 'held', delay: 0.3, window: 0.55, lifeScale: 0.7, countScale: 0.12, speedScale: 0.4, spawnOffset: [-0.6, 0, 0], spawnScale: 0.2, turbulenceScale: 0.3, gravity: 0.2 } },
], 2, 1.2)
