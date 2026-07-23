import { authoredRecipe } from '../constants/01'

export default authoredRecipe('curse-release', 'Curse release', 'Curse release with hex burst and glyph dust.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.95, scale: 0.42, phase: 'curse-release-launch-flash', tuning: { meshMotion: 'flash', colorOverride: '#e8c8ff' } },
  { kind: 'particles', role: 'impact', opacity: 0.95, scale: 0.65, phase: 'curse-release-launch-fan', tuning: { spawnScale: 0.45, motion: 'radial-burst', sprite: 'magic', size: [0.5, 0.65, 0.4], colorOverride: '#9d2bff', ramp: 'pigment', speedScale: 2.2, speedJitter: 0.4, window: 0.05, lifeScale: 0.4, ease: 'snap', countScale: 0.85, turbulenceScale: 0, gravity: 0, impactVector: [1, 0.3, 0.55], spreadAngle: 0.35, spinScale: 0 } },
  { kind: 'particles', role: 'aura', opacity: 0.7, scale: 0.5, phase: 'curse-release-anchor-residue', tuning: { sprite: 'smoke', blend: 'alpha', ramp: 'dark', death: 'erode', delay: 0.26, window: 0.5, lifeScale: 0.6, speedScale: 0.3, gravity: 0.5, countScale: 0.35, turbulenceScale: 0.4, colorOverride: '#4b2a66' } },
], 2, 1.6)
