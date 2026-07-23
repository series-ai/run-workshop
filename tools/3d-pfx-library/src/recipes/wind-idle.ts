import { authoredRecipe } from '../constants/01'

export default authoredRecipe('wind-idle', 'Wind idle', 'Air current idle with ribbon flow and drifting dust.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'wind-idle-element-traffic', tuning: { sprite: 'streak', size: [0.7, 0.5, 0.15], colorOverride: '#00d9a8', ramp: 'held', countScale: 0.3, speedScale: 0.6, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'orbit-ring', gravity: 0, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'wind-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#00d9a8' } },
], 2, 0.81)
