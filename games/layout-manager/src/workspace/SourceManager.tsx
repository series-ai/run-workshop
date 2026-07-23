import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ImageNode, WorkspaceAction } from './types';
import { useDraggableModal } from './ai/useDraggableModal';

interface SourceManagerProps {
  images: ImageNode[];
  selectedIds: Set<string>;
  dispatch: React.Dispatch<WorkspaceAction>;
  onClose: () => void;
}

interface SourceGroup {
  src: string;
  fileName: string;
  naturalWidth: number;
  naturalHeight: number;
  ids: string[];
  /** true when the src blob/data URL fails to load */
  broken: boolean;
}

export function SourceManager({ images, selectedIds, dispatch, onClose }: SourceManagerProps) {
  const { panelRef, onPointerDown, onPointerMove, onPointerUp } = useDraggableModal();
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replacingKey, setReplacingKey] = useState<string | null>(null);
  const replacingModeRef = useRef<'stretch' | 'fit'>('stretch');
  const [brokenSrcs, setBrokenSrcs] = useState<Set<string>>(new Set());
  // Selection snapshot from when the manager opened — used for the sort order
  // so the list doesn't reshuffle as you select things from inside the menu
  const initialSelectedRef = useRef<Set<string>>(new Set(selectedIds));

  // Group images by their source URL
  const groups: SourceGroup[] = useMemo(() => {
    const map = new Map<string, SourceGroup>();
    for (const img of images) {
      const existing = map.get(img.src);
      if (existing) {
        existing.ids.push(img.id);
      } else {
        map.set(img.src, {
          src: img.src,
          fileName: img.fileName,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          ids: [img.id],
          broken: brokenSrcs.has(img.src),
        });
      }
    }
    // Sources containing the elements that were selected when the manager
    // opened sort to the top (stable order otherwise)
    const initial = initialSelectedRef.current;
    return Array.from(map.values()).sort((a, b) => {
      const aSel = a.ids.some((id) => initial.has(id)) ? 0 : 1;
      const bSel = b.ids.some((id) => initial.has(id)) ? 0 : 1;
      return aSel - bSel;
    });
  }, [images, brokenSrcs]);

  // Probe for broken sources on mount
  useEffect(() => {
    const uniqueSrcs = new Set(images.map((i) => i.src));
    const broken = new Set<string>();
    let cancelled = false;

    Promise.all(
      Array.from(uniqueSrcs).map(
        (src) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => {
              broken.add(src);
              resolve();
            };
            img.src = src;
          }),
      ),
    ).then(() => {
      if (!cancelled) setBrokenSrcs(broken);
    });

    return () => {
      cancelled = true;
    };
  }, [images]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Close on overlay click
  // Close on Escape (the panel is non-modal — no overlay to click)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleReplace = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !replacingKey) return;
      const group = groups.find((g) => g.src === replacingKey);
      if (!group) return;

      const fileUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        // Normalize the new image to the OLD source's pixel dimensions so
        // element bounds, crops, masks, and paint layers keep applying the
        // same way. Fit = scale to fit inside (centered, transparent
        // padding, aspect preserved); stretch = fill the old dimensions.
        const w = group.naturalWidth;
        const h = group.naturalHeight;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        if (replacingModeRef.current === 'fit') {
          const s = Math.min(w / img.naturalWidth, h / img.naturalHeight);
          const dw = img.naturalWidth * s;
          const dh = img.naturalHeight * s;
          ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        } else {
          ctx.drawImage(img, 0, 0, w, h);
        }
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(fileUrl);
          if (!blob) return;
          dispatch({
            type: 'REPLACE_SOURCE',
            ids: group.ids,
            src: URL.createObjectURL(blob),
            fileName: file.name,
            naturalWidth: w,
            naturalHeight: h,
          });
          setReplacingKey(null);
        }, 'image/png');
      };
      img.src = fileUrl;
      e.target.value = '';
    },
    [replacingKey, groups, images, dispatch],
  );

  const startReplace = useCallback((srcKey: string, mode: 'stretch' | 'fit') => {
    setReplacingKey(srcKey);
    replacingModeRef.current = mode;
    // Need a tick for the ref to be ready after state change
    setTimeout(() => replaceInputRef.current?.click(), 0);
  }, []);

  const selectAll = useCallback(
    (ids: string[]) => {
      dispatch({ type: 'SELECT_MULTIPLE', ids, additive: false });
      // Panel stays open — it's a non-modal tool now, and selection feedback
      // (border + tag) shows the result in place
    },
    [dispatch],
  );

  return createPortal(
    <div className="source-manager" ref={panelRef} onPointerDown={(e) => e.stopPropagation()}>
        <div
          className="source-manager-header"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{ cursor: 'move' }}
        >
          <h2>Source Images</h2>
          <span className="source-manager-count">
            {groups.length} source{groups.length !== 1 ? 's' : ''} &middot; {images.length} element
            {images.length !== 1 ? 's' : ''}
          </span>
          <button className="source-manager-close" onClick={onClose} title="Close">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="source-manager-empty">No images in project</div>
        ) : (
          <div className="source-manager-grid">
            {groups.map((group) => { const isSelected = group.ids.some((id) => selectedIds.has(id)); return (
              <div
                key={group.src}
                className={`source-manager-card${group.broken ? ' source-manager-card-broken' : ''}${isSelected ? ' source-manager-card-selected' : ''}`}
              >
                <div className="source-manager-thumb">
                  {group.broken ? (
                    <div className="source-manager-broken-icon">
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                      </svg>
                      <span>Missing</span>
                    </div>
                  ) : (
                    <img src={group.src} alt={group.fileName} draggable={false} />
                  )}
                </div>
                <div className="source-manager-info">
                  <div className="source-manager-filename" title={group.fileName}>
                    {group.fileName || 'Untitled'}
                  </div>
                  <div className="source-manager-meta">
                    {group.naturalWidth}&times;{group.naturalHeight}
                    <span className="source-manager-dot">&middot;</span>
                    {group.ids.length} element{group.ids.length !== 1 ? 's' : ''}
                  </div>
                  {isSelected && (
                    <div className="source-manager-selected-tag">(currently selected)</div>
                  )}
                </div>
                <div className="source-manager-actions">
                  <button
                    className="source-manager-btn"
                    onClick={() => startReplace(group.src, 'stretch')}
                    title="Replace this source image — new image is stretched to the old source's dimensions; element bounds, crops, and paint stay as-is"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Replace (stretch)
                  </button>
                  <button
                    className="source-manager-btn"
                    onClick={() => startReplace(group.src, 'fit')}
                    title="Replace this source image — new image is scaled (no stretch, centered) to fit the old source's dimensions; element bounds, crops, and paint stay as-is"
                  >
                    Replace (fit)
                  </button>
                  <button
                    className="source-manager-btn source-manager-btn-secondary"
                    onClick={() => selectAll(group.ids)}
                    title="Select all elements using this source"
                  >
                    Select ({group.ids.length})
                  </button>
                </div>
              </div>
            ); })}
          </div>
        )}

      <input
        ref={replaceInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
        onChange={handleReplace}
        className="hidden-file-input"
      />
    </div>,
    document.body,
  );
}
