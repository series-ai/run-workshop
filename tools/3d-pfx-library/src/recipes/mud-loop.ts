import { authoredRecipe } from '../constants/01'

export default authoredRecipe('mud-loop', 'Mud loop', 'Heavy earth hazard loop with sludge body, clumps, and a grounded boundary.', [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.45, scale: 0.55, phase: 'mud-loop-body-cling', tuning: { meshMotion: 'bloom', blend: 'alpha', colorOverride: '#7a3d0d' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'mud-loop-element-traffic', tuning: { sprite: 'splat', size: [0.55, 0.7, 0.4], colorOverride: '#7a3d0d', ramp: 'pigment', countScale: 0.45, speedScale: 0.8, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'screen-fall', gravity: 0, blend: 'alpha', spinScale: 0.85 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'mud-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#7a3d0d' } },
], 2, 1.35)
