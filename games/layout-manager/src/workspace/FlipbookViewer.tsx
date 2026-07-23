import { useState, useRef, useCallback, useEffect, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { VideoExtractModal } from './VideoExtractModal';
import { deleteFilesFromDirectory } from './videoFrameExtractor';
import { encodeGif } from './gifExport';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-m4v', 'video/x-matroska'];
const VIDEO_EXTENSIONS = ['.mp4', '.m4v', '.webm', '.ogg', '.ogv', '.mov', '.mkv'];

function isVideoFile(file: File): boolean {
  if (ACCEPTED_VIDEO_TYPES.includes(file.type)) return true;
  const name = file.name.toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => name.endsWith(ext));
}
const ACCEPT_STRING = [...ACCEPTED_TYPES, ...ACCEPTED_VIDEO_TYPES].join(',');

interface FlipbookFile {
  id: string;
  name: string;
  src: string;
  thumbSrc: string;
  file: File;
  selected: boolean;
}

const THUMB_MAX = 200; // max thumbnail dimension — matches the size slider max

function generateThumbnail(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(THUMB_MAX / img.naturalWidth, THUMB_MAX / img.naturalHeight, 1);
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        resolve(blob ? URL.createObjectURL(blob) : src);
      });
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

// --- Memoized grid item: only re-renders when its own file/size changes ---
const FlipbookGridItem = memo(function FlipbookGridItem({
  file,
  index,
  thumbnailSize,
  onToggle,
}: {
  file: FlipbookFile;
  index: number;
  thumbnailSize: number;
  onToggle: (id: string) => void;
}) {
  return (
    <div
      className={`flipbook-grid-item${file.selected ? ' flipbook-grid-item-selected' : ''}`}
      onClick={() => onToggle(file.id)}
    >
      {file.thumbSrc ? (
        <img
          src={file.thumbSrc}
          alt={file.name}
          className="flipbook-grid-thumb"
          draggable={false}
          loading="lazy"
          decoding="async"
          style={{ width: thumbnailSize, height: thumbnailSize }}
        />
      ) : (
        <div className="flipbook-grid-thumb flipbook-grid-thumb-loading" style={{ width: thumbnailSize, height: thumbnailSize }} />
      )}
      <div className="flipbook-grid-info">
        <span className="flipbook-grid-name" title={file.name}>{file.name}</span>
        <span className="flipbook-grid-index">#{index + 1}</span>
      </div>
      {file.selected && <div className="flipbook-grid-check">&#10003;</div>}
    </div>
  );
});

// --- Memoized grid: does NOT re-render when currentFrame/isPlaying change ---
const FlipbookGrid = memo(function FlipbookGrid({
  files,
  thumbnailSize,
  onToggle,
}: {
  files: FlipbookFile[];
  thumbnailSize: number;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flipbook-grid" style={{ '--thumb-size': `${thumbnailSize}px` } as React.CSSProperties}>
      {files.map((file, index) => (
        <FlipbookGridItem
          key={file.id}
          file={file}
          index={index}
          thumbnailSize={thumbnailSize}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
});

// --- Main viewer ---
interface FlipbookViewerProps {
  onImportFiles: (files: File[], originX: number, originY: number, suggestedName?: string) => void;
  viewCenter: { x: number; y: number };
  onClose: () => void;
}

export function FlipbookViewer({ onImportFiles, viewCenter, onClose }: FlipbookViewerProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [files, setFiles] = useState<FlipbookFile[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(12);
  const [loop, setLoop] = useState(true);
  const [thumbnailSize, setThumbnailSize] = useState(100);
  const [dragOver, setDragOver] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [gifProgress, setGifProgress] = useState<{ done: number; total: number } | null>(null);
  // Track directory handle and all extracted file names for cleanup
  const extractDirRef = useRef<FileSystemDirectoryHandle | null>(null);
  const extractFileNamesRef = useRef<string[]>([]);

  // Refs to avoid stale closures in the animation timer
  const stateRef = useRef({ currentFrame, isPlaying, fps, loop, files });
  stateRef.current = { currentFrame, isPlaying, fps, loop, files };

  // Memoize selected files — only recomputes when files array changes, not on frame ticks
  const selectedFiles = useMemo(() => files.filter((f) => f.selected), [files]);
  const currentImage = selectedFiles[currentFrame];
  const selectedCount = selectedFiles.length;

  // Cleanup on unmount — revoke all blob URLs for frames not imported
  const filesRef = useRef(files);
  filesRef.current = files;
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      // Revoke all remaining blob URLs
      for (const f of filesRef.current) {
        URL.revokeObjectURL(f.src);
        if (f.thumbSrc) URL.revokeObjectURL(f.thumbSrc);
      }
    };
  }, []);

  // Close on Escape, Space to toggle play
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') {
        e.preventDefault();
        const s = stateRef.current;
        const hasSelected = s.files.some((f) => f.selected);
        if (!hasSelected) return;
        if (s.isPlaying) {
          stopPlayback();
        } else {
          startPlayback();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const loadFiles = useCallback((newFiles: FileList | File[]) => {
    const accepted = Array.from(newFiles).filter((f) => ACCEPTED_TYPES.includes(f.type));
    if (accepted.length === 0) return;

    const loaded: FlipbookFile[] = accepted.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      src: URL.createObjectURL(file),
      thumbSrc: '', // placeholder — generated async below
      file,
      selected: false,
    }));

    setFiles((prev) => {
      const merged = [...prev, ...loaded];
      merged.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
      return merged;
    });
    setCurrentFrame(0);
    stopPlayback();

    // Generate thumbnails in the background, update files as each completes
    for (const entry of loaded) {
      generateThumbnail(entry.src).then((thumbSrc) => {
        setFiles((prev) => prev.map((f) => (f.id === entry.id ? { ...f, thumbSrc } : f)));
      });
    }
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, selected: !f.selected } : f)));
  }, []);

  const selectAll = useCallback(() => {
    setFiles((prev) => prev.map((f) => ({ ...f, selected: true })));
  }, []);

  const clearSelection = useCallback(() => {
    setFiles((prev) => prev.map((f) => ({ ...f, selected: false })));
  }, []);

  const clearAll = useCallback(() => {
    stopPlayback();
    files.forEach((f) => {
      URL.revokeObjectURL(f.src);
      if (f.thumbSrc) URL.revokeObjectURL(f.thumbSrc);
    });
    setFiles([]);
    setCurrentFrame(0);
  }, [files]);

  // --- Playback ---
  const stopPlayback = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const startPlayback = useCallback(() => {
    const s = stateRef.current;
    const selCount = s.files.filter((f) => f.selected).length;
    if (selCount === 0) return;

    setIsPlaying(true);

    const animate = () => {
      const cur = stateRef.current;
      if (!cur.isPlaying) return;

      const count = cur.files.filter((f) => f.selected).length;
      if (count === 0) return;

      const next = cur.currentFrame + 1;
      if (next >= count) {
        if (cur.loop) {
          setCurrentFrame(0);
        } else {
          setIsPlaying(false);
          setCurrentFrame(0);
          return;
        }
      } else {
        setCurrentFrame(next);
      }

      timerRef.current = setTimeout(animate, 1000 / cur.fps);
    };

    timerRef.current = setTimeout(animate, 1000 / s.fps);
  }, []);

  const handleStop = useCallback(() => {
    stopPlayback();
    setCurrentFrame(0);
  }, [stopPlayback]);

  // --- Import selected into workspace ---
  const handleImport = useCallback(async () => {
    const selected = files.filter((f) => f.selected);
    if (selected.length === 0) return;

    // Derive a suggested name from the source
    let suggestedName: string | undefined;
    if (sourceName) {
      suggestedName = sourceName;
    } else if (selected.length > 0) {
      // Use first file name without extension and trailing numbers
      suggestedName = selected[0]!.file.name.replace(/\.[^.]+$/, '').replace(/[\d_-]+$/, '');
    }

    onImportFiles(
      selected.map((f) => f.file),
      viewCenter.x,
      viewCenter.y,
      suggestedName,
    );

    // If frames came from video extraction, offer to delete unselected files
    const dirHandle = extractDirRef.current;
    const allNames = extractFileNamesRef.current;
    if (dirHandle && allNames.length > 0) {
      const selectedNames = new Set(selected.map((f) => f.file.name));
      const unselectedNames = allNames.filter((n) => !selectedNames.has(n));
      if (unselectedNames.length > 0) {
        const shouldDelete = window.confirm(
          `Delete ${unselectedNames.length} unselected frame${unselectedNames.length !== 1 ? 's' : ''} from the output folder?`,
        );
        if (shouldDelete) {
          await deleteFilesFromDirectory(dirHandle, unselectedNames);
        }
      }
    }

    onClose();
  }, [files, sourceName, onImportFiles, viewCenter, onClose]);

  // --- Export selection as animated GIF ---
  const handleExportGif = useCallback(async () => {
    const selected = filesRef.current.filter((f) => f.selected);
    if (selected.length === 0 || gifProgress) return;
    const s = stateRef.current;
    try {
      setGifProgress({ done: 0, total: selected.length });
      const blob = await encodeGif(
        selected.map((f) => f.src),
        s.fps,
        s.loop,
        (done, total) => setGifProgress({ done, total }),
      );
      const base = sourceName
        || selected[0]!.file.name.replace(/\.[^.]+$/, '').replace(/[\d_-]+$/, '')
        || 'flipbook';
      const name = `${base}.gif`;
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as unknown as { showSaveFilePicker: (o: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
            suggestedName: name,
            types: [{ description: 'GIF Animation', accept: { 'image/gif': ['.gif'] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch (e) {
          if ((e as Error).name !== 'AbortError') throw e;
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('GIF export failed:', e);
      alert(`GIF export failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setGifProgress(null);
    }
  }, [gifProgress, sourceName]);

  // --- Drag/drop & overlay ---
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    },
    [onClose],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);

      // Check for video files
      const droppedFiles = Array.from(e.dataTransfer.files);
      const videoFiles = droppedFiles.filter((f) => isVideoFile(f));
      if (videoFiles.length === 1 && droppedFiles.length === 1) {
        setVideoFile(videoFiles[0]!);
        return;
      }

      // Check for directory entries via webkitGetAsEntry
      const items = e.dataTransfer.items;
      const entries: FileSystemEntry[] = [];
      if (items) {
        for (let i = 0; i < items.length; i++) {
          const entry = items[i]!.webkitGetAsEntry?.();
          if (entry) entries.push(entry);
        }
      }

      const hasDirectory = entries.some((e) => e.isDirectory);
      if (hasDirectory) {
        // Recursively collect files from directories
        const allFiles: File[] = [];
        const readEntry = (entry: FileSystemEntry): Promise<void> => {
          if (entry.isFile) {
            return new Promise((resolve) => {
              (entry as FileSystemFileEntry).file((f) => { allFiles.push(f); resolve(); }, () => resolve());
            });
          }
          if (entry.isDirectory) {
            return new Promise((resolve) => {
              const reader = (entry as FileSystemDirectoryEntry).createReader();
              const readBatch = () => {
                reader.readEntries(async (batch) => {
                  if (batch.length === 0) { resolve(); return; }
                  await Promise.all(batch.map(readEntry));
                  readBatch(); // directories can return entries in batches
                }, () => resolve());
              };
              readBatch();
            });
          }
          return Promise.resolve();
        };
        await Promise.all(entries.map(readEntry));
        if (allFiles.length > 0) loadFiles(allFiles);
      } else if (e.dataTransfer.files.length > 0) {
        loadFiles(e.dataTransfer.files);
      }
    },
    [loadFiles],
  );

  return createPortal(
    <div
      className={`flipbook-overlay${dragOver ? ' flipbook-overlay-dragover' : ''}`}
      ref={overlayRef}
      onClick={handleOverlayClick}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
      onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
      onDragLeave={(e) => { if (e.target === overlayRef.current) setDragOver(false); }}
      onDrop={handleDrop}
    >
      <div className="flipbook-panel" onPointerDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flipbook-header">
          <h2>Flipbook Viewer</h2>
          <span className="flipbook-count">
            {files.length} file{files.length !== 1 ? 's' : ''}
            {selectedCount > 0 && <> &middot; {selectedCount} selected</>}
          </span>
          <button className="flipbook-close" onClick={onClose} title="Close (Esc)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {files.length === 0 ? (
          /* Empty / drop zone */
          <div className={`flipbook-drop-zone${dragOver ? ' flipbook-drop-zone-active' : ''}`}>
            <div className="flipbook-drop-content">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="2" />
                <path d="M7 2v20" />
                <path d="M12 2v20" />
                <path d="M17 2v20" />
              </svg>
              <h3>Load Image Sequence</h3>
              <p>Drag and drop images, a folder, or a video file here</p>
              <button className="flipbook-choose-btn" onClick={() => fileInputRef.current?.click()}>
                Choose Files
              </button>
            </div>
          </div>
        ) : (
          /* Main content — two-column layout */
          <div className="flipbook-main">
            {/* Left column: controls + thumbnail grid */}
            <div className="flipbook-left">
              <div className="flipbook-controls">
                <div className="flipbook-controls-left">
                  <button className="flipbook-btn" onClick={selectAll}>Select All</button>
                  <button className="flipbook-btn" onClick={clearSelection}>Clear</button>
                  <button className="flipbook-btn" onClick={() => fileInputRef.current?.click()}>Load More</button>
                  <button className="flipbook-btn flipbook-btn-danger" onClick={clearAll}>Reset</button>
                </div>
                <div className="flipbook-controls-right">
                  <label className="flipbook-size-label">Size</label>
                  <input
                    type="range"
                    min="50"
                    max="200"
                    value={thumbnailSize}
                    onChange={(e) => setThumbnailSize(parseInt(e.target.value, 10))}
                    className="flipbook-size-slider"
                  />
                  <span className="flipbook-size-value">{thumbnailSize}px</span>
                </div>
              </div>

              <div className="flipbook-grid-area">
                <FlipbookGrid files={files} thumbnailSize={thumbnailSize} onToggle={toggleSelection} />
              </div>
            </div>

            {/* Right column: preview + transport + import */}
            <div className="flipbook-right">
              {selectedCount === 0 ? (
                <div className="flipbook-no-selection">Select images to preview animation</div>
              ) : (
                <>
                  <div className="flipbook-preview">
                    {currentImage ? (
                      <img src={currentImage.src} alt={currentImage.name} className="flipbook-preview-img" draggable={false} />
                    ) : (
                      <div className="flipbook-preview-empty">No frame</div>
                    )}
                  </div>

                  <div className="flipbook-transport">
                    <div className="flipbook-transport-row">
                      <button className="flipbook-btn flipbook-btn-transport" onClick={isPlaying ? stopPlayback : startPlayback} title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}>
                        {isPlaying ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
                        )}
                      </button>
                      <button className="flipbook-btn flipbook-btn-transport" onClick={handleStop} title="Stop">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" /></svg>
                      </button>

                      <div className="flipbook-fps">
                        <label>FPS</label>
                        <input
                          type="number"
                          min="1"
                          max="60"
                          value={fps}
                          onChange={(e) => setFps(Math.max(1, Math.min(60, parseInt(e.target.value, 10) || 1)))}
                          className="flipbook-fps-input"
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>

                      <label className="flipbook-loop-label">
                        <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
                        Loop
                      </label>
                    </div>

                    <div className="flipbook-frame-row">
                      <span className="flipbook-frame-label">Frame {currentFrame + 1} / {selectedCount}</span>
                      <input
                        type="range"
                        min="0"
                        max={Math.max(0, selectedCount - 1)}
                        value={currentFrame}
                        onChange={(e) => setCurrentFrame(parseInt(e.target.value, 10))}
                        className="flipbook-frame-slider"
                      />
                    </div>
                  </div>

                  <div className="flipbook-import-area">
                    {currentImage && (
                      <div className="flipbook-frame-info">
                        <span className="flipbook-frame-name">{currentImage.name}</span>
                      </div>
                    )}
                    <button className="flipbook-import-btn" onClick={handleImport} disabled={selectedCount === 0}>
                      Import Selected ({selectedCount})
                    </button>
                    <button
                      className="flipbook-btn flipbook-gif-btn"
                      onClick={handleExportGif}
                      disabled={selectedCount === 0 || !!gifProgress}
                      title="Export the selected frames as an animated GIF at the current FPS and loop setting"
                    >
                      {gifProgress ? `Encoding… ${gifProgress.done}/${gifProgress.total}` : `Export GIF (${selectedCount})`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_STRING}
          multiple
          onChange={(e) => {
            if (!e.target.files) return;
            const picked = Array.from(e.target.files);
            const vids = picked.filter((f) => isVideoFile(f));
            if (vids.length === 1 && picked.length === 1) {
              setVideoFile(vids[0]!);
            } else {
              loadFiles(e.target.files);
            }
            e.target.value = '';
          }}
          className="hidden-file-input"
        />
      </div>

      {/* Video extraction modal */}
      {videoFile && (
        <VideoExtractModal
          videoFile={videoFile}
          onExtract={(extractedFiles, dirHandle, allFileNames) => {
            extractDirRef.current = dirHandle;
            extractFileNamesRef.current = allFileNames;
            setSourceName(videoFile.name.replace(/\.[^.]+$/, ''));
            setVideoFile(null);
            loadFiles(extractedFiles);
          }}
          onCancel={() => setVideoFile(null)}
        />
      )}
    </div>,
    document.body,
  );
}
