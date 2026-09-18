import type { DotAnchor, DotFrame, DotLine } from './sampling';
import { activeAnchors, buildSampleGrid } from './sampling.ts';

export interface DotDocument {
  frame: DotFrame;
  anchors: DotAnchor[];
  size?: number;
  outputHeight?: number;
  lines?: DotLine[];
  levels?: number;
  radius?: number;
  strength?: number;
  softSelection?: boolean;
}
export interface DotHistory {
  present: DotDocument;
  past: DotDocument[];
  future: DotDocument[];
}
export type DotEdit =
  | { type: 'pin'; anchor: DotAnchor }
  | { type: 'band'; axis: 'row' | 'column'; index: number; delta: number }
  | { type: 'resolution'; size: number; height?: number }
  | { type: 'frame'; frame: DotFrame }
  | { type: 'adjust-frame'; frame: DotFrame }
  | { type: 'line'; line: DotLine }
  | { type: 'clear-lines' }
  | {
      type: 'settings';
      settings: Partial<Pick<DotDocument, 'levels' | 'radius' | 'strength' | 'softSelection'>>;
    }
  | { type: 'remove'; col: number; row: number }
  | { type: 'clear' }
  | { type: 'undo' }
  | { type: 'redo' };

/** Carry the editable grid with its frame instead of clearing the artist's work. */
export function transformDotFrame(document: DotDocument, frame: DotFrame): DotDocument {
  const from = document.frame;
  if (frame.x === from.x && frame.y === from.y && frame.w === from.w && frame.h === from.h)
    return document;
  const transform = (p: { x: number; y: number }) => ({
    x: frame.x + ((p.x - from.x) / from.w) * frame.w,
    y: frame.y + ((p.y - from.y) / from.h) * frame.h,
  });
  return {
    ...document,
    frame,
    anchors: document.anchors.map((a) => ({
      ...a,
      ...transform(a),
      ...(a.dragInfluence
        ? {
            dragInfluence: {
              ...a.dragInfluence,
              point: a.dragInfluence.point ? transform(a.dragInfluence.point) : null,
            },
          }
        : {}),
    })),
    lines: (document.lines ?? []).map((line) => line.map(transform)),
  };
}

/** Move one complete band from its current deformed shape. Always calculate
 * the starting samples once, so earlier pins in the batch cannot pull later ones. */
function moveDotBand(
  present: DotDocument,
  axis: 'row' | 'column',
  index: number,
  requestedDelta: number,
): DotDocument {
  const size = present.size ?? 32,
    height = present.outputHeight ?? size;
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= (axis === 'row' ? height : size) ||
    !Number.isFinite(requestedDelta) ||
    requestedDelta === 0
  )
    return present;
  const grid = buildSampleGrid(
    present.frame,
    size,
    present.anchors,
    { lines: present.lines, radius: present.radius, strength: present.strength },
    height,
  );
  const cells = Array.from({ length: axis === 'row' ? size : height }, (_, i) => {
    const col = axis === 'row' ? i : index,
      row = axis === 'row' ? index : i;
    return { col, row, ...grid[row * size + col]! };
  });
  const key = axis === 'row' ? 'y' : 'x';
  const lower = axis === 'row' ? present.frame.y : present.frame.x;
  const upper = lower + (axis === 'row' ? present.frame.h : present.frame.w) - 0.0001;
  const delta = Math.max(
    lower - Math.min(...cells.map((p) => p[key])),
    Math.min(upper - Math.max(...cells.map((p) => p[key])), requestedDelta),
  );
  if (delta === 0) return present;
  let next = present;
  for (const cell of cells) {
    // Reuse the pin path for importance, soft selection and hidden-pin preservation.
    next = editDotDocument(
      { present: next, past: [], future: [] },
      { type: 'pin', anchor: { ...cell, [key]: cell[key] + delta } },
    ).present;
  }
  return next;
}

export function editDotDocument(history: DotHistory, edit: DotEdit): DotHistory {
  const { present, past, future } = history;
  if (edit.type === 'undo') {
    if (!past.length) return history;
    return {
      present: past[past.length - 1]!,
      past: past.slice(0, -1),
      future: [present, ...future],
    };
  }
  if (edit.type === 'redo') {
    if (!future.length) return history;
    return { present: future[0]!, past: [...past, present], future: future.slice(1) };
  }
  let next: DotDocument;
  if (edit.type === 'band') {
    next = moveDotBand(present, edit.axis, edit.index, edit.delta);
    if (next === present) return history;
  } else if (edit.type === 'resolution') {
    const height = edit.height ?? edit.size;
    if (
      !Number.isInteger(edit.size) ||
      edit.size < 1 ||
      edit.size > 128 ||
      !Number.isInteger(height) ||
      height < 1 ||
      height > 128 ||
      (edit.size === (present.size ?? 32) &&
        height === (present.outputHeight ?? present.size ?? 32))
    )
      return history;
    const previousSize = present.size ?? 32;
    next = {
      ...present,
      size: edit.size,
      outputHeight: height,
      anchors: present.anchors.map((a) => {
        const u = a.u ?? (a.col + 0.5) / previousSize;
        const v = a.v ?? (a.row + 0.5) / (present.outputHeight ?? previousSize);
        return {
          ...a,
          u,
          v,
          basisSize: a.basisSize ?? previousSize,
          basisHeight: a.basisHeight ?? a.basisSize ?? present.outputHeight ?? previousSize,
          col: Math.min(edit.size - 1, Math.floor(u * edit.size)),
          row: Math.min(height - 1, Math.floor(v * height)),
        };
      }),
    };
  } else if (edit.type === 'frame')
    next = { ...present, frame: edit.frame, anchors: [], lines: [] };
  else if (edit.type === 'adjust-frame') {
    next = transformDotFrame(present, edit.frame);
    if (next === present) return history;
  } else if (edit.type === 'line') {
    if (edit.line.length < 2) return history;
    next = { ...present, lines: [...(present.lines ?? []), edit.line] };
  } else if (edit.type === 'clear-lines') {
    if (!present.lines?.length) return history;
    next = { ...present, lines: [] };
  } else if (edit.type === 'settings') {
    const defaults = { levels: 0, radius: 2, strength: 0.8, softSelection: false };
    const keys = Object.keys(edit.settings) as (keyof typeof defaults)[];
    if (
      keys.every((key) => (edit.settings[key] ?? defaults[key]) === (present[key] ?? defaults[key]))
    )
      return history;
    next = { ...present, ...edit.settings };
  } else if (edit.type === 'clear') {
    if (!present.anchors.length) return history;
    next = { ...present, anchors: [] };
  } else if (edit.type === 'remove') {
    const removed = activeAnchors(present.anchors).find(
      (a) => a.col === edit.col && a.row === edit.row,
    );
    if (!removed) return history;
    next = { ...present, anchors: present.anchors.filter((a) => a !== removed) };
  } else {
    const replaced = activeAnchors(present.anchors).find(
      (a) => a.col === edit.anchor.col && a.row === edit.anchor.row,
    );
    // Selecting an existing pin is not an edit, even if soft selection changed.
    if (replaced && replaced.x === edit.anchor.x && replaced.y === edit.anchor.y) return history;
    next = {
      ...present,
      anchors: [
        ...present.anchors.filter((a) => a !== replaced),
        {
          ...edit.anchor,
          u: replaced?.u ?? edit.anchor.u ?? (edit.anchor.col + 0.5) / (present.size ?? 32),
          v:
            replaced?.v ??
            edit.anchor.v ??
            (edit.anchor.row + 0.5) / (present.outputHeight ?? present.size ?? 32),
          basisSize: replaced?.basisSize ?? edit.anchor.basisSize ?? present.size ?? 32,
          basisHeight:
            replaced?.basisHeight ??
            replaced?.basisSize ??
            edit.anchor.basisHeight ??
            edit.anchor.basisSize ??
            present.outputHeight ??
            present.size ??
            32,
          dragInfluence: present.softSelection
            ? undefined
            : replaced?.dragInfluence?.size === (present.size ?? 32) &&
                (replaced.dragInfluence.height ?? replaced.dragInfluence.size) ===
                  (present.outputHeight ?? present.size ?? 32)
              ? replaced.dragInfluence
              : {
                  size: present.size ?? 32,
                  height: present.outputHeight ?? present.size ?? 32,
                  point: replaced ? { x: replaced.x, y: replaced.y } : null,
                },
        },
      ],
    };
  }
  return { present: next, past: [...past.slice(-99), present], future: [] };
}
