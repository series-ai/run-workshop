/**
 * Client-side video frame extraction using HTMLVideoElement + Canvas.
 * Supports saving to disk (Chrome/Edge) or in-memory blobs (Firefox/others).
 */

export interface ExtractToDiskOptions {
  file: File;
  fps: number; // 0 = "all" (~30fps estimate)
  format: 'png' | 'jpeg' | 'webp';
  startTime: number;
  duration: number;
  directoryHandle: FileSystemDirectoryHandle;
  onProgress: (current: number, total: number) => void;
  signal: AbortSignal;
}

export interface ExtractToMemoryOptions {
  file: File;
  fps: number;
  format: 'png' | 'jpeg' | 'webp';
  startTime: number;
  duration: number;
  onProgress: (current: number, total: number) => void;
  signal: AbortSignal;
}

export interface VideoMeta {
  duration: number;
  width: number;
  height: number;
  src: string; // blob URL — caller must revoke
}

/** Load video metadata. */
export function loadVideoMeta(file: File): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    const src = URL.createObjectURL(file);
    video.onloadedmetadata = () => {
      if (!video.duration || video.duration === Infinity) {
        video.currentTime = 1e10;
        video.onseeked = () => {
          resolve({ duration: video.duration, width: video.videoWidth, height: video.videoHeight, src });
        };
      } else {
        resolve({ duration: video.duration, width: video.videoWidth, height: video.videoHeight, src });
      }
    };
    video.onerror = () => {
      URL.revokeObjectURL(src);
      const ua = navigator.userAgent || '';
      const hasChrome = ua.includes('Chrome') || ua.includes('Chromium');
      const isEdge = ua.includes('Edg/');
      const isChromium = hasChrome && !isEdge && !ua.includes('OPR');
      const hint = isChromium
        ? '\n\nChromium-based browsers may lack H.264 codecs. Try Chrome, Edge, or Firefox instead.'
        : '\n\nTry using a different browser (Chrome, Edge, or Firefox).';
      reject(new Error('Video format not supported by your browser.' + hint));
    };
    video.src = src;
  });
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const handler = () => {
      video.removeEventListener('seeked', handler);
      requestAnimationFrame(() => resolve());
    };
    video.addEventListener('seeked', handler);
    video.currentTime = Math.max(0, Math.min(time, video.duration));
  });
}

/** Estimate blob size per frame in bytes based on format and resolution. */
export function estimateFrameSize(width: number, height: number, format: 'png' | 'jpeg' | 'webp'): number {
  const pixels = width * height;
  // Rough estimates based on typical compression ratios
  if (format === 'jpeg') return Math.round(pixels * 0.15); // ~15% of raw
  if (format === 'webp') return Math.round(pixels * 0.12);  // ~12% of raw
  return Math.round(pixels * 0.8); // PNG — ~80% of raw for photo content, less for simple content
}

/** Estimate total memory cost in bytes. */
export function estimateMemoryCost(
  width: number, height: number, format: 'png' | 'jpeg' | 'webp',
  fps: number, duration: number,
): { frameCount: number; perFrameBytes: number; totalBytes: number } {
  const effectiveFps = fps === 0 ? 30 : fps;
  const frameCount = Math.ceil(duration * effectiveFps);
  const perFrameBytes = estimateFrameSize(width, height, format);
  return { frameCount, perFrameBytes, totalBytes: frameCount * perFrameBytes };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export { formatBytes };

// --- Shared extraction core ---

async function prepareVideo(file: File): Promise<{ video: HTMLVideoElement; src: string }> {
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  const src = URL.createObjectURL(file);
  await new Promise<void>((resolve, reject) => {
    video.oncanplaythrough = () => resolve();
    video.onerror = () => reject(new Error('Failed to load video'));
    video.src = src;
  });
  return { video, src };
}

function getExportSettings(format: 'png' | 'jpeg' | 'webp') {
  const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  const quality = format === 'png' ? undefined : 0.92;
  const ext = format === 'jpeg' ? 'jpg' : format;
  return { mimeType, quality, ext };
}

/** Extract frames and save directly to a directory on disk (Chrome/Edge). */
export async function extractFramesToDisk(options: ExtractToDiskOptions): Promise<string[]> {
  const { file, fps, format, startTime, duration, directoryHandle, onProgress, signal } = options;
  const effectiveFps = fps === 0 ? 30 : fps;
  const totalFrames = Math.ceil(duration * effectiveFps);
  const { mimeType, quality, ext } = getExportSettings(format);
  const digits = Math.max(2, String(totalFrames).length);

  const { video, src } = await prepareVideo(file);

  try {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;

    const fileNames: string[] = [];

    for (let i = 0; i < totalFrames; i++) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

      const time = startTime + i / effectiveFps;
      if (time > startTime + duration) break;

      await seekTo(video, time);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0);

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), mimeType, quality);
      });

      const name = `frame_${String(i + 1).padStart(digits, '0')}.${ext}`;
      const fileHandle = await directoryHandle.getFileHandle(name, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();

      fileNames.push(name);
      onProgress(i + 1, totalFrames);
    }

    return fileNames;
  } finally {
    URL.revokeObjectURL(src);
  }
}

/** Extract frames to in-memory File objects (Firefox/fallback). */
export async function extractFramesToMemory(options: ExtractToMemoryOptions): Promise<File[]> {
  const { file, fps, format, startTime, duration, onProgress, signal } = options;
  const effectiveFps = fps === 0 ? 30 : fps;
  const totalFrames = Math.ceil(duration * effectiveFps);
  const { mimeType, quality, ext } = getExportSettings(format);
  const digits = Math.max(2, String(totalFrames).length);

  const { video, src } = await prepareVideo(file);

  try {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;

    const files: File[] = [];

    for (let i = 0; i < totalFrames; i++) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

      const time = startTime + i / effectiveFps;
      if (time > startTime + duration) break;

      await seekTo(video, time);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0);

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), mimeType, quality);
      });

      const name = `frame_${String(i + 1).padStart(digits, '0')}.${ext}`;
      files.push(new File([blob], name, { type: mimeType }));

      onProgress(i + 1, totalFrames);
    }

    return files;
  } finally {
    URL.revokeObjectURL(src);
  }
}

/** Read files back from a directory handle as File objects. */
export async function readFilesFromDirectory(
  directoryHandle: FileSystemDirectoryHandle,
  fileNames: string[],
): Promise<File[]> {
  const files: File[] = [];
  for (const name of fileNames) {
    try {
      const handle = await directoryHandle.getFileHandle(name);
      const file = await handle.getFile();
      files.push(file);
    } catch { /* skip */ }
  }
  return files;
}

/** Delete specific files from a directory. */
export async function deleteFilesFromDirectory(
  directoryHandle: FileSystemDirectoryHandle,
  fileNames: string[],
): Promise<void> {
  for (const name of fileNames) {
    try { await directoryHandle.removeEntry(name); } catch { /* ignore */ }
  }
}
