import { authoredRecipe } from '../constants/01'

export default authoredRecipe('hologram-loop', 'Hologram loop', 'Projection loop with scan band, shimmer plane, and voxel noise.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.85, scale: 0.75, phase: 'hologram-loop-ground-circle', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#00c3ff' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'hologram-loop-element-traffic', tuning: { sprite: 'sparkle', size: [0.35, 0.5, 0.3], colorOverride: '#00c3ff', ramp: 'held', countScale: 0.45, speedScale: 0.6, speedJitter: 0.5, turbulenceScale: 0.25, motion: 'orbit-ring', gravity: 0, spinScale: 0, flicker: 1.6 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'hologram-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#00c3ff', flicker: 1.4 } },
], 2, 0.95)
