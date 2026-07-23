import { authoredRecipe } from '../constants/01'

// RIME erosion doctrine: the body ERODES (never fades); bright edge motes
// leave along the dissolve front; essence rises as the receipt.
export default authoredRecipe('dissolve', 'Object dissolve cloud', 'Erosion dissolve: body breaks cell-by-cell, edge motes rise off the front.', [
  { kind: 'shield-shell', role: 'body', opacity: 0.85, scale: 0.7, phase: 'dissolve-eroding-subject', tuning: { meshShader: 'fresnel-shell', meshMotion: 'break', colorOverride: '#66e8d0', delay: 0, window: 0.72 } },
  { kind: 'particles', role: 'volume', opacity: 0.9, scale: 0.9, phase: 'dissolve-edge-motes', tuning: { motion: 'column-rise', sprite: 'glow', blend: 'additive', delay: 0, window: 0.72, countScale: 0.55, speedScale: 0.8, speedJitter: 0.35, spawnScale: 0.7, size: [0.3, 0.45, 0.25], ramp: 'held', spinScale: 0, turbulenceScale: 0.2, gravity: 0.5, flicker: 0.8 } },
], 2, 1.0)
