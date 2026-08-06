/** Types for the vendored cutout engine (see cutoutEngine.mjs header). */

export interface CutoutImage {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

export interface CutoutSeed {
  x: number;
  y: number;
  tolerance?: number;
}

export interface CutoutOptions {
  tolerance?: number;
  contract?: number;
  smooth?: number;
  feather?: number;
  shadow?: boolean;
  shadowStrength?: number;
  /** chroma only */
  key?: string;
  despill?: number;
  despillReach?: number;
  despillTone?: number;
}

export interface CutoutResult extends CutoutImage {
  transparentPct: number;
}

export function wandCutout(img: CutoutImage, seeds: CutoutSeed[], opts: CutoutOptions): CutoutResult;
export function chromaCutout(img: CutoutImage, seeds: CutoutSeed[], opts: CutoutOptions): CutoutResult;

/** Neutral-darkening test: 0..1 how much pixel i is a shadow of bg color. */
export function shadowDarkness(d: Uint8ClampedArray, i: number, bg: number[]): number;

/** Selection-space ops (255 = selected/removed) shared with matte refinement. */
export function contractSel(sel: Uint8ClampedArray, w: number, h: number, r: number): void;
export function smoothSel(sel: Uint8ClampedArray, w: number, h: number, r: number): void;
export function blurSel(sel: Uint8ClampedArray, w: number, h: number, r: number): void;
export function erodeSel(sel: Uint8ClampedArray, w: number, h: number, r: number): void;
export function dilateSel(sel: Uint8ClampedArray, w: number, h: number, r: number): void;
