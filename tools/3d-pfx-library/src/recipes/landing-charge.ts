import { authoredRecipe } from '../constants/01'

export default authoredRecipe('landing-charge', 'Landing charge', 'Landing windup with ground compression and floor guide.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'landing-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'debris', colorOverride: '#b58743', ramp: 'held', spawnScale: 2.2, countScale: 0.5, speedScale: 1.1, speedJitter: 0.5, turbulenceScale: 0, gravity: 0, spinScale: 0, blend: 'alpha' } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'landing-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#d4a961' } },
  { kind: 'cloud-volume', role: 'volume', opacity: 0.4, scale: 0.52, phase: 'landing-charge-gather-body', tuning: { meshMotion: 'charge', blend: 'alpha', colorOverride: '#957d53' } },
], 2, 1.4)
