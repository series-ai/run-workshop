import { authoredRecipe } from '../constants/01'

export default authoredRecipe('shadow-charge', 'Shadow charge', 'Shadow windup with void gather and ink wake.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'shadow-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'twirl', colorOverride: '#5425be', ramp: 'dark', spawnScale: 2.2, countScale: 0.5, speedScale: 1.1, speedJitter: 0.3, turbulenceScale: 0, gravity: 0, spinScale: 0.7, blend: 'alpha' } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'shadow-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#341e59' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.75, scale: 0.6, phase: 'shadow-charge-anchor-ring', tuning: { meshMotion: 'charge', ringPurpose: 'boundary', colorOverride: '#7a3ff0' } },
], 2, 0.8)
