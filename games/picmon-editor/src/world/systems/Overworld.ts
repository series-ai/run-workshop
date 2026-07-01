import { TILE_SIZE, type Direction, type Rect, type NpcDef, type AnimalDef } from '../engine/types';
import { input } from '../engine/Input';
import { rectsOverlap, overlapArea } from '../engine/collision';
import { getImage, PLAYER_SPRITE_JSON, PLAYER_SPRITE_PNG, DEFAULT_PLAYER_CHARACTER, playerSpritePathsFor, loadImage, getCdnImage, loadCdnImage, mapJsonPath, mapTilesheetPath } from '../engine/assets';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { drawSpriteFlipped, getAnimalDirections, getSpritesheet, loadSpritesheet, resolveAnimalFrame, resolveFrame } from '../engine/Spritesheet';
import { PLAYER_START, getPortals, NPC_CATALOG, MAP_CATALOG, buildAnimalsForMap, buildNpcsForMap, buildObjectBlockerRectsForMap, buildObjectsForMap, getSpawn, objectDrawRect, type ObjectRuntimeDef, type Portal, type PortalGate, type PortalHalf } from '../data/maps';
import { isAdminCached } from '../../utils/adminAccess';
// 2026-05-13 — Pharaoh's Awakening event gate. Resolves the portal
// gate's `eventId` field against the global event-window flag.
import { isEventActive as isDesertEventActive } from '../../data/desertEvent';
import { drawParticles, spawnGrassParticle, updateParticles, type Particle } from './particles';
import { RESTORABLES, type RestorableDef } from '../data/restorables';
import { WORLD_SIGNS, getWorldSignsForMap, getSignWidth, getSignSpritePath, isRenderableSign, type WorldSignDef } from '../data/worldSigns';
import { getGrassPatches } from './grassPatches';
// 2026-06-01 (v1.670) — Removed `getFtueSync` import + drawFtueGrassPointer.
// The FTUE grass pointer overlay was deleted per Mike's request
// ("remove the grass distance modal that you built"). No other code
// in this file consumes the FTUE step, so the import is gone too.
import { findPath, nearestWalkable, isWalkable } from './pathfinding';
import { type PickupDef, getResolvedPickups } from '../data/pickups';
import { loadAtlas, getAtlasImage, getAtlasFrame } from '../../components/Icon';
import type { VillageProgress } from '../../utils/villageStorage';
import {
  circleCollidesBlockers,
  getMap,
  isTallGrassAt,
  loadSpriteFusionMap,
  rectCollidesBlockers,
  rectOverlapsTallGrass,
  tallGrassTileIdAt,
  tileSrcXY,
  type SFLayer,
  type SFMap,
} from '../data/spriteFusionMap';

// Pixels per RAF tick. At 8 px/frame & 60fps the player crosses one
// Pixels per 60fps-equivalent frame. Actual per-tick movement is
// `MOVE_SPEED * frameMul` where frameMul is computed in GameCanvas
// from the real delta time. This keeps walk speed identical at 30
// fps (mobile), 60 fps, and 120 fps (modern phones / Pro displays).
// History: was 5, bumped to 8 in v1.150 to compensate for slow-fps
// mobile, then v1.171 made movement frame-rate-independent which
// made 8 the *universal* speed and felt "crazy fast" on PC. v1.174
// drops it back to 5 since dt-scaling already solves the slow-mobile
// problem without needing a base bump.
// 2026-05-10 — Player feedback: "moves a hair too fast — slow down".
// Drop the base speed by ~20% so movement reads as a deliberate walk
// rather than a trot. dt-scaling still keeps frame-rate parity.
const MOVE_SPEED = 4;
/**
 * 2026-05-18 (v1.409) — Threshold for the auto-unstuck rescue (see
 * OverworldState.stuckFrames + the `wantsToMove && !moved` block at
 * the bottom of updateOverworld). Originally 60 frames (~1 sec at
 * 60fps), but playtest feedback (2026-05-23, Mike's friend) showed
 * that 1 sec is way too aggressive: rubbing against a tree for a
 * moment teleported the player back to the village. Bumped to 180
 * frames (~3 sec) so a casual collision bump no longer trips it,
 * while a genuinely jammed player still gets rescued well before
 * they'd give up and close the game. Counter resets the instant the
 * player either moves successfully OR stops holding input.
 */
const STUCK_AUTO_RESCUE_FRAMES = 180;
// Per-60fps-frame chance of triggering a wild encounter while
// standing in tall grass. Scaled by frameMul at the call site so
// encounters-per-second stays constant regardless of device fps.
// v1.250 — Dropped 0.018 → 0.010 so a tile crossing is roughly a
// 5% encounter chance instead of ~9%. Players were reporting
// "3 battles in 3 steps" stretches because of how high-variance the
// roll is; combined with the new POST_BATTLE_ENCOUNTER_COOLDOWN
// below (which silences encounters for ~2s after returning from a
// fight) the worst-case streak is now bounded at ~10 tiles between
// battles instead of "every step in a row."
// v1.219 — Cooldown bumped 120 → 180 (3s) AND a NEW tile-gated guard
// added (`postBattleSafeTile`). The time-only cooldown wasn't enough:
// Barker reported a player wedged against an NPC in tall grass who
// slip-shuffled on the SAME grass tile until the 2s cooldown expired,
// then immediately re-rolled into another encounter — looped forever.
// The tile-gate suppresses encounters as long as the player remains
// on the tile they fought on, regardless of how long they've been
// there, so they always get at least one full step out of the fight
// tile before the next roll fires.
const ENCOUNTER_RATE = 0.010;
/** Frames (at 60fps) of suppressed encounters after returning from a
 *  battle. Lets the player step off the tile they fought on without
 *  being yanked back into a fight on the very next frame.
 *  v1.219 — bumped 120 → 180 (~3s) as a backstop after the tile-gate
 *  fix. Players wedged against an NPC could outlast the 2s window in
 *  ~2 frames of slip-shuffle and slam straight back into a fight. */
export const POST_BATTLE_ENCOUNTER_COOLDOWN = 180;

// Portal gates are data-driven via the `gate` field on each portal in
// src/world/data/portals.json (see PortalGate in world/data/maps.ts).
// Active gates physically block the door rect via playerCollidesActiveGate;
// the inflated proximity rect fires the "sealed" toast on rising-edge
// approach. Add a new gate by editing portals.json — no code changes.
// Character render height in world pixels. Equal to TILE_SIZE so a 16×16
// source sprite draws at an exact 3× integer upscale (matches the map tile
// upscale) — no subpixel sampling, no frame bleed.
const CHAR_SCREEN_H = TILE_SIZE;
const PLAYER_HITBOX = 38;
const PLAYER_HITBOX_OFFSET = (TILE_SIZE - PLAYER_HITBOX) / 2;
// When a move is blocked, how many pixels we're willing to automatically
// slide perpendicular to slip past small protrusions (3px building dips,
// doorframe edges, etc.). Larger = more forgiving / slippery-feeling.
const AUTO_SLIP_MAX = 6;
// Non-collider layers whose individual tiles should participate in the
// Y-sort pass rather than being flat-drawn under characters. Bushes and
// flowers are NOT in this set — they're handled by a pixel-level overlay
// pass (`drawBushOpacityOverlay`) that only occludes the character when
// their foot actually stands on opaque bush/flower pixels. That replaces
// a cruder footY-vs-tile-bottom comparison that flipped the character
// behind the bush the moment they crossed the tile boundary.
const Y_SORTED_LAYERS = new Set<string>();

// Cached resolved object lists per map id. buildObjectsForMap() walks the
// map JSON and resolves every optional default; doing that on every frame
// would allocate and discard hundreds of objects for nothing. The cache
// keys an identity check against `MAP_CATALOG[mapId].objects` — the editor
// save flow replaces that array reference whenever the user saves, so a
// fresh cache (and matching collision rebuild) lands on the next frame
// after a save with no extra plumbing.
const objectRuntimeCache = new Map<string, { ref: unknown; resolved: ObjectRuntimeDef[] }>();
function objectsForMap(mapId: string): ObjectRuntimeDef[] {
  const ref = MAP_CATALOG[mapId]?.objects;
  const entry = objectRuntimeCache.get(mapId);
  if (entry && entry.ref === ref) return entry.resolved;
  const resolved = buildObjectsForMap(mapId);
  objectRuntimeCache.set(mapId, { ref, resolved });
  // Tie collision rebuild to the same identity check so a save in the
  // editor doesn't leave the game with stale blocker AABBs.
  const sfmap = getMap(mapJsonPath(mapId));
  if (sfmap) sfmap.objectBlockerRects = buildObjectBlockerRectsForMap(mapId, getImage);
  return resolved;
}
/** Frame tempo for animated objects. 6 FPS matches the editor preview and
 *  reads as a comfortable flag wave / flower sway. */
const OBJECT_ANIM_FPS = 6;
// Side length (in tiles) of the square each NPC is fenced to around their
// spawn. Their anchor may move up to NPC_WANDER_BOX_TILES/2 tiles from
// spawn in any direction. Shrink this if NPCs drift too far.
const NPC_WANDER_BOX_TILES = 7;

export interface AnimalRuntime {
  /** Index in state.animalStates — used as the selection key in the editor. */
  index: number;
  def: AnimalDef;
  x: number;
  y: number;
  spawnX: number;
  spawnY: number;
  direction: Direction;
  isMoving: boolean;
  walkFrame: number;
  walkTimer: number;
  wanderCooldown: number;
  wanderSteps: number;
}

export interface NpcRuntime {
  id: string;
  x: number;
  y: number;
  spawnX: number;
  spawnY: number;
  direction: Direction;
  isMoving: boolean;
  walkFrame: number;
  walkTimer: number;
  wanderCooldown: number;
  wanderSteps: number;
  /** Emote currently floating above this NPC's head, or null. */
  activeEmoteSrc: string | null;
  /** Frames left until the active emote disappears. */
  emoteFramesLeft: number;
  /** Frames until the NEXT mood emote pop-up fires. */
  nextEmoteIn: number;
}

export interface OverworldState {
  currentMapId: string;
  playerX: number;
  playerY: number;
  /** Persisted camera top-left in world px. Drives the dead-zone follow:
   *  the player can roam a centered rectangle without the camera moving;
   *  the camera only scrolls once they push past its edge. `undefined`
   *  means "snap to center the player next frame" (set after teleport /
   *  map load so the new map doesn't slide into view). See resolveCamera. */
  cameraX?: number;
  cameraY?: number;
  direction: Direction;
  isMoving: boolean;
  walkFrame: number;
  walkTimer: number;
  interactingNpc: string | null;
  dialogueIndex: number;
  /** World sign currently being read (kind drives the modal/dock in React).
   *  Persists across frames so the engine can detect walk-away and clear
   *  it, mirroring `interactingNpc`'s lifecycle. */
  readingSign: string | null;
  /** Current page index for the open text-dialogue sign. Advanced by A
   *  press, reset to 0 on every fresh open. Ignored when readingSign is
   *  null or the sign is not a text-dialogue. */
  signPageIdx: number;
  npcStates: NpcRuntime[];
  animalStates: AnimalRuntime[];
  /** Transient FX particles (grass tufts, etc.). Purged as they expire. */
  particles: Particle[];
  /** Frames since the last grass-tuft particle was spawned. Used to pace
   *  the emitter so footsteps in tall grass read as a steady fountain. */
  grassParticleCooldown: number;
  /** v1.250 — Frames remaining where wild-encounter rolls are suppressed
   *  even on tall grass. Set to POST_BATTLE_ENCOUNTER_COOLDOWN after
   *  every battle exit so the player can move off the fight tile
   *  without being immediately re-pulled into another fight. */
  postBattleEncounterCooldown: number;
  /** v1.219 — Tile the player was standing on when their last battle
   *  ended. Wild-encounter rolls are suppressed entirely while the
   *  player remains on this tile, regardless of `postBattleEncounterCooldown`.
   *  Cleared the first frame the player's center is on a different tile.
   *  Fixes the "stuck against NPC in tall grass → infinite battle loop"
   *  bug: the time-based cooldown alone could expire while a wedged
   *  player was still slip-shuffling on the same fight tile, allowing
   *  the next per-frame ~1% encounter roll to immediately re-trigger. */
  postBattleSafeTile: { col: number; row: number } | null;
  /** Portals whose rect the player is STILL standing on after a teleport — suppressed until they walk off. */
  blockedPortalIds: Set<string>;
  /** Quest-gated portal whose door the player bumped against this frame.
   *  Compared against the previous frame to fire the "sealed" toast on
   *  the rising edge only (so holding into the door doesn't spam the
   *  banner every frame). */
  bumpedGateId: string | null;
  /** Frames remaining where ALL portals are suppressed regardless of
   *  overlap. Set after every teleport so a player holding the same
   *  input can't ping-pong between two adjacent portal endpoints
   *  (notably intra-map portals like portal-7's boat ↔ ruins ferry
   *  where the spawn lands close to the destination rect). Combined
   *  with `lastTeleportPos` for a "must move at least 1 tile from
   *  spawn before any portal can trigger" guarantee. */
  postTeleportCooldown: number;
  /** World-pixel position the player spawned at after the most recent
   *  teleport. Used by the portal-trigger loop to require the player
   *  has moved at least 1 tile (TILE_SIZE) away before any portal can
   *  fire. Kills the spin-on-portal bug for ALL portals, since it's
   *  input-direction-agnostic. */
  lastTeleportPos: { x: number; y: number } | null;
  /** Player is standing next to a restorable building and can press A to open the restoration UI. */
  facingRestorable: string | null;
  /** Player is standing next to a world sign and can press A to read it.
   *  Used by drawTalkIndicators to draw the "!" prompt above the sign. */
  facingSign: string | null;
  /** Injected from WorldTab so the renderer knows what art to overlay. */
  villageProgress: VillageProgress;
  /** NPC ids of trainers the player has already beaten. Drives the talk
   *  indicator emote (red ! → grey ...) after a win. */
  trainerDefeats: Set<string>;
  /**
   * 2026-06-04 (v1.700) — Mike: "you shouldn't be able to leave a
   * floor if you haven't beaten the trainer on the floor." When set
   * to true AND the player is on a tower-arena map, every portal
   * trigger on that map is suppressed — the only exits are winning
   * the tower-challenger battle (handleTowerBattleEnd programmatic
   * teleport to the next arena) or wiping (programmatic teleport
   * back to the lobby). Walking onto inter-arena portals is a no-op.
   * WorldTab syncs this from `currentTowerRun` state; cleared the
   * moment the run ends (wipe / voluntary end / completion).
   */
  towerRunActive: boolean;
  /** Rising-edge tracker for the tower-lock hint toast — the portal id
   *  the player most recently bumped into while a tower run was active.
   *  Compared frame-over-frame so the "Defeat the challenger to advance"
   *  toast fires once per portal-walk-on, not every frame. */
  bumpedTowerLockedPortalId: string | null;
  /** Player's chosen overworld character name (folder under
   *  /public/world/npcs/Character/<name>/). Defaults to the value of
   *  DEFAULT_PLAYER_CHARACTER; mirror signs swap it at runtime. */
  playerCharacter: string;
  /** Active tap-to-navigate target, if any. Cleared on arrival/cancel. */
  pathTarget: PathTarget | null;
  /** How many consecutive frames the path follower failed to advance. */
  pathStuckFrames: number;
  /**
   * 2026-05-18 (v1.409) — How many consecutive frames the player has
   * been TRYING to move (held a direction key, used the virtual joystick,
   * or is following a tap-path) but their position hasn't changed.
   * Drives the auto-unstuck rescue: when this exceeds STUCK_AUTO_RESCUE_FRAMES
   * we run `findLoginSafePosition` and snap the player to a safe spot
   * without requiring them to dig through the More menu for the
   * Unstuck button. Reported by PsycoKai on Discord ("character gets
   * stuck, have to exit the game"); plec acknowledged "this is a bug
   * that keeps re-appearing."
   *
   * Resets to 0 the moment the player actually moves, opens a modal /
   * dialogue / battle (those legitimately freeze movement), or after
   * a rescue fires.
   */
  stuckFrames: number;
  /** Set of pickup ids the player has already collected on this world map. */
  collectedPickups: Set<string>;
}

/**
 * Pending tap-to-navigate target. Actions:
 *   - 'move': stop at the target
 *   - 'talk': open dialogue with npcId (walks adjacent first)
 *   - 'restorable': open the restoration modal for buildingId
 *   - 'sign': open the world sign signId (walks adjacent first). Mirrors
 *             'talk' so click-to-move on a sign acts just like click-to-
 *             move on an NPC — essential for mobile play.
 */
export interface PathTarget {
  x: number;
  y: number;
  action: 'move' | 'talk' | 'restorable' | 'sign';
  npcId?: string;
  buildingId?: string;
  signId?: string;
  /**
   * Tile-grid waypoints (world-pixel tile centers) the player must walk
   * through, in order, to reach the goal without crossing blocker tiles.
   * The mover follows waypoints[0], shifting it off when reached, then
   * walks to the next. After all waypoints are consumed the mover heads
   * directly to (x, y) for the final approach (sub-tile precision).
   * Empty array = walk straight to (x, y).
   */
  waypoints: Array<{ x: number; y: number }>;
}

/**
 * Fetch an NpcDef by id using the catalog (map-agnostic identity) plus the
 * current runtime tile position for the few consumers that expect tileX/Y.
 */
/**
 * Build a PathTarget from a world-space click. Picks the most specific
 * action available: NPC > restorable > bare move. For NPCs we snap to the
 * adjacent tile closest to the player so arrival faces the NPC naturally.
 */
export function buildPathTargetFromWorldClick(
  state: OverworldState,
  worldX: number,
  worldY: number,
): PathTarget {
  // Resolve the goal point + action.
  let goalX = worldX;
  let goalY = worldY;
  let action: PathTarget['action'] = 'move';
  let npcId: string | undefined;
  let buildingId: string | undefined;
  let signId: string | undefined;

  for (const nrt of state.npcStates) {
    const nx = nrt.x + TILE_SIZE / 2;
    const ny = nrt.y + TILE_SIZE / 2;
    if (Math.abs(worldX - nx) <= TILE_SIZE * 0.7 && Math.abs(worldY - ny) <= TILE_SIZE * 0.7) {
      const dx = state.playerX + TILE_SIZE / 2 - nx;
      const dy = state.playerY + TILE_SIZE / 2 - ny;
      let tx = nx; let ty = ny;
      if (Math.abs(dx) >= Math.abs(dy)) tx += (dx >= 0 ? TILE_SIZE : -TILE_SIZE);
      else ty += (dy >= 0 ? TILE_SIZE : -TILE_SIZE);
      goalX = tx; goalY = ty; action = 'talk'; npcId = nrt.id;
      break;
    }
  }
  if (action === 'move') {
    // Signs are higher priority than restorables because a sign is an
    // explicit interaction point — restorables are the underlying art.
    // Wide signs check every cell in the footprint; the player approaches
    // from the cell closest to the click.
    for (const sign of getWorldSignsForMap(state.currentMapId)) {
      const w = getSignWidth(sign.sprite);
      let bestCellTx = sign.tileX;
      let bestCellTy = sign.tileY;
      let bestDist = Infinity;
      for (let i = 0; i < w; i++) {
        const cx = (sign.tileX + i) * TILE_SIZE + TILE_SIZE / 2;
        const cy = sign.tileY * TILE_SIZE + TILE_SIZE / 2;
        const d = Math.hypot(worldX - cx, worldY - cy);
        if (d < bestDist) {
          bestDist = d;
          bestCellTx = sign.tileX + i;
          bestCellTy = sign.tileY;
        }
      }
      // Hit radius matches the NPC test (~0.7 tile of forgiveness) so a
      // mobile tap doesn't have to land perfectly on the sign sprite.
      if (bestDist <= TILE_SIZE * 0.85) {
        const cx = bestCellTx * TILE_SIZE + TILE_SIZE / 2;
        const cy = bestCellTy * TILE_SIZE + TILE_SIZE / 2;
        const dx = state.playerX + TILE_SIZE / 2 - cx;
        const dy = state.playerY + TILE_SIZE / 2 - cy;
        let tx = cx; let ty = cy;
        if (Math.abs(dx) >= Math.abs(dy)) tx += (dx >= 0 ? TILE_SIZE : -TILE_SIZE);
        else ty += (dy >= 0 ? TILE_SIZE : -TILE_SIZE);
        goalX = tx; goalY = ty; action = 'sign'; signId = sign.id;
        break;
      }
    }
  }
  if (action === 'move') {
    for (const b of RESTORABLES) {
      const left = b.tileX * TILE_SIZE;
      const top = b.tileY * TILE_SIZE;
      const right = left + b.widthTiles * TILE_SIZE;
      const bottom = top + b.heightTiles * TILE_SIZE;
      if (worldX >= left && worldX <= right && worldY >= top && worldY <= bottom) {
        goalX = left + (b.widthTiles * TILE_SIZE) / 2;
        goalY = bottom + TILE_SIZE / 2;
        action = 'restorable'; buildingId = b.id;
        break;
      }
    }
  }

  // Compute tile-grid waypoints around blockers via A*. Click on a blocker
  // (e.g. a tree) snaps to the nearest walkable tile so we can still walk
  // there. If no path is found, return an empty waypoint list and let the
  // mover do its old straight-line attempt — better than no-op.
  const waypoints: Array<{ x: number; y: number }> = [];
  const map = getMap(mapJsonPath(state.currentMapId));
  if (map) {
    // Treat NPCs as solid for pathing — they collide with the player at
    // movement time anyway (see playerCollidesAnyNpc), so paths that try to
    // cross their tile would just stall against them. EXCEPT the NPC we're
    // walking to talk to — its tile is fine because the goal is the
    // adjacent tile, but the NPC tile shouldn't block routing through the
    // tile we're targeting if the NPC happens to overlap.
    const npcBlockers = new Set<string>();
    for (const nrt of state.npcStates) {
      if (npcId && nrt.id === npcId) continue;
      // Defeated bridge guards are walk-through — don't block A*.
      if (isDefeatedBridgeGuard(nrt, state)) continue;
      const ntx = Math.floor((nrt.x + TILE_SIZE / 2) / TILE_SIZE);
      const nty = Math.floor((nrt.y + TILE_SIZE / 2) / TILE_SIZE);
      npcBlockers.add(`${ntx},${nty}`);
    }
    const sx = Math.floor((state.playerX + TILE_SIZE / 2) / TILE_SIZE);
    const sy = Math.floor((state.playerY + TILE_SIZE / 2) / TILE_SIZE);
    let gx = Math.floor(goalX / TILE_SIZE);
    let gy = Math.floor(goalY / TILE_SIZE);
    const snapped = nearestWalkable(map, gx, gy, 6, npcBlockers);
    if (snapped) {
      gx = snapped.tx; gy = snapped.ty;
      const path = findPath(map, sx, sy, gx, gy, 4000, npcBlockers);
      if (path && path.length > 1) {
        // Skip the start tile (player's already there). The remaining tiles
        // become waypoints in world-pixel tile-center coords. Replace the
        // last waypoint with the precise goal so NPC/restorable arrival
        // points still snap to the adjacent tile center we resolved above.
        for (let i = 1; i < path.length - 1; i++) {
          const t = path[i]!;
          waypoints.push({
            x: t.tx * TILE_SIZE + TILE_SIZE / 2,
            y: t.ty * TILE_SIZE + TILE_SIZE / 2,
          });
        }
        waypoints.push({ x: goalX, y: goalY });
      }
    }
  }

  return { x: goalX, y: goalY, action, npcId, buildingId, signId, waypoints };
}

function npcDefForRuntime(npcId: string, state: OverworldState): NpcDef | null {
  const base = NPC_CATALOG[npcId];
  if (!base) return null;
  const rt = state.npcStates.find((r) => r.id === npcId);
  return {
    ...base,
    tileX: rt ? Math.round(rt.x / TILE_SIZE) : 0,
    tileY: rt ? Math.round(rt.y / TILE_SIZE) : 0,
  };
}

/** How often (in ticks) an animal alternates between stand & jump frames
 *  while moving. Lower than NPCs so the 2-frame run reads as a derpy sprint. */
const ANIMAL_FRAME_PERIOD = 10;
/** Wander pixel speed for animals. Matches NPC speed; could be per-type later. */
const ANIMAL_WANDER_SPEED = 1;

/**
 * 2026-05-12 — Snap an entity's spawn tile outward to the nearest
 * non-blocker tile. Map JSON `placements` are author-supplied integers
 * and occasionally land inside a building footprint, on a roof tile,
 * or in an off-navmesh pocket the player can't reach. Stationary NPCs
 * stranded there can't recover (they never move); wandering NPCs
 * jitter at the wall. Both read as "glitched" to the player.
 *
 * This snaps each entity to the nearest walkable tile at runtime so
 * JSON typos self-heal in-game; the `console.warn` in DEV builds
 * gives the team a hit-list of placements to permanently fix in
 * source. The walk is concentric Manhattan rings (closest tile wins)
 * up to `radius` away. Returns the original tile when nothing's in
 * the way, so this is a near-zero-cost no-op for clean maps.
 */
function findEntitySafeSpawn(
  map: SFMap,
  startTileX: number,
  startTileY: number,
  hitbox: number,
  hitboxOffset: number,
  radius: number = 6,
): { tileX: number; tileY: number } {
  const isBlocked = (tx: number, ty: number): boolean =>
    rectCollidesBlockers(
      map,
      TILE_SIZE,
      tx * TILE_SIZE + hitboxOffset,
      ty * TILE_SIZE + hitboxOffset,
      hitbox,
      hitbox,
    );
  if (!isBlocked(startTileX, startTileY)) {
    return { tileX: startTileX, tileY: startTileY };
  }
  for (let r = 1; r <= radius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) + Math.abs(dy) !== r) continue;
        const tx = startTileX + dx;
        const ty = startTileY + dy;
        if (!isBlocked(tx, ty)) return { tileX: tx, tileY: ty };
      }
    }
  }
  return { tileX: startTileX, tileY: startTileY };
}

/** Build runtime state for every animal placement on a map. */
function buildAnimalStatesForMap(mapId: string): AnimalRuntime[] {
  const map = getMap(mapJsonPath(mapId));
  return buildAnimalsForMap(mapId).map((def, index) => {
    const safe = map
      ? findEntitySafeSpawn(map, def.tileX, def.tileY, ANIMAL_HITBOX, ANIMAL_HITBOX_OFFSET)
      : { tileX: def.tileX, tileY: def.tileY };
    if (import.meta.env.DEV && (safe.tileX !== def.tileX || safe.tileY !== def.tileY)) {
      console.warn(
        `[Animal spawn] "${def.type}" on map "${mapId}" was blocked at ` +
        `(${def.tileX},${def.tileY}); snapped to (${safe.tileX},${safe.tileY}). ` +
        `Fix the placement in src/world/data/maps/${mapId}.json.`,
      );
    }
    return {
      index,
      def,
      x: safe.tileX * TILE_SIZE,
      y: safe.tileY * TILE_SIZE,
      spawnX: safe.tileX * TILE_SIZE,
      spawnY: safe.tileY * TILE_SIZE,
      // Start facing right since every sheet has right_stand — avoids an
      // initial "no frame for this direction" flash.
      direction: 'right' as Direction,
      isMoving: false,
      walkFrame: 0,
      walkTimer: 0,
      wanderCooldown: 60 + Math.floor(Math.random() * 180),
      wanderSteps: 0,
    };
  });
}

/** Build the runtime NPC list for a given map (fresh wander state for each). */
function buildNpcStatesForMap(mapId: string): NpcRuntime[] {
  const map = getMap(mapJsonPath(mapId));
  return buildNpcsForMap(mapId).map((npc) => {
    const safe = map
      ? findEntitySafeSpawn(map, npc.tileX, npc.tileY, NPC_HITBOX, NPC_HITBOX_OFFSET)
      : { tileX: npc.tileX, tileY: npc.tileY };
    if (import.meta.env.DEV && (safe.tileX !== npc.tileX || safe.tileY !== npc.tileY)) {
      console.warn(
        `[NPC spawn] "${npc.id}" on map "${mapId}" was blocked at ` +
        `(${npc.tileX},${npc.tileY}); snapped to (${safe.tileX},${safe.tileY}). ` +
        `Fix the placement in src/world/data/maps/${mapId}.json.`,
      );
    }
    return {
      id: npc.id,
      x: safe.tileX * TILE_SIZE,
      y: safe.tileY * TILE_SIZE,
      spawnX: safe.tileX * TILE_SIZE,
      spawnY: safe.tileY * TILE_SIZE,
      direction: 'down' as Direction,
      isMoving: false,
      walkFrame: 0,
      walkTimer: 0,
      wanderCooldown: 60 + Math.floor(Math.random() * 180),
      wanderSteps: 0,
      activeEmoteSrc: null,
      emoteFramesLeft: 0,
      // Stagger the first mood pop so a crowd doesn't all emote at once.
      nextEmoteIn: 180 + Math.floor(Math.random() * 600),
    };
  });
}

/**
 * v1.253 — Bump the spawn tile to the nearest free tile if any NPC's hitbox
 * overlaps it. Walks outward in concentric rings (Manhattan distance) up to
 * `radius` tiles. Returns the original tile when nothing's in the way (the
 * common case) so the function is a no-op when a map is well-laid-out.
 *
 * Exported so callers that move the player after construction (FTUE
 * teleports, post-portal arrival) can apply the same safety.
 */
export function findUnblockedSpawnTile(
  spawn: { tileX: number; tileY: number },
  npcStates: NpcRuntime[],
  radius: number = 5,
): { tileX: number; tileY: number } {
  const playerRectAt = (tx: number, ty: number): Rect => ({
    x: tx * TILE_SIZE + PLAYER_HITBOX_OFFSET,
    y: ty * TILE_SIZE + PLAYER_HITBOX_OFFSET,
    width: PLAYER_HITBOX,
    height: PLAYER_HITBOX,
  });
  const overlapsAnyNpc = (tx: number, ty: number): boolean => {
    const pr = playerRectAt(tx, ty);
    for (const nrt of npcStates) {
      const nr: Rect = {
        x: nrt.x + NPC_HITBOX_OFFSET,
        y: nrt.y + NPC_HITBOX_OFFSET,
        width: NPC_HITBOX,
        height: NPC_HITBOX,
      };
      if (rectsOverlap(pr, nr)) return true;
    }
    return false;
  };
  if (!overlapsAnyNpc(spawn.tileX, spawn.tileY)) return spawn;
  // Scan concentric Manhattan rings — closer first.
  for (let r = 1; r <= radius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) + Math.abs(dy) !== r) continue;
        const tx = spawn.tileX + dx;
        const ty = spawn.tileY + dy;
        if (!overlapsAnyNpc(tx, ty)) return { tileX: tx, tileY: ty };
      }
    }
  }
  return spawn;
}

/**
 * Stronger version of `findUnblockedSpawnTile` for post-warp scenarios
 * (blackout revival, FTUE shortcuts, etc.). Checks BOTH the static map
 * blocker layer and live NPC positions, so the returned tile is guaranteed
 * walkable. Falls back to the input spawn if no walkable tile exists within
 * `radius`.
 *
 * Required for the healer-revival warp: `findUnblockedSpawnTile` only
 * checks NPCs, so it would happily place the player on a wall or in the
 * water just to dodge the healer NPC. This one snaps to terrain that the
 * player can actually move on.
 */
export function findSafeRespawnTile(
  mapId: string,
  spawn: { tileX: number; tileY: number },
  npcStates: NpcRuntime[],
  radius: number = 6,
): { tileX: number; tileY: number } {
  const map = getMap(mapJsonPath(mapId));
  if (!map) return findUnblockedSpawnTile(spawn, npcStates, radius);
  const npcBlockers = new Set<string>();
  for (const nrt of npcStates) {
    const ntx = Math.floor((nrt.x + TILE_SIZE / 2) / TILE_SIZE);
    const nty = Math.floor((nrt.y + TILE_SIZE / 2) / TILE_SIZE);
    npcBlockers.add(`${ntx},${nty}`);
  }
  const snapped = nearestWalkable(map, spawn.tileX, spawn.tileY, radius, npcBlockers);
  if (snapped) return { tileX: snapped.tx, tileY: snapped.ty };
  return spawn;
}

/**
 * 2026-05-18 (v1.411) — Per-map reachability cache from the default
 * spawn tile. The set holds "tx,ty" strings for every tile that
 * `isWalkable` accepts AND is connected (4-directional flood) to the
 * map's default spawn.
 *
 * WHY THIS EXISTS
 *   Discord report from DrVirjinity 18 minutes after v1.409 went
 *   live: "I left the game on in background while I was outside the
 *   bounds on that ss earlier and the unstuck puts me outside the
 *   bounds with no way back in." Root cause: `isWalkable` defines
 *   "walkable" as "in-bounds AND no blocker tile at this position",
 *   but a map's void / decorative regions outside the playable area
 *   also have no blocker tiles registered. The BFS in
 *   `nearestWalkable` happily accepted those void cells as valid
 *   snap targets, leaving the player snapped from one out-of-bounds
 *   spot to another with no way back into the playable region.
 *   Same defect made `isHitboxClear` return true for many out-of-
 *   bounds positions, suppressing the auto-unstuck entirely until
 *   the player wandered to a spot that DID overlap a registered
 *   blocker — at which point the snap finished the soft-lock.
 *
 * Computed once per map on first need and cached for the process
 * lifetime — map data is immutable once loaded so the reachable set
 * is too. Memory is trivial (Set<string> of up to ~mapWidth × mapHeight
 * entries; in practice ~1-5k tiles per map).
 */
const REACHABLE_FROM_SPAWN_CACHE = new Map<string, Set<string>>();

function computeReachableFromSpawn(mapId: string, map: SFMap): Set<string> {
  const cached = REACHABLE_FROM_SPAWN_CACHE.get(mapId);
  if (cached) return cached;

  const reachable = new Set<string>();
  const spawn = getSpawn(mapId);
  const seedTx = spawn.tileX;
  const seedTy = spawn.tileY;
  // Seed validation: a map whose catalog default spawn isn't itself
  // walkable is a content bug (`createOverworldState` would already
  // have snapped on entry), but be defensive — try the nearest
  // walkable cell within a small radius as the seed so the flood
  // still works. NPCs are excluded from the walkability check here
  // because we want the static reachability set of the map itself;
  // an NPC parked on a doorway doesn't make the rest of the map
  // unreachable.
  let startTx = seedTx;
  let startTy = seedTy;
  const startKey = `${startTx},${startTy}`;
  if (!isWalkable(map, startTx, startTy)) {
    const snap = nearestWalkable(map, seedTx, seedTy, 6);
    if (snap) {
      startTx = snap.tx;
      startTy = snap.ty;
    } else {
      console.warn(
        `[reachable] map '${mapId}' default spawn (${seedTx},${seedTy}) not walkable AND no nearby walkable found — reachable set will be empty; auto-unstuck falls back to spawn-tile pixel coords`,
      );
      REACHABLE_FROM_SPAWN_CACHE.set(mapId, reachable);
      return reachable;
    }
  }

  // 4-direction BFS. Diagonal moves aren't actually traversable by
  // the player (only via slip+push), so the reachable set should
  // mirror that — using 4-neighbor flood matches what the player
  // can actually navigate to.
  const queue: Array<[number, number]> = [[startTx, startTy]];
  reachable.add(`${startTx},${startTy}`);
  if (startKey !== `${startTx},${startTy}`) reachable.add(startKey);
  const NEIGHBORS_4: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (queue.length > 0) {
    const [tx, ty] = queue.shift()!;
    for (const [dx, dy] of NEIGHBORS_4) {
      const nx = tx + dx;
      const ny = ty + dy;
      const k = `${nx},${ny}`;
      if (reachable.has(k)) continue;
      if (!isWalkable(map, nx, ny)) continue;
      reachable.add(k);
      queue.push([nx, ny]);
    }
  }
  console.warn(
    `[reachable] map '${mapId}' flood from spawn (${startTx},${startTy}) → ${reachable.size} reachable tiles`,
  );
  REACHABLE_FROM_SPAWN_CACHE.set(mapId, reachable);
  return reachable;
}

/**
 * 2026-05-11 — Hitbox-aware login validator.
 * 2026-05-18 (v1.411) — Reachability-aware: snap target must be
 * connected to the map's default spawn, never just "no blocker
 * here". See `computeReachableFromSpawn` above for the full
 * DrVirjinity-out-of-bounds bug context.
 *
 * BACKGROUND
 *   `findSafeRespawnTile` only validates the *tile center* via
 *   `nearestWalkable`. That misses two real-world stuck cases:
 *     1. The save fired mid-step, so the player's pixel position
 *        straddles a blocker tile or an NPC body even though its
 *        rounded tile center is clear.
 *     2. The BFS exhausted its radius without finding a free cell;
 *        we silently returned the original (stuck) tile.
 *   Both produce the chronic "logged in stuck on NPC, can't move
 *   any direction" reports.
 *   v1.411 added a third case: the player is in a region that's
 *   technically inside the map array bounds but disconnected from
 *   the playable area (void), where no blocker tiles exist so the
 *   BFS happily snaps in place.
 *
 * FIX
 *   - Validate at the player's actual hitbox rect against both the
 *     map blocker layer AND every NPC's body rect.
 *   - Widen the snap radius to 12 tiles.
 *   - When the BFS still finds nothing, fall back to the map's
 *     default spawn — guaranteed safe because every entry to
 *     `createOverworldState` already runs `findUnblockedSpawnTile`
 *     against it. This trades "stay near where you saved" for "you
 *     can always move", which is the right call when the save is
 *     unrecoverable.
 *   - (v1.411) Treat positions whose tile is NOT in the reachable-
 *     from-spawn set as automatically stuck regardless of
 *     `isHitboxClear`. The snap target must also be in the
 *     reachable set; otherwise fall straight through to the
 *     default-spawn warp. Closes the "snap from one out-of-bounds
 *     spot to another" path DrVirjinity reported.
 *
 * Returns pixel-precise coordinates plus a `rescued` flag for
 * telemetry / banner UX.
 */
export function findLoginSafePosition(
  mapId: string,
  savedPixelX: number,
  savedPixelY: number,
  npcStates: NpcRuntime[],
): { pixelX: number; pixelY: number; rescued: boolean } {
  const map = getMap(mapJsonPath(mapId));
  // No map data yet (lazy-load race) → trust the save; the live
  // collision system will catch up once the map loads.
  if (!map) return { pixelX: savedPixelX, pixelY: savedPixelY, rescued: false };

  // 2026-05-18 (v1.411) — Reachability check. Compute (or hit cache)
  // the set of tiles connected to the default spawn. The saved
  // position's tile must be in this set; otherwise the player is in
  // a void / out-of-bounds region and no local snap will help.
  const reachable = computeReachableFromSpawn(mapId, map);
  const savedTx = Math.floor((savedPixelX + TILE_SIZE / 2) / TILE_SIZE);
  const savedTy = Math.floor((savedPixelY + TILE_SIZE / 2) / TILE_SIZE);
  const savedInReachable = reachable.size > 0 && reachable.has(`${savedTx},${savedTy}`);

  // Fast path: in-bounds, in-reachable, hitbox clear → not stuck.
  if (savedInReachable && isHitboxClear(map, savedPixelX, savedPixelY, npcStates)) {
    return { pixelX: savedPixelX, pixelY: savedPixelY, rescued: false };
  }

  // Snap to nearest walkable tile center via the BFS. Tile-center
  // pixel coords are always hitbox-clean against the tile itself,
  // so the snapped result is automatically valid for blocker
  // collision; we additionally require the snap target to be in
  // the reachable set so it isn't a disconnected void tile.
  const npcBlockers = new Set<string>();
  for (const nrt of npcStates) {
    const ntx = Math.floor((nrt.x + TILE_SIZE / 2) / TILE_SIZE);
    const nty = Math.floor((nrt.y + TILE_SIZE / 2) / TILE_SIZE);
    npcBlockers.add(`${ntx},${nty}`);
  }
  // 2026-05-22 — Also exclude tiles overlapped by ObjectPlacement
  // colliders (flags etc.). Without this the snap can return the
  // player's CURRENT tile, which still sits inside the object rect,
  // so Unstuck visibly does nothing for an object-stuck player.
  for (const r of map.objectBlockerRects) {
    const x0 = Math.floor(r.x / TILE_SIZE);
    const y0 = Math.floor(r.y / TILE_SIZE);
    const x1 = Math.floor((r.x + r.w - 1) / TILE_SIZE);
    const y1 = Math.floor((r.y + r.h - 1) / TILE_SIZE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) npcBlockers.add(`${tx},${ty}`);
  }
  // Only attempt the local snap if the saved position is in the
  // reachable set. Out-of-bounds players go straight to the
  // default-spawn warp below — searching outward from a void cell
  // wastes BFS cycles and risks landing on another void cell.
  if (savedInReachable) {
    const snapped = nearestWalkable(map, savedTx, savedTy, 12, npcBlockers);
    if (snapped && reachable.has(`${snapped.tx},${snapped.ty}`)) {
      console.warn(
        `[loginSafe] '${mapId}' saved pos (${savedPixelX},${savedPixelY}) overlapped blocker/NPC — snapped to reachable (${snapped.tx},${snapped.ty})`,
      );
      return { pixelX: snapped.tx * TILE_SIZE, pixelY: snapped.ty * TILE_SIZE, rescued: true };
    }
    if (snapped) {
      // Snap landed on a "walkable" but DISCONNECTED tile (void
      // region). Drop straight through to default-spawn warp.
      console.warn(
        `[loginSafe] '${mapId}' nearestWalkable returned (${snapped.tx},${snapped.ty}) but it's not in the reachable set — falling back to default spawn instead`,
      );
    }
  } else {
    console.warn(
      `[loginSafe] '${mapId}' saved pos tile (${savedTx},${savedTy}) is OUT OF REACHABLE SET (void / OOB) — skipping local snap, warping to default spawn`,
    );
  }

  // Total recovery: warp to map default spawn. createOverworldState
  // proves this tile is reachable; better to lose the saved location
  // than leave the player permanently stuck.
  const defaultSpawn = getSpawn(mapId);
  console.warn(
    `[loginSafe] '${mapId}' falling back to default spawn (${defaultSpawn.tileX},${defaultSpawn.tileY})`,
  );
  return {
    pixelX: defaultSpawn.tileX * TILE_SIZE,
    pixelY: defaultSpawn.tileY * TILE_SIZE,
    rescued: true,
  };
}

/** True when the player's hitbox at `(pixelX, pixelY)` doesn't
 *  overlap any static map blocker or any NPC body. Mirrors the
 *  per-frame collision logic so a "valid login pos" matches what
 *  the live update loop considers walkable. */
function isHitboxClear(
  map: SFMap,
  pixelX: number,
  pixelY: number,
  npcStates: NpcRuntime[],
): boolean {
  const px = pixelX + PLAYER_HITBOX_OFFSET;
  const py = pixelY + PLAYER_HITBOX_OFFSET;
  if (rectCollidesBlockers(map, TILE_SIZE, px, py, PLAYER_HITBOX, PLAYER_HITBOX)) return false;
  const playerRect: Rect = { x: px, y: py, width: PLAYER_HITBOX, height: PLAYER_HITBOX };
  for (const nrt of npcStates) {
    // v1.710 — Match the live findCollidingNpc widening so a saved
    // login position next to a `gateTilesLR` NPC is correctly treated
    // as unsafe and falls through to nearestWalkable.
    const gateLR = NPC_CATALOG[nrt.id]?.gateTilesLR ?? 0;
    const lateral = gateLR > 0 ? gateLR * TILE_SIZE : 0;
    const npcRect: Rect = {
      x: nrt.x + NPC_HITBOX_OFFSET - lateral,
      y: nrt.y + NPC_HITBOX_OFFSET,
      width: NPC_HITBOX + lateral * 2,
      height: NPC_HITBOX,
    };
    if (rectsOverlap(playerRect, npcRect)) return false;
  }
  return true;
}

export function createOverworldState(mapId: string = 'villageruin'): OverworldState {
  const spawn = getSpawn(mapId) ?? { tileX: PLAYER_START.tileX, tileY: PLAYER_START.tileY };
  // v1.253 — Defensive spawn bump. If an NPC's hitbox overlaps the spawn
  // tile (because someone placed an NPC right next to / on top of the
  // spawn point in the JSON), the player loads in "stuck" — they can't
  // walk in any direction without the NPC blocking them. Find the
  // nearest unblocked tile in a 5-tile radius and use that instead.
  // No-op when the spawn is already clear, which is the common case.
  const npcStates = buildNpcStatesForMap(mapId);
  const safeSpawn = findUnblockedSpawnTile(spawn, npcStates);
  return {
    currentMapId: mapId,
    playerX: safeSpawn.tileX * TILE_SIZE,
    playerY: safeSpawn.tileY * TILE_SIZE,
    direction: 'down',
    isMoving: false,
    walkFrame: 0,
    walkTimer: 0,
    interactingNpc: null,
    dialogueIndex: 0,
    readingSign: null,
    signPageIdx: 0,
    blockedPortalIds: new Set(),
    bumpedGateId: null,
    postTeleportCooldown: 0,
    lastTeleportPos: null,
    facingRestorable: null,
    facingSign: null,
    villageProgress: {},
    trainerDefeats: new Set(),
    towerRunActive: false,
    bumpedTowerLockedPortalId: null,
    playerCharacter: DEFAULT_PLAYER_CHARACTER,
    pathTarget: null,
    pathStuckFrames: 0,
    stuckFrames: 0,
    collectedPickups: new Set(),
    npcStates,
    animalStates: buildAnimalStatesForMap(mapId),
    particles: [],
    grassParticleCooldown: 0,
    postBattleEncounterCooldown: 0,
    postBattleSafeTile: null,
  };
}

function getPlayerHitbox(state: OverworldState): Rect {
  return {
    x: state.playerX + PLAYER_HITBOX_OFFSET,
    y: state.playerY + PLAYER_HITBOX_OFFSET,
    width: PLAYER_HITBOX,
    height: PLAYER_HITBOX,
  };
}

function getTileRect(col: number, row: number): Rect {
  return { x: col * TILE_SIZE, y: row * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE };
}

const PLAYER_RADIUS = PLAYER_HITBOX / 2;
// How much of an NPC's tile counts as solid body for player collision. The NPC
// sprite draws at TILE_SIZE but their actual silhouette is narrower — fencing
// the hit box inset a bit keeps the collision feeling fair instead of sticky.
const NPC_HITBOX = 32;
const NPC_HITBOX_OFFSET = (TILE_SIZE - NPC_HITBOX) / 2;
/** Animals use a slightly tighter hitbox — their silhouettes tend to be
 *  smaller than NPC character sprites (e.g. a cat vs. a full person). */
const ANIMAL_HITBOX = 28;
const ANIMAL_HITBOX_OFFSET = (TILE_SIZE - ANIMAL_HITBOX) / 2;

function playerCollidesAnyNpc(state: OverworldState, dx: number, dy: number): boolean {
  return findCollidingNpc(state, dx, dy) !== null;
}

/**
 * Like playerCollidesAnyNpc, but returns the offending NPC (or null). Lets
 * the move code know exactly who's in the way so it can try to push them
 * out of the path instead of just blocking.
 */
/** True when this NPC is a bridge guard that has already been defeated —
 *  their collision should be skipped so the player can walk through. */
function isDefeatedBridgeGuard(nrt: NpcRuntime, state: OverworldState): boolean {
  if (!state.trainerDefeats.has(nrt.id)) return false;
  const cat = NPC_CATALOG[nrt.id];
  return !!cat?.blocksPassage;
}

function findCollidingNpc(state: OverworldState, dx: number, dy: number): NpcRuntime | null {
  const newPlayer: Rect = {
    x: state.playerX + PLAYER_HITBOX_OFFSET + dx,
    y: state.playerY + PLAYER_HITBOX_OFFSET + dy,
    width: PLAYER_HITBOX,
    height: PLAYER_HITBOX,
  };
  for (const nrt of state.npcStates) {
    // Defeated trainers that are marked as bridge guards become walk-
    // through once beaten so they stop physically blocking the path.
    if (isDefeatedBridgeGuard(nrt, state)) continue;
    // v1.710 — Lateral gate widening for `gateTilesLR` NPCs (see
    // NpcDef in types.ts). When set, expand the npcRect by N tile
    // widths on each side (no Y change) so the NPC physically spans
    // a corridor and funnels the player through a talk interaction
    // instead of letting them squeeze past on the side tile.
    const gateLR = NPC_CATALOG[nrt.id]?.gateTilesLR ?? 0;
    const lateral = gateLR > 0 ? gateLR * TILE_SIZE : 0;
    const npcRect: Rect = {
      x: nrt.x + NPC_HITBOX_OFFSET - lateral,
      y: nrt.y + NPC_HITBOX_OFFSET,
      width: NPC_HITBOX + lateral * 2,
      height: NPC_HITBOX,
    };
    if (rectsOverlap(newPlayer, npcRect)) return nrt;
  }
  // Animals are intentionally non-solid for the player — you can walk
  // through a wandering dog. They still collide with NPCs and each other
  // so their wander behavior looks natural.
  return null;
}

/**
 * Player-vs-NPC contact resolver.
 *
 * v1.207 — push-aside DISABLED entirely. Originally this was intended
 * for anonymous wandering villagers blocking narrow paths, but every
 * NPC on every map now ships as a named NPC_CATALOG entry (services,
 * trainers, dialogue NPCs), so the only effect of pushing was:
 *   - Trainer battles refusing to fire because the trainer kept side-
 *     stepping the player (fixed in the first pass by gating on
 *     pendingTrainer, but service NPCs still felt jittery).
 *   - Healer/Quartermaster/Tutor NPCs scooting away when the player
 *     tried to talk to them, making interactions feel slippery.
 *   - Players reporting "I keep pushing NPCs around the map."
 *
 * NPCs are now hard blockers — the player walks around them, exactly
 * like every classic RPG. Animals are still non-solid for the player
 * (see findCollidingNpc) so a wandering dog doesn't stop you.
 *
 * Kept the function (and the call sites) as a no-op so wandering NPCs
 * can be re-enabled cheaply if we ever want them, but they should be
 * gated by an explicit flag on NpcDef ("wanderer: true") rather than
 * the previous default-on behavior.
 */
function tryPushNpcAside(_nrt: NpcRuntime, _state: OverworldState): boolean {
  return false;
}

/** Find a restorable building within interaction range of the player. */
function getNearbyRestorable(state: OverworldState): RestorableDef | null {
  // Restorables are villageruin-only for now; gate so teleporting into a
  // dungeon doesn't light up false-positive prompts from overlapping coords.
  if (state.currentMapId !== 'villageruin') return null;
  const cx = state.playerX + TILE_SIZE / 2;
  const cy = state.playerY + TILE_SIZE / 2;
  for (const b of RESTORABLES) {
    const bx = (b.tileX + b.widthTiles / 2) * TILE_SIZE;
    const by = (b.tileY + b.heightTiles / 2) * TILE_SIZE;
    const dist = Math.hypot(bx - cx, by - cy);
    // Generous range — the building footprint itself is several tiles, and the
    // player should be able to walk up to any edge and trigger the prompt.
    const range = Math.max(b.widthTiles, b.heightTiles) * TILE_SIZE * 0.8 + TILE_SIZE;
    if (dist <= range) return b;
  }
  return null;
}

/** Find a world sign within interaction range of the player. Cheap
 *  enough to call every frame — WORLD_SIGNS is small (one entry per
 *  zone for now) and the geometry is a single distance check per sign.
 *  Range matches the tile-grid feel of NPC adjacency: ~1.2 tiles. */
function getNearbyWorldSign(state: OverworldState): WorldSignDef | null {
  const signs = getWorldSignsForMap(state.currentMapId);
  if (signs.length === 0) return null;
  const cx = state.playerX + TILE_SIZE / 2;
  const cy = state.playerY + TILE_SIZE / 2;
  const range = TILE_SIZE * 1.4;
  let bestDist = Infinity;
  let best: WorldSignDef | null = null;
  for (const s of signs) {
    // For wide signs the readable target is the centre of the full
    // footprint (anchor tile + width-1 tiles to the right), so the player
    // can stand under any cell and still read.
    const w = getSignWidth(s.sprite);
    const sx = s.tileX * TILE_SIZE + (w * TILE_SIZE) / 2;
    const sy = s.tileY * TILE_SIZE + TILE_SIZE / 2;
    const d = Math.hypot(sx - cx, sy - cy);
    if (d <= range + ((w - 1) * TILE_SIZE) / 2 && d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best;
}

/** True if (dx, dy) would push the player's hitbox onto a sign tile.
 *  Signs are physically solid — players walk up to them and read,
 *  same as bumping a wall. Wide signs (sign_wide2/3) block their full
 *  footprint, not just the anchor cell. */
function playerCollidesWorldSign(state: OverworldState, dx: number, dy: number): boolean {
  const signs = getWorldSignsForMap(state.currentMapId);
  if (signs.length === 0) return false;
  const cx = state.playerX + TILE_SIZE / 2 + dx;
  const cy = state.playerY + TILE_SIZE / 2 + dy;
  for (const s of signs) {
    // Invisible markers don't block — they're meant to layer on top of
    // an existing blocker so the underlying tile handles collision.
    if (!isRenderableSign(s.sprite)) continue;
    const w = getSignWidth(s.sprite);
    const left = s.tileX * TILE_SIZE;
    const right = left + w * TILE_SIZE;
    const top = s.tileY * TILE_SIZE;
    const bottom = top + TILE_SIZE;
    const nearestX = Math.max(left, Math.min(cx, right));
    const nearestY = Math.max(top, Math.min(cy, bottom));
    if (Math.hypot(cx - nearestX, cy - nearestY) < PLAYER_RADIUS) return true;
  }
  return false;
}

function playerCircleCollides(state: OverworldState, dx: number, dy: number): boolean {
  // NPCs are solid — players can't walk through them anymore.
  if (playerCollidesAnyNpc(state, dx, dy)) return true;
  // Active quest gates make their portal rect solid — the door is the
  // physical block, not just a teleport rejection. Cleared the moment the
  // gate's required trainers are defeated.
  if (playerCollidesActiveGate(state, dx, dy)) return true;
  // Wooden world signs are tile-sized solids (read from the side, not
  // walk-through). Mirrors NPC blocking semantics.
  if (playerCollidesWorldSign(state, dx, dy)) return true;
  const map = getMap(mapJsonPath(state.currentMapId));
  if (!map) return false;
  const cx = state.playerX + TILE_SIZE / 2 + dx;
  const cy = state.playerY + TILE_SIZE / 2 + dy;
  return circleCollidesBlockers(map, TILE_SIZE, cx, cy, PLAYER_RADIUS);
}

/** True if the proposed move (dx, dy) would push the player's hitbox into
 *  any active gated portal half on the current map. */
function playerCollidesActiveGate(state: OverworldState, dx: number, dy: number): boolean {
  return findActiveGateBlocking(state, dx, dy) !== null;
}

/**
 * 2026-05-30 (v1.602) — Single chokepoint for "is this gate currently
 * open?" so trainer-defeat and event-window checks stay in one place.
 * Returns TRUE when the gate allows passage (all required trainers
 * defeated AND, if an `eventId` is set, that event is currently active).
 *
 * Mike (5/30): "the portral in the village is still taking users to the
 * desert event too man" — the v1.544 todo added `gate.eventId: 'desert_pharaoh'`
 * to portal-desert-city in portals.json but the actual gate evaluation
 * was only checking trainer defeats, so the desert portal stayed open
 * after the Pharaoh event window closed. This helper closes that loop.
 */
function isGateOpen(gate: PortalGate, state: OverworldState): boolean {
  const allDefeated = gate.requiredTrainerDefeats.every((id) => state.trainerDefeats.has(id));
  if (!allDefeated) return false;
  if (gate.eventId && !isEventGateActive(gate.eventId)) return false;
  return true;
}

/** Like the above but returns the offending portal id so the caller can
 *  fire the "sealed" toast naming the right gate. */
function findActiveGateBlocking(state: OverworldState, dx: number, dy: number): string | null {
  const playerRect: Rect = {
    x: state.playerX + PLAYER_HITBOX_OFFSET + dx,
    y: state.playerY + PLAYER_HITBOX_OFFSET + dy,
    width: PLAYER_HITBOX,
    height: PLAYER_HITBOX,
  };
  for (const portal of getPortals()) {
    const gate = portal.gate;
    if (!gate) continue;
    if (!isPortalVisibleToCurrentPlayer(portal, state.currentMapId)) continue;
    if (state.currentMapId !== gate.fromMapId) continue;
    if (isGateOpen(gate, state)) continue;
    const half = portal.a.mapId === gate.fromMapId ? portal.a : portal.b;
    if (rectsOverlap(playerRect, halfWorldRect(half))) return portal.id;
  }
  return null;
}

/** Padding (in pixels) added to a gated door's rect to form the "info
 *  zone" — when the player enters this expanded rect we fire the
 *  "sealed" toast. Keeps the collision tight on the actual rect while
 *  giving the player a chance to read the requirement before they're
 *  pinned against the door. One tile on each side feels generous
 *  without spilling far into the surrounding map. */
const GATE_TOAST_PROXIMITY_PX = TILE_SIZE;

/** Returns the id of any active gate whose inflated rect the player
 *  currently overlaps, regardless of whether they're moving. Used to
 *  fire the "sealed" toast when the player approaches the door, not
 *  just when they push into it. */
function findActiveGateNearby(state: OverworldState): string | null {
  const playerRect: Rect = {
    x: state.playerX + PLAYER_HITBOX_OFFSET,
    y: state.playerY + PLAYER_HITBOX_OFFSET,
    width: PLAYER_HITBOX,
    height: PLAYER_HITBOX,
  };
  for (const portal of getPortals()) {
    const gate = portal.gate;
    if (!gate) continue;
    if (!isPortalVisibleToCurrentPlayer(portal, state.currentMapId)) continue;
    if (state.currentMapId !== gate.fromMapId) continue;
    if (isGateOpen(gate, state)) continue;
    const half = portal.a.mapId === gate.fromMapId ? portal.a : portal.b;
    const r = halfWorldRect(half);
    const inflated: Rect = {
      x: r.x - GATE_TOAST_PROXIMITY_PX,
      y: r.y - GATE_TOAST_PROXIMITY_PX,
      width: r.width + GATE_TOAST_PROXIMITY_PX * 2,
      height: r.height + GATE_TOAST_PROXIMITY_PX * 2,
    };
    if (rectsOverlap(playerRect, inflated)) return portal.id;
  }
  return null;
}

/**
 * Try the axis-aligned move (dx, dy) — exactly one of them is non-zero.
 * If blocked, scan perpendicular offsets from 1..AUTO_SLIP_MAX and return
 * the smallest one that clears. Returns the slip amount on the perpendicular
 * axis (0 for a clean move, null if no slip clears within the budget).
 */
function findPerpendicularSlip(state: OverworldState, dx: number, dy: number): number | null {
  if (!playerCircleCollides(state, dx, dy)) return 0;
  const perp = dx !== 0 ? 'y' : 'x';
  for (let n = 1; n <= AUTO_SLIP_MAX; n++) {
    const neg = perp === 'y' ? playerCircleCollides(state, dx, -n) : playerCircleCollides(state, -n, dy);
    if (!neg) return -n;
    const pos = perp === 'y' ? playerCircleCollides(state, dx, n) : playerCircleCollides(state, n, dy);
    if (!pos) return n;
  }
  return null;
}

function npcWouldCollide(
  nrt: NpcRuntime,
  dx: number,
  dy: number,
  state: OverworldState,
  opts: { skipWanderBox?: boolean } = {},
): boolean {
  const newX = nrt.x + dx;
  const newY = nrt.y + dy;
  if (!opts.skipWanderBox) {
    // Fence: keep the NPC anchor within NPC_WANDER_BOX_TILES tiles of spawn.
    const half = (NPC_WANDER_BOX_TILES * TILE_SIZE) / 2;
    if (
      newX < nrt.spawnX - half ||
      newX > nrt.spawnX + half ||
      newY < nrt.spawnY - half ||
      newY > nrt.spawnY + half
    ) {
      return true;
    }
  }

  // Don't wander onto a portal trigger — NPCs standing on doors block
  // entry/exit. The wander code respects this; a push (skipWanderBox) does
  // too, since "out of the way" still shouldn't park the NPC on a doorway.
  const newTx = Math.floor((newX + TILE_SIZE / 2) / TILE_SIZE);
  const newTy = Math.floor((newY + TILE_SIZE / 2) / TILE_SIZE);
  for (const portal of getPortals()) {
    for (const halfP of [portal.a, portal.b]) {
      if (halfP.mapId !== state.currentMapId) continue;
      const r = halfP.rect;
      if (newTx >= r.tileX && newTx < r.tileX + r.w && newTy >= r.tileY && newTy < r.tileY + r.h) {
        return true;
      }
    }
  }

  // Don't wander onto the player — avoids the NPC pushing through you.
  const npcRect: Rect = {
    x: newX + NPC_HITBOX_OFFSET,
    y: newY + NPC_HITBOX_OFFSET,
    width: NPC_HITBOX,
    height: NPC_HITBOX,
  };
  const playerRect: Rect = {
    x: state.playerX + PLAYER_HITBOX_OFFSET,
    y: state.playerY + PLAYER_HITBOX_OFFSET,
    width: PLAYER_HITBOX,
    height: PLAYER_HITBOX,
  };
  if (rectsOverlap(npcRect, playerRect)) return true;

  // Also don't wander into another NPC.
  for (const other of state.npcStates) {
    if (other.id === nrt.id) continue;
    const otherRect: Rect = {
      x: other.x + NPC_HITBOX_OFFSET,
      y: other.y + NPC_HITBOX_OFFSET,
      width: NPC_HITBOX,
      height: NPC_HITBOX,
    };
    if (rectsOverlap(npcRect, otherRect)) return true;
  }
  // ...or an animal.
  for (const art of state.animalStates) {
    if (rectsOverlap(npcRect, {
      x: art.x + ANIMAL_HITBOX_OFFSET,
      y: art.y + ANIMAL_HITBOX_OFFSET,
      width: ANIMAL_HITBOX,
      height: ANIMAL_HITBOX,
    })) return true;
  }
  // ...or a world sign. Signs block the player and should block wanderers
  // too — otherwise an NPC can drift across the sign and look like it's
  // walking through wood. Wide signs (sign_wide2/3) block their full
  // footprint, not just the anchor cell. no_sprite signs are skipped
  // since they're invisible markers, not physical objects.
  for (const sign of getWorldSignsForMap(state.currentMapId)) {
    if (!isRenderableSign(sign.sprite)) continue;
    const w = getSignWidth(sign.sprite);
    const signRect: Rect = {
      x: sign.tileX * TILE_SIZE,
      y: sign.tileY * TILE_SIZE,
      width: w * TILE_SIZE,
      height: TILE_SIZE,
    };
    if (rectsOverlap(npcRect, signRect)) return true;
  }

  const map = getMap(mapJsonPath(state.currentMapId));
  if (!map) return false;
  return rectCollidesBlockers(map, TILE_SIZE, newX, newY, TILE_SIZE, TILE_SIZE);
}

function animalHitRect(art: AnimalRuntime, x: number = art.x, y: number = art.y): Rect {
  return {
    x: x + ANIMAL_HITBOX_OFFSET,
    y: y + ANIMAL_HITBOX_OFFSET,
    width: ANIMAL_HITBOX,
    height: ANIMAL_HITBOX,
  };
}

function animalWouldCollide(art: AnimalRuntime, dx: number, dy: number, state: OverworldState): boolean {
  // Per-instance wander fence — half-box in pixels.
  const half = art.def.wanderTiles * TILE_SIZE;
  const newX = art.x + dx;
  const newY = art.y + dy;
  if (
    newX < art.spawnX - half ||
    newX > art.spawnX + half ||
    newY < art.spawnY - half ||
    newY > art.spawnY + half
  ) {
    return true;
  }

  const next = animalHitRect(art, newX, newY);
  // Animals and the player pass through each other (collision is disabled
  // both ways). Still avoid NPCs and other animals so group wander looks
  // organic rather than overlapping.

  // Don't bump into NPCs.
  for (const nrt of state.npcStates) {
    const r: Rect = {
      x: nrt.x + NPC_HITBOX_OFFSET,
      y: nrt.y + NPC_HITBOX_OFFSET,
      width: NPC_HITBOX,
      height: NPC_HITBOX,
    };
    if (rectsOverlap(next, r)) return true;
  }
  // Don't bump into other animals.
  for (const other of state.animalStates) {
    if (other.index === art.index) continue;
    if (rectsOverlap(next, animalHitRect(other))) return true;
  }

  const map = getMap(mapJsonPath(state.currentMapId));
  if (!map) return false;
  return rectCollidesBlockers(map, TILE_SIZE, newX, newY, TILE_SIZE, TILE_SIZE);
}

function updateAnimalWander(art: AnimalRuntime, state: OverworldState) {
  if (art.wanderSteps <= 0) {
    art.isMoving = false;
    art.wanderCooldown--;
    if (art.wanderCooldown <= 0) {
      // Pick a random direction from the ones this sheet actually has frames
      // for. If the sheet hasn't loaded yet, roam horizontally — every sheet
      // has right_stand, so that's always safe.
      const sheet = getSpritesheet(art.def.spriteJson);
      const dirs: Direction[] = sheet ? getAnimalDirections(sheet) : ['left', 'right'];
      if (dirs.length === 0) {
        art.wanderCooldown = 120 + Math.floor(Math.random() * 240);
        return;
      }
      art.direction = dirs[Math.floor(Math.random() * dirs.length)]!;
      art.wanderSteps = TILE_SIZE * (1 + Math.floor(Math.random() * 2));
      art.wanderCooldown = 120 + Math.floor(Math.random() * 240);
    }
    return;
  }

  let dx = 0, dy = 0;
  switch (art.direction) {
    case 'up': dy = -ANIMAL_WANDER_SPEED; break;
    case 'down': dy = ANIMAL_WANDER_SPEED; break;
    case 'left': dx = -ANIMAL_WANDER_SPEED; break;
    case 'right': dx = ANIMAL_WANDER_SPEED; break;
  }

  if (!animalWouldCollide(art, dx, dy, state)) {
    art.x += dx;
    art.y += dy;
    art.isMoving = true;
    art.wanderSteps -= ANIMAL_WANDER_SPEED;

    art.walkTimer++;
    if (art.walkTimer >= ANIMAL_FRAME_PERIOD) {
      art.walkTimer = 0;
      art.walkFrame = (art.walkFrame + 1) % 2;
    }
  } else {
    art.wanderSteps = 0;
    art.isMoving = false;
  }
}

/**
 * Tick the NPC's mood-emote timer. Active emote fades after its duration;
 * after a pause, pick a random emote from the NPC's list. NPCs without any
 * moodEmotes never pop an emote.
 */
function tickNpcEmote(nrt: NpcRuntime) {
  if (nrt.emoteFramesLeft > 0) {
    nrt.emoteFramesLeft--;
    if (nrt.emoteFramesLeft === 0) nrt.activeEmoteSrc = null;
    return;
  }
  if (nrt.activeEmoteSrc !== null) return;
  if (nrt.nextEmoteIn > 0) {
    nrt.nextEmoteIn--;
    return;
  }
  const moods = NPC_CATALOG[nrt.id]?.moodEmotes;
  if (moods && moods.length > 0) {
    const pick = moods[Math.floor(Math.random() * moods.length)]!;
    nrt.activeEmoteSrc = `world/ui/Emote/${pick}.png`;
    nrt.emoteFramesLeft = 120; // ~2s at 60fps
  }
  // Reschedule whether or not we actually popped — if the list is empty this
  // turns into a cheap counter.
  nrt.nextEmoteIn = 300 + Math.floor(Math.random() * 900); // 5–20s
}

/** Snap an NPC's facing direction so they look at the player. Called the
 *  instant dialogue begins — without it, the NPC keeps facing wherever
 *  their wander tick last pointed and the player ends up talking to the
 *  back of someone's head. Also freezes the walk animation so a mid-step
 *  NPC doesn't keep bobbing during conversation. */
function turnNpcToFacePlayer(nrt: NpcRuntime, state: OverworldState) {
  const dx = state.playerX - nrt.x;
  const dy = state.playerY - nrt.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    nrt.direction = dx > 0 ? 'right' : 'left';
  } else {
    nrt.direction = dy > 0 ? 'down' : 'up';
  }
  nrt.isMoving = false;
  nrt.walkFrame = 0;
  // Reset any in-progress wander step so the NPC doesn't try to take a
  // step away on the next non-talking frame.
  nrt.wanderSteps = 0;
}

function updateNpcWander(nrt: NpcRuntime, state: OverworldState) {
  tickNpcEmote(nrt);
  const def = NPC_CATALOG[nrt.id];
  // Locked-facing NPCs: pin to the authored direction and skip all wander /
  // look-around. Only honored alongside `stationary` — facing-lock is a
  // refinement of "stay put", not a standalone mode (a wandering NPC frozen
  // to one facing would moonwalk). While the player is mid-conversation the
  // wander loop isn't even reached (the update returns early), so
  // turnNpcToFacePlayer's turn toward the player holds; the frame after
  // dialogue ends re-pins here.
  if (def?.stationary && def?.faceDirection) {
    nrt.isMoving = false;
    nrt.wanderSteps = 0;
    nrt.direction = def.faceDirection;
    return;
  }
  // Stationary NPCs stand rooted to their spawn — no random-walk step,
  // but they still occasionally turn to look around so they don't read
  // as statues. wanderCooldown ticks down; when it hits 0 we pick a new
  // random cardinal direction and reset to a longer interval (3–7s)
  // than the moving wander.
  if (def?.stationary) {
    nrt.isMoving = false;
    nrt.wanderSteps = 0;
    nrt.wanderCooldown--;
    if (nrt.wanderCooldown <= 0) {
      const dirs: Direction[] = ['up', 'down', 'left', 'right'];
      nrt.direction = dirs[Math.floor(Math.random() * dirs.length)]!;
      nrt.wanderCooldown = 180 + Math.floor(Math.random() * 240);
    }
    return;
  }
  if (nrt.wanderSteps <= 0) {
    nrt.isMoving = false;
    nrt.wanderCooldown--;
    if (nrt.wanderCooldown <= 0) {
      const dirs: Direction[] = ['up', 'down', 'left', 'right'];
      nrt.direction = dirs[Math.floor(Math.random() * dirs.length)]!;
      nrt.wanderSteps = TILE_SIZE * (1 + Math.floor(Math.random() * 2));
      nrt.wanderCooldown = 120 + Math.floor(Math.random() * 240);
    }
    return;
  }

  let dx = 0, dy = 0;
  const speed = 1;
  switch (nrt.direction) {
    case 'up': dy = -speed; break;
    case 'down': dy = speed; break;
    case 'left': dx = -speed; break;
    case 'right': dx = speed; break;
  }

  if (!npcWouldCollide(nrt, dx, dy, state)) {
    nrt.x += dx;
    nrt.y += dy;
    nrt.isMoving = true;
    nrt.wanderSteps -= speed;

    nrt.walkTimer++;
    if (nrt.walkTimer >= 15) {
      nrt.walkTimer = 0;
      nrt.walkFrame = (nrt.walkFrame + 1) % 4;
    }
  } else {
    nrt.wanderSteps = 0;
    nrt.isMoving = false;
  }
}

function getFacingNpc(state: OverworldState): string | null {
  let checkX = state.playerX;
  let checkY = state.playerY;
  switch (state.direction) {
    case 'up': checkY -= TILE_SIZE; break;
    case 'down': checkY += TILE_SIZE; break;
    case 'left': checkX -= TILE_SIZE; break;
    case 'right': checkX += TILE_SIZE; break;
  }
  const checkRect: Rect = {
    x: checkX + PLAYER_HITBOX_OFFSET,
    y: checkY + PLAYER_HITBOX_OFFSET,
    width: PLAYER_HITBOX,
    height: PLAYER_HITBOX,
  };
  for (const nrt of state.npcStates) {
    const npcRect: Rect = { x: nrt.x, y: nrt.y, width: TILE_SIZE, height: TILE_SIZE };
    if (rectsOverlap(checkRect, npcRect)) return nrt.id;
  }
  return null;
}

export interface OverworldUpdateResult {
  encounter: boolean;
  interactingNpc: NpcDef | null;
  dialogueIndex: number;
  /**
   * 2026-05-18 (v1.409) — Set on the single frame the auto-unstuck
   * rescue fires (player held a direction for STUCK_AUTO_RESCUE_FRAMES
   * without their position changing). WorldTab shows a brief toast
   * ("Got you unstuck!") so the player understands what happened
   * instead of seeing themselves teleport silently. See
   * OverworldState.stuckFrames for the trigger logic.
   */
  autoUnstuckRescued: boolean;
  /**
   * 2026-06-10 — Pre-snap player pixel coords captured the moment the
   * auto-unstuck fires. We need these for the rescue analytics to
   * pinpoint the offending tile (villageruin / snow_town clusters in
   * Mike's 24h report). Without capturing pre-snap, OverworldState's
   * playerX/Y is already the safe-spawn position by the time the
   * React handler runs and the analytics event ships, so the heatmap
   * would just show "where players got rescued TO", not "where they
   * got stuck".
   */
  autoUnstuckTrapPx: number | null;
  autoUnstuckTrapPy: number | null;
  /** Restorable the player is adjacent to (for the HUD prompt). */
  nearbyRestorable: RestorableDef | null;
  /** Set when the player pressed A with a restorable nearby — WorldTab opens the restoration modal. */
  openedRestorable: string | null;
  /** Set on the frame the player stepped onto a pickup tile — WorldTab awards rewards. */
  collectedPickup: PickupDef | null;
  /** v1.253 — Set when the player initiated talk with a utility NPC
   *  (shop / heal / tutor / merge / pvp / starter-pick). The dialogue
   *  is bypassed entirely so the modal opens on the very first tap
   *  instead of forcing the player to mash through 3 lines of flavor
   *  text. WorldTab routes this through the same handler as
   *  dialogue-end so all the existing kind-dispatch logic is reused. */
  utilityNpcOpened: string | null;
  /** v1.252 — World sign the player just pressed A on. WorldTab looks
   *  up the def in WORLD_SIGNS and dispatches per `kind` (e.g. dojo
   *  flier modal). Mutually exclusive with the NPC / restorable
   *  branches above — the action-press handler returns the moment any
   *  one of them fires. */
  openedSign: string | null;
  /** Sign currently within interaction range (for the HUD "!" prompt). */
  nearbySign: WorldSignDef | null;
  /** Sign the player is currently reading. Mirrors interactingNpc: stays
   *  set across frames until the player walks away or moves, at which
   *  point the engine clears it. WorldTab closes the popup when this
   *  transitions to null. Null if no sign is open. */
  readingSign: string | null;
  /** Current page index for text-dialogue signs. React renders this. */
  signPageIdx: number;
}

/** Utility NPC kinds whose tap should open a modal directly. */
function isUtilityKind(kind: NpcDef['kind']): boolean {
  return kind === 'shop' || kind === 'heal' || kind === 'tutor'
    || kind === 'merge' || kind === 'pvp' || kind === 'starter-pick'
    || kind === 'tower' || kind === 'tower-challenger';
}

/**
 * 2026-05-12 — Admin-gated portals (e.g. dev sandbox zones) appear in
 * portals.json so they ship in the bundle, but for non-admin players
 * they must be invisible: no warp trigger, no proximity prompt, no
 * door overlay. Centralized so every portal-iterating loop can opt in
 * with one filter call.
 *
 * 2026-05-17 — Gates are now ONE-WAY. `gate.fromMapId` names the side
 * the block applies from; the OPPOSITE side is always visible so a
 * player who somehow ended up on the gated side (e.g. they entered
 * desert_city before v1.383 shipped the `eventId` gate) can still
 * walk back out. Without this fix, those players would be stuck in
 * desert_city forever — the portal would be hidden from both sides.
 * `currentMapId` is optional so legacy callers without map context
 * fall back to the previous "hide on both sides" behavior (safest
 * default when we don't know where the player is).
 */
function isPortalVisibleToCurrentPlayer(p: Portal, currentMapId?: string): boolean {
  const gate = p.gate;
  if (!gate) return true;
  // If the caller told us where the player is AND the player is on the
  // non-gated side, ignore the gate entirely. Stranded players use this
  // to escape; admins keep full bidirectional access via the bypasses
  // below.
  if (currentMapId && gate.fromMapId && currentMapId !== gate.fromMapId) {
    return true;
  }
  if (gate.adminOnly && !isAdminCached()) return false;
  // 2026-05-13 — Limited-time event gate. When set, the portal only
  // surfaces to non-admin players during the event window. Admins
  // bypass via `isAdminCached()` inside the resolver so we can QA
  // pre-launch and post-close.
  if (gate.eventId && !isEventGateActive(gate.eventId)) return false;
  return true;
}

/** Resolve an event-gate id to its current live state. Admins are
 *  treated as "always live" via the per-event helpers so the QA path
 *  doesn't need any further branching here. Add new event ids by
 *  extending this switch. */
function isEventGateActive(eventId: string): boolean {
  switch (eventId) {
    case 'desert_pharaoh':
      return isDesertEventActive();
    default:
      // Unknown event id: be conservative — treat as inactive so a
      // typo in portals.json doesn't accidentally leak content.
      return false;
  }
}

/**
 * Swap the player to the destination map + spawn. Atomic — no intermediate
 * "transitioning" state. The renderer looks up map data by state.currentMapId
 * every frame, so writing it here is all we need.
 *
 * Preloading is handled once at game start in preloadAssets(). If a map ever
 * fails to preload, getMap() for it returns null and the renderer will show
 * a placeholder; we log loudly here so that case is diagnosable from the
 * console instead of being silent.
 */
function teleport(state: OverworldState, portal: Portal, fromSide: 'a' | 'b') {
  const dest = fromSide === 'a' ? portal.b : portal.a;
  const ok = teleportToMap(state, dest.mapId, {
    spawnTileX: dest.spawn.tileX,
    spawnTileY: dest.spawn.tileY,
    facing: dest.facing,
  });
  // 2026-05-12 — If the destination wasn't preloaded (new map added
  // after boot, e.g. dev-only desert zone in a long-running dev
  // session), fire a lazy load so the next step onto the portal
  // succeeds. Suppress the portal we just bumped into for one frame
  // so we don't infinitely re-warn until the load resolves.
  if (!ok) {
    state.blockedPortalIds.add(portal.id);
    void ensureMapLoaded(dest.mapId).catch(() => {});
  }
}

/**
 * Move the player to any map by id. Used by:
 *   - The portal `teleport()` helper above (with the portal's spawn coords).
 *   - The admin "Travel" picker (no coords → falls back to the map's
 *     `spawns.default`).
 *
 * Pass `opts.spawnTileX/spawnTileY` to land at a specific tile; omit to
 * use the map's `default` spawn from MAP_CATALOG. Throws nothing — if
 * the destination map isn't preloaded the call is a no-op (logs a
 * warning so the failure is debuggable).
 */
/**
 * 2026-05-12 — Lazy-load a map's SF data + tilesheet image into the
 * caches so a subsequent sync `teleportToMap()` succeeds. Idempotent —
 * both underlying loaders dedupe on cache hit. Returns true once the
 * map is ready (or already was), false on load failure.
 *
 * Used by the admin Travel modal so newly-authored maps (added after
 * the dev server's boot-time `preloadAssets()` ran) become reachable
 * without forcing a full page reload.
 */
export async function ensureMapLoaded(destId: string): Promise<boolean> {
  const jsonPath = mapJsonPath(destId);
  const sheetPath = mapTilesheetPath(destId);
  if (getMap(jsonPath) && getImage(sheetPath)) return true;
  try {
    await Promise.all([
      loadSpriteFusionMap(jsonPath, sheetPath),
      loadImage(sheetPath),
    ]);
    return !!getMap(jsonPath);
  } catch (err) {
    console.warn(`[ensureMapLoaded] "${destId}" failed:`, err);
    return false;
  }
}

export function teleportToMap(
  state: OverworldState,
  destId: string,
  opts: { spawnTileX?: number; spawnTileY?: number; facing?: 'up' | 'down' | 'left' | 'right' } = {},
): boolean {
  const destPath = mapJsonPath(destId);
  if (!getMap(destPath)) {
    console.warn(
      `[teleport] ABORTED: map "${destId}" not preloaded (${destPath}). ` +
      `preloadAssets() must run and succeed for every map in MAP_CATALOG.`,
    );
    return false;
  }
  if (!getImage(mapTilesheetPath(destId))) {
    console.warn(
      `[teleport] tilesheet "${mapTilesheetPath(destId)}" not in image cache — ` +
      `renderer will show a placeholder until it loads.`,
    );
  }

  // Resolve spawn: explicit coords win; otherwise fall back to the
  // destination map's default spawn from the catalog. Last resort is
  // (0, 0) — visible-but-edge so the player can immediately move off.
  const mapDef = MAP_CATALOG[destId];
  const defSpawn = mapDef?.spawns?.['default'];
  const tileX = opts.spawnTileX ?? defSpawn?.tileX ?? 0;
  const tileY = opts.spawnTileY ?? defSpawn?.tileY ?? 0;

  state.currentMapId = destId;
  state.npcStates = buildNpcStatesForMap(destId);
  state.animalStates = buildAnimalStatesForMap(destId);
  // Drop stale FX so grass tufts don't carry over from the previous scene.
  state.particles.length = 0;
  state.grassParticleCooldown = 0;
  state.playerX = tileX * TILE_SIZE;
  state.playerY = tileY * TILE_SIZE;
  // 2026-05-18 (v1.409) — Hitbox-aware spawn validation. NPCs are
  // rebuilt fresh from the destination map's definition at every
  // teleport, and `tileX/tileY` is just the map's catalog default
  // spawn (or a portal-provided coord); neither check the resulting
  // hitbox against the just-spawned NPC bodies. If an NPC happens to
  // sit at or near the spawn tile (Tomas in front of the Village Ruin
  // gate, the shopkeeper at the desert market entrance, etc.) the
  // player lands fully overlapped and slip+push fails because no
  // direction is clear. `findLoginSafePosition` is the same hitbox-
  // aware snapper the boot-time validator and the manual Unstuck
  // button use; running it once post-teleport eliminates the
  // map-transition stuck mode that drove most of the Discord
  // reports.
  try {
    const safe = findLoginSafePosition(destId, state.playerX, state.playerY, state.npcStates);
    if (safe.rescued) {
      console.warn(
        `[teleport] '${destId}' spawn (${tileX},${tileY}) overlapped NPC/blocker — snapped to safe pixel pos`,
      );
      state.playerX = safe.pixelX;
      state.playerY = safe.pixelY;
    }
  } catch (err) {
    console.warn('[teleport] post-teleport spawn validation failed; trusting raw spawn:', err);
  }
  state.direction = opts.facing ?? 'down';
  state.isMoving = false;
  state.walkFrame = 0;
  state.walkTimer = 0;
  state.interactingNpc = null;
  state.dialogueIndex = 0;
  state.facingRestorable = null;
  // v1.209 ? clear any in-flight tap-to-walk path. Without this, a path
  // whose route crossed the portal will persist after teleport, and the
  // pathfinder will steer the player straight back into the portal they
  // just used (since the target tile is still on the other side). That
  // produced the "stands on the portal and spins in circles" bug for
  // portal-8 (the intra-village teleport): tap somewhere across the
  // village, the route goes through portal-8, you teleport, and the
  // path immediately walks you back through it. Clearing the target
  // here ends the path on arrival at the new map and lets the player
  // re-tap if they want to keep going.
  state.pathTarget = null;
  state.pathStuckFrames = 0;
  // If the spawn tile itself sits inside a portal rect, suppress that portal
  // until the player physically walks off — otherwise we'd teleport right
  // back on the next tick.
  state.blockedPortalIds = portalIdsOverlappingPlayer(state);
  // v1.209 ? short global cooldown + spawn-distance guard after every
  // teleport. Same-map portals (e.g. portal-7 boat dock, portal-8
  // intra-village) place the spawn only 1 tile from the destination
  // rect; without this, holding ANY input direction that nudges the
  // player toward the destination rect re-triggers within 1-2 frames
  // and creates a visible spin/ping-pong. The cooldown gives the
  // player a brief window to release input; the spawn-distance guard
  // (read at trigger time) hard-blocks ALL portals until they've
  // moved at least 1 tile from where they spawned, which is naturally
  // input-direction-agnostic.
  state.postTeleportCooldown = 10;
  state.lastTeleportPos = { x: state.playerX, y: state.playerY };
  // Snap the camera to center the player on the new map instead of letting
  // the dead-zone follow slide the old camera across to the spawn.
  state.cameraX = undefined;
  state.cameraY = undefined;
  // v1.209 ? portal SFX. Lazy-imported to avoid a top-level circular
  // dep between Overworld + the audio module. Fire-and-forget.
  import('../../utils/bgm').then((m) => m.playSfx('teleport')).catch(() => {});
  return true;
}

export function updateOverworld(
  state: OverworldState,
  frameMul: number = 1,
): OverworldUpdateResult {
  const result: OverworldUpdateResult = {
    encounter: false,
    interactingNpc: null,
    dialogueIndex: state.dialogueIndex,
    autoUnstuckRescued: false,
    autoUnstuckTrapPx: null,
    autoUnstuckTrapPy: null,
    nearbyRestorable: null,
    openedRestorable: null,
    collectedPickup: null,
    utilityNpcOpened: null,
    openedSign: null,
    nearbySign: null,
    readingSign: null,
    signPageIdx: state.signPageIdx,
  };

  // Track proximity for the HUD "!" indicator every frame, even during dialogue.
  const nearby = getNearbyRestorable(state);
  result.nearbyRestorable = nearby;
  state.facingRestorable = nearby?.id ?? null;
  // World signs (canvas-drawn wooden plank). Same proximity model as
  // restorables — only fires the HUD prompt when the player is actually
  // adjacent + facing the sign tile, not from across the map.
  const nearbySign = getNearbyWorldSign(state);
  result.nearbySign = nearbySign;
  state.facingSign = nearbySign?.id ?? null;

  if (state.interactingNpc) {
    const npc = npcDefForRuntime(state.interactingNpc, state);
    // v1.250 — walk-away dismissal. Players reported dialogs (esp. Coach
    // Marek by the PvP gate) feeling "sticky" after a tap-walk-by: the
    // box would open and they'd have to mash the action key to escape.
    // Two escape hatches now end the conversation gracefully:
    //   1. Any movement intent (held direction key, virtual joystick drag,
    //      or a fresh tap-to-walk path) — close immediately and let the
    //      same frame process the movement normally.
    //   2. Distance fallback (~half a portrait screen / 6 tiles) — handles
    //      edge cases where the NPC wanders off, the player teleports, or
    //      somehow ends up far from whoever they were "talking to".
    const wantsMove =
      input.isDown('up') ||
      input.isDown('down') ||
      input.isDown('left') ||
      input.isDown('right') ||
      state.pathTarget !== null;
    let tooFar = false;
    if (npc) {
      const nrt = state.npcStates.find((n) => n.id === state.interactingNpc);
      if (nrt) {
        const dxN = nrt.x - state.playerX;
        const dyN = nrt.y - state.playerY;
        tooFar = Math.hypot(dxN, dyN) > TILE_SIZE * 6;
      }
    }
    if (!npc || wantsMove || tooFar) {
      // End the conversation and fall through to the normal update path
      // so this same frame can start moving / pathing / triggering portals.
      state.interactingNpc = null;
      state.dialogueIndex = 0;
    } else {
      result.interactingNpc = npc;
      result.dialogueIndex = state.dialogueIndex;
      if (input.wasPressed('action')) {
        state.dialogueIndex++;
        if (state.dialogueIndex >= npc.dialogue.length) {
          state.interactingNpc = null;
          state.dialogueIndex = 0;
          // Wipe any still-held keys so the player doesn't auto-walk off once
          // the dialogue dismisses (common when a direction key was held mid-talk
          // and its keyup slipped past the window listener).
          input.clear();
        }
        result.dialogueIndex = state.dialogueIndex;
      }
      return result;
    }
  }

  // World-sign reading lifecycle. Mirrors interactingNpc semantics so
  // signs feel exactly like NPC dialogue:
  // - Pressing A near a sign opens it (handled below) and sets
  //   state.readingSign + state.signPageIdx = 0.
  // - While readingSign is set: walking, holding any direction, starting
  //   a tap-to-walk path, or drifting > 6 tiles closes the sign.
  // - Pressing A advances signPageIdx; for image-popup signs (or past
  //   the last text page) it closes. The engine is the source of truth
  //   for page index — React renders result.signPageIdx so the dialogue
  //   UI advances exactly when the engine says so (same plumbing as
  //   dialogueIndex for NPCs).
  if (state.readingSign) {
    const sign = WORLD_SIGNS.find((s) => s.id === state.readingSign);
    let tooFar = false;
    if (sign) {
      const w = getSignWidth(sign.sprite);
      const sx = sign.tileX * TILE_SIZE + (w * TILE_SIZE) / 2;
      const sy = sign.tileY * TILE_SIZE + TILE_SIZE / 2;
      const pcx = state.playerX + TILE_SIZE / 2;
      const pcy = state.playerY + TILE_SIZE / 2;
      tooFar = Math.hypot(sx - pcx, sy - pcy) > TILE_SIZE * 6;
    }
    const wantsMove =
      input.isDown('up') ||
      input.isDown('down') ||
      input.isDown('left') ||
      input.isDown('right') ||
      state.pathTarget !== null;
    if (!sign || wantsMove || tooFar) {
      state.readingSign = null;
      state.signPageIdx = 0;
      // Fall through so the same frame can move / path / interact normally.
    } else if (input.wasPressed('action')) {
      // Advance or close per kind. Text-dialogue: advance until past the
      // last page, then close. Image-popup: any press closes (single
      // image, no pages).
      const isText = sign.kind === 'text-dialogue';
      const pages = isText ? (sign.text ?? []) : [];
      if (isText && state.signPageIdx < pages.length - 1) {
        state.signPageIdx++;
        result.readingSign = state.readingSign;
        result.signPageIdx = state.signPageIdx;
        input.clear();
        // Defensive: clear so a held key doesn't auto-step the player
        // off the sign on the next frame.
        return result;
      }
      // Otherwise — image-popup, or text past the last page — close.
      state.readingSign = null;
      state.signPageIdx = 0;
      input.clear();
      return result;
    } else {
      // Still reading, no input — just surface the current state.
      result.readingSign = state.readingSign;
      result.signPageIdx = state.signPageIdx;
      return result;
    }
  }

  if (input.wasPressed('action')) {
    const npcId = getFacingNpc(state);
    if (npcId) {
      const npc = npcDefForRuntime(npcId, state);
      if (npc && isUtilityKind(npc.kind)) {
        // Utility NPC — skip dialogue entirely so the modal opens on the
        // very first tap. WorldTab routes utilityNpcOpened through the
        // same dispatch as dialogue-end.
        const utilNrt = state.npcStates.find((n) => n.id === npcId);
        if (utilNrt) turnNpcToFacePlayer(utilNrt, state);
        result.utilityNpcOpened = npcId;
        input.clear();
        return result;
      }
      state.interactingNpc = npcId;
      state.dialogueIndex = 0;
      result.interactingNpc = npc!;
      result.dialogueIndex = 0;
      // Turn the NPC to face the player so dialogue isn't delivered to
      // the back of their head.
      const nrt = state.npcStates.find((n) => n.id === npcId);
      if (nrt) turnNpcToFacePlayer(nrt, state);
      // Same defensive clear on dialogue START — prevents the first action press
      // from "double-firing" into both opening dialogue and advancing a line.
      input.clear();
      return result;
    }
    // No NPC to talk to but a restorable is within range → open the restoration modal.
    if (nearby) {
      result.openedRestorable = nearby.id;
      input.clear();
      return result;
    }
    // World sign within range — open whatever modal its kind maps to
    // (e.g. dojo flier). Same precedence as restorables: NPCs win,
    // restorables next, signs last so a sign placed near an NPC never
    // shadows the NPC interaction.
    if (nearbySign) {
      result.openedSign = nearbySign.id;
      state.readingSign = nearbySign.id;
      state.signPageIdx = 0;
      result.readingSign = nearbySign.id;
      result.signPageIdx = 0;
      input.clear();
      return result;
    }
  }

  for (const nrt of state.npcStates) {
    updateNpcWander(nrt, state);
  }
  for (const art of state.animalStates) {
    updateAnimalWander(art, state);
  }

  // Read axis input. Holding two perpendicular keys produces a diagonal.
  let ix = 0, iy = 0;
  if (input.isDown('up')) iy -= 1;
  if (input.isDown('down')) iy += 1;
  if (input.isDown('left')) ix -= 1;
  if (input.isDown('right')) ix += 1;

  // Tap-to-navigate: walk the waypoint list (computed by A*), then close the
  // last leg to (pathTarget.x, pathTarget.y). Keyboard input always wins and
  // cancels the path.
  const ARRIVE_DIST = TILE_SIZE * 0.35;
  // Waypoints sit at tile centers, so a generous arrival radius (≈ half a
  // tile) is fine — once we're inside the next tile we pop and steer toward
  // the one after so the player keeps flowing instead of stopping at every
  // grid node.
  const WAYPOINT_ARRIVE_DIST = TILE_SIZE * 0.5;
  if ((ix !== 0 || iy !== 0) && state.pathTarget) {
    state.pathTarget = null;
    state.pathStuckFrames = 0;
  } else if (state.pathTarget) {
    const pcx = state.playerX + TILE_SIZE / 2;
    const pcy = state.playerY + TILE_SIZE / 2;

    // Pop any waypoints we're already on (e.g., the path's first non-start
    // tile coincides with the player's current tile because the click was
    // close).
    while (state.pathTarget.waypoints.length > 0) {
      const wp = state.pathTarget.waypoints[0]!;
      const wddx = wp.x - pcx;
      const wddy = wp.y - pcy;
      if (Math.hypot(wddx, wddy) <= WAYPOINT_ARRIVE_DIST) {
        state.pathTarget.waypoints.shift();
      } else {
        break;
      }
    }

    // Steer toward the next live waypoint, or the final goal if all consumed.
    const next = state.pathTarget.waypoints[0];
    const targetX = next ? next.x : state.pathTarget.x;
    const targetY = next ? next.y : state.pathTarget.y;
    const ddx = targetX - pcx;
    const ddy = targetY - pcy;
    const dist = Math.hypot(ddx, ddy);
    const arriveDist = next ? WAYPOINT_ARRIVE_DIST : ARRIVE_DIST;
    if (dist <= arriveDist) {
      if (next) {
        state.pathTarget.waypoints.shift();
        state.pathStuckFrames = 0;
      } else {
        const pt = state.pathTarget;
        state.pathTarget = null;
        state.pathStuckFrames = 0;
        if (pt.action === 'talk' && pt.npcId) {
          const nrt = state.npcStates.find((n) => n.id === pt.npcId);
          if (nrt) {
            const fdx = (nrt.x + TILE_SIZE / 2) - pcx;
            const fdy = (nrt.y + TILE_SIZE / 2) - pcy;
            state.direction = Math.abs(fdx) > Math.abs(fdy)
              ? (fdx > 0 ? 'right' : 'left')
              : (fdy > 0 ? 'down' : 'up');
          }
          const npc = npcDefForRuntime(pt.npcId, state);
          if (npc && isUtilityKind(npc.kind)) {
            // Utility NPC — bypass dialogue, open the modal on arrival.
            if (nrt) turnNpcToFacePlayer(nrt, state);
            result.utilityNpcOpened = pt.npcId;
            state.isMoving = false;
            return result;
          }
          state.interactingNpc = pt.npcId;
          state.dialogueIndex = 0;
          if (npc) {
            result.interactingNpc = npc;
            result.dialogueIndex = 0;
          }
          // Match the A-press path: turn the NPC to face the player on
          // arrival so click-to-walk and A-press both feel the same.
          if (nrt) turnNpcToFacePlayer(nrt, state);
          state.isMoving = false;
          return result;
        }
        if (pt.action === 'restorable' && pt.buildingId) {
          result.openedRestorable = pt.buildingId;
          state.isMoving = false;
          return result;
        }
        if (pt.action === 'sign' && pt.signId) {
          // Face the sign on arrival (use the center of the full footprint
          // for wide signs so the player aims at the middle, not the
          // anchor) — mirrors the 'talk' branch above.
          const sign = WORLD_SIGNS.find((s) => s.id === pt.signId);
          if (sign) {
            const w = getSignWidth(sign.sprite);
            const cx = sign.tileX * TILE_SIZE + (w * TILE_SIZE) / 2;
            const cy = sign.tileY * TILE_SIZE + TILE_SIZE / 2;
            const fdx = cx - pcx;
            const fdy = cy - pcy;
            state.direction = Math.abs(fdx) > Math.abs(fdy)
              ? (fdx > 0 ? 'right' : 'left')
              : (fdy > 0 ? 'down' : 'up');
          }
          // Mark the engine as actively reading + fire the opened event so
          // WorldTab's handleOpenSign opens the matching popup. Mirrors the
          // A-press path so click-to-walk and A-press are identical.
          state.readingSign = pt.signId;
          state.signPageIdx = 0;
          result.readingSign = pt.signId;
          result.signPageIdx = 0;
          result.openedSign = pt.signId;
          state.isMoving = false;
          return result;
        }
      }
    } else {
      ix = ddx / dist;
      iy = ddy / dist;
    }
  }

  let moved = false;
  if (ix !== 0 || iy !== 0) {
    // Normalize so diagonal movement doesn't double the travel speed.
    // MOVE_SPEED is pixels-per-60fps-frame; multiply by frameMul so a
    // 30fps device covers double the pixels per tick (matching real
    // walk speed) and a 120Hz device halves them (no warp-speed PC).
    const mag = Math.hypot(ix, iy);
    const speed = MOVE_SPEED * frameMul;
    const dx = (ix / mag) * speed;
    const dy = (iy / mag) * speed;

    // Face whichever axis has the bigger component. For keyboard, ix/iy
    // are 0 or ±1 so this is the same as "horizontal wins on diagonal".
    // For pathing, ix/iy are normalized floats — the old `ix !== 0` test
    // was almost always true (tiny float fractions on a "vertical" move),
    // so the player faced left/right the whole way to a click. Comparing
    // magnitudes picks up/down when the path is mostly vertical.
    if (Math.abs(ix) >= Math.abs(iy)) state.direction = ix > 0 ? 'right' : 'left';
    else state.direction = iy > 0 ? 'down' : 'up';

    // Resolve each axis independently so running into a wall at an angle
    // slides along it instead of stopping the full move. If a straight
    // same-axis move is blocked, try auto-slipping a few pixels perpendicular
    // to clear small bumps (e.g. a 3px dip in a building sprite). If even
    // that fails AND the obstacle is an NPC, try to push them aside so we
    // don't permanently stall against a wandering villager.
    if (dx !== 0) {
      let slip = findPerpendicularSlip(state, dx, 0);
      if (slip === null) {
        const blocker = findCollidingNpc(state, dx, 0);
        if (blocker && tryPushNpcAside(blocker, state)) {
          slip = findPerpendicularSlip(state, dx, 0);
        }
      }
      if (slip !== null) {
        state.playerX += dx;
        state.playerY += slip;
        moved = true;
      }
    }
    if (dy !== 0) {
      let slip = findPerpendicularSlip(state, 0, dy);
      if (slip === null) {
        const blocker = findCollidingNpc(state, 0, dy);
        if (blocker && tryPushNpcAside(blocker, state)) {
          slip = findPerpendicularSlip(state, 0, dy);
        }
      }
      if (slip !== null) {
        state.playerX += slip;
        state.playerY += dy;
        moved = true;
      }
    }
  }

  state.isMoving = moved;

  // 2026-05-18 (v1.409) — Auto-unstuck rescue. If the player has been
  // trying to move (any direction held, joystick active, OR a tap-path
  // is in flight) but their position hasn't actually changed for
  // STUCK_AUTO_RESCUE_FRAMES consecutive frames, they're soft-locked
  // against an NPC/blocker/hitbox overlap that the slip + push paths
  // above couldn't resolve. Auto-fire findLoginSafePosition so the
  // player doesn't have to dig into the More menu for the Unstuck
  // button — most players never find it, exit the game instead, and
  // bounce. Reported repeatedly on Discord, most recently by PsycoKai
  // ("character gets stuck, have to exit the game"); plec's reply
  // acknowledged it's "a bug that keeps re-appearing."
  //
  // Why "trying to move" matters as the gate: standing still with no
  // input is the resting state and should never trigger a rescue.
  // Holding a direction (or having a path) for 60+ frames with no
  // movement is unambiguous proof the player is jammed.
  const wantsToMove = ix !== 0 || iy !== 0 || state.pathTarget !== null;
  if (wantsToMove && !moved) {
    state.stuckFrames++;
    if (state.stuckFrames >= STUCK_AUTO_RESCUE_FRAMES) {
      try {
        const safe = findLoginSafePosition(
          state.currentMapId,
          state.playerX,
          state.playerY,
          state.npcStates,
        );
        if (safe.rescued) {
          // Stamp the trap coords BEFORE the snap overwrites them so
          // the React-side analytics emission can ship the actual
          // pinned-against-blocker position. See OverworldStepResult
          // for context.
          result.autoUnstuckTrapPx = state.playerX;
          result.autoUnstuckTrapPy = state.playerY;
          state.playerX = safe.pixelX;
          state.playerY = safe.pixelY;
          // Cancel any in-flight tap-path so the rescue snap isn't
          // immediately re-pathed back into whatever pinned us.
          state.pathTarget = null;
          state.pathStuckFrames = 0;
          result.autoUnstuckRescued = true;
          console.warn(
            `[overworld] auto-unstuck fired on '${state.currentMapId}' after ${state.stuckFrames} blocked frames`,
          );
          // 2026-05-18 (v1.411) — Catastrophic-map escalation.
          // DrVirjinity reported the v1.409 auto-unstuck snapping
          // them from one out-of-bounds spot to another. The v1.411
          // reachability fix in findLoginSafePosition closes the
          // void-snap path, but if the CURRENT map's reachable set
          // is empty (corrupt content, broken default spawn, or a
          // map that loaded partially) the snap result would be
          // the spawn pixel coords on top of an unreachable tile.
          // Detect that case and escalate by teleporting to
          // villageruin — guaranteed-good map per the manual
          // Unstuck button's existing fallback. Same UX DrVirjinity
          // asked for: "unstuck to starting area worked well before
          // fyi, maybe both options would be good."
          const postSnapMap = getMap(mapJsonPath(state.currentMapId));
          if (postSnapMap) {
            const postSnapTx = Math.floor((state.playerX + TILE_SIZE / 2) / TILE_SIZE);
            const postSnapTy = Math.floor((state.playerY + TILE_SIZE / 2) / TILE_SIZE);
            const reachable = computeReachableFromSpawn(state.currentMapId, postSnapMap);
            const stillStuck = reachable.size === 0 || !reachable.has(`${postSnapTx},${postSnapTy}`);
            if (stillStuck && state.currentMapId !== 'villageruin') {
              console.warn(
                `[overworld] post-snap still on unreachable tile (${postSnapTx},${postSnapTy}) on '${state.currentMapId}' — escalating to villageruin warp`,
              );
              teleportToMap(state, 'villageruin');
            }
          }
        }
      } catch (err) {
        console.warn('[overworld] auto-unstuck rescue failed:', err);
      }
      state.stuckFrames = 0;
    }
  } else {
    state.stuckFrames = 0;
  }

  // Quest gate proximity toast: when the player enters the inflated rect
  // around an active gated door, fire the "sealed" toast on the rising
  // edge. Walking out of the zone clears it; walking back in re-arms.
  // Done after move resolution so the player's position is final.
  const nearbyGateId = findActiveGateNearby(state);
  if (nearbyGateId !== state.bumpedGateId) {
    if (nearbyGateId) {
      const portal = getPortals().find((p) => p.id === nearbyGateId);
      const gate = portal?.gate;
      if (gate && typeof window !== 'undefined') {
        const missing = gate.requiredTrainerDefeats.filter((id) => !state.trainerDefeats.has(id));
        window.dispatchEvent(new CustomEvent('picmon:portal-blocked', {
          detail: { portalId: nearbyGateId, message: gate.blockedMessage ?? 'This way is sealed.', missing },
        }));
      }
    }
    state.bumpedGateId = nearbyGateId;
  }

  // Bail on a stuck tap-path so the player isn't frozen against a wall.
  if (state.pathTarget) {
    state.pathStuckFrames = moved ? 0 : state.pathStuckFrames + 1;
    if (state.pathStuckFrames > 12) {
      state.pathTarget = null;
      state.pathStuckFrames = 0;
    }
  }

  if (moved) {
    state.walkTimer++;
    if (state.walkTimer >= 10) {
      state.walkTimer = 0;
      state.walkFrame = (state.walkFrame + 1) % 4;
    }

    const map = getMap(mapJsonPath(state.currentMapId));
    if (map) {
      const playerRect = getPlayerHitbox(state);
      const centerCol = Math.floor((state.playerX + TILE_SIZE / 2) / TILE_SIZE);
      const centerRow = Math.floor((state.playerY + TILE_SIZE / 2) / TILE_SIZE);
      // v1.250 — Decrement post-battle encounter cooldown every frame
      // so it ticks down even while the player is standing still.
      if (state.postBattleEncounterCooldown > 0) {
        state.postBattleEncounterCooldown = Math.max(
          0,
          state.postBattleEncounterCooldown - frameMul,
        );
      }
      // v1.219 — Clear the post-battle safe tile as soon as the
      // player has moved off it. Done here (inside the `moved`
      // block + after we already have centerCol/centerRow) so the
      // bookkeeping stays cheap and runs at most once per frame.
      if (state.postBattleSafeTile) {
        if (state.postBattleSafeTile.col !== centerCol
            || state.postBattleSafeTile.row !== centerRow) {
          state.postBattleSafeTile = null;
        }
      }
      if (isTallGrassAt(map, centerCol, centerRow)) {
        const tileRect = getTileRect(centerCol, centerRow);
        const overlap = overlapArea(playerRect, tileRect);
        const playerArea = PLAYER_HITBOX * PLAYER_HITBOX;
        if (overlap > playerArea * 0.5) {
          // Skip the roll while EITHER guard is active:
          //   • postBattleEncounterCooldown — time-based 3s grace.
          //   • postBattleSafeTile — tile-gated guard. Suppresses
          //     encounters as long as the player is still on the
          //     tile they fought on. Without this, a player wedged
          //     against an NPC in tall grass could outlast the
          //     time-based cooldown via slip-shuffle and immediately
          //     re-trigger on the very next eligible frame, looping
          //     forever (Barker bug, v1.219).
          const onSafeTile = !!state.postBattleSafeTile
            && state.postBattleSafeTile.col === centerCol
            && state.postBattleSafeTile.row === centerRow;
          if (state.postBattleEncounterCooldown <= 0
              && !onSafeTile
              && Math.random() < ENCOUNTER_RATE * frameMul) {
            result.encounter = true;
            // Cancel any in-flight click-to-walk path. Without this, the
            // mover resumes the saved path the instant the battle ends —
            // and if the path is wedged against a blocker (a tree edge,
            // an NPC who shuffled into the way), the player slip-shuffles
            // back into the same grass tile and re-triggers another
            // encounter on the next eligible frame. Path is one-shot
            // intent; getting yanked into battle invalidates it.
            state.pathTarget = null;
            state.pathStuckFrames = 0;
          }
          // Grass-tuft fountain: emit every few frames so a steady walk
          // produces a continuous spray at the player's feet. Spawn at
          // the foot with a small random horizontal offset so stream
          // doesn't look like a single column.
          if (state.grassParticleCooldown <= 0) {
            const footX = state.playerX + TILE_SIZE / 2 + (Math.random() - 0.5) * 10;
            const footY = state.playerY + TILE_SIZE - 6;
            spawnGrassParticle(state.particles, footX, footY);
            state.grassParticleCooldown = 6; // ~10 particles/sec at 60fps
          }
        }
      }

      // Pickup detection — stepping onto a pickup tile collects it. Uses the
      // resolved positions so any pickup authored on a blocker tile has been
      // snapped to the nearest walkable tile.
      const resolved = getResolvedPickups(map, state.currentMapId);
      for (const p of resolved.values()) {
        if (state.collectedPickups.has(p.id)) continue;
        if (p.tileX === centerCol && p.tileY === centerRow) {
          state.collectedPickups.add(p.id);
          result.collectedPickup = p;
          break;
        }
      }
    }
  } else {
    state.walkFrame = 0;
    state.walkTimer = 0;
  }

  // ── Portal triggers ──
  // v1.209 ? global post-teleport debounce. Always decrement first so
  // the cooldown lifts even if the player isn't moving.
  if (state.postTeleportCooldown > 0) state.postTeleportCooldown--;
  // Clear any blocked portal the player has now physically walked off of,
  // then trigger the first portal they're still standing inside.
  const nowOverlapping = portalIdsOverlappingPlayer(state);
  for (const id of Array.from(state.blockedPortalIds)) {
    if (!nowOverlapping.has(id)) state.blockedPortalIds.delete(id);
  }
  // While the post-teleport debounce is active, skip ALL portal triggers ?
  // not just the just-used one. That handles the same-map ping-pong case
  // where holding input would otherwise instantly fire the destination
  // half on the very next frame.
  // Additionally, even after the time cooldown lifts, require the player
  // to have physically moved >= 1 tile from where they spawned before any
  // portal can fire. This is the input-direction-agnostic guarantee that
  // kills the spin-on-portal bug for portal-7 (boat dock), portal-8
  // (intra-village), and anything else with a spawn placed adjacent to
  // its destination rect.
  let movedFarEnough = true;
  if (state.lastTeleportPos) {
    const dx = state.playerX - state.lastTeleportPos.x;
    const dy = state.playerY - state.lastTeleportPos.y;
    if (Math.hypot(dx, dy) < TILE_SIZE) movedFarEnough = false;
    else state.lastTeleportPos = null; // grace satisfied; clear so we don't re-check forever
  }
  if (state.postTeleportCooldown === 0 && movedFarEnough) {
  // v1.700 — Tower-run floor lock. If the player has an active tower
  // run AND is currently on a tower-arena map, suppress ALL portal
  // triggers so they can't skip floors by walking through inter-arena
  // doorways. The only legitimate exits are winning the floor (which
  // teleports programmatically via handleTowerBattleEnd → teleportToMap)
  // or wiping (also programmatic). Lobby maps are unaffected — the
  // player can still enter/leave the tower normally outside a run.
  const towerArenaLocked = state.towerRunActive
    && typeof state.currentMapId === 'string'
    && state.currentMapId.startsWith('trainertowerarena');
  if (towerArenaLocked) {
    // Locked — fire a hint toast on rising edge so the player knows
    // why nothing happens when they step on the doorway. Uses the
    // same `picmon:portal-blocked` event the quest-gate banner
    // listens for, so no extra wiring in WorldTab is needed.
    let bumped: string | null = null;
    for (const p of getPortals()) {
      if (!nowOverlapping.has(p.id)) continue;
      if (!isPortalVisibleToCurrentPlayer(p, state.currentMapId)) continue;
      if (!sideOverlappingOnCurrentMap(state, p)) continue;
      bumped = p.id;
      break;
    }
    if (bumped !== state.bumpedTowerLockedPortalId) {
      if (bumped && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('picmon:portal-blocked', {
          detail: {
            portalId: bumped,
            message: 'Defeat the Tower Challenger to advance.',
            missing: [],
          },
        }));
      }
      state.bumpedTowerLockedPortalId = bumped;
    }
  } else {
    // Not locked — clear the rising-edge tracker so the toast re-arms
    // for the next active-run session.
    if (state.bumpedTowerLockedPortalId !== null) {
      state.bumpedTowerLockedPortalId = null;
    }
    for (const p of getPortals()) {
      if (state.blockedPortalIds.has(p.id)) continue;
      if (!nowOverlapping.has(p.id)) continue;
      if (!isPortalVisibleToCurrentPlayer(p, state.currentMapId)) continue;
      const side = sideOverlappingOnCurrentMap(state, p);
      if (!side) continue;
      // Active gates make the rect physically solid (see playerCircleCollides
      // → playerCollidesActiveGate), so reaching this loop means the gate is
      // already cleared OR there is no gate. Either way: teleport.
      teleport(state, p, side);
      break;
    }
  } // end tower-arena lock gate
  } // end post-teleport cooldown gate

  // Advance transient FX last — particles keep ticking (gravity, animation)
  // even while the player stands still, so an in-flight tuft completes its
  // break-up instead of freezing mid-air.
  updateParticles(state.particles);
  if (state.grassParticleCooldown > 0) state.grassParticleCooldown--;

  return result;
}

// ── Portal helpers ──
function halfWorldRect(half: PortalHalf): Rect {
  return {
    x: half.rect.tileX * TILE_SIZE,
    y: half.rect.tileY * TILE_SIZE,
    width: half.rect.w * TILE_SIZE,
    height: half.rect.h * TILE_SIZE,
  };
}

/** v1.250 — Inset portal rect used ONLY for teleport-trigger detection.
 *  Players reported the doorway hitbox felt "eager on the outside" —
 *  they'd brush against the edge of a doorway tile and immediately
 *  warp through. Shrinking the trigger rect by PORTAL_TRIGGER_INSET
 *  pixels on every side requires the player's hitbox to actually be
 *  more meaningfully inside the door before it fires. We keep the
 *  full rect for visualization, sealed-toast proximity, and gate-
 *  block detection so those still feel responsive. */
const PORTAL_TRIGGER_INSET = 4;
function halfWorldTriggerRect(half: PortalHalf): Rect {
  const r = halfWorldRect(half);
  // Don't shrink below 1px — a 1×1-tile portal still has 16 - 8 = 8px
  // of trigger area which is plenty given the player hitbox is ~16px.
  const inset = Math.min(PORTAL_TRIGGER_INSET, Math.floor(r.width / 4), Math.floor(r.height / 4));
  return {
    x: r.x + inset,
    y: r.y + inset,
    width: Math.max(1, r.width - inset * 2),
    height: Math.max(1, r.height - inset * 2),
  };
}

function portalIdsOverlappingPlayer(state: OverworldState): Set<string> {
  const out = new Set<string>();
  const pRect = getPlayerHitbox(state);
  for (const p of getPortals()) {
    const aHit = p.a.mapId === state.currentMapId && rectsOverlap(pRect, halfWorldTriggerRect(p.a));
    const bHit = p.b.mapId === state.currentMapId && rectsOverlap(pRect, halfWorldTriggerRect(p.b));
    if (aHit || bHit) out.add(p.id);
  }
  return out;
}

function sideOverlappingOnCurrentMap(state: OverworldState, p: Portal): 'a' | 'b' | null {
  const pRect = getPlayerHitbox(state);
  if (p.a.mapId === state.currentMapId && rectsOverlap(pRect, halfWorldTriggerRect(p.a))) return 'a';
  if (p.b.mapId === state.currentMapId && rectsOverlap(pRect, halfWorldTriggerRect(p.b))) return 'b';
  return null;
}

// ════════════════════════════════════════════
// RENDERING
// ════════════════════════════════════════════

/**
 * Redraw tall-grass tiles on top of any character whose feet are standing
 * in tall grass, clipped to the bottom half of the character's sprite rect.
 * The tile art is rendered at its normal world position, so the grass
 * blades visually overlap the character's lower body.
 */
function drawTallGrassOverlay(
  ctx: CanvasRenderingContext2D,
  map: SFMap,
  tilesheet: HTMLImageElement,
  tilesheetCols: number,
  srcTileSize: number,
  characters: { x: number; y: number }[],
) {
  // A narrow strip at the very bottom-center of the character sprite. The
  // overlay only triggers when this strip overlaps OPAQUE pixels of the tall
  // grass tile — same alpha-mask test as the collision code — so the
  // character has to actually be standing on grass blades, not just sharing
  // a cell with a sparsely-painted grass tile.
  const FOOT_W = 16;
  const FOOT_H = 6;

  for (const c of characters) {
    const footX = c.x + (TILE_SIZE - FOOT_W) / 2;
    const footY = c.y + TILE_SIZE - FOOT_H;
    if (!rectOverlapsTallGrass(map, TILE_SIZE, footX, footY, FOOT_W, FOOT_H)) continue;

    // Match drawCharSprite's Math.round on the character position. Without
    // this, a fractional c.y (e.g. mid-step at 100.6) renders the sprite
    // at row 101 but builds a clip whose bottom edge is at 148.6 — one
    // pixel short of the sprite's actual bottom row (149), leaving a thin
    // horizontal sliver of the sprite uncovered by the grass overlay.
    const renderX = Math.round(c.x);
    const renderY = Math.round(c.y);

    // Clip subsequent draws to the bottom ~25% of the character's sprite
    // rect — just the feet/shins, so the character mostly shows through the
    // grass instead of being half-covered.
    const clipX = renderX;
    const clipH = Math.round(TILE_SIZE * 0.25);
    const clipY = renderY + TILE_SIZE - clipH;
    const clipW = TILE_SIZE;

    ctx.save();
    ctx.beginPath();
    ctx.rect(clipX, clipY, clipW, clipH);
    ctx.clip();

    // Redraw any tall-grass tile overlapping the character's sprite rect.
    // Character sprite can straddle two tiles when moving between cells.
    // ty1 extends one row past the apparent bottom so that even when the
    // sprite renders into the next tile cell (rounding pushes it down a
    // pixel), the next-cell's grass tile — if any — covers that pixel.
    const tx0 = Math.floor(renderX / TILE_SIZE);
    const tx1 = Math.floor((renderX + TILE_SIZE - 1) / TILE_SIZE);
    const ty0 = Math.floor((renderY + TILE_SIZE / 2) / TILE_SIZE);
    const ty1 = Math.floor((renderY + TILE_SIZE) / TILE_SIZE);

    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const id = tallGrassTileIdAt(map, tx, ty);
        if (id === undefined) continue;
        const { sx, sy } = tileSrcXY(String(id), tilesheetCols, srcTileSize);
        ctx.drawImage(
          tilesheet,
          sx,
          sy,
          srcTileSize,
          srcTileSize,
          tx * TILE_SIZE,
          ty * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE,
        );
      }
    }

    ctx.restore();
  }
}

/**
 * Per-pixel bush/flower occlusion: for each character, sample the alpha of
 * whichever bushes_flowers tile sits at their bottom-center pixel. If that
 * exact pixel is opaque art (not one of the many transparent pixels in a
 * flower/bush tile), redraw the tile on top of the character. Otherwise
 * the character stays visible in front of the bush.
 *
 * Reuses the tile opacity masks built by the SpriteFusion loader for
 * collision, so no extra ImageData plumbing is needed here.
 */
function drawBushOpacityOverlay(
  ctx: CanvasRenderingContext2D,
  map: SFMap,
  tilesheet: HTMLImageElement,
  tilesheetCols: number,
  srcTileSize: number,
  characters: { x: number; y: number }[],
) {
  const bushLayer = map.data.layers.find((l) => l.name === 'bushes_flowers');
  if (!bushLayer || bushLayer.tiles.length === 0) return;

  for (const c of characters) {
    // Foot point = bottom-center pixel of the character sprite. Simple,
    // pixel-accurate, no guessing at a foot rectangle.
    const footX = c.x + TILE_SIZE / 2;
    const footY = c.y + TILE_SIZE - 1;
    const tx = Math.floor(footX / TILE_SIZE);
    const ty = Math.floor(footY / TILE_SIZE);

    const tile = bushLayer.tiles.find((t) => t.x === tx && t.y === ty);
    if (!tile) continue;

    const tileId = parseInt(tile.id, 10);
    if (map.emptyIds.has(tileId)) continue;
    const mask = map.tileMasks.get(tileId);
    if (!mask) continue;

    // World pixel → tile-local world pixel → source pixel (tile art is 16px
    // wide upscaled to 48px world, so divide by the 3× ratio).
    const localX = footX - tx * TILE_SIZE;
    const localY = footY - ty * TILE_SIZE;
    const sx = Math.floor((localX * srcTileSize) / TILE_SIZE);
    const sy = Math.floor((localY * srcTileSize) / TILE_SIZE);
    if (sx < 0 || sx >= srcTileSize || sy < 0 || sy >= srcTileSize) continue;

    if (mask[sy * srcTileSize + sx] === 0) continue;

    // Opaque pixel → bush wins. Redraw the tile at its world position on
    // top of whatever the character drew.
    const src = tileSrcXY(tile.id, tilesheetCols, srcTileSize);
    ctx.drawImage(
      tilesheet,
      src.sx,
      src.sy,
      srcTileSize,
      srcTileSize,
      tx * TILE_SIZE,
      ty * TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE,
    );
  }
}

// Draw all tiles in a given layer that fall inside the visible rect.
function drawLayer(
  ctx: CanvasRenderingContext2D,
  tilesheet: HTMLImageElement,
  tilesheetCols: number,
  srcTileSize: number,
  L: SFLayer,
  camX: number,
  camY: number,
  canvasWidth: number,
  canvasHeight: number,
) {
  for (const t of L.tiles) {
    const dx = t.x * TILE_SIZE;
    const dy = t.y * TILE_SIZE;
    if (dx + TILE_SIZE < camX || dx > camX + canvasWidth) continue;
    if (dy + TILE_SIZE < camY || dy > camY + canvasHeight) continue;
    const { sx, sy } = tileSrcXY(t.id, tilesheetCols, srcTileSize);
    ctx.drawImage(tilesheet, sx, sy, srcTileSize, srcTileSize, dx, dy, TILE_SIZE, TILE_SIZE);
  }
}

/** Draw one object placement at its current animation frame, viewport-
 *  culled. Shared by the under/sort/overlay passes — the only difference
 *  between them is WHEN we call this (relative to characters / overlay
 *  layer), so the body lives in one place. Frame size is per-image
 *  (resolved from the manifest); placements are bottom-centered on their
 *  tile so a 10×8 flower sits on the ground rather than floating in the
 *  top-left of a 48×48 tile. */
function drawObject(
  ctx: CanvasRenderingContext2D,
  o: ObjectRuntimeDef,
  tick: number,
  camX: number,
  camY: number,
  canvasWidth: number,
  canvasHeight: number,
) {
  const { dx, dy, dw, dh } = objectDrawRect(o.tileX, o.tileY, o.offsetX, o.offsetY, o.frameW, o.frameH);
  if (dx + dw < camX || dx > camX + canvasWidth) return;
  if (dy + dh < camY || dy > camY + canvasHeight) return;
  const img = getImage(o.image);
  if (!img) return; // not loaded yet — next preload pass will catch it
  const frameCount = Math.max(1, Math.floor(img.naturalWidth / o.frameW));
  const frame = (tick + o.phaseSeed) % frameCount;
  ctx.drawImage(img, frame * o.frameW, 0, o.frameW, o.frameH, dx, dy, dw, dh);
}

// Camera dead zone — the player can roam within this centered rectangle
// without the camera scrolling. Only when they push past its edge does the
// camera follow, pinning them to that edge. Stops the whole screen from
// lurching back and forth when the player paces a tiny area (e.g. shuffling
// across a single bush), a known nausea trigger. Half-extents are a fraction
// of the viewport so the feel scales with screen size.
const CAMERA_DEADZONE_HALF_FRAC_X = 0.1;
const CAMERA_DEADZONE_HALF_FRAC_Y = 0.1;

/**
 * Resolve the camera top-left (world px) for this frame and persist it onto
 * state.cameraX/cameraY. Applies a centered dead zone (frame-to-frame memory
 * via the stored camera) then clamps to the map bounds, snapping to whole
 * pixels so tile seams don't appear.
 *
 * - Maps smaller than the viewport are centered and never scroll.
 * - `state.cameraX === undefined` snaps the camera to center the player (used
 *   after teleport / map load so the new map doesn't slide into view).
 *
 * Idempotent within a frame: calling it again with the same player position
 * leaves the camera unchanged, so it's safe to resolve once up-front (for FX
 * that run before the render) and again inside renderOverworld.
 */
export function resolveCamera(
  state: OverworldState,
  canvasWidth: number,
  canvasHeight: number,
  worldPxW: number,
  worldPxH: number,
): { camX: number; camY: number } {
  const smallX = worldPxW < canvasWidth;
  const smallY = worldPxH < canvasHeight;
  const playerCx = state.playerX + TILE_SIZE / 2;
  const playerCy = state.playerY + TILE_SIZE / 2;

  let camX: number;
  if (smallX) {
    camX = Math.round(-(canvasWidth - worldPxW) / 2);
  } else if (state.cameraX === undefined) {
    camX = Math.round(Math.max(0, Math.min(playerCx - canvasWidth / 2, worldPxW - canvasWidth)));
  } else {
    const half = canvasWidth * CAMERA_DEADZONE_HALF_FRAC_X;
    const rel = playerCx - (state.cameraX + canvasWidth / 2);
    let next = state.cameraX;
    if (rel > half) next += rel - half;
    else if (rel < -half) next += rel + half;
    camX = Math.round(Math.max(0, Math.min(next, worldPxW - canvasWidth)));
  }

  let camY: number;
  if (smallY) {
    camY = Math.round(-(canvasHeight - worldPxH) / 2);
  } else if (state.cameraY === undefined) {
    camY = Math.round(Math.max(0, Math.min(playerCy - canvasHeight / 2, worldPxH - canvasHeight)));
  } else {
    const half = canvasHeight * CAMERA_DEADZONE_HALF_FRAC_Y;
    const rel = playerCy - (state.cameraY + canvasHeight / 2);
    let next = state.cameraY;
    if (rel > half) next += rel - half;
    else if (rel < -half) next += rel + half;
    camY = Math.round(Math.max(0, Math.min(next, worldPxH - canvasHeight)));
  }

  state.cameraX = camX;
  state.cameraY = camY;
  return { camX, camY };
}

export function renderOverworld(
  ctx: CanvasRenderingContext2D,
  state: OverworldState,
  canvasWidth: number,
  canvasHeight: number,
  frameCount: number,
  mapOverride?: SFMap,
  npcsOverride?: NpcDef[],
  tilesheetPathOverride?: string,
) {
  // Normal gameplay looks up by state.currentMapId. Building interiors pass
  // an override map (+ its tilesheet path, because interior JSONs often share
  // a parent-area tilesheet and so don't follow the mapId → tilesheet-path
  // convention).
  const map = mapOverride ?? getMap(mapJsonPath(state.currentMapId));
  const tilesheet = getImage(tilesheetPathOverride ?? mapTilesheetPath(state.currentMapId));

  // World dimensions derive from the loaded map so resizing in Sprite Fusion
  // just works. Fall back to viewport size before the map finishes loading.
  const worldPxW = map ? map.data.mapWidth * TILE_SIZE : canvasWidth;
  const worldPxH = map ? map.data.mapHeight * TILE_SIZE : canvasHeight;
  const { camX, camY } = resolveCamera(state, canvasWidth, canvasHeight, worldPxW, worldPxH);

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.save();
  ctx.translate(-camX, -camY);

  if (map && tilesheet) {
    const srcTileSize = map.data.tileSize;
    const tilesheetCols = Math.max(1, Math.floor(tilesheet.width / srcTileSize));

    // Sprite Fusion exports layers in stack order (top-first in the editor).
    // Reverse so the bottom layer draws first. Collider layer AND any layer
    // whose tiles should occlude characters from below (bushes, flowers) are
    // held out of the flat pass and Y-sorted so that a character standing
    // above a bush walks behind it.
    // Flat pass in reverse JSON order. `overlay` is held out and drawn last
    // (after all characters); everything else flows through based on its
    // position in the Sprite Fusion layer stack, so `under` naturally ends up
    // above ground/floor-detail but below tall grass / blockers / characters.
    const flatLayers = [...map.data.layers]
      .reverse()
      .filter((l) => !l.collider && !Y_SORTED_LAYERS.has(l.name) && l.name !== 'overlay');
    for (const L of flatLayers) {
      drawLayer(ctx, tilesheet, tilesheetCols, srcTileSize, L, camX, camY, canvasWidth, canvasHeight);
    }

    // Resolved object list for the current map + shared animation tick.
    // The list is cached per mapId so we don't rebuild it every frame; the
    // tick is wall-clock based so two devices render the same frame at the
    // same wall time, independent of frame rate.
    const objs = objectsForMap(state.currentMapId);
    const objTick = Math.floor(performance.now() / (1000 / OBJECT_ANIM_FPS));

    // Pass 1/3 — 'under' objects. Drawn after the flat tile pass but
    // before characters / Y-sort, so a ground flower lays under NPCs the
    // same way a tile in the SF `under` layer would.
    if (!mapOverride) for (const o of objs) {
      if (o.drawOrder === 'under') drawObject(ctx, o, objTick, camX, camY, canvasWidth, canvasHeight);
    }

    // Gated-portal door overlay: drawn flat after the floor pass so the
    // player and NPCs always render on top. Active only while the gate's
    // required trainers are still alive AND we're on the gated side.
    // Sized to the rect so a 1×1 portal gets a single-tile door.
    if (!mapOverride) for (const portal of getPortals()) {
      const gate = portal.gate;
      if (!gate || !gate.doorImage) continue;
      if (!isPortalVisibleToCurrentPlayer(portal, state.currentMapId)) continue;
      if (state.currentMapId !== gate.fromMapId) continue;
      if (isGateOpen(gate, state)) continue;
      const half = portal.a.mapId === gate.fromMapId ? portal.a : portal.b;
      const doorImg = getImage(gate.doorImage);
      if (!doorImg) {
        loadImage(gate.doorImage).catch(() => {});
        continue;
      }
      const worldX = half.rect.tileX * TILE_SIZE;
      const worldY = half.rect.tileY * TILE_SIZE;
      const w = half.rect.w * TILE_SIZE;
      const h = half.rect.h * TILE_SIZE;
      ctx.drawImage(doorImg, worldX, worldY, w, h);
    }

    // ── Unified Y-sorted draw pass ──
    interface Drawable { footY: number; draw: () => void }
    const drawables: Drawable[] = [];

    const playerFootY = state.playerY + TILE_SIZE;
    // Player skin is dynamic — defaults to Boy, the mirror-sign picker
    // swaps the character name at runtime. Falls back to the Boy paths
    // if the chosen sheet failed to preload, so the player never goes
    // invisible after a swap.
    const playerPaths = playerSpritePathsFor(state.playerCharacter);
    const playerImg = getImage(playerPaths.png) ?? getImage(PLAYER_SPRITE_PNG);
    const playerSheet = getSpritesheet(playerPaths.json) ?? getSpritesheet(PLAYER_SPRITE_JSON);
    drawables.push({
      footY: playerFootY,
      draw: () => {
        if (playerImg && playerSheet) {
          const frameName = resolveFrame(playerSheet, state.direction, state.isMoving ? state.walkFrame : 0);
          if (frameName) drawCharSprite(ctx, playerImg, playerSheet, frameName, state.playerX, state.playerY);
        } else if (playerImg) {
          const aspect = playerImg.width / playerImg.height;
          const dw = CHAR_SCREEN_H * aspect;
          ctx.drawImage(playerImg, state.playerX + TILE_SIZE / 2 - dw / 2, state.playerY + TILE_SIZE - CHAR_SCREEN_H, dw, CHAR_SCREEN_H);
        }
      },
    });

    for (const nrt of state.npcStates) {
      const npc = npcsOverride
        ? npcsOverride.find((n) => n.id === nrt.id)
        : npcDefForRuntime(nrt.id, state);
      if (!npc) continue;
      drawables.push({
        footY: nrt.y + TILE_SIZE,
        draw: () => drawNpcRuntime(ctx, npc, nrt, frameCount),
      });
    }

    for (const art of state.animalStates) {
      drawables.push({
        footY: art.y + TILE_SIZE,
        draw: () => drawAnimalRuntime(ctx, art),
      });
    }

    // Pass 2/3 — 'sort' objects join the Y-sort drawables array so they
    // interleave naturally with player/NPCs/animals by foot position.
    // footY = the object's bottom edge in world pixels (after the bottom-
    // centered draw rect resolution).
    if (!mapOverride) for (const o of objs) {
      if (o.drawOrder !== 'sort') continue;
      const { dx, dy, dw, dh } = objectDrawRect(o.tileX, o.tileY, o.offsetX, o.offsetY, o.frameW, o.frameH);
      // Cheap viewport pre-cull — drawObject also checks, but skipping
      // here saves an Array.push for offscreen placements.
      if (dx + dw < camX || dx > camX + canvasWidth) continue;
      if (dy + dh < camY || dy > camY + canvasHeight) continue;
      drawables.push({
        footY: dy + dh,
        draw: () => drawObject(ctx, o, objTick, camX, camY, canvasWidth, canvasHeight),
      });
    }

    // Y-sort all tiles whose layer should occlude characters from below —
    // collider layer (walls/trees) plus named layers like bushes_flowers.
    for (const L of map.data.layers) {
      if (!L.collider && !Y_SORTED_LAYERS.has(L.name)) continue;
      for (const t of L.tiles) {
        if (map.emptyIds.has(parseInt(t.id, 10))) continue;
        const dx = t.x * TILE_SIZE;
        const dy = t.y * TILE_SIZE;
        if (dx + TILE_SIZE < camX || dx > camX + canvasWidth) continue;
        if (dy + TILE_SIZE < camY || dy > camY + canvasHeight) continue;
        const { sx, sy } = tileSrcXY(t.id, tilesheetCols, srcTileSize);
        drawables.push({
          footY: (t.y + 1) * TILE_SIZE,
          draw: () => ctx.drawImage(tilesheet, sx, sy, srcTileSize, srcTileSize, dx, dy, TILE_SIZE, TILE_SIZE),
        });
      }
    }

    // Restored-building overlays are only relevant on the world map, not interiors.
    if (!mapOverride) for (const b of RESTORABLES) {
      const prog = state.villageProgress[b.id];
      if (!prog || prog.stage <= 0) continue;
      const stageDef = b.stages[prog.stage];

      let img: HTMLImageElement | undefined;

      if (stageDef?.assetPath) {
        img = getCdnImage(stageDef.assetPath);
        if (!img) {
          loadCdnImage(
            stageDef.assetPath,
            (p) => RundotGameAPI.cdn.fetchAsset(p),
          ).catch(() => {});
        }
      }

      if (!img) {
        const url = prog.stageImages[prog.stage];
        if (url) {
          img = getImage(url);
          if (!img) loadImage(url).catch(() => {});
        }
      }

      if (!img) continue;

      const worldX = b.tileX * TILE_SIZE;
      const worldY = b.tileY * TILE_SIZE;
      const w = b.widthTiles * TILE_SIZE;
      const h = b.heightTiles * TILE_SIZE;
      const imgRef = img;
      drawables.push({
        footY: worldY + h,
        draw: () => ctx.drawImage(imgRef, worldX, worldY, w, h),
      });
    }

    drawables.sort((a, b) => a.footY - b.footY);
    for (const d of drawables) d.draw();

    // Bush/flower per-pixel occlusion: for each character, if their foot
    // pixel landed on OPAQUE bush art, redraw that bush tile on top. This
    // replaces the old footY-vs-tile-bottom Y-sort so a character walking
    // past a flower with lots of transparent space around it stays visibly
    // in front until they actually step on the petals.
    drawBushOpacityOverlay(
      ctx,
      map,
      tilesheet,
      tilesheetCols,
      srcTileSize,
      [
        { x: state.playerX, y: state.playerY },
        ...state.npcStates.map((n) => ({ x: n.x, y: n.y })),
        ...state.animalStates.map((a) => ({ x: a.x, y: a.y })),
      ],
    );

    // Foreground tall-grass overlay: redraw the tall-grass tile on top of
    // any character whose feet are standing in it, clipped to the lower
    // half of the character's sprite rect. Gives the classic "standing in
    // the grass" look.
    drawTallGrassOverlay(
      ctx,
      map,
      tilesheet,
      tilesheetCols,
      srcTileSize,
      [
        { x: state.playerX, y: state.playerY },
        ...state.npcStates.map((n) => ({ x: n.x, y: n.y })),
        ...state.animalStates.map((a) => ({ x: a.x, y: a.y })),
      ],
    );

    // "overlay" layer draws above characters/buildings so you can walk under
    // roofs and tree canopies. Particles (weather, grass tufts) draw on top
    // of overlay because they're atmospheric — a snowflake should land on a
    // roof, not behind it.
    for (const L of map.data.layers) {
      if (L.name === 'overlay') drawLayer(ctx, tilesheet, tilesheetCols, srcTileSize, L, camX, camY, canvasWidth, canvasHeight);
    }

    // Pass 3/3 — 'overlay' objects render above the SF overlay layer so
    // they sit on top of every world element. Particles still draw above
    // these (intentional — atmospheric > decorative).
    if (!mapOverride) for (const o of objs) {
      if (o.drawOrder === 'overlay') drawObject(ctx, o, objTick, camX, camY, canvasWidth, canvasHeight);
    }

    drawParticles(ctx, state.particles);

    // Mood emotes — random flavor pop-ups above idling NPCs. Drawn BEFORE
    // talk indicators so the talk "!" / "..." wins when the player is close.
    drawMoodEmotes(ctx, state, frameCount);

    // Grass-patch level signs + world pickups + interactable wooden signs.
    drawGrassLevelSigns(ctx, map, state.currentMapId, camX, camY, canvasWidth, canvasHeight);
    // 2026-06-01 (v1.670) — Removed drawFtueGrassPointer per Mike's
    // request: "remove the grass distance modal that you built." The
    // v1.657 FTUE grass pointer (on-screen chevron + off-screen
    // compass arrow with "Grass — N tiles" distance pill) was built
    // for the 7-beat tutorial that no longer exists; v1.659 collapsed
    // the FTUE to a 3-beat auto-battle flow where the player never
    // sees the overworld on the 'fight' beat unless they lose the
    // auto-battle. The pointer's intended audience (a lost player
    // who returns to the world and needs a hint) is rare enough that
    // the persistent on-canvas overlay is unjustified noise. If
    // recovery guidance is needed later, prefer a Help-menu replay
    // entry or a one-shot toast over a per-frame canvas draw.
    drawWorldSigns(ctx, state.currentMapId, camX, camY, canvasWidth, canvasHeight);
    drawPickups(ctx, state, map, frameCount, camX, camY, canvasWidth, canvasHeight);

    // Persistent service-role bubbles (e.g. the healer's "+" cross) always
    // render above their NPC, so players can spot service characters from
    // across the map. Drawn under the proximity "!" so when the player
    // walks up the talk indicator still wins visually.
    drawServiceBubbles(ctx, state, frameCount);

    // "!" / "..." talk indicator above NPCs + restorables within interaction
    // range. Hidden while a dialogue is already open.
    if (!state.interactingNpc) {
      drawTalkIndicators(ctx, state, frameCount);
    }
  } else {
    // Map/tilesheet not loaded yet — draw placeholder color so player isn't on a black void.
    ctx.fillStyle = '#2d6b25';
    ctx.fillRect(0, 0, worldPxW, worldPxH);
  }

  // Touch frameCount so unused-var lints don't complain (kept in signature for future anim).
  void frameCount;

  ctx.restore();
}

function drawCharSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  sheet: import('../engine/Spritesheet').SpritesheetData,
  frameName: string,
  tileX: number,
  tileY: number,
) {
  const frameInfo = sheet.frames[frameName];
  if (!frameInfo) return;

  const { x: sx, y: sy, w: sw, h: sh } = frameInfo.frame;
  const aspect = sw / sh;
  const drawH = CHAR_SCREEN_H;
  const drawW = drawH * aspect;
  // Round to integer pixels so nearest-neighbor upscaling stays clean even
  // when the character's world position is fractional (e.g. diagonal moves).
  const dx = Math.round(tileX + TILE_SIZE / 2 - drawW / 2);
  const dy = Math.round(tileY + TILE_SIZE - drawH);

  const rot = frameInfo.rotation;
  if (rot === 0) {
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, drawW, drawH);
  } else {
    ctx.save();
    ctx.translate(dx + drawW / 2, dy + drawH / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.drawImage(img, sx, sy, sw, sh, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  }
}

/** Radius (in world pixels) within which an NPC shows a talk emote above their head. */
const TALK_INDICATOR_RANGE = TILE_SIZE * 1.6;

/**
 * Draw random mood emotes over NPCs whose runtime has an active emote. Skipped
 * for NPCs currently within talk range so the mood doesn't stack on top of the
 * talk indicator — the player's approach hides the flavor pop.
 */
function drawMoodEmotes(
  ctx: CanvasRenderingContext2D,
  state: OverworldState,
  frameCount: number,
) {
  const px = state.playerX + TILE_SIZE / 2;
  const py = state.playerY + TILE_SIZE / 2;
  const bounce = Math.sin(frameCount * 0.12) * 2;
  const scale = 3;
  for (const nrt of state.npcStates) {
    if (!nrt.activeEmoteSrc) continue;
    const nx = nrt.x + TILE_SIZE / 2;
    const ny = nrt.y + TILE_SIZE / 2;
    if (Math.hypot(nx - px, ny - py) <= TALK_INDICATOR_RANGE) continue;
    const img = getImage(nrt.activeEmoteSrc);
    if (!img) continue;
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    const cx = Math.round(nx);
    const cy = Math.round(nrt.y - 4 + bounce);
    ctx.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h), w, h);
  }
}
const TALK_INDICATOR_EMOTE_TALK = 'world/ui/Emote/emote20.png';   // grey dots — regular NPC
const TALK_INDICATOR_EMOTE_BATTLE = 'world/ui/Emote/emote22.png'; // red ! — trainer battle

/**
 * Persistent role-indicator bubbles above service NPCs (healer, shop,
 * merge, pvp). Always drawn regardless of player distance so players can
 * locate the healer / shop / altar at a glance. Pixel-art themed:
 * rounded thought-bubble with a colored glyph inside, gently bobbing.
 */
const SERVICE_GLYPHS: Partial<Record<string, { glyph: string; fill: string; stroke: string }>> = {
  heal:  { glyph: '+', fill: '#ffffff', stroke: '#c0392b' },
  shop:  { glyph: '$', fill: '#ffffff', stroke: '#2e7d32' },
  merge: { glyph: '*', fill: '#ffffff', stroke: '#9028a0' },
  pvp:   { glyph: '!', fill: '#ffffff', stroke: '#1565c0' },
  // Master Tutor — gold-rimmed scroll bubble. Distinct from shop's
  // green dollar so players can tell "premium move tutor" from
  // "Quartermaster sundries" at a glance.
  tutor: { glyph: '?', fill: '#ffd700', stroke: '#1a1208' },
  // v1.710 — Trainer Tower gatekeeper (Marshal Vance). Red `!` on
  // white because Mike wanted a "screaming exclamation point" that
  // tells the player "talk to me, then I'll let you climb." Visually
  // distinct from the blue PvP `!` and the trainer-battle red-fill `!`
  // so a glance at the map disambiguates "gate to the leaderboard
  // tower" from "PvP league signpost" from "fight me trainer."
  tower: { glyph: '!', fill: '#c0392b', stroke: '#ffffff' },
};

// Trainer bubble style — intentionally distinct from `pvp` (blue `!` on
// white) so a glance at the map tells you "that's a fightable trainer"
// vs "that's a PvP league contact". Red fill with a white glyph and a
// crossed-swords tail reads as hostile intent across any palette.
const TRAINER_BUBBLE_STYLE = {
  glyph:  '!',
  fill:   '#c0392b',
  stroke: '#ffffff',
} as const;

// v1.209 ? Special bubble for the dojo master (NPC id "master"). The
// generic trainer red `!` was making him visually identical to every
// minor brawler in the cave; he\u2019s the endgame fight, he should
// look like it. Gold `?` on a deep crimson fill marks him as
// "the question waiting at the top of the dojo" \u2014 a unique style
// reserved for the single boss in the game. If we add more bosses
// later, generalize via an `npcId\u2192style` map; for one entry the
// inline check is fine.
const MASTER_BUBBLE_STYLE = {
  glyph:  '?',
  fill:   '#7a1f1f',
  stroke: '#ffd166',
} as const;
const MASTER_NPC_ID = 'master';

function drawServiceBubbles(
  ctx: CanvasRenderingContext2D,
  state: OverworldState,
  frameCount: number,
) {
  const bounce = Math.sin(frameCount * 0.08) * 1.5;
  for (const nrt of state.npcStates) {
    const def = NPC_CATALOG[nrt.id];
    if (!def) continue;
    // Skip while the player is mid-dialogue with this NPC (cleaner UI).
    if (state.interactingNpc === nrt.id) continue;

    // Service NPCs (healer / shop / merge / pvp) — persistent role bubble.
    let style: { glyph: string; fill: string; stroke: string } | undefined =
      def.kind ? SERVICE_GLYPHS[def.kind] : undefined;

    // Trainers that haven't been defeated yet also get a persistent
    // bubble — but a distinct one (red fill, white `!`) so players can
    // spot them from across the map and pair them to the promoted
    // "Trainer Duels" section in the quest panel. Once defeated the
    // bubble goes away, matching the rest of the "this is done" UX.
    const isTrainer = (def.trainerParty?.length ?? 0) > 0;
    const pendingTrainer = isTrainer && !state.trainerDefeats.has(nrt.id);
    if (!style && pendingTrainer) {
      // v1.209 ? Master Kenji gets his own gold-rimmed crimson `?`
      // bubble so the endgame boss reads visually distinct from every
      // minor cave brawler with the generic red `!`.
      style = nrt.id === MASTER_NPC_ID ? MASTER_BUBBLE_STYLE : TRAINER_BUBBLE_STYLE;
    }
    if (!style) continue;

    const cx = Math.round(nrt.x + TILE_SIZE / 2);
    // Sit the bubble well above the sprite's head. NPC sprites render at
    // 48px (3x of 16), so push up ~32 world px.
    const cy = Math.round(nrt.y - 20 + bounce);
    // v1.250 — Healers get a custom signpost-style marker (big medical
    // cross + pulsing halo + "HEAL" label) instead of the generic "+"
    // bubble. Players were missing the healer in busy towns; this
    // makes them spottable from across the map at a glance.
    if (def.kind === 'heal') {
      drawHealerSign(ctx, cx, cy, frameCount);
      continue;
    }
    drawServiceBubble(ctx, cx, cy, style.glyph, style.fill, style.stroke);

    // v1.250 — Trainer level chip. Sits to the right of the bubble so
    // players can scout difficulty before walking into a duel.
    // Uses the highest-level mon in the trainer's party as the
    // displayed number; matches what the player will face on the lead
    // slot of a tough trainer's roster. Color-banded by absolute
    // trainer level (low=green, mid=yellow, high=red) — lighter weight
    // than wiring through the player's own lead level just to compute
    // a relative diff, and still gives a quick at-a-glance read.
    if (pendingTrainer && def.trainerParty && def.trainerParty.length > 0) {
      let maxLevel = 1;
      for (const t of def.trainerParty) {
        if (t.level > maxLevel) maxLevel = t.level;
      }
      drawTrainerLevelChip(ctx, cx + 14, cy - 2, maxLevel);
    }
  }
}

/** v1.250 — Distinctive healer "Pokemon Center"-style sign. Big white
 *  medical cross on a red plate, pulsing green halo to catch the eye,
 *  and a small "HEAL" label below so the function is unambiguous. Used
 *  in place of the generic SERVICE_GLYPH bubble for any NPC with
 *  `kind: 'heal'`. */
function drawHealerSign(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  frameCount: number,
) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // Pulsing halo — slow sine, gentle so it's calming rather than alarming.
  const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.10);
  const haloRadius = 18 + pulse * 4;
  ctx.beginPath();
  ctx.arc(cx, cy, haloRadius, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(80, 220, 120, ${0.10 + 0.18 * pulse})`;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = `rgba(120, 255, 160, ${0.30 + 0.30 * pulse})`;
  ctx.stroke();

  // Red plate (rounded square via overlapping rectangles + corners).
  const plate = 22;
  const half = plate / 2;
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(cx - half, cy - half, plate, plate);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#1a1208';
  ctx.strokeRect(cx - half + 0.5, cy - half + 0.5, plate - 1, plate - 1);

  // White medical cross — two thick bars centered on the plate.
  const crossThick = 4;
  const crossLen = 14;
  ctx.fillStyle = '#ffffff';
  // Vertical bar
  ctx.fillRect(cx - crossThick / 2, cy - crossLen / 2, crossThick, crossLen);
  // Horizontal bar
  ctx.fillRect(cx - crossLen / 2, cy - crossThick / 2, crossLen, crossThick);

  // "HEAL" pill underneath. Placed offset down so it doesn't fight the
  // NPC's sprite head when sprites are tall.
  const labelY = cy + half + 8;
  const labelText = 'HEAL';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tw = Math.max(28, Math.ceil(ctx.measureText(labelText).width) + 8);
  const lh = 12;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx - tw / 2, labelY - lh / 2, tw, lh);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#c0392b';
  ctx.strokeRect(cx - tw / 2 + 0.5, labelY - lh / 2 + 0.5, tw - 1, lh - 1);
  ctx.fillStyle = '#c0392b';
  ctx.fillText(labelText, cx, labelY + 1);

  ctx.restore();
}

/** Pixel-art "Lv N" chip used to mark trainer difficulty in the
 *  overworld. Color-banded by trainer level: green (<=5), yellow
 *  (6-15), red (16+). Drawn pixel-aligned so it matches the rest of
 *  the bubble visuals. */
function drawTrainerLevelChip(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  level: number,
) {
  const text = `Lv${level}`;
  const fill =
    level >= 16 ? '#c0392b' :
    level >= 6  ? '#d49a26' :
                  '#3a8e2c';
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Measure with a small horizontal padding so 1-3 digit numbers all
  // get the same comfy spacing.
  const w = Math.max(20, Math.ceil(ctx.measureText(text).width) + 6);
  const h = 12;
  const x = cx - w / 2;
  const y = cy - h / 2;
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#1a1208';
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, cx, cy + 1);
  ctx.restore();
}

/**
 * Render one pixel-art style thought bubble centered at (cx, cy). The
 * bubble anchor sits a couple of pixels below the main circle to mimic a
 * classic comic "thought cloud" tail.
 */
function drawServiceBubble(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  glyph: string,
  fill: string,
  stroke: string,
) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  // Main bubble body
  const r = 11;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#1a1208';
  ctx.stroke();

  // Tail: two diminishing dots toward the NPC below.
  ctx.beginPath();
  ctx.arc(cx - 2, cy + r + 4, 3, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#1a1208';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx - 5, cy + r + 9, 1.8, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.stroke();

  // Glyph
  ctx.fillStyle = stroke;
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, cx, cy + 1);
  ctx.restore();
}

/** Draw the "press A to talk" emote above every NPC / interactable the player
 *  is close enough to. Trainers (NPCs with a trainerParty) get a red ! emote
 *  to warn the player that speaking to them starts a battle. */
function drawTalkIndicators(
  ctx: CanvasRenderingContext2D,
  state: OverworldState,
  frameCount: number,
) {
  const talkEmote = getImage(TALK_INDICATOR_EMOTE_TALK);
  const battleEmote = getImage(TALK_INDICATOR_EMOTE_BATTLE);
  // Fall back to whichever IS loaded if the other failed (unlikely but safe).
  const fallback = talkEmote ?? battleEmote;
  if (!fallback) return;

  const px = state.playerX + TILE_SIZE / 2;
  const py = state.playerY + TILE_SIZE / 2;
  const bounce = Math.sin(frameCount * 0.12) * 2;

  // Pair each target with the emote image to use.
  const targets: { cx: number; cy: number; img: HTMLImageElement }[] = [];

  for (const nrt of state.npcStates) {
    const nx = nrt.x + TILE_SIZE / 2;
    const ny = nrt.y + TILE_SIZE / 2;
    if (Math.hypot(nx - px, ny - py) > TALK_INDICATOR_RANGE) continue;
    const isTrainer = (NPC_CATALOG[nrt.id]?.trainerParty?.length ?? 0) > 0;
    const pendingBattle = isTrainer && !state.trainerDefeats.has(nrt.id);
    const img = (pendingBattle ? battleEmote : talkEmote) ?? fallback;
    targets.push({ cx: Math.round(nx), cy: Math.round(nrt.y - 4 + bounce), img });
  }

  if (state.facingRestorable) {
    const b = RESTORABLES.find((r) => r.id === state.facingRestorable);
    if (b) {
      const cx = Math.round((b.tileX + b.widthTiles / 2) * TILE_SIZE);
      const cy = Math.round(b.tileY * TILE_SIZE - 8 + bounce);
      targets.push({ cx, cy, img: talkEmote ?? fallback });
    }
  }

  if (state.facingSign) {
    const s = WORLD_SIGNS.find((w) => w.id === state.facingSign);
    if (s) {
      // Hover the prompt directly above the sign — sign center sits at
      // tile center, so subtract roughly the sign half-height + a bit
      // of breathing room before applying bounce.
      const cx = Math.round(s.tileX * TILE_SIZE + TILE_SIZE / 2);
      const cy = Math.round(s.tileY * TILE_SIZE - 8 + bounce);
      targets.push({ cx, cy, img: talkEmote ?? fallback });
    }
  }

  // Integer 3× upscale to match the character-sprite render scale (16px
  // source → 48px world). Keeps nearest-neighbor crisp.
  const scale = 3;
  for (const { cx, cy, img } of targets) {
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h), w, h);
  }
}

function drawAnimalRuntime(ctx: CanvasRenderingContext2D, art: AnimalRuntime) {
  const img = getImage(art.def.sprite);
  if (!img) {
    loadImage(art.def.sprite).catch(() => {});
    return;
  }
  const sheet = getSpritesheet(art.def.spriteJson);
  if (!sheet) {
    loadSpritesheet(art.def.spriteJson).catch(() => {});
    return;
  }
  // Animals animate only while moving — idle stands still on the stand frame.
  const phase = art.isMoving ? art.walkFrame : 0;
  const { frameName, flipX } = resolveAnimalFrame(sheet, art.direction, phase);
  if (!frameName) return;
  const info = sheet.frames[frameName];
  if (!info) return;
  const { w: sw, h: sh } = info.frame;
  // Integer upscale to match the map tile scale (16px source → 48px world).
  // Works for the 16×16 dog all the way up to the 24×16 horse; aspect is
  // preserved so no squashing.
  const scale = TILE_SIZE / 16;
  const drawW = Math.round(sw * scale);
  const drawH = Math.round(sh * scale);
  const dx = Math.round(art.x + TILE_SIZE / 2 - drawW / 2);
  const dy = Math.round(art.y + TILE_SIZE - drawH);
  drawSpriteFlipped(ctx, img, sheet, frameName, dx, dy, drawW, drawH, flipX);
}

function drawNpcRuntime(ctx: CanvasRenderingContext2D, npc: NpcDef, nrt: NpcRuntime, _frameCount: number) {
  const npcImg = getImage(npc.sprite);
  if (!npcImg) {
    // Lazy-fetch: NPC was re-skinned in the editor to a character not in the
    // startup preload. Kick off the load; next frame the image will be cached.
    loadImage(npc.sprite).catch(() => {});
    return;
  }

  const sheetData = npc.spriteJson ? getSpritesheet(npc.spriteJson) : undefined;
  if (npc.spriteJson && !sheetData) {
    loadSpritesheet(npc.spriteJson).catch(() => {});
  }
  if (sheetData) {
    const frame = nrt.isMoving ? nrt.walkFrame : 0;
    const frameName = resolveFrame(sheetData, nrt.direction, frame);
    if (frameName) {
      drawCharSprite(ctx, npcImg, sheetData, frameName, nrt.x, nrt.y);
    }
  } else {
    const aspect = npcImg.width / npcImg.height;
    const dw = CHAR_SCREEN_H * aspect;
    ctx.drawImage(npcImg, nrt.x + TILE_SIZE / 2 - dw / 2, nrt.y + TILE_SIZE - CHAR_SCREEN_H, dw, CHAR_SCREEN_H);
  }
}

// ════════════════════════════════════════════
// GRASS PATCH LEVEL SIGNS + WORLD PICKUPS
// ════════════════════════════════════════════

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Interactable signposts (read with A). Each sign instance picks one of
 *  the PNG variants under /public/world/tilesets/signs/; wide variants
 *  (sign_wide2 / sign_wide3) span 2 or 3 tiles starting from the anchor.
 *  The sprite is drawn fitted to the sign's tile footprint with crisp
 *  pixel-art scaling — no procedural wood-plank fallback. */
function drawWorldSigns(
  ctx: CanvasRenderingContext2D,
  mapId: string,
  camX: number,
  camY: number,
  canvasWidth: number,
  canvasHeight: number,
) {
  const signs = getWorldSignsForMap(mapId);
  if (signs.length === 0) return;
  ctx.save();
  const prevSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  for (const s of signs) {
    // Invisible interaction markers (no_sprite) don't draw — they exist to
    // attach a popup to an existing blocker (door, statue, fence) that the
    // tilemap already renders.
    if (!isRenderableSign(s.sprite)) continue;
    const w = getSignWidth(s.sprite);
    const x = s.tileX * TILE_SIZE;
    const y = s.tileY * TILE_SIZE;
    const dw = w * TILE_SIZE;
    const dh = TILE_SIZE;
    // Cull off-screen signs cheaply.
    if (x + dw < camX || x > camX + canvasWidth) continue;
    if (y + dh < camY || y > camY + canvasHeight) continue;
    const img = getImage(getSignSpritePath(s.sprite));
    if (!img) continue;
    ctx.drawImage(img, x, y, dw, dh);
  }
  ctx.imageSmoothingEnabled = prevSmoothing;
  ctx.restore();
}

/** Wooden "Lv. N-M" sign above each connected tall-grass patch. */
function drawGrassLevelSigns(
  ctx: CanvasRenderingContext2D,
  map: SFMap,
  mapId: string,
  camX: number,
  camY: number,
  canvasWidth: number,
  canvasHeight: number,
) {
  const patches = getGrassPatches(map, mapId);
  if (patches.length === 0) return;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const p of patches) {
    const cx = Math.round(p.signTile.tx * TILE_SIZE + TILE_SIZE / 2);
    const cy = Math.round(p.signTile.ty * TILE_SIZE - 6);
    if (cx + 40 < camX || cx - 40 > camX + canvasWidth) continue;
    if (cy + 32 < camY || cy - 32 > camY + canvasHeight) continue;

    const label = p.minLevel === p.maxLevel
      ? `Lv. ${p.minLevel}`
      : `Lv. ${p.minLevel}-${p.maxLevel}`;
    const signW = 52;
    const signH = 22;

    ctx.fillStyle = '#6b3f20';
    ctx.fillRect(cx - 1.5, cy + signH / 2, 3, 8);

    ctx.fillStyle = '#1c1208';
    roundRect(ctx, cx - signW / 2 - 2, cy - signH / 2 - 2, signW + 4, signH + 4, 4);
    ctx.fill();

    const grad = ctx.createLinearGradient(0, cy - signH / 2, 0, cy + signH / 2);
    grad.addColorStop(0, '#c29367');
    grad.addColorStop(1, '#8f6842');
    ctx.fillStyle = grad;
    roundRect(ctx, cx - signW / 2, cy - signH / 2, signW, signH, 3);
    ctx.fill();

    ctx.fillStyle = '#2a1a0a';
    ctx.beginPath();
    ctx.arc(cx - signW / 2 + 4, cy - signH / 2 + 4, 1.2, 0, Math.PI * 2);
    ctx.arc(cx + signW / 2 - 4, cy - signH / 2 + 4, 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2a1a0a';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(label, cx, cy + 1);
  }
  ctx.restore();
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

/**
 * 2026-06-01 (v1.670) — Removed. The v1.657 `drawFtueGrassPointer`
 * (on-screen chevron + off-screen compass arrow + "Grass — N tiles"
 * distance pill) was built when the FTUE asked players to walk to
 * tall grass on their own. v1.659 collapsed the tutorial to a
 * 3-beat auto-battle flow where the player never needs to find
 * grass during the happy path, and Mike asked to remove the pointer
 * outright ("remove the grass distance modal that you built"). Left
 * this comment so future spelunkers know the pointer existed and
 * why it's gone; check git blame on this line if you want the old
 * implementation back as a Help-menu replay or one-shot toast.
 */
/** Uncollected pickups as floating icons with pulsing sparkle halo. */
function drawPickups(
  ctx: CanvasRenderingContext2D,
  state: OverworldState,
  map: SFMap,
  frame: number,
  camX: number,
  camY: number,
  canvasWidth: number,
  canvasHeight: number,
) {
  const resolved = getResolvedPickups(map, state.currentMapId);
  // Kick off the atlas load once; subsequent calls return the cached promise.
  void loadAtlas();
  const atlasImg = getAtlasImage();
  // 2026-05-27 — Bumped ICON_BOX 24→36 so ground pickups read at a glance.
  // Halo, sparkle orbit, and cull buffer derive from ICON_BOX so they scale
  // together if the size is tuned again later.
  const ICON_BOX = 36;
  const HALO_BASE = ICON_BOX * 0.75; // halo radius at minimum pulse
  const HALO_PULSE = ICON_BOX * 0.25; // additional radius at peak pulse
  const HALO_SIDE = ICON_BOX * 2;     // fillRect side around halo
  const SPARKLE_ORBIT = ICON_BOX * 0.58;
  const CULL_BUFFER = ICON_BOX * 1.33;
  for (const p of resolved.values()) {
    if (state.collectedPickups.has(p.id)) continue;
    const cx = Math.round(p.tileX * TILE_SIZE + TILE_SIZE / 2);
    const cy = Math.round(p.tileY * TILE_SIZE + TILE_SIZE / 2);
    if (cx + CULL_BUFFER < camX || cx - CULL_BUFFER > camX + canvasWidth) continue;
    if (cy + CULL_BUFFER < camY || cy - CULL_BUFFER > camY + canvasHeight) continue;

    const bob = Math.sin(frame * 0.1 + p.tileX) * 3;
    const pulse = 0.5 + 0.5 * Math.sin(frame * 0.08 + p.tileY);

    ctx.save();
    const grd = ctx.createRadialGradient(cx, cy + bob, 0, cx, cy + bob, HALO_BASE + pulse * HALO_PULSE);
    grd.addColorStop(0, `rgba(255, 235, 120, ${0.5 + pulse * 0.3})`);
    grd.addColorStop(1, 'rgba(255, 235, 120, 0)');
    ctx.fillStyle = grd;
    ctx.fillRect(cx - HALO_SIDE / 2, cy + bob - HALO_SIDE / 2, HALO_SIDE, HALO_SIDE);

    if (atlasImg) {
      const f = getAtlasFrame(p.iconName);
      const longest = Math.max(f.w, f.h);
      const scale = ICON_BOX / longest;
      const drawW = Math.round(f.w * scale);
      const drawH = Math.round(f.h * scale);
      const dx = Math.round(cx - drawW / 2);
      const dy = Math.round(cy + bob - drawH / 2);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(atlasImg, f.x, f.y, f.w, f.h, dx, dy, drawW, drawH);
    }

    for (let i = 0; i < 3; i++) {
      const ang = (frame * 0.05 + i * 2.09) % (Math.PI * 2);
      const r = SPARKLE_ORBIT + pulse * 3;
      const sx = cx + Math.cos(ang) * r;
      const sy = cy + bob + Math.sin(ang) * r;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(Math.round(sx) - 1, Math.round(sy) - 1, 2, 2);
    }
    ctx.restore();
  }
}
