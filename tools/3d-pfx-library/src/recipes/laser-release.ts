import { authoredRecipe } from '../constants/01'

export default authoredRecipe('laser-release', 'Laser release', 'Laser release with hard-light snap and ricochet sparks.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.95, scale: 0.42, phase: 'laser-release-launch-flash', tuning: { meshMotion: 'flash', colorOverride: '#ffc8b8' } },
  { kind: 'particles', role: 'impact', opacity: 0.95, scale: 0.65, phase: 'laser-release-launch-fan', tuning: { spawnScale: 0.45, motion: 'radial-burst', sprite: 'streak', colorOverride: '#ff2600', ramp: 'pigment', speedScale: 2.2, speedJitter: 0.4, window: 0.05, lifeScale: 0.4, ease: 'snap', countScale: 0.85, turbulenceScale: 0, gravity: 0, impactVector: [1, 0.3, 0.55], spreadAngle: 0.35, stretch: 2.2, spinScale: 0, flicker: 1.2 } },
  { kind: 'particles', role: 'impact', opacity: 0.7, scale: 0.45, phase: 'laser-release-backblast', tuning: { motion: 'radial-burst', sprite: 'glow', impactVector: [-1, 0.25, 0], spreadAngle: 0.8, speedScale: 1.2, delay: 0.03, window: 0.1, lifeScale: 0.3, ease: 'snap', colorOverride: '#ff2600', ramp: 'pigment', countScale: 0.25, turbulenceScale: 0, gravity: -2 } },
  { kind: 'particles', role: 'aura', opacity: 0.7, scale: 0.5, phase: 'laser-release-anchor-residue', tuning: { sprite: 'glow', blend: 'alpha', ramp: 'dark', delay: 0.32, window: 0.55, lifeScale: 0.6, speedScale: 0.2, gravity: 0.3, countScale: 0.35, turbulenceScale: 0.3, colorOverride: '#ff2600' } },
], 2, 2.2)
