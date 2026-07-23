import { authoredRecipe } from '../constants/01'

export default authoredRecipe('hologram-idle', 'Hologram idle', 'Projection idle with scan bands and voxel shimmer.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'hologram-idle-element-traffic', tuning: { sprite: 'sparkle', size: [0.35, 0.5, 0.3], colorOverride: '#00c3ff', ramp: 'held', countScale: 0.3, speedScale: 0.6, speedJitter: 0.5, turbulenceScale: 0.25, motion: 'orbit-ring', gravity: 0, spinScale: 0, flicker: 1.6 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'hologram-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#00c3ff', flicker: 1.4 } },
], 2, 0.81)
