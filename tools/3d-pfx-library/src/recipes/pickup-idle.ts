import { authoredRecipe } from '../constants/01'

export default authoredRecipe('pickup-idle', 'Pickup idle', 'Collectible idle glint with screen sparkle and value motes.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'pickup-idle-element-traffic', tuning: { sprite: 'sparkle', size: [0.35, 0.5, 0.3], colorOverride: '#ffc21f', ramp: 'held', countScale: 0.3, speedScale: 0.6, speedJitter: 0.15, turbulenceScale: 0, motion: 'column-rise', gravity: 0.3, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'pickup-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#ffc21f' } },
], 2, 0.68)
