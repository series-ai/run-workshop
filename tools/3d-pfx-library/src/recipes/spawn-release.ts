import { authoredRecipe } from '../constants/01'

export default authoredRecipe('spawn-release', 'Spawn release', 'Spawn release with origin pop and ready motes.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.95, scale: 0.42, phase: 'spawn-release-launch-flash', tuning: { meshMotion: 'flash', colorOverride: '#d8e8ff' } },
  { kind: 'particles', role: 'impact', opacity: 0.95, scale: 0.65, phase: 'spawn-release-launch-fan', tuning: { spawnScale: 0.45, motion: 'radial-burst', sprite: 'sparkle', size: [0.35, 0.5, 0.3], colorOverride: '#0077ff', ramp: 'pigment', speedScale: 2.2, speedJitter: 0.15, window: 0.05, lifeScale: 0.4, ease: 'snap', countScale: 0.85, turbulenceScale: 0, gravity: 0, impactVector: [1, 0.3, 0.55], spreadAngle: 0.35, spinScale: 0 } },
  { kind: 'particles', role: 'aura', opacity: 0.7, scale: 0.5, phase: 'spawn-release-anchor-residue', tuning: { sprite: 'sparkle', ramp: 'pigment', delay: 0.32, window: 0.55, lifeScale: 0.6, speedScale: 0.25, gravity: 0.6, countScale: 0.35, turbulenceScale: 0.2, colorOverride: '#0077ff' } },
], 2, 1.8)
