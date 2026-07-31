/**
 * "Shadow Keep" background removal — the vendored wand/chroma cutout engine
 * running on canvas ImageData. Unlike the AI engines, it preserves soft
 * contact shadows as translucent black. Works on uniform / near-uniform
 * backgrounds and green/magenta screens; instant, fully in-browser.
 */
import { wandCutout, chromaCutout } from './cutoutEngine.mjs';

export interface ShadowCutoutOptions {
  mode: 'wand' | 'chroma';
  /** Max per-channel difference from the seed/key color (default 20). */
  tolerance: number;
  /** Chroma key color, e.g. "#00ff00" (chroma mode only). */
  key: string;
  /** Shadow layer opacity scale, 0–200 (%). 0 disables shadow recovery. */
  shadowStrength: number;
  /** Selection contraction px before refine (engine default 1). */
  contract?: number;
  /** Contour smoothing px (engine default 2). */
  smooth?: number;
  /** Edge blur px (engine default 1). */
  feather?: number;
  /** When set, edge px were tuned against a preview capped at this long
   * side — scale them up so full-res output matches the preview. */
  opsScaleRef?: number;
}

/** Remove the background from an image blob, keeping soft shadows.
 * Wand mode floods from the four corners; chroma mode keys on the color. */
export async function removeBackgroundShadowKeep(
  imageBlob: Blob,
  opts: ShadowCutoutOptions,
): Promise<Blob> {
  const bitmap = await createImageBitmap(imageBlob);
  const { width: w, height: h } = bitmap;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const imageData = ctx.getImageData(0, 0, w, h);
  const img = { w, h, data: imageData.data };

  const opsScale = opts.opsScaleRef ? Math.max(1, Math.max(w, h) / opts.opsScaleRef) : 1;
  const scalePx = (v: number | undefined) => (v === undefined ? undefined : Math.round(v * opsScale));
  const common = {
    tolerance: opts.tolerance,
    shadow: opts.shadowStrength > 0,
    shadowStrength: opts.shadowStrength,
    contract: scalePx(opts.contract),
    smooth: scalePx(opts.smooth),
    feather: scalePx(opts.feather),
  };
  if (opts.mode === 'chroma') {
    chromaCutout(img, [], { ...common, key: opts.key });
  } else {
    const seeds = [
      { x: 0, y: 0 },
      { x: w - 1, y: 0 },
      { x: 0, y: h - 1 },
      { x: w - 1, y: h - 1 },
    ];
    wandCutout(img, seeds, common);
  }

  ctx.putImageData(imageData, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Failed to encode result');
  return blob;
}
