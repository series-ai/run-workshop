import { authoredRecipe } from '../constants/01'

export default authoredRecipe('rune-charge', 'Rune charge', 'Rune windup with script gather and casting ring.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'rune-charge-gather-inflow', tuning: { motion: 'column-rise', sprite: 'rune', colorOverride: '#ffb62f', ramp: 'held', spawnScale: 2.2, countScale: 0.5, speedScale: 1.1, speedJitter: 0.15, turbulenceScale: 0, gravity: 0, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'rune-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#ffc21f' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.6, scale: 0.6, phase: 'rune-charge-anchor-ring', tuning: { meshMotion: 'charge', ringPurpose: 'glyph', colorOverride: '#ffb62f' } },
], 2, 1.0)
