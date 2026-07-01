// Battle-backdrop frame resolver — reads per-map default + per-patch overrides
// straight off the map JSON files (MAP_CATALOG). The map editor at /editor
// writes those fields; here we just look them up.
//
// Resolution priority at battle time:
//   1. map.grassPatchBackgrounds[`${signTx},${signTy}`]  (when the player
//      triggered the encounter from a tagged grass patch)
//   2. map.battleBgFrame                                  (per-map default)
//   3. 'forest'                                           (built-in fallback)
//
// Frames live in public/world/backgrounds/battlebackgrounds1.png — the 8
// names below match the JSON keys in the matching .json sidecar.
//
// 2026-06-03 (v1.696) — Added 'tower' as a STANDALONE frame. The existing
// battlebackgrounds1.png sheet is fully packed (8 hand-painted frames in
// a 4x2 grid) so the tower arena was generated as its own 384x688 portrait
// PNG at public/world/backgrounds/battlebg-tower.png. The render path in
// GameCanvas.renderBattleBackground checks STANDALONE_BG_FRAMES first and
// loads the standalone image directly; everything else still goes through
// the sheet+sidecar lookup. The editor's FrameThumb has a parallel check.

import { MAP_CATALOG } from '../world/data/maps';

export type BgFrameName =
  | 'town'
  | 'villageruin'
  | 'desert'
  | 'cave'
  | 'dojo'
  | 'forest'
  | 'fencepath'
  | 'snowtown'
  | 'tower';

export const BG_FRAME_NAMES: BgFrameName[] = [
  'town',
  'villageruin',
  'desert',
  'cave',
  'dojo',
  'forest',
  'fencepath',
  'snowtown',
  'tower',
];

/**
 * Frames that live in their own standalone PNG instead of the packed
 * battlebackgrounds1.png sheet. Renderers/editor thumbnails must special-
 * case these. Map: frameName -> public-relative PNG path (no leading slash
 * — matches the convention used by GameCanvas asset loading).
 */
export const STANDALONE_BG_FRAMES: Partial<Record<BgFrameName, string>> = {
  tower: 'world/backgrounds/battlebg-tower.png',
};

const BG_FRAME_SET: Set<string> = new Set(BG_FRAME_NAMES);

export const BG_FALLBACK_FRAME: BgFrameName = 'forest';

export function patchOverrideKey(signTx: number, signTy: number): string {
  return `${signTx},${signTy}`;
}

function asFrameName(v: string | undefined): BgFrameName | undefined {
  if (!v) return undefined;
  return BG_FRAME_SET.has(v) ? (v as BgFrameName) : undefined;
}

/**
 * Resolve which frame to draw for a battle on `mapId`. If `patchSignTile` is
 * supplied and that patch has an override, it wins; otherwise the per-map
 * default; otherwise the forest fallback. Pure — safe to call every frame.
 */
export function resolveBattleBgFrame(
  mapId: string | undefined,
  patchSignTile?: { tx: number; ty: number } | null,
): BgFrameName {
  if (!mapId) return BG_FALLBACK_FRAME;
  const m = MAP_CATALOG[mapId];
  if (!m) return BG_FALLBACK_FRAME;
  if (patchSignTile && m.grassPatchBackgrounds) {
    const k = patchOverrideKey(patchSignTile.tx, patchSignTile.ty);
    const override = asFrameName(m.grassPatchBackgrounds[k]);
    if (override) return override;
  }
  const def = asFrameName(m.battleBgFrame);
  if (def) return def;
  return BG_FALLBACK_FRAME;
}
