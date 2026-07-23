import type { ImageNode, CanvasRect } from './types';

/** Resolve the display name for a sprite: spriteName if set, else fileName without extension. */
export function getSpriteName(img: ImageNode): string {
  if (img.spriteName && img.spriteName.trim()) {
    return img.spriteName.trim();
  }
  return img.fileName.replace(/\.[^.]+$/, '');
}

/** Rotation-aware canvas overlap test (canvas is at 0,0). Rendering rotates
 * around the element's center, so membership must use the rotated bounding
 * box — the unrotated rect can sit off-canvas while the sprite is visible. */
export function overlapsCanvas(img: ImageNode, canvas: CanvasRect): boolean {
  let left = img.x;
  let top = img.y;
  let right = img.x + img.width;
  let bottom = img.y + img.height;
  if (img.rotation % 360 !== 0) {
    const corners = computeCorners(img);
    left = Math.min(...corners.map((c) => c.x));
    right = Math.max(...corners.map((c) => c.x));
    top = Math.min(...corners.map((c) => c.y));
    bottom = Math.max(...corners.map((c) => c.y));
  }
  return !(right <= 0 || left >= canvas.width || bottom <= 0 || top >= canvas.height);
}

/** Return images that overlap the canvas rect (canvas is at 0,0). */
export function getCanvasOverlappingImages(images: ImageNode[], canvas: CanvasRect): ImageNode[] {
  return images.filter((img) => overlapsCanvas(img, canvas));
}

/** Find rigged images whose current transform differs from their saved base position.
 * The exported PNG and frame rects use current positions, so exporting while a
 * child sits on its dressed pose bakes the wrong sheet rect and a ~zero offset. */
export function findOffBasePoseImages(images: ImageNode[]): string[] {
  const EPS = 0.5;
  return images
    .filter((img) => {
      const bp = img.basePosition;
      if (!bp) return false;
      return (
        Math.abs(img.x - bp.x) > EPS ||
        Math.abs(img.y - bp.y) > EPS ||
        Math.abs(img.width - bp.width) > EPS ||
        Math.abs(img.height - bp.height) > EPS ||
        Math.abs(img.rotation - bp.rotation) > 0.05
      );
    })
    .map((img) => img.id);
}

/** Find images without a custom sprite name (using filename fallback). Returns array of image ids. */
export function findUnnamedImages(images: ImageNode[]): string[] {
  return images.filter((img) => !img.spriteName || !img.spriteName.trim()).map((img) => img.id);
}

/** Find duplicate sprite names among a set of images. Returns a map of name -> array of image ids. */
export function findDuplicateSpriteNames(images: ImageNode[]): Map<string, string[]> {
  const nameToIds = new Map<string, string[]>();
  for (const img of images) {
    const name = getSpriteName(img);
    const ids = nameToIds.get(name);
    if (ids) {
      ids.push(img.id);
    } else {
      nameToIds.set(name, [img.id]);
    }
  }
  // Only keep entries with duplicates
  const duplicates = new Map<string, string[]>();
  for (const [name, ids] of nameToIds) {
    if (ids.length > 1) {
      duplicates.set(name, ids);
    }
  }
  return duplicates;
}

/** Find pairs of images whose bounding boxes overlap. Returns array of [idA, idB] pairs and set of all involved IDs. */
export function findOverlappingElements(images: ImageNode[]): { pairs: [string, string][]; ids: Set<string> } {
  const pairs: [string, string][] = [];
  const ids = new Set<string>();
  for (let i = 0; i < images.length; i++) {
    const a = images[i]!;
    for (let j = i + 1; j < images.length; j++) {
      const b = images[j]!;
      // Skip parent-child relationships — they're expected to overlap
      if (a.parentId === b.id || b.parentId === a.id) continue;
      // AABB overlap test with sub-pixel tolerance: edge-to-edge layouts pick
      // up float dust from group scaling (103.999999 vs 104) that would flag
      // touching elements as overlapping. Require a visible overlap.
      const EPS = 0.5;
      const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      if (overlapX > EPS && overlapY > EPS) {
        pairs.push([a.id, b.id]);
        ids.add(a.id);
        ids.add(b.id);
      }
    }
  }
  return { pairs, ids };
}

/** Compute the 4 corner positions of an element after rotation (pivot = center). */
function computeCorners(img: ImageNode): { x: number; y: number }[] {
  const cx = img.x + img.width / 2;
  const cy = img.y + img.height / 2;
  const hw = img.width / 2;
  const hh = img.height / 2;
  const rad = (img.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Offsets from center for each corner: TL, TR, BR, BL
  const offsets = [
    { dx: -hw, dy: -hh },
    { dx: hw, dy: -hh },
    { dx: hw, dy: hh },
    { dx: -hw, dy: hh },
  ];

  return offsets.map(({ dx, dy }) => ({
    x: Math.round((cx + dx * cos - dy * sin) * 10) / 10,
    y: Math.round((cy + dx * sin + dy * cos) * 10) / 10,
  }));
}

/** Deduplicate frame keys by appending _2, _3, etc. */
function deduplicateKeys(names: string[]): string[] {
  const counts = new Map<string, number>();
  const result: string[] = [];
  for (const name of names) {
    const count = counts.get(name) ?? 0;
    counts.set(name, count + 1);
    if (count === 0) {
      result.push(name);
    } else {
      result.push(`${name}_${count + 1}`);
    }
  }
  return result;
}

export interface CanvasInfoFrame {
  frame: { x: number; y: number; w: number; h: number };
  rotation: number;
  corners: { x: number; y: number }[];
  sourceSize: { w: number; h: number };
  parent?: string;
  offset?: { dx: number; dy: number; dw: number; dh: number; dRotation: number };
  layerOrder?: 'above' | 'below';
  replacesParent?: boolean;
  children?: string[];
}

export interface CanvasInfoJson {
  guide: {
    coordinateSystem: string;
    frame: string;
    corners: string;
    sourceSize: string;
    rotation: string;
    parent: string;
    children: string;
    offset: string;
    layerOrder: string;
    replacesParent: string;
  };
  frames: Record<string, CanvasInfoFrame>;
  meta: {
    app: string;
    image: string;
    size: { w: number; h: number };
    scale: string;
  };
}

/** Build the full canvas info JSON object. */
export function buildCanvasInfoJson(images: ImageNode[], canvas: CanvasRect): CanvasInfoJson {
  const overlapping = getCanvasOverlappingImages(images, canvas);
  const sorted = [...overlapping].sort((a, b) => a.zIndex - b.zIndex);

  const rawNames = sorted.map(getSpriteName);
  const keys = deduplicateKeys(rawNames);

  // Build a map from image ID to its deduplicated key name
  const idToKey = new Map<string, string>();
  for (let i = 0; i < sorted.length; i++) {
    const key = keys[i];
    const img = sorted[i];
    if (key && img) idToKey.set(img.id, key);
  }

  // Build set of overlapping IDs for parent/child resolution
  const overlappingIds = new Set(sorted.map((img) => img.id));

  const frames: CanvasInfoJson['frames'] = {};
  for (let i = 0; i < sorted.length; i++) {
    const key = keys[i];
    const img = sorted[i];
    if (!key || !img) continue;

    const entry: CanvasInfoFrame = {
      frame: {
        x: Math.round(img.x),
        y: Math.round(img.y),
        w: Math.round(img.width),
        h: Math.round(img.height),
      },
      rotation: Math.round(img.rotation * 10) / 10,
      corners: computeCorners(img),
      sourceSize: {
        w: img.naturalWidth,
        h: img.naturalHeight,
      },
    };

    // Add rig data if present (only reference nodes within the canvas)
    if (img.parentId && overlappingIds.has(img.parentId)) {
      const parentKey = idToKey.get(img.parentId);
      if (parentKey) {
        entry.parent = parentKey;
        // Compute offset as delta from base (current canvas position) to offset position
        if (img.offsetPosition) {
          entry.offset = {
            dx: Math.round(img.offsetPosition.x - img.x),
            dy: Math.round(img.offsetPosition.y - img.y),
            dw: Math.round(img.offsetPosition.width - img.width),
            dh: Math.round(img.offsetPosition.height - img.height),
            dRotation: Math.round((img.offsetPosition.rotation - img.rotation) * 10) / 10,
          };
        }
        entry.layerOrder = img.layerOrder;
        if (img.replacesParent) {
          entry.replacesParent = true;
        }
      }
    }

    // Find children of this node that are within the canvas
    const childKeys = sorted
      .filter((c) => c.parentId === img.id && overlappingIds.has(c.id))
      .map((c) => idToKey.get(c.id))
      .filter((k): k is string => !!k);
    if (childKeys.length > 0) {
      entry.children = childKeys;
    }

    frames[key] = entry;
  }

  return {
    guide: {
      coordinateSystem: 'Origin is top-left. X increases rightward. Y increases downward. Standard screen/canvas coordinates.',
      frame: 'Clip rect on the sprite sheet PNG: {x, y, w, h}. Use these coordinates to cut this sprite from the matching .png file.',
      corners: 'The 4 corner positions of the sprite after rotation is applied. Order: top-left, top-right, bottom-right, bottom-left. Use these if you want to avoid rotation math.',
      sourceSize: 'Original dimensions of the source image before any scaling. Metadata only — not needed for rendering.',
      rotation: 'Rotation in degrees. Pivot point is the center of the frame rect.',
      parent: 'Sprite name of this element\'s parent in the rig hierarchy.',
      children: 'Array of sprite names that are children of this element.',
      offset: 'Delta from the sprite\'s sheet position (frame) to its equipped/dressed position. Apply as: dressedX = frame.x + offset.dx, dressedY = frame.y + offset.dy, etc. The dressed position may be outside the canvas — that is expected.',
      layerOrder: '"above" = render this child on top of the parent. "below" = render behind the parent.',
      replacesParent: 'When true, this child is a visual replacement for the parent. When this child is active, hide the parent but still render other children as normal.',
    },
    frames,
    meta: {
      app: 'LayoutManager',
      image: 'See matching .png file',
      size: { w: canvas.width, h: canvas.height },
      scale: '1',
    },
  };
}
