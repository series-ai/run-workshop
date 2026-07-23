import { authoredRecipe } from '../constants/01'

export default authoredRecipe('warp-trail', 'Warp trail', 'Spatial distortion trail with shear ribbon and pixel flecks.', [
  { kind: 'particles', role: 'trail', opacity: 0.95, scale: 0.68, phase: 'warp-trail-wake-stream', tuning: { motion: 'trail-stream', sprite: 'sparkle', size: [0.35, 0.5, 0.3], colorOverride: '#2f8fe8', ramp: 'held', countScale: 0.35, lifeScale: 0.7, speedScale: 6, speedJitter: 0.4, streamSpread: 0.12, turbulenceScale: 0, gravity: 0, spinScale: 1.2 } },
  { kind: 'tapered-trail', role: 'trail', opacity: 0.7, scale: 0.75, phase: 'warp-trail-taper-body', tuning: { meshShader: 'trail-flow', colorOverride: '#2f8fe8' } },
  { kind: 'particles', role: 'aura', opacity: 0.6, scale: 0.45, phase: 'warp-trail-stragglers', tuning: { sprite: 'glow', colorOverride: '#dff2ff', ramp: 'held', delay: 0.3, window: 0.55, lifeScale: 0.7, countScale: 0.12, speedScale: 0.4, spawnOffset: [-0.6, 0, 0], spawnScale: 0.2, turbulenceScale: 0.3, gravity: 0.2 } },
], 2, 1.4)
