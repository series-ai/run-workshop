import { authoredRecipe } from '../constants/01'

export default authoredRecipe('dash-charge', 'Dash charge', 'Dash windup with speed coil and afterimage flecks.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.9, scale: 0.38, phase: 'dash-charge-ignition-pop', tuning: { meshMotion: 'flash', colorOverride: '#ffffff' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'dash-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'streak', colorOverride: '#7fc4ff', ramp: 'held', spawnScale: 2.2, countScale: 0.5, speedScale: 0.9, speedJitter: 0.5, turbulenceScale: 0, gravity: 0, stretch: 1.4, spinScale: 0 } },
  { kind: 'impact-sparks', role: 'impact', opacity: 0.9, scale: 0.5, phase: 'dash-charge-release-snap', tuning: { motion: 'converge-center', sprite: 'glow', delay: 0.88, window: 0.08, lifeScale: 0.14, ease: 'snap', speedScale: 2, spawnScale: 1.2, colorOverride: '#ffffff', turbulenceScale: 0, gravity: 0 } },
], 2, 1.8)
