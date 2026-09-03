/**
 * Camera and orientation configurations for 3D model previews and stage views.
 */

/** Standard three-quarter yaw for assets authored facing -Z (ships, buildings, props, animals, etc.). */
export const DEFAULT_MODEL_PREVIEW_YAW = Math.PI - Math.PI / 5

/** Character rig models are authored facing +X, so they need a -90° turn (with 3/4 yaw) to face forward. */
export const CHARACTER_MODEL_PREVIEW_YAW = -Math.PI / 2 - Math.PI / 5

export const MODEL_PREVIEW_YAW = DEFAULT_MODEL_PREVIEW_YAW

/** Returns the front three-quarter view yaw for a model given its category. */
export function getModelPreviewYaw(category?: string): number {
  if (category === 'characters-skins') {
    return CHARACTER_MODEL_PREVIEW_YAW
  }
  return DEFAULT_MODEL_PREVIEW_YAW
}
