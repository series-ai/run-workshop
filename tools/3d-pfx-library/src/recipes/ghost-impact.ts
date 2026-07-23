import { authoredRecipe } from '../constants/01'

export default authoredRecipe('ghost-impact', "Ghost impact", "Ethereal hit with spirit puff and faded orbit wisps.", [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.55, scale: 0.48, phase: 'ghost-impact-spirit-puff', tuning: { meshMotion: 'bloom', colorOverride: '#9fd8e8' } },
  { kind: 'particles', role: 'aura', opacity: 1, scale: 0.55, phase: 'ghost-impact-ectoplasm-motes', tuning: { countScale: 0.6, delay: 0.26, window: 0.28, lifeScale: 0.85, ramp: 'held', speedScale: 0.3, turbulenceScale: 0.4, sprite: 'glow', gravity: 0.9, colorOverride: '#eaffff' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.8, scale: 0.55, phase: 'ghost-impact-fade-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave', colorOverride: '#dff6ff' } },
], 2, 1.4)
