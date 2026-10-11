/**
 * Published jam-ready-assets pack versions, keyed by leaf id. Production
 * builds resolve every file through these pins; a leaf without a pin fails
 * the build (see vite.config.ts). Verify each version against the published
 * manifest/v2/index.json after the asset mirror publishes a new pack.
 */
export const PINS: Readonly<Record<string, string>> = {
  'proofofplay-pirate-nation/3D/pirate': '2ae870ead5c1',
  'proofofplay-pirate-nation/icons': 'ec3e46dfcd27',
  'proofofplay-pirate-nation/ui': '97835c36f9f1',
  'run-voxel-fantasy/3D/characters': 'b4f5356a12bb',
  'run-voxel-fantasy/3D/fantasy': '2cb49a6b15cc',
  'run-voxel-fantasy/icons': 'c62c330a1f5e',
  'run-voxel-fantasy/ui': '905c394c8b3b',
  'run-voxel-monster/3D/characters': '66aba185668f',
  'run-voxel-monster/3D/monster': 'c86f11b0b828',
  'run-voxel-monster/icons': '3db136d140f8',
  'run-voxel-monster/ui': '184063cb6df0',
  'run-voxel-post-apocalypse/3D/characters': 'ce8e9ae74e0b',
  'run-voxel-post-apocalypse/3D/post-apocalypse': 'fad2d501df5b',
  'run-voxel-post-apocalypse/icons': '5a37f417fc17',
  'run-voxel-post-apocalypse/ui': 'ad88b3e6d8b5',
  'run-voxel-space/3D/characters': '8719778bfaf5',
  'run-voxel-space/3D/space-scifi': '64428996a192',
  'run-voxel-space/icons': '4badf8aa4626',
  'run-voxel-space/ui': '08bce374dfbf',
}
