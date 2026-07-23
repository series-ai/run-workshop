import { authoredRecipe } from '../constants/01'

export default authoredRecipe('warning-release', 'Warning release', 'Warning release with alert flare and urgency ticks.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.95, scale: 0.35, phase: 'warning-release-launch-flash', tuning: { meshMotion: 'flash', colorOverride: '#ffd8b8' } },
  { kind: 'particles', role: 'impact', opacity: 0.95, scale: 0.5, phase: 'warning-release-launch-fan', tuning: { spawnScale: 0.45, motion: 'radial-burst', sprite: 'glow', size: [0.35, 0.5, 0.3], colorOverride: '#ff5500', ramp: 'pigment', speedScale: 2.2, speedJitter: 0.4, window: 0.05, lifeScale: 0.4, ease: 'snap', countScale: 0.5, turbulenceScale: 0, gravity: 0, impactVector: [1, 0.3, 0.55], spreadAngle: 0.35, spinScale: 0, flicker: 1.2 } },
  { kind: 'particles', role: 'aura', opacity: 0.7, scale: 0.5, phase: 'warning-release-anchor-residue', tuning: { sprite: 'glow', blend: 'alpha', ramp: 'dark', delay: 0.32, window: 0.55, lifeScale: 0.6, speedScale: 0.2, gravity: 0.3, countScale: 0.35, turbulenceScale: 0.3, colorOverride: '#ff5500' } },
], 2, 1.9)
