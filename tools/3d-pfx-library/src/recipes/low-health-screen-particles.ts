import { authoredRecipe } from '../constants/01'

// Screen spec: damage DARKENS (alpha/dark family, never luminous red);
// center stays clear — specks live at the frame edge; heartbeat tempo.
export default authoredRecipe('low-health-screen-particles', 'Low-health screen warning', 'UI-safe danger overlay: a center-safe blood-red edge pulse with drifting peripheral flecks.', [
  { kind: 'screen-plane', role: 'screen', opacity: 0.72, scale: 1, phase: 'danger-vignette', tuning: { screenShader: 'danger-vignette', colorOverride: '#b11232' } },
  { kind: 'particles', role: 'screen', opacity: 0.94, scale: 1, phase: 'pulse-specks', tuning: { motion: 'danger-pulse', sprite: 'splat', blend: 'alpha', ramp: 'pigment', colorOverride: '#c91f42', countScale: 0.9, spawnScale: 1, size: [0.48, 0.72, 0.34], spinScale: 0, turbulenceScale: 0.04, flicker: 0.1 } },
], 2, 1.6)
