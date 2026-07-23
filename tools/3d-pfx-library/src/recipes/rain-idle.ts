import { authoredRecipe } from '../constants/01'

export default authoredRecipe('rain-idle', 'Rain idle', 'Rain idle with falling streaks and surface splash pips.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'rain-idle-element-traffic', tuning: { sprite: 'streak', size: [0.7, 0.5, 0.15], colorOverride: '#0095ff', ramp: 'held', countScale: 0.3, speedScale: 0.8, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'screen-fall', gravity: 0, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'rain-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#0095ff' } },
], 2, 0.81)
