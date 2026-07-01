import { loadSpritesheet } from './Spritesheet';
import { loadSpriteFusionMap } from '../data/spriteFusionMap';
import { allAnimalSheetsInCatalog, allObjectImagesInCatalog, buildObjectBlockerRectsForMap, getPortals, MAP_CATALOG, NPC_CATALOG, setObjectFolderDefault, setObjectFrameDims } from '../data/maps';
import { RENDERABLE_SIGN_SPRITES, getSignSpritePath } from '../data/worldSigns';

export const VILLAGE_RUIN_MAP_JSON = 'world/maps/villageruin.json';
export const VILLAGE_RUIN_TILESHEET = 'world/maps/villageruin.png';

/** Conventional path helpers — every map's files live at these URLs under /public. */
export const mapJsonPath = (mapId: string) => `world/maps/${mapId}.json`;

/**
 * Some maps share a parent tilesheet instead of shipping their own PNG. The
 * interior_* maps (shop/lab/hospital/house room interiors) all draw from
 * villageruin.png. Without this mapping, `getImage(mapTilesheetPath(id))`
 * would 404 for those and the renderer would show a placeholder.
 */
const SHARED_TILESHEETS: Record<string, string> = {
  // 2026-05-12 — Dev-only desert zone reuses the city's TilesetDesert
  // sprite sheet for the wild area so we ship one PNG instead of two.
  desert_wilds: 'desert_city',
  // 2026-06-02 — Two arena variants are tile-for-tile duplicates of earlier
  // arenas, so they reuse those PNGs instead of shipping their own.
  trainertowerarena2: 'trainertowerarena',
  trainertowerarena3: 'trainertowerarena1',
};
export const mapTilesheetPath = (mapId: string) =>
  `world/maps/${SHARED_TILESHEETS[mapId] ?? mapId}.png`;

// Shared character spritesheet convention from the new asset pack:
//   world/npcs/Character/<Name>/SpriteSheet.{png,json}
// Same grid layout for ~all characters: 4×4 walk block, then attack row,
// jump row, then 4 unique frames.
export const characterSheet = (name: string) => ({
  png: `world/npcs/Character/${name}/SpriteSheet.png`,
  json: `world/npcs/Character/${name}/SpriteSheet.json`,
  faceset: `world/npcs/Character/${name}/Faceset.png`,
});

/** Default player character name. The mirror-sign picker can swap to any
 *  other name in `getAvailableCharacterNames()` at runtime. */
export const DEFAULT_PLAYER_CHARACTER = 'Boy';
const BOY = characterSheet(DEFAULT_PLAYER_CHARACTER);
export const PLAYER_SPRITE_PNG = BOY.png;
export const PLAYER_SPRITE_JSON = BOY.json;

/** Sprite paths (PNG + JSON) for a named character. The mirror picker uses
 *  this when swapping the player skin so the renderer's getImage /
 *  getSpritesheet calls hit the already-preloaded character. */
export const playerSpritePathsFor = (name: string) => {
  const s = characterSheet(name);
  return { png: s.png, json: s.json, faceset: s.faceset };
};

/**
 * Character sheets the overworld needs to preload: the player (always) plus
 * every distinct character referenced by any NPC in the catalog. Derived so
 * picking any character for any NPC via the editor "just works" without
 * having to remember to add its name here.
 */
function deriveCharacterSheets() {
  return getAvailableCharacterNames().map(characterSheet);
}

/** Every character name the overworld has preloaded — the default Boy plus
 *  whichever names are referenced by any NPC in the catalog. The mirror
 *  picker grid renders one Faceset per entry. Ordered with 'Boy' first
 *  (default), then the rest alphabetically so the grid is stable. */
export function getAvailableCharacterNames(): string[] {
  const names = new Set<string>([DEFAULT_PLAYER_CHARACTER]);
  for (const npc of Object.values(NPC_CATALOG)) {
    const m = npc.sprite.match(/\/Character\/([^/]+)\//);
    if (m) names.add(m[1]!);
  }
  const rest = [...names].filter((n) => n !== DEFAULT_PLAYER_CHARACTER).sort();
  return [DEFAULT_PLAYER_CHARACTER, ...rest];
}

/** Animal sheets referenced by any map's `animals` array — PNG + JSON. */
function deriveAnimalSheets() {
  return allAnimalSheetsInCatalog().map(({ type, sheet }) => ({
    png: `world/npcs/Animal/${type}/${sheet}.png`,
    json: `world/npcs/Animal/${type}/${sheet}.json`,
  }));
}

const cache = new Map<string, HTMLImageElement>();

// In-flight loads — any caller asking for the same src while a load is
// already running gets the SAME Image back instead of a new request. Prevents
// the two-preload-passes race (React StrictMode, HMR) from triggering Firefox
// "NS_BINDING_ABORTED" when it collapses duplicate URLs and aborts the first
// one, leaving the cache empty.
const pending = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = cache.get(src);
  if (cached) return Promise.resolve(cached);
  const inFlight = pending.get(src);
  if (inFlight) return inFlight;

  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onerror = (e) => {
      console.warn(`[world/assets] Failed to load image: ${src}`, e);
      reject(new Error(`Failed to load: ${src}`));
    };
    img.onload = () => {
      // Force a full decode before caching. Without this, Firefox can hand
      // us an Image that reports valid naturalWidth/Height (headers parsed)
      // but whose pixel data was never decoded (because the HTTP request
      // got NS_BINDING_ABORTED after the cache hit). drawImage on such an
      // image draws nothing — which we saw as "cave map goes black".
      img.decode().then(
        () => {
          cache.set(src, img);
          resolve(img);
        },
        (err) => {
          console.warn(`[world/assets] decode failed for ${src}:`, err);
          // Fall back to the undecoded image — at worst it still renders
          // blank, but we don't permanently lock callers waiting on decode.
          cache.set(src, img);
          resolve(img);
        },
      );
    };
    img.src = src;
  });
  pending.set(src, p);
  // Clear the pending entry once the load settles. We swallow the rejection
  // here so this housekeeping chain doesn't surface a second "uncaught in
  // promise" for callers that already handled the original rejection.
  p.then(
    () => pending.delete(src),
    () => pending.delete(src),
  );
  return p;
}

export function getImage(src: string): HTMLImageElement | undefined {
  return cache.get(src);
}

// Separate tracking for CDN asset paths — RundotGameAPI.cdn.fetchAsset returns
// a Blob which we convert to an object URL + Image. Kept alongside the main
// image cache so repeated renders hit the Map in O(1).
const cdnAssetCache = new Map<string, HTMLImageElement>();
const cdnAssetPending = new Map<string, Promise<HTMLImageElement | null>>();
const cdnAssetFailed = new Set<string>();

/**
 * Resolve a logical CDN asset path (e.g. "village/foo.png") to an Image,
 * using RundotGameAPI.cdn.fetchAsset when available and falling back to a
 * direct fetch of /cdn/<path> (served by the libraries plugin in dev).
 * Returns null if the asset isn't available anywhere — caller can show a
 * placeholder. Caches success AND terminal failure so we never thrash.
 */
export function loadCdnImage(
  assetPath: string,
  fetchAssetFn?: (p: string) => Promise<Blob>,
): Promise<HTMLImageElement | null> {
  const cached = cdnAssetCache.get(assetPath);
  if (cached) return Promise.resolve(cached);
  if (cdnAssetFailed.has(assetPath)) return Promise.resolve(null);
  const inFlight = cdnAssetPending.get(assetPath);
  if (inFlight) return inFlight;

  const p = (async () => {
    const tryFromBlob = async (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      try {
        const img = await loadImage(url);
        cdnAssetCache.set(assetPath, img);
        return img;
      } finally {
        // Don't revoke — Image may still be decoding on some browsers.
        // Object URLs are tiny compared to the image bytes themselves.
      }
    };

    if (fetchAssetFn) {
      try {
        const blob = await fetchAssetFn(assetPath);
        return await tryFromBlob(blob);
      } catch (err) {
        console.warn(`[world/assets] cdn.fetchAsset('${assetPath}') failed, trying static fallback:`, err);
      }
    }

    try {
      const resp = await fetch(`/cdn/${assetPath}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      return await tryFromBlob(blob);
    } catch (err) {
      console.warn(`[world/assets] static /cdn/${assetPath} failed:`, err);
      cdnAssetFailed.add(assetPath);
      return null;
    }
  })();

  cdnAssetPending.set(assetPath, p);
  p.finally(() => cdnAssetPending.delete(assetPath));
  return p;
}

export function getCdnImage(assetPath: string): HTMLImageElement | undefined {
  return cdnAssetCache.get(assetPath);
}

/**
 * Pull the door image manifest the doors-manifest vite plugin emits at
 * server/build start. Returns full /public-relative paths ready to feed
 * loadImage. Failure is non-fatal — we just preload nothing extra and
 * fall back to the lazy load in renderOverworld.
 */
async function fetchDoorManifest(): Promise<string[]> {
  try {
    const res = await fetch('world/tilesets/doors/_manifest.json');
    if (!res.ok) return [];
    const json = await res.json() as { doors?: unknown };
    if (!Array.isArray(json.doors)) return [];
    return json.doors
      .filter((s): s is string => typeof s === 'string')
      .map((name) => `world/tilesets/doors/${name}`);
  } catch {
    return [];
  }
}

/** Pull the per-image frame dimensions manifest (emitted by the
 *  objects-manifest Vite plugin) into the in-memory map. Without this,
 *  the runtime would assume 16×16 frames for every object PNG and slice
 *  sub-tile sheets (like flower.png at 10×8) incorrectly. Failure is
 *  non-fatal — defaults to 16×16 per image. */
async function loadObjectFrameDims(): Promise<void> {
  try {
    const res = await fetch('world/tilesets/Animated/_manifest.json');
    if (!res.ok) return;
    const { objects } = await res.json() as {
      objects: Array<{ image: string; frameW: number; frameH: number }>;
    };
    for (const o of objects) {
      setObjectFrameDims(o.image, { frameW: o.frameW, frameH: o.frameH });
    }
  } catch {
    // Manifest absent (e.g. very old build) — fall through, defaults
    // to 16×16 which keeps existing flag placements working unchanged.
  }
}

/** Pull per-folder collider defaults from the editor's sidecar files and
 *  install them into the in-memory map. Failure is non-fatal — collider
 *  fallback degrades to the alpha bbox / full tile. */
async function loadObjectFolderDefaults(): Promise<void> {
  try {
    const res = await fetch('/api/editor/list-object-folder-defaults');
    if (!res.ok) return;
    const { defaults } = await res.json() as {
      defaults: Array<{ folder: string; colliderBox: { x: number; y: number; w: number; h: number } }>;
    };
    for (const d of defaults) setObjectFolderDefault(d.folder, d.colliderBox);
  } catch {
    // No dev server endpoint (prod build) — that's fine.
  }
}

export async function preloadAssets(): Promise<void> {
  // Every map we might teleport into. Preload tilesheets + Sprite Fusion data
  // so portal crossings are synchronous. `mapTilesheetPath` handles shared
  // tilesheets (interiors → villageruin.png) so this works uniformly.
  const mapIds = Object.keys(MAP_CATALOG);
  const characterSheets = deriveCharacterSheets();
  const animalSheets = deriveAnimalSheets();

  const images = [
    ...characterSheets.map((s) => s.png),
    ...characterSheets.map((s) => s.faceset),
    ...animalSheets.map((s) => s.png),
    'world/effects/Particle/Grass.png',
    'world/effects/Elemental/Plant/SpriteSheet.png',
    'world/backgrounds/battlebackgrounds1.png',
    'world/backgrounds/battlebg-tower.png',
    // v1.208 — splash backgrounds for the title screen. Two variants,
    // portrait for phones and landscape for desktop, picked at render
    // time by renderTitle based on viewport aspect. Preloading both
    // here means returning players see the full-art splash instantly,
    // not the dark-blue starfield fallback while the image fetches.
    'world/ui/splash.png',
    'world/ui/splash-landscape.png',
    // Every emote — used for talk indicators AND flavor "mood" pops above
    // NPC heads (see Overworld's drawMoodEmotes).
    ...Array.from({ length: 30 }, (_, i) => `world/ui/Emote/emote${i + 1}.png`),
    ...mapIds.map(mapTilesheetPath),
    // Title screen splash — loaded so the pixel-art intro doesn't flash blank.
    'world/ui/splash.png',
    // Door overlays. We preload EVERY door PNG under public/world/tilesets/
    // doors/ (via the build-time _manifest.json the doors-manifest vite
    // plugin emits) plus any door referenced in portals.json. Belt-and-
    // braces: if the manifest is missing in some deploy, we still cover
    // the doors players actually encounter.
    ...Array.from(
      new Set([
        ...(await fetchDoorManifest()),
        ...getPortals()
          .map((p) => p.gate?.doorImage)
          .filter((s): s is string => !!s),
      ]),
    ),
    // World-sign PNGs (interactable signposts placed in maps). The variants
    // are bounded so we preload all of them rather than walking
    // worldSigns.json — if a sign is added in the editor mid-session the
    // sprite is already in cache. RENDERABLE_SIGN_SPRITES skips 'no_sprite'
    // (which has no PNG — it's an invisible interaction marker).
    ...RENDERABLE_SIGN_SPRITES.map(getSignSpritePath),
    // Every decorative object image referenced by any map's `objects` array.
    // Preloading here means buildObjectsForMap()'s `image` paths are
    // already in `cache` on the first frame after a teleport — no first-
    // frame pops while the PNG decodes.
    ...allObjectImagesInCatalog(),
  ];

  const spritesheets = [
    ...characterSheets.map((s) => s.json),
    ...animalSheets.map((s) => s.json),
    'world/effects/Particle/Grass.json',
    'world/effects/Elemental/Plant/SpriteSheet.json',
    'world/backgrounds/battlebackgrounds1.json',
  ];

  const results = await Promise.allSettled([
    ...images.map(loadImage),
    ...spritesheets.map((path) => loadSpritesheet(path)),
    ...mapIds.map((id) => loadSpriteFusionMap(mapJsonPath(id), mapTilesheetPath(id))),
  ]);

  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length > 0) {
    console.warn(`[world/assets] ${failed.length} asset(s) failed to load:`, failed);
  }

  // Per-image frame dimensions need to land BEFORE both folder defaults
  // (because alpha-bbox compute uses the frame size) and blocker rects
  // (which position colliders relative to the resolved draw rect).
  await loadObjectFrameDims();
  // Folder-level collider defaults need to land BEFORE we build blocker
  // rects, otherwise placements without a per-instance colliderBox fall
  // through to the alpha bbox instead of the canonical default.
  await loadObjectFolderDefaults();

  // With every object PNG now in the image cache + folder defaults
  // loaded, populate each map's `objectBlockerRects` so collision picks
  // up `blocksPassage` objects without changing any of the existing call
  // sites. Reuses the cached SFMap created earlier in this pass.
  for (const id of mapIds) {
    const m = await loadSpriteFusionMap(mapJsonPath(id), mapTilesheetPath(id)).catch(() => null);
    if (!m) continue;
    m.objectBlockerRects = buildObjectBlockerRectsForMap(id, getImage);
  }
}
