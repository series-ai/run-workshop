import { authoredRecipe } from '../constants/01'

export default authoredRecipe('leaf-release', 'Leaf release', 'Leaf release with canopy scatter and green eddy.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.95, scale: 0.42, phase: 'leaf-release-launch-flash', tuning: { meshMotion: 'flash', colorOverride: '#d8ffc8' } },
  { kind: 'particles', role: 'impact', opacity: 0.95, scale: 0.65, phase: 'leaf-release-launch-fan', tuning: { spawnScale: 0.45, motion: 'radial-burst', sprite: 'debris', size: [0.45, 0.55, 0.3], colorOverride: '#3fb800', ramp: 'pigment', speedScale: 2.2, speedJitter: 0.4, window: 0.05, lifeScale: 0.4, ease: 'snap', countScale: 0.85, turbulenceScale: 0.5, gravity: -0.8, impactVector: [1, 0.3, 0.55], spreadAngle: 0.35, spinScale: 1.3, blend: 'alpha' } },
  { kind: 'particles', role: 'aura', opacity: 0.7, scale: 0.5, phase: 'leaf-release-anchor-residue', tuning: { sprite: 'glow', blend: 'alpha', ramp: 'dark', delay: 0.32, window: 0.55, lifeScale: 0.6, speedScale: 0.2, gravity: 0.3, countScale: 0.35, turbulenceScale: 0.3, colorOverride: '#3fb800' } },
], 2, 1.7)
