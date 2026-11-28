/**
 * Pure pixel-buffer primitives, pattern compiler, 1px contour outliner,
 * nearest-neighbor blitter, and zero-dependency RGBA PNG encoder.
 */

import { deflateSync } from 'node:zlib';

/** Little-endian packed RGBA32: R in bits 0..7, G in 8..15, B in 16..23, A in 24..31. */
export type RGBA32 = number;

export interface PixelSurface {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint32Array;
}

export function packRGBA(r: number, g: number, b: number, a = 255): RGBA32 {
  return (((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;
}

export function hexToU32(hex: string, alpha = 255): RGBA32 {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex;
  if (clean.length !== 6) {
    throw new Error(`Expected 6-digit hex color, got "${hex}"`);
  }
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return packRGBA(r, g, b, alpha);
}

export function createSurface(width: number, height: number, fill: RGBA32 = 0): PixelSurface {
  const pixels = new Uint32Array(width * height);
  if (fill !== 0) pixels.fill(fill);
  return { width, height, pixels };
}

/**
 * Compile an ASCII pixel-art matrix into a strict PixelSurface.
 * '.' and ' ' map to transparent (0). All rows must have identical length.
 */
export function compilePattern(
  rows: readonly string[],
  palette: Readonly<Record<string, RGBA32>>,
  expectedWidth?: number,
  expectedHeight?: number,
): PixelSurface {
  const height = rows.length;
  if (height === 0) {
    throw new Error('compilePattern requires at least one row');
  }
  const width = rows[0].length;
  if (expectedHeight !== undefined && height !== expectedHeight) {
    throw new Error(`Pattern height ${height} !== expected ${expectedHeight}`);
  }
  if (expectedWidth !== undefined && width !== expectedWidth) {
    throw new Error(`Pattern width ${width} !== expected ${expectedWidth}`);
  }

  const pixels = new Uint32Array(width * height);
  for (let y = 0; y < height; y++) {
    const row = rows[y];
    if (row.length !== width) {
      throw new Error(`Pattern row ${y} length ${row.length} !== ${width}`);
    }
    for (let x = 0; x < width; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const col = palette[ch];
      if (col === undefined) {
        throw new Error(`Unknown palette key "${ch}" at (${x}, ${y})`);
      }
      pixels[y * width + x] = col;
    }
  }
  return { width, height, pixels };
}

export function mirrorHorizontal(src: PixelSurface): PixelSurface {
  const dst = new Uint32Array(src.width * src.height);
  for (let y = 0; y < src.height; y++) {
    const row = y * src.width;
    for (let x = 0; x < src.width; x++) {
      dst[row + (src.width - 1 - x)] = src.pixels[row + x];
    }
  }
  return { width: src.width, height: src.height, pixels: dst };
}

/**
 * Return a (width+2) x (height+2) surface with a crisp 4-neighbor 1px ink outline
 * around every opaque pixel of `src`.
 */
export function addPixelOutline(src: PixelSurface, outlineColor: RGBA32): PixelSurface {
  const w = src.width + 2;
  const h = src.height + 2;
  const dst = new Uint32Array(w * h);

  // Copy core sprite centered at (+1, +1)
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      dst[(y + 1) * w + (x + 1)] = src.pixels[y * src.width + x];
    }
  }

  // Stamp 4-neighbor outline on transparent border pixels
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if ((dst[i] >>> 24) !== 0) continue;
      const hasNeighbor =
        (x > 0 && (dst[i - 1] >>> 24) > 0 && dst[i - 1] !== outlineColor) ||
        (x + 1 < w && (dst[i + 1] >>> 24) > 0 && dst[i + 1] !== outlineColor) ||
        (y > 0 && (dst[i - w] >>> 24) > 0 && dst[i - w] !== outlineColor) ||
        (y + 1 < h && (dst[i + w] >>> 24) > 0 && dst[i + w] !== outlineColor);
      if (hasNeighbor) {
        dst[i] = outlineColor;
      }
    }
  }
  return { width: w, height: h, pixels: dst };
}

export function blendPixel(dst: Uint32Array, index: number, src: RGBA32): void {
  const a = (src >>> 24) & 255;
  if (a === 0) return;
  if (a === 255) {
    dst[index] = src;
    return;
  }
  const bg = dst[index];
  const f = a / 255;
  const inv = 1 - f;
  const r = Math.round((src & 255) * f + (bg & 255) * inv);
  const g = Math.round(((src >>> 8) & 255) * f + ((bg >>> 8) & 255) * inv);
  const b = Math.round(((src >>> 16) & 255) * f + ((bg >>> 16) & 255) * inv);
  dst[index] = packRGBA(r, g, b, 255);
}

export function setPixel(dst: PixelSurface, x: number, y: number, color: RGBA32): void {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || ix >= dst.width || iy < 0 || iy >= dst.height) return;
  blendPixel(dst.pixels, iy * dst.width + ix, color);
}

export function fillRect(
  dst: PixelSurface,
  x: number,
  y: number,
  w: number,
  h: number,
  color: RGBA32,
): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(dst.width, Math.floor(x + w));
  const y1 = Math.min(dst.height, Math.floor(y + h));
  for (let py = y0; py < y1; py++) {
    const row = py * dst.width;
    for (let px = x0; px < x1; px++) {
      blendPixel(dst.pixels, row + px, color);
    }
  }
}

export function drawEllipse(
  dst: PixelSurface,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: RGBA32,
): void {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(dst.width - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(dst.height - 1, Math.ceil(cy + ry));
  for (let py = y0; py <= y1; py++) {
    const dy = (py + 0.5 - cy) / ry;
    for (let px = x0; px <= x1; px++) {
      const dx = (px + 0.5 - cx) / rx;
      if (dx * dx + dy * dy <= 1) {
        blendPixel(dst.pixels, py * dst.width + px, color);
      }
    }
  }
}

export function drawLine(
  dst: PixelSurface,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: RGBA32,
): void {
  let ix0 = Math.round(x0);
  let iy0 = Math.round(y0);
  const ix1 = Math.round(x1);
  const iy1 = Math.round(y1);
  const dx = Math.abs(ix1 - ix0);
  const dy = -Math.abs(iy1 - iy0);
  const sx = ix0 < ix1 ? 1 : -1;
  const sy = iy0 < iy1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    setPixel(dst, ix0, iy0, color);
    if (ix0 === ix1 && iy0 === iy1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      ix0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      iy0 += sy;
    }
  }
}

export function blitScaled(
  dst: PixelSurface,
  src: PixelSurface,
  dstX: number,
  dstY: number,
  zoom = 1,
): void {
  for (let sy = 0; sy < src.height; sy++) {
    for (let sx = 0; sx < src.width; sx++) {
      const c = src.pixels[sy * src.width + sx];
      if ((c >>> 24) === 0) continue;
      for (let zy = 0; zy < zoom; zy++) {
        const ty = dstY + sy * zoom + zy;
        if (ty < 0 || ty >= dst.height) continue;
        for (let zx = 0; zx < zoom; zx++) {
          const tx = dstX + sx * zoom + zx;
          if (tx < 0 || tx >= dst.width) continue;
          blendPixel(dst.pixels, ty * dst.width + tx, c);
        }
      }
    }
  }
}

export function scaleSurface(src: PixelSurface, zoom: number): PixelSurface {
  const dst = createSurface(src.width * zoom, src.height * zoom);
  blitScaled(dst, src, 0, 0, zoom);
  return dst;
}

// ---------- Zero-dependency PNG encoder ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length, false);
  out[4] = type.charCodeAt(0);
  out[5] = type.charCodeAt(1);
  out[6] = type.charCodeAt(2);
  out[7] = type.charCodeAt(3);
  out.set(data, 8);
  const crc = crc32(out.subarray(4, 8 + data.length));
  view.setUint32(8 + data.length, crc, false);
  return out;
}

export function encodePNG(surface: PixelSurface): Uint8Array {
  const { width, height, pixels } = surface;
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowOff = y * (width * 4 + 1);
    raw[rowOff] = 0;
    for (let x = 0; x < width; x++) {
      const c = pixels[y * width + x];
      const o = rowOff + 1 + x * 4;
      raw[o] = c & 255;
      raw[o + 1] = (c >>> 8) & 255;
      raw[o + 2] = (c >>> 16) & 255;
      raw[o + 3] = (c >>> 24) & 255;
    }
  }

  const ihdr = new Uint8Array(13);
  const iv = new DataView(ihdr.buffer);
  iv.setUint32(0, width, false);
  iv.setUint32(4, height, false);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const idat = deflateSync(raw, { level: 6 });
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const c1 = makeChunk('IHDR', ihdr);
  const c2 = makeChunk('IDAT', idat);
  const c3 = makeChunk('IEND', new Uint8Array(0));

  const total = new Uint8Array(sig.length + c1.length + c2.length + c3.length);
  let pos = 0;
  for (const part of [sig, c1, c2, c3]) {
    total.set(part, pos);
    pos += part.length;
  }
  return total;
}

export function surfaceToDataURL(surface: PixelSurface): string {
  const png = encodePNG(surface);
  return `data:image/png;base64,${Buffer.from(png).toString('base64')}`;
}
