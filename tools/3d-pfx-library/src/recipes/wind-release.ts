import { authoredRecipe } from '../constants/01'

export default authoredRecipe('wind-release', 'Wind release', 'Wind release with gust shear and dust sling.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.95, scale: 0.42, phase: 'wind-release-launch-flash', tuning: { meshMotion: 'flash', colorOverride: '#d8fff0' } },
  { kind: 'particles', role: 'impact', opacity: 0.95, scale: 0.65, phase: 'wind-release-launch-fan', tuning: { spawnScale: 0.45, motion: 'radial-burst', sprite: 'streak', colorOverride: '#00d9a8', ramp: 'pigment', speedScale: 2.2, speedJitter: 0.4, window: 0.05, lifeScale: 0.4, ease: 'snap', countScale: 0.85, turbulenceScale: 0, gravity: 0, impactVector: [1, 0.3, 0.55], spreadAngle: 0.35, stretch: 1.8, spinScale: 0 } },
  { kind: 'particles', role: 'aura', opacity: 0.7, scale: 0.5, phase: 'wind-release-anchor-residue', tuning: { sprite: 'glow', blend: 'alpha', ramp: 'dark', delay: 0.26, window: 0.5, lifeScale: 0.6, speedScale: 0.2, gravity: 0.3, countScale: 0.35, turbulenceScale: 0.3, colorOverride: '#00d9a8' } },
], 2, 2.2)
