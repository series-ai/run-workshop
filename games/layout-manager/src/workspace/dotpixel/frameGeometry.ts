import type { DotFrame } from './sampling';

export type FrameHandle = 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

/** Resize against the opposite edge/corner; movement never changes frame dimensions. */
export function adjustFrame(
  frame: DotFrame,
  handle: FrameHandle,
  dx: number,
  dy: number,
  width: number,
  height: number,
  square: boolean,
): DotFrame {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  dx = Math.round(dx);
  dy = Math.round(dy);
  if (handle === 'move')
    return {
      ...frame,
      x: clamp(frame.x + dx, 0, width - frame.w),
      y: clamp(frame.y + dy, 0, height - frame.h),
    };
  const west = handle.includes('w'),
    east = handle.includes('e');
  const north = handle.includes('n'),
    south = handle.includes('s');
  const right = frame.x + frame.w,
    bottom = frame.y + frame.h;
  if (!square) {
    const x = west ? clamp(frame.x + dx, 0, right - 1) : frame.x;
    const y = north ? clamp(frame.y + dy, 0, bottom - 1) : frame.y;
    return {
      x,
      y,
      w: (east ? clamp(right + dx, x + 1, width) : right) - x,
      h: (south ? clamp(bottom + dy, y + 1, height) : bottom) - y,
    };
  }
  const horizontal = west || east,
    vertical = north || south;
  const wantedW = frame.w + (west ? -dx : dx);
  const wantedH = frame.h + (north ? -dy : dy);
  const wanted =
    horizontal && vertical
      ? Math.abs(dx) >= Math.abs(dy)
        ? wantedW
        : wantedH
      : horizontal
        ? wantedW
        : wantedH;
  const cx = frame.x + frame.w / 2,
    cy = frame.y + frame.h / 2;
  const maxW = west ? right : east ? width - frame.x : 2 * Math.min(cx, width - cx);
  const maxH = north ? bottom : south ? height - frame.y : 2 * Math.min(cy, height - cy);
  const side = clamp(wanted, 1, Math.floor(Math.min(maxW, maxH)));
  return {
    x: west ? right - side : east ? frame.x : Math.floor(cx - side / 2),
    y: north ? bottom - side : south ? frame.y : Math.floor(cy - side / 2),
    w: side,
    h: side,
  };
}
