import type { ImageNode, ProjectFile, CanvasRect, ScaleFilter, RulerGuide } from './types';

/**
 * Convert a blob/object URL to a base64 data URL.
 */
function toDataUrl(src: string): Promise<string> {
  // Already a data URL
  if (src.startsWith('data:')) return Promise.resolve(src);

  return fetch(src)
    .then((r) => r.blob())
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }),
    );
}

/** Convert a data: URL to a blob: URL. Pass-through for blob: URLs and empty/null. */
function dataToBlobUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('blob:')) return url;
  if (!url.startsWith('data:')) return url;
  const [header, base64] = url.split(',');
  const mime = header!.match(/:(.*?);/)?.[1] ?? 'image/png';
  const bytes = atob(base64!);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return URL.createObjectURL(new Blob([arr], { type: mime }));
}

/** Pass-through for empty/null; convert blob: URLs to data: URLs otherwise. */
async function toDataUrlOrNull(src: string | null | undefined): Promise<string | null> {
  if (!src) return null;
  return toDataUrl(src);
}

export async function buildProjectBlob(
  images: ImageNode[],
  pan: { x: number; y: number },
  zoom: number,
  canvas?: CanvasRect | null,
  scaleFilter?: ScaleFilter,
  guides?: RulerGuide[],
  canvasBgColor?: string | null,
): Promise<Blob> {
  const serializedImages = await Promise.all(
    images.map(async (img) => {
      const [dataUrl, maskDataUrl, paintOverlayUrl, paintUnderlayUrl, paintCompositeUrl, paintLayers] = await Promise.all([
        toDataUrl(img.src),
        toDataUrlOrNull(img.maskDataUrl),
        toDataUrlOrNull(img.paintOverlayUrl),
        toDataUrlOrNull(img.paintUnderlayUrl),
        toDataUrlOrNull(img.paintCompositeUrl),
        img.paintLayers
          ? Promise.all(img.paintLayers.map(async (l) => ({
              ...l,
              dataUrl: l.dataUrl ? await toDataUrl(l.dataUrl) : '',
            })))
          : Promise.resolve(null),
      ]);
      const { src: _src, ...rest } = img;
      return { ...rest, dataUrl, maskDataUrl, paintOverlayUrl, paintUnderlayUrl, paintCompositeUrl, paintLayers };
    }),
  );

  const project: ProjectFile = {
    version: 1,
    images: serializedImages,
    pan,
    zoom,
    canvas: canvas ?? null,
    scaleFilter: scaleFilter ?? 'bicubic',
    guides: guides ?? [],
    canvasBgColor: canvasBgColor ?? null,
  };

  return new Blob([JSON.stringify(project)], { type: 'application/json' });
}

// Current file handle for "Save" (reuse without prompt)
let currentFileHandle: FileSystemFileHandle | null = null;

// Absolute on-disk path of the current project, when known (captured from
// file:// drop URIs). Lets "Save" rewrite the file in place via the dev
// server — works even in browsers without the File System Access API (Brave).
let currentFilePath: string | null = null;

export function getCurrentFileHandle(): FileSystemFileHandle | null {
  return currentFileHandle;
}

export function setCurrentFileHandle(handle: FileSystemFileHandle | null) {
  currentFileHandle = handle;
}

export function getCurrentFilePath(): string | null {
  return currentFilePath;
}

export function setCurrentFilePath(path: string | null) {
  currentFilePath = path;
}

/**
 * Save Project — writes to the existing file handle if one exists,
 * or downloads with the stored project name. Otherwise falls through to Save As.
 * Returns the project name used (or null if cancelled).
 */
export async function saveProject(
  images: ImageNode[],
  pan: { x: number; y: number },
  zoom: number,
  canvas?: CanvasRect | null,
  scaleFilter?: ScaleFilter,
  projectName?: string | null,
  guides?: RulerGuide[],
  canvasBgColor?: string | null,
): Promise<{ name: string } | null> {
  if (currentFileHandle) {
    const blob = await buildProjectBlob(images, pan, zoom, canvas, scaleFilter, guides, canvasBgColor);
    const writable = await currentFileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { name: currentFileHandle.name };
  }
  // Known on-disk path (from a file:// drop) — rewrite the file in place
  // through the dev server. True save-in-place without the FS Access API.
  if (currentFilePath) {
    const blob = await buildProjectBlob(images, pan, zoom, canvas, scaleFilter, guides, canvasBgColor);
    const resp = await fetch('/__save-layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: currentFilePath, data: await blob.text() }),
    });
    if (!resp.ok) throw new Error(`Save failed: ${await resp.text()}`);
    return { name: currentFilePath.split('/').pop()!.split('\\').pop()! };
  }
  // No file handle but have a project name — download silently with that name
  if (projectName) {
    const blob = await buildProjectBlob(images, pan, zoom, canvas, scaleFilter, guides, canvasBgColor);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = projectName.endsWith('.layout') ? projectName : `${projectName}.layout`;
    a.click();
    URL.revokeObjectURL(url);
    return { name: projectName };
  }
  // No existing handle or name — fall through to Save As
  return saveProjectAs(images, pan, zoom, canvas, scaleFilter, guides, canvasBgColor);
}

/**
 * Save Project As — always prompts the user for a file name/location.
 * Must call the file picker BEFORE any async work to preserve the user gesture.
 * Returns the chosen name (or null if cancelled).
 */
export async function saveProjectAs(
  images: ImageNode[],
  pan: { x: number; y: number },
  zoom: number,
  canvas?: CanvasRect | null,
  scaleFilter?: ScaleFilter,
  guides?: RulerGuide[],
  canvasBgColor?: string | null,
): Promise<{ name: string } | null> {
  if ('showSaveFilePicker' in window) {
    try {
      // Open picker immediately while user gesture is still active
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: currentFileHandle?.name ?? currentFilePath?.split('/').pop() ?? 'layout.layout',
        types: [
          {
            description: 'Layout Project',
            accept: { 'application/json': ['.layout'] },
          },
        ],
      });
      // Now build the blob and write
      const blob = await buildProjectBlob(images, pan, zoom, canvas, scaleFilter, guides, canvasBgColor);
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      currentFileHandle = handle;
      currentFilePath = null; // the handle is now the save target
      return { name: handle.name };
    } catch (e: any) {
      if (e.name === 'AbortError') return null;
      throw e;
    }
  }

  // Fallback for browsers without File System Access API
  const name = prompt('Save project as:', currentFilePath?.split('/').pop() ?? 'layout.layout');
  if (!name) return null;
  currentFilePath = null; // Save As targets a new (downloaded) file
  const fileName = name.endsWith('.layout') ? name : `${name}.layout`;
  const blob = await buildProjectBlob(images, pan, zoom, canvas, scaleFilter, guides, canvasBgColor);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return { name: fileName };
}

/**
 * Load a project from a .layout file and remember its handle for future saves.
 */
export function loadProject(file: File, fileHandle?: FileSystemFileHandle): Promise<{
  images: ImageNode[];
  pan: { x: number; y: number };
  zoom: number;
  canvas?: CanvasRect | null;
  scaleFilter?: ScaleFilter;
  guides?: RulerGuide[];
  canvasBgColor?: string | null;
}> {
  // Opening a project resets the save target — a stale handle/path from a
  // previously opened file must never be silently overwritten by Ctrl+S.
  currentFileHandle = fileHandle ?? null;
  currentFilePath = null;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const project: ProjectFile = JSON.parse(reader.result as string);
        if (project.version !== 1) {
          reject(new Error('Unsupported project version'));
          return;
        }
        const images: ImageNode[] = project.images.map((img) => {
          const { dataUrl, ...rest } = img;
          // Convert all heavy data: URLs to blob: URLs so the bytes live in
          // browser-managed Blob storage instead of as base64 strings on the
          // JS heap. Reduces memory footprint dramatically for large projects.
          const src = dataToBlobUrl(dataUrl)!;
          const maskDataUrl = dataToBlobUrl(rest.maskDataUrl ?? null);
          const paintOverlayUrl = dataToBlobUrl(rest.paintOverlayUrl ?? null);
          const paintUnderlayUrl = dataToBlobUrl(rest.paintUnderlayUrl ?? null);
          const paintCompositeUrl = dataToBlobUrl(rest.paintCompositeUrl ?? null);
          const paintLayers = rest.paintLayers
            ? rest.paintLayers.map((l) => l.dataUrl ? { ...l, dataUrl: dataToBlobUrl(l.dataUrl) ?? '' } : l)
            : rest.paintLayers;
          return {
            ...rest,
            src,
            maskDataUrl,
            paintOverlayUrl,
            paintUnderlayUrl,
            paintCompositeUrl,
            paintLayers,
            locked: rest.locked ?? false,
            opacity: rest.opacity ?? 1,
            spriteName: rest.spriteName ?? '',
            parentId: rest.parentId ?? null,
            basePosition: rest.basePosition ?? null,
            offsetPosition: rest.offsetPosition ?? null,
            layerOrder: rest.layerOrder ?? 'above',
            replacesParent: rest.replacesParent ?? false,
            flipH: rest.flipH ?? false,
            flipV: rest.flipV ?? false,
          };
        });
        resolve({ images, pan: project.pan, zoom: project.zoom, canvas: project.canvas ?? null, scaleFilter: project.scaleFilter ?? 'bicubic', guides: project.guides ?? [], canvasBgColor: project.canvasBgColor ?? null });
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
