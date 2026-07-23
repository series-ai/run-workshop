import { authoredRecipe } from '../constants/01'

export default authoredRecipe('frost-release', 'Frost release', 'Frost release with chill bloom and snow motes.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.95, scale: 0.42, phase: 'frost-release-launch-flash', tuning: { meshMotion: 'flash', colorOverride: '#d8f0ff' } },
  { kind: 'particles', role: 'impact', opacity: 0.95, scale: 0.65, phase: 'frost-release-launch-fan', tuning: { spawnScale: 0.45, motion: 'radial-burst', sprite: 'sparkle', size: [0.35, 0.5, 0.3], colorOverride: '#00aaff', ramp: 'pigment', speedScale: 2.2, speedJitter: 0.4, window: 0.05, lifeScale: 0.4, ease: 'snap', countScale: 0.85, turbulenceScale: 0, gravity: 0, impactVector: [1, 0.3, 0.55], spreadAngle: 0.35, spinScale: 0, blend: 'alpha' } },
  { kind: 'particles', role: 'aura', opacity: 0.7, scale: 0.5, phase: 'frost-release-anchor-residue', tuning: { sprite: 'soft', blend: 'alpha', ramp: 'pigment', death: 'erode', delay: 0.32, window: 0.55, lifeScale: 0.6, speedScale: 0.25, gravity: 0.3, countScale: 0.35, turbulenceScale: 0.4, colorOverride: '#00aaff' } },
], 2, 1.9)
