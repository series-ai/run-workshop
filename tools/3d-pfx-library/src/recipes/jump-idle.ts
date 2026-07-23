import { authoredRecipe } from '../constants/01'

export default authoredRecipe('jump-idle', 'Jump idle', 'Jump pad idle with lift stream and takeoff pips.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'jump-idle-element-traffic', tuning: { sprite: 'glow', size: [0.45, 0.6, 0.35], colorOverride: '#5ac8ff', ramp: 'held', countScale: 0.3, speedScale: 0.6, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'column-rise', gravity: 0.3, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'jump-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#5ac8ff' } },
], 2, 0.81)
