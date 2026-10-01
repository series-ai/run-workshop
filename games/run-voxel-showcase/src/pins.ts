/**
 * Published jam-ready-assets pack versions, keyed by leaf id. Production
 * builds resolve every file through these pins; a leaf without a pin fails
 * the build (see vite.config.ts). The RUN voxel pins are the versions the
 * mirror published for jam-ready-assets 782e3a095 (#13): update them
 * from manifest/v2/index.json of the run-asset-library bucket when the packs change.
 */
export const PINS: Readonly<Record<string, string>> = {
  'proofofplay-pirate-nation/3D/pirate': '2ae870ead5c1',
  'proofofplay-pirate-nation/icons': 'ec3e46dfcd27',
  'proofofplay-pirate-nation/ui': '97835c36f9f1',
  'run-voxel-fantasy/3D/characters': '8e9bc17b093e',
  'run-voxel-fantasy/3D/fantasy': '394a50607b14',
  'run-voxel-fantasy/icons': '52eaddc568f4',
  'run-voxel-fantasy/ui': 'b4f1d873244a',
  'run-voxel-monster/3D/characters': '80dd57f4aebc',
  'run-voxel-monster/3D/monster': '51d7c4babfa8',
  'run-voxel-monster/icons': '91288ab8c591',
  'run-voxel-monster/ui': '4d03b0c0d647',
  'run-voxel-post-apocalypse/3D/characters': '0d2f7179c0bb',
  'run-voxel-post-apocalypse/3D/post-apocalypse': 'e25238d4f204',
  'run-voxel-post-apocalypse/icons': 'b2718af4846c',
  'run-voxel-post-apocalypse/ui': '02df8c45b050',
  'run-voxel-space/3D/characters': 'd18f373433f5',
  'run-voxel-space/3D/space-scifi': '64e4caab2158',
  'run-voxel-space/icons': '5405db5699f2',
  'run-voxel-space/ui': '5a178dd3452c',
}
