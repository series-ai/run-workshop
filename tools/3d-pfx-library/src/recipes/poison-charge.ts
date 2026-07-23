import { authoredRecipe } from '../constants/01'

export default authoredRecipe('poison-charge', 'Poison charge', 'Poison windup with thickening spores and hazard pulse.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'poison-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'glow', colorOverride: '#55e51f', ramp: 'held', spawnScale: 2.2, countScale: 0.5, speedScale: 1.1, speedJitter: 0.5, turbulenceScale: 0, gravity: 0, spinScale: 0, flicker: 0.8 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'poison-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#3fc00f', flicker: 0.8 } },
  { kind: 'cloud-volume', role: 'volume', opacity: 0.4, scale: 0.52, phase: 'poison-charge-gather-body', tuning: { meshMotion: 'charge', blend: 'alpha', colorOverride: '#2f8a1f' } },
], 2, 0.95)
