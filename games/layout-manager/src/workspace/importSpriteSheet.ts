import type { ImageNode, CanvasRect } from './types';
import type { CanvasInfoJson } from './canvasInfo';

/**
 * Import a sprite sheet JSON + PNG pair, reconstructing all ImageNodes
 * with their cropRect, parent/child hierarchy, and rig data.
 *
 * Each sprite becomes an ImageNode sharing the same blob URL (UV-style),
 * with cropRect pointing to its visible region in the sprite sheet.
 */
export async function importSpriteSheet(
  jsonFile: File,
  imageFile: File,
): Promise<{ images: ImageNode[]; canvas: CanvasRect }> {
  // Parse JSON
  const jsonText = await jsonFile.text();
  const data: CanvasInfoJson = JSON.parse(jsonText);

  // Load the image to get actual pixel dimensions
  const imageSrc = URL.createObjectURL(imageFile);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load sprite sheet image'));
    img.src = imageSrc;
  });

  const natW = img.naturalWidth;
  const natH = img.naturalHeight;

  // First pass: assign IDs to all sprite names
  const nameToId = new Map<string, string>();
  for (const spriteName of Object.keys(data.frames)) {
    nameToId.set(spriteName, crypto.randomUUID());
  }

  // Second pass: build ImageNodes
  const nodes: ImageNode[] = [];
  let zIndex = 0;

  for (const [spriteName, frame] of Object.entries(data.frames)) {
    const id = nameToId.get(spriteName)!;
    const parentId = frame.parent ? (nameToId.get(frame.parent) ?? null) : null;

    const fx = frame.frame.x;
    const fy = frame.frame.y;
    const fw = frame.frame.w;
    const fh = frame.frame.h;

    // Compute visible crop rect (intersection of frame with image bounds)
    const clipLeft = Math.max(0, fx);
    const clipTop = Math.max(0, fy);
    const clipRight = Math.min(natW, fx + fw);
    const clipBottom = Math.min(natH, fy + fh);
    const cw = clipRight - clipLeft;
    const ch = clipBottom - clipTop;

    // Skip frames entirely outside the image
    if (cw <= 0 || ch <= 0) {
      console.warn(`[importSpriteSheet] Skipping "${spriteName}": frame is entirely outside image bounds`);
      continue;
    }

    const cropRect = { x: clipLeft, y: clipTop, w: cw, h: ch };

    // Workspace position = where visible portion starts
    const nodeX = clipLeft;
    const nodeY = clipTop;
    const nodeW = cw;
    const nodeH = ch;

    // Base position (sheet/packed position) — only meaningful for children
    const basePosition = parentId ? {
      x: nodeX,
      y: nodeY,
      width: nodeW,
      height: nodeH,
      rotation: frame.rotation,
    } : null;

    // Offset position (dressed/equipped position)
    let offsetPosition = null;
    if (parentId && frame.offset) {
      const { dx, dy, dw, dh, dRotation } = frame.offset;
      offsetPosition = {
        x: nodeX + dx,
        y: nodeY + dy,
        width: nodeW + dw,
        height: nodeH + dh,
        rotation: frame.rotation + dRotation,
      };
    }

    nodes.push({
      id,
      src: imageSrc,
      fileName: `${spriteName}.png`,
      x: nodeX,
      y: nodeY,
      width: nodeW,
      height: nodeH,
      naturalWidth: natW,
      naturalHeight: natH,
      rotation: frame.rotation,
      zIndex: zIndex++,
      locked: false,
      opacity: 1,
      spriteName,
      cropRect,
      parentId,
      basePosition,
      offsetPosition,
      layerOrder: frame.layerOrder ?? 'above',
      replacesParent: frame.replacesParent ?? false,
      flipH: false,
      flipV: false,
    });
  }

  const canvas: CanvasRect = { width: data.meta.size.w, height: data.meta.size.h };

  return { images: nodes, canvas };
}
