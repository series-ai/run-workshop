import { useRef, useCallback, useState, useEffect } from 'react';
import type { ImageNode as ImageNodeType, WorkspaceAction, CanvasRect, SnapGuide, RulerGuide } from './types';
import { adjustmentsFilter } from './types';
import { cssFontFamily, ensureGoogleFont } from './googleFonts';

/**
 * The ONE text-node measurement used both while editing and after commit —
 * two divergent measurements previously made the box snap/offset on commit.
 */
function measureTextNode(
  n: Pick<ImageNodeType, 'fontSize' | 'fontFamily' | 'fontBold' | 'fontItalic' | 'textAutoWidth' | 'width'>,
  text: string,
): { w: number; h: number } {
  const size = n.fontSize ?? 24;
  const family = n.fontFamily ?? 'sans-serif';
  const bold = n.fontBold ? 'bold ' : '';
  const italic = n.fontItalic ? 'italic ' : '';
  const padding = 4;
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.font = `${italic}${bold}${size}px "${family}"`;
  const metrics = ctx.measureText('Mg');
  const lineH = (metrics.fontBoundingBoxAscent ?? size * 0.8) + (metrics.fontBoundingBoxDescent ?? size * 0.2);
  const lines = text.split('\n');

  if (n.textAutoWidth) {
    const maxLineW = Math.max(...lines.map((l) => ctx.measureText(l || ' ').width));
    return {
      w: Math.max(60, Math.ceil(maxLineW) + padding * 2),
      h: Math.ceil(lineH * lines.length * 1.2) + padding * 2,
    };
  }

  // Fixed width — word-wrap and compute height
  const maxW = n.width - padding * 2;
  let wrappedCount = 0;
  for (const line of lines) {
    if (!line) { wrappedCount++; continue; }
    const words = line.split(' ');
    let current = '';
    for (const word of words) {
      const test = current ? current + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && current) {
        wrappedCount++;
        current = word;
      } else {
        current = test;
      }
    }
    wrappedCount++;
  }
  return { w: n.width, h: Math.ceil(lineH * wrappedCount * 1.2) + padding * 2 };
}
import { computeSnap, computeResizeSnap } from './snap';

interface ImageNodeProps {
  node: ImageNodeType;
  selected: boolean;
  zoom: number;
  dispatch: React.Dispatch<WorkspaceAction>;
  selectedIds: Set<string>;
  onContextMenu: (e: React.PointerEvent | React.MouseEvent, id: string) => void;
  multiSelected: boolean;
  images: ImageNodeType[];
  snapEnabled: boolean;
  canvas: CanvasRect | null;
  onSnapGuides: (guides: SnapGuide[]) => void;
  highlightColor?: string | null;
  rulerGuides: RulerGuide[];
  onDragActive?: (active: boolean) => void;
  editingText?: boolean;
  onEditText?: (id: string | null) => void;
}

export function ImageNodeComponent({
  node,
  selected,
  zoom,
  dispatch,
  selectedIds,
  onContextMenu,
  multiSelected,
  images,
  snapEnabled,
  canvas,
  onSnapGuides,
  highlightColor,
  rulerGuides,
  onDragActive,
  editingText,
  onEditText,
}: ImageNodeProps) {
  const isTextNode = node.nodeType === 'text';
  const adjustFilter = adjustmentsFilter(node);

  // Load Google Fonts on demand so text nodes render correctly after project load
  useEffect(() => {
    if (isTextNode) ensureGoogleFont(node.fontFamily);
  }, [isTextNode, node.fontFamily]);
  const dragStartRef = useRef<{
    sx: number;
    sy: number;
    moved: boolean;
    origPositions: Map<string, { x: number; y: number }>;
    lastAppliedDx: number;
    lastAppliedDy: number;
  } | null>(null);
  const resizeStartRef = useRef<{
    sx: number;
    sy: number;
    origW: number;
    origH: number;
    origX: number;
    origY: number;
    corner: string;
    aspect: number;
  } | null>(null);
  const rotateStartRef = useRef<{
    cx: number;
    cy: number;
    startAngle: number;
    origRotation: number;
  } | null>(null);

  // --- Drag ---
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 2) return; // right click handled separately
      if (e.button === 1) return; // middle click is for panning
      if (node.locked) return; // locked images can't be interacted with
      e.stopPropagation();

      // Select logic
      if (!selected && !e.ctrlKey && !e.metaKey) {
        dispatch({ type: 'SELECT', id: node.id, additive: false });
      } else if (e.ctrlKey || e.metaKey) {
        dispatch({ type: 'SELECT', id: node.id, additive: true });
      }

      dispatch({ type: 'SNAPSHOT' });

      // Snapshot original positions of all selected images for snap tracking
      const origPositions = new Map<string, { x: number; y: number }>();
      const ids = selectedIds.has(node.id) ? selectedIds : new Set([node.id]);
      for (const img of images) {
        if (ids.has(img.id)) {
          origPositions.set(img.id, { x: img.x, y: img.y });
        }
      }

      dragStartRef.current = {
        sx: e.clientX,
        sy: e.clientY,
        moved: false,
        origPositions,
        lastAppliedDx: 0,
        lastAppliedDy: 0,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [dispatch, node.id, selected, selectedIds, images],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const ref = dragStartRef.current;
      if (!ref) return;

      // Cumulative raw offset from drag start
      let rawDx = (e.clientX - ref.sx) / zoom;
      let rawDy = (e.clientY - ref.sy) / zoom;

      if (!ref.moved && Math.abs(rawDx) <= 1 && Math.abs(rawDy) <= 1) return;
      if (!ref.moved) onDragActive?.(true);
      ref.moved = true;

      // Shift: lock to cardinal direction
      if (e.shiftKey) {
        if (Math.abs(rawDx) >= Math.abs(rawDy)) {
          rawDy = 0;
        } else {
          rawDx = 0;
        }
      }

      let finalDx = rawDx;
      let finalDy = rawDy;

      if (snapEnabled) {
        // Build target positions (original + raw offset) for snap computation
        const targetImages = images.map((img) => {
          const orig = ref.origPositions.get(img.id);
          if (orig) {
            return { ...img, x: orig.x + rawDx, y: orig.y + rawDy };
          }
          return img;
        });

        const movingIds = new Set(ref.origPositions.keys());
        const { dx: snapDx, dy: snapDy, guides } = computeSnap(movingIds, targetImages, canvas, rulerGuides);
        finalDx = rawDx + snapDx;
        finalDy = rawDy + snapDy;
        onSnapGuides(guides);
      } else {
        onSnapGuides([]);
      }

      // Dispatch incremental delta from last applied position
      const incDx = finalDx - ref.lastAppliedDx;
      const incDy = finalDy - ref.lastAppliedDy;

      if (Math.abs(incDx) > 0.01 || Math.abs(incDy) > 0.01) {
        const ids = Array.from(ref.origPositions.keys());
        dispatch({ type: 'MOVE_IMAGES', ids, dx: incDx, dy: incDy });
        ref.lastAppliedDx = finalDx;
        ref.lastAppliedDy = finalDy;
      }
    },
    [dispatch, zoom, snapEnabled, images, canvas, onSnapGuides, rulerGuides],
  );

  const handlePointerUp = useCallback(() => {
    if (dragStartRef.current?.moved) onDragActive?.(false);
    dragStartRef.current = null;
    onSnapGuides([]);
  }, [onSnapGuides, onDragActive]);

  // --- Resize ---
  const handleResizeDown = useCallback(
    (e: React.PointerEvent, corner: string) => {
      e.stopPropagation();
      e.preventDefault();
      dispatch({ type: 'SNAPSHOT' });
      const aspect = node.width / node.height;
      resizeStartRef.current = {
        sx: e.clientX,
        sy: e.clientY,
        origW: node.width,
        origH: node.height,
        origX: node.x,
        origY: node.y,
        corner,
        aspect,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [node.width, node.height, node.x, node.y],
  );

  const handleResizeMove = useCallback(
    (e: React.PointerEvent) => {
      const r = resizeStartRef.current;
      if (!r) return;

      const dx = (e.clientX - r.sx) / zoom;
      const dy = (e.clientY - r.sy) / zoom;

      let newW = r.origW;
      let newH = r.origH;
      let newX = r.origX;
      let newY = r.origY;

      const freeResize = e.shiftKey || isTextNode;

      // Determine direction based on corner
      const isLeft = r.corner.includes('l');
      const isTop = r.corner.includes('t');

      if (isLeft) {
        newW = r.origW - dx;
        newX = r.origX + dx;
      } else {
        newW = r.origW + dx;
      }

      if (isTop) {
        newH = r.origH - dy;
        newY = r.origY + dy;
      } else {
        newH = r.origH + dy;
      }

      // Constrain aspect ratio by default
      if (!freeResize) {
        const targetAspect = r.aspect;
        const currentAspect = newW / newH;
        if (currentAspect > targetAspect) {
          const adjustedW = newH * targetAspect;
          if (isLeft) {
            newX += newW - adjustedW;
          }
          newW = adjustedW;
        } else {
          const adjustedH = newW / targetAspect;
          if (isTop) {
            newY += newH - adjustedH;
          }
          newH = adjustedH;
        }
      }

      // Minimum size
      if (newW < 20) {
        if (isLeft) newX -= 20 - newW;
        newW = 20;
      }
      if (newH < 20) {
        if (isTop) newY -= 20 - newH;
        newH = 20;
      }

      // Snap dragged edges to other image edges / canvas
      if (snapEnabled) {
        const draggedEdges: { left?: number; right?: number; top?: number; bottom?: number } = {};
        if (isLeft) draggedEdges.left = newX;
        else draggedEdges.right = newX + newW;
        if (isTop) draggedEdges.top = newY;
        else draggedEdges.bottom = newY + newH;

        const { dx: snapDx, dy: snapDy, guides } = computeResizeSnap(node.id, draggedEdges, images, canvas, rulerGuides);
        onSnapGuides(guides);

        if (snapDx !== 0) {
          if (isLeft) { newX += snapDx; newW -= snapDx; }
          else { newW += snapDx; }
        }
        if (snapDy !== 0) {
          if (isTop) { newY += snapDy; newH -= snapDy; }
          else { newH += snapDy; }
        }

        // Re-apply aspect ratio constraint after snap (unless free resize)
        if (!freeResize) {
          if (Math.abs(snapDx) > 0 && Math.abs(snapDy) === 0) {
            // X snapped — adjust height to match
            const adjustedH = newW / r.aspect;
            if (isTop) newY += newH - adjustedH;
            newH = adjustedH;
          } else if (Math.abs(snapDy) > 0 && Math.abs(snapDx) === 0) {
            // Y snapped — adjust width to match
            const adjustedW = newH * r.aspect;
            if (isLeft) newX += newW - adjustedW;
            newW = adjustedW;
          }
        }
      } else {
        onSnapGuides([]);
      }

      dispatch({
        type: 'RESIZE_IMAGE',
        id: node.id,
        width: Math.round(newW),
        height: Math.round(newH),
        x: Math.round(newX),
        y: Math.round(newY),
      });
      // Manual resize locks text node width
      if (isTextNode && node.textAutoWidth) {
        dispatch({ type: 'UPDATE_TEXT', id: node.id, updates: { textAutoWidth: false } });
      }
    },
    [dispatch, node.id, zoom, snapEnabled, images, canvas, onSnapGuides, rulerGuides, isTextNode],
  );

  const handleResizeUp = useCallback(() => {
    resizeStartRef.current = null;
    onSnapGuides([]);
  }, [onSnapGuides]);

  // --- Rotate ---
  const handleRotateDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      dispatch({ type: 'SNAPSHOT' });

      const rect = (e.target as HTMLElement).closest('.image-node')?.getBoundingClientRect();
      if (!rect) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
      rotateStartRef.current = {
        cx,
        cy,
        startAngle,
        origRotation: node.rotation,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [node.rotation],
  );

  const handleRotateMove = useCallback(
    (e: React.PointerEvent) => {
      const r = rotateStartRef.current;
      if (!r) return;

      const currentAngle = Math.atan2(e.clientY - r.cy, e.clientX - r.cx);
      let newRotation = r.origRotation + ((currentAngle - r.startAngle) * 180) / Math.PI;

      // Snap to 15-degree increments when holding Shift, or 5-degree when snapping enabled
      if (e.shiftKey) {
        newRotation = Math.round(newRotation / 15) * 15;
      } else if (snapEnabled) {
        newRotation = Math.round(newRotation / 5) * 5;
      }

      dispatch({ type: 'ROTATE_IMAGE', id: node.id, rotation: newRotation });
    },
    [dispatch, node.id, snapEnabled],
  );

  const handleRotateUp = useCallback(() => {
    rotateStartRef.current = null;
  }, []);

  const handleRightClick = useCallback(
    (e: React.MouseEvent) => {
      // While editing text, let the browser's native menu through so
      // spellcheck suggestions are available in the textarea.
      if ((e.target as HTMLElement).closest('textarea')) {
        e.stopPropagation();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (node.locked) return;
      if (!selected) {
        dispatch({ type: 'SELECT', id: node.id, additive: false });
      }
      onContextMenu(e, node.id);
    },
    [dispatch, node.id, onContextMenu, selected],
  );

  const corners = ['tl', 'tr', 'bl', 'br'];
  const textEditRef = useRef<HTMLTextAreaElement>(null);
  const [localText, setLocalText] = useState(node.text ?? '');

  // Sync local text when node text changes externally
  useEffect(() => { setLocalText(node.text ?? ''); }, [node.text]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (editingText && textEditRef.current) {
      textEditRef.current.focus();
      textEditRef.current.select();
    }
  }, [editingText]);

  // Auto-resize text node — measure text directly via canvas
  const nodeRef = useRef(node);
  nodeRef.current = node;
  useEffect(() => {
    if (!isTextNode || editingText) return;
    const n = nodeRef.current;
    const m = measureTextNode(n, n.text || 'Text');
    if (n.textAutoWidth) {
      if (Math.abs(m.w - n.width) > 1 || Math.abs(m.h - n.height) > 1) {
        dispatch({ type: 'RESIZE_IMAGE', id: n.id, width: m.w, height: m.h, x: n.x, y: n.y });
      }
    } else if (m.h > n.height + 1) {
      // Manually-sized frame is authoritative — only grow when the text
      // no longer fits, never snap the user's frame back down
      dispatch({ type: 'RESIZE_IMAGE', id: n.id, width: n.width, height: m.h, x: n.x, y: n.y });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTextNode, editingText, node.text, node.fontSize, node.fontFamily, node.fontBold, node.fontItalic, node.textAutoWidth, node.width, dispatch]);

  const commitTextEdit = useCallback(() => {
    if (localText !== node.text) {
      dispatch({ type: 'SNAPSHOT' });
      dispatch({ type: 'UPDATE_TEXT', id: node.id, updates: { text: localText } });
    }
    onEditText?.(null);
  }, [dispatch, node.id, node.text, localText, onEditText]);

  const handleDoubleClick = useCallback(() => {
    if (isTextNode && onEditText) {
      onEditText(node.id);
    }
  }, [isTextNode, node.id, onEditText]);

  return (
    <div
      className={`image-node${selected ? ' image-node-selected' : ''}${node.locked ? ' image-node-locked' : ''}${isTextNode ? ' text-node' : ''}`}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        zIndex: node.zIndex,
        transform: `rotate(${node.rotation}deg)`,
        pointerEvents: node.locked ? 'none' : undefined,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDragStart={(e) => e.preventDefault()}
      onContextMenu={handleRightClick}
      onDoubleClick={handleDoubleClick}
    >
      {highlightColor && (
        <div
          className="image-node-highlight"
          style={{
            borderColor: highlightColor,
            borderWidth: Math.max(2, 3 / zoom),
          }}
        />
      )}
      {!isTextNode && node.bgColor && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: -1,
            backgroundColor: node.bgColor,
            opacity: node.opacity, filter: adjustFilter,
            pointerEvents: 'none',
          }}
        />
      )}
      {isTextNode ? (
        editingText ? (
          <textarea
            ref={textEditRef}
            className="text-node-editor"
            value={localText}
            onChange={(e) => {
              setLocalText(e.target.value);
              // Same measurement as the post-commit auto-size — the box you
              // see while typing is exactly the box after Confirm Text.
              // Fixed-width (manually sized) frames only grow when overflowing.
              const m = measureTextNode(node, e.target.value || 'Text');
              if (node.textAutoWidth) {
                if (m.w !== node.width || m.h !== node.height) {
                  dispatch({ type: 'RESIZE_IMAGE', id: node.id, width: m.w, height: m.h, x: node.x, y: node.y });
                }
              } else if (m.h > node.height + 1) {
                dispatch({ type: 'RESIZE_IMAGE', id: node.id, width: node.width, height: m.h, x: node.x, y: node.y });
              }
            }}
            onBlur={commitTextEdit}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') { setLocalText(node.text ?? ''); onEditText?.(null); }
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) commitTextEdit();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              fontFamily: cssFontFamily(node.fontFamily),
              fontSize: node.fontSize ?? 24,
              fontWeight: node.fontBold ? 'bold' : 'normal',
              fontStyle: node.fontItalic ? 'italic' : 'normal',
              textDecoration: node.fontUnderline ? 'underline' : 'none',
              textAlign: node.textAlign ?? 'left',
              color: node.textColor ?? '#000000',
              opacity: node.opacity, filter: adjustFilter,
              whiteSpace: node.textAutoWidth ? 'pre' : 'pre-wrap',
              wordWrap: node.textAutoWidth ? 'normal' : 'break-word',
            }}
          />
        ) : (
          // Same element type as the editor — a <div> lays out large text a
          // few px differently than a <textarea>, which made text visibly
          // shift on commit. Identical element = pixel-identical layout.
          <textarea
            className="text-node-editor text-node-display"
            value={node.text || 'Text'}
            readOnly
            tabIndex={-1}
            style={{
              fontFamily: cssFontFamily(node.fontFamily),
              fontSize: node.fontSize ?? 24,
              fontWeight: node.fontBold ? 'bold' : 'normal',
              fontStyle: node.fontItalic ? 'italic' : 'normal',
              textDecoration: node.fontUnderline ? 'underline' : 'none',
              textAlign: node.textAlign ?? 'left',
              color: node.textColor ?? '#000000',
              opacity: node.opacity, filter: adjustFilter,
              whiteSpace: node.textAutoWidth ? 'pre' : 'pre-wrap',
              wordWrap: node.textAutoWidth ? 'normal' : 'break-word',
            }}
          />
        )
      ) : (() => {
        const flipTransform = (node.flipH || node.flipV)
          ? `scale(${node.flipH ? -1 : 1}, ${node.flipV ? -1 : 1})`
          : undefined;

        // When a full composite is available (blend modes), render it instead of separate layers
        if (node.paintCompositeUrl) {
          if (node.cropRect) {
            const crop = node.cropRect;
            // Per-axis display scale. A single shared scale is wrong when the
            // node has been stretched non-uniformly (e.g. shift-resize or a
            // freshly-sliced piece of an originally-stretched element) — using
            // width-derived scale for height crops the wrong vertical region.
            const cropDsX = node.width / crop.w;
            const cropDsY = node.height / crop.h;
            return (
              <div style={{ width: '100%', height: '100%', overflow: 'hidden', contain: 'paint', opacity: node.opacity, filter: adjustFilter, transform: flipTransform }}>
                <img
                  src={node.paintCompositeUrl}
                  alt={node.fileName}
                  className="image-node-img image-node-img-cropped"
                  draggable={false}
                  style={{
                    width: node.naturalWidth * cropDsX,
                    height: node.naturalHeight * cropDsY,
                    marginLeft: -crop.x * cropDsX,
                    marginTop: -crop.y * cropDsY,
                  }}
                />
              </div>
            );
          }
          return (
            <img
              src={node.paintCompositeUrl}
              alt={node.fileName}
              className="image-node-img"
              draggable={false}
              style={{ opacity: node.opacity, filter: adjustFilter, transform: flipTransform }}
            />
          );
        }

        if (node.cropRect) {
          const crop = node.cropRect;
          // Per-axis scale — see paintCompositeUrl branch above for rationale.
          const cropDsX = node.width / crop.w;
          const cropDsY = node.height / crop.h;
          const maskStyle: React.CSSProperties = node.maskDataUrl ? {
            WebkitMaskImage: `url(${node.maskDataUrl})`,
            maskImage: `url(${node.maskDataUrl})`,
            WebkitMaskSize: `${node.naturalWidth * cropDsX}px ${node.naturalHeight * cropDsY}px`,
            maskSize: `${node.naturalWidth * cropDsX}px ${node.naturalHeight * cropDsY}px`,
            WebkitMaskPosition: `${-crop.x * cropDsX}px ${-crop.y * cropDsY}px`,
            maskPosition: `${-crop.x * cropDsX}px ${-crop.y * cropDsY}px`,
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
          } : {};
          return (
            <>
              <div style={{ width: '100%', height: '100%', overflow: 'hidden', contain: 'paint', opacity: node.opacity, filter: adjustFilter, transform: flipTransform, ...maskStyle }}>
                <img
                  src={node.src}
                  alt={node.fileName}
                  className="image-node-img image-node-img-cropped"
                  draggable={false}
                  style={{
                    width: node.naturalWidth * cropDsX,
                    height: node.naturalHeight * cropDsY,
                    marginLeft: -crop.x * cropDsX,
                    marginTop: -crop.y * cropDsY,
                  }}
                />
              </div>
              {node.paintUnderlayUrl && (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', contain: 'paint', pointerEvents: 'none', ...maskStyle }}>
                  <img
                    src={node.paintUnderlayUrl}
                    className="image-node-img image-node-paint-overlay"
                    draggable={false}
                    style={{
                      width: node.naturalWidth * cropDsX,
                      height: node.naturalHeight * cropDsY,
                      marginLeft: -crop.x * cropDsX,
                      marginTop: -crop.y * cropDsY,
                      opacity: node.opacity, filter: adjustFilter,
                      transform: flipTransform,
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              )}
              {node.paintOverlayUrl && (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', contain: 'paint', pointerEvents: 'none' }}>
                  <img
                    src={node.paintOverlayUrl}
                    className="image-node-img image-node-paint-overlay"
                    draggable={false}
                    style={{
                      width: node.naturalWidth * cropDsX,
                      height: node.naturalHeight * cropDsY,
                      marginLeft: -crop.x * cropDsX,
                      marginTop: -crop.y * cropDsY,
                      opacity: node.opacity, filter: adjustFilter,
                      transform: flipTransform,
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              )}
            </>
          );
        }
        return (
          <>
            <img
              src={node.src}
              alt={node.fileName}
              className="image-node-img"
              draggable={false}
              style={{
                opacity: node.opacity, filter: adjustFilter,
                transform: flipTransform,
                ...(node.maskDataUrl ? {
                  WebkitMaskImage: `url(${node.maskDataUrl})`,
                  maskImage: `url(${node.maskDataUrl})`,
                  WebkitMaskSize: '100% 100%',
                  maskSize: '100% 100%',
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                } : {}),
              }}
            />
            {node.paintUnderlayUrl && (
              <img
                src={node.paintUnderlayUrl}
                className="image-node-img image-node-paint-overlay"
                draggable={false}
                style={{
                  position: 'absolute', top: 0, left: 0,
                  width: '100%', height: '100%',
                  opacity: node.opacity, filter: adjustFilter,
                  transform: flipTransform,
                  pointerEvents: 'none',
                  ...(node.maskDataUrl ? {
                    WebkitMaskImage: `url(${node.maskDataUrl})`,
                    maskImage: `url(${node.maskDataUrl})`,
                    WebkitMaskSize: '100% 100%',
                    maskSize: '100% 100%',
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                  } : {}),
                }}
              />
            )}
            {node.paintOverlayUrl && (
              <img
                src={node.paintOverlayUrl}
                className="image-node-img image-node-paint-overlay"
                draggable={false}
                style={{
                  position: 'absolute', top: 0, left: 0,
                  width: '100%', height: '100%',
                  opacity: node.opacity, filter: adjustFilter,
                  transform: flipTransform,
                  pointerEvents: 'none',
                }}
              />
            )}
          </>
        );
      })()}

      {selected && !multiSelected && !node.locked && (() => {
        // Counter-scale handles so they stay a consistent visual size
        const s = 1 / zoom;
        const handleSize = 8 * s;
        const handleOffset = -handleSize;
        const rotateLineH = 25 * s;
        const rotateSize = 12 * s;
        const rotateTop = -(rotateLineH + rotateSize + 2 * s);
        const rotateLineTop = -(rotateLineH + 2 * s);

        return (
          <>
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

            {/* Rotation handle */}
            <div
              className="rotate-handle-line"
              style={{
                top: rotateLineTop,
                height: rotateLineH,
                width: 2 * s,
                left: '50%',
                transform: `translateX(-50%)`,
              }}
            />
            <div
              className="rotate-handle"
              style={{
                top: rotateTop,
                width: rotateSize,
                height: rotateSize,
                left: '50%',
                transform: `translateX(-50%)`,
              }}
              onPointerDown={handleRotateDown}
              onPointerMove={handleRotateMove}
              onPointerUp={handleRotateUp}
            />
          </>
        );
      })()}
    </div>
  );
}
