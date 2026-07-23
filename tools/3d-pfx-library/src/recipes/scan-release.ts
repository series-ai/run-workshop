import { authoredRecipe } from '../constants/01'

export default authoredRecipe('scan-release', 'Scan release', 'Scan release with data burst and sampled points.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.95, scale: 0.35, phase: 'scan-release-launch-flash', tuning: { meshMotion: 'flash', colorOverride: '#d8fff0' } },
  { kind: 'particles', role: 'impact', opacity: 0.95, scale: 0.5, phase: 'scan-release-launch-fan', tuning: { spawnScale: 0.45, motion: 'radial-burst', sprite: 'sparkle', size: [0.35, 0.5, 0.3], colorOverride: '#00d9b0', ramp: 'pigment', speedScale: 2.2, speedJitter: 0.15, window: 0.05, lifeScale: 0.4, ease: 'snap', countScale: 0.5, turbulenceScale: 0, gravity: 0, impactVector: [1, 0.3, 0.55], spreadAngle: 0.35, spinScale: 0, flicker: 0.8 } },
  { kind: 'particles', role: 'aura', opacity: 0.7, scale: 0.5, phase: 'scan-release-anchor-residue', tuning: { sprite: 'glow', blend: 'alpha', ramp: 'dark', delay: 0.38, window: 0.45, lifeScale: 0.6, speedScale: 0.2, gravity: 0.3, countScale: 0.35, turbulenceScale: 0.3, colorOverride: '#00d9b0' } },
], 2, 2.0)
