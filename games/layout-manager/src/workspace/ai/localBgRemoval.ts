/**
 * Local background removal — ONNX Runtime Web (MIT) + Apache-2.0 segmentation
 * models. Replaces @imgly/background-removal (AGPL, not redistributable in
 * run-workshop). Everything runs in the browser; no API key, no uploads.
 *
 * Models (both Apache-2.0, by Xuebin Qin et al., ONNX exports hosted by the
 * rembg project's model releases):
 *  - ISNet general-use (DIS) — high quality, ~170 MB, 1024x1024 input
 *  - U2-Net small (u2netp)   — fast fallback,  ~4.5 MB,  320x320 input
 */
import * as ort from 'onnxruntime-web/wasm';
import { registerAiSession, unregisterAiSession } from './aiSessionRegistry';
// Deep imports — onnxruntime-web's package exports don't expose dist/, so
// these go through the filesystem; Vite fingerprints them into the bundle.
import ortWasmUrl from '../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url';
import ortMjsUrl from '../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url';

export type BgModelId = 'isnet' | 'u2netp';

interface ModelSpec {
  url: string;
  inputSize: number;
  /** Per-channel normalization: (v/255 - mean) / std */
  mean: [number, number, number];
  std: [number, number, number];
}

const MODELS: Record<BgModelId, ModelSpec> = {
  isnet: {
    url: 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx',
    inputSize: 1024,
    mean: [0.5, 0.5, 0.5],
    std: [1, 1, 1],
  },
  u2netp: {
    url: 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx',
    inputSize: 320,
    mean: [0.485, 0.456, 0.406],
    std: [0.229, 0.224, 0.225],
  },
};

const MODEL_CACHE = 'lm-bg-models-v1';

export type ProgressCallback = (phase: string, progress: number) => void;

/** Fetch the model, serving from the browser Cache API after first download.
 * GitHub release assets don't carry CORP headers, so the download goes through
 * the dev server's /__proxy to stay same-origin under COEP: require-corp. */
async function fetchModel(spec: ModelSpec, onProgress?: ProgressCallback): Promise<ArrayBuffer> {
  const cache = await caches.open(MODEL_CACHE);
  const cached = await cache.match(spec.url);
  if (cached) return cached.arrayBuffer();

  const resp = await fetch(`/__proxy?url=${encodeURIComponent(spec.url)}`);
  if (!resp.ok || !resp.body) throw new Error(`Model download failed (${resp.status})`);

  const total = Number(resp.headers.get('content-length')) || 0;
  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    const mb = (received / 1024 / 1024).toFixed(0);
    onProgress?.(
      total ? `Downloading model... ${mb} MB` : `Downloading model... ${mb} MB`,
      total ? received / total : 0,
    );
  }
  const buf = new Uint8Array(received);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.length; }

  await cache.put(spec.url, new Response(buf.slice().buffer, {
    headers: { 'Content-Type': 'application/octet-stream' },
  })).catch(() => { /* cache quota — still usable this session */ });
  return buf.buffer;
}

const sessions = new Map<BgModelId, Promise<ort.InferenceSession>>();

const SESSION_LABELS: Record<BgModelId, { label: string; sizeHint: string }> = {
  isnet: { label: 'Bg removal — Quality (ISNet)', sizeHint: '~500 MB' },
  u2netp: { label: 'Bg removal — Fast (U2-Net)', sizeHint: '~40 MB' },
};

function getSession(model: BgModelId, onProgress?: ProgressCallback): Promise<ort.InferenceSession> {
  let s = sessions.get(model);
  if (!s) {
    s = (async () => {
      ort.env.wasm.wasmPaths = { wasm: ortWasmUrl, mjs: ortMjsUrl };
      // Run inference in a dedicated worker so the UI thread stays responsive;
      // clamp threads to what the machine actually has (0/undefined can
      // deadlock the pthread pool in some environments).
      ort.env.wasm.proxy = true;
      ort.env.wasm.numThreads = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
      const weights = await fetchModel(MODELS[model], onProgress);
      onProgress?.('Loading model...', 0);
      const session = await ort.InferenceSession.create(weights, { executionProviders: ['wasm'] });
      // Let the MEM tool see and evict the resident model (reloads from
      // browser cache on next use — a few seconds, no re-download)
      registerAiSession(`bg-${model}`, {
        ...SESSION_LABELS[model],
        release: async () => {
          sessions.delete(model);
          await session.release();
        },
      });
      return session;
    })();
    sessions.set(model, s);
    s.catch(() => sessions.delete(model)); // let a failed load retry
  }
  return s;
}

/** Release all loaded background-removal models (freeing their WASM memory). */
export async function releaseBgSessions(): Promise<void> {
  for (const [model, p] of Array.from(sessions.entries())) {
    sessions.delete(model);
    unregisterAiSession(`bg-${model}`);
    try { (await p).release(); } catch { /* never loaded */ }
  }
}

/** Remove the background from an image blob. Returns a PNG blob with alpha. */
export async function removeBackgroundLocal(
  imageBlob: Blob,
  model: BgModelId = 'isnet',
  onProgress?: ProgressCallback,
): Promise<Blob> {
  const spec = MODELS[model];
  const session = await getSession(model, onProgress);

  const bitmap = await createImageBitmap(imageBlob);
  const { width: w, height: h } = bitmap;

  // Preprocess: stretch-resize to the model's square input, normalize NCHW
  onProgress?.('Preparing image...', 0);
  const size = spec.inputSize;
  const pre = document.createElement('canvas');
  pre.width = size;
  pre.height = size;
  const pctx = pre.getContext('2d', { willReadFrequently: true })!;
  pctx.drawImage(bitmap, 0, 0, size, size);
  const px = pctx.getImageData(0, 0, size, size).data;
  const input = new Float32Array(3 * size * size);
  const plane = size * size;
  for (let i = 0; i < plane; i++) {
    input[i] = (px[i * 4]! / 255 - spec.mean[0]) / spec.std[0];
    input[plane + i] = (px[i * 4 + 1]! / 255 - spec.mean[1]) / spec.std[1];
    input[plane * 2 + i] = (px[i * 4 + 2]! / 255 - spec.mean[2]) / spec.std[2];
  }

  onProgress?.('Removing background...', 0.2);
  const tensor = new ort.Tensor('float32', input, [1, 3, size, size]);
  const outputs = await session.run({ [session.inputNames[0]!]: tensor });
  const out = outputs[session.outputNames[0]!]!.data as Float32Array;

  // Postprocess: min-max normalize the first output map to a 0..255 mask
  onProgress?.('Compositing...', 0.8);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < plane; i++) {
    const v = out[i]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  const maskData = pctx.createImageData(size, size);
  for (let i = 0; i < plane; i++) {
    const a = Math.round(((out[i]! - min) / range) * 255);
    maskData.data[i * 4] = 255;
    maskData.data[i * 4 + 1] = 255;
    maskData.data[i * 4 + 2] = 255;
    maskData.data[i * 4 + 3] = a;
  }
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = size;
  maskCanvas.height = size;
  maskCanvas.getContext('2d')!.putImageData(maskData, 0, 0);

  // Composite: original image, alpha = bilinearly-upscaled mask
  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const octx = outCanvas.getContext('2d')!;
  octx.drawImage(bitmap, 0, 0);
  octx.globalCompositeOperation = 'destination-in';
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(maskCanvas, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => outCanvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Failed to encode result');
  onProgress?.('Done', 1);
  return blob;
}
