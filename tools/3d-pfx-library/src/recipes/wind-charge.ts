import { authoredRecipe } from '../constants/01'

export default authoredRecipe('wind-charge', 'Wind charge', 'Wind windup with air spool and dust draw.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'wind-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'streak', colorOverride: '#5adfc8', ramp: 'held', spawnScale: 2.2, countScale: 0.5, speedScale: 1.1, speedJitter: 0.5, turbulenceScale: 0, gravity: 0, stretch: 1.3, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'wind-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#4dc8b0' } },
  { kind: 'cloud-volume', role: 'volume', opacity: 0.4, scale: 0.52, phase: 'wind-charge-gather-body', tuning: { meshMotion: 'charge', blend: 'alpha', colorOverride: '#3fa890' } },
], 2, 1.2)
