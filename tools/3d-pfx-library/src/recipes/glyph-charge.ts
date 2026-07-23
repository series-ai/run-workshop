import { authoredRecipe } from '../constants/01'

export default authoredRecipe('glyph-charge', 'Glyph charge', 'Glyph windup with symbol ring and arcane dust.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'glyph-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'magic', colorOverride: '#ffc21f', ramp: 'held', spawnScale: 2.2, countScale: 0.5, speedScale: 1.1, speedJitter: 0.15, turbulenceScale: 0, gravity: 0, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'glyph-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#ffb62f' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.6, scale: 0.6, phase: 'glyph-charge-anchor-ring', tuning: { meshMotion: 'charge', ringPurpose: 'glyph', colorOverride: '#ffb62f' } },
], 2, 1.0)
