import { authoredRecipe } from '../constants/01'

export default authoredRecipe('embers-idle', 'Embers idle', 'Looping ember bed with small cinders and heat shimmer.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'embers-idle-element-traffic', tuning: { sprite: 'glow', size: [0.45, 0.6, 0.35], colorOverride: '#ff6a00', ramp: 'held', countScale: 0.3, speedScale: 0.6, speedJitter: 0.5, turbulenceScale: 0.25, motion: 'column-rise', gravity: 0.3, spinScale: 0, flicker: 1.6 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'embers-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#ff6a00', flicker: 1.4 } },
], 2, 0.81)
