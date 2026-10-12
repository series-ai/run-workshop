/** Paint sign and media atlases outside the main thread. */
import {
  MEDIA_ATLAS_HEIGHT, MEDIA_ATLAS_WIDTH, paintSignMediaAtlas,
  type SignMediaWorkerResponse,
} from './signMedia';
import {
  paintSignAtlas, SIGN_ATLAS_HEIGHT, SIGN_ATLAS_WIDTH,
} from './signAtlas';

self.onmessage = (event: MessageEvent<unknown>): void => {
  const data = event.data;
  let bitmap: ImageBitmap | null = null;
  let signBitmap: ImageBitmap | null = null;
  try {
    if (data === null || typeof data !== 'object' || !('type' in data) || data.type !== 'render') {
      throw new Error('SKYRIVER_SIGN_MEDIA_INVALID_WORKER_REQUEST');
    }
    const signCanvas = new OffscreenCanvas(SIGN_ATLAS_WIDTH, SIGN_ATLAS_HEIGHT);
    paintSignAtlas(signCanvas);
    signBitmap = signCanvas.transferToImageBitmap();

    const mediaCanvas = new OffscreenCanvas(MEDIA_ATLAS_WIDTH, MEDIA_ATLAS_HEIGHT);
    paintSignMediaAtlas(mediaCanvas);
    bitmap = mediaCanvas.transferToImageBitmap();

    const response: SignMediaWorkerResponse = { status: 'success', bitmap, signBitmap };
    self.postMessage(response, { transfer: [bitmap, signBitmap] });
  } catch (error: unknown) {
    try { bitmap?.close(); } catch { /* Ignore close failure. */ }
    try { signBitmap?.close(); } catch { /* Ignore close failure. */ }
    const response: SignMediaWorkerResponse = {
      status: 'error', error: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(response);
  }
};
