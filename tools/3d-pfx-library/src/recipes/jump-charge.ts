import { authoredRecipe } from '../constants/01'

export default authoredRecipe('jump-charge', 'Jump charge', 'Jump windup with lift loading and takeoff pips.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.9, scale: 0.38, phase: 'jump-charge-ignition-pop', tuning: { meshMotion: 'flash', colorOverride: '#eaf8ff' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'jump-charge-gather-inflow', tuning: { motion: 'column-rise', sprite: 'glow', colorOverride: '#5ac8ff', ramp: 'held', spawnScale: 2.2, countScale: 0.5, speedScale: 0.9, speedJitter: 0.5, turbulenceScale: 0, gravity: 0, spinScale: 0 } },
  { kind: 'impact-sparks', role: 'impact', opacity: 0.9, scale: 0.5, phase: 'jump-charge-release-snap', tuning: { motion: 'converge-center', sprite: 'glow', delay: 0.88, window: 0.08, lifeScale: 0.14, ease: 'snap', speedScale: 2, spawnScale: 1.2, colorOverride: '#eaf8ff', turbulenceScale: 0, gravity: 0 } },
], 2, 1.7)
