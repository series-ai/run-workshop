import { authoredRecipe } from '../constants/01'

export default authoredRecipe('parry-idle', 'Parry idle', 'Parry-ready idle with timing sparks and counter pulse.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'parry-idle-element-traffic', tuning: { sprite: 'streak', size: [0.7, 0.5, 0.15], colorOverride: '#ffb300', ramp: 'held', countScale: 0.3, speedScale: 0.6, speedJitter: 0.15, turbulenceScale: 0, motion: 'orbit-ring', gravity: 0, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'parry-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#ffb300' } },
], 2, 0.68)
