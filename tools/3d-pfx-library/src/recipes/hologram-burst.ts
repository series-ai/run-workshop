import { authoredRecipe } from '../constants/01'

export default authoredRecipe('hologram-burst', "Hologram burst", "Projection glitch burst for sci-fi reveals, damage, and UI-world transitions.", [
  { kind: 'screen-plane', role: 'screen', opacity: 0.6, scale: 0.42, phase: 'hologram-burst-projection-flash', tuning: { meshMotion: 'flash' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.42, scale: 0.64, phase: 'hologram-burst-scan-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  { kind: 'particles', role: 'aura', opacity: 0.46, scale: 0.48, phase: 'hologram-burst-voxel-noise', tuning: { delay: 0.26, window: 0.28, lifeScale: 0.6, blend: 'alpha', ramp: 'dark', death: 'erode', countScale: 0.3, speedScale: 0.5, turbulenceScale: 0.4, sprite: 'sparkle', gravity: 0.4, flicker: 1.4 } },
], 2, 1.25)
