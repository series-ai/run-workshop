// Type-only stand-in for the game's village-restoration save slice. In the
// full game this persists per-building restoration progress to appStorage;
// the editor's Play mode never restores buildings, so only the shape is
// needed (Overworld's OverworldState.villageProgress is typed against it).

export interface BuildingProgress {
  /** 0 = ruined, 1..totalStages = progressively restored */
  stage: number;
  /** imageUrl per stage; index 0 is unused (stage 0 has no generated art). */
  stageImages: string[];
  /** When this building was first interacted with. */
  firstTouchedAt?: number;
  /** When the most recent stage completed. */
  lastAdvancedAt?: number;
}

export type VillageProgress = Record<string, BuildingProgress>;
