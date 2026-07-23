import { authoredRecipe } from '../constants/01'

export default authoredRecipe('slime-impact', "Slime impact", "Elastic slime contact with blob pop and sticky orbit beads.", [
  { kind: 'core-sphere', role: 'body', opacity: 0.6, scale: 0.26, phase: 'slime-impact-blob-pop', tuning: { sprite: 'splat', spinScale: 0.5, countScale: 0.3, gravity: -1.8, colorOverride: '#39dd4b', death: 'erode' } },
  { kind: 'particles', role: 'impact', opacity: 0.48, scale: 0.5, phase: 'slime-impact-sticky-beads', tuning: { countScale: 0.3, delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0, sprite: 'soft', blend: 'alpha', gravity: -1.4 } },
  { kind: 'ring-field', role: 'aura', opacity: 0.45, scale: 0.55, phase: 'slime-impact-elastic-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
], 2, 1.5)
