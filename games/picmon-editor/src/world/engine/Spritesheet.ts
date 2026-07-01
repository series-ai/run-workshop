// Spritesheet renderer using the JSON atlas format
// Handles varied naming conventions across spritesheets:
//   nurse/villager: down01, left01, right01, up01 (4 dirs x 4 frames)
//   professor:      down_left01, down_right01, up01 (3 groups x 4 frames)
//   rival:          down_up01, left01, right01 (3 groups x 3 frames)

import type { Direction } from './types';

export interface SpriteFrame {
  frame: { x: number; y: number; w: number; h: number };
  rotation: number;
}

export interface SpritesheetData {
  frames: Record<string, SpriteFrame>;
  meta: { size: { w: number; h: number } };
}

const sheetCache = new Map<string, SpritesheetData>();
const sheetLoading = new Map<string, Promise<SpritesheetData>>();

export async function loadSpritesheet(jsonPath: string): Promise<SpritesheetData> {
  const cached = sheetCache.get(jsonPath);
  if (cached) return cached;

  const loading = sheetLoading.get(jsonPath);
  if (loading) return loading;

  const promise = fetch(jsonPath)
    .then(r => r.json())
    .then((data: SpritesheetData) => {
      sheetCache.set(jsonPath, data);
      return data;
    });

  sheetLoading.set(jsonPath, promise);
  return promise;
}

export function getSpritesheet(jsonPath: string): SpritesheetData | undefined {
  return sheetCache.get(jsonPath);
}

/**
 * Resolve a game Direction + walk frame into the best matching frame name
 * for a given spritesheet. Handles all naming conventions:
 *
 *  Standard (nurse, villager): down01..04, left01..04, right01..04, up01..04
 *  Professor:                  down_right01..04, down_left01..04, up01..04
 *  Rival:                      down_up01..03, left01..03, right01..03
 *  Player walk.json:           same standard or whatever it has
 */
export function resolveFrame(
  sheetData: SpritesheetData,
  direction: Direction,
  walkFrame: number,
): string | null {
  const frames = sheetData.frames;

  // Build the list of prefixes to try for this direction, in priority order
  const prefixCandidates = directionFallbacks[direction];

  for (const prefix of prefixCandidates) {
    // Count how many frames exist for this prefix
    const count = countFrames(frames, prefix);
    if (count === 0) continue;

    const idx = (walkFrame % count) + 1;
    const name = `${prefix}${String(idx).padStart(2, '0')}`;
    if (frames[name]) return name;
  }

  // Last resort: return the first frame in the sheet
  const allKeys = Object.keys(frames);
  return allKeys.length > 0 ? allKeys[0]! : null;
}

// For each game direction, the ordered list of prefixes to look for.
// The `walk_*` convention is the primary naming in the new character asset
// pack; the un-prefixed variants are kept for the older NPC sheets.
const directionFallbacks: Record<Direction, string[]> = {
  down:  ['walk_down', 'down', 'down_up', 'down_right', 'down_left'],
  up:    ['walk_up', 'up', 'down_up', 'down'],
  left:  ['walk_left', 'left', 'down_left'],
  right: ['walk_right', 'right', 'down_right'],
};

// ── Animal (stand/jump) sprite sheets ──
// Animal sheets use a different naming convention from NPCs:
//   2-frame (dogs, cats, …): right_stand, right_jump
//   4-frame (horses, cow, donkey, lion, …): down_stand, down_jump, right_stand, right_jump
// Up never has frames — left is always rendered by horizontal-flipping the
// right frames. So "supported directions" for roaming are the ones where
// we can find at least a `*_stand` frame (plus `left` iff `right_stand`
// exists and we can flip it).

export interface AnimalFrameResolve {
  /** Frame name to draw, or null if nothing matches. */
  frameName: string | null;
  /** True when the caller must horizontally mirror the drawn frame. */
  flipX: boolean;
}

/**
 * For an animal sheet, work out what to draw for a given facing direction
 * and whether it should be mirrored. `walkFrame` alternates 0 → stand,
 * 1 → jump; higher values wrap (0/2/… = stand, 1/3/… = jump).
 *
 * Design rules:
 *   - Left uses `right_*` horizontally mirrored.
 *   - Up NEVER uses a vertical flip. Instead it falls through to the
 *     right-facing side view, unmirrored — the animal still moves up but
 *     is shown from the side (matches the derpy-run aesthetic for 2-frame
 *     sheets and avoids rendering a down-facing horse while it walks away
 *     from the camera).
 *   - Down uses `down_*` when available, else falls back to right-facing
 *     side view (unmirrored).
 */
export function resolveAnimalFrame(
  sheetData: SpritesheetData,
  direction: Direction,
  walkFrame: number,
): AnimalFrameResolve {
  const frames = sheetData.frames;
  const phase = walkFrame % 2 === 0 ? 'stand' : 'jump';
  const tryName = (dir: string): string | null => {
    const key = `${dir}_${phase}`;
    return frames[key] ? key : null;
  };

  switch (direction) {
    case 'right': {
      const name = tryName('right');
      if (name) return { frameName: name, flipX: false };
      break;
    }
    case 'left': {
      const name = tryName('right');
      if (name) return { frameName: name, flipX: true };
      break;
    }
    case 'down': {
      const name = tryName('down') ?? tryName('right');
      if (name) return { frameName: name, flipX: false };
      break;
    }
    case 'up': {
      // No vertical flip — always render side-on when moving up.
      const name = tryName('right');
      if (name) return { frameName: name, flipX: false };
      break;
    }
  }

  // Last-resort fallbacks — try the stand frame of any direction that exists.
  const fallback = ['right_stand', 'down_stand', 'left_stand', 'up_stand']
    .find((k) => frames[k]);
  return { frameName: fallback ?? null, flipX: false };
}

/**
 * All 4 facings are roamable as long as the sheet has a right-facing stand
 * frame (which every valid animal sheet in the asset pack does). Up and
 * down fall back to the side view via `resolveAnimalFrame` when they're not
 * in the sheet.
 */
export function getAnimalDirections(sheetData: SpritesheetData): Direction[] {
  if (!sheetData.frames['right_stand']) return [];
  return ['up', 'down', 'left', 'right'];
}

/**
 * Draw a sprite frame with optional horizontal flip. Used for animal sprites
 * that only have right-facing frames — left-facing is rendered by mirroring.
 * Signature mirrors drawSprite: destX/destY/destW/destH are the world rect.
 */
export function drawSpriteFlipped(
  ctx: CanvasRenderingContext2D,
  sheetImage: HTMLImageElement,
  sheetData: SpritesheetData,
  frameName: string,
  destX: number,
  destY: number,
  destW: number,
  destH: number,
  flipX: boolean,
) {
  const frameInfo = sheetData.frames[frameName];
  if (!frameInfo) return;
  const { x, y, w, h } = frameInfo.frame;
  if (!flipX && frameInfo.rotation === 0) {
    ctx.drawImage(sheetImage, x, y, w, h, destX, destY, destW, destH);
    return;
  }
  ctx.save();
  ctx.translate(destX + destW / 2, destY + destH / 2);
  if (frameInfo.rotation !== 0) ctx.rotate((frameInfo.rotation * Math.PI) / 180);
  if (flipX) ctx.scale(-1, 1);
  ctx.drawImage(sheetImage, x, y, w, h, -destW / 2, -destH / 2, destW, destH);
  ctx.restore();
}

function countFrames(frames: Record<string, SpriteFrame>, prefix: string): number {
  let count = 0;
  for (let i = 1; i <= 10; i++) {
    const name = `${prefix}${String(i).padStart(2, '0')}`;
    if (frames[name]) count++;
    else break;
  }
  return count;
}

/**
 * Draw a sprite stretched to exactly destW x destH (use when you want exact fill).
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sheetImage: HTMLImageElement,
  sheetData: SpritesheetData,
  frameName: string,
  destX: number,
  destY: number,
  destW: number,
  destH: number,
) {
  const frameInfo = sheetData.frames[frameName];
  if (!frameInfo) return;

  const { x, y, w, h } = frameInfo.frame;
  const rot = frameInfo.rotation;

  if (rot === 0) {
    ctx.drawImage(sheetImage, x, y, w, h, destX, destY, destW, destH);
  } else {
    const cx = destX + destW / 2;
    const cy = destY + destH / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.drawImage(sheetImage, x, y, w, h, -destW / 2, -destH / 2, destW, destH);
    ctx.restore();
  }
}

/**
 * Draw a sprite preserving its natural aspect ratio.
 * Fits within the target width, anchored to the bottom-center of the dest area.
 */
export function drawSpriteFit(
  ctx: CanvasRenderingContext2D,
  sheetImage: HTMLImageElement,
  sheetData: SpritesheetData,
  frameName: string,
  destX: number,
  destY: number,
  fitW: number,
) {
  const frameInfo = sheetData.frames[frameName];
  if (!frameInfo) return;

  const { x, y, w, h } = frameInfo.frame;
  const aspect = h / w;
  const drawW = fitW;
  const drawH = fitW * aspect;
  // Anchor bottom-center: sprite sits on (destX, destY) as its bottom-center
  const dx = destX - drawW / 2;
  const dy = destY - drawH;

  const rot = frameInfo.rotation;
  if (rot === 0) {
    ctx.drawImage(sheetImage, x, y, w, h, dx, dy, drawW, drawH);
  } else {
    const cx = dx + drawW / 2;
    const cy = dy + drawH / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.drawImage(sheetImage, x, y, w, h, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  }
}
