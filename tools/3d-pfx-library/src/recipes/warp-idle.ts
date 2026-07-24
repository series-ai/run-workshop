import { authoredRecipe } from '../constants/01'

export default authoredRecipe('warp-idle', 'Warp idle', 'Warp idle with lens bend and displaced space motes.', [
  { kind: 'core-sphere', role: 'body', opacity: 0.7, scale: 0.48, phase: 'warp-idle-lens-bend', tuning: { meshShader: 'vortex-swirl', meshMotion: 'breathe', colorOverride: '#2f8fe8' } },
  { kind: 'particles', role: 'aura', opacity: 0.8, scale: 0.6, phase: 'warp-idle-displaced-motes', tuning: { sprite: 'sparkle', blend: 'additive', size: [0.3, 0.44, 0.26], colorOverride: '#7fb8f2', ramp: 'held', countScale: 0.24, speedScale: 0.5, speedJitter: 0.2, turbulenceScale: 0.45, motion: 'orbit-ring', gravity: 0, spinScale: 0 } },
], 2, 0.81)
