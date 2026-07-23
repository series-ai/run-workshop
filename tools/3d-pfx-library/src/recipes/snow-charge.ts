import { authoredRecipe } from '../constants/01'

export default authoredRecipe('snow-charge', 'Snow charge', 'Snow windup with powder lift and ice flecks.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'snow-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'sparkle', colorOverride: '#ffffff', ramp: 'held', spawnScale: 2.2, countScale: 0.5, speedScale: 1.1, speedJitter: 0.5, turbulenceScale: 0, gravity: 0, spinScale: 0, blend: 'alpha' } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'snow-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#dff2ff' } },
  { kind: 'cloud-volume', role: 'volume', opacity: 0.4, scale: 0.52, phase: 'snow-charge-gather-body', tuning: { meshMotion: 'charge', blend: 'alpha', colorOverride: '#b6d8f0' } },
], 2, 0.9)
