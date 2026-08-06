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

export type BgModelId = 'isnet' | 'u2netp' | 'birefnet';

interface ModelSpec {
  url: string;
  inputSize: number;
  /** Per-channel normalization: (v/255 - mean) / std */
  mean: [number, number, number];
  std: [number, number, number];
  /** Output map needs a sigmoid before min-max normalization */
  sigmoid?: boolean;
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
  // BiRefNet (full, MIT) at 512x512, fp16 — the only variant that fits the
  // WASM heap: 1024-input exports (full and Lite, fp32 and fp16) all abort
  // with an activation OOM during inference; at 512 the activations are a
  // quarter the size and inference lands in seconds.
  birefnet: {
    url: 'https://huggingface.co/onnx-community/BiRefNet_512x512-ONNX/resolve/main/onnx/model_fp16.onnx',
    inputSize: 512,
    mean: [0.485, 0.456, 0.406],
    std: [0.229, 0.224, 0.225],
    sigmoid: true,
  },
};

const MODEL_CACHE = 'lm-bg-models-v1';

// Evict cached models we no longer use (earlier BiRefNet attempts that OOM
// the WASM heap) so they don't waste hundreds of MB of browser storage
const LEGACY_MODEL_URLS = [
  'https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-general-bb_swin_v1_tiny-epoch_232.onnx',
  'https://huggingface.co/onnx-community/BiRefNet_lite/resolve/main/onnx/model.onnx',
  'https://huggingface.co/onnx-community/BiRefNet_lite/resolve/main/onnx/model_fp16.onnx',
];
caches.open(MODEL_CACHE).then((c) => LEGACY_MODEL_URLS.forEach((u) => c.delete(u))).catch(() => {});

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

// In-flight inference per model — every release path awaits this first so a
// session is never freed under an active run on the shared WASM heap
const inFlight = new Map<BgModelId, Promise<unknown>>();

async function safeRelease(model: BgModelId, p: Promise<ort.InferenceSession>): Promise<void> {
  let session: ort.InferenceSession;
  try { session = await p; } catch { return; } // never finished loading
  try { await inFlight.get(model); } catch { /* failed runs still finish */ }
  try { await session.release(); } catch { /* already released */ }
}

// Idle auto-unload: a loaded model holds hundreds of MB of WASM heap, so if
// it hasn't been used for a while, release it. Weights stay in the browser
// cache — the next use reloads in seconds, no re-download.
const IDLE_UNLOAD_MS = 15 * 60 * 1000;
const lastUsed = new Map<BgModelId, number>();
let idleTimer: ReturnType<typeof setInterval> | null = null;

function touchSession(model: BgModelId): void {
  lastUsed.set(model, Date.now());
}

function ensureIdleTimer(): void {
  if (idleTimer) return;
  idleTimer = setInterval(() => {
    for (const [model, p] of Array.from(sessions.entries())) {
      const idle = Date.now() - (lastUsed.get(model) ?? 0);
      if (idle < IDLE_UNLOAD_MS) continue;
      sessions.delete(model);
      lastUsed.delete(model);
      unregisterAiSession(`bg-${model}`);
      void safeRelease(model, p);
    }
    if (sessions.size === 0 && idleTimer) {
      clearInterval(idleTimer);
      idleTimer = null;
    }
  }, 60 * 1000);
}

const SESSION_LABELS: Record<BgModelId, { label: string; sizeHint: string }> = {
  isnet: { label: 'Bg removal — Quality (ISNet)', sizeHint: '~500 MB' },
  u2netp: { label: 'Bg removal — Fast (U2-Net)', sizeHint: '~40 MB' },
  birefnet: { label: 'Bg removal — Best (BiRefNet)', sizeHint: '~1 GB' },
};

// Serializes evict+create critical sections: overlapping loads of different
// models would otherwise race and release each other mid-load
let loadChain: Promise<unknown> = Promise.resolve();

function getSession(model: BgModelId, onProgress?: ProgressCallback): Promise<ort.InferenceSession> {
  let s = sessions.get(model);
  if (!s) {
    s = (async () => {
      // Wait for any in-progress load/eviction to fully settle first
      const prev = loadChain;
      let release!: () => void;
      loadChain = new Promise<void>((r) => { release = r; });
      try {
        await prev.catch(() => { /* prior load failed — heap is free */ });
        // All models share ONE WASM heap (the proxy worker) with a hard size
        // ceiling — two resident models can't fit, so evict the others first.
        // Their weights stay in the browser cache; re-loading takes seconds.
        for (const [other, p] of Array.from(sessions.entries())) {
          if (other === model) continue;
          sessions.delete(other);
          unregisterAiSession(`bg-${other}`);
          await safeRelease(other, p);
        }
        return await createSession(model, onProgress);
      } finally {
        release();
      }
    })();
    sessions.set(model, s);
    s.catch(() => sessions.delete(model)); // let a failed load retry
    ensureIdleTimer();
  }
  touchSession(model);
  return s;
}

async function createSession(model: BgModelId, onProgress?: ProgressCallback): Promise<ort.InferenceSession> {
  ort.env.wasm.wasmPaths = { wasm: ortWasmUrl, mjs: ortMjsUrl };
      // Run inference in a dedicated worker so the UI thread stays responsive;
      // clamp threads to what the machine actually has (0/undefined can
      // deadlock the pthread pool in some environments).
      ort.env.wasm.proxy = true;
      ort.env.wasm.numThreads = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
      const weights = await fetchModel(MODELS[model], onProgress);
      onProgress?.('Loading model...', 0);
      // Arena/mem-pattern off: large models (BiRefNet) otherwise abort the
      // WASM heap with a raw-number OOM during session init/inference
      let session: ort.InferenceSession;
      try {
        session = await ort.InferenceSession.create(weights, {
          executionProviders: ['wasm'],
          enableCpuMemArena: false,
          enableMemPattern: false,
        });
      } catch (e) {
        const msg = String(e instanceof Error ? e.message : e);
        if (/allocate|memory|abort|\d{8,}/i.test(msg)) {
          throw new Error('Not enough browser memory to load the model. Use Free Memory in the MEM tool (top toolbar), or reload the tab, then try again.');
        }
        throw e;
      }
      // Let the MEM tool see and evict the resident model (reloads from
      // browser cache on next use — a few seconds, no re-download)
  // Let the MEM tool see and evict the resident model (reloads from
  // browser cache on next use — a few seconds, no re-download)
  registerAiSession(`bg-${model}`, {
    ...SESSION_LABELS[model],
    release: async () => {
      sessions.delete(model);
      try { await inFlight.get(model); } catch { /* ignore */ }
      await session.release();
    },
  });
  return session;
}

/** True when generating with this model won't trigger a fresh download —
 * either the session is live or the weights are in the browser cache. */
export async function isModelReady(model: BgModelId): Promise<boolean> {
  if (sessions.has(model)) return true;
  try {
    const cache = await caches.open(MODEL_CACHE);
    return !!(await cache.match(MODELS[model].url));
  } catch {
    return false;
  }
}

/** Release all loaded background-removal models (freeing their WASM memory). */
export async function releaseBgSessions(): Promise<void> {
  for (const [model, p] of Array.from(sessions.entries())) {
    sessions.delete(model);
    unregisterAiSession(`bg-${model}`);
    await safeRelease(model, p);
  }
}

/** Run the model on a source and return its foreground matte scaled to
 * outW x outH (0 = background, 255 = foreground). The expensive part —
 * inference — happens here once; matte refinement is cheap post-processing. */
export async function computeMatte(
  source: CanvasImageSource,
  outW: number,
  outH: number,
  model: BgModelId = 'isnet',
  onProgress?: ProgressCallback,
): Promise<Uint8ClampedArray> {
  const spec = MODELS[model];
  const session = await getSession(model, onProgress);

  // Guard the ENTIRE session-use window (preprocess through run) so an
  // eviction from another model's load can't free this session between
  // getSession returning and the run starting
  let finishUse!: () => void;
  const useGuard = new Promise<void>((r) => { finishUse = r; });
  const prevFlight = inFlight.get(model);
  inFlight.set(model, prevFlight ? prevFlight.then(() => useGuard) : useGuard);

  let out: Float32Array;
  try {
    // Preprocess: stretch-resize to the model's square input, normalize NCHW
    onProgress?.('Preparing image...', 0);
    const size = spec.inputSize;
    const pre = document.createElement('canvas');
    pre.width = size;
    pre.height = size;
    const pctx0 = pre.getContext('2d', { willReadFrequently: true })!;
    pctx0.drawImage(source, 0, 0, size, size);
    const px = pctx0.getImageData(0, 0, size, size).data;
    const input = new Float32Array(3 * size * size);
    const plane0 = size * size;
    for (let i = 0; i < plane0; i++) {
      input[i] = (px[i * 4]! / 255 - spec.mean[0]) / spec.std[0];
      input[plane0 + i] = (px[i * 4 + 1]! / 255 - spec.mean[1]) / spec.std[1];
      input[plane0 * 2 + i] = (px[i * 4 + 2]! / 255 - spec.mean[2]) / spec.std[2];
    }

    onProgress?.('Removing background...', 0.2);
    const tensor = new ort.Tensor('float32', input, [1, 3, size, size]);
    const outputs = await session.run({ [session.inputNames[0]!]: tensor });
    out = outputs[session.outputNames[0]!]!.data as Float32Array;
  } finally {
    finishUse();
  }
  const size = spec.inputSize;
  const plane = size * size;
  const pctx = document.createElement('canvas').getContext('2d')!;

  // Postprocess: (sigmoid for models that output logits, then) min-max
  // normalize the first output map to a 0..255 mask
  const val = spec.sigmoid
    ? (i: number) => 1 / (1 + Math.exp(-out[i]!))
    : (i: number) => out[i]!;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < plane; i++) {
    const v = val(i);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  const maskData = pctx.createImageData(size, size);
  for (let i = 0; i < plane; i++) {
    const a = Math.round(((val(i) - min) / range) * 255);
    maskData.data[i * 4] = 255;
    maskData.data[i * 4 + 1] = 255;
    maskData.data[i * 4 + 2] = 255;
    maskData.data[i * 4 + 3] = a;
  }
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = size;
  maskCanvas.height = size;
  maskCanvas.getContext('2d')!.putImageData(maskData, 0, 0);

  // Bilinear-scale the matte to the requested size and read its alpha
  const scaled = document.createElement('canvas');
  scaled.width = outW;
  scaled.height = outH;
  const sctx = scaled.getContext('2d', { willReadFrequently: true })!;
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(maskCanvas, 0, 0, outW, outH);
  const sd = sctx.getImageData(0, 0, outW, outH).data;
  const matte = new Uint8ClampedArray(outW * outH);
  for (let p = 0; p < matte.length; p++) matte[p] = sd[p * 4 + 3]!;
  return matte;
}

/** Remove the background from an image blob. Returns a PNG blob with alpha.
 * Optional matte refinement ops (hardness/contract/smooth/feather) are given
 * in preview-scale pixels (`opsScaleRef` = the preview's long side) and are
 * scaled up for the full-resolution pass so results match the preview. */
export async function removeBackgroundLocal(
  imageBlob: Blob,
  model: BgModelId = 'isnet',
  onProgress?: ProgressCallback,
  opts?: { hardness?: number; contract?: number; smooth?: number; feather?: number; opsScaleRef?: number; keepShadows?: boolean },
): Promise<Blob> {
  const bitmap = await createImageBitmap(imageBlob);
  const { width: w, height: h } = bitmap;

  const matte = await computeMatte(bitmap, w, h, model, onProgress);
  onProgress?.('Compositing...', 0.8);

  if (opts && ((opts.hardness ?? 0) > 0 || opts.contract || opts.smooth || opts.feather)) {
    const { refineMatte } = await import('./matteOps');
    const s = opts.opsScaleRef ? Math.max(1, Math.max(w, h) / opts.opsScaleRef) : 1;
    const refined = refineMatte(matte, w, h, {
      hardness: opts.hardness,
      contract: Math.round((opts.contract ?? 0) * s),
      smooth: Math.round((opts.smooth ?? 0) * s),
      feather: Math.round((opts.feather ?? 0) * s),
    });
    matte.set(refined);
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const octx = outCanvas.getContext('2d')!;
  octx.drawImage(bitmap, 0, 0);

  if (opts?.keepShadows) {
    // Shadow double pass on the AI matte — pixel math on the original image
    const { applyMatteWithShadows } = await import('./matteOps');
    const id = octx.getImageData(0, 0, w, h);
    applyMatteWithShadows(id, matte);
    octx.putImageData(id, 0, 0);
  } else {
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = w;
    maskCanvas.height = h;
    const mctx = maskCanvas.getContext('2d')!;
    const maskData = mctx.createImageData(w, h);
    for (let p = 0; p < matte.length; p++) {
      maskData.data[p * 4] = 255;
      maskData.data[p * 4 + 1] = 255;
      maskData.data[p * 4 + 2] = 255;
      maskData.data[p * 4 + 3] = matte[p]!;
    }
    mctx.putImageData(maskData, 0, 0);
    octx.globalCompositeOperation = 'destination-in';
    octx.drawImage(maskCanvas, 0, 0, w, h);
  }
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => outCanvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Failed to encode result');
  onProgress?.('Done', 1);
  return blob;
}
