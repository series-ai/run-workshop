import { authoredRecipe } from '../constants/01'

export default authoredRecipe('bubble-release', 'Bubble release', 'Bubble release with pop chain and foam pips.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.95, scale: 0.42, phase: 'bubble-release-launch-flash', tuning: { meshMotion: 'flash', colorOverride: '#d8f0ff' } },
  { kind: 'particles', role: 'impact', opacity: 0.95, scale: 0.65, phase: 'bubble-release-launch-fan', tuning: { spawnScale: 0.45, motion: 'radial-burst', sprite: 'soft', size: [0.4, 0.55, 0.35], colorOverride: '#00a8f0', ramp: 'pigment', speedScale: 2.2, speedJitter: 0.4, window: 0.05, lifeScale: 0.4, ease: 'snap', countScale: 0.85, turbulenceScale: 0, gravity: 0.8, impactVector: [1, 0.3, 0.55], spreadAngle: 0.35, spinScale: 0 } },
  { kind: 'particles', role: 'aura', opacity: 0.7, scale: 0.5, phase: 'bubble-release-anchor-residue', tuning: { sprite: 'sparkle', ramp: 'pigment', delay: 0.26, window: 0.5, lifeScale: 0.6, speedScale: 0.25, gravity: 0.6, countScale: 0.35, turbulenceScale: 0.2, colorOverride: '#00a8f0' } },
], 2, 1.8)
