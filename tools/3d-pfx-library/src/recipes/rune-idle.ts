import { authoredRecipe } from '../constants/01'

export default authoredRecipe('rune-idle', 'Rune idle', 'Arcane rune idle with script orbit and letter motes.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'rune-idle-element-traffic', tuning: { sprite: 'rune', size: [0.5, 0.65, 0.4], colorOverride: '#ffa200', ramp: 'held', countScale: 0.3, speedScale: 0.6, speedJitter: 0.15, turbulenceScale: 0, motion: 'column-rise', gravity: 0.3, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'rune-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#ffa200' } },
], 2, 0.68)
