import { authoredRecipe } from '../constants/01'

export default authoredRecipe('holy-charge', 'Holy charge', 'Holy windup with brightening halo and grace motes.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'holy-charge-gather-inflow', tuning: { motion: 'column-rise', sprite: 'sparkle', colorOverride: '#ffd44d', ramp: 'held', spawnScale: 2.2, countScale: 0.5, speedScale: 1.1, speedJitter: 0.15, turbulenceScale: 0, gravity: 0, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'holy-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#ffcf3d' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.6, scale: 0.6, phase: 'holy-charge-anchor-ring', tuning: { meshMotion: 'charge', ringPurpose: 'boundary', colorOverride: '#ffc21f' } },
], 2, 0.9)
