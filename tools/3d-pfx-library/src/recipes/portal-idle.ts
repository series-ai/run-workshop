import { authoredRecipe } from '../constants/01'

export default authoredRecipe('portal-idle', 'Portal idle', 'Portal mouth idle with vortex ring and spiral dust.', [
  { kind: 'core-sphere', role: 'body', opacity: 0.8, scale: 0.5, phase: 'portal-idle-vortex-disc', tuning: { meshShader: 'vortex-swirl', colorOverride: '#7a1fff' } },
  { kind: 'particles', role: 'aura', opacity: 0.7, scale: 0.55, phase: 'portal-idle-orbit-motes', tuning: { motion: 'orbit-ring', sprite: 'magic', size: [0.24, 0.34, 0.3], colorOverride: '#9d2bff', ramp: 'held', countScale: 0.14, speedScale: 0.5, speedJitter: 0.2, spinScale: 0, turbulenceScale: 0.2, gravity: 0 } },
], 2, 0.8)
