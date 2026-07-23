import { authoredRecipe } from '../constants/01'

export default authoredRecipe('shield-impact', "Shield impact", "Defensive contact ripple with shell flare and deflection flecks.", [
  { kind: 'ring-field', role: 'aura', opacity: 0.45, scale: 0.56, phase: 'shield-impact-shell-wave', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  { kind: 'impact-sparks', role: 'impact', opacity: 0.6, scale: 0.5, phase: 'shield-impact-deflect-flecks', tuning: { window: 0.28, lifeScale: 0.85, ease: 'snap', ramp: 'held', spinScale: 0, turbulenceScale: 0, sprite: 'glow', gravity: 0, impactVector: [1, 0.5, 0], spreadAngle: 0.6, delay: 0.26 } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.45, scale: 0.55, phase: 'shield-impact-contact-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
], 2, 2.0)
