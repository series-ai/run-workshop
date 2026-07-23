import { authoredRecipe } from '../constants/01'

export default authoredRecipe('portal-loop', 'Portal loop', 'Persistent portal with vortex rim, interior window, and orbiting motes.', [
  { kind: 'core-sphere', role: 'body', opacity: 0.9, scale: 0.6, phase: 'portal-loop-vortex-disc', tuning: { meshShader: 'vortex-swirl', colorOverride: '#7a1fff' } },
  { kind: 'particles', role: 'aura', opacity: 0.75, scale: 0.6, phase: 'portal-loop-orbit-motes', tuning: { motion: 'orbit-ring', sprite: 'magic', size: [0.26, 0.38, 0.35], colorOverride: '#9d2bff', ramp: 'held', countScale: 0.18, speedScale: 0.55, speedJitter: 0.2, spinScale: 0, turbulenceScale: 0.2, gravity: 0 } },
  { kind: 'ring-field', role: 'aura', opacity: 0.85, scale: 0.72, phase: 'portal-loop-ground-circle', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#7a1fff' } },
], 2, 0.95)
