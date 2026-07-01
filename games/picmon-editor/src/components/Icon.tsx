import { useEffect, useState, type CSSProperties } from 'react';
import type { MonsterType, TypeFamily } from '../data/typeSystem';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import atlas from '../world/tilesets/ui_icons.json';

const ATLAS_URL = '/cdn-assets/ui_icons.png';

/** Friendly identifier → atlas key. Atlas keys may contain spaces or emojis;
 *  these stable identifiers don't, so callers stay clean. */
const NAME_TO_KEY = {
  // Tab / screen
  bag: 'bag',
  picdex: 'picdex',
  achievement: 'achievement',
  help: 'help',
  'settings-cog': 'settings cog',
  'success-check': 'success check',
  world: 'world',
  stardust: 'stardust',
  gift: 'gift',
  crystalball: 'crystalball',
  picmoncard: 'picmoncard',
  create: 'create',
  merge: 'merge',
  shop: 'shop',
  warning: 'warning',
  unliked: 'unliked',
  'liked-hp': 'liked hp',
  'fight-battle': 'fight battle',
  diamond: 'diamond',
  crown: 'crown master',
  toolbox: 'toolbox',
  coin: 'coin',
  'film-basic': 'Basic Film',
  'film-keen': 'Keen Film',
  'film-master': 'Master Film',
  'film-platinum': 'Platinum Film',
  'growth-shards': 'Growth Shards',
  'gacha-pack': 'Gacha Pack',
  // Consumables
  'prismatic-core':    'Prismatic Core',
  'awakening-crystal': 'awakening crystal',
  'pure-crystal':      'pure crystal',
  'luck-charm':        'luck charm',
  'family-prism':      'family prism',
  'scroll-closed':     'closed scroll',
  'scroll-open':       'open scroll',
  'health-potion':     'health potion',
  'super-potion':      'super potion',
  'full-heal':         'full heal',
  tome:                'tome',
  'cross-type-scroll': 'cross type scroll',
  // Misc
  map:                 'map',
  'party-popper':      'party popper',
  cap:                 'cap',
  people:              'people icon',
  discord:             'discord',
  'heart-bandage':     'heart bandage',
  'speaker-high':      'speaker_high',
  'speaker-low':       'speaker_low',
  'speaker-mute':      'speaker_mute',
  // Numbers / glyphs
  hashtag: 'hashtag #',
  one: '1',
  two: '2',
  three: '3',
  zoom: 'zoom 🔍',
  'place-1st': '1st place gold',
  'place-2nd': '2nd place silver',
  'place-3rd': '3rd place bronze',
  // Math / state glyphs
  minus: 'minus -',
  plus: 'plus +',
  x: 'x',
  lightningbolt: 'lightningbolt',
  check: 'check ✓',
  // Battle action / state
  flee: 'flee',
  switch: 'switch',
  lock: 'lock',
  // Element archetype icons
  'arc-thermal': 'fire thermal heat',
  'arc-aquatic': 'aquatic Flow',
  'arc-mineral': 'mineral charge',
  'arc-organic': 'organic growth',
  'arc-electric': 'electric voltage',
  'arc-arcane': 'arcane mana',
  'arc-atmospheric': 'atmospheric pressure',
  // Element types — atlas keys are PascalCase
  fire: 'Fire',
  lava: 'Lava',
  furnace: 'Furnace',
  ember: 'Ember',
  ash: 'Ash',
  water: 'Water',
  ice: 'Ice',
  steam: 'Steam',
  acid: 'Acid',
  mist: 'Mist',
  stone: 'Stone',
  steel: 'Steel',
  crystal: 'Crystal',
  chalk: 'Chalk',
  obsidian: 'Obsidian',
  sand: 'Sand',
  nature: 'Nature',
  fungus: 'Fungus',
  coral: 'Coral',
  venom: 'Venom',
  bone: 'Bone',
  spark: 'Spark',
  magnetic: 'Magnetic',
  plasma: 'Plasma',
  static: 'Static',
  neon: 'Neon',
  shadow: 'Shadow',
  light: 'Light',
  void: 'Void',
  spirit: 'Spirit',
  mirror: 'Mirror',
  stellar: 'Stellar',
  wind: 'Wind',
  thunder: 'Thunder',
  dust: 'Dust',
  cloud: 'Cloud',
  storm: 'Storm',
  // v1.701 — Combat (Trainer Tower). No bespoke atlas frame yet; we
  // reuse the Stone glyph as a temporary visual placeholder so the
  // Icon component renders something instead of blank. Most surfaces
  // use the emoji from TYPE_DISPLAY (👊) anyway — Icon.tsx only
  // matters for the few atlas-backed callsites (collection tab type
  // chip, etc). Generate a real martial.png and swap NAME_TO_KEY +
  // STANDALONE_SRC when art lands.
  martial: 'Stone',
  'arc-combat': 'mineral charge',
} as const satisfies Record<string, string>;

export type IconName = keyof typeof NAME_TO_KEY;

/** Icons that load from a standalone PNG instead of the shared atlas.
 *  Path is relative to the public/ root and served directly in dev and prod.
 *  We prefix with `import.meta.env.BASE_URL` because vite.config.ts sets
 *  `base: './'` — in the deployed bundle that turns `BASE_URL` into `./`,
 *  which resolves correctly against the game's host subpath. A naked
 *  absolute `/world/...` string is NOT rewritten by Vite (only CSS
 *  `url(...)` and `<link>` etc. get the base-prefix treatment), so in
 *  prod it 404s against the host root and the icon renders blank.
 *  v1.547 — fixes the missing Merge tab icon from c217df4. */
const STANDALONE_SRC: Partial<Record<IconName, string>> = {
  merge: `${import.meta.env.BASE_URL}world/ui/theme/merge_icon.png`,
};

interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
}

const FRAMES = atlas.frames as Record<string, AtlasFrame>;

const TYPE_TO_ICON: Record<MonsterType, IconName> = {
  fire: 'fire', lava: 'lava', furnace: 'furnace', ember: 'ember', ash: 'ash',
  water: 'water', ice: 'ice', steam: 'steam', acid: 'acid', mist: 'mist',
  stone: 'stone', steel: 'steel', crystal: 'crystal', chalk: 'chalk', obsidian: 'obsidian', sand: 'sand',
  nature: 'nature', fungus: 'fungus', coral: 'coral', venom: 'venom', bone: 'bone',
  spark: 'spark', magnetic: 'magnetic', plasma: 'plasma', static: 'static', neon: 'neon',
  shadow: 'shadow', light: 'light', void: 'void', spirit: 'spirit', mirror: 'mirror', stellar: 'stellar',
  wind: 'wind', thunder: 'thunder', dust: 'dust', cloud: 'cloud', storm: 'storm',
  // v1.701 — Combat (Trainer Tower). Placeholder maps to the Stone
  // glyph; replace when bespoke martial.png lands.
  martial: 'martial',
};

const FAMILY_TO_ICON: Record<TypeFamily, IconName> = {
  thermal: 'arc-thermal',
  aquatic: 'arc-aquatic',
  mineral: 'arc-mineral',
  organic: 'arc-organic',
  electric: 'arc-electric',
  arcane: 'arc-arcane',
  atmospheric: 'arc-atmospheric',
  combat: 'arc-combat',
};

// ─────────────────────────────────────────────────────────────────────────
// Frame extraction. The atlas has zero inter-frame padding, so any sampling
// at fractional scales would bleed neighboring frames into the rendered icon.
// We pre-extract each frame into its own data URL via canvas, then render
// that isolated image — no neighbors, no bleed.
// ─────────────────────────────────────────────────────────────────────────

let atlasImagePromise: Promise<HTMLImageElement> | null = null;
let atlasImageReady: HTMLImageElement | null = null;
export function loadAtlas(): Promise<HTMLImageElement> {
  if (atlasImagePromise) return atlasImagePromise;
  atlasImagePromise = (async () => {
    const tryLoad = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
    // 2026-05-11 — Skip the static `/cdn-assets/` path in production.
    // It works in dev (Vite serves `public/`) but the prod host
    // (h5-apps.getreel.com) doesn't expose that route, so the
    // attempt always 404s and pollutes the player's DevTools and
    // the error monitor. Prod always goes through the SDK CDN
    // fetcher which IS the canonical path. Dev still tries the
    // static path first because the SDK mock doesn't ship the
    // asset.
    if (import.meta.env.DEV) {
      try { atlasImageReady = await tryLoad(ATLAS_URL); return atlasImageReady; } catch { /* try CDN */ }
    }
    try {
      const blob = await RundotGameAPI.cdn.fetchAsset('ui_icons.png');
      atlasImageReady = await tryLoad(URL.createObjectURL(blob));
      return atlasImageReady;
    } catch { /* try /cdn/ prefix */ }
    try { atlasImageReady = await tryLoad('/cdn/ui_icons.png'); return atlasImageReady; } catch { /* give up */ }
    // Last-ditch fallback: try the static path even in prod, in case
    // a future deploy starts serving it. Better one 404 than no atlas.
    if (!import.meta.env.DEV) {
      try { atlasImageReady = await tryLoad(ATLAS_URL); return atlasImageReady; } catch { /* give up */ }
    }
    throw new Error('Failed to load icon atlas');
  })();
  return atlasImagePromise;
}

/** Synchronous handle for canvas draws — null until the atlas finishes loading. */
export function getAtlasImage(): HTMLImageElement | null {
  return atlasImageReady;
}

/** Frame rect for a named icon. Throws if the name is unknown. */
export function getAtlasFrame(name: IconName): { x: number; y: number; w: number; h: number } {
  return FRAMES[NAME_TO_KEY[name]]!.frame;
}

const dataUrlCache = new Map<IconName, string>();
const inflight = new Map<IconName, Promise<string>>();

function extractFrame(name: IconName): Promise<string> {
  const cached = dataUrlCache.get(name);
  if (cached) return Promise.resolve(cached);
  const pending = inflight.get(name);
  if (pending) return pending;

  const promise = loadAtlas().then((atlasImg) => {
    const frame = FRAMES[NAME_TO_KEY[name]]!.frame;
    const canvas = document.createElement('canvas');
    canvas.width = frame.w;
    canvas.height = frame.h;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(atlasImg, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
    const url = canvas.toDataURL();
    dataUrlCache.set(name, url);
    inflight.delete(name);
    return url;
  });
  inflight.set(name, promise);
  return promise;
}

interface IconProps {
  name: IconName;
  /** Size of the bounding box in pixels. The icon scales to fit while
   *  preserving aspect ratio; the shorter axis is centered with transparent
   *  padding so all icons share a consistent visual footprint. */
  size?: number;
  className?: string;
  title?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 24, className, title, style }: IconProps) {
  const standaloneSrc = STANDALONE_SRC[name];
  const [atlasSrc, setAtlasSrc] = useState<string | null>(() => dataUrlCache.get(name) ?? null);

  useEffect(() => {
    if (standaloneSrc) return; // standalone icons bypass the atlas
    const cached = dataUrlCache.get(name);
    if (cached) {
      setAtlasSrc(cached);
      return;
    }
    let cancelled = false;
    extractFrame(name).then((url) => {
      if (!cancelled) setAtlasSrc(url);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [name, standaloneSrc]);

  let src: string | null;
  let drawW: number;
  let drawH: number;
  if (standaloneSrc) {
    src = standaloneSrc;
    drawW = size;
    drawH = size;
  } else {
    src = atlasSrc;
    const frame = FRAMES[NAME_TO_KEY[name]]!.frame;
    const longest = Math.max(frame.w, frame.h);
    const scale = size / longest;
    drawW = Math.round(frame.w * scale);
    drawH = Math.round(frame.h * scale);
  }

  return (
    <span
      className={`ui-icon ${className ?? ''}`}
      title={title}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      {src && (
        <img
          src={src}
          width={drawW}
          height={drawH}
          alt=""
          aria-hidden
          style={{ imageRendering: 'pixelated', display: 'block' }}
        />
      )}
    </span>
  );
}

interface TypeIconProps {
  type: MonsterType;
  size?: number;
  className?: string;
  title?: string;
  style?: CSSProperties;
}

export function TypeIcon({ type, size, className, title, style }: TypeIconProps) {
  return <Icon name={TYPE_TO_ICON[type]} size={size} className={className} title={title} style={style} />;
}

interface ArchetypeIconProps {
  family: TypeFamily;
  size?: number;
  className?: string;
  title?: string;
  style?: CSSProperties;
}

export function ArchetypeIcon({ family, size, className, title, style }: ArchetypeIconProps) {
  return <Icon name={FAMILY_TO_ICON[family]} size={size} className={className} title={title} style={style} />;
}
