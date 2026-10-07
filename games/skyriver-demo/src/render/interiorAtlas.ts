/**
 * @file interiorAtlas.ts — the rooms behind the windows, drawn at boot into one Canvas2D atlas (T7-4).
 *
 * Interior mapping (city.ts tower shader) ray-traces a box room behind every window cell: the hit
 * on the back wall, a side wall, the floor or the ceiling, plus one cut-out furniture layer at
 * mid-depth, is looked up here. Because the planes sit at different depths, furniture slides
 * against the back wall as the camera moves: true parallax from a flat facade.
 *
 * Layout: 2048 x 1280 RGBA, 8 x 5 rooms of 256 x 256 px. Inside a room cell (u right, v up):
 *   back wall   [0.00, 0.50] x [0.50, 1.00]   (x across, y up)
 *   furniture   [0.50, 1.00] x [0.50, 1.00]   (x across, y up; alpha = coverage)
 *   side wall   [0.00, 0.25] x [0.00, 0.50]   (u = depth 0..1, v = up)
 *   floor       [0.25, 0.625] x [0.00, 0.25]  (u = across, v = depth)
 *   ceiling     [0.25, 0.625] x [0.25, 0.50]  (u = across, v = depth)
 * Rooms 0-9 are GRIME (cluttered, warm, hanging bulbs), 10-21 MID (apartments and offices),
 * 22-31 PRISTINE (empty floors, thin ceiling light lines). R16 adds a fifth row of archetypes,
 * 32-39 (server room, noodle counter, karaoke lounge, laundromat, gym, grow room, gallery, workshop),
 * which the shader mixes into the strata sets. Values stay dark with strong contrast;
 * light fixtures are drawn near-white so the shader's light colour carries them over the bloom
 * threshold in lit rooms.
 *
 * Zero shipped assets: every room is drawn with Canvas2D primitives. Pure function of a seed.
 */
import * as THREE from 'three';

export const INTERIOR_ATLAS_COLUMNS = 8;
export const INTERIOR_ATLAS_ROWS = 5;
export const INTERIOR_ROOMS = INTERIOR_ATLAS_COLUMNS * INTERIOR_ATLAS_ROWS;
export const INTERIOR_GRIME_ROOMS: readonly [number, number] = [0, 10];
export const INTERIOR_MID_ROOMS: readonly [number, number] = [10, 12];
export const INTERIOR_PRISTINE_ROOMS: readonly [number, number] = [22, 10];
/** R16 archetypes, rooms 32-39, in this order. */
export const INTERIOR_EXTRA_ROOMS: readonly [number, number] = [32, 8];
type Extra = 'server' | 'noodle' | 'karaoke' | 'laundry' | 'gym' | 'grow' | 'gallery' | 'workshop';
const EXTRAS: readonly Extra[] = ['server', 'noodle', 'karaoke', 'laundry', 'gym', 'grow', 'gallery', 'workshop'];

const CELL = 256;
const WIDTH = CELL * INTERIOR_ATLAS_COLUMNS;
const HEIGHT = CELL * INTERIOR_ATLAS_ROWS;

type Theme = 'grime' | 'mid' | 'pristine';
type Ctx = CanvasRenderingContext2D;

/** Small deterministic PRNG (mulberry32): presentation only, seeded per room. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shade(rgb: readonly [number, number, number], k: number): string {
  return `rgb(${Math.round(rgb[0] * k)},${Math.round(rgb[1] * k)},${Math.round(rgb[2] * k)})`;
}

/** Sub-rectangle in canvas pixels for a room part. Canvas y grows down; atlas v grows up. */
function part(room: number, u0: number, v0: number, u1: number, v1: number): [number, number, number, number] {
  const cx = (room % INTERIOR_ATLAS_COLUMNS) * CELL;
  const cy = Math.floor(room / INTERIOR_ATLAS_COLUMNS) * CELL;
  const x = cx + u0 * CELL;
  const y = cy + (1 - v1) * CELL;
  return [x, y, (u1 - u0) * CELL, (v1 - v0) * CELL];
}

function glowDot(ctx: Ctx, x: number, y: number, r: number, color = 'rgba(255,240,210,1)'): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(0.25, 'rgba(255,220,170,0.55)');
  g.addColorStop(1, 'rgba(255,200,140,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function drawBackWall(ctx: Ctx, theme: Theme, rect: [number, number, number, number], r: () => number): void {
  const [x, y, w, h] = rect;
  const wallTone: readonly [number, number, number] = theme === 'grime'
    ? [120 + r() * 40, 92 + r() * 25, 62 + r() * 20]
    : theme === 'mid'
      ? (r() < 0.5 ? [150, 140, 125] : [105, 120, 140])
      : [60, 68, 80];
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, shade(wallTone, 0.75));
  g.addColorStop(1, shade(wallTone, 0.45));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  if (theme === 'grime') {
    // Stains, pipes, cluttered shelves, a poster.
    for (let i = 0; i < 6; i += 1) {
      ctx.fillStyle = `rgba(30,20,10,${0.15 + r() * 0.25})`;
      ctx.fillRect(x + r() * w, y + r() * h * 0.3, 4 + r() * 18, h * (0.3 + r() * 0.6));
    }
    ctx.fillStyle = 'rgba(40,32,26,0.9)';
    ctx.fillRect(x + w * 0.05, y, 5, h);
    for (let s = 0; s < 3; s += 1) {
      const sy = y + h * (0.25 + s * 0.2);
      ctx.fillStyle = 'rgba(35,25,18,1)';
      ctx.fillRect(x + w * 0.55, sy, w * 0.4, 4);
      for (let k = 0; k < 6; k += 1) {
        ctx.fillStyle = shade([90 + r() * 120, 70 + r() * 70, 40 + r() * 40], 0.8);
        const bw = 5 + r() * 10;
        const bh = 6 + r() * 14;
        ctx.fillRect(x + w * 0.56 + k * 9 + r() * 3, sy - bh, bw, bh);
      }
    }
    ctx.fillStyle = shade([160 + r() * 80, 60 + r() * 60, 50], 0.7);
    ctx.fillRect(x + w * 0.18, y + h * 0.18, w * 0.18, h * 0.24);
  } else if (theme === 'mid') {
    // Framed picture or blinds, a shelf or a door.
    if (r() < 0.5) {
      ctx.fillStyle = 'rgba(20,18,16,0.9)';
      ctx.fillRect(x + w * 0.3, y + h * 0.2, w * 0.3, h * 0.22);
      ctx.fillStyle = shade([90 + r() * 120, 90 + r() * 100, 110 + r() * 100], 0.7);
      ctx.fillRect(x + w * 0.32, y + h * 0.22, w * 0.26, h * 0.18);
    } else {
      ctx.fillStyle = 'rgba(25,22,20,0.85)';
      for (let s = 0; s < 3; s += 1) ctx.fillRect(x + w * 0.62, y + h * (0.22 + s * 0.16), w * 0.32, 3);
      for (let k = 0; k < 10; k += 1) {
        ctx.fillStyle = shade([60 + r() * 120, 50 + r() * 90, 40 + r() * 80], 0.8);
        ctx.fillRect(x + w * 0.63 + (k % 5) * 8, y + h * (0.22 + Math.floor(k / 5) * 0.16) - 12, 6, 12);
      }
    }
    if (r() < 0.4) {
      ctx.fillStyle = 'rgba(30,26,22,0.95)';
      ctx.fillRect(x + w * 0.08, y + h * 0.3, w * 0.16, h * 0.7);
    }
  } else {
    // Pristine: dark glass partition lines, one floor-to-ceiling panel joint pattern.
    ctx.strokeStyle = 'rgba(120,140,170,0.35)';
    ctx.lineWidth = 1;
    for (let k = 1; k < 4; k += 1) {
      ctx.beginPath();
      ctx.moveTo(x + (w * k) / 4, y);
      ctx.lineTo(x + (w * k) / 4, y + h);
      ctx.stroke();
    }
  }
}

function drawFurniture(ctx: Ctx, theme: Theme, rect: [number, number, number, number], r: () => number): void {
  const [x, y, w, h] = rect;
  // Furniture is a cut-out layer: transparent background, near-black silhouettes with a rim tone.
  const ink = theme === 'grime' ? 'rgba(18,12,8,1)' : 'rgba(14,13,14,1)';
  const rim = theme === 'grime' ? 'rgba(90,60,35,1)' : 'rgba(70,70,80,1)';
  const floorY = y + h;
  const silhouette = (bx: number, by: number, bw: number, bh: number): void => {
    ctx.fillStyle = ink;
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = rim;
    ctx.fillRect(bx, by, bw, 2);
  };
  if (theme === 'grime') {
    // Junk piles, a table with clutter, a chair, laundry on a line, a hanging bulb.
    for (let k = 0; k < 4; k += 1) {
      const bw = w * (0.08 + r() * 0.14);
      const bh = h * (0.08 + r() * 0.22);
      silhouette(x + r() * (w - bw), floorY - bh, bw, bh);
    }
    silhouette(x + w * 0.35, floorY - h * 0.3, w * 0.34, h * 0.05);
    silhouette(x + w * 0.37, floorY - h * 0.3, 4, h * 0.3);
    silhouette(x + w * 0.66, floorY - h * 0.3, 4, h * 0.3);
    for (let k = 0; k < 5; k += 1) silhouette(x + w * (0.38 + k * 0.06), floorY - h * (0.34 + r() * 0.06), 6, h * 0.05);
    ctx.strokeStyle = 'rgba(20,14,10,1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.18);
    ctx.lineTo(x + w, y + h * 0.22);
    ctx.stroke();
    for (let k = 0; k < 4; k += 1) {
      ctx.fillStyle = shade([60 + r() * 140, 40 + r() * 80, 30 + r() * 60], 0.5);
      ctx.fillRect(x + w * (0.1 + k * 0.2 + r() * 0.05), y + h * 0.19, w * 0.08, h * (0.08 + r() * 0.08));
    }
    const bx = x + w * (0.3 + r() * 0.4);
    ctx.fillStyle = 'rgba(20,14,10,1)';
    ctx.fillRect(bx, y, 1, h * 0.3);
    glowDot(ctx, bx, y + h * 0.31, 16);
  } else if (theme === 'mid') {
    const kind = Math.floor(r() * 5);
    if (kind === 0) {
      // Desk, monitor glow, lamp, chair.
      silhouette(x + w * 0.2, floorY - h * 0.32, w * 0.5, h * 0.04);
      silhouette(x + w * 0.22, floorY - h * 0.32, 4, h * 0.32);
      silhouette(x + w * 0.66, floorY - h * 0.32, 4, h * 0.32);
      ctx.fillStyle = 'rgba(140,190,255,1)';
      ctx.fillRect(x + w * 0.38, floorY - h * 0.5, w * 0.16, h * 0.13);
      silhouette(x + w * 0.62, floorY - h * 0.45, 3, h * 0.13);
      glowDot(ctx, x + w * 0.63, floorY - h * 0.46, 12);
      silhouette(x + w * 0.42, floorY - h * 0.28, w * 0.1, h * 0.28);
    } else if (kind === 1) {
      // Sofa and standing lamp, a person's silhouette.
      silhouette(x + w * 0.15, floorY - h * 0.22, w * 0.55, h * 0.22);
      silhouette(x + w * 0.15, floorY - h * 0.34, w * 0.08, h * 0.34);
      silhouette(x + w * 0.62, floorY - h * 0.34, w * 0.08, h * 0.34);
      silhouette(x + w * 0.8, floorY - h * 0.6, 3, h * 0.6);
      glowDot(ctx, x + w * 0.81, floorY - h * 0.62, 18);
      if (r() < 0.6) {
        silhouette(x + w * 0.4, floorY - h * 0.42, w * 0.07, h * 0.2);
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.arc(x + w * 0.435, floorY - h * 0.46, w * 0.035, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (kind === 2) {
      // Kitchen counter with upper cabinets and a hanging light.
      silhouette(x, floorY - h * 0.3, w * 0.75, h * 0.3);
      silhouette(x, y + h * 0.2, w * 0.6, h * 0.16);
      glowDot(ctx, x + w * 0.45, y + h * 0.42, 14);
    } else if (kind === 3) {
      // Bed, headboard, bedside lamp.
      silhouette(x + w * 0.2, floorY - h * 0.16, w * 0.6, h * 0.16);
      silhouette(x + w * 0.2, floorY - h * 0.32, w * 0.05, h * 0.32);
      glowDot(ctx, x + w * 0.12, floorY - h * 0.25, 10);
    }
    // kind 4: empty room.
  } else if (r() < 0.6) {
    // T7-5 pristine: open-plan office rows — low desks with cool monitor glows, receding in two rows.
    for (let row = 0; row < 2; row += 1) {
      const deskY = floorY - h * (0.22 + row * 0.12);
      const scale = row === 0 ? 1 : 0.7;
      for (let k = 0; k < 4; k += 1) {
        const dx = x + w * (0.08 + k * 0.23 + row * 0.1);
        silhouette(dx, deskY, w * 0.16 * scale, h * 0.03);
        ctx.fillStyle = 'rgba(150,200,255,1)';
        ctx.fillRect(dx + w * 0.04 * scale, deskY - h * 0.08 * scale, w * 0.08 * scale, h * 0.06 * scale);
      }
    }
  } else {
    // Pristine lobby: a thin lit grid on a glass partition.
    ctx.strokeStyle = 'rgba(200,225,255,0.9)';
    ctx.lineWidth = 1;
    for (let k = 1; k < 6; k += 1) {
      ctx.beginPath(); ctx.moveTo(x + (w * k) / 6, y + h * 0.15); ctx.lineTo(x + (w * k) / 6, floorY); ctx.stroke();
    }
    for (let k = 1; k < 4; k += 1) {
      ctx.beginPath(); ctx.moveTo(x, y + h * (0.15 + k * 0.2)); ctx.lineTo(x + w, y + h * (0.15 + k * 0.2)); ctx.stroke();
    }
  }
}

function drawSideWall(ctx: Ctx, theme: Theme, rect: [number, number, number, number], r: () => number): void {
  const [x, y, w, h] = rect;
  const tone: readonly [number, number, number] = theme === 'grime' ? [100, 75, 50] : theme === 'mid' ? [125, 120, 112] : [50, 56, 66];
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, shade(tone, 0.55));
  g.addColorStop(1, shade(tone, 0.35));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  if (theme !== 'pristine' && r() < 0.6) {
    ctx.fillStyle = 'rgba(25,20,16,0.8)';
    ctx.fillRect(x + w * 0.4, y + h * 0.3, w * 0.35, h * 0.7);
  }
}

function drawFloor(ctx: Ctx, theme: Theme, rect: [number, number, number, number], r: () => number): void {
  const [x, y, w, h] = rect;
  ctx.fillStyle = theme === 'grime' ? 'rgb(38,28,20)' : theme === 'mid' ? 'rgb(44,38,34)' : 'rgb(22,26,32)';
  ctx.fillRect(x, y, w, h);
  if (theme === 'mid' && r() < 0.6) {
    ctx.fillStyle = shade([120 + r() * 80, 60 + r() * 60, 50 + r() * 60], 0.45);
    ctx.fillRect(x + w * 0.2, y + h * 0.25, w * 0.6, h * 0.5);
  }
  if (theme === 'grime') {
    for (let k = 0; k < 12; k += 1) {
      ctx.fillStyle = `rgba(10,8,6,${0.3 + r() * 0.4})`;
      ctx.fillRect(x + r() * w, y + r() * h, 3 + r() * 8, 2 + r() * 5);
    }
  }
  if (theme === 'pristine') {
    // Polished floor: a soft reflection of the ceiling lines.
    ctx.fillStyle = 'rgba(160,190,230,0.12)';
    ctx.fillRect(x + w * 0.1, y, w * 0.05, h);
    ctx.fillRect(x + w * 0.85, y, w * 0.05, h);
  }
}

function drawCeiling(ctx: Ctx, theme: Theme, rect: [number, number, number, number], r: () => number): void {
  const [x, y, w, h] = rect;
  ctx.fillStyle = theme === 'grime' ? 'rgb(50,38,28)' : theme === 'mid' ? 'rgb(70,66,62)' : 'rgb(28,32,40)';
  ctx.fillRect(x, y, w, h);
  if (theme === 'pristine') {
    // Thin light lines running back into the floor plate.
    ctx.fillStyle = 'rgba(235,245,255,1)';
    for (const k of [0.25, 0.75]) ctx.fillRect(x + w * k - 1, y, 3, h);
  } else if (theme === 'mid') {
    ctx.fillStyle = 'rgba(255,245,225,1)';
    ctx.fillRect(x + w * 0.35, y + h * 0.4, w * 0.3, h * 0.12);
  } else {
    ctx.strokeStyle = 'rgba(20,14,10,1)';
    for (let k = 0; k < 3; k += 1) {
      ctx.beginPath();
      ctx.moveTo(x + r() * w, y);
      ctx.lineTo(x + r() * w, y + h);
      ctx.stroke();
    }
  }
}

type Rect = [number, number, number, number];

/** R16: one of the eight extra archetypes, all five parts. */
function drawExtra(ctx: Ctx, kind: Extra, back: Rect, side: Rect, floor: Rect, ceiling: Rect, furniture: Rect, r: () => number): void {
  const wall: Record<Extra, readonly [number, number, number]> = {
    server: [34, 40, 52], noodle: [130, 96, 58], karaoke: [60, 30, 64], laundry: [120, 128, 120],
    gym: [90, 92, 98], grow: [40, 52, 40], gallery: [170, 170, 165], workshop: [96, 80, 62],
  };
  const tone = wall[kind];
  {
    const [x, y, w, h] = back;
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, shade(tone, 0.8));
    g.addColorStop(1, shade(tone, 0.45));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    if (kind === 'karaoke') {
      // A magenta neon strip and a big screen.
      ctx.fillStyle = 'rgba(255,90,220,1)';
      ctx.fillRect(x, y + h * 0.12, w, 3);
      ctx.fillStyle = 'rgba(120,200,255,1)';
      ctx.fillRect(x + w * 0.3, y + h * 0.25, w * 0.4, h * 0.25);
    } else if (kind === 'gym') {
      // Mirror wall: a pale band with the room's lights in it.
      ctx.fillStyle = 'rgba(150,165,185,0.6)';
      ctx.fillRect(x + w * 0.05, y + h * 0.15, w * 0.9, h * 0.6);
    } else if (kind === 'workshop') {
      // Pegboard of tools.
      ctx.fillStyle = 'rgba(70,58,44,1)';
      ctx.fillRect(x + w * 0.1, y + h * 0.15, w * 0.8, h * 0.4);
      for (let k = 0; k < 14; k += 1) {
        ctx.fillStyle = shade([40 + r() * 140, 40 + r() * 100, 40 + r() * 60], 0.7);
        ctx.fillRect(x + w * (0.12 + (k % 7) * 0.11), y + h * (0.18 + Math.floor(k / 7) * 0.18), 4, 10 + r() * 14);
      }
    } else if (kind === 'gallery') {
      // Two framed canvases.
      ctx.fillStyle = shade([200 + r() * 55, 80 + r() * 120, 60 + r() * 100], 0.8);
      ctx.fillRect(x + w * 0.12, y + h * 0.25, w * 0.3, h * 0.3);
      ctx.fillStyle = shade([60 + r() * 80, 120 + r() * 100, 180 + r() * 70], 0.8);
      ctx.fillRect(x + w * 0.58, y + h * 0.3, w * 0.24, h * 0.22);
    } else if (kind === 'noodle') {
      // Menu boards and a red lantern.
      for (let k = 0; k < 3; k += 1) {
        ctx.fillStyle = 'rgba(245,225,190,1)';
        ctx.fillRect(x + w * (0.1 + k * 0.28), y + h * 0.12, w * 0.22, h * 0.14);
      }
      glowDot(ctx, x + w * 0.85, y + h * 0.4, 14, 'rgba(255,90,60,1)');
    }
  }
  {
    const [x, y, w, h] = side;
    ctx.fillStyle = shade(tone, 0.4);
    ctx.fillRect(x, y, w, h);
  }
  {
    const [x, y, w, h] = floor;
    ctx.fillStyle = kind === 'gallery' ? 'rgb(90,86,80)' : kind === 'gym' ? 'rgb(30,30,34)' : shade(tone, 0.3);
    ctx.fillRect(x, y, w, h);
  }
  {
    const [x, y, w, h] = ceiling;
    ctx.fillStyle = shade(tone, 0.5);
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = kind === 'grow' ? 'rgba(200,120,255,1)' : kind === 'server' ? 'rgba(170,210,255,1)' : 'rgba(255,240,215,1)';
    if (kind === 'gallery' || kind === 'server') for (const k of [0.3, 0.7]) ctx.fillRect(x + w * k - 1, y, 3, h);
    else ctx.fillRect(x + w * 0.3, y + h * 0.4, w * 0.4, h * 0.1);
  }
  {
    const [x, y, w, h] = furniture;
    const floorY = y + h;
    const ink = 'rgba(12,12,14,1)';
    const block = (bx: number, by: number, bw: number, bh: number): void => {
      ctx.fillStyle = ink;
      ctx.fillRect(bx, by, bw, bh);
    };
    if (kind === 'server') {
      // Rack rows with status LEDs.
      for (let k = 0; k < 4; k += 1) {
        const rx = x + w * (0.06 + k * 0.24);
        block(rx, floorY - h * 0.7, w * 0.18, h * 0.7);
        for (let l = 0; l < 10; l += 1) {
          ctx.fillStyle = r() < 0.7 ? 'rgba(90,255,140,1)' : 'rgba(80,160,255,1)';
          ctx.fillRect(rx + 3 + r() * (w * 0.18 - 6), floorY - h * (0.1 + l * 0.06), 2, 2);
        }
      }
    } else if (kind === 'noodle') {
      // Counter, stools and steam.
      block(x, floorY - h * 0.3, w, h * 0.3);
      for (let k = 0; k < 4; k += 1) block(x + w * (0.1 + k * 0.22), floorY - h * 0.18, w * 0.06, h * 0.18);
      ctx.fillStyle = 'rgba(255,230,200,0.35)';
      ctx.fillRect(x + w * 0.4, floorY - h * 0.6, w * 0.08, h * 0.28);
    } else if (kind === 'karaoke') {
      // Booth and two singers.
      block(x + w * 0.05, floorY - h * 0.25, w * 0.9, h * 0.25);
      for (const px of [0.35, 0.6]) {
        block(x + w * px, floorY - h * 0.55, w * 0.07, h * 0.3);
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.arc(x + w * (px + 0.035), floorY - h * 0.6, w * 0.035, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (kind === 'laundry') {
      // A row of machines with round lit doors.
      for (let k = 0; k < 4; k += 1) {
        const mx = x + w * (0.04 + k * 0.24);
        block(mx, floorY - h * 0.36, w * 0.2, h * 0.36);
        ctx.fillStyle = 'rgba(150,200,230,1)';
        ctx.beginPath();
        ctx.arc(mx + w * 0.1, floorY - h * 0.2, w * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (kind === 'gym') {
      // Treadmills.
      for (let k = 0; k < 3; k += 1) {
        const tx = x + w * (0.05 + k * 0.32);
        block(tx, floorY - h * 0.08, w * 0.24, h * 0.08);
        block(tx + w * 0.2, floorY - h * 0.4, 4, h * 0.32);
        ctx.fillStyle = 'rgba(255,120,60,1)';
        ctx.fillRect(tx + w * 0.18, floorY - h * 0.42, 8, 4);
      }
    } else if (kind === 'grow') {
      // Shelves of plants under purple grow light.
      for (let k = 0; k < 3; k += 1) {
        const sy = floorY - h * (0.15 + k * 0.22);
        block(x + w * 0.05, sy, w * 0.9, 3);
        for (let p = 0; p < 9; p += 1) {
          ctx.fillStyle = shade([40 + r() * 40, 140 + r() * 90, 50 + r() * 40], 0.8);
          ctx.fillRect(x + w * (0.07 + p * 0.1), sy - 8 - r() * 8, 7, 8 + r() * 8);
        }
      }
    } else if (kind === 'gallery') {
      // A plinth with a sculpture, one visitor.
      block(x + w * 0.42, floorY - h * 0.2, w * 0.14, h * 0.2);
      block(x + w * 0.45, floorY - h * 0.36, w * 0.08, h * 0.16);
      block(x + w * 0.75, floorY - h * 0.45, w * 0.06, h * 0.45);
    } else {
      // Workbench, vice, a welding flare.
      block(x + w * 0.1, floorY - h * 0.32, w * 0.7, h * 0.05);
      block(x + w * 0.12, floorY - h * 0.32, 4, h * 0.32);
      block(x + w * 0.76, floorY - h * 0.32, 4, h * 0.32);
      glowDot(ctx, x + w * 0.5, floorY - h * 0.36, 10, 'rgba(180,220,255,1)');
    }
  }
}

export interface InteriorAtlas {
  readonly texture: THREE.Texture;
  dispose(): void;
}

/** Draws the atlas. Needs a DOM canvas, so it runs in the browser only (the city constructor). */
export function createInteriorAtlas(seed: number): InteriorAtlas {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('SKYRIVER_INTERIOR_ATLAS_NO_2D_CONTEXT');
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  for (let room = 0; room < INTERIOR_ROOMS; room += 1) {
    const r = rng((seed ^ 0x51a7) + room * 7919);
    if (room >= INTERIOR_EXTRA_ROOMS[0]) {
      drawExtra(ctx, EXTRAS[room - INTERIOR_EXTRA_ROOMS[0]]!, part(room, 0, 0.5, 0.5, 1), part(room, 0, 0, 0.25, 0.5),
        part(room, 0.25, 0, 0.625, 0.25), part(room, 0.25, 0.25, 0.625, 0.5), part(room, 0.5, 0.5, 1, 1), r);
      continue;
    }
    const theme: Theme = room < INTERIOR_MID_ROOMS[0] ? 'grime' : room < INTERIOR_PRISTINE_ROOMS[0] ? 'mid' : 'pristine';
    // Opaque parts first (alpha 1); the furniture cell keeps a transparent background.
    drawBackWall(ctx, theme, part(room, 0, 0.5, 0.5, 1), r);
    drawSideWall(ctx, theme, part(room, 0, 0, 0.25, 0.5), r);
    drawFloor(ctx, theme, part(room, 0.25, 0, 0.625, 0.25), r);
    drawCeiling(ctx, theme, part(room, 0.25, 0.25, 0.625, 0.5), r);
    drawFurniture(ctx, theme, part(room, 0.5, 0.5, 1, 1), r);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'skyriver.interiorAtlas';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.premultiplyAlpha = false;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return {
    texture,
    dispose(): void {
      texture.dispose();
    },
  };
}
