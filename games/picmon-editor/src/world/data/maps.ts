import type { AnimalDef, NpcDef, TrainerMonSpec } from '../engine/types';
import { TILE_SIZE } from '../engine/types';
import type { ObjectBlockerRect } from './spriteFusionMap';
import portalsJson from './portals.json';

// NPC catalog: identity lives in src/world/data/npcs/<id>.json, independent
// of which map they're on. Map files (src/world/data/maps/<mapId>.json) list
// which NPCs appear on each map and where.
//
// Portals live in a single src/world/data/portals.json as pairs (A/B) so a
// doorway between locations is one record — same-map teleports just use
// the same mapId on both halves.

interface NpcJson {
  id: string;
  name: string;
  character: string;
  dialogue: string[];
  kind?: 'pvp' | 'merge' | 'shop' | 'heal' | 'tutor' | 'starter-pick' | 'tower' | 'tower-challenger';
  trainerParty?: TrainerMonSpec[];
  trainerReward?: number;
  postDefeatDialogue?: string[];
  preBattleLine?: string;
  moodEmotes?: string[];
  /** When true, this NPC doesn't wander — see NpcDef.stationary. */
  stationary?: boolean;
  /** Lock facing to one cardinal direction — see NpcDef.faceDirection. */
  faceDirection?: NpcDef['faceDirection'];
  /** v1.710 — Lateral gate width (tiles). See NpcDef.gateTilesLR.
   *  Marshal Vance uses 1 to span the 3-tile-wide tower lobby corridor. */
  gateTilesLR?: number;
  /** Editor-side filter — see NpcDef.homeMapId. Not enforced at runtime. */
  homeMapId?: string;
  /** When true, this trainer physically blocks passage (bridge guard).
   *  Once defeated, they become walk-through so the player can pass. */
  blocksPassage?: boolean;
  /**
   * 2026-05-13 — Optional list of trainer ids that must be defeated
   * BEFORE this trainer will engage in battle. Used for boss-style
   * gating (the Pharaoh's Awakening Sovereign requires the three
   * trial-guardians beaten first). Talking to the NPC without the
   * prerequisites met yields the pre-requisite hint message instead
   * of starting the duel. Empty / absent = no prerequisites.
   */
  requiredTrainerDefeats?: string[];
  /**
   * 2026-05-13 — Optional message shown when the player tries to
   * engage this trainer but `requiredTrainerDefeats` isn't yet
   * satisfied. Defaults to a generic "you must first defeat..."
   * notice if absent.
   */
  prereqBlockedMessage?: string;
}

/**
 * Inline placement for a wandering decorative animal. Unlike NPCs, animals
 * have no dialogue/behavior config, so everything lives on the placement —
 * no separate per-animal JSON catalog.
 */
export interface AnimalPlacement {
  type: string;
  /** Sheet basename under the species folder; defaults to "SpriteSheet". */
  sheet?: string;
  tileX: number;
  tileY: number;
  /** Half-width (in tiles) of the roam box around spawn. */
  wanderTiles: number;
}

/**
 * Inline placement for a static decorative object (flags, etc.) keyed by
 * an image path relative to public/world/tilesets/. First 16×16 of the
 * source PNG is rendered as the object's tile. Editor-only for now —
 * runtime renderer pickup is a follow-up.
 */
/**
 * How an object draws relative to the player sprite. Independent of
 * collision (which lives on `blocksPassage`).
 *  - 'under'   → drawn below the player (like the `ground` SF layer)
 *  - 'sort'    → Y-sorted with the player (like `bushes_flowers`)
 *  - 'overlay' → drawn above the player (like the `overlay` SF layer)
 */
export type ObjectDrawOrder = 'under' | 'sort' | 'overlay';

export interface ObjectPlacement {
  /** Tileset-relative path, e.g. "Animated/Flag/FlagRed16x16.png". */
  image: string;
  tileX: number;
  tileY: number;
  /** Sub-tile offset in SOURCE pixels (16-px grid). Lets a designer
   *  nudge an object off the grid for fine-tuning. Defaults to 0. */
  offsetX?: number;
  offsetY?: number;
  /** Draw order vs the player sprite. Defaults to 'under'. */
  drawOrder?: ObjectDrawOrder;
  /** When true, the object's tile is impassable to the player. Defaults
   *  to false (decorative-only). Independent of `drawOrder`. */
  blocksPassage?: boolean;
  /** Custom collider box in SOURCE pixels (16-px grid). Origin is the
   *  object's top-left at its tile + offset. When present, overrides the
   *  auto-cropped alpha bbox. Used for things like raising a doorway
   *  collider above the floor or shrinking a flag's box to just the pole.
   *  Omit to fall back to the alpha-bbox auto-crop. */
  colliderBox?: { x: number; y: number; w: number; h: number };
  /** When true (default), the animation starts on a per-placement phase
   *  offset so a row of flags / flowers doesn't flap in lockstep. The
   *  offset is deterministic from tileX/tileY/image so it's stable
   *  across reloads. Set to false to force all placements to start on
   *  frame 0 (useful when you DO want synchronized animation). */
  randomizeFrameStart?: boolean;
}

interface MapJson {
  id: string;
  /** Named entry points. `default` is where the player appears on first load. */
  spawns: Record<string, { tileX: number; tileY: number }>;
  /** Static NPC placements on this map. Editor writes here. */
  placements: Array<{ npcId: string; tileX: number; tileY: number }>;
  /** Decorative animal placements. Optional — absent on maps with no animals. */
  animals?: AnimalPlacement[];
  /** Decorative object placements (flags, etc.). Editor-only renderer for now. */
  objects?: ObjectPlacement[];
  /**
   * Default battle backdrop frame for encounters on this map. One of the
   * frame keys in public/world/backgrounds/battlebackgrounds1.json. Omitted
   * means "use the forest fallback".
   */
  battleBgFrame?: string;
  /**
   * Per-grass-patch backdrop overrides. Keyed by `${signTileX},${signTileY}`
   * — the upper-left tile of each connected tall-grass region (matches what
   * grassPatches.computeGrassPatches picks as the patch sign anchor).
   */
  grassPatchBackgrounds?: Record<string, string>;
  /**
   * Per-grass-patch wild-encounter level range overrides. When an entry
   * exists for a patch, its `{ min, max }` replaces the auto-tier values
   * grassPatches.ts assigns by spawn distance. Same key shape as
   * `grassPatchBackgrounds`.
   */
  grassPatchLevels?: Record<string, { min: number; max: number }>;
  /**
   * 2026-06-05 (v1.730) — Per-grass-patch environment override.
   *
   * Keyed by `${signTileX},${signTileY}` (same coordinate space as
   * `grassPatchLevels` / `grassPatchBackgrounds`). When an entry
   * exists for a patch, the wild-encounter picker in GameCanvas
   * uses THIS env id instead of the map-level `MAP_ENVIRONMENTS`
   * tag — so a single map can host multiple themed wild zones.
   *
   * Use case: villageruin needs a "Dojo Wilds" zone around the
   * Trainer Tower entrance (south of the village) where martial
   * mons spawn at high concentration, while keeping the rest of
   * villageruin's wilds generic for FTUE starter encounters. The
   * map-level env tag was the wrong granularity for this — tagging
   * all of villageruin would have funneled starters into a tier-2
   * martial biome.
   *
   * Tagged patches still mix with the general (untagged) pool at
   * the standard 3× env-weight, so the dojo grass isn't *exclusive*
   * to martial mons — players still see variety, just biased toward
   * the dojo theme. Matches the desert / forest1 / cave pattern.
   */
  grassPatchEnvOverrides?: Record<string, string>;
  /**
   * 2026-05-17 — Per-grass-patch XP multiplier. When an entry exists,
   * `calculateWorldXP` in WorldTab post-multiplies the final XP by this
   * value for any wild kill/capture that fired from that patch. Same
   * key shape as `grassPatchLevels`. Used for late-game "challenge"
   * wilds (e.g. the Lively Dragon patch in snow_town) where the
   * level-diff curve already caps at 4× but the player needs more
   * meaningful progression per kill.
   */
  grassPatchXpMultipliers?: Record<string, number>;
  /**
   * v1.223 — Override the tile the grass-patch tier algorithm uses as
   * its "easy origin". Patches closest to this tile get tier 0 (lowest
   * levels); patches farthest get tier 5 (highest). Default is the
   * map's `spawns.default` tile, which sits in the middle of most
   * maps and produces a "cone of difficulty" radiating outward —
   * geographically incoherent for players who expect "going deeper =
   * harder". Set this to the natural ENTRY portal (e.g. Forest 1's
   * village-side at 33,48) so the ramp follows the player's path.
   */
  levelOriginTile?: { tileX: number; tileY: number };
}

export interface PortalHalf {
  mapId: string;
  /** Collision rect in tile coords — stepping into it triggers the warp. */
  rect: { tileX: number; tileY: number; w: number; h: number };
  /** Tile the player appears on when coming through from the OTHER half. */
  spawn: { tileX: number; tileY: number };
  /** Direction the player faces on arrival. Defaults to 'down' if absent. */
  facing?: 'up' | 'down' | 'left' | 'right';
}
/**
 * Optional quest gate on a portal. When present, crossing INTO the portal
 * from `fromMapId` is blocked until every id in `requiredTrainerDefeats`
 * appears in the player's trainerDefeats set. The render layer also draws
 * `doorImage` (if set) at the gated half's rect while the gate is active.
 *
 * fromMapId must equal one of the portal's halves' mapId. The gated half
 * is the one whose mapId === fromMapId. doorImage is a /public-relative
 * path (e.g. "world/tilesets/Cave_BossDoor.png") and is preloaded by
 * preloadAssets so it draws on the first frame after walking up.
 */
export interface PortalGate {
  fromMapId: string;
  requiredTrainerDefeats: string[];
  blockedMessage?: string;
  doorImage?: string;
  /**
   * 2026-05-12 — Dev-only flag. When true the portal is treated as
   * non-existent for non-admin players (no warp triggered, no door
   * sprite drawn, no proximity prompt). Admins step through normally.
   * Used for in-progress zones that ship in the bundle but should not
   * surface to live users yet.
   */
  adminOnly?: boolean;
  /**
   * 2026-05-13 — Limited-time event gate. When set, the portal is
   * gated by the named event's active window. Two enforcement layers:
   *
   *   1. Visibility (`isPortalVisibleToCurrentPlayer` in Overworld.ts) —
   *      when the event is inactive the portal is treated as non-
   *      existent for non-admin players (no warp, no door sprite, no
   *      proximity prompt). Admins still see / step through normally.
   *
   *   2. Gate-blocking (`isGateOpen` in Overworld.ts, added 2026-05-30
   *      / v1.602) — belt-and-suspenders. Even if the visibility check
   *      somehow misses (e.g. the portal lacks a `gate` block but is
   *      still listed), the gate evaluator refuses to open while the
   *      event window is closed.
   *
   * Currently supported eventIds: 'desert_pharaoh' (Pharaoh's
   * Awakening). Adding a new event: extend the switch in the resolver
   * and in `isGateOpen` so both layers know about it.
   *
   * Mike (2026-05-30): "the portral in the village is still taking
   * users to the desert event too man" — root cause was that
   * portal-desert-city had a `gate` block (for the blockedMessage
   * scaffolding) but no `eventId` on it, so neither layer fired.
   * v1.602 plugs `eventId: 'desert_pharaoh'` into the desert portal
   * and adds the gate-blocking layer.
   */
  eventId?: string;
}
export interface Portal {
  id: string;
  a: PortalHalf;
  b: PortalHalf;
  gate?: PortalGate;
}
interface PortalsJson { portals: Portal[] }

const charSprite = (name: string) => ({
  sprite: `world/npcs/Character/${name}/SpriteSheet.png`,
  spriteJson: `world/npcs/Character/${name}/SpriteSheet.json`,
  faceset: `world/npcs/Character/${name}/Faceset.png`,
});

/** Resolve an animal placement to its sprite sheet PNG + JSON urls. */
export function animalSpritePaths(type: string, sheet?: string): { sprite: string; spriteJson: string; sheet: string } {
  const stem = sheet && sheet.length > 0 ? sheet : 'SpriteSheet';
  return {
    sheet: stem,
    sprite: `world/npcs/Animal/${type}/${stem}.png`,
    spriteJson: `world/npcs/Animal/${type}/${stem}.json`,
  };
}

// Glob so dropping a new NPC JSON into src/world/data/npcs/ just works.
const NPC_MODULES = import.meta.glob<NpcJson>('./npcs/*.json', { eager: true, import: 'default' });
export const NPC_CATALOG: Record<string, Omit<NpcDef, 'tileX' | 'tileY'>> = {};
for (const json of Object.values(NPC_MODULES)) {
  NPC_CATALOG[json.id] = {
    id: json.id,
    name: json.name,
    ...charSprite(json.character),
    dialogue: json.dialogue,
    ...(json.kind ? { kind: json.kind } : {}),
    ...(json.trainerParty ? { trainerParty: json.trainerParty } : {}),
    ...(json.trainerReward !== undefined ? { trainerReward: json.trainerReward } : {}),
    ...(json.preBattleLine ? { preBattleLine: json.preBattleLine } : {}),
    ...(json.postDefeatDialogue ? { postDefeatDialogue: json.postDefeatDialogue } : {}),
    ...(json.moodEmotes ? { moodEmotes: json.moodEmotes } : {}),
    ...(json.stationary ? { stationary: true } : {}),
    ...(json.faceDirection ? { faceDirection: json.faceDirection } : {}),
    ...(json.gateTilesLR ? { gateTilesLR: json.gateTilesLR } : {}),
    ...(json.homeMapId ? { homeMapId: json.homeMapId } : {}),
    ...(json.blocksPassage ? { blocksPassage: true } : {}),
    ...(json.requiredTrainerDefeats && json.requiredTrainerDefeats.length > 0
      ? { requiredTrainerDefeats: json.requiredTrainerDefeats }
      : {}),
    ...(json.prereqBlockedMessage ? { prereqBlockedMessage: json.prereqBlockedMessage } : {}),
  };
}

// Map catalog, same pattern.
const MAP_MODULES = import.meta.glob<MapJson>('./maps/*.json', { eager: true, import: 'default' });
export const MAP_CATALOG: Record<string, MapJson> = {};
for (const json of Object.values(MAP_MODULES)) {
  MAP_CATALOG[json.id] = json;
}

// Portals go through a getter so the game picks up edits from the editor
// without a page refresh. See the hot-accept block near the bottom of this
// file — when portals.json changes we re-read it into PORTALS_DATA.
let PORTALS_DATA: Portal[] = (portalsJson as PortalsJson).portals;
export const PORTALS: Portal[] = PORTALS_DATA;
export function getPortals(): Portal[] { return PORTALS_DATA; }

// Active map: for now there's only one. When we add dungeons this becomes
// a per-run selection driven by map transitions.
const ACTIVE_MAP_ID = 'villageruin';
const activeMap = MAP_CATALOG[ACTIVE_MAP_ID];
if (!activeMap) {
  throw new Error(`Map "${ACTIVE_MAP_ID}" not found — expected src/world/data/maps/${ACTIVE_MAP_ID}.json`);
}

export const PLAYER_START = activeMap.spawns['default'] ?? { tileX: 0, tileY: 0 };

// Accept our own HMR updates so edits to the NPC/map JSON files don't
// cascade through the module graph and remount downstream React components
// (the editor specifically — we want it to keep its camera state after a
// save). Game consumers re-read `npcs` at startup so they're unaffected.
//
// Portals are different — the game consults them every frame to decide when
// to teleport, so we need an escape hatch: explicitly accept portals.json
// updates and swap the live array without invalidating the rest of the
// graph. Game reads via getPortals() which returns the latest snapshot.
if (import.meta.hot) {
  import.meta.hot.accept('./portals.json', (updated) => {
    if (!updated) return;
    const fresh = (updated['default'] ?? updated) as PortalsJson;
    PORTALS_DATA = fresh.portals;
    // eslint-disable-next-line no-console
    console.log('[maps] portals.json hot-reloaded — live in the game');
    // Broadcast so the editor (if open on another tab) can pick up external
    // edits and avoid saving stale state on top of them.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('picmon:portals-reloaded', { detail: fresh.portals }));
    }
  });
  import.meta.hot.accept();
}

export function buildNpcsForMap(mapId: string): NpcDef[] {
  const m = MAP_CATALOG[mapId];
  if (!m) return [];
  const out: NpcDef[] = [];
  for (const p of m.placements) {
    const base = NPC_CATALOG[p.npcId];
    if (!base) {
      console.warn(`[maps] placement references unknown npc id "${p.npcId}" on map "${mapId}"`);
      continue;
    }
    out.push({ ...base, tileX: p.tileX, tileY: p.tileY });
  }
  return out;
}

/** Alias kept for the building-interior call site (GameCanvas). */
export const getInteriorNpcs = buildNpcsForMap;

/** Build the animal def list for a map, resolving sprite paths. */
export function buildAnimalsForMap(mapId: string): AnimalDef[] {
  const m = MAP_CATALOG[mapId];
  if (!m || !m.animals) return [];
  return m.animals.map((a) => {
    const { sheet, sprite, spriteJson } = animalSpritePaths(a.type, a.sheet);
    return {
      type: a.type,
      sheet,
      sprite,
      spriteJson,
      tileX: a.tileX,
      tileY: a.tileY,
      wanderTiles: a.wanderTiles,
    };
  });
}

/**
 * Unique (type, sheet) pairs across every map's animals — used by the asset
 * preloader so all animal PNGs+JSONs referenced by any map are in cache
 * before the game hands out control.
 */
export function allAnimalSheetsInCatalog(): Array<{ type: string; sheet: string }> {
  const seen = new Set<string>();
  const out: Array<{ type: string; sheet: string }> = [];
  for (const m of Object.values(MAP_CATALOG)) {
    if (!m.animals) continue;
    for (const a of m.animals) {
      const { sheet } = animalSpritePaths(a.type, a.sheet);
      const key = `${a.type}/${sheet}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ type: a.type, sheet });
    }
  }
  return out;
}

/**
 * Runtime-resolved object placement. Mirrors ObjectPlacement but with
 * every optional defaulted and an image path that's ready to hand to
 * `getImage()`. Per-placement `phaseSeed` is a stable hash (modulo'd at
 * draw time by the actual frame count) so a row of flags out-of-syncs
 * without us recomputing the hash each frame.
 */
export interface ObjectRuntimeDef {
  /** /public-relative path. Use directly with getImage(). */
  image: string;
  tileX: number;
  tileY: number;
  offsetX: number;
  offsetY: number;
  /** Source-pixel frame dimensions (resolved from the objects-manifest). */
  frameW: number;
  frameH: number;
  drawOrder: ObjectDrawOrder;
  blocksPassage: boolean;
  /** Pre-computed animation phase seed. 0 when randomizeFrameStart=false. */
  phaseSeed: number;
}

/** Cheap stable hash of an object's identifying fields → animation phase. */
function objectPhaseSeed(o: ObjectPlacement): number {
  if (o.randomizeFrameStart === false) return 0;
  let h = (o.tileX * 73856093) ^ (o.tileY * 19349663);
  for (let i = 0; i < o.image.length; i++) h = (h * 31 + o.image.charCodeAt(i)) | 0;
  // Drop the sign bit so the modulo at draw time stays nonnegative without
  // an extra `((x % n) + n) % n` dance.
  return h & 0x7fffffff;
}

/** Build the resolved object list for a map. Returns [] when the map has
 *  no objects so callers can iterate unconditionally. */
export function buildObjectsForMap(mapId: string): ObjectRuntimeDef[] {
  const m = MAP_CATALOG[mapId];
  if (!m || !m.objects || m.objects.length === 0) return [];
  return m.objects.map((o) => {
    const { frameW, frameH } = getObjectFrameDims(o.image);
    return {
      image: `world/tilesets/${o.image}`,
      tileX: o.tileX,
      tileY: o.tileY,
      offsetX: o.offsetX ?? 0,
      offsetY: o.offsetY ?? 0,
      frameW,
      frameH,
      drawOrder: o.drawOrder ?? 'under',
      blocksPassage: !!o.blocksPassage,
      phaseSeed: objectPhaseSeed(o),
    };
  });
}

/** Every unique object image path referenced anywhere in MAP_CATALOG. Drives
 *  the asset preloader so getImage() is a cache hit on the first frame
 *  after a map load. */
export function allObjectImagesInCatalog(): string[] {
  const seen = new Set<string>();
  for (const m of Object.values(MAP_CATALOG)) {
    if (!m.objects) continue;
    for (const o of m.objects) seen.add(`world/tilesets/${o.image}`);
  }
  return [...seen];
}

/** Per-image frame dimensions in SOURCE pixels. Populated from the
 *  objects-manifest at preload. Defaults to 16×16 when missing. */
type FrameDims = { frameW: number; frameH: number };
const objectFrameDims = new Map<string, FrameDims>();
export function getObjectFrameDims(image: string): FrameDims {
  return objectFrameDims.get(image) ?? { frameW: 16, frameH: 16 };
}
export function setObjectFrameDims(image: string, dims: FrameDims): void {
  objectFrameDims.set(image, dims);
}

/** Per-folder default collider box (source pixels). Populated at preload
 *  from each `Animated/<folder>/_collider.json` sidecar. The editor also
 *  writes here via its "Set as folder default" button (in addition to
 *  POSTing the sidecar file), so subsequent collider lookups see the new
 *  default immediately without a refresh. */
type ColliderBox = { x: number; y: number; w: number; h: number };
const folderColliderDefaults = new Map<string, ColliderBox>();
/** Folder name for a tileset-relative image path: "Animated/Flag/FlagRed.png" → "Animated/Flag". */
function folderOf(image: string): string {
  const i = image.lastIndexOf('/');
  return i < 0 ? image : image.slice(0, i);
}
export function getObjectFolderDefault(imagePathOrFolder: string): ColliderBox | undefined {
  // Accept either a full "Animated/Flag/FlagRed.png" or just "Animated/Flag".
  const folder = imagePathOrFolder.includes('.') ? folderOf(imagePathOrFolder) : imagePathOrFolder;
  return folderColliderDefaults.get(folder);
}
export function setObjectFolderDefault(folder: string, box: ColliderBox | null): void {
  if (box) folderColliderDefaults.set(folder, box);
  else folderColliderDefaults.delete(folder);
}
export function listObjectFolderDefaults(): Array<{ folder: string; colliderBox: ColliderBox }> {
  return [...folderColliderDefaults.entries()].map(([folder, colliderBox]) => ({ folder, colliderBox }));
}

/** Cached alpha bounding box of an image's first 16×16 frame, in
 *  source-pixel coords. Same trick as the editor's `Blocks player` rect —
 *  cropping the collider to the visible silhouette so a flagpole only
 *  blocks its actual columns. Cache is keyed by image src so multiple
 *  placements of the same flag share one decode. */
type AlphaBox = { x: number; y: number; w: number; h: number } | null;
const alphaBoxCache = new Map<string, AlphaBox>();
function alphaBoxFor(img: HTMLImageElement, src: string, imagePath: string): AlphaBox {
  const cached = alphaBoxCache.get(src);
  if (cached !== undefined) return cached;
  const { frameW: W, frameH: H } = getObjectFrameDims(imagePath);
  try {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const cx = c.getContext('2d', { willReadFrequently: true });
    if (!cx) { alphaBoxCache.set(src, null); return null; }
    cx.drawImage(img, 0, 0, W, H, 0, 0, W, H);
    const data = cx.getImageData(0, 0, W, H).data;
    let minX = W, minY = H, maxX = -1, maxY = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (data[(y * W + x) * 4 + 3]! > 0) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    const out: AlphaBox = maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    alphaBoxCache.set(src, out);
    return out;
  } catch {
    alphaBoxCache.set(src, null);
    return null;
  }
}

/** World-pixel draw rect for an object placement. Anchor is the tile's
 *  center on both axes — sub-tile assets (10×8 flower) sit centered in
 *  their grid square rather than floating in a corner; 16×16 frames are
 *  visually unchanged from the old "top-left at tile origin" anchoring
 *  (the math works out identical). */
export function objectDrawRect(
  tileX: number, tileY: number,
  offsetX: number, offsetY: number,
  frameW: number, frameH: number,
): { dx: number; dy: number; dw: number; dh: number } {
  const k = TILE_SIZE / 16;
  const dw = frameW * k;
  const dh = frameH * k;
  const dx = tileX * TILE_SIZE + TILE_SIZE / 2 - dw / 2 + offsetX * k;
  const dy = tileY * TILE_SIZE + TILE_SIZE / 2 - dh / 2 + offsetY * k;
  return { dx, dy, dw, dh };
}

/** Compute world-pixel AABB blockers for every `blocksPassage` object on
 *  this map. Rect comes from the fallback chain (per-instance custom →
 *  folder default → alpha bbox → full frame) and is positioned via
 *  objectDrawRect so sub-tile assets collide where they actually render. */
export function buildObjectBlockerRectsForMap(
  mapId: string,
  getImg: (src: string) => HTMLImageElement | undefined,
): ObjectBlockerRect[] {
  const m = MAP_CATALOG[mapId];
  if (!m || !m.objects) return [];
  const out: ObjectBlockerRect[] = [];
  const k = TILE_SIZE / 16;
  for (const o of m.objects) {
    if (!o.blocksPassage) continue;
    const src = `world/tilesets/${o.image}`;
    const { frameW, frameH } = getObjectFrameDims(o.image);
    const { dx, dy } = objectDrawRect(o.tileX, o.tileY, o.offsetX ?? 0, o.offsetY ?? 0, frameW, frameH);
    // Fallback chain: per-placement custom → folder default → alpha bbox
    // → full frame. The first three are designer-controllable; the last
    // is a safety net while the image is still decoding.
    const cb =
      o.colliderBox ??
      folderColliderDefaults.get(folderOf(o.image)) ??
      (() => { const img = getImg(src); return img ? alphaBoxFor(img, src, o.image) : null; })();
    if (cb) {
      out.push({ x: dx + cb.x * k, y: dy + cb.y * k, w: cb.w * k, h: cb.h * k });
    } else {
      out.push({ x: dx, y: dy, w: frameW * k, h: frameH * k });
    }
  }
  return out;
}

/** Spawn tile for a named spawn on a map (falls back to `default`, then 0,0). */
export function getSpawn(mapId: string, spawnId: string = 'default'): { tileX: number; tileY: number } {
  const m = MAP_CATALOG[mapId];
  return m?.spawns[spawnId] ?? m?.spawns['default'] ?? { tileX: 0, tileY: 0 };
}

// Legacy: the initial player NPC list for the default starting map. Runtime
// swaps to a fresh list via buildNpcsForMap() on map transitions.
export const npcs: NpcDef[] = buildNpcsForMap(ACTIVE_MAP_ID);
