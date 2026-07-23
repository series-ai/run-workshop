import { useRef, useCallback, useEffect, useState } from 'react';
import type { RulerGuide, WorkspaceAction } from './types';

const RULER_SIZE = 20; // px thickness of ruler bars

interface RulersProps {
  pan: { x: number; y: number };
  zoom: number;
  guides: RulerGuide[];
  dispatch: React.Dispatch<WorkspaceAction>;
  themeName?: string;
}

/** Compute a nice tick interval given the current zoom. */
function tickInterval(zoom: number): { major: number; minor: number } {
  const pixelsPerUnit = zoom;
  const candidates = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
  for (const c of candidates) {
    if (c * pixelsPerUnit >= 60) return { major: c, minor: c / 5 };
  }
  return { major: 5000, minor: 1000 };
}

function RulerCanvas({
  axis,
  pan,
  zoom,
  guides,
  themeName,
}: {
  axis: 'x' | 'y';
  pan: { x: number; y: number };
  zoom: number;
  guides: RulerGuide[];
  themeName?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Track container size via ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ w: width, h: height });
      }
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0 || size.h === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    ctx.scale(dpr, dpr);

    const w = size.w;
    const h = size.h;

    ctx.clearRect(0, 0, w, h);

    // Read theme colors from CSS variables
    const rootStyle = getComputedStyle(document.documentElement);
    const surfaceRgb = rootStyle.getPropertyValue('--color-surface-rgb').trim() || '22, 33, 62';
    const textRgb = rootStyle.getPropertyValue('--color-text-primary-rgb').trim() || '255, 255, 255';

    // Background
    ctx.fillStyle = `rgba(${surfaceRgb}, 0.95)`;
    ctx.fillRect(0, 0, w, h);

    const { major, minor } = tickInterval(zoom);
    const offset = axis === 'x' ? pan.x : pan.y;
    const length = axis === 'x' ? w : h;

    ctx.fillStyle = `rgba(${textRgb}, 0.45)`;
    ctx.strokeStyle = `rgba(${textRgb}, 0.25)`;
    ctx.lineWidth = 1;
    ctx.font = '9px -apple-system, sans-serif';
    ctx.textBaseline = axis === 'x' ? 'top' : 'middle';

    const startWs = -offset / zoom;
    const endWs = (length - offset) / zoom;

    const firstMinor = Math.floor(startWs / minor) * minor;
    for (let ws = firstMinor; ws <= endWs; ws += minor) {
      const screen = ws * zoom + offset;
      if (screen < 0 || screen > length) continue;

      const isMajor = Math.abs(ws % major) < 0.01;
      const tickLen = isMajor ? RULER_SIZE * 0.6 : RULER_SIZE * 0.3;

      ctx.beginPath();
      if (axis === 'x') {
        ctx.moveTo(screen, RULER_SIZE);
        ctx.lineTo(screen, RULER_SIZE - tickLen);
      } else {
        ctx.moveTo(RULER_SIZE, screen);
        ctx.lineTo(RULER_SIZE - tickLen, screen);
      }
      ctx.stroke();

    }

    // Draw guide markers on the ruler
    // Top ruler (axis='x') shows markers for vertical guides (guide.axis='x')
    // Left ruler (axis='y') shows markers for horizontal guides (guide.axis='y')
    ctx.fillStyle = 'rgba(0, 200, 220, 0.9)';
    for (const g of guides) {
      if (g.axis !== axis) continue;
      const screen = g.position * zoom + offset;
      if (screen < 0 || screen > length) continue;

      if (axis === 'x') {
        ctx.beginPath();
        ctx.moveTo(screen, RULER_SIZE);
        ctx.lineTo(screen - 4, RULER_SIZE - 6);
        ctx.lineTo(screen + 4, RULER_SIZE - 6);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(RULER_SIZE, screen);
        ctx.lineTo(RULER_SIZE - 6, screen - 4);
        ctx.lineTo(RULER_SIZE - 6, screen + 4);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Bottom/right edge line
    ctx.strokeStyle = `rgba(${textRgb}, 0.12)`;
    ctx.beginPath();
    if (axis === 'x') {
      ctx.moveTo(0, RULER_SIZE - 0.5);
      ctx.lineTo(w, RULER_SIZE - 0.5);
    } else {
      ctx.moveTo(RULER_SIZE - 0.5, 0);
      ctx.lineTo(RULER_SIZE - 0.5, h);
    }
    ctx.stroke();
  }, [axis, pan, zoom, guides, size, themeName]);

  const wrapperStyle: React.CSSProperties = axis === 'x'
    ? { position: 'fixed', top: 0, left: RULER_SIZE, right: 0, height: RULER_SIZE, zIndex: 101, pointerEvents: 'none' }
    : { position: 'fixed', top: RULER_SIZE, left: 0, bottom: 0, width: RULER_SIZE, zIndex: 101, pointerEvents: 'none' };

  return (
    <div style={wrapperStyle}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}

export function Rulers({ pan, zoom, guides, dispatch, themeName }: RulersProps) {
  const dragRef = useRef<{
    guideAxis: 'x' | 'y'; // the axis of the guide being created/moved
    guideId: string | null; // null = creating new, string = moving existing
  } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const screenToWorkspace = useCallback(
    (screenX: number, screenY: number) => ({
      x: (screenX - pan.x) / zoom,
      y: (screenY - pan.y) / zoom,
    }),
    [pan, zoom],
  );

  // Dragging from the TOP ruler → creates a HORIZONTAL guide (axis='y')
  // Dragging from the LEFT ruler → creates a VERTICAL guide (axis='x')
  const handleRulerPointerDown = useCallback(
    (e: React.PointerEvent, rulerAxis: 'x' | 'y') => {
      e.preventDefault();
      e.stopPropagation();

      // The guide axis is perpendicular to the ruler:
      // top ruler (rulerAxis='x') → guide axis 'y' (horizontal line at a Y position)
      // left ruler (rulerAxis='y') → guide axis 'x' (vertical line at an X position)
      const guideAxis = rulerAxis === 'x' ? 'y' : 'x';

      // Check if clicking on an existing guide marker on this ruler
      const ws = screenToWorkspace(e.clientX, e.clientY);
      // The ruler shows guides whose axis matches the ruler axis
      // (vertical guides on top ruler, horizontal guides on left ruler)
      // Wait - markers on the top ruler are for axis='x' guides (vertical lines at X positions)
      // So we check guides matching the RULER axis, not the perpendicular
      const pos = rulerAxis === 'x' ? ws.x : ws.y;
      const threshold = 8 / zoom;
      const existing = guides.find(
        (g) => g.axis === rulerAxis && Math.abs(g.position - pos) < threshold,
      );

      if (existing) {
        dispatch({ type: 'SNAPSHOT' });
        dragRef.current = { guideAxis: existing.axis, guideId: existing.id };
      } else {
        dragRef.current = { guideAxis, guideId: null };
      }

      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [screenToWorkspace, zoom, guides, dispatch],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const ref = dragRef.current;
      if (!ref) return;

      const ws = screenToWorkspace(e.clientX, e.clientY);
      const pos = Math.round(ref.guideAxis === 'x' ? ws.x : ws.y);

      // Show preview line
      if (previewRef.current) {
        previewRef.current.style.display = 'block';
        if (ref.guideAxis === 'x') {
          // Vertical guide line
          const screenX = pos * zoom + pan.x;
          previewRef.current.style.left = `${screenX}px`;
          previewRef.current.style.top = `${RULER_SIZE}px`;
          previewRef.current.style.width = '1px';
          previewRef.current.style.height = `calc(100vh - ${RULER_SIZE}px)`;
        } else {
          // Horizontal guide line
          const screenY = pos * zoom + pan.y;
          previewRef.current.style.left = `${RULER_SIZE}px`;
          previewRef.current.style.top = `${screenY}px`;
          previewRef.current.style.width = `calc(100vw - ${RULER_SIZE}px)`;
          previewRef.current.style.height = '1px';
        }
      }

      // Move existing guide
      if (ref.guideId) {
        dispatch({ type: 'MOVE_GUIDE', id: ref.guideId, position: pos });
      }
    },
    [screenToWorkspace, zoom, pan, dispatch],
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      const ref = dragRef.current;
      if (!ref) return;

      if (previewRef.current) {
        previewRef.current.style.display = 'none';
      }

      const ws = screenToWorkspace(e.clientX, e.clientY);
      const pos = Math.round(ref.guideAxis === 'x' ? ws.x : ws.y);

      // Check if released back on a ruler → delete
      const inTopRuler = e.clientY < RULER_SIZE;
      const inLeftRuler = e.clientX < RULER_SIZE;
      const inRuler = inTopRuler || inLeftRuler;

      if (ref.guideId) {
        if (inRuler) {
          dispatch({ type: 'REMOVE_GUIDE', id: ref.guideId });
        }
      } else {
        if (!inRuler) {
          dispatch({
            type: 'ADD_GUIDE',
            guide: { id: crypto.randomUUID(), axis: ref.guideAxis, position: pos },
          });
        }
      }

      dragRef.current = null;
    },
    [screenToWorkspace, dispatch],
  );

  // Global listeners for drag
  useEffect(() => {
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  return (
    <>
      <RulerCanvas axis="x" pan={pan} zoom={zoom} guides={guides} themeName={themeName} />
      <RulerCanvas axis="y" pan={pan} zoom={zoom} guides={guides} themeName={themeName} />

      {/* Corner square */}
      <div
        className="ruler-corner"
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={() => {
          if (guides.length > 0) dispatch({ type: 'CLEAR_GUIDES' });
        }}
        title={guides.length > 0 ? 'Double-click to clear all guides' : ''}
      />

      {/* Interaction overlays for creating guides */}
      <div
        className="ruler-hit-area ruler-hit-x"
        onPointerDown={(e) => handleRulerPointerDown(e, 'x')}
      />
      <div
        className="ruler-hit-area ruler-hit-y"
        onPointerDown={(e) => handleRulerPointerDown(e, 'y')}
      />

      {/* Preview line while dragging */}
      <div ref={previewRef} className="ruler-guide-preview" style={{ display: 'none' }} />
    </>
  );
}

export { RULER_SIZE };
