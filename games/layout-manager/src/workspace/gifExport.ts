import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import type { ImageNode } from './types';
import { flattenNode } from './ai/flattenNode';

export interface GifFrame {
  data: Uint8ClampedArray; // RGBA pixels
  width: number;
  height: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load frame: ${src}`));
    img.src = src;
  });
}

/**
 * Core encoder — DOM-free so it can be tested headlessly.
 * All frames must share the same dimensions.
 */
export async function encodeGifFrames(
  frames: GifFrame[],
  fps: number,
  loop: boolean,
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  if (frames.length === 0) throw new Error('No frames to encode');
  const w = frames[0]!.width;
  const h = frames[0]!.height;

  // Opaque animations use the high-quality rgb565 quantizer; rgba4444
  // (4 bits/channel, visibly noisier) only when transparency must survive.
  let hasAlpha = false;
  outer: for (const f of frames) {
    for (let p = 3; p < f.data.length; p += 4) {
      if (f.data[p]! < 128) { hasAlpha = true; break outer; }
    }
  }
  const format = hasAlpha ? 'rgba4444' : 'rgb565';

  const gif = GIFEncoder();
  const delay = Math.round(1000 / Math.max(1, fps));

  for (let i = 0; i < frames.length; i++) {
    const data = frames[i]!.data;
    const palette = quantize(data, 256, { format, oneBitAlpha: hasAlpha });
    const index = applyPalette(data, palette, format);
    gif.writeFrame(index, w, h, {
      palette,
      delay,
      transparent: hasAlpha,
      // Restore-to-background disposal prevents ghosting between transparent frames
      dispose: hasAlpha ? 2 : 0,
      ...(i === 0 ? { repeat: loop ? 0 : -1 } : {}),
    });
    onProgress?.(i + 1, frames.length);
    // Yield so a UI can show progress during long encodes
    await new Promise((r) => setTimeout(r, 0));
  }

  gif.finish();
  return gif.bytes();
}

/** Effective pixel dimensions of a node's visible content (crop-aware). */
function nodeContentDims(node: ImageNode): { w: number; h: number } {
  if (node.cropRect) return { w: node.cropRect.w, h: node.cropRect.h };
  return { w: node.naturalWidth, h: node.naturalHeight };
}

export interface NodeGifStats {
  count: number;
  maxW: number;
  maxH: number;
  /** true when frames have differing content dimensions */
  mismatched: boolean;
  /** distinct sizes, e.g. ["512×512", "1024×768"] */
  sizes: string[];
}

/** Pre-flight stats for exporting workspace elements as GIF frames. */
export function analyzeNodesForGif(nodes: ImageNode[]): NodeGifStats {
  const sizes = new Set<string>();
  let maxW = 0, maxH = 0;
  for (const n of nodes) {
    const { w, h } = nodeContentDims(n);
    sizes.add(`${w}×${h}`);
    maxW = Math.max(maxW, w);
    maxH = Math.max(maxH, h);
  }
  return { count: nodes.length, maxW, maxH, mismatched: sizes.size > 1, sizes: Array.from(sizes) };
}

/**
 * Encode workspace elements as GIF frames at their source resolution
 * (crop, paint layers, adjustments, and flips applied; rotation ignored).
 * `scale` uniformly scales all frames (e.g. 0.5 to halve output size);
 * mismatched frames are centered on a canvas sized to the largest frame.
 */
export async function encodeGifFromNodes(
  nodes: ImageNode[],
  fps: number,
  loop: boolean,
  scale: number,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  if (nodes.length === 0) throw new Error('No frames to encode');
  const stats = analyzeNodesForGif(nodes);
  const w = Math.max(1, Math.round(stats.maxW * scale));
  const h = Math.max(1, Math.round(stats.maxH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  const frames: GifFrame[] = [];
  for (const node of nodes) {
    const src = await flattenNode(node);
    const img = await loadImage(src);
    const dims = nodeContentDims(node);
    const dw = dims.w * scale;
    const dh = dims.h * scale;
    const dx = (w - dw) / 2;
    const dy = (h - dh) / 2;
    const sx = node.cropRect?.x ?? 0;
    const sy = node.cropRect?.y ?? 0;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    if (node.flipH || node.flipV) {
      ctx.translate(w / 2, h / 2);
      ctx.scale(node.flipH ? -1 : 1, node.flipV ? -1 : 1);
      ctx.translate(-w / 2, -h / 2);
    }
    ctx.drawImage(img, sx, sy, dims.w, dims.h, dx, dy, dw, dh);
    ctx.restore();
    frames.push({ data: ctx.getImageData(0, 0, w, h).data, width: w, height: h });
  }

  const bytes = await encodeGifFrames(frames, fps, loop, onProgress);
  return new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: 'image/gif' });
}

/**
 * Browser entry — loads image sources, rasterizes them (centered on a canvas
 * sized to the largest frame), and encodes an animated GIF blob.
 */
export async function encodeGif(
  srcs: string[],
  fps: number,
  loop: boolean,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  if (srcs.length === 0) throw new Error('No frames to encode');
  const imgs = await Promise.all(srcs.map(loadImage));
  const w = Math.max(...imgs.map((i) => i.naturalWidth));
  const h = Math.max(...imgs.map((i) => i.naturalHeight));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  const frames: GifFrame[] = imgs.map((img) => {
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, Math.floor((w - img.naturalWidth) / 2), Math.floor((h - img.naturalHeight) / 2));
    return { data: ctx.getImageData(0, 0, w, h).data, width: w, height: h };
  });

  const bytes = await encodeGifFrames(frames, fps, loop, onProgress);
  return new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: 'image/gif' });
}
