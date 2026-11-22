/**
 * jam-ready-assets pack versions per leaf ID.
 * Production builds resolve every GLB exclusively through these pins via
 * RundotGameAPI.assetLibrary.getPackBaseUrl(); local/dev builds resolve from
 * tools/run-voxel-characters/out/jam-stage/ or ~/dev/jam-ready-assets.
 */
export const PINS: Readonly<Record<string, string>> = {
  'run-cubix-core/3D/characters': '69db355d03d7',
  'run-cubix-core/3D/prototype-blocks': 'a71d9b9d1ccc',
  'run-cubix-heist/3D/characters': 'a1b2c908ee92',
  'run-cubix-heist/3D/heist': 'b347683b4ed2',
  'run-cubix-industrial/3D/characters': '6a0473ad6f62',
  'run-cubix-industrial/3D/industrial': '1bbf364f19ff',
  'run-cubix-security/3D/characters': '0a56cd055f71',
  'run-cubix-security/3D/security': '10b9d9866874',
  'run-cubix-creatures/3D/characters': '388e883dd8b6',
  'run-cubix-creatures/3D/creatures': 'c9b3fb57eb85',
  'run-cubix-fantasy/3D/characters': '0a8b3b92c977',
  'run-cubix-fantasy/3D/fantasy': '078ed091b34e',
}
