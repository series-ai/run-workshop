export interface MaskPoint {
  x: number;
  y: number;
  pressure: number;
}

export type MaskBrushType = 'hide' | 'reveal' | 'fill' | 'select-rect' | 'select-polygon' | 'select-wand';

export interface WandSettings {
  tolerance: number;   // 0–255
  contiguous: boolean;
  spread: number;      // -20 to +20 pixels
}

/** Build a mask canvas from a wand click: BFS or global color match. */
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

  // Build mask canvas
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

  // Apply spread (morphological dilate/erode)
  if (settings.spread !== 0) return morphMask(mask, settings.spread);
  return mask;
}

/** Dilate (amount > 0) or erode (amount < 0) a mask by a circular kernel. */
function morphMask(mask: HTMLCanvasElement, amount: number): HTMLCanvasElement {
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
export type MaskBrushShape = 'round' | 'oval' | 'square';

export interface MaskSelection {
  x: number;
  y: number;
  w: number;
  h: number;
  polygon?: MaskPoint[];
}

export function fillSelectionMask(
  ctx: CanvasRenderingContext2D,
  selection: MaskSelection,
  mode: 'hide' | 'reveal',
): void {
  ctx.save();
  if (selection.polygon && selection.polygon.length >= 3) {
    ctx.beginPath();
    ctx.moveTo(selection.polygon[0]!.x, selection.polygon[0]!.y);
    for (let i = 1; i < selection.polygon.length; i++) {
      ctx.lineTo(selection.polygon[i]!.x, selection.polygon[i]!.y);
    }
    ctx.closePath();
    ctx.clip();
  }

  if (mode === 'hide') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#ffffff';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffffff';
  }

  if (selection.polygon && selection.polygon.length >= 3) {
    // Fill the clipped region
    ctx.fillRect(selection.x, selection.y, selection.w, selection.h);
  } else {
    ctx.fillRect(selection.x, selection.y, selection.w, selection.h);
  }
  ctx.restore();
}

export interface MaskBrushSettings {
  type: MaskBrushType;
  shape: MaskBrushShape;
  size: number;
  opacity: number;
  hardness: number; // 0 = soft, 1 = hard
  spacing: number; // fraction of brush size between stamps
}

function drawStamp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  baseR: number,
  hardness: number,
  shape: MaskBrushShape,
): void {
  if (baseR < 0.5) return;

  const isOval = shape === 'oval';
  const ovalRatio = 0.6;

  if (shape === 'square') {
    const half = Math.max(baseR, 0.5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(x - half), Math.round(y - half), Math.round(half * 2), Math.round(half * 2));
  } else if (hardness >= 0.99) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    const rx = isOval ? Math.max(baseR * ovalRatio, 0.5) : Math.max(baseR, 0.5);
    ctx.ellipse(x, y, rx, Math.max(baseR, 0.5), 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.save();
    ctx.translate(x, y);
    if (isOval) ctx.scale(ovalRatio, 1);
    const innerR = baseR * hardness;
    const gradient = ctx.createRadialGradient(0, 0, innerR, 0, 0, baseR);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, baseR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawMaskStrokeSegment(
  ctx: CanvasRenderingContext2D,
  prev: MaskPoint,
  curr: MaskPoint,
  brush: MaskBrushSettings,
): void {
  ctx.save();

  if (brush.type === 'hide') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = brush.opacity;
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = brush.opacity;
  }

  const pressure = curr.pressure * 0.5 + 0.5;
  const lineW = brush.size * pressure;
  const step = Math.max(0.5, lineW * brush.spacing);

  if (brush.shape === 'round' && brush.hardness >= 0.99 && brush.spacing <= 0.25) {
    // Fast path for hard round brush
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.stroke();
  } else {
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(1, Math.ceil(dist / step));
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const x = prev.x + dx * t;
      const y = prev.y + dy * t;
      drawStamp(ctx, x, y, lineW / 2, brush.hardness, brush.shape);
    }
  }

  ctx.restore();
}

export function drawMaskDot(
  ctx: CanvasRenderingContext2D,
  point: MaskPoint,
  brush: MaskBrushSettings,
): void {
  ctx.save();

  if (brush.type === 'hide') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = brush.opacity;
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = brush.opacity;
  }

  const pressure = point.pressure * 0.5 + 0.5;
  const baseR = (brush.size / 2) * pressure;
  drawStamp(ctx, point.x, point.y, baseR, brush.hardness, brush.shape);

  ctx.restore();
}

export function floodFillMask(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  mode: 'hide' | 'reveal',
  tolerance: number = 32,
  bounds?: { x: number; y: number; w: number; h: number },
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Constrain to bounds if provided
  const bx0 = bounds ? Math.max(0, Math.floor(bounds.x)) : 0;
  const by0 = bounds ? Math.max(0, Math.floor(bounds.y)) : 0;
  const bx1 = bounds ? Math.min(w, Math.ceil(bounds.x + bounds.w)) : w;
  const by1 = bounds ? Math.min(h, Math.ceil(bounds.y + bounds.h)) : h;

  const px = Math.round(x);
  const py = Math.round(y);
  if (px < bx0 || px >= bx1 || py < by0 || py >= by1) return;

  const startIdx = (py * w + px) * 4;
  const startA = data[startIdx + 3]!;

  const targetA = mode === 'reveal' ? 255 : 0;

  if (Math.abs(startA - targetA) < 2) return;

  const visited = new Uint8Array(w * h);
  const stack: number[] = [px, py];

  while (stack.length > 0) {
    const cy = stack.pop()!;
    const cx = stack.pop()!;

    const idx = cy * w + cx;
    if (visited[idx]) continue;
    visited[idx] = 1;

    const pi = idx * 4;
    if (Math.abs((data[pi + 3] ?? 0) - startA) > tolerance) continue;

    data[pi] = 255;
    data[pi + 1] = 255;
    data[pi + 2] = 255;
    data[pi + 3] = targetA;

    if (cx > bx0) stack.push(cx - 1, cy);
    if (cx < bx1 - 1) stack.push(cx + 1, cy);
    if (cy > by0) stack.push(cx, cy - 1);
    if (cy < by1 - 1) stack.push(cx, cy + 1);
  }

  ctx.putImageData(imageData, 0, 0);
}

const MAX_MASK_HISTORY = 30;

export class MaskHistoryManager {
  private undoStack: ImageData[] = [];
  private redoStack: ImageData[] = [];

  snapshot(ctx: CanvasRenderingContext2D): void {
    this.undoStack.push(ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height));
    if (this.undoStack.length > MAX_MASK_HISTORY) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  undo(ctx: CanvasRenderingContext2D): boolean {
    if (this.undoStack.length === 0) return false;
    this.redoStack.push(ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height));
    ctx.putImageData(this.undoStack.pop()!, 0, 0);
    return true;
  }

  redo(ctx: CanvasRenderingContext2D): boolean {
    if (this.redoStack.length === 0) return false;
    this.undoStack.push(ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height));
    ctx.putImageData(this.redoStack.pop()!, 0, 0);
    return true;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}
