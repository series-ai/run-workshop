import { authoredRecipe } from '../constants/01'

export default authoredRecipe('barrier-charge', 'Barrier charge', 'Barrier windup with panel pulse and edge motes.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'barrier-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'glow', colorOverride: '#4da6ff', ramp: 'held', spawnScale: 2.2, countScale: 0.5, speedScale: 1.1, speedJitter: 0.15, turbulenceScale: 0, gravity: 0, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'barrier-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#5fb0e8' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.6, scale: 0.6, phase: 'barrier-charge-anchor-ring', tuning: { meshMotion: 'charge', ringPurpose: 'boundary', colorOverride: '#4da6ff' } },
], 2, 1.0)
