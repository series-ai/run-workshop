// Group connected tall-grass tiles into "patches" and tag each one with a
// deterministic level range based on distance from the player spawn. The
// overworld renderer draws a wooden sign outside each patch showing its
// level range; the battle transition consults the same data to clamp a
// wild enemy's level when the player triggers an encounter from that patch.
//
// All math is keyed off the *map* — patches are computed once per map load
// and cached, so the renderer does zero flood-fill work per frame.

import { TILE_SIZE } from '../engine/types';
import { isTallGrassAt, type SFMap } from '../data/spriteFusionMap';
import { MAP_CATALOG } from '../data/maps';
import { getMapEnvironment, getEnvironment } from '../../data/environments';

export interface GrassPatch {
  /** Stable unique id across a single map instance. */
  id: number;
  /** Every tile cell that belongs to this connected grass region. */
  tiles: Array<{ tx: number; ty: number }>;
  /** Tile chosen to anchor the "Lv. N-M" sign — the topmost row's leftmost
   *  grass tile, so the sign always sits on actual grass even for L-shaped
   *  or otherwise non-rectangular patches. For rectangular patches this is
   *  the same as the bounding-box upper-left. */
  signTile: { tx: number; ty: number };
  /** Legacy bbox upper-left tile, retained ONLY so `grassPatchLevels`
   *  overrides authored before the smarter `signTile` was introduced
   *  (2026-05-13) still resolve. Box-shaped patches have this equal to
   *  `signTile`; the two can differ for non-rectangular patches whose
   *  bbox corner sits outside the grass. */
  legacyBboxTopLeft: { tx: number; ty: number };
  /** Inclusive level range rolled for this patch. */
  minLevel: number;
  maxLevel: number;
  /** 2026-06-05 (v1.730) — Per-patch environment override (e.g.
   *  `'martial'` on the dojo-side patches in villageruin). When
   *  set, the wild-encounter picker treats this patch as belonging
   *  to that env's themed pool instead of the map-level env tag —
   *  letting one map host multiple wild biomes (Dojo Wilds + the
   *  default villageruin general pool side-by-side). Populated
   *  from `MapDef.grassPatchEnvOverrides`. */
  environment?: string;
}

/** Default level range when a map's environment doesn't define one.
 *  v1.250 — Cut from 1-20 → 1-8 to soften wilds outside the village
 *  ruins (the only outdoor map currently falling through to this
 *  default). The old 1-20 split into 6 tiers meant patches just past
 *  the spawn already topped out at Lv 7+, which over-leveled fresh
 *  starter parties. New 1-8 split: 1-2, 2-3, 3-4, 4-5, 5-6, 6-8 across
 *  the six progressive tiers, so the deepest wilds peak at 8 instead
 *  of 20. Sign labels reflect this automatically since they read
 *  patch.minLevel/maxLevel. */
const DEFAULT_LEVEL_RANGE = { min: 1, max: 8 } as const;
/** Number of progressive tiers we subdivide a level range into. */
const TIER_COUNT = 6;

/**
 * Subdivide an env-defined level range into TIER_COUNT progressive
 * inclusive tiers. Closer-to-spawn patches get the lower tiers, distant
 * patches get the upper tiers. Each tier overlaps slightly with the
 * next so the curve feels smooth instead of stepwise.
 *
 * Example for {min: 1, max: 20}:
 *   tier 0: 1-4    (closest)
 *   tier 1: 4-7
 *   tier 2: 7-10
 *   tier 3: 10-13
 *   tier 4: 13-16
 *   tier 5: 16-20  (farthest)
 *
 * Example for {min: 20, max: 40} (cave):
 *   tier 0: 20-23
 *   tier 5: 36-40
 */
function tiersFor(levelRange: { min: number; max: number }): Array<{ min: number; max: number }> {
  const span = Math.max(1, levelRange.max - levelRange.min);
  const stepF = span / TIER_COUNT;
  const tiers: Array<{ min: number; max: number }> = [];
  for (let i = 0; i < TIER_COUNT; i++) {
    const lo = Math.round(levelRange.min + i * stepF);
    // Each tier reaches one step further so the upper edges line up
    // with the next tier's lower edge — no level falls in a gap.
    const hi = Math.round(levelRange.min + (i + 1) * stepF);
    tiers.push({ min: lo, max: Math.max(lo, hi) });
  }
  // Force the very first tier to start at min and the last to end at
  // max — rounding can otherwise drift the endpoints by ±1.
  tiers[0]!.min = levelRange.min;
  tiers[TIER_COUNT - 1]!.max = levelRange.max;
  return tiers;
}

/** Map cache keyed by `${SFMap-id}:${mapId}` so different maps don't share
 *  a cached patch list. The previous WeakMap<SFMap> shared cache across
 *  any caller that passed the same SFMap reference, which broke when
 *  the same SFMap could be looked up under different mapIds. */
const cache = new Map<string, GrassPatch[]>();
let cacheKeySeq = 0;
const mapKeys = new WeakMap<SFMap, number>();
function mapCacheKey(map: SFMap, mapId?: string): string {
  let k = mapKeys.get(map);
  if (!k) { k = ++cacheKeySeq; mapKeys.set(map, k); }
  return `${k}:${mapId ?? '_'}`;
}

/**
 * Return the patches for `map`. When `mapId` is provided and the map JSON has
 * `grassPatchLevels` overrides, the matching patches return with their
 * `{ minLevel, maxLevel }` replaced. Computation + flood-fill stays cached on
 * the SFMap; the override merge is a cheap allocation when present, and the
 * base list is returned untouched when no overrides exist.
 */
export function getGrassPatches(map: SFMap, mapId?: string): GrassPatch[] {
  const key = mapCacheKey(map, mapId);
  let base = cache.get(key);
  if (!base) {
    base = computeGrassPatches(map, mapId);
    cache.set(key, base);
  }
  if (!mapId) return base;
  const overrides = MAP_CATALOG[mapId]?.grassPatchLevels;
  const envOverrides = MAP_CATALOG[mapId]?.grassPatchEnvOverrides;
  const hasLevelOv = overrides && Object.keys(overrides).length > 0;
  const hasEnvOv = envOverrides && Object.keys(envOverrides).length > 0;
  if (!hasLevelOv && !hasEnvOv) return base;
  return base.map((p) => {
    const primaryKey = `${p.signTile.tx},${p.signTile.ty}`;
    // Legacy fallback: overrides authored before the 2026-05-13 signTile
    // fix were keyed by the bbox upper-left. For rectangular patches the
    // two keys are identical; for non-rectangular ones the legacy key
    // still resolves so existing JSON data keeps working.
    const legacyKey = `${p.legacyBboxTopLeft.tx},${p.legacyBboxTopLeft.ty}`;
    const lvlOv = overrides?.[primaryKey] ?? (legacyKey !== primaryKey ? overrides?.[legacyKey] : undefined);
    const envOv = envOverrides?.[primaryKey] ?? (legacyKey !== primaryKey ? envOverrides?.[legacyKey] : undefined);
    if (!lvlOv && !envOv) return p;
    const next: GrassPatch = { ...p };
    if (lvlOv) { next.minLevel = lvlOv.min; next.maxLevel = lvlOv.max; }
    if (envOv) next.environment = envOv;
    return next;
  });
}

function computeGrassPatches(map: SFMap, mapId?: string): GrassPatch[] {
  const visited = new Set<string>();
  const patches: GrassPatch[] = [];
  const { mapWidth, mapHeight } = map.data;

  for (let ty = 0; ty < mapHeight; ty++) {
    for (let tx = 0; tx < mapWidth; tx++) {
      const key = `${tx},${ty}`;
      if (visited.has(key)) continue;
      if (!isTallGrassAt(map, tx, ty)) continue;

      // BFS flood fill for this connected grass region.
      const tiles: Array<{ tx: number; ty: number }> = [];
      const queue: Array<{ tx: number; ty: number }> = [{ tx, ty }];
      visited.add(key);
      while (queue.length > 0) {
        const cell = queue.shift()!;
        tiles.push(cell);
        const neighbors = [
          { tx: cell.tx + 1, ty: cell.ty },
          { tx: cell.tx - 1, ty: cell.ty },
          { tx: cell.tx, ty: cell.ty + 1 },
          { tx: cell.tx, ty: cell.ty - 1 },
        ];
        for (const n of neighbors) {
          const nk = `${n.tx},${n.ty}`;
          if (visited.has(nk)) continue;
          if (!isTallGrassAt(map, n.tx, n.ty)) continue;
          visited.add(nk);
          queue.push(n);
        }
      }

      if (tiles.length === 0) continue;

      // Walk the tile list once: track bbox min for the legacy override key,
      // accumulate the center for the spawn-distance sort, and pick the
      // visual top-left grass tile (topmost row, leftmost within that row)
      // as the sign anchor. The lex-min approach equals the bbox corner for
      // rectangular patches and naturally migrates inward when the bbox
      // corner isn't grass — exactly what L-shaped, archipelago, or
      // diagonal patches need.
      let minTx = Infinity, minTy = Infinity;
      let cxSum = 0, cySum = 0;
      let signTx = tiles[0]!.tx, signTy = tiles[0]!.ty;
      for (const t of tiles) {
        if (t.tx < minTx) minTx = t.tx;
        if (t.ty < minTy) minTy = t.ty;
        cxSum += t.tx;
        cySum += t.ty;
        if (t.ty < signTy || (t.ty === signTy && t.tx < signTx)) {
          signTy = t.ty;
          signTx = t.tx;
        }
      }
      const centerTx = cxSum / tiles.length;
      const centerTy = cySum / tiles.length;

      patches.push({
        id: patches.length,
        tiles,
        signTile: { tx: signTx, ty: signTy },
        legacyBboxTopLeft: { tx: minTx, ty: minTy },
        minLevel: 0,
        maxLevel: 0,
        // _center stashed for the sort below; stripped later.
        ...({ _centerTx: centerTx, _centerTy: centerTy } as unknown as {}),
      } as GrassPatch & { _centerTx: number; _centerTy: number });
    }
  }

  // Distance from the map's level-tier origin — closer patches get easier
  // tier ranges. Prefers `levelOriginTile` (set per-map for natural
  // entry-driven progression, e.g. Forest 1's village-side portal at
  // 33,48) and falls back to `spawns.default` for maps that don't
  // override. The previous version always used the default spawn, but
  // that's typically in the geographic middle of the map, producing a
  // "cone of difficulty" that ramps DOWN as the player walks deeper —
  // backwards from what most level designers want.
  const mapDef = mapId ? MAP_CATALOG[mapId] : undefined;
  const origin = mapDef?.levelOriginTile
    ?? mapDef?.spawns?.['default']
    ?? { tileX: 0, tileY: 0 };
  const spawnTx = origin.tileX;
  const spawnTy = origin.tileY;
  patches.sort((a, b) => {
    const ax = (a as unknown as { _centerTx: number })._centerTx;
    const ay = (a as unknown as { _centerTy: number })._centerTy;
    const bx = (b as unknown as { _centerTx: number })._centerTx;
    const by = (b as unknown as { _centerTy: number })._centerTy;
    const da = Math.hypot(ax - spawnTx, ay - spawnTy);
    const db = Math.hypot(bx - spawnTx, by - spawnTy);
    return da - db;
  });

  // Pull the env's level range; subdivide into TIER_COUNT progressive
  // tiers so each map's progression honors its own difficulty band.
  // Forest1 → 1-20 (per-tier ~3-4 levels), cave1 → 20-40 (per-tier
  // ~3-4 levels), default 1-20 for any untagged map.
  const envId = mapId ? getMapEnvironment(mapId) : null;
  const env = envId ? getEnvironment(envId) : null;
  const TIER_RANGES = tiersFor(env?.levelRange ?? DEFAULT_LEVEL_RANGE);

  // Assign tier ranges. The first patch closest to spawn gets the
  // lowest tier; if there are more patches than tiers, the last tier
  // repeats so distant wilderness stays consistently tough.
  patches.forEach((p, i) => {
    const tier = TIER_RANGES[Math.min(i, TIER_RANGES.length - 1)]!;
    p.minLevel = tier.min;
    p.maxLevel = tier.max;
    // Rebuild id to match final sort order.
    p.id = i;
    // Strip transient fields.
    delete (p as unknown as { _centerTx?: number })._centerTx;
    delete (p as unknown as { _centerTy?: number })._centerTy;
  });

  return patches;
}

/** Find which patch (if any) contains the given world-pixel position. */
export function patchAtPixel(map: SFMap, px: number, py: number, mapId?: string): GrassPatch | null {
  const tx = Math.floor(px / TILE_SIZE);
  const ty = Math.floor(py / TILE_SIZE);
  for (const p of getGrassPatches(map, mapId)) {
    for (const t of p.tiles) {
      if (t.tx === tx && t.ty === ty) return p;
    }
  }
  return null;
}

/** Roll a wild encounter level inside the patch's range. */
export function rollPatchLevel(p: GrassPatch): number {
  const span = p.maxLevel - p.minLevel + 1;
  return p.minLevel + Math.floor(Math.random() * span);
}

/**
 * 2026-05-17 — Lookup the XP multiplier for a patch from the map's
 * `grassPatchXpMultipliers` override. Returns 1 (no-op) when no entry
 * exists for this patch. Matches the same primary/legacy key
 * resolution `getGrassPatches` uses so authors can key by either
 * `signTile` (post-2026-05-13) or the legacy bbox upper-left.
 *
 * Callsite: `WorldTab` battle-end XP calc reads this with the player's
 * current position resolved to a patch, so kills/captures from a
 * tagged patch pay out N× the normal amount.
 */
export function getPatchXpMultiplier(mapId: string | undefined, patch: GrassPatch | null): number {
  if (!mapId || !patch) return 1;
  const overrides = MAP_CATALOG[mapId]?.grassPatchXpMultipliers;
  if (!overrides) return 1;
  const primaryKey = `${patch.signTile.tx},${patch.signTile.ty}`;
  const legacyKey = `${patch.legacyBboxTopLeft.tx},${patch.legacyBboxTopLeft.ty}`;
  const mult = overrides[primaryKey] ?? (legacyKey !== primaryKey ? overrides[legacyKey] : undefined);
  return typeof mult === 'number' && mult > 0 ? mult : 1;
}
