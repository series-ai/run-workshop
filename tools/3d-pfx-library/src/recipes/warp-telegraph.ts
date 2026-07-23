import { authoredRecipe } from '../constants/01'

export default authoredRecipe('warp-telegraph', 'Warp telegraph', 'Warp warning telegraph with lens warning and displaced motes.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.85, scale: 0.38, phase: 'warp-telegraph-ground-stamp', tuning: { meshMotion: 'flash', colorOverride: '#0077ff' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.95, scale: 0.75, phase: 'warp-telegraph-warning-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#0077ff' } },
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.28, scale: 0.7, phase: 'warp-telegraph-warning-fill', tuning: { colorOverride: '#2f8fe8' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.6, phase: 'warp-telegraph-ground-urgency', tuning: { motion: 'column-rise', sprite: 'sparkle', colorOverride: '#2f9dff', ramp: 'pigment', delay: 0.12, window: 0.6, lifeScale: 1.0, countScale: 0.3, speedScale: 0.5, speedJitter: 0.4, spawnScale: 1.6, turbulenceScale: 0.2, gravity: 0.8, spinScale: 1.2 } },
  { kind: 'impact-sparks', role: 'impact', opacity: 0.95, scale: 0.5, phase: 'warp-telegraph-ground-snapshot', tuning: { sprite: 'glow', delay: 0.9, window: 0.07, lifeScale: 0.12, ease: 'snap', speedScale: 1.8, colorOverride: '#fff1d8', ramp: 'held', countScale: 0.4, turbulenceScale: 0, gravity: 0 } },
], 2, 0.6)
