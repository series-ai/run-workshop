/**
 * Published jam-ready-assets pack versions per leaf ID.
 * Populate after staging & mirroring to jam-ready-assets; local/dev builds
 * resolve directly from tools/run-voxel-characters/out/jam-stage/ or ~/dev/jam-ready-assets.
 */
export const PINS: Readonly<Record<string, string>> = {
  // Example after staging to jam-ready-assets:
  // 'run-voxchar-core/3D/characters': '<12-char-version>',
}
