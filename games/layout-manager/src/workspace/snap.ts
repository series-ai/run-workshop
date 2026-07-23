import type { ImageNode, CanvasRect, SnapGuide, RulerGuide } from './types';

const SNAP_THRESHOLD = 8; // pixels in workspace coords

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Axis-aligned bounding box of an element as actually displayed — accounts for
 * rotation (applied around the element center). Snapping on raw x/y/w/h makes
 * rotated elements "un-snappable": their visual edges no longer match the
 * unrotated rect the numbers describe.
 */
function visualBounds(img: ImageNode): Rect {
  const rot = ((img.rotation % 360) + 360) % 360;
  if (rot === 0) return { x: img.x, y: img.y, width: img.width, height: img.height };
  const rad = (rot * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const w = img.width * cos + img.height * sin;
  const h = img.width * sin + img.height * cos;
  const cx = img.x + img.width / 2;
  const cy = img.y + img.height / 2;
  return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
}

/**
 * Given a group of images being moved, compute the snap offset and active guides.
 *
 * @param movingIds  IDs of images being dragged
 * @param allImages  All images with their *target* positions (after raw dx/dy applied)
 * @param canvas     Optional canvas rect (at origin 0,0)
 * @returns          { dx, dy } snap adjustment to apply on top, plus active snap guides
 */
export function computeSnap(
  movingIds: Set<string>,
  allImages: ImageNode[],
  canvas: CanvasRect | null,
  rulerGuides?: RulerGuide[],
): { dx: number; dy: number; guides: SnapGuide[] } {
  const moving = allImages.filter((img) => movingIds.has(img.id)).map(visualBounds);
  const obstacles = allImages.filter((img) => !movingIds.has(img.id)).map(visualBounds);

  if (moving.length === 0) return { dx: 0, dy: 0, guides: [] };

  // Compute bounding box of moving group
  const bbox: Rect = {
    x: Math.min(...moving.map((m) => m.x)),
    y: Math.min(...moving.map((m) => m.y)),
    width: 0,
    height: 0,
  };
  bbox.width = Math.max(...moving.map((m) => m.x + m.width)) - bbox.x;
  bbox.height = Math.max(...moving.map((m) => m.y + m.height)) - bbox.y;

  const bboxCx = bbox.x + bbox.width / 2;
  const bboxCy = bbox.y + bbox.height / 2;
  const bboxRight = bbox.x + bbox.width;
  const bboxBottom = bbox.y + bbox.height;

  // Collect all snap targets (edges + centers of obstacles)
  const xTargets: number[] = [];
  const yTargets: number[] = [];

  for (const obs of obstacles) {
    xTargets.push(obs.x, obs.x + obs.width, obs.x + obs.width / 2);
    yTargets.push(obs.y, obs.y + obs.height, obs.y + obs.height / 2);
  }

  // Canvas edges
  if (canvas) {
    xTargets.push(0, canvas.width, canvas.width / 2);
    yTargets.push(0, canvas.height, canvas.height / 2);
  }

  // Ruler guides
  if (rulerGuides) {
    for (const g of rulerGuides) {
      if (g.axis === 'x') xTargets.push(g.position);
      else yTargets.push(g.position);
    }
  }

  // Source edges/centers of the moving group bbox
  const xSources = [bbox.x, bboxRight, bboxCx];
  const ySources = [bbox.y, bboxBottom, bboxCy];

  // Also add individual image edges for single-image moves
  if (moving.length === 1) {
    const m = moving[0]!; // already a visual (rotation-aware) bounds rect
    xSources.length = 0;
    ySources.length = 0;
    xSources.push(m.x, m.x + m.width, m.x + m.width / 2);
    ySources.push(m.y, m.y + m.height, m.y + m.height / 2);
  }

  let bestDx = Infinity;
  let bestDy = Infinity;
  const guides: SnapGuide[] = [];

  // Find closest X snap
  for (const src of xSources) {
    for (const tgt of xTargets) {
      const dist = Math.abs(src - tgt);
      if (dist < Math.abs(bestDx) && dist <= SNAP_THRESHOLD) {
        bestDx = tgt - src;
      }
    }
  }

  // Find closest Y snap
  for (const src of ySources) {
    for (const tgt of yTargets) {
      const dist = Math.abs(src - tgt);
      if (dist < Math.abs(bestDy) && dist <= SNAP_THRESHOLD) {
        bestDy = tgt - src;
      }
    }
  }

  const dx = Math.abs(bestDx) <= SNAP_THRESHOLD ? bestDx : 0;
  const dy = Math.abs(bestDy) <= SNAP_THRESHOLD ? bestDy : 0;

  // Collect guides for the snapped positions
  if (dx !== 0 || dy !== 0) {
    const snappedXSources = xSources.map((s) => s + dx);
    const snappedYSources = ySources.map((s) => s + dy);

    for (const src of snappedXSources) {
      for (const tgt of xTargets) {
        if (Math.abs(src - tgt) < 0.5) {
          guides.push({ axis: 'x', position: tgt });
        }
      }
    }
    for (const src of snappedYSources) {
      for (const tgt of yTargets) {
        if (Math.abs(src - tgt) < 0.5) {
          guides.push({ axis: 'y', position: tgt });
        }
      }
    }
  }

  // Also show guides even when dx/dy are 0 but we're already aligned
  if (dx === 0) {
    for (const src of xSources) {
      for (const tgt of xTargets) {
        if (Math.abs(src - tgt) < 0.5) {
          guides.push({ axis: 'x', position: tgt });
        }
      }
    }
  }
  if (dy === 0) {
    for (const src of ySources) {
      for (const tgt of yTargets) {
        if (Math.abs(src - tgt) < 0.5) {
          guides.push({ axis: 'y', position: tgt });
        }
      }
    }
  }

  // Deduplicate guides
  const seen = new Set<string>();
  const uniqueGuides = guides.filter((g) => {
    const key = `${g.axis}:${g.position}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { dx, dy, guides: uniqueGuides };
}

/**
 * Snap adjustment for a resize operation.
 *
 * @param resizingIds  ID or set of IDs of image(s) being resized
 * @param edges        The edges being dragged: { left?, right?, top?, bottom? } in workspace coords
 * @param allImages    All images (current positions)
 * @param canvas       Optional canvas rect
 * @returns            Snap deltas for each active edge, plus guides
 */
export function computeResizeSnap(
  resizingIds: string | Set<string>,
  edges: { left?: number; right?: number; top?: number; bottom?: number },
  allImages: ImageNode[],
  canvas: CanvasRect | null,
  rulerGuides?: RulerGuide[],
): { dx: number; dy: number; guides: SnapGuide[] } {
  const idSet = typeof resizingIds === 'string' ? new Set([resizingIds]) : resizingIds;
  const obstacles = allImages.filter((img) => !idSet.has(img.id)).map(visualBounds);

  const xTargets: number[] = [];
  const yTargets: number[] = [];

  for (const obs of obstacles) {
    xTargets.push(obs.x, obs.x + obs.width, obs.x + obs.width / 2);
    yTargets.push(obs.y, obs.y + obs.height, obs.y + obs.height / 2);
  }

  if (canvas) {
    xTargets.push(0, canvas.width, canvas.width / 2);
    yTargets.push(0, canvas.height, canvas.height / 2);
  }

  // Ruler guides
  if (rulerGuides) {
    for (const g of rulerGuides) {
      if (g.axis === 'x') xTargets.push(g.position);
      else yTargets.push(g.position);
    }
  }

  // Collect the edges being dragged as snap sources
  const xSources: number[] = [];
  const ySources: number[] = [];
  if (edges.left !== undefined) xSources.push(edges.left);
  if (edges.right !== undefined) xSources.push(edges.right);
  if (edges.top !== undefined) ySources.push(edges.top);
  if (edges.bottom !== undefined) ySources.push(edges.bottom);

  let bestDx = Infinity;
  let bestDy = Infinity;

  for (const src of xSources) {
    for (const tgt of xTargets) {
      const dist = Math.abs(src - tgt);
      if (dist < Math.abs(bestDx) && dist <= SNAP_THRESHOLD) {
        bestDx = tgt - src;
      }
    }
  }

  for (const src of ySources) {
    for (const tgt of yTargets) {
      const dist = Math.abs(src - tgt);
      if (dist < Math.abs(bestDy) && dist <= SNAP_THRESHOLD) {
        bestDy = tgt - src;
      }
    }
  }

  const dx = Math.abs(bestDx) <= SNAP_THRESHOLD ? bestDx : 0;
  const dy = Math.abs(bestDy) <= SNAP_THRESHOLD ? bestDy : 0;

  const guides: SnapGuide[] = [];
  const snappedX = xSources.map((s) => s + dx);
  const snappedY = ySources.map((s) => s + dy);

  for (const src of snappedX) {
    for (const tgt of xTargets) {
      if (Math.abs(src - tgt) < 0.5) {
        guides.push({ axis: 'x', position: tgt });
      }
    }
  }
  for (const src of snappedY) {
    for (const tgt of yTargets) {
      if (Math.abs(src - tgt) < 0.5) {
        guides.push({ axis: 'y', position: tgt });
      }
    }
  }

  const seen = new Set<string>();
  const uniqueGuides = guides.filter((g) => {
    const key = `${g.axis}:${g.position}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { dx, dy, guides: uniqueGuides };
}
