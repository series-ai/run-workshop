import { authoredRecipe } from '../constants/01'

export default authoredRecipe('target-release', 'Target release', 'Target release with lock flash and reticle snap.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.95, scale: 0.35, phase: 'target-release-launch-flash', tuning: { meshMotion: 'flash', colorOverride: '#d8e8ff' } },
  { kind: 'particles', role: 'impact', opacity: 0.95, scale: 0.5, phase: 'target-release-launch-fan', tuning: { spawnScale: 0.45, motion: 'radial-burst', sprite: 'sparkle', size: [0.35, 0.5, 0.3], colorOverride: '#0080ff', ramp: 'pigment', speedScale: 2.2, speedJitter: 0.15, window: 0.05, lifeScale: 0.4, ease: 'snap', countScale: 0.5, turbulenceScale: 0, gravity: 0, impactVector: [1, 0.3, 0.55], spreadAngle: 0.35, spinScale: 0 } },
  { kind: 'particles', role: 'aura', opacity: 0.7, scale: 0.5, phase: 'target-release-anchor-residue', tuning: { sprite: 'glow', blend: 'alpha', ramp: 'dark', delay: 0.26, window: 0.5, lifeScale: 0.6, speedScale: 0.2, gravity: 0.3, countScale: 0.35, turbulenceScale: 0.3, colorOverride: '#0080ff' } },
], 2, 2.0)
