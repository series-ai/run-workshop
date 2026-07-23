import { authoredRecipe } from '../constants/01'

export default authoredRecipe('warp-idle', 'Warp idle', 'Warp idle with lens bend and displaced space motes.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'warp-idle-element-traffic', tuning: { sprite: 'sparkle', size: [0.35, 0.5, 0.3], colorOverride: '#2f8fe8', ramp: 'held', countScale: 0.3, speedScale: 0.6, speedJitter: 0.15, turbulenceScale: 0, motion: 'orbit-ring', gravity: 0, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'warp-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#2f8fe8' } },
], 2, 0.81)
