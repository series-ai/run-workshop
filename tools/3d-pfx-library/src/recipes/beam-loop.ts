import { authoredRecipe } from '../constants/01'

export default authoredRecipe('beam-loop', 'Beam loop', 'Sustained vertical beam for channels, objectives, and active devices.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.85, scale: 0.75, phase: 'beam-loop-ground-circle', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#0077ff' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'beam-loop-element-traffic', tuning: { sprite: 'sparkle', size: [0.35, 0.5, 0.3], colorOverride: '#0077ff', ramp: 'held', countScale: 0.45, speedScale: 0.6, speedJitter: 0.15, turbulenceScale: 0, motion: 'column-rise', gravity: 0.3, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'beam-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#0077ff' } },
], 2, 0.8)
