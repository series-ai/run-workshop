import { authoredRecipe } from '../constants/01'

export default authoredRecipe('blood-impact', "Blood impact", "Organic hit splatter with droplet flecks and compact ring.", [
  { kind: 'particles', role: 'impact', opacity: 0.7, scale: 0.55, phase: 'blood-impact-splatter-fan', tuning: { countScale: 0.3, delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0, sprite: 'splat', blend: 'alpha', ramp: 'pigment', colorOverride: '#e02535', spinScale: 0.5, gravity: -3, death: 'erode', impactVector: [1, 0.3, 0], spreadAngle: 0.7 } },
  { kind: 'cloud-volume', role: 'volume', opacity: 0.4, scale: 0.34, phase: 'blood-impact-mist-pop', tuning: { meshMotion: 'bloom', blend: 'alpha', colorOverride: '#8a2430' } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.55, scale: 0.55, phase: 'blood-impact-contact-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave', colorOverride: '#b5121f' } },
], 2, 2.0)
