import { authoredRecipe } from '../constants/01'

export default authoredRecipe('rune-loop', 'Rune loop', 'Arcane sustained loop with rotating script and stable casting boundary.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.85, scale: 0.75, phase: 'rune-loop-ground-circle', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#ffa200' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'rune-loop-element-traffic', tuning: { sprite: 'rune', size: [0.5, 0.65, 0.4], colorOverride: '#ffa200', ramp: 'held', countScale: 0.45, speedScale: 0.6, speedJitter: 0.15, turbulenceScale: 0, motion: 'column-rise', gravity: 0.3, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'rune-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#ffa200' } },
], 2, 0.8)
