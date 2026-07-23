import type { ImageNode } from './types';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export interface CropRectResult {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Auto-crop: find the bounding box of non-transparent pixels.
 * If the image already has a cropRect, scans only within that region.
 * Returns coordinates in full-source space, or null if no trim is possible.
 */
export async function autoCropImage(image: ImageNode): Promise<CropRectResult | null> {
  const srcImg = await loadImage(image.src);
  const natW = image.naturalWidth;
  const natH = image.naturalHeight;

  // Region to scan — existing crop or full image
  const region = image.cropRect ?? { x: 0, y: 0, w: natW, h: natH };

  const offscreen = document.createElement('canvas');
  offscreen.width = region.w;
  offscreen.height = region.h;
  const ctx = offscreen.getContext('2d')!;
  ctx.drawImage(srcImg, -region.x, -region.y);

  // Apply mask so masked-out pixels are treated as transparent
  if (image.maskDataUrl) {
    const maskImg = await loadImage(image.maskDataUrl);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskImg, -region.x, -region.y);
    ctx.globalCompositeOperation = 'source-over';
  }

  const data = ctx.getImageData(0, 0, region.w, region.h).data;

  let minX = region.w;
  let minY = region.h;
  let maxX = -1;
  let maxY = -1;

  for (let py = 0; py < region.h; py++) {
    for (let px = 0; px < region.w; px++) {
      const alpha = data[(py * region.w + px) * 4 + 3]!;
      if (alpha > 0) {
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
    }
  }

  // No opaque pixels, or already fully tight — nothing to trim
  if (maxX < 0 || (minX === 0 && minY === 0 && maxX === region.w - 1 && maxY === region.h - 1)) {
    return null;
  }

  // Convert back to full-source coordinates
  return {
    x: region.x + minX,
    y: region.y + minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
  };
}

/**
 * Render an image with its crop rect to an offscreen canvas (for export).
 */
export async function renderCroppedImage(
  image: ImageNode,
): Promise<{ canvas: HTMLCanvasElement; displayScale: number }> {
  const srcImg = await loadImage(image.src);
  const crop = image.cropRect ?? { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight };
  const displayScale = image.width / crop.w;

  const canvas = document.createElement('canvas');
  canvas.width = crop.w;
  canvas.height = crop.h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(srcImg, -crop.x, -crop.y);

  return { canvas, displayScale };
}
