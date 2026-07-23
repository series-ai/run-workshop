import { authoredRecipe } from '../constants/01'

export default authoredRecipe('thruster-release', 'Thruster release', 'Thruster release with ignition blast and flame points.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.95, scale: 0.42, phase: 'thruster-release-launch-flash', tuning: { meshMotion: 'flash', colorOverride: '#ffd1a8' } },
  { kind: 'particles', role: 'impact', opacity: 0.95, scale: 0.65, phase: 'thruster-release-launch-fan', tuning: { spawnScale: 0.45, motion: 'radial-burst', sprite: 'glow', size: [0.35, 0.5, 0.3], colorOverride: '#ff6a00', ramp: 'pigment', speedScale: 2.2, speedJitter: 0.4, window: 0.05, lifeScale: 0.4, ease: 'snap', countScale: 0.85, turbulenceScale: 0, gravity: 0, impactVector: [0, -1, 0], spreadAngle: 0.35, spinScale: 0, flicker: 1.4 } },
  { kind: 'particles', role: 'aura', opacity: 0.7, scale: 0.5, phase: 'thruster-release-anchor-residue', tuning: { sprite: 'smoke', blend: 'alpha', ramp: 'dark', death: 'erode', delay: 0.38, window: 0.45, lifeScale: 0.6, speedScale: 0.3, gravity: 0.5, countScale: 0.35, turbulenceScale: 0.4, colorOverride: '#5a5a5a' } },
], 2, 1.9)
