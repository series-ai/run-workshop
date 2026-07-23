import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Play, Pause, Square, ZoomIn, ZoomOut } from 'lucide-react';
import type { ImageNode } from './types';
import { analyzeNodesForGif, encodeGifFromNodes } from './gifExport';

/** Above this max dimension, offer to downscale the exported GIF. */
const GIF_SAFE_DIM = 1024;

interface AnimationPreviewProps {
  images: ImageNode[];
  selectedIds: Set<string>;
  onResetPositionRef?: React.MutableRefObject<(() => void) | null>;
}

export function AnimationPreview({ images, selectedIds, onResetPositionRef }: AnimationPreviewProps) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(12);
  const [loop, setLoop] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [collapsed, setCollapsed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Draggable panel
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
  if (onResetPositionRef) onResetPositionRef.current = () => setPanelPos(null);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleHeaderPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: rect.left, oy: rect.top };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handleHeaderPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.sx;
    const dy = e.clientY - dragRef.current.sy;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pw = panelRef.current?.offsetWidth ?? 280;
    const x = Math.max(-pw + 40, Math.min(vw - 40, dragRef.current.ox + dx));
    const y = Math.max(0, Math.min(vh - 40, dragRef.current.oy + dy));
    setPanelPos({ x, y });
  }, []);

  const handleHeaderPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Sorted frames by name (natural sort)
  const frames = useMemo(() => {
    return images
      .filter((img) => selectedIds.has(img.id))
      .sort((a, b) => {
        const nameA = a.spriteName || a.fileName;
        const nameB = b.spriteName || b.fileName;
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
      });
  }, [images, selectedIds]);

  const stateRef = useRef({ currentFrame, isPlaying, fps, loop, count: frames.length });
  stateRef.current = { currentFrame, isPlaying, fps, loop, count: frames.length };

  // Reset frame index when selection changes
  useEffect(() => {
    setCurrentFrame((prev) => (prev >= frames.length ? 0 : prev));
  }, [frames.length]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const stopPlayback = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setIsPlaying(false);
  }, []);

  const startPlayback = useCallback(() => {
    if (stateRef.current.count < 2) return;
    setIsPlaying(true);
    const animate = () => {
      const s = stateRef.current;
      if (!s.isPlaying) return;
      const next = s.currentFrame + 1;
      if (next >= s.count) {
        if (s.loop) { setCurrentFrame(0); } else { setIsPlaying(false); return; }
      } else { setCurrentFrame(next); }
      timerRef.current = setTimeout(animate, 1000 / s.fps);
    };
    timerRef.current = setTimeout(animate, 1000 / stateRef.current.fps);
  }, []);

  const togglePlay = useCallback(() => {
    if (stateRef.current.isPlaying) stopPlayback(); else startPlayback();
  }, [stopPlayback, startPlayback]);

  const handleStop = useCallback(() => { stopPlayback(); setCurrentFrame(0); }, [stopPlayback]);

  // --- GIF export (confirmed, size-guarded) ---
  const [gifProgress, setGifProgress] = useState<{ done: number; total: number } | null>(null);
  const framesRef = useRef(frames);
  framesRef.current = frames;

  const handleExportGif = useCallback(async () => {
    if (gifProgress) return;
    const s = stateRef.current;
    const imageFrames = framesRef.current.filter((f) => f.nodeType !== 'text');
    if (imageFrames.length < 2) {
      alert('GIF export needs at least 2 image frames (text elements are skipped).');
      return;
    }
    const stats = analyzeNodesForGif(imageFrames);

    // Confirm — this is a real export, not a misclick
    let msg = `Export ${stats.count} frames as an animated GIF?\n\n${stats.maxW}×${stats.maxH} @ ${s.fps} FPS${s.loop ? ', looping' : ', plays once'}`;
    if (imageFrames.length < framesRef.current.length) {
      msg += `\n\nNote: ${framesRef.current.length - imageFrames.length} text element(s) will be skipped.`;
    }
    if (stats.mismatched) {
      msg += `\n\n⚠ Frames have mismatched sizes (${stats.sizes.join(', ')}). Smaller frames will be centered on the largest.`;
    }
    if (!window.confirm(msg)) return;

    // Large frames: offer to downscale before encoding chews the machine
    let scale = 1;
    if (Math.max(stats.maxW, stats.maxH) > GIF_SAFE_DIM) {
      const target = GIF_SAFE_DIM / Math.max(stats.maxW, stats.maxH);
      const outW = Math.round(stats.maxW * target);
      const outH = Math.round(stats.maxH * target);
      const downscale = window.confirm(
        `These frames are large (${stats.maxW}×${stats.maxH}). GIFs this size encode slowly and produce huge files.\n\nOK — downscale to ${outW}×${outH}\nCancel — keep full size anyway`,
      );
      if (downscale) scale = target;
    }

    try {
      setGifProgress({ done: 0, total: imageFrames.length });
      const blob = await encodeGifFromNodes(imageFrames, s.fps, s.loop, scale, (done, total) => setGifProgress({ done, total }));
      const first = imageFrames[0]!;
      const base = (first.spriteName || first.fileName.replace(/\.[^.]+$/, '').replace(/[\d_-]+$/, '')) || 'animation';
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
  }, [gifProgress]);

  if (frames.length < 2) return null;

  const frame = frames[currentFrame];
  if (!frame) return null;

  const frameName = frame.spriteName || frame.fileName.replace(/\.[^.]+$/, '');

  return (
    <div
      ref={panelRef}
      className="anim-preview-panel"
      style={panelPos ? { position: 'fixed', left: panelPos.x, top: panelPos.y, right: 'auto', bottom: 'auto' } : undefined}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="anim-preview-header"
        style={{ cursor: 'grab' }}
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
      >
        <div className="grab-bar" />
        <span className="anim-preview-title">Animation Preview</span>
        <span className="anim-preview-badge">{frames.length} frames</span>
        <button
          className="anim-preview-collapse-btn"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {collapsed
              ? <polyline points="6 9 12 15 18 9" />
              : <polyline points="6 15 12 9 18 15" />
            }
          </svg>
        </button>
      </div>

      {!collapsed && (
        <div className="anim-preview-body">
          <div className="anim-preview-display" style={{ maxHeight: 200 * zoom }}>
            {frame.nodeType === 'text' ? (
              <span
                className="anim-preview-text"
                style={{
                  fontFamily: frame.fontFamily ?? 'sans-serif',
                  fontSize: Math.min((frame.fontSize ?? 24) * zoom, 96),
                  fontWeight: frame.fontBold ? 'bold' : 'normal',
                  fontStyle: frame.fontItalic ? 'italic' : 'normal',
                  textDecoration: frame.fontUnderline ? 'underline' : 'none',
                  color: frame.textColor ?? '#ffffff',
                  textAlign: frame.textAlign ?? 'left',
                }}
              >{frame.text}</span>
            ) : frame.cropRect ? (() => {
              const crop = frame.cropRect;
              const maxDim = 200 * zoom;
              const scale = Math.min(maxDim / crop.w, maxDim / crop.h, 1 * zoom);
              const dispW = crop.w * scale;
              const dispH = crop.h * scale;
              const fullScale = dispW / crop.w;
              return (
                <div style={{ width: dispW, height: dispH, overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                  <img
                    src={frame.src}
                    alt={frameName}
                    draggable={false}
                    style={{
                      width: frame.naturalWidth * fullScale,
                      height: frame.naturalHeight * fullScale,
                      marginLeft: -crop.x * fullScale,
                      marginTop: -crop.y * fullScale,
                      maxWidth: 'none',
                      maxHeight: 'none',
                    }}
                  />
                  {frame.paintUnderlayUrl && (
                    <img
                      src={frame.paintUnderlayUrl}
                      draggable={false}
                      style={{
                        position: 'absolute', top: 0, left: 0,
                        width: frame.naturalWidth * fullScale,
                        height: frame.naturalHeight * fullScale,
                        marginLeft: -crop.x * fullScale,
                        marginTop: -crop.y * fullScale,
                        maxWidth: 'none',
                        maxHeight: 'none',
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                  {frame.paintOverlayUrl && (
                    <img
                      src={frame.paintOverlayUrl}
                      draggable={false}
                      style={{
                        position: 'absolute', top: 0, left: 0,
                        width: frame.naturalWidth * fullScale,
                        height: frame.naturalHeight * fullScale,
                        marginLeft: -crop.x * fullScale,
                        marginTop: -crop.y * fullScale,
                        maxWidth: 'none',
                        maxHeight: 'none',
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                </div>
              );
            })() : (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img
                  src={frame.src}
                  alt={frameName}
                  draggable={false}
                  style={{ maxWidth: 200 * zoom, maxHeight: 200 * zoom }}
                />
                {frame.paintUnderlayUrl && (
                  <img
                    src={frame.paintUnderlayUrl}
                    draggable={false}
                    style={{
                      position: 'absolute', top: 0, left: 0,
                      width: '100%', height: '100%',
                      pointerEvents: 'none',
                    }}
                  />
                )}
                {frame.paintOverlayUrl && (
                  <img
                    src={frame.paintOverlayUrl}
                    draggable={false}
                    style={{
                      position: 'absolute', top: 0, left: 0,
                      width: '100%', height: '100%',
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </div>
            )}
          </div>

          <div className="anim-preview-transport">
            <button className="anim-preview-btn" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button className="anim-preview-btn" onClick={handleStop} title="Stop">
              <Square size={14} />
            </button>
            <div className="anim-preview-fps">
              <label>FPS</label>
              <input
                type="number"
                min="1"
                max="60"
                value={fps}
                onChange={(e) => setFps(Math.max(1, Math.min(60, parseInt(e.target.value, 10) || 1)))}
                onKeyDown={(e) => e.stopPropagation()}
                className="anim-preview-fps-input"
              />
            </div>
            <label className="anim-preview-loop">
              <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
              Loop
            </label>
            <button
              className="anim-preview-btn anim-preview-gif-btn"
              onClick={handleExportGif}
              disabled={!!gifProgress}
              title="Export these frames as an animated GIF (uses the FPS and loop settings above)"
            >
              {gifProgress ? `${gifProgress.done}/${gifProgress.total}` : 'GIF'}
            </button>
          </div>

          <div className="anim-preview-scrub">
            <span className="anim-preview-frame-label">{currentFrame + 1} / {frames.length}</span>
            <input
              type="range"
              min="0"
              max={Math.max(0, frames.length - 1)}
              value={currentFrame}
              onChange={(e) => setCurrentFrame(parseInt(e.target.value, 10))}
              className="anim-preview-slider"
            />
          </div>

          <div className="anim-preview-zoom-row">
            <button className="anim-preview-btn" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} title="Zoom Out">
              <ZoomOut size={14} />
            </button>
            <span className="anim-preview-zoom-label">{Math.round(zoom * 100)}%</span>
            <button className="anim-preview-btn" onClick={() => setZoom((z) => Math.min(4, z + 0.25))} title="Zoom In">
              <ZoomIn size={14} />
            </button>
            <span className="anim-preview-frame-name" title={frameName}>{frameName}</span>
          </div>
        </div>
      )}
    </div>
  );
}
