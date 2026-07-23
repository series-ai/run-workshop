import { useReducer, useCallback, useState } from 'react';
import type { WorkspaceState, WorkspaceAction, ImageNode } from './types';
import { readPngScaleFilter } from './pngChunks';
import optimise from '@jsquash/oxipng/optimise';
import { loadConfig } from './userConfig';

/** Convert a data URL to a Blob. */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header!.match(/:(.*?);/)?.[1] ?? 'image/png';
  const bytes = atob(base64!);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/** Convert any data: URL into a blob: URL. Pass-through for blob: URLs and
 *  empty/null. Heavy paint/mask payloads live as base64 strings on the JS heap
 *  otherwise; converting moves the bytes out to browser-managed Blob storage so
 *  history snapshots only need to retain a short URL string. */
function toBlobUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('blob:')) return url;
  if (url.startsWith('data:')) return URL.createObjectURL(dataUrlToBlob(url));
  return url;
}

/**
 * Losslessly optimise a PNG file on import via oxipng WASM.
 * Returns an object URL for the optimised (or original) image.
 */
async function optimiseAndCreateUrl(file: File): Promise<string> {
  if (file.type !== 'image/png') return URL.createObjectURL(file);
  try {
    const buf = await file.arrayBuffer();
    const optimised = await optimise(buf, { level: 1 });
    if (optimised.byteLength < buf.byteLength) {
      return URL.createObjectURL(new Blob([optimised], { type: 'image/png' }));
    }
  } catch { /* fall through */ }
  return URL.createObjectURL(file);
}

interface LoadedImage {
  file: File;
  src: string;
  w: number;
  h: number;
  nw: number;
  nh: number;
}

const MAX_IMPORT_DIM = 1024;

/** Optimise one file and measure its dimensions. Resolves null if the image fails to decode. */
async function loadSingleImage(file: File): Promise<LoadedImage | null> {
  const src = await optimiseAndCreateUrl(file);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > MAX_IMPORT_DIM || h > MAX_IMPORT_DIM) {
        const scale = MAX_IMPORT_DIM / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      resolve({ file, src, w, h, nw: img.naturalWidth, nh: img.naturalHeight });
    };
    img.onerror = () => {
      console.warn('Skipping image that failed to decode:', file.name);
      URL.revokeObjectURL(src);
      resolve(null);
    };
    img.src = src;
  });
}

const MIN_ZOOM = 0.01;
const MAX_ZOOM = 32;

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

function reassignZIndices(images: ImageNode[]): ImageNode[] {
  const sorted = [...images].sort((a, b) => a.zIndex - b.zIndex);
  return sorted.map((img, i) => ({ ...img, zIndex: i }));
}

// Check if two rects overlap on the perpendicular axis
function overlapsPerp(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  axis: 'x' | 'y',
): boolean {
  if (axis === 'x') {
    // Moving vertically, check horizontal overlap
    return a.x < b.x + b.width && a.x + a.width > b.x;
  }
  // Moving horizontally, check vertical overlap
  return a.y < b.y + b.height && a.y + a.height > b.y;
}

// Check if two rects overlap (both axes)
function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function alignImages(
  allImages: ImageNode[],
  ids: string[],
  direction: 'top' | 'bottom' | 'left' | 'right',
  padding: number = 0,
): ImageNode[] {
  const idSet = new Set(ids);
  const selected = allImages.filter((img) => idSet.has(img.id));
  if (selected.length < 2) return allImages;

  const gap = Math.max(0, Math.round(padding));

  const updates = new Map<string, { x: number; y: number }>();
  selected.forEach((img) => updates.set(img.id, { x: img.x, y: img.y }));

  {
    // Collision-based slide — only selected elements matter; unselected
    // elements are ignored so alignment is relative to the selection itself.
    if (direction === 'top') {
      const sorted = [...selected].sort((a, b) => a.y - b.y);
      for (const img of sorted) {
        const pos = updates.get(img.id)!;
        let targetY = -Infinity;
        for (const other of sorted) {
          if (other.id === img.id) break;
          const otherPos = updates.get(other.id)!;
          const otherRect = { ...other, ...otherPos };
          if (overlapsPerp({ ...img, ...pos }, otherRect, 'x') && otherPos.y + other.height <= pos.y) {
            targetY = Math.max(targetY, otherPos.y + other.height + gap);
          }
        }
        if (targetY === -Infinity) {
          targetY = Math.min(...sorted.map((s) => s.y));
        }
        pos.y = targetY;
      }
    } else if (direction === 'bottom') {
      const sorted = [...selected].sort((a, b) => (b.y + b.height) - (a.y + a.height));
      for (const img of sorted) {
        const pos = updates.get(img.id)!;
        let targetBottom = Infinity;
        for (const other of sorted) {
          if (other.id === img.id) break;
          const otherPos = updates.get(other.id)!;
          const otherRect = { ...other, ...otherPos };
          if (overlapsPerp({ ...img, ...pos }, otherRect, 'x') && otherPos.y >= pos.y + img.height) {
            targetBottom = Math.min(targetBottom, otherPos.y - gap);
          }
        }
        if (targetBottom === Infinity) {
          targetBottom = Math.max(...selected.map((s) => s.y + s.height));
        }
        pos.y = targetBottom - img.height;
      }
    } else if (direction === 'left') {
      const sorted = [...selected].sort((a, b) => a.x - b.x);
      for (const img of sorted) {
        const pos = updates.get(img.id)!;
        let targetX = -Infinity;
        for (const other of sorted) {
          if (other.id === img.id) break;
          const otherPos = updates.get(other.id)!;
          const otherRect = { ...other, ...otherPos };
          if (overlapsPerp({ ...img, ...pos }, otherRect, 'y') && otherPos.x + other.width <= pos.x) {
            targetX = Math.max(targetX, otherPos.x + other.width + gap);
          }
        }
        if (targetX === -Infinity) {
          targetX = Math.min(...sorted.map((s) => s.x));
        }
        pos.x = targetX;
      }
    } else if (direction === 'right') {
      const sorted = [...selected].sort((a, b) => (b.x + b.width) - (a.x + a.width));
      for (const img of sorted) {
        const pos = updates.get(img.id)!;
        let targetRight = Infinity;
        for (const other of sorted) {
          if (other.id === img.id) break;
          const otherPos = updates.get(other.id)!;
          const otherRect = { ...other, ...otherPos };
          if (overlapsPerp({ ...img, ...pos }, otherRect, 'y') && otherPos.x >= pos.x + img.width) {
            targetRight = Math.min(targetRight, otherPos.x - gap);
          }
        }
        if (targetRight === Infinity) {
          targetRight = Math.max(...selected.map((s) => s.x + s.width));
        }
        pos.x = targetRight - img.width;
      }
    }

    // Resolve any remaining overlaps among selected images.
    // When gap > 0 we treat each rect as inflated by `gap` in the stacking axis,
    // so neighbours end up with `gap` pixels of clear space between them.
    if (direction === 'top' || direction === 'bottom') {
      const sorted = [...selected].sort((a, b) => updates.get(a.id)!.x - updates.get(b.id)!.x);
      for (let i = 1; i < sorted.length; i++) {
        const curr = sorted[i]!;
        const currPos = updates.get(curr.id)!;
        const currRect = { x: currPos.x, y: currPos.y, width: curr.width, height: curr.height };
        for (let j = 0; j < i; j++) {
          const prev = sorted[j]!;
          const prevPos = updates.get(prev.id)!;
          const prevInflated = { x: prevPos.x, y: prevPos.y, width: prev.width + gap, height: prev.height };
          if (rectsOverlap(currRect, prevInflated)) {
            currPos.x = prevPos.x + prev.width + gap;
            currRect.x = currPos.x;
          }
        }
      }
    } else {
      const sorted = [...selected].sort((a, b) => updates.get(a.id)!.y - updates.get(b.id)!.y);
      for (let i = 1; i < sorted.length; i++) {
        const curr = sorted[i]!;
        const currPos = updates.get(curr.id)!;
        const currRect = { x: currPos.x, y: currPos.y, width: curr.width, height: curr.height };
        for (let j = 0; j < i; j++) {
          const prev = sorted[j]!;
          const prevPos = updates.get(prev.id)!;
          const prevInflated = { x: prevPos.x, y: prevPos.y, width: prev.width, height: prev.height + gap };
          if (rectsOverlap(currRect, prevInflated)) {
            currPos.y = prevPos.y + prev.height + gap;
            currRect.y = currPos.y;
          }
        }
      }
    }

  }

  return allImages.map((img) => {
    const pos = updates.get(img.id);
    if (!pos) return img;
    return { ...img, x: pos.x, y: pos.y };
  });
}

/**
 * Apply a fixed pixel gap between selected items along both axes.
 * Items only move when they are touching or too tightly spaced relative to
 * `gap`; intentionally larger spacing is preserved.
 */
function distributeGaps(allImages: ImageNode[], ids: string[], gap: number): ImageNode[] {
  const idSet = new Set(ids);
  const selected = allImages.filter((img) => idSet.has(img.id));
  if (selected.length < 2) return allImages;
  const g = Math.max(0, Math.round(gap));

  const updates = new Map<string, { x: number; y: number }>();
  selected.forEach((img) => updates.set(img.id, { x: img.x, y: img.y }));

  // X-axis pass
  {
    const sorted = [...selected].sort((a, b) => updates.get(a.id)!.x - updates.get(b.id)!.x);
    for (let i = 1; i < sorted.length; i++) {
      const curr = sorted[i]!;
      const currPos = updates.get(curr.id)!;
      const currRect = { x: currPos.x, y: currPos.y, width: curr.width, height: curr.height };
      for (let j = 0; j < i; j++) {
        const prev = sorted[j]!;
        const prevPos = updates.get(prev.id)!;
        const prevInflated = { x: prevPos.x, y: prevPos.y, width: prev.width + g, height: prev.height };
        if (rectsOverlap(currRect, prevInflated)) {
          currPos.x = prevPos.x + prev.width + g;
          currRect.x = currPos.x;
        }
      }
    }
  }

  // Y-axis pass
  {
    const sorted = [...selected].sort((a, b) => updates.get(a.id)!.y - updates.get(b.id)!.y);
    for (let i = 1; i < sorted.length; i++) {
      const curr = sorted[i]!;
      const currPos = updates.get(curr.id)!;
      const currRect = { x: currPos.x, y: currPos.y, width: curr.width, height: curr.height };
      for (let j = 0; j < i; j++) {
        const prev = sorted[j]!;
        const prevPos = updates.get(prev.id)!;
        const prevInflated = { x: prevPos.x, y: prevPos.y, width: prev.width, height: prev.height + g };
        if (rectsOverlap(currRect, prevInflated)) {
          currPos.y = prevPos.y + prev.height + g;
          currRect.y = currPos.y;
        }
      }
    }
  }

  return allImages.map((img) => {
    const pos = updates.get(img.id);
    if (!pos) return img;
    return { ...img, x: pos.x, y: pos.y };
  });
}

/** Get all descendant IDs of the given node IDs (recursive). */
function getAllDescendantIds(images: ImageNode[], ids: Set<string>): Set<string> {
  const all = new Set(ids);
  let added = true;
  while (added) {
    added = false;
    for (const img of images) {
      if (img.parentId && all.has(img.parentId) && !all.has(img.id)) {
        all.add(img.id);
        added = true;
      }
    }
  }
  return all;
}

/** Check if ancestorId is an ancestor of nodeId. */
function isAncestor(images: ImageNode[], ancestorId: string, nodeId: string): boolean {
  const byId = new Map(images.map((img) => [img.id, img]));
  let current = byId.get(nodeId);
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true;
    current = byId.get(current.parentId);
  }
  return false;
}

function capturePosition(img: ImageNode): import('./types').SavedPosition {
  return { x: img.x, y: img.y, width: img.width, height: img.height, rotation: img.rotation };
}

function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'LOAD_PROJECT': {
      // Stale blob URLs from the previous project are released by
      // historyReducer's reconcileBlobRefs once history is reset.
      return {
        images: action.images,
        selectedIds: new Set<string>(),
        lastSelectedId: null,
        pan: action.pan,
        zoom: action.zoom,
        canvas: action.canvas ?? null,
        scaleFilter: action.scaleFilter ?? loadConfig().defaultScaleFilter,
        snapEnabled: action.snapEnabled ?? false,
        projectName: action.projectName ?? null,
        guides: action.guides ?? [],
        canvasBgColor: action.canvasBgColor ?? null,
      };
    }

    case 'NEW_PROJECT': {
      // Stale blob URLs are released by historyReducer's reconcileBlobRefs.
      return { ...initialState, selectedIds: new Set<string>() };
    }

    case 'SET_PROJECT_NAME': {
      return { ...state, projectName: action.name };
    }

    case 'ADD_IMAGE': {
      const maxZ = state.images.reduce((max, img) => Math.max(max, img.zIndex), -1);
      const image = { ...action.image, zIndex: maxZ + 1 };
      return { ...state, images: [...state.images, image] };
    }

    case 'ADD_IMAGES': {
      let maxZ = state.images.reduce((max, img) => Math.max(max, img.zIndex), -1);
      const newImages = action.images.map((img) => ({ ...img, zIndex: ++maxZ }));
      return {
        ...state,
        images: [...state.images, ...newImages],
        selectedIds: new Set(newImages.map((img) => img.id)),
        lastSelectedId: newImages[newImages.length - 1]?.id ?? null,
      };
    }

    case 'REMOVE_IMAGES': {
      const lockedIds = new Set(state.images.filter((img) => img.locked).map((img) => img.id));
      const idSet = new Set(action.ids.filter((id) => !lockedIds.has(id)));
      if (idSet.size === 0) return state;
      // Detach children of removed nodes (they become roots)
      const remaining = state.images
        .filter((img) => !idSet.has(img.id))
        .map((img) => img.parentId && idSet.has(img.parentId) ? { ...img, parentId: null, basePosition: null, offsetPosition: null, replacesParent: false } : img);
      const newSelected = new Set<string>();
      state.selectedIds.forEach((id) => {
        if (!idSet.has(id)) newSelected.add(id);
      });
      const newLast = state.lastSelectedId && idSet.has(state.lastSelectedId) ? null : state.lastSelectedId;
      return { ...state, images: reassignZIndices(remaining), selectedIds: newSelected, lastSelectedId: newLast };
    }

    case 'MOVE_IMAGES': {
      // Expand to include all descendants so children follow parents
      const directlyDragged = new Set(action.ids);
      const idSet = getAllDescendantIds(state.images, directlyDragged);
      return {
        ...state,
        images: state.images.map((img) => {
          if (!idSet.has(img.id) || img.locked) return img;
          const updated: ImageNode = { ...img, x: img.x + action.dx, y: img.y + action.dy };
          // Only shift saved positions for elements dragged along by a parent,
          // not elements being directly dragged (user is repositioning them)
          if (!directlyDragged.has(img.id)) {
            if (updated.basePosition) {
              updated.basePosition = { ...updated.basePosition, x: updated.basePosition.x + action.dx, y: updated.basePosition.y + action.dy };
            }
            if (updated.offsetPosition) {
              updated.offsetPosition = { ...updated.offsetPosition, x: updated.offsetPosition.x + action.dx, y: updated.offsetPosition.y + action.dy };
            }
          }
          return updated;
        }),
      };
    }

    case 'RESIZE_IMAGE': {
      return {
        ...state,
        images: state.images.map((img) =>
          img.id === action.id && !img.locked
            ? { ...img, width: action.width, height: action.height, x: action.x, y: action.y }
            : img,
        ),
      };
    }

    case 'ROTATE_IMAGE': {
      return {
        ...state,
        images: state.images.map((img) =>
          img.id === action.id && !img.locked ? { ...img, rotation: action.rotation } : img,
        ),
      };
    }

    case 'SELECT': {
      const selTarget = state.images.find((img) => img.id === action.id);
      if (selTarget?.locked) return state;
      if (action.additive) {
        const newSelected = new Set(state.selectedIds);
        if (newSelected.has(action.id)) {
          newSelected.delete(action.id);
          // If we deselected the last selected, pick another
          const newLast = action.id === state.lastSelectedId
            ? (newSelected.size > 0 ? Array.from(newSelected).pop()! : null)
            : state.lastSelectedId;
          return { ...state, selectedIds: newSelected, lastSelectedId: newLast };
        } else {
          newSelected.add(action.id);
          return { ...state, selectedIds: newSelected, lastSelectedId: action.id };
        }
      }
      return { ...state, selectedIds: new Set([action.id]), lastSelectedId: action.id };
    }

    case 'SELECT_ALL': {
      const unlocked = state.images.filter((img) => !img.locked);
      const lastId = unlocked.length > 0 ? unlocked[unlocked.length - 1]!.id : null;
      return { ...state, selectedIds: new Set(unlocked.map((img) => img.id)), lastSelectedId: lastId };
    }

    case 'SELECT_MULTIPLE': {
      const lockedSet = new Set(state.images.filter((img) => img.locked).map((img) => img.id));
      const unlockedIds = action.ids.filter((id) => !lockedSet.has(id));
      const lastId = unlockedIds.length > 0 ? unlockedIds[unlockedIds.length - 1]! : state.lastSelectedId;
      if (action.additive) {
        const newSelected = new Set(state.selectedIds);
        unlockedIds.forEach((id) => newSelected.add(id));
        return { ...state, selectedIds: newSelected, lastSelectedId: lastId };
      }
      return { ...state, selectedIds: new Set(unlockedIds), lastSelectedId: lastId };
    }

    case 'SELECT_NONE': {
      return { ...state, selectedIds: new Set<string>(), lastSelectedId: null };
    }

    case 'SET_PAN': {
      return { ...state, pan: action.pan };
    }

    case 'SET_ZOOM': {
      return { ...state, zoom: clampZoom(action.zoom), pan: action.pan };
    }

    case 'ORIGINAL_SCALE': {
      if (state.images.length === 0) return state;
      return {
        ...state,
        images: state.images.map((img) => ({
          ...img,
          width: img.cropRect ? img.cropRect.w : img.naturalWidth,
          height: img.cropRect ? img.cropRect.h : img.naturalHeight,
        })),
      };
    }

    case 'ORIGINAL_SCALE_SELECTION': {
      const idSet = new Set(action.ids);
      const selected = state.images.filter((img) => idSet.has(img.id) && !img.locked);
      if (selected.length === 0) return state;

      if (selected.length === 1) {
        // Single image: just reset size, no position change needed
        return {
          ...state,
          images: state.images.map((img) => {
            if (!idSet.has(img.id) || img.locked) return img;
            return {
              ...img,
              width: img.cropRect ? img.cropRect.w : img.naturalWidth,
              height: img.cropRect ? img.cropRect.h : img.naturalHeight,
            };
          }),
        };
      }

      // Group: scale positions relative to group origin so spacing scales with size
      const originX = Math.min(...selected.map((img) => img.x));
      const originY = Math.min(...selected.map((img) => img.y));

      return {
        ...state,
        images: state.images.map((img) => {
          if (!idSet.has(img.id) || img.locked) return img;
          const newW = img.cropRect ? img.cropRect.w : img.naturalWidth;
          const newH = img.cropRect ? img.cropRect.h : img.naturalHeight;
          const scaleX = img.width > 0 ? newW / img.width : 1;
          const scaleY = img.height > 0 ? newH / img.height : 1;
          return {
            ...img,
            width: newW,
            height: newH,
            x: originX + (img.x - originX) * scaleX,
            y: originY + (img.y - originY) * scaleY,
          };
        }),
      };
    }

    case 'RESIZE_SELECTION': {
      const idSet = new Set(action.ids);
      const selected = state.images.filter((img) => idSet.has(img.id) && !img.locked);

      if (action.scaleTogether && selected.length > 1) {
        const originX = Math.min(...selected.map((img) => img.x));
        const originY = Math.min(...selected.map((img) => img.y));
        return {
          ...state,
          images: state.images.map((img) => {
            if (!idSet.has(img.id) || img.locked) return img;
            return {
              ...img,
              width: Math.max(20, Math.round(img.width * action.scaleX)),
              height: Math.max(20, Math.round(img.height * action.scaleY)),
              x: originX + (img.x - originX) * action.scaleX,
              y: originY + (img.y - originY) * action.scaleY,
            };
          }),
        };
      }

      return {
        ...state,
        images: state.images.map((img) => {
          if (!idSet.has(img.id) || img.locked) return img;
          return {
            ...img,
            width: Math.max(20, Math.round(img.width * action.scaleX)),
            height: Math.max(20, Math.round(img.height * action.scaleY)),
          };
        }),
      };
    }

    case 'NORMALIZE_SCALE': {
      if (state.images.length === 0) return state;
      return {
        ...state,
        images: state.images.map((img) => {
          const aspect = img.naturalWidth / img.naturalHeight;
          const newH = action.targetHeight;
          const newW = Math.round(newH * aspect);
          return { ...img, width: newW, height: newH };
        }),
      };
    }

    case 'SCALE_SELECTION_TO_LARGEST': {
      const idSet = new Set(action.ids);
      const selected = state.images.filter((img) => idSet.has(img.id) && !img.locked);
      if (selected.length === 0) return state;
      const maxH = Math.max(...selected.map((img) => img.height));
      return {
        ...state,
        images: state.images.map((img) => {
          if (!idSet.has(img.id) || img.locked) return img;
          const aspect = img.width / img.height;
          const newH = maxH;
          const newW = Math.round(newH * aspect);
          return { ...img, width: newW, height: newH };
        }),
      };
    }

    case 'SCALE_SELECTION_TO_SMALLEST': {
      const idSet = new Set(action.ids);
      const selected = state.images.filter((img) => idSet.has(img.id) && !img.locked);
      if (selected.length === 0) return state;
      const minH = Math.min(...selected.map((img) => img.height));
      return {
        ...state,
        images: state.images.map((img) => {
          if (!idSet.has(img.id) || img.locked) return img;
          const aspect = img.width / img.height;
          const newH = minH;
          const newW = Math.round(newH * aspect);
          return { ...img, width: newW, height: newH };
        }),
      };
    }

    case 'NORMALIZE_SELECTION': {
      const idSet = new Set(action.ids);
      return {
        ...state,
        images: state.images.map((img) => {
          if (!idSet.has(img.id) || img.locked) return img;
          const aspect = img.naturalWidth / img.naturalHeight;
          const newH = action.targetHeight;
          const newW = Math.round(newH * aspect);
          return { ...img, width: newW, height: newH };
        }),
      };
    }

    case 'ALIGN': {
      return {
        ...state,
        images: alignImages(state.images, action.ids, action.direction, action.padding ?? 0),
      };
    }

    case 'DISTRIBUTE_GAPS': {
      return {
        ...state,
        images: distributeGaps(state.images, action.ids, action.gap),
      };
    }

    case 'ARRANGE_GRID': {
      const idSet = new Set(action.ids);
      const selected = state.images.filter((img) => idSet.has(img.id));
      if (selected.length < 2) return state;

      // Sort by fileName naturally
      const sorted = [...selected].sort((a, b) =>
        a.fileName.localeCompare(b.fileName, undefined, { numeric: true, sensitivity: 'base' }),
      );

      // Use top-left of selection bounding box as origin
      const originX = Math.min(...selected.map((img) => img.x));
      const originY = Math.min(...selected.map((img) => img.y));
      const cols = Math.ceil(Math.sqrt(sorted.length));

      // Build rows
      const rows: ImageNode[][] = [];
      for (let i = 0; i < sorted.length; i += cols) {
        rows.push(sorted.slice(i, i + cols));
      }

      // Column widths and row heights
      const colWidths: number[] = [];
      for (let c = 0; c < cols; c++) {
        let maxW = 0;
        for (const row of rows) {
          const cell = row[c];
          if (cell) maxW = Math.max(maxW, cell.width);
        }
        colWidths.push(maxW);
      }
      const rowHeights = rows.map((row) => Math.max(...row.map((img) => img.height)));

      // Build position map
      const posMap = new Map<string, { x: number; y: number }>();
      let curY = originY;
      for (let r = 0; r < rows.length; r++) {
        let curX = originX;
        for (let c = 0; c < rows[r]!.length; c++) {
          const img = rows[r]![c]!;
          posMap.set(img.id, { x: curX, y: curY });
          curX += colWidths[c]!;
        }
        curY += rowHeights[r]!;
      }

      return {
        ...state,
        images: state.images.map((img) => {
          const pos = posMap.get(img.id);
          return pos ? { ...img, x: pos.x, y: pos.y } : img;
        }),
      };
    }

    case 'ARRANGE_STRIP': {
      const idSet = new Set(action.ids);
      const selected = state.images.filter((img) => idSet.has(img.id));
      if (selected.length < 2) return state;

      const sorted = [...selected].sort((a, b) =>
        a.fileName.localeCompare(b.fileName, undefined, { numeric: true, sensitivity: 'base' }),
      );

      const originX = Math.min(...selected.map((img) => img.x));
      const originY = Math.min(...selected.map((img) => img.y));

      const posMap = new Map<string, { x: number; y: number }>();
      let curX = originX;
      for (const img of sorted) {
        posMap.set(img.id, { x: curX, y: originY });
        curX += img.width;
      }

      return {
        ...state,
        images: state.images.map((img) => {
          const pos = posMap.get(img.id);
          return pos ? { ...img, x: pos.x, y: pos.y } : img;
        }),
      };
    }

    case 'ARRANGE_LIST': {
      const idSet = new Set(action.ids);
      const selected = state.images.filter((img) => idSet.has(img.id));
      if (selected.length < 2) return state;

      const sorted = [...selected].sort((a, b) =>
        a.fileName.localeCompare(b.fileName, undefined, { numeric: true, sensitivity: 'base' }),
      );

      const originX = Math.min(...selected.map((img) => img.x));
      const originY = Math.min(...selected.map((img) => img.y));

      const posMap = new Map<string, { x: number; y: number }>();
      let curY = originY;
      for (const img of sorted) {
        posMap.set(img.id, { x: originX, y: curY });
        curY += img.height;
      }

      return {
        ...state,
        images: state.images.map((img) => {
          const pos = posMap.get(img.id);
          return pos ? { ...img, x: pos.x, y: pos.y } : img;
        }),
      };
    }

    case 'BRING_TO_FRONT': {
      const maxZ = state.images.reduce((max, img) => Math.max(max, img.zIndex), 0);
      return {
        ...state,
        images: reassignZIndices(
          state.images.map((img) => (img.id === action.id ? { ...img, zIndex: maxZ + 1 } : img)),
        ),
      };
    }

    case 'SEND_TO_BACK': {
      const minZ = state.images.reduce((min, img) => Math.min(min, img.zIndex), 0);
      return {
        ...state,
        images: reassignZIndices(
          state.images.map((img) => (img.id === action.id ? { ...img, zIndex: minZ - 1 } : img)),
        ),
      };
    }

    case 'BRING_FORWARD': {
      const target = state.images.find((img) => img.id === action.id);
      if (!target) return state;
      const above = state.images
        .filter((img) => img.zIndex > target.zIndex)
        .sort((a, b) => a.zIndex - b.zIndex)[0];
      if (!above) return state;
      return {
        ...state,
        images: reassignZIndices(
          state.images.map((img) => {
            if (img.id === target.id) return { ...img, zIndex: above.zIndex + 0.5 };
            return img;
          }),
        ),
      };
    }

    case 'SCALE_GROUP': {
      const idSet = new Set(action.ids);
      const { scaleX, scaleY, originX, originY } = action;
      return {
        ...state,
        images: state.images.map((img) => {
          if (!idSet.has(img.id) || img.locked) return img;
          const newX = originX + (img.x - originX) * scaleX;
          const newY = originY + (img.y - originY) * scaleY;
          const newW = img.width * scaleX;
          const newH = img.height * scaleY;
          return {
            ...img,
            x: newX,
            y: newY,
            width: Math.max(20, newW),
            height: Math.max(20, newH),
          };
        }),
      };
    }

    case 'ROTATE_GROUP': {
      const idSet = new Set(action.ids);
      const { deltaRotation, originX, originY } = action;
      const rad = (deltaRotation * Math.PI) / 180;
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);
      return {
        ...state,
        images: state.images.map((img) => {
          if (!idSet.has(img.id) || img.locked) return img;
          // Rotate the image center around the group origin
          const imgCx = img.x + img.width / 2;
          const imgCy = img.y + img.height / 2;
          const relX = imgCx - originX;
          const relY = imgCy - originY;
          const newCx = originX + relX * cosA - relY * sinA;
          const newCy = originY + relX * sinA + relY * cosA;
          return {
            ...img,
            x: newCx - img.width / 2,
            y: newCy - img.height / 2,
            rotation: img.rotation + deltaRotation,
          };
        }),
      };
    }

    case 'SEND_BACKWARD': {
      const target = state.images.find((img) => img.id === action.id);
      if (!target) return state;
      const below = state.images
        .filter((img) => img.zIndex < target.zIndex)
        .sort((a, b) => b.zIndex - a.zIndex)[0];
      if (!below) return state;
      return {
        ...state,
        images: reassignZIndices(
          state.images.map((img) => {
            if (img.id === target.id) return { ...img, zIndex: below.zIndex - 0.5 };
            return img;
          }),
        ),
      };
    }

    case 'SET_CANVAS': {
      return { ...state, canvas: action.canvas };
    }

    case 'MAKE_CANVAS_FROM_SELECTION': {
      const idSet = new Set(action.ids);
      const selected = state.images.filter((img) => idSet.has(img.id));
      if (selected.length === 0) return state;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const img of selected) {
        const cx = img.x + img.width / 2;
        const cy = img.y + img.height / 2;
        const rad = (img.rotation * Math.PI) / 180;
        const cos = Math.abs(Math.cos(rad));
        const sin = Math.abs(Math.sin(rad));
        const rbw = img.width * cos + img.height * sin;
        const rbh = img.width * sin + img.height * cos;
        minX = Math.min(minX, cx - rbw / 2);
        minY = Math.min(minY, cy - rbh / 2);
        maxX = Math.max(maxX, cx + rbw / 2);
        maxY = Math.max(maxY, cy + rbh / 2);
      }
      const bw = Math.round(maxX - minX);
      const bh = Math.round(maxY - minY);
      return {
        ...state,
        canvas: { width: bw, height: bh },
        images: state.images.map((img) =>
          idSet.has(img.id) ? { ...img, x: img.x - minX, y: img.y - minY } : img,
        ),
      };
    }

    case 'SET_SCALE_FILTER': {
      return { ...state, scaleFilter: action.filter };
    }

    case 'SET_SNAP': {
      return { ...state, snapEnabled: action.enabled };
    }

    case 'SPLIT_IMAGE': {
      const idx = state.images.findIndex((img) => img.id === action.originalId);
      if (idx === -1) return state;
      // Don't revoke the original blob URL — pieces share it
      // Replace original with pieces, assign consecutive zIndex values
      const before = state.images.slice(0, idx);
      const after = state.images.slice(idx + 1);
      const newImages = [...before, ...action.pieces, ...after];
      const pieceIds = new Set(action.pieces.map((p) => p.id));
      return {
        ...state,
        images: reassignZIndices(newImages),
        selectedIds: pieceIds,
        lastSelectedId: action.pieces.length > 0 ? action.pieces[action.pieces.length - 1]!.id : null,
      };
    }

    case 'TOGGLE_LOCK': {
      const idSet = new Set(action.ids);
      const targets = state.images.filter((img) => idSet.has(img.id));
      if (targets.length === 0) return state;
      const allLocked = targets.every((img) => img.locked);
      const newImages = state.images.map((img) =>
        idSet.has(img.id) ? { ...img, locked: !allLocked } : img,
      );
      // Deselect images that are being locked
      const newSelected = allLocked
        ? state.selectedIds
        : new Set([...state.selectedIds].filter((id) => !idSet.has(id)));
      const newLast = state.lastSelectedId && newSelected.has(state.lastSelectedId)
        ? state.lastSelectedId
        : (newSelected.size > 0 ? Array.from(newSelected).pop()! : null);
      return { ...state, images: newImages, selectedIds: newSelected, lastSelectedId: newLast };
    }

    case 'SET_OPACITY': {
      const idSet = new Set(action.ids);
      return {
        ...state,
        images: state.images.map((img) =>
          idSet.has(img.id) ? { ...img, opacity: action.opacity } : img,
        ),
      };
    }

    case 'SET_ADJUSTMENTS': {
      const idSet = new Set(action.ids);
      return {
        ...state,
        images: state.images.map((img) =>
          idSet.has(img.id) ? { ...img, ...action.updates } : img,
        ),
      };
    }

    case 'RENAME_IMAGE': {
      return {
        ...state,
        images: state.images.map((img) =>
          img.id === action.id ? { ...img, spriteName: action.spriteName } : img,
        ),
      };
    }

    case 'SET_CROP': {
      return {
        ...state,
        images: state.images.map((img) =>
          img.id === action.id
            ? { ...img, cropRect: action.cropRect, width: action.width, height: action.height, x: action.x, y: action.y }
            : img,
        ),
      };
    }

    case 'SET_CROP_RECT': {
      return {
        ...state,
        images: state.images.map((img) => {
          if (img.id !== action.id) return img;
          const oldCropX = img.cropRect ? img.cropRect.x : 0;
          const oldCropY = img.cropRect ? img.cropRect.y : 0;
          const oldCropW = img.cropRect ? img.cropRect.w : img.naturalWidth;
          const oldCropH = img.cropRect ? img.cropRect.h : img.naturalHeight;
          // Per-axis scales preserve any non-uniform stretch the user applied with shift-resize
          const scaleX = img.width / oldCropW;
          const scaleY = img.height / oldCropH;
          const newCropX = action.cropRect ? action.cropRect.x : 0;
          const newCropY = action.cropRect ? action.cropRect.y : 0;
          const newCropW = action.cropRect ? action.cropRect.w : img.naturalWidth;
          const newCropH = action.cropRect ? action.cropRect.h : img.naturalHeight;
          const dx = (newCropX - oldCropX) * scaleX;
          const dy = (newCropY - oldCropY) * scaleY;
          return {
            ...img,
            cropRect: action.cropRect,
            width: Math.round(newCropW * scaleX),
            height: Math.round(newCropH * scaleY),
            x: img.x + dx,
            y: img.y + dy,
          };
        }),
      };
    }

    case 'DUPLICATE_IMAGES': {
      const idSet = new Set(action.ids);
      const toDuplicate = state.images.filter((img) => idSet.has(img.id));
      if (toDuplicate.length === 0) return state;
      const maxZ = state.images.reduce((max, img) => Math.max(max, img.zIndex), -1);
      const newImages: ImageNode[] = toDuplicate.map((img, i) => ({
        ...img,
        id: crypto.randomUUID(),
        x: img.x + 20,
        y: img.y + 20,
        zIndex: maxZ + 1 + i,
        locked: false,
        parentId: null,
        basePosition: null,
        offsetPosition: null,
        replacesParent: false,
      }));
      const newIds = new Set(newImages.map((img) => img.id));
      return {
        ...state,
        images: [...state.images, ...newImages],
        selectedIds: newIds,
        lastSelectedId: newImages[newImages.length - 1]!.id,
      };
    }

    case 'REPLACE_SOURCE': {
      const idSet = new Set(action.ids);
      return {
        ...state,
        images: state.images.map((img) =>
          idSet.has(img.id)
            ? {
                ...img,
                src: action.src,
                fileName: action.fileName,
                naturalWidth: action.naturalWidth,
                naturalHeight: action.naturalHeight,
              }
            : img,
        ),
      };
    }

    case 'BAKE_IMAGE': {
      // Atomically swap the source to a freshly-flattened version and drop every
      // pixel-modifying piece of edit state. One history entry per bake.
      const newSrc = toBlobUrl(action.src) ?? action.src;
      return {
        ...state,
        images: state.images.map((img) =>
          img.id === action.id
            ? {
                ...img,
                src: newSrc,
                naturalWidth: action.naturalWidth,
                naturalHeight: action.naturalHeight,
                cropRect: undefined,
                maskDataUrl: null,
                paintLayers: null,
                paintOverlayUrl: null,
                paintUnderlayUrl: null,
                paintCompositeUrl: null,
                flipH: false,
                flipV: false,
                bgColor: null,
                brightness: undefined,
                contrast: undefined,
                saturation: undefined,
                hue: undefined,
              }
            : img,
        ),
      };
    }

    case 'SET_MASK': {
      const maskUrl = toBlobUrl(action.maskDataUrl);
      return {
        ...state,
        images: state.images.map((img) =>
          img.id === action.id ? { ...img, maskDataUrl: maskUrl } : img,
        ),
      };
    }

    case 'SET_IMAGE_SRC': {
      const newSrc = action.src.startsWith('blob:') ? action.src : URL.createObjectURL(dataUrlToBlob(action.src));
      return {
        ...state,
        images: state.images.map((img) =>
          img.id === action.id ? { ...img, src: newSrc } : img,
        ),
      };
    }

    case 'SET_PAINT_LAYERS': {
      const paintLayers = action.paintLayers
        ? action.paintLayers.map((l) => l.dataUrl ? { ...l, dataUrl: toBlobUrl(l.dataUrl) ?? '' } : l)
        : null;
      const paintOverlayUrl = toBlobUrl(action.paintOverlayUrl);
      const paintUnderlayUrl = toBlobUrl(action.paintUnderlayUrl);
      const paintCompositeUrl = toBlobUrl(action.paintCompositeUrl);
      return {
        ...state,
        images: state.images.map((img) =>
          img.id === action.id ? { ...img, paintLayers, paintOverlayUrl, paintUnderlayUrl, paintCompositeUrl } : img,
        ),
      };
    }

    case 'ATTACH_TO_PARENT': {
      const { childId, parentId } = action;
      if (childId === parentId) return state;
      if (isAncestor(state.images, childId, parentId)) return state;
      const child = state.images.find((img) => img.id === childId);
      if (!child) return state;
      return {
        ...state,
        images: state.images.map((img) =>
          img.id === childId ? { ...img, parentId, layerOrder: img.layerOrder ?? 'above' } : img,
        ),
      };
    }

    case 'DETACH_FROM_PARENT': {
      return {
        ...state,
        images: state.images.map((img) =>
          img.id === action.childId ? { ...img, parentId: null, basePosition: null, offsetPosition: null, replacesParent: false } : img,
        ),
      };
    }

    case 'SET_LAYER_ORDER': {
      const child = state.images.find((img) => img.id === action.id);
      if (!child || !child.parentId) return state;
      const parent = state.images.find((img) => img.id === child.parentId);
      if (!parent) return state;

      // Place child directly above or below parent in z-order
      let newZ: number;
      if (action.layerOrder === 'above') {
        newZ = parent.zIndex + 0.5;
      } else {
        newZ = parent.zIndex - 0.5;
      }

      return {
        ...state,
        images: reassignZIndices(
          state.images.map((img) =>
            img.id === action.id ? { ...img, zIndex: newZ, layerOrder: action.layerOrder } : img,
          ),
        ),
      };
    }

    case 'SET_BASE_POSITION': {
      const img = state.images.find((i) => i.id === action.id);
      if (!img || !img.parentId) return state;
      return {
        ...state,
        images: state.images.map((i) =>
          i.id === action.id ? { ...i, basePosition: capturePosition(i) } : i,
        ),
      };
    }

    case 'SET_OFFSET_POSITION': {
      const img = state.images.find((i) => i.id === action.id);
      if (!img || !img.parentId) return state;
      return {
        ...state,
        images: state.images.map((i) =>
          i.id === action.id ? { ...i, offsetPosition: capturePosition(i) } : i,
        ),
      };
    }

    case 'GOTO_BASE_POSITION': {
      const img = state.images.find((i) => i.id === action.id);
      if (!img?.basePosition) return state;
      const bp = img.basePosition;
      return {
        ...state,
        images: state.images.map((i) =>
          i.id === action.id ? { ...i, x: bp.x, y: bp.y, width: bp.width, height: bp.height, rotation: bp.rotation } : i,
        ),
      };
    }

    case 'GOTO_OFFSET_POSITION': {
      const img = state.images.find((i) => i.id === action.id);
      if (!img?.offsetPosition) return state;
      const op = img.offsetPosition;
      return {
        ...state,
        images: state.images.map((i) =>
          i.id === action.id ? { ...i, x: op.x, y: op.y, width: op.width, height: op.height, rotation: op.rotation } : i,
        ),
      };
    }

    case 'SET_REPLACES_PARENT': {
      return {
        ...state,
        images: state.images.map((img) =>
          img.id === action.id ? { ...img, replacesParent: action.replaces } : img,
        ),
      };
    }

    case 'ADD_GUIDE': {
      return { ...state, guides: [...state.guides, action.guide] };
    }

    case 'MOVE_GUIDE': {
      return {
        ...state,
        guides: state.guides.map((g) =>
          g.id === action.id ? { ...g, position: action.position } : g,
        ),
      };
    }

    case 'REMOVE_GUIDE': {
      return { ...state, guides: state.guides.filter((g) => g.id !== action.id) };
    }

    case 'CLEAR_GUIDES': {
      return { ...state, guides: [] };
    }

    case 'SET_CANVAS_BG_COLOR': {
      return { ...state, canvasBgColor: action.color };
    }

    case 'FLIP_IMAGES': {
      const idSet = new Set(action.ids);
      return {
        ...state,
        images: state.images.map((img) => {
          if (!idSet.has(img.id) || img.locked) return img;
          if (action.axis === 'h') return { ...img, flipH: !img.flipH };
          return { ...img, flipV: !img.flipV };
        }),
      };
    }

    case 'SET_BG_COLOR': {
      const idSet = new Set(action.ids);
      return {
        ...state,
        images: state.images.map((img) => idSet.has(img.id) ? { ...img, bgColor: action.color } : img),
      };
    }

    case 'UPDATE_TEXT': {
      return {
        ...state,
        images: state.images.map((img) =>
          img.id === action.id ? { ...img, ...action.updates } : img,
        ),
      };
    }

    default:
      return state;
  }
}

const initialState: WorkspaceState = {
  images: [],
  selectedIds: new Set<string>(),
  lastSelectedId: null,
  pan: { x: 0, y: 0 },
  zoom: 1,
  canvas: null,
  scaleFilter: loadConfig().defaultScaleFilter,
  snapEnabled: false,
  projectName: null,
  guides: [],
  canvasBgColor: null,
};

const MAX_HISTORY = 20;

/** Collect every blob: URL referenced by an image into the given set. */
function collectBlobUrls(image: ImageNode, into: Set<string>): void {
  const add = (u: string | null | undefined) => { if (u && u.startsWith('blob:')) into.add(u); };
  add(image.src);
  add(image.maskDataUrl);
  add(image.paintOverlayUrl);
  add(image.paintUnderlayUrl);
  add(image.paintCompositeUrl);
  if (image.paintLayers) {
    for (const l of image.paintLayers) add(l.dataUrl);
  }
}

function urlSetOfHistory(h: HistoryState): Set<string> {
  const s = new Set<string>();
  for (const img of h.current.images) collectBlobUrls(img, s);
  for (const slot of h.past) for (const img of slot.images) collectBlobUrls(img, s);
  for (const slot of h.future) for (const img of slot.images) collectBlobUrls(img, s);
  return s;
}

/** Revoke any blob: URL that was reachable from oldH but is no longer reachable
 *  from newH. Safe across undo/redo because URLs referenced by past or future
 *  slots stay alive — only truly orphaned URLs get revoked. */
function reconcileBlobRefs(oldH: HistoryState, newH: HistoryState): void {
  const oldS = urlSetOfHistory(oldH);
  const newS = urlSetOfHistory(newH);
  for (const url of oldS) {
    if (!newS.has(url)) URL.revokeObjectURL(url);
  }
}

// Actions that don't modify image data — no undo entry needed
const NON_UNDOABLE: Set<string> = new Set([
  'SELECT', 'SELECT_NONE', 'SELECT_ALL', 'SELECT_MULTIPLE',
  'SET_PAN', 'SET_ZOOM',
  'UNDO', 'REDO', 'SNAPSHOT',
  'SET_SCALE_FILTER', 'SET_SNAP',
  'SET_PROJECT_NAME', 'NEW_PROJECT',
]);

// Actions that fire continuously during a drag — the component dispatches
// SNAPSHOT once before starting, so these don't create entries
const CONTINUOUS: Set<string> = new Set([
  'MOVE_IMAGES', 'RESIZE_IMAGE', 'ROTATE_IMAGE',
  'SCALE_GROUP', 'ROTATE_GROUP',
  'MOVE_GUIDE',
  'DISTRIBUTE_GAPS',
]);

interface HistoryState {
  current: WorkspaceState;
  past: WorkspaceState[];
  future: WorkspaceState[];
}

function historyReducer(history: HistoryState, action: WorkspaceAction): HistoryState {
  const next = computeNextHistory(history, action);
  if (next !== history) reconcileBlobRefs(history, next);
  return next;
}

function computeNextHistory(history: HistoryState, action: WorkspaceAction): HistoryState {
  // Purge undo/redo snapshots (keep the current state) — historyReducer's
  // reconcileBlobRefs then revokes every blob URL only the history referenced,
  // freeing memory held by deleted images.
  if (action.type === 'CLEAR_HISTORY') {
    if (history.past.length === 0 && history.future.length === 0) return history;
    return { current: history.current, past: [], future: [] };
  }

  if (action.type === 'UNDO') {
    if (history.past.length === 0) return history;
    const prev = history.past[history.past.length - 1]!;
    return {
      current: { ...prev, selectedIds: history.current.selectedIds, lastSelectedId: history.current.lastSelectedId },
      past: history.past.slice(0, -1),
      future: [history.current, ...history.future].slice(0, MAX_HISTORY),
    };
  }

  if (action.type === 'REDO') {
    if (history.future.length === 0) return history;
    const next = history.future[0]!;
    return {
      current: { ...next, selectedIds: history.current.selectedIds, lastSelectedId: history.current.lastSelectedId },
      past: [...history.past, history.current].slice(-MAX_HISTORY),
      future: history.future.slice(1),
    };
  }

  if (action.type === 'SNAPSHOT') {
    // Manually push current state to history (used before continuous operations)
    return {
      current: history.current,
      past: [...history.past, history.current].slice(-MAX_HISTORY),
      future: [],
    };
  }

  const newState = workspaceReducer(history.current, action);
  if (newState === history.current) return history;

  // NEW_PROJECT and LOAD_PROJECT reset history entirely
  if (action.type === 'NEW_PROJECT' || action.type === 'LOAD_PROJECT') {
    return { current: newState, past: [], future: [] };
  }

  // BAKE_IMAGE is a targeted "freeze" of one image. It must:
  //   - not push a history entry (the dialog promises it cannot be undone), and
  //   - retroactively apply the baked fields to every past/future snapshot so
  //     the now-orphaned mask/paint URLs become unreachable and reconcileBlobRefs
  //     revokes them. This preserves all other undo history (moves, alignments,
  //     edits to other elements) — only this image's layered state is wiped.
  if (action.type === 'BAKE_IMAGE') {
    const bakedImg = newState.images.find((i) => i.id === action.id);
    if (!bakedImg) return { ...history, current: newState };
    const bakedFields = {
      src: bakedImg.src,
      naturalWidth: bakedImg.naturalWidth,
      naturalHeight: bakedImg.naturalHeight,
      cropRect: undefined,
      maskDataUrl: null,
      paintLayers: null,
      paintOverlayUrl: null,
      paintUnderlayUrl: null,
      paintCompositeUrl: null,
      flipH: false,
      flipV: false,
      bgColor: null,
    };
    const overlay = (s: WorkspaceState): WorkspaceState => ({
      ...s,
      images: s.images.map((img) => img.id === action.id ? { ...img, ...bakedFields } : img),
    });
    return {
      current: newState,
      past: history.past.map(overlay),
      future: history.future.map(overlay),
    };
  }

  // Non-undoable actions: just update current, don't touch history
  if (NON_UNDOABLE.has(action.type)) {
    return { ...history, current: newState };
  }

  // Continuous actions: update current but don't push history (SNAPSHOT already did)
  if (CONTINUOUS.has(action.type)) {
    return { ...history, current: newState };
  }

  // All other actions: push current to past, clear future
  return {
    current: newState,
    past: [...history.past, history.current].slice(-MAX_HISTORY),
    future: [],
  };
}

const initialHistoryState: HistoryState = {
  current: initialState,
  past: [],
  future: [],
};

export interface ImportProgress {
  current: number;
  total: number;
}

export function useWorkspaceState() {
  const [history, dispatch] = useReducer(historyReducer, initialHistoryState);
  const state = history.current;
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);

  /** Load multiple files and arrange them in a grid sorted by filename. */
  const addImagesFromFiles = useCallback((files: File[], originX: number, originY: number, onScaleFilterDetected?: (filter: string) => void, onComplete?: (ids: string[]) => void) => {
    if (files.length === 0) return;

    // Natural sort by filename so "2.png" comes before "10.png"
    const sorted = [...files].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
    );

    // Check first PNG for scale filter metadata before optimisation strips it
    if (onScaleFilterDetected) {
      const firstPng = sorted.find((f) => f.type === 'image/png');
      if (firstPng) {
        readPngScaleFilter(firstPng).then((detected) => {
          if (detected) onScaleFilterDetected(detected);
        });
      }
    }

    // Process images one at a time to avoid overwhelming WASM
    (async () => {
      const total = sorted.length;
      const loaded: LoadedImage[] = [];

      for (let i = 0; i < total; i++) {
        setImportProgress({ current: i + 1, total });
        const item = await loadSingleImage(sorted[i]!);
        if (item) loaded.push(item);
      }

      setImportProgress(null);
      if (loaded.length === 0) return;

      // Determine grid columns: sqrt of count, rounded up
      const cols = Math.ceil(Math.sqrt(loaded.length));

      // Build rows and compute column widths / row heights
      const rows: LoadedImage[][] = [];
      for (let i = 0; i < loaded.length; i += cols) {
        rows.push(loaded.slice(i, i + cols));
      }

      const colWidths: number[] = [];
      for (let c = 0; c < cols; c++) {
        let maxW = 0;
        for (const row of rows) {
          const cell = row[c];
          if (cell) maxW = Math.max(maxW, cell.w);
        }
        colWidths.push(maxW);
      }

      const rowHeights: number[] = rows.map((row) =>
        Math.max(...row.map((item) => item.h)),
      );

      // Place images in the grid
      const nodes: ImageNode[] = [];
      let curY = originY;
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r]!;
        let curX = originX;
        for (let c = 0; c < row.length; c++) {
          const item = row[c]!;
          nodes.push({
            id: crypto.randomUUID(),
            src: item.src,
            fileName: item.file.name,
            x: curX,
            y: curY,
            width: item.w,
            height: item.h,
            naturalWidth: item.nw,
            naturalHeight: item.nh,
            rotation: 0,
            zIndex: 0,
            locked: false,
            opacity: 1,
            spriteName: '',
            parentId: null,
            basePosition: null,
            offsetPosition: null,
            layerOrder: 'above',
            replacesParent: false,
            flipH: false,
            flipV: false,
          });
          curX += colWidths[c]!;
        }
        curY += rowHeights[r]!;
      }

      dispatch({ type: 'ADD_IMAGES', images: nodes });
      if (onComplete) onComplete(nodes.map((n) => n.id));
    })();
  }, []);

  const addImageFromFile = useCallback((file: File, dropX?: number, dropY?: number, onScaleFilterDetected?: (filter: string) => void, onImageSize?: (w: number, h: number) => void) => {
    // Check for embedded scale filter metadata before optimisation (which strips chunks)
    if (onScaleFilterDetected && file.type === 'image/png') {
      readPngScaleFilter(file).then((detected) => {
        if (detected) onScaleFilterDetected(detected);
      });
    }

    (async () => {
      setImportProgress({ current: 1, total: 1 });
      const loaded = await loadSingleImage(file);
      setImportProgress(null);
      if (!loaded) return;

      if (onImageSize) onImageSize(loaded.nw, loaded.nh);

      const node: ImageNode = {
        id: crypto.randomUUID(),
        src: loaded.src,
        fileName: file.name,
        x: dropX ?? 100,
        y: dropY ?? 100,
        width: loaded.w,
        height: loaded.h,
        naturalWidth: loaded.nw,
        naturalHeight: loaded.nh,
        rotation: 0,
        zIndex: 0,
        locked: false,
        opacity: 1,
        spriteName: '',
        parentId: null,
        basePosition: null,
        offsetPosition: null,
        layerOrder: 'above',
        replacesParent: false,
        flipH: false,
        flipV: false,
      };
      dispatch({ type: 'ADD_IMAGE', image: node });
    })();
  }, []);

  const addImageFromUrl = useCallback((url: string, dropX?: number, dropY?: number) => {
    const loadViaProxy = (imageUrl: string) => {
      const proxyUrl = `/__proxy?url=${encodeURIComponent(imageUrl)}`;
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > MAX_IMPORT_DIM || h > MAX_IMPORT_DIM) {
          const scale = MAX_IMPORT_DIM / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext('2d')!.drawImage(img, 0, 0);
        c.toBlob((blob) => {
          const src = blob ? URL.createObjectURL(blob) : proxyUrl;
          const node: ImageNode = {
            id: crypto.randomUUID(),
            src,
            fileName: (() => {
              const raw = imageUrl.split('/').pop()?.split('?')[0] || 'image.png';
              try { return decodeURIComponent(raw); } catch { return raw; }
            })(),
            x: dropX ?? 100,
            y: dropY ?? 100,
            width: w,
            height: h,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            rotation: 0,
            zIndex: 0,
            locked: false,
            opacity: 1,
            spriteName: '',
            parentId: null,
            basePosition: null,
            offsetPosition: null,
            layerOrder: 'above',
            replacesParent: false,
            flipH: false,
            flipV: false,
          };
          dispatch({ type: 'ADD_IMAGE', image: node });
        }, 'image/png');
      };
      img.onerror = () => {
        console.warn('Could not load image via proxy:', imageUrl);
        alert(`Could not load image.\n\nTry right-clicking the image and choosing "Copy Image", then paste here with Ctrl+V.`);
      };
      img.src = proxyUrl;
    };

    // Check if URL is an image by fetching headers through the proxy
    // If it's a page, try to extract og:image from the HTML
    const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|svg|avif|bmp|ico)(\?|$)/i;

    fetch(`/__proxy?url=${encodeURIComponent(url)}`).then(async (resp) => {
      const contentType = resp.headers.get('content-type') || '';
      if (contentType.startsWith('image/')) {
        // Direct image URL — load it
        loadViaProxy(url);
      } else if (IMAGE_EXT_RE.test(new URL(url).pathname)) {
        // URL has an image extension but server returned unexpected content-type
        // (e.g. Midjourney CDN) — try loading it as an image anyway
        loadViaProxy(url);
      } else {
        // Probably a page — try to extract image URL from it
        const text = await resp.text();
        // Check for imgurl param (Google), og:image meta, or twitter:image
        let imageUrl: string | null = null;
        try {
          const parsed = new URL(url);
          imageUrl = parsed.searchParams.get('imgurl');
        } catch { /* ignore */ }
        if (!imageUrl) {
          const ogMatch = text.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
            || text.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
          if (ogMatch) imageUrl = ogMatch[1]!;
        }
        if (!imageUrl) {
          const twMatch = text.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
            || text.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
          if (twMatch) imageUrl = twMatch[1]!;
        }
        if (imageUrl) {
          loadViaProxy(imageUrl);
        } else {
          console.warn('No image found at URL:', url);
          alert(`Could not find an image at this URL.\n\nTry right-clicking the image and choosing "Copy Image", then paste here with Ctrl+V.`);
        }
      }
    }).catch(() => {
      // Fetch itself failed — try loading directly as image anyway
      loadViaProxy(url);
    });
  }, []);

  return {
    state,
    dispatch,
    addImageFromFile,
    addImagesFromFiles,
    addImageFromUrl,
    importProgress,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    historyDepth: { past: history.past.length, future: history.future.length, max: MAX_HISTORY },
  };
}
