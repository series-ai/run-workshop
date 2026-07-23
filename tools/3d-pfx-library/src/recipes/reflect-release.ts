import { authoredRecipe } from '../constants/01'

export default authoredRecipe('reflect-release', 'Reflect release', 'Shield reflection discharge with an outward defensive pulse.', [
  { kind: 'shield-shell', role: 'aura', opacity: 0.78, scale: 1.08, phase: 'reflect-release-deflection-shell', tuning: { meshShader: 'hex-shell', meshMotion: 'break', blend: 'alpha', colorOverride: '#3fa9ff', delay: 0.05, window: 0.5, positionOffset: [0, 0.38, 0] } },
  { kind: 'impact-core', role: 'impact', opacity: 0.98, scale: 0.72, phase: 'reflect-release-contact-core', tuning: { meshMotion: 'flash', lifecycle: 'impact-core-flash', colorOverride: '#ffffff', positionOffset: [0.52, 0.42, 0], window: 0.36, startScale: 0.32 } },
  { kind: 'particles', role: 'impact', opacity: 0.96, scale: 0.92, phase: 'reflect-release-return-vector', tuning: { motion: 'impact-burst', sprite: 'streak', blend: 'additive', colorOverride: '#8fd8ff', ramp: 'pinned-hot', delay: 0.025, window: 0.28, lifeScale: 0.62, countScale: 0.66, speedScale: 4.6, speedJitter: 0.28, drag: 1.1, gravity: 0, spawnScale: 0.14, depthScale: 2.8, positionOffset: [0.52, 0.42, 0], impactVector: [1, 0.18, 0.08], spreadAngle: 0.2, spinScale: 0, stretch: 2.4, turbulenceScale: 0.05, size: [0.22, 0.4, 0.07], death: 'erode' } },
], 2, 1.6)
