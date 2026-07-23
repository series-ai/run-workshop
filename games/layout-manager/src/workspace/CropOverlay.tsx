import { useRef, useCallback, useEffect } from 'react';
import type { ImageNode } from './types';

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CropGeometry {
  ds: number;
  fullX: number;
  fullY: number;
}

interface CropOverlayProps {
  image: ImageNode;
  cropRect: CropRect;
  zoom: number;
  offsetOnly?: boolean;
  onRectChange: (rect: CropRect) => void;
  onApply: (rect: CropRect, geometry: CropGeometry) => void;
  onCancel: () => void;
}

type DragMode = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | 'move';

export function CropOverlay({ image, cropRect, zoom, offsetOnly, onRectChange, onApply, onCancel }: CropOverlayProps) {
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    startRect: CropRect;
  } | null>(null);

  // Display scale: display pixels per natural pixel
  const prev = image.cropRect;
  const ds = prev ? image.width / prev.w : image.width / image.naturalWidth;

  // Full source image in workspace coords
  const fullW = image.naturalWidth * ds;
  const fullH = image.naturalHeight * ds;
  const fullX = prev ? image.x - prev.x * ds : image.x;
  const fullY = prev ? image.y - prev.y * ds : image.y;

  // In offset mode, the border stays fixed at the original crop position;
  // the source image shifts instead. `prev` (image.cropRect) is the fixed anchor.
  const fixedRect = offsetOnly && prev ? prev : cropRect;
  const cdx = fixedRect.x * ds;
  const cdy = fixedRect.y * ds;
  const cdw = fixedRect.w * ds;
  const cdh = fixedRect.h * ds;

  // Source image offset (only non-zero in offset mode)
  const imgOffsetX = offsetOnly && prev ? (prev.x - cropRect.x) * ds : 0;
  const imgOffsetY = offsetOnly && prev ? (prev.y - cropRect.y) * ds : 0;

  const sanitizeRect = useCallback(
    (r: CropRect, isMove: boolean): CropRect => {
      let w = Math.max(1, Math.round(r.w));
      let h = Math.max(1, Math.round(r.h));
      w = Math.min(w, image.naturalWidth);
      h = Math.min(h, image.naturalHeight);
      let x = Math.round(r.x);
      let y = Math.round(r.y);
      if (isMove) {
        x = Math.max(0, Math.min(x, image.naturalWidth - w));
        y = Math.max(0, Math.min(y, image.naturalHeight - h));
      } else {
        x = Math.max(0, x);
        y = Math.max(0, y);
        if (x + w > image.naturalWidth) w = image.naturalWidth - x;
        if (y + h > image.naturalHeight) h = image.naturalHeight - y;
      }
      return { x, y, w, h };
    },
    [image.naturalWidth, image.naturalHeight],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, mode: DragMode) => {
      e.stopPropagation();
      e.preventDefault();
      dragRef.current = {
        mode,
        startX: e.clientX,
        startY: e.clientY,
        startRect: { ...cropRect },
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [cropRect],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;

      let rawDx = (e.clientX - d.startX) / zoom / ds;
      let rawDy = (e.clientY - d.startY) / zoom / ds;

      // Un-rotate screen-space delta back to image-space
      if (image.rotation) {
        const rad = -(image.rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rx = rawDx * cos - rawDy * sin;
        const ry = rawDx * sin + rawDy * cos;
        rawDx = rx;
        rawDy = ry;
      }

      // Flip inverts the visual drag direction
      if (image.flipH) rawDx = -rawDx;
      if (image.flipV) rawDy = -rawDy;

      // Shift: lock to cardinal direction
      if (e.shiftKey) {
        if (Math.abs(rawDx) >= Math.abs(rawDy)) {
          rawDy = 0;
        } else {
          rawDx = 0;
        }
      }

      const r = { ...d.startRect };

      if (d.mode === 'move') {
        // In offset mode, drag moves the image (invert direction)
        const sign = offsetOnly ? -1 : 1;
        r.x = r.x + rawDx * sign;
        r.y = r.y + rawDy * sign;
      } else {
        if (d.mode.includes('w')) {
          const newX = r.x + rawDx;
          const maxX = r.x + r.w - 1;
          const clampedX = Math.min(newX, maxX);
          r.w = r.w + (r.x - clampedX);
          r.x = clampedX;
        }
        if (d.mode.includes('e')) {
          r.w = Math.max(1, r.w + rawDx);
        }
        if (d.mode.includes('n')) {
          const newY = r.y + rawDy;
          const maxY = r.y + r.h - 1;
          const clampedY = Math.min(newY, maxY);
          r.h = r.h + (r.y - clampedY);
          r.y = clampedY;
        }
        if (d.mode.includes('s')) {
          r.h = Math.max(1, r.h + rawDy);
        }
      }

      onRectChange(sanitizeRect(r, d.mode === 'move'));
    },
    [zoom, ds, offsetOnly, onRectChange, sanitizeRect, image.flipH, image.flipV, image.rotation],
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Handle Enter/Escape inside CropOverlay — single source of truth
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onApply(cropRect, { ds, fullX, fullY });
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cropRect, ds, fullX, fullY, onApply, onCancel]);

  const s = 1 / zoom;
  const handleSize = 10 * s;
  const halfHandle = handleSize / 2;
  const edgeThickness = 6 * s;
  const toolbarScale = s;

  // Rotate cursor direction to match the visual orientation
  const rotateCursor = (cursor: string): string => {
    // Normalize rotation to 0-360 range, then to nearest 45° step
    const rot = (((image.rotation ?? 0) % 360) + 360) % 360;
    if (rot < 23) return cursor;
    // 8-direction cursor cycle
    const dirs = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
    const match = cursor.match(/^(nw|ne|sw|se|ns|ew|n|s|e|w)-resize$/);
    if (!match) return cursor;
    const dir = match[1]!;
    // How many 45° steps to rotate
    const steps = Math.round(rot / 45) % 8;
    if (dir === 'ns') {
      const rotated = dirs[(0 + steps) % 8]!;
      return rotated.length === 2 ? `${rotated}-resize` : (rotated === 'n' || rotated === 's' ? 'ns-resize' : 'ew-resize');
    }
    if (dir === 'ew') {
      const rotated = dirs[(2 + steps) % 8]!;
      return rotated.length === 2 ? `${rotated}-resize` : (rotated === 'n' || rotated === 's' ? 'ns-resize' : 'ew-resize');
    }
    const idx = dirs.indexOf(dir);
    if (idx === -1) return cursor;
    const rotated = dirs[(idx + steps) % 8]!;
    return `${rotated}-resize`;
  };

  // Flip resize cursors so arrows match the visual orientation
  const cursorMap: Record<string, string> = {};
  if (image.flipH && image.flipV) {
    Object.assign(cursorMap, { 'nw-resize': 'se-resize', 'ne-resize': 'sw-resize', 'sw-resize': 'ne-resize', 'se-resize': 'nw-resize' });
  } else if (image.flipH) {
    Object.assign(cursorMap, { 'nw-resize': 'ne-resize', 'ne-resize': 'nw-resize', 'sw-resize': 'se-resize', 'se-resize': 'sw-resize', 'ew-resize': 'ew-resize' });
  } else if (image.flipV) {
    Object.assign(cursorMap, { 'nw-resize': 'sw-resize', 'sw-resize': 'nw-resize', 'ne-resize': 'se-resize', 'se-resize': 'ne-resize', 'ns-resize': 'ns-resize' });
  }
  const fc = (cursor: string): string => rotateCursor(cursorMap[cursor] ?? cursor);

  // Counter-rotation for UI elements so they stay axis-aligned on screen
  const counterRotate = image.rotation ? `rotate(${-image.rotation}deg)` : undefined;

  const hs = (top: number, left: number, cursor: string): React.CSSProperties => ({
    position: 'absolute',
    width: handleSize,
    height: handleSize,
    top: top - halfHandle,
    left: left - halfHandle,
    background: '#fff',
    border: `2px solid var(--color-primary)`,
    borderRadius: 2,
    cursor,
    pointerEvents: 'auto',
    zIndex: 5,
    transform: counterRotate,
  });

  const es = (
    top: number,
    left: number,
    width: number,
    height: number,
    cursor: string,
  ): React.CSSProperties => ({
    position: 'absolute',
    top, left, width, height,
    cursor,
    pointerEvents: 'auto',
    zIndex: 4,
  });

  // Rotation + flip on the outer div so handles match the visual image orientation.
  const flipScaleX = image.flipH ? -1 : 1;
  const flipScaleY = image.flipV ? -1 : 1;
  const hasFlip = image.flipH || image.flipV;

  const transforms: string[] = [];
  if (image.rotation) transforms.push(`rotate(${image.rotation}deg)`);
  if (hasFlip) transforms.push(`scale(${flipScaleX}, ${flipScaleY})`);
  const overlayTransform = transforms.length > 0 ? transforms.join(' ') : undefined;

  // Transform origin must be the ORIGINAL node center (not the editing crop center),
  // so the overlay stays aligned with the ImageNode as the crop rect changes.
  const originX = prev ? prev.x * ds + (prev.w * ds) / 2 : fullW / 2;
  const originY = prev ? prev.y * ds + (prev.h * ds) / 2 : fullH / 2;



  return (
    <>
    <div
      className="crop-overlay"
      style={{
        position: 'absolute',
        left: fullX,
        top: fullY,
        width: fullW,
        height: fullH,
        transform: overlayTransform,
        transformOrigin: `${originX}px ${originY}px`,
        pointerEvents: 'none',
        zIndex: 999996,
      }}
    >
      {/* Full source image (with mask if present) */}
      {(() => {
        const maskStyle: React.CSSProperties = image.maskDataUrl ? {
          WebkitMaskImage: `url(${image.maskDataUrl})`,
          maskImage: `url(${image.maskDataUrl})`,
          WebkitMaskSize: `${fullW}px ${fullH}px`,
          maskSize: `${fullW}px ${fullH}px`,
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
        } : {};
        return (
          <>
            <img
              src={image.src}
              alt=""
              draggable={false}
              style={{
                position: 'absolute',
                left: imgOffsetX,
                top: imgOffsetY,
                width: fullW,
                height: fullH,
                pointerEvents: 'none',
                display: 'block',
                ...maskStyle,
              }}
            />
            {image.paintUnderlayUrl && (
              <img
                src={image.paintUnderlayUrl}
                draggable={false}
                style={{
                  position: 'absolute',
                  left: imgOffsetX,
                  top: imgOffsetY,
                  width: fullW,
                  height: fullH,
                  pointerEvents: 'none',
                  display: 'block',
                  ...maskStyle,
                }}
              />
            )}
            {image.paintOverlayUrl && (
              <img
                src={image.paintOverlayUrl}
                draggable={false}
                style={{
                  position: 'absolute',
                  left: imgOffsetX,
                  top: imgOffsetY,
                  width: fullW,
                  height: fullH,
                  pointerEvents: 'none',
                  display: 'block',
                }}
              />
            )}
          </>
        );
      })()}

      {/* Dark mask with crop hole */}
      <div
        className="crop-mask"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: fullW,
          height: fullH,
          clipPath: `polygon(
            0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
            ${cdx}px ${cdy}px,
            ${cdx}px ${cdy + cdh}px,
            ${cdx + cdw}px ${cdy + cdh}px,
            ${cdx + cdw}px ${cdy}px,
            ${cdx}px ${cdy}px
          )`,
        }}
      />

      {/* Crop border */}
      <div
        className="crop-border"
        style={{
          top: cdy,
          left: cdx,
          width: cdw,
          height: cdh,
          borderWidth: Math.max(1, 1.5 * s),
        }}
      />

      {/* Move drag area — full overlay in offset mode, crop rect in crop mode */}
      <div
        style={{
          position: 'absolute',
          top: offsetOnly ? 0 : cdy,
          left: offsetOnly ? 0 : cdx,
          width: offsetOnly ? fullW : cdw,
          height: offsetOnly ? fullH : cdh,
          cursor: offsetOnly ? 'grab' : 'move',
          pointerEvents: 'auto',
          zIndex: 3,
        }}
        onPointerDown={(e) => handlePointerDown(e, 'move')}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {/* Edge handles (crop only) */}
      {!offsetOnly && <>
        <div style={es(cdy - edgeThickness / 2, cdx, cdw, edgeThickness, fc('ns-resize'))}
          onPointerDown={(e) => handlePointerDown(e, 'n')}
          onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} />
        <div style={es(cdy + cdh - edgeThickness / 2, cdx, cdw, edgeThickness, fc('ns-resize'))}
          onPointerDown={(e) => handlePointerDown(e, 's')}
          onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} />
        <div style={es(cdy, cdx - edgeThickness / 2, edgeThickness, cdh, fc('ew-resize'))}
          onPointerDown={(e) => handlePointerDown(e, 'w')}
          onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} />
        <div style={es(cdy, cdx + cdw - edgeThickness / 2, edgeThickness, cdh, fc('ew-resize'))}
          onPointerDown={(e) => handlePointerDown(e, 'e')}
          onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} />

        {/* Corner handles */}
        <div style={hs(cdy, cdx, fc('nw-resize'))}
          onPointerDown={(e) => handlePointerDown(e, 'nw')}
          onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} />
        <div style={hs(cdy, cdx + cdw, fc('ne-resize'))}
          onPointerDown={(e) => handlePointerDown(e, 'ne')}
          onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} />
        <div style={hs(cdy + cdh, cdx, fc('sw-resize'))}
          onPointerDown={(e) => handlePointerDown(e, 'sw')}
          onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} />
        <div style={hs(cdy + cdh, cdx + cdw, fc('se-resize'))}
          onPointerDown={(e) => handlePointerDown(e, 'se')}
          onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} />

        {/* Edge midpoint handles */}
        <div style={hs(cdy, cdx + cdw / 2, fc('ns-resize'))}
          onPointerDown={(e) => handlePointerDown(e, 'n')}
          onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} />
        <div style={hs(cdy + cdh, cdx + cdw / 2, fc('ns-resize'))}
          onPointerDown={(e) => handlePointerDown(e, 's')}
          onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} />
        <div style={hs(cdy + cdh / 2, cdx, fc('ew-resize'))}
          onPointerDown={(e) => handlePointerDown(e, 'w')}
          onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} />
        <div style={hs(cdy + cdh / 2, cdx + cdw, fc('ew-resize'))}
          onPointerDown={(e) => handlePointerDown(e, 'e')}
          onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} />
      </>}

    </div>

    {/* Toolbar — rendered OUTSIDE the rotated overlay so it's never affected by rotation/flip */}
    {(() => {
      const rad = ((image.rotation ?? 0) * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const fsx = image.flipH ? -1 : 1;
      const fsy = image.flipV ? -1 : 1;

      // Transform crop rect corners from overlay-local to workspace-canvas space
      const toParent = (lx: number, ly: number) => {
        const fx = (lx - originX) * fsx;
        const fy = (ly - originY) * fsy;
        return {
          x: fx * cos - fy * sin + originX + fullX,
          y: fx * sin + fy * cos + originY + fullY,
        };
      };
      const corners = [
        toParent(cdx, cdy),
        toParent(cdx + cdw, cdy),
        toParent(cdx + cdw, cdy + cdh),
        toParent(cdx, cdy + cdh),
      ];
      const tbTop = Math.max(...corners.map((c) => c.y)) + 8 * s;
      const tbLeft = (Math.min(...corners.map((c) => c.x)) + Math.max(...corners.map((c) => c.x))) / 2;

      return (
        <div
          className="crop-toolbar"
          style={{
            position: 'absolute',
            top: tbTop,
            left: tbLeft,
            transform: `translateX(-50%) scale(${toolbarScale})`,
            transformOrigin: 'top center',
            pointerEvents: 'auto',
            zIndex: 999996,
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="crop-toolbar-info">
            {offsetOnly ? 'Offset' : `${cropRect.w} x ${cropRect.h}`}
          </div>
          <button className="crop-toolbar-btn crop-toolbar-apply" onClick={() => onApply(cropRect, { ds, fullX, fullY })}>Apply</button>
          <button className="crop-toolbar-btn crop-toolbar-cancel" onClick={onCancel}>Cancel</button>
        </div>
      );
    })()}
    </>
  );
}
