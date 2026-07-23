import { authoredRecipe } from '../constants/01'

export default authoredRecipe('meteor-impact', "Meteor impact", "Molten impact with core read, cinders, and pressure ring.", [
  { kind: 'core-sphere', role: 'impact', opacity: 0.5, scale: 1.1, phase: 'meteor-impact-contrast-shadow', tuning: { meshMotion: 'flash', blend: 'alpha', colorOverride: '#0b0812' } },
  { kind: 'core-sphere', role: 'body', opacity: 0.6, scale: 0.5, phase: 'meteor-impact-molten-core', tuning: { meshMotion: 'flash' } },
  { kind: 'particles', role: 'impact', opacity: 0.62, scale: 0.62, phase: 'meteor-impact-cinder-burst', tuning: { window: 0.2, lifeScale: 0.8, ease: 'snap', ramp: 'held', spinScale: 1.2, turbulenceScale: 0, sprite: 'fire', gravity: -1.4, delay: 0.14 } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.45, scale: 0.72, phase: 'meteor-impact-pressure-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
], 2, 1.4)
