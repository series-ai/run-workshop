import { authoredRecipe } from '../constants/01'

export default authoredRecipe('water-release', 'Water release', 'Water release with splash crown and mist breath.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.95, scale: 0.42, phase: 'water-release-launch-flash', tuning: { meshMotion: 'flash', colorOverride: '#d8f0ff' } },
  { kind: 'particles', role: 'impact', opacity: 0.95, scale: 0.65, phase: 'water-release-launch-fan', tuning: { spawnScale: 0.45, motion: 'radial-burst', sprite: 'soft', size: [0.4, 0.55, 0.35], colorOverride: '#0095ff', ramp: 'pigment', speedScale: 2.2, speedJitter: 0.4, window: 0.05, lifeScale: 0.4, ease: 'snap', countScale: 0.85, turbulenceScale: 0, gravity: -1.5, impactVector: [1, 0.3, 0.55], spreadAngle: 0.35, spinScale: 0 } },
  { kind: 'particles', role: 'aura', opacity: 0.7, scale: 0.5, phase: 'water-release-anchor-residue', tuning: { sprite: 'soft', blend: 'alpha', ramp: 'pigment', death: 'erode', delay: 0.38, window: 0.45, lifeScale: 0.6, speedScale: 0.25, gravity: 0.3, countScale: 0.35, turbulenceScale: 0.4, colorOverride: '#0095ff' } },
], 2, 2.0)
