import type { StrokeEffect } from './types';

/**
 * Render a stroke effect around the non-transparent pixels of a source canvas.
 *
 * Returns a canvas containing only the stroke pixels (RGBA), or null if
 * the effect is disabled or thickness is 0.
 */
export function renderStrokeEffect(
  source: HTMLCanvasElement,
  effect: StrokeEffect,
  nw: number,
  nh: number,
): HTMLCanvasElement | null {
  if (!effect.enabled || effect.thickness <= 0) return null;

  const srcCtx = source.getContext('2d')!;
  const srcData = srcCtx.getImageData(0, 0, nw, nh);
  const alpha = new Uint8Array(nw * nh);

  // Extract binary alpha
  for (let i = 0; i < alpha.length; i++) {
    alpha[i] = srcData.data[i * 4 + 3]! > 0 ? 1 : 0;
  }

  // Find edge pixels only (pixels with at least one neighbor that differs)
  const edges = findEdges(alpha, nw, nh);
  if (edges.length === 0) return null;

  let strokeMask: Uint8Array;
  const t = effect.thickness;

  if (effect.position === 'outside') {
    const dilated = dilateFromEdges(alpha, edges, nw, nh, t, true);
    strokeMask = subtract(dilated, alpha, nw, nh);
  } else if (effect.position === 'inside') {
    const eroded = erodeFromEdges(alpha, edges, nw, nh, t);
    strokeMask = subtract(alpha, eroded, nw, nh);
  } else {
    // center
    const halfOut = Math.ceil(t / 2);
    const halfIn = Math.floor(t / 2);
    const dilated = dilateFromEdges(alpha, edges, nw, nh, halfOut, true);
    const eroded = halfIn > 0 ? erodeFromEdges(alpha, edges, nw, nh, halfIn) : alpha;
    strokeMask = subtract(dilated, eroded, nw, nh);
  }

  // Parse color
  const c = effect.color.replace('#', '');
  const cr = parseInt(c.substring(0, 2), 16);
  const cg = parseInt(c.substring(2, 4), 16);
  const cb = parseInt(c.substring(4, 6), 16);
  const ca = Math.round(effect.opacity * 255);

  // Build output canvas
  const out = document.createElement('canvas');
  out.width = nw;
  out.height = nh;
  const outCtx = out.getContext('2d')!;
  const outData = outCtx.createImageData(nw, nh);

  for (let i = 0; i < strokeMask.length; i++) {
    if (strokeMask[i]) {
      const j = i * 4;
      outData.data[j] = cr;
      outData.data[j + 1] = cg;
      outData.data[j + 2] = cb;
      outData.data[j + 3] = ca;
    }
  }

  outCtx.putImageData(outData, 0, 0);
  return out;
}

/** Find edge pixels — pixels where alpha differs from at least one neighbor. */
export function findEdges(mask: Uint8Array, w: number, h: number): number[] {
  const edges: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const v = mask[idx]!;
      // Check 4-connected neighbors
      if (x > 0 && mask[idx - 1] !== v) { edges.push(idx); continue; }
      if (x < w - 1 && mask[idx + 1] !== v) { edges.push(idx); continue; }
      if (y > 0 && mask[idx - w] !== v) { edges.push(idx); continue; }
      if (y < h - 1 && mask[idx + w] !== v) { edges.push(idx); continue; }
      // Image border pixels are also edges
      if (v && (x === 0 || x === w - 1 || y === 0 || y === h - 1)) { edges.push(idx); }
    }
  }
  return edges;
}

/** Dilate outward from edge pixels only (much faster than full dilate). */
export function dilateFromEdges(
  mask: Uint8Array, edges: number[], w: number, h: number, radius: number, outward: boolean,
): Uint8Array {
  const out = new Uint8Array(mask);
  const r2 = radius * radius;

  for (const idx of edges) {
    const ex = idx % w;
    const ey = (idx - ex) / w;
    // Only process edges that are on the correct side
    if (outward && mask[idx] === 0) continue; // for outward dilate, start from filled edge pixels
    if (!outward && mask[idx] === 1) continue;

    const y0 = Math.max(0, ey - radius);
    const y1 = Math.min(h - 1, ey + radius);
    const x0 = Math.max(0, ex - radius);
    const x1 = Math.min(w - 1, ex + radius);
    for (let ny = y0; ny <= y1; ny++) {
      for (let nx = x0; nx <= x1; nx++) {
        const dx = nx - ex;
        const dy = ny - ey;
        if (dx * dx + dy * dy <= r2) {
          out[ny * w + nx] = 1;
        }
      }
    }
  }
  return out;
}

/** Erode inward from edge pixels only. */
export function erodeFromEdges(
  mask: Uint8Array, edges: number[], w: number, h: number, radius: number,
): Uint8Array {
  // Erode = invert, dilate empty edge pixels, invert
  const out = new Uint8Array(mask);
  const r2 = radius * radius;

  for (const idx of edges) {
    const ex = idx % w;
    const ey = (idx - ex) / w;
    // Only process filled pixels on the edge (they'll be eroded inward)
    if (mask[idx] === 0) continue;

    const y0 = Math.max(0, ey - radius);
    const y1 = Math.min(h - 1, ey + radius);
    const x0 = Math.max(0, ex - radius);
    const x1 = Math.min(w - 1, ex + radius);
    for (let ny = y0; ny <= y1; ny++) {
      for (let nx = x0; nx <= x1; nx++) {
        const dx = nx - ex;
        const dy = ny - ey;
        if (dx * dx + dy * dy <= r2) {
          out[ny * w + nx] = 0;
        }
      }
    }
  }
  return out;
}

/** Subtract mask B from mask A (A AND NOT B). */
function subtract(a: Uint8Array, b: Uint8Array, _w: number, _h: number): Uint8Array {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) {
    out[i] = a[i] && !b[i] ? 1 : 0;
  }
  return out;
}
