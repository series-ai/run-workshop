import { removeBackgroundLocal, type BgModelId } from './localBgRemoval';

export type ProgressCallback = (phase: string, progress: number) => void;
export type { BgModelId };

/**
 * Remove the background from an image blob. Runs locally in the browser via
 * ONNX Runtime Web + Apache-2.0 segmentation models — no API key, no uploads.
 * Returns a PNG blob with transparent background.
 */
export async function removeImageBackground(
  imageBlob: Blob,
  onProgress?: ProgressCallback,
  model: BgModelId = 'isnet',
): Promise<Blob> {
  return removeBackgroundLocal(imageBlob, model, onProgress);
}
