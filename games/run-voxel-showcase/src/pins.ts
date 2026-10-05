/**
 * Published jam-ready-assets pack versions, keyed by leaf id. Production
 * builds resolve every file through these pins; a leaf without a pin fails
 * the build (see vite.config.ts). The RUN voxel pins are the versions the
 * mirror published for jam-ready-assets c66d19ff4 (#14): update them
 * from manifest/v2/index.json of the run-asset-library bucket when the packs change.
 */
export const PINS: Readonly<Record<string, string>> = {
  'proofofplay-pirate-nation/3D/pirate': '2ae870ead5c1',
  'proofofplay-pirate-nation/icons': 'ec3e46dfcd27',
  'proofofplay-pirate-nation/ui': '97835c36f9f1',
  'run-voxel-fantasy/3D/characters': 'b4f5356a12bb',
  'run-voxel-fantasy/3D/fantasy': '9c54ac6915ae',
  'run-voxel-fantasy/icons': '0b60daada47b',
  'run-voxel-fantasy/ui': '905c394c8b3b',
  'run-voxel-monster/3D/characters': '66aba185668f',
  'run-voxel-monster/3D/monster': '23dee8a98dd6',
  'run-voxel-monster/icons': 'c125eacbf540',
  'run-voxel-monster/ui': '184063cb6df0',
  'run-voxel-post-apocalypse/3D/characters': 'ce8e9ae74e0b',
  'run-voxel-post-apocalypse/3D/post-apocalypse': '0d43a579c800',
  'run-voxel-post-apocalypse/icons': '8804011192b8',
  'run-voxel-post-apocalypse/ui': 'ad88b3e6d8b5',
  'run-voxel-space/3D/characters': '8719778bfaf5',
  'run-voxel-space/3D/space-scifi': '8f832e2688d1',
  'run-voxel-space/icons': '5315f2a1f364',
  'run-voxel-space/ui': '08bce374dfbf',
}
