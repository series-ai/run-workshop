import { authoredRecipe } from '../constants/01'

export default authoredRecipe('spark-charge', 'Spark charge', 'Spark windup with contact ticks and bright focus.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.9, scale: 0.38, phase: 'spark-charge-ignition-pop', tuning: { meshMotion: 'flash', colorOverride: '#fff2c8' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'spark-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'streak', colorOverride: '#ffc21f', ramp: 'held', spawnScale: 2.2, countScale: 0.5, speedScale: 1.1, speedJitter: 0.5, turbulenceScale: 0, gravity: 0, stretch: 1.3, spinScale: 0 } },
  { kind: 'impact-sparks', role: 'impact', opacity: 0.9, scale: 0.5, phase: 'spark-charge-release-snap', tuning: { motion: 'converge-center', sprite: 'glow', delay: 0.88, window: 0.08, lifeScale: 0.14, ease: 'snap', speedScale: 2, spawnScale: 1.2, colorOverride: '#fff2c8', turbulenceScale: 0, gravity: 0 } },
], 2, 2.4)
