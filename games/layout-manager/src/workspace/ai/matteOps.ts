/**
 * Cheap post-processing on an AI foreground matte (0 = background,
 * 255 = foreground). Reuses the cutout engine's selection ops so the AI
 * engines get the same Edge controls as the Simple engine. All ops run in
 * milliseconds — the expensive inference happens once, then these re-apply
 * live as sliders move.
 */
import { contractSel, smoothSel, blurSel, shadowDarkness } from './cutoutEngine.mjs';

export interface MatteOpts {
  /** 0 = raw model matte; 100 = near-binary cut at 50% confidence. */
  hardness?: number;
  /** Shrink the removed region N px; negative expands it (eats fringe). */
  contract?: number;
  /** Round contours N px. */
  smooth?: number;
  /** Blur the edge N px. */
  feather?: number;
}

/** Returns a refined copy of the matte; the input is not modified. */
export function refineMatte(matte: Uint8ClampedArray, w: number, h: number, opts: MatteOpts): Uint8ClampedArray {
  const m = matte.slice();
  const hard = opts.hardness ?? 0;
  if (hard > 0) {
    // Levels around 50% confidence: higher hardness narrows the soft band
    const T = 128;
    const S = Math.max(1, 128 * (1 - hard / 100));
    for (let i = 0; i < m.length; i++) {
      const v = ((m[i]! - (T - S)) / (2 * S)) * 255;
      m[i] = Math.max(0, Math.min(255, Math.round(v)));
    }
  }
  if (opts.contract || opts.smooth || opts.feather) {
    // Engine ops work in background-selection space (255 = removed) — invert
    const sel = new Uint8ClampedArray(m.length);
    for (let i = 0; i < m.length; i++) sel[i] = 255 - m[i]!;
    if (opts.contract) contractSel(sel, w, h, opts.contract);
    if (opts.smooth) smoothSel(sel, w, h, opts.smooth);
    if (opts.feather) blurSel(sel, w, h, opts.feather);
    for (let i = 0; i < m.length; i++) m[i] = 255 - sel[i]!;
  }
  return m;
}

/** Multiply the matte into an ImageData's alpha channel (in place). */
export function applyMatteToImageData(imageData: ImageData, matte: Uint8ClampedArray): void {
  const d = imageData.data;
  for (let p = 0; p < matte.length; p++) {
    d[p * 4 + 3] = Math.round((d[p * 4 + 3]! * matte[p]!) / 255);
  }
}

/** Dominant opaque colors along the image border — the shadow anchors the
 * bg-removal-softshadows skill's engine A auto-samples: quantized to
 * 16-steps, pairwise distance >= 38, max 4 colors. */
export function borderPalette(imageData: ImageData, maxColors = 4): [number, number, number][] {
  const { data: d, width: w, height: h } = imageData;
  const counts = new Map<number, { n: number; r: number; g: number; b: number }>();
  const tally = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    if (d[i + 3]! < 200) return;
    const qr = (d[i]! >> 4) << 4;
    const qg = (d[i + 1]! >> 4) << 4;
    const qb = (d[i + 2]! >> 4) << 4;
    const key = (qr << 16) | (qg << 8) | qb;
    const e = counts.get(key);
    if (e) e.n++;
    else counts.set(key, { n: 1, r: qr + 8, g: qg + 8, b: qb + 8 });
  };
  for (let x = 0; x < w; x++) { tally(x, 0); tally(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { tally(0, y); tally(w - 1, y); }
  const sorted = Array.from(counts.values()).sort((a, b) => b.n - a.n);
  const picked: [number, number, number][] = [];
  const MIN_DIST_SQ = 38 * 38;
  for (const c of sorted) {
    if (picked.length >= maxColors) break;
    const far = picked.every(([r, g, b]) => {
      const dr = c.r - r; const dg = c.g - g; const db = c.b - b;
      return dr * dr + dg * dg + db * db >= MIN_DIST_SQ;
    });
    if (far) picked.push([c.r, c.g, c.b]);
  }
  return picked;
}

/** Composite an AI matte with the skill's shadow double pass: object layer
 * alpha = matte, plus removed pixels that are a neutral darkening of a
 * border anchor come back as translucent black (shadow_alpha = darkness *
 * source_alpha * (1 - subject_alpha)). Operates on the ORIGINAL pixels. */
export function applyMatteWithShadows(imageData: ImageData, matte: Uint8ClampedArray, shadowStrength = 100): void {
  const d = imageData.data;
  const anchors = borderPalette(imageData);
  const strength = shadowStrength / 100;
  for (let p = 0; p < matte.length; p++) {
    const i = p * 4;
    const srcA = d[i + 3]! / 255;
    const subjA = matte[p]! / 255;
    const aO = srcA * subjA;
    let aS = 0;
    if (anchors.length && aO < 1) {
      let dark = 0;
      for (const bg of anchors) {
        const v = shadowDarkness(d, i, bg);
        if (v > dark) dark = v;
      }
      aS = Math.min(1, dark * strength) * srcA * (1 - subjA);
    }
    const aF = aO + aS;
    if (aS > 0 && aF > 0) {
      // Shadow contributes as translucent BLACK (un-composited multiply)
      const f = aO / aF;
      d[i] = Math.round(d[i]! * f);
      d[i + 1] = Math.round(d[i + 1]! * f);
      d[i + 2] = Math.round(d[i + 2]! * f);
    }
    d[i + 3] = Math.round(255 * aF);
  }
}
