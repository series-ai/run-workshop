import { authoredRecipe } from '../constants/01'

export default authoredRecipe('rune-impact', "Rune impact", "Arcane impact with script flash and letter motes.", [
  { kind: 'ring-field', role: 'aura', opacity: 0.8, scale: 0.7, phase: 'rune-impact-script-flash', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave', colorOverride: '#ffcf6a' } },
  { kind: 'particles', role: 'aura', opacity: 0.95, scale: 0.62, phase: 'rune-impact-letter-motes', tuning: { countScale: 0.55, delay: 0.26, window: 0.28, lifeScale: 0.85, ramp: 'held', death: 'erode', speedScale: 0.25, turbulenceScale: 0.4, sprite: 'rune', gravity: 0.7, spinScale: 0.8, colorOverride: '#ffe2a8', size: [0.55, 0.75, 0.4], spawnLift: 0.2 } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.7, scale: 0.55, phase: 'rune-impact-cast-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave', colorOverride: '#ffcf6a' } },
], 2, 2.0)
