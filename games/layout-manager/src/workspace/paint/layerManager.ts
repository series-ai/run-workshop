import type { Layer, TextLayerData } from './types';
import { layerAdjustFilter } from './types';

let nextId = 1;

/** Render text layer data onto a canvas context */
export function renderTextToCanvas(ctx: CanvasRenderingContext2D, td: TextLayerData): void {
  const { text, x, y, w, h, font, size, bold, italic, underline, align, color, rotation } = td;
  const italicStr = italic ? 'italic ' : '';
  const boldStr = bold ? 'bold ' : '';
  ctx.font = `${italicStr}${boldStr}${size}px "${font}"`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = align;

  const padding = 2;
  const maxWidth = w - padding * 2;
  const metrics = ctx.measureText('Mg');
  // Replicate the edit overlay's CSS layout (line-height: 1.2): each line box
  // is 1.2em tall and the glyphs are centered in it via half-leading, so the
  // committed raster lands on the exact pixels the overlay showed.
  const lineHeight = size * 1.2;
  const asc = metrics.fontBoundingBoxAscent ?? size * 0.8;
  const desc = metrics.fontBoundingBoxDescent ?? size * 0.2;
  const halfLeading = (lineHeight - (asc + desc)) / 2;

  // Word-wrap
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph === '') { lines.push(''); continue; }
    const words = paragraph.split(' ');
    let current = '';
    for (const word of words) {
      const test = current ? current + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    lines.push(current);
  }

  ctx.save();

  // Apply rotation around text box center
  if (rotation) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.translate(cx, cy);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  let alignX: number;
  if (align === 'center') alignX = x + w / 2;
  else if (align === 'right') alignX = x + w - padding;
  else alignX = x + padding;

  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  for (let i = 0; i < lines.length; i++) {
    const lineTop = y + padding + i * lineHeight;
    if (lineTop > y + h) break;
    const baseline = lineTop + halfLeading + asc;
    ctx.fillText(lines[i]!, alignX, baseline);
    if (underline) {
      const lw = ctx.measureText(lines[i]!).width;
      let ux: number;
      if (align === 'center') ux = alignX - lw / 2;
      else if (align === 'right') ux = alignX - lw;
      else ux = alignX;
      ctx.fillRect(ux, baseline + Math.max(1, size * 0.08), lw, Math.max(1, Math.round(size / 16)));
    }
  }
  ctx.restore();
}

/** Create a text layer */
export function createTextLayer(width: number, height: number, textData: TextLayerData, name?: string): Layer {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const id = `text-layer-${nextId++}`;
  return {
    id,
    name: name ?? `Text ${nextId - 1}`,
    visible: true,
    opacity: 1,
    blendMode: 'source-over',
    canvas,
    textData,
  };
}

export function createLayer(width: number, height: number, name?: string): Layer {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const id = `layer-${nextId++}`;
  return {
    id,
    name: name ?? `Layer ${nextId - 1}`,
    visible: true,
    opacity: 1,
    blendMode: 'source-over',
    canvas,
  };
}

/**
 * Composite all visible layers onto a destination canvas in order (bottom to top).
 */
export function compositeLayers(
  layers: Layer[],
  destCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  checkerboard?: HTMLCanvasElement,
): void {
  destCtx.clearRect(0, 0, width, height);

  if (checkerboard) {
    destCtx.drawImage(checkerboard, 0, 0);
  }

  for (const layer of layers) {
    if (!layer.visible) continue;
    destCtx.save();
    destCtx.globalAlpha = layer.opacity;
    destCtx.filter = layerAdjustFilter(layer.adjustments);
    if (layer.blendMode && layer.blendMode !== 'source-over') {
      destCtx.globalCompositeOperation = layer.blendMode;
    }
    destCtx.drawImage(layer.canvas, 0, 0);
    destCtx.restore();
  }
}

/**
 * Create a checkerboard pattern canvas for transparency indication.
 */
export function createCheckerboard(width: number, height: number, cellSize: number = 8): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#cccccc';
  for (let y = 0; y < height; y += cellSize) {
    for (let x = 0; x < width; x += cellSize) {
      if ((Math.floor(x / cellSize) + Math.floor(y / cellSize)) % 2 === 0) continue;
      ctx.fillRect(x, y, cellSize, cellSize);
    }
  }
  return canvas;
}

/**
 * Export all layers composited as a single data URL (PNG).
 */
export function exportAsDataURL(layers: Layer[], width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  for (const layer of layers) {
    if (!layer.visible) continue;
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.filter = layerAdjustFilter(layer.adjustments);
    ctx.drawImage(layer.canvas, 0, 0);
    ctx.restore();
  }

  return canvas.toDataURL('image/png');
}
