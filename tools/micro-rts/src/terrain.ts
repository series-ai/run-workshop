/**
 * Shared battlefield world & viewport dimensions (512x288 world = 64x36 tiles of 8x8; 384x216 viewport).
 * Terrain rendering is handled by the 2-layer Wang-16 tileset engine in ./tileset.ts.
 */

export const WORLD_W = 512;
export const WORLD_H = 288;
export const VIEW_W = 384;
export const VIEW_H = 216;
