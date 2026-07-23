import { authoredRecipe } from '../constants/01'

export default authoredRecipe('meteor-ring', "Meteor ring", "Cinematic heated ring for meteor landings and boss arena reads.", [
  { kind: 'impact-shards', role: 'body', opacity: 0.96, scale: 1, phase: 'meteor-ring-molten-crater', tuning: { meshGeometry: 'meteor-ring-impact-crater', meshMotion: 'flash', lifecycle: 'meteor-impact-settle', blend: 'alpha', positionOffset: [0, -0.88, 0] } },
  { kind: 'particles', role: 'impact', opacity: 0.94, scale: 1.12, phase: 'meteor-ring-ballistic-ejecta', tuning: { motion: 'meteor-impact', sprite: 'debris', blend: 'alpha', colorOverride: '#ff6a16', ramp: 'pigment', death: 'erode', delay: 0.01, window: 0.7, lifeScale: 0.96, countScale: 0.72, speedScale: 3, speedJitter: 0.38, drag: 0.28, gravity: -2.2, spawnScale: 0.18, spawnLift: 0.08, depthScale: 3.2, stretch: 0.08, spinScale: 1.1, turbulenceScale: 0.04, impactVector: [0, 1, 0], spreadAngle: 1.22, size: [0.11, 0.16, 0.1], positionOffset: [0, -0.88, 0] } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.66, scale: 1.85, phase: 'meteor-ring-heat-front', tuning: { meshGeometry: 'meteor-ring-heat-front', meshMotion: 'shockwave', ringPurpose: 'shockwave', colorOverride: '#ff9b3d', delay: 0.18, window: 0.34, positionOffset: [0, -0.88, 0] } },
], 2, 1.2)
