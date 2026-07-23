import { authoredRecipe } from '../constants/01'

// Despawn receipt for a reticle: the target cage visibly fractures into
// closed 3D shards while an early ground wave clears the lock boundary.
export default authoredRecipe('target-break', 'Target break', 'Reticle cancellation: hex target shell, radial fracture volume, ground-clear wave.', [
  { kind: 'shield-shell', role: 'aura', opacity: 0.88, scale: 0.78, phase: 'target-break-fracture-shell', tuning: { meshGeometry: 'target-break-lock-shell', meshShader: 'hex-shell', meshMotion: 'break', colorOverride: '#5dcfff', positionOffset: [0, 0.32, 0] } },
  { kind: 'shield-fragments', role: 'impact', opacity: 1, scale: 0.96, phase: 'target-break-radial-fragments', tuning: { meshGeometry: 'target-break-honeycomb-fragments', meshMotion: 'flash', lifecycle: 'impact-shard-burst', delay: 0.02, window: 0.72, startScale: 0.24, colorOverride: '#d8f5ff', positionOffset: [0, 0.32, 0] } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 1, scale: 0.86, phase: 'target-break-ground-clear-wave', tuning: { meshGeometry: 'target-break-ground-reticle', meshMotion: 'shockwave', ringPurpose: 'shockwave', colorOverride: '#72d9ff', delay: 0.18 } },
], 2, 1.35)
