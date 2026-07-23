import { authoredRecipe } from '../constants/01'

export default authoredRecipe('exhaust-idle', 'Exhaust idle', 'Exhaust idle with soot breath and heat shimmer.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'exhaust-idle-element-traffic', tuning: { sprite: 'smoke', size: [0.6, 0.8, 0.5], colorOverride: '#6a7888', ramp: 'held', countScale: 0.3, speedScale: 0.6, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'column-rise', gravity: 0.3, blend: 'alpha', spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'exhaust-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#6a7888' } },
], 2, 0.81)
