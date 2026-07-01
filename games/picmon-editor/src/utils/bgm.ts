// No-op audio stub for the standalone editor. The ported overworld only
// touches audio via a fire-and-forget `playSfx('teleport')` on portal travel
// (lazy-imported in Overworld.ts) and an optional `setFootstepActive` in the
// game loop. The editor demo runs silent; these keep the imports resolving.

export type SfxId = string;

export function playSfx(_id: SfxId): void {
  /* silent in the editor */
}

export function setFootstepActive(_active: boolean): void {
  /* silent in the editor */
}
