import { authoredRecipe } from '../constants/01'

// Despawn spec: a despawn is a RECEIPT — kill-frame flash marks the
// instant, matter leaves as fragments, the dark skirt lingers (resolution).
export default authoredRecipe('enemy-death-poof', 'Enemy cleanup poof', 'Readable non-gory death cleanup: kill flash, collapse fragments, lingering dark skirt.', [
  { kind: 'core-sphere', role: 'impact', opacity: 1, scale: 0.68, phase: 'enemy-death-hard-kill-receipt', tuning: { meshMotion: 'flash', window: 0.16, startScale: 0.55, colorOverride: '#ffffff', positionOffset: [0, 0.52, 0] } },
  { kind: 'shield-fragments', role: 'body', opacity: 0.9, scale: 0.85, phase: 'enemy-death-body-collapse', tuning: { meshMotion: 'break', blend: 'alpha', colorOverride: '#8d6cac', positionOffset: [0, 0.42, 0] } },
  { kind: 'particles', role: 'volume', opacity: 0.88, scale: 1.25, phase: 'enemy-death-smoke-resolver', tuning: { motion: 'drift-cloud', sprite: 'puff', blend: 'alpha', colorOverride: '#806a80', delay: 0.03, window: 0.22, lifeScale: 0.9, countScale: 1.15, speedScale: 0.6, speedJitter: 0.45, gravity: 0.16, drag: 1.7, spawnScale: 0.95, depthScale: 2.8, positionOffset: [0, 0.24, 0], size: [0.6, 1.05, 1.25], spinScale: 0.45, ramp: 'held', death: 'erode', turbulenceScale: 0.36 } },
], 2, 1.4)
