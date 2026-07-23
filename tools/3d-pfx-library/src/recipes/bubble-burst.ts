import { authoredRecipe } from '../constants/01'

export default authoredRecipe('bubble-burst', "Bubble burst", "Light water/aquatic burst for pickups, ambience, and impacts.", [
  { kind: 'bubble-shells', role: 'body', opacity: 0.72, scale: 0.7, phase: 'bubble-burst-pop-cluster', tuning: { meshShader: 'fresnel-shell', meshMotion: 'bloom', colorIndex: 0 } },
  { kind: 'ring-field', role: 'aura', opacity: 0.5, scale: 0.58, phase: 'bubble-burst-pop-wave', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  { kind: 'particles', role: 'volume', opacity: 0.3, scale: 0.5, phase: 'bubble-burst-water-haze', tuning: { sprite: 'puff', blend: 'alpha', delay: 0.26, window: 0.28, countScale: 0.25, speedScale: 0.4, gravity: 0.4, drag: 1.6, size: [0.6, 0.9, 1.05], ramp: 'dark', lifeScale: 0.85, death: 'erode', turbulenceScale: 0.4 } },
], 2, 1.2)
