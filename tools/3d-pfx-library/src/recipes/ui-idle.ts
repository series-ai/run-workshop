import { authoredRecipe } from '../constants/01'

export default authoredRecipe('ui-idle', 'UI idle', 'Interface idle shimmer with small HUD points.', [
  { kind: 'screen-plane', role: 'screen', opacity: 0.28, scale: 0.5, phase: 'ui-idle-hud-shimmer', tuning: { meshMotion: 'pulse', blend: 'additive', colorOverride: '#4da6ff' } },
  { kind: 'particles', role: 'screen', opacity: 0.7, scale: 0.5, phase: 'ui-idle-interface-pips', tuning: { sprite: 'sparkle', blend: 'additive', size: [0.22, 0.32, 0.18], colorOverride: '#9cc8ff', ramp: 'held', countScale: 0.2, speedScale: 0.4, speedJitter: 0.1, turbulenceScale: 0, motion: 'column-rise', gravity: 0, spinScale: 0 } },
], 2, 0.68)
