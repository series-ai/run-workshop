import { authoredRecipe } from '../constants/01'

export default authoredRecipe('parry-charge', 'Parry charge', 'Parry windup with counter-ready spark and timing ticks.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.9, scale: 0.38, phase: 'parry-charge-ignition-pop', tuning: { meshMotion: 'flash', colorOverride: '#fff2c8' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'parry-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'streak', colorOverride: '#ffc21f', ramp: 'held', spawnScale: 2.2, countScale: 0.7, speedScale: 1.1, speedJitter: 0.5, turbulenceScale: 0, gravity: 0, stretch: 1.4, spinScale: 0 } },
  { kind: 'impact-sparks', role: 'impact', opacity: 0.9, scale: 0.5, phase: 'parry-charge-release-snap', tuning: { motion: 'converge-center', sprite: 'glow', delay: 0.88, window: 0.08, lifeScale: 0.14, ease: 'snap', speedScale: 2, spawnScale: 1.2, colorOverride: '#fff2c8', turbulenceScale: 0, gravity: 0 } },
], 2, 2.6)
