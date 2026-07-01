// Sprite Fusion map format loader + lookups.
// Exports from https://spritefusion.com look like:
//   { tileSize, mapWidth, mapHeight, layers: [{ name, tiles: [{id,x,y}], collider }] }
//
// Collision is per-pixel: we scan each tile's alpha mask out of the tilesheet
// once at load time and check the player's hitbox against the opaque pixels of
// every overlapping blocker tile. This way transparent corners/edges on trees,
// walls, etc. don't stop the player, and fully-empty tiles (the Sprite Fusion
// eraser/background id) never block anything.

export interface SFTile {
  id: string;
  x: number;
  y: number;
}

export interface SFLayer {
  name: string;
  tiles: SFTile[];
  collider: boolean;
}

export interface SFMapData {
  tileSize: number;
  mapWidth: number;
  mapHeight: number;
  layers: SFLayer[];
}

/** World-pixel AABB used for ObjectPlacement collision. */
export interface ObjectBlockerRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SFMap {
  data: SFMapData;
  /** (x,y) tile-cell → tile id on the Blockers layer. Empty ids are omitted. */
  blockerTileAt: Map<string, number>;
  /** (x,y) tile-cell → tile id on any "tall grass"-named layer. */
  tallGrassTileAt: Map<string, number>;
  /** Per-tile-id alpha mask at source resolution (data.tileSize²). 1 = opaque. */
  tileMasks: Map<number, Uint8Array>;
  /** Tile ids whose source cell is fully transparent (eraser / padding slots). */
  emptyIds: Set<number>;
  /** World-pixel AABB rects from blocksPassage objects placed on this map.
   *  Populated by assets.ts after image preload; defaults to an empty array
   *  so collision call sites work the same on maps with no objects. */
  objectBlockerRects: ObjectBlockerRect[];
}

// Per-path cache so multiple maps can coexist. Callers look up by jsonPath —
// there is intentionally NO "active map" global, because that turned into a
// multi-writer bug where a side effect during a React re-render could silently
// switch which map the renderer drew while the game state still said "cave1".
const cache = new Map<string, SFMap>();

/**
 * Tilesheets that ship a `*_water.json` collision sidecar.
 *
 * The sidecar is opt-in per tilesheet — only `villageruin.png` has
 * one as of 2026-05-11. v1.281's loader fetched the sidecar
 * unconditionally for every tilesheet, which generated 18+ HTTP
 * 404s per session against the CDN and lit up error monitors.
 * Anything not in this set short-circuits to "no sidecar".
 *
 * Add new entries when authoring a map with water/shore tiles that
 * needs the frame-name-based blocker rule. Existing maps with no
 * water can continue to use Sprite Fusion's "Blockers" layer.
 */
const TILESHEETS_WITH_WATER_SIDECAR = new Set<string>([
  'world/maps/villageruin.png',
  'world/maps/desert_city.png',
  'world/maps/community.png',
  'world/maps/farmlands.png',
  'world/maps/CapitalGrounds.png',
  // Sample for new devs: TemplateMap ships a TemplateMap_water.json so the
  // tutorial can point at a working example of custom tile blocking.
  'world/maps/TemplateMap.png',
]);

export async function loadSpriteFusionMap(
  jsonPath: string,
  tilesheetPath: string,
): Promise<SFMap> {
  const hit = cache.get(jsonPath);
  if (hit) return hit;

  // Optional tile-collision sidecar that lives next to the tilesheet PNG:
  //   <tilesheet>.png  →  <tilesheet>_water.json
  // Frames named `water*` or `shore*` in that file are treated as solid no
  // matter which layer they appear on. 404 / parse error just means "no
  // sidecar, nothing extra blocks" — keeps maps without water working.
  //
  // 2026-05-11 — Skip the fetch entirely for tilesheets that we know
  // don't ship a sidecar. v1.281 was firing 18+ fetches per session
  // that all 404'd, which polluted error monitors and the player's
  // DevTools console. The sidecar is opt-in per tilesheet, so a
  // static allowlist is the simplest correct gate. Add new entries
  // here when authoring a map with a `*_water.json` neighbor.
  const sidecarPromise = TILESHEETS_WITH_WATER_SIDECAR.has(tilesheetPath)
    ? fetch(tilesheetPath.replace(/\.png$/i, '_water.json'))
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
    : Promise.resolve(null);

  const [res, img, sidecar] = await Promise.all([
    fetch(jsonPath),
    loadImage(tilesheetPath),
    sidecarPromise,
  ]);
  if (!res.ok) throw new Error(`Failed to load map: ${jsonPath} (${res.status})`);
  const data = (await res.json()) as SFMapData;
  const { masks, emptyIds } = analyzeTilesheet(img, data.tileSize);

  const cols = Math.max(1, Math.floor(img.width / data.tileSize));
  const solidTileIds = extractSolidTileIds(sidecar, cols, data.tileSize);

  const blockerTileAt = buildBlockerMap(data, emptyIds);
  augmentWithSolidTiles(blockerTileAt, data, solidTileIds, emptyIds);

  const m: SFMap = {
    data,
    blockerTileAt,
    tallGrassTileAt: buildTileMap(data, (L) => L.name.toLowerCase().includes('tall grass'), emptyIds),
    tileMasks: masks,
    emptyIds,
    objectBlockerRects: [],
  };
  cache.set(jsonPath, m);
  return m;
}

/**
 * Parse a LayoutManager-style sidecar atlas and return every tile id whose
 * frame name starts with `water` or `shore`. Frame rects are in pixel
 * coordinates on the tilesheet PNG, so we convert back to the tile id using
 * the same `row * cols + col` formula the map uses.
 *
 * Frames may be either:
 *   • A single 16×16 tile rect (villageruin convention: one frame per tile,
 *     named `water`, `shore01`, `shore02`, …), or
 *   • A larger rectangle that covers a contiguous block of solid tiles
 *     (desert_city convention: one frame named `water_tiles` covering an
 *     entire region of the sheet).
 * Both are supported: we iterate every tile inside the frame rect, so a
 * 128×32 region at tileSize 16 expands to all 16 tile ids it spans.
 */
function extractSolidTileIds(
  sidecar: unknown,
  cols: number,
  tileSize: number,
): Set<number> {
  const out = new Set<number>();
  if (!sidecar || typeof sidecar !== 'object') return out;
  const frames = (sidecar as { frames?: unknown }).frames;
  if (!frames || typeof frames !== 'object') return out;
  for (const [name, raw] of Object.entries(frames as Record<string, unknown>)) {
    if (!/^(water|shore)/i.test(name)) continue;
    const frame = (raw as { frame?: { x?: unknown; y?: unknown; w?: unknown; h?: unknown } } | null)?.frame;
    if (!frame || typeof frame.x !== 'number' || typeof frame.y !== 'number') continue;
    const w = typeof frame.w === 'number' && frame.w > 0 ? frame.w : tileSize;
    const h = typeof frame.h === 'number' && frame.h > 0 ? frame.h : tileSize;
    const col0 = Math.floor(frame.x / tileSize);
    const row0 = Math.floor(frame.y / tileSize);
    const colN = Math.ceil((frame.x + w) / tileSize);
    const rowN = Math.ceil((frame.y + h) / tileSize);
    for (let r = row0; r < rowN; r++) {
      for (let c = col0; c < colN; c++) {
        out.add(r * cols + c);
      }
    }
  }
  return out;
}

/**
 * Fold tile-id-based solids (water, shore, etc.) into the blocker coord map
 * by scanning every non-collider layer for tiles whose id is solid. The
 * downstream collision code only reads `blockerTileAt`, so adding the coord
 * there is all that's needed to make the player collide.
 */
function augmentWithSolidTiles(
  blockerTileAt: Map<string, number>,
  data: SFMapData,
  solidTileIds: Set<number>,
  emptyIds: Set<number>,
): void {
  if (solidTileIds.size === 0) return;
  for (const L of data.layers) {
    if (L.collider) continue; // already in blockerTileAt
    for (const t of L.tiles) {
      const id = parseInt(t.id, 10);
      if (!solidTileIds.has(id)) continue;
      if (emptyIds.has(id)) continue;
      const key = `${t.x},${t.y}`;
      // Don't clobber a real Blockers entry that may already sit at the same
      // coord — both resolve to a collision anyway, but keeping the original
      // tile id means `map.tileMasks` still points at the right art.
      if (!blockerTileAt.has(key)) blockerTileAt.set(key, id);
    }
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function analyzeTilesheet(
  img: HTMLImageElement,
  srcTileSize: number,
): { masks: Map<number, Uint8Array>; emptyIds: Set<number> } {
  const masks = new Map<number, Uint8Array>();
  const emptyIds = new Set<number>();
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { masks, emptyIds };
  ctx.drawImage(img, 0, 0);
  const cols = Math.max(1, Math.floor(img.width / srcTileSize));
  const rows = Math.max(1, Math.floor(img.height / srcTileSize));
  const tileArea = srcTileSize * srcTileSize;
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const id = ty * cols + tx;
      const { data: px } = ctx.getImageData(tx * srcTileSize, ty * srcTileSize, srcTileSize, srcTileSize);
      const mask = new Uint8Array(tileArea);
      let opaque = 0;
      for (let i = 0; i < tileArea; i++) {
        if (px[i * 4 + 3]! > 0) {
          mask[i] = 1;
          opaque++;
        }
      }
      if (opaque === 0) emptyIds.add(id);
      else masks.set(id, mask);
    }
  }
  return { masks, emptyIds };
}

function buildBlockerMap(data: SFMapData, emptyIds: Set<number>): Map<string, number> {
  const m = new Map<string, number>();
  for (const L of data.layers) {
    if (!L.collider) continue;
    for (const t of L.tiles) {
      const id = parseInt(t.id, 10);
      if (emptyIds.has(id)) continue;
      m.set(`${t.x},${t.y}`, id);
    }
  }
  return m;
}

function buildTileMap(
  data: SFMapData,
  predicate: (L: SFLayer) => boolean,
  emptyIds: Set<number>,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const L of data.layers) {
    if (!predicate(L)) continue;
    for (const t of L.tiles) {
      const id = parseInt(t.id, 10);
      if (emptyIds.has(id)) continue;
      m.set(`${t.x},${t.y}`, id);
    }
  }
  return m;
}

export function getMap(jsonPath: string): SFMap | null {
  return cache.get(jsonPath) ?? null;
}

export function isTallGrassAt(m: SFMap, tx: number, ty: number): boolean {
  return m.tallGrassTileAt.has(`${tx},${ty}`);
}

export function tallGrassTileIdAt(m: SFMap, tx: number, ty: number): number | undefined {
  return m.tallGrassTileAt.get(`${tx},${ty}`);
}

/**
 * True if the world-pixel rect [x, x+w) × [y, y+h) overlaps any opaque
 * pixel of a Blockers tile. Out-of-bounds counts as a collision (edge wall).
 */
export function rectCollidesBlockers(
  m: SFMap,
  renderTileSize: number,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  const worldPxW = m.data.mapWidth * renderTileSize;
  const worldPxH = m.data.mapHeight * renderTileSize;
  if (x < 0 || y < 0 || x + w > worldPxW || y + h > worldPxH) return true;

  const src = m.data.tileSize;
  const scale = renderTileSize / src;
  const minTx = Math.floor(x / renderTileSize);
  const maxTx = Math.floor((x + w - 1) / renderTileSize);
  const minTy = Math.floor(y / renderTileSize);
  const maxTy = Math.floor((y + h - 1) / renderTileSize);

  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      const id = m.blockerTileAt.get(`${tx},${ty}`);
      if (id === undefined) continue;
      const mask = m.tileMasks.get(id);
      if (!mask) continue;

      // Intersect the hitbox with this tile in world pixels, then map to source pixels.
      const ix0 = Math.max(x, tx * renderTileSize);
      const iy0 = Math.max(y, ty * renderTileSize);
      const ix1 = Math.min(x + w, (tx + 1) * renderTileSize);
      const iy1 = Math.min(y + h, (ty + 1) * renderTileSize);
      const sx0 = Math.max(0, Math.floor((ix0 - tx * renderTileSize) / scale));
      const sy0 = Math.max(0, Math.floor((iy0 - ty * renderTileSize) / scale));
      const sx1 = Math.min(src, Math.ceil((ix1 - tx * renderTileSize) / scale));
      const sy1 = Math.min(src, Math.ceil((iy1 - ty * renderTileSize) / scale));

      for (let sy = sy0; sy < sy1; sy++) {
        const rowStart = sy * src;
        for (let sx = sx0; sx < sx1; sx++) {
          if (mask[rowStart + sx]) return true;
        }
      }
    }
  }
  // Decorative-object AABB blockers (flags etc.). Plain rect-vs-rect — the
  // bounds were already alpha-bbox-cropped at build time so transparent
  // pixels never block. Walking this list directly is fine; we expect at
  // most a few hundred per map and the hot path is checked once per move.
  for (const r of m.objectBlockerRects) {
    if (x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y) return true;
  }
  return false;
}

/**
 * True if a circle of `radius` centered at world-pixel (cx, cy) overlaps any
 * opaque pixel of a Blockers tile. Used for player collision so the hitbox
 * doesn't catch on square corners.
 */
export function circleCollidesBlockers(
  m: SFMap,
  renderTileSize: number,
  cx: number,
  cy: number,
  radius: number,
): boolean {
  const worldPxW = m.data.mapWidth * renderTileSize;
  const worldPxH = m.data.mapHeight * renderTileSize;
  if (cx - radius < 0 || cy - radius < 0 || cx + radius > worldPxW || cy + radius > worldPxH) return true;

  const src = m.data.tileSize;
  const scale = renderTileSize / src;
  const r2 = radius * radius;

  const minTx = Math.floor((cx - radius) / renderTileSize);
  const maxTx = Math.floor((cx + radius - 1) / renderTileSize);
  const minTy = Math.floor((cy - radius) / renderTileSize);
  const maxTy = Math.floor((cy + radius - 1) / renderTileSize);

  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      const id = m.blockerTileAt.get(`${tx},${ty}`);
      if (id === undefined) continue;
      const mask = m.tileMasks.get(id);
      if (!mask) continue;

      const tileX0 = tx * renderTileSize;
      const tileY0 = ty * renderTileSize;
      const ix0 = Math.max(cx - radius, tileX0);
      const iy0 = Math.max(cy - radius, tileY0);
      const ix1 = Math.min(cx + radius, tileX0 + renderTileSize);
      const iy1 = Math.min(cy + radius, tileY0 + renderTileSize);
      const sx0 = Math.max(0, Math.floor((ix0 - tileX0) / scale));
      const sy0 = Math.max(0, Math.floor((iy0 - tileY0) / scale));
      const sx1 = Math.min(src, Math.ceil((ix1 - tileX0) / scale));
      const sy1 = Math.min(src, Math.ceil((iy1 - tileY0) / scale));

      for (let sy = sy0; sy < sy1; sy++) {
        const rowStart = sy * src;
        const wy = tileY0 + (sy + 0.5) * scale;
        const ddy = wy - cy;
        const ddy2 = ddy * ddy;
        if (ddy2 > r2) continue;
        for (let sx = sx0; sx < sx1; sx++) {
          if (!mask[rowStart + sx]) continue;
          const wx = tileX0 + (sx + 0.5) * scale;
          const ddx = wx - cx;
          if (ddx * ddx + ddy2 <= r2) return true;
        }
      }
    }
  }
  // Decorative-object AABB blockers — circle-vs-rect closest-point test.
  for (const r of m.objectBlockerRects) {
    const nx = Math.max(r.x, Math.min(cx, r.x + r.w));
    const ny = Math.max(r.y, Math.min(cy, r.y + r.h));
    const ddx = cx - nx;
    const ddy = cy - ny;
    if (ddx * ddx + ddy * ddy <= r2) return true;
  }
  return false;
}

/**
 * True if the world-pixel rect overlaps any opaque pixel of a tall-grass
 * tile. Same per-pixel alpha-mask approach as rectCollidesBlockers — use
 * this to decide "are the character's feet actually standing on a grass
 * blade?" instead of the coarser "is this tile cell a grass tile?".
 */
export function rectOverlapsTallGrass(
  m: SFMap,
  renderTileSize: number,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  const src = m.data.tileSize;
  const scale = renderTileSize / src;
  const minTx = Math.floor(x / renderTileSize);
  const maxTx = Math.floor((x + w - 1) / renderTileSize);
  const minTy = Math.floor(y / renderTileSize);
  const maxTy = Math.floor((y + h - 1) / renderTileSize);

  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      const id = m.tallGrassTileAt.get(`${tx},${ty}`);
      if (id === undefined) continue;
      const mask = m.tileMasks.get(id);
      if (!mask) continue;

      const ix0 = Math.max(x, tx * renderTileSize);
      const iy0 = Math.max(y, ty * renderTileSize);
      const ix1 = Math.min(x + w, (tx + 1) * renderTileSize);
      const iy1 = Math.min(y + h, (ty + 1) * renderTileSize);
      const sx0 = Math.max(0, Math.floor((ix0 - tx * renderTileSize) / scale));
      const sy0 = Math.max(0, Math.floor((iy0 - ty * renderTileSize) / scale));
      const sx1 = Math.min(src, Math.ceil((ix1 - tx * renderTileSize) / scale));
      const sy1 = Math.min(src, Math.ceil((iy1 - ty * renderTileSize) / scale));

      for (let sy = sy0; sy < sy1; sy++) {
        const rowStart = sy * src;
        for (let sx = sx0; sx < sx1; sx++) {
          if (mask[rowStart + sx]) return true;
        }
      }
    }
  }
  return false;
}

export function tileSrcXY(
  idStr: string,
  tilesheetCols: number,
  srcTileSize: number,
): { sx: number; sy: number } {
  const id = parseInt(idStr, 10);
  const col = id % tilesheetCols;
  const row = Math.floor(id / tilesheetCols);
  return { sx: col * srcTileSize, sy: row * srcTileSize };
}
