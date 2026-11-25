/**
 * jam-ready-assets pack versions per leaf id. Production builds load every model and sound
 * through these pins with RundotGameAPI.assetLibrary.getPackBaseUrl(); local builds serve the
 * files from a jam-ready-assets checkout or the tool's build output (see vite.config.js).
 *
 * After the pack is merged in jam-ready-assets and mirrored, copy each leaf's `version` from
 * manifest/v2/index.json here, and refresh src/kit.json from the same build (npm run sync-kit).
 */
export const KIT_LEAF = 'run-trainspotter/3D/vehicles-racing';
export const AUDIO_LEAF = 'run-trainspotter/audio';

export const PINS = {
  [KIT_LEAF]: 'bb1349b93d49',
  [AUDIO_LEAF]: 'bd29ad54bb58',
};
