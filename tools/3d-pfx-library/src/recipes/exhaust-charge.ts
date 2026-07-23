import { authoredRecipe } from '../constants/01'

export default authoredRecipe('exhaust-charge', 'Exhaust charge', 'Exhaust windup with soot build and heat thread.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'exhaust-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'debris', colorOverride: '#8a8a8a', ramp: 'dark', spawnScale: 2.2, countScale: 0.5, speedScale: 1.1, speedJitter: 0.5, turbulenceScale: 0, gravity: 0, spinScale: 0, blend: 'alpha' } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'exhaust-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#9a9a9a' } },
  { kind: 'cloud-volume', role: 'volume', opacity: 0.4, scale: 0.52, phase: 'exhaust-charge-gather-body', tuning: { meshMotion: 'charge', blend: 'alpha', colorOverride: '#6e6e6e' } },
], 2, 1.0)
