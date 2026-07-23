import { authoredRecipe } from '../constants/01'

export default authoredRecipe('bubble-trail', 'Bubble trail', 'Light bubble stream for underwater motion and vents.', [
  { kind: 'particles', role: 'trail', opacity: 0.95, scale: 0.68, phase: 'bubble-trail-wake-stream', tuning: { motion: 'trail-stream', sprite: 'soft', size: [0.55, 0.7, 0.45], colorOverride: '#00a8f0', ramp: 'held', countScale: 0.35, lifeScale: 0.7, speedScale: 6, speedJitter: 0.4, streamSpread: 0.12, turbulenceScale: 0, gravity: 0.8, spinScale: 0 } },
  { kind: 'tapered-trail', role: 'trail', opacity: 0.7, scale: 0.75, phase: 'bubble-trail-taper-body', tuning: { meshShader: 'trail-flow', colorOverride: '#00a8f0' } },
  { kind: 'particles', role: 'aura', opacity: 0.6, scale: 0.45, phase: 'bubble-trail-stragglers', tuning: { sprite: 'glow', colorOverride: '#c8ecff', ramp: 'held', delay: 0.3, window: 0.55, lifeScale: 0.7, countScale: 0.12, speedScale: 0.4, spawnOffset: [-0.6, 0, 0], spawnScale: 0.2, turbulenceScale: 0.3, gravity: 0.2 } },
], 2, 1.1)
