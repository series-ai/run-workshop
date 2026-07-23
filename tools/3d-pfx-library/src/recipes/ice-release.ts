import { authoredRecipe } from '../constants/01'

export default authoredRecipe('ice-release', 'Ice release', 'Ice release with crystal burst and freezing mist.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.95, scale: 0.42, phase: 'ice-release-launch-flash', tuning: { meshMotion: 'flash', colorOverride: '#d8f0ff' } },
  { kind: 'particles', role: 'impact', opacity: 0.95, scale: 0.65, phase: 'ice-release-launch-fan', tuning: { spawnScale: 0.45, motion: 'radial-burst', sprite: 'twirl', size: [0.45, 0.6, 0.35], colorOverride: '#009dff', ramp: 'pigment', speedScale: 2.2, speedJitter: 0.4, window: 0.05, lifeScale: 0.4, ease: 'snap', countScale: 0.85, turbulenceScale: 0, gravity: -2, impactVector: [1, 0.3, 0.55], spreadAngle: 0.35, spinScale: 0.9, blend: 'alpha' } },
  { kind: 'particles', role: 'aura', opacity: 0.7, scale: 0.5, phase: 'ice-release-anchor-residue', tuning: { sprite: 'soft', blend: 'alpha', ramp: 'pigment', death: 'erode', delay: 0.26, window: 0.5, lifeScale: 0.6, speedScale: 0.25, gravity: 0.3, countScale: 0.35, turbulenceScale: 0.4, colorOverride: '#009dff' } },
], 2, 2.0)
