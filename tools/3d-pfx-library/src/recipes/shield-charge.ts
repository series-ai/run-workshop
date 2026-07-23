import { authoredRecipe } from '../constants/01'

export default authoredRecipe('shield-charge', 'Shield charge', 'Shield windup with brightening shell and guard sparks.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'shield-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'glow', colorOverride: '#2f8fe8', ramp: 'held', spawnScale: 2.2, countScale: 0.5, speedScale: 1.1, speedJitter: 0.15, turbulenceScale: 0, gravity: 0, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'shield-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#4da6ff' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.6, scale: 0.6, phase: 'shield-charge-anchor-ring', tuning: { meshMotion: 'charge', ringPurpose: 'boundary', colorOverride: '#2f8fe8' } },
], 2, 1.0)
