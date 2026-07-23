import { authoredRecipe } from '../constants/01'

export default authoredRecipe('hologram-impact', "Hologram impact", "Projection hit glitch with scan fragments and voxel dust.", [
  { kind: 'screen-plane', role: 'screen', opacity: 0.6, scale: 0.26, phase: 'hologram-impact-projection-glitch', tuning: { meshMotion: 'flash' } },
  { kind: 'particles', role: 'aura', opacity: 0.44, scale: 0.5, phase: 'hologram-impact-voxel-dust', tuning: { countScale: 0.23, delay: 0.26, window: 0.28, lifeScale: 0.85, blend: 'alpha', ramp: 'dark', death: 'erode', speedScale: 0.5, turbulenceScale: 0.4, sprite: 'sparkle', gravity: 0.4, flicker: 1.4 } },
  { kind: 'ring-field', role: 'aura', opacity: 0.45, scale: 0.55, phase: 'hologram-impact-scan-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
], 2, 2.2)
