// Tile-grid A* for tap-to-move click pathing. The player can otherwise walk
// pixel-by-pixel through tile alpha masks (see Overworld's findPerpendicularSlip
// + playerCircleCollides), but a click that aims past a wall used to just walk
// the player straight into the wall and abandon the path. This module computes
// a tile-cell route around blockers so clicks "go around" buildings, fences,
// trees, etc. instead of getting stuck.
//
// Conservative: any tile in `blockerTileAt` counts as fully blocked, even
// though the engine's pixel collision would let the player squeeze past
// transparent corners. That's fine — a slightly long path is better than a
// path that gets stuck on a corner.
//
// 8-directional with NO corner-cutting (a diagonal step is only allowed if
// both adjacent cardinal tiles are also walkable), so the player won't try to
// shave corners through walls.

import type { SFMap } from '../data/spriteFusionMap';

export interface TileXY { tx: number; ty: number }

function key(tx: number, ty: number): string {
  return `${tx},${ty}`;
}

export function isWalkable(map: SFMap, tx: number, ty: number, extra?: Set<string>): boolean {
  if (tx < 0 || ty < 0) return false;
  if (tx >= map.data.mapWidth || ty >= map.data.mapHeight) return false;
  const k = key(tx, ty);
  if (map.blockerTileAt.has(k)) return false;
  if (extra && extra.has(k)) return false;
  return true;
}

/**
 * Find the nearest walkable tile to (tx, ty), searched in expanding rings.
 * Returns null if nothing within `maxRadius` tiles is walkable. Used to snap
 * a click on a blocker tile (a tree, a wall, or an NPC) to the closest
 * reachable cell.
 */
export function nearestWalkable(
  map: SFMap,
  tx: number,
  ty: number,
  maxRadius = 6,
  extraBlockers?: Set<string>,
): TileXY | null {
  if (isWalkable(map, tx, ty, extraBlockers)) return { tx, ty };
  for (let r = 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        // Only inspect the ring border at radius r.
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = tx + dx;
        const ny = ty + dy;
        if (isWalkable(map, nx, ny, extraBlockers)) return { tx: nx, ty: ny };
      }
    }
  }
  return null;
}

const NEIGHBORS = [
  { dx:  0, dy: -1, cost: 1.0 }, // N
  { dx:  1, dy:  0, cost: 1.0 }, // E
  { dx:  0, dy:  1, cost: 1.0 }, // S
  { dx: -1, dy:  0, cost: 1.0 }, // W
  { dx:  1, dy: -1, cost: 1.4142 }, // NE
  { dx:  1, dy:  1, cost: 1.4142 }, // SE
  { dx: -1, dy:  1, cost: 1.4142 }, // SW
  { dx: -1, dy: -1, cost: 1.4142 }, // NW
];

function octileHeuristic(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

/**
 * Find a tile-grid path from (sx, sy) to (gx, gy). Returns the sequence of
 * tiles INCLUDING the start tile and goal tile, or null if unreachable.
 *
 * `maxNodes` bounds search work — if a path is genuinely far / convoluted we'd
 * rather give up and let the click no-op than burn frames searching the whole
 * map.
 */
export function findPath(
  map: SFMap,
  sx: number,
  sy: number,
  gx: number,
  gy: number,
  maxNodes = 4000,
  extraBlockers?: Set<string>,
): TileXY[] | null {
  // Start tile is always treated as walkable — the player is standing on it,
  // so even if it overlaps an `extraBlockers` entry (shouldn't, but defensive),
  // we don't want to refuse to plan a route out.
  if (!isWalkable(map, sx, sy)) return null;
  if (!isWalkable(map, gx, gy, extraBlockers)) return null;
  if (sx === gx && sy === gy) return [{ tx: sx, ty: sy }];

  // Open set keyed by tile, priority = fScore. Implemented as a sorted array
  // popped from the front — fine for the modest path lengths in this game
  // (~20–60 tiles). A binary heap is overkill here.
  interface Node { tx: number; ty: number; g: number; f: number; parent: string | null }
  const startKey = key(sx, sy);
  const open: Node[] = [{ tx: sx, ty: sy, g: 0, f: octileHeuristic(sx, sy, gx, gy), parent: null }];
  const openMap = new Map<string, Node>([[startKey, open[0]!]]);
  const closed = new Map<string, Node>();
  let visited = 0;

  while (open.length > 0) {
    if (visited++ > maxNodes) return null;
    // Pop the lowest-f node from the open list.
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i]!.f < open[bestIdx]!.f) bestIdx = i;
    }
    const cur = open.splice(bestIdx, 1)[0]!;
    const ck = key(cur.tx, cur.ty);
    openMap.delete(ck);
    closed.set(ck, cur);

    if (cur.tx === gx && cur.ty === gy) {
      // Reconstruct from parents.
      const path: TileXY[] = [];
      let n: Node | undefined = cur;
      while (n) {
        path.push({ tx: n.tx, ty: n.ty });
        n = n.parent ? closed.get(n.parent) ?? openMap.get(n.parent) : undefined;
      }
      path.reverse();
      return path;
    }

    for (const nb of NEIGHBORS) {
      const nx = cur.tx + nb.dx;
      const ny = cur.ty + nb.dy;
      if (!isWalkable(map, nx, ny, extraBlockers)) continue;
      // No corner-cutting on diagonal moves: both adjacent cardinal tiles
      // must also be walkable, otherwise the diagonal would slip through a
      // wall corner (or squeeze between two NPCs).
      if (nb.dx !== 0 && nb.dy !== 0) {
        if (!isWalkable(map, cur.tx + nb.dx, cur.ty, extraBlockers)) continue;
        if (!isWalkable(map, cur.tx, cur.ty + nb.dy, extraBlockers)) continue;
      }
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const tentativeG = cur.g + nb.cost;
      const existing = openMap.get(nk);
      if (existing && existing.g <= tentativeG) continue;
      const node: Node = {
        tx: nx, ty: ny,
        g: tentativeG,
        f: tentativeG + octileHeuristic(nx, ny, gx, gy),
        parent: ck,
      };
      if (existing) {
        // Replace by removing the old open-list entry and pushing the new.
        const idx = open.indexOf(existing);
        if (idx >= 0) open.splice(idx, 1);
      }
      open.push(node);
      openMap.set(nk, node);
    }
  }
  return null;
}
