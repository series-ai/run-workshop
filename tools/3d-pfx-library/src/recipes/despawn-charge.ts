import { authoredRecipe } from '../constants/01'

export default authoredRecipe('despawn-charge', 'Despawn charge', 'Despawn windup with exit gather and fade particles.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'despawn-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'sparkle', colorOverride: '#5fb0e8', ramp: 'held', spawnScale: 2.2, countScale: 0.5, speedScale: 1.1, speedJitter: 0.15, turbulenceScale: 0, gravity: 0, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'despawn-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#7fc4ff' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.6, scale: 0.6, phase: 'despawn-charge-anchor-ring', tuning: { meshMotion: 'charge', ringPurpose: 'boundary', colorOverride: '#4d8fc0' } },
], 2, 1.1)
