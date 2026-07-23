import { authoredRecipe } from '../constants/01'

export default authoredRecipe('water-charge', 'Water charge', 'Water windup with ripple pull and droplet gather.', [
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'water-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'soft', colorOverride: '#1fa8e8', ramp: 'held', spawnScale: 2.2, countScale: 0.5, speedScale: 1.2, speedJitter: 0.65, turbulenceScale: 0.25, gravity: 0, spinScale: 0.85, size: [0.35, 0.5, 0.3] } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'water-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#29b6f0' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.6, scale: 0.6, phase: 'water-charge-anchor-ring', tuning: { meshMotion: 'charge', ringPurpose: 'boundary', colorOverride: '#1fa8e8' } },
], 2, 1.1)
