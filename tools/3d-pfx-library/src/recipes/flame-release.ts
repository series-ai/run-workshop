import { authoredRecipe } from '../constants/01'

export default authoredRecipe('flame-release', 'Flame release', 'Flame release with fire fan and ember tail.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.95, scale: 0.42, phase: 'flame-release-launch-flash', tuning: { meshMotion: 'flash', colorOverride: '#ffd1a8' } },
  { kind: 'particles', role: 'impact', opacity: 0.95, scale: 0.65, phase: 'flame-release-launch-fan', tuning: { spawnScale: 0.45, motion: 'radial-burst', sprite: 'fire', size: [0.55, 0.75, 0.4], colorOverride: '#ff3d00', ramp: 'pigment', speedScale: 2.2, speedJitter: 0.4, window: 0.05, lifeScale: 0.4, ease: 'snap', countScale: 0.85, turbulenceScale: 0, gravity: 0, impactVector: [1, 0.3, 0.55], spreadAngle: 0.35, spinScale: 0, flicker: 1.6 } },
  { kind: 'particles', role: 'aura', opacity: 0.7, scale: 0.5, phase: 'flame-release-anchor-residue', tuning: { sprite: 'smoke', blend: 'alpha', ramp: 'dark', death: 'erode', delay: 0.38, window: 0.45, lifeScale: 0.6, speedScale: 0.3, gravity: 0.5, countScale: 0.35, turbulenceScale: 0.4, colorOverride: '#5a4a42' } },
], 2, 1.9)
