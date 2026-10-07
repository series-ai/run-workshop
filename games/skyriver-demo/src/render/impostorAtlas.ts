/**
 * @file impostorAtlas.ts — the far-city impostor cards (R16), baked at boot into one Canvas2D atlas.
 *
 * R15 drew the three far-skyline layers as ~260 box masses in the tower batch. R16 replaces them with
 * cards: each far tower is a crossed pair of alpha-tested quads (city.ts) that samples one of 64
 * baked silhouettes here — near-black massing with a sparse grid of lit windows. Mipmapping averages
 * the windows into a glow with distance, so a card costs one texture tap where a box ran the facade
 * shader's far branch on three to five faces.
 *
 * Layout (2048 x 1024 RGBA, mipmapped): 32 columns x 2 rows of 64 x 512 px cells. A cell is two
 * sections:
 *   - crown, the top CROWN_PX rows: the tower's top (flat parapet, stepped cap, or cap and spire),
 *     standing for IMPOSTOR_CROWN_WIDTHS card-widths of height;
 *   - body, the remaining BODY_PX rows: a seamless window tile, IMPOSTOR_BODY_WIDTHS card-widths tall,
 *     repeated down the card so windows keep their aspect however tall the tower is.
 * RGB is lit-window colour (linear, used as emissive), alpha is the silhouette. Zero shipped assets.
 */
import * as THREE from 'three';

export const IMPOSTOR_ATLAS_WIDTH = 2048;
export const IMPOSTOR_ATLAS_HEIGHT = 1024;
export const IMPOSTOR_COLUMNS = 32;
export const IMPOSTOR_ROWS = 2;
export const IMPOSTOR_VARIANTS = IMPOSTOR_COLUMNS * IMPOSTOR_ROWS;
const CELL_W = IMPOSTOR_ATLAS_WIDTH / IMPOSTOR_COLUMNS;
const CELL_H = IMPOSTOR_ATLAS_HEIGHT / IMPOSTOR_ROWS;
export const IMPOSTOR_CROWN_PX = 192;
export const IMPOSTOR_BODY_PX = CELL_H - IMPOSTOR_CROWN_PX;
/** Card heights the two sections stand for, in card widths (crown px / cell width, and body). */
export const IMPOSTOR_CROWN_WIDTHS = IMPOSTOR_CROWN_PX / CELL_W;
export const IMPOSTOR_BODY_WIDTHS = IMPOSTOR_BODY_PX / CELL_W;
/** Variant ranges by top shape: flat parapet, stepped cap, cap and spire. */
export const IMPOSTOR_FLAT = [0, 21] as const;
export const IMPOSTOR_CAP = [21, 43] as const;
export const IMPOSTOR_SPIRE = [43, 64] as const;

export interface ImpostorAtlas {
  readonly texture: THREE.Texture;
  dispose(): void;
}

/** Deterministic hash, the CPU twin of the shaders' skyHash11. */
function hash(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453123;
  return s - Math.floor(s);
}

/** Window cell, px: 4 across by 5 down, glass 2 x 3 (about 14 x 9 m on a 220 m card). */
const WIN_W = 4;
const WIN_H = 5;

/**
 * Lit windows over a rectangle of one cell. Rows are gated in zones (whole floors dark), and a lit
 * share of ~14% inside lit zones, warm or cold per window — the R15 far-layer rule, baked.
 */
function windows(ctx: CanvasRenderingContext2D, variant: number, x0: number, y0: number, w: number, h: number, rowOffset: number): void {
  for (let row = 0; row * WIN_H < h; row += 1) {
    const globalRow = row + rowOffset;
    const zoneLit = hash(Math.floor(globalRow / 8) * 7.13 + variant * 31.7) > 0.45;
    if (!zoneLit) continue;
    for (let col = 0; col * WIN_W < w; col += 1) {
      const pick = hash(globalRow * 13.31 + col * 3.77 + variant * 17.9);
      if (pick < 0.9) continue;
      const warm = hash(globalRow * 3.1 + col * 7.7 + variant * 11.0) < 0.6;
      ctx.fillStyle = warm ? 'rgb(255,140,56)' : 'rgb(115,166,255)';
      ctx.fillRect(x0 + col * WIN_W + 1, y0 + row * WIN_H + 1, 2, 3);
    }
  }
}

/**
 * Draws the atlas. Needs a DOM canvas, so it runs in the browser only (the city constructor calls
 * it; nothing at module scope touches the DOM).
 */
export function createImpostorAtlas(): ImpostorAtlas {
  const canvas = document.createElement('canvas');
  canvas.width = IMPOSTOR_ATLAS_WIDTH;
  canvas.height = IMPOSTOR_ATLAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('SKYRIVER_IMPOSTOR_ATLAS_NO_2D_CONTEXT');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let variant = 0; variant < IMPOSTOR_VARIANTS; variant += 1) {
    const cx = (variant % IMPOSTOR_COLUMNS) * CELL_W;
    const cy = Math.floor(variant / IMPOSTOR_COLUMNS) * CELL_H;
    const bodyTop = cy + IMPOSTOR_CROWN_PX;
    const solid = 'rgb(0,0,0)';

    // Body tile: full width, seamless (the window rows wrap on the tile height).
    ctx.fillStyle = solid;
    ctx.fillRect(cx, bodyTop, CELL_W, IMPOSTOR_BODY_PX);
    windows(ctx, variant, cx, bodyTop, CELL_W, IMPOSTOR_BODY_PX, 0);

    // Crown: the body runs up to a roofline, then the top shape above it.
    const flat = variant < IMPOSTOR_FLAT[1];
    const spire = variant >= IMPOSTOR_SPIRE[0];
    const roof = cy + Math.round(IMPOSTOR_CROWN_PX * (flat ? 0.04 + 0.12 * hash(variant + 0.5) : 0.42 + 0.3 * hash(variant + 0.5)));
    ctx.fillStyle = solid;
    ctx.fillRect(cx, roof, CELL_W, bodyTop - roof);
    windows(ctx, variant, cx, roof, CELL_W, bodyTop - roof, 1000);
    if (!flat) {
      // Stepped cap: one or two narrower stages, off-centre a little.
      const capW = Math.round(CELL_W * (0.38 + 0.24 * hash(variant + 1.5)));
      const capX = cx + Math.round((CELL_W - capW) * (0.3 + 0.4 * hash(variant + 2.5)));
      const capTop = cy + Math.round((roof - cy) * (spire ? 0.55 + 0.2 * hash(variant + 3.5) : 0.1 + 0.4 * hash(variant + 3.5)));
      ctx.fillStyle = solid;
      ctx.fillRect(capX, capTop, capW, roof - capTop + 1);
      windows(ctx, variant + 0.5, capX, capTop, capW, roof - capTop, 2000);
      if (spire) {
        const spireW = Math.max(2, Math.round(CELL_W * 0.07));
        const spireX = capX + Math.round((capW - spireW) * 0.5);
        ctx.fillStyle = solid;
        ctx.fillRect(spireX, cy + 2, spireW, capTop - cy - 1);
        // Aircraft-warning lamp at the tip.
        ctx.fillStyle = 'rgb(255,60,40)';
        ctx.fillRect(spireX, cy + 2, spireW, 2);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'skyriver.impostorAtlas';
  // Window colours are emissive data, not an sRGB image.
  texture.colorSpace = THREE.NoColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return {
    texture,
    dispose(): void {
      texture.dispose();
    },
  };
}
