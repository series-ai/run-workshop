import { authoredRecipe } from '../constants/01'

export default authoredRecipe('sand-release', 'Sand release', 'Sand release with grain burst and low haze.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.95, scale: 0.42, phase: 'sand-release-launch-flash', tuning: { meshMotion: 'flash', colorOverride: '#f0e0c0' } },
  { kind: 'particles', role: 'impact', opacity: 0.95, scale: 0.65, phase: 'sand-release-launch-fan', tuning: { spawnScale: 0.45, motion: 'radial-burst', sprite: 'debris', size: [0.45, 0.55, 0.3], colorOverride: '#c28a26', ramp: 'pigment', speedScale: 2.2, speedJitter: 0.4, window: 0.05, lifeScale: 0.4, ease: 'snap', countScale: 0.85, turbulenceScale: 0, gravity: -3, impactVector: [1, 0.3, 0.55], spreadAngle: 0.35, spinScale: 0.9, blend: 'alpha' } },
  { kind: 'particles', role: 'aura', opacity: 0.7, scale: 0.5, phase: 'sand-release-anchor-residue', tuning: { sprite: 'soft', blend: 'alpha', ramp: 'pigment', death: 'erode', delay: 0.26, window: 0.5, lifeScale: 0.6, speedScale: 0.25, gravity: 0.3, countScale: 0.35, turbulenceScale: 0.4, colorOverride: '#c28a26' } },
], 2, 1.9)
