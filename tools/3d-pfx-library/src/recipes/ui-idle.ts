import { authoredRecipe } from '../constants/01'

export default authoredRecipe('ui-idle', 'UI idle', 'Interface idle shimmer with small HUD points.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'ui-idle-element-traffic', tuning: { sprite: 'sparkle', size: [0.35, 0.5, 0.3], colorOverride: '#4da6ff', ramp: 'held', countScale: 0.3, speedScale: 0.6, speedJitter: 0.15, turbulenceScale: 0, motion: 'column-rise', gravity: 0.3, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'ui-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#4da6ff' } },
], 2, 0.68)
