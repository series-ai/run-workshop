import { authoredRecipe } from '../constants/01'

export default authoredRecipe('shard-charge', 'Shard charge', 'Shard windup with fragment glints and crack tension.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'shard-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'twirl', colorOverride: '#5ab8f0', ramp: 'held', spawnScale: 2.2, countScale: 0.5, speedScale: 1.1, speedJitter: 0.5, turbulenceScale: 0, gravity: 0, spinScale: 1.0, blend: 'alpha' } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'shard-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#5ac8ff' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.6, scale: 0.6, phase: 'shard-charge-anchor-ring', tuning: { meshMotion: 'charge', ringPurpose: 'boundary', colorOverride: '#4db8f0' } },
], 2, 1.2)
