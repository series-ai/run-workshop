import { authoredRecipe } from '../constants/01'

export default authoredRecipe('hologram-trail', 'Hologram trail', 'Projection trail with scan slices and voxel noise.', [
  { kind: 'particles', role: 'trail', opacity: 0.9, scale: 0.6, phase: 'hologram-trail-mote-wake', tuning: { motion: 'trail-stream', sprite: 'sparkle', size: [0.35, 0.5, 0.3], colorOverride: '#00c3ff', ramp: 'held', countScale: 0.35, lifeScale: 0.7, speedScale: 5, speedJitter: 0.15, streamSpread: 0.1, spinScale: 0, turbulenceScale: 0, gravity: 0, flicker: 1.2 } },
  { kind: 'tapered-trail', role: 'trail', opacity: 0.6, scale: 0.7, phase: 'hologram-trail-taper-body', tuning: { meshShader: 'trail-flow', colorOverride: '#00c3ff' } },
  { kind: 'particles', role: 'aura', opacity: 0.65, scale: 0.42, phase: 'hologram-trail-stragglers', tuning: { sprite: 'glow', colorOverride: '#c8f0fa', ramp: 'held', delay: 0.3, window: 0.55, lifeScale: 0.7, countScale: 0.1, speedScale: 0.35, spawnOffset: [-0.6, 0, 0], spawnScale: 0.2, turbulenceScale: 0.25, gravity: 0.15 } },
], 2, 1.3)
