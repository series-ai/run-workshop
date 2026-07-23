import { authoredRecipe } from '../constants/01'

export default authoredRecipe('curse-impact', "Curse impact", "Hexed impact with fracture flash and smoky glyph dust.", [
  { kind: 'impact-sparks', role: 'impact', opacity: 0.9, scale: 0.6, phase: 'curse-impact-hex-fracture', tuning: { window: 0.14, lifeScale: 0.58, ease: 'snap', ramp: 'held', spinScale: 0, turbulenceScale: 0, sprite: 'magic', colorOverride: '#d8a8ff', delay: 0.12, countScale: 0.5 } },
  { kind: 'cloud-volume', role: 'volume', opacity: 0.55, scale: 0.42, phase: 'curse-impact-hex-smoke', tuning: { meshMotion: 'bloom', blend: 'alpha', colorOverride: '#5a3a78' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.75, scale: 0.65, phase: 'curse-impact-mark-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave', colorOverride: '#a355f5' } },
], 2, 1.7)
