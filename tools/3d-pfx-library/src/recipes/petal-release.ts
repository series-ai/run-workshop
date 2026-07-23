import { authoredRecipe } from '../constants/01'

export default authoredRecipe('petal-release', 'Petal release', 'Petal release with blossom fan and perfume haze.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.95, scale: 0.42, phase: 'petal-release-launch-flash', tuning: { meshMotion: 'flash', colorOverride: '#ffd8e8' } },
  { kind: 'particles', role: 'impact', opacity: 0.95, scale: 0.65, phase: 'petal-release-launch-fan', tuning: { spawnScale: 0.45, motion: 'radial-burst', sprite: 'debris', size: [0.45, 0.55, 0.3], colorOverride: '#ff3d8a', ramp: 'pigment', speedScale: 2.2, speedJitter: 0.4, window: 0.05, lifeScale: 0.4, ease: 'snap', countScale: 0.85, turbulenceScale: 0.5, gravity: -0.5, impactVector: [1, 0.3, 0.55], spreadAngle: 0.35, spinScale: 1.2, blend: 'alpha' } },
  { kind: 'particles', role: 'aura', opacity: 0.7, scale: 0.5, phase: 'petal-release-anchor-residue', tuning: { sprite: 'glow', blend: 'alpha', ramp: 'dark', delay: 0.38, window: 0.45, lifeScale: 0.6, speedScale: 0.2, gravity: 0.3, countScale: 0.35, turbulenceScale: 0.3, colorOverride: '#ff3d8a' } },
], 2, 1.6)
