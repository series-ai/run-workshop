import { findAlphaBounds } from '../cropImage';
import type { CropRectResult } from '../cropImage';
import { renderStrokeEffect } from './strokeEffect';

export const PIXEL_FIX_PADDING = 2;

/** Draw view-only diagnostics into a separate canvas. Never modify the source. */
export function renderPixelFixPreview(
  source: HTMLCanvasElement,
  target: HTMLCanvasElement,
  crop: CropRectResult | null,
  viewScale: number,
): CropRectResult | null {
  const pad = PIXEL_FIX_PADDING;
  const w = source.width + pad * 2;
  const h = source.height + pad * 2;
  if (target.width !== w || target.height !== h) {
    target.width = w;
    target.height = h;
  }
  const ctx = target.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  const x = Math.max(0, Math.floor(crop?.x ?? 0));
  const y = Math.max(0, Math.floor(crop?.y ?? 0));
  const right = Math.min(source.width, Math.ceil(crop ? crop.x + crop.w : source.width));
  const bottom = Math.min(source.height, Math.ceil(crop ? crop.y + crop.h : source.height));
  if (right <= x || bottom <= y) return null;
  ctx.drawImage(source, x, y, right - x, bottom - y, x + pad, y + pad, right - x, bottom - y);
  const bounds = findAlphaBounds(ctx.getImageData(0, 0, w, h).data, w, h);
  // Padding lets an outside stroke show even on pixels at the image edge.
  const stroke = bounds
    ? renderStrokeEffect(
        target,
        {
          enabled: true,
          color: '#ff0000',
          thickness: 2,
          opacity: 1,
          position: 'outside',
        },
        w,
        h,
      )
    : null;
  ctx.clearRect(0, 0, w, h);
  if (!bounds) return null;
  if (stroke) ctx.drawImage(stroke, 0, 0);

  // Static black/white dashed frame is distinct from the red pixel highlight.
  // Its bounds come from the image BEFORE adding the diagnostic stroke.
  ctx.save();
  const screenPixel = 1 / Math.max(0.001, viewScale);
  ctx.lineWidth = screenPixel;
  ctx.strokeStyle = '#000000';
  ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
  ctx.setLineDash([4 * screenPixel, 4 * screenPixel]);
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
  ctx.restore();
  return { x: bounds.x - pad, y: bounds.y - pad, w: bounds.w, h: bounds.h };
}
