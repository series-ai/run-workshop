import { authoredRecipe } from '../constants/01'

export default authoredRecipe('glyph-release', 'Glyph release', 'Glyph release with symbol flare and arcane dust.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.95, scale: 0.42, phase: 'glyph-release-launch-flash', tuning: { meshMotion: 'flash', colorOverride: '#fff2c0' } },
  { kind: 'particles', role: 'impact', opacity: 0.95, scale: 0.65, phase: 'glyph-release-launch-fan', tuning: { spawnScale: 0.45, motion: 'radial-burst', sprite: 'magic', size: [0.5, 0.65, 0.4], colorOverride: '#ffb300', ramp: 'pigment', speedScale: 2.2, speedJitter: 0.15, window: 0.05, lifeScale: 0.4, ease: 'snap', countScale: 0.85, turbulenceScale: 0, gravity: 0, impactVector: [1, 0.3, 0.55], spreadAngle: 0.35, spinScale: 0 } },
  { kind: 'particles', role: 'aura', opacity: 0.7, scale: 0.5, phase: 'glyph-release-anchor-residue', tuning: { sprite: 'sparkle', ramp: 'pigment', delay: 0.38, window: 0.45, lifeScale: 0.6, speedScale: 0.25, gravity: 0.6, countScale: 0.35, turbulenceScale: 0.2, colorOverride: '#ffb300' } },
], 2, 1.8)
