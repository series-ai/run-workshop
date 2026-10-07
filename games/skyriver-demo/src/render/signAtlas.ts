/**
 * @file signAtlas.ts — the legible neon signage, drawn at boot into one Canvas2D atlas (T7).
 *
 * Both cycle-2 reviews read the signs as "blank glowing rectangles": the T6R glyphs were hashed
 * strokes, never letters. This module draws real lettering — a small fictional brand language
 * (NEO-KYOTO, ラーメン, CYBERNETICS, 未来銀行 …) in kana/kanji and latin — into an offscreen canvas
 * once, and city.ts samples it as the sign's emissive mask. Bloom then turns each lettered tube
 * into glowing signage.
 *
 * Zero shipped assets: the text is drawn with the platform's own system fonts at runtime (Hiragino
 * on Apple, Noto Sans CJK on Android/ChromeOS). Nothing is downloaded or bundled.
 *
 * Layout (one 2048 x 2048 RGBA canvas, mipmapped; T7-2 grew it so no sign text repeats):
 *   - 32 vertical cells, 128 x 768 px, in two bands: stacked kana/kanji, or latin set sideways.
 *     Cells 0..HERO_VERTICAL_CELLS-1 are reserved for the giant hero blades.
 *   - 16 horizontal cells, 512 x 128 px, in a 4 x 4 grid below: one-line wordmarks.
 *     Cells 0..HERO_HORIZONTAL_CELLS-1 are reserved for the giant wall panels.
 * The canvas holds white-on-black luminance only; the sign shader tints it per sign and adds a
 * white-hot tube core where the mask saturates.
 */
import * as THREE from 'three';

export const SIGN_ATLAS_WIDTH = 2048;
export const SIGN_ATLAS_HEIGHT = 2048;
const VERTICAL_CELL = { w: 128, h: 768, count: 32, perRow: 16 } as const;
const HORIZONTAL_CELL = { w: 512, h: 128, columns: 4, rows: 4 } as const;
/** Cells reserved for hero signs, so their text appears nowhere else in the canyon. */
/** R12: 16 reserved vertical cells — more hero blades (near-wall clusters), still no text repeats nearby. */
export const HERO_VERTICAL_CELLS = 16;
export const HERO_HORIZONTAL_CELLS = 4;

/** Stacked top-to-bottom, the way vertical shop signs read. */
const VERTICAL_STACKED: readonly string[] = Object.freeze([
  // Hero blades (cells 0-7).
  'ネオ京都',
  'ラーメン',
  'サイバネ',
  '未来銀行',
  'ホテル夜',
  'カラオケ',
  '電脳街',
  'スカイ川',
  // Ordinary banners.
  '寿司24',
  '風航空',
  '夜市',
  '薬局',
  '居酒屋',
  '雷電',
  '月光',
  '新宿区',
  '整備工',
  '銀河',
  '茶房',
  '星の湯',
  '赤提灯',
  '龍門',
]);
/** Latin set sideways along the blade (rotated 90 degrees). */
const VERTICAL_SIDEWAYS: readonly string[] = Object.freeze([
  'CYBERNETICS',
  'RAMEN 24H',
  'SKYRIVER',
  'MIRAI BANK',
  'ROBOTIX',
  'DATA VAULT',
  'KAZE AIR',
  'NIGHT MARKET',
  'PHARMA',
  'NOODLE BAR',
]);
const HORIZONTAL: readonly string[] = Object.freeze([
  // Giant wall panels (cells 0-3).
  'NEO-KYOTO',
  'CYBERNETICS',
  'スカイリバー',
  'MIRAI BANK 未来',
  // Ordinary strips.
  'RAMP ACCESS',
  'OPEN 24H',
  '寿司 SUSHI',
  'ROBOTIX',
  'HOTEL',
  '夜市 NIGHT',
  'RYOKAN',
  '電脳 CYBER',
  'NOODLE BAR',
  '薬 PHARMA',
  'KAZE AIR',
  'DATA VAULT',
]);

/** UV rectangle in the atlas: u0, v0, u1, v1 (v up, matching CanvasTexture's default flipY). */
export type AtlasRect = readonly [number, number, number, number];

export interface SignAtlas {
  readonly texture: THREE.Texture;
  readonly vertical: readonly AtlasRect[];
  readonly horizontal: readonly AtlasRect[];
  dispose(): void;
}

const CJK_FONT = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", "Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif';
const LATIN_FONT = '"Helvetica Neue", "Arial Narrow", Arial, "Noto Sans", sans-serif';

function rectFor(x: number, y: number, w: number, h: number): AtlasRect {
  return [x / SIGN_ATLAS_WIDTH, 1 - (y + h) / SIGN_ATLAS_HEIGHT, (x + w) / SIGN_ATLAS_WIDTH, 1 - y / SIGN_ATLAS_HEIGHT];
}

/** Neon tube look: a soft wide glow pass, then the crisp core on top. */
function neonText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x, y);
}

function frame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 5;
  ctx.shadowColor = 'rgba(255,255,255,0.8)';
  ctx.shadowBlur = 8;
  ctx.strokeRect(x + 7, y + 7, w - 14, h - 14);
  ctx.shadowBlur = 0;
}

/**
 * Draws the atlas. Needs a DOM canvas, so it runs in the browser only (the city constructor calls
 * it; nothing at module scope touches the DOM, so node tests can still import this file).
 */
export function createSignAtlas(): SignAtlas {
  const canvas = document.createElement('canvas');
  canvas.width = SIGN_ATLAS_WIDTH;
  canvas.height = SIGN_ATLAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('SKYRIVER_SIGN_ATLAS_NO_2D_CONTEXT');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const vertical: AtlasRect[] = [];
  for (let i = 0; i < VERTICAL_CELL.count; i += 1) {
    const x = (i % VERTICAL_CELL.perRow) * VERTICAL_CELL.w;
    const y = Math.floor(i / VERTICAL_CELL.perRow) * VERTICAL_CELL.h;
    const w = VERTICAL_CELL.w;
    const h = VERTICAL_CELL.h;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    if (i % 3 !== 2) frame(ctx, x, y, w, h);
    if (i < VERTICAL_STACKED.length) {
      const chars = [...VERTICAL_STACKED[i]!];
      const pitch = Math.min(118, (h - 60) / chars.length);
      ctx.font = `800 ${Math.round(pitch * 0.82)}px ${CJK_FONT}`;
      const top = y + h / 2 - (pitch * chars.length) / 2 + pitch / 2;
      chars.forEach((ch, k) => neonText(ctx, ch, x + w / 2, top + k * pitch));
    } else {
      const word = VERTICAL_SIDEWAYS[(i - VERTICAL_STACKED.length) % VERTICAL_SIDEWAYS.length]!;
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(-Math.PI / 2);
      let size = 84;
      ctx.font = `800 ${size}px ${LATIN_FONT}`;
      const fit = (h - 70) / ctx.measureText(word).width;
      if (fit < 1) {
        size = Math.floor(size * fit);
        ctx.font = `800 ${size}px ${LATIN_FONT}`;
      }
      neonText(ctx, word, 0, 4);
    }
    ctx.restore();
    vertical.push(rectFor(x, y, w, h));
  }

  const horizontal: AtlasRect[] = [];
  const baseY = VERTICAL_CELL.h * 2;
  for (let row = 0; row < HORIZONTAL_CELL.rows; row += 1) {
    for (let column = 0; column < HORIZONTAL_CELL.columns; column += 1) {
      const index = row * HORIZONTAL_CELL.columns + column;
      const x = column * HORIZONTAL_CELL.w;
      const y = baseY + row * HORIZONTAL_CELL.h;
      const w = HORIZONTAL_CELL.w;
      const h = HORIZONTAL_CELL.h;
      const word = HORIZONTAL[index % HORIZONTAL.length]!;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      if (index % 4 !== 3) frame(ctx, x, y, w, h);
      const cjk = /[぀-ヿ一-鿿]/u.test(word);
      let size = 74;
      ctx.font = `800 ${size}px ${cjk ? CJK_FONT : LATIN_FONT}`;
      const fit = (w - 56) / ctx.measureText(word).width;
      if (fit < 1) {
        size = Math.floor(size * fit);
        ctx.font = `800 ${size}px ${cjk ? CJK_FONT : LATIN_FONT}`;
      }
      neonText(ctx, word, x + w / 2, y + h / 2 + 3);
      ctx.restore();
      horizontal.push(rectFor(x, y, w, h));
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'skyriver.signAtlas';
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;

  return {
    texture,
    vertical,
    horizontal,
    dispose(): void {
      texture.dispose();
    },
  };
}
