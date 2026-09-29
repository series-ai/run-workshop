/**
 * Published jam-ready-assets pack versions, keyed by leaf id. Production
 * builds resolve every file through these pins; a leaf without a pin fails
 * the build (see vite.config.ts). RUN voxel leaves get pins after their
 * jam-ready-assets PR merges and the mirror publishes them.
 */
export const PINS: Readonly<Record<string, string>> = {
  'proofofplay-pirate-nation/3D/pirate': '2ae870ead5c1',
  'proofofplay-pirate-nation/icons': 'ec3e46dfcd27',
  'proofofplay-pirate-nation/ui': '97835c36f9f1',
}
