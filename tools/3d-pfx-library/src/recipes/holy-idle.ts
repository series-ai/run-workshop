import { authoredRecipe } from '../constants/01'

export default authoredRecipe('holy-idle', 'Holy idle', 'Holy aura idle with breathing halo and grace motes.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'holy-idle-element-traffic', tuning: { sprite: 'sparkle', size: [0.35, 0.5, 0.3], colorOverride: '#ffc300', ramp: 'held', countScale: 0.3, speedScale: 0.6, speedJitter: 0.15, turbulenceScale: 0, motion: 'column-rise', gravity: 0.3, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'holy-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#ffc300' } },
], 2, 0.51)
