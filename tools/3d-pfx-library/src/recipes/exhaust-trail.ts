import { authoredRecipe } from '../constants/01'

export default authoredRecipe('exhaust-trail', 'Exhaust trail', 'Soft exhaust smoke trail with soot points and heat wake.', [
  { kind: 'particles', role: 'trail', opacity: 0.95, scale: 0.68, phase: 'exhaust-trail-wake-stream', tuning: { motion: 'trail-stream', sprite: 'smoke', size: [0.6, 0.8, 0.5], colorOverride: '#6a7888', ramp: 'dark', countScale: 0.35, lifeScale: 0.7, speedScale: 6, speedJitter: 0.4, streamSpread: 0.12, turbulenceScale: 0, gravity: 0.5, spinScale: 0, blend: 'alpha' } },
  { kind: 'tapered-trail', role: 'trail', opacity: 0.7, scale: 0.75, phase: 'exhaust-trail-taper-body', tuning: { meshShader: 'trail-flow', colorOverride: '#6a7888' } },
  { kind: 'particles', role: 'aura', opacity: 0.6, scale: 0.45, phase: 'exhaust-trail-stragglers', tuning: { sprite: 'glow', colorOverride: '#a8a8a8', ramp: 'held', delay: 0.3, window: 0.55, lifeScale: 0.7, countScale: 0.12, speedScale: 0.4, spawnOffset: [-0.6, 0, 0], spawnScale: 0.2, turbulenceScale: 0.3, gravity: 0.2 } },
], 2, 1.2)
