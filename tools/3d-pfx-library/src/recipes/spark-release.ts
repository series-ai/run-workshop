import { authoredRecipe } from '../constants/01'

export default authoredRecipe('spark-release', 'Spark release', 'Spark release with contact star and glitter points.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.95, scale: 0.35, phase: 'spark-release-launch-flash', tuning: { meshMotion: 'flash', colorOverride: '#fff2c0' } },
  { kind: 'particles', role: 'impact', opacity: 0.95, scale: 0.5, phase: 'spark-release-launch-fan', tuning: { spawnScale: 0.45, motion: 'radial-burst', sprite: 'streak', colorOverride: '#ffb300', ramp: 'pigment', speedScale: 2.2, speedJitter: 0.4, window: 0.05, lifeScale: 0.4, ease: 'snap', countScale: 0.5, turbulenceScale: 0, gravity: 0, impactVector: [1, 0.3, 0.55], spreadAngle: 0.35, stretch: 2.0, spinScale: 0 } },
  { kind: 'particles', role: 'aura', opacity: 0.7, scale: 0.5, phase: 'spark-release-anchor-residue', tuning: { sprite: 'glow', blend: 'alpha', ramp: 'dark', delay: 0.38, window: 0.45, lifeScale: 0.6, speedScale: 0.2, gravity: 0.3, countScale: 0.35, turbulenceScale: 0.3, colorOverride: '#ffb300' } },
], 2, 2.4)
