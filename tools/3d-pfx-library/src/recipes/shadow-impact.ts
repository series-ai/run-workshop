import { authoredRecipe } from '../constants/01'

export default authoredRecipe('shadow-impact', "Shadow impact", "Dark contact smear with void wisps and occlusion ring.", [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.32, scale: 0.5, phase: 'shadow-impact-void-smear', tuning: { meshMotion: 'bloom', blend: 'alpha', sprite: 'twirl', ramp: 'dark', gravity: 0.5, spinScale: 0.6, colorOverride: '#3a2b52' } },
  { kind: 'particles', role: 'trail', opacity: 0.65, scale: 0.55, phase: 'shadow-impact-ink-wake', tuning: { sprite: 'twirl', blend: 'alpha', ramp: 'dark', delay: 0.26, window: 0.28, lifeScale: 0.85, countScale: 0.3, speedScale: 0.5, gravity: 0.4, spinScale: 0.6, turbulenceScale: 0.4, death: 'erode', colorOverride: '#6a4bb0' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.75, scale: 0.6, phase: 'shadow-impact-occlusion-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave', colorOverride: '#8a5cf0' } },
], 2, 1.4)
