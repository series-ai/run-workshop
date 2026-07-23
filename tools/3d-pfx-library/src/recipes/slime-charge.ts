import { authoredRecipe } from '../constants/01'

export default authoredRecipe('slime-charge', 'Slime charge', 'Slime windup with ooze compression and elastic ripple.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'slime-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'soft', colorOverride: '#2fd943', ramp: 'held', spawnScale: 2.2, countScale: 0.5, speedScale: 1.1, speedJitter: 0.65, turbulenceScale: 0.25, gravity: 0, spinScale: 0.85 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'slime-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#2fd943' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.6, scale: 0.6, phase: 'slime-charge-anchor-ring', tuning: { meshMotion: 'charge', ringPurpose: 'boundary', colorOverride: '#2fd943' } },
], 2, 1.0)
