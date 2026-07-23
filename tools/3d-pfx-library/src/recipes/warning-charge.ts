import { authoredRecipe } from '../constants/01'

export default authoredRecipe('warning-charge', 'Warning charge', 'Warning windup with alert prime and danger ticks.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.9, scale: 0.38, phase: 'warning-charge-ignition-pop', tuning: { meshMotion: 'flash', colorOverride: '#ffb272' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'warning-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'glow', colorOverride: '#ff6a1f', ramp: 'held', spawnScale: 2.2, countScale: 0.5, speedScale: 1.1, speedJitter: 0.5, turbulenceScale: 0, gravity: 0, spinScale: 0, flicker: 1.2 } },
  { kind: 'impact-sparks', role: 'impact', opacity: 0.9, scale: 0.5, phase: 'warning-charge-release-snap', tuning: { motion: 'converge-center', sprite: 'glow', delay: 0.88, window: 0.08, lifeScale: 0.14, ease: 'snap', speedScale: 2, spawnScale: 1.2, colorOverride: '#ffb272', turbulenceScale: 0, gravity: 0 } },
], 2, 2.0)
