import { authoredRecipe } from '../constants/01'

export default authoredRecipe('portal-release', 'Portal release', 'Portal release with vortex flare and arrival dust.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.95, scale: 0.42, phase: 'portal-release-launch-flash', tuning: { meshMotion: 'flash', colorOverride: '#e8c8ff' } },
  { kind: 'particles', role: 'impact', opacity: 0.95, scale: 0.65, phase: 'portal-release-launch-fan', tuning: { spawnScale: 0.45, motion: 'radial-burst', sprite: 'magic', size: [0.5, 0.65, 0.4], colorOverride: '#7a1fff', ramp: 'pigment', speedScale: 2.2, speedJitter: 0.4, window: 0.05, lifeScale: 0.4, ease: 'snap', countScale: 0.85, turbulenceScale: 0, gravity: 0, impactVector: [1, 0.3, 0.55], spreadAngle: 0.35, spinScale: 0 } },
  { kind: 'particles', role: 'impact', opacity: 0.7, scale: 0.45, phase: 'portal-release-backblast', tuning: { motion: 'radial-burst', sprite: 'glow', impactVector: [-1, 0.25, 0], spreadAngle: 0.8, speedScale: 1.2, delay: 0.03, window: 0.1, lifeScale: 0.3, ease: 'snap', colorOverride: '#7a1fff', ramp: 'pigment', countScale: 0.25, turbulenceScale: 0, gravity: -2 } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.6, scale: 0.6, phase: 'portal-release-departure-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave', colorOverride: '#7a1fff' } },
  { kind: 'particles', role: 'aura', opacity: 0.7, scale: 0.5, phase: 'portal-release-anchor-residue', tuning: { sprite: 'sparkle', ramp: 'pigment', delay: 0.32, window: 0.55, lifeScale: 0.6, speedScale: 0.25, gravity: 0.6, countScale: 0.35, turbulenceScale: 0.2, colorOverride: '#7a1fff' } },
], 2, 1.4)
