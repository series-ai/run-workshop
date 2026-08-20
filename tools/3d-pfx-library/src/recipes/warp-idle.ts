import { authoredRecipe } from '../constants/01'

// Reference (docs/reference-recipes.md Portal idle loop): a breathing swirl
// lens plus inward-spiraling rim motes that shrink as they fall into the core.
export default authoredRecipe('warp-idle', 'Warp idle', 'Warp idle with lens bend and displaced space motes.', [
  { kind: 'core-sphere', role: 'body', opacity: 0.85, scale: 0.55, phase: 'warp-idle-lens-bend', tuning: { meshShader: 'vortex-swirl', meshMotion: 'breathe', colorOverride: '#2f8fe8' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'warp-idle-displaced-motes', tuning: { sprite: 'twinkle', blend: 'additive', size: [0.34, 0.5, 0.2], colorOverride: '#7fb8f2', ramp: 'held', countScale: 0.32, speedScale: 0.6, speedJitter: 0.2, turbulenceScale: 0.15, motion: 'spherical-converge', gravity: 0, drag: 1.5, spinScale: 0 } },
], 2, 0.81)
