import { useRef, useCallback, useMemo } from 'react';
import type { ImageNode, WorkspaceAction, CanvasRect, SnapGuide, RulerGuide } from './types';
import { computeResizeSnap } from './snap';

interface GroupTransformBoxProps {
  images: ImageNode[];
  selectedIds: Set<string>;
  zoom: number;
  dispatch: React.Dispatch<WorkspaceAction>;
  snapEnabled: boolean;
  canvas: CanvasRect | null;
  onSnapGuides: (guides: SnapGuide[]) => void;
  rulerGuides: RulerGuide[];
}

export function GroupTransformBox({ images, selectedIds, zoom, dispatch, snapEnabled, canvas, onSnapGuides, rulerGuides }: GroupTransformBoxProps) {
  const selected = useMemo(
    () => images.filter((img) => selectedIds.has(img.id)),
    [images, selectedIds],
  );

  const ids = useMemo(() => Array.from(selectedIds), [selectedIds]);

  // Compute bounding box of all selected images
  const bbox = useMemo(() => {
    if (selected.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const img of selected) {
      minX = Math.min(minX, img.x);
      minY = Math.min(minY, img.y);
      maxX = Math.max(maxX, img.x + img.width);
      maxY = Math.max(maxY, img.y + img.height);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [selected]);

  // --- Resize ---
  const resizeStartRef = useRef<{
    sx: number;
    sy: number;
    bbox: { x: number; y: number; width: number; height: number };
    corner: string;
  } | null>(null);

  const handleResizeDown = useCallback(
    (e: React.PointerEvent, corner: string) => {
      e.stopPropagation();
      e.preventDefault();
      if (!bbox) return;
      dispatch({ type: 'SNAPSHOT' });
      resizeStartRef.current = {
        sx: e.clientX,
        sy: e.clientY,
        bbox: { ...bbox },
        corner,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [bbox, dispatch],
  );

  const handleResizeMove = useCallback(
    (e: React.PointerEvent) => {
      const r = resizeStartRef.current;
      if (!r) return;

      const dx = (e.clientX - r.sx) / zoom;
      const dy = (e.clientY - r.sy) / zoom;

      const isLeft = r.corner.includes('l');
      const isTop = r.corner.includes('t');

      // Compute new bounding box
      let newX = r.bbox.x;
      let newY = r.bbox.y;
      let newW = r.bbox.width;
      let newH = r.bbox.height;

      if (isLeft) {
        newW = r.bbox.width - dx;
        newX = r.bbox.x + dx;
      } else {
        newW = r.bbox.width + dx;
      }
      if (isTop) {
        newH = r.bbox.height - dy;
        newY = r.bbox.y + dy;
      } else {
        newH = r.bbox.height + dy;
      }

      // Maintain aspect ratio (uniform scale)
      const aspect = r.bbox.width / r.bbox.height;
      const currentAspect = newW / newH;
      if (currentAspect > aspect) {
        const adjustedW = newH * aspect;
        if (isLeft) newX += newW - adjustedW;
        newW = adjustedW;
      } else {
        const adjustedH = newW / aspect;
        if (isTop) newY += newH - adjustedH;
        newH = adjustedH;
      }

      // Snap dragged edges
      if (snapEnabled) {
        const draggedEdges: { left?: number; right?: number; top?: number; bottom?: number } = {};
        if (isLeft) draggedEdges.left = newX;
        else draggedEdges.right = newX + newW;
        if (isTop) draggedEdges.top = newY;
        else draggedEdges.bottom = newY + newH;

        const { dx: snapDx, dy: snapDy, guides } = computeResizeSnap(selectedIds, draggedEdges, images, canvas, rulerGuides);
        onSnapGuides(guides);

        if (snapDx !== 0) {
          if (isLeft) { newX += snapDx; newW -= snapDx; }
          else { newW += snapDx; }
        }
        if (snapDy !== 0) {
          if (isTop) { newY += snapDy; newH -= snapDy; }
          else { newH += snapDy; }
        }

        // Re-apply aspect ratio after snap
        const aspect = r.bbox.width / r.bbox.height;
        const currentAspect = newW / newH;
        if (Math.abs(snapDx) > 0 && Math.abs(snapDy) === 0) {
          const adjustedH = newW / aspect;
          if (isTop) newY += newH - adjustedH;
          newH = adjustedH;
        } else if (Math.abs(snapDy) > 0 && Math.abs(snapDx) === 0) {
          const adjustedW = newH * aspect;
          if (isLeft) newX += newW - adjustedW;
          newW = adjustedW;
        } else if (currentAspect > aspect) {
          const adjustedW = newH * aspect;
          if (isLeft) newX += newW - adjustedW;
          newW = adjustedW;
        } else {
          const adjustedH = newW / aspect;
          if (isTop) newY += newH - adjustedH;
          newH = adjustedH;
        }
      } else {
        onSnapGuides([]);
      }

      // Minimum group size
      if (newW < 40) return;
      if (newH < 40) return;

      const scaleX = newW / r.bbox.width;
      const scaleY = newH / r.bbox.height;

      // Origin is the corner opposite to the one being dragged
      const originX = isLeft ? r.bbox.x + r.bbox.width : r.bbox.x;
      const originY = isTop ? r.bbox.y + r.bbox.height : r.bbox.y;

      dispatch({ type: 'SCALE_GROUP', ids, scaleX, scaleY, originX, originY });

      // Update start for incremental dispatch
      resizeStartRef.current = {
        ...r,
        sx: e.clientX,
        sy: e.clientY,
        bbox: { x: newX, y: newY, width: newW, height: newH },
      };
    },
    [dispatch, ids, zoom, snapEnabled, selectedIds, images, canvas, onSnapGuides, rulerGuides],
  );

  const handleResizeUp = useCallback(() => {
    resizeStartRef.current = null;
    onSnapGuides([]);
  }, [onSnapGuides]);

  // --- Rotate ---
  const rotateStartRef = useRef<{
    cx: number;
    cy: number;
    startAngle: number;
    lastAngle: number;
  } | null>(null);

  const handleRotateDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!bbox) return;
      dispatch({ type: 'SNAPSHOT' });

      // Group center in screen coords
      const el = (e.target as HTMLElement).closest('.group-transform-box');
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
      rotateStartRef.current = { cx, cy, startAngle, lastAngle: startAngle };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [bbox, dispatch],
  );

  const handleRotateMove = useCallback(
    (e: React.PointerEvent) => {
      const r = rotateStartRef.current;
      if (!r || !bbox) return;

      const currentAngle = Math.atan2(e.clientY - r.cy, e.clientX - r.cx);
      let deltaDeg = ((currentAngle - r.lastAngle) * 180) / Math.PI;

      const snapDeg = e.shiftKey ? 15 : snapEnabled ? 5 : 0;
      if (snapDeg > 0) {
        const totalDeg = ((currentAngle - r.startAngle) * 180) / Math.PI;
        const snapped = Math.round(totalDeg / snapDeg) * snapDeg;
        const prevTotal = ((r.lastAngle - r.startAngle) * 180) / Math.PI;
        const prevSnapped = Math.round(prevTotal / snapDeg) * snapDeg;
        deltaDeg = snapped - prevSnapped;
        if (deltaDeg === 0) return;
      }

      const originX = bbox.x + bbox.width / 2;
      const originY = bbox.y + bbox.height / 2;

      dispatch({ type: 'ROTATE_GROUP', ids, deltaRotation: deltaDeg, originX, originY });
      r.lastAngle = currentAngle;
    },
    [dispatch, ids, bbox, snapEnabled],
  );

  const handleRotateUp = useCallback(() => {
    rotateStartRef.current = null;
  }, []);

  if (!bbox || selected.length < 2) return null;

  const s = 1 / zoom;
  const handleSize = 8 * s;
  const handleOffset = -handleSize;
  const borderWidth = 1.5 * s;
  const rotateLineH = 25 * s;
  const rotateSize = 12 * s;
  const rotateTop = -(rotateLineH + rotateSize + 2 * s);
  const rotateLineTop = -(rotateLineH + 2 * s);

  const corners = ['tl', 'tr', 'bl', 'br'];

  return (
    <div
      className="group-transform-box"
      style={{
        position: 'absolute',
        left: bbox.x,
        top: bbox.y,
        width: bbox.width,
        height: bbox.height,
        border: `${borderWidth}px solid var(--color-primary)`,
        pointerEvents: 'none',
        zIndex: 999999,
      }}
    >
      {/* Corner resize handles */}
      {corners.map((corner) => {
        const isTop = corner.includes('t');
        const isLeft = corner.includes('l');
        const style: React.CSSProperties = {
          position: 'absolute',
          width: handleSize,
          height: handleSize,
          top: isTop ? handleOffset : undefined,
          bottom: isTop ? undefined : handleOffset,
          left: isLeft ? handleOffset : undefined,
          right: isLeft ? undefined : handleOffset,
          pointerEvents: 'auto',
        };
        return (
          <div
            key={corner}
            className={`resize-handle resize-handle-${corner}`}
            style={style}
            onPointerDown={(e) => handleResizeDown(e, corner)}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeUp}
          />
        );
      })}

      {/* Lock button */}
      <button
        className="lock-icon-btn"
        style={{
          top: -(22 * s + 4 * s),
          left: 0,
          width: 22 * s,
          height: 22 * s,
          pointerEvents: 'auto',
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          dispatch({ type: 'TOGGLE_LOCK', ids });
        }}
        title="Lock"
      >
        <svg width={14 * s} height={14 * s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </button>

      {/* Onion skin button */}
      {(() => {
        const anyOnion = selected.some((img) => img.opacity < 1);
        return (
          <button
            className={`lock-icon-btn${anyOnion ? ' onion-btn-active' : ''}`}
            style={{
              top: -(22 * s + 4 * s),
              left: (22 * s + 4 * s),
              width: 22 * s,
              height: 22 * s,
              pointerEvents: 'auto',
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              dispatch({ type: 'SET_OPACITY', ids, opacity: anyOnion ? 1 : 0.6 });
            }}
            title={anyOnion ? 'Disable onion skin' : 'Onion skin (60%)'}
          >
            <svg width={14 * s} height={14 * s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
          </button>
        );
      })()}

      {/* Rotation handle */}
      <div
        className="rotate-handle-line"
        style={{
          top: rotateLineTop,
          height: rotateLineH,
          width: 2 * s,
          left: '50%',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
        }}
      />
      <div
        className="rotate-handle"
        style={{
          top: rotateTop,
          width: rotateSize,
          height: rotateSize,
          left: '50%',
          transform: 'translateX(-50%)',
          pointerEvents: 'auto',
        }}
        onPointerDown={handleRotateDown}
        onPointerMove={handleRotateMove}
        onPointerUp={handleRotateUp}
      />
    </div>
  );
}
