import { authoredRecipe } from '../constants/01'

export default authoredRecipe('footstep-loop', 'Footstep loop', 'Repeatable footfall loop with tiny puffs and grounded grit.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.85, scale: 0.75, phase: 'footstep-loop-ground-circle', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#9a7a3d' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'footstep-loop-element-traffic', tuning: { sprite: 'debris', size: [0.45, 0.55, 0.3], colorOverride: '#9a7a3d', ramp: 'held', countScale: 0.45, speedScale: 0.6, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'ground-scuff', gravity: 0.1, blend: 'alpha', spinScale: 0.85 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'footstep-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#9a7a3d', positionOffset: [0, 0.25, 0] } },
], 2, 0.95)
