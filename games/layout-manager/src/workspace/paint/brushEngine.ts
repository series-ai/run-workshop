import type { Point, BrushSettings } from './types';

// ==================== Helpers ====================

/** Fill a pixel-snapped stamp: square, circle, or oval depending on brush shape. */
function pixelStamp(ctx: CanvasRenderingContext2D, px: number, py: number, size: number, shape: 'circle' | 'oval' | 'square'): void {
  if (shape === 'square') {
    ctx.fillRect(px, py, size, size);
    return;
  }
  const rx = shape === 'oval' ? size * 0.3 : size / 2;
  const ry = size / 2;
  const cx = px + size / 2;
  const cy = py + ry;
  for (let y = py; y < py + size; y++) {
    for (let x = px; x < px + size; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return { r, g, b, a: 255 };
}

/**
 * Compute soft-brush parameters from hardness (0..1).
 * innerRatio: where the gradient starts (0 = center, 1 = edge)
 * radiusScale: how much to expand the radius for extra feathering
 */
export function softBrushParams(hardness: number): { innerRatio: number; radiusScale: number } {
  // Hard core percentage — at hardness=1, 100% is hard. At hardness=0, 0% is hard.
  const innerRatio = hardness * 0.8;
  // Expand radius for softer brushes to maintain visual size
  const radiusScale = 1 + (1 - hardness) * 0.5;
  return { innerRatio, radiusScale };
}

// ==================== Core drawing ====================

/**
 * Get the composite mode and color for the current brush type.
 * 'reveal' and 'hide' are mask-mode brushes that paint/erase white.
 */
function getBrushComposite(type: BrushSettings['type']): {
  composite: GlobalCompositeOperation;
  color: string | null; // null = use brush.color
  alpha: number | null; // null = use brush.opacity
} {
  switch (type) {
    case 'hide':
      return { composite: 'destination-out', color: '#ffffff', alpha: null };
    case 'reveal':
      return { composite: 'source-over', color: '#ffffff', alpha: null };
    case 'eraser':
      return { composite: 'destination-out', color: '#000000', alpha: 1 };
    default:
      return { composite: 'source-over', color: null, alpha: null };
  }
}

/**
 * Draw a stroke segment between two points.
 */
export function drawStrokeSegment(
  ctx: CanvasRenderingContext2D,
  prev: Point,
  curr: Point,
  brush: BrushSettings,
  pixelSnap: boolean = false,
): void {
  const { composite, color, alpha } = getBrushComposite(brush.type);
  const fillColor = color ?? brush.color;
  const fillAlpha = alpha ?? brush.opacity;

  ctx.save();
  ctx.globalCompositeOperation = composite;
  ctx.globalAlpha = fillAlpha;

  // Pixel snap mode: bypass pressure, snap to pixel grid
  if (pixelSnap) {
    const s = brush.size;
    ctx.fillStyle = fillColor;
    ctx.imageSmoothingEnabled = false;
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(1, Math.ceil(dist));
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const px = Math.floor(prev.x + dx * t - s / 2);
      const py = Math.floor(prev.y + dy * t - s / 2);
      pixelStamp(ctx, px, py, s, brush.shape);
    }
    ctx.restore();
    return;
  }

  const { innerRatio, radiusScale } = softBrushParams(brush.hardness);
  const pressure = curr.pressure * 0.5 + 0.5;
  const lineW = brush.size * pressure;
  const step = Math.max(0.5, lineW * brush.spacing);
  const isSquare = brush.shape === 'square';
  const isOval = brush.shape === 'oval';
  const ovalRatio = 0.6; // width/height ratio for oval

  if (isSquare) {
    // Square brush: stamp solid rects along the stroke, with edge softness for low hardness
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(1, Math.ceil(dist / step));
    const side = Math.max(Math.round(lineW), 1);
    const half = side / 2;
    const softEdge = Math.round(side * (1 - brush.hardness) * 0.5);

    if (softEdge < 1) {
      // Hard square — solid fill
      ctx.fillStyle = fillColor;
      for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const x = Math.round(prev.x + dx * t - half);
        const y = Math.round(prev.y + dy * t - half);
        ctx.fillRect(x, y, side, side);
      }
    } else {
      // Soft square — solid core with fading edge bands
      const { r: cr, g: cg, b: cb } = hexToRgba(fillColor);
      for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const sx = Math.round(prev.x + dx * t - half);
        const sy = Math.round(prev.y + dy * t - half);
        for (let ring = softEdge; ring >= 0; ring--) {
          const alpha = ring === 0 ? 1 : (1 - ring / (softEdge + 1));
          ctx.fillStyle = ring === 0 ? fillColor : `rgba(${cr},${cg},${cb},${alpha})`;
          ctx.fillRect(sx + ring, sy + ring, side - ring * 2, side - ring * 2);
        }
      }
    }
  } else if (!isOval && innerRatio >= 0.98 && brush.spacing <= 0.25) {
    // Hard circle brush with tight spacing — simple line is faster
    ctx.strokeStyle = fillColor;
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
    const baseR = lineW / 2;
    const rx = isOval ? baseR * ovalRatio : baseR;
    const ry = baseR;

    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const x = prev.x + dx * t;
      const y = prev.y + dy * t;

      if (innerRatio >= 0.98) {
        ctx.fillStyle = fillColor;
        ctx.beginPath();
        ctx.ellipse(x, y, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Radial gradient doesn't support ellipse — use save/scale trick
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(isOval ? ovalRatio : 1, 1);
        const r = ry * radiusScale;
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        const { r: cr, g: cg, b: cb } = hexToRgba(fillColor);
        gradient.addColorStop(0, fillColor);
        if (innerRatio > 0.01) gradient.addColorStop(innerRatio, fillColor);
        const mid = innerRatio + (1 - innerRatio) * 0.5;
        gradient.addColorStop(mid, `rgba(${cr},${cg},${cb},0.5)`);
        gradient.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

/**
 * Draw a single dot (tap without drag).
 */
export function drawDot(
  ctx: CanvasRenderingContext2D,
  point: Point,
  brush: BrushSettings,
  pixelSnap: boolean = false,
): void {
  const { composite, color, alpha } = getBrushComposite(brush.type);
  const fillColor = color ?? brush.color;
  const fillAlpha = alpha ?? brush.opacity;

  ctx.save();
  ctx.globalCompositeOperation = composite;
  ctx.globalAlpha = fillAlpha;

  // Pixel snap mode: bypass pressure, snap to pixel grid
  if (pixelSnap) {
    ctx.fillStyle = fillColor;
    ctx.imageSmoothingEnabled = false;
    const s = brush.size;
    const px = Math.floor(point.x - s / 2);
    const py = Math.floor(point.y - s / 2);
    pixelStamp(ctx, px, py, s, brush.shape);
    ctx.restore();
    return;
  }

  const pressure = point.pressure * 0.5 + 0.5;
  const lineW = brush.size * pressure;
  if (lineW < 1) { ctx.restore(); return; }

  const isSquare = brush.shape === 'square';
  const isOval = brush.shape === 'oval';
  const ovalRatio = 0.6;
  const { innerRatio, radiusScale } = softBrushParams(brush.hardness);

  if (isSquare) {
    // Square brush: solid rect with optional soft edges
    const side = Math.max(Math.round(lineW), 1);
    const half = side / 2;
    const softEdge = Math.round(side * (1 - brush.hardness) * 0.5);
    const sx = Math.round(point.x - half);
    const sy = Math.round(point.y - half);

    if (softEdge < 1) {
      ctx.fillStyle = fillColor;
      ctx.fillRect(sx, sy, side, side);
    } else {
      const { r: cr, g: cg, b: cb } = hexToRgba(fillColor);
      for (let ring = softEdge; ring >= 0; ring--) {
        const alpha = ring === 0 ? 1 : (1 - ring / (softEdge + 1));
        ctx.fillStyle = ring === 0 ? fillColor : `rgba(${cr},${cg},${cb},${alpha})`;
        ctx.fillRect(sx + ring, sy + ring, side - ring * 2, side - ring * 2);
      }
    }
  } else {
    const baseR = lineW / 2;
    const rx = isOval ? baseR * ovalRatio : baseR;
    const ry = baseR;

    if (innerRatio >= 0.98) {
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.ellipse(point.x, point.y, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.save();
      ctx.translate(point.x, point.y);
      if (isOval) ctx.scale(ovalRatio, 1);
      const r = ry * radiusScale;
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      const { r: cr, g: cg, b: cb } = hexToRgba(fillColor);
      gradient.addColorStop(0, fillColor);
      if (innerRatio > 0.01) gradient.addColorStop(innerRatio, fillColor);
      const midPoint = innerRatio + (1 - innerRatio) * 0.5;
      gradient.addColorStop(midPoint, `rgba(${cr},${cg},${cb},0.5)`);
      gradient.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

// ==================== Flood fill ====================

/**
 * Flood fill at the given point with a color.
 * For mask mode, use '#ffffff' with appropriate tolerance.
 */
export function floodFill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  fillColor: string,
  tolerance: number = 32,
  bounds?: { x: number; y: number; w: number; h: number },
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  const bx0 = bounds ? Math.max(0, Math.floor(bounds.x)) : 0;
  const by0 = bounds ? Math.max(0, Math.floor(bounds.y)) : 0;
  const bx1 = bounds ? Math.min(w, Math.ceil(bounds.x + bounds.w)) : w;
  const by1 = bounds ? Math.min(h, Math.ceil(bounds.y + bounds.h)) : h;

  const px = Math.round(x);
  const py = Math.round(y);
  if (px < bx0 || px >= bx1 || py < by0 || py >= by1) return;

  const startIdx = (py * w + px) * 4;
  const startR = data[startIdx]!;
  const startG = data[startIdx + 1]!;
  const startB = data[startIdx + 2]!;
  const startA = data[startIdx + 3]!;

  const fill = hexToRgba(fillColor);

  if (
    Math.abs(startR - fill.r) < 2 &&
    Math.abs(startG - fill.g) < 2 &&
    Math.abs(startB - fill.b) < 2 &&
    Math.abs(startA - fill.a) < 2
  ) {
    return;
  }

  const visited = new Uint8Array(w * h);
  const stack: number[] = [px, py];

  while (stack.length > 0) {
    const cy = stack.pop()!;
    const cx = stack.pop()!;

    const idx = cy * w + cx;
    if (visited[idx]) continue;
    visited[idx] = 1;

    const pi = idx * 4;
    if (
      Math.abs((data[pi] ?? 0) - startR) > tolerance ||
      Math.abs((data[pi + 1] ?? 0) - startG) > tolerance ||
      Math.abs((data[pi + 2] ?? 0) - startB) > tolerance ||
      Math.abs((data[pi + 3] ?? 0) - startA) > tolerance
    ) continue;

    data[pi] = fill.r;
    data[pi + 1] = fill.g;
    data[pi + 2] = fill.b;
    data[pi + 3] = fill.a;

    if (cx > bx0) stack.push(cx - 1, cy);
    if (cx < bx1 - 1) stack.push(cx + 1, cy);
    if (cy > by0) stack.push(cx, cy - 1);
    if (cy < by1 - 1) stack.push(cx, cy + 1);
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Mask-specific flood fill that operates on alpha channel only.
 * mode 'hide' sets alpha to 0, 'reveal' sets alpha to 255.
 */
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

// ==================== Smudge tool ====================

export interface SmudgeState {
  buffer: ImageData;
  lastX: number;
  lastY: number;
  carry: number;
}

export function smudgeStart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  brush: BrushSettings,
): SmudgeState {
  const pressure = 0.5 * 0.5 + 0.5;
  const diameter = Math.max(2, Math.round(brush.size * pressure));
  const sx = Math.round(x - diameter / 2);
  const sy = Math.round(y - diameter / 2);
  const buffer = ctx.getImageData(sx, sy, diameter, diameter);
  applyCircularMask(buffer);
  return { buffer, lastX: x, lastY: y, carry: 1.0 };
}

export function smudgeMove(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  brush: BrushSettings,
  state: SmudgeState,
): void {
  const diameter = state.buffer.width;
  const strength = brush.opacity;
  const decayPerStep = 0.06 + (1 - brush.hardness) * 0.14;

  const dx = x - state.lastX;
  const dy = y - state.lastY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const step = Math.max(1, diameter * brush.spacing);
  const steps = Math.max(1, Math.ceil(dist / step));

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const cx = state.lastX + dx * t;
    const cy = state.lastY + dy * t;
    const sx = Math.round(cx - diameter / 2);
    const sy = Math.round(cy - diameter / 2);

    const carriedData = state.buffer.data;
    let opaqueSum = 0;
    for (let p = 3; p < carriedData.length; p += 4) {
      opaqueSum += carriedData[p]!;
    }

    if (opaqueSum === 0) {
      const freshSample = ctx.getImageData(sx, sy, diameter, diameter);
      applyCircularMask(freshSample);
      state.buffer = freshSample;
      let freshOpaque = 0;
      for (let p = 3; p < freshSample.data.length; p += 4) {
        freshOpaque += freshSample.data[p]!;
      }
      if (freshOpaque > 0) state.carry = 1.0;
      continue;
    }

    state.carry = Math.max(0, state.carry - decayPerStep);
    const effectiveStrength = strength * state.carry;

    if (effectiveStrength < 0.005) {
      const freshSample = ctx.getImageData(sx, sy, diameter, diameter);
      applyCircularMask(freshSample);
      state.buffer = freshSample;
      let freshOpaque = 0;
      for (let p = 3; p < freshSample.data.length; p += 4) {
        freshOpaque += freshSample.data[p]!;
      }
      if (freshOpaque > 0) state.carry = 1.0;
      continue;
    }

    const canvasPatch = ctx.getImageData(sx, sy, diameter, diameter);
    const carried = state.buffer.data;
    const canvas = canvasPatch.data;
    const blended = ctx.createImageData(diameter, diameter);
    const out = blended.data;

    for (let p = 0; p < carried.length; p += 4) {
      const ca = carried[p + 3]! / 255;
      if (ca < 0.01) {
        out[p] = canvas[p]!;
        out[p + 1] = canvas[p + 1]!;
        out[p + 2] = canvas[p + 2]!;
        out[p + 3] = canvas[p + 3]!;
        continue;
      }
      const s = effectiveStrength * ca;
      const canvasA = canvas[p + 3]! / 255;
      const cR = canvasA > 0.01 ? canvas[p]! : carried[p]!;
      const cG = canvasA > 0.01 ? canvas[p + 1]! : carried[p + 1]!;
      const cB = canvasA > 0.01 ? canvas[p + 2]! : carried[p + 2]!;

      out[p] = Math.round(carried[p]! * s + cR * (1 - s));
      out[p + 1] = Math.round(carried[p + 1]! * s + cG * (1 - s));
      out[p + 2] = Math.round(carried[p + 2]! * s + cB * (1 - s));
      out[p + 3] = Math.max(carried[p + 3]!, canvas[p + 3]!);
    }

    ctx.putImageData(blended, sx, sy);

    const newSample = ctx.getImageData(sx, sy, diameter, diameter);
    applyCircularMask(newSample);
    state.buffer = newSample;
  }

  state.lastX = x;
  state.lastY = y;
}

function applyCircularMask(img: ImageData): void {
  const d = img.width;
  const r = d / 2;
  const data = img.data;
  const feather = Math.max(2, r * 0.25);
  for (let y = 0; y < d; y++) {
    for (let x = 0; x < d; x++) {
      const dx = x - r + 0.5;
      const dy = y - r + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > r) {
        const i = (y * d + x) * 4;
        data[i + 3] = 0;
      } else {
        const edgeDist = r - dist;
        if (edgeDist < feather) {
          const i = (y * d + x) * 4;
          data[i + 3] = Math.round(data[i + 3]! * (edgeDist / feather));
        }
      }
    }
  }
}

// ==================== Clone stamp ====================

export interface CloneState {
  offsetX: number;
  offsetY: number;
  lastX: number;
  lastY: number;
}

export function cloneStart(
  x: number,
  y: number,
  sourceX: number,
  sourceY: number,
): CloneState {
  return {
    offsetX: sourceX - x,
    offsetY: sourceY - y,
    lastX: x,
    lastY: y,
  };
}

// Reusable temp canvas for clone/heal stamp compositing
let _stampCanvas: HTMLCanvasElement | null = null;
function getStampCanvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (!_stampCanvas || _stampCanvas.width < size || _stampCanvas.height < size) {
    _stampCanvas = document.createElement('canvas');
    _stampCanvas.width = size;
    _stampCanvas.height = size;
  }
  const ctx = _stampCanvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  return { canvas: _stampCanvas, ctx };
}

export function cloneMove(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  brush: BrushSettings,
  state: CloneState,
  sourceCtx: CanvasRenderingContext2D,
): void {
  const sampleCtx = sourceCtx;
  const pressure = 0.5 * 0.5 + 0.5;
  const diameter = Math.max(2, Math.round(brush.size * pressure));
  const { radiusScale } = softBrushParams(brush.hardness);
  const effectiveDiameter = Math.max(2, Math.round(diameter * radiusScale));

  const dx = x - state.lastX;
  const dy = y - state.lastY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const step = Math.max(1, diameter * brush.spacing);
  const steps = Math.max(1, Math.ceil(dist / step));

  const { canvas: tmp, ctx: tCtx } = getStampCanvas(effectiveDiameter);

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const bx = state.lastX + dx * t;
    const by = state.lastY + dy * t;

    const srcX = bx + state.offsetX;
    const srcY = by + state.offsetY;

    const halfD = effectiveDiameter / 2;
    const sx = Math.round(srcX - halfD);
    const sy = Math.round(srcY - halfD);
    const destX = Math.round(bx - halfD);
    const destY = Math.round(by - halfD);

    const srcData = sampleCtx.getImageData(sx, sy, effectiveDiameter, effectiveDiameter);
    applyHardnessMask(srcData, brush.hardness, brush.shape);

    if (brush.opacity < 1) {
      const d = srcData.data;
      for (let p = 3; p < d.length; p += 4) {
        d[p] = Math.round(d[p]! * brush.opacity);
      }
    }

    tCtx.clearRect(0, 0, effectiveDiameter, effectiveDiameter);
    tCtx.putImageData(srcData, 0, 0);
    ctx.drawImage(tmp, 0, 0, effectiveDiameter, effectiveDiameter, destX, destY, effectiveDiameter, effectiveDiameter);
  }

  state.lastX = x;
  state.lastY = y;
}

export function cloneDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  brush: BrushSettings,
  sourceX: number,
  sourceY: number,
  sourceCtx?: CanvasRenderingContext2D,
): void {
  const sampleCtx = sourceCtx ?? ctx;
  const pressure = 0.5 * 0.5 + 0.5;
  const diameter = Math.max(2, Math.round(brush.size * pressure));
  const { radiusScale } = softBrushParams(brush.hardness);
  const effectiveDiameter = Math.max(2, Math.round(diameter * radiusScale));

  const halfD = effectiveDiameter / 2;
  const sx = Math.round(sourceX - halfD);
  const sy = Math.round(sourceY - halfD);
  const destX = Math.round(x - halfD);
  const destY = Math.round(y - halfD);

  const srcData = sampleCtx.getImageData(sx, sy, effectiveDiameter, effectiveDiameter);
  applyHardnessMask(srcData, brush.hardness, brush.shape);

  if (brush.opacity < 1) {
    const d = srcData.data;
    for (let p = 3; p < d.length; p += 4) {
      d[p] = Math.round(d[p]! * brush.opacity);
    }
  }

  const { canvas: tmp, ctx: tCtx } = getStampCanvas(effectiveDiameter);
  tCtx.clearRect(0, 0, effectiveDiameter, effectiveDiameter);
  tCtx.putImageData(srcData, 0, 0);
  ctx.drawImage(tmp, 0, 0, effectiveDiameter, effectiveDiameter, destX, destY, effectiveDiameter, effectiveDiameter);
}

function applyHardnessMask(img: ImageData, hardness: number, shape: BrushSettings['shape'] = 'circle'): void {
  const d = img.width;
  const r = d / 2;
  const data = img.data;
  const { innerRatio } = softBrushParams(hardness);
  const innerR = r * innerRatio;
  const ovalRatio = 0.6;

  for (let y = 0; y < d; y++) {
    for (let x = 0; x < d; x++) {
      const dx = x - r + 0.5;
      const dy = y - r + 0.5;
      const i = (y * d + x) * 4;

      if (shape === 'square') {
        // Square: no circular mask, just apply hardness fade at edges
        const edgeDist = Math.max(Math.abs(dx), Math.abs(dy));
        if (edgeDist > innerR && innerR < r) {
          const fade = 1 - (edgeDist - innerR) / (r - innerR);
          data[i + 3] = Math.round(data[i + 3]! * Math.max(0, fade));
        }
      } else {
        // Circle or oval
        const ndx = shape === 'oval' ? dx / ovalRatio : dx;
        const dist = Math.sqrt(ndx * ndx + dy * dy);
        if (dist > r) {
          data[i + 3] = 0;
        } else if (dist > innerR) {
          const fade = 1 - (dist - innerR) / (r - innerR);
          data[i + 3] = Math.round(data[i + 3]! * fade);
        }
      }
    }
  }
}

// ==================== Healing brush ====================
// Samples border pixels around the brush area and interpolates inward
// to blend over imperfections. No source point needed.

export interface HealState {
  lastX: number;
  lastY: number;
  /** Snapshot of the canvas before the stroke started */
  snapshot: HTMLCanvasElement;
}

export function healStart(ctx: CanvasRenderingContext2D): HealState {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const snap = document.createElement('canvas');
  snap.width = w; snap.height = h;
  snap.getContext('2d')!.drawImage(ctx.canvas, 0, 0);
  return { lastX: 0, lastY: 0, snapshot: snap };
}

export function healBrush(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  brush: BrushSettings,
  state: HealState,
): void {
  const pressure = 0.5 * 0.5 + 0.5;
  const diameter = Math.max(4, Math.round(brush.size * pressure));
  const r = diameter / 2;
  const dx = Math.round(x - r);
  const dy = Math.round(y - r);

  // Read from the pre-stroke snapshot (what the image looked like before we started)
  const snapCtx = state.snapshot.getContext('2d')!;
  const patchData = snapCtx.getImageData(dx, dy, diameter, diameter);
  const d = patchData.data;

  // Shape-aware distance function
  const isOval = brush.shape === 'oval';
  const isSquare = brush.shape === 'square';
  const shapeDist = (cx: number, cy: number): number => {
    if (isSquare) return Math.max(Math.abs(cx), Math.abs(cy));
    const nx = isOval ? cx / 0.6 : cx;
    return Math.sqrt(nx * nx + cy * cy);
  };

  // Sample border pixels (ring at ~80-100% radius)
  const innerR = r * 0.75;
  let borderR = 0, borderG = 0, borderB = 0, borderCount = 0;

  for (let py = 0; py < diameter; py++) {
    for (let px = 0; px < diameter; px++) {
      const cx = px - r + 0.5;
      const cy = py - r + 0.5;
      const dist = shapeDist(cx, cy);
      if (dist >= innerR && dist <= r) {
        const idx = (py * diameter + px) * 4;
        if (d[idx + 3]! > 10) {
          borderR += d[idx]!;
          borderG += d[idx + 1]!;
          borderB += d[idx + 2]!;
          borderCount++;
        }
      }
    }
  }

  if (borderCount === 0) return;

  const avgR = borderR / borderCount;
  const avgG = borderG / borderCount;
  const avgB = borderB / borderCount;

  // Blend each pixel toward the border average based on distance from edge
  const result = ctx.createImageData(diameter, diameter);
  const out = result.data;
  const { innerRatio } = softBrushParams(brush.hardness);
  const hardR = r * innerRatio;

  for (let py = 0; py < diameter; py++) {
    for (let px = 0; px < diameter; px++) {
      const idx = (py * diameter + px) * 4;
      const cx = px - r + 0.5;
      const cy = py - r + 0.5;
      const dist = shapeDist(cx, cy);

      if (dist > r) {
        out[idx] = 0; out[idx + 1] = 0; out[idx + 2] = 0; out[idx + 3] = 0;
        continue;
      }

      // Blend factor: 1.0 at center (full heal), 0.0 at edge (keep original)
      const blend = dist <= hardR ? 1 : 1 - (dist - hardR) / (r - hardR);
      const healStrength = blend * brush.opacity;

      const origR = d[idx]!;
      const origG = d[idx + 1]!;
      const origB = d[idx + 2]!;
      const origA = d[idx + 3]!;

      out[idx] = Math.round(origR + (avgR - origR) * healStrength);
      out[idx + 1] = Math.round(origG + (avgG - origG) * healStrength);
      out[idx + 2] = Math.round(origB + (avgB - origB) * healStrength);
      out[idx + 3] = origA;
    }
  }

  const { canvas: tmp, ctx: tCtx } = getStampCanvas(diameter);
  tCtx.clearRect(0, 0, diameter, diameter);
  tCtx.putImageData(result, 0, 0);
  ctx.drawImage(tmp, 0, 0, diameter, diameter, dx, dy, diameter, diameter);
}
