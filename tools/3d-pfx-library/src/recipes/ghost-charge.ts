import { authoredRecipe } from '../constants/01'

export default authoredRecipe('ghost-charge', 'Ghost charge', 'Ghost windup with spirit gather and fade halo.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'ghost-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'glow', colorOverride: '#eaffff', ramp: 'held', spawnScale: 2.2, countScale: 0.5, speedScale: 1.1, speedJitter: 0.3, turbulenceScale: 0, gravity: 0, spinScale: 0, flicker: 0.8 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'ghost-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#b4f3ff', flicker: 0.8 } },
  { kind: 'cloud-volume', role: 'volume', opacity: 0.4, scale: 0.52, phase: 'ghost-charge-gather-body', tuning: { meshMotion: 'charge', blend: 'alpha', colorOverride: '#5fc8d8' } },
], 2, 0.8)
