import { authoredRecipe } from '../constants/01'

export default authoredRecipe('curse-charge', 'Curse charge', 'Curse windup with tightening hex and glyph dust.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'curse-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'magic', colorOverride: '#a855f5', ramp: 'held', spawnScale: 2.2, countScale: 0.5, speedScale: 1.1, speedJitter: 0.3, turbulenceScale: 0, gravity: 0, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'curse-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#9333ea' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.6, scale: 0.6, phase: 'curse-charge-anchor-ring', tuning: { meshMotion: 'charge', ringPurpose: 'boundary', colorOverride: '#9333ea' } },
], 2, 0.85)
