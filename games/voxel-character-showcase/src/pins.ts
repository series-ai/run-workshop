/**
 * jam-ready-assets pack versions per leaf ID.
 * Production builds resolve every GLB exclusively through these pins via
 * RundotGameAPI.assetLibrary.getPackBaseUrl(); local/dev builds resolve from
 * tools/run-voxel-characters/out/jam-stage/ or ~/dev/jam-ready-assets.
 */
export const PINS: Readonly<Record<string, string>> = {
  'run-cubix-core/3D/characters': '69db355d03d7',
  'run-cubix-core/3D/prototype-blocks': 'b0bdad1f50b4',
  'run-cubix-heist/3D/characters': 'a1b2c908ee92',
  'run-cubix-heist/3D/heist': '708ab97ad0f5',
  'run-cubix-industrial/3D/characters': '6a0473ad6f62',
  'run-cubix-industrial/3D/industrial': '730e4448373c',
  'run-cubix-security/3D/characters': '0a56cd055f71',
  'run-cubix-security/3D/security': 'c246f3e6d95d',
  'run-cubix-creatures/3D/characters': '388e883dd8b6',
  'run-cubix-creatures/3D/creatures': '5c7dde42149d',
  'run-cubix-fantasy/3D/characters': '08164c84193f',
  'run-cubix-fantasy/3D/fantasy': '4c18c604c9af',
}
