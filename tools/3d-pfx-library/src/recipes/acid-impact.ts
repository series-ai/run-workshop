import { authoredRecipe } from '../constants/01'

export default authoredRecipe('acid-impact', "Acid impact", "Corrosive spit impact with sizzling specks and thin ring.", [
  { kind: 'particles', role: 'impact', opacity: 0.56, scale: 0.5, phase: 'acid-impact-corrosive-spit', tuning: { countScale: 0.3, delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0, sprite: 'splat', spinScale: 0.5, gravity: -2, colorOverride: '#39dd4b', death: 'erode' } },
  { kind: 'cloud-volume', role: 'volume', opacity: 0.32, scale: 0.38, phase: 'acid-impact-vapor-wisp', tuning: { meshMotion: 'bloom', blend: 'alpha' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.45, scale: 0.55, phase: 'acid-impact-etch-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
], 2, 1.9)
