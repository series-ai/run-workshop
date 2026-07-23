import { authoredRecipe } from '../constants/01'

export default authoredRecipe('rune-release', 'Rune release', 'Rune release with script flash and letter motes.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.95, scale: 0.42, phase: 'rune-release-launch-flash', tuning: { meshMotion: 'flash', colorOverride: '#fff2c0' } },
  { kind: 'particles', role: 'impact', opacity: 0.95, scale: 0.65, phase: 'rune-release-launch-fan', tuning: { spawnScale: 0.45, motion: 'radial-burst', sprite: 'rune', size: [0.5, 0.65, 0.4], colorOverride: '#ffa200', ramp: 'pigment', speedScale: 2.2, speedJitter: 0.15, window: 0.05, lifeScale: 0.4, ease: 'snap', countScale: 0.85, turbulenceScale: 0, gravity: 0, impactVector: [1, 0.3, 0.55], spreadAngle: 0.35, spinScale: 0 } },
  { kind: 'particles', role: 'aura', opacity: 0.7, scale: 0.5, phase: 'rune-release-anchor-residue', tuning: { sprite: 'sparkle', ramp: 'pigment', delay: 0.32, window: 0.55, lifeScale: 0.6, speedScale: 0.25, gravity: 0.6, countScale: 0.35, turbulenceScale: 0.2, colorOverride: '#ffa200' } },
], 2, 1.8)
