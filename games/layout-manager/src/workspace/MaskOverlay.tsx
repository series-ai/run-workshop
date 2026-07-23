import { useRef, useCallback, useEffect, useState } from 'react';
import type { ImageNode } from './types';
import type { MaskBrushSettings, MaskPoint, MaskSelection, WandSettings } from './maskBrushes';
import { drawMaskStrokeSegment, drawMaskDot, floodFillMask, MaskHistoryManager, buildWandMask } from './maskBrushes';
import { MaskToolbar } from './MaskToolbar';

import type { ScaleFilter, RulerGuide } from './types';

interface MaskOverlayProps {
  image: ImageNode;
  zoom: number;
  pan: { x: number; y: number };
  scaleFilter: ScaleFilter;
  guides: RulerGuide[];
  snapEnabled: boolean;
  onApply: (maskDataUrl: string | null) => void;
  onCancel: () => void;
}

// Paint a geometric shape onto a canvas context
function paintShape(ctx: CanvasRenderingContext2D, sel: MaskSelection, mode: 'set' | 'add' | 'subtract', nw: number, nh: number) {
  if (mode === 'set') {
    ctx.clearRect(0, 0, nw, nh);
  }
  ctx.save();
  if (mode === 'subtract') {
    ctx.globalCompositeOperation = 'destination-out';
  } else {
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.fillStyle = '#ffffff';
  if (sel.polygon && sel.polygon.length >= 3) {
    ctx.beginPath();
    ctx.moveTo(sel.polygon[0]!.x, sel.polygon[0]!.y);
    for (let i = 1; i < sel.polygon.length; i++) {
      ctx.lineTo(sel.polygon[i]!.x, sel.polygon[i]!.y);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(sel.x, sel.y, sel.w, sel.h);
  }
  ctx.restore();
}

function selMaskHasPixels(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d')!;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i]! > 0) return true;
  }
  return false;
}

// Restore pixels outside selection mask within a bounding box
function clipBrushToSelMask(
  maskCtx: CanvasRenderingContext2D,
  preStrokeData: ImageData,
  selMaskCtx: CanvasRenderingContext2D,
  bx: number, by: number, bw: number, bh: number,
) {
  const cw = maskCtx.canvas.width;
  const ch = maskCtx.canvas.height;
  // Clamp bbox to canvas
  const x0 = Math.max(0, Math.floor(bx));
  const y0 = Math.max(0, Math.floor(by));
  const x1 = Math.min(cw, Math.ceil(bx + bw));
  const y1 = Math.min(ch, Math.ceil(by + bh));
  const rw = x1 - x0;
  const rh = y1 - y0;
  if (rw <= 0 || rh <= 0) return;

  const current = maskCtx.getImageData(x0, y0, rw, rh);
  const selData = selMaskCtx.getImageData(x0, y0, rw, rh);
  const cd = current.data;
  const sd = selData.data;
  const pw = preStrokeData.width;

  for (let ry = 0; ry < rh; ry++) {
    for (let rx = 0; rx < rw; rx++) {
      const li = (ry * rw + rx) * 4;
      if (sd[li + 3]! === 0) {
        // Not selected — restore from pre-stroke
        const gi = ((y0 + ry) * pw + (x0 + rx)) * 4;
        cd[li] = preStrokeData.data[gi]!;
        cd[li + 1] = preStrokeData.data[gi + 1]!;
        cd[li + 2] = preStrokeData.data[gi + 2]!;
        cd[li + 3] = preStrokeData.data[gi + 3]!;
      }
    }
  }
  maskCtx.putImageData(current, x0, y0);
}

export function MaskOverlay({ image, zoom, pan, scaleFilter, guides, snapEnabled, onApply, onCancel }: MaskOverlayProps) {
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const selMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef(new MaskHistoryManager());
  const imgRef = useRef<HTMLImageElement | null>(null);
  const prevPointRef = useRef<MaskPoint | null>(null);
  const drawingRef = useRef(false);
  const initRef = useRef(false);
  const preStrokeDataRef = useRef<ImageData | null>(null);
  const lastStrokeEndRef = useRef<MaskPoint | null>(null);
  const antOffsetRef = useRef(0);
  const spaceHeldRef = useRef(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [middleHeld, setMiddleHeld] = useState(false);
  const antRafRef = useRef<number | null>(null);
  const cachedEdgeSegs = useRef<{ hSegs: Array<[number, number, number, number]>; vSegs: Array<[number, number, number, number]> } | null>(null);
  const edgeCacheDirty = useRef(true);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [, forceUpdate] = useState(0);

  // Selection state
  const [hasSelection, setHasSelection] = useState(false);
  const [polygonPoints, setPolygonPointsRaw] = useState<MaskPoint[]>([]);
  const polygonPointsRef = useRef<MaskPoint[]>([]);
  const setPolygonPoints = useCallback((p: MaskPoint[]) => { polygonPointsRef.current = p; setPolygonPointsRaw(p); }, []);
  const selStartRef = useRef<MaskPoint | null>(null);
  const polyDraggingRef = useRef(false);
  const selDraggedRef = useRef(false);
  const selModeRef = useRef<'set' | 'add' | 'subtract'>('set');
  const lastClickTimeRef = useRef(0);
  // For live rect preview during drag
  const [, setDragRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const dragRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const setDragRectBoth = useCallback((r: { x: number; y: number; w: number; h: number } | null) => {
    dragRectRef.current = r;
    setDragRect(r);
  }, []);

  const [brush, setBrushRaw] = useState<MaskBrushSettings>(() => {
    const defaults: MaskBrushSettings = { type: 'hide', shape: 'round', size: 20, opacity: 1, hardness: 1, spacing: 0.15 };
    try {
      const saved = localStorage.getItem('maskBrushSettings');
      if (saved) {
        const p = JSON.parse(saved);
        return {
          ...defaults,
          shape: p.shape === 'square' ? 'square' : 'round',
          size: Math.max(1, Math.min(2048, Number(p.size) || defaults.size)),
          opacity: Math.max(0.05, Math.min(1, Number(p.opacity) || defaults.opacity)),
          hardness: Math.max(0, Math.min(1, Number(p.hardness) || defaults.hardness)),
          spacing: Math.max(0.05, Math.min(2, Number(p.spacing) || defaults.spacing)),
        };
      }
    } catch {}
    return defaults;
  });

  const setBrush = useCallback((update: MaskBrushSettings | ((b: MaskBrushSettings) => MaskBrushSettings)) => {
    setBrushRaw((prev) => {
      const next = typeof update === 'function' ? update(prev) : update;
      localStorage.setItem('maskBrushSettings', JSON.stringify(next));
      return next;
    });
  }, []);

  const [wandSettings, setWandSettings] = useState<WandSettings>({ tolerance: 32, contiguous: true, spread: 0 });

  const { naturalWidth: nw, naturalHeight: nh } = image;

  const prev = image.cropRect;
  const ds = prev ? image.width / prev.w : image.width / nw;
  const fullW = nw * ds;
  const fullH = nh * ds;
  const fullX = prev ? image.x - prev.x * ds : image.x;
  const fullY = prev ? image.y - prev.y * ds : image.y;

  // Ensure selection mask canvas exists
  const getSelMaskCtx = useCallback((): CanvasRenderingContext2D => {
    if (!selMaskCanvasRef.current) {
      const c = document.createElement('canvas');
      c.width = nw;
      c.height = nh;
      selMaskCanvasRef.current = c;
    }
    return selMaskCanvasRef.current.getContext('2d')!;
  }, [nw, nh]);

  const updateHasSelection = useCallback(() => {
    const c = selMaskCanvasRef.current;
    setHasSelection(c ? selMaskHasPixels(c) : false);
    edgeCacheDirty.current = true;
  }, []);

  const clearSelection = useCallback(() => {
    const c = selMaskCanvasRef.current;
    if (c) c.getContext('2d')!.clearRect(0, 0, nw, nh);
    setHasSelection(false);
    setPolygonPoints([]);
    setDragRectBoth(null);
    edgeCacheDirty.current = true;
    cachedEdgeSegs.current = null;
  }, [nw, nh, setPolygonPoints, setDragRectBoth]);

  const applySelectionShape = useCallback((sel: MaskSelection, mode: 'set' | 'add' | 'subtract') => {
    const ctx = getSelMaskCtx();
    paintShape(ctx, sel, mode, nw, nh);
    updateHasSelection();
  }, [getSelMaskCtx, nw, nh, updateHasSelection]);

  const renderPreview = useCallback(() => {
    const display = displayCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const img = imgRef.current;
    if (!display || !maskCanvas || !img) return;

    if (display.width !== nw || display.height !== nh) {
      display.width = nw;
      display.height = nh;
    }

    const ctx = display.getContext('2d')!;
    ctx.clearRect(0, 0, nw, nh);

    // Read theme background for checkerboard
    const rootStyle = getComputedStyle(document.documentElement);
    const bgColor = rootStyle.getPropertyValue('--color-background').trim() || '#1a1a2e';
    const surfaceColor = rootStyle.getPropertyValue('--color-surface').trim() || '#2a2a3e';

    // Checkerboard
    const checkSize = Math.max(8, Math.round(nw / 80));
    ctx.save();
    for (let y = 0; y < nh; y += checkSize) {
      for (let x = 0; x < nw; x += checkSize) {
        const isDark = ((x / checkSize) + (y / checkSize)) % 2 === 0;
        ctx.fillStyle = isDark ? bgColor : surfaceColor;
        ctx.fillRect(x, y, checkSize, checkSize);
      }
    }
    ctx.restore();

    // Image masked (flip is handled via CSS on the canvas element)
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.drawImage(img, 0, 0, nw, nh);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskCanvas, 0, 0);
    ctx.globalCompositeOperation = 'destination-over';
    for (let y = 0; y < nh; y += checkSize) {
      for (let x = 0; x < nw; x += checkSize) {
        const isDark = ((x / checkSize) + (y / checkSize)) % 2 === 0;
        ctx.fillStyle = isDark ? bgColor : surfaceColor;
        ctx.fillRect(x, y, checkSize, checkSize);
      }
    }
    ctx.restore();

  }, [nw, nh, ds]);

  // --- Separate overlay render for selection outlines (called by animation loop) ---
  const renderOverlay = useCallback((dashOffset: number) => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;

    // Overlay is viewport-sized (screen space) — never changes with zoom
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (overlay.width !== vw || overlay.height !== vh) {
      overlay.width = vw;
      overlay.height = vh;
    }
    const oc = overlay.getContext('2d')!;
    oc.clearRect(0, 0, vw, vh);

    // Convert image coords to screen coords, accounting for rotation
    const scale = ds * zoom;
    const rad = (image.rotation * Math.PI) / 180;
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);
    const screenCx = (fullX + fullW / 2) * zoom + pan.x;
    const screenCy = (fullY + fullH / 2) * zoom + pan.y;
    const imgToScreen = (ix: number, iy: number): [number, number] => {
      // Position relative to image center in screen space
      const lx = (ix * ds - fullW / 2) * zoom;
      const ly = (iy * ds - fullH / 2) * zoom;
      // Rotate
      return [
        screenCx + lx * cosR - ly * sinR,
        screenCy + lx * sinR + ly * cosR,
      ];
    };

    // Scale dash pattern: at low zoom use longer dashes so they don't bleed together
    const dashOn = Math.max(4, Math.min(12, 6 / Math.min(1, scale)));
    const dashOff = Math.max(3, Math.min(8, 4 / Math.min(1, scale)));
    const dashTotal = dashOn + dashOff;

    const strokeAnts = () => {
      oc.lineWidth = 1.5;
      oc.setLineDash([dashOn, dashOff]);
      oc.lineDashOffset = dashOffset % dashTotal;
      oc.strokeStyle = '#fff';
      oc.stroke();
      oc.lineDashOffset = (dashOffset + dashTotal / 2) % dashTotal;
      oc.strokeStyle = '#000';
      oc.stroke();
    };

    // Selection outline with directional marching ants (clockwise flow)
    const selMask = selMaskCanvasRef.current;
    if (selMask && selMaskHasPixels(selMask)) {
      // Recompute edge segments only when selection changes
      if (edgeCacheDirty.current || !cachedEdgeSegs.current) {
        const sd = selMask.getContext('2d')!.getImageData(0, 0, nw, nh).data;
        const isSel = (x: number, y: number) => x >= 0 && y >= 0 && x < nw && y < nh && sd[(y * nw + x) * 4 + 3]! > 10;

        const hSegs: Array<[number, number, number, number]> = [];
        const vSegs: Array<[number, number, number, number]> = [];

        for (let y = 0; y <= nh; y++) {
          let inRun = false, runStart = 0, runDir = 1;
          for (let x = 0; x <= nw; x++) {
            const above = isSel(x, y - 1);
            const below = isSel(x, y);
            const edge = above !== below;
            if (edge && !inRun) {
              inRun = true; runStart = x;
              runDir = below ? 1 : -1;
            }
            if (!edge && inRun) { hSegs.push([runStart, x, y, runDir]); inRun = false; }
          }
          if (inRun) hSegs.push([runStart, nw, y, runDir]);
        }
        for (let x = 0; x <= nw; x++) {
          let inRun = false, runStart = 0, runDir = 1;
          for (let y = 0; y <= nh; y++) {
            const left = isSel(x - 1, y);
            const right = isSel(x, y);
            const edge = left !== right;
            if (edge && !inRun) {
              inRun = true; runStart = y;
              runDir = right ? -1 : 1;
            }
            if (!edge && inRun) { vSegs.push([runStart, y, x, runDir]); inRun = false; }
          }
          if (inRun) vSegs.push([runStart, nh, x, runDir]);
        }

        cachedEdgeSegs.current = { hSegs, vSegs };
        edgeCacheDirty.current = false;
      }

      const { hSegs, vSegs } = cachedEdgeSegs.current;

      oc.save();
      oc.lineWidth = 1.5;
      oc.setLineDash([dashOn, dashOff]);

      // Batch segments into 2 direction groups and draw each as one path
      const drawBatch = (segs: Array<[number, number, number, number]>, isHoriz: boolean, dir: number) => {
        const off = dashOffset * dir;
        const filtered = segs.filter((s) => s[3] === dir);
        if (filtered.length === 0) return;

        oc.strokeStyle = '#fff';
        oc.lineDashOffset = off % dashTotal;
        oc.beginPath();
        for (const s of filtered) {
          const [ax, ay] = isHoriz ? imgToScreen(s[0], s[2]) : imgToScreen(s[2], s[0]);
          const [bx, by] = isHoriz ? imgToScreen(s[1], s[2]) : imgToScreen(s[2], s[1]);
          oc.moveTo(ax, ay); oc.lineTo(bx, by);
        }
        oc.stroke();

        oc.strokeStyle = '#000';
        oc.lineDashOffset = (off + dashTotal / 2) % dashTotal;
        oc.beginPath();
        for (const s of filtered) {
          const [ax, ay] = isHoriz ? imgToScreen(s[0], s[2]) : imgToScreen(s[2], s[0]);
          const [bx, by] = isHoriz ? imgToScreen(s[1], s[2]) : imgToScreen(s[2], s[1]);
          oc.moveTo(ax, ay); oc.lineTo(bx, by);
        }
        oc.stroke();
      };

      drawBatch(hSegs, true, 1);
      drawBatch(hSegs, true, -1);
      drawBatch(vSegs, false, 1);
      drawBatch(vSegs, false, -1);

      oc.restore();
    }

    // In-progress drag rect preview
    const dr = dragRectRef.current;
    if (dr && dr.w > 0 && dr.h > 0) {
      oc.save();
      oc.beginPath();
      const [r0x, r0y] = imgToScreen(dr.x, dr.y);
      const [r1x, r1y] = imgToScreen(dr.x + dr.w, dr.y);
      const [r2x, r2y] = imgToScreen(dr.x + dr.w, dr.y + dr.h);
      const [r3x, r3y] = imgToScreen(dr.x, dr.y + dr.h);
      oc.moveTo(r0x, r0y); oc.lineTo(r1x, r1y); oc.lineTo(r2x, r2y); oc.lineTo(r3x, r3y); oc.closePath();
      strokeAnts();
      oc.restore();
    }

    // In-progress polygon points
    const polyPts = polygonPointsRef.current;
    if (polyPts.length > 0) {
      oc.save();
      oc.beginPath();
      const [p0x, p0y] = imgToScreen(polyPts[0]!.x, polyPts[0]!.y);
      oc.moveTo(p0x, p0y);
      for (let i = 1; i < polyPts.length; i++) { const [px, py] = imgToScreen(polyPts[i]!.x, polyPts[i]!.y); oc.lineTo(px, py); }
      strokeAnts();

      oc.setLineDash([]);
      for (const p of polyPts) {
        oc.beginPath();
        const [vpx, vpy] = imgToScreen(p.x, p.y);
        oc.arc(vpx, vpy, 4, 0, Math.PI * 2);
        oc.fillStyle = '#fff';
        oc.fill();
        oc.strokeStyle = '#000';
        oc.lineWidth = 1;
        oc.stroke();
      }

      if (polyPts.length >= 3) {
        oc.beginPath();
        const [cp0x, cp0y] = imgToScreen(polyPts[0]!.x, polyPts[0]!.y);
        oc.arc(cp0x, cp0y, 8, 0, Math.PI * 2);
        const primaryRgb = getComputedStyle(document.documentElement).getPropertyValue('--color-primary-rgb').trim() || '102, 126, 234';
        oc.strokeStyle = `rgba(${primaryRgb}, 0.6)`;
        oc.lineWidth = 2;
        oc.setLineDash([]);
        oc.stroke();
      }
      oc.restore();
    }
  }, [nw, nh, ds, zoom, scaleFilter, pan, fullX, fullY, fullW, fullH, image.rotation]);

  // Load source image and initialize mask
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    // Ensure sel mask canvas
    getSelMaskCtx();

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      const maskCanvas = maskCanvasRef.current;
      if (!maskCanvas) return;
      maskCanvas.width = nw;
      maskCanvas.height = nh;
      const ctx = maskCanvas.getContext('2d')!;

      if (image.maskDataUrl) {
        const maskImg = new Image();
        maskImg.onload = () => {
          ctx.drawImage(maskImg, 0, 0);
          renderPreview();
        };
        maskImg.src = image.maskDataUrl;
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, nw, nh);
        renderPreview();
      }
    };
    img.src = image.src;
  }, [nw, nh, image.src, image.maskDataUrl, renderPreview, getSelMaskCtx]);

  // Marching ants animation loop — throttled to 30fps
  useEffect(() => {
    let lastTime = 0;
    let lastDrawTime = 0;
    const frameInterval = 1000 / 30; // 30fps
    const animate = (time: number) => {
      const dt = lastTime ? (time - lastTime) / 1000 : 0;
      lastTime = time;

      const speed = Math.max(3, 8 * Math.min(1, ds * zoom));
      antOffsetRef.current = (antOffsetRef.current + dt * speed) % 20;

      // Only redraw at 30fps
      if (time - lastDrawTime >= frameInterval) {
        lastDrawTime = time;
        renderOverlay(antOffsetRef.current);
      }

      antRafRef.current = requestAnimationFrame(animate);
    };
    antRafRef.current = requestAnimationFrame(animate);
    return () => {
      if (antRafRef.current) cancelAnimationFrame(antRafRef.current);
    };
  }, [renderOverlay]);

  const screenToMask = useCallback((clientX: number, clientY: number): MaskPoint | null => {
    const display = displayCanvasRef.current;
    if (!display) return null;

    // Image center in screen space
    const screenCx = (fullX + fullW / 2) * zoom + pan.x;
    const screenCy = (fullY + fullH / 2) * zoom + pan.y;

    // Un-rotate the click point around the image center
    const rad = -(image.rotation * Math.PI) / 180;
    const dx = clientX - screenCx;
    const dy = clientY - screenCy;
    const urx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ury = dx * Math.sin(rad) + dy * Math.cos(rad);

    // Now map from screen-space (relative to image top-left) to mask coords
    const imgScreenW = fullW * zoom;
    const imgScreenH = fullH * zoom;
    let x = ((urx + imgScreenW / 2) / imgScreenW) * nw;
    let y = ((ury + imgScreenH / 2) / imgScreenH) * nh;

    if (image.flipH) x = nw - x;
    if (image.flipV) y = nh - y;
    return { x, y, pressure: 1 };
  }, [nw, nh, image.flipH, image.flipV, image.rotation, fullX, fullY, fullW, fullH, zoom, pan]);

  const closePolygon = useCallback((pts: MaskPoint[], mode: 'set' | 'add' | 'subtract') => {
    if (pts.length < 3) return;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const sel: MaskSelection = {
      x: Math.min(...xs), y: Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys),
      polygon: pts,
    };
    applySelectionShape(sel, mode);
    setPolygonPoints([]);
    renderPreview();
  }, [applySelectionShape, renderPreview, setPolygonPoints]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Middle mouse or space+left click: let it pass through to workspace for panning
    if (e.button === 1) {
      setMiddleHeld(true);
      const onUp = () => { setMiddleHeld(false); document.removeEventListener('pointerup', onUp); };
      document.addEventListener('pointerup', onUp);
      return;
    }
    if (e.button === 0 && spaceHeldRef.current) return;

    e.stopPropagation();
    e.preventDefault();

    const point = screenToMask(e.clientX, e.clientY);
    if (!point) return;

    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d')!;

    if (e.pressure > 0) point.pressure = e.pressure;

    // Determine selection mode from modifiers
    const mode: 'set' | 'add' | 'subtract' = e.shiftKey ? 'add' : e.altKey ? 'subtract' : 'set';
    selModeRef.current = mode;

    if (brush.type === 'select-rect') {
      setPolygonPoints([]);
      // Snap start point to guides
      if (snapEnabled && guides.length > 0) {
        const snapThresh = 8 / (ds * zoom);
        for (const g of guides) {
          if (g.axis === 'x' && Math.abs(point.x - g.position) < snapThresh) point.x = g.position;
          if (g.axis === 'y' && Math.abs(point.y - g.position) < snapThresh) point.y = g.position;
        }
      }
      selStartRef.current = point;
      selDraggedRef.current = false;
      drawingRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (brush.type === 'select-polygon') {
      const now = Date.now();
      const isDoubleClick = now - lastClickTimeRef.current < 200;
      lastClickTimeRef.current = now;

      // Snap point to guides
      if (snapEnabled && guides.length > 0) {
        const snapThresh = 8 / (ds * zoom);
        for (const g of guides) {
          if (g.axis === 'x' && Math.abs(point.x - g.position) < snapThresh) point.x = g.position;
          if (g.axis === 'y' && Math.abs(point.y - g.position) < snapThresh) point.y = g.position;
        }
      }

      if (polygonPoints.length >= 3) {
        const first = polygonPoints[0]!;
        const closeDist = 15 / (ds * zoom);
        const dx = point.x - first.x;
        const dy = point.y - first.y;
        if (Math.sqrt(dx * dx + dy * dy) < closeDist || isDoubleClick) {
          closePolygon(polygonPoints, mode);
          return;
        }
      } else if (isDoubleClick && polygonPoints.length >= 3) {
        closePolygon(polygonPoints, mode);
        return;
      }

      // Add point and start dragging it
      const newPts = [...polygonPoints, point];
      setPolygonPoints(newPts);
      polyDraggingRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      renderPreview();
      return;
    }

    if (brush.type === 'select-wand') {
      setPolygonPoints([]);
      // Build a flat composite of the image for color sampling
      const flat = document.createElement('canvas');
      flat.width = nw; flat.height = nh;
      const flatCtx = flat.getContext('2d')!;
      flatCtx.fillStyle = '#fff';
      flatCtx.fillRect(0, 0, nw, nh);
      const img = imgRef.current;
      if (img) flatCtx.drawImage(img, 0, 0, nw, nh);

      const wandMask = buildWandMask(flat, point.x, point.y, wandSettings);

      // Composite wand mask into selection mask
      const selCtx = getSelMaskCtx();
      if (mode === 'set') selCtx.clearRect(0, 0, nw, nh);
      if (mode === 'subtract') {
        selCtx.globalCompositeOperation = 'destination-out';
      } else {
        selCtx.globalCompositeOperation = 'source-over';
      }
      selCtx.drawImage(wandMask, 0, 0);
      selCtx.globalCompositeOperation = 'source-over';
      updateHasSelection();
      renderPreview();
      return;
    }

    // Brush tools
    historyRef.current.snapshot(ctx);

    // If there's a selection, save pre-stroke data for clipping
    if (hasSelection) {
      preStrokeDataRef.current = ctx.getImageData(0, 0, nw, nh);
    }

    // Shift+click with brush: draw a line from last stroke endpoint to current point
    if (e.shiftKey && lastStrokeEndRef.current && (brush.type === 'hide' || brush.type === 'reveal')) {
      const from = lastStrokeEndRef.current;
      drawingRef.current = true;
      prevPointRef.current = from;
      drawMaskStrokeSegment(ctx, from, point, brush);
      // Clip the line to selection
      if (hasSelection && preStrokeDataRef.current && selMaskCanvasRef.current) {
        const r = brush.size;
        const minX = Math.min(from.x, point.x) - r;
        const minY = Math.min(from.y, point.y) - r;
        const maxX = Math.max(from.x, point.x) + r;
        const maxY = Math.max(from.y, point.y) + r;
        clipBrushToSelMask(ctx, preStrokeDataRef.current, selMaskCanvasRef.current.getContext('2d')!,
          minX, minY, maxX - minX, maxY - minY);
      }
      prevPointRef.current = point;
      lastStrokeEndRef.current = point;
      renderPreview();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (brush.type === 'fill') {
      const imgData = ctx.getImageData(Math.round(point.x), Math.round(point.y), 1, 1);
      const alpha = imgData.data[3] ?? 0;
      const mode = alpha > 127 ? 'hide' : 'reveal';
      // For fill with selection, pass bounding box constraint
      const selMask = selMaskCanvasRef.current;
      let bounds: { x: number; y: number; w: number; h: number } | undefined;
      if (hasSelection && selMask) {
        // Use bounding box of selection mask
        const sd = selMask.getContext('2d')!.getImageData(0, 0, nw, nh).data;
        let bx0 = nw, by0 = nh, bx1 = 0, by1 = 0;
        for (let y = 0; y < nh; y++) {
          for (let x = 0; x < nw; x++) {
            if (sd[(y * nw + x) * 4 + 3]! > 0) {
              if (x < bx0) bx0 = x;
              if (x > bx1) bx1 = x;
              if (y < by0) by0 = y;
              if (y > by1) by1 = y;
            }
          }
        }
        if (bx1 >= bx0) bounds = { x: bx0, y: by0, w: bx1 - bx0 + 1, h: by1 - by0 + 1 };
      }
      floodFillMask(ctx, point.x, point.y, mode, 32, bounds);
      // Clip flood fill result to selection mask
      if (hasSelection && preStrokeDataRef.current && selMaskCanvasRef.current) {
        clipBrushToSelMask(ctx, preStrokeDataRef.current, selMaskCanvasRef.current.getContext('2d')!,
          bounds?.x ?? 0, bounds?.y ?? 0, bounds?.w ?? nw, bounds?.h ?? nh);
      }
      preStrokeDataRef.current = null;
      renderPreview();
      forceUpdate((n) => n + 1);
    } else {
      drawingRef.current = true;
      prevPointRef.current = point;
      lastStrokeEndRef.current = point;
      drawMaskDot(ctx, point, brush);
      // Clip to selection
      if (hasSelection && preStrokeDataRef.current && selMaskCanvasRef.current) {
        const r = brush.size;
        clipBrushToSelMask(ctx, preStrokeDataRef.current, selMaskCanvasRef.current.getContext('2d')!,
          point.x - r, point.y - r, r * 2, r * 2);
      }
      renderPreview();
    }

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [brush, screenToMask, renderPreview, polygonPoints, closePolygon, ds, zoom, hasSelection, nw, nh, setPolygonPoints]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const point = screenToMask(e.clientX, e.clientY);
    if (point) {
      setCursorPos({ x: e.clientX, y: e.clientY });
    }

    // Drag polygon point
    if (brush.type === 'select-polygon' && polyDraggingRef.current && point) {
      // Snap to guides
      if (snapEnabled && guides.length > 0) {
        const snapThresh = 8 / (ds * zoom);
        for (const g of guides) {
          if (g.axis === 'x' && Math.abs(point.x - g.position) < snapThresh) point.x = g.position;
          if (g.axis === 'y' && Math.abs(point.y - g.position) < snapThresh) point.y = g.position;
        }
      }
      const pts = [...polygonPointsRef.current];
      if (pts.length > 0) {
        pts[pts.length - 1] = point;
        setPolygonPoints(pts);
        renderPreview();
      }
      return;
    }

    if (brush.type === 'select-rect' && drawingRef.current && selStartRef.current && point) {
      const sx = selStartRef.current.x;
      const sy = selStartRef.current.y;
      let px = point.x;
      let py = point.y;
      // Snap to ruler guides
      if (snapEnabled && guides.length > 0) {
        const snapThresh = 8 / (ds * zoom);
        for (const g of guides) {
          if (g.axis === 'x' && Math.abs(px - g.position) < snapThresh) px = g.position;
          if (g.axis === 'y' && Math.abs(py - g.position) < snapThresh) py = g.position;
        }
      }
      const w = Math.abs(px - sx);
      const h = Math.abs(py - sy);
      if (w > 3 || h > 3) selDraggedRef.current = true;
      setDragRectBoth({ x: Math.min(sx, px), y: Math.min(sy, py), w, h });
      renderPreview();
      return;
    }

    if (!drawingRef.current || !point) return;
    if (brush.type === 'select-rect' || brush.type === 'select-polygon' || brush.type === 'select-wand') return;

    if (e.pressure > 0) point.pressure = e.pressure;

    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d')!;

    if (prevPointRef.current) {
      drawMaskStrokeSegment(ctx, prevPointRef.current, point, brush);
      // Clip to selection
      if (hasSelection && preStrokeDataRef.current && selMaskCanvasRef.current) {
        const p = prevPointRef.current;
        const r = brush.size;
        const bx = Math.min(p.x, point.x) - r;
        const by = Math.min(p.y, point.y) - r;
        const bw = Math.abs(point.x - p.x) + r * 2;
        const bh = Math.abs(point.y - p.y) + r * 2;
        clipBrushToSelMask(ctx, preStrokeDataRef.current, selMaskCanvasRef.current.getContext('2d')!,
          bx, by, bw, bh);
      }
    }
    prevPointRef.current = point;
    lastStrokeEndRef.current = point;
    renderPreview();
  }, [brush, screenToMask, renderPreview, hasSelection, setDragRectBoth]);

  const handlePointerUp = useCallback(() => {
    // Confirm polygon point position on release
    if (polyDraggingRef.current) {
      polyDraggingRef.current = false;
      return;
    }
    if (brush.type === 'select-rect') {
      if (!selDraggedRef.current) {
        // Click without drag = clear selection
        clearSelection();
        renderPreview();
      } else if (dragRectRef.current) {
        // Finalize the rect selection
        const r = dragRectRef.current;
        const sel: MaskSelection = { x: r.x, y: r.y, w: r.w, h: r.h };
        applySelectionShape(sel, selModeRef.current);
        setDragRectBoth(null);
        renderPreview();
      }
      selStartRef.current = null;
      drawingRef.current = false;
      return;
    }
    drawingRef.current = false;
    prevPointRef.current = null;
    preStrokeDataRef.current = null;
    forceUpdate((n) => n + 1);
  }, [brush.type, renderPreview, clearSelection, applySelectionShape, setDragRectBoth]);

  // Fill selection with hide or reveal
  const fillSelection = useCallback((mode: 'hide' | 'reveal') => {
    if (!hasSelection) return;
    const maskCanvas = maskCanvasRef.current;
    const selMask = selMaskCanvasRef.current;
    if (!maskCanvas || !selMask) return;
    const ctx = maskCanvas.getContext('2d')!;
    historyRef.current.snapshot(ctx);

    if (mode === 'hide') {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(selMask, 0, 0);
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(selMask, 0, 0);
      ctx.restore();
    }

    clearSelection();
    renderPreview();
    forceUpdate((n) => n + 1);
  }, [hasSelection, renderPreview, clearSelection]);

  const handleUndo = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    historyRef.current.undo(maskCanvas.getContext('2d')!);
    renderPreview();
    forceUpdate((n) => n + 1);
  }, [renderPreview]);

  const handleRedo = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    historyRef.current.redo(maskCanvas.getContext('2d')!);
    renderPreview();
    forceUpdate((n) => n + 1);
  }, [renderPreview]);

  const handleInvert = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d')!;
    historyRef.current.snapshot(ctx);
    const imgData = ctx.getImageData(0, 0, nw, nh);
    const data = imgData.data;
    for (let i = 3; i < data.length; i += 4) {
      data[i] = 255 - data[i]!;
    }
    ctx.putImageData(imgData, 0, 0);
    renderPreview();
    forceUpdate((n) => n + 1);
  }, [nw, nh, renderPreview]);

  const handleApply = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d')!;
    const imgData = ctx.getImageData(0, 0, nw, nh);
    const data = imgData.data;
    let allWhite = true;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i]! < 255) { allWhite = false; break; }
    }
    onApply(allWhite ? null : maskCanvas.toDataURL('image/png'));
  }, [nw, nh, onApply]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') { spaceHeldRef.current = true; setSpaceHeld(true); }

      if (e.key === 'Enter') {
        e.preventDefault();
        handleApply();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (hasSelection || polygonPoints.length > 0) {
          clearSelection();
          renderPreview();
        } else {
          onCancel();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        const sel: MaskSelection = { x: 0, y: 0, w: nw, h: nh };
        applySelectionShape(sel, 'set');
        setPolygonPoints([]);
        setBrush((b) => {
          if (b.type !== 'select-rect' && b.type !== 'select-polygon' && b.type !== 'select-wand') return { ...b, type: 'select-rect' };
          return b;
        });
        renderPreview();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || e.key === 'y')) {
        e.preventDefault();
        handleRedo();
      }
      if ((e.key === 'b' || e.key === 'B') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setBrush((b) => ({ ...b, type: 'reveal' }));
      }
      if ((e.key === 'e' || e.key === 'E') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setBrush((b) => ({ ...b, type: 'hide' }));
      }
      if ((e.key === 'x' || e.key === 'X') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setBrush((b) => ({ ...b, type: b.type === 'hide' ? 'reveal' : 'hide' }));
      }
      if ((e.key === 'g' || e.key === 'G') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setBrush((b) => ({ ...b, type: 'fill' }));
      }
      if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setBrush((b) => ({ ...b, type: 'select-rect' }));
      }
      if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setBrush((b) => ({ ...b, type: 'select-polygon' }));
      }
      if ((e.key === 'w' || e.key === 'W') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setBrush((b) => ({ ...b, type: 'select-wand' }));
      }
      if (e.key === '[') {
        e.preventDefault();
        setBrush((b) => ({ ...b, size: Math.max(1, b.size - (b.size > 100 ? 50 : b.size > 10 ? 5 : 1)) }));
      }
      if (e.key === ']') {
        e.preventDefault();
        setBrush((b) => ({ ...b, size: Math.min(2048, b.size + (b.size >= 100 ? 50 : b.size >= 10 ? 5 : 1)) }));
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && hasSelection) {
        e.preventDefault();
        fillSelection('hide');
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') { spaceHeldRef.current = false; setSpaceHeld(false); }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, [handleApply, handleUndo, handleRedo, onCancel, hasSelection, polygonPoints, renderPreview, fillSelection, clearSelection, applySelectionShape, nw, nh, setPolygonPoints]);

  const isBrushTool = brush.type === 'hide' || brush.type === 'reveal';
  const isSelectTool = brush.type === 'select-rect' || brush.type === 'select-polygon' || brush.type === 'select-wand';
  const cursorRadius = (brush.size / 2) * 0.75 * ds * zoom;

  let canvasCursor = 'none';
  if (brush.type === 'fill') canvasCursor = 'crosshair';
  if (isSelectTool) canvasCursor = 'crosshair';
  if (spaceHeld) canvasCursor = 'grab';

  return (
    <>
      <canvas ref={maskCanvasRef} style={{ display: 'none' }} />

      {/* Full-viewport event capture layer — catches clicks outside the image.
          Rendered inside workspace-canvas so events bubble to viewport for middle-mouse panning. */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 98,
          cursor: canvasCursor,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      <div
        className="mask-overlay"
        style={{
          position: 'absolute',
          top: 0, left: 0, width: 0, height: 0,
          transformOrigin: '0 0',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          zIndex: 99,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: fullX, top: fullY, width: fullW, height: fullH,
            transform: image.rotation ? `rotate(${image.rotation}deg)` : undefined,
            transformOrigin: `${fullW / 2}px ${fullH / 2}px`,
          }}
        >
          <canvas
            ref={displayCanvasRef}
            style={{
              width: fullW, height: fullH,
              display: 'block',
              pointerEvents: 'none',
              imageRendering: scaleFilter === 'nearest' ? 'pixelated' : 'auto',
              transform: (image.flipH || image.flipV) ? `scale(${image.flipH ? -1 : 1}, ${image.flipV ? -1 : 1})` : undefined,
              transformOrigin: prev
                ? `${(prev.x + prev.w / 2) * ds}px ${(prev.y + prev.h / 2) * ds}px`
                : `${fullW / 2}px ${fullH / 2}px`,
            }}
          />
        </div>
        {/* Ruler guide lines mirrored inside the mask overlay stacking context */}
        {guides.map((g) => {
          const lw = 1 / zoom;
          if (g.axis === 'x') {
            return (
              <div key={`mg-${g.id}`} className="ruler-guide-line ruler-guide-line-x" style={{ position: 'absolute', left: g.position - lw / 2, top: -100000, width: lw, height: 200000, pointerEvents: 'none' }} />
            );
          }
          return (
            <div key={`mg-${g.id}`} className="ruler-guide-line ruler-guide-line-y" style={{ position: 'absolute', top: g.position - lw / 2, left: -100000, height: lw, width: 200000, pointerEvents: 'none' }} />
          );
        })}
      </div>

      {/* Screen-space overlay canvas for selection outlines — viewport sized, always crisp */}
      <canvas
        ref={overlayCanvasRef}
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          zIndex: 100,
        }}
      />

      {cursorPos && isBrushTool && !spaceHeld && !middleHeld && (
        <div
          className={`mask-brush-cursor${brush.shape === 'square' ? ' mask-brush-cursor-square' : ''}`}
          style={{
            left: cursorPos.x - cursorRadius,
            top: cursorPos.y - cursorRadius,
            width: cursorRadius * 2,
            height: cursorRadius * 2,
          }}
        />
      )}

      <MaskToolbar
        brush={brush}
        onBrushChange={setBrush}
        canUndo={historyRef.current.canUndo}
        canRedo={historyRef.current.canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onInvert={handleInvert}
        onApply={handleApply}
        onCancel={onCancel}
        hasSelection={hasSelection}
        onFillSelection={fillSelection}
        wandSettings={wandSettings}
        onWandSettingsChange={setWandSettings}
      />
    </>
  );
}
