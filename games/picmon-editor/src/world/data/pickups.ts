// Static pickups scattered on the world map. When the player's center tile
// matches one of these, the pickup is collected: rewards are granted and
// the pickup id is added to the player's "collected" set (persisted in
// appStorage). Currently one-shot — pickups don't respawn.
//
// Placements hand-tuned to nudge players into exploring further from spawn
// for better rewards. Each pickup has a deterministic id so collected-state
// is stable across code edits. If a placement happens to land on a blocker
// tile (tree, wall, building edge), `getResolvedPickups()` snaps it to the
// nearest walkable tile so the player can always reach it.

import type { ConsumableId } from '../../data/consumables';
import { type SFMap } from './spriteFusionMap';
import type { IconName } from '../../components/Icon';

export interface PickupDef {
  id: string;
  tileX: number;
  tileY: number;
  /** Map this pickup belongs to. Defaults to 'villageruin' when omitted. */
  mapId?: string;
  /** What the pickup awards when collected. */
  reward: {
    stardust?: number;
    filmCharges?: number;
    fusionShards?: number;
    statueFragments?: number;
    consumable?: { id: ConsumableId; amount: number };
  };
  /** Short label shown in the pickup toast. */
  label: string;
  /** Atlas icon rendered above the pickup. */
  iconName: IconName;
}

// Spawn is at (21, 45). Pickups are spread outward — more valuable rewards
// live further from camp so exploration is incentivised.
export const PICKUPS: PickupDef[] = [
  // Close to spawn — intro tier
  // 2026-05-12 — pickup stardust halved across all rings (was 25/35/60/120/80/250 = 570 total).
  // The pickup path also flows through earnStardust (progression multiplier),
  // so the effective drop after both passes is roughly 1/3 of the pre-fix total.
  { id: 'pk-stardust-01', tileX: 26, tileY: 46, reward: { stardust: 12 }, label: '+12 Stardust', iconName: 'stardust' },
  { id: 'pk-blank-01',    tileX: 19, tileY: 48, reward: { filmCharges: 2 }, label: '+2 Capture Film', iconName: 'film-basic' },
  { id: 'pk-stardust-02', tileX: 14, tileY: 40, reward: { stardust: 18 }, label: '+18 Stardust', iconName: 'stardust' },
  { id: 'pk-luck-01',     tileX: 28, tileY: 50, reward: { consumable: { id: 'luck_charm', amount: 1 } }, label: 'Luck Charm', iconName: 'luck-charm' },

  // Dojo challenge poster — near the forest entrance where trainers mention it
  { id: 'pk-dojo-poster', tileX: 35, tileY: 55, reward: {}, label: 'Dojo Challenge Poster', iconName: 'scroll-closed' },

  // Mid-ring (15-30 tiles from spawn)
  { id: 'pk-stardust-03', tileX: 40, tileY: 50, reward: { stardust: 30 }, label: '+30 Stardust', iconName: 'stardust' },
  { id: 'pk-shards-01',   tileX: 12, tileY: 30, reward: { fusionShards: 10 }, label: '+10 Fusion Shards', iconName: 'crystalball' },
  { id: 'pk-blank-02',    tileX: 45, tileY: 45, reward: { filmCharges: 3 }, label: '+3 Capture Film', iconName: 'film-basic' },
  { id: 'pk-luck-02',     tileX: 32, tileY: 30, reward: { consumable: { id: 'luck_charm', amount: 2 } }, label: '2x Luck Charm', iconName: 'luck-charm' },
  { id: 'pk-prism-01',    tileX: 48, tileY: 55, reward: { consumable: { id: 'family_prism', amount: 1 } }, label: 'Family Prism', iconName: 'family-prism' },

  // Far ring (30-60 tiles)
  { id: 'pk-stardust-04', tileX: 60, tileY: 28, reward: { stardust: 60 }, label: '+60 Stardust', iconName: 'stardust' },
  { id: 'pk-scroll-01',   tileX: 55, tileY: 55, reward: { consumable: { id: 'signature_scroll', amount: 1 } }, label: 'Signature Scroll', iconName: 'scroll-closed' },
  { id: 'pk-frags-01',    tileX: 65, tileY: 30, reward: { stardust: 40 }, label: '+40 Stardust', iconName: 'stardust' },
  { id: 'pk-shards-02',   tileX: 70, tileY: 45, reward: { fusionShards: 25 }, label: '+25 Fusion Shards', iconName: 'crystalball' },

  // Distant rewards (60+ tiles) — worth the trek
  { id: 'pk-core-01',     tileX: 88, tileY: 50, reward: { consumable: { id: 'prismatic_core', amount: 1 } }, label: 'Prismatic Core', iconName: 'prismatic-core' },
  { id: 'pk-stardust-05', tileX: 80, tileY: 70, reward: { stardust: 125 }, label: '+125 Stardust', iconName: 'stardust' },
  { id: 'pk-crystal-01',  tileX: 100, tileY: 45, reward: { consumable: { id: 'pure_crystal', amount: 1 } }, label: 'Pure Crystal', iconName: 'pure-crystal' },
  { id: 'pk-blank-03',    tileX: 95, tileY: 80, reward: { filmCharges: 8 }, label: '+8 Capture Film', iconName: 'film-basic' },
  { id: 'pk-frags-02',    tileX: 105, tileY: 60, reward: { filmCharges: 5 }, label: '+5 Capture Film', iconName: 'film-basic' },
];

/**
 * Snap each pickup to the nearest walkable tile on the loaded map. Tiles on
 * the blocker layer (trees, walls, building edges) are skipped via a
 * spiral search up to ~10 tiles outward. Cached per-map so the spiral runs
 * exactly once. Pickups that never find a walkable home (deep in the
 * out-of-bounds void) get filtered out.
 */
const resolveCache = new WeakMap<SFMap, Map<string, PickupDef>>();

function isWalkable(map: SFMap, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= map.data.mapWidth || ty >= map.data.mapHeight) return false;
  return !map.blockerTileAt.has(`${tx},${ty}`);
}

/** Spiral outward from (cx, cy) and return the first walkable tile within `max` rings. */
function nearestWalkable(map: SFMap, cx: number, cy: number, max = 10): { tx: number; ty: number } | null {
  if (isWalkable(map, cx, cy)) return { tx: cx, ty: cy };
  for (let r = 1; r <= max; r++) {
    // Walk the ring perimeter; checking corners + edges in a fixed pattern
    // is plenty for "nudge to nearest open tile".
    for (let dx = -r; dx <= r; dx++) {
      if (isWalkable(map, cx + dx, cy - r)) return { tx: cx + dx, ty: cy - r };
      if (isWalkable(map, cx + dx, cy + r)) return { tx: cx + dx, ty: cy + r };
    }
    for (let dy = -r + 1; dy <= r - 1; dy++) {
      if (isWalkable(map, cx - r, cy + dy)) return { tx: cx - r, ty: cy + dy };
      if (isWalkable(map, cx + r, cy + dy)) return { tx: cx + r, ty: cy + dy };
    }
  }
  return null;
}

export function getResolvedPickups(map: SFMap, mapId?: string): Map<string, PickupDef> {
  const cached = resolveCache.get(map);
  if (cached) return cached;
  const out = new Map<string, PickupDef>();
  // Track tiles already used by other pickups so two of them don't end up
  // on the same square after snapping.
  const taken = new Set<string>();
  const activeMapId = mapId ?? 'villageruin';
  for (const p of PICKUPS) {
    // v1.253 — Only show pickups on the map they belong to.
    if ((p.mapId ?? 'villageruin') !== activeMapId) continue;
    const snap = nearestWalkable(map, p.tileX, p.tileY);
    if (!snap) continue;
    let { tx, ty } = snap;
    // Resolve collisions with previously-placed pickups by snapping to the
    // next walkable tile not yet occupied.
    if (taken.has(`${tx},${ty}`)) {
      const alt = nearestWalkable(map, tx, ty, 6);
      if (alt && !taken.has(`${alt.tx},${alt.ty}`)) {
        tx = alt.tx; ty = alt.ty;
      }
    }
    taken.add(`${tx},${ty}`);
    out.set(p.id, { ...p, tileX: tx, tileY: ty });
  }
  resolveCache.set(map, out);
  return out;
}
