import { authoredRecipe } from '../constants/01'

export default authoredRecipe('barrier-loop', 'Barrier loop', 'Persistent barrier wall with base ring and crackle points.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.85, scale: 0.75, phase: 'barrier-loop-ground-circle', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#4da6ff' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'barrier-loop-element-traffic', tuning: { sprite: 'glow', size: [0.45, 0.6, 0.35], colorOverride: '#4da6ff', ramp: 'held', countScale: 0.45, speedScale: 0.6, speedJitter: 0.15, turbulenceScale: 0, motion: 'column-rise', gravity: 0.3, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'barrier-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#4da6ff' } },
], 2, 0.8)
