import { authoredRecipe } from '../constants/01'

export default authoredRecipe('warp-loop', 'Warp loop', 'Sustained spatial distortion with shear ribbons and a stabilizing ring.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.85, scale: 0.75, phase: 'warp-loop-ground-circle', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#2f8fe8' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'warp-loop-element-traffic', tuning: { sprite: 'sparkle', size: [0.35, 0.5, 0.3], colorOverride: '#2f8fe8', ramp: 'held', countScale: 0.45, speedScale: 0.6, speedJitter: 0.15, turbulenceScale: 0, motion: 'orbit-ring', gravity: 0, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'warp-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#2f8fe8' } },
], 2, 0.95)
