/**
 * Published jam-ready-assets pack versions per leaf ID.
 * Production builds resolve every GLB exclusively through these pins via
 * RundotGameAPI.assetLibrary.getPackBaseUrl(); local/dev builds resolve from
 * tools/run-voxel-characters/out/jam-stage/ or ~/dev/jam-ready-assets.
 */
export const PINS: Readonly<Record<string, string>> = {
  'run-cubix-core/3D/characters': '69db355d03d7',
  'run-cubix-heist/3D/characters': 'a1b2c908ee92',
  'run-cubix-heist/3D/heist': '1ec7e0b5a3b6',
  'run-cubix-industrial/3D/characters': '6a0473ad6f62',
  'run-cubix-industrial/3D/industrial': '7a68dc4af695',
  'run-cubix-security/3D/characters': '0a56cd055f71',
  'run-cubix-security/3D/security': 'cf2301e9184b',
  'run-cubix-creatures/3D/characters': '388e883dd8b6',
  'run-cubix-creatures/3D/creatures': 'a3b858e52a5a',
  'run-cubix-fantasy/3D/characters': '08164c84193f',
  'run-cubix-fantasy/3D/fantasy': '310273339022',
}
