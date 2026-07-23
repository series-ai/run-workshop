import { authoredRecipe } from '../constants/01'

export default authoredRecipe('hologram-aura', 'Hologram aura', 'Readable sci-fi field around interactive holographic objects.', [
  { kind: 'shield-shell', role: 'aura', opacity: 0.86, scale: 1.28, phase: 'hologram-aura-scan-shell', tuning: { meshShader: 'hologram-shell', meshMotion: 'pulse', lifecycle: 'hologram-aura-loop', blend: 'additive', colorOverride: '#00bfe8', positionOffset: [0, 0.16, 0] } },
  { kind: 'particles', role: 'volume', opacity: 0.82, scale: 1.08, phase: 'hologram-aura-data-interference', tuning: { motion: 'column-rise', sprite: 'streak', blend: 'additive', colorOverride: '#64e8ff', ramp: 'held', countScale: 0.68, speedScale: 0.34, speedJitter: 0.22, spawnScale: 0.72, depthScale: 1.65, turbulenceScale: 0.08, gravity: 0, spinScale: 0, size: [0.14, 0.3, 0.07], flicker: 1.15, positionOffset: [0, 0.12, 0] } },
  { kind: 'particles', role: 'aura', opacity: 0.78, scale: 1.04, phase: 'hologram-aura-orbiting-glyphs', tuning: { motion: 'shell-flame', sprite: 'rune', blend: 'additive', colorOverride: '#a7f5ff', ramp: 'held', countScale: 0.42, speedScale: 0.08, speedJitter: 0.12, drag: 4.5, spawnScale: 1.38, depthScale: 1.5, turbulenceScale: 0.04, gravity: 0, spinScale: 0.18, size: [0.14, 0.25, 0.1], flicker: 0.65, positionOffset: [0, 0.18, 0] } },
], 2, 0.92)
