import { authoredRecipe } from '../constants/01'

export default authoredRecipe('ice-charge', 'Ice charge', 'Ice windup with shards gathering and cold mist.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'ice-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'twirl', colorOverride: '#4db8f0', ramp: 'held', spawnScale: 2.2, countScale: 0.5, speedScale: 1.1, speedJitter: 0.5, turbulenceScale: 0, gravity: 0, spinScale: 0.9, blend: 'alpha' } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'ice-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#5ac8ff' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.6, scale: 0.6, phase: 'ice-charge-anchor-ring', tuning: { meshMotion: 'charge', ringPurpose: 'boundary', colorOverride: '#4db8f0' } },
], 2, 1.1)
