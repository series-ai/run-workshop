import { authoredRecipe } from '../constants/01'

export default authoredRecipe('thruster-charge', 'Thruster charge', 'Thruster windup with ignition prime and exhaust thread.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'thruster-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'glow', colorOverride: '#ff8a2f', ramp: 'held', spawnScale: 2.2, countScale: 0.5, speedScale: 1.1, speedJitter: 0.5, turbulenceScale: 0, gravity: 0, spinScale: 0, flicker: 1.2 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'thruster-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#ff8a2f', flicker: 1.2 } },
  { kind: 'cloud-volume', role: 'volume', opacity: 0.4, scale: 0.52, phase: 'thruster-charge-gather-body', tuning: { meshMotion: 'charge', blend: 'alpha', colorOverride: '#8a8a8a' } },
], 2, 1.2)
