import { authoredRecipe } from '../constants/01'

export default authoredRecipe('laser-idle', 'Laser idle', 'Hard-light idle line with ricochet shimmer.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'laser-idle-element-traffic', tuning: { sprite: 'glow', size: [0.45, 0.6, 0.35], colorOverride: '#ff2600', ramp: 'held', countScale: 0.3, speedScale: 0.6, speedJitter: 0.5, turbulenceScale: 0.25, motion: 'orbit-ring', gravity: 0, spinScale: 0, flicker: 1.6 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'laser-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#ff2600', flicker: 1.4 } },
], 2, 0.81)
