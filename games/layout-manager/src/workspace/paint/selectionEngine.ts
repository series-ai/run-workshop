import type { Point, WandSettings, SelectionRect } from './types';

/**
 * Build a mask canvas from a wand click: BFS (contiguous) or global color match.
 */
export function buildWandMask(
  srcCanvas: HTMLCanvasElement,
  px: number,
  py: number,
  settings: WandSettings,
): HTMLCanvasElement {
  const W = srcCanvas.width;
  const H = srcCanvas.height;
  const ctx = srcCanvas.getContext('2d')!;
  const imgData = ctx.getImageData(0, 0, W, H);
  const d = imgData.data;

  const ix = Math.round(px);
  const iy = Math.round(py);
  if (ix < 0 || iy < 0 || ix >= W || iy >= H) {
    const empty = document.createElement('canvas');
    empty.width = W; empty.height = H;
    return empty;
  }

  const si = (iy * W + ix) * 4;
  const seedR = d[si]!;
  const seedG = d[si + 1]!;
  const seedB = d[si + 2]!;
  const seedA = d[si + 3]!;

  const colorDiff = (i: number): number => {
    const dr = d[i]! - seedR;
    const dg = d[i + 1]! - seedG;
    const db = d[i + 2]! - seedB;
    const da = d[i + 3]! - seedA;
    return Math.sqrt(dr * dr + dg * dg + db * db + da * da);
  };

  const selected = new Uint8Array(W * H);

  if (settings.contiguous) {
    const visited = new Uint8Array(W * H);
    const queue: number[] = [];
    const startIdx = iy * W + ix;
    queue.push(startIdx);
    visited[startIdx] = 1;
    let head = 0;
    while (head < queue.length) {
      const idx = queue[head++]!;
      if (colorDiff(idx * 4) <= settings.tolerance) {
        selected[idx] = 1;
        const x = idx % W;
        const neighbors = [
          idx - W,
          idx + W,
          x > 0 ? idx - 1 : -1,
          x < W - 1 ? idx + 1 : -1,
        ];
        for (const n of neighbors) {
          if (n >= 0 && n < W * H && !visited[n]) {
            visited[n] = 1;
            queue.push(n);
          }
        }
      }
    }
  } else {
    for (let i = 0; i < W * H; i++) {
      if (colorDiff(i * 4) <= settings.tolerance) selected[i] = 1;
    }
  }

  const mask = document.createElement('canvas');
  mask.width = W; mask.height = H;
  const mCtx = mask.getContext('2d')!;
  const mData = mCtx.createImageData(W, H);
  const md = mData.data;
  for (let i = 0; i < W * H; i++) {
    if (selected[i]) {
      md[i * 4] = 255;
      md[i * 4 + 1] = 255;
      md[i * 4 + 2] = 255;
      md[i * 4 + 3] = 255;
    }
  }
  mCtx.putImageData(mData, 0, 0);

  if (settings.spread !== 0) return morphMask(mask, settings.spread);
  return mask;
}

/**
 * Dilate (amount > 0) or erode (amount < 0) a mask by a circular kernel.
 */
export function morphMask(mask: HTMLCanvasElement, amount: number): HTMLCanvasElement {
  const absAmt = Math.abs(amount);
  const grow = amount > 0;
  const W = mask.width;
  const H = mask.height;
  const src = mask.getContext('2d')!.getImageData(0, 0, W, H).data;
  const isSet = (i: number) => i >= 0 && i < W * H && src[i * 4 + 3]! > 10;

  const result = new Uint8Array(W * H);
  const radius = absAmt;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (grow) {
        let found = false;
        outer: for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy <= radius * radius) {
              const nx = x + dx, ny = y + dy;
              if (nx >= 0 && ny >= 0 && nx < W && ny < H && isSet(ny * W + nx)) {
                found = true; break outer;
              }
            }
          }
        }
        result[idx] = found ? 1 : 0;
      } else {
        let allSet = true;
        outer2: for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy <= radius * radius) {
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= W || ny >= H || !isSet(ny * W + nx)) {
                allSet = false; break outer2;
              }
            }
          }
        }
        result[idx] = allSet ? 1 : 0;
      }
    }
  }

  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const outCtx = out.getContext('2d')!;
  const outData = outCtx.createImageData(W, H);
  const od = outData.data;
  for (let i = 0; i < W * H; i++) {
    if (result[i]) { od[i * 4] = 255; od[i * 4 + 1] = 255; od[i * 4 + 2] = 255; od[i * 4 + 3] = 255; }
  }
  outCtx.putImageData(outData, 0, 0);
  return out;
}

/**
 * Fill a selection area on a mask canvas.
 */
export function fillSelectionMask(
  ctx: CanvasRenderingContext2D,
  selection: SelectionRect,
  polygon: Point[] | undefined,
  mode: 'hide' | 'reveal',
): void {
  ctx.save();
  if (polygon && polygon.length >= 3) {
    ctx.beginPath();
    ctx.moveTo(polygon[0]!.x, polygon[0]!.y);
    for (let i = 1; i < polygon.length; i++) {
      ctx.lineTo(polygon[i]!.x, polygon[i]!.y);
    }
    ctx.closePath();
    ctx.clip();
  }

  if (mode === 'hide') {
    ctx.globalCompositeOperation = 'destination-out';
  } else {
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(selection.x, selection.y, selection.w, selection.h);
  ctx.restore();
}
