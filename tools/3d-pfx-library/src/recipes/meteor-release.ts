import { authoredRecipe } from '../constants/01'

export default authoredRecipe('meteor-release', 'Meteor release', 'Meteor release with molten burst and pressure ring.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.95, scale: 0.65, phase: 'meteor-release-launch-flash', tuning: { meshMotion: 'flash', colorOverride: '#ffd1a8' } },
  { kind: 'particles', role: 'impact', opacity: 0.95, scale: 0.78, phase: 'meteor-release-launch-fan', tuning: { spawnScale: 0.45, motion: 'radial-burst', sprite: 'fire', size: [0.55, 0.75, 0.4], colorOverride: '#ff3d00', ramp: 'pigment', speedScale: 2.2, speedJitter: 0.4, window: 0.05, lifeScale: 0.4, ease: 'snap', countScale: 1.0, turbulenceScale: 0, gravity: 0, impactVector: [1, 0.3, 0.55], spreadAngle: 0.35, spinScale: 0, flicker: 1.5 } },
  { kind: 'particles', role: 'impact', opacity: 0.7, scale: 0.45, phase: 'meteor-release-backblast', tuning: { motion: 'radial-burst', sprite: 'glow', impactVector: [-1, 0.25, 0], spreadAngle: 0.8, speedScale: 1.2, delay: 0.03, window: 0.1, lifeScale: 0.3, ease: 'snap', colorOverride: '#ff3d00', ramp: 'pigment', countScale: 0.25, turbulenceScale: 0, gravity: -2 } },
  { kind: 'particles', role: 'aura', opacity: 0.7, scale: 0.5, phase: 'meteor-release-anchor-residue', tuning: { sprite: 'smoke', blend: 'alpha', ramp: 'dark', death: 'erode', delay: 0.26, window: 0.5, lifeScale: 0.6, speedScale: 0.3, gravity: 0.5, countScale: 0.35, turbulenceScale: 0.4, colorOverride: '#5a4a42' } },
], 2, 1.4)
