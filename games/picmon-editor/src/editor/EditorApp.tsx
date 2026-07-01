import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { animalSpritePaths, MAP_CATALOG, NPC_CATALOG, PORTALS, type AnimalPlacement, type ObjectDrawOrder, type ObjectPlacement, type Portal, type PortalGate, type PortalHalf } from '../world/data/maps';
import { loadSpriteFusionMap, tileSrcXY, isTallGrassAt, type SFMap } from '../world/data/spriteFusionMap';
import { mapJsonPath, mapTilesheetPath } from '../world/engine/assets';
import { TILE_SIZE, type TrainerMonSpec, type Direction } from '../world/engine/types';
import { loadSpritesheet, resolveFrame, type SpritesheetData } from '../world/engine/Spritesheet';
import { SIGN_SPRITES, RENDERABLE_SIGN_SPRITES, WORLD_SIGN_KINDS, getSignSpritePath, getSignWidth, type WorldSignDef, type WorldSignKind, type WorldSignSprite } from '../world/data/worldSigns';
import { ALL_TYPES } from '../data/typeSystem';
import { RARITY_ORDER } from '../types/card';
import { TRAINER_MON_CATALOG, type TrainerMonCatalogEntry } from '../world/data/trainerMonCatalog';
import { getGrassPatches } from '../world/systems/grassPatches';
import { BG_FRAME_NAMES, BG_FALLBACK_FRAME, STANDALONE_BG_FRAMES, type BgFrameName } from '../utils/mapBattleBackgroundStore';
import { PlayCanvas } from './PlayCanvas';

const DEFAULT_MAP_ID = 'villageruin';
// Minimap is scaled by an INTEGER number of pixels-per-tile so every source
// tile lands on whole minimap pixels (no aliasing / moiré). This target is
// the longest-side budget in pixels; the exact size is W*K × H*K where
// K = floor(MINIMAP_TARGET / max(W, H)), clamped to [1, 8].
const MINIMAP_TARGET = 240;
// Zoom levels where TILE_SIZE * zoom is an integer — tiles render flush
// with no seams at any of these. Some (33 / 67 / 100 / 133 / …) are also
// strictly pixel-perfect (every source pixel same screen size); the rest
// (25 / 50 / 75 / 125 / 150 / …) have slight within-tile unevenness but
// look clean at the map level. This gives a familiar 25%-stepped ladder
// plus the pixel-perfect thirds in the high-detail band.
const CLEAN_ZOOMS = [
  0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1, 1.25, 4 / 3, 1.5, 5 / 3, 1.75, 2, 2.5, 3,
];

function stepCleanZoom(current: number, dir: 'in' | 'out') {
  if (dir === 'in') {
    for (const z of CLEAN_ZOOMS) if (z > current + 1e-4) return z;
    return CLEAN_ZOOMS[CLEAN_ZOOMS.length - 1]!;
  }
  for (let i = CLEAN_ZOOMS.length - 1; i >= 0; i--) {
    const z = CLEAN_ZOOMS[i]!;
    if (z < current - 1e-4) return z;
  }
  return CLEAN_ZOOMS[0]!;
}

// Stable key for each selectable item.
type SelKey = string;
//   'npc:<id>'
//   'animal:<index>'               — decorative animal at this index in the
//                                    map's animals[] array. Not stable across
//                                    deletions, but editor selection doesn't
//                                    need to survive that.
//   'spawn'                        — default spawn
//   'portal-rect:<portalId>:a|b'   — a portal half's trigger box
//   'portal-spawn:<portalId>:a|b'  — the arrival tile for that half
const npcKey = (id: string) => `npc:${id}`;
const animalKey = (index: number) => `animal:${index}`;
const SPAWN_KEY = 'spawn';
const portalRectKey = (id: string, side: 'a' | 'b') => `portal-rect:${id}:${side}`;
const portalSpawnKey = (id: string, side: 'a' | 'b') => `portal-spawn:${id}:${side}`;
//   'grass:<signTx>,<signTy>' — tall-grass patch keyed by its sign anchor
//                              (upper-left tile of the patch's bbox).
const grassKey = (tx: number, ty: number) => `grass:${tx},${ty}`;
//   'sign:<id>' — interactable world sign placed via the Signs sidebar.
const signKey = (id: string) => `sign:${id}`;
//   'object:<index>' — decorative object (flag, etc.) placed via the
//                      Objects sidebar. Same index-based caveat as animals.
const objectKey = (index: number) => `object:${index}`;

const OBJECT_DRAW_ORDER_OPTIONS: Array<{ value: ObjectDrawOrder; label: string }> = [
  { value: 'under',   label: 'Under' },
  { value: 'sort',    label: 'Sort with player' },
  { value: 'overlay', label: 'Overlay' },
];

/** Allocate the next unused sign id matching `sign-N`. Keeps the JSON
 *  readable and lets multiple maps share an id namespace. */
function newSignId(existing: WorldSignDef[]): string {
  for (let i = 1; i < 10000; i++) {
    const id = `sign-${i}`;
    if (!existing.some((s) => s.id === id)) return id;
  }
  return `sign-${Date.now()}`;
}

/** Frame coords on battlebackgrounds1.png (matches the JSON sidecar).
 *  Standalone frames (e.g. 'tower' in v1.696) live in their own PNG and
 *  do not have coordinates on the packed sheet; FrameThumb special-cases
 *  them via STANDALONE_BG_FRAMES rather than looking up this table. */
const BG_FRAME_COORDS: Record<BgFrameName, { x: number; y: number }> = {
  town: { x: 0, y: 0 },
  dojo: { x: 341, y: 0 },
  villageruin: { x: 683, y: 0 },
  desert: { x: 0, y: 341 },
  cave: { x: 341, y: 341 },
  fencepath: { x: 683, y: 341 },
  forest: { x: 0, y: 683 },
  snowtown: { x: 341, y: 683 },
  tower: { x: 0, y: 0 },
};
const BG_SHEET_URL = '/world/backgrounds/battlebackgrounds1.png';
const BG_SHEET_PX = 1024;
const BG_FRAME_PX = 341;
/** Default roam range (in tiles) for newly-placed animals. The editor
 *  exposes a per-animal input that starts here. */
const DEFAULT_ANIMAL_WANDER_TILES = 3;
/** Max characters that reliably fit in one in-game dialogue window before
 *  the text overflows the container. Measured against the longest line that
 *  still renders cleanly. The editor shows a per-line counter that warns as
 *  a dialogue line approaches (amber) or exceeds (red) this budget. */
const DIALOGUE_MAX_CHARS = 116;
/** Greedily word-wrap one dialogue string into multiple lines that each fit
 *  within `max` chars, breaking only at spaces. A single word longer than
 *  `max` is left on its own (still-too-long) line rather than hard-split, so
 *  no token gets mangled. Used by the editor's per-line "split" button to
 *  reflow an over-length line into several fitting dialogue windows. */
function wrapDialogueLine(text: string, max: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= max) cur += ' ' + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
// Clone so edits don't mutate the imported JSON module. Include every field
// on PortalHalf or the editor will silently drop data — `facing` in particular
// was getting stripped, which made the N/S/E/W dropdown appear to reset.
const clonePortals = (ps: Portal[]): Portal[] =>
  ps.map((p) => ({
    id: p.id,
    a: { mapId: p.a.mapId, rect: { ...p.a.rect }, spawn: { ...p.a.spawn }, facing: p.a.facing },
    b: { mapId: p.b.mapId, rect: { ...p.b.rect }, spawn: { ...p.b.spawn }, facing: p.b.facing },
    ...(p.gate ? {
      gate: {
        fromMapId: p.gate.fromMapId,
        requiredTrainerDefeats: [...p.gate.requiredTrainerDefeats],
        // eventId + adminOnly aren't editable in the gate panel, but they're
        // load-bearing at runtime (event-window gating / dev-only zone hiding).
        // Carry them through the clone so a portal save doesn't silently drop
        // them — the editor previously stripped `eventId` from the desert gate.
        ...(p.gate.eventId !== undefined ? { eventId: p.gate.eventId } : {}),
        ...(p.gate.adminOnly !== undefined ? { adminOnly: p.gate.adminOnly } : {}),
        ...(p.gate.blockedMessage !== undefined ? { blockedMessage: p.gate.blockedMessage } : {}),
        ...(p.gate.doorImage !== undefined ? { doorImage: p.gate.doorImage } : {}),
      },
    } : {}),
  }));
function newPortalId(existing: Portal[]): string {
  for (let i = 1; i < 10000; i++) {
    const id = `portal-${i}`;
    if (!existing.some((p) => p.id === id)) return id;
  }
  return `portal-${Date.now()}`;
}

/** Slugify a friendly NPC name into the id-safe charset (`^[a-z0-9-]+$`).
 *  Returns "npc" if the name has no usable characters (all symbols). */
function slugifyNpcName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'npc';
}

/** Generate a unique NPC id from a friendly name by slugifying it and
 *  appending a base36 time seed — so the user only ever types a name (which
 *  becomes the in-game `name`) and never has to invent a unique id. `taken`
 *  guards the astronomically-unlikely same-millisecond collision. */
function newNpcId(name: string, taken: (id: string) => boolean): string {
  const base = slugifyNpcName(name);
  const seed = Date.now().toString(36);
  let id = `${base}-${seed}`;
  for (let i = 2; taken(id); i++) id = `${base}-${seed}-${i}`;
  return id;
}

interface Placement { npcId: string; tileX: number; tileY: number }
interface SpawnPoint { tileX: number; tileY: number }
interface TileCoord { tileX: number; tileY: number }
interface CharacterInfo { name: string; limited: boolean }
/** Species + sheet variants as served by /api/editor/list-animals. */
interface AnimalSpeciesInfo { type: string; sheets: string[] }
interface NpcDraft {
  character: string;
  name: string;
  dialogue: string[];
  /** When present (non-empty) this NPC triggers a battle after dialogue. */
  trainerParty?: TrainerMonSpec[];
  trainerReward?: number;
  /** NOTE: unused at runtime — nothing reads this when a trainer battle
   *  starts, so its editor input is hidden (see the trainer section JSX).
   *  Kept on the draft only to load + round-trip existing on-disk values so
   *  a save doesn't silently wipe them. */
  preBattleLine?: string;
  postDefeatDialogue?: string[];
  /** Emote file basenames (e.g. "emote7") that pop above the NPC's head
   *  randomly while idling. */
  moodEmotes?: string[];
  /** When true, the NPC stays rooted to its spawn tile (engine skips the
   *  random wander step). Mood emotes still tick. */
  stationary?: boolean;
  /** Locks facing to a fixed direction (engine skips idle look-around).
   *  Unset = the NPC turns to look around. See NpcDef.faceDirection. */
  faceDirection?: Direction;
  /** Trainer ids that must be defeated before this battle will trigger.
   *  When unmet the runtime shows `prereqBlockedMessage` (or a default). */
  requiredTrainerDefeats?: string[];
  prereqBlockedMessage?: string;
  /** When true, the NPC physically blocks the tile until defeated. */
  blocksPassage?: boolean;
  /** Map this NPC belongs to — used by the editor's placement picker as a
   *  filter and by some runtime gating. */
  homeMapId?: string;
}

/** Labels for the flavor-emote picker — keep in sync with the files in
 *  public/world/ui/Emote/. */
const EMOTE_LABELS: Record<string, string> = {
  emote1: 'surprise', emote2: 'happy menace', emote3: 'knocked out', emote4: 'angry',
  emote5: 'confused', emote6: 'dumb happy', emote7: 'raised eyebrow', emote8: 'wink',
  emote9: 'dumb annoyed', emote10: 'annoyed', emote11: 'happy', emote12: 'cat face',
  emote13: 'sad', emote14: 'head empty', emote15: 'paralyzed', emote16: 'super sad',
  emote17: 'depressed', emote18: 'satisfied', emote19: 'sour', emote20: '...',
  emote21: '!', emote22: '! (red)', emote23: '?', emote24: 'person',
  emote25: '? (red)', emote26: 'broken heart', emote27: 'heart', emote28: 'Zzzz',
  emote29: 'star', emote30: 'cross',
};
const EMOTE_BASENAMES = Array.from({ length: 30 }, (_, i) => `emote${i + 1}`);

/** Extract the character folder name from an NPC sprite path. */
function characterOfNpc(npcId: string): string {
  const sprite = NPC_CATALOG[npcId]?.sprite ?? '';
  const m = sprite.match(/\/Character\/([^/]+)\//);
  return m?.[1] ?? '';
}

/** Build an editable draft from whatever's in NPC_CATALOG right now. */
function draftFromCatalog(npcId: string): NpcDraft {
  const n = NPC_CATALOG[npcId];
  return {
    character: characterOfNpc(npcId),
    name: n?.name ?? npcId,
    dialogue: n?.dialogue ? [...n.dialogue] : [],
    ...(n?.trainerParty ? { trainerParty: n.trainerParty.map((m) => ({ ...m })) } : {}),
    ...(n?.trainerReward !== undefined ? { trainerReward: n.trainerReward } : {}),
    ...(n?.preBattleLine ? { preBattleLine: n.preBattleLine } : {}),
    ...(n?.postDefeatDialogue ? { postDefeatDialogue: [...n.postDefeatDialogue] } : {}),
    ...(n?.moodEmotes ? { moodEmotes: [...n.moodEmotes] } : {}),
    ...(n?.stationary ? { stationary: true } : {}),
    ...(n?.faceDirection ? { faceDirection: n.faceDirection } : {}),
    ...(n?.requiredTrainerDefeats && n.requiredTrainerDefeats.length > 0
      ? { requiredTrainerDefeats: [...n.requiredTrainerDefeats] }
      : {}),
    ...(n?.prereqBlockedMessage ? { prereqBlockedMessage: n.prereqBlockedMessage } : {}),
    ...(n?.blocksPassage ? { blocksPassage: true } : {}),
    ...(n?.homeMapId ? { homeMapId: n.homeMapId } : {}),
  };
}

/** All NPC ids that are trainers — for the prerequisite picker. Mirrors the
 *  list the portal-gate editor builds, computed once from the static catalog. */
const ALL_TRAINER_IDS = Object.values(NPC_CATALOG)
  .filter((n) => Array.isArray(n.trainerParty) && n.trainerParty.length > 0)
  .map((n) => n.id)
  .sort();

/** Curated trainer-mon catalog grouped by rarity for the <optgroup> picker.
 *  Within a rarity the entries are name-sorted so they're easy to scan. */
const TRAINER_CATALOG_BY_RARITY: Record<string, TrainerMonCatalogEntry[]> = {};
for (const e of Object.values(TRAINER_MON_CATALOG)) {
  (TRAINER_CATALOG_BY_RARITY[e.rarity] ??= []).push(e);
}
for (const list of Object.values(TRAINER_CATALOG_BY_RARITY)) {
  list.sort((a, b) => a.name.localeCompare(b.name));
}

const TM_INPUT: CSSProperties = {
  background: '#111', color: '#eee', border: '1px solid #444',
  borderRadius: 3, padding: '2px 4px', fontSize: 10,
  // minWidth + border-box so inputs/selects shrink with the sidebar instead
  // of overflowing past its right edge (text inputs carry an intrinsic
  // min-width from their `size` attribute).
  minWidth: 0, boxSizing: 'border-box',
};

/** "Set all to Lv N" helper with a visible Set button (Enter also works).
 *  Local state so typing a multi-digit level doesn't apply intermediate
 *  values on every keystroke. */
function BulkLevelControl({ onApply }: { onApply: (lv: number) => void }) {
  const [val, setVal] = useState('');
  const apply = () => {
    const v = Math.max(1, parseInt(val, 10) || 0);
    if (v >= 1) { onApply(v); setVal(''); }
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#aaa' }}>
      <span>Set all to Lv</span>
      <input
        type="number"
        min={1}
        placeholder="?"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') apply(); }}
        style={{ width: 44, ...TM_INPUT, textAlign: 'center', fontSize: 11 }}
        title="Type a level and press Enter (or click Set) to apply it to every mon in this party"
      />
      <button
        onClick={apply}
        style={{ ...TM_INPUT, cursor: 'pointer', padding: '2px 8px', fontSize: 10 }}
      >Set</button>
    </div>
  );
}

/** One trainer-party slot. Either references a curated catalog mon (stable
 *  art/stats via `specId`) or is a "custom" wild-pool mon defined purely by
 *  element/rarity/level. Picking a catalog mon syncs element/rarity to it and
 *  locks those selects; choosing "custom" frees them and clears `specId`. */
function TrainerPartyMember({ mon, index, onChange, onRemove }: {
  mon: TrainerMonSpec;
  index: number;
  onChange: (next: TrainerMonSpec) => void;
  onRemove: () => void;
}) {
  const entry = mon.specId ? TRAINER_MON_CATALOG[mon.specId] : undefined;
  const missingSpec = !!mon.specId && !entry;
  const previewUrl = mon.imageUrl ?? entry?.imageUrl;
  return (
    <div style={{ display: 'flex', gap: 6, padding: 6, marginBottom: 6, background: '#161616', border: '1px solid #3a2a2a', borderRadius: 4 }}>
      <div style={{
        width: 46, height: 46, flexShrink: 0, borderRadius: 3, background: '#000',
        border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}>
        {previewUrl
          ? <img src={previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
          : <span style={{ fontSize: 9, color: '#666', textAlign: 'center', lineHeight: 1.2 }}>wild<br />pool</span>}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: '#777', width: 20, flexShrink: 0 }}>#{index + 1}</span>
          <select
            value={mon.specId ?? ''}
            onChange={(e) => {
              const id = e.target.value || undefined;
              if (!id) {
                // Back to a custom wild-pool mon: keep element/rarity/level/name,
                // drop the catalog reference and its art.
                onChange({ ...mon, specId: undefined, imageUrl: undefined });
              } else {
                const ce = TRAINER_MON_CATALOG[id]!;
                // Catalog dictates element/rarity at battle time, so mirror them
                // into the spec for consistent display + JSON.
                onChange({
                  ...mon,
                  specId: id,
                  element: ce.element as TrainerMonSpec['element'],
                  rarity: ce.rarity,
                  imageUrl: undefined,
                });
              }
            }}
            style={{ flex: 1, minWidth: 0, ...TM_INPUT }}
            title="Pick a curated trainer mon (stable art + stats) or leave as a custom wild-pool mon"
          >
            <option value="">— custom (wild pool) —</option>
            {missingSpec && <option value={mon.specId}>{mon.specId} (missing)</option>}
            {RARITY_ORDER.filter((r) => TRAINER_CATALOG_BY_RARITY[r]?.length).map((r) => (
              <optgroup key={r} label={r}>
                {TRAINER_CATALOG_BY_RARITY[r]!.map((ce) => (
                  <option key={ce.id} value={ce.id}>{ce.name} · {ce.element}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            onClick={onRemove}
            title="Remove mon"
            style={{ ...TM_INPUT, cursor: 'pointer', padding: '0 6px' }}
          >×</button>
        </div>
        <input
          placeholder={entry ? entry.name : 'display name (optional)'}
          value={mon.name ?? ''}
          onChange={(e) => onChange({ ...mon, name: e.target.value || undefined })}
          style={TM_INPUT}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 52px', gap: 4, minWidth: 0 }}>
          <select
            value={mon.element}
            disabled={!!entry}
            title={entry ? 'Element is set by the catalog mon. Switch to "custom" to change it.' : 'Element'}
            onChange={(e) => onChange({ ...mon, element: e.target.value as TrainerMonSpec['element'], specId: undefined, imageUrl: undefined })}
            style={{ ...TM_INPUT, minWidth: 0, opacity: entry ? 0.55 : 1 }}
          >
            {ALL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={mon.rarity}
            disabled={!!entry}
            title={entry ? 'Rarity is set by the catalog mon. Switch to "custom" to change it.' : 'Rarity'}
            onChange={(e) => onChange({ ...mon, rarity: e.target.value as TrainerMonSpec['rarity'], specId: undefined, imageUrl: undefined })}
            style={{ ...TM_INPUT, minWidth: 0, opacity: entry ? 0.55 : 1 }}
          >
            {RARITY_ORDER.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <input
            type="number"
            min={1}
            value={mon.level}
            title="Level (always authoritative, even for catalog mons)"
            onChange={(e) => onChange({ ...mon, level: Math.max(1, parseInt(e.target.value, 10) || 1) })}
            style={{ ...TM_INPUT, minWidth: 0, background: '#1a1408', color: '#ffd166', border: '1px solid #5c4a1a', textAlign: 'center', fontWeight: 600, fontSize: 11 }}
          />
        </div>
        {entry && (
          <div style={{ fontSize: 9, color: '#7a9a6a', whiteSpace: 'normal', wordBreak: 'break-word' }}>
            catalog · HP {entry.stats.hp} ATK {entry.stats.atk} DEF {entry.stats.def} SPD {entry.stats.spd}
          </div>
        )}
        {missingSpec && (
          <div style={{ fontSize: 9, color: '#f66' }}>unknown specId — runtime falls back to wild pool</div>
        )}
      </div>
    </div>
  );
}

// Pointer interaction: moving a group, drawing a selection box, resizing a
// portal rect by one of its corners, panning, or nothing.
type PortalCorner = 'nw' | 'ne' | 'sw' | 'se';
type BlockerHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move';
type Interaction =
  | { kind: 'move'; startTile: TileCoord; originals: Record<SelKey, TileCoord> }
  | { kind: 'box'; startTile: TileCoord; endTile: TileCoord; preSelection: Set<SelKey> }
  | { kind: 'resize'; portalId: string; side: 'a' | 'b'; corner: PortalCorner;
      startTile: TileCoord; origRect: { tileX: number; tileY: number; w: number; h: number } }
  | { kind: 'pan' }
  // Drag a corner/edge handle (or interior) of an object's collider box.
  // Dimensions are source pixels (0..16). Snap to integer on commit so
  // the JSON stays minimal and consistent with the editor's pixel grid.
  | { kind: 'collider'; objectIndex: number; handle: BlockerHandle;
      startSrcX: number; startSrcY: number;
      origBox: { x: number; y: number; w: number; h: number } }
  | null;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

/** Compute the alpha bounding box of an image's first frame. Frame
 *  dimensions come from the per-image catalog (defaults to 16×16). Null
 *  = fully transparent first frame; callers fall back to the full frame.
 *  Used to auto-crop collision rects to the visible silhouette so a
 *  flagpole only blocks its actual columns. */
function computeFirstFrameAlphaBBox(img: HTMLImageElement, frameW: number, frameH: number): { x: number; y: number; w: number; h: number } | null {
  try {
    const c = document.createElement('canvas');
    c.width = frameW; c.height = frameH;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, frameW, frameH, 0, 0, frameW, frameH);
    const data = ctx.getImageData(0, 0, frameW, frameH).data;
    let minX = frameW, minY = frameH, maxX = -1, maxY = -1;
    for (let y = 0; y < frameH; y++) {
      for (let x = 0; x < frameW; x++) {
        if (data[(y * frameW + x) * 4 + 3]! > 0) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  } catch {
    return null;
  }
}

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

/**
 * Small number input that lets the user backspace / clear the field while
 * editing. Commits the parsed value when it's valid and in range; clamps
 * to [min, max] on blur. Without this, `value={n}` + onChange forcing
 * `parseInt(...) || min` makes the field unclearable — you had to highlight
 * and type over every change.
 */
function NumberInput({
  value, onCommit, min = 1, max = 99, style,
}: {
  value: number;
  onCommit: (n: number) => void;
  min?: number;
  max?: number;
  style?: React.CSSProperties;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);
  return (
    <input
      type="number" min={min} max={max}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseInt(e.target.value);
        if (!isNaN(n) && n >= min && n <= max) onCommit(n);
      }}
      onBlur={() => {
        const n = parseInt(text);
        const clamped = isNaN(n) || n < min ? min : n > max ? max : n;
        setText(String(clamped));
        if (clamped !== value) onCommit(clamped);
      }}
      style={style}
    />
  );
}

/** Tiny CSS-cropped thumbnail of one frame from battlebackgrounds1.png.
 *  Standalone frames (v1.696 'tower') render their own full PNG instead
 *  of cropping the packed sheet. */
function FrameThumb({ frame, size }: { frame: BgFrameName; size: number }) {
  const standalone = STANDALONE_BG_FRAMES[frame];
  if (standalone) {
    return (
      <div
        title={frame}
        style={{
          width: size,
          height: size,
          backgroundImage: `url(/${standalone})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          imageRendering: 'pixelated',
          borderRadius: 4,
          border: '1px solid #444',
          flexShrink: 0,
        }}
      />
    );
  }
  const c = BG_FRAME_COORDS[frame];
  const scale = size / BG_FRAME_PX;
  return (
    <div
      title={frame}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${BG_SHEET_URL})`,
        backgroundPosition: `-${c.x * scale}px -${c.y * scale}px`,
        backgroundSize: `${BG_SHEET_PX * scale}px ${BG_SHEET_PX * scale}px`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        borderRadius: 4,
        border: '1px solid #444',
        flexShrink: 0,
      }}
    />
  );
}

/**
 * Frame picker: <select> + thumbnail of the chosen frame. `value=undefined`
 * means "inherit" (map default for patch overrides; forest fallback for the
 * map default itself). Pass `inheritLabel` to control what shows when value
 * is undefined.
 */
function FramePicker({
  value,
  onChange,
  inheritLabel,
}: {
  value: BgFrameName | undefined;
  onChange: (v: BgFrameName | undefined) => void;
  inheritLabel: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <FrameThumb frame={value ?? BG_FALLBACK_FRAME} size={42} />
      <select
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? undefined : (v as BgFrameName));
        }}
        style={{
          flex: 1, padding: '4px 6px',
          background: '#1a1a1a', color: '#eee',
          border: '1px solid #444', borderRadius: 4, fontSize: 12,
        }}
      >
        <option value="">{inheritLabel}</option>
        {BG_FRAME_NAMES.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </div>
  );
}

/**
 * Editor for a portal's optional quest gate. Lets you pick which side
 * gets blocked, the trainers that have to be defeated, the toast text,
 * and an optional door overlay image. Passing `null` to onChange clears
 * the gate so the field is dropped from the saved JSON.
 *
 * Trainer ids come from NPC_CATALOG entries with a non-empty trainerParty.
 */
function PortalGateEditor({
  portal,
  onChange,
}: {
  portal: Portal;
  onChange: (g: PortalGate | null) => void;
}) {
  const trainerIds = useMemo(
    () =>
      Object.values(NPC_CATALOG)
        .filter((n) => Array.isArray(n.trainerParty) && n.trainerParty.length > 0)
        .map((n) => n.id)
        .sort(),
    [],
  );
  // Door images live under public/world/tilesets/doors/ — fetched from a
  // dev-only endpoint so the dropdown stays in sync with whatever PNGs
  // are on disk. We hold an empty list while the request is in flight.
  const [doorOptions, setDoorOptions] = useState<Array<{ name: string; path: string }>>([]);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/editor/list-doors')
      .then((r) => (r.ok ? r.json() : { doors: [] }))
      .then((data) => {
        if (!cancelled) setDoorOptions(Array.isArray(data?.doors) ? data.doors : []);
      })
      .catch(() => { if (!cancelled) setDoorOptions([]); });
    return () => { cancelled = true; };
  }, []);
  const sides: Array<{ value: string; label: string }> = [
    { value: portal.a.mapId, label: `Block from ${portal.a.mapId} (A)` },
    { value: portal.b.mapId, label: `Block from ${portal.b.mapId} (B)` },
  ];
  const g = portal.gate;
  const enabled = !!g;
  return (
    <div
      style={{
        marginTop: 6,
        padding: '6px 8px',
        background: '#1f1f1f',
        border: '1px solid #333',
        borderRadius: 3,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ color: '#9cf', fontWeight: 'bold', fontSize: 11 }}>Quest Gate</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#aaa', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              if (!e.target.checked) {
                onChange(null);
                return;
              }
              onChange({
                fromMapId: portal.a.mapId,
                requiredTrainerDefeats: [],
              });
            }}
          />
          enabled
        </label>
      </div>
      {enabled && g && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <label style={{ color: '#888', fontSize: 10, minWidth: 50 }}>side</label>
            <select
              value={g.fromMapId}
              onChange={(e) => onChange({ ...g, fromMapId: e.target.value })}
              style={{
                flex: 1, background: '#1a1a1a', color: '#ddd',
                border: '1px solid #444', borderRadius: 3, fontSize: 10, padding: '1px 4px',
              }}
            >
              {sides.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
            <label style={{ color: '#888', fontSize: 10, minWidth: 50, marginTop: 2 }}>defeat</label>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {g.requiredTrainerDefeats.map((tid, i) => (
                <div key={i} style={{ display: 'flex', gap: 3 }}>
                  <select
                    value={tid}
                    onChange={(e) => {
                      const next = [...g.requiredTrainerDefeats];
                      next[i] = e.target.value;
                      onChange({ ...g, requiredTrainerDefeats: next });
                    }}
                    style={{
                      flex: 1, background: '#1a1a1a', color: '#ddd',
                      border: '1px solid #444', borderRadius: 3, fontSize: 10, padding: '1px 4px',
                    }}
                  >
                    {!trainerIds.includes(tid) && <option value={tid}>{tid} (missing)</option>}
                    {trainerIds.map((id) => (<option key={id} value={id}>{id}</option>))}
                  </select>
                  <button
                    onClick={() => {
                      const next = g.requiredTrainerDefeats.filter((_, j) => j !== i);
                      onChange({ ...g, requiredTrainerDefeats: next });
                    }}
                    title="Remove"
                    style={{
                      padding: '0 6px', fontSize: 10, background: '#3a1f1f', color: '#f66',
                      border: '1px solid #5a2a2a', borderRadius: 3, cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const first = trainerIds.find((id) => !g.requiredTrainerDefeats.includes(id)) ?? trainerIds[0];
                  if (!first) return;
                  onChange({ ...g, requiredTrainerDefeats: [...g.requiredTrainerDefeats, first] });
                }}
                disabled={trainerIds.length === 0}
                style={{
                  padding: '2px 6px', fontSize: 10, background: '#1e3a4a', color: '#9cf',
                  border: '1px solid #355', borderRadius: 3, cursor: trainerIds.length === 0 ? 'not-allowed' : 'pointer',
                  alignSelf: 'flex-start',
                }}
              >
                + trainer
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
            <label style={{ color: '#888', fontSize: 10, minWidth: 50, marginTop: 2 }}>message</label>
            <textarea
              value={g.blockedMessage ?? ''}
              onChange={(e) => onChange({ ...g, blockedMessage: e.target.value || undefined })}
              placeholder="Toast shown when blocked"
              rows={2}
              style={{
                flex: 1, background: '#1a1a1a', color: '#ddd',
                border: '1px solid #444', borderRadius: 3, fontSize: 10, padding: '2px 4px',
                resize: 'vertical', fontFamily: 'inherit',
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <label style={{ color: '#888', fontSize: 10, minWidth: 50 }}>door</label>
            <select
              value={g.doorImage ?? ''}
              onChange={(e) => onChange({ ...g, doorImage: e.target.value || undefined })}
              style={{
                flex: 1, background: '#1a1a1a', color: '#ddd',
                border: '1px solid #444', borderRadius: 3, fontSize: 10, padding: '1px 4px',
              }}
            >
              <option value="">(none — block but no overlay)</option>
              {/* If the saved path isn't in the listed folder yet, keep it as
                   an option so we don't silently drop it on save. */}
              {g.doorImage && !doorOptions.some((d) => d.path === g.doorImage) && (
                <option value={g.doorImage}>{g.doorImage} (missing)</option>
              )}
              {doorOptions.map((d) => (
                <option key={d.path} value={d.path}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

export function EditorApp() {
  const [map, setMap] = useState<SFMap | null>(null);
  const [tilesheet, setTilesheet] = useState<HTMLImageElement | null>(null);
  const [npcImages, setNpcImages] = useState<Record<string, HTMLImageElement>>({});
  // JSON atlases for NPC sheets, keyed by spriteJson path. Only needed to
  // preview a facing-locked NPC in the correct stand frame (the packed atlas
  // isn't a fixed grid, so we must read frame coords from the sheet).
  const [npcSheets, setNpcSheets] = useState<Record<string, SpritesheetData>>({});
  const [error, setError] = useState<string | null>(null);

  // ── In-app dialog system ──
  // Replaces window.prompt / window.confirm / window.alert because the
  // Cursor IDE's embedded browser SUPPRESSES all native dialogs (visible
  // in the console as "[CursorBrowser] Dialog suppressed: prompt …").
  // That bricked "+ NPC" — the prompt returned null and the create
  // path early-returned. Keeping a custom modal also works on mobile
  // and in production previews.
  type DialogConfig =
    | { kind: 'prompt'; title: string; placeholder?: string; defaultValue?: string; resolve: (v: string | null) => void }
    | { kind: 'confirm'; title: string; resolve: (v: boolean) => void }
    | { kind: 'alert'; title: string; resolve: () => void };
  const [dialog, setDialog] = useState<DialogConfig | null>(null);
  const [dialogInput, setDialogInput] = useState<string>('');
  const askPrompt = (title: string, placeholder?: string, defaultValue = ''): Promise<string | null> =>
    new Promise((resolve) => {
      setDialogInput(defaultValue);
      setDialog({ kind: 'prompt', title, placeholder, defaultValue, resolve });
    });
  const askConfirm = (title: string): Promise<boolean> =>
    new Promise((resolve) => {
      setDialog({ kind: 'confirm', title, resolve });
    });
  const showAlert = (title: string): Promise<void> =>
    new Promise((resolve) => {
      setDialog({ kind: 'alert', title, resolve });
    });
  function closeDialog(value: string | boolean | null) {
    if (!dialog) return;
    if (dialog.kind === 'prompt') dialog.resolve(value as string | null);
    else if (dialog.kind === 'confirm') dialog.resolve(value as boolean);
    else dialog.resolve();
    setDialog(null);
    setDialogInput('');
  }

  // Active map. The on-disk detection effect below corrects this to a map
  // that actually exists once it resolves; until then we seed from the
  // build-time catalog: last-used map, else the historical villageruin
  // default, else the first catalog entry. Switching resets all per-map
  // state (placements, spawn, camera).
  const readLastMap = () => { try { return localStorage.getItem('editor:last-map') || ''; } catch { return ''; } };
  const [activeMapId, setActiveMapId] = useState<string>(() => {
    const stored = readLastMap();
    if (stored && MAP_CATALOG[stored]) return stored;
    if (MAP_CATALOG[DEFAULT_MAP_ID]) return DEFAULT_MAP_ID;
    return Object.keys(MAP_CATALOG).sort()[0] ?? DEFAULT_MAP_ID;
  });
  const initialMap = MAP_CATALOG[activeMapId];

  // Maps that actually exist on disk under public/world/maps/, resolved
  // against shared tilesheets — i.e. maps the editor can truly load. Detected
  // from the dev server (list-maps) so we never default to or list a map whose
  // tile JSON / PNG isn't present in this checkout. `undefined` = still
  // detecting; `null` = no dev API (prod build) → fall back to the catalog.
  const [diskMaps, setDiskMaps] = useState<string[] | null | undefined>(undefined);
  const availableMapIds = diskMaps ?? Object.keys(MAP_CATALOG).sort();

  // Play mode — full-screen overlay that runs the real overworld engine on
  // the current map. Toggled by the Play button; the overlay's Stop button
  // flips it back. See PlayCanvas.tsx.
  const [playing, setPlaying] = useState(false);

  // ── sessionStorage rescue for unsaved per-map state ──
  // Vite Fast Refresh forcibly remounts EditorApp when hooks change shape
  // (including any time we add a new useEffect to fix a bug), and that
  // remount re-runs every useState initializer. Without this rescue, the
  // initializers fall back to MAP_CATALOG[mapId] — which is the LAST
  // SAVED state on disk. Any in-progress placements/animals/spawns the
  // user added since the previous save vanish silently. The user reported
  // exactly this: "I make NPCs, save them TWICE and they aren't there"
  // because each remount between create and save was wiping the new
  // placement back to MAP_CATALOG's view.
  //
  // We persist a per-map snapshot under `editor:dirty:<mapId>` and use
  // it as a higher-priority initializer than MAP_CATALOG. After a
  // successful save we clear the snapshot (disk now matches React state,
  // so the rescue is unnecessary).
  const SESSION_KEY = `editor:dirty:${activeMapId}`;
  function loadSession<T>(fallback: T): T {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed as T;
    } catch {
      return fallback;
    }
  }
  type DirtySnapshot = {
    placements: Placement[];
    animals: AnimalPlacement[];
    objects: ObjectPlacement[];
    spawns: Record<string, SpawnPoint>;
    battleBgFrame?: BgFrameName;
    grassPatchBackgrounds?: Record<string, BgFrameName>;
    grassPatchLevels?: Record<string, { min: number; max: number }>;
  };
  const sessionSnapshotRaw = loadSession<Partial<DirtySnapshot> | null>(null);
  // v1.209 ? auto-discard stale sessionStorage rescue if it would
  // silently REMOVE placements that exist on disk. The rescue is
  // intended to preserve UNSAVED edits across HMR remounts ? but if
  // disk was hand-restored after a corruption (or the rescue is
  // older than the on-disk JSON), the rescue is the stale source
  // and disk is authoritative. Heuristic: if disk has 3+ placements
  // that the rescue snapshot is missing, treat the rescue as stale
  // and ignore it.
  const sessionSnapshot: Partial<DirtySnapshot> | null = (() => {
    if (!sessionSnapshotRaw?.placements || !MAP_CATALOG[activeMapId]?.placements) return sessionSnapshotRaw;
    const diskIds = new Set(MAP_CATALOG[activeMapId]!.placements.map((p) => p.npcId));
    const snapIds = new Set((sessionSnapshotRaw.placements ?? []).map((p) => p.npcId));
    const missingFromSnap = [...diskIds].filter((id) => !snapIds.has(id));
    if (missingFromSnap.length >= 3) {
      console.warn(
        `[editor] discarding stale sessionStorage rescue for "${activeMapId}" ? disk has ${missingFromSnap.length} placements ` +
        `that the rescue is missing (${missingFromSnap.slice(0, 5).join(', ')}${missingFromSnap.length > 5 ? '...' : ''}). ` +
        `Loading from disk instead.`,
      );
      try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
      return null;
    }
    return sessionSnapshotRaw;
  })();

  const [placements, setPlacements] = useState<Placement[]>(() => {
    const raw = sessionSnapshot?.placements ?? initialMap?.placements ?? [];
    // Dedupe by npcId — same NPC can't sensibly be placed twice on a map
    // (npcKey would collide in the selection model, both sprites stack
    // at the same tile in-game). Older states from before the save-time
    // dedupe could still hold a duplicate from a Vite HMR race; squash
    // here so the editor never displays / round-trips one.
    const seen = new Set<string>();
    return raw.filter((p) => {
      if (seen.has(p.npcId)) return false;
      seen.add(p.npcId);
      return true;
    });
  });
  // Decorative animals — inline placements, no separate per-animal JSON.
  // Clone so the live MAP_CATALOG object isn't mutated by editor drags.
  const [animals, setAnimals] = useState<AnimalPlacement[]>(
    () => sessionSnapshot?.animals ?? (initialMap?.animals ?? []).map((a) => ({ ...a })),
  );
  // Decorative objects — inline image placements (flags, etc.). Same
  // session-rescue pattern as animals.
  const [objects, setObjects] = useState<ObjectPlacement[]>(
    () => sessionSnapshot?.objects ?? ((initialMap as { objects?: ObjectPlacement[] } | undefined)?.objects ?? []).map((o) => ({ ...o })),
  );
  // Full spawns record so non-default spawns (future map-transition entries)
  // round-trip through save without being dropped.
  const [spawns, setSpawns] = useState<Record<string, SpawnPoint>>(
    () => sessionSnapshot?.spawns ?? ({ ...(initialMap?.spawns ?? {}) }),
  );
  const spawn = spawns['default'] ?? { tileX: 0, tileY: 0 };
  const setSpawn = (p: SpawnPoint) => setSpawns((prev) => ({ ...prev, default: p }));
  // Map default backdrop frame (one of BG_FRAME_NAMES) — undefined falls
  // through to BG_FALLBACK_FRAME. Patch overrides keyed by `${signTx},${signTy}`.
  const [battleBgFrame, setBattleBgFrame] = useState<BgFrameName | undefined>(
    () => sessionSnapshot?.battleBgFrame ?? (initialMap?.battleBgFrame as BgFrameName | undefined),
  );
  const [grassPatchBackgrounds, setGrassPatchBackgrounds] = useState<Record<string, BgFrameName>>(
    () => sessionSnapshot?.grassPatchBackgrounds ?? ({ ...((initialMap?.grassPatchBackgrounds as Record<string, BgFrameName> | undefined) ?? {}) }),
  );
  const [grassPatchLevels, setGrassPatchLevels] = useState<Record<string, { min: number; max: number }>>(
    () => sessionSnapshot?.grassPatchLevels ?? ({ ...(initialMap?.grassPatchLevels ?? {}) }),
  );
  const [selection, setSelection] = useState<Set<SelKey>>(() => new Set());
  /** Tile under the mouse cursor — surfaced in the toolbar so an admin
   *  can read coords without an in-canvas overlay or a debugger. */
  const [hoverTile, setHoverTile] = useState<TileCoord | null>(null);

  // Collapsible sidebar sections — keyed by id, persisted to localStorage
  // so an admin's preferred layout survives a refresh. Click a section
  // header (with ▶ / ▼ chevron) to fold its body away. Big maps with many
  // NPCs / animals / portals get unmanageable without this.
  type SidebarSectionId = 'spawn' | 'npcs' | 'signs' | 'animals' | 'objects' | 'portals' | 'grass';
  const COLLAPSED_SECTIONS_KEY = 'editor:collapsed-sections';
  const [collapsedSections, setCollapsedSections] = useState<Set<SidebarSectionId>>(() => {
    try {
      const raw = localStorage.getItem(COLLAPSED_SECTIONS_KEY);
      if (raw) return new Set(JSON.parse(raw) as SidebarSectionId[]);
    } catch { /* best effort */ }
    return new Set<SidebarSectionId>();
  });
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_SECTIONS_KEY, JSON.stringify([...collapsedSections]));
    } catch { /* best effort */ }
  }, [collapsedSections]);
  const toggleSection = useCallback((id: SidebarSectionId) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const isSectionOpen = (id: SidebarSectionId) => !collapsedSections.has(id);
  /** Shared styles for the clickable section header chip. */
  const sectionHeaderClick = {
    cursor: 'pointer' as const,
    userSelect: 'none' as const,
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    gap: 6,
  };

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  // Baseline used for the dirty flag. After a successful save we update this
  // so the UI immediately reflects "clean" without waiting for HMR to reload
  // the JSON module.
  const [savedBaseline, setSavedBaseline] = useState<string | null>(null);
  // Portals are global (cross-map pairs), not per-map. A save writes them to
  // src/world/data/portals.json via its own endpoint.
  // v1.209 ? sessionStorage rescue for unsaved portal edits, mirroring the
  // per-map rescue above. Without this, a Vite Fast Refresh remount (or
  // any unrelated hot reload) re-ran `useState(() => clonePortals(PORTALS))`
  // against the disk state and threw away in-progress portal edits before
  // the user could click Save. Players reported "portals don't save when
  // you place them in the editor" because their work was vanishing on
  // every Fast Refresh tick. Now: hydrate from sessionStorage if present,
  // snapshot on every change, clear on save success.
  const PORTALS_SESSION_KEY = 'editor:dirty:portals';
  const portalsSessionSnapshot = (() => {
    try {
      const raw = sessionStorage.getItem(PORTALS_SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as Portal[];
    } catch { return null; }
  })();
  const [portals, setPortals] = useState<Portal[]>(
    () => portalsSessionSnapshot ?? clonePortals(PORTALS),
  );
  const [savedPortalsBaseline, setSavedPortalsBaseline] = useState<string | null>(null);
  const loadedPortalsBaseline = useMemo(() => JSON.stringify(PORTALS), []);
  const effectivePortalsBaseline = savedPortalsBaseline ?? loadedPortalsBaseline;
  const portalsDirty = effectivePortalsBaseline !== JSON.stringify(portals);
  // Persist every portal edit to sessionStorage so a hot-reload
  // remount can restore it. Cleared in save() once disk catches up.
  useEffect(() => {
    try {
      sessionStorage.setItem(PORTALS_SESSION_KEY, JSON.stringify(portals));
    } catch { /* storage full / disabled — best effort */ }
  }, [portals]);

  // World signs. Like portals, signs are a single global JSON file
  // (src/world/data/worldSigns.json) edited via /api/editor/save-signs.
  // We rehydrate from sessionStorage in case a Fast Refresh remount kills
  // in-progress edits before the user clicks Save (same pattern that
  // saved portals from the same disaster).
  const SIGNS_SESSION_KEY = 'editor:dirty:signs';
  const signsSessionSnapshot = (() => {
    try {
      const raw = sessionStorage.getItem(SIGNS_SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as WorldSignDef[];
    } catch { return null; }
  })();
  const [signs, setSigns] = useState<WorldSignDef[]>(() => signsSessionSnapshot ?? []);
  const [loadedSignsBaseline, setLoadedSignsBaseline] = useState<string>('[]');
  const [savedSignsBaseline, setSavedSignsBaseline] = useState<string | null>(null);
  const effectiveSignsBaseline = savedSignsBaseline ?? loadedSignsBaseline;
  const signsDirty = effectiveSignsBaseline !== JSON.stringify(signs);
  useEffect(() => {
    try {
      sessionStorage.setItem(SIGNS_SESSION_KEY, JSON.stringify(signs));
    } catch { /* best effort */ }
  }, [signs]);
  // One-shot load from disk on mount. The disk JSON is the source of
  // truth on first paint; sessionStorage only takes over if there's an
  // unsaved snapshot the user is mid-editing.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/editor/list-signs')
      .then((r) => r.json())
      .then((data: { signs?: WorldSignDef[] }) => {
        if (cancelled) return;
        const disk = data.signs ?? [];
        setLoadedSignsBaseline(JSON.stringify(disk));
        // Only adopt disk state if we don't have a dirty sessionStorage
        // snapshot — otherwise we'd clobber the user's in-flight edits.
        if (!signsSessionSnapshot) setSigns(disk);
      })
      .catch((err) => console.warn('[editor] failed to load worldSigns.json:', err));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Sign sprite image cache for the editor canvas. Preload every variant
  // once at mount so dragging a sign onto a new sprite is instant.
  const [signImages, setSignImages] = useState<Record<string, HTMLImageElement>>({});
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      // Skip 'no_sprite' — it has no PNG and the canvas renders a placeholder
      // outline for it instead of looking up an image.
      RENDERABLE_SIGN_SPRITES.map(async (sp) => {
        const src = `/${getSignSpritePath(sp)}`;
        return new Promise<[string, HTMLImageElement] | null>((resolve) => {
          const img = new Image();
          img.onload = () => resolve([sp, img]);
          img.onerror = () => resolve(null);
          img.src = src;
        });
      }),
    ).then((pairs) => {
      if (cancelled) return;
      const map: Record<string, HTMLImageElement> = {};
      for (const p of pairs) if (p) map[p[0]] = p[1];
      setSignImages(map);
    });
    return () => { cancelled = true; };
  }, []);

  const [signSaveStatus, setSignSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [signSaveError, setSignSaveError] = useState<string | null>(null);

  const [interaction, setInteraction] = useState<Interaction>(null);
  const [showGrid, setShowGrid] = useState(false);

  // Characters available for the NPC sprite dropdown. Populated from a
  // filesystem listing so dropping a new folder into
  // public/world/npcs/Character/ makes it show up without a code change.
  const [characters, setCharacters] = useState<CharacterInfo[]>([]);
  useEffect(() => {
    fetch('/api/editor/list-characters')
      .then((r) => r.json())
      .then(({ characters }) => setCharacters(characters))
      .catch((err) => console.warn('[editor] failed to list characters:', err));
  }, []);

  // Animal species + per-species sheet variants. Populated from
  // /api/editor/list-animals so new folders under public/world/npcs/Animal/
  // show up automatically.
  const [animalCatalog, setAnimalCatalog] = useState<AnimalSpeciesInfo[]>([]);
  useEffect(() => {
    fetch('/api/editor/list-animals')
      .then((r) => r.json())
      .then(({ animals }: { animals: AnimalSpeciesInfo[] }) => setAnimalCatalog(animals))
      .catch((err) => console.warn('[editor] failed to list animals:', err));
  }, []);

  // Object image catalog — PNG entries under public/world/tilesets/Animated/*/.
  // Includes per-image frame dimensions (source pixels) read from each
  // folder's JSON sidecar. Flags ship as 16×16, flower.png as 10×8,
  // plant.png as 16×16. Without per-image dims we'd slice sub-tile
  // sheets wrong.
  type ObjectImageInfo = { name: string; image: string; frameW: number; frameH: number };
  const [objectCatalog, setObjectCatalog] = useState<ObjectImageInfo[]>([]);
  useEffect(() => {
    fetch('/api/editor/list-objects')
      .then((r) => r.json())
      .then(({ objects }: { objects: ObjectImageInfo[] }) => setObjectCatalog(objects))
      .catch((err) => console.warn('[editor] failed to list objects:', err));
  }, []);
  /** Frame dimensions for an image path (e.g. "Animated/Flag/FlagBlue16x16.png").
   *  Falls back to 16×16 when the catalog hasn't loaded yet OR the image is
   *  not in the catalog (renamed PNG / missing file). */
  const frameDimsFor = (image: string): { frameW: number; frameH: number } => {
    const found = objectCatalog.find((c) => c.image === image);
    return found ? { frameW: found.frameW, frameH: found.frameH } : { frameW: 16, frameH: 16 };
  };
  /** World-pixel draw rect for an object placement. Mirrors the runtime's
   *  `objectDrawRect` so the editor previews placements in their exact
   *  in-game position (centered in the tile on both axes; 16×16 frames
   *  remain at the top-left of their tile because the math collapses). */
  const objectRectFor = (o: ObjectPlacement): { dx: number; dy: number; dw: number; dh: number } => {
    const { frameW, frameH } = frameDimsFor(o.image);
    const K = TILE_SIZE / 16;
    const dw = frameW * K;
    const dh = frameH * K;
    return {
      dx: o.tileX * TILE_SIZE + TILE_SIZE / 2 - dw / 2 + (o.offsetX ?? 0) * K,
      dy: o.tileY * TILE_SIZE + TILE_SIZE / 2 - dh / 2 + (o.offsetY ?? 0) * K,
      dw,
      dh,
    };
  };
  // Image cache for objects — keyed by the source PNG path so the canvas
  // can draw the current animation frame without re-fetching.
  const [objectImages, setObjectImages] = useState<Record<string, HTMLImageElement>>({});
  // Alpha bounding box of each object image's FIRST frame, in source-pixel
  // (0..16) coords. Computed once per unique src and reused for collision
  // visualization (and, eventually, runtime collision). Null means the
  // first frame is fully transparent — fall back to full-tile collision.
  type ObjectBBox = { x: number; y: number; w: number; h: number };
  const [objectBBoxes, setObjectBBoxes] = useState<Record<string, ObjectBBox | null>>({});
  // Per-folder default collider boxes (e.g. "Animated/Flag" → { x, y, w, h }).
  // Used as the second tier in the collider fallback chain (placement
  // override → folder default → alpha bbox). Loaded from the dev server's
  // `_collider.json` sidecars on mount and re-fetched whenever the user
  // saves a new default via the sidebar button.
  const [folderColliderDefaults, setFolderColliderDefaults] = useState<Record<string, ObjectBBox>>({});
  useEffect(() => {
    fetch('/api/editor/list-object-folder-defaults')
      .then((r) => r.ok ? r.json() : { defaults: [] })
      .then(({ defaults }: { defaults: Array<{ folder: string; colliderBox: ObjectBBox }> }) => {
        const next: Record<string, ObjectBBox> = {};
        for (const d of defaults) next[d.folder] = d.colliderBox;
        setFolderColliderDefaults(next);
      })
      .catch((err) => console.warn('[editor] failed to load folder collider defaults:', err));
  }, []);
  /** Folder name for a tileset-relative image path. */
  const folderOf = (image: string) => {
    const i = image.lastIndexOf('/');
    return i < 0 ? image : image.slice(0, i);
  };
  /** Resolve the effective collider source for a placement: 'custom' if
   *  it has its own colliderBox, 'folder' if a folder default applies,
   *  'auto' otherwise. The actual box for each tier is read separately. */
  type ColliderSource = 'custom' | 'folder' | 'auto';
  const colliderSourceFor = (o: ObjectPlacement): ColliderSource => {
    if (o.colliderBox) return 'custom';
    if (folderColliderDefaults[folderOf(o.image)]) return 'folder';
    return 'auto';
  };
  // Index of the object whose collider is currently being edited (the
  // canvas shows handles, and pointer-down inside the rect drags/resizes
  // it instead of the usual entity drag). Cleared on map switch and when
  // the user clicks the toggle off.
  const [editColliderIndex, setEditColliderIndex] = useState<number | null>(null);

  // Sidebar Objects-section sub-grouping: collapse state per folder
  // (e.g. "Animated/Flag"). Persisted to localStorage like the top-level
  // section collapse so it survives a refresh.
  const COLLAPSED_OBJECT_FOLDERS_KEY = 'editor:collapsed-object-folders';
  const [collapsedObjectFolders, setCollapsedObjectFolders] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(COLLAPSED_OBJECT_FOLDERS_KEY);
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch { /* best effort */ }
    return new Set();
  });
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_OBJECT_FOLDERS_KEY, JSON.stringify([...collapsedObjectFolders]));
    } catch { /* best effort */ }
  }, [collapsedObjectFolders]);
  const toggleObjectFolder = useCallback((folder: string) => {
    setCollapsedObjectFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder); else next.add(folder);
      return next;
    });
  }, []);

  // Animation tick for flag (and other 16×16-frame) objects. Increments
  // ~6 times/sec; the canvas render uses `tick % frameCount` to pick which
  // 16×16 slice of the source sheet to draw. We only run the timer while
  // at least one object exists on this map — keeps the editor idle when
  // there's nothing to animate.
  const [objectAnimTick, setObjectAnimTick] = useState(0);
  useEffect(() => {
    if (objects.length === 0) return;
    const id = window.setInterval(() => setObjectAnimTick((t) => t + 1), 1000 / 6);
    return () => window.clearInterval(id);
  }, [objects.length]);
  const objectSpritesKey = useMemo(
    () => objects.map((o) => o.image).sort().join('|'),
    [objects],
  );
  useEffect(() => {
    let cancelled = false;
    const srcs = Array.from(new Set(objects.map((o) => `world/tilesets/${o.image}`)));
    Promise.all(srcs.map(async (src) => [src, await loadImage(src)] as const))
      .then((pairs) => {
        if (cancelled) return;
        setObjectImages((prev) => {
          const next = { ...prev };
          for (const [src, img] of pairs) next[src] = img;
          return next;
        });
        // Re-derive bboxes using the catalog's per-image frame dims. The
        // effect re-runs after the catalog fetch finishes, so a placement
        // loaded before the catalog gets its bbox refined once dims are
        // known (no stale 16×16 cache).
        setObjectBBoxes(() => {
          const next: Record<string, ObjectBBox | null> = {};
          for (const [src, img] of pairs) {
            const image = src.replace(/^world\/tilesets\//, '');
            const { frameW, frameH } = frameDimsFor(image);
            next[src] = computeFirstFrameAlphaBBox(img, frameW, frameH);
          }
          return next;
        });
      })
      .catch(() => { /* missing image surfaced as a placeholder rect */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectSpritesKey, objectCatalog]);

  // Image cache for animal sheets in the editor canvas — parallel to
  // npcImages. Keyed by sprite url so the canvas can pick the right PNG for
  // each placement without re-fetching.
  const [animalImages, setAnimalImages] = useState<Record<string, HTMLImageElement>>({});
  const animalSpritesKey = useMemo(
    () => animals.map((a) => animalSpritePaths(a.type, a.sheet).sprite).sort().join('|'),
    [animals],
  );
  useEffect(() => {
    let cancelled = false;
    const srcs = Array.from(new Set(animals.map((a) => animalSpritePaths(a.type, a.sheet).sprite)));
    Promise.all(srcs.map(async (src) => [src, await loadImage(src)] as const))
      .then((pairs) => {
        if (cancelled) return;
        setAnimalImages((prev) => {
          const next = { ...prev };
          for (const [src, img] of pairs) next[src] = img;
          return next;
        });
      })
      .catch(() => { /* missing sheet is surfaced as a red placeholder on the canvas */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animalSpritesKey]);

  // Per-NPC editable drafts. Lazy: a draft for `npcId` exists only after the
  // user edits that NPC. Before that, the UI reads directly from NPC_CATALOG.
  // `savedBaselines` captures draft state at the moment of a successful save
  // so dirty detection survives while HMR catches up to the file change.
  const [npcDrafts, setNpcDrafts] = useState<Record<string, NpcDraft>>({});
  const [npcSavedBaselines, setNpcSavedBaselines] = useState<Record<string, string>>({});
  const [npcSaveStatus, setNpcSaveStatus] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});
  const [npcSaveError, setNpcSaveError] = useState<Record<string, string>>({});

  // Fields overridden locally after a save. These take priority over
  // NPC_CATALOG in the editor's reads, so the canvas + sidebar show the new
  // sprite/name the instant the save succeeds — without depending on Vite's
  // HMR pipeline to re-evaluate maps.ts.
  interface NpcFields {
    id: string;
    name: string;
    sprite: string;
    spriteJson: string;
    faceset: string;
    dialogue: string[];
  }
  const [npcOverrides, setNpcOverrides] = useState<Record<string, NpcFields>>({});
  const resolveNpc = (id: string): NpcFields | null => {
    // Priority order:
    //   1. npcDrafts  — live in-progress edits (sprite picker, name, etc.).
    //                   Drafts MUST win so the canvas updates immediately
    //                   when the user changes the character dropdown — without
    //                   this you had to save before seeing the swap, which
    //                   was hopeless UX (player asked "how do I change Walt"
    //                   even though they'd already picked a new sprite).
    //   2. npcOverrides — runtime-created NPCs and disk-hydrated record.
    //   3. NPC_CATALOG  — build-time static fallback.
    const draft = npcDrafts[id];
    const ov = npcOverrides[id];
    const base = NPC_CATALOG[id];
    if (!draft && !ov && !base) return null;

    // Pick the source of authority for character-derived sprite paths.
    // Drafts only carry `character`; we need to project that back to
    // sprite/spriteJson/faceset urls. Treat empty-string character as
    // "no opinion" so a runtime-created NPC whose draft hasn't had
    // character set yet still renders its persisted sprite.
    const character = (draft?.character?.trim() || characterOfNpc(id)) || '';
    const ovOrBase: NpcFields = ov ?? {
      id: base?.id ?? id,
      name: base?.name ?? id,
      sprite: base?.sprite ?? '',
      spriteJson: base?.spriteJson ?? '',
      faceset: base?.faceset ?? '',
      dialogue: base?.dialogue ?? [],
    };
    if (!draft) return ovOrBase;
    // Re-derive sprite paths from the draft's character so live previews
    // reflect dropdown picks before save. If we have no character at all
    // (empty string), fall back to whatever sprite the override/base had
    // — never fabricate a `world/npcs/Character//SpriteSheet.png` url
    // which would 404 and break the canvas image cache.
    const useDraftSprite = character.length > 0;
    return {
      id: ovOrBase.id,
      name: draft.name ?? ovOrBase.name,
      sprite: useDraftSprite ? `world/npcs/Character/${character}/SpriteSheet.png` : ovOrBase.sprite,
      spriteJson: useDraftSprite ? `world/npcs/Character/${character}/SpriteSheet.json` : ovOrBase.spriteJson,
      faceset: useDraftSprite ? `world/npcs/Character/${character}/Faceset.png` : ovOrBase.faceset,
      dialogue: draft.dialogue ?? ovOrBase.dialogue,
    };
  };

  /**
   * Build the "disk" (last-saved) draft for an NPC, ignoring any live
   * npcDrafts edits. Consults npcOverrides FIRST so a runtime-created NPC —
   * which lives only in overrides until vite re-globs its JSON — uses its
   * real name/character, not its seeded id. `draftFromCatalog` alone would
   * fall back to `name: npcId`, leaking the id seed into the Name field and
   * marking the fresh NPC phantom-dirty. See resolveNpc for the same priority.
   */
  const diskDraftForNpc = (id: string): NpcDraft => {
    const ov = npcOverrides[id];
    if (ov && !NPC_CATALOG[id]) {
      return {
        character: ov.sprite.match(/\/Character\/([^/]+)\//)?.[1] ?? '',
        name: ov.name,
        dialogue: [...ov.dialogue],
      };
    }
    return draftFromCatalog(id);
  };
  /** Inspector draft: live edits win, else the last-saved disk draft. */
  const draftForNpc = (id: string): NpcDraft => npcDrafts[id] ?? diskDraftForNpc(id);

  /**
   * Hydrate npcOverrides from disk via /api/editor/list-npcs. Authoritative
   * source for any NPC vite's `import.meta.glob` hasn't picked up yet —
   * notably NPCs created via "+ NPC" at runtime, which would otherwise
   * vanish from the canvas after a save triggers a vite HMR remount.
   * Also called right after createNpc to seal the new NPC's record.
   */
  const refreshNpcOverridesFromDisk = useCallback(async () => {
    try {
      const res = await fetch('/api/editor/list-npcs');
      if (!res.ok) return;
      const { npcs } = (await res.json()) as { npcs: Array<{
        id: string; character: string; name: string; dialogue?: string[];
      }> };
      setNpcOverrides((prev) => {
        const next = { ...prev };
        for (const n of npcs) {
          // Only seed the override when this NPC isn't in the build-time
          // catalog yet. Catalog entries are loaded statically and don't
          // need an override; runtime-created NPCs do.
          if (NPC_CATALOG[n.id]) continue;
          // Don't overwrite a freshly-edited override that the user
          // hasn't saved yet — saving will eventually flush it back.
          if (prev[n.id]) continue;
          next[n.id] = {
            id: n.id,
            name: n.name,
            sprite: `world/npcs/Character/${n.character}/SpriteSheet.png`,
            spriteJson: `world/npcs/Character/${n.character}/SpriteSheet.json`,
            faceset: `world/npcs/Character/${n.character}/Faceset.png`,
            dialogue: [...(n.dialogue ?? [])],
          };
        }
        return next;
      });
    } catch { /* best-effort */ }
  }, []);

  // Hydrate on mount so the very first paint after a remount already has
  // the runtime-added NPCs available to resolveNpc().
  useEffect(() => { refreshNpcOverridesFromDisk(); }, [refreshNpcOverridesFromDisk]);

  function updateNpcDraft(npcId: string, patch: Partial<NpcDraft>) {
    setNpcDrafts((prev) => {
      // Seed from diskDraftForNpc (not draftFromCatalog) so editing ANY field
      // on a freshly-created NPC — one that lives in npcOverrides but isn't in
      // NPC_CATALOG yet — uses its real name, not the seeded id. The catalog
      // fallback returns `name: npcId`, which would poison the draft's name
      // the instant the user touched dialogue/facing/etc. and stick there.
      const cur = prev[npcId] ?? diskDraftForNpc(npcId);
      return { ...prev, [npcId]: { ...cur, ...patch } };
    });
  }

  /**
   * Create a new NPC JSON + drop a placement at the center of the current
   * view. Prompts for the NPC's name (the in-game display name); the unique
   * id is auto-generated from it via `newNpcId` so the user never has to
   * invent — or de-conflict — an id. Two NPCs can share a name ("Chad");
   * their ids stay distinct (chad-<seed>).
   */
  async function createNpc() {
    const raw = await askPrompt(
      'New NPC name',
      'in-game name, e.g. "Chad" or "Village Guard"',
    );
    if (!raw) return;
    const displayName = raw.trim();
    if (!displayName) return;
    const npcId = newNpcId(displayName, (id) => !!(NPC_CATALOG[id] || npcOverrides[id]));
    // Scope the new NPC to the active map by default so it doesn't clutter
    // every map's "+ Place" picker. Lift homeMapId by hand-editing the JSON
    // (or via the editor's NPC sidebar) if you want a cross-map NPC.
    const newData = { character: 'Boy', name: displayName, dialogue: ['...'], homeMapId: activeMapId };
    const res = await fetch('/api/editor/create-npc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npcId, data: newData }),
    });
    if (!res.ok) {
      await showAlert(`Create failed: ${res.status} ${await res.text()}`);
      return;
    }
    // Local override so the canvas + sidebar show the new NPC immediately.
    setNpcOverrides((prev) => ({
      ...prev,
      [npcId]: {
        id: npcId,
        name: newData.name,
        sprite: `world/npcs/Character/${newData.character}/SpriteSheet.png`,
        spriteJson: `world/npcs/Character/${newData.character}/SpriteSheet.json`,
        faceset: `world/npcs/Character/${newData.character}/Faceset.png`,
        dialogue: [...newData.dialogue],
      },
    }));
    // Place it at the center tile of the current view, but ALWAYS clamp to
    // the active map's bounds so an off-screen / out-of-bounds camera can't
    // drop the NPC at a tile that doesn't exist on this map. Previously this
    // bit cave1 hard: switching from a bigger map kept the cam outside the
    // cave's 44×50 tile bounds, so new NPCs landed on phantom tiles and
    // never rendered. With the bound clamp the worst case is "NPC lands at
    // (0,0)" — visible, movable, fixable.
    const rawTileX = Math.floor((cam.x + viewport.w / 2 / cam.zoom) / TILE_SIZE);
    const rawTileY = Math.floor((cam.y + viewport.h / 2 / cam.zoom) / TILE_SIZE);
    const maxX = map ? map.data.mapWidth - 1 : rawTileX;
    const maxY = map ? map.data.mapHeight - 1 : rawTileY;
    const centerTileX = Math.max(0, Math.min(maxX, rawTileX));
    const centerTileY = Math.max(0, Math.min(maxY, rawTileY));
    setPlacements((prev) => [...prev, { npcId, tileX: centerTileX, tileY: centerTileY }]);
    setSelection(new Set([npcKey(npcId)]));
    console.log(`[editor] created npc "${npcId}" at (${centerTileX}, ${centerTileY}) on ${activeMapId}`);
    // Re-pull the disk catalog so the new NPC stays resolvable across any
    // future vite HMR remounts. Without this the React npcOverride is the
    // only record of the new NPC, and the next save (which triggers HMR)
    // wipes it — the placement remains but renders as "unknown".
    void refreshNpcOverridesFromDisk();
  }

  /**
   * Place a previously-created NPC (one whose JSON exists on disk but isn't
   * placed on the current map) at the center of the current view. Picks
   * from the union of NPC_CATALOG + npcOverrides minus anything already
   * placed on this map — recovers from cases where a placement got lost
   * to a remount but the underlying NPC JSON survives on disk.
   */
  async function placeExistingNpc() {
    const placedIds = new Set(placements.map((p) => p.npcId));
    // Map-scope filter: an NPC is eligible to place on this map when
    // its homeMapId matches activeMapId OR is unset (legacy / no
    // explicit scope). Without this filter every Forest trainer + Cave
    // trainer + Snow trainer all show up in every map's picker, which
    // is what the player flagged as "all NPCs exist on all maps".
    const candidates = Array.from(
      new Set([...Object.keys(NPC_CATALOG), ...Object.keys(npcOverrides)]),
    )
      .filter((id) => !placedIds.has(id))
      .filter((id) => {
        // Catalog is the authoritative source for `homeMapId` (the
        // override map only stores fields the editor actively edits;
        // homeMapId comes from disk). NPCs with no home are universal.
        const h = NPC_CATALOG[id]?.homeMapId;
        return !h || h === activeMapId;
      })
      .sort();
    if (candidates.length === 0) {
      await showAlert('No unplaced NPCs available for this map. Use "+ NPC" to create a new one (it will be scoped to this map).');
      return;
    }
    const list = candidates.join('\n  - ');
    const id = await askPrompt(
      `Place which existing NPC on this map?\n\nEligible (scoped to ${activeMapId}):\n  - ${list}`,
      'type the exact id (e.g. walt)',
    );
    if (!id) return;
    const npcId = id.trim().toLowerCase();
    if (!candidates.includes(npcId)) {
      await showAlert(`"${npcId}" isn't a known NPC, or is already placed on this map.`);
      return;
    }
    const rawTileX = Math.floor((cam.x + viewport.w / 2 / cam.zoom) / TILE_SIZE);
    const rawTileY = Math.floor((cam.y + viewport.h / 2 / cam.zoom) / TILE_SIZE);
    const maxX = map ? map.data.mapWidth - 1 : rawTileX;
    const maxY = map ? map.data.mapHeight - 1 : rawTileY;
    const tileX = Math.max(0, Math.min(maxX, rawTileX));
    const tileY = Math.max(0, Math.min(maxY, rawTileY));
    setPlacements((prev) => [...prev, { npcId, tileX, tileY }]);
    setSelection(new Set([npcKey(npcId)]));
    console.log(`[editor] placed existing npc "${npcId}" at (${tileX}, ${tileY}) on ${activeMapId}`);
  }

  /**
   * Remove an NPC from the current map's placements WITHOUT deleting the
   * NPC's JSON. Use this when an NPC's been over-placed elsewhere or needs
   * to migrate to another map — the NPC stays in NPC_CATALOG and can be
   * re-placed via "+ Place" (here or on another map). Pairs with
   * `deleteNpc` which wipes the JSON entirely.
   */
  function unplaceNpc(npcId: string) {
    setPlacements((prev) => {
      const next = prev.filter((p) => p.npcId !== npcId);
      // v1.209 ? immediately mirror to sessionStorage. The useEffect
      // that snapshots placements/animals/etc. is async and runs on the
      // NEXT render. If a Vite Fast Refresh fires between the unplace
      // and that effect (which it does fairly aggressively in dev), the
      // remount reads STALE placements from sessionStorage and the
      // unplace silently reverts. Doing the write synchronously here
      // closes that window.
      try {
        const snapshot = {
          placements: next,
          animals,
          spawns,
          battleBgFrame,
          grassPatchBackgrounds,
          grassPatchLevels,
        };
        sessionStorage.setItem(`editor:dirty:${activeMapId}`, JSON.stringify(snapshot));
      } catch { /* storage full / disabled — best effort */ }
      console.log(`[editor] unplaced "${npcId}" from ${activeMapId} (${prev.length} ? ${next.length} placements)`);
      return next;
    });
    setSelection((prev) => {
      const next = new Set(prev);
      next.delete(npcKey(npcId));
      return next;
    });
  }

  /**
   * Delete the NPC JSON from disk and remove its placement from the current
   * map. If it's referenced by other maps those will show "unknown" until
   * they're edited — we warn the user before doing it.
   */
  async function deleteNpc(npcId: string) {
    const otherMapsUsing = Object.values(MAP_CATALOG)
      .filter((m) => m.id !== activeMapId && m.placements.some((p) => p.npcId === npcId))
      .map((m) => m.id);
    const warning = otherMapsUsing.length
      ? `\n\nWARNING: this NPC is also placed on: ${otherMapsUsing.join(', ')}. Those will show "unknown" until fixed.`
      : '';
    if (!(await askConfirm(`Delete NPC "${npcId}" from disk?${warning}`))) return;
    const res = await fetch('/api/editor/delete-npc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npcId }),
    });
    if (!res.ok) {
      await showAlert(`Delete failed: ${res.status} ${await res.text()}`);
      return;
    }
    // Scrub local state too.
    setPlacements((prev) => prev.filter((p) => p.npcId !== npcId));
    setSelection((prev) => {
      const next = new Set(prev);
      next.delete(npcKey(npcId));
      return next;
    });
    setNpcOverrides((prev) => {
      const next = { ...prev };
      delete next[npcId];
      return next;
    });
    setNpcDrafts((prev) => {
      const next = { ...prev };
      delete next[npcId];
      return next;
    });
    setNpcSavedBaselines((prev) => {
      const next = { ...prev };
      delete next[npcId];
      return next;
    });
    console.log(`[editor] deleted npc "${npcId}"`);
  }

  /** Drop a new animal placement at the center of the current view. Defaults
   *  to the first species in the catalog (alphabetically "Cat" today). */
  async function createAnimal() {
    if (animalCatalog.length === 0) {
      await showAlert('Animal catalog is still loading — try again in a moment.');
      return;
    }
    const species = animalCatalog[0]!;
    const sheet = species.sheets.includes('SpriteSheet') ? 'SpriteSheet' : species.sheets[0]!;
    const centerTileX = Math.floor((cam.x + viewport.w / 2 / cam.zoom) / TILE_SIZE);
    const centerTileY = Math.floor((cam.y + viewport.h / 2 / cam.zoom) / TILE_SIZE);
    const placement: AnimalPlacement = {
      type: species.type,
      // Persist sheet only when it's non-default; the JSON formatter drops
      // the key for "SpriteSheet" anyway.
      ...(sheet !== 'SpriteSheet' ? { sheet } : {}),
      tileX: centerTileX,
      tileY: centerTileY,
      wanderTiles: DEFAULT_ANIMAL_WANDER_TILES,
    };
    setAnimals((prev) => {
      const next = [...prev, placement];
      setSelection(new Set([animalKey(next.length - 1)]));
      return next;
    });
  }

  /** Remove an animal placement by index, and clean up any selection keys
   *  that referenced it or the shifted tail. */
  function deleteAnimal(index: number) {
    setAnimals((prev) => prev.filter((_, i) => i !== index));
    setSelection((prev) => {
      const next = new Set<SelKey>();
      for (const k of prev) {
        if (!k.startsWith('animal:')) { next.add(k); continue; }
        const i = parseInt(k.slice(7), 10);
        if (i === index) continue;
        next.add(i > index ? animalKey(i - 1) : k);
      }
      return next;
    });
  }

  /** Patch a single field on an animal placement (type/sheet/wanderTiles). */
  function updateAnimal(index: number, patch: Partial<AnimalPlacement>) {
    setAnimals((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  /** Drop a new object placement at the center of the current view. Defaults
   *  to the first image in the catalog (alphabetically). */
  async function createObject() {
    if (objectCatalog.length === 0) {
      await showAlert('Object catalog is still loading — try again in a moment.');
      return;
    }
    const first = objectCatalog[0]!;
    const centerTileX = Math.floor((cam.x + viewport.w / 2 / cam.zoom) / TILE_SIZE);
    const centerTileY = Math.floor((cam.y + viewport.h / 2 / cam.zoom) / TILE_SIZE);
    const placement: ObjectPlacement = {
      image: first.image,
      tileX: centerTileX,
      tileY: centerTileY,
    };
    setObjects((prev) => {
      const next = [...prev, placement];
      setSelection(new Set([objectKey(next.length - 1)]));
      return next;
    });
  }

  /** Remove an object placement by index, and clean up any selection keys
   *  that referenced it or the shifted tail. */
  function deleteObject(index: number) {
    setObjects((prev) => prev.filter((_, i) => i !== index));
    setSelection((prev) => {
      const next = new Set<SelKey>();
      for (const k of prev) {
        if (!k.startsWith('object:')) { next.add(k); continue; }
        const i = parseInt(k.slice(7), 10);
        if (i === index) continue;
        next.add(i > index ? objectKey(i - 1) : k);
      }
      return next;
    });
    // Keep editColliderIndex pointing at the right placement: clear if
    // we just deleted the editing target, decrement if the deletion
    // shifted the editing target's index down.
    setEditColliderIndex((prev) => prev === null ? null : prev === index ? null : prev > index ? prev - 1 : prev);
  }

  /** Patch a single field on an object placement (image/tileX/tileY). */
  function updateObject(index: number, patch: Partial<ObjectPlacement>) {
    setObjects((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  }

  /** Duplicate one or more object placements. Each copy lands one tile
   *  to the right of its source (or one row down if the source was on
   *  the right edge). All per-instance settings carry over —
   *  colliderBox, drawOrder, offsets, blocksPassage, randomizeFrameStart,
   *  image. Selection moves to the copies so the designer can immediately
   *  drag/edit them as a group. */
  function duplicateObjects(indices: number[]) {
    if (indices.length === 0) return;
    setObjects((prev) => {
      const mapW = map?.data.mapWidth ?? 9999;
      const mapH = map?.data.mapHeight ?? 9999;
      const next = [...prev];
      const newKeys = new Set<SelKey>();
      // Sort + dedupe so the original-array order of selections is
      // preserved in the copies' relative arrangement.
      for (const idx of [...new Set(indices)].sort((a, b) => a - b)) {
        const src = prev[idx];
        if (!src) continue;
        let tileX = src.tileX + 1;
        let tileY = src.tileY;
        if (tileX >= mapW) { tileX = src.tileX; tileY = Math.min(mapH - 1, src.tileY + 1); }
        // Deep clone so colliderBox / etc aren't shared between source and copy.
        const copy: ObjectPlacement = JSON.parse(JSON.stringify({ ...src, tileX, tileY }));
        next.push(copy);
        newKeys.add(objectKey(next.length - 1));
      }
      setSelection(newKeys);
      return next;
    });
  }
  /** Convenience wrapper: duplicate exactly one placement (the inspector
   *  row's "Duplicate" button uses this). */
  function duplicateObject(index: number) {
    duplicateObjects([index]);
  }
  /** Indices of every currently-selected object placement, in selection order. */
  function selectedObjectIndices(): number[] {
    const out: number[] = [];
    for (const k of selection) {
      if (!k.startsWith('object:')) continue;
      const i = parseInt(k.slice(7), 10);
      if (Number.isFinite(i) && objects[i]) out.push(i);
    }
    return out;
  }

  /** Drop a new sign at the center of the current view on the active map.
   *  Defaults to sign_1 + dojo-poster — designer changes both in the
   *  sidebar inspector. */
  function createSign() {
    const centerTileX = Math.floor((cam.x + viewport.w / 2 / cam.zoom) / TILE_SIZE);
    const centerTileY = Math.floor((cam.y + viewport.h / 2 / cam.zoom) / TILE_SIZE);
    setSigns((prev) => {
      const id = newSignId(prev);
      const def: WorldSignDef = {
        id,
        mapId: activeMapId,
        tileX: centerTileX,
        tileY: centerTileY,
        sprite: 'sign_1',
        kind: 'text-dialogue',
        text: ['New sign — edit this text in the Signs sidebar.'],
      };
      const next = [...prev, def];
      setSelection(new Set([signKey(id)]));
      return next;
    });
  }

  function deleteSign(id: string) {
    setSigns((prev) => prev.filter((s) => s.id !== id));
    setSelection((prev) => {
      const next = new Set<SelKey>();
      for (const k of prev) if (k !== signKey(id)) next.add(k);
      return next;
    });
  }

  function updateSign(id: string, patch: Partial<WorldSignDef>) {
    setSigns((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function saveNpc(npcId: string) {
    const draft = npcDrafts[npcId];
    if (!draft) return;
    setNpcSaveStatus((s) => ({ ...s, [npcId]: 'saving' }));
    setNpcSaveError((s) => ({ ...s, [npcId]: '' }));
    // Explicit null → delete. Without this, turning trainer OFF and saving
    // would leave the old trainerParty on disk (server merges with existing).
    const payload = {
      character: draft.character,
      name: draft.name,
      dialogue: draft.dialogue,
      trainerParty: draft.trainerParty && draft.trainerParty.length > 0 ? draft.trainerParty : null,
      trainerReward: draft.trainerReward ?? null,
      // Unused at runtime + hidden in the editor, but still round-tripped here
      // so saving an NPC that already has one on disk doesn't wipe it.
      preBattleLine: draft.preBattleLine ?? null,
      postDefeatDialogue: draft.postDefeatDialogue && draft.postDefeatDialogue.length > 0 ? draft.postDefeatDialogue : null,
      moodEmotes: draft.moodEmotes && draft.moodEmotes.length > 0 ? draft.moodEmotes : null,
      // Explicit null when off so the server-side merge actually removes
      // the field instead of keeping a stale `true` on disk.
      stationary: draft.stationary ? true : null,
      // Locked facing — explicit null when "Auto" so the server merge clears
      // any stale direction left on disk.
      faceDirection: draft.faceDirection ?? null,
      // Gating fields — same explicit-null-when-off contract so disabling a
      // prerequisite or passage block actually clears it on disk.
      requiredTrainerDefeats: draft.requiredTrainerDefeats && draft.requiredTrainerDefeats.length > 0 ? draft.requiredTrainerDefeats : null,
      prereqBlockedMessage: draft.prereqBlockedMessage ?? null,
      blocksPassage: draft.blocksPassage ? true : null,
      // homeMapId is a placement-filter concept (not part of trainer setup);
      // we don't manage it here, and the server-side merge preserves it.
    };
    try {
      const res = await fetch('/api/editor/save-npc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npcId, data: payload }),
      });
      if (!res.ok) throw new Error(`save-npc ${res.status} ${await res.text()}`);
      const result = await res.json().catch(() => ({}));
      console.log(`[editor] npc save ok → ${result.path ?? npcId}`);
      setNpcSavedBaselines((prev) => ({ ...prev, [npcId]: JSON.stringify(draft) }));
      setNpcSaveStatus((s) => ({ ...s, [npcId]: 'saved' }));
      setTimeout(() => setNpcSaveStatus((s) => (s[npcId] === 'saved' ? { ...s, [npcId]: 'idle' } : s)), 2500);
      // Populate the local override so the editor's reads (canvas + sidebar)
      // reflect the new NPC immediately, independent of HMR.
      const charSprite = `world/npcs/Character/${draft.character}/SpriteSheet.png`;
      const charJson = `world/npcs/Character/${draft.character}/SpriteSheet.json`;
      const charFaceset = `world/npcs/Character/${draft.character}/Faceset.png`;
      setNpcOverrides((prev) => ({
        ...prev,
        [npcId]: {
          id: npcId,
          name: draft.name,
          sprite: charSprite,
          spriteJson: charJson,
          faceset: charFaceset,
          dialogue: [...draft.dialogue],
        },
      }));
      // And pull the new sprite image into the cache so drawImage has it ready.
      loadImage(charSprite)
        .then((img) => setNpcImages((prev) => ({ ...prev, [charSprite]: img })))
        .catch(() => {});
    } catch (err) {
      setNpcSaveStatus((s) => ({ ...s, [npcId]: 'error' }));
      setNpcSaveError((s) => ({ ...s, [npcId]: String(err) }));
    }
  }
  // When the user clicks "jump to" on a portal half, we stash the tile to
  // center on AND the selection to apply once the new map finishes loading.
  // The map-switch state-reset effect unconditionally clears selection, so
  // deferring via pendingFocus is how we make the jumped-to portal stay
  // highlighted after the switch.
  const [pendingFocus, setPendingFocus] = useState<
    { mapId: string; tileX: number; tileY: number; selection?: Set<SelKey> } | null
  >(null);

  // If portals.json changes outside the editor (e.g. I fix a file by hand,
  // or another editor tab saves) AND the editor has no unsaved portal
  // changes, re-sync from the new truth. Without this, the editor's
  // useState value stays frozen at first-mount data and the next Save
  // clobbers the external change.
  useEffect(() => {
    const onReload = (e: Event) => {
      const fresh = (e as CustomEvent).detail as Portal[] | undefined;
      if (!fresh) return;
      if (portalsDirty) {
        console.warn('[editor] portals.json changed on disk, but you have unsaved edits — not re-syncing. Save or refresh to reconcile.');
        return;
      }
      setPortals(clonePortals(fresh));
      setSavedPortalsBaseline(JSON.stringify(fresh));
      console.log('[editor] portals re-synced from disk (external change, editor was clean)');
    };
    window.addEventListener('picmon:portals-reloaded', onReload);
    return () => window.removeEventListener('picmon:portals-reloaded', onReload);
  }, [portalsDirty]);
  const [cam, setCam] = useState({ x: 0, y: 0, zoom: 1 });
  const [viewport, setViewport] = useState({ w: 1, h: 1 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const viewportDivRef = useRef<HTMLDivElement>(null);
  const minimapBgRef = useRef<HTMLCanvasElement | null>(null);
  const minimapSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  const loadedBaseline = useMemo(() => {
    if (!initialMap) return null;
    return JSON.stringify({
      placements: initialMap.placements,
      spawns: initialMap.spawns,
      animals: initialMap.animals ?? [],
      objects: (initialMap as { objects?: ObjectPlacement[] } | undefined)?.objects ?? [],
      battleBgFrame: initialMap.battleBgFrame,
      grassPatchBackgrounds: initialMap.grassPatchBackgrounds ?? {},
      grassPatchLevels: initialMap.grassPatchLevels ?? {},
    });
  }, [initialMap]);
  // Tracks which map the current placements/animals/etc. state is FOR.
  // Updated by the load effect below after it resets state for a new
  // activeMapId. The save effect skips writes until this matches
  // activeMapId — otherwise switching maps races the load effect and
  // stamps the OLD map's placements into the NEW map's sessionStorage
  // slot, which the load effect then reads back as "the new map's
  // unsaved state" and ultimately persists to the new map's JSON. This
  // was destroying snow_town with villageruin's town-stamp data when
  // the user switched between them in the editor.
  const [stateMapId, setStateMapId] = useState<string | null>(null);

  const effectiveBaseline = savedBaseline ?? loadedBaseline;
  // Note: `dirty` is only meaningful while the in-memory state actually
  // belongs to `activeMapId`. During a map switch there's a brief window
  // where state still holds the previous map's data; gating dirty on
  // stateMapId avoids a false-positive that would let the user save the
  // wrong map's content to disk.
  const dirty =
    stateMapId === activeMapId &&
    effectiveBaseline !== null &&
    effectiveBaseline !== JSON.stringify({
      placements, spawns, animals, objects, battleBgFrame, grassPatchBackgrounds, grassPatchLevels,
    });

  // Snapshot the editor's per-map dirty state to sessionStorage on every
  // change. Together with the loadSession-seeded useState initializers
  // above, this means a Vite Fast Refresh remount (or accidental tab
  // refresh) restores in-progress placements/animals/spawns instead of
  // resetting to MAP_CATALOG (which is stale until the user actually
  // saves). Cleared in save() once disk catches up.
  useEffect(() => {
    if (stateMapId !== activeMapId) return; // mid-switch — don't poison the new map's slot
    try {
      const snapshot: DirtySnapshot = {
        placements,
        animals,
        objects,
        spawns,
        battleBgFrame,
        grassPatchBackgrounds,
        grassPatchLevels,
      };
      sessionStorage.setItem(`editor:dirty:${activeMapId}`, JSON.stringify(snapshot));
    } catch { /* sessionStorage full / disabled — no rescue, but UI keeps working */ }
  }, [stateMapId, activeMapId, placements, animals, objects, spawns, battleBgFrame, grassPatchBackgrounds, grassPatchLevels]);

  // Reset state + reload assets when the active map changes. The Sprite
  // Fusion loader caches by path, so repeated switches back to the same map
  // are cheap.
  useEffect(() => {
    // Hold off until disk detection resolves (undefined), and skip maps the
    // detection says aren't loadable — the correction effect below switches
    // activeMapId to one that is, which retriggers this load. Prevents a
    // flash of "Failed to load …png" when the catalog default isn't on disk.
    if (diskMaps === undefined) return;
    if (diskMaps && !diskMaps.includes(activeMapId)) return;
    const def = MAP_CATALOG[activeMapId];
    if (!def) return;
    // Prefer the unsaved sessionStorage snapshot for this map id over
    // MAP_CATALOG. Without this, switching back to a map that has
    // unsaved changes would silently revert them.
    let snap: Partial<DirtySnapshot> | null = null;
    try {
      const raw = sessionStorage.getItem(`editor:dirty:${activeMapId}`);
      if (raw) snap = JSON.parse(raw);
    } catch { /* ignore */ }
    setPlacements(snap?.placements ?? def.placements);
    setAnimals(snap?.animals ?? (def.animals ?? []).map((a) => ({ ...a })));
    setObjects(snap?.objects ?? ((def as { objects?: ObjectPlacement[] }).objects ?? []).map((o) => ({ ...o })));
    setSpawns(snap?.spawns ?? { ...def.spawns });
    setBattleBgFrame(snap?.battleBgFrame ?? (def.battleBgFrame as BgFrameName | undefined));
    setGrassPatchBackgrounds(snap?.grassPatchBackgrounds ?? { ...((def.grassPatchBackgrounds as Record<string, BgFrameName> | undefined) ?? {}) });
    setGrassPatchLevels(snap?.grassPatchLevels ?? { ...(def.grassPatchLevels ?? {}) });
    setSelection(new Set());
    setInteraction(null);
    setEditColliderIndex(null);
    setSavedBaseline(null);
    setSaveStatus('idle');
    setSaveError(null);
    // Mark state as belonging to this map so the dirty-state save effect
    // can resume writing once React batches the setState calls above.
    setStateMapId(activeMapId);
    // Force map/tilesheet re-load for the new id.
    setMap(null);
    setTilesheet(null);

    // Re-center the camera on the new map's default spawn. Without this the
    // cam stays at the previous map's coordinates — if the player was panned
    // off the right edge of villageruin and switches to a smaller map like
    // cave1, the viewport was OFF the cave map. "+ NPC" then placed mons at
    // world tiles outside the cave bounds, so the user reported "can't add
    // NPCs to the cave" — the NPCs were created but invisible offscreen.
    const spawn = def.spawns?.['default'];
    if (spawn) {
      const wx = spawn.tileX * TILE_SIZE + TILE_SIZE / 2;
      const wy = spawn.tileY * TILE_SIZE + TILE_SIZE / 2;
      setCam((c) => ({ ...c, x: wx - viewport.w / 2 / c.zoom, y: wy - viewport.h / 2 / c.zoom }));
    } else {
      // Fallback: center on the map's geometric middle if no default spawn.
      setCam((c) => ({ ...c, x: 0, y: 0 }));
    }

    // Clear any prior load error now that we're loading a map we believe is
    // present — so switching off a broken map dismisses its error banner.
    setError(null);
    let cancelled = false;
    const jsonPath = mapJsonPath(activeMapId);
    const tilesheetPath = mapTilesheetPath(activeMapId);
    Promise.all([
      loadSpriteFusionMap(jsonPath, tilesheetPath),
      loadImage(tilesheetPath),
    ])
      .then(([m, img]) => { if (!cancelled) { setMap(m); setTilesheet(img); } })
      .catch((err) => { if (!cancelled) setError(String(err)); });
    return () => { cancelled = true; };
  }, [activeMapId, diskMaps]);

  // Detect which maps actually exist on disk so the dropdown and default
  // never point at a phantom catalog entry whose tile assets aren't present.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/editor/list-maps');
        if (!res.ok) throw new Error(`list-maps ${res.status}`);
        const { maps, tilesheets } = await res.json() as { maps: string[]; tilesheets: string[] };
        const sheetSet = new Set(tilesheets);
        const tilesheetBaseOf = (id: string) =>
          mapTilesheetPath(id).replace(/^world\/maps\//, '').replace(/\.png$/i, '');
        // Loadable = has a catalog entry (so its def + placement data exist)
        // AND its (possibly shared) tilesheet PNG is present on disk.
        const loadable = maps
          .filter((id) => !!MAP_CATALOG[id] && sheetSet.has(tilesheetBaseOf(id)))
          .sort((a, b) => a.localeCompare(b));
        if (!cancelled) setDiskMaps(loadable);
      } catch {
        // No dev API (prod build / static preview) — fall back to the catalog.
        if (!cancelled) setDiskMaps(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Once detection resolves, make sure the active map is one we can load.
  // Catalog defaults (incl. the villageruin fallback) may point at a map
  // whose assets aren't in this checkout.
  useEffect(() => {
    if (!diskMaps || diskMaps.length === 0) return;
    if (diskMaps.includes(activeMapId)) return;
    const stored = readLastMap();
    setActiveMapId(diskMaps.includes(stored) ? stored : diskMaps[0]!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diskMaps]);

  // Remember the last map so a reload reopens it instead of the default.
  useEffect(() => {
    try { localStorage.setItem('editor:last-map', activeMapId); } catch { /* ignore */ }
  }, [activeMapId]);

  // Keep `npcImages` in sync with whatever sprite paths NPC_CATALOG currently
  // references. Re-fires on HMR when a saved NPC's `character` field changes
  // so the new sprite's image is loaded and appears on the canvas without a
  // full page refresh.
  const npcSpritesKey = useMemo(
    () => Object.values(NPC_CATALOG).map((n) => n.sprite).sort().join('|'),
    // NPC_CATALOG is rebuilt as a new object on every HMR of maps.ts, so
    // depending on its identity re-runs this effect whenever any NPC file
    // changes. The stringified key above also catches actual content changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [NPC_CATALOG],
  );
  useEffect(() => {
    let cancelled = false;
    const srcs = Array.from(new Set(Object.values(NPC_CATALOG).map((n) => n.sprite)));
    Promise.all(srcs.map(async (src) => [src, await loadImage(src)] as const))
      .then((pairs) => {
        if (cancelled) return;
        setNpcImages((prev) => {
          const next = { ...prev };
          for (const [src, img] of pairs) next[src] = img;
          return next;
        });
      })
      .catch((err) => { if (!cancelled) setError(String(err)); });
    return () => { cancelled = true; };
  }, [npcSpritesKey]);

  // ALSO load sprites referenced by any in-progress NPC draft (i.e. the
  // user picked a new character in the dropdown but hasn't saved yet)
  // AND by any runtime override (NPC created via "+ NPC"). Without this
  // the canvas can't draw the live preview because npcImages has no
  // entry for the not-yet-on-disk sprite path — Walt would render with
  // his old sprite OR vanish entirely until Save NPC.
  const draftSpritesKey = useMemo(() => {
    const draftChars = Object.values(npcDrafts).map((d) => d.character).filter(Boolean);
    const ovSrcs = Object.values(npcOverrides).map((o) => o.sprite).filter(Boolean);
    return [...draftChars, ...ovSrcs].sort().join('|');
  }, [npcDrafts, npcOverrides]);
  useEffect(() => {
    let cancelled = false;
    const fromDrafts = Object.values(npcDrafts)
      .map((d) => d.character)
      .filter(Boolean)
      .map((c) => `world/npcs/Character/${c}/SpriteSheet.png`);
    const fromOverrides = Object.values(npcOverrides)
      .map((o) => o.sprite)
      .filter(Boolean);
    const need = Array.from(new Set([...fromDrafts, ...fromOverrides]));
    Promise.all(
      need.map(async (src) => {
        try { return [src, await loadImage(src)] as const; }
        catch { return [src, null] as const; }
      }),
    ).then((pairs) => {
      if (cancelled) return;
      setNpcImages((prev) => {
        const next = { ...prev };
        for (const [src, img] of pairs) if (img) next[src] = img;
        return next;
      });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftSpritesKey]);

  // Load JSON atlases for NPCs that are facing-locked, so the canvas can draw
  // them in the correct stand frame. Only fetched for placed stay-put NPCs
  // with a faceDirection — everyone else uses the top-left frame and needs no
  // atlas. `loadSpritesheet` caches globally; we mirror into state to re-render.
  const facingSheetKey = useMemo(() => {
    const paths = new Set<string>();
    for (const p of placements) {
      const d = draftForNpc(p.npcId);
      if (d.stationary && d.faceDirection) {
        const npc = resolveNpc(p.npcId);
        if (npc?.spriteJson) paths.add(npc.spriteJson);
      }
    }
    return Array.from(paths).sort().join('|');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placements, npcDrafts, npcOverrides]);
  useEffect(() => {
    if (!facingSheetKey) return;
    let cancelled = false;
    const paths = facingSheetKey.split('|').filter(Boolean);
    Promise.all(paths.map(async (jp) => {
      try { return [jp, await loadSpritesheet(jp)] as const; }
      catch { return [jp, null] as const; }
    })).then((pairs) => {
      if (cancelled) return;
      setNpcSheets((prev) => {
        const next = { ...prev };
        for (const [jp, sheet] of pairs) if (sheet) next[jp] = sheet;
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [facingSheetKey]);

  // Viewport size tracking.
  useEffect(() => {
    const el = viewportDivRef.current;
    if (!el) return;
    const apply = () => {
      const r = el.getBoundingClientRect();
      setViewport({ w: Math.max(1, Math.floor(r.width)), h: Math.max(1, Math.floor(r.height)) });
    };
    apply();
    const obs = new ResizeObserver(apply);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Initial camera on first load (and after every map switch): 100% zoom,
  // centered on the map's midpoint — OR, if the user just clicked a "jump
  // to this half" button, centered on that tile instead.
  useEffect(() => {
    if (!map || viewport.w <= 1) return;
    const mapPxW = map.data.mapWidth * TILE_SIZE;
    const mapPxH = map.data.mapHeight * TILE_SIZE;
    const zoom = 1;
    let focusX = mapPxW / 2;
    let focusY = mapPxH / 2;
    if (pendingFocus && pendingFocus.mapId === activeMapId) {
      focusX = pendingFocus.tileX * TILE_SIZE + TILE_SIZE / 2;
      focusY = pendingFocus.tileY * TILE_SIZE + TILE_SIZE / 2;
      if (pendingFocus.selection) setSelection(pendingFocus.selection);
      setPendingFocus(null);
    }
    setCam({
      x: focusX - viewport.w / 2 / zoom,
      y: focusY - viewport.h / 2 / zoom,
      zoom,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, tilesheet]);

  // Cached minimap background. Pick an INTEGER pixels-per-tile so each source
  // tile lands on whole minimap pixels — no fractional sampling, no aliasing.
  useEffect(() => {
    if (!map || !tilesheet) return;
    const W = map.data.mapWidth;
    const H = map.data.mapHeight;
    const K = Math.max(1, Math.min(8, Math.floor(MINIMAP_TARGET / Math.max(W, H))));
    const w = W * K;
    const h = H * K;
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const ctx = off.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, w, h);
    const srcTile = map.data.tileSize;
    const cols = Math.max(1, Math.floor(tilesheet.width / srcTile));
    for (const L of [...map.data.layers].reverse()) {
      for (const t of L.tiles) {
        if (map.emptyIds.has(parseInt(t.id, 10))) continue;
        const { sx, sy } = tileSrcXY(t.id, cols, srcTile);
        ctx.drawImage(tilesheet, sx, sy, srcTile, srcTile, t.x * K, t.y * K, K, K);
      }
    }
    minimapBgRef.current = off;
    minimapSizeRef.current = { w, h };
  }, [map, tilesheet]);

  // ── Main canvas render ──
  useEffect(() => {
    if (!map || !tilesheet) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = viewport.w;
    canvas.height = viewport.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, viewport.w, viewport.h);

    /** Draw a centered text label with a black pill behind it, sized to
     *  fit the actual text. `cx, bottomY` is the center-x and the bottom
     *  edge of the 14-px-tall background bar (text baseline sits at
     *  bottomY - 4). Use this everywhere instead of hard-coding a tile-
     *  width rect — older code used `TILE_SIZE + 8` which clipped any
     *  name longer than ~4 chars. */
    const drawEntityLabel = (text: string, cx: number, bottomY: number, color: string) => {
      ctx.font = '10px monospace';
      const padX = 4;
      const w = ctx.measureText(text).width + padX * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(cx - w / 2, bottomY - 14, w, 14);
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(text, cx, bottomY - 4);
      ctx.textAlign = 'start';
    };

    ctx.save();
    // setTransform lets us floor the translate in SCREEN space, not world
    // space. At zooms where 1 world pixel != 1 screen pixel (e.g. 33%, 67%),
    // flooring cam.x gives a world-integer offset whose screen-space value is
    // still fractional → adjacent tiles land on partial pixels → black seams.
    // Flooring `cam.x * zoom` keeps every tile boundary pixel-aligned.
    const tx = -Math.floor(cam.x * cam.zoom);
    const ty = -Math.floor(cam.y * cam.zoom);
    ctx.setTransform(cam.zoom, 0, 0, cam.zoom, tx, ty);

    const srcTile = map.data.tileSize;
    const cols = Math.max(1, Math.floor(tilesheet.width / srcTile));
    const x0 = Math.max(0, Math.floor(cam.x / TILE_SIZE) - 1);
    const x1 = Math.min(map.data.mapWidth, Math.ceil((cam.x + viewport.w / cam.zoom) / TILE_SIZE) + 1);
    const y0 = Math.max(0, Math.floor(cam.y / TILE_SIZE) - 1);
    const y1 = Math.min(map.data.mapHeight, Math.ceil((cam.y + viewport.h / cam.zoom) / TILE_SIZE) + 1);

    for (const L of [...map.data.layers].reverse()) {
      for (const t of L.tiles) {
        if (t.x < x0 || t.x >= x1 || t.y < y0 || t.y >= y1) continue;
        if (map.emptyIds.has(parseInt(t.id, 10))) continue;
        const { sx, sy } = tileSrcXY(t.id, cols, srcTile);
        ctx.drawImage(
          tilesheet,
          sx, sy, srcTile, srcTile,
          t.x * TILE_SIZE, t.y * TILE_SIZE,
          TILE_SIZE, TILE_SIZE,
        );
      }
    }

    if (showGrid && cam.zoom > 0.25) {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1 / cam.zoom;
      ctx.beginPath();
      for (let tx = x0; tx <= x1; tx++) {
        const wx = tx * TILE_SIZE;
        ctx.moveTo(wx, y0 * TILE_SIZE);
        ctx.lineTo(wx, y1 * TILE_SIZE);
      }
      for (let ty = y0; ty <= y1; ty++) {
        const wy = ty * TILE_SIZE;
        ctx.moveTo(x0 * TILE_SIZE, wy);
        ctx.lineTo(x1 * TILE_SIZE, wy);
      }
      ctx.stroke();
    }

    // Grass-patch overlay — every tagged patch gets a translucent override
    // tint (so the user can see at a glance which patches differ from the
    // map default), and the selected patch additionally gets a yellow
    // outline around every tile that belongs to it.
    {
      const patches = getGrassPatches(map);
      for (const p of patches) {
        const isSel = selection.has(grassKey(p.signTile.tx, p.signTile.ty));
        const hasOverride = !!grassPatchBackgrounds[`${p.signTile.tx},${p.signTile.ty}`];
        if (!isSel && !hasOverride) continue;
        for (const t of p.tiles) {
          if (t.tx < x0 - 1 || t.tx >= x1 + 1 || t.ty < y0 - 1 || t.ty >= y1 + 1) continue;
          const wx = t.tx * TILE_SIZE;
          const wy = t.ty * TILE_SIZE;
          if (hasOverride) {
            ctx.fillStyle = 'rgba(180, 100, 255, 0.18)';
            ctx.fillRect(wx, wy, TILE_SIZE, TILE_SIZE);
          }
          if (isSel) {
            ctx.strokeStyle = '#ffd93d';
            ctx.lineWidth = 2 / cam.zoom;
            ctx.strokeRect(wx + 0.5, wy + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
          }
        }
      }
    }

    // Object rendering helper. Objects are drawn in three passes against
    // the player's z-order — 'behind' before NPCs/animals, 'sort' after
    // them, 'front' after signs — controlled by each object's drawOrder
    // field. Defining the helper here (once) so all three passes share
    // identical draw / selection / collision-visualization code.
    const drawObjectAt = (i: number) => {
      const o = objects[i]!;
      if (o.tileX < x0 - 1 || o.tileX >= x1 + 1 || o.tileY < y0 - 1 || o.tileY >= y1 + 1) return;
      const src = `world/tilesets/${o.image}`;
      const img = objectImages[src];
      const { frameW, frameH } = frameDimsFor(o.image);
      // World-pixel placement rect — bottom-centered on the tile so sub-
      // tile assets sit on the ground (matches the runtime renderer).
      const k = TILE_SIZE / 16;
      const { dx, dy, dw, dh } = objectRectFor(o);
      if (img) {
        const frameCount = Math.max(1, Math.floor(img.naturalWidth / frameW));
        // Per-placement phase offset so a row of flags doesn't flap in
        // lockstep. Deterministic hash of tile coords + image path so the
        // phase is stable across renders/reloads. Set
        // `randomizeFrameStart: false` on the placement to opt out and
        // force frame-0 start (synchronized animation).
        let phase = 0;
        if (o.randomizeFrameStart !== false) {
          let h = (o.tileX * 73856093) ^ (o.tileY * 19349663);
          for (let c = 0; c < o.image.length; c++) h = (h * 31 + o.image.charCodeAt(c)) | 0;
          phase = ((h % frameCount) + frameCount) % frameCount;
        }
        const frame = (objectAnimTick + phase) % frameCount;
        ctx.drawImage(img, frame * frameW, 0, frameW, frameH, dx, dy, dw, dh);
      } else {
        ctx.fillStyle = '#5a3a78';
        ctx.fillRect(dx, dy, dw, dh);
      }
      const isSelected = selection.has(objectKey(i));
      if (o.blocksPassage) {
        // Dashed red box around the collider rect — custom colliderBox
        // wins, otherwise the folder default (e.g. all flags share one),
        // otherwise the auto-cropped alpha bbox. Falls back to the full
        // frame when the bbox isn't known yet.
        const cb = o.colliderBox ?? folderColliderDefaults[folderOf(o.image)] ?? objectBBoxes[src] ?? null;
        const rx = cb ? dx + cb.x * k : dx;
        const ry = cb ? dy + cb.y * k : dy;
        const rw = cb ? cb.w * k : dw;
        const rh = cb ? cb.h * k : dh;
        const editing = editColliderIndex === i;
        ctx.strokeStyle = editing ? '#ffd93d' : (isSelected ? '#ffd93d' : '#f66');
        ctx.lineWidth = 2 / cam.zoom;
        ctx.setLineDash([4 / cam.zoom, 3 / cam.zoom]);
        ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
        ctx.setLineDash([]);
        if (editing) {
          // 8 grab handles (corners + edge midpoints). Handles are sized
          // in screen px so they stay clickable when zoomed out.
          const hs = 8 / cam.zoom;
          const xs = [rx, rx + rw / 2, rx + rw];
          const ys = [ry, ry + rh / 2, ry + rh];
          ctx.fillStyle = '#ffd93d';
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 1 / cam.zoom;
          for (const hy of ys) {
            for (const hx of xs) {
              if (hx === xs[1] && hy === ys[1]) continue; // skip center
              ctx.fillRect(hx - hs, hy - hs, hs * 2, hs * 2);
              ctx.strokeRect(hx - hs, hy - hs, hs * 2, hs * 2);
            }
          }
        }
      }
      // Selection outline encloses the larger of the anchor tile or the
      // rendered sprite, whichever is bigger. Sub-tile assets (10×8
      // flower) get a normal grid-square box; super-tile assets (32×32
      // quicksand) get a box that wraps the full 2×2-tile silhouette so
      // the user can see what they actually grabbed.
      const tilePxX = o.tileX * TILE_SIZE;
      const tilePxY = o.tileY * TILE_SIZE;
      const ox = Math.min(tilePxX, dx);
      const oy = Math.min(tilePxY, dy);
      const ox2 = Math.max(tilePxX + TILE_SIZE, dx + dw);
      const oy2 = Math.max(tilePxY + TILE_SIZE, dy + dh);
      if (isSelected) {
        ctx.strokeStyle = '#ffd93d';
        ctx.lineWidth = 3 / cam.zoom;
        ctx.strokeRect(ox - 1, oy - 1, ox2 - ox + 2, oy2 - oy + 2);
        // Label only when selected — keeps a densely-decorated map from
        // becoming a wall of text. Object name (+ non-default draw order
        // tag) lives in the sidebar inspector too, so this is just a
        // canvas-side confirmation of what you grabbed.
        const baseLabel = o.image.replace(/^.*\//, '').replace(/\.png$/i, '');
        const dz = o.drawOrder ?? 'under';
        const tag = dz === 'under' ? '' : ` · ${dz}`;
        drawEntityLabel(baseLabel + tag, (ox + ox2) / 2, oy, '#ffd93d');
      }
    };

    // Pass 1/3 — 'behind' objects render before NPCs/animals/signs so
    // those entities visually sit on top.
    for (let i = 0; i < objects.length; i++) {
      if ((objects[i]!.drawOrder ?? 'under') === 'under') drawObjectAt(i);
    }

    // NPCs.
    for (const p of placements) {
      if (p.tileX < x0 - 1 || p.tileX >= x1 + 1 || p.tileY < y0 - 1 || p.tileY >= y1 + 1) continue;
      const npc = resolveNpc(p.npcId);
      if (!npc) continue;
      const img = npcImages[npc.sprite];
      const dx = p.tileX * TILE_SIZE;
      const dy = p.tileY * TILE_SIZE;
      if (img) {
        // Default to the top-left frame. A facing-locked stay-put NPC previews
        // in the stand frame for its direction so the editor matches what the
        // player will see in-game (packed atlas → read coords from the sheet).
        let sx = 0, sy = 0, sw = 16, sh = 16;
        const fd = draftForNpc(p.npcId);
        if (fd.stationary && fd.faceDirection && npc.spriteJson) {
          const sheet = npcSheets[npc.spriteJson];
          const frameName = sheet ? resolveFrame(sheet, fd.faceDirection, 0) : null;
          const fr = frameName ? sheet!.frames[frameName]?.frame : undefined;
          if (fr) { sx = fr.x; sy = fr.y; sw = fr.w; sh = fr.h; }
        }
        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, TILE_SIZE, TILE_SIZE);
      } else {
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(dx, dy, TILE_SIZE, TILE_SIZE);
      }
      const isSelected = selection.has(npcKey(p.npcId));
      if (isSelected) {
        ctx.strokeStyle = '#ffd93d';
        ctx.lineWidth = 3 / cam.zoom;
        ctx.strokeRect(dx - 1, dy - 1, TILE_SIZE + 2, TILE_SIZE + 2);
      }
      drawEntityLabel(npc.name, dx + TILE_SIZE / 2, dy, isSelected ? '#ffd93d' : '#fff');
    }

    // Animals — one row on top of each placement tile. Sprite sheets are
    // small (~16×16 for a dog, ~24×16 for a horse) so we just draw the
    // first frame of the sheet (top-left 16px block) as a cheap preview.
    // Good enough to differentiate species without loading every frame.
    for (let i = 0; i < animals.length; i++) {
      const a = animals[i]!;
      if (a.tileX < x0 - 1 || a.tileX >= x1 + 1 || a.tileY < y0 - 1 || a.tileY >= y1 + 1) continue;
      const { sprite } = animalSpritePaths(a.type, a.sheet);
      const img = animalImages[sprite];
      const dx = a.tileX * TILE_SIZE;
      const dy = a.tileY * TILE_SIZE;
      if (img) {
        ctx.drawImage(img, 0, 0, 16, 16, dx, dy, TILE_SIZE, TILE_SIZE);
      } else {
        ctx.fillStyle = '#2e7d32';
        ctx.fillRect(dx, dy, TILE_SIZE, TILE_SIZE);
      }
      const isSelected = selection.has(animalKey(i));
      if (isSelected) {
        ctx.strokeStyle = '#ffd93d';
        ctx.lineWidth = 3 / cam.zoom;
        ctx.strokeRect(dx - 1, dy - 1, TILE_SIZE + 2, TILE_SIZE + 2);
        // Wander fence overlay so the user can see the roam range while
        // editing — light green square centered on spawn, size 2*wanderTiles.
        const half = a.wanderTiles * TILE_SIZE;
        ctx.strokeStyle = 'rgba(74,222,128,0.5)';
        ctx.setLineDash([6 / cam.zoom, 4 / cam.zoom]);
        ctx.lineWidth = 1.5 / cam.zoom;
        ctx.strokeRect(dx - half, dy - half, TILE_SIZE + half * 2, TILE_SIZE + half * 2);
        ctx.setLineDash([]);
      }
      const label = a.sheet && a.sheet !== 'SpriteSheet'
        ? `${a.type} · ${a.sheet.replace(/^SpriteSheet/i, '').replace(/^SpriteSheeL/i, '') || a.sheet}`
        : a.type;
      drawEntityLabel(label, dx + TILE_SIZE / 2, dy, isSelected ? '#ffd93d' : '#9f9');
    }

    // Pass 2/3 — 'sort' objects (Y-sort with the player). Best-effort
    // editor preview: rendered after NPCs/animals so they cover the
    // entities, mirroring "object foot is below entity foot" in the
    // canonical case. The in-game renderer does a real Y-sort.
    for (let i = 0; i < objects.length; i++) {
      if (objects[i]!.drawOrder === 'sort') drawObjectAt(i);
    }

    // World signs. PNG sprite fits to the sign's full footprint
    // (1 tile for sign_1..7, 2 for sign_wide2, 3 for sign_wide3).
    // The 'no_sprite' variant is an invisible in-game marker — but in the
    // editor we draw a dashed-outline placeholder so designers can still
    // see, select, and drag it.
    for (const s of signs) {
      if (s.mapId !== activeMapId) continue;
      const w = getSignWidth(s.sprite);
      if (s.tileX + w - 1 < x0 - 1 || s.tileX >= x1 + 1) continue;
      if (s.tileY < y0 - 1 || s.tileY >= y1 + 1) continue;
      const dx = s.tileX * TILE_SIZE;
      const dy = s.tileY * TILE_SIZE;
      const dw = w * TILE_SIZE;
      const dh = TILE_SIZE;
      if (s.sprite === 'no_sprite') {
        // Hatched fill + dashed outline so it reads as "invisible marker".
        ctx.fillStyle = 'rgba(155, 208, 255, 0.18)';
        ctx.fillRect(dx, dy, dw, dh);
        ctx.strokeStyle = '#9bd0ff';
        ctx.lineWidth = 1.5 / cam.zoom;
        ctx.setLineDash([6 / cam.zoom, 4 / cam.zoom]);
        ctx.strokeRect(dx + 1, dy + 1, dw - 2, dh - 2);
        ctx.setLineDash([]);
      } else {
        const img = signImages[s.sprite];
        if (img) {
          ctx.drawImage(img, dx, dy, dw, dh);
        } else {
          ctx.fillStyle = '#8f6842';
          ctx.fillRect(dx, dy, dw, dh);
        }
      }
      const isSelected = selection.has(signKey(s.id));
      if (isSelected) {
        ctx.strokeStyle = '#ffd93d';
        ctx.lineWidth = 3 / cam.zoom;
        ctx.strokeRect(dx - 1, dy - 1, dw + 2, dh + 2);
      }
      drawEntityLabel(s.id, dx + dw / 2, dy, isSelected ? '#ffd93d' : '#cce');
    }

    // Pass 3/3 — 'front' objects (canopy / above-player). Drawn last so
    // they sit on top of every world entity, like the SF `overlay` layer.
    for (let i = 0; i < objects.length; i++) {
      if (objects[i]!.drawOrder === 'overlay') drawObjectAt(i);
    }

    // Spawn.
    const sx = spawn.tileX * TILE_SIZE + TILE_SIZE / 2;
    const sy = spawn.tileY * TILE_SIZE + TILE_SIZE / 2;
    const spawnSelected = selection.has(SPAWN_KEY);
    ctx.strokeStyle = spawnSelected ? '#ffd93d' : '#3af';
    ctx.lineWidth = 3 / cam.zoom;
    ctx.beginPath();
    ctx.arc(sx, sy, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = spawnSelected ? '#ffd93d' : '#3af';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SPAWN', sx, sy + 4);
    ctx.textAlign = 'start';

    // ── Portals ──
    for (const p of portals) {
      const aOnMap = p.a.mapId === activeMapId;
      const bOnMap = p.b.mapId === activeMapId;
      if (!aOnMap && !bOnMap) continue;

      const drawHalf = (side: 'a' | 'b', half: PortalHalf) => {
        const rx = half.rect.tileX * TILE_SIZE;
        const ry = half.rect.tileY * TILE_SIZE;
        const rw = half.rect.w * TILE_SIZE;
        const rh = half.rect.h * TILE_SIZE;
        const rectSelected = selection.has(portalRectKey(p.id, side));
        // Rect — magenta tint for A, teal tint for B, so the two halves are
        // visually distinguishable when both are on the same map.
        const tint = side === 'a' ? 'rgba(255,66,196,' : 'rgba(51,220,200,';
        const edge = side === 'a' ? '#ff42c4' : '#33dcc8';
        ctx.fillStyle = tint + '0.18)';
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeStyle = rectSelected ? '#ffd93d' : edge;
        ctx.lineWidth = (rectSelected ? 3 : 2) / cam.zoom;
        ctx.strokeRect(rx, ry, rw, rh);

        // Destination badge — "→ cave1" if other half is on a different map.
        const other = side === 'a' ? p.b : p.a;
        const label = other.mapId === activeMapId
          ? `↔ same-map (${p.id})`
          : `→ ${other.mapId} (${p.id})`;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        const labelW = ctx.measureText(label).width + 8;
        ctx.fillRect(rx, ry - 14, Math.max(rw, labelW), 14);
        ctx.fillStyle = rectSelected ? '#ffd93d' : '#fff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'start';
        ctx.fillText(label, rx + 4, ry - 4);

        // Arrival spawn — small diamond so it's distinguishable from the
        // default SPAWN circle.
        const sxW = half.spawn.tileX * TILE_SIZE + TILE_SIZE / 2;
        const syW = half.spawn.tileY * TILE_SIZE + TILE_SIZE / 2;
        const spawnSelected = selection.has(portalSpawnKey(p.id, side));
        ctx.fillStyle = spawnSelected ? '#ffd93d' : edge;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1 / cam.zoom;
        ctx.beginPath();
        ctx.moveTo(sxW, syW - 10);
        ctx.lineTo(sxW + 10, syW);
        ctx.lineTo(sxW, syW + 10);
        ctx.lineTo(sxW - 10, syW);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#000';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(side.toUpperCase(), sxW, syW + 3);
        ctx.textAlign = 'start';

        // Corner resize handles on the selected rect.
        if (rectSelected) {
          const r = half.rect;
          const corners: Array<[number, number]> = [
            [r.tileX - 1,     r.tileY - 1],     // nw
            [r.tileX + r.w,   r.tileY - 1],     // ne
            [r.tileX - 1,     r.tileY + r.h],   // sw
            [r.tileX + r.w,   r.tileY + r.h],   // se
          ];
          const hSize = TILE_SIZE * 0.8;
          const off = (TILE_SIZE - hSize) / 2;
          for (const [cx, cy] of corners) {
            const wx = cx * TILE_SIZE + off;
            const wy = cy * TILE_SIZE + off;
            ctx.fillStyle = '#ffd93d';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1 / cam.zoom;
            ctx.fillRect(wx, wy, hSize, hSize);
            ctx.strokeRect(wx, wy, hSize, hSize);
          }
        }
      };

      if (aOnMap) drawHalf('a', p.a);
      if (bOnMap) drawHalf('b', p.b);

      // Dotted A↔B link line if both halves are on this map.
      if (aOnMap && bOnMap) {
        const ax = p.a.rect.tileX * TILE_SIZE + (p.a.rect.w * TILE_SIZE) / 2;
        const ay = p.a.rect.tileY * TILE_SIZE + (p.a.rect.h * TILE_SIZE) / 2;
        const bx = p.b.rect.tileX * TILE_SIZE + (p.b.rect.w * TILE_SIZE) / 2;
        const by = p.b.rect.tileY * TILE_SIZE + (p.b.rect.h * TILE_SIZE) / 2;
        ctx.save();
        ctx.setLineDash([6 / cam.zoom, 4 / cam.zoom]);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.5 / cam.zoom;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Selection box overlay (while dragging).
    if (interaction?.kind === 'box') {
      const a = interaction.startTile;
      const b = interaction.endTile;
      const bx = Math.min(a.tileX, b.tileX) * TILE_SIZE;
      const by = Math.min(a.tileY, b.tileY) * TILE_SIZE;
      const bw = (Math.abs(a.tileX - b.tileX) + 1) * TILE_SIZE;
      const bh = (Math.abs(a.tileY - b.tileY) + 1) * TILE_SIZE;
      ctx.fillStyle = 'rgba(255,217,61,0.12)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = '#ffd93d';
      ctx.lineWidth = 1.5 / cam.zoom;
      ctx.strokeRect(bx, by, bw, bh);
    }

    ctx.restore();
  }, [map, tilesheet, npcImages, npcSheets, npcDrafts, placements, animals, animalImages, objects, objectImages, objectBBoxes, objectAnimTick, editColliderIndex, signs, signImages, spawn, portals, activeMapId, selection, cam, viewport, showGrid, interaction, npcOverrides]);

  // ── Minimap render ──
  useEffect(() => {
    if (!map) return;
    const mini = minimapRef.current;
    const bg = minimapBgRef.current;
    if (!mini || !bg) return;
    const { w, h } = minimapSizeRef.current;
    mini.width = w; mini.height = h;
    const ctx = mini.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bg, 0, 0);

    const mapPxW = map.data.mapWidth * TILE_SIZE;
    const mapPxH = map.data.mapHeight * TILE_SIZE;
    const rx = (cam.x / mapPxW) * w;
    const ry = (cam.y / mapPxH) * h;
    const rw = (viewport.w / cam.zoom / mapPxW) * w;
    const rh = (viewport.h / cam.zoom / mapPxH) * h;
    ctx.strokeStyle = '#ffd93d';
    ctx.lineWidth = 2;
    ctx.strokeRect(rx, ry, rw, rh);

    ctx.fillStyle = '#ff66c4';
    for (const p of placements) {
      const mx = (p.tileX * TILE_SIZE / mapPxW) * w;
      const my = (p.tileY * TILE_SIZE / mapPxH) * h;
      ctx.fillRect(mx - 1, my - 1, 3, 3);
    }
    ctx.fillStyle = '#4ade80';
    for (const a of animals) {
      const mx = (a.tileX * TILE_SIZE / mapPxW) * w;
      const my = (a.tileY * TILE_SIZE / mapPxH) * h;
      ctx.fillRect(mx - 1, my - 1, 3, 3);
    }
    ctx.fillStyle = '#3af';
    const smx = (spawn.tileX * TILE_SIZE / mapPxW) * w;
    const smy = (spawn.tileY * TILE_SIZE / mapPxH) * h;
    ctx.fillRect(smx - 2, smy - 2, 5, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, cam, viewport, placements, animals, spawn, minimapBgRef.current]);

  // ── Coordinate helpers ──
  function mouseToTile(e: { clientX: number; clientY: number }) {
    const canvas = canvasRef.current;
    if (!canvas) return { tileX: 0, tileY: 0 };
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    return {
      tileX: Math.floor((mx / cam.zoom + cam.x) / TILE_SIZE),
      tileY: Math.floor((my / cam.zoom + cam.y) / TILE_SIZE),
    };
  }
  /** Sub-tile world-pixel coords. Used by the collider drag handles where
   *  whole-tile precision (the usual `mouseToTile`) would be way too
   *  coarse — handles operate at source-pixel granularity (3 world px). */
  function mouseToWorldPx(e: { clientX: number; clientY: number }) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / cam.zoom + cam.x,
      y: (e.clientY - rect.top) / cam.zoom + cam.y,
    };
  }
  /** Hit-test the 8 handles + interior of the currently-edited object's
   *  collider rect. Returns the handle id (or 'move' for interior) or null
   *  if the world-px coord is outside the rect. */
  function colliderHandleAt(worldX: number, worldY: number): BlockerHandle | null {
    if (editColliderIndex === null) return null;
    const o = objects[editColliderIndex];
    if (!o || !o.blocksPassage) return null;
    const src = `world/tilesets/${o.image}`;
    const cb = o.colliderBox ?? folderColliderDefaults[folderOf(o.image)] ?? objectBBoxes[src];
    if (!cb) return null;
    const k = TILE_SIZE / 16;
    const { dx, dy } = objectRectFor(o);
    const rx = dx + cb.x * k;
    const ry = dy + cb.y * k;
    const rw = cb.w * k;
    const rh = cb.h * k;
    const hr = 10 / cam.zoom; // hit half-width, screen-px equivalent
    const xs: Array<[number, 'w' | 'c' | 'e']> = [[rx, 'w'], [rx + rw / 2, 'c'], [rx + rw, 'e']];
    const ys: Array<[number, 'n' | 'c' | 's']> = [[ry, 'n'], [ry + rh / 2, 'c'], [ry + rh, 's']];
    for (const [hy, py] of ys) {
      for (const [hx, px] of xs) {
        if (px === 'c' && py === 'c') continue;
        if (Math.abs(worldX - hx) <= hr && Math.abs(worldY - hy) <= hr) {
          return `${py === 'c' ? '' : py}${px === 'c' ? '' : px}` as BlockerHandle;
        }
      }
    }
    if (worldX >= rx && worldX <= rx + rw && worldY >= ry && worldY <= ry + rh) return 'move';
    return null;
  }

  // Portal halves that live on the currently-active map, paired with their
  // side ('a' or 'b') so hit-testing / rendering knows which side is which.
  const activePortalHalves: Array<{ portal: Portal; side: 'a' | 'b'; half: PortalHalf }> = [];
  for (const p of portals) {
    if (p.a.mapId === activeMapId) activePortalHalves.push({ portal: p, side: 'a', half: p.a });
    if (p.b.mapId === activeMapId) activePortalHalves.push({ portal: p, side: 'b', half: p.b });
  }

  // Check if the click landed on a resize corner of any currently-selected
  // portal rect. Handles are drawn just OUTSIDE the rect's four corners
  // (offset by one tile diagonally) so they don't overlap the rect body.
  function cornerHitAt(tileX: number, tileY: number): { portalId: string; side: 'a' | 'b'; corner: PortalCorner } | null {
    for (const { portal, side, half } of activePortalHalves) {
      if (!selection.has(portalRectKey(portal.id, side))) continue;
      const { rect } = half;
      const corners: Array<[PortalCorner, number, number]> = [
        ['nw', rect.tileX - 1,            rect.tileY - 1],
        ['ne', rect.tileX + rect.w,       rect.tileY - 1],
        ['sw', rect.tileX - 1,            rect.tileY + rect.h],
        ['se', rect.tileX + rect.w,       rect.tileY + rect.h],
      ];
      for (const [corner, hx, hy] of corners) {
        if (tileX === hx && tileY === hy) return { portalId: portal.id, side, corner };
      }
    }
    return null;
  }

  function itemAt(tileX: number, tileY: number): SelKey | null {
    // Portal spawns first (single-tile markers layered above rects).
    for (const { portal, side, half } of activePortalHalves) {
      if (half.spawn.tileX === tileX && half.spawn.tileY === tileY) {
        return portalSpawnKey(portal.id, side);
      }
    }
    // Portal rects (any tile inside the rect counts).
    for (const { portal, side, half } of activePortalHalves) {
      const { rect } = half;
      if (
        tileX >= rect.tileX && tileX < rect.tileX + rect.w &&
        tileY >= rect.tileY && tileY < rect.tileY + rect.h
      ) {
        return portalRectKey(portal.id, side);
      }
    }
    for (const p of placements) {
      if (p.tileX === tileX && p.tileY === tileY) return npcKey(p.npcId);
    }
    // Animals sit on a single tile like NPCs — they just render smaller.
    for (let i = 0; i < animals.length; i++) {
      const a = animals[i]!;
      if (a.tileX === tileX && a.tileY === tileY) return animalKey(i);
    }
    // Objects also sit on a single 16×16 tile.
    for (let i = 0; i < objects.length; i++) {
      const o = objects[i]!;
      if (o.tileX === tileX && o.tileY === tileY) return objectKey(i);
    }
    // World signs on this map — wide variants occupy width tiles to the
    // right of the anchor, so any cell in that span is a hit.
    for (const s of signs) {
      if (s.mapId !== activeMapId) continue;
      const w = getSignWidth(s.sprite);
      if (tileY === s.tileY && tileX >= s.tileX && tileX < s.tileX + w) {
        return signKey(s.id);
      }
    }
    if (spawn.tileX === tileX && spawn.tileY === tileY) return SPAWN_KEY;
    // Tall grass — anchor selection on the patch's sign tile so the SelKey
    // is stable regardless of which tile inside the patch the user clicks.
    if (map && isTallGrassAt(map, tileX, tileY)) {
      const patch = getGrassPatches(map).find(
        (p) => p.tiles.some((t) => t.tx === tileX && t.ty === tileY),
      );
      if (patch) return grassKey(patch.signTile.tx, patch.signTile.ty);
    }
    return null;
  }

  function originalsFor(keys: Set<SelKey>): Record<SelKey, TileCoord> {
    const out: Record<SelKey, TileCoord> = {};
    for (const k of keys) {
      if (k === SPAWN_KEY) {
        out[k] = { tileX: spawn.tileX, tileY: spawn.tileY };
      } else if (k.startsWith('npc:')) {
        const id = k.slice(4);
        const p = placements.find((pp) => pp.npcId === id);
        if (p) out[k] = { tileX: p.tileX, tileY: p.tileY };
      } else if (k.startsWith('animal:')) {
        const idx = parseInt(k.slice(7), 10);
        const a = animals[idx];
        if (a) out[k] = { tileX: a.tileX, tileY: a.tileY };
      } else if (k.startsWith('object:')) {
        const idx = parseInt(k.slice(7), 10);
        const o = objects[idx];
        if (o) out[k] = { tileX: o.tileX, tileY: o.tileY };
      } else if (k.startsWith('sign:')) {
        const id = k.slice(5);
        const s = signs.find((ss) => ss.id === id);
        if (s) out[k] = { tileX: s.tileX, tileY: s.tileY };
      } else if (k.startsWith('portal-rect:')) {
        const [, portalId, side] = k.split(':');
        if (!portalId || (side !== 'a' && side !== 'b')) continue;
        const p = portals.find((pp) => pp.id === portalId);
        if (p) {
          const h = side === 'a' ? p.a : p.b;
          out[k] = { tileX: h.rect.tileX, tileY: h.rect.tileY };
          // Lock-step shadow: whenever a portal rect is dragged, the spawn
          // rides along so the arrival tile stays where the user put it
          // relative to the rect. User can still drag the spawn alone by
          // clicking the diamond directly.
          const spawnK = portalSpawnKey(portalId, side);
          if (!out[spawnK]) {
            out[spawnK] = { tileX: h.spawn.tileX, tileY: h.spawn.tileY };
          }
        }
      } else if (k.startsWith('portal-spawn:')) {
        const [, portalId, side] = k.split(':');
        const p = portals.find((pp) => pp.id === portalId);
        if (p && (side === 'a' || side === 'b')) {
          const h = side === 'a' ? p.a : p.b;
          out[k] = { tileX: h.spawn.tileX, tileY: h.spawn.tileY };
        }
      }
    }
    return out;
  }

  function applyGroupDelta(originals: Record<SelKey, TileCoord>, dx: number, dy: number) {
    if (!map) return;
    // Clamp the delta so no item leaves the map — preserves group shape.
    // For portal rects the anchor is the top-left; we additionally constrain
    // by rect size so the far edge stays inside the map.
    let minDx = -Infinity, maxDx = Infinity, minDy = -Infinity, maxDy = Infinity;
    for (const [key, o] of Object.entries(originals)) {
      let rectW = 1, rectH = 1;
      if (key.startsWith('portal-rect:')) {
        const [, portalId, side] = key.split(':');
        const p = portals.find((pp) => pp.id === portalId);
        if (p) {
          const h = side === 'a' ? p.a : p.b;
          rectW = h.rect.w;
          rectH = h.rect.h;
        }
      } else if (key.startsWith('sign:')) {
        const id = key.slice(5);
        const s = signs.find((ss) => ss.id === id);
        if (s) rectW = getSignWidth(s.sprite);
      }
      minDx = Math.max(minDx, -o.tileX);
      maxDx = Math.min(maxDx, map.data.mapWidth - rectW - o.tileX);
      minDy = Math.max(minDy, -o.tileY);
      maxDy = Math.min(maxDy, map.data.mapHeight - rectH - o.tileY);
    }
    const cdx = clamp(dx, minDx, maxDx);
    const cdy = clamp(dy, minDy, maxDy);

    if (originals[SPAWN_KEY]) {
      const o = originals[SPAWN_KEY];
      setSpawn({ tileX: o.tileX + cdx, tileY: o.tileY + cdy });
    }
    setPlacements((prev) =>
      prev.map((p) => {
        const o = originals[npcKey(p.npcId)];
        if (!o) return p;
        return { ...p, tileX: o.tileX + cdx, tileY: o.tileY + cdy };
      }),
    );
    setAnimals((prev) =>
      prev.map((a, i) => {
        const o = originals[animalKey(i)];
        if (!o) return a;
        return { ...a, tileX: o.tileX + cdx, tileY: o.tileY + cdy };
      }),
    );
    setObjects((prev) =>
      prev.map((obj, i) => {
        const o = originals[objectKey(i)];
        if (!o) return obj;
        return { ...obj, tileX: o.tileX + cdx, tileY: o.tileY + cdy };
      }),
    );
    // Signs ride along with the same group delta.
    setSigns((prev) =>
      prev.map((s) => {
        const o = originals[signKey(s.id)];
        if (!o) return s;
        return { ...s, tileX: o.tileX + cdx, tileY: o.tileY + cdy };
      }),
    );
    // Portals: walk each side once, apply rect/spawn deltas. `originalsFor`
    // adds a shadow spawn entry whenever a rect is selected, so dragging a
    // rect naturally drags its spawn in lockstep.
    setPortals((prev) =>
      prev.map((p) => {
        const rectAOrig = originals[portalRectKey(p.id, 'a')];
        const rectBOrig = originals[portalRectKey(p.id, 'b')];
        const spawnAOrig = originals[portalSpawnKey(p.id, 'a')];
        const spawnBOrig = originals[portalSpawnKey(p.id, 'b')];
        if (!rectAOrig && !rectBOrig && !spawnAOrig && !spawnBOrig) return p;
        return {
          ...p,
          a: {
            ...p.a,
            rect: rectAOrig
              ? { ...p.a.rect, tileX: rectAOrig.tileX + cdx, tileY: rectAOrig.tileY + cdy }
              : p.a.rect,
            spawn: spawnAOrig
              ? { tileX: spawnAOrig.tileX + cdx, tileY: spawnAOrig.tileY + cdy }
              : p.a.spawn,
          },
          b: {
            ...p.b,
            rect: rectBOrig
              ? { ...p.b.rect, tileX: rectBOrig.tileX + cdx, tileY: rectBOrig.tileY + cdy }
              : p.b.rect,
            spawn: spawnBOrig
              ? { tileX: spawnBOrig.tileX + cdx, tileY: spawnBOrig.tileY + cdy }
              : p.b.spawn,
          },
        };
      }),
    );
  }

  function itemsInBox(a: TileCoord, b: TileCoord): Set<SelKey> {
    const minX = Math.min(a.tileX, b.tileX);
    const maxX = Math.max(a.tileX, b.tileX);
    const minY = Math.min(a.tileY, b.tileY);
    const maxY = Math.max(a.tileY, b.tileY);
    const hit = new Set<SelKey>();
    for (const p of placements) {
      if (p.tileX >= minX && p.tileX <= maxX && p.tileY >= minY && p.tileY <= maxY) {
        hit.add(npcKey(p.npcId));
      }
    }
    for (let i = 0; i < animals.length; i++) {
      const a = animals[i]!;
      if (a.tileX >= minX && a.tileX <= maxX && a.tileY >= minY && a.tileY <= maxY) {
        hit.add(animalKey(i));
      }
    }
    for (let i = 0; i < objects.length; i++) {
      const o = objects[i]!;
      if (o.tileX >= minX && o.tileX <= maxX && o.tileY >= minY && o.tileY <= maxY) {
        hit.add(objectKey(i));
      }
    }
    if (spawn.tileX >= minX && spawn.tileX <= maxX && spawn.tileY >= minY && spawn.tileY <= maxY) {
      hit.add(SPAWN_KEY);
    }
    for (const s of signs) {
      if (s.mapId !== activeMapId) continue;
      const w = getSignWidth(s.sprite);
      if (s.tileY < minY || s.tileY > maxY) continue;
      if (s.tileX + w - 1 < minX || s.tileX > maxX) continue;
      hit.add(signKey(s.id));
    }
    for (const { portal, side, half } of activePortalHalves) {
      if (
        half.rect.tileX <= maxX && half.rect.tileX + half.rect.w - 1 >= minX &&
        half.rect.tileY <= maxY && half.rect.tileY + half.rect.h - 1 >= minY
      ) {
        hit.add(portalRectKey(portal.id, side));
      }
      if (
        half.spawn.tileX >= minX && half.spawn.tileX <= maxX &&
        half.spawn.tileY >= minY && half.spawn.tileY <= maxY
      ) {
        hit.add(portalSpawnKey(portal.id, side));
      }
    }
    return hit;
  }

  // ── Portal CRUD ──
  function addPortalPair() {
    if (!map) return;
    // Drop the new pair at the tile currently under the viewport center
    // (whatever the user is looking at) instead of the map center. That way
    // the portal appears right where the user expects to see it.
    const worldCX = cam.x + viewport.w / 2 / cam.zoom;
    const worldCY = cam.y + viewport.h / 2 / cam.zoom;
    const cx = clamp(Math.floor(worldCX / TILE_SIZE), 0, map.data.mapWidth - 2);
    const cy = clamp(Math.floor(worldCY / TILE_SIZE), 0, map.data.mapHeight - 2);
    const id = newPortalId(portals);
    const halfOnCurrent: PortalHalf = {
      mapId: activeMapId,
      rect: { tileX: cx, tileY: cy, w: 1, h: 1 },
      spawn: { tileX: cx, tileY: cy + 1 },
    };
    // B defaults to same map (offset a bit) for a quick same-map test. User
    // can flip it to another map via the sidebar dropdown.
    const otherHalf: PortalHalf = {
      mapId: activeMapId,
      rect: { tileX: Math.min(cx + 3, map.data.mapWidth - 1), tileY: cy, w: 1, h: 1 },
      spawn: { tileX: Math.min(cx + 3, map.data.mapWidth - 1), tileY: cy + 1 },
    };
    setPortals((prev) => [...prev, { id, a: halfOnCurrent, b: otherHalf }]);
    setSelection(new Set([portalRectKey(id, 'a')]));
  }

  function deletePortalPair(id: string) {
    setPortals((prev) => prev.filter((p) => p.id !== id));
    setSelection((prev) => {
      const next = new Set(prev);
      next.delete(portalRectKey(id, 'a'));
      next.delete(portalRectKey(id, 'b'));
      next.delete(portalSpawnKey(id, 'a'));
      next.delete(portalSpawnKey(id, 'b'));
      return next;
    });
  }

  function updatePortalHalf(id: string, side: 'a' | 'b', patch: Partial<PortalHalf>) {
    setPortals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [side]: { ...(side === 'a' ? p.a : p.b), ...patch } } : p)),
    );
  }

  /** Set or clear a portal's quest gate. Pass null to remove gating; the
   *  field is dropped from the saved JSON entirely so plain portals stay
   *  clean. */
  function updatePortalGate(id: string, gate: PortalGate | null) {
    setPortals((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (gate === null) {
          const { gate: _drop, ...rest } = p;
          return rest as Portal;
        }
        return { ...p, gate };
      }),
    );
  }

  /** Arrival tile for a given rect + facing — one tile outside the rect in
   *  the facing direction, aligned to the rect's center on the perpendicular
   *  axis. Used when the user picks a facing so the spawn snaps to "right
   *  outside the door". */
  function spawnAdjacentToRect(
    rect: { tileX: number; tileY: number; w: number; h: number },
    facing: 'up' | 'down' | 'left' | 'right',
  ): { tileX: number; tileY: number } {
    const cx = rect.tileX + Math.floor(rect.w / 2);
    const cy = rect.tileY + Math.floor(rect.h / 2);
    switch (facing) {
      case 'up':    return { tileX: cx, tileY: rect.tileY - 1 };
      case 'down':  return { tileX: cx, tileY: rect.tileY + rect.h };
      case 'left':  return { tileX: rect.tileX - 1, tileY: cy };
      case 'right': return { tileX: rect.tileX + rect.w, tileY: cy };
    }
  }

  /** Change a portal half's facing AND auto-snap its spawn to the adjacent
   *  tile in that direction — matches the user's mental model of "pick an
   *  exit side" where direction and arrival tile are one decision. */
  function setPortalFacing(id: string, side: 'a' | 'b', facing: 'up' | 'down' | 'left' | 'right') {
    setPortals((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const h = side === 'a' ? p.a : p.b;
        return {
          ...p,
          [side]: { ...h, facing, spawn: spawnAdjacentToRect(h.rect, facing) },
        };
      }),
    );
  }

  // ── Pointer interaction ──
  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    canvasRef.current?.focus();
    // Middle mouse → pan.
    if (e.button === 1) {
      e.preventDefault();
      setInteraction({ kind: 'pan' });
      canvasRef.current?.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;

    // Collider edit handles have top priority — only exist when the user
    // explicitly entered edit mode for an object. Source-px granularity,
    // so we use sub-tile coords here rather than mouseToTile.
    if (editColliderIndex !== null) {
      const wp = mouseToWorldPx(e);
      const hh = colliderHandleAt(wp.x, wp.y);
      if (hh) {
        const o = objects[editColliderIndex]!;
        const src = `world/tilesets/${o.image}`;
        const cb = o.colliderBox ?? folderColliderDefaults[folderOf(o.image)] ?? objectBBoxes[src] ?? { x: 0, y: 0, w: 16, h: 16 };
        const k = TILE_SIZE / 16;
        setInteraction({
          kind: 'collider',
          objectIndex: editColliderIndex,
          handle: hh,
          startSrcX: wp.x / k,
          startSrcY: wp.y / k,
          origBox: { ...cb },
        });
        canvasRef.current?.setPointerCapture(e.pointerId);
        return;
      }
      // Clicked outside the rect — fall through to normal handling. The
      // user can deliberately exit edit mode by toggling the sidebar
      // button; here we just don't hijack their click.
    }

    const tile = mouseToTile(e);
    // Resize handle has priority — it only exists on the selected portal.
    const handle = cornerHitAt(tile.tileX, tile.tileY);
    if (handle) {
      const p = portals.find((pp) => pp.id === handle.portalId);
      if (p) {
        const half = handle.side === 'a' ? p.a : p.b;
        setInteraction({
          kind: 'resize',
          portalId: handle.portalId,
          side: handle.side,
          corner: handle.corner,
          startTile: tile,
          origRect: { ...half.rect },
        });
        canvasRef.current?.setPointerCapture(e.pointerId);
        return;
      }
    }

    const hit = itemAt(tile.tileX, tile.tileY);

    if (hit) {
      // Grass patches aren't draggable — they're tile-data. Just select.
      if (hit.startsWith('grass:')) {
        if (e.shiftKey) {
          const ns = new Set(selection);
          if (ns.has(hit)) ns.delete(hit);
          else ns.add(hit);
          setSelection(ns);
        } else {
          setSelection(new Set([hit]));
        }
        return;
      }
      // Clicked an item.
      let nextSel: Set<SelKey>;
      if (e.shiftKey) {
        // Shift+click toggles — and doesn't start a drag.
        const ns = new Set(selection);
        if (ns.has(hit)) ns.delete(hit);
        else ns.add(hit);
        setSelection(ns);
        return;
      } else if (selection.has(hit)) {
        // Clicked a member of the current selection → drag the whole group.
        nextSel = selection;
      } else {
        // Clicked an unselected item → replace selection.
        nextSel = new Set([hit]);
        setSelection(nextSel);
      }
      setInteraction({ kind: 'move', startTile: tile, originals: originalsFor(nextSel) });
      canvasRef.current?.setPointerCapture(e.pointerId);
    } else {
      // Clicked empty space → start a box select.
      const pre = e.shiftKey ? new Set(selection) : new Set<SelKey>();
      if (!e.shiftKey) setSelection(pre);
      setInteraction({ kind: 'box', startTile: tile, endTile: tile, preSelection: pre });
      canvasRef.current?.setPointerCapture(e.pointerId);
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    // Track the tile under the cursor at all times (even when not
    // interacting) so the toolbar HUD can show the player's mouse
    // coord — handy for picking spots without a tile-painter.
    setHoverTile(mouseToTile(e));
    if (!interaction) return;
    if (interaction.kind === 'pan') {
      setCam((c) => ({ ...c, x: c.x - e.movementX / c.zoom, y: c.y - e.movementY / c.zoom }));
      return;
    }
    if (interaction.kind === 'move') {
      const tile = mouseToTile(e);
      const dx = tile.tileX - interaction.startTile.tileX;
      const dy = tile.tileY - interaction.startTile.tileY;
      applyGroupDelta(interaction.originals, dx, dy);
      return;
    }
    if (interaction.kind === 'box') {
      const tile = mouseToTile(e);
      const next = { ...interaction, endTile: tile };
      setInteraction(next);
      // Live preview: selection = preSelection ∪ itemsInBox.
      const hit = itemsInBox(interaction.startTile, tile);
      const union = new Set(interaction.preSelection);
      for (const k of hit) union.add(k);
      setSelection(union);
      return;
    }
    if (interaction.kind === 'collider') {
      const k = TILE_SIZE / 16;
      const wp = mouseToWorldPx(e);
      const target = objects[interaction.objectIndex];
      const { frameW, frameH } = target ? frameDimsFor(target.image) : { frameW: 16, frameH: 16 };
      // Convert mouse to source-pixel space and snap to integer — keeps
      // the collider on the same grid as the asset's pixel art.
      const dxSrc = Math.round(wp.x / k - interaction.startSrcX);
      const dySrc = Math.round(wp.y / k - interaction.startSrcY);
      const o = interaction.origBox;
      let nx = o.x, ny = o.y, nw = o.w, nh = o.h;
      const h = interaction.handle;
      if (h === 'move') {
        nx = o.x + dxSrc;
        ny = o.y + dySrc;
      } else {
        if (h === 'nw' || h === 'w' || h === 'sw') { nx = o.x + dxSrc; nw = o.w - dxSrc; }
        if (h === 'ne' || h === 'e' || h === 'se') { nw = o.w + dxSrc; }
        if (h === 'nw' || h === 'n' || h === 'ne') { ny = o.y + dySrc; nh = o.h - dySrc; }
        if (h === 'sw' || h === 's' || h === 'se') { nh = o.h + dySrc; }
      }
      // Clamp to the frame's grid with min 1×1. If the drag tried to
      // invert the rect (e.g. dragging the east edge past the west) we
      // collapse to 1 px on that axis rather than flipping signs.
      if (nw < 1) { nx = (h === 'move') ? nx : o.x + o.w - 1; nw = 1; }
      if (nh < 1) { ny = (h === 'move') ? ny : o.y + o.h - 1; nh = 1; }
      nx = clamp(nx, 0, frameW - nw);
      ny = clamp(ny, 0, frameH - nh);
      nw = clamp(nw, 1, frameW - nx);
      nh = clamp(nh, 1, frameH - ny);
      updateObject(interaction.objectIndex, { colliderBox: { x: nx, y: ny, w: nw, h: nh } });
      return;
    }
    if (interaction.kind === 'resize') {
      if (!map) return;
      const tile = mouseToTile(e);
      const dx = tile.tileX - interaction.startTile.tileX;
      const dy = tile.tileY - interaction.startTile.tileY;
      const o = interaction.origRect;
      // Each corner anchors the OPPOSITE corner in place and shifts the
      // grabbed edges. Width/height are always >= 1 tile.
      let tileX = o.tileX, tileY = o.tileY, w = o.w, h = o.h;
      if (interaction.corner === 'se' || interaction.corner === 'ne') {
        w = Math.max(1, o.w + dx);
      } else {
        const nx = Math.min(o.tileX + o.w - 1, o.tileX + dx);
        w = Math.max(1, o.tileX + o.w - nx);
        tileX = nx;
      }
      if (interaction.corner === 'se' || interaction.corner === 'sw') {
        h = Math.max(1, o.h + dy);
      } else {
        const ny = Math.min(o.tileY + o.h - 1, o.tileY + dy);
        h = Math.max(1, o.tileY + o.h - ny);
        tileY = ny;
      }
      // Clamp to map bounds.
      tileX = clamp(tileX, 0, map.data.mapWidth - 1);
      tileY = clamp(tileY, 0, map.data.mapHeight - 1);
      w = clamp(w, 1, map.data.mapWidth - tileX);
      h = clamp(h, 1, map.data.mapHeight - tileY);
      updatePortalHalf(interaction.portalId, interaction.side, {
        rect: { tileX, tileY, w, h },
      });
      return;
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    setInteraction(null);
    try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* ok */ }
  }

  function onWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setCam((c) => {
      const worldX = mx / c.zoom + c.x;
      const worldY = my / c.zoom + c.y;
      const newZoom = stepCleanZoom(c.zoom, e.deltaY < 0 ? 'in' : 'out');
      return { x: worldX - mx / newZoom, y: worldY - my / newZoom, zoom: newZoom };
    });
  }

  /**
   * Resolve a selection key into the map + tile it points at. Returns null
   * if the selection refers to something on an unknown map or missing data.
   */
  function resolveSelection(key: SelKey): { mapId: string; tileX: number; tileY: number } | null {
    if (key === SPAWN_KEY) return { mapId: activeMapId, tileX: spawn.tileX, tileY: spawn.tileY };
    if (key.startsWith('npc:')) {
      const id = key.slice(4);
      const p = placements.find((pp) => pp.npcId === id);
      if (!p) return null;
      return { mapId: activeMapId, tileX: p.tileX, tileY: p.tileY };
    }
    if (key.startsWith('animal:')) {
      const idx = parseInt(key.slice(7), 10);
      const a = animals[idx];
      if (!a) return null;
      return { mapId: activeMapId, tileX: a.tileX, tileY: a.tileY };
    }
    if (key.startsWith('sign:')) {
      const id = key.slice(5);
      const s = signs.find((ss) => ss.id === id);
      if (!s) return null;
      return { mapId: s.mapId, tileX: s.tileX, tileY: s.tileY };
    }
    if (key.startsWith('portal-rect:') || key.startsWith('portal-spawn:')) {
      const [kind, portalId, side] = key.split(':') as [string, string, 'a' | 'b'];
      const portal = portals.find((pp) => pp.id === portalId);
      if (!portal) return null;
      const half = side === 'a' ? portal.a : portal.b;
      const tile = kind === 'portal-rect' ? half.rect : half.spawn;
      return { mapId: half.mapId, tileX: tile.tileX, tileY: tile.tileY };
    }
    return null;
  }

  /** Focus the camera on whatever is currently selected (first key). Jumps
   *  maps if the selection lives elsewhere, same as the portal Go button. */
  async function focusSelection() {
    const first = selection.values().next().value;
    if (!first) return;
    const t = resolveSelection(first);
    if (!t) return;
    if (t.mapId !== activeMapId) {
      const needsConfirm = dirty || portalsDirty;
      if (needsConfirm && !(await askConfirm('Discard unsaved changes and jump to the other map?'))) return;
      setPendingFocus({ mapId: t.mapId, tileX: t.tileX, tileY: t.tileY, selection: new Set([first]) });
      setActiveMapId(t.mapId);
    } else {
      const wx = t.tileX * TILE_SIZE + TILE_SIZE / 2;
      const wy = t.tileY * TILE_SIZE + TILE_SIZE / 2;
      setCam((c) => ({ ...c, x: wx - viewport.w / 2 / c.zoom, y: wy - viewport.h / 2 / c.zoom }));
    }
  }

  /** Global hotkeys. Skipped while a text field has focus so 'f' / 'd' /
   *  Backspace / Delete still work normally inside name + dialogue inputs.
   *    F                   → focus selection.
   *    D                   → duplicate every selected object.
   *    Delete / Backspace  → delete every selected object. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      const isF = k === 'f' || k === 'F';
      const isD = k === 'd' || k === 'D';
      const isDel = k === 'Delete' || k === 'Backspace';
      if (!isF && !isD && !isDel) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isF) {
        e.preventDefault();
        focusSelection();
        return;
      }
      if (isD) {
        e.preventDefault();
        const idx = selectedObjectIndices();
        if (idx.length > 0) duplicateObjects(idx);
        return;
      }
      if (isDel) {
        const idx = selectedObjectIndices();
        if (idx.length === 0) return; // nothing object-y selected; let the key pass
        e.preventDefault();
        // Delete in descending index order so the prior deletes don't
        // shift the indices that follow.
        for (const i of [...new Set(idx)].sort((a, b) => b - a)) deleteObject(i);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  /** Jump the editor's active map + camera to a specific portal half AND
   *  auto-select that half's rect so it stays highlighted for further edits. */
  async function jumpToHalf(portalId: string, side: 'a' | 'b') {
    const portal = portals.find((p) => p.id === portalId);
    if (!portal) return;
    const half = side === 'a' ? portal.a : portal.b;
    const selKey = new Set<SelKey>([portalRectKey(portalId, side)]);
    const needsConfirm = (dirty || portalsDirty) && activeMapId !== half.mapId;
    if (needsConfirm && !(await askConfirm('Discard unsaved changes and jump to the other portal half?'))) {
      return;
    }
    if (activeMapId !== half.mapId) {
      setPendingFocus({
        mapId: half.mapId,
        tileX: half.rect.tileX,
        tileY: half.rect.tileY,
        selection: selKey,
      });
      setActiveMapId(half.mapId);
    } else {
      // Same map — recenter immediately, keep current zoom.
      setSelection(selKey);
      const wx = half.rect.tileX * TILE_SIZE + TILE_SIZE / 2;
      const wy = half.rect.tileY * TILE_SIZE + TILE_SIZE / 2;
      setCam((c) => ({ ...c, x: wx - viewport.w / 2 / c.zoom, y: wy - viewport.h / 2 / c.zoom }));
    }
  }

  /** List of NPC ids whose draft differs from their last-saved baseline. */
  const dirtyNpcIds = useMemo(() => {
    return Object.keys(npcDrafts).filter((id) => {
      const draft = npcDrafts[id]!;
      const baseline = npcSavedBaselines[id] ?? JSON.stringify(diskDraftForNpc(id));
      return JSON.stringify(draft) !== baseline;
    });
  }, [npcDrafts, npcSavedBaselines]);

  async function save() {
    setSaveStatus('saving');
    setSaveError(null);
    try {
      // Map first — only writes if map-side is dirty.
      if (dirty) {
        // v1.209 ? log the placement count so the dev console makes it
        // obvious when an unplace really did get persisted to disk.
        console.log(`[editor] saving ${activeMapId} with ${placements.length} placements:`, placements.map((p) => p.npcId).join(', '));
        // v1.209 ? safety guard: if we're about to save a placement
        // list that's MUCH SHORTER than what's on disk (meaning a
        // bunch of NPCs are about to silently disappear), refuse the
        // save unless the user explicitly confirms. This is the
        // anti-corruption fix for the cave1 incident where a stale
        // session state wiped out every cave trainer in a single
        // save click.
        try {
          const onDisk = await fetch(`/api/editor/load-map?mapId=${encodeURIComponent(activeMapId)}`);
          if (onDisk.ok) {
            const diskJson = await onDisk.json() as { placements?: Array<{ npcId: string }> };
            const diskCount = diskJson.placements?.length ?? 0;
            const lost = (diskJson.placements ?? [])
              .map((p) => p.npcId)
              .filter((id) => !placements.some((p) => p.npcId === id));
            // Threshold: if we're about to drop 3+ NPCs OR more than
            // 25% of the on-disk count, prompt for confirmation. A
            // single Unplace doesn't trigger this; a session-wipe does.
            if (lost.length >= 3 || (diskCount >= 4 && lost.length / diskCount > 0.25)) {
              const ok = await askConfirm(
                `\u26A0 This save will REMOVE ${lost.length} NPC${lost.length === 1 ? '' : 's'} from "${activeMapId}":\n\n` +
                `  ${lost.join(', ')}\n\n` +
                `On-disk has ${diskCount} placements; you're saving ${placements.length}. ` +
                `If this is unexpected, click Cancel and use "Reload from disk" first.\n\n` +
                `Save anyway?`,
              );
              if (!ok) {
                setSaveStatus('idle');
                return;
              }
            }
          }
        } catch (err) {
          console.warn('[editor] save safety check failed (continuing anyway):', err);
        }
        const existingDef = MAP_CATALOG[activeMapId];
        // Dedupe placements by npcId before writing. The editor selection
        // model assumes a single placement per NPC (npcKey collides
        // otherwise), and a duplicate slipped in via some past
        // session-rescue / HMR race once and silently round-tripped
        // through every save until a designer spotted it (two Mira
        // sprites stacked on the same tile). Defensive dedupe makes
        // sure we never persist that state again.
        const seenNpcIds = new Set<string>();
        const dedupedPlacements: Placement[] = [];
        for (const p of placements) {
          if (seenNpcIds.has(p.npcId)) {
            console.warn(`[editor] dropping duplicate placement for "${p.npcId}" on save`);
            continue;
          }
          seenNpcIds.add(p.npcId);
          dedupedPlacements.push(p);
        }
        const mapPayload = {
          id: activeMapId,
          spawns,
          placements: dedupedPlacements,
          animals,
          ...(objects.length > 0 ? { objects } : {}),
          ...(battleBgFrame ? { battleBgFrame } : {}),
          ...(Object.keys(grassPatchBackgrounds).length > 0
            ? { grassPatchBackgrounds }
            : {}),
          ...(Object.keys(grassPatchLevels).length > 0
            ? { grassPatchLevels }
            : {}),
          // v1.223 — Preserve levelOriginTile across editor saves. The
          // editor doesn't surface this field as a UI control yet, so
          // forward whatever's already on disk to avoid stripping it.
          ...(existingDef?.levelOriginTile
            ? { levelOriginTile: existingDef.levelOriginTile }
            : {}),
        };
        const res = await fetch('/api/editor/save-map', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mapId: activeMapId,
            data: mapPayload,
          }),
        });
        if (!res.ok) throw new Error(`save-map ${res.status} ${await res.text()}`);
        const result = await res.json().catch(() => ({}));
        console.log('[editor] map save ok →', result.path ?? activeMapId);
        setSavedBaseline(JSON.stringify({
          placements, spawns, animals, objects, battleBgFrame, grassPatchBackgrounds, grassPatchLevels,
        }));
        // Mirror the freshly-written JSON into the in-memory MAP_CATALOG so
        // "Reload from disk" returns the just-saved state instead of the
        // module-load snapshot. Without this, MAP_CATALOG only reflects
        // what was on disk when the editor bundle first loaded — saving
        // and then reloading would silently revert the save.
        // (cast: MapJson has optional fields that mapPayload may omit.)
        MAP_CATALOG[activeMapId] = mapPayload as unknown as typeof MAP_CATALOG[string];
        // Disk now matches React state — drop the sessionStorage rescue
        // for this map so a future remount hydrates from the freshly-
        // written MAP_CATALOG instead of stale snapshot data.
        try { sessionStorage.removeItem(`editor:dirty:${activeMapId}`); } catch {}
      }
      // Portals (global file, single save even if multiple pairs changed).
      if (portalsDirty) {
        // v1.243 — Safety net for portal-data-loss. The editor's
        // React `portals` state can drift behind disk (e.g. an
        // upstream pull added portals while the editor was open with
        // a stale sessionStorage rescue). We re-fetch disk first and
        // abort the save if it would silently clobber portals the
        // editor never knew about — forcing a reload to reconcile.
        //
        // 2026-06-26 — Switched from a COUNT comparison to an ID set
        // comparison. The old `diskCount > portals.length` check fired
        // a false positive on EVERY intentional portal deletion: after
        // removing a portal the editor naturally has one fewer than
        // disk, which looked identical to "a teammate added one." Now
        // we only warn about disk portals whose id the editor has
        // NEVER seen (not in the current state AND not in the baseline
        // it loaded/last-saved). A deleted portal's id is in the
        // baseline, so a deliberate delete no longer trips the guard.
        try {
          const onDisk = await fetch('/api/editor/list-portals');
          if (onDisk.ok) {
            const diskJson = await onDisk.json() as { portals?: Array<{ id?: string }> };
            const diskPortals = Array.isArray(diskJson?.portals) ? diskJson.portals : [];
            // Every portal id the editor is aware of: current state plus
            // the baseline it originally loaded (or last saved). Deletions
            // live in the baseline; additions live in current state.
            const knownIds = new Set<string>();
            for (const p of portals) knownIds.add(p.id);
            try {
              const baselinePortals = JSON.parse(effectivePortalsBaseline) as Array<{ id?: string }>;
              for (const p of baselinePortals) if (p?.id) knownIds.add(p.id);
            } catch { /* baseline unparseable — fall back to current-state ids only */ }
            // Disk portals the editor has never seen → genuinely added
            // elsewhere; saving would wipe them. A disk portal missing an
            // id is treated as unknown (conservative).
            const unknownDiskPortals = diskPortals.filter((p) => !p?.id || !knownIds.has(p.id));
            if (unknownDiskPortals.length > 0) {
              const proceed = window.confirm(
                `WARNING: portals.json on disk has ${unknownDiskPortals.length} portal(s) the editor has never seen ` +
                `(likely added by a teammate). Saving would DELETE them.\n\n` +
                `Click Cancel to abort the save and reload the editor (recommended).\n` +
                `Click OK only if you genuinely intend to delete those portals.`,
              );
              if (!proceed) {
                throw new Error(
                  `aborted: would have deleted ${unknownDiskPortals.length} unknown portal(s) from disk`,
                );
              }
            }
          }
        } catch (guardErr) {
          // If the guard endpoint itself errored (e.g. /list-portals
          // doesn't exist on this dev server), fall through and save
          // anyway — the guard is a safety net, not a hard wall.
          if (guardErr instanceof Error && guardErr.message.startsWith('aborted:')) {
            throw guardErr;
          }
          console.warn('[editor] portal-loss guard skipped:', guardErr);
        }
        const res = await fetch('/api/editor/save-portals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: { portals } }),
        });
        if (!res.ok) throw new Error(`save-portals ${res.status} ${await res.text()}`);
        const result = await res.json().catch(() => ({}));
        console.log('[editor] portals save ok →', result.path ?? 'portals.json');
        setSavedPortalsBaseline(JSON.stringify(portals));
        try { sessionStorage.removeItem('editor:dirty:portals'); } catch {}
      }
      // World signs (global file like portals).
      if (signsDirty) {
        setSignSaveStatus('saving');
        setSignSaveError(null);
        try {
          const res = await fetch('/api/editor/save-signs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { signs } }),
          });
          if (!res.ok) throw new Error(`save-signs ${res.status} ${await res.text()}`);
          const result = await res.json().catch(() => ({}));
          console.log('[editor] signs save ok →', result.path ?? 'worldSigns.json');
          setSavedSignsBaseline(JSON.stringify(signs));
          setSignSaveStatus('saved');
          setTimeout(() => setSignSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 3000);
          try { sessionStorage.removeItem(SIGNS_SESSION_KEY); } catch {}
        } catch (err) {
          setSignSaveStatus('error');
          setSignSaveError(String(err));
          throw err;
        }
      }
      // Any NPCs with unsaved edits — fan out via the per-NPC saver so the
      // override + baseline bookkeeping matches the "Save NPC" button's flow.
      for (const id of dirtyNpcIds) {
        await saveNpc(id);
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 3000);
    } catch (err) {
      setSaveStatus('error');
      setSaveError(String(err));
    }
  }

  function snapToInGameView() {
    setCam((c) => {
      const wx = c.x + viewport.w / 2 / c.zoom;
      const wy = c.y + viewport.h / 2 / c.zoom;
      return { zoom: 1, x: wx - viewport.w / 2, y: wy - viewport.h / 2 };
    });
  }

  // ── Minimap input ──
  function minimapToCam(e: { clientX: number; clientY: number }) {
    if (!map) return null;
    const mini = minimapRef.current;
    if (!mini) return null;
    const r = mini.getBoundingClientRect();
    const mx = clamp(e.clientX - r.left, 0, r.width);
    const my = clamp(e.clientY - r.top, 0, r.height);
    const mapPxW = map.data.mapWidth * TILE_SIZE;
    const mapPxH = map.data.mapHeight * TILE_SIZE;
    const worldX = (mx / r.width) * mapPxW;
    const worldY = (my / r.height) * mapPxH;
    return { x: worldX - viewport.w / 2 / cam.zoom, y: worldY - viewport.h / 2 / cam.zoom };
  }
  const [minimapDragging, setMinimapDragging] = useState(false);
  function onMinimapDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const pos = minimapToCam(e);
    if (pos) setCam((c) => ({ ...c, x: pos.x, y: pos.y }));
    setMinimapDragging(true);
    minimapRef.current?.setPointerCapture(e.pointerId);
  }
  function onMinimapMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!minimapDragging) return;
    const pos = minimapToCam(e);
    if (pos) setCam((c) => ({ ...c, x: pos.x, y: pos.y }));
  }
  function onMinimapUp(e: React.PointerEvent<HTMLCanvasElement>) {
    setMinimapDragging(false);
    try { minimapRef.current?.releasePointerCapture(e.pointerId); } catch { /* ok */ }
  }

  // Sidebar row click.
  function toggleSidebar(key: SelKey, shift: boolean) {
    if (shift) {
      const ns = new Set(selection);
      if (ns.has(key)) ns.delete(key);
      else ns.add(key);
      setSelection(ns);
    } else {
      setSelection(new Set([key]));
    }
  }

  if (diskMaps && diskMaps.length === 0) {
    return (
      <div style={{ padding: 24, color: '#ccc', fontFamily: 'system-ui, sans-serif', lineHeight: 1.6, maxWidth: 560 }}>
        <h2 style={{ color: '#9cf', marginTop: 0 }}>No maps found</h2>
        <p>
          The editor scanned <code>public/world/maps/</code> but found no map that
          has both a tile JSON and a matching tilesheet PNG.
        </p>
        <p>
          Drop a Sprite Fusion export there — <code>&lt;name&gt;.json</code> plus{' '}
          <code>&lt;name&gt;.png</code> — then reload this page.
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ padding: 24, color: '#f66', fontFamily: 'monospace', lineHeight: 1.5 }}>
        Error: {error}
        <div style={{ color: '#888', marginTop: 8 }}>
          If this map's tile assets are missing, reload to switch to an available map.
        </div>
      </div>
    );
  }
  if (!initialMap) {
    return <div style={{ padding: 24, color: '#f66' }}>No map config for {activeMapId}</div>;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#111', userSelect: 'none' }}>
      {playing && <PlayCanvas mapId={activeMapId} onStop={() => setPlaying(false)} />}
      <aside
        style={{
          width: 280,
          padding: 16,
          borderRight: '1px solid #333',
          overflowY: 'auto',
          flexShrink: 0,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18 }}>Map Editor</h1>

        <label style={{ display: 'block', marginTop: 10, fontSize: 11, color: '#888' }}>
          Map
          <select
            value={activeMapId}
            onChange={async (e) => {
              const next = e.target.value;
              if (dirty && !(await askConfirm('Discard unsaved changes and switch maps?'))) return;
              setActiveMapId(next);
            }}
            style={{
              display: 'block', width: '100%', marginTop: 4, padding: '4px 6px',
              background: '#1a1a1a', color: '#eee', border: '1px solid #444', borderRadius: 4, fontSize: 12,
            }}
          >
            {availableMapIds.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        </label>

        <button
          onClick={() => setPlaying(true)}
          style={{
            display: 'block', width: '100%', marginTop: 8, padding: '8px 10px',
            background: '#2f7a3b', color: '#fff', fontSize: 13, fontWeight: 600,
            border: '1px solid #4a5', borderRadius: 6, cursor: 'pointer',
          }}
          title="Play the saved map — real movement, camera, and portal travel. Save first to demo unsaved edits."
        >
          ▶ Play map
        </button>

        <p style={{ color: '#888', fontSize: 12, marginTop: 8 }}>
          {map ? <>{map.data.mapWidth}×{map.data.mapHeight} tiles · </> : null}
          zoom {Math.round(cam.zoom * 100)}%
        </p>

        <button
          onClick={snapToInGameView}
          style={{
            marginTop: 6, padding: '6px 10px', background: '#2a2a2a', color: '#eee',
            border: '1px solid #444', borderRadius: 4, cursor: 'pointer', fontSize: 12, width: '100%',
          }}
        >
          🔍 In-game zoom (100%)
        </button>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
          Show tile grid
        </label>

        {/* Hover coord readout — surfaces (tx, ty) for whatever tile the
            cursor is over, so an admin can pick a precise tile to ask for
            a JSON-side blocker / portal / spawn placement without an
            in-canvas inspector. Empty when the mouse leaves the canvas. */}
        <div style={{
          marginTop: 8,
          padding: '4px 8px',
          background: '#0a0a0a',
          border: '1px solid #2a2a2a',
          borderRadius: 4,
          fontFamily: 'monospace',
          fontSize: 12,
          color: hoverTile ? '#9bd0ff' : '#555',
          textAlign: 'center',
        }}>
          {hoverTile ? `Tile: (${hoverTile.tileX}, ${hoverTile.tileY})` : 'Tile: \u2014'}
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 12 }}>
          <button
            onClick={save}
            disabled={!(dirty || portalsDirty || signsDirty || dirtyNpcIds.length > 0) || saveStatus === 'saving'}
            style={{
              flex: 1,
              padding: '6px 10px',
              background: (dirty || portalsDirty || signsDirty || dirtyNpcIds.length > 0) ? '#3b7a3b' : '#2a2a2a',
              color: (dirty || portalsDirty || signsDirty || dirtyNpcIds.length > 0) ? '#fff' : '#666',
              border: '1px solid ' + ((dirty || portalsDirty || signsDirty || dirtyNpcIds.length > 0) ? '#5a3' : '#444'),
              borderRadius: 4,
              cursor: (dirty || portalsDirty || signsDirty || dirtyNpcIds.length > 0) && saveStatus !== 'saving' ? 'pointer' : 'default',
              fontSize: 12,
            }}
          >
            {saveStatus === 'saving'
              ? 'Saving…'
              : saveStatus === 'saved'
              ? 'Saved ✓'
              : (dirty || portalsDirty || signsDirty || dirtyNpcIds.length > 0)
              ? (() => {
                  const parts: string[] = [];
                  if (dirty) parts.push('map');
                  if (portalsDirty) parts.push('portals');
                  if (signsDirty) parts.push('signs');
                  if (dirtyNpcIds.length > 0) parts.push(`${dirtyNpcIds.length} npc${dirtyNpcIds.length === 1 ? '' : 's'}`);
                  return `Save (${parts.join(' + ')})`;
                })()
              : 'No changes'}
          </button>
          <button
            onClick={async () => {
              const hasUnsaved = dirty || portalsDirty || dirtyNpcIds.length > 0;
              if (hasUnsaved && !(await askConfirm(
                'Discard unsaved edits and reload this map from disk?\n\n' +
                'Use this when the JSON has been changed by another tool (e.g. an external edit) ' +
                'but the editor is still showing stale state from its sessionStorage rescue.',
              ))) return;
              // Fetch the LIVE on-disk JSON (not MAP_CATALOG, which is a
              // module-load snapshot that drifts as the dev server runs).
              // Falls back to MAP_CATALOG only if the API call fails — that
              // way at least something loads even if dev middleware is down.
              let def: typeof MAP_CATALOG[string] | null = null;
              try {
                const res = await fetch(`/api/editor/load-map?mapId=${encodeURIComponent(activeMapId)}`);
                if (res.ok) {
                  def = await res.json();
                  // Mirror the freshly-fetched JSON into MAP_CATALOG too so
                  // future references see the current truth.
                  if (def) MAP_CATALOG[activeMapId] = def;
                } else {
                  console.warn('[editor] /api/editor/load-map failed:', res.status, await res.text());
                }
              } catch (err) {
                console.warn('[editor] /api/editor/load-map errored:', err);
              }
              if (!def) def = MAP_CATALOG[activeMapId] ?? null;
              if (!def) {
                await showAlert(`Could not reload "${activeMapId}" from disk and it isn't in MAP_CATALOG either.`);
                return;
              }
              // Drop the sessionStorage snapshot AFTER the fetch succeeds so
              // we don't lose it on a network failure.
              try { sessionStorage.removeItem(`editor:dirty:${activeMapId}`); } catch { /* ignore */ }
              setPlacements(def.placements ?? []);
              setAnimals(((def.animals ?? []) as typeof animals).map((a) => ({ ...a })));
              setSpawns({ ...(def.spawns ?? {}) });
              setBattleBgFrame(def.battleBgFrame as BgFrameName | undefined);
              setGrassPatchBackgrounds({ ...((def.grassPatchBackgrounds as Record<string, BgFrameName> | undefined) ?? {}) });
              setGrassPatchLevels({ ...(def.grassPatchLevels ?? {}) });
              setSavedBaseline(null);
              setSaveStatus('idle');
              setSaveError(null);
              setSelection(new Set());
              setInteraction(null);
            }}
            title="Discard unsaved changes and re-fetch this map's JSON from disk via the dev API"
            style={{
              padding: '6px 10px',
              background: '#2a2a2a',
              color: '#9cf',
              border: '1px solid #555',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Reload from disk
          </button>
        </div>
        {saveStatus === 'error' && (
          <div style={{ marginTop: 6, color: '#f66', fontSize: 11, whiteSpace: 'pre-wrap' }}>
            Save failed: {saveError}
          </div>
        )}

        <hr style={{ borderColor: '#333', margin: '12px 0' }} />
        <h2 style={{ fontSize: 13, color: '#9cf', margin: '0 0 6px' }}>
          Selection ({selection.size})
        </h2>
        <div style={{ color: '#666', fontSize: 11, marginBottom: 6 }}>
          Click to select · Shift+click to toggle · Drag empty area to box-select
        </div>

        <h3
          style={{ fontSize: 12, color: '#888', margin: '8px 0 4px', ...sectionHeaderClick }}
          onClick={() => toggleSection('spawn')}
        >
          <span style={{ width: 10, textAlign: 'center', color: '#666' }}>
            {isSectionOpen('spawn') ? '▼' : '▶'}
          </span>
          Spawn
        </h3>
        {isSectionOpen('spawn') && (
          <div
            style={{
              padding: '4px 8px', borderRadius: 4,
              background: selection.has(SPAWN_KEY) ? '#ffd93d22' : 'transparent',
              border: selection.has(SPAWN_KEY) ? '1px solid #ffd93d' : '1px solid transparent',
              fontSize: 12, cursor: 'pointer',
            }}
            onClick={(e) => toggleSidebar(SPAWN_KEY, e.shiftKey)}
          >
            default <span style={{ color: '#666' }}>({spawn.tileX}, {spawn.tileY})</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '10px 0 4px' }}>
          <h3
            style={{ fontSize: 12, color: '#888', margin: 0, ...sectionHeaderClick }}
            onClick={() => toggleSection('npcs')}
          >
            <span style={{ width: 10, textAlign: 'center', color: '#666' }}>
              {isSectionOpen('npcs') ? '▼' : '▶'}
            </span>
            NPCs ({placements.length})
          </h3>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={placeExistingNpc}
              style={{
                padding: '2px 8px', background: '#2a2a32', color: '#9cf',
                border: '1px solid #355', borderRadius: 4, cursor: 'pointer', fontSize: 11,
              }}
              title="Place an NPC that already has a JSON file but isn't on this map"
            >
              + Place
            </button>
            <button
              onClick={createNpc}
              style={{
                padding: '2px 8px', background: '#2a2a2a', color: '#eee',
                border: '1px solid #555', borderRadius: 4, cursor: 'pointer', fontSize: 11,
              }}
            >
              + NPC
            </button>
          </div>
        </div>
        {isSectionOpen('npcs') && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 12, lineHeight: 1.6 }}>
          {placements.map((p) => {
            const n = resolveNpc(p.npcId);
            const key = npcKey(p.npcId);
            const isSel = selection.has(key);
            // Reading draft lazily — uncommitted edits live in npcDrafts,
            // everything else comes from the resolved NPC (override ∪ catalog).
            const draft = draftForNpc(p.npcId);
            // Dirty = current draft differs from either the last successful
            // save or (if no save yet) the last-saved disk draft.
            const savedBaseline = npcSavedBaselines[p.npcId] ?? JSON.stringify(diskDraftForNpc(p.npcId));
            const dirty = JSON.stringify(draft) !== savedBaseline;
            const status = npcSaveStatus[p.npcId] ?? 'idle';
            const err = npcSaveError[p.npcId];
            return (
              <li
                key={p.npcId}
                style={{
                  padding: isSel ? 6 : '2px 8px', borderRadius: 4, marginBottom: isSel ? 6 : 0,
                  background: isSel ? '#ffd93d14' : 'transparent',
                  border: isSel ? '1px solid #ffd93d' : '1px solid transparent',
                  color: n ? '#ddd' : '#f66',
                }}
              >
                <div
                  style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center' }}
                  onClick={(e) => toggleSidebar(key, e.shiftKey)}
                >
                  <span>
                    <code>{p.npcId}</code>{' '}
                    <span style={{ color: '#666' }}>({p.tileX},{p.tileY})</span>
                    {!n && ' — unknown'}
                  </span>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {n && <span style={{ color: '#888' }}>{n.name}</span>}
                    {isSel && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const wx = p.tileX * TILE_SIZE + TILE_SIZE / 2;
                          const wy = p.tileY * TILE_SIZE + TILE_SIZE / 2;
                          setCam((c) => ({ ...c, x: wx - viewport.w / 2 / c.zoom, y: wy - viewport.h / 2 / c.zoom }));
                        }}
                        title="Center camera on this NPC (hotkey: F)"
                        style={{
                          padding: '1px 6px', fontSize: 10, background: '#1e3a4a', color: '#9cf',
                          border: '1px solid #355', borderRadius: 3, cursor: 'pointer',
                        }}
                      >
                        go
                      </button>
                    )}
                  </span>
                </div>
                {isSel && (
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <img
                        key={draft.character}
                        src={`world/npcs/Character/${draft.character}/Faceset.png`}
                        alt=""
                        style={{ width: 32, height: 32, imageRendering: 'pixelated', background: '#000', borderRadius: 3 }}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                      />
                      <select
                        value={draft.character}
                        onChange={(e) => updateNpcDraft(p.npcId, { character: e.target.value })}
                        style={{ flex: 1, background: '#111', color: '#eee', border: '1px solid #444', borderRadius: 3, padding: '2px 4px', fontSize: 11 }}
                      >
                        {!characters.some((c) => c.name === draft.character) && (
                          <option value={draft.character}>{draft.character} (missing)</option>
                        )}
                        {characters.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}{c.limited ? ' (2-frame walk)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11, color: '#aaa' }}>
                      Name
                      <input
                        value={draft.name}
                        onChange={(e) => updateNpcDraft(p.npcId, { name: e.target.value })}
                        style={{ flex: 1, background: '#111', color: '#eee', border: '1px solid #444', borderRadius: 3, padding: '2px 4px', fontSize: 11 }}
                      />
                    </label>
                    <div>
                      <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>Dialogue ({draft.dialogue.length})</div>
                      {draft.dialogue.map((line, i) => {
                        const over = line.length > DIALOGUE_MAX_CHARS;
                        const near = !over && line.length >= DIALOGUE_MAX_CHARS - 12;
                        const counterColor = over ? '#ff6b6b' : near ? '#ffd93d' : '#777';
                        return (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 3 }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <textarea
                              value={line}
                              onChange={(e) => updateNpcDraft(p.npcId, {
                                dialogue: draft.dialogue.map((d, j) => (j === i ? e.target.value : d)),
                              })}
                              rows={2}
                              style={{ flex: 1, background: '#111', color: '#eee', border: `1px solid ${over ? '#ff6b6b' : '#444'}`, borderRadius: 3, padding: '2px 4px', fontSize: 11, resize: 'vertical', fontFamily: 'inherit' }}
                            />
                            {i > 0 && (
                              <button
                                onClick={() => updateNpcDraft(p.npcId, {
                                  dialogue: draft.dialogue.reduce<string[]>((acc, d, j) => {
                                    if (j === i) acc[acc.length - 1] = `${acc[acc.length - 1]} ${d}`.trim();
                                    else acc.push(d);
                                    return acc;
                                  }, []),
                                })}
                                style={{ background: '#2a2a2a', color: '#7fd1ff', border: '1px solid #555', borderRadius: 3, padding: '0 6px', cursor: 'pointer', fontSize: 11 }}
                                title="Merge this line into the one above"
                              >
                                ⤴
                              </button>
                            )}
                            {over && (
                              <button
                                onClick={() => updateNpcDraft(p.npcId, {
                                  dialogue: draft.dialogue.flatMap((d, j) =>
                                    j === i ? wrapDialogueLine(d, DIALOGUE_MAX_CHARS) : [d]),
                                })}
                                style={{ background: '#2a2a2a', color: '#ffd93d', border: '1px solid #555', borderRadius: 3, padding: '0 6px', cursor: 'pointer', fontSize: 11 }}
                                title={`Split into lines that fit (${DIALOGUE_MAX_CHARS} chars max)`}
                              >
                                ⤶ split
                              </button>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <button
                                onClick={() => updateNpcDraft(p.npcId, { dialogue: draft.dialogue.filter((_, j) => j !== i) })}
                                style={{ background: '#2a2a2a', color: '#eee', border: '1px solid #555', borderRadius: 3, padding: '0 6px', cursor: 'pointer', fontSize: 11 }}
                                title="Remove line"
                              >
                                ×
                              </button>
                              <button
                                onClick={() => updateNpcDraft(p.npcId, {
                                  dialogue: draft.dialogue.flatMap((d, j) => j === i ? [d, ''] : [d]),
                                })}
                                style={{ background: '#2a2a2a', color: '#9ae6a4', border: '1px solid #555', borderRadius: 3, padding: '0 6px', cursor: 'pointer', fontSize: 11 }}
                                title="Insert a blank line below this one"
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <div style={{ alignSelf: 'flex-end', fontSize: 10, color: counterColor, fontVariantNumeric: 'tabular-nums' }}>
                            {line.length}/{DIALOGUE_MAX_CHARS}{over ? ' — may overflow' : ''}
                          </div>
                        </div>
                        );
                      })}
                      <button
                        onClick={() => updateNpcDraft(p.npcId, { dialogue: [...draft.dialogue, ''] })}
                        style={{ background: '#2a2a2a', color: '#eee', border: '1px solid #555', borderRadius: 3, padding: '2px 8px', cursor: 'pointer', fontSize: 11 }}
                      >
                        + line
                      </button>
                    </div>
                    {/* Movement — stationary NPCs stay rooted to their spawn
                        tile (engine skips the random wander step). Useful for
                        shopkeepers, statue-like signage, etc. */}
                    <label
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        fontSize: 11, color: '#aaa', cursor: 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!draft.stationary}
                        onChange={(e) => updateNpcDraft(p.npcId, {
                          stationary: e.target.checked,
                          // Facing-lock only applies to stay-put NPCs — clear
                          // it when unchecking so a stale direction can't
                          // linger (and gets removed from disk on save).
                          ...(e.target.checked ? {} : { faceDirection: undefined }),
                        })}
                      />
                      Stay put (don't wander)
                    </label>
                    {/* Facing lock — pin the NPC to one direction instead of
                        the idle look-around. Only available while "Stay put"
                        is on. They still turn to face the player while talking,
                        then snap back. */}
                    <label
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        fontSize: 11, color: draft.stationary ? '#aaa' : '#666',
                      }}
                    >
                      Facing
                      <select
                        value={draft.faceDirection ?? ''}
                        disabled={!draft.stationary}
                        title={draft.stationary ? '' : 'Enable "Stay put" to lock facing'}
                        onChange={(e) => updateNpcDraft(p.npcId, {
                          faceDirection: (e.target.value || undefined) as Direction | undefined,
                        })}
                        style={{ flex: 1, background: draft.stationary ? '#111' : '#1a1a1a', color: draft.stationary ? '#eee' : '#666', border: '1px solid #444', borderRadius: 3, padding: '2px 4px', fontSize: 11, cursor: draft.stationary ? 'pointer' : 'not-allowed' }}
                      >
                        <option value="">Auto (look around)</option>
                        <option value="up">North</option>
                        <option value="down">South</option>
                        <option value="right">East</option>
                        <option value="left">West</option>
                      </select>
                    </label>
                    {/* Mood emotes — flavor pop-ups above the NPC's head. */}
                    <div>
                      <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>
                        Mood emotes ({draft.moodEmotes?.length ?? 0})
                      </div>
                      <select
                        value=""
                        onChange={(e) => {
                          const pick = e.target.value;
                          if (!pick) return;
                          const cur = draft.moodEmotes ?? [];
                          if (cur.includes(pick)) return;
                          updateNpcDraft(p.npcId, { moodEmotes: [...cur, pick] });
                        }}
                        style={{ width: '100%', background: '#111', color: '#eee', border: '1px solid #444', borderRadius: 3, padding: '2px 4px', fontSize: 11 }}
                      >
                        <option value="">+ add emote…</option>
                        {EMOTE_BASENAMES
                          .filter((b) => !(draft.moodEmotes ?? []).includes(b))
                          .map((b) => (
                            <option key={b} value={b}>{b} — {EMOTE_LABELS[b] ?? b}</option>
                          ))}
                      </select>
                      {(draft.moodEmotes ?? []).length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                          {(draft.moodEmotes ?? []).map((basename) => (
                            <span
                              key={basename}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 3,
                                background: '#1a1a1a', border: '1px solid #333',
                                borderRadius: 3, padding: '1px 4px', fontSize: 10, color: '#ccc',
                              }}
                              title={EMOTE_LABELS[basename] ?? basename}
                            >
                              <img
                                src={`world/ui/Emote/${basename}.png`}
                                alt=""
                                style={{ width: 14, height: 14, imageRendering: 'pixelated', objectFit: 'contain' }}
                              />
                              {EMOTE_LABELS[basename] ?? basename}
                              <button
                                onClick={() => updateNpcDraft(p.npcId, {
                                  moodEmotes: (draft.moodEmotes ?? []).filter((e) => e !== basename),
                                })}
                                style={{ background: 'transparent', color: '#f88', border: 'none', cursor: 'pointer', fontSize: 10, padding: 0, lineHeight: 1 }}
                                title="Remove"
                              >×</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Trainer battle section. Enabling adds a 1-mon party as a
                        sensible starting point; disabling removes all trainer
                        fields on save. */}
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: '#f88', marginTop: 4 }}>
                      <input
                        type="checkbox"
                        checked={!!draft.trainerParty}
                        onChange={(e) => {
                          if (e.target.checked) {
                            updateNpcDraft(p.npcId, {
                              trainerParty: [{ element: 'fire', rarity: 'common', level: 1 }],
                            });
                          } else {
                            updateNpcDraft(p.npcId, {
                              trainerParty: undefined,
                              trainerReward: undefined,
                              preBattleLine: undefined,
                              postDefeatDialogue: undefined,
                              requiredTrainerDefeats: undefined,
                              prereqBlockedMessage: undefined,
                              blocksPassage: undefined,
                            });
                          }
                        }}
                      />
                      Trainer battle
                    </label>
                    {draft.trainerParty && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 8, borderLeft: '2px solid #633' }}>
                        {/* `preBattleLine` is intentionally hidden: nothing reads
                            it at runtime (the trainer battle fires straight into
                            'battle-transition' without surfacing it). The field is
                            still loaded into the draft and round-tripped on save so
                            existing values on disk are preserved — re-add an input
                            here if/when the runtime actually displays it. */}
                        <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11, color: '#aaa' }}>
                          Reward (coins)
                          <input
                            type="number"
                            min={0}
                            value={draft.trainerReward ?? ''}
                            title="Base coin reward paid on defeat (scaled ~0.63× at runtime). Stardust is awarded separately from the lead mon's rarity."
                            onChange={(e) => {
                              const v = e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value, 10) || 0);
                              updateNpcDraft(p.npcId, { trainerReward: v });
                            }}
                            style={{ width: 80, background: '#111', color: '#eee', border: '1px solid #444', borderRadius: 3, padding: '2px 4px', fontSize: 11 }}
                          />
                          {draft.trainerReward !== undefined && draft.trainerReward > 0 && (
                            <span style={{ fontSize: 10, color: '#777' }}>≈ {Math.max(1, Math.round(draft.trainerReward * 0.63))} paid</span>
                          )}
                        </label>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <div style={{ fontSize: 11, color: '#aaa' }}>Party ({draft.trainerParty.length})</div>
                            {/* Bulk-level helper — faster than editing every mon's
                                level one at a time when scaling a trainer to a zone. */}
                            <BulkLevelControl
                              onApply={(v) => updateNpcDraft(p.npcId, {
                                trainerParty: draft.trainerParty!.map((m) => ({ ...m, level: v })),
                              })}
                            />
                          </div>
                          {/* Level-curve hint. There's no per-map "expected level"
                              data model, so the sanity check is in-party: show the
                              range/avg and flag a party that isn't ascending (the
                              usual authoring intent for a lead → ace progression). */}
                          {(() => {
                            const lv = draft.trainerParty.map((m) => m.level);
                            const minL = Math.min(...lv), maxL = Math.max(...lv);
                            const avg = lv.reduce((a, b) => a + b, 0) / lv.length;
                            const descends = lv.some((l, i) => i > 0 && l < lv[i - 1]!);
                            return (
                              <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>
                                Lv {minL}{minL !== maxL ? `–${maxL}` : ''} · avg {avg.toFixed(1)}
                                {descends && <span style={{ color: '#d9a441' }}> · ⚠ levels not ascending</span>}
                              </div>
                            );
                          })()}
                          {draft.trainerParty.map((mon, i) => (
                            <TrainerPartyMember
                              key={i}
                              mon={mon}
                              index={i}
                              onChange={(next) => updateNpcDraft(p.npcId, {
                                trainerParty: draft.trainerParty!.map((m, j) => (j === i ? next : m)),
                              })}
                              onRemove={() => updateNpcDraft(p.npcId, {
                                trainerParty: draft.trainerParty!.filter((_, j) => j !== i),
                              })}
                            />
                          ))}
                          <button
                            onClick={() => updateNpcDraft(p.npcId, {
                              trainerParty: [...draft.trainerParty!, { element: 'fire', rarity: 'common', level: 1 }],
                            })}
                            style={{ background: '#2a2a2a', color: '#eee', border: '1px solid #555', borderRadius: 3, padding: '2px 8px', cursor: 'pointer', fontSize: 11 }}
                          >
                            + mon
                          </button>
                        </div>
                        {/* Gating — blocksPassage + prerequisite trainers. Both
                            were previously JSON-only; exposing them here means
                            boss gauntlets (e.g. pharaoh-sphinx) can be authored
                            end-to-end in the editor. */}
                        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: '#aaa', cursor: 'pointer', userSelect: 'none' }}>
                          <input
                            type="checkbox"
                            checked={!!draft.blocksPassage}
                            onChange={(e) => updateNpcDraft(p.npcId, { blocksPassage: e.target.checked || undefined })}
                          />
                          Blocks passage until defeated
                        </label>
                        <div>
                          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>
                            Required defeats first ({draft.requiredTrainerDefeats?.length ?? 0})
                          </div>
                          {(draft.requiredTrainerDefeats ?? []).map((tid, i) => (
                            <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 3 }}>
                              <select
                                value={tid}
                                onChange={(e) => updateNpcDraft(p.npcId, {
                                  requiredTrainerDefeats: (draft.requiredTrainerDefeats ?? []).map((t, j) => (j === i ? e.target.value : t)),
                                })}
                                style={{ flex: 1, ...TM_INPUT, fontSize: 11 }}
                              >
                                {!ALL_TRAINER_IDS.includes(tid) && <option value={tid}>{tid} (missing)</option>}
                                {ALL_TRAINER_IDS.filter((id) => id !== p.npcId).map((id) => (
                                  <option key={id} value={id}>{id}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => updateNpcDraft(p.npcId, {
                                  requiredTrainerDefeats: (draft.requiredTrainerDefeats ?? []).filter((_, j) => j !== i),
                                })}
                                style={{ background: '#2a2a2a', color: '#eee', border: '1px solid #555', borderRadius: 3, padding: '0 6px', cursor: 'pointer', fontSize: 11 }}
                                title="Remove prerequisite"
                              >×</button>
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              const cur = draft.requiredTrainerDefeats ?? [];
                              const first = ALL_TRAINER_IDS.find((id) => id !== p.npcId && !cur.includes(id)) ?? ALL_TRAINER_IDS.find((id) => id !== p.npcId);
                              if (!first) return;
                              updateNpcDraft(p.npcId, { requiredTrainerDefeats: [...cur, first] });
                            }}
                            disabled={ALL_TRAINER_IDS.filter((id) => id !== p.npcId).length === 0}
                            style={{ background: '#2a2a2a', color: '#eee', border: '1px solid #555', borderRadius: 3, padding: '2px 8px', cursor: 'pointer', fontSize: 11 }}
                          >
                            + prerequisite
                          </button>
                          {(draft.requiredTrainerDefeats?.length ?? 0) > 0 && (
                            <input
                              placeholder="blocked message (optional)"
                              value={draft.prereqBlockedMessage ?? ''}
                              onChange={(e) => updateNpcDraft(p.npcId, { prereqBlockedMessage: e.target.value || undefined })}
                              style={{ width: '100%', marginTop: 4, ...TM_INPUT, fontSize: 11 }}
                            />
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>Post-defeat dialogue ({draft.postDefeatDialogue?.length ?? 0})</div>
                          {(draft.postDefeatDialogue ?? []).map((line, i) => (
                            <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 3 }}>
                              <textarea
                                value={line}
                                onChange={(e) => updateNpcDraft(p.npcId, {
                                  postDefeatDialogue: (draft.postDefeatDialogue ?? []).map((d, j) => j === i ? e.target.value : d),
                                })}
                                rows={2}
                                style={{ flex: 1, background: '#111', color: '#eee', border: '1px solid #444', borderRadius: 3, padding: '2px 4px', fontSize: 11, resize: 'vertical', fontFamily: 'inherit' }}
                              />
                              <button
                                onClick={() => updateNpcDraft(p.npcId, {
                                  postDefeatDialogue: (draft.postDefeatDialogue ?? []).filter((_, j) => j !== i),
                                })}
                                style={{ background: '#2a2a2a', color: '#eee', border: '1px solid #555', borderRadius: 3, padding: '0 6px', cursor: 'pointer', fontSize: 11 }}
                                title="Remove line"
                              >×</button>
                            </div>
                          ))}
                          <button
                            onClick={() => updateNpcDraft(p.npcId, {
                              postDefeatDialogue: [...(draft.postDefeatDialogue ?? []), ''],
                            })}
                            style={{ background: '#2a2a2a', color: '#eee', border: '1px solid #555', borderRadius: 3, padding: '2px 8px', cursor: 'pointer', fontSize: 11 }}
                          >
                            + line
                          </button>
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => saveNpc(p.npcId)}
                        disabled={!dirty || status === 'saving'}
                        style={{
                          background: dirty ? '#2a5a2a' : '#2a2a2a',
                          color: '#eee', border: '1px solid #555', borderRadius: 3,
                          padding: '3px 10px', cursor: dirty ? 'pointer' : 'default', fontSize: 11,
                        }}
                      >
                        {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Save NPC'}
                      </button>
                      <button
                        onClick={() => unplaceNpc(p.npcId)}
                        title="Remove from this map (keeps the NPC JSON so + Place can drop it back later, including on another map)"
                        style={{
                          background: '#2a2a2a', color: '#ffd93d', border: '1px solid #665533',
                          borderRadius: 3, padding: '3px 10px', cursor: 'pointer', fontSize: 11,
                        }}
                      >
                        Unplace
                      </button>
                      <button
                        onClick={() => deleteNpc(p.npcId)}
                        title="Delete the NPC JSON entirely (removes from every map). Use 'Unplace' if you only want to remove from this map."
                        style={{
                          background: '#2a2a2a', color: '#f88', border: '1px solid #633',
                          borderRadius: 3, padding: '3px 10px', cursor: 'pointer', fontSize: 11,
                        }}
                      >
                        Delete NPC
                      </button>
                      {dirty && <span style={{ color: '#ffd93d', fontSize: 10 }}>unsaved</span>}
                      {status === 'error' && <span style={{ color: '#f66', fontSize: 10 }} title={err}>save failed</span>}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        )}

        {/* World signs — interactable signposts placed on the map. Stored in
            src/world/data/worldSigns.json (global). Each sign has a sprite
            variant (1×1 or wide), a kind that drives the in-game action,
            and an optional label for accessibility. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '10px 0 4px' }}>
          <h3
            style={{ fontSize: 12, color: '#888', margin: 0, ...sectionHeaderClick }}
            onClick={() => toggleSection('signs')}
          >
            <span style={{ width: 10, textAlign: 'center', color: '#666' }}>
              {isSectionOpen('signs') ? '▼' : '▶'}
            </span>
            Signs ({signs.filter((s) => s.mapId === activeMapId).length})
          </h3>
          <button
            onClick={createSign}
            style={{
              padding: '2px 8px', background: '#2a2a2a', color: '#eee',
              border: '1px solid #555', borderRadius: 4, cursor: 'pointer', fontSize: 11,
            }}
            title="Drop a new sign at the center of the current view"
          >
            + Sign
          </button>
        </div>
        {isSectionOpen('signs') && signSaveStatus === 'error' && signSaveError && (
          <div style={{ marginBottom: 6, color: '#f66', fontSize: 11, whiteSpace: 'pre-wrap' }}>
            Sign save failed: {signSaveError}
          </div>
        )}
        {isSectionOpen('signs') && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 12, lineHeight: 1.6 }}>
          {signs.filter((s) => s.mapId === activeMapId).map((s) => {
            const key = signKey(s.id);
            const isSel = selection.has(key);
            const w = getSignWidth(s.sprite);
            return (
              <li
                key={s.id}
                style={{
                  padding: isSel ? 6 : '2px 8px', borderRadius: 4, marginBottom: isSel ? 6 : 0,
                  background: isSel ? '#ffd93d14' : 'transparent',
                  border: isSel ? '1px solid #ffd93d' : '1px solid transparent',
                  color: '#ddd',
                }}
              >
                <div
                  style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center' }}
                  onClick={(e) => toggleSidebar(key, e.shiftKey)}
                >
                  <span>
                    <code>{s.id}</code>{' '}
                    <span style={{ color: '#666' }}>({s.tileX},{s.tileY})</span>
                  </span>
                  <span style={{ color: '#888', fontSize: 10 }}>
                    {s.sprite}{w > 1 ? ` ×${w}` : ''}
                  </span>
                </div>
                {isSel && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {/* Sprite picker */}
                    <label style={{ fontSize: 11, color: '#aaa' }}>
                      Sprite
                      <select
                        value={s.sprite}
                        onChange={(e) => updateSign(s.id, { sprite: e.target.value as WorldSignSprite })}
                        style={{
                          width: '100%', marginTop: 2, padding: '3px 6px',
                          background: '#1a1a1a', color: '#eee', border: '1px solid #444',
                          borderRadius: 3, fontFamily: 'monospace', fontSize: 11,
                        }}
                      >
                        {SIGN_SPRITES.map((sp) => (
                          <option key={sp} value={sp}>
                            {sp}{getSignWidth(sp) > 1 ? ` (${getSignWidth(sp)} tiles)` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    {/* Kind selector — drives which content fields appear
                        below. Switching kinds preserves the OTHER kind's
                        data on the sign so a designer can flip back and
                        forth without retyping. */}
                    <label style={{ fontSize: 11, color: '#aaa' }}>
                      Kind
                      <select
                        value={s.kind}
                        onChange={(e) => updateSign(s.id, { kind: e.target.value as WorldSignKind })}
                        style={{
                          width: '100%', marginTop: 2, padding: '3px 6px',
                          background: '#1a1a1a', color: '#eee', border: '1px solid #444',
                          borderRadius: 3, fontFamily: 'monospace', fontSize: 11,
                        }}
                      >
                        {WORLD_SIGN_KINDS.map((k) => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                    </label>
                    {/* Per-kind content editors. */}
                    {s.kind === 'dojo-poster' && (
                      <div style={{ color: '#aaa', fontSize: 10, padding: '4px 6px', background: '#1a1a1a', border: '1px solid #333', borderRadius: 3 }}>
                        Legacy kind — image is hardcoded to
                        <code style={{ marginLeft: 4 }}>store/dojo-challenge-poster.png</code>.
                        Switch to <code>image-popup</code> to use a custom image.
                      </div>
                    )}
                    {s.kind === 'image-popup' && (
                      <label style={{ fontSize: 11, color: '#aaa' }}>
                        Image path (CDN)
                        <input
                          type="text"
                          value={s.imagePath ?? ''}
                          onChange={(e) => updateSign(s.id, { imagePath: e.target.value || undefined })}
                          placeholder="store/dojo-challenge-poster.png"
                          style={{
                            width: '100%', marginTop: 2, padding: '3px 6px',
                            background: '#1a1a1a', color: '#eee', border: '1px solid #444',
                            borderRadius: 3, fontFamily: 'monospace', fontSize: 11,
                          }}
                        />
                        <div style={{ marginTop: 2, color: '#666', fontSize: 10 }}>
                          Path under the CDN bucket. Loaded via
                          <code style={{ marginLeft: 4 }}>RundotGameAPI.cdn.fetchAsset</code>.
                        </div>
                      </label>
                    )}
                    {s.kind === 'text-dialogue' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 11, color: '#aaa' }}>
                          Dialogue pages ({(s.text ?? []).length})
                        </div>
                        {(s.text ?? []).map((page, i) => (
                          <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
                            <textarea
                              value={page}
                              onChange={(e) => {
                                const next = [...(s.text ?? [])];
                                next[i] = e.target.value;
                                updateSign(s.id, { text: next });
                              }}
                              rows={2}
                              style={{
                                flex: 1, padding: '4px 6px', background: '#1a1a1a',
                                color: '#eee', border: '1px solid #444', borderRadius: 3,
                                fontFamily: 'monospace', fontSize: 11, resize: 'vertical',
                              }}
                            />
                            <button
                              onClick={() => {
                                const next = (s.text ?? []).filter((_, j) => j !== i);
                                updateSign(s.id, { text: next.length > 0 ? next : [''] });
                              }}
                              title="Remove this page"
                              style={{
                                background: '#2a2a2a', color: '#f88', border: '1px solid #633',
                                borderRadius: 3, padding: '2px 6px', cursor: 'pointer', fontSize: 10,
                              }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => updateSign(s.id, { text: [...(s.text ?? []), ''] })}
                          style={{
                            background: '#2a2a32', color: '#9cf', border: '1px solid #355',
                            borderRadius: 3, padding: '3px 8px', cursor: 'pointer', fontSize: 11,
                            alignSelf: 'flex-start', marginTop: 2,
                          }}
                        >
                          + page
                        </button>
                      </div>
                    )}
                    {/* Optional accessibility label */}
                    <label style={{ fontSize: 11, color: '#aaa' }}>
                      Label (optional)
                      <input
                        type="text"
                        value={s.label ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateSign(s.id, v ? { label: v } : { label: undefined });
                        }}
                        placeholder="DOJO"
                        style={{
                          width: '100%', marginTop: 2, padding: '3px 6px',
                          background: '#1a1a1a', color: '#eee', border: '1px solid #444',
                          borderRadius: 3, fontFamily: 'monospace', fontSize: 11,
                        }}
                      />
                    </label>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <button
                        onClick={() => {
                          const wx = s.tileX * TILE_SIZE + TILE_SIZE / 2;
                          const wy = s.tileY * TILE_SIZE + TILE_SIZE / 2;
                          setCam((c) => ({ ...c, x: wx - viewport.w / 2 / c.zoom, y: wy - viewport.h / 2 / c.zoom }));
                        }}
                        title="Center camera on this sign"
                        style={{
                          background: '#1e3a4a', color: '#9cf', border: '1px solid #355',
                          borderRadius: 3, padding: '3px 10px', cursor: 'pointer', fontSize: 11,
                        }}
                      >
                        go
                      </button>
                      <button
                        onClick={() => deleteSign(s.id)}
                        style={{
                          background: '#2a2a2a', color: '#f88', border: '1px solid #633',
                          borderRadius: 3, padding: '3px 10px', cursor: 'pointer', fontSize: 11,
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '10px 0 4px' }}>
          <h3
            style={{ fontSize: 12, color: '#888', margin: 0, ...sectionHeaderClick }}
            onClick={() => toggleSection('animals')}
          >
            <span style={{ width: 10, textAlign: 'center', color: '#666' }}>
              {isSectionOpen('animals') ? '▼' : '▶'}
            </span>
            Animals ({animals.length})
          </h3>
          <button
            onClick={createAnimal}
            disabled={animalCatalog.length === 0}
            style={{
              padding: '2px 8px', background: '#2a2a2a', color: '#eee',
              border: '1px solid #555', borderRadius: 4,
              cursor: animalCatalog.length === 0 ? 'default' : 'pointer',
              fontSize: 11,
              opacity: animalCatalog.length === 0 ? 0.5 : 1,
            }}
            title={animalCatalog.length === 0 ? 'Loading species list…' : 'Add an animal at view center'}
          >
            + Animal
          </button>
        </div>
        {isSectionOpen('animals') && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 12, lineHeight: 1.6 }}>
          {animals.map((a, i) => {
            const key = animalKey(i);
            const isSel = selection.has(key);
            const species = animalCatalog.find((c) => c.type === a.type);
            const sheetVariants = species?.sheets ?? [];
            const currentSheet = a.sheet ?? 'SpriteSheet';
            const variantLabel = (s: string) => {
              if (s === 'SpriteSheet') return 'default';
              // Strip the common prefix; fall back to full stem for oddities
              // like the misspelled Lioness sheet.
              return s.replace(/^SpriteSheet/i, '').replace(/^SpriteSheeL/i, '') || s;
            };
            return (
              <li
                key={i}
                style={{
                  padding: isSel ? 6 : '2px 8px', borderRadius: 4, marginBottom: isSel ? 6 : 0,
                  background: isSel ? '#ffd93d14' : 'transparent',
                  border: isSel ? '1px solid #ffd93d' : '1px solid transparent',
                  color: '#ddd',
                }}
              >
                <div
                  style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center' }}
                  onClick={(e) => toggleSidebar(key, e.shiftKey)}
                >
                  <span>
                    <code>{a.type}</code>
                    {a.sheet && a.sheet !== 'SpriteSheet' && (
                      <span style={{ color: '#888' }}> · {variantLabel(a.sheet)}</span>
                    )}{' '}
                    <span style={{ color: '#666' }}>({a.tileX},{a.tileY})</span>
                  </span>
                  <span style={{ color: '#888', fontSize: 11 }}>roam {a.wanderTiles}t</span>
                </div>
                {isSel && (
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11, color: '#aaa' }}>
                      Species
                      <select
                        value={a.type}
                        onChange={(e) => {
                          const nextSpecies = animalCatalog.find((c) => c.type === e.target.value);
                          const nextSheet = nextSpecies
                            ? (nextSpecies.sheets.includes('SpriteSheet') ? 'SpriteSheet' : nextSpecies.sheets[0]!)
                            : 'SpriteSheet';
                          updateAnimal(i, {
                            type: e.target.value,
                            // Drop `sheet` when it's default to keep the JSON clean.
                            ...(nextSheet === 'SpriteSheet' ? { sheet: undefined } : { sheet: nextSheet }),
                          });
                        }}
                        style={{ flex: 1, background: '#111', color: '#eee', border: '1px solid #444', borderRadius: 3, padding: '2px 4px', fontSize: 11 }}
                      >
                        {!species && <option value={a.type}>{a.type} (missing)</option>}
                        {animalCatalog.map((c) => (
                          <option key={c.type} value={c.type}>
                            {c.type}{c.sheets.length > 1 ? ` (${c.sheets.length} variants)` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    {sheetVariants.length > 1 && (
                      <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11, color: '#aaa' }}>
                        Variant
                        <select
                          value={currentSheet}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateAnimal(i, v === 'SpriteSheet' ? { sheet: undefined } : { sheet: v });
                          }}
                          style={{ flex: 1, background: '#111', color: '#eee', border: '1px solid #444', borderRadius: 3, padding: '2px 4px', fontSize: 11 }}
                        >
                          {sheetVariants.map((s) => (
                            <option key={s} value={s}>{variantLabel(s)}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11, color: '#aaa' }}>
                      Wander range (tiles)
                      <input
                        type="range"
                        min={0}
                        max={15}
                        step={1}
                        value={a.wanderTiles}
                        onChange={(e) => updateAnimal(i, { wanderTiles: parseInt(e.target.value, 10) })}
                        style={{ flex: 1 }}
                      />
                      <NumberInput
                        value={a.wanderTiles}
                        min={0}
                        max={99}
                        onCommit={(n) => updateAnimal(i, { wanderTiles: n })}
                        style={{ width: 44, background: '#111', color: '#eee', border: '1px solid #444', borderRadius: 3, padding: '2px 4px', fontSize: 11 }}
                      />
                    </label>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => {
                          const wx = a.tileX * TILE_SIZE + TILE_SIZE / 2;
                          const wy = a.tileY * TILE_SIZE + TILE_SIZE / 2;
                          setCam((c) => ({ ...c, x: wx - viewport.w / 2 / c.zoom, y: wy - viewport.h / 2 / c.zoom }));
                        }}
                        title="Center camera (hotkey: F)"
                        style={{ padding: '3px 10px', fontSize: 11, background: '#1e3a4a', color: '#9cf', border: '1px solid #355', borderRadius: 3, cursor: 'pointer' }}
                      >
                        go
                      </button>
                      <button
                        onClick={() => deleteAnimal(i)}
                        style={{ background: '#2a2a2a', color: '#f88', border: '1px solid #633', borderRadius: 3, padding: '3px 10px', cursor: 'pointer', fontSize: 11 }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        )}

        {/* Decorative objects — static images placed on a tile. First pass
            sources from public/world/tilesets/Animated/Flag/; editor-only
            renderer (game runtime support is a follow-up). */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '10px 0 4px' }}>
          <h3
            style={{ fontSize: 12, color: '#888', margin: 0, ...sectionHeaderClick }}
            onClick={() => toggleSection('objects')}
          >
            <span style={{ width: 10, textAlign: 'center', color: '#666' }}>
              {isSectionOpen('objects') ? '▼' : '▶'}
            </span>
            Objects ({objects.length})
          </h3>
          <button
            onClick={createObject}
            disabled={objectCatalog.length === 0}
            style={{
              padding: '2px 8px', background: '#2a2a2a', color: '#eee',
              border: '1px solid #555', borderRadius: 4,
              cursor: objectCatalog.length === 0 ? 'default' : 'pointer',
              fontSize: 11,
              opacity: objectCatalog.length === 0 ? 0.5 : 1,
            }}
            title={objectCatalog.length === 0 ? 'Loading object catalog…' : 'Add an object at view center'}
          >
            + Object
          </button>
        </div>
        {isSectionOpen('objects') && (() => {
          // Group placements by source folder ("Animated/Flag" etc.) so a
          // densely-decorated map doesn't show a 200-row flat list. Each
          // group has its own collapse state persisted to localStorage.
          const groups = new Map<string, Array<{ o: ObjectPlacement; index: number }>>();
          objects.forEach((o, i) => {
            const folder = folderOf(o.image);
            if (!groups.has(folder)) groups.set(folder, []);
            groups.get(folder)!.push({ o, index: i });
          });
          const orderedGroups = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
          return (
            <div>
            {orderedGroups.map(([folder, entries]) => {
              const isFolderOpen = !collapsedObjectFolders.has(folder);
              const folderLabel = folder.replace(/^Animated\//, '');
              return (
                <div key={folder} style={{ marginBottom: 4 }}>
                  <div
                    onClick={() => toggleObjectFolder(folder)}
                    style={{
                      ...sectionHeaderClick,
                      fontSize: 11, color: '#9cf', padding: '3px 4px',
                      borderBottom: '1px solid #2a2a2a',
                    }}
                  >
                    <span style={{ width: 10, textAlign: 'center', color: '#7aa' }}>
                      {isFolderOpen ? '▼' : '▶'}
                    </span>
                    {folderLabel} ({entries.length})
                  </div>
                  {isFolderOpen && (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 12, lineHeight: 1.6 }}>
                      {entries.map(({ o, index: i }) => {
            const key = objectKey(i);
            const isSel = selection.has(key);
            const label = o.image.replace(/^.*\//, '').replace(/\.png$/i, '');
            return (
              <li
                key={i}
                style={{
                  padding: isSel ? 6 : '2px 8px', borderRadius: 4, marginBottom: isSel ? 6 : 0,
                  background: isSel ? '#ffd93d14' : 'transparent',
                  border: isSel ? '1px solid #ffd93d' : '1px solid transparent',
                  color: '#ddd',
                }}
              >
                <div
                  style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center' }}
                  onClick={(e) => toggleSidebar(key, e.shiftKey)}
                >
                  <span>
                    <code>{label}</code>{' '}
                    <span style={{ color: '#666' }}>({o.tileX},{o.tileY})</span>
                  </span>
                </div>
                {isSel && (
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11, color: '#aaa' }}>
                      Image
                      <select
                        value={o.image}
                        onChange={(e) => updateObject(i, { image: e.target.value })}
                        style={{ flex: 1, background: '#111', color: '#eee', border: '1px solid #444', borderRadius: 3, padding: '2px 4px', fontSize: 11 }}
                      >
                        {/* If the current image isn't in the catalog (renamed
                            / deleted file), show it as a "missing" entry so
                            the value still round-trips through save. */}
                        {!objectCatalog.some((c) => c.image === o.image) && (
                          <option value={o.image}>{label} (missing)</option>
                        )}
                        {objectCatalog.map((c) => (
                          <option key={c.image} value={c.image}>{c.name.replace(/\.png$/i, '')}</option>
                        ))}
                      </select>
                    </label>
                    {/* Sub-tile offset in SOURCE pixels (16-px grid). Drag
                        on the canvas still snaps to whole tiles; these
                        inputs are for fine-tune nudges (e.g. a flagpole
                        that needs to sit 3 px to the right of its tile). */}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: '#aaa' }}>
                      <span>Offset</span>
                      <label style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        x
                        <NumberInput
                          value={o.offsetX ?? 0}
                          min={-99}
                          max={99}
                          onCommit={(n) => updateObject(i, { offsetX: n || undefined })}
                          style={{ width: 48, background: '#111', color: '#eee', border: '1px solid #444', borderRadius: 3, padding: '2px 4px', fontSize: 11 }}
                        />
                      </label>
                      <label style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        y
                        <NumberInput
                          value={o.offsetY ?? 0}
                          min={-99}
                          max={99}
                          onCommit={(n) => updateObject(i, { offsetY: n || undefined })}
                          style={{ width: 48, background: '#111', color: '#eee', border: '1px solid #444', borderRadius: 3, padding: '2px 4px', fontSize: 11 }}
                        />
                      </label>
                      <span style={{ color: '#666', fontSize: 10 }}>px</span>
                    </div>
                    <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11, color: '#aaa' }}>
                      Draw
                      <select
                        value={o.drawOrder ?? 'under'}
                        onChange={(e) => {
                          const v = e.target.value as ObjectDrawOrder;
                          updateObject(i, { drawOrder: v === 'under' ? undefined : v });
                        }}
                        style={{ flex: 1, background: '#111', color: '#eee', border: '1px solid #444', borderRadius: 3, padding: '2px 4px', fontSize: 11 }}
                      >
                        {OBJECT_DRAW_ORDER_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: '#aaa' }}>
                      <input
                        type="checkbox"
                        checked={!!o.blocksPassage}
                        onChange={(e) => {
                          const next = e.target.checked || undefined;
                          updateObject(i, { blocksPassage: next });
                          // Leaving edit mode if blocking is turned off so
                          // we don't leave dangling handles on the canvas.
                          if (!next && editColliderIndex === i) setEditColliderIndex(null);
                        }}
                      />
                      Blocks player
                    </label>
                    {o.blocksPassage && (() => {
                      const src = `world/tilesets/${o.image}`;
                      const folder = folderOf(o.image);
                      const { frameW, frameH } = frameDimsFor(o.image);
                      const folderDefault = folderColliderDefaults[folder] ?? null;
                      const auto = objectBBoxes[src] ?? null;
                      const cb = o.colliderBox ?? folderDefault ?? auto ?? { x: 0, y: 0, w: frameW, h: frameH };
                      const source = colliderSourceFor(o);
                      const setCb = (patch: Partial<typeof cb>) => {
                        const next = { ...cb, ...patch };
                        // Clamp to the actual frame grid with min 1×1.
                        // Negative dragging is normalized at the canvas
                        // layer; the sidebar just guards the input range.
                        next.x = Math.max(0, Math.min(frameW - 1, next.x));
                        next.y = Math.max(0, Math.min(frameH - 1, next.y));
                        next.w = Math.max(1, Math.min(frameW - next.x, next.w));
                        next.h = Math.max(1, Math.min(frameH - next.y, next.h));
                        updateObject(i, { colliderBox: next });
                      };
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 6px', background: '#1a1a1a', border: '1px solid #333', borderRadius: 3 }}>
                          <div style={{ fontSize: 11, color: '#aaa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Collider (src px)</span>
                            <span style={{ color: source === 'custom' ? '#ffe066' : source === 'folder' ? '#9cf' : '#666', fontSize: 10 }}>
                              {source === 'custom' ? 'custom' : source === 'folder' ? `${folder} default` : 'auto'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11, color: '#aaa', flexWrap: 'wrap' }}>
                            <label style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                              x
                              <NumberInput
                                value={cb.x}
                                min={0}
                                max={frameW - 1}
                                onCommit={(n) => setCb({ x: n })}
                                style={{ width: 40, background: '#111', color: '#eee', border: '1px solid #444', borderRadius: 3, padding: '2px 4px', fontSize: 11 }}
                              />
                            </label>
                            <label style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                              y
                              <NumberInput
                                value={cb.y}
                                min={0}
                                max={frameH - 1}
                                onCommit={(n) => setCb({ y: n })}
                                style={{ width: 40, background: '#111', color: '#eee', border: '1px solid #444', borderRadius: 3, padding: '2px 4px', fontSize: 11 }}
                              />
                            </label>
                            <label style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                              w
                              <NumberInput
                                value={cb.w}
                                min={1}
                                max={frameW}
                                onCommit={(n) => setCb({ w: n })}
                                style={{ width: 40, background: '#111', color: '#eee', border: '1px solid #444', borderRadius: 3, padding: '2px 4px', fontSize: 11 }}
                              />
                            </label>
                            <label style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                              h
                              <NumberInput
                                value={cb.h}
                                min={1}
                                max={frameH}
                                onCommit={(n) => setCb({ h: n })}
                                style={{ width: 40, background: '#111', color: '#eee', border: '1px solid #444', borderRadius: 3, padding: '2px 4px', fontSize: 11 }}
                              />
                            </label>
                          </div>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <button
                              onClick={() => setEditColliderIndex(editColliderIndex === i ? null : i)}
                              style={{
                                flex: 1, padding: '3px 8px', fontSize: 11,
                                background: editColliderIndex === i ? '#3b7a3b' : '#2a2a32',
                                color: editColliderIndex === i ? '#fff' : '#9cf',
                                border: '1px solid ' + (editColliderIndex === i ? '#5a3' : '#355'),
                                borderRadius: 3, cursor: 'pointer',
                              }}
                              title="Toggle on-canvas handles. Drag a corner/edge to resize, drag inside the rect to move."
                            >
                              {editColliderIndex === i ? 'Editing on canvas — done' : 'Edit on canvas'}
                            </button>
                            <button
                              onClick={async () => {
                                // Save the CURRENT resolved box (whatever
                                // the inspector is showing) as the folder
                                // default. After persisting, drop this
                                // placement's per-instance override since
                                // it would now duplicate the default and
                                // bloat the JSON. Every other placement in
                                // the same folder (current + future)
                                // inherits it automatically via the
                                // fallback chain.
                                const payload = { folder, colliderBox: cb };
                                try {
                                  const r = await fetch('/api/editor/save-object-folder-default', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(payload),
                                  });
                                  if (!r.ok) throw new Error(`save-object-folder-default ${r.status} ${await r.text()}`);
                                  setFolderColliderDefaults((prev) => ({ ...prev, [folder]: cb }));
                                  if (o.colliderBox) updateObject(i, { colliderBox: undefined });
                                } catch (err) {
                                  console.error('[editor] folder default save failed:', err);
                                  await showAlert(`Failed to save folder default:\n${String(err)}`);
                                }
                              }}
                              title={`Make this collider the default for every PNG in ${folder}/. Existing and future placements without their own override will use it.`}
                              style={{
                                padding: '3px 8px', fontSize: 11,
                                background: '#2a3a4a', color: '#9cf',
                                border: '1px solid #466', borderRadius: 3,
                                cursor: 'pointer',
                              }}
                            >
                              Set as folder default
                            </button>
                            <button
                              onClick={() => updateObject(i, { colliderBox: undefined })}
                              disabled={!o.colliderBox}
                              style={{
                                padding: '3px 8px', fontSize: 11,
                                background: '#2a2a2a',
                                color: o.colliderBox ? '#ddd' : '#666',
                                border: '1px solid #444', borderRadius: 3,
                                cursor: o.colliderBox ? 'pointer' : 'default',
                              }}
                              title="Drop the custom box and fall back to the auto alpha-bbox crop."
                            >
                              Reset to auto
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: '#aaa' }}>
                      <input
                        type="checkbox"
                        checked={o.randomizeFrameStart !== false}
                        onChange={(e) => updateObject(i, { randomizeFrameStart: e.target.checked ? undefined : false })}
                      />
                      Randomize frame start
                    </label>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => {
                          const wx = o.tileX * TILE_SIZE + TILE_SIZE / 2;
                          const wy = o.tileY * TILE_SIZE + TILE_SIZE / 2;
                          setCam((c) => ({ ...c, x: wx - viewport.w / 2 / c.zoom, y: wy - viewport.h / 2 / c.zoom }));
                        }}
                        title="Center camera (hotkey: F)"
                        style={{ padding: '3px 10px', fontSize: 11, background: '#1e3a4a', color: '#9cf', border: '1px solid #355', borderRadius: 3, cursor: 'pointer' }}
                      >
                        go
                      </button>
                      <button
                        onClick={() => duplicateObject(i)}
                        title="Duplicate this object one tile to the right; selection moves to the copy."
                        style={{ padding: '3px 10px', fontSize: 11, background: '#2a3a2a', color: '#9f9', border: '1px solid #363', borderRadius: 3, cursor: 'pointer' }}
                      >
                        Duplicate
                      </button>
                      <button
                        onClick={() => deleteObject(i)}
                        style={{ background: '#2a2a2a', color: '#f88', border: '1px solid #633', borderRadius: 3, padding: '3px 10px', cursor: 'pointer', fontSize: 11 }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
                    </ul>
                  )}
                </div>
              );
            })}
            </div>
          );
        })()}

        <hr style={{ borderColor: '#333', margin: '12px 0' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2
            style={{ fontSize: 13, color: '#9cf', margin: 0, ...sectionHeaderClick }}
            onClick={() => toggleSection('portals')}
          >
            <span style={{ width: 10, textAlign: 'center', color: '#7aa' }}>
              {isSectionOpen('portals') ? '▼' : '▶'}
            </span>
            Portals ({activePortalHalves.length > 0
              ? `${activePortalHalves.length} on map · ${portals.length} total`
              : portals.length})
          </h2>
          <button
            onClick={addPortalPair}
            style={{
              padding: '2px 8px', background: '#2a2a2a', color: '#eee',
              border: '1px solid #555', borderRadius: 4, cursor: 'pointer', fontSize: 11,
            }}
          >
            + pair
          </button>
        </div>
        {isSectionOpen('portals') && (
        portals.length === 0 ? (
          <div style={{ color: '#666', fontSize: 11, marginTop: 4 }}>No portals yet. Click <b>+ pair</b>.</div>
        ) : activePortalHalves.length === 0 ? (
          <div style={{ color: '#666', fontSize: 11, marginTop: 4 }}>
            None on this map ({portals.length} on other maps).
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0', fontSize: 11, lineHeight: 1.4 }}>
            {portals
              .filter((p) => p.a.mapId === activeMapId || p.b.mapId === activeMapId)
              .map((p) => {
              const rectASel = selection.has(portalRectKey(p.id, 'a'));
              const rectBSel = selection.has(portalRectKey(p.id, 'b'));
              const anySel = rectASel || rectBSel ||
                selection.has(portalSpawnKey(p.id, 'a')) || selection.has(portalSpawnKey(p.id, 'b'));
              return (
                <li
                  key={p.id}
                  style={{
                    padding: anySel ? 6 : 4,
                    marginBottom: 4,
                    borderRadius: 4,
                    background: anySel ? '#ffd93d14' : '#1a1a1a',
                    border: '1px solid ' + (anySel ? '#ffd93d' : '#333'),
                  }}
                >
                  {/* Collapsed header — click to select (and expand) */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                    }}
                    onClick={(e) => toggleSidebar(portalRectKey(p.id, 'a'), e.shiftKey)}
                    title={anySel ? '' : 'Click to expand'}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: '#666', fontSize: 9 }}>{anySel ? '▾' : '▸'}</span>
                      <code style={{ color: '#ddd' }}>{p.id}</code>
                      {!anySel && (
                        <span style={{ color: '#666', fontSize: 10 }}>
                          · {p.a.mapId} ↔ {p.b.mapId}
                        </span>
                      )}
                    </span>
                    {anySel && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deletePortalPair(p.id); }}
                        title="Delete pair"
                        style={{
                          padding: '1px 6px', fontSize: 10, background: '#3a1f1f', color: '#f66',
                          border: '1px solid #5a2a2a', borderRadius: 3, cursor: 'pointer',
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {anySel && (['a', 'b'] as const).map((side) => {
                    const half = side === 'a' ? p.a : p.b;
                    const isSel = selection.has(portalRectKey(p.id, side));
                    return (
                      <div
                        key={side}
                        style={{
                          marginTop: 4,
                          padding: '4px 6px',
                          background: isSel ? '#ffd93d22' : '#242424',
                          border: '1px solid ' + (isSel ? '#ffd93d' : '#333'),
                          borderRadius: 3,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                          onClick={(e) => toggleSidebar(portalRectKey(p.id, side), e.shiftKey)}
                        >
                          <span style={{ color: side === 'a' ? '#ff66c4' : '#33dcc8', fontWeight: 'bold' }}>
                            {side.toUpperCase()}
                          </span>
                          <select
                            value={half.mapId}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updatePortalHalf(p.id, side, { mapId: e.target.value })}
                            style={{
                              flex: 1, background: '#1a1a1a', color: '#ddd',
                              border: '1px solid #444', borderRadius: 3, fontSize: 11, padding: '1px 4px',
                            }}
                          >
                            {availableMapIds.map((m) => (<option key={m} value={m}>{m}</option>))}
                          </select>
                          <button
                            onClick={(e) => { e.stopPropagation(); jumpToHalf(p.id, side); }}
                            title={activeMapId === half.mapId ? 'Center camera on this half' : `Jump to ${half.mapId} at this half`}
                            style={{
                              padding: '1px 6px', fontSize: 10, background: '#1e3a4a', color: '#9cf',
                              border: '1px solid #355', borderRadius: 3, cursor: 'pointer',
                            }}
                          >
                            go
                          </button>
                        </div>
                        <div style={{ color: '#888', fontSize: 10, marginTop: 3 }}>
                          rect ({half.rect.tileX},{half.rect.tileY}) {half.rect.w}×{half.rect.h} ·
                          {' '}spawn ({half.spawn.tileX},{half.spawn.tileY})
                          <div style={{ marginTop: 2, display: 'flex', gap: 3, alignItems: 'center' }}>
                            <label style={{ color: '#666' }}>face</label>
                            <select
                              value={half.facing ?? 'down'}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setPortalFacing(p.id, side, e.target.value as 'up' | 'down' | 'left' | 'right')}
                              style={{ background: '#1a1a1a', color: '#ddd', border: '1px solid #444', borderRadius: 3, fontSize: 10, padding: '1px 2px' }}
                            >
                              <option value="up">North</option>
                              <option value="down">South</option>
                              <option value="left">West</option>
                              <option value="right">East</option>
                            </select>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPortalFacing(p.id, side, half.facing ?? 'down');
                              }}
                              title="Snap spawn to the tile just outside the rect in the facing direction"
                              style={{
                                padding: '1px 6px', fontSize: 10, background: '#2a2a2a',
                                color: '#eee', border: '1px solid #444', borderRadius: 3, cursor: 'pointer',
                              }}
                            >
                              snap
                            </button>
                          </div>
                          <div style={{ marginTop: 2, display: 'flex', gap: 3, alignItems: 'center' }}>
                            <label style={{ color: '#666' }}>size</label>
                            <NumberInput
                              value={half.rect.w}
                              min={1}
                              max={16}
                              onCommit={(w) => updatePortalHalf(p.id, side, { rect: { ...half.rect, w } })}
                              style={{ width: 34, background: '#1a1a1a', color: '#ddd', border: '1px solid #444', borderRadius: 3, fontSize: 10, padding: '1px 2px' }}
                            />
                            ×
                            <NumberInput
                              value={half.rect.h}
                              min={1}
                              max={16}
                              onCommit={(h) => updatePortalHalf(p.id, side, { rect: { ...half.rect, h } })}
                              style={{ width: 34, background: '#1a1a1a', color: '#ddd', border: '1px solid #444', borderRadius: 3, fontSize: 10, padding: '1px 2px' }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {anySel && (
                    <PortalGateEditor
                      portal={p}
                      onChange={(g) => updatePortalGate(p.id, g)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )
        )}

        {(() => {
          const patches = map ? getGrassPatches(map) : [];
          const grassKeys = [...selection].filter((k) => k.startsWith('grass:'));
          return (
            <>
              <hr style={{ borderColor: '#333', margin: '12px 0' }} />
              <h2
                style={{ fontSize: 13, color: '#9cf', margin: '0 0 6px', ...sectionHeaderClick }}
                onClick={() => toggleSection('grass')}
              >
                <span style={{ width: 10, textAlign: 'center', color: '#7aa' }}>
                  {isSectionOpen('grass') ? '▼' : '▶'}
                </span>
                Tall Grass ({patches.length})
              </h2>
              {isSectionOpen('grass') && (<>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: '#bbb', minWidth: 80 }}>Default backdrop</span>
                <div style={{ flex: 1 }}>
                  <FramePicker
                    value={battleBgFrame}
                    onChange={(v) => setBattleBgFrame(v)}
                    inheritLabel="(forest fallback)"
                  />
                </div>
              </div>

              {patches.length === 0 ? (
                <div style={{ fontSize: 11, color: '#666', fontStyle: 'italic' }}>
                  No tall grass on this map.
                </div>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 12, lineHeight: 1.6 }}>
                  {patches.map((p) => {
                    const k = grassKey(p.signTile.tx, p.signTile.ty);
                    const isSel = selection.has(k);
                    const storeKey = `${p.signTile.tx},${p.signTile.ty}`;
                    const override = grassPatchBackgrounds[storeKey];
                    const lvl = grassPatchLevels[storeKey];
                    const effectiveMin = lvl?.min ?? p.minLevel;
                    const effectiveMax = lvl?.max ?? p.maxLevel;
                    return (
                      <li
                        key={k}
                        style={{
                          padding: isSel ? 6 : '3px 8px',
                          borderRadius: 4,
                          marginBottom: isSel ? 6 : 2,
                          background: isSel ? '#ffd93d14' : 'transparent',
                          border: isSel ? '1px solid #ffd93d' : '1px solid transparent',
                        }}
                      >
                        <div
                          onClick={(e) => toggleSidebar(k, e.shiftKey)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{ flex: 1, color: isSel ? '#ffd93d' : '#ddd' }}>
                            ({p.signTile.tx},{p.signTile.ty})
                            <span style={{ color: '#666' }}> · {p.tiles.length}t · </span>
                            <span style={{ color: lvl ? '#d9c2ff' : '#666' }}>Lv.{effectiveMin}-{effectiveMax}</span>
                          </span>
                          {override && (
                            <span style={{ fontSize: 10, color: '#d9c2ff' }}>{override}</span>
                          )}
                          {isSel && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Center camera on the patch centroid so large
                                // patches frame nicely instead of anchoring on
                                // the sign tile (which sits at the bbox corner).
                                const cxTile = p.tiles.reduce((s, t) => s + t.tx, 0) / p.tiles.length;
                                const cyTile = p.tiles.reduce((s, t) => s + t.ty, 0) / p.tiles.length;
                                const wx = cxTile * TILE_SIZE + TILE_SIZE / 2;
                                const wy = cyTile * TILE_SIZE + TILE_SIZE / 2;
                                setCam((c) => ({ ...c, x: wx - viewport.w / 2 / c.zoom, y: wy - viewport.h / 2 / c.zoom }));
                              }}
                              title="Center camera on this grass patch"
                              style={{
                                padding: '1px 6px', fontSize: 10, background: '#1e3a4a', color: '#9cf',
                                border: '1px solid #355', borderRadius: 3, cursor: 'pointer',
                              }}
                            >
                              go
                            </button>
                          )}
                        </div>

                        {isSel && grassKeys.length === 1 && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>Backdrop override</div>
                            <FramePicker
                              value={override}
                              onChange={(v) => {
                                setGrassPatchBackgrounds((prev) => {
                                  const next = { ...prev };
                                  if (v) next[storeKey] = v;
                                  else delete next[storeKey];
                                  return next;
                                });
                              }}
                              inheritLabel={`(use map default${battleBgFrame ? `: ${battleBgFrame}` : ': forest'})`}
                            />
                            <div style={{ fontSize: 10, color: '#888', marginTop: 10, marginBottom: 4 }}>Level range override</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <label style={{ fontSize: 11, color: '#bbb' }}>min</label>
                              <NumberInput
                                value={lvl?.min ?? p.minLevel}
                                min={1}
                                max={99}
                                onCommit={(n) => {
                                  setGrassPatchLevels((prev) => {
                                    const cur = prev[storeKey];
                                    const max = cur?.max ?? p.maxLevel;
                                    return { ...prev, [storeKey]: { min: n, max: Math.max(n, max) } };
                                  });
                                }}
                                style={{
                                  width: 56, padding: '2px 4px',
                                  background: '#1a1a1a', color: '#eee',
                                  border: '1px solid #444', borderRadius: 4, fontSize: 12,
                                }}
                              />
                              <label style={{ fontSize: 11, color: '#bbb', marginLeft: 8 }}>max</label>
                              <NumberInput
                                value={lvl?.max ?? p.maxLevel}
                                min={1}
                                max={99}
                                onCommit={(n) => {
                                  setGrassPatchLevels((prev) => {
                                    const cur = prev[storeKey];
                                    const min = cur?.min ?? p.minLevel;
                                    return { ...prev, [storeKey]: { min: Math.min(min, n), max: n } };
                                  });
                                }}
                                style={{
                                  width: 56, padding: '2px 4px',
                                  background: '#1a1a1a', color: '#eee',
                                  border: '1px solid #444', borderRadius: 4, fontSize: 12,
                                }}
                              />
                              {lvl && (
                                <button
                                  onClick={() => {
                                    setGrassPatchLevels((prev) => {
                                      const next = { ...prev };
                                      delete next[storeKey];
                                      return next;
                                    });
                                  }}
                                  style={{
                                    marginLeft: 'auto', padding: '2px 8px',
                                    background: '#2a2a2a', color: '#eee',
                                    border: '1px solid #555', borderRadius: 4, cursor: 'pointer', fontSize: 10,
                                  }}
                                  title="Drop the override and fall back to the auto-tier level range"
                                >
                                  reset
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {grassKeys.length > 1 && (
                <div style={{ marginTop: 10, fontSize: 11, color: '#888' }}>
                  {grassKeys.length} patches selected — pick one to edit its override.
                </div>
              )}
              </>)}
            </>
          );
        })()}

        <hr style={{ borderColor: '#333', margin: '12px 0' }} />
        <p style={{ color: '#666', fontSize: 11, lineHeight: 1.5 }}>
          Middle-click + drag: pan · Wheel: zoom · Click/drag minimap to jump.
          Click portal rect / diamond to drag it; use the size inputs to resize.
        </p>
      </aside>

      <div
        ref={viewportDivRef}
        style={{ flex: 1, overflow: 'hidden', background: '#000', position: 'relative' }}
      >
        <canvas
          ref={canvasRef}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => setHoverTile(null)}
          onWheel={onWheel}
          onContextMenu={(e) => e.preventDefault()}
          onAuxClick={(e) => e.preventDefault()}
          style={{
            display: 'block', imageRendering: 'pixelated', touchAction: 'none',
            cursor: interaction?.kind === 'pan' ? 'grabbing'
              : interaction?.kind === 'move' ? 'grabbing'
              : interaction?.kind === 'box' ? 'crosshair'
              : 'default',
            outline: 'none',
          }}
        />

        <div
          style={{
            position: 'absolute', top: 12, right: 12,
            background: '#000', border: '1px solid #444', padding: 4,
          }}
        >
          <canvas
            ref={minimapRef}
            onPointerDown={onMinimapDown}
            onPointerMove={onMinimapMove}
            onPointerUp={onMinimapUp}
            onPointerCancel={onMinimapUp}
            onContextMenu={(e) => e.preventDefault()}
            style={{ display: 'block', imageRendering: 'pixelated', touchAction: 'none', cursor: 'crosshair' }}
          />
        </div>
      </div>

      {/* Custom in-app dialog modal — replaces native prompt/confirm/alert
          which Cursor's embedded browser suppresses. Backdrop click
          cancels (matches native prompt behaviour). Enter on prompt
          submits, Esc cancels. */}
      {dialog && (
        <div
          onClick={() => closeDialog(dialog.kind === 'confirm' ? false : null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#1c1c24', border: '1px solid #555', borderRadius: 8,
              padding: 18, minWidth: 320, maxWidth: 'min(90vw, 480px)',
              boxShadow: '0 6px 30px rgba(0,0,0,0.6)',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            <div style={{ color: '#eee', fontSize: 14, whiteSpace: 'pre-wrap', marginBottom: 14 }}>
              {dialog.title}
            </div>
            {dialog.kind === 'prompt' && (
              <input
                autoFocus
                value={dialogInput}
                onChange={(e) => setDialogInput(e.target.value)}
                placeholder={dialog.placeholder}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') closeDialog(dialogInput);
                  else if (e.key === 'Escape') closeDialog(null);
                }}
                style={{
                  width: '100%', padding: '8px 10px', marginBottom: 14,
                  background: '#0d0d12', border: '1px solid #555', color: '#eee',
                  borderRadius: 4, fontSize: 13, fontFamily: 'monospace',
                  boxSizing: 'border-box',
                }}
              />
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {dialog.kind !== 'alert' && (
                <button
                  onClick={() => closeDialog(dialog.kind === 'confirm' ? false : null)}
                  style={{
                    padding: '6px 14px', background: '#2a2a32', color: '#ccc',
                    border: '1px solid #555', borderRadius: 4, cursor: 'pointer', fontSize: 13,
                  }}
                >
                  Cancel
                </button>
              )}
              <button
                autoFocus={dialog.kind !== 'prompt'}
                onClick={() =>
                  closeDialog(
                    dialog.kind === 'prompt' ? dialogInput :
                    dialog.kind === 'confirm' ? true :
                    null,
                  )
                }
                style={{
                  padding: '6px 14px', background: '#3a6ed0', color: '#fff',
                  border: '1px solid #4a7ee0', borderRadius: 4, cursor: 'pointer', fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {dialog.kind === 'confirm' ? 'OK' : dialog.kind === 'alert' ? 'OK' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
