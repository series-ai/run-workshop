import { authoredRecipe } from '../constants/01'

export default authoredRecipe('parry-trail', 'Parry trail', 'Timing trail with ready star ticks and a compact ribbon.', [
  { kind: 'trail-ribbon', role: 'trail', opacity: 0.95, scale: 1.1, phase: 'parry-trail-blade-arc', tuning: { meshShader: 'arc-sweep', colorOverride: '#ffb300' } },
  { kind: 'impact-sparks', role: 'impact', opacity: 0.85, scale: 1, phase: 'parry-trail-edge-sparks', tuning: { sprite: 'streak', stretch: 5, speedScale: 0.9, drag: 4, size: [0.6, 0.45, 0.14], countScale: 0.7, lifeScale: 0.45, spinScale: 0, ramp: 'pinned-hot', bands: 2, ease: 'snap', colorOverride: '#fff6d8', delay: 0.06, window: 0.14, turbulenceScale: 0, spawnOffset: [0.38, 0.59, -0.24], spawnScale: 0.25, impactVector: [-0.96, 0.27, 0.2], spreadAngle: 0.55, positionOffset: [0, 0.9, -0.2] } },
], 2, 2.2)
