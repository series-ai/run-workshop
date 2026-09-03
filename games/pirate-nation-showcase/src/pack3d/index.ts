/**
 * `pack3d` — the reusable half of this showcase.
 *
 * Everything a RUN app needs to render Pirate Nation models correctly:
 * a canvas preset that carries the depth-buffer fix, a model component that
 * clones and places by catalogue bounds, and bounds-driven layout helpers.
 * See ./README.md.
 */
export { PackCanvas, STAGE_COLORS, type PackCanvasProps, type StageBackdrop } from './PackCanvas'
export { PackModel, type PackModelProps } from './PackModel'
export {
  modelTransform,
  type ModelAnchor,
  type ModelBounds,
  type ModelPlacement,
  type ModelTransformOptions,
  type Vec3Tuple,
} from './modelTransform'
export { layoutRow, type LayoutItem, type LayoutPlacement, type LayoutRowOptions } from './layout'
export { FitCamera, type FitCameraProps } from './FitCamera'
export { ViewerErrorBoundary } from './ViewerErrorBoundary'
export {
  CHARACTER_MODEL_PREVIEW_YAW,
  DEFAULT_MODEL_PREVIEW_YAW,
  getModelPreviewYaw,
  MODEL_PREVIEW_YAW,
} from './modelViewConfig'
