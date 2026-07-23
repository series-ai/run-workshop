import { authoredRecipe } from '../constants/01'

export default authoredRecipe('engine-charge', 'Engine charge', 'Engine windup with heat build and metal ticks.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'engine-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'debris', colorOverride: '#b8b8b8', ramp: 'dark', spawnScale: 2.2, countScale: 0.5, speedScale: 1.1, speedJitter: 0.5, turbulenceScale: 0, gravity: 0, spinScale: 0, blend: 'alpha' } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'engine-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#c8c8c8' } },
  { kind: 'cloud-volume', role: 'volume', opacity: 0.4, scale: 0.52, phase: 'engine-charge-gather-body', tuning: { meshMotion: 'charge', blend: 'alpha', colorOverride: '#6e6e6e' } },
], 2, 1.1)
