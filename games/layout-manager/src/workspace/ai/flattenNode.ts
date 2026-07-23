import type { ImageNode } from '../types';
import { adjustmentsFilter } from '../types';

/** Flatten a node's base image + paint layers (with bg color and adjustments baked in) into a single data URL. */
export async function flattenNode(node: ImageNode): Promise<string> {
  const adjust = adjustmentsFilter(node);
  // Fast paths only if there's no bg color or adjustments to bake in
  if (!node.bgColor && !adjust) {
    if (node.paintCompositeUrl) return node.paintCompositeUrl;
    if (!node.paintOverlayUrl && !node.paintUnderlayUrl) return node.src;
  }

  const canvas = document.createElement('canvas');
  canvas.width = node.naturalWidth;
  canvas.height = node.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.filter = adjust ?? 'none';

  const loadImg = (url: string) => new Promise<HTMLImageElement>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = url;
  });

  // Flat bg color drawn first so it fills any transparent regions of the image above
  if (node.bgColor) {
    ctx.fillStyle = node.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (node.paintCompositeUrl) {
    const composite = await loadImg(node.paintCompositeUrl);
    ctx.drawImage(composite, 0, 0);
  } else {
    if (node.paintUnderlayUrl) {
      const underlay = await loadImg(node.paintUnderlayUrl);
      ctx.drawImage(underlay, 0, 0);
    }
    const base = await loadImg(node.src);
    ctx.drawImage(base, 0, 0);
    if (node.paintOverlayUrl) {
      const overlay = await loadImg(node.paintOverlayUrl);
      ctx.drawImage(overlay, 0, 0);
    }
  }

  return canvas.toDataURL('image/png');
}

/** Convert a data URL or blob/object URL to a Blob. */
export async function urlToBlob(url: string): Promise<Blob> {
  const resp = await fetch(url);
  return resp.blob();
}
