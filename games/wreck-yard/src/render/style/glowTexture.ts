import * as THREE from 'three';

let shared: THREE.CanvasTexture | null = null;

/**
 * Soft radial falloff for additive glow cards (floodlights, furnace mouths).
 * One small texture shared by every card; no blur pass needed.
 */
export function glowTexture(): THREE.CanvasTexture {
  if (shared) return shared;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('WRECK_YARD_GLOW_TEXTURE_CONTEXT');
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.14)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  shared = new THREE.CanvasTexture(canvas);
  shared.colorSpace = THREE.SRGBColorSpace;
  return shared;
}

let sharedSmoke: THREE.CanvasTexture | null = null;

/** Dense, soft-edged puff for smoke: solid in the middle, unlike the glow card. */
export function smokeTexture(): THREE.CanvasTexture {
  if (sharedSmoke) return sharedSmoke;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('WRECK_YARD_SMOKE_TEXTURE_CONTEXT');
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.85)');
  gradient.addColorStop(0.8, 'rgba(255,255,255,0.3)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  sharedSmoke = new THREE.CanvasTexture(canvas);
  sharedSmoke.colorSpace = THREE.SRGBColorSpace;
  return sharedSmoke;
}
