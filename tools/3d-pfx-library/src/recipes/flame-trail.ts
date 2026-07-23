import { authoredRecipe } from '../constants/01'

export default authoredRecipe('flame-trail', 'Flame trail', 'Hot flame trail with directional ribbon and ember breakup.', [
  { kind: 'particles', role: 'trail', opacity: 0.95, scale: 0.68, phase: 'flame-trail-wake-stream', tuning: { motion: 'trail-stream', sprite: 'lick', size: [1.0, 0.8, 0.2], colorOverride: '#ff3d00', ramp: 'held', countScale: 0.35, lifeScale: 0.7, speedScale: 6, speedJitter: 0.4, streamSpread: 0.12, turbulenceScale: 0, gravity: 0, spinScale: 0, flicker: 1.6 } },
  { kind: 'tapered-trail', role: 'trail', opacity: 0.7, scale: 0.75, phase: 'flame-trail-taper-body', tuning: { meshShader: 'trail-flow', colorOverride: '#ff3d00' } },
  { kind: 'particles', role: 'aura', opacity: 0.6, scale: 0.45, phase: 'flame-trail-stragglers', tuning: { sprite: 'glow', colorOverride: '#ffd166', ramp: 'held', delay: 0.3, window: 0.55, lifeScale: 0.7, countScale: 0.12, speedScale: 0.4, spawnOffset: [-0.6, 0, 0], spawnScale: 0.2, turbulenceScale: 0.3, gravity: 0.2 } },
], 2, 1.4)
