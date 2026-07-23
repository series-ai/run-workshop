import { authoredRecipe } from '../constants/01'

export default authoredRecipe('parry-release', 'Parry release', 'Parry release with counter spark and timing flash.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.95, scale: 0.42, phase: 'parry-release-launch-flash', tuning: { meshMotion: 'flash', colorOverride: '#fff2c0' } },
  { kind: 'particles', role: 'impact', opacity: 0.95, scale: 0.65, phase: 'parry-release-launch-fan', tuning: { spawnScale: 0.45, motion: 'radial-burst', sprite: 'streak', colorOverride: '#ffb300', ramp: 'pigment', speedScale: 2.2, speedJitter: 0.4, window: 0.05, lifeScale: 0.4, ease: 'snap', countScale: 0.85, turbulenceScale: 0, gravity: 0, impactVector: [1, 0.3, 0.55], spreadAngle: 0.35, stretch: 2.2, spinScale: 0 } },
  { kind: 'particles', role: 'impact', opacity: 0.7, scale: 0.45, phase: 'parry-release-backblast', tuning: { motion: 'radial-burst', sprite: 'glow', impactVector: [-1, 0.25, 0], spreadAngle: 0.8, speedScale: 1.2, delay: 0.12, window: 0.3, lifeScale: 0.7, ease: 'snap', colorOverride: '#ffb300', ramp: 'pigment', countScale: 0.25, turbulenceScale: 0, gravity: -2 } },
], 2, 3.0)
