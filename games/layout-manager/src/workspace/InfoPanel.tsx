import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, Upload, Copy, Grid2X2, FlipHorizontal2, FlipVertical2, RotateCcw, RotateCw, Crop, X, Move, Unlink2, Link2, Plus, Maximize2, Pencil, Paintbrush, Check, Trash2, AlignLeft, AlignCenter, AlignRight, Flame, Slice } from 'lucide-react';
import type { ImageNode, WorkspaceAction, CanvasRect } from './types';
import { ColorPicker } from './paint/ColorPicker';
import { splitImage } from './splitImage';
import { GENERIC_FONTS, GOOGLE_FONTS, ensureGoogleFont } from './googleFonts';

interface InfoPanelProps {
  image: ImageNode;
  selectionCount: number;
  dispatch: React.Dispatch<WorkspaceAction>;
  selectedIds: Set<string>;
  images: ImageNode[];
  splitV: number;
  splitH: number;
  onSplitVChange: (v: number) => void;
  onSplitHChange: (h: number) => void;
  isCropping: boolean;
  onCropStart: () => void;
  onAutoCrop: () => void;
  onCropCancel: () => void;
  onOffsetStart: () => void;
  isMasking: boolean;
  hasMask: boolean;
  onMaskStart: () => void;
  onMaskCancel: () => void;
  onClearMask: () => void;
  onApplyMask: () => void;
  hasEdits: boolean;
  onBake: () => void;
  isSlicing: boolean;
  onSliceToggle: () => void;
  canvas: CanvasRect | null;
  onBatchRename: () => void;
  editingTextId: string | null;
  onConfirmText: () => void;
  onResetPositionRef?: React.MutableRefObject<(() => void) | null>;
  panelPos: { x: number; y: number } | null;
  onPanelPosChange: (pos: { x: number; y: number } | null) => void;
  alignPadding: number;
  onAlignPaddingChange: (value: number) => void;
}

function getFileType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const types: Record<string, string> = {
    png: 'PNG',
    jpg: 'JPEG',
    jpeg: 'JPEG',
    gif: 'GIF',
    webp: 'WebP',
    svg: 'SVG',
  };
  return types[ext] ?? (ext.toUpperCase() || 'Unknown');
}

/** Expand a set of element ids with all their attached descendants. */
function collectWithDescendants(images: ImageNode[], ids: Set<string>): string[] {
  const result = new Set(ids);
  let grew = true;
  while (grew) {
    grew = false;
    for (const img of images) {
      if (img.parentId && result.has(img.parentId) && !result.has(img.id)) {
        result.add(img.id);
        grew = true;
      }
    }
  }
  return Array.from(result);
}

export function InfoPanel({ image, selectionCount, dispatch, selectedIds, images, splitV, splitH, onSplitVChange, onSplitHChange, isCropping, onCropStart, onAutoCrop, onCropCancel, onOffsetStart, isMasking, hasMask, onMaskStart, onMaskCancel, onClearMask, onApplyMask: _, hasEdits, onBake, isSlicing, onSliceToggle, canvas, onBatchRename, editingTextId, onConfirmText, onResetPositionRef, panelPos, onPanelPosChange, alignPadding, onAlignPaddingChange }: InfoPanelProps) {
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [bgColorWheel, setBgColorWheel] = useState<{ top: number; left: number } | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);

  /** Uniformly scale + center a set of elements (by id) to fit the page. */
  const fitGroupToPage = useCallback((idList: string[]) => {
    if (!canvas) return;
    const group = images.filter((img) => idList.includes(img.id) && !img.locked);
    if (group.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const img of group) {
      const cx = img.x + img.width / 2;
      const cy = img.y + img.height / 2;
      const rad = (img.rotation * Math.PI) / 180;
      const cos = Math.abs(Math.cos(rad));
      const sin = Math.abs(Math.sin(rad));
      const rbw = img.width * cos + img.height * sin;
      const rbh = img.width * sin + img.height * cos;
      minX = Math.min(minX, cx - rbw / 2);
      minY = Math.min(minY, cy - rbh / 2);
      maxX = Math.max(maxX, cx + rbw / 2);
      maxY = Math.max(maxY, cy + rbh / 2);
    }
    const bw = maxX - minX;
    const bh = maxY - minY;
    if (bw <= 0 || bh <= 0) return;
    const scale = Math.min(canvas.width / bw, canvas.height / bh);
    const ids = group.map((g) => g.id);
    dispatch({ type: 'SNAPSHOT' });
    // Scale the group around its top-left, then center the result on the page
    dispatch({ type: 'SCALE_GROUP', ids, scaleX: scale, scaleY: scale, originX: minX, originY: minY });
    dispatch({
      type: 'MOVE_IMAGES',
      ids,
      dx: -minX + (canvas.width - bw * scale) / 2,
      dy: -minY + (canvas.height - bh * scale) / 2,
    });
  }, [canvas, images, dispatch]);
  const [editW, setEditW] = useState(String(Math.round(image.width)));
  const [editH, setEditH] = useState(String(Math.round(image.height)));
  const [linked, setLinked] = useState(true);
  const [scaleTogether, setScaleTogether] = useState(true);
  const committedRef = useRef(false);
  const [splitting, setSplitting] = useState(false);
  const alignSpacingSnapshottedRef = useRef(false);

  if (onResetPositionRef) onResetPositionRef.current = () => onPanelPosChange(null);
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
    const pw = panelRef.current?.offsetWidth ?? 220;
    const x = Math.max(-pw + 40, Math.min(vw - 40, dragRef.current.ox + dx));
    const y = Math.max(0, Math.min(vh - 40, dragRef.current.oy + dy));
    // Apply position directly to DOM for smooth dragging (avoids React re-render per frame)
    const el = panelRef.current;
    if (el) {
      el.style.position = 'fixed';
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.right = 'auto';
    }
  }, []);

  const handleHeaderPointerUp = useCallback(() => {
    if (!dragRef.current) return;
    // Commit final position to React state
    const el = panelRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      onPanelPosChange({ x: rect.left, y: rect.top });
    }
    dragRef.current = null;
  }, [onPanelPosChange]);

  const aspect = image.width / image.height;

  // Sync inputs when the image changes externally (drag resize, undo, etc.)
  useEffect(() => {
    setEditW(String(Math.round(image.width)));
    setEditH(String(Math.round(image.height)));
  }, [image.width, image.height, image.id]);

  const revert = useCallback(() => {
    setEditW(String(Math.round(image.width)));
    setEditH(String(Math.round(image.height)));
  }, [image.width, image.height]);

  const commitWidth = useCallback(() => {
    if (committedRef.current) return;
    const newW = parseInt(editW, 10);
    if (isNaN(newW) || newW < 1) {
      revert();
      return;
    }
    committedRef.current = true;
    const scaleX = newW / image.width;
    const ids = Array.from(selectedIds);
    dispatch({ type: 'RESIZE_SELECTION', ids, scaleX, scaleY: linked ? scaleX : 1, scaleTogether });
  }, [editW, image.width, selectedIds, dispatch, linked, revert, scaleTogether]);

  const commitHeight = useCallback(() => {
    if (committedRef.current) return;
    const newH = parseInt(editH, 10);
    if (isNaN(newH) || newH < 1) {
      revert();
      return;
    }
    committedRef.current = true;
    const scaleY = newH / image.height;
    const ids = Array.from(selectedIds);
    dispatch({ type: 'RESIZE_SELECTION', ids, scaleX: linked ? scaleY : 1, scaleY, scaleTogether });
  }, [editH, image.height, selectedIds, dispatch, linked, revert, scaleTogether]);

  // When linked, auto-update the other field as the user types
  const handleWChange = useCallback(
    (val: string) => {
      setEditW(val);
      if (linked) {
        const w = parseInt(val, 10);
        if (!isNaN(w) && w > 0) {
          setEditH(String(Math.round(w / aspect)));
        }
      }
    },
    [linked, aspect],
  );

  const handleHChange = useCallback(
    (val: string) => {
      setEditH(val);
      if (linked) {
        const h = parseInt(val, 10);
        if (!isNaN(h) && h > 0) {
          setEditW(String(Math.round(h * aspect)));
        }
      }
    },
    [linked, aspect],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, commit: () => void) => {
      // Stop all keyboard events from propagating to workspace handlers
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        committedRef.current = false;
        commit();
        (e.target as HTMLInputElement).blur();
      }
      if (e.key === 'Escape') {
        revert();
        (e.target as HTMLInputElement).blur();
      }
    },
    [revert],
  );

  const handleBlur = useCallback(
    (commit: () => void) => {
      commit();
      // Reset the guard after blur completes
      setTimeout(() => { committedRef.current = false; }, 0);
    },
    [],
  );

  const handleSplit = useCallback(() => {
    if (splitting) return;
    setSplitting(true);
    try {
      const pieces = splitImage(image, splitV, splitH);
      dispatch({ type: 'SPLIT_IMAGE', originalId: image.id, pieces });
    } catch (err) {
      console.error('Failed to split image:', err);
    }
    setSplitting(false);
  }, [image, splitV, splitH, splitting, dispatch]);

  const handleReplaceSource = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      dispatch({
        type: 'REPLACE_SOURCE',
        ids: Array.from(selectedIds),
        src,
        fileName: file.name,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      });
    };
    img.src = src;
    e.target.value = '';
  }, [dispatch, selectedIds]);

  const handleFocus = () => {
    const padding = 60;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scaleX = (vw - padding * 2) / image.width;
    const scaleY = (vh - padding * 2) / image.height;
    const newZoom = Math.min(32, Math.max(0.01, Math.min(scaleX, scaleY)));
    const cx = image.x + image.width / 2;
    const cy = image.y + image.height / 2;
    const newPanX = vw / 2 - cx * newZoom;
    const newPanY = vh / 2 - cy * newZoom;
    dispatch({ type: 'SET_ZOOM', zoom: newZoom, pan: { x: newPanX, y: newPanY } });
  };

  return (
    <div
      ref={panelRef}
      className="info-panel"
      style={panelPos ? { position: 'fixed', left: panelPos.x, top: panelPos.y, right: 'auto' } : undefined}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="info-panel-header"
        style={{ cursor: 'grab' }}
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
      >
        <div className="grab-bar" />
        {selectionCount > 1 && (
          <span className="info-panel-badge">{selectionCount} selected</span>
        )}
      </div>

      {image.nodeType !== 'text' && (
        <div className="info-panel-thumb" style={{ position: 'relative' }}>
          <img src={image.src} alt={image.fileName} draggable={false} />
          {image.paintUnderlayUrl && (
            <img src={image.paintUnderlayUrl} draggable={false} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
          )}
          {image.paintOverlayUrl && (
            <img src={image.paintOverlayUrl} draggable={false} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
          )}
        </div>
      )}

      <div className="info-panel-quick-actions">
        <button className="info-panel-icon-btn" onClick={handleFocus} title="Focus">
          <Search size={14} />
        </button>
        {selectionCount >= 1 && image.nodeType !== 'text' && (
          <button className="info-panel-icon-btn" onClick={() => replaceInputRef.current?.click()} title="Replace Source">
            <Upload size={14} />
          </button>
        )}
        <button className="info-panel-icon-btn" onClick={() => dispatch({ type: 'DUPLICATE_IMAGES', ids: Array.from(selectedIds) })} title="Duplicate (D)">
          <Copy size={14} />
        </button>
        {selectionCount === 1 && (
          <button className="info-panel-icon-btn" onClick={() => {
            const rawW = image.cropRect ? image.cropRect.w : image.naturalWidth;
            const rawH = image.cropRect ? image.cropRect.h : image.naturalHeight;
            const rad = (image.rotation * Math.PI) / 180;
            const cos = Math.abs(Math.cos(rad));
            const sin = Math.abs(Math.sin(rad));
            // Canvas = rotated bounding box at 1:1 scale
            const cw = Math.round(rawW * cos + rawH * sin);
            const ch = Math.round(rawW * sin + rawH * cos);
            dispatch({ type: 'SET_CANVAS', canvas: { width: cw, height: ch } });
            // Image stays at 1:1 scale, centered in canvas
            dispatch({ type: 'RESIZE_IMAGE', id: image.id, width: rawW, height: rawH, x: (cw - rawW) / 2, y: (ch - rawH) / 2 });
            dispatch({ type: 'SEND_TO_BACK', id: image.id });
          }} title="Make Page (1:1)">
            <Grid2X2 size={14} />
          </button>
        )}
        {selectionCount > 1 && (
          <button className="info-panel-icon-btn" onClick={() => {
            const selected = images.filter((img) => selectedIds.has(img.id));
            // Compute rotated bounding boxes
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const img of selected) {
              const cx = img.x + img.width / 2;
              const cy = img.y + img.height / 2;
              const rad = (img.rotation * Math.PI) / 180;
              const cos = Math.abs(Math.cos(rad));
              const sin = Math.abs(Math.sin(rad));
              const rbw = img.width * cos + img.height * sin;
              const rbh = img.width * sin + img.height * cos;
              minX = Math.min(minX, cx - rbw / 2);
              minY = Math.min(minY, cy - rbh / 2);
              maxX = Math.max(maxX, cx + rbw / 2);
              maxY = Math.max(maxY, cy + rbh / 2);
            }
            const bw = Math.round(maxX - minX);
            const bh = Math.round(maxY - minY);
            dispatch({ type: 'SET_CANVAS', canvas: { width: bw, height: bh } });
            dispatch({ type: 'MOVE_IMAGES', ids: Array.from(selectedIds), dx: -minX, dy: -minY });
          }} title="Make Page from Selection">
            <Grid2X2 size={14} />
          </button>
        )}
        {selectionCount === 1 && canvas && (
          <button className="info-panel-icon-btn" onClick={() => {
            // An element with attached children fits as a group so the
            // whole node tree scales and moves together
            const groupIds = collectWithDescendants(images, new Set([image.id]));
            if (groupIds.length > 1) {
              fitGroupToPage(groupIds);
              return;
            }
            const rad = (image.rotation * Math.PI) / 180;
            const cos = Math.abs(Math.cos(rad));
            const sin = Math.abs(Math.sin(rad));
            const aspect = image.width / image.height;
            // Solve for image width/height that fills canvas when rotated
            // rotatedW = w*cos + h*sin = canvas.width
            // rotatedH = w*sin + h*cos = canvas.height
            // with h = w / aspect
            const w = Math.min(
              canvas.width / (cos + sin / aspect),
              canvas.height / (sin + cos / aspect),
            );
            const h = w / aspect;
            const cx = (canvas.width - w) / 2;
            const cy = (canvas.height - h) / 2;
            dispatch({ type: 'RESIZE_IMAGE', id: image.id, width: Math.round(w), height: Math.round(h), x: cx, y: cy });
          }} title="Fit to Page">
            <Maximize2 size={14} />
          </button>
        )}
        {selectionCount > 1 && canvas && (
          <button className="info-panel-icon-btn" onClick={() => {
            // Attached children ride along even when not explicitly selected
            fitGroupToPage(collectWithDescendants(images, new Set(selectedIds)));
          }} title="Fit Selection to Page">
            <Maximize2 size={14} />
          </button>
        )}
        <input
          ref={replaceInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
          onChange={handleReplaceSource}
          className="hidden-file-input"
        />
      </div>

      <div className="info-panel-rows">
        {image.nodeType !== 'text' && (
          <>
            {selectionCount === 1 && (
              <div className="info-panel-row info-panel-sprite-name-row">
                <span className="info-panel-label">Sprite Name</span>
                <input
                  className="info-panel-sprite-name-input"
                  type="text"
                  value={image.spriteName}
                  placeholder={image.fileName.replace(/\.[^.]+$/, '')}
                  maxLength={32}
                  onChange={(e) => dispatch({ type: 'RENAME_IMAGE', id: image.id, spriteName: e.target.value })}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                />
              </div>
            )}
            {selectionCount > 1 && (
              <div className="info-panel-row info-panel-sprite-name-row">
                <span className="info-panel-label">Names</span>
                <button className="info-panel-btn info-panel-split-btn" onClick={onBatchRename}>
                  <Pencil size={14} />
                  Batch Rename ({selectionCount})
                </button>
              </div>
            )}
            <div className="info-panel-row">
              <span className="info-panel-label">Name</span>
              <span className="info-panel-value info-panel-value-name" title={image.fileName}>
                {image.fileName}
              </span>
            </div>
            <div className="info-panel-row">
              <span className="info-panel-label">Type</span>
              <span className="info-panel-value">{getFileType(image.fileName)}</span>
            </div>
            <div className="info-panel-row">
              <span className="info-panel-label">Original</span>
              <span className="info-panel-value">
                {image.naturalWidth} x {image.naturalHeight}
              </span>
            </div>
          </>
        )}
        {image.nodeType === 'text' ? null : (
          <div className="info-panel-row">
            <span className="info-panel-label">Display</span>
            <span className="info-panel-value info-panel-size-inputs">
              <input
                className="info-panel-size-input"
                type="number"
                value={editW}
                onChange={(e) => handleWChange(e.target.value)}
                onBlur={() => handleBlur(commitWidth)}
                onKeyDown={(e) => handleKeyDown(e, commitWidth)}
                min="20"
              />
              <button
                className={`info-panel-chain-btn${linked ? ' info-panel-chain-linked' : ''}`}
                onClick={() => setLinked((v) => !v)}
                title={linked ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
              >
                {linked ? <Link2 size={14} /> : <Unlink2 size={14} />}
              </button>
              <input
                className="info-panel-size-input"
                type="number"
                value={editH}
                onChange={(e) => handleHChange(e.target.value)}
                onBlur={() => handleBlur(commitHeight)}
                onKeyDown={(e) => handleKeyDown(e, commitHeight)}
                min="20"
              />
            </span>
          </div>
        )}
        {selectionCount > 1 && (
          <div className="info-panel-row">
            <span className="info-panel-label"></span>
            <button
              className={`info-panel-scale-together-btn${scaleTogether ? ' active' : ''}`}
              onClick={() => setScaleTogether((v) => !v)}
              title={scaleTogether ? 'Scale together: positions adjust with size' : 'Scale independently: only sizes change'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {scaleTogether ? (
                  <>
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <path d="M10 7h4" />
                    <path d="M10 17h4" />
                    <path d="M7 10v4" />
                    <path d="M17 10v4" />
                  </>
                ) : (
                  <>
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                  </>
                )}
              </svg>
              {scaleTogether ? 'Scale Together' : 'Scale Independent'}
            </button>
          </div>
        )}
        {selectionCount > 1 && (
          <div className="info-panel-row" title="Pixel gap inserted between selected elements. Updates immediately and is reused by Ctrl+Arrow alignment.">
            <span className="info-panel-label">Align Spacing</span>
            <span className="info-panel-value" style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
              <input
                type="text"
                inputMode="numeric"
                className="info-panel-size-input"
                style={{ width: 48, textAlign: 'right' }}
                value={String(alignPadding)}
                onFocus={() => { alignSpacingSnapshottedRef.current = false; }}
                onBlur={() => { alignSpacingSnapshottedRef.current = false; }}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '');
                  const n = v === '' ? 0 : Math.min(999, Number(v));
                  onAlignPaddingChange(n);
                  if (selectedIds.size >= 2) {
                    if (!alignSpacingSnapshottedRef.current) {
                      dispatch({ type: 'SNAPSHOT' });
                      alignSpacingSnapshottedRef.current = true;
                    }
                    dispatch({ type: 'DISTRIBUTE_GAPS', ids: Array.from(selectedIds), gap: n });
                  }
                }}
              />
              <span style={{ opacity: 0.6, fontSize: 11 }}>px</span>
            </span>
          </div>
        )}
        <div className="info-panel-row">
          <span className="info-panel-label">Position</span>
          <span className="info-panel-value">
            {Math.round(image.x)}, {Math.round(image.y)}
          </span>
        </div>
        <div className="info-panel-row">
          <span className="info-panel-label">Rotation</span>
          <span className="info-panel-value">{Math.round(image.rotation)}°</span>
        </div>
        <div className="info-panel-row">
          <span className="info-panel-label">Layer</span>
          <span className="info-panel-value">{image.zIndex}</span>
        </div>
        <div className="info-panel-row">
          <span className="info-panel-label">Opacity</span>
          <span className="info-panel-value info-panel-opacity">
            <input
              className="info-panel-opacity-slider"
              type="range"
              min="0"
              max="100"
              value={Math.round(image.opacity * 100)}
              onChange={(e) => {
                const ids = Array.from(selectedIds);
                dispatch({ type: 'SET_OPACITY', ids, opacity: parseInt(e.target.value, 10) / 100 });
              }}
            />
            <span className="info-panel-opacity-value">{Math.round(image.opacity * 100)}%</span>
          </span>
        </div>
        {image.nodeType !== 'text' && (
          <div className="info-panel-row">
            <span className="info-panel-label">Background</span>
            <span className="info-panel-value" style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
              <button
                className={`canvas-bg-swatch canvas-bg-swatch-transparent${!image.bgColor ? ' canvas-bg-swatch-active' : ''}`}
                onClick={() => { dispatch({ type: 'SNAPSHOT' }); dispatch({ type: 'SET_BG_COLOR', ids: Array.from(selectedIds), color: null }); }}
                title="Transparent (no fill)"
              />
              <button
                className={`canvas-bg-swatch${image.bgColor === '#ffffff' ? ' canvas-bg-swatch-active' : ''}`}
                style={{ background: '#ffffff' }}
                onClick={() => { dispatch({ type: 'SNAPSHOT' }); dispatch({ type: 'SET_BG_COLOR', ids: Array.from(selectedIds), color: '#ffffff' }); }}
                title="White"
              />
              <button
                className={`canvas-bg-swatch${image.bgColor === '#000000' ? ' canvas-bg-swatch-active' : ''}`}
                style={{ background: '#000000' }}
                onClick={() => { dispatch({ type: 'SNAPSHOT' }); dispatch({ type: 'SET_BG_COLOR', ids: Array.from(selectedIds), color: '#000000' }); }}
                title="Black"
              />
              <button
                className={`canvas-bg-swatch canvas-bg-swatch-custom${image.bgColor && image.bgColor !== '#ffffff' && image.bgColor !== '#000000' ? ' canvas-bg-swatch-active' : ''}`}
                style={{ background: image.bgColor && image.bgColor !== '#ffffff' && image.bgColor !== '#000000' ? image.bgColor : 'var(--color-primary)' }}
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  // Anchor the picker to the LEFT of the swatch so it lands next to the InfoPanel
                  // (which lives on the right edge), not floating off-screen to the right.
                  const PICKER_WIDTH = 240;
                  setBgColorWheel({ top: r.bottom + 4, left: r.right - PICKER_WIDTH });
                }}
                title="Custom color"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </span>
          </div>
        )}
        {image.nodeType !== 'text' && selectionCount === 1 && image.prompts && image.prompts.length > 0 && image.prompts.map((p, idx) => {
          const isNegative = /negative/i.test(p.title) && /prompt/i.test(p.title);
          const isPositive = !isNegative && /prompt/i.test(p.title);
          const titleColor = isNegative ? 'var(--color-error)' : isPositive ? 'var(--color-success)' : undefined;
          return (
            <div key={`prompt-${idx}-${p.title}`} className="info-panel-row">
              <span className="info-panel-label" style={titleColor ? { color: titleColor } : undefined}>{p.title}</span>
              <span className="info-panel-value" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="ai-modal-clear-btn"
                  onClick={() => { navigator.clipboard.writeText(p.text).catch((e) => console.warn('[InfoPanel] clipboard write failed:', e)); }}
                  title={`Copy: ${p.text}`}
                  style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 6px' }}
                >
                  <Copy size={13} />
                </button>
              </span>
            </div>
          );
        })}
      </div>
      {bgColorWheel && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100000 }}
          onPointerDown={(e) => { e.stopPropagation(); setBgColorWheel(null); }}
        >
          <div
            style={{ position: 'absolute', top: bgColorWheel.top, left: bgColorWheel.left }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <ColorPicker
              color={image.bgColor ?? '#ffffff'}
              onChange={(c) => { dispatch({ type: 'SNAPSHOT' }); dispatch({ type: 'SET_BG_COLOR', ids: Array.from(selectedIds), color: c }); }}
              onClose={() => setBgColorWheel(null)}
            />
          </div>
        </div>,
        document.body,
      )}

      {image.nodeType !== 'text' && (
        <div className="info-panel-quick-actions" style={{ paddingTop: 4 }}>
          <button
            className={`info-panel-icon-btn${image.flipH ? ' info-panel-icon-btn-active' : ''}`}
            onClick={() => { dispatch({ type: 'SNAPSHOT' }); dispatch({ type: 'FLIP_IMAGES', ids: Array.from(selectedIds), axis: 'h' }); }}
            title="Flip Horizontal"
          >
            <FlipHorizontal2 size={14} />
          </button>
          <button
            className={`info-panel-icon-btn${image.flipV ? ' info-panel-icon-btn-active' : ''}`}
            onClick={() => { dispatch({ type: 'SNAPSHOT' }); dispatch({ type: 'FLIP_IMAGES', ids: Array.from(selectedIds), axis: 'v' }); }}
            title="Flip Vertical"
          >
            <FlipVertical2 size={14} />
          </button>
          <button
            className="info-panel-icon-btn"
            onClick={() => { dispatch({ type: 'SNAPSHOT' }); dispatch({ type: 'ROTATE_IMAGE', id: image.id, rotation: image.rotation - 90 }); }}
            title="Rotate 90° Left"
          >
            <RotateCcw size={14} />
          </button>
          <button
            className="info-panel-icon-btn"
            onClick={() => { dispatch({ type: 'SNAPSHOT' }); dispatch({ type: 'ROTATE_IMAGE', id: image.id, rotation: image.rotation + 90 }); }}
            title="Rotate 90° Right"
          >
            <RotateCw size={14} />
          </button>
          {selectionCount === 1 && (() => {
            // Stretched element (display ratio ≠ content ratio, >1% off):
            // offer restoring the natural aspect within the current bounds
            const cw = image.cropRect ? image.cropRect.w : image.naturalWidth;
            const ch = image.cropRect ? image.cropRect.h : image.naturalHeight;
            if (cw <= 0 || ch <= 0) return null;
            const contentAspect = cw / ch;
            const displayAspect = image.width / image.height;
            if (Math.abs(displayAspect - contentAspect) / contentAspect < 0.01) return null;
            return (
              <button
                className="info-panel-icon-btn"
                onClick={() => {
                  let w = image.width;
                  let h = w / contentAspect;
                  if (h > image.height) {
                    h = image.height;
                    w = h * contentAspect;
                  }
                  dispatch({ type: 'SNAPSHOT' });
                  dispatch({
                    type: 'RESIZE_IMAGE',
                    id: image.id,
                    width: Math.round(w),
                    height: Math.round(h),
                    x: image.x + (image.width - w) / 2,
                    y: image.y + (image.height - h) / 2,
                  });
                }}
                title="Fit to Bounds — element is stretched; restore its natural aspect ratio within the current bounds"
              >
                <Maximize2 size={14} style={{ transform: 'rotate(90deg)' }} />
              </button>
            );
          })()}
        </div>
      )}

      {!isMasking && image.nodeType !== 'text' && (
        <div className="info-panel-split">
          <div
            className="info-panel-split-header"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => setAdjustOpen((o) => !o)}
          >
            <span>{adjustOpen ? '▾' : '▸'} Adjust</span>
            {/* Always rendered so its appearance never shifts the layout */}
            <button
              className="info-panel-icon-btn"
              style={{
                fontSize: 10,
                padding: '1px 6px',
                visibility: (image.brightness ?? 1) === 1 && (image.contrast ?? 1) === 1 && (image.saturation ?? 1) === 1 && (image.hue ?? 0) === 0 ? 'hidden' : 'visible',
              }}
              title="Reset adjustments"
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: 'SNAPSHOT' });
                dispatch({ type: 'SET_ADJUSTMENTS', ids: Array.from(selectedIds), updates: { brightness: undefined, contrast: undefined, saturation: undefined, hue: undefined } });
              }}
            >Reset</button>
          </div>
          {adjustOpen && <div className="info-panel-rows" style={{ padding: '4px 10px' }}>
            {([
              { key: 'brightness' as const, label: 'Bright', min: 0, max: 200, scale: 100, def: 100, unit: '%' },
              { key: 'contrast' as const, label: 'Contrast', min: 0, max: 200, scale: 100, def: 100, unit: '%' },
              { key: 'saturation' as const, label: 'Sat', min: 0, max: 200, scale: 100, def: 100, unit: '%' },
              { key: 'hue' as const, label: 'Hue', min: -180, max: 180, scale: 1, def: 0, unit: '°' },
            ]).map(({ key, label, min, max, scale, def, unit }) => {
              const raw = image[key];
              const val = Math.round((raw ?? def / scale) * scale);
              return (
                <div className="info-panel-row" key={key}>
                  <span className="info-panel-label">{label}</span>
                  <span className="info-panel-value info-panel-opacity">
                    <input
                      className="info-panel-opacity-slider"
                      type="range"
                      min={min}
                      max={max}
                      value={val}
                      onDoubleClick={() => {
                        dispatch({ type: 'SET_ADJUSTMENTS', ids: Array.from(selectedIds), updates: { [key]: undefined } });
                      }}
                      onChange={(e) => {
                        dispatch({ type: 'SET_ADJUSTMENTS', ids: Array.from(selectedIds), updates: { [key]: parseInt(e.target.value, 10) / scale } });
                      }}
                    />
                    <span className="info-panel-opacity-value">{val}{unit}</span>
                  </span>
                </div>
              );
            })}
          </div>}
        </div>
      )}

      {selectionCount === 1 && !isMasking && image.nodeType !== 'text' && (
        <div className="info-panel-split">
          <div className="info-panel-split-header">Split Image</div>
          <div className="info-panel-split-controls">
            <button
              className={`info-panel-icon-btn${isSlicing ? ' info-panel-icon-btn-active' : ''}`}
              onClick={onSliceToggle}
              title="Knife tool (K) — click near an edge of the element to cut it there"
            >
              <Slice size={14} />
            </button>
            <div className="info-panel-split-field">
              <label className="info-panel-split-label">V</label>
              <input
                className="info-panel-split-input"
                type="number"
                min={0}
                max={40}
                value={splitV}
                onChange={(e) => onSplitVChange(Math.min(40, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
            <div className="info-panel-split-field">
              <label className="info-panel-split-label">H</label>
              <input
                className="info-panel-split-input"
                type="number"
                min={0}
                max={40}
                value={splitH}
                onChange={(e) => onSplitHChange(Math.min(40, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
            <span className="info-panel-split-info">
              {(splitV + 1) * (splitH + 1)}pc
            </span>
          </div>
          <button
            className="info-panel-btn info-panel-split-btn"
            onClick={handleSplit}
            disabled={splitting || (splitV === 0 && splitH === 0)}
          >
            <Plus size={14} />
            {splitting ? 'Splitting...' : 'Split'}
          </button>
        </div>
      )}

      {!isMasking && image.nodeType !== 'text' && <div className="info-panel-split">
        <div className="info-panel-split-header">Crop</div>
        <div className="info-panel-crop-buttons">
          {selectionCount === 1 && (
            isCropping ? (
              <button className="info-panel-btn info-panel-split-btn" onClick={onCropCancel}>
                <X size={14} />
                Cancel Crop
              </button>
            ) : (
              <button className="info-panel-btn info-panel-split-btn" onClick={onCropStart}>
                <Crop size={14} />
                Crop
              </button>
            )
          )}
          <button className="info-panel-btn info-panel-split-btn" onClick={onAutoCrop} disabled={isCropping}>
              <Crop size={14} />
              Auto Crop{selectionCount > 1 ? ' All' : ''}
            </button>
              <button className="info-panel-btn info-panel-split-btn" onClick={onOffsetStart} disabled={isCropping || !image.cropRect}>
                <Move size={14} />
                Offset Image{selectionCount > 1 ? 's' : ''}
              </button>
          {selectionCount === 1 && (
            <>
              {image.cropRect && !isCropping && (
                <button className="info-panel-btn info-panel-split-btn" onClick={() => {
                  const ds = image.width / image.cropRect!.w;
                  dispatch({
                    type: 'SET_CROP',
                    id: image.id,
                    cropRect: undefined,
                    width: Math.round(image.naturalWidth * ds),
                    height: Math.round(image.naturalHeight * ds),
                    x: Math.round(image.x - image.cropRect!.x * ds),
                    y: Math.round(image.y - image.cropRect!.y * ds),
                  });
                }}>
                  <RotateCcw size={14} />
                  Restore
                </button>
              )}
            </>
          )}
          </div>
        </div>}

      {selectionCount === 1 && image.parentId && (() => {
        const parent = images.find((img) => img.id === image.parentId);
        const parentName = parent ? (parent.spriteName || parent.fileName.replace(/\.[^.]+$/, '')) : 'Unknown';
        const children = images.filter((img) => img.parentId === image.id);
        const hasBase = !!image.basePosition;
        const hasOffset = !!image.offsetPosition;
        return (
          <div className="info-panel-split info-panel-rig-section">
            <div className="info-panel-split-header">Rig</div>
            <div className="info-panel-rows" style={{ padding: 0 }}>
              <div className="info-panel-row">
                <span className="info-panel-label">Parent</span>
                <button
                  className="info-panel-rig-parent-link"
                  onClick={() => parent && dispatch({ type: 'SELECT', id: parent.id, additive: false })}
                >
                  {parentName}
                </button>
              </div>
              <div className="info-panel-row">
                <span className="info-panel-label">Layer</span>
                <div className="info-panel-rig-layer-toggle">
                  <button
                    className={`info-panel-rig-layer-btn${image.layerOrder === 'above' ? ' active' : ''}`}
                    onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); dispatch({ type: 'SNAPSHOT' }); dispatch({ type: 'SET_LAYER_ORDER', id: image.id, layerOrder: 'above' }); }}
                  >Above</button>
                  <button
                    className={`info-panel-rig-layer-btn${image.layerOrder === 'below' ? ' active' : ''}`}
                    onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); dispatch({ type: 'SNAPSHOT' }); dispatch({ type: 'SET_LAYER_ORDER', id: image.id, layerOrder: 'below' }); }}
                  >Below</button>
                </div>
              </div>
              <div className="info-panel-row">
                <span className="info-panel-label">Replaces</span>
                <button
                  className={`info-panel-rig-layer-btn${image.replacesParent ? ' active' : ''}`}
                  onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); dispatch({ type: 'SNAPSHOT' }); dispatch({ type: 'SET_REPLACES_PARENT', id: image.id, replaces: !image.replacesParent }); }}
                  style={{ fontSize: 11 }}
                >{image.replacesParent ? 'Yes — hides parent' : 'No'}</button>
              </div>
              {children.length > 0 && (
                <div className="info-panel-row">
                  <span className="info-panel-label">Children</span>
                  <span className="info-panel-value">{children.length}</span>
                </div>
              )}
            </div>

            <button
              className={`info-panel-btn${hasBase ? ' info-panel-rig-pos-set' : ''}`}
              onClick={() => { dispatch({ type: 'SNAPSHOT' }); dispatch({ type: 'SET_BASE_POSITION', id: image.id }); }}
            >
              Set Base Position
              {hasBase && (
                <span className="info-panel-rig-pos-info-inline">
                  {Math.round(image.basePosition!.x)}, {Math.round(image.basePosition!.y)} &middot; {Math.round(image.basePosition!.width)}x{Math.round(image.basePosition!.height)}
                </span>
              )}
            </button>
            {hasBase && (
              <button
                className="info-panel-btn"
                onClick={() => { dispatch({ type: 'SNAPSHOT' }); dispatch({ type: 'GOTO_BASE_POSITION', id: image.id }); }}
              >
                Go To Base
              </button>
            )}

            <button
              className={`info-panel-btn${hasOffset ? ' info-panel-rig-pos-set' : ''}`}
              onClick={() => { dispatch({ type: 'SNAPSHOT' }); dispatch({ type: 'SET_OFFSET_POSITION', id: image.id }); }}
            >
              Set Offset Position
              {hasOffset && (
                <span className="info-panel-rig-pos-info-inline">
                  {Math.round(image.offsetPosition!.x)}, {Math.round(image.offsetPosition!.y)} &middot; {Math.round(image.offsetPosition!.width)}x{Math.round(image.offsetPosition!.height)}
                </span>
              )}
            </button>
            {hasOffset && (
              <button
                className="info-panel-btn"
                onClick={() => { dispatch({ type: 'SNAPSHOT' }); dispatch({ type: 'GOTO_OFFSET_POSITION', id: image.id }); }}
              >
                Go To Offset
              </button>
            )}

            <button
              className="info-panel-btn info-panel-detach-btn"
              onClick={() => dispatch({ type: 'DETACH_FROM_PARENT', childId: image.id })}
            >
              <Unlink2 size={14} />
              Detach
            </button>
          </div>
        );
      })()}

      {selectionCount === 1 && !image.parentId && images.some((img) => img.parentId === image.id) && (
        <div className="info-panel-split">
          <div className="info-panel-split-header">Rig</div>
          <div className="info-panel-rows" style={{ padding: 0 }}>
            <div className="info-panel-row">
              <span className="info-panel-label">Role</span>
              <span className="info-panel-value">Parent</span>
            </div>
            <div className="info-panel-row">
              <span className="info-panel-label">Children</span>
              <span className="info-panel-value">{images.filter((img) => img.parentId === image.id).length}</span>
            </div>
          </div>
        </div>
      )}

      {selectionCount === 1 && image.nodeType !== 'text' && (
        <div className="info-panel-split">
          <div className="info-panel-split-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            Mask / Paint
            <button className="info-panel-icon-btn" onClick={onClearMask} disabled={!hasMask || isMasking} title="Clear Mask">
              <Trash2 size={14} />
            </button>
          </div>
          <div className="info-panel-crop-buttons">
            {isMasking ? (
              <>
                <button className="info-panel-btn info-panel-split-btn" onClick={onMaskCancel}>
                  <X size={14} />
                  Cancel
                </button>
                <button className="info-panel-btn info-panel-split-btn info-panel-apply-btn" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))}>
                  <Check size={14} />
                  Apply
                </button>
              </>
            ) : (
              <button className="info-panel-btn info-panel-split-btn" onClick={onMaskStart} disabled={isCropping}>
                <Paintbrush size={14} />
                Edit Mask / Paint
              </button>
            )}
          </div>
          {!isMasking && hasEdits && (
            <div className="info-panel-crop-buttons">
              <button
                className="info-panel-btn info-panel-split-btn info-panel-bake-btn"
                onClick={() => {
                  const ok = window.confirm(
                    'Bake all edits (mask, paint, crop, flip, background) into the source image?\n\nThis cannot be undone. Undo history will be cleared and the layered state will be released from memory.',
                  );
                  if (ok) onBake();
                }}
                disabled={isCropping}
                title="Flatten all edits into a new source image"
              >
                <Flame size={14} />
                Bake Changes
              </button>
            </div>
          )}
        </div>
      )}

      {/* Text properties */}
      {selectionCount === 1 && image.nodeType === 'text' && (
        <div className="info-panel-split">
          <div className="info-panel-split-header">Text</div>
          <div className="info-panel-rows" style={{ padding: '4px 10px' }}>
            <div className="info-panel-row">
              <span className="info-panel-label">Font</span>
              <select
                className="info-panel-select"
                value={image.fontFamily ?? 'sans-serif'}
                // Keep arrow keys inside the select (the workspace handler
                // otherwise nudges the element), so fonts can be cycled and
                // previewed live with up/down
                onKeyDown={(e) => e.stopPropagation()}
                onChange={(e) => {
                  ensureGoogleFont(e.target.value);
                  dispatch({ type: 'SNAPSHOT' });
                  dispatch({ type: 'UPDATE_TEXT', id: image.id, updates: { fontFamily: e.target.value } });
                }}
              >
                <optgroup label="Generic">
                  {GENERIC_FONTS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </optgroup>
                <optgroup label="Google Fonts">
                  {GOOGLE_FONTS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <TextSizeControl
              fontSize={image.fontSize ?? 24}
              onChange={(size) => {
                dispatch({ type: 'SNAPSHOT' });
                dispatch({ type: 'UPDATE_TEXT', id: image.id, updates: { fontSize: size } });
              }}
            />
            <div className="info-panel-row">
              <span className="info-panel-label">Color</span>
              <input
                type="color"
                className="info-panel-color"
                value={image.textColor ?? '#000000'}
                onChange={(e) => {
                  dispatch({ type: 'UPDATE_TEXT', id: image.id, updates: { textColor: e.target.value } });
                }}
              />
            </div>
            <div className="info-panel-row">
              <span className="info-panel-label">Style</span>
              <div style={{ display: 'flex', gap: 2 }}>
                <button
                  className={`info-panel-icon-btn${image.fontBold ? ' info-panel-icon-btn-active' : ''}`}
                  onClick={() => { dispatch({ type: 'SNAPSHOT' }); dispatch({ type: 'UPDATE_TEXT', id: image.id, updates: { fontBold: !image.fontBold } }); }}
                  title="Bold"
                  style={{ fontWeight: 'bold', fontSize: 12 }}
                >B</button>
                <button
                  className={`info-panel-icon-btn${image.fontItalic ? ' info-panel-icon-btn-active' : ''}`}
                  onClick={() => { dispatch({ type: 'SNAPSHOT' }); dispatch({ type: 'UPDATE_TEXT', id: image.id, updates: { fontItalic: !image.fontItalic } }); }}
                  title="Italic"
                  style={{ fontStyle: 'italic', fontSize: 12 }}
                >I</button>
                <button
                  className={`info-panel-icon-btn${image.fontUnderline ? ' info-panel-icon-btn-active' : ''}`}
                  onClick={() => { dispatch({ type: 'SNAPSHOT' }); dispatch({ type: 'UPDATE_TEXT', id: image.id, updates: { fontUnderline: !image.fontUnderline } }); }}
                  title="Underline"
                  style={{ textDecoration: 'underline', fontSize: 12 }}
                >U</button>
              </div>
            </div>
            <div className="info-panel-row">
              <span className="info-panel-label">Align</span>
              <div style={{ display: 'flex', gap: 2 }}>
                <button
                  className={`info-panel-icon-btn${(image.textAlign ?? 'left') === 'left' ? ' info-panel-icon-btn-active' : ''}`}
                  onClick={() => { dispatch({ type: 'SNAPSHOT' }); dispatch({ type: 'UPDATE_TEXT', id: image.id, updates: { textAlign: 'left' } }); }}
                  title="Align left"
                ><AlignLeft size={12} /></button>
                <button
                  className={`info-panel-icon-btn${image.textAlign === 'center' ? ' info-panel-icon-btn-active' : ''}`}
                  onClick={() => { dispatch({ type: 'SNAPSHOT' }); dispatch({ type: 'UPDATE_TEXT', id: image.id, updates: { textAlign: 'center' } }); }}
                  title="Align center"
                ><AlignCenter size={12} /></button>
                <button
                  className={`info-panel-icon-btn${image.textAlign === 'right' ? ' info-panel-icon-btn-active' : ''}`}
                  onClick={() => { dispatch({ type: 'SNAPSHOT' }); dispatch({ type: 'UPDATE_TEXT', id: image.id, updates: { textAlign: 'right' } }); }}
                  title="Align right"
                ><AlignRight size={12} /></button>
              </div>
            </div>
          </div>
          {editingTextId === image.id && (
            <div className="info-panel-crop-buttons" style={{ marginTop: 4 }}>
              <button className="info-panel-btn info-panel-split-btn info-panel-apply-btn" onClick={onConfirmText}>
                <Check size={14} />
                Confirm Text
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Text Size Control ──────────────────────────────────────────────── */

function TextSizeControl({ fontSize, onChange }: { fontSize: number; onChange: (size: number) => void }) {
  const [draft, setDraft] = useState(String(fontSize));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(String(fontSize));
  }, [fontSize, editing]);

  const commit = () => {
    setEditing(false);
    const v = parseInt(draft, 10);
    if (v && v >= 1 && v <= 512 && v !== fontSize) {
      onChange(v);
    } else {
      setDraft(String(fontSize));
    }
  };

  return (
    <div className="info-panel-row">
      <span className="info-panel-label">Size</span>
      <span className="info-panel-value info-panel-opacity">
        <input
          type="range"
          className="info-panel-opacity-slider"
          min={1}
          max={200}
          value={fontSize}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
        />
        <input
          className="info-panel-size-input"
          type="text"
          value={editing ? draft : String(fontSize)}
          onChange={(e) => { setEditing(true); setDraft(e.target.value); }}
          onFocus={() => setEditing(true)}
          onBlur={commit}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') commit();
          }}
          style={{ width: 36 }}
        />
      </span>
    </div>
  );
}
