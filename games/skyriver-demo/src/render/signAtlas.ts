/**
 * Draw seeded sign species in one boot atlas.
 * System fonts supply glyphs. Canvas paths supply all other art.
 * Red controls emission. Green stores the accent mask.
 * The sign material applies the district tint.
 * Hero cells keep their reserved brand text.
 */
import * as THREE from 'three';
import { signCellSpecies } from './signDesign';
import { drawSignArt } from './signArt';

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

export interface SignAtlasLayout {
  readonly vertical: readonly AtlasRect[];
  readonly horizontal: readonly AtlasRect[];
}

export interface SignAtlas {
  readonly texture: THREE.Texture;
  readonly vertical: readonly AtlasRect[];
  readonly horizontal: readonly AtlasRect[];
  dispose(): void;
}

export type SignAtlasCanvas = HTMLCanvasElement | OffscreenCanvas;
export type SignAtlasContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const CJK_FONT = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", "Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif';
const LATIN_FONT = '"Helvetica Neue", "Arial Narrow", Arial, "Noto Sans", sans-serif';

function rectFor(x: number, y: number, w: number, h: number): AtlasRect {
  return [x / SIGN_ATLAS_WIDTH, 1 - (y + h) / SIGN_ATLAS_HEIGHT, (x + w) / SIGN_ATLAS_WIDTH, 1 - y / SIGN_ATLAS_HEIGHT];
}

/** Neon tube look: a soft wide glow pass, then the crisp core on top. */
function neonText(ctx: SignAtlasContext, text: string, x: number, y: number): void {
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x, y);
}

function frame(ctx: SignAtlasContext, x: number, y: number, w: number, h: number): void {
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 5;
  ctx.shadowColor = 'rgba(255,255,255,0.8)';
  ctx.shadowBlur = 8;
  ctx.strokeRect(x + 7, y + 7, w - 14, h - 14);
  ctx.shadowBlur = 0;
}

/** Compute vertical and horizontal cell rectangles without canvas operations. */
export function deriveSignAtlasLayout(): SignAtlasLayout {
  const vertical: AtlasRect[] = [];
  for (let i = 0; i < VERTICAL_CELL.count; i += 1) {
    const x = (i % VERTICAL_CELL.perRow) * VERTICAL_CELL.w;
    const y = Math.floor(i / VERTICAL_CELL.perRow) * VERTICAL_CELL.h;
    vertical.push(rectFor(x, y, VERTICAL_CELL.w, VERTICAL_CELL.h));
  }

  const horizontal: AtlasRect[] = [];
  const baseY = VERTICAL_CELL.h * 2;
  for (let row = 0; row < HORIZONTAL_CELL.rows; row += 1) {
    for (let column = 0; column < HORIZONTAL_CELL.columns; column += 1) {
      const x = column * HORIZONTAL_CELL.w;
      const y = baseY + row * HORIZONTAL_CELL.h;
      horizontal.push(rectFor(x, y, HORIZONTAL_CELL.w, HORIZONTAL_CELL.h));
    }
  }

  return { vertical, horizontal };
}

/** Paint sign species and lettering into a canvas. */
export function paintSignAtlas(canvas: HTMLCanvasElement | OffscreenCanvas): SignAtlasLayout {
  canvas.width = SIGN_ATLAS_WIDTH;
  canvas.height = SIGN_ATLAS_HEIGHT;
  const ctx = 'transferToImageBitmap' in canvas
    ? canvas.getContext('2d')
    : canvas.getContext('2d');
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
    const species = signCellSpecies(i, true);
    if (species !== 'glyph') {
      drawSignArt(ctx, species, x, y, w, h, i - 17);
    } else if (i < VERTICAL_STACKED.length) {
      if (i % 4 === 0) frame(ctx, x, y, w, h);
      if (i % 4 === 1) { ctx.translate(x + w / 2, y + h / 2); ctx.rotate(-0.055); ctx.translate(-x - w / 2, -y - h / 2); }
      if (i % 4 === 2) drawSignArt(ctx, 'emblem', x + w * .24, y + 10, w * .52, w * .52, i);
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
      const species = signCellSpecies(index, false);
      if (species !== 'glyph') {
        drawSignArt(ctx, species, x, y, w, h, index - 4);
        ctx.restore();
        horizontal.push(rectFor(x, y, w, h));
        continue;
      }
      if (index % 4 === 3) frame(ctx, x, y, w, h);
      const cjk = /[぀-ヿ一-鿿]/u.test(word);
      let size = 74;
      ctx.font = `800 ${size}px ${cjk ? CJK_FONT : LATIN_FONT}`;
      const fitWidth = index < HERO_HORIZONTAL_CELLS ? w - 56 : w * .62;
      const fit = fitWidth / ctx.measureText(word).width;
      if (fit < 1) {
        size = Math.floor(size * fit);
        ctx.font = `800 ${size}px ${cjk ? CJK_FONT : LATIN_FONT}`;
      }
      if (index === 0) {
        const chars = [...word];
        const radius = w * .62;
        ctx.font = `800 56px ${LATIN_FONT}`;
        chars.forEach((char, k) => {
          const angle = (k - (chars.length - 1) * .5) * .12;
          ctx.save(); ctx.translate(x + w * .5 + Math.sin(angle) * radius, y + h * .36 + (1 - Math.cos(angle)) * radius);
          ctx.rotate(angle); neonText(ctx, char, 0, 0); ctx.restore();
        });
      } else if (index === 1) {
        drawSignArt(ctx, 'tube', x + 8, y + 8, h - 16, h - 16, 1);
        ctx.save(); ctx.translate(x + w * .6, y + h * .5); ctx.scale(.72, .9); neonText(ctx, word, 0, 0); ctx.restore();
      } else {
        ctx.save(); ctx.translate(x + w / 2, y + h / 2 + 3); ctx.rotate(index === 2 ? -.08 : 0);
        neonText(ctx, word, 0, 0); ctx.restore();
      }
      ctx.restore();
      horizontal.push(rectFor(x, y, w, h));
    }
  }

  return { vertical, horizontal };
}

// Cache one immutable canvas and layout.
let bootAtlas: (SignAtlasLayout & { readonly canvas: HTMLCanvasElement }) | null = null;

/** Install a pre-rendered atlas bitmap into the cache. */
export function installSignAtlasBitmap(bitmap: ImageBitmap): void {
  if (bootAtlas !== null) return;
  const canvas = document.createElement('canvas');
  canvas.width = SIGN_ATLAS_WIDTH;
  canvas.height = SIGN_ATLAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('SKYRIVER_SIGN_ATLAS_NO_2D_CONTEXT');
  ctx.drawImage(bitmap, 0, 0);
  bootAtlas = { canvas, ...deriveSignAtlasLayout() };
}

/** Create one sign atlas with a new canvas texture over the cached canvas. */
export function createSignAtlas(): SignAtlas {
  if (bootAtlas === null) {
    const canvas = document.createElement('canvas');
    bootAtlas = { canvas, ...paintSignAtlas(canvas) };
  }
  const texture = new THREE.CanvasTexture(bootAtlas.canvas);
  texture.name = 'skyriver.signAtlas';
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;

  return {
    texture,
    vertical: bootAtlas.vertical,
    horizontal: bootAtlas.horizontal,
    dispose(): void {
      texture.dispose();
    },
  };
}
