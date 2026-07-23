import { authoredRecipe } from '../constants/01'

export default authoredRecipe('poison-impact', "Poison impact", "Toxic contact puff with sickly motes and hazard ring.", [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.4, scale: 0.5, phase: 'poison-impact-toxic-puff', tuning: { meshMotion: 'bloom', blend: 'alpha', colorOverride: '#3f7a2a' } },
  { kind: 'particles', role: 'volume', opacity: 0.9, scale: 0.55, phase: 'poison-impact-spore-motes', tuning: { countScale: 0.5, delay: 0.26, window: 0.28, lifeScale: 0.85, ramp: 'held', death: 'erode', speedScale: 0.5, turbulenceScale: 0.4, sprite: 'glow', gravity: 0.7, flicker: 0.8, colorOverride: '#8aff4d' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.7, scale: 0.55, phase: 'poison-impact-hazard-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave', colorOverride: '#4fc02a' } },
], 2, 1.5)
