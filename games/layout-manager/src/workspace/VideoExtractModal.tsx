import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  loadVideoMeta, extractFramesToDisk, extractFramesToMemory,
  readFilesFromDirectory, estimateMemoryCost, formatBytes,
} from './videoFrameExtractor';
import type { VideoMeta } from './videoFrameExtractor';

const HAS_DIRECTORY_PICKER = 'showDirectoryPicker' in window;

interface VideoExtractModalProps {
  videoFile: File;
  onExtract: (files: File[], directoryHandle: FileSystemDirectoryHandle | null, allFileNames: string[]) => void;
  onCancel: () => void;
}

const FPS_OPTIONS = [1, 5, 10, 15, 24, 30, 0] as const;
const FORMAT_OPTIONS: Array<{ value: 'png' | 'jpeg' | 'webp'; label: string }> = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPG' },
  { value: 'webp', label: 'WebP' },
];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VideoExtractModal({ videoFile, onExtract, onCancel }: VideoExtractModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFps, setSelectedFps] = useState<number>(10);
  const [format, setFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [startTime, setStartTime] = useState(0);
  const [clipDuration, setClipDuration] = useState(10);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [mode, setMode] = useState<'folder' | 'memory'>(HAS_DIRECTORY_PICKER ? 'folder' : 'memory');

  const needsClip = meta ? meta.duration > 10 : false;
  const effectiveDuration = meta ? (needsClip ? Math.min(clipDuration, meta.duration - startTime) : meta.duration) : 0;
  const effectiveStart = needsClip ? startTime : 0;

  useEffect(() => {
    loadVideoMeta(videoFile).then((m) => {
      setMeta(m);
      if (m.duration <= 10) setClipDuration(m.duration);
    }).catch((err) => {
      setError(err.message || 'Failed to load video');
    });
  }, [videoFile]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (extracting) abortRef.current?.abort();
        else onCancel();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel, extracting]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current && !extracting) onCancel();
    },
    [onCancel, extracting],
  );

  const getFrameCount = useCallback((fps: number) => {
    const f = fps === 0 ? 30 : fps;
    return Math.ceil(effectiveDuration * f);
  }, [effectiveDuration]);

  // Memory estimation
  const memEstimate = meta ? estimateMemoryCost(meta.width, meta.height, format, selectedFps, effectiveDuration) : null;

  const getMemoryWarning = (): { level: 'ok' | 'warn' | 'danger'; message: string } | null => {
    if (!memEstimate || mode === 'folder') return null;
    const { totalBytes } = memEstimate;
    if (totalBytes > 1024 * 1024 * 1024) {
      return { level: 'danger', message: `Estimated ~${formatBytes(totalBytes)} in memory. This may crash the browser. Use a lower FPS, switch to JPG, or use Chrome/Edge to save to a folder instead.` };
    }
    if (totalBytes > 500 * 1024 * 1024) {
      return { level: 'warn', message: `Estimated ~${formatBytes(totalBytes)} in memory. This is heavy. Consider a lower FPS or JPG format.` };
    }
    if (totalBytes > 200 * 1024 * 1024) {
      return { level: 'warn', message: `Estimated ~${formatBytes(totalBytes)} in memory.` };
    }
    return null;
  };

  const memWarning = getMemoryWarning();

  const handleExtract = useCallback(async () => {
    if (!meta) return;

    const controller = new AbortController();
    abortRef.current = controller;

    if (mode === 'folder') {
      // Chrome/Edge: save to folder
      let dirHandle: FileSystemDirectoryHandle;
      try {
        dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        setError('Failed to select folder');
        return;
      }

      setExtracting(true);
      setProgress({ current: 0, total: getFrameCount(selectedFps) });

      try {
        const fileNames = await extractFramesToDisk({
          file: videoFile,
          fps: selectedFps,
          format,
          startTime: effectiveStart,
          duration: effectiveDuration,
          directoryHandle: dirHandle,
          onProgress: (current, t) => setProgress({ current, total: t }),
          signal: controller.signal,
        });
        const files = await readFilesFromDirectory(dirHandle, fileNames);
        if (meta.src) URL.revokeObjectURL(meta.src);
        onExtract(files, dirHandle, fileNames);
      } catch (err: any) {
        if (err.name === 'AbortError') { setExtracting(false); setProgress(null); }
        else { setError(err.message || 'Extraction failed'); setExtracting(false); }
      }
    } else {
      // Firefox/fallback: in-memory
      setExtracting(true);
      setProgress({ current: 0, total: getFrameCount(selectedFps) });

      try {
        const files = await extractFramesToMemory({
          file: videoFile,
          fps: selectedFps,
          format,
          startTime: effectiveStart,
          duration: effectiveDuration,
          onProgress: (current, t) => setProgress({ current, total: t }),
          signal: controller.signal,
        });
        if (meta.src) URL.revokeObjectURL(meta.src);
        onExtract(files, null, files.map((f) => f.name));
      } catch (err: any) {
        if (err.name === 'AbortError') { setExtracting(false); setProgress(null); }
        else { setError(err.message || 'Extraction failed'); setExtracting(false); }
      }
    }
  }, [meta, mode, videoFile, selectedFps, format, effectiveStart, effectiveDuration, getFrameCount, onExtract]);

  const handleCancel = useCallback(() => {
    if (extracting) {
      abortRef.current?.abort();
    } else {
      if (meta?.src) URL.revokeObjectURL(meta.src);
      onCancel();
    }
  }, [extracting, meta, onCancel]);

  const frameCount = getFrameCount(selectedFps);

  return createPortal(
    <div className="video-extract-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="video-extract-panel" onPointerDown={(e) => e.stopPropagation()}>
        <div className="video-extract-header">
          <h2>Video Frame Extraction</h2>
          <button className="video-extract-close" onClick={handleCancel} title="Cancel">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {error ? (
          <div className="video-extract-error">
            <p>{error}</p>
            <button className="video-extract-btn" onClick={onCancel}>Close</button>
          </div>
        ) : !meta ? (
          <div className="video-extract-loading">Loading video...</div>
        ) : extracting && progress ? (
          <div className="video-extract-progress">
            <div className="video-extract-progress-label">
              {mode === 'folder' ? 'Saving' : 'Extracting'} frame {progress.current} / {progress.total}
              {mode === 'folder' ? ' to disk' : ' to memory'}
            </div>
            <div className="video-extract-progress-bar">
              <div className="video-extract-progress-fill" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
            </div>
            <button className="video-extract-btn video-extract-btn-cancel" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="video-extract-form">
            <div className="video-extract-info">
              <span className="video-extract-filename">{videoFile.name}</span>
              <span className="video-extract-meta">
                {meta.width}x{meta.height} &middot; {formatTime(meta.duration)}
              </span>
            </div>

            {needsClip && (
              <div className="video-extract-clip">
                <div className="video-extract-clip-label">
                  Video is longer than 10 seconds. Select a clip:
                </div>
                <div className="video-extract-clip-row">
                  <label>
                    Start
                    <input
                      type="number"
                      className="video-extract-input"
                      min={0}
                      max={Math.max(0, meta.duration - 1)}
                      step={0.1}
                      value={startTime}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(meta.duration - 1, parseFloat(e.target.value) || 0));
                        setStartTime(v);
                        setClipDuration(Math.min(clipDuration, meta.duration - v));
                      }}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    <span className="video-extract-unit">s</span>
                  </label>
                  <label>
                    Duration
                    <input
                      type="number"
                      className="video-extract-input"
                      min={0.1}
                      max={Math.min(10, meta.duration - startTime)}
                      step={0.1}
                      value={clipDuration}
                      onChange={(e) => setClipDuration(Math.max(0.1, Math.min(10, meta.duration - startTime, parseFloat(e.target.value) || 1)))}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    <span className="video-extract-unit">s (max 10)</span>
                  </label>
                </div>
                <div className="video-extract-clip-range">
                  {formatTime(effectiveStart)} — {formatTime(effectiveStart + effectiveDuration)}
                </div>
              </div>
            )}

            {/* Save mode */}
            <div className="video-extract-section">
              <div className="video-extract-section-label">Save To</div>
              <div className="video-extract-format-row">
                <button
                  className={`video-extract-format-btn${mode === 'folder' ? ' active' : ''}`}
                  onClick={() => setMode('folder')}
                  disabled={!HAS_DIRECTORY_PICKER}
                  title={HAS_DIRECTORY_PICKER ? 'Save frames to a folder on disk' : 'Not supported in this browser — use Chrome or Edge'}
                >
                  Folder
                </button>
                <button
                  className={`video-extract-format-btn${mode === 'memory' ? ' active' : ''}`}
                  onClick={() => setMode('memory')}
                >
                  Memory
                </button>
              </div>
              {!HAS_DIRECTORY_PICKER && (
                <div className="video-extract-note">
                  Folder saving requires Chrome or Edge. Using in-memory mode.
                </div>
              )}
            </div>

            {/* FPS */}
            <div className="video-extract-section">
              <div className="video-extract-section-label">Frame Rate</div>
              <div className="video-extract-fps-grid">
                {FPS_OPTIONS.map((fps) => {
                  const count = getFrameCount(fps);
                  const label = fps === 0 ? 'ALL' : `${fps} FPS`;
                  return (
                    <button
                      key={fps}
                      className={`video-extract-fps-btn${selectedFps === fps ? ' active' : ''}`}
                      onClick={() => setSelectedFps(fps)}
                    >
                      <span className="video-extract-fps-label">{label}</span>
                      <span className="video-extract-fps-count">~{count} frames</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Format */}
            <div className="video-extract-section">
              <div className="video-extract-section-label">Format</div>
              <div className="video-extract-format-row">
                {FORMAT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`video-extract-format-btn${format === opt.value ? ' active' : ''}`}
                    onClick={() => setFormat(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Memory estimate for in-memory mode */}
            {mode === 'memory' && memEstimate && (
              <div className="video-extract-note">
                ~{formatBytes(memEstimate.perFrameBytes)}/frame &middot; ~{formatBytes(memEstimate.totalBytes)} total
              </div>
            )}

            {/* Warnings */}
            {memWarning && (
              <div className={`video-extract-warning${memWarning.level === 'danger' ? ' video-extract-warning-danger' : ''}`}>
                {memWarning.message}
              </div>
            )}

            <div className="video-extract-actions">
              <button
                className="video-extract-btn video-extract-btn-primary"
                onClick={handleExtract}
              >
                Extract {frameCount} Frames
              </button>
              <button className="video-extract-btn" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
