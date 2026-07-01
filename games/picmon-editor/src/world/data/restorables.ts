// Catalog of restorable buildings in the village. Each entry defines a world
// region (in tile coordinates) and a set of restoration stages. Progress is
// driven by the player spending Stardust and kicks off AI art generation via
// RundotGameAPI.imageGen to produce the "next stage" image for that slot.
//
// Add more buildings by appending new entries here — no engine changes required.

export interface RestorableStage {
  label: string;
  /** Text description of this stage used as prompt flavor. */
  description: string;
  /** Stardust cost to UNLOCK this stage (stage 0 is free / default). */
  cost: number;
  /** Alternate cost in Statue Fragments (PvP-earned). When set, this becomes
   *  the primary payment method and cost (Stardust) is ignored. */
  fragmentCost?: number;
  /** Pixel-art prompt appended to the base prompt to nudge the AI. */
  promptHint: string;
  /**
   * Pre-baked CDN asset path for this stage (fetched via RundotGameAPI.cdn).
   * Produced by the in-browser Art Forge (admin panel) and committed to
   * `cdn/`. When present the renderer uses this instead of any per-player
   * runtime-generated URL, so every player sees the same restored art and
   * no login is required.
   */
  assetPath?: string;
}

export interface RestorableDef {
  id: string;
  name: string;
  flavor: string;
  /** Top-left tile coord of the building footprint in the map. */
  tileX: number;
  tileY: number;
  /** Footprint size in tiles. */
  widthTiles: number;
  heightTiles: number;
  stages: RestorableStage[];
}

export const RESTORABLES: RestorableDef[] = [
  {
    id: 'founder-statue',
    name: "Founder's Statue",
    flavor: 'Crumbling stone statue honoring the village founder.',
    tileX: 16,
    tileY: 10,
    widthTiles: 2,
    heightTiles: 3,
    stages: [
      {
        label: 'Ruined',
        description: 'Cracked, moss-covered, missing an arm.',
        cost: 0,
        promptHint: 'heavily damaged, cracked, moss-covered, missing parts',
      },
      {
        label: 'Re-carved',
        description: 'The outline is restored but the surface is rough.',
        cost: 75,
        fragmentCost: 1,
        promptHint:
          'partially restored, outline repaired, surface rough and unfinished, ' +
          'scaffolding cleared, still weathered but standing tall',
        assetPath: 'village/founder-statue-stage-1.png',
      },
      {
        label: 'Polished',
        description: 'Clean lines, engraved inscription visible.',
        cost: 200,
        fragmentCost: 3,
        promptHint:
          'well-restored, clean lines, engraved inscription visible, surface smooth, ' +
          'sharp details, standing proudly',
        assetPath: 'village/founder-statue-stage-2.png',
      },
      {
        label: 'Radiant',
        description: 'Gleaming, flanked by fresh flowers and torches.',
        cost: 500,
        fragmentCost: 5,
        promptHint:
          'pristine and radiant, gleaming polished stone, fresh flowers at the base, ' +
          'lit torches on either side, heroic silhouette, golden hour light',
        assetPath: 'village/founder-statue-stage-3.png',
      },
    ],
  },
];

/** Base prompt every restoration generation starts with. Keeps art style consistent. */
export const RESTORATION_BASE_PROMPT =
  'Pixel art in the exact same retro 16-bit RPG tilemap style as the reference image. ' +
  'Same subject, same camera angle, same lighting, same proportions, same color palette. ' +
  'Transparent background, chunky pixels, bold outlines. No text, no UI.';

export function getRestorable(id: string): RestorableDef | undefined {
  return RESTORABLES.find((r) => r.id === id);
}
