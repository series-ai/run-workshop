// World signs — interactable signposts the player walks up to and presses
// A to read. Each sign is anchored to a (mapId, tileX, tileY); the anchor
// tile (plus any extra tiles for wide variants) is treated as a blocker so
// the player can't walk through it. Pressing A while adjacent and facing
// the sign fires `onSignOpened(id)` upstream — the WorldTab dispatches per
// `kind` to whichever modal/UI is appropriate.
//
// Why not an NPC? Tried that first (kind="dojo-poster" routed through
// dialogue). The wooden-sign aesthetic reads better than a character
// sprite, so signs got their own data + render path while reusing the
// existing adjacency / interaction plumbing.
//
// Data source: src/world/data/worldSigns.json is the source of truth — the
// editor writes back to it via /api/editor/save-signs. This module just
// loads, types, and exposes lookup helpers.

import rawSigns from './worldSigns.json';

/** What pops up when the player reads the sign.
 *  - 'image-popup'   — fullscreen modal showing a single image (e.g. a
 *                      poster). Image is loaded from CDN by `imagePath`.
 *  - 'text-dialogue' — bottom-docked dialogue frame (uses
 *                      dialog-simple.png) showing `text` pages, no NPC
 *                      speaker. Tap to advance pages, last tap closes.
 *  - 'mirror'        — opens a character-sprite picker (grid of every
 *                      character's Faceset.png). Selecting one swaps
 *                      the player's overworld sprite to that character.
 *                      No per-sign content fields — the picker is the
 *                      same for every mirror.
 *  - 'dojo-poster'   — legacy alias for image-popup with the hardcoded
 *                      'store/dojo-challenge-poster.png' image. Kept so
 *                      the original DOJO flier sign keeps working
 *                      without editing the JSON.
 */
export type WorldSignKind = 'image-popup' | 'text-dialogue' | 'mirror' | 'dojo-poster';

/** Editor dropdown order — newest/cleanest kinds first, legacy at the end. */
export const WORLD_SIGN_KINDS: ReadonlyArray<WorldSignKind> = [
  'text-dialogue',
  'image-popup',
  'mirror',
  'dojo-poster',
];

/** CDN path the legacy 'dojo-poster' kind always loads. New signs should
 *  use 'image-popup' + a custom imagePath instead. */
export const DOJO_POSTER_CDN_PATH = 'store/dojo-challenge-poster.png';

export type WorldSignSprite =
  | 'sign_1'
  | 'sign_2'
  | 'sign_3'
  | 'sign_4'
  | 'sign_5'
  | 'sign_6'
  | 'sign_7'
  | 'sign_wide2'
  | 'sign_wide3'
  /** Invisible sign — no PNG, no collision contribution. Use it to layer
   *  an interaction trigger on top of an existing blocker (door, statue,
   *  fence, etc.) so the player can read it like any other sign. */
  | 'no_sprite';

export interface WorldSignDef {
  id: string;
  mapId: string;
  /** Anchor tile (leftmost cell for wide signs). */
  tileX: number;
  tileY: number;
  /** Which PNG variant under public/world/tilesets/signs/<sprite>.png. */
  sprite: WorldSignSprite;
  /** Action triggered when the player presses A while facing the sign. */
  kind: WorldSignKind;
  /** Optional accessibility/tooltip text; not rendered on the sign face. */
  label?: string;
  /** For kind='image-popup': CDN path of the poster image (e.g.
   *  'store/dojo-challenge-poster.png'). Loaded via
   *  RundotGameAPI.cdn.fetchAsset with /cdn-assets/ URL fallbacks. */
  imagePath?: string;
  /** For kind='text-dialogue': one or more pages of dialogue text. Each
   *  entry becomes a tap-to-advance page in the same UI as NPC
   *  dialogue but without a name tab or faceset. */
  text?: string[];
}

/** All known sprite variants — useful for the editor sprite picker.
 *  Includes 'no_sprite' which has no PNG and no collision contribution. */
export const SIGN_SPRITES: ReadonlyArray<WorldSignSprite> = [
  'sign_1',
  'sign_2',
  'sign_3',
  'sign_4',
  'sign_5',
  'sign_6',
  'sign_7',
  'sign_wide2',
  'sign_wide3',
  'no_sprite',
];

/** Sprite variants that actually have a PNG on disk. The preloader and the
 *  in-game renderer iterate this list; 'no_sprite' is intentionally
 *  excluded because it's a marker, not a graphic. */
export const RENDERABLE_SIGN_SPRITES: ReadonlyArray<WorldSignSprite> =
  SIGN_SPRITES.filter((sp) => sp !== 'no_sprite');

/** True when this sprite variant should draw a PNG on the world canvas
 *  and contribute its footprint to player/NPC collision. */
export function isRenderableSign(sprite: WorldSignSprite): boolean {
  return sprite !== 'no_sprite';
}

/** Tile-width of a sign sprite. Wide variants occupy 2 or 3 contiguous
 *  cells starting from the anchor tile (extending to the right).
 *  no_sprite is always 1 tile (it's an invisible interaction marker). */
export function getSignWidth(sprite: WorldSignSprite): number {
  if (sprite === 'sign_wide2') return 2;
  if (sprite === 'sign_wide3') return 3;
  return 1;
}

/** Public path to the sign PNG (loaded by URL — these aren't bundled). */
export function getSignSpritePath(sprite: WorldSignSprite): string {
  return `world/tilesets/signs/${sprite}.png`;
}

/** All registered signs across every map. The editor mutates this via the
 *  save endpoint; in-memory readers re-import on module reload. */
export const WORLD_SIGNS: WorldSignDef[] = (rawSigns as { signs: WorldSignDef[] }).signs;

export function getWorldSignsForMap(mapId: string): WorldSignDef[] {
  return WORLD_SIGNS.filter((s) => s.mapId === mapId);
}

export function getWorldSign(id: string): WorldSignDef | undefined {
  return WORLD_SIGNS.find((s) => s.id === id);
}
