import { authoredRecipe } from '../constants/01'

export default authoredRecipe('warning-trail', 'Warning trail', 'Urgent warning trail with alert streak and tick particles.', [
  { kind: 'particles', role: 'trail', opacity: 0.9, scale: 0.6, phase: 'warning-trail-mote-wake', tuning: { motion: 'trail-stream', sprite: 'glow', size: [0.45, 0.6, 0.35], colorOverride: '#ff5500', ramp: 'held', countScale: 0.35, lifeScale: 0.7, speedScale: 5, speedJitter: 0.15, streamSpread: 0.1, spinScale: 0, turbulenceScale: 0, gravity: 0, flicker: 1.2 } },
  { kind: 'tapered-trail', role: 'trail', opacity: 0.6, scale: 0.7, phase: 'warning-trail-taper-body', tuning: { meshShader: 'trail-flow', colorOverride: '#ff5500' } },
  { kind: 'particles', role: 'aura', opacity: 0.65, scale: 0.42, phase: 'warning-trail-stragglers', tuning: { sprite: 'glow', colorOverride: '#ffc89a', ramp: 'held', delay: 0.3, window: 0.55, lifeScale: 0.7, countScale: 0.1, speedScale: 0.35, spawnOffset: [-0.6, 0, 0], spawnScale: 0.2, turbulenceScale: 0.25, gravity: 0.15 } },
], 2, 1.2)
