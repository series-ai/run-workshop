import { authoredRecipe } from '../constants/01'

export default authoredRecipe('blood-release', 'Blood release', 'Blood release with droplet spray and pulse mist.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.95, scale: 0.42, phase: 'blood-release-launch-flash', tuning: { meshMotion: 'flash', colorOverride: '#ffb8b8' } },
  { kind: 'particles', role: 'impact', opacity: 0.95, scale: 0.65, phase: 'blood-release-launch-fan', tuning: { spawnScale: 0.45, motion: 'radial-burst', sprite: 'splat', size: [0.55, 0.75, 0.4], colorOverride: '#a80d18', ramp: 'pigment', speedScale: 2.2, speedJitter: 0.65, window: 0.05, lifeScale: 0.4, ease: 'snap', countScale: 0.85, turbulenceScale: 0, gravity: -2.5, impactVector: [1, 0.3, 0.55], spreadAngle: 0.35, spinScale: 0.85, blend: 'alpha' } },
  { kind: 'particles', role: 'aura', opacity: 0.7, scale: 0.5, phase: 'blood-release-anchor-residue', tuning: { sprite: 'glow', blend: 'alpha', ramp: 'dark', delay: 0.38, window: 0.45, lifeScale: 0.6, speedScale: 0.2, gravity: 0.3, countScale: 0.35, turbulenceScale: 0.3, colorOverride: '#a80d18' } },
], 2, 2.0)
