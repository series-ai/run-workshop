import { authoredRecipe } from '../constants/01'

export default authoredRecipe('marker-burst', "Marker burst", "Placement/marker confirmation with a grounded open ring.", [
  { kind: 'ring-field', role: 'aura', opacity: 0.78, scale: 0.86, phase: 'marker-burst-open-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'reticle', colorOverride: '#75b7ff', positionOffset: [0, -0.88, 0] } },
  { kind: 'particles', role: 'impact', opacity: 0.92, scale: 0.58, phase: 'marker-burst-confirm-pips', tuning: { delay: 0.06, window: 0.36, lifeScale: 0.7, blend: 'additive', ramp: 'pinned-hot', death: 'erode', countScale: 0.68, speedScale: 1.1, turbulenceScale: 0.12, sprite: 'sparkle', gravity: 0, size: [0.22, 0.48, 0.14], positionOffset: [0, -0.84, 0], randomizeAzimuth: true } },
], 2, 1.2)
