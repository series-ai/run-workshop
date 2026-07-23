import { authoredRecipe } from '../constants/01'

export default authoredRecipe('shadow-trail', 'Shadow trail', 'Umbra trail with dark haze and low-contrast particles.', [
  { kind: 'particles', role: 'trail', opacity: 0.95, scale: 0.68, phase: 'shadow-trail-wake-stream', tuning: { motion: 'trail-stream', sprite: 'twirl', size: [0.5, 0.6, 0.35], colorOverride: '#6a26e8', ramp: 'dark', countScale: 0.7, lifeScale: 0.7, speedScale: 6, speedJitter: 0.4, streamSpread: 0.12, turbulenceScale: 0, gravity: 0, spinScale: 0.7, blend: 'alpha' } },
  { kind: 'particles', role: 'aura', opacity: 0.6, scale: 0.45, phase: 'shadow-trail-stragglers', tuning: { sprite: 'glow', colorOverride: '#9b7bd6', ramp: 'held', delay: 0.3, window: 0.55, lifeScale: 0.7, countScale: 0.12, speedScale: 0.4, spawnOffset: [-0.6, 0, 0], spawnScale: 0.2, turbulenceScale: 0.3, gravity: 0.2 } },
], 2, 0.95)
