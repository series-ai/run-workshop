import { authoredRecipe } from '../constants/01'

export default authoredRecipe('healing-charge', 'Healing charge', 'Healing windup with restoration build and calm pulse.', [
  { kind: 'particles', role: 'aura', opacity: 1.0, scale: 0.62, phase: 'healing-charge-gather-inflow', tuning: { motion: 'healing-spiral', sprite: 'sparkle', colorOverride: '#4de87a', ramp: 'held', spawnScale: 2.2, countScale: 0.5, speedScale: 1.1, speedJitter: 0.15, turbulenceScale: 0, gravity: 0, spinScale: 0, size: [0.4, 0.55, 0.35] } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'healing-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#6fe895' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.6, scale: 0.6, phase: 'healing-charge-anchor-ring', tuning: { meshMotion: 'charge', ringPurpose: 'boundary', colorOverride: '#3fd968' } },
], 2, 0.8)
