import { authoredRecipe } from '../constants/01'

export default authoredRecipe('ghost-idle', 'Ghost idle', 'Ethereal idle with spirit wisps and fade halo.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'ghost-idle-element-traffic', tuning: { sprite: 'glow', size: [0.45, 0.6, 0.35], colorOverride: '#00c8d9', ramp: 'held', countScale: 0.3, speedScale: 0.6, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'column-rise', gravity: 0.3, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'ghost-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#00c8d9' } },
], 2, 0.81)
