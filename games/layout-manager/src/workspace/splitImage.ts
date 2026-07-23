import type { ImageNode } from './types';

/**
 * Split an image into a grid of (cols x rows) pieces.
 * vCuts = number of vertical cuts → cols = vCuts + 1
 * hCuts = number of horizontal cuts → rows = hCuts + 1
 *
 * UV-style: each piece shares the original `src` and `naturalWidth`/`naturalHeight`,
 * with its own `cropRect` pointing to its UV region. No canvas, no new blob URLs.
 * If the source image is already cropped, splits the visible (cropped) region.
 */
export function splitImage(
  image: ImageNode,
  vCuts: number,
  hCuts: number,
): ImageNode[] {
  const cols = vCuts + 1;
  const rows = hCuts + 1;

  // The region we're splitting: either the existing crop or the full image
  const region = image.cropRect ?? { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight };

  // Display scale: display pixels per natural pixel
  const ds = image.cropRect
    ? image.width / image.cropRect.w
    : image.width / image.naturalWidth;

  // Full source image origin in workspace coords
  const fullX = image.cropRect
    ? image.x - image.cropRect.x * ds
    : image.x;
  const fullY = image.cropRect
    ? image.y - image.cropRect.y * ds
    : image.y;

  // Size of each piece in natural pixels
  const pieceNatW = Math.floor(region.w / cols);
  const pieceNatH = Math.floor(region.h / rows);

  const pieces: ImageNode[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Natural-resolution crop coordinates within the source image
      const sx = region.x + col * pieceNatW;
      const sy = region.y + row * pieceNatH;
      // Last column/row picks up remaining pixels
      const sw = col === cols - 1 ? (region.x + region.w) - sx : pieceNatW;
      const sh = row === rows - 1 ? (region.y + region.h) - sy : pieceNatH;

      // Display size matches the scale of the original
      const displayW = Math.round(sw * ds);
      const displayH = Math.round(sh * ds);

      // Position in workspace coords
      const x = Math.round(fullX + sx * ds);
      const y = Math.round(fullY + sy * ds);

      const baseName = image.fileName.replace(/\.[^.]+$/, '');
      const fileExt = image.fileName.split('.').pop() ?? 'png';

      pieces.push({
        id: crypto.randomUUID(),
        src: image.src,
        fileName: `${baseName}_${row + 1}x${col + 1}.${fileExt}`,
        x,
        y,
        width: displayW,
        height: displayH,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        rotation: image.rotation,
        zIndex: image.zIndex,
        locked: false,
        opacity: image.opacity,
        spriteName: '',
        cropRect: { x: sx, y: sy, w: sw, h: sh },
        parentId: null,
        basePosition: null,
        offsetPosition: null,
        layerOrder: 'above',
        replacesParent: false,
        flipH: image.flipH,
        flipV: image.flipV,
      });
    }
  }

  return pieces;
}

/**
 * Slice an image into 2 pieces along a single arbitrary cut.
 * `axis = 'vertical'` produces left/right pieces; `axis = 'horizontal'` produces top/bottom.
 * `cutAtDisplay` is the cut position in image-local display pixels (0..image.width or 0..image.height).
 * Pieces share the same source and natural dimensions, with their own cropRect (UV-style).
 */
export function sliceImage(
  image: ImageNode,
  axis: 'vertical' | 'horizontal',
  cutAtDisplay: number,
): ImageNode[] {
  const region = image.cropRect ?? { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight };
  const baseName = image.fileName.replace(/\.[^.]+$/, '');
  const ext = image.fileName.split('.').pop() ?? 'png';

  const make = (
    crop: { x: number; y: number; w: number; h: number },
    x: number,
    y: number,
    w: number,
    h: number,
    suffix: string,
  ): ImageNode => ({
    id: crypto.randomUUID(),
    src: image.src,
    fileName: `${baseName}_${suffix}.${ext}`,
    x,
    y,
    width: w,
    height: h,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    rotation: image.rotation,
    zIndex: image.zIndex,
    locked: false,
    opacity: image.opacity,
    spriteName: '',
    cropRect: crop,
    parentId: null,
    basePosition: null,
    offsetPosition: null,
    layerOrder: 'above',
    replacesParent: false,
    flipH: image.flipH,
    flipV: image.flipV,
  });

  // Note: cutNat is rounded to integer (crop coords must land on whole natural
  // pixels), but cutDisp is kept as a float. Rounding cutDisp causes each
  // piece's display-per-natural ratio to drift off the original's, which
  // shows up as a visible scale mismatch when display ≠ natural (e.g., a 4K
  // source rendered at 100px). CSS handles subpixel widths and positions, and
  // the algebra works out so both pieces' cropDs exactly equals the original ds.
  if (axis === 'vertical') {
    const ds = image.width / region.w;
    if (ds <= 0) return [image];
    const cutNat = Math.round(cutAtDisplay / ds);
    if (cutNat <= 0 || cutNat >= region.w) return [image];
    const cutDisp = cutNat * ds;
    return [
      make({ x: region.x, y: region.y, w: cutNat, h: region.h }, image.x, image.y, cutDisp, image.height, 'L'),
      make({ x: region.x + cutNat, y: region.y, w: region.w - cutNat, h: region.h }, image.x + cutDisp, image.y, image.width - cutDisp, image.height, 'R'),
    ];
  } else {
    const ds = image.height / region.h;
    if (ds <= 0) return [image];
    const cutNat = Math.round(cutAtDisplay / ds);
    if (cutNat <= 0 || cutNat >= region.h) return [image];
    const cutDisp = cutNat * ds;
    return [
      make({ x: region.x, y: region.y, w: region.w, h: cutNat }, image.x, image.y, image.width, cutDisp, 'T'),
      make({ x: region.x, y: region.y + cutNat, w: region.w, h: region.h - cutNat }, image.x, image.y + cutDisp, image.width, image.height - cutDisp, 'B'),
    ];
  }
}
