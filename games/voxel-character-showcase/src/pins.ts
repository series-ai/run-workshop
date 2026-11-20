/**
 * Published jam-ready-assets pack versions per leaf ID.
 * Production builds resolve every GLB exclusively through these pins via
 * RundotGameAPI.assetLibrary.getPackBaseUrl(); local/dev builds resolve from
 * tools/run-voxel-characters/out/jam-stage/ or ~/dev/jam-ready-assets.
 */
export const PINS: Readonly<Record<string, string>> = {
  'run-cubix-core/3D/characters': '266f19badfd6',
  'run-cubix-heist/3D/characters': '039c68f5ff58',
  'run-cubix-heist/3D/heist': '1ec7e0b5a3b6',
  'run-cubix-industrial/3D/characters': 'fb4dbca189e5',
  'run-cubix-industrial/3D/industrial': '7a68dc4af695',
  'run-cubix-security/3D/characters': 'dfb6df976341',
  'run-cubix-security/3D/security': 'cf2301e9184b',
  'run-cubix-creatures/3D/characters': '25bb137d9e45',
  'run-cubix-creatures/3D/creatures': 'a3b858e52a5a',
  'run-cubix-fantasy/3D/characters': 'b8733fca9230',
  'run-cubix-fantasy/3D/fantasy': '310273339022',
}
