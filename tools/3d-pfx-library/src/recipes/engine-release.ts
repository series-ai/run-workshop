import { authoredRecipe } from '../constants/01'

export default authoredRecipe('engine-release', 'Engine release', 'Engine release with heat vent and carbon flecks.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.95, scale: 0.42, phase: 'engine-release-launch-flash', tuning: { meshMotion: 'flash', colorOverride: '#e8e8e8' } },
  { kind: 'particles', role: 'impact', opacity: 0.95, scale: 0.65, phase: 'engine-release-launch-fan', tuning: { spawnScale: 0.45, motion: 'radial-burst', sprite: 'debris', size: [0.45, 0.55, 0.3], colorOverride: '#5a7ba8', ramp: 'dark', speedScale: 2.2, speedJitter: 0.4, window: 0.05, lifeScale: 0.4, ease: 'snap', countScale: 0.85, turbulenceScale: 0, gravity: -1.5, impactVector: [1, 0.3, 0.55], spreadAngle: 0.35, spinScale: 0, blend: 'alpha' } },
  { kind: 'particles', role: 'aura', opacity: 0.7, scale: 0.5, phase: 'engine-release-anchor-residue', tuning: { sprite: 'smoke', blend: 'alpha', ramp: 'dark', death: 'erode', delay: 0.32, window: 0.55, lifeScale: 0.6, speedScale: 0.3, gravity: 0.5, countScale: 0.35, turbulenceScale: 0.4, colorOverride: '#5a5a5a' } },
], 2, 1.8)
