import { authoredRecipe } from '../constants/01'

export default authoredRecipe('leaf-impact', "Leaf impact", "Organic impact with leaf scatter and tiny ground swirl.", [
  { kind: 'particles', role: 'impact', opacity: 0.7, scale: 0.55, phase: 'leaf-impact-leaf-scatter', tuning: { countScale: 0.3, delay: 0.12, window: 0.14, lifeScale: 0.9, ease: 'snap', turbulenceScale: 0.6, sprite: 'debris', blend: 'alpha', gravity: -0.9, spinScale: 1.4, colorOverride: '#8fd45e', ramp: 'held' } },
  { kind: 'particles', role: 'trail', opacity: 0.7, scale: 0.55, phase: 'leaf-impact-swirl-wake', tuning: { sprite: 'twirl', blend: 'alpha', ramp: 'held', delay: 0.26, window: 0.28, lifeScale: 0.85, countScale: 0.3, speedScale: 0.5, gravity: -0.5, spinScale: 1.2, turbulenceScale: 0.5, death: 'erode', colorOverride: '#8fd45e' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.55, scale: 0.55, phase: 'leaf-impact-ground-eddy', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave', colorOverride: '#6fb843' } },
], 2, 1.4)
