/**
 * Published jam-ready-assets pack versions per leaf ID.
 * Populate after staging & mirroring to jam-ready-assets; local/dev builds
 * resolve directly from tools/run-poly-packs/out/jam-stage/ or ~/dev/jam-ready-assets.
 */
export const PINS: Readonly<Record<string, string>> = {
  // Example after staging to jam-ready-assets:
  // 'run-poly-core/3D/characters': '<12-char-version>',
}
