/**
 * Constraint-based Wave Function Collapse (WFC) + Dual-Grid Wang-16 Auto-Tiling
 * level generator and canvas baker for RUN Micro-RTS.
 *
 * Pipeline:
 *   1. Macro-WFC collapses a 15x8 tactical sector grid (each sector = 4x4 tiles)
 *      using 4-neighbor adjacency constraints (plateaus, ramps, rivers, bridges,
 *      roads, groves, creep) with seeded strategic anchors and backtracking.
 *   2. Vertex Expansion maps sectors onto a 61x33 dual-grid vertex field (60x32
 *      tiles = 480x256 px), applies organic edge wobble (strictly flat at ramp
 *      mouths and bridge abutments), and smooths single-vertex spikes.
 *   3. 2-Layer Wang-16 Auto-Tiler resolves Layer-0 ground transitions (rows 2, 3,
 *      4, 5, 7) + Layer-1 alpha cliffs (row 6) + aligned 4-way ramps and bridges.
 *   4. Biome Prop Placer populates mineral patches, gas/magma vents, central
 *      neutral objectives, destructible chokes, wreckage, and biome flora.
 */

import type { BiomeEntry, EnvObjectEntry } from './catalog'

export const TILE_PX = 8
export const MAP_TILES_W = 60
export const MAP_TILES_H = 32
export const WORLD_W = MAP_TILES_W * TILE_PX // 480
export const WORLD_H = MAP_TILES_H * TILE_PX // 256

export type EnvTileKind = 'primary' | 'secondary' | 'hazard' | 'accent' | 'cliff'
export type MapPresetId = 'wfc-frontier' | 'high-citadel' | 'twin-bridges' | 'shattered-basins'

export const MAP_PRESETS: ReadonlyArray<{ readonly id: MapPresetId; readonly label: string }> = [
  { id: 'wfc-frontier', label: 'WFC Frontier' },
  { id: 'high-citadel', label: 'High Citadel' },
  { id: 'twin-bridges', label: 'Twin Bridges' },
  { id: 'shattered-basins', label: 'Shattered Basins' },
]

export type WfcSectorKind =
  | 'GRASS'
  | 'ROAD'
  | 'PLATEAU'
  | 'WATER'
  | 'CREEP'
  | 'BRIDGE_H'
  | 'RAMP_S'
  | 'RAMP_W'

export interface RampPlacement {
  readonly dir: 'S' | 'N' | 'E' | 'W'
  readonly tx: number
  readonly ty: number
}

export interface BridgePlacement {
  readonly orientation: 'h' | 'v'
  readonly tx: number
  readonly ty: number
}

export interface PropPlacement {
  readonly id: string
  readonly sheet: string
  readonly cellW: number
  readonly cellH: number
  readonly frames: number
  readonly x: number
  readonly y: number
  readonly phaseOffset: number
}

export interface BaseAnchor {
  readonly faction: 'vanguard' | 'kraxen' | 'solaris'
  readonly x: number
  readonly y: number
}

export interface GeneratedBattleMap {
  readonly seed: number
  readonly preset: MapPresetId
  readonly theme: BiomeEntry['theme']
  readonly usedFallback: boolean
  readonly sectorW: number
  readonly sectorH: number
  readonly sectors: readonly WfcSectorKind[]
  readonly gridW: number // MAP_TILES_W + 1 = 61
  readonly gridH: number // MAP_TILES_H + 1 = 33
  readonly vertices: readonly EnvTileKind[] // length gridW * gridH
  readonly ramps: readonly RampPlacement[]
  readonly bridges: readonly BridgePlacement[]
  readonly hazardTiles: ReadonlyArray<{ readonly tx: number; readonly ty: number; readonly variant: number }>
  readonly walkable: readonly boolean[] // length MAP_TILES_W * MAP_TILES_H
  readonly props: readonly PropPlacement[]
  readonly bases: readonly BaseAnchor[]
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hash2i(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0
  h = ((h ^ (h >>> 13)) * 1274126177) | 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

const ALL_SECTORS: readonly WfcSectorKind[] = [
  'GRASS',
  'ROAD',
  'PLATEAU',
  'WATER',
  'CREEP',
  'BRIDGE_H',
  'RAMP_S',
  'RAMP_W',
]

type CardinalDir = 'N' | 'S' | 'E' | 'W'
const OPPOSITE: Record<CardinalDir, CardinalDir> = { N: 'S', S: 'N', E: 'W', W: 'E' }

/**
 * Strictly symmetric adjacency rule table for Macro-WFC.
 * Guarantees coherent RTS terrain grammar:
 * - Rivers flow vertically or form basins cleanly; BRIDGE_H links WATER/GRASS/ROAD N/S and ROAD/GRASS/CREEP E/W.
 * - PLATEAU connects down to ROAD/GRASS via RAMP_S (PLATEAU to N, ROAD/GRASS to S) or RAMP_W (PLATEAU to E, ROAD/GRASS to W).
 * - PLATEAU never drops sheer into WATER without a walkable bank.
 */
const ALLOWED_NEIGHBORS: Record<WfcSectorKind, Record<CardinalDir, readonly WfcSectorKind[]>> = {
  GRASS: {
    N: ['GRASS', 'ROAD', 'PLATEAU', 'WATER', 'CREEP', 'RAMP_S', 'RAMP_W'],
    S: ['GRASS', 'ROAD', 'PLATEAU', 'WATER', 'CREEP', 'RAMP_W'],
    E: ['GRASS', 'ROAD', 'PLATEAU', 'WATER', 'CREEP', 'BRIDGE_H', 'RAMP_W', 'RAMP_S'],
    W: ['GRASS', 'ROAD', 'PLATEAU', 'WATER', 'CREEP', 'BRIDGE_H', 'RAMP_S'],
  },
  ROAD: {
    N: ['GRASS', 'ROAD', 'PLATEAU', 'WATER', 'CREEP', 'RAMP_S', 'RAMP_W'],
    S: ['GRASS', 'ROAD', 'PLATEAU', 'WATER', 'CREEP', 'RAMP_W'],
    E: ['GRASS', 'ROAD', 'PLATEAU', 'WATER', 'CREEP', 'BRIDGE_H', 'RAMP_W', 'RAMP_S'],
    W: ['GRASS', 'ROAD', 'PLATEAU', 'WATER', 'CREEP', 'BRIDGE_H', 'RAMP_S'],
  },
  PLATEAU: {
    N: ['PLATEAU', 'GRASS', 'ROAD', 'CREEP', 'RAMP_W'],
    S: ['PLATEAU', 'GRASS', 'ROAD', 'CREEP', 'RAMP_S', 'RAMP_W'],
    E: ['PLATEAU', 'GRASS', 'ROAD', 'CREEP', 'RAMP_S'],
    W: ['PLATEAU', 'GRASS', 'ROAD', 'CREEP', 'RAMP_W', 'RAMP_S'],
  },
  WATER: {
    N: ['WATER', 'GRASS', 'ROAD', 'CREEP', 'BRIDGE_H'],
    S: ['WATER', 'GRASS', 'ROAD', 'CREEP', 'BRIDGE_H'],
    E: ['WATER', 'GRASS', 'ROAD', 'CREEP'],
    W: ['WATER', 'GRASS', 'ROAD', 'CREEP'],
  },
  CREEP: {
    N: ['CREEP', 'GRASS', 'ROAD', 'PLATEAU', 'WATER', 'RAMP_S', 'RAMP_W'],
    S: ['CREEP', 'GRASS', 'ROAD', 'PLATEAU', 'WATER', 'RAMP_W'],
    E: ['CREEP', 'GRASS', 'ROAD', 'PLATEAU', 'WATER', 'BRIDGE_H', 'RAMP_S'],
    W: ['CREEP', 'GRASS', 'ROAD', 'PLATEAU', 'WATER', 'BRIDGE_H', 'RAMP_S'],
  },
  BRIDGE_H: {
    N: ['WATER'],
    S: ['WATER'],
    E: ['ROAD', 'GRASS', 'CREEP'],
    W: ['ROAD', 'GRASS', 'CREEP'],
  },
  RAMP_S: {
    N: ['PLATEAU'],
    S: ['ROAD', 'GRASS', 'CREEP'],
    E: ['GRASS', 'ROAD', 'PLATEAU', 'CREEP'],
    W: ['GRASS', 'ROAD', 'PLATEAU', 'CREEP'],
  },
  RAMP_W: {
    N: ['GRASS', 'ROAD', 'PLATEAU', 'CREEP'],
    S: ['GRASS', 'ROAD', 'PLATEAU', 'CREEP'],
    E: ['PLATEAU'],
    W: ['ROAD', 'GRASS'],
  },
}

const PRESET_WEIGHTS: Record<MapPresetId, Record<WfcSectorKind, number>> = {
  'wfc-frontier': {
    GRASS: 34,
    ROAD: 22,
    PLATEAU: 14,
    WATER: 11,
    CREEP: 12,
    BRIDGE_H: 2,
    RAMP_S: 2,
    RAMP_W: 2,
  },
  'high-citadel': {
    GRASS: 26,
    ROAD: 22,
    PLATEAU: 28,
    WATER: 6,
    CREEP: 10,
    BRIDGE_H: 1,
    RAMP_S: 4,
    RAMP_W: 3,
  },
  'twin-bridges': {
    GRASS: 30,
    ROAD: 24,
    PLATEAU: 12,
    WATER: 18,
    CREEP: 10,
    BRIDGE_H: 3,
    RAMP_S: 2,
    RAMP_W: 1,
  },
  'shattered-basins': {
    GRASS: 24,
    ROAD: 18,
    PLATEAU: 18,
    WATER: 20,
    CREEP: 15,
    BRIDGE_H: 2,
    RAMP_S: 2,
    RAMP_W: 2,
  },
}

function solveMacroWfc(
  sectorW: number,
  sectorH: number,
  preset: MapPresetId,
  seed: number,
): { sectors: WfcSectorKind[]; usedFallback: boolean } {
  const weights = PRESET_WEIGHTS[preset]

  for (let attempt = 0; attempt < 24; attempt++) {
    const rng = mulberry32(seed * 7919 + attempt * 104729 + 17)
    const domains: Set<WfcSectorKind>[] = Array.from({ length: sectorW * sectorH }, () => new Set(ALL_SECTORS))
    const idx = (x: number, y: number) => y * sectorW + x

    const force = (x: number, y: number, allowed: readonly WfcSectorKind[]): boolean => {
      if (x < 0 || x >= sectorW || y < 0 || y >= sectorH) return true
      const dom = domains[idx(x, y)]!
      let changed = false
      for (const k of [...dom]) {
        if (!allowed.includes(k)) {
          dom.delete(k)
          changed = true
        }
      }
      if (dom.size === 0) return false
      return changed ? propagate([[x, y]]) : true
    }

    const propagate = (queue: Array<[number, number]>): boolean => {
      const dirs: Array<[number, number, CardinalDir]> = [
        [0, -1, 'N'],
        [0, 1, 'S'],
        [1, 0, 'E'],
        [-1, 0, 'W'],
      ]
      while (queue.length > 0) {
        const [cx, cy] = queue.pop()!
        const srcDom = domains[idx(cx, cy)]!
        for (const [dx, dy, dir] of dirs) {
          const nx = cx + dx
          const ny = cy + dy
          if (nx < 0 || nx >= sectorW || ny < 0 || ny >= sectorH) continue
          const dstDom = domains[idx(nx, ny)]!
          const opp = OPPOSITE[dir]
          let removed = false
          for (const candidate of [...dstDom]) {
            let supported = false
            for (const src of srcDom) {
              if (
                ALLOWED_NEIGHBORS[src][dir].includes(candidate) &&
                ALLOWED_NEIGHBORS[candidate][opp].includes(src)
              ) {
                supported = true
                break
              }
            }
            if (!supported) {
              dstDom.delete(candidate)
              removed = true
            }
          }
          if (dstDom.size === 0) return false
          if (removed) queue.push([nx, ny])
        }
      }
      return true
    }

    // Strategic anchors (Vanguard West, Solaris NE, Kraxen SE + Preset signatures)
    let ok = true
    // Vanguard home pad (West center)
    ok = ok && force(1, 3, ['ROAD']) && force(1, 4, ['ROAD']) && force(2, 3, ['ROAD', 'GRASS']) && force(2, 4, ['ROAD', 'GRASS'])
    // Solaris home pad (NE)
    ok = ok && force(13, 1, ['PLATEAU']) && force(12, 1, ['PLATEAU']) && force(12, 2, ['RAMP_S'])
    // Kraxen creep nest (SE)
    ok = ok && force(13, 5, ['CREEP']) && force(12, 5, ['CREEP']) && force(13, 6, ['CREEP']) && force(12, 6, ['CREEP'])

    if (preset === 'twin-bridges') {
      const rx = 7
      ok =
        ok &&
        force(rx, 0, ['WATER']) &&
        force(rx, 1, ['WATER']) &&
        force(rx, 2, ['BRIDGE_H']) &&
        force(rx, 3, ['WATER']) &&
        force(rx, 4, ['WATER']) &&
        force(rx, 5, ['BRIDGE_H']) &&
        force(rx, 6, ['WATER']) &&
        force(rx, 7, ['WATER']) &&
        force(4, 1, ['PLATEAU']) &&
        force(4, 2, ['RAMP_S'])
    } else if (preset === 'high-citadel') {
      ok =
        ok &&
        force(5, 0, ['PLATEAU']) &&
        force(6, 0, ['PLATEAU']) &&
        force(7, 0, ['PLATEAU']) &&
        force(8, 0, ['PLATEAU']) &&
        force(6, 1, ['PLATEAU']) &&
        force(7, 1, ['PLATEAU']) &&
        force(6, 2, ['RAMP_S']) &&
        force(9, 1, ['PLATEAU']) &&
        force(9, 2, ['RAMP_S']) &&
        force(7, 6, ['WATER']) &&
        force(8, 6, ['WATER'])
    } else if (preset === 'shattered-basins') {
      ok =
        ok &&
        force(5, 1, ['WATER']) &&
        force(5, 2, ['WATER']) &&
        force(9, 5, ['WATER']) &&
        force(9, 6, ['WATER']) &&
        force(7, 3, ['ROAD']) &&
        force(7, 4, ['ROAD']) &&
        force(4, 5, ['PLATEAU']) &&
        force(3, 5, ['RAMP_W'])
    } else {
      // wfc-frontier: winding central crossing + NW plateau
      const rx = 6 + (seed % 3)
      const b1 = 2 + (seed % 2)
      const b2 = 5
      ok =
        ok &&
        force(rx, b1 - 1, ['WATER']) &&
        force(rx, b1, ['BRIDGE_H']) &&
        force(rx, b1 + 1, ['WATER']) &&
        force(rx, b2 - 1, ['WATER']) &&
        force(rx, b2, ['BRIDGE_H']) &&
        force(rx, b2 + 1, ['WATER']) &&
        force(3, 0, ['PLATEAU']) &&
        force(4, 0, ['PLATEAU']) &&
        force(4, 1, ['RAMP_S'])
    }

    if (!ok) continue

    // Main minimum-entropy collapse loop
    let contradiction = false
    while (true) {
      let bestIdx = -1
      let bestEntropy = Infinity
      for (let i = 0; i < domains.length; i++) {
        const size = domains[i]!.size
        if (size <= 1) continue
        const noise = rng() * 0.01
        if (size + noise < bestEntropy) {
          bestEntropy = size + noise
          bestIdx = i
        }
      }
      if (bestIdx === -1) break

      const dom = [...domains[bestIdx]!]
      let totalW = 0
      for (const k of dom) totalW += weights[k]
      let pick = rng() * totalW
      let chosen = dom[0]!
      for (const k of dom) {
        pick -= weights[k]
        if (pick <= 0) {
          chosen = k
          break
        }
      }

      const cx = bestIdx % sectorW
      const cy = Math.floor(bestIdx / sectorW)
      if (!force(cx, cy, [chosen])) {
        contradiction = true
        break
      }
    }

    if (!contradiction) {
      return { sectors: domains.map((d) => [...d][0] ?? 'GRASS'), usedFallback: false }
    }
  }

  // Deterministic safe fallback (guaranteed valid)
  return {
    usedFallback: true,
    sectors: Array.from({ length: sectorW * sectorH }, (_, i) => {
      const x = i % sectorW
      const y = Math.floor(i / sectorW)
      if (y <= 1 && x >= 5 && x <= 13) return 'PLATEAU'
      if (y === 2 && (x === 6 || x === 12)) return 'RAMP_S'
      if (x === 7 && (y === 4 || y === 6)) return 'WATER'
      if (x === 7 && y === 5) return 'BRIDGE_H'
      if (x >= 11 && y >= 4) return 'CREEP'
      if (y === 3 || y === 4) return 'ROAD'
      return 'GRASS'
    }),
  }
}

export function generateWfcBattleMap(
  theme: BiomeEntry['theme'],
  preset: MapPresetId,
  seed: number,
  envObjects: readonly EnvObjectEntry[],
): GeneratedBattleMap {
  const sectorW = 15
  const sectorH = 8
  const { sectors, usedFallback } = solveMacroWfc(sectorW, sectorH, preset, seed)

  const gridW = MAP_TILES_W + 1 // 61
  const gridH = MAP_TILES_H + 1 // 33
  const vertices: EnvTileKind[] = new Array(gridW * gridH).fill('primary')

  const ramps: RampPlacement[] = []
  const bridges: BridgePlacement[] = []
  const lockedZones: Array<{ x0: number; y0: number; x1: number; y1: number }> = []

  const sectorAt = (sx: number, sy: number): WfcSectorKind =>
    sectors[Math.max(0, Math.min(sectorH - 1, sy)) * sectorW + Math.max(0, Math.min(sectorW - 1, sx))]!

  // Track ramp & bridge exact tile alignments first so we flatten cliff/river edges cleanly
  for (let sy = 0; sy < sectorH; sy++) {
    for (let sx = 0; sx < sectorW; sx++) {
      const k = sectorAt(sx, sy)
      if (k === 'RAMP_S') {
        // Cliff rim sits along vertex row gy = sy * 4 -> ramp spans tx = sx*4 .. sx*4+2, ty = sy*4 .. sy*4+1
        const tx = sx * 4
        const ty = sy * 4
        ramps.push({ dir: 'S', tx, ty })
        lockedZones.push({ x0: tx - 1, y0: ty - 2, x1: tx + 4, y1: ty + 3 })
      } else if (k === 'RAMP_W') {
        // Cliff rim sits along vertex col gx = (sx + 1) * 4 -> West-facing ramp steps down to the left
        const tx = (sx + 1) * 4 - 1
        const ty = sy * 4
        ramps.push({ dir: 'W', tx, ty })
        lockedZones.push({ x0: tx - 2, y0: ty - 1, x1: tx + 3, y1: ty + 4 })
      } else if (k === 'BRIDGE_H') {
        // Horizontal bridge (4 tiles wide: left abutment + 2x center span + right abutment)
        const tx = sx * 4
        const ty = sy * 4 + 1
        bridges.push({ orientation: 'h', tx, ty })
        lockedZones.push({ x0: tx - 1, y0: ty - 1, x1: tx + 5, y1: ty + 3 })
      }
    }
  }

  const isLocked = (gx: number, gy: number) =>
    lockedZones.some((z) => gx >= z.x0 && gx <= z.x1 && gy >= z.y0 && gy <= z.y1)

  // Map Macro-WFC sectors -> 61x33 dual-grid vertex kinds with organic edge jitter outside locked ramp/bridge mouths
  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      let sampleX = gx
      let sampleY = gy
      if (!isLocked(gx, gy)) {
        const jx = (hash2i(gx >> 1, gy >> 1, seed + 101) - 0.5) * 1.9
        const jy = (hash2i(gx >> 1, gy >> 1, seed + 211) - 0.5) * 1.9
        sampleX = Math.max(0, Math.min(MAP_TILES_W - 0.01, gx + jx))
        sampleY = Math.max(0, Math.min(MAP_TILES_H - 0.01, gy + jy))
      }
      const sx = Math.min(sectorW - 1, Math.floor(sampleX / 4))
      const sy = Math.min(sectorH - 1, Math.floor(sampleY / 4))
      const sec = sectorAt(sx, sy)
      let kind: EnvTileKind = 'primary'
      if (sec === 'PLATEAU') kind = 'cliff'
      else if (sec === 'WATER') kind = 'hazard'
      else if (sec === 'CREEP') kind = 'accent'
      else if (sec === 'ROAD') kind = 'secondary'
      else if (sec === 'BRIDGE_H') {
        // Keep a crisp 2-tile-wide water stream underneath the bridge span (middle columns of sector)
        const lx = gx - sx * 4
        kind = lx >= 1 && lx <= 3 ? 'hazard' : 'secondary'
      } else if (sec === 'RAMP_S') {
        // Exact flat cliff rim at gy === sy * 4
        kind = gy <= sy * 4 ? 'cliff' : 'secondary'
      } else if (sec === 'RAMP_W') {
        // Exact flat cliff rim at gx === (sx + 1) * 4
        kind = gx >= (sx + 1) * 4 ? 'cliff' : 'secondary'
      }
      vertices[gy * gridW + gx] = kind
    }
  }

  // Enforce clean flat rims around every ramp mouth so Wang-16 cliff wall never overlaps ramp stairs
  for (const r of ramps) {
    if (r.dir === 'S') {
      for (let gx = r.tx; gx <= r.tx + 3; gx++) {
        if (gx < 0 || gx >= gridW) continue
        if (r.ty - 1 >= 0) vertices[(r.ty - 1) * gridW + gx] = 'cliff'
        if (r.ty >= 0 && r.ty < gridH) vertices[r.ty * gridW + gx] = 'cliff'
        if (r.ty + 1 < gridH) vertices[(r.ty + 1) * gridW + gx] = 'secondary'
        if (r.ty + 2 < gridH) vertices[(r.ty + 2) * gridW + gx] = 'secondary'
      }
    } else if (r.dir === 'W') {
      for (let gy = r.ty; gy <= r.ty + 3; gy++) {
        if (gy < 0 || gy >= gridH) continue
        if (r.tx + 1 < gridW) vertices[gy * gridW + (r.tx + 1)] = 'cliff'
        if (r.tx + 2 < gridW) vertices[gy * gridW + (r.tx + 2)] = 'cliff'
        if (r.tx >= 0) vertices[gy * gridW + r.tx] = 'secondary'
        if (r.tx - 1 >= 0) vertices[gy * gridW + (r.tx - 1)] = 'secondary'
      }
    }
  }

  // 1-pass morphological smoothing (eliminates ugly isolated 1-vertex pinches outside locked zones)
  const smoothed = [...vertices]
  for (let gy = 1; gy < gridH - 1; gy++) {
    for (let gx = 1; gx < gridW - 1; gx++) {
      if (isLocked(gx, gy)) continue
      const cur = vertices[gy * gridW + gx]!
      const n = vertices[(gy - 1) * gridW + gx]!
      const s = vertices[(gy + 1) * gridW + gx]!
      const w = vertices[gy * gridW + (gx - 1)]!
      const e = vertices[gy * gridW + (gx + 1)]!
      const sameCount = [n, s, w, e].filter((k) => k === cur).length
      if (sameCount <= 1) {
        // Adopt majority cardinal neighbor
        const counts = new Map<EnvTileKind, number>()
        for (const k of [n, s, w, e]) counts.set(k, (counts.get(k) ?? 0) + 1)
        let best = cur
        let bestC = 0
        for (const [k, c] of counts) {
          if (c > bestC) {
            bestC = c
            best = k
          }
        }
        smoothed[gy * gridW + gx] = best
      }
    }
  }
  for (let i = 0; i < vertices.length; i++) vertices[i] = smoothed[i]!

  // Compute animated interior hazard tiles + ground walkability mask
  const hazardTiles: Array<{ tx: number; ty: number; variant: number }> = []
  const walkable: boolean[] = new Array(MAP_TILES_W * MAP_TILES_H).fill(true)
  const vAt = (gx: number, gy: number) => vertices[gy * gridW + gx]!

  const inBridge = (tx: number, ty: number) =>
    bridges.some((b) =>
      b.orientation === 'h'
        ? tx >= b.tx && tx < b.tx + 4 && ty >= b.ty && ty < b.ty + 2
        : tx >= b.tx && tx < b.tx + 2 && ty >= b.ty && ty < b.ty + 4,
    )

  const inRamp = (tx: number, ty: number) =>
    ramps.some((r) =>
      r.dir === 'S' || r.dir === 'N'
        ? tx >= r.tx && tx < r.tx + 3 && ty >= r.ty && ty < r.ty + 2
        : tx >= r.tx && tx < r.tx + 2 && ty >= r.ty && ty < r.ty + 3,
    )

  for (let ty = 0; ty < MAP_TILES_H; ty++) {
    for (let tx = 0; tx < MAP_TILES_W; tx++) {
      const c = [vAt(tx, ty), vAt(tx + 1, ty), vAt(tx, ty + 1), vAt(tx + 1, ty + 1)]
      const hCount = c.filter((k) => k === 'hazard').length
      const cliffCount = c.filter((k) => k === 'cliff').length
      if (hCount === 4 && !inBridge(tx, ty)) {
        const vr = hash2i(tx, ty, 811)
        const variant = vr > 0.88 ? 3 : vr > 0.62 ? 2 : vr > 0.34 ? 1 : 0
        hazardTiles.push({ tx, ty, variant })
      }
      const isWaterTile = hCount >= 2 && !inBridge(tx, ty)
      const isCliffWall = cliffCount > 0 && cliffCount < 4 && !inRamp(tx, ty)
      walkable[ty * MAP_TILES_W + tx] = !isWaterTile && !isCliffWall
    }
  }

  // Exact base anchors matching the pre-collapsed WFC home sectors
  const bases: BaseAnchor[] = [
    { faction: 'vanguard', x: 56, y: 144 },
    { faction: 'solaris', x: 420, y: 52 },
    { faction: 'kraxen', x: 422, y: 204 },
  ]

  // Place biome-authentic props, mineral lines, objectives, and destructible chokes
  const objById = new Map(envObjects.map((o) => [o.id, o]))
  const props: PropPlacement[] = []
  const rng = mulberry32(seed * 31337 + 99)

  const canPlaceProp = (px: number, py: number, minDistFromBases = 34): boolean => {
    const tx = Math.floor(px / TILE_PX)
    const ty = Math.floor(py / TILE_PX)
    if (tx < 2 || tx >= MAP_TILES_W - 2 || ty < 2 || ty >= MAP_TILES_H - 2) return false
    if (!walkable[ty * MAP_TILES_W + tx]) return false
    if (inBridge(tx, ty) || inRamp(tx, ty)) return false
    for (const b of bases) {
      if (Math.hypot(px - b.x, py - b.y) < minDistFromBases) return false
    }
    for (const p of props) {
      if (Math.hypot(px - p.x, py - p.y) < 18) return false
    }
    return true
  }

  const addProp = (id: string, px: number, py: number) => {
    const o = objById.get(id)
    if (!o) return
    props.push({
      id: o.id,
      sheet: o.sheet,
      cellW: o.cellW,
      cellH: o.cellH,
      frames: o.frames,
      x: Math.round(px),
      y: Math.round(py),
      phaseOffset: Math.floor(rng() * 10),
    })
  }

  // 1. Mineral lines & gas vents around the 3 faction bases
  const minCoords: Array<[string, number, number]> = [
    ['mineral-blue', 22, 118],
    ['mineral-blue', 20, 136],
    [theme === 'volcanic' ? 'magma-vent' : 'gas-geyser', 28, 166],
    ['mineral-blue', 454, 34],
    ['mineral-blue', 456, 52],
    ['mineral-blue', 454, 186],
    ['mineral-blue', 456, 206],
    [theme === 'volcanic' ? 'magma-vent' : 'gas-geyser', 446, 228],
  ]
  for (const [id, x, y] of minCoords) {
    if (canPlaceProp(x, y, 22)) addProp(id, x, y)
  }

  // 2. Contested Rich Gold & Neutral Objective near battlefield center
  const centerCandidates: Array<[string, number, number]> = [
    ['neutral-watchtower', 240, 128],
    ['neutral-shrine', 216, 124],
    ['mineral-gold', 196, 44],
    ['mineral-gold', 292, 212],
    ['neutral-medpad', 184, 198],
  ]
  for (const [id, x, y] of centerCandidates) {
    // Search nearby walkable tile if exact spot is river/cliff
    for (let rad = 0; rad <= 40; rad += 8) {
      let placed = false
      for (let ang = 0; ang < 8; ang++) {
        const cx = x + Math.cos((ang * Math.PI) / 4) * rad
        const cy = y + Math.sin((ang * Math.PI) / 4) * rad
        if (canPlaceProp(cx, cy, 42)) {
          addProp(id, cx, cy)
          placed = true
          break
        }
      }
      if (placed) break
    }
  }

  // 3. Biome-specific flora, ruins, and wreckage clusters along valley/plateau margins
  const biomeFlora: Record<BiomeEntry['theme'], readonly string[]> = {
    temperate: ['tree-pine', 'tree-oak', 'brush-reeds', 'rock-mossy', 'fallen-log'],
    tundra: ['tree-frost-pine', 'ice-spire', 'rock-frozen'],
    volcanic: ['tree-charred', 'obsidian-spire', 'basalt-arch', 'ash-crater'],
    desert: ['tree-palm', 'ruin-obelisk', 'ruin-arch', 'desert-cactus', 'fossil-leviathan'],
  }
  const floraPool = biomeFlora[theme]
  const chokeId =
    theme === 'temperate'
      ? 'obstacle-rocks'
      : theme === 'desert'
        ? 'obstacle-pillar'
        : theme === 'volcanic'
          ? 'obstacle-ribwall'
          : 'obstacle-barricade'

  // Try placing 1-2 destructible choke obstacles near midfield flank
  for (let i = 0; i < 16 && props.filter((p) => p.id === chokeId).length < 2; i++) {
    const px = 140 + rng() * 200
    const py = 36 + rng() * 184
    const tx = Math.floor(px / TILE_PX)
    const ty = Math.floor(py / TILE_PX)
    if (vAt(tx, ty) === 'secondary' && canPlaceProp(px, py, 56)) {
      addProp(chokeId, px, py)
    }
  }

  // Place 18-24 atmospheric flora & wreckage pieces away from main battle road
  for (let i = 0; i < 110 && props.length < 34; i++) {
    const px = 24 + rng() * (WORLD_W - 48)
    const py = 20 + rng() * (WORLD_H - 40)
    const tx = Math.floor(px / TILE_PX)
    const ty = Math.floor(py / TILE_PX)
    const vk = vAt(tx, ty)
    if (vk === 'secondary') continue // Keep roads clean for smooth tank combat
    if (!canPlaceProp(px, py, 38)) continue
    const useWreck = rng() < 0.14
    const pick = useWreck
      ? (['wreck-tank', 'wreck-droppod', 'prop-crates'] as const)[Math.floor(rng() * 3)]!
      : floraPool[Math.floor(rng() * floraPool.length)]!
    addProp(pick, px, py)
  }

  return {
    seed,
    preset,
    theme,
    usedFallback,
    sectorW,
    sectorH,
    sectors,
    gridW,
    gridH,
    vertices,
    ramps,
    bridges,
    hazardTiles,
    walkable,
    props,
    bases,
  }
}

/**
 * Bakes Layer-0 (Wang-16 ground transitions), Layer-1 (Alpha cliffs & plateau interior),
 * and Layer-2 (aligned 4-way ramps & steel truss bridges) onto a crisp offscreen canvas.
 */
export function bakeTerrainToCanvas(
  map: GeneratedBattleMap,
  atlas: HTMLImageElement,
  ramps: Partial<Record<'N' | 'S' | 'E' | 'W', HTMLImageElement>>,
  bridgeH: HTMLImageElement | null,
  bridgeV: HTMLImageElement | null,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = WORLD_W
  canvas.height = WORLD_H
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false

  const at = (gx: number, gy: number): EnvTileKind => map.vertices[gy * map.gridW + gx]!
  const drawAtlas = (col: number, row: number, tx: number, ty: number) => {
    ctx.drawImage(atlas, col * TILE_PX, row * TILE_PX, TILE_PX, TILE_PX, tx * TILE_PX, ty * TILE_PX, TILE_PX, TILE_PX)
  }

  for (let ty = 0; ty < MAP_TILES_H; ty++) {
    for (let tx = 0; tx < MAP_TILES_W; tx++) {
      const raw: readonly EnvTileKind[] = [at(tx, ty), at(tx + 1, ty), at(tx, ty + 1), at(tx + 1, ty + 1)]
      const nonCliff = raw.filter((k) => k !== 'cliff')
      const fallback: EnvTileKind = nonCliff[0] ?? 'primary'
      const nw = raw[0] === 'cliff' ? fallback : raw[0]!
      const ne = raw[1] === 'cliff' ? fallback : raw[1]!
      const sw = raw[2] === 'cliff' ? fallback : raw[2]!
      const se = raw[3] === 'cliff' ? fallback : raw[3]!

      const vr = hash2i(tx, ty, 313)
      const v = vr < 0.5 ? 0 : vr < 0.72 ? 1 : vr < 0.88 ? 2 : 3
      const maskOf = (k: EnvTileKind) =>
        (nw === k ? 1 : 0) | (ne === k ? 2 : 0) | (sw === k ? 4 : 0) | (se === k ? 8 : 0)

      // Pass 1 — Layer 0: Edge-exact Wang-16 Ground Transitions
      const hMask = maskOf('hazard')
      if (hMask === 15) {
        drawAtlas(v, 1, tx, ty)
      } else if (hMask > 0) {
        const secCnt = [nw, ne, sw, se].filter((k) => k === 'secondary' || k === 'accent').length
        drawAtlas(hMask, secCnt > 1 ? 7 : 5, tx, ty)
      } else {
        const aMask = maskOf('accent')
        if (aMask === 15) {
          drawAtlas(8 + v, 0, tx, ty)
        } else if (aMask > 0) {
          const priCnt = [nw, ne, sw, se].filter((k) => k === 'primary').length
          drawAtlas(aMask, priCnt >= 2 ? 4 : 3, tx, ty)
        } else {
          const pMask = maskOf('primary')
          if (pMask === 15) {
            const fl = hash2i(tx, ty, 77)
            if (fl > 0.91) drawAtlas(14 + (v & 1), 1, tx, ty)
            else drawAtlas(4 + v, 0, tx, ty)
          } else if (pMask > 0) {
            drawAtlas(pMask, 2, tx, ty)
          } else {
            const cr = hash2i(tx, ty, 505)
            if (cr > 0.95) drawAtlas(11 + (v % 3), 1, tx, ty)
            else drawAtlas(v, 0, tx, ty)
          }
        }
      }

      // Pass 2 — Layer 1: Alpha-Transparent High-Ground Plateaus & Cliffs (Row 6)
      const cMask =
        (raw[0] === 'cliff' ? 1 : 0) |
        (raw[1] === 'cliff' ? 2 : 0) |
        (raw[2] === 'cliff' ? 4 : 0) |
        (raw[3] === 'cliff' ? 8 : 0)
      if (cMask === 15) {
        const acc = hash2i(tx, ty, 41)
        if (acc > 0.85) drawAtlas(4 + (v & 3), 1, tx, ty)
        else drawAtlas(12 + v, 0, tx, ty)
      } else if (cMask > 0) {
        drawAtlas(cMask, 6, tx, ty)
      }
    }
  }

  // Pass 3 — Aligned 4-Way Ramps & Steel Truss Bridges
  for (const r of map.ramps) {
    const img = ramps[r.dir]
    if (img) ctx.drawImage(img, r.tx * TILE_PX, r.ty * TILE_PX)
  }
  for (const b of map.bridges) {
    if (b.orientation === 'h' && bridgeH) {
      // Tile the 24x16 bridge into a flush 32x16 (4x2 tile) crossing: left abutment, 2x center span, right abutment
      ctx.drawImage(bridgeH, 0, 0, TILE_PX, 16, b.tx * TILE_PX, b.ty * TILE_PX, TILE_PX, 16)
      ctx.drawImage(bridgeH, TILE_PX, 0, TILE_PX, 16, (b.tx + 1) * TILE_PX, b.ty * TILE_PX, TILE_PX, 16)
      ctx.drawImage(bridgeH, TILE_PX, 0, TILE_PX, 16, (b.tx + 2) * TILE_PX, b.ty * TILE_PX, TILE_PX, 16)
      ctx.drawImage(bridgeH, TILE_PX * 2, 0, TILE_PX, 16, (b.tx + 3) * TILE_PX, b.ty * TILE_PX, TILE_PX, 16)
    } else if (b.orientation === 'v' && bridgeV) {
      ctx.drawImage(bridgeV, b.tx * TILE_PX, b.ty * TILE_PX)
    }
  }

  return canvas
}

export function isWalkableGround(map: GeneratedBattleMap, px: number, py: number): boolean {
  const tx = Math.floor(px / TILE_PX)
  const ty = Math.floor(py / TILE_PX)
  if (tx < 0 || tx >= MAP_TILES_W || ty < 0 || ty >= MAP_TILES_H) return false
  return map.walkable[ty * MAP_TILES_W + tx] ?? false
}
