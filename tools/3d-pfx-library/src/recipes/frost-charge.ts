import { authoredRecipe } from '../constants/01'

export default authoredRecipe('frost-charge', 'Frost charge', 'Frost windup with crystal breath and snow motes.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'frost-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'sparkle', colorOverride: '#7fd0f5', ramp: 'held', spawnScale: 2.2, countScale: 0.5, speedScale: 1.1, speedJitter: 0.5, turbulenceScale: 0, gravity: 0, spinScale: 0, blend: 'alpha' } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'frost-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#8fd8ff' } },
  { kind: 'cloud-volume', role: 'volume', opacity: 0.4, scale: 0.52, phase: 'frost-charge-gather-body', tuning: { meshMotion: 'charge', blend: 'alpha', colorOverride: '#5a9fd0' } },
], 2, 0.95)
