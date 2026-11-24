/**
 * jam-ready-assets pack versions per leaf ID.
 * Production builds resolve every GLB exclusively through these pins via
 * RundotGameAPI.assetLibrary.getPackBaseUrl(); local/dev builds resolve from
 * tools/run-voxel-characters/out/jam-stage/ or ~/dev/jam-ready-assets.
 */
export const PINS: Readonly<Record<string, string>> = {
  'run-cubix-core/3D/characters': '391b607a32cd',
  'run-cubix-core/3D/prototype-blocks': '092a17382f8f',
  'run-cubix-heist/3D/characters': '8e17ce9ed7d2',
  'run-cubix-heist/3D/heist': '68a49f5f13cc',
  'run-cubix-industrial/3D/characters': '17865de2b25a',
  'run-cubix-industrial/3D/industrial': 'ae7ff6c41720',
  'run-cubix-security/3D/characters': 'cbdf8c44bf5f',
  'run-cubix-security/3D/security': '2c23ba4cd46d',
  'run-cubix-creatures/3D/characters': 'a2874fef581a',
  'run-cubix-creatures/3D/creatures': 'd2ba24284fb7',
  'run-cubix-fantasy/3D/characters': 'fee13080e3ad',
  'run-cubix-fantasy/3D/fantasy': '39371d3074ed',
  'run-cubix-caverns/3D/dungeon': 'a5c6caa35a75',
  'run-cubix-apocalypse/3D/post-apocalypse': '7313e2582d86',
  'run-cubix-ww2/3D/misc': '1f647d1a683c',
  'run-cubix-medieval/3D/fantasy': 'ed56dc6de278',
}
