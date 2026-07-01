import type { MonsterType as RealMonsterType } from '../../data/typeSystem';
import type { Rarity } from '../../types/card';

// ── Core game types ──

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Position, Size {}

export type GameMode = 'title' | 'overworld' | 'battle-transition' | 'battle' | 'battle-end-transition';

export type Direction = 'up' | 'down' | 'left' | 'right';

// ── Tile map ──

export const enum Tile {
  Grass = 0,
  Path = 1,
  Water = 2,
  TallGrass = 3,
  Building = 4,
  Tree = 5,
  Fence = 6,
  FlowerGrass = 7,
  DoorMat = 8, // walkable, visual marker
  Bush = 9, // decorative bush, solid
}

export const TILE_SIZE = 48;

// Canvas matches the reference exactly
export const CANVAS_W = 1024;
export const CANVAS_H = 576;

export interface NpcDef {
  id: string;
  name: string;
  sprite: string;
  spriteJson?: string; // optional spritesheet JSON atlas
  faceset?: string;    // portrait shown in dialogue box
  tileX: number;
  tileY: number;
  dialogue: string[];
  /**
   * If set, scopes the NPC to a single map for editor convenience —
   * the "+ Place" picker only offers NPCs whose `homeMapId` matches
   * the active map (or is unset/legacy). Doesn't affect runtime; an
   * NPC can still be placed on multiple maps if you really want that,
   * the field is purely an editor-side filter so per-zone trainers
   * (snowflo, snowpro, ironbeck, etc.) don't pollute the picker on
   * unrelated maps.
   */
  homeMapId?: string;
  /**
   * Declares what happens when dialogue ends. Maps to a handler in WorldTab.
   *   'pvp'   \u2192 opens the league picker / PvP overlay
   *   'merge' \u2192 opens the merge altar modal
   * If absent, it's a plain talk-only NPC (or a trainer, handled via trainerParty).
   */
  kind?: 'pvp' | 'merge' | 'shop' | 'heal' | 'tutor' | 'starter-pick' | 'tower' | 'tower-challenger';
  /**
   * If present, this NPC is a trainer. After dialogue ends, a battle starts
   * against this party (one-time only — tracked in storage). Mons are
   * materialised into BattleCards at runtime via `buildTrainerMon` so we
   * don't have to hand-roll stats / abilities here.
   */
  trainerParty?: TrainerMonSpec[];
  /** Stardust dropped on defeating this trainer. Defaults to scale by party. */
  trainerReward?: number;
  /** Dialogue shown after the trainer has been beaten (replaces normal lines). */
  postDefeatDialogue?: string[];
  /** When true, this trainer physically blocks passage until defeated.
   *  Once beaten, their collision is removed so the player can pass. */
  blocksPassage?: boolean;
  /** Pre-battle bark shown right before the encounter triggers. */
  preBattleLine?: string;
  /**
   * Emote file basenames (e.g. "emote7", "emote14") this NPC randomly pops
   * above their head while idling/walking. Gives the town some flavor. An
   * empty or missing list = silent NPC.
   */
  moodEmotes?: string[];
  /**
   * When true, the NPC stands rooted to their spawn tile — the engine
   * skips the random wander step every frame. Mood emotes and idle
   * facing still tick. Toggleable per-NPC from the editor inspector.
   */
  stationary?: boolean;
  /**
   * Locks the NPC's facing to a fixed cardinal direction. When set, the
   * engine skips the idle look-around (and any wander turning) and pins the
   * sprite to this direction — except while the player is talking to them,
   * when they briefly turn to face the player and snap back once dialogue
   * ends. Independent of `stationary`, but typically paired with it for a
   * guard/shopkeeper who should always face a doorway. Unset = look around.
   */
  faceDirection?: Direction;
  /**
   * 2026-06-04 (v1.710) — Lateral gate width. When set to N > 0, the
   * NPC's player-collision rect expands by N tile-widths to the LEFT
   * and N to the RIGHT (no Y change), so the NPC physically spans
   * (1 + 2N) tiles across a corridor. Used for gatekeeper NPCs that
   * must funnel the player through a `talk-to-me` interaction even
   * when their map tile sits in a wider hallway than a single NPC's
   * default 32px hitbox can fill. Marshal Vance in the Trainer Tower
   * lobby uses `gateTilesLR: 1` to plug the 3-tile-wide red carpet
   * approach so players can't sidle past him.
   *
   * Independent of `blocksPassage` (which only releases on trainer
   * defeat). This field has NO defeat condition — the NPC always
   * blocks the expanded rect. For trainer gates that should open
   * after a fight, keep using `blocksPassage` instead.
   */
  gateTilesLR?: number;
  /**
   * 2026-05-13 — Trainer pre-requisite gate. If set, this trainer
   * won't engage in battle until every listed trainer id is in the
   * player's `trainerDefeats` set. Used for boss gating in event
   * dojos (e.g. the Pharaoh's Awakening Sovereign requires the three
   * trial-guardians beaten first). Enforced in `WorldTab.tsx`'s
   * trainer-interaction handler.
   */
  requiredTrainerDefeats?: string[];
  /**
   * 2026-05-13 — Optional override for the "you need to beat X first"
   * notice. If absent, a generic message is generated from the
   * `requiredTrainerDefeats` list.
   */
  prereqBlockedMessage?: string;
}

export interface AnimalDef {
  /** Animal species — a folder under public/world/npcs/Animal/ (e.g. "Dog", "Horse"). */
  type: string;
  /**
   * Sprite sheet basename under that folder, without extension
   * (e.g. "SpriteSheet" for Dog, "SpriteSheetBlack" for the black horse,
   * "SpriteSheeLlioness" for the misspelled lioness). Defaults to
   * "SpriteSheet" when a species has only one sheet.
   */
  sheet: string;
  /** Full sprite PNG url: world/npcs/Animal/<type>/<sheet>.png */
  sprite: string;
  /** Full sprite JSON url (same stem, .json). */
  spriteJson: string;
  tileX: number;
  tileY: number;
  /** How many tiles the animal may stray from its spawn anchor (half-size of a square box centered on spawn). */
  wanderTiles: number;
}

export interface TrainerMonSpec {
  /**
   * If set, resolves from TRAINER_MON_CATALOG. The entry's name / stats /
   * abilities / imageUrl / element / rarity are used verbatim so the
   * trainer's monster is stable and predictable across battles. The spec's
   * `level` is still authoritative (getEffectiveStats scales accordingly).
   * Lets the same unique mon appear as a L3 for a starter trainer and a
   * L12 for a champion.
   */
  specId?: string;
  /** Display name. Leave blank to use a generated default like "Wild Crystal". */
  name?: string;
  element: RealMonsterType;
  rarity: Rarity;
  level: number;
  /**
   * Optional environment hint — biases the wild-pool matcher to prefer
   * cards tagged with this environment id (e.g. "snow", "cave", "forest")
   * so snow trainers carry snow-themed art instead of a random in-pool
   * card that just happens to share the element. Set automatically by
   * the Trainer Battle Creator.
   */
  environment?: string;
  /** Optional pre-existing image URL (e.g. from prod card art). */
  imageUrl?: string;
}

