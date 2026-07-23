import { authoredRecipe } from '../constants/01'

export default authoredRecipe('glyph-loop', 'Glyph loop', 'Persistent glyph field for spells, puzzle states, and buff zones.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.85, scale: 0.75, phase: 'glyph-loop-ground-circle', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#ffb300' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'glyph-loop-element-traffic', tuning: { sprite: 'magic', size: [0.5, 0.65, 0.4], colorOverride: '#ffb300', ramp: 'held', countScale: 0.45, speedScale: 0.6, speedJitter: 0.15, turbulenceScale: 0, motion: 'column-rise', gravity: 0.3, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'glyph-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#ffb300' } },
], 2, 0.8)
