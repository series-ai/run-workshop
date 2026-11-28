/**
 * Faction-authentic RTS Building State Synthesizer.
 *
 * Generates a uniform-cell 7-state sprite set for every faction building so any RTS engine
 * can render full construction, operational, animated active/firing, damaged, and destroyed
 * lifecycles on a shared (anchorX, anchorY) footprint with zero pixel jitter:
 *
 *   [0] build_1  — Early construction (~33%): steel scaffolding / bio-bud / cyan warp-grid
 *   [1] build_2  — Mid construction   (~70%): half-hull + weld sparks / erupting shell / coalescing warp
 *   [2] idle     — Operational (100% HP): hand-authored hero sprite
 *   [3] active_0 — Working / Producing / Firing (animation frame A)
 *   [4] active_1 — Working / Producing / Firing (animation frame B)
 *   [5] damaged  — Battle-damaged (<50% HP): scorched cracks + fire/smoke | ichor | plasma arcs
 *   [6] rubble   — Destroyed (0% HP): collapsed faction-authentic wreckage on same footprint
 *
 * All pixel mutations happen on the un-outlined core grid using the faction's true palette
 * BEFORE applying single-pass #130f1e exterior outlining, guaranteeing crisp pixel-art craft.
 */

import { INK_OUTLINE, type FactionId } from './palette.ts';
import {
  addPixelOutline,
  blitScaled,
  compilePattern,
  createSurface,
  setPixel,
  type PixelSurface,
  type RGBA32,
} from './pixel.ts';

function getPixel(s: PixelSurface, x: number, y: number): RGBA32 {
  if (x < 0 || y < 0 || x >= s.width || y >= s.height) return 0;
  return s.pixels[y * s.width + x] ?? 0;
}

export const BUILDING_STATES = [
  'build_1',
  'build_2',
  'idle',
  'active_0',
  'active_1',
  'damaged',
  'rubble',
] as const;

export type BuildingStateId = (typeof BUILDING_STATES)[number];

export interface BuildingStateSet {
  readonly states: Readonly<Record<BuildingStateId, PixelSurface>>;
  readonly strip: PixelSurface;
  readonly cellW: number;
  readonly cellH: number;
  readonly anchorX: number;
  readonly anchorY: number;
}

function hash2d(x: number, y: number, seed: number): number {
  let n = Math.imul(x + 37, 374761393) + Math.imul(y + 17, 668265263) + Math.imul(seed + 11, 2147483647);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function isOpaque(s: PixelSurface, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= s.width || y >= s.height) return false;
  return (getPixel(s, x, y) >>> 24) > 0;
}

function findBounds(s: PixelSurface): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = s.width;
  let maxX = -1;
  let minY = s.height;
  let maxY = -1;
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      if (isOpaque(s, x, y)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) return { minX: 0, maxX: s.width - 1, minY: 0, maxY: s.height - 1 };
  return { minX, maxX, minY, maxY };
}

function cloneSurface(src: PixelSurface): PixelSurface {
  const out = createSurface(src.width, src.height, 0);
  out.pixels.set(src.pixels);
  return out;
}

function padRawCore(raw: PixelSurface, padLeft: number, padRight: number, padTop: number, padBottom: number): PixelSurface {
  const out = createSurface(raw.width + padLeft + padRight, raw.height + padTop + padBottom, 0);
  blitScaled(out, raw, padLeft, padTop, 1);
  return out;
}

function makeSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function buildEarlyConstruction(
  core: PixelSurface,
  faction: FactionId,
  pal: Readonly<Record<string, RGBA32>>,
  seed: number,
): PixelSurface {
  const out = createSurface(core.width, core.height, 0);
  const { minX, maxX, minY, maxY } = findBounds(core);
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const cx = Math.floor((minX + maxX) / 2);

  if (faction === 'vanguard') {
    // Grounded steel foundation slab (bottom 4 rows) + crisp A-frame gantry scaffolding + amber corner beacons
    const slabTop = maxY - Math.max(3, Math.floor(bh * 0.22));
    const scafTop = maxY - Math.max(7, Math.floor(bh * 0.56));
    for (let y = slabTop; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (!isOpaque(core, x, y)) continue;
        const isEdge = y === slabTop || x === minX || x === maxX;
        setPixel(out, x, y, y === slabTop ? pal.s : isEdge ? pal.d : (x + y) % 4 === 0 ? pal.s : pal.d);
      }
    }
    // Corner posts + inner girder posts
    const leftPost = minX + 2;
    const rightPost = maxX - 2;
    const midPost = cx;
    for (let y = scafTop; y <= slabTop; y++) {
      setPixel(out, leftPost, y, y === scafTop ? pal.w : pal.s);
      setPixel(out, rightPost, y, y === scafTop ? pal.m : pal.d);
      if (bw >= 22) setPixel(out, midPost, y, pal.d);
    }
    // Horizontal cross-bar & diagonal truss
    const barY = Math.floor((scafTop + slabTop) / 2);
    for (let x = leftPost; x <= rightPost; x++) {
      if (x % 2 === 0) setPixel(out, x, barY, pal.s);
      setPixel(out, x, scafTop + 1, x < cx ? pal.m : pal.s);
    }
    // Diagonal steel brace
    const span = slabTop - scafTop;
    for (let i = 1; i < span; i++) {
      const dx = leftPost + Math.round((i / span) * (rightPost - leftPost));
      setPixel(out, dx, scafTop + i, pal.d);
    }
    // Cobalt anchor pads + amber construction beacons
    setPixel(out, leftPost - 1, slabTop, pal.B);
    setPixel(out, rightPost + 1, slabTop, pal.B);
    setPixel(out, leftPost, scafTop, pal.v);
    setPixel(out, rightPost, scafTop, pal.f);
    return out;
  }

  if (faction === 'kraxen') {
    // Low grounded natural chitin mound (h/t/n/R/r) + tiny team brood-mark + warm bio-core + 2 bone buds
    const moundTop = maxY - Math.max(6, Math.floor(bh * 0.45));
    const rx = Math.max(4, Math.floor(bw * 0.44));
    const ry = Math.max(3, maxY - moundTop);
    for (let y = moundTop; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const nx = (x - cx) / rx;
        const ny = (y - maxY) / ry;
        const d2 = nx * nx + ny * ny;
        if (d2 > 1.05) continue;
        if (y >= maxY - 2) {
          setPixel(out, x, y, (x + y) % 3 === 0 ? pal.n : pal.t);
        } else if (d2 < 0.16) {
          setPixel(out, x, y, d2 < 0.06 ? pal.o : pal.e);
        } else if (d2 < 0.34 && y < maxY - 2) {
          setPixel(out, x, y, x < cx ? pal.m : pal.u);
        } else if (d2 < 0.68) {
          setPixel(out, x, y, x < cx && y < maxY - 3 ? pal.h : pal.t);
        } else {
          setPixel(out, x, y, (x + y) % 2 === 0 ? pal.R : pal.n);
        }
      }
    }
    // Two tiny budding ivory bone ribs erupting from the mound
    setPixel(out, cx - Math.max(2, Math.floor(rx * 0.45)), moundTop, pal.o);
    setPixel(out, cx - Math.max(2, Math.floor(rx * 0.45)), moundTop + 1, pal.c);
    setPixel(out, cx + Math.max(2, Math.floor(rx * 0.45)), moundTop + 1, pal.o);
    setPixel(out, cx + Math.max(2, Math.floor(rx * 0.45)), moundTop + 2, pal.c);
    return out;
  }

  // Solaris: Grounded golden base ring + crisp cyan holographic scanline warp-projection (up to 64% height)
  const baseCut = maxY - Math.max(2, Math.floor(bh * 0.18));
  const holoTop = maxY - Math.max(8, Math.floor(bh * 0.64));
  for (let y = holoTop; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!isOpaque(core, x, y)) continue;
      if (y >= baseCut) {
        setPixel(out, x, y, y === baseCut ? pal.y : (x + y) % 3 === 0 ? pal.b : pal.g);
      } else {
        const isBorder =
          !isOpaque(core, x - 1, y) ||
          !isOpaque(core, x + 1, y) ||
          !isOpaque(core, x, y - 1) ||
          y === holoTop;
        if (isBorder) {
          setPixel(out, x, y, y === holoTop ? pal.C : pal.c);
        } else if (y % 2 === 0 && (x + Math.floor(y / 2)) % 2 === 0) {
          setPixel(out, x, y, hash2d(x, y, seed) > 0.72 ? pal.C : pal.v);
        }
      }
    }
  }
  return out;
}

function buildMidConstruction(
  core: PixelSurface,
  faction: FactionId,
  pal: Readonly<Record<string, RGBA32>>,
  seed: number,
): PixelSurface {
  const out = createSurface(core.width, core.height, 0);
  const { minX, maxX, minY, maxY } = findBounds(core);
  const bh = maxY - minY + 1;
  const cx = Math.floor((minX + maxX) / 2);
  const cutY = maxY - Math.floor(bh * 0.65);

  if (faction === 'vanguard') {
    // Bottom 65% real hull + upper steel framing ribs + 2 crisp amber-white weld sparks
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (!isOpaque(core, x, y)) continue;
        if (y >= cutY) {
          setPixel(out, x, y, getPixel(core, x, y));
        } else {
          const isEdge =
            !isOpaque(core, x - 1, y) || !isOpaque(core, x + 1, y) || !isOpaque(core, x, y - 1);
          if (isEdge || x === cx || y === cutY - 1) {
            setPixel(out, x, y, y === cutY - 1 ? pal.m : (x + y) % 2 === 0 ? pal.s : pal.d);
          }
        }
      }
    }
    // Crisp weld-spark flashes along the construction seam
    const w1x = Math.max(minX + 3, cx - 4);
    const w2x = Math.min(maxX - 3, cx + 4);
    setPixel(out, w1x, cutY, pal.F);
    setPixel(out, w1x - 1, cutY - 1, pal.v);
    setPixel(out, w1x + 1, cutY, pal.f);
    setPixel(out, w2x, cutY - 1, pal.F);
    setPixel(out, w2x + 1, cutY - 2, pal.v);
    return out;
  }

  if (faction === 'kraxen') {
    // Bottom 68% real hive + natural chitin growth rim (h/t) + warm bio-core & bone buds
    const kCut = maxY - Math.floor(bh * 0.68);
    for (let y = kCut - 2; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (!isOpaque(core, x, y)) continue;
        if (y > kCut) {
          setPixel(out, x, y, getPixel(core, x, y));
        } else if (y === kCut) {
          const distC = Math.abs(x - cx);
          setPixel(out, x, y, distC <= 2 ? pal.e : x < cx ? pal.h : pal.t);
        } else if (Math.abs(x - cx) <= 1) {
          setPixel(out, x, y, pal.o);
        } else if (getPixel(core, x, y) === pal.o || getPixel(core, x, y) === pal.c) {
          setPixel(out, x, y, pal.o);
        }
      }
    }
    return out;
  }

  // Solaris: Bottom 65% materialized solid gold, bright cyan-white materialization scan beam,
  // upper 35% shimmering holographic cyan warp-lattice (v/c/C, team-color independent!)
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!isOpaque(core, x, y)) continue;
      if (y > cutY) {
        setPixel(out, x, y, getPixel(core, x, y));
      } else if (y === cutY) {
        setPixel(out, x, y, (x + seed) % 3 === 0 ? pal.w : pal.C);
      } else {
        const isEdge =
          !isOpaque(core, x - 1, y) || !isOpaque(core, x + 1, y) || !isOpaque(core, x, y - 1);
        if (isEdge) {
          setPixel(out, x, y, pal.c);
        } else if ((x + y) % 2 === 0) {
          setPixel(out, x, y, y > cutY - 3 ? pal.C : pal.v);
        }
      }
    }
  }
  return out;
}

function buildActiveFrame(
  core: PixelSurface,
  id: string,
  faction: FactionId,
  pal: Readonly<Record<string, RGBA32>>,
  frameIdx: 0 | 1,
): PixelSurface {
  const out = cloneSurface(core);
  const { minX, maxX, minY, maxY } = findBounds(core);
  const cx = Math.floor((minX + maxX) / 2);

  if (faction === 'vanguard') {
    // Special case: Aegis Gun-Bunker alternating twin-autocannon muzzle flashes!
    if (id === 'vanguard-turret') {
      // Find rightmost barrel tip pixels on upper/lower barrel rows
      const upperY = minY + 2;
      const lowerY = minY + 4;
      const fireY = frameIdx === 0 ? upperY : lowerY;
      let tipX = maxX;
      for (let x = core.width - 1; x >= 0; x--) {
        if (isOpaque(core, x, fireY)) {
          tipX = x;
          break;
        }
      }
      // Crisp 3px muzzle flare off the active barrel tip!
      setPixel(out, tipX, fireY, pal.F);
      setPixel(out, tipX + 1, fireY, pal.F);
      setPixel(out, tipX + 2, fireY, pal.v);
      setPixel(out, tipX + 1, fireY - 1, pal.f);
      setPixel(out, tipX + 1, fireY + 1, pal.f);
      // Recoil glint on the amber status lamp
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          if (getPixel(core, x, y) === pal.f) setPixel(out, x, y, frameIdx === 0 ? pal.v : pal.F);
        }
      }
      return out;
    }

    // Pulse beacons, visors, weld arcs, and bay interiors across all Vanguard structures
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = getPixel(core, x, y);
        if (px === pal.v) {
          setPixel(out, x, y, frameIdx === 0 ? pal.F : pal.f);
        } else if (px === pal.f) {
          setPixel(out, x, y, frameIdx === 0 ? pal.v : pal.F);
        } else if (px === pal.c) {
          setPixel(out, x, y, frameIdx === 0 ? pal.w : pal.b);
        } else if (px === pal.k && frameIdx === 1 && y >= minY + 6 && y <= maxY - 4) {
          // Subtle warm operational glow inside dark bays/pits
          if ((x + y) % 5 === 0) setPixel(out, x, y, pal.f);
        }
      }
    }
    // Subtle crisp exhaust / steam vent puff rising cleanly above top vent
    const puffX = Math.max(minX + 4, cx - 5);
    const puffY = Math.max(1, minY - (frameIdx === 0 ? 1 : 2));
    setPixel(out, puffX, puffY, frameIdx === 0 ? pal.w : pal.m);
    setPixel(out, puffX + 1, puffY, pal.s);
    if (frameIdx === 1) setPixel(out, puffX + 1, puffY - 1, pal.m);
    return out;
  }

  if (faction === 'kraxen') {
    // Pulse bioluminescent venom glands (l -> g -> G) and warm amber-ochre bio-cores (e -> o)
    const isAcidBuilding = id === 'kraxen-lab' || id === 'kraxen-colony';
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = getPixel(core, x, y);
        if (px === pal.l) {
          setPixel(out, x, y, frameIdx === 0 ? pal.g : pal.G);
        } else if (px === pal.g) {
          setPixel(out, x, y, pal.G);
        } else if (px === pal.e) {
          setPixel(out, x, y, frameIdx === 0 ? pal.o : pal.G);
        } else if (px === pal.a && frameIdx === 1) {
          setPixel(out, x, y, pal.e);
        }
      }
    }
    if (frameIdx === 1) {
      if (id === 'kraxen-colony') {
        setPixel(out, cx, Math.max(0, minY - 1), pal.G);
        setPixel(out, cx - 1, minY, pal.g);
        setPixel(out, cx + 1, minY, pal.g);
      } else {
        const moteA = isAcidBuilding ? pal.G : pal.o;
        const moteB = isAcidBuilding ? pal.g : pal.e;
        setPixel(out, cx - 2, Math.max(0, minY - 1), moteA);
        setPixel(out, cx + 3, Math.max(0, minY - 2), moteB);
      }
    } else {
      setPixel(out, cx + 2, Math.max(0, minY - 1), isAcidBuilding ? pal.g : pal.e);
    }
    return out;
  }

  // Solaris: Surge ONLY cyan solar energy (v/c/C -> C/w) while keeping team banners (D/t/T) untouched!
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = getPixel(core, x, y);
      if (px === pal.v) {
        setPixel(out, x, y, frameIdx === 0 ? pal.c : pal.C);
      } else if (px === pal.c) {
        setPixel(out, x, y, pal.C);
      } else if (px === pal.C && frameIdx === 1) {
        if (Math.abs(x - cx) <= 1) setPixel(out, x, y, pal.w);
      }
    }
  }
  // Helios Obelisk defense turret fires a crisp white-cyan star flare off its focal prism
  if (id === 'solaris-turret') {
    const fx = frameIdx === 0 ? cx + 3 : cx + 4;
    const fy = minY + 4;
    setPixel(out, fx, fy, pal.w);
    setPixel(out, fx + 1, fy, pal.C);
    setPixel(out, fx, fy - 1, pal.c);
    setPixel(out, fx, fy + 1, pal.c);
  } else {
    // Floating harmonic sun-sparks above apex
    const sy = Math.max(0, minY - (frameIdx === 0 ? 1 : 2));
    setPixel(out, cx + (frameIdx === 0 ? -3 : 3), sy, pal.C);
    if (frameIdx === 1) setPixel(out, cx - 4, Math.max(0, minY - 1), pal.c);
  }
  return out;
}

function buildDamaged(
  core: PixelSurface,
  faction: FactionId,
  pal: Readonly<Record<string, RGBA32>>,
  seed: number,
): PixelSurface {
  const out = cloneSurface(core);
  const { minX, maxX, minY, maxY } = findBounds(core);
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const cx = Math.floor((minX + maxX) / 2);

  // Two deterministic breach centers in the upper-mid hull (never destroying outer base!)
  const b1x = cx - Math.max(2, Math.floor(bw * 0.18));
  const b1y = minY + Math.max(3, Math.floor(bh * 0.34));
  const b2x = cx + Math.max(2, Math.floor(bw * 0.16));
  const b2y = minY + Math.max(4, Math.floor(bh * 0.56));

  // Subtle surface scorching & armor chips
  for (let y = minY; y <= maxY - 2; y++) {
    for (let x = minX + 1; x <= maxX - 1; x++) {
      if (!isOpaque(core, x, y)) continue;
      const d1 = Math.abs(x - b1x) + Math.abs(y - b1y);
      const d2 = Math.abs(x - b2x) + Math.abs(y - b2y);
      const nearBreach = d1 <= 2 || d2 <= 2;
      const px = getPixel(core, x, y);

      if (nearBreach && hash2d(x, y, seed + 3) < 0.72) {
        if (faction === 'vanguard') {
          setPixel(out, x, y, d1 <= 1 || d2 <= 1 ? pal.k : pal.q);
        } else if (faction === 'kraxen') {
          setPixel(out, x, y, d1 <= 1 || d2 <= 1 ? pal.x : pal.r);
        } else {
          setPixel(out, x, y, d1 <= 1 || d2 <= 1 ? pal.D : pal.b);
        }
      } else if (hash2d(x, y, seed + 9) < 0.14) {
        // Light battle-wear dimming
        if (faction === 'vanguard' && (px === pal.w || px === pal.m)) setPixel(out, x, y, pal.s);
        if (faction === 'kraxen' && px === pal.p) setPixel(out, x, y, pal.u);
        if (faction === 'solaris' && (px === pal.y || px === pal.w)) setPixel(out, x, y, pal.b);
      }
    }
  }

  // Carve a tiny 1-2px upper silhouette chip for dramatic battle wear
  for (let y = minY; y <= minY + 1; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (isOpaque(out, x, y) && Math.abs(x - b1x) <= 1 && hash2d(x, y, seed + 17) < 0.65) {
        setPixel(out, x, y, 0);
      }
    }
  }

  // Faction-authentic damage tells (fire+smoke / ichor-ooze / unstable cyan arcs)
  if (faction === 'vanguard') {
    // Fire ember 1 + dark smoke plume rising above it
    setPixel(out, b1x, b1y, pal.F);
    setPixel(out, b1x + 1, b1y, pal.v);
    setPixel(out, b1x, b1y - 1, pal.f);
    setPixel(out, b1x - 1, b1y - 2, pal.q);
    setPixel(out, b1x, b1y - 3, pal.d);
    setPixel(out, b1x + 1, Math.max(0, b1y - 4), pal.e);
    // Secondary fire spark at breach 2
    setPixel(out, b2x, b2y, pal.v);
    setPixel(out, b2x, b2y - 1, pal.f);
    setPixel(out, b2x + 1, b2y - 2, pal.q);
  } else if (faction === 'kraxen') {
    // Oozing acid-lime & ochre bio-ichor spilling downward from ruptured carapace
    setPixel(out, b1x, b1y, pal.g);
    setPixel(out, b1x, b1y + 1, pal.l);
    setPixel(out, b1x + 1, b1y + 2, pal.e);
    setPixel(out, b2x, b2y, pal.G);
    setPixel(out, b2x, b2y + 1, pal.g);
    setPixel(out, b2x - 1, b2y + 2, pal.l);
  } else {
    // Crackling unstable white-cyan plasma arcs jumping out of cracked bronze casing
    setPixel(out, b1x, b1y, pal.w);
    setPixel(out, b1x - 1, b1y - 1, pal.C);
    setPixel(out, b1x + 1, b1y - 2, pal.c);
    setPixel(out, b2x, b2y, pal.C);
    setPixel(out, b2x + 1, b2y - 1, pal.w);
    setPixel(out, b2x + 2, b2y - 2, pal.c);
  }

  return out;
}

function buildRubble(
  core: PixelSurface,
  faction: FactionId,
  pal: Readonly<Record<string, RGBA32>>,
  seed: number,
): PixelSurface {
  const out = createSurface(core.width, core.height, 0);
  const { minX, maxX, minY, maxY } = findBounds(core);
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const cx = Math.floor((minX + maxX) / 2);
  const rubbleH = Math.max(5, Math.min(9, Math.floor(bh * 0.36)));
  const topY = maxY - rubbleH + 1;

  for (let y = topY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const nx = (x - cx) / Math.max(4, bw * 0.48);
      const ny = (y - maxY) / rubbleH;
      // Jagged irregular rubble silhouette tapering naturally at left/right edges
      const jitter = (hash2d(x, 0, seed + 5) - 0.5) * 0.42;
      const dist = nx * nx + ny * ny;
      if (dist > 0.92 + jitter) continue;
      const h = hash2d(x, y, seed + 23);

      if (faction === 'vanguard') {
        if (y === maxY) {
          setPixel(out, x, y, h > 0.5 ? pal.d : pal.q);
        } else if (h < 0.25) {
          setPixel(out, x, y, pal.q);
        } else if (h < 0.62) {
          setPixel(out, x, y, pal.d);
        } else if (h < 0.85) {
          setPixel(out, x, y, pal.s);
        } else {
          setPixel(out, x, y, pal.D);
        }
      } else if (faction === 'kraxen') {
        if (y === maxY) {
          setPixel(out, x, y, h > 0.5 ? pal.n : pal.t);
        } else if (h < 0.32) {
          setPixel(out, x, y, pal.r);
        } else if (h < 0.68) {
          setPixel(out, x, y, pal.n);
        } else if (h < 0.86) {
          setPixel(out, x, y, pal.u);
        } else {
          setPixel(out, x, y, pal.t);
        }
      } else {
        if (y === maxY) {
          setPixel(out, x, y, h > 0.5 ? pal.b : pal.g);
        } else if (h < 0.42) {
          setPixel(out, x, y, pal.b);
        } else if (h < 0.78) {
          setPixel(out, x, y, pal.g);
        } else if (h < 0.9) {
          setPixel(out, x, y, pal.y);
        } else {
          setPixel(out, x, y, pal.D);
        }
      }
    }
  }

  // Signature readable wreckage details on top of rubble pile
  if (faction === 'vanguard') {
    // Broken diagonal steel girder + cobalt plate + 2 smoldering embers
    setPixel(out, cx - 3, topY + 1, pal.m);
    setPixel(out, cx - 2, topY + 2, pal.s);
    setPixel(out, cx + 2, topY + 2, pal.B);
    setPixel(out, cx + 3, topY + 3, pal.D);
    setPixel(out, cx - 1, topY + 2, pal.f);
    setPixel(out, cx, topY + 2, pal.v);
    setPixel(out, cx + 3, maxY - 2, pal.f);
  } else if (faction === 'kraxen') {
    // Snapped ivory bone-rib splinters + small fading acid-lime ichor pool
    setPixel(out, cx - 4, topY + 1, pal.o);
    setPixel(out, cx - 3, topY + 2, pal.c);
    setPixel(out, cx + 3, topY + 1, pal.o);
    setPixel(out, cx + 2, topY + 2, pal.c);
    setPixel(out, cx, topY + 3, pal.g);
    setPixel(out, cx + 1, topY + 3, pal.l);
  } else {
    // Shattered golden arch slab + dying cyan solar shard
    setPixel(out, cx - 3, topY + 1, pal.y);
    setPixel(out, cx - 2, topY + 1, pal.g);
    setPixel(out, cx + 2, topY + 2, pal.T);
    setPixel(out, cx + 3, topY + 2, pal.t);
    setPixel(out, cx, topY + 1, pal.C);
    setPixel(out, cx, topY + 2, pal.c);
  }

  return out;
}

export function synthesizeBuildingStates(
  id: string,
  faction: FactionId,
  rows: readonly string[],
  palette: Readonly<Record<string, RGBA32>>,
  anchorOffsetX = 0,
): BuildingStateSet {
  const raw = compilePattern(rows, palette);
  // Generous un-outlined headroom: +3px top (exhaust/spores/smoke), +3px right (bunker muzzle flash), +1px left
  const padLeft = 1;
  const padRight = 3;
  const padTop = 3;
  const padBottom = 0;
  const paddedCore = padRawCore(raw, padLeft, padRight, padTop, padBottom);
  const seed = makeSeed(id);

  const rawByState: Record<BuildingStateId, PixelSurface> = {
    build_1: buildEarlyConstruction(paddedCore, faction, palette, seed),
    build_2: buildMidConstruction(paddedCore, faction, palette, seed),
    idle: paddedCore,
    active_0: buildActiveFrame(paddedCore, id, faction, palette, 0),
    active_1: buildActiveFrame(paddedCore, id, faction, palette, 1),
    damaged: buildDamaged(paddedCore, faction, palette, seed),
    rubble: buildRubble(paddedCore, faction, palette, seed),
  };

  // Single-pass #130f1e outline on every state (uniform cellW x cellH for all 7 states!)
  const outlinedByState = {} as Record<BuildingStateId, PixelSurface>;
  for (const st of BUILDING_STATES) {
    outlinedByState[st] = addPixelOutline(rawByState[st], INK_OUTLINE);
  }

  const idleSurf = outlinedByState.idle;
  const cellW = idleSurf.width;
  const cellH = idleSurf.height;

  // Shared ground-hugging anchor derived strictly from the idle footprint
  let bottomY = cellH - 1;
  for (let y = cellH - 1; y >= 0; y--) {
    let hasOpaque = false;
    for (let x = 0; x < cellW; x++) {
      if ((getPixel(idleSurf, x, y) >>> 24) > 0) {
        hasOpaque = true;
        break;
      }
    }
    if (hasOpaque) {
      bottomY = y;
      break;
    }
  }

  // Center X of the hero building inside the padded cell
  const anchorX = padLeft + 1 + Math.floor(raw.width / 2) + anchorOffsetX;
  const anchorY = Math.max(0, bottomY - 2);

  // Compose 7-column horizontal state strip
  const strip = createSurface(cellW * BUILDING_STATES.length, cellH, 0);
  for (let i = 0; i < BUILDING_STATES.length; i++) {
    blitScaled(strip, outlinedByState[BUILDING_STATES[i]], i * cellW, 0, 1);
  }

  return {
    states: outlinedByState,
    strip,
    cellW,
    cellH,
    anchorX,
    anchorY,
  };
}
