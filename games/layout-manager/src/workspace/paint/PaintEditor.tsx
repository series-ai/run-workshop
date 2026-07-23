/**
 * PaintEditor — wraps the existing MaskOverlay canvas infrastructure with
 * the new Photoshop/Krita-style UI layout:
 *   - Vertical tool sidebar (left)
 *   - Tool options bar (bottom)
 *   - Layer panel (right, collapsible)
 *
 * Phase 2: Uses MaskOverlay's canvas/pointer/selection system internally.
 * The new UI components drive the same brush/tool state.
 * Layer system and additional paint tools will be wired in Phase 3.
 */

import { useRef, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ImageNode, ScaleFilter, RulerGuide } from '../types';
import type { MaskPoint, MaskSelection } from '../maskBrushes';
import { buildWandMask } from '../maskBrushes';
import { drawStrokeSegment, drawDot, floodFill, floodFillMask, smudgeStart, smudgeMove, cloneStart, cloneMove, cloneDot, healStart, healBrush } from './brushEngine';
import type { SmudgeState, CloneState, HealState } from './brushEngine';
import { PaintToolbar } from './PaintToolbar';
import { ToolOptionsBar } from './ToolOptionsBar';
import { LayerPanel } from './LayerPanel';
import { ColorPicker, addRecentColor as addRecentColorToStorage } from './ColorPicker';
import type { BrushSettings, BrushType, ToolType, Layer, WandSettings as PaintWandSettings, Point, TextSettings, TextLayerData } from './types';
import { renderStrokeEffect, findEdges, dilateFromEdges, erodeFromEdges } from './strokeEffect';
import { DEFAULT_BRUSH, layerAdjustFilter } from './types';
import type { LayerAdjustments } from './types';
import { GOOGLE_FONTS, ensureGoogleFont } from '../googleFonts';

const DEFAULT_TEXT_SETTINGS: TextSettings = {
  font: 'sans-serif',
  size: 24,
  bold: false,
  italic: false,
  underline: false,
  align: 'left',
};

// Generic families (always available) + common fonts to probe for
const GENERIC_FONTS = ['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'];
const PROBE_FONTS = [
  'Arial', 'Helvetica', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Gill Sans',
  'Times New Roman', 'Georgia', 'Garamond', 'Palatino',
  'Courier New', 'Lucida Console',
  'Impact', 'Comic Sans MS',
  // Linux common
  'DejaVu Sans', 'DejaVu Serif', 'DejaVu Sans Mono',
  'Liberation Sans', 'Liberation Serif', 'Liberation Mono',
  'Noto Sans', 'Noto Serif', 'Noto Mono',
  'Ubuntu', 'Cantarell', 'Droid Sans',
];

function detectAvailableFonts(): string[] {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const testStr = 'mmmmmmmmmmlli1|WMQ@#';
  const size = '72px';
  // Measure with a baseline fallback
  ctx.font = `${size} monospace`;
  const baseW = ctx.measureText(testStr).width;
  ctx.font = `${size} serif`;
  const baseW2 = ctx.measureText(testStr).width;

  const available: string[] = [];
  for (const font of PROBE_FONTS) {
    ctx.font = `${size} "${font}", monospace`;
    const w1 = ctx.measureText(testStr).width;
    ctx.font = `${size} "${font}", serif`;
    const w2 = ctx.measureText(testStr).width;
    // If it differs from either fallback, the font is installed
    if (w1 !== baseW || w2 !== baseW2) {
      available.push(font);
    }
  }
  return [...GENERIC_FONTS, ...available];
}

let _cachedFonts: string[] | null = null;
function getAvailableFonts(): string[] {
  if (!_cachedFonts) _cachedFonts = detectAvailableFonts();
  return _cachedFonts;
}

const TEXT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 48, 64, 72, 96, 128];
import { createLayer, createTextLayer, renderTextToCanvas } from './layerManager';

interface PaintEditorProps {
  image: ImageNode;
  zoom: number;
  pan: { x: number; y: number };
  scaleFilter: ScaleFilter;
  guides: RulerGuide[];
  snapEnabled: boolean;
  onApply: (maskDataUrl: string | null, paintLayers: { name: string; dataUrl: string; visible: boolean; opacity: number; blendMode?: string; textData?: TextLayerData; adjustments?: LayerAdjustments }[] | null, paintOverlayUrl: string | null, backgroundDataUrl: string | null, paintUnderlayUrl?: string | null, paintCompositeUrl?: string | null) => void;
  onCancel: () => void;
  onFrame?: () => void;
  /** Called whenever undo/redo availability changes */
  onHistoryChange?: (state: { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean }) => void;
  /** Called when crop is changed from within the paint editor */
  onCropChange?: (cropRect: { x: number; y: number; w: number; h: number } | null) => void;
  /** When set, import this file as a new paint layer then call onImportLayerDone */
  importLayerFile?: { file: File; mode: 'fit' | 'stretch' | 'original' } | null;
  onImportLayerDone?: () => void;
  onHideSource?: (hide: boolean) => void;
}

// --- Utility functions from MaskOverlay ---

function paintShape(ctx: CanvasRenderingContext2D, sel: MaskSelection, mode: 'set' | 'add' | 'subtract', nw: number, nh: number) {
  if (mode === 'set') ctx.clearRect(0, 0, nw, nh);
  ctx.save();
  ctx.globalCompositeOperation = mode === 'subtract' ? 'destination-out' : 'source-over';
  ctx.fillStyle = '#ffffff';
  if (sel.polygon && sel.polygon.length >= 3) {
    ctx.beginPath();
    ctx.moveTo(sel.polygon[0]!.x, sel.polygon[0]!.y);
    for (let i = 1; i < sel.polygon.length; i++) ctx.lineTo(sel.polygon[i]!.x, sel.polygon[i]!.y);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(sel.x, sel.y, sel.w, sel.h);
  }
  ctx.restore();
}

function selMaskHasPixels(canvas: HTMLCanvasElement): boolean {
  const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 3; i < data.length; i += 4) { if (data[i]! > 0) return true; }
  return false;
}


/**
 * Restore pixels outside the selection mask.
 * Compares current canvas with pre-stroke snapshot and reverts any pixel
 * where the selection mask alpha is 0.
 */
function clipToSelection(
  ctx: CanvasRenderingContext2D,
  preStroke: ImageData,
  selMask: HTMLCanvasElement,
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const current = ctx.getImageData(0, 0, w, h);
  const sel = selMask.getContext('2d')!.getImageData(0, 0, w, h);
  const cd = current.data;
  const sd = sel.data;
  const pd = preStroke.data;

  for (let i = 0; i < cd.length; i += 4) {
    if (sd[i + 3]! === 0) {
      cd[i] = pd[i]!;
      cd[i + 1] = pd[i + 1]!;
      cd[i + 2] = pd[i + 2]!;
      cd[i + 3] = pd[i + 3]!;
    }
  }
  ctx.putImageData(current, 0, 0);
}

/** Compute transform handle positions in image space */
function getTransformHandles(
  bounds: { x: number; y: number; w: number; h: number },
  transform: { scaleX: number; scaleY: number; rotation: number },
  screenScale: number = 1,
) {
  const tw = bounds.w * transform.scaleX;
  const th = bounds.h * transform.scaleY;
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  const rot = transform.rotation * Math.PI / 180;
  const cosT = Math.cos(rot);
  const sinT = Math.sin(rot);

  const toImg = (lx: number, ly: number): [number, number] => [
    cx + lx * cosT - ly * sinT,
    cy + lx * sinT + ly * cosT,
  ];

  const corners = {
    tl: toImg(-tw / 2, -th / 2),
    tr: toImg(tw / 2, -th / 2),
    br: toImg(tw / 2, th / 2),
    bl: toImg(-tw / 2, th / 2),
  };

  const edges = {
    t: [(corners.tl[0] + corners.tr[0]) / 2, (corners.tl[1] + corners.tr[1]) / 2] as [number, number],
    r: [(corners.tr[0] + corners.br[0]) / 2, (corners.tr[1] + corners.br[1]) / 2] as [number, number],
    b: [(corners.br[0] + corners.bl[0]) / 2, (corners.br[1] + corners.bl[1]) / 2] as [number, number],
    l: [(corners.bl[0] + corners.tl[0]) / 2, (corners.bl[1] + corners.tl[1]) / 2] as [number, number],
  };

  // Rotation handle: above top edge center
  const topDx = corners.tr[0] - corners.tl[0];
  const topDy = corners.tr[1] - corners.tl[1];
  const topLen = Math.sqrt(topDx * topDx + topDy * topDy) || 1;
  const upX = topDy / topLen;
  const upY = -topDx / topLen;
  const rotDist = 30 / screenScale; // 30 screen pixels converted to image space
  const rotHandle: [number, number] = [edges.t[0] + upX * rotDist, edges.t[1] + upY * rotDist];

  return { corners, edges, rotHandle, center: [cx, cy] as [number, number] };
}

/** Get rotation-aware resize cursor for a transform handle */
function getHandleCursor(handle: string, rotation: number): string {
  // Base angles for each handle (degrees, 0 = right, clockwise)
  const baseAngles: Record<string, number> = {
    r: 0, br: 45, b: 90, bl: 135, l: 180, tl: 225, t: 270, tr: 315,
  };
  const base = baseAngles[handle];
  if (base === undefined) return 'move';
  // Normalize to 0-360
  const angle = ((base + rotation) % 360 + 360) % 360;
  // Map angle to cursor (8 sectors of 45 degrees each)
  const cursors = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];
  const sector = Math.round(angle / 45) % 8;
  return cursors[sector]!;
}

/** Build a composite of all visible layers for clone/heal source sampling */
function buildComposite(
  layers: Layer[], nw: number, nh: number,
  _imgRef: React.MutableRefObject<HTMLImageElement | null>,
  _maskCanvasRef: React.RefObject<HTMLCanvasElement | null>,
): HTMLCanvasElement {
  const flat = document.createElement('canvas');
  flat.width = nw;
  flat.height = nh;
  const ctx = flat.getContext('2d')!;
  for (const layer of layers) {
    if (!layer.visible) continue;
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    if (layer.name === 'Background') {
      ctx.drawImage(layer.canvas, 0, 0);
    } else if (layer.name === 'Mask') {
      // Skip mask clipping for clone/heal source — we want raw pixel data
      continue;
    } else {
      ctx.drawImage(layer.canvas, 0, 0);
    }
    ctx.restore();
  }
  return flat;
}

/** Get the effective tool type for pointer handling */
function getEffectiveTool(brush: BrushSettings, activeTool: ToolType): string {
  if (activeTool !== 'brush') return activeTool;
  return brush.type; // pencil, eraser, fill, smudge, clone, heal
}

export function PaintEditor({ image, zoom, pan, scaleFilter, guides, snapEnabled, onApply, onCancel, onHistoryChange, onFrame, onCropChange, importLayerFile, onImportLayerDone, onHideSource }: PaintEditorProps) {
  // --- Canvas refs (same three-canvas architecture as MaskOverlay) ---
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const selMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const prevPointRef = useRef<MaskPoint | null>(null);
  const drawingRef = useRef(false);
  const initRef = useRef(false);
  const preStrokeDataRef = useRef<ImageData | null>(null);
  const lastStrokeEndRef = useRef<MaskPoint | null>(null);
  const smudgeStateRef = useRef<SmudgeState | null>(null);
  const cloneStateRef = useRef<CloneState | null>(null);
  const healStateRef = useRef<HealState | null>(null);
  const cloneSourceRef = useRef<{ x: number; y: number } | null>(null);
  const cloneOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const cloneSourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cloneSourceMode, setCloneSourceMode] = useState<'canvas' | 'layer'>('canvas');
  const cloneSourceLayerIdRef = useRef<string | null>(null);
  const strokeBufferRef = useRef<HTMLCanvasElement | null>(null);
  const strokeBufferCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const strokeOpacityRef = useRef(1);
  const antOffsetRef = useRef(0);
  const spaceHeldRef = useRef(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [altHeld, setAltHeld] = useState(false);
  const [middleHeld, setMiddleHeld] = useState(false);
  const antRafRef = useRef<number | null>(null);
  const cachedEdgeSegs = useRef<{ hSegs: Array<[number, number, number, number]>; vSegs: Array<[number, number, number, number]> } | null>(null);
  const edgeCacheDirty = useRef(true);
  const [, forceUpdate] = useState(0);

  // --- New UI state ---
  const [activeTool, setActiveToolRaw] = useState<ToolType>('brush');
  const [brush, setBrushRaw] = useState<BrushSettings>(() => {
    try {
      const saved = localStorage.getItem('paintBrushSettings');
      if (saved) {
        const p = JSON.parse(saved);
        return { ...DEFAULT_BRUSH, ...p };
      }
    } catch {}
    return { ...DEFAULT_BRUSH, type: 'pencil' as BrushType, color: '#ffffff' };
  });
  const setBrush = useCallback((update: BrushSettings | ((b: BrushSettings) => BrushSettings)) => {
    setBrushRaw((prev) => {
      const next = typeof update === 'function' ? update(prev) : update;
      localStorage.setItem('paintBrushSettings', JSON.stringify(next));
      return next;
    });
  }, []);

  const [wandSettings, setWandSettings] = useState<PaintWandSettings>({ tolerance: 32, contiguous: true, spread: 0 });
  const [fgColor, setFgColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [eyedropperPreview, setEyedropperPreview] = useState<string | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [strokeColorPickerOpen, setStrokeColorPickerOpen] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('paint_recent_colors');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const addRecentColor = useCallback((hex: string) => {
    addRecentColorToStorage(hex);
    setRecentColors(prev => {
      const filtered = prev.filter(c => c !== hex);
      return [hex, ...filtered].slice(0, 12);
    });
  }, []);
  const [pixelSnap, setPixelSnap] = useState(false);
  const [paintContextMenu, setPaintContextMenu] = useState<{ x: number; y: number } | null>(null);
  const strokeEyedropperRef = useRef(false);
  const prevToolRef = useRef<ToolType>('brush');
  const brushCursorRef = useRef<HTMLDivElement>(null);

  // Crop tool state
  const initialCropRef = useRef<{ x: number; y: number; w: number; h: number } | null>(
    image.cropRect ? { ...image.cropRect } : null,
  );
  const [cropRect, setCropRectRaw] = useState<{ x: number; y: number; w: number; h: number } | null>(
    image.cropRect ? { ...image.cropRect } : null,
  );
  const cropRectRef = useRef(cropRect);
  const setCropRect = useCallback((v: { x: number; y: number; w: number; h: number } | null | ((prev: { x: number; y: number; w: number; h: number } | null) => { x: number; y: number; w: number; h: number } | null)) => {
    setCropRectRaw((prev) => {
      const next = typeof v === 'function' ? v(prev) : v;
      cropRectRef.current = next;
      return next;
    });
  }, []);
  const cropDragRef = useRef<{ type: 'move' | 'resize' | 'create'; handle?: string; startX: number; startY: number; origRect: { x: number; y: number; w: number; h: number } } | null>(null);

  // Text tool state
  const [textSettings, setTextSettings] = useState<TextSettings>(() => {
    try {
      const saved = localStorage.getItem('paintTextSettings');
      if (saved) return { ...DEFAULT_TEXT_SETTINGS, ...JSON.parse(saved) };
    } catch {}
    return { ...DEFAULT_TEXT_SETTINGS };
  });
  const updateTextSettings = useCallback((update: Partial<TextSettings>) => {
    if (update.font) {
      // Google Fonts load async — re-render the preview once ready
      ensureGoogleFont(update.font);
      document.fonts.ready.then(() => requestAnimationFrame(() => renderPreviewRef.current?.()));
    }
    setTextSettings((prev) => {
      const next = { ...prev, ...update };
      localStorage.setItem('paintTextSettings', JSON.stringify(next));
      return next;
    });
  }, []);
  const [textBox, setTextBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const textBoxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const textAreaRef = useRef<HTMLDivElement>(null);
  const textDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const textSettingsRef = useRef(textSettings);
  textSettingsRef.current = textSettings;
  const [editingTextLayerId, setEditingTextLayerIdRaw] = useState<string | null>(null);
  const editingTextLayerIdRef = useRef<string | null>(null);
  const setEditingTextLayerId = useCallback((id: string | null) => {
    editingTextLayerIdRef.current = id;
    setEditingTextLayerIdRaw(id);
  }, []);

  // Text layer undo stack (for move/transform operations)
  const textUndoStack = useRef<{ layerId: string; textData: TextLayerData }[]>([]);
  const textRedoStack = useRef<{ layerId: string; textData: TextLayerData }[]>([]);

  // Move tool — floating selection
  const floatingDataRef = useRef<ImageData | null>(null);
  const moveStartRef = useRef<{ x: number; y: number } | null>(null);
  const selBoundsRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const origSelMaskRef = useRef<HTMLCanvasElement | null>(null);
  const moveOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Transform tool state
  const transformRef = useRef<{ scaleX: number; scaleY: number; rotation: number }>({ scaleX: 1, scaleY: 1, rotation: 0 });
  const transformDragRef = useRef<{ type: 'move' | 'resize' | 'rotate'; handle?: string; startX: number; startY: number; origBounds: { x: number; y: number; w: number; h: number }; origScale: { x: number; y: number }; origRotation: number } | null>(null);
  const [transformHoverCursor, setTransformHoverCursor] = useState<string | null>(null);

  // Unified undo stack — each entry captures both canvas pixels and selection state atomically
  type UndoEntry = {
    canvasData: ImageData | null; // null = this action didn't modify the canvas
    maskData: ImageData | null;
    floating: ImageData | null;
    bounds: { x: number; y: number; w: number; h: number } | null;
    origMask: ImageData | null;
    offset: { x: number; y: number };
    transform: { scaleX: number; scaleY: number; rotation: number };
  };
  const undoStack = useRef<UndoEntry[]>([]);
  const redoStack = useRef<UndoEntry[]>([]);
  /** Cap paint-editor history. Each entry holds full ImageData of canvas + selection
   *  mask (~32 MB on a 2K canvas), so an unbounded stack will exhaust heap quickly
   *  during long brushwork sessions. */
  const MAX_PAINT_HISTORY = 20;

  const captureUndoEntry = (includeCanvas: boolean): UndoEntry => {
    const selCanvas = selMaskCanvasRef.current;
    const maskData = selCanvas ? selCanvas.getContext('2d')!.getImageData(0, 0, nw, nh) : null;
    const origMask = origSelMaskRef.current ? origSelMaskRef.current.getContext('2d')!.getImageData(0, 0, nw, nh) : null;
    let canvasData: ImageData | null = null;
    if (includeCanvas) {
      const canvas = getActiveCanvas();
      if (canvas) canvasData = canvas.getContext('2d')!.getImageData(0, 0, nw, nh);
    }
    return {
      canvasData,
      maskData,
      floating: floatingDataRef.current ? new ImageData(new Uint8ClampedArray(floatingDataRef.current.data), floatingDataRef.current.width, floatingDataRef.current.height) : null,
      bounds: selBoundsRef.current ? { ...selBoundsRef.current } : null,
      origMask,
      offset: { ...moveOffsetRef.current },
      transform: { ...transformRef.current },
    };
  };

  /** Snapshot current state for undo. Pass false if only selection/transform changed (no canvas pixels). */
  const snapshotState = (includeCanvas: boolean = true) => {
    undoStack.current.push(captureUndoEntry(includeCanvas));
    if (undoStack.current.length > MAX_PAINT_HISTORY) undoStack.current.shift();
    redoStack.current.length = 0;
  };

  /** Fully drop paint-editor history. Called on Apply or Cancel so the heavy
   *  ImageData payloads are released before the parent does its own (memory-hungry)
   *  compositing / dataURL work. The editor unmounts immediately after, so no
   *  leftover state can carry into the next element's paint session. */
  const clearPaintHistory = () => {
    undoStack.current.length = 0;
    redoStack.current.length = 0;
    textUndoStack.current.length = 0;
    textRedoStack.current.length = 0;
  };

  const restoreEntry = (entry: UndoEntry) => {
    // Restore canvas pixels if this entry saved them
    if (entry.canvasData) {
      const canvas = getActiveCanvas();
      if (canvas) canvas.getContext('2d')!.putImageData(entry.canvasData, 0, 0);
    }
    // Restore selection state
    const selCanvas = selMaskCanvasRef.current;
    if (selCanvas && entry.maskData) {
      selCanvas.getContext('2d')!.putImageData(entry.maskData, 0, 0);
    } else if (selCanvas) {
      selCanvas.getContext('2d')!.clearRect(0, 0, nw, nh);
    }
    floatingDataRef.current = entry.floating;
    selBoundsRef.current = entry.bounds;
    if (entry.origMask) {
      if (!origSelMaskRef.current) {
        origSelMaskRef.current = document.createElement('canvas');
        origSelMaskRef.current.width = nw;
        origSelMaskRef.current.height = nh;
      }
      origSelMaskRef.current.getContext('2d')!.putImageData(entry.origMask, 0, 0);
    } else {
      origSelMaskRef.current = null;
    }
    moveOffsetRef.current = { ...entry.offset };
    transformRef.current = { ...entry.transform };
    updateHasSelection();
    edgeCacheDirty.current = true;
    cachedEdgeSegs.current = null;
  };

  // Layer state — Background (source image) + Mask layer
  const [layers, setLayers] = useState<Layer[]>([]);
  const layersRef = useRef<Layer[]>([]);
  layersRef.current = layers;
  const [activeLayerId, setActiveLayerId] = useState('');
  const [bgVisible, setBgVisible] = useState(true);
  const [maskVisible, setMaskVisible] = useState(true);
  const [showCheckerboard, setShowCheckerboard] = useState(false);

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
  const [, setDragRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const dragRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const setDragRectBoth = useCallback((r: { x: number; y: number; w: number; h: number } | null) => {
    dragRectRef.current = r;
    setDragRect(r);
  }, []);

  const { naturalWidth: nw, naturalHeight: nh } = image;
  // Compute display geometry once on mount so crop changes don't shift the canvas
  const [initGeom] = useState(() => {
    const prev = image.cropRect;
    const ds = prev ? image.width / prev.w : image.width / nw;
    return {
      ds,
      fullW: nw * ds,
      fullH: nh * ds,
      fullX: prev ? image.x - prev.x * ds : image.x,
      fullY: prev ? image.y - prev.y * ds : image.y,
    };
  });
  const { ds, fullW, fullH, fullX, fullY } = initGeom;

  const effectiveTool = getEffectiveTool(brush, activeTool);

  // Get the canvas for the active layer (mask canvas for Mask layer, layer canvas for others)
  const getActiveCanvas = useCallback((): HTMLCanvasElement | null => {
    const activeLayer = layersRef.current.find((l) => l.id === activeLayerId);
    if (!activeLayer) return maskCanvasRef.current;
    if (activeLayer.name === 'Mask') return maskCanvasRef.current;
    return activeLayer.canvas;
  }, [activeLayerId]);

  // On the mask layer, convert color to mask behavior:
  // White/light → paint white (reveal), Black/dark → erase (hide)
  const isMaskLayer = layers.find((l) => l.id === activeLayerId)?.name === 'Mask';
  const fgLuminance = (() => {
    const c = fgColor.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
  })();

  const paintBrush: BrushSettings = (() => {
    if (!isMaskLayer || brush.type === 'eraser' || brush.type === 'fill') {
      return { ...brush, color: fgColor };
    }
    // On mask layer with pencil: dark colors erase, light colors paint white
    if (fgLuminance < 0.5) {
      // Dark color → erase with strength proportional to darkness
      return { ...brush, type: 'eraser' as BrushType, color: '#000000', opacity: brush.opacity * (1 - fgLuminance * 2) };
    }
    // Light color → paint white with strength proportional to lightness
    return { ...brush, color: '#ffffff', opacity: brush.opacity * (fgLuminance * 2 - 1 + 0.5) };
  })();

  // --- Selection helpers ---
  const getSelMaskCtx = useCallback((): CanvasRenderingContext2D => {
    if (!selMaskCanvasRef.current) {
      const c = document.createElement('canvas');
      c.width = nw; c.height = nh;
      selMaskCanvasRef.current = c;
    }
    return selMaskCanvasRef.current.getContext('2d')!;
  }, [nw, nh]);

  const updateHasSelection = useCallback(() => {
    const c = selMaskCanvasRef.current;
    setHasSelection(c ? selMaskHasPixels(c) : false);
    edgeCacheDirty.current = true;
  }, []);

  // commitFloating — defined as a ref-based function so it can be used before renderPreview is declared
  const commitFloatingRef = useRef<() => void>(() => {});
  const commitFloating = useCallback(() => { commitFloatingRef.current(); }, []);
  const commitTextBoxRef = useRef<() => void>(() => {});
  const commitTextBoxStable = useCallback(() => { commitTextBoxRef.current(); }, []);

  const setActiveTool = useCallback((tool: ToolType) => {
    // Clear text layer transform state when switching away from transform
    const prevActiveLayer = layersRef.current.find((l) => l.id === activeLayerId);
    if (prevActiveLayer?.textData && floatingDataRef.current) {
      floatingDataRef.current = null;
      selBoundsRef.current = null;
      transformRef.current = { scaleX: 1, scaleY: 1, rotation: 0 };
    }
    if (floatingDataRef.current) commitFloating();
    if (textBoxRef.current) commitTextBoxStable();
    setActiveToolRaw(tool);
    // Set up transform bounds for text layer
    if (tool === 'transform') {
      const al = layersRef.current.find((l) => l.id === activeLayerId);
      if (al?.textData) {
        const td = al.textData;
        selBoundsRef.current = { x: td.x, y: td.y, w: td.w, h: td.h };
        transformRef.current = { scaleX: 1, scaleY: 1, rotation: td.rotation ?? 0 };
        floatingDataRef.current = new ImageData(1, 1);
        renderPreviewRef.current();
      }
    }
  }, [commitFloating, commitTextBoxStable, activeLayerId]);

  const clearSelection = useCallback(() => {
    if (floatingDataRef.current) commitFloating();
    snapshotState(false);
    const c = selMaskCanvasRef.current;
    if (c) c.getContext('2d')!.clearRect(0, 0, nw, nh);
    setHasSelection(false);
    setPolygonPoints([]);
    setDragRectBoth(null);
    if (activeTool === 'transform') setActiveToolRaw('select-rect');
    edgeCacheDirty.current = true;
    cachedEdgeSegs.current = null;
  }, [nw, nh, setPolygonPoints, setDragRectBoth, commitFloating, activeTool]);

  const invertSelection = useCallback(() => {
    snapshotState(false);
    const c = selMaskCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const data = ctx.getImageData(0, 0, nw, nh);
    for (let i = 0; i < data.data.length; i += 4) {
      const wasSelected = data.data[i + 3]! > 0;
      const v = wasSelected ? 0 : 255;
      data.data[i] = v;
      data.data[i + 1] = v;
      data.data[i + 2] = v;
      data.data[i + 3] = v;
    }
    ctx.putImageData(data, 0, 0);
    updateHasSelection();
    edgeCacheDirty.current = true;
    cachedEdgeSegs.current = null;
  }, [nw, nh, updateHasSelection]);

  const growShrinkSelection = useCallback((amount: number) => {
    if (amount === 0) return;
    const c = selMaskCanvasRef.current;
    if (!c) return;
    snapshotState(false);
    const ctx = c.getContext('2d')!;
    const imgData = ctx.getImageData(0, 0, nw, nh);

    // Extract binary alpha
    const alpha = new Uint8Array(nw * nh);
    for (let i = 0; i < alpha.length; i++) {
      alpha[i] = imgData.data[i * 4 + 3]! > 127 ? 1 : 0;
    }

    const edges = findEdges(alpha, nw, nh);
    if (edges.length === 0) return;

    let result: Uint8Array;
    if (amount > 0) {
      // Grow: dilate outward from edges
      result = dilateFromEdges(alpha, edges, nw, nh, amount, true);
    } else {
      // Shrink: erode inward from edges
      result = erodeFromEdges(alpha, edges, nw, nh, -amount);
    }

    // Write back to selection mask
    for (let i = 0; i < result.length; i++) {
      const v = result[i] ? 255 : 0;
      const j = i * 4;
      imgData.data[j] = v;
      imgData.data[j + 1] = v;
      imgData.data[j + 2] = v;
      imgData.data[j + 3] = v;
    }
    ctx.putImageData(imgData, 0, 0);
    updateHasSelection();
    edgeCacheDirty.current = true;
    cachedEdgeSegs.current = null;
    renderPreviewRef.current();
  }, [nw, nh, updateHasSelection]);

  const selectLayerContents = useCallback((targetLayerId?: string) => {
    snapshotState(false);
    const activeLayer = layersRef.current.find((l) => l.id === (targetLayerId ?? activeLayerId));
    if (!activeLayer) return;
    // Read pixels from the active layer's canvas (or source image for Background)
    const tmp = document.createElement('canvas');
    tmp.width = nw; tmp.height = nh;
    const tctx = tmp.getContext('2d')!;
    if (activeLayer.name === 'Background' && imgRef.current) {
      tctx.drawImage(imgRef.current, 0, 0, nw, nh);
    } else if (activeLayer.name === 'Mask') {
      const mc = maskCanvasRef.current;
      if (mc) tctx.drawImage(mc, 0, 0);
    } else {
      tctx.drawImage(activeLayer.canvas, 0, 0);
    }
    const data = tctx.getImageData(0, 0, nw, nh);
    for (let i = 0; i < data.data.length; i += 4) {
      const v = data.data[i + 3]! > 0 ? 255 : 0;
      data.data[i] = v;
      data.data[i + 1] = v;
      data.data[i + 2] = v;
      data.data[i + 3] = v;
    }
    const selCtx = getSelMaskCtx();
    selCtx.putImageData(data, 0, 0);
    updateHasSelection();
    edgeCacheDirty.current = true;
    cachedEdgeSegs.current = null;
  }, [nw, nh, activeLayerId, getSelMaskCtx, updateHasSelection]);

  // --- Text tool helpers ---
  const renderPreviewRef = useRef<() => void>(() => {});

  const commitTextBox = useCallback(() => {
    const box = textBoxRef.current;
    const ta = textAreaRef.current;
    const layerId = editingTextLayerId;

    if (!layerId || !box || !ta) {
      textBoxRef.current = null;
      setTextBox(null);
      setEditingTextLayerId(null);
      return;
    }

    const text = (ta.innerText ?? '').trim();
    if (!text) {
      // Empty text — delete the layer. Update layersRef synchronously too:
      // handleApply commits and then reads layersRef in the same tick, before
      // React flushes setLayers.
      layersRef.current = layersRef.current.filter((l) => l.id !== layerId);
      setLayers(layersRef.current);
      ta.innerText = '';
      textBoxRef.current = null;
      setTextBox(null);
      setEditingTextLayerId(null);
      renderPreviewRef.current();
      return;
    }

    const settings = textSettingsRef.current;
    // Preserve existing rotation from the layer
    const existingLayer = layersRef.current.find((l) => l.id === layerId);
    const td: TextLayerData = {
      text: ta.innerText ?? '',
      x: box.x, y: box.y, w: box.w, h: box.h,
      font: settings.font,
      size: settings.size,
      bold: settings.bold,
      italic: settings.italic,
      underline: settings.underline,
      align: settings.align,
      color: fgColor,
      rotation: existingLayer?.textData?.rotation,
    };

    const layerName = text.slice(0, 8).trim() + (text.length > 8 ? '…' : '');
    // Update layersRef synchronously — handleApply reads it right after this
    // commit, before React flushes the setLayers update.
    layersRef.current = layersRef.current.map((l) =>
      l.id === layerId ? { ...l, textData: td, name: layerName } : l,
    );
    setLayers(layersRef.current);

    ta.innerText = '';
    textBoxRef.current = null;
    setTextBox(null);
    setEditingTextLayerId(null);
    renderPreviewRef.current();
  }, [fgColor, editingTextLayerId]);
  commitTextBoxRef.current = commitTextBox;

  const applySelectionShape = useCallback((sel: MaskSelection, mode: 'set' | 'add' | 'subtract') => {
    snapshotState(false);
    const ctx = getSelMaskCtx();
    paintShape(ctx, sel, mode, nw, nh);
    updateHasSelection();
  }, [getSelMaskCtx, nw, nh, updateHasSelection]);

  // --- Rendering ---
  const checkerCacheRef = useRef<HTMLCanvasElement | null>(null);
  const previewRafRef = useRef<number | null>(null);

  const renderPreview = useCallback(() => {
    const display = displayCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const img = imgRef.current;
    if (!display || !maskCanvas || !img) return;

    if (display.width !== nw || display.height !== nh) {
      display.width = nw; display.height = nh;
      checkerCacheRef.current = null; // invalidate cache on resize
    }
    const ctx = display.getContext('2d')!;
    ctx.clearRect(0, 0, nw, nh);

    // Cached checkerboard
    if (!checkerCacheRef.current) {
      const rootStyle = getComputedStyle(document.documentElement);
      const bgColor = rootStyle.getPropertyValue('--color-background').trim() || '#1a1a2e';
      const surfaceColor = rootStyle.getPropertyValue('--color-surface').trim() || '#2a2a3e';
      const checkSize = Math.max(8, Math.round(nw / 80));
      const cc = document.createElement('canvas');
      cc.width = nw; cc.height = nh;
      const cctx = cc.getContext('2d')!;
      for (let y = 0; y < nh; y += checkSize) {
        for (let x = 0; x < nw; x += checkSize) {
          cctx.fillStyle = ((x / checkSize) + (y / checkSize)) % 2 === 0 ? bgColor : surfaceColor;
          cctx.fillRect(x, y, checkSize, checkSize);
        }
      }
      checkerCacheRef.current = cc;
    }

    // Composite layers bottom-to-top
    // Special layers: "Background" draws the source image, "Mask" draws the mask canvas
    // Other layers draw their own canvas
    const allLayers = layersRef.current;
    const activeLayerForFloat = allLayers.find((l) => l.id === activeLayerId);
    const hasFloating = floatingDataRef.current && selBoundsRef.current && !activeLayerForFloat?.textData && activeLayerForFloat?.visible;
    for (const layer of allLayers) {
      if (!layer.visible) continue;

      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.filter = layerAdjustFilter(layer.adjustments);

      if (layer.name === 'Background') {
        ctx.drawImage(layer.canvas, 0, 0);
      } else if (layer.name === 'Mask') {
        // Mask layer: use destination-in to clip everything below by the mask
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(maskCanvas, 0, 0);
      } else if (layer.textData) {
        // Apply blend mode for non-special layers
        if (layer.blendMode && layer.blendMode !== 'source-over') {
          ctx.globalCompositeOperation = layer.blendMode;
        }
        // Text layer: render text dynamically (skip if currently being edited)
        if (layer.id !== editingTextLayerIdRef.current) {
          // During transform, use selBounds position instead of stored textData position
          const sb = selBoundsRef.current;
          const tr = transformRef.current;
          if (layer.id === activeLayerId && sb && floatingDataRef.current) {
            const tdOverride = {
              ...layer.textData,
              x: sb.x, y: sb.y,
              w: Math.round(sb.w * Math.abs(tr.scaleX)),
              h: Math.round(sb.h * Math.abs(tr.scaleY)),
              rotation: tr.rotation,
            };
            renderTextToCanvas(ctx, tdOverride);
          } else {
            renderTextToCanvas(ctx, layer.textData);
          }
        }
      } else {
        // Regular paint layer: apply blend mode and draw
        if (layer.blendMode && layer.blendMode !== 'source-over') {
          ctx.globalCompositeOperation = layer.blendMode;
        }
        ctx.drawImage(layer.canvas, 0, 0);
      }

      ctx.restore();

      // Draw floating selection at its layer position so it composites correctly with the mask
      if (hasFloating && layer.id === activeLayerId) {
        const fd = floatingDataRef.current!;
        const b = selBoundsRef.current!;
        const t = transformRef.current;
        const tmp = document.createElement('canvas');
        tmp.width = fd.width;
        tmp.height = fd.height;
        tmp.getContext('2d')!.putImageData(fd, 0, 0);
        ctx.save();
        ctx.globalAlpha = layer.opacity;
      ctx.filter = layerAdjustFilter(layer.adjustments);
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        ctx.translate(cx, cy);
        ctx.rotate(t.rotation * Math.PI / 180);
        ctx.scale(t.scaleX, t.scaleY);
        ctx.imageSmoothingEnabled = t.scaleX !== 1 || t.scaleY !== 1;
        ctx.drawImage(tmp, -b.w / 2, -b.h / 2);
        ctx.restore();
      }

      // Stroke effect (non-destructive, rendered on top of the layer)
      if (layer.strokeEffect?.enabled && layer.name !== 'Mask') {
        let sourceCanvas = layer.canvas;
        if (layer.textData && layer.id !== editingTextLayerIdRef.current) {
          const tmp = document.createElement('canvas');
          tmp.width = nw; tmp.height = nh;
          const td = (layer.id === activeLayerId && selBoundsRef.current && floatingDataRef.current)
            ? { ...layer.textData, x: selBoundsRef.current.x, y: selBoundsRef.current.y, w: Math.round(selBoundsRef.current.w * Math.abs(transformRef.current.scaleX)), h: Math.round(selBoundsRef.current.h * Math.abs(transformRef.current.scaleY)), rotation: transformRef.current.rotation }
            : layer.textData;
          renderTextToCanvas(tmp.getContext('2d')!, td);
          sourceCanvas = tmp;
        }
        const strokeCanvas = renderStrokeEffect(sourceCanvas, layer.strokeEffect, nw, nh);
        if (strokeCanvas) {
          ctx.save();
          ctx.globalAlpha = layer.opacity;
      ctx.filter = layerAdjustFilter(layer.adjustments);
          ctx.drawImage(strokeCanvas, 0, 0);
          ctx.restore();
        }
      }
    }

    // Draw active stroke buffer (shows current brush stroke in progress)
    if (strokeBufferRef.current) {
      ctx.save();
      ctx.globalAlpha = strokeOpacityRef.current;
      ctx.drawImage(strokeBufferRef.current, 0, 0);
      ctx.restore();
    }

    // Draw cached checkerboard behind everything, or show workspace through transparent areas
    if (showCheckerboard) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.drawImage(checkerCacheRef.current!, 0, 0);
      ctx.restore();
    }
  }, [nw, nh, bgVisible, maskVisible, layers, activeLayerId, showCheckerboard]);

  // Wire up refs now that renderPreview is available
  renderPreviewRef.current = renderPreview;

  commitFloatingRef.current = () => {
    if (!floatingDataRef.current || !selBoundsRef.current) return;
    snapshotState(true);
    const drawCanvas = getActiveCanvas();
    if (drawCanvas) {
      const ctx = drawCanvas.getContext('2d')!;

      const fd = floatingDataRef.current;
      const b = selBoundsRef.current;
      const t = transformRef.current;

      // Create source canvas from floating data
      const src = document.createElement('canvas');
      src.width = fd.width;
      src.height = fd.height;
      src.getContext('2d')!.putImageData(fd, 0, 0);

      // Draw transformed floating pixels onto the layer
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t.rotation * Math.PI / 180);
      ctx.scale(t.scaleX, t.scaleY);
      // Use smoothing only if actually scaled/rotated
      const isTransformed = t.scaleX !== 1 || t.scaleY !== 1 || t.rotation !== 0;
      ctx.imageSmoothingEnabled = isTransformed;
      if (isTransformed) ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, -b.w / 2, -b.h / 2);
      ctx.restore();

      // Rebuild selection mask to match transformed area
      const selCanvas = selMaskCanvasRef.current;
      if (selCanvas) {
        const selCtx = selCanvas.getContext('2d')!;
        selCtx.clearRect(0, 0, nw, nh);
        // Draw a white filled version of the transformed shape as the new mask
        selCtx.save();
        selCtx.translate(cx, cy);
        selCtx.rotate(t.rotation * Math.PI / 180);
        selCtx.scale(t.scaleX, t.scaleY);
        // Use the floating data alpha as the mask shape
        const maskSrc = document.createElement('canvas');
        maskSrc.width = fd.width; maskSrc.height = fd.height;
        const mctx = maskSrc.getContext('2d')!;
        mctx.putImageData(fd, 0, 0);
        // Convert to white where alpha > 0
        const md = mctx.getImageData(0, 0, fd.width, fd.height);
        for (let i = 0; i < md.data.length; i += 4) {
          const a = md.data[i + 3]!;
          md.data[i] = a > 0 ? 255 : 0;
          md.data[i + 1] = a > 0 ? 255 : 0;
          md.data[i + 2] = a > 0 ? 255 : 0;
          md.data[i + 3] = a > 0 ? 255 : 0;
        }
        mctx.putImageData(md, 0, 0);
        selCtx.drawImage(maskSrc, -b.w / 2, -b.h / 2);
        selCtx.restore();
        updateHasSelection();
        edgeCacheDirty.current = true;
        cachedEdgeSegs.current = null;
      }
    }
    floatingDataRef.current = null;
    selBoundsRef.current = null;
    origSelMaskRef.current = null;
    moveOffsetRef.current = { x: 0, y: 0 };
    transformRef.current = { scaleX: 1, scaleY: 1, rotation: 0 };
    transformDragRef.current = null;
    renderPreview();
    forceUpdate((n) => n + 1);
  };

  // --- Overlay render (marching ants) ---
  const renderOverlay = useCallback((dashOffset: number) => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (overlay.width !== vw || overlay.height !== vh) {
      overlay.width = vw; overlay.height = vh;
    }
    const oc = overlay.getContext('2d')!;
    oc.clearRect(0, 0, vw, vh);

    const scale = ds * zoom;
    const rad = (image.rotation * Math.PI) / 180;
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);
    const screenCx = (fullX + fullW / 2) * zoom + pan.x;
    const screenCy = (fullY + fullH / 2) * zoom + pan.y;
    const imgToScreen = (ix: number, iy: number): [number, number] => {
      const lx = (ix * ds - fullW / 2) * zoom;
      const ly = (iy * ds - fullH / 2) * zoom;
      return [screenCx + lx * cosR - ly * sinR, screenCy + lx * sinR + ly * cosR];
    };

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

    // Selection outline
    const selMask = selMaskCanvasRef.current;
    if (selMask && selMaskHasPixels(selMask)) {
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
            if (edge && !inRun) { inRun = true; runStart = x; runDir = below ? 1 : -1; }
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
            if (edge && !inRun) { inRun = true; runStart = y; runDir = right ? -1 : 1; }
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

    // Drag rect preview
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

    // Polygon points
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
        oc.fillStyle = '#fff'; oc.fill();
        oc.strokeStyle = '#000'; oc.lineWidth = 1; oc.stroke();
      }
      if (polyPts.length >= 3) {
        oc.beginPath();
        const [cp0x, cp0y] = imgToScreen(polyPts[0]!.x, polyPts[0]!.y);
        oc.arc(cp0x, cp0y, 8, 0, Math.PI * 2);
        const primaryRgb = getComputedStyle(document.documentElement).getPropertyValue('--color-primary-rgb').trim() || '102, 126, 234';
        oc.strokeStyle = `rgba(${primaryRgb}, 0.6)`;
        oc.lineWidth = 2; oc.setLineDash([]); oc.stroke();
      }
      oc.restore();
    }

    // Transform bounding box + handles
    if (activeTool === 'transform' && floatingDataRef.current && selBoundsRef.current) {
      const b = selBoundsRef.current;
      const t = transformRef.current;
      const tw = b.w * t.scaleX;
      const th = b.h * t.scaleY;
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;

      // Corner points in image space (rotated around center)
      const rot = t.rotation * Math.PI / 180;
      const cosT = Math.cos(rot);
      const sinT = Math.sin(rot);
      const corners = [
        [-tw / 2, -th / 2], [tw / 2, -th / 2],
        [tw / 2, th / 2], [-tw / 2, th / 2],
      ].map(([lx, ly]) => imgToScreen(
        cx + lx! * cosT - ly! * sinT,
        cy + lx! * sinT + ly! * cosT,
      ));

      // Dashed border
      oc.save();
      oc.setLineDash([6, 4]);
      oc.strokeStyle = '#fff';
      oc.lineWidth = 1.5;
      oc.beginPath();
      oc.moveTo(corners[0]![0], corners[0]![1]);
      for (let i = 1; i < 4; i++) oc.lineTo(corners[i]![0], corners[i]![1]);
      oc.closePath();
      oc.stroke();
      oc.strokeStyle = 'rgba(0,0,0,0.5)';
      oc.lineWidth = 1;
      oc.stroke();
      oc.setLineDash([]);

      // Resize handles (8: 4 corners + 4 edges) — hidden for text layers (can't stretch text)
      const isTextTransform = !!layersRef.current.find((l) => l.id === activeLayerId)?.textData;
      const edges = corners.map((c, i) => {
        const next = corners[(i + 1) % 4]!;
        return [(c[0] + next[0]) / 2, (c[1] + next[1]) / 2] as [number, number];
      });
      if (!isTextTransform) {
        const allHandles = [...corners, ...edges];
        const handleSize = 6;
        for (const [hx, hy] of allHandles) {
          oc.fillStyle = '#fff';
          oc.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
          oc.strokeStyle = 'rgba(0,0,0,0.6)';
          oc.lineWidth = 1;
          oc.strokeRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
        }
      }

      // Rotation handle — above top edge center (pointing outward/up, 30 screen px)
      const topMid = edges[0]!;
      const rTopDx = corners[1]![0] - corners[0]![0];
      const rTopDy = corners[1]![1] - corners[0]![1];
      const rTopLen = Math.sqrt(rTopDx * rTopDx + rTopDy * rTopDy) || 1;
      const rotHandleX = topMid[0] + (rTopDy / rTopLen) * 30;
      const rotHandleY = topMid[1] + (-rTopDx / rTopLen) * 30;

      // Line from top edge to rotation handle
      oc.beginPath();
      oc.moveTo(topMid[0], topMid[1]);
      oc.lineTo(rotHandleX, rotHandleY);
      oc.strokeStyle = '#fff';
      oc.lineWidth = 1.5;
      oc.stroke();
      oc.strokeStyle = 'rgba(0,0,0,0.5)';
      oc.lineWidth = 1;
      oc.stroke();

      // Rotation circle
      oc.beginPath();
      oc.arc(rotHandleX, rotHandleY, 5, 0, Math.PI * 2);
      oc.fillStyle = '#fff';
      oc.fill();
      oc.strokeStyle = 'rgba(0,0,0,0.6)';
      oc.lineWidth = 1;
      oc.stroke();

      oc.restore();
    }

    // Crop overlay — always show when crop exists, full controls when crop tool active
    if (activeTool === 'crop' || cropRect) {
      const cr = cropRect ?? { x: 0, y: 0, w: nw, h: nh };

      // Dim outside crop area
      const [tlx, tly] = imgToScreen(cr.x, cr.y);
      const [trx, try_] = imgToScreen(cr.x + cr.w, cr.y);
      const [brx, bry] = imgToScreen(cr.x + cr.w, cr.y + cr.h);
      const [blx, bly] = imgToScreen(cr.x, cr.y + cr.h);

      // Full image corners
      const [i0x, i0y] = imgToScreen(0, 0);
      const [i1x, i1y] = imgToScreen(nw, 0);
      const [i2x, i2y] = imgToScreen(nw, nh);
      const [i3x, i3y] = imgToScreen(0, nh);

      // Draw dim overlay using path with hole
      const isCropActive = activeTool === 'crop';
      oc.save();
      oc.fillStyle = isCropActive ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.25)';
      oc.beginPath();
      // Outer (full image)
      oc.moveTo(i0x, i0y); oc.lineTo(i1x, i1y); oc.lineTo(i2x, i2y); oc.lineTo(i3x, i3y); oc.closePath();
      // Inner hole (crop rect) — wound opposite direction
      oc.moveTo(tlx, tly); oc.lineTo(blx, bly); oc.lineTo(brx, bry); oc.lineTo(trx, try_); oc.closePath();
      oc.fill('evenodd');

      // Crop border
      oc.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#667eea';
      oc.lineWidth = 1.5;
      oc.beginPath();
      oc.moveTo(tlx, tly); oc.lineTo(trx, try_); oc.lineTo(brx, bry); oc.lineTo(blx, bly); oc.closePath();
      oc.stroke();
      oc.strokeStyle = 'rgba(0,0,0,0.5)';
      oc.lineWidth = 1;
      oc.stroke();

      // Resize handles (only when crop tool active)
      if (isCropActive) {
        const corners = [[tlx, tly], [trx, try_], [brx, bry], [blx, bly]];
        const edges = [
          [(tlx + trx) / 2, (tly + try_) / 2],
          [(trx + brx) / 2, (try_ + bry) / 2],
          [(brx + blx) / 2, (bry + bly) / 2],
          [(blx + tlx) / 2, (bly + tly) / 2],
        ];
        const allHandles = [...corners, ...edges];
        const hs = 6;
        for (const hp of allHandles) {
          const hpx = hp[0]!, hpy = hp[1]!;
          oc.fillStyle = '#fff';
          oc.fillRect(hpx - hs / 2, hpy - hs / 2, hs, hs);
          oc.strokeStyle = 'rgba(0,0,0,0.6)';
          oc.lineWidth = 1;
          oc.strokeRect(hpx - hs / 2, hpy - hs / 2, hs, hs);
        }
      }

      oc.restore();
    }

    // Clone/heal source crosshair
    const cloneSrc = cloneSourceRef.current;
    if (cloneSrc && (brush.type === 'clone' || brush.type === 'heal')) {
      const [cx, cy] = imgToScreen(cloneSrc.x, cloneSrc.y);
      const armLen = 12;
      const gap = 4;

      oc.save();
      oc.setLineDash([]);

      // White outline
      oc.lineWidth = 2;
      oc.strokeStyle = '#fff';
      oc.beginPath();
      oc.moveTo(cx - armLen, cy); oc.lineTo(cx - gap, cy);
      oc.moveTo(cx + gap, cy); oc.lineTo(cx + armLen, cy);
      oc.moveTo(cx, cy - armLen); oc.lineTo(cx, cy - gap);
      oc.moveTo(cx, cy + gap); oc.lineTo(cx, cy + armLen);
      oc.stroke();

      // Black inner
      oc.lineWidth = 1;
      oc.strokeStyle = '#000';
      oc.beginPath();
      oc.moveTo(cx - armLen, cy); oc.lineTo(cx - gap, cy);
      oc.moveTo(cx + gap, cy); oc.lineTo(cx + armLen, cy);
      oc.moveTo(cx, cy - armLen); oc.lineTo(cx, cy - gap);
      oc.moveTo(cx, cy + gap); oc.lineTo(cx, cy + armLen);
      oc.stroke();

      // Circle
      oc.beginPath();
      oc.arc(cx, cy, 8, 0, Math.PI * 2);
      oc.strokeStyle = '#fff';
      oc.lineWidth = 2;
      oc.stroke();
      oc.strokeStyle = '#000';
      oc.lineWidth = 1;
      oc.stroke();

      oc.restore();
    }

    // Draw text layer bounds when selected (not editing)
    const activeLayer = layersRef.current.find((l) => l.id === activeLayerId);
    if (activeLayer?.textData && !editingTextLayerIdRef.current) {
      const td = activeLayer.textData;
      const rot = (td.rotation ?? 0) * Math.PI / 180;
      const cx = td.x + td.w / 2;
      const cy = td.y + td.h / 2;
      const rotPt = (px: number, py: number): [number, number] => {
        const dx = px - cx, dy = py - cy;
        return [cx + dx * Math.cos(rot) - dy * Math.sin(rot), cy + dx * Math.sin(rot) + dy * Math.cos(rot)];
      };
      const [tlx, tly] = imgToScreen(...rotPt(td.x, td.y));
      const [trx, try_] = imgToScreen(...rotPt(td.x + td.w, td.y));
      const [brx, bry] = imgToScreen(...rotPt(td.x + td.w, td.y + td.h));
      const [blx, bly] = imgToScreen(...rotPt(td.x, td.y + td.h));
      oc.save();
      oc.setLineDash([4, 3]);
      oc.strokeStyle = 'rgba(255,255,255,0.6)';
      oc.lineWidth = 1;
      oc.beginPath();
      oc.moveTo(tlx, tly);
      oc.lineTo(trx, try_);
      oc.lineTo(brx, bry);
      oc.lineTo(blx, bly);
      oc.closePath();
      oc.stroke();
      oc.restore();
    }
  }, [nw, nh, ds, zoom, pan, fullX, fullY, fullW, fullH, image.rotation, brush.type, activeTool, cropRect, activeLayerId]);

  // --- Initialize ---
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    getSelMaskCtx();

    const loadAndInit = (loadedImg: HTMLImageElement) => {
      imgRef.current = loadedImg;
      const maskCanvas = maskCanvasRef.current;
      if (!maskCanvas) return;
      maskCanvas.width = nw; maskCanvas.height = nh;
      const ctx = maskCanvas.getContext('2d')!;

      if (image.maskDataUrl) {
        const maskImg = new Image();
        maskImg.onload = () => { ctx.drawImage(maskImg, 0, 0); renderPreview(); };
        maskImg.src = image.maskDataUrl;
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, nw, nh);
        renderPreview();
      }

      // Initialize layer list: Background (image) + Mask + restored paint layers
      const bgLayer = createLayer(nw, nh, 'Background');
      const bgCtx = bgLayer.canvas.getContext('2d')!;
      bgCtx.drawImage(img, 0, 0, nw, nh);
      const maskLayer = createLayer(nw, nh, 'Mask');
      maskLayer.visible = true;

      let activeId = maskLayer.id;

      // Restore saved paint layers
      if (image.paintLayers && image.paintLayers.length > 0) {
        // Restore Background settings
        const savedBg = image.paintLayers.find((l) => l.name === 'Background');
        if (savedBg) {
          if (savedBg.strokeEffect) bgLayer.strokeEffect = savedBg.strokeEffect as import('./types').StrokeEffect;
          if (savedBg.blendMode) bgLayer.blendMode = savedBg.blendMode as import('./types').BlendMode;
          bgLayer.visible = savedBg.visible;
          bgLayer.opacity = savedBg.opacity;
        }

        const savedMask = image.paintLayers.find((l) => l.name === 'Mask');
        if (savedMask) {
          maskLayer.visible = savedMask.visible;
          maskLayer.opacity = savedMask.opacity;
          if (savedMask.strokeEffect) maskLayer.strokeEffect = savedMask.strokeEffect as import('./types').StrokeEffect;
          if (savedMask.blendMode) maskLayer.blendMode = savedMask.blendMode as import('./types').BlendMode;
        }

        // Build the layer list in saved order, substituting the real bgLayer/maskLayer objects
        // and creating new layers for everything else
        const allLayers: Layer[] = [];
        const rasterToLoad: { layer: Layer; dataUrl: string }[] = [];

        for (const saved of image.paintLayers) {
          if (saved.name === 'Background') {
            if (saved.adjustments) bgLayer.adjustments = saved.adjustments;
            allLayers.push(bgLayer);
          } else if (saved.name === 'Mask') {
            allLayers.push(maskLayer);
          } else if (saved.textData) {
            const td = saved.textData as TextLayerData;
            ensureGoogleFont(td.font);
            const layer = createTextLayer(nw, nh, td, saved.name);
            layer.visible = saved.visible;
            layer.opacity = saved.opacity;
            if (saved.strokeEffect) layer.strokeEffect = saved.strokeEffect as import('./types').StrokeEffect;
            if (saved.blendMode) layer.blendMode = saved.blendMode as import('./types').BlendMode;
            if (saved.adjustments) layer.adjustments = saved.adjustments;
            allLayers.push(layer);
            activeId = layer.id;
          } else {
            const layer = createLayer(nw, nh, saved.name);
            layer.visible = saved.visible;
            layer.opacity = saved.opacity;
            if (saved.strokeEffect) layer.strokeEffect = saved.strokeEffect as import('./types').StrokeEffect;
            if (saved.blendMode) layer.blendMode = saved.blendMode as import('./types').BlendMode;
            if (saved.adjustments) layer.adjustments = saved.adjustments;
            rasterToLoad.push({ layer, dataUrl: saved.dataUrl });
            allLayers.push(layer);
            activeId = layer.id;
          }
        }

        if (rasterToLoad.length === 0) {
          setLayers(allLayers);
          setActiveLayerId(activeId);
          renderPreview();
        } else {
          let loaded = 0;
          for (const { layer, dataUrl } of rasterToLoad) {
            const layerImg = new Image();
            layerImg.onload = () => {
              layer.canvas.getContext('2d')!.drawImage(layerImg, 0, 0);
              loaded++;
              if (loaded === rasterToLoad.length) {
                setLayers([...allLayers]);
                setActiveLayerId(activeId);
                renderPreview();
              }
            };
            layerImg.src = dataUrl;
          }
          setLayers(allLayers);
          setActiveLayerId(activeId);
        }
      } else {
        const allLayers = [bgLayer, maskLayer];
        setLayers(allLayers);
        setActiveLayerId(activeId);
      }
    };
    // Load without crossOrigin first (always works), then try CORS upgrade in background
    const img = new Image();
    img.onload = () => loadAndInit(img);
    img.src = image.src;
  }, [nw, nh, image.src, image.maskDataUrl, image.paintLayers, renderPreview, getSelMaskCtx]);

  // Re-render when layer visibility or checkerboard changes
  useEffect(() => { renderPreview(); }, [bgVisible, maskVisible, showCheckerboard, renderPreview]);

  // Auto-lift selection when switching to transform tool
  useEffect(() => {
    if (activeTool === 'transform' && hasSelection && !floatingDataRef.current) {
      const drawCanvas = getActiveCanvas();
      if (!drawCanvas) return;
      const ctx = drawCanvas.getContext('2d')!;
      const selCanvas = selMaskCanvasRef.current;
      if (!selCanvas) return;

      snapshotState(true);

      // Threshold selection mask
      const selCtx = selCanvas.getContext('2d')!;
      const selData = selCtx.getImageData(0, 0, nw, nh);
      for (let i = 0; i < selData.data.length; i += 4) {
        const v = selData.data[i + 3]! > 127 ? 255 : 0;
        selData.data[i] = v; selData.data[i + 1] = v; selData.data[i + 2] = v; selData.data[i + 3] = v;
      }
      selCtx.putImageData(selData, 0, 0);

      // Find bounds
      let minX = nw, minY = nh, maxX = 0, maxY = 0;
      for (let y = 0; y < nh; y++) {
        for (let x = 0; x < nw; x++) {
          if (selData.data[(y * nw + x) * 4 + 3]! > 0) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < minX) return;

      const sw = maxX - minX + 1;
      const sh = maxY - minY + 1;
      selBoundsRef.current = { x: minX, y: minY, w: sw, h: sh };

      // Extract pixels
      const srcData = ctx.getImageData(minX, minY, sw, sh);
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          const selAlpha = selData.data[((minY + y) * nw + (minX + x)) * 4 + 3]!;
          if (selAlpha === 0) {
            const i = (y * sw + x) * 4;
            srcData.data[i] = 0; srcData.data[i + 1] = 0; srcData.data[i + 2] = 0; srcData.data[i + 3] = 0;
          }
        }
      }
      floatingDataRef.current = srcData;
      transformRef.current = { scaleX: 1, scaleY: 1, rotation: 0 };

      // Save original mask
      const origMask = document.createElement('canvas');
      origMask.width = nw; origMask.height = nh;
      origMask.getContext('2d')!.drawImage(selCanvas, 0, 0);
      origSelMaskRef.current = origMask;
      moveOffsetRef.current = { x: 0, y: 0 };

      // Clear selected pixels from layer
      const layerData = ctx.getImageData(0, 0, nw, nh);
      for (let y = 0; y < nh; y++) {
        for (let x = 0; x < nw; x++) {
          if (selData.data[(y * nw + x) * 4 + 3]! > 0) {
            const i = (y * nw + x) * 4;
            layerData.data[i] = 0; layerData.data[i + 1] = 0; layerData.data[i + 2] = 0; layerData.data[i + 3] = 0;
          }
        }
      }
      ctx.putImageData(layerData, 0, 0);

      renderPreview();
      forceUpdate((n) => n + 1);
    }
  }, [activeTool]); // eslint-disable-line react-hooks/exhaustive-deps

  // Marching ants animation
  useEffect(() => {
    let lastTime = 0;
    let lastDrawTime = 0;
    const frameInterval = 1000 / 30;
    const animate = (time: number) => {
      const dt = lastTime ? (time - lastTime) / 1000 : 0;
      lastTime = time;
      const speed = Math.max(3, 8 * Math.min(1, ds * zoom));
      antOffsetRef.current = (antOffsetRef.current + dt * speed) % 20;
      if (time - lastDrawTime >= frameInterval) {
        lastDrawTime = time;
        renderOverlay(antOffsetRef.current);
      }
      antRafRef.current = requestAnimationFrame(animate);
    };
    antRafRef.current = requestAnimationFrame(animate);
    return () => { if (antRafRef.current) cancelAnimationFrame(antRafRef.current); };
  }, [renderOverlay]);

  // --- Coordinate transform ---
  const screenToMask = useCallback((clientX: number, clientY: number): MaskPoint | null => {
    const display = displayCanvasRef.current;
    if (!display) return null;
    const screenCx = (fullX + fullW / 2) * zoom + pan.x;
    const screenCy = (fullY + fullH / 2) * zoom + pan.y;
    const rad = -(image.rotation * Math.PI) / 180;
    const dx = clientX - screenCx;
    const dy = clientY - screenCy;
    const urx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ury = dx * Math.sin(rad) + dy * Math.cos(rad);
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
    const sel: MaskSelection = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), polygon: pts };
    applySelectionShape(sel, mode);
    setPolygonPoints([]);
    renderPreview();
  }, [applySelectionShape, renderPreview, setPolygonPoints]);

  // --- Pointer handlers ---
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 2) return; // right click — reserved for context menu
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

    const drawCanvas = getActiveCanvas();
    if (!drawCanvas) return;
    const ctx = drawCanvas.getContext('2d')!;

    if (e.pressure > 0) point.pressure = e.pressure;
    const mode: 'set' | 'add' | 'subtract' = e.shiftKey ? 'add' : e.altKey ? 'subtract' : 'set';
    selModeRef.current = mode;

    // Block brush operations on text layers
    const activeLayer = layersRef.current.find((l) => l.id === activeLayerId);
    if (activeLayer?.textData && activeTool !== 'text' && activeTool !== 'eyedropper'
      && activeTool !== 'select-rect' && activeTool !== 'select-polygon' && activeTool !== 'select-wand'
      && activeTool !== 'move' && activeTool !== 'transform' && activeTool !== 'crop') {
      return;
    }

    // Text tool — commit any existing text box, then start dragging a new one
    if (activeTool === 'text') {
      if (textBoxRef.current) {
        commitTextBoxRef.current();
      }
      // If clicking inside an existing text layer's bounds, don't start a new drag
      // (double-click will handle entering edit mode)
      const activeTextLayer = layersRef.current.find((l) => l.id === activeLayerId);
      if (activeTextLayer?.textData && !editingTextLayerIdRef.current) {
        const td = activeTextLayer.textData;
        if (point.x >= td.x && point.x <= td.x + td.w && point.y >= td.y && point.y <= td.y + td.h) {
          return;
        }
      }
      // Only allow text creation inside the image bounds
      if (point.x < 0 || point.x >= nw || point.y < 0 || point.y >= nh) return;
      textDragStartRef.current = { x: point.x, y: point.y };
      drawingRef.current = true;
      // Capture so pointerup reaches us even when the live text box overlay
      // appears under the cursor mid-drag — otherwise the drag never ends and
      // the box keeps resizing with every later mouse move
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    // Crop tool — drag handles to resize, drag inside to move, drag outside to create new
    if (activeTool === 'crop') {
      const cr = cropRect ?? { x: 0, y: 0, w: nw, h: nh };
      const hitR = 10 / (ds * zoom);

      // Check resize handles
      const handleNames = ['tl', 'tr', 'br', 'bl', 't', 'r', 'b', 'l'] as const;
      const handlePts: [number, number][] = [
        [cr.x, cr.y], [cr.x + cr.w, cr.y], [cr.x + cr.w, cr.y + cr.h], [cr.x, cr.y + cr.h],
        [cr.x + cr.w / 2, cr.y], [cr.x + cr.w, cr.y + cr.h / 2],
        [cr.x + cr.w / 2, cr.y + cr.h], [cr.x, cr.y + cr.h / 2],
      ];
      let handled = false;
      for (let i = 0; i < handlePts.length; i++) {
        const hdx = point.x - handlePts[i]![0];
        const hdy = point.y - handlePts[i]![1];
        if (Math.sqrt(hdx * hdx + hdy * hdy) < hitR) {
          cropDragRef.current = { type: 'resize', handle: handleNames[i], startX: point.x, startY: point.y, origRect: { ...cr } };
          drawingRef.current = true;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          handled = true;
          break;
        }
      }

      if (!handled) {
        // Check if inside crop rect — move
        if (point.x >= cr.x && point.x <= cr.x + cr.w && point.y >= cr.y && point.y <= cr.y + cr.h) {
          cropDragRef.current = { type: 'move', startX: point.x, startY: point.y, origRect: { ...cr } };
          drawingRef.current = true;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        } else {
          // Outside — create new crop rect
          cropDragRef.current = { type: 'create', startX: point.x, startY: point.y, origRect: { x: point.x, y: point.y, w: 0, h: 0 } };
          drawingRef.current = true;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }
      }
      return;
    }

    // Eyedropper — drag to preview, release to confirm
    if (effectiveTool === 'eyedropper') {
      const display = displayCanvasRef.current;
      if (display) {
        const dCtx = display.getContext('2d')!;
        const pixel = dCtx.getImageData(Math.round(point.x), Math.round(point.y), 1, 1).data;
        const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(v => (v ?? 0).toString(16).padStart(2, '0')).join('');
        if (strokeEyedropperRef.current) {
          setLayers((prev) => prev.map((l) =>
            l.id === activeLayerId && l.strokeEffect ? { ...l, strokeEffect: { ...l.strokeEffect, color: hex } } : l,
          ));
          renderPreview();
        } else {
          setEyedropperPreview(hex);
        }
      }
      drawingRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    // Transform tool on text layer — use text bounds as selection, resize handles
    if (activeTool === 'transform' && activeLayer?.textData) {
      const td = activeLayer.textData;
      // Set up selBounds from text data if not already set
      if (!selBoundsRef.current || !floatingDataRef.current) {
        selBoundsRef.current = { x: td.x, y: td.y, w: td.w, h: td.h };
        transformRef.current = { scaleX: 1, scaleY: 1, rotation: td.rotation ?? 0 };
        floatingDataRef.current = new ImageData(1, 1);
      }
      textUndoStack.current.push({ layerId: activeLayerId, textData: { ...td } });
      textRedoStack.current.length = 0;
      moveStartRef.current = { x: point.x, y: point.y };

      // Check transform handles
      const handles = getTransformHandles(selBoundsRef.current, transformRef.current, ds * zoom);
      const hitRadius = 12 / (ds * zoom);

      const rdx = point.x - handles.rotHandle[0];
      const rdy = point.y - handles.rotHandle[1];
      if (Math.sqrt(rdx * rdx + rdy * rdy) < hitRadius) {
        transformDragRef.current = {
          type: 'rotate', startX: point.x, startY: point.y,
          origBounds: { ...selBoundsRef.current },
          origScale: { x: transformRef.current.scaleX, y: transformRef.current.scaleY },
          origRotation: transformRef.current.rotation,
        };
        drawingRef.current = true;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }

      // Skip resize handles for text layers — text can't be stretched
      if (!activeLayer?.textData) {
        const handleNames = ['tl', 'tr', 'br', 'bl', 't', 'r', 'b', 'l'] as const;
        const handlePts = [
          handles.corners.tl, handles.corners.tr, handles.corners.br, handles.corners.bl,
          handles.edges.t, handles.edges.r, handles.edges.b, handles.edges.l,
        ];
        for (let i = 0; i < handlePts.length; i++) {
          const hx = handlePts[i]![0] - point.x;
          const hy = handlePts[i]![1] - point.y;
          if (Math.sqrt(hx * hx + hy * hy) < hitRadius) {
            transformDragRef.current = {
              type: 'resize', handle: handleNames[i], startX: point.x, startY: point.y,
              origBounds: { ...selBoundsRef.current },
              origScale: { x: transformRef.current.scaleX, y: transformRef.current.scaleY },
              origRotation: transformRef.current.rotation,
            };
            drawingRef.current = true;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            return;
          }
        }
      }

      // No handle hit — move drag
      drawingRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    // Move tool on text layer — drag the text box position
    if (activeTool === 'move' && activeLayer?.textData) {
      textUndoStack.current.push({ layerId: activeLayerId, textData: { ...activeLayer.textData } });
      textRedoStack.current.length = 0;
      moveStartRef.current = { x: point.x, y: point.y };
      drawingRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    // Move/Transform tool — lift selection and start dragging
    if (activeTool === 'move' || activeTool === 'transform') {
      // No selection: move tool lifts entire layer content
      if (!hasSelection && activeTool === 'move' && !floatingDataRef.current) {
        const layerData = ctx.getImageData(0, 0, nw, nh);
        let minX = nw, minY = nh, maxX = -1, maxY = -1;
        for (let y = 0; y < nh; y++) {
          for (let x = 0; x < nw; x++) {
            if (layerData.data[(y * nw + x) * 4 + 3]! > 0) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX < 0) return; // layer is empty

        snapshotState(true);

        const sw = maxX - minX + 1;
        const sh = maxY - minY + 1;
        selBoundsRef.current = { x: minX, y: minY, w: sw, h: sh };
        floatingDataRef.current = ctx.getImageData(minX, minY, sw, sh);
        transformRef.current = { scaleX: 1, scaleY: 1, rotation: 0 };

        // Create a selection mask covering the content bounds
        const selCtx = getSelMaskCtx();
        selCtx.clearRect(0, 0, nw, nh);
        selCtx.fillStyle = '#fff';
        selCtx.fillRect(minX, minY, sw, sh);
        const origMask = document.createElement('canvas');
        origMask.width = nw; origMask.height = nh;
        origMask.getContext('2d')!.drawImage(selMaskCanvasRef.current!, 0, 0);
        origSelMaskRef.current = origMask;
        moveOffsetRef.current = { x: 0, y: 0 };
        setHasSelection(true);

        // Clear the layer
        ctx.clearRect(0, 0, nw, nh);
        renderPreview();

        moveStartRef.current = { x: point.x, y: point.y };
        drawingRef.current = true;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }
      if (!hasSelection) return;
      moveStartRef.current = { x: point.x, y: point.y };

      // Transform tool: detect handle hits when already floating
      if (activeTool === 'transform' && floatingDataRef.current && selBoundsRef.current) {
        const handles = getTransformHandles(selBoundsRef.current, transformRef.current, ds * zoom);
        const hitRadius = 12 / (ds * zoom); // screen pixels → image pixels

        // Check rotation handle
        const rdx = point.x - handles.rotHandle[0];
        const rdy = point.y - handles.rotHandle[1];
        if (Math.sqrt(rdx * rdx + rdy * rdy) < hitRadius) {
          snapshotState(false);
          transformDragRef.current = {
            type: 'rotate', startX: point.x, startY: point.y,
            origBounds: { ...selBoundsRef.current },
            origScale: { x: transformRef.current.scaleX, y: transformRef.current.scaleY },
            origRotation: transformRef.current.rotation,
          };
          drawingRef.current = true;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          return;
        }

        // Check resize handles
        const handleNames = ['tl', 'tr', 'br', 'bl', 't', 'r', 'b', 'l'] as const;
        const handlePts = [
          handles.corners.tl, handles.corners.tr, handles.corners.br, handles.corners.bl,
          handles.edges.t, handles.edges.r, handles.edges.b, handles.edges.l,
        ];
        for (let i = 0; i < handlePts.length; i++) {
          const hx = handlePts[i]![0] - point.x;
          const hy = handlePts[i]![1] - point.y;
          if (Math.sqrt(hx * hx + hy * hy) < hitRadius) {
            snapshotState(false);
            transformDragRef.current = {
              type: 'resize', handle: handleNames[i], startX: point.x, startY: point.y,
              origBounds: { ...selBoundsRef.current },
              origScale: { x: transformRef.current.scaleX, y: transformRef.current.scaleY },
              origRotation: transformRef.current.rotation,
            };
            drawingRef.current = true;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            return;
          }
        }
        // No handle hit — fall through to move drag
        snapshotState(false);
      }

      if (!floatingDataRef.current) {
        // Snapshot for undo before lifting
        snapshotState(true);

        // First click: lift selected pixels from the active layer
        const selCanvas = selMaskCanvasRef.current;
        if (!selCanvas) return;

        // Threshold selection mask to binary for sharp edges
        const selCtx = selCanvas.getContext('2d')!;
        const selData = selCtx.getImageData(0, 0, nw, nh);
        for (let i = 0; i < selData.data.length; i += 4) {
          const v = selData.data[i + 3]! > 127 ? 255 : 0;
          selData.data[i] = v;
          selData.data[i + 1] = v;
          selData.data[i + 2] = v;
          selData.data[i + 3] = v;
        }
        // Write thresholded mask back so erase and marching ants use it
        selCtx.putImageData(selData, 0, 0);

        // Find bounding box of selection mask
        let minX = nw, minY = nh, maxX = 0, maxY = 0;
        for (let y = 0; y < nh; y++) {
          for (let x = 0; x < nw; x++) {
            if (selData.data[(y * nw + x) * 4 + 3]! > 0) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX < minX) return; // empty selection

        const sw = maxX - minX + 1;
        const sh = maxY - minY + 1;
        selBoundsRef.current = { x: minX, y: minY, w: sw, h: sh };

        // Extract pixels from active layer, masked by selection
        const srcData = ctx.getImageData(minX, minY, sw, sh);
        for (let y = 0; y < sh; y++) {
          for (let x = 0; x < sw; x++) {
            const selAlpha = selData.data[((minY + y) * nw + (minX + x)) * 4 + 3]!;
            if (selAlpha === 0) {
              const i = (y * sw + x) * 4;
              srcData.data[i] = 0;
              srcData.data[i + 1] = 0;
              srcData.data[i + 2] = 0;
              srcData.data[i + 3] = 0;
            }
          }
        }
        floatingDataRef.current = srcData;
        transformRef.current = { scaleX: 1, scaleY: 1, rotation: 0 };

        // Save original selection mask for offset-based repositioning
        const origMask = document.createElement('canvas');
        origMask.width = nw; origMask.height = nh;
        origMask.getContext('2d')!.drawImage(selCanvas, 0, 0);
        origSelMaskRef.current = origMask;
        moveOffsetRef.current = { x: 0, y: 0 };

        // Clear selected pixels using pixel-level masking (no anti-aliasing)
        const layerData = ctx.getImageData(0, 0, nw, nh);
        for (let y = 0; y < nh; y++) {
          for (let x = 0; x < nw; x++) {
            if (selData.data[(y * nw + x) * 4 + 3]! > 0) {
              const i = (y * nw + x) * 4;
              layerData.data[i] = 0;
              layerData.data[i + 1] = 0;
              layerData.data[i + 2] = 0;
              layerData.data[i + 3] = 0;
            }
          }
        }
        ctx.putImageData(layerData, 0, 0);
        renderPreview();
      }

      drawingRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (effectiveTool === 'select-rect') {
      setPolygonPoints([]);
      if (pixelSnap) {
        point.x = Math.round(point.x);
        point.y = Math.round(point.y);
      }
      if (snapEnabled) {
        const snapThresh = 8 / (ds * zoom);
        for (const g of guides) {
          if (g.axis === 'x' && Math.abs(point.x - g.position) < snapThresh) point.x = g.position;
          if (g.axis === 'y' && Math.abs(point.y - g.position) < snapThresh) point.y = g.position;
        }
        const cr = cropRectRef.current;
        if (cr) {
          if (Math.abs(point.x - cr.x) < snapThresh) point.x = cr.x;
          else if (Math.abs(point.x - (cr.x + cr.w)) < snapThresh) point.x = cr.x + cr.w;
          if (Math.abs(point.y - cr.y) < snapThresh) point.y = cr.y;
          else if (Math.abs(point.y - (cr.y + cr.h)) < snapThresh) point.y = cr.y + cr.h;
        }
      }
      selStartRef.current = point;
      selDraggedRef.current = false;
      drawingRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (effectiveTool === 'select-polygon') {
      const now = Date.now();
      const isDoubleClick = now - lastClickTimeRef.current < 200;
      lastClickTimeRef.current = now;
      if (pixelSnap) {
        point.x = Math.round(point.x);
        point.y = Math.round(point.y);
      }
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
        if (Math.sqrt((point.x - first.x) ** 2 + (point.y - first.y) ** 2) < closeDist || isDoubleClick) {
          closePolygon(polygonPoints, mode);
          return;
        }
      }
      const newPts = [...polygonPoints, point];
      setPolygonPoints(newPts);
      polyDraggingRef.current = true;
      drawingRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      renderPreview();
      return;
    }

    if (effectiveTool === 'select-wand') {
      snapshotState(false);
      setPolygonPoints([]);
      // Sample only from the active layer
      const flat = document.createElement('canvas');
      flat.width = nw; flat.height = nh;
      const flatCtx = flat.getContext('2d')!;
      const activeLayer = layersRef.current.find((l) => l.id === activeLayerId);
      if (activeLayer?.name === 'Background' && imgRef.current) {
        flatCtx.drawImage(imgRef.current, 0, 0, nw, nh);
      } else if (activeLayer?.name === 'Mask') {
        flatCtx.fillStyle = '#000';
        flatCtx.fillRect(0, 0, nw, nh);
        const mc = maskCanvasRef.current;
        if (mc) flatCtx.drawImage(mc, 0, 0);
      } else if (activeLayer) {
        flatCtx.drawImage(activeLayer.canvas, 0, 0);
      }
      const wandMask = buildWandMask(flat, point.x, point.y, wandSettings);
      const selCtx = getSelMaskCtx();
      if (mode === 'set') selCtx.clearRect(0, 0, nw, nh);
      selCtx.globalCompositeOperation = mode === 'subtract' ? 'destination-out' : 'source-over';
      selCtx.drawImage(wandMask, 0, 0);
      selCtx.globalCompositeOperation = 'source-over';
      updateHasSelection();
      renderPreview();
      return;
    }

    if (effectiveTool === 'fill') {
      snapshotState(true);
      const selMask = selMaskCanvasRef.current;
      const hasSel = selMask && selMaskHasPixels(selMask);
      // Snapshot before fill so we can clip to selection
      const preFillData = hasSel ? ctx.getImageData(0, 0, nw, nh) : null;
      let bounds: { x: number; y: number; w: number; h: number } | undefined;
      if (hasSel) {
        const sd = selMask!.getContext('2d')!.getImageData(0, 0, nw, nh).data;
        let x0 = nw, y0 = nh, x1 = 0, y1 = 0;
        for (let py = 0; py < nh; py++) {
          for (let px = 0; px < nw; px++) {
            if (sd[(py * nw + px) * 4 + 3]! > 0) {
              x0 = Math.min(x0, px); y0 = Math.min(y0, py);
              x1 = Math.max(x1, px + 1); y1 = Math.max(y1, py + 1);
            }
          }
        }
        bounds = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      }
      if (isMaskLayer) {
        const maskMode = fgLuminance < 0.5 ? 'hide' : 'reveal';
        floodFillMask(ctx, point.x, point.y, maskMode, 32, bounds);
      } else {
        floodFill(ctx, point.x, point.y, fgColor, 32, bounds);
      }
      // Clip fill to selection
      if (hasSel && preFillData) {
        clipToSelection(ctx, preFillData, selMask!);
      }
      renderPreview();
      return;
    }

    // Brush stroke start
    snapshotState(true);

    // Apply selection clipping if there's an active selection
    const selMask = selMaskCanvasRef.current;
    const hasSel = selMask && selMaskHasPixels(selMask);
    if (hasSel) {
      preStrokeDataRef.current = ctx.getImageData(0, 0, nw, nh);
    } else {
      preStrokeDataRef.current = null;
    }

    // --- Smudge ---
    if (effectiveTool === 'smudge') {
      smudgeStateRef.current = smudgeStart(ctx, point.x, point.y, paintBrush);
      prevPointRef.current = point;
      drawingRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      renderPreview();
      return;
    }

    // --- Clone ---
    if (effectiveTool === 'clone') {
      if (e.altKey) {
        cloneSourceRef.current = { x: point.x, y: point.y };
        cloneOffsetRef.current = null; // will be set on first stroke
        cloneSourceLayerIdRef.current = activeLayerId; // remember which layer was alt+clicked
        drawingRef.current = false;
        return;
      }
      if (!cloneSourceRef.current) { drawingRef.current = false; return; }
      // Compute offset on first stroke, reuse on subsequent strokes
      if (!cloneOffsetRef.current) {
        cloneOffsetRef.current = { x: cloneSourceRef.current.x - point.x, y: cloneSourceRef.current.y - point.y };
      }
      const srcX = point.x + cloneOffsetRef.current.x;
      const srcY = point.y + cloneOffsetRef.current.y;
      cloneSourceRef.current = { x: srcX, y: srcY };
      // Build source snapshot: canvas mode = full composite, layer mode = specific layer only
      let sourceSnap: HTMLCanvasElement;
      if (cloneSourceMode === 'layer' && cloneSourceLayerIdRef.current) {
        const srcLayer = layersRef.current.find((l) => l.id === cloneSourceLayerIdRef.current);
        if (srcLayer) {
          sourceSnap = document.createElement('canvas');
          sourceSnap.width = nw; sourceSnap.height = nh;
          sourceSnap.getContext('2d')!.drawImage(srcLayer.canvas, 0, 0);
        } else {
          sourceSnap = buildComposite(layersRef.current, nw, nh, imgRef, maskCanvasRef);
        }
      } else {
        sourceSnap = buildComposite(layersRef.current, nw, nh, imgRef, maskCanvasRef);
      }
      cloneSourceCanvasRef.current = sourceSnap;
      cloneStateRef.current = cloneStart(point.x, point.y, srcX, srcY);
      const srcCtx = sourceSnap.getContext('2d')!;
      // Create stroke buffer for opacity-correct clone strokes
      if (paintBrush.opacity < 1) {
        const buf = document.createElement('canvas');
        buf.width = nw; buf.height = nh;
        strokeBufferRef.current = buf;
        strokeBufferCtxRef.current = buf.getContext('2d')!;
        strokeOpacityRef.current = paintBrush.opacity;
      }
      const cloneCtx = strokeBufferCtxRef.current ?? ctx;
      cloneDot(cloneCtx, point.x, point.y, { ...paintBrush, opacity: strokeBufferRef.current ? 1 : paintBrush.opacity }, srcX, srcY, srcCtx);
      if (hasSel && preStrokeDataRef.current) clipToSelection(ctx, preStrokeDataRef.current, selMask!);
      prevPointRef.current = point;
      drawingRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      renderPreview();
      return;
    }

    // --- Heal ---
    if (effectiveTool === 'heal') {
      // Create stroke buffer for opacity-correct heal strokes
      if (paintBrush.opacity < 1) {
        const buf = document.createElement('canvas');
        buf.width = nw; buf.height = nh;
        // Pre-fill with current layer content so heal can sample surroundings
        buf.getContext('2d')!.drawImage(drawCanvas, 0, 0);
        strokeBufferRef.current = buf;
        strokeBufferCtxRef.current = buf.getContext('2d')!;
        strokeOpacityRef.current = paintBrush.opacity;
      }
      const healCtx = strokeBufferCtxRef.current ?? ctx;
      healStateRef.current = healStart(healCtx);
      healStateRef.current.lastX = point.x;
      healStateRef.current.lastY = point.y;
      healBrush(healCtx, point.x, point.y, paintBrush, healStateRef.current);
      if (hasSel && preStrokeDataRef.current) clipToSelection(ctx, preStrokeDataRef.current, selMask!);
      prevPointRef.current = point;
      drawingRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      renderPreview();
      return;
    }

    // --- Pencil / Eraser ---
    // Create stroke buffer for opacity-correct rendering
    const isEraser = paintBrush.type === 'eraser' || paintBrush.type === 'hide';
    if (!isEraser && paintBrush.opacity < 1) {
      const buf = document.createElement('canvas');
      buf.width = nw; buf.height = nh;
      strokeBufferRef.current = buf;
      strokeBufferCtxRef.current = buf.getContext('2d')!;
      strokeOpacityRef.current = paintBrush.opacity;
    }

    const drawCtx = strokeBufferCtxRef.current ?? ctx;
    // Stroke buffer draws at full opacity; final composite applies brush opacity
    const bufBrush = strokeBufferRef.current ? { ...paintBrush, opacity: 1 } : paintBrush;

    if (e.shiftKey && lastStrokeEndRef.current) {
      drawStrokeSegment(drawCtx, lastStrokeEndRef.current as Point, point as Point, bufBrush, pixelSnap);
    } else {
      drawDot(drawCtx, point as Point, bufBrush, pixelSnap);
    }

    // Restore pixels outside selection
    if (hasSel && preStrokeDataRef.current) {
      if (strokeBufferRef.current) {
        // Buffer mode: composite buffer to layer with opacity, then clip
        ctx.save();
        ctx.globalAlpha = paintBrush.opacity;
        ctx.drawImage(strokeBufferRef.current, 0, 0);
        ctx.restore();
        clipToSelection(ctx, preStrokeDataRef.current, selMask!);
      } else {
        clipToSelection(ctx, preStrokeDataRef.current, selMask!);
      }
    }

    prevPointRef.current = point;
    drawingRef.current = true;
    lastStrokeEndRef.current = point;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    renderPreview();
  }, [screenToMask, effectiveTool, paintBrush, renderPreview, guides, snapEnabled, ds, zoom, nw, nh, polygonPoints, closePolygon, setPolygonPoints, getSelMaskCtx, updateHasSelection, wandSettings, applySelectionShape]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    const point = screenToMask(e.clientX, e.clientY);
    if (!point) return;
    if (e.pressure > 0) point.pressure = e.pressure;

    // Text tool — drag out text box rectangle
    if (activeTool === 'text' && textDragStartRef.current) {
      const sx = textDragStartRef.current.x;
      const sy = textDragStartRef.current.y;
      // Clamp drag endpoint to image bounds during creation
      const ex = Math.max(0, Math.min(nw, point.x));
      const ey = Math.max(0, Math.min(nh, point.y));
      const box = {
        x: Math.min(sx, ex),
        y: Math.min(sy, ey),
        w: Math.abs(ex - sx),
        h: Math.abs(ey - sy),
      };
      textBoxRef.current = box;
      setTextBox(box);
      renderPreview();
      return;
    }

    // Crop tool — handle resize/move/create
    if (activeTool === 'crop' && cropDragRef.current) {
      const drag = cropDragRef.current;
      const dxp = point.x - drag.startX;
      const dyp = point.y - drag.startY;

      if (drag.type === 'create') {
        const x0 = Math.max(0, Math.min(drag.startX, point.x));
        const y0 = Math.max(0, Math.min(drag.startY, point.y));
        const x1 = Math.min(nw, Math.max(drag.startX, point.x));
        const y1 = Math.min(nh, Math.max(drag.startY, point.y));
        setCropRect({ x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) });
      } else if (drag.type === 'move') {
        const or = drag.origRect;
        setCropRect({
          x: Math.max(0, Math.min(nw - or.w, or.x + dxp)),
          y: Math.max(0, Math.min(nh - or.h, or.y + dyp)),
          w: or.w,
          h: or.h,
        });
      } else if (drag.type === 'resize') {
        const or = drag.origRect;
        const h = drag.handle!;
        let nx = or.x, ny = or.y, nxw = or.x + or.w, nyh = or.y + or.h;

        if (h === 'tl' || h === 'l' || h === 'bl') nx = Math.max(0, or.x + dxp);
        if (h === 'tr' || h === 'r' || h === 'br') nxw = Math.min(nw, or.x + or.w + dxp);
        if (h === 'tl' || h === 't' || h === 'tr') ny = Math.max(0, or.y + dyp);
        if (h === 'bl' || h === 'b' || h === 'br') nyh = Math.min(nh, or.y + or.h + dyp);

        // Ensure minimum size
        if (nxw - nx < 1) { if (h.includes('l')) nx = nxw - 1; else nxw = nx + 1; }
        if (nyh - ny < 1) { if (h.includes('t')) ny = nyh - 1; else nyh = ny + 1; }

        setCropRect({ x: nx, y: ny, w: nxw - nx, h: nyh - ny });
      }
      return;
    }

    // Transform tool — handle resize/rotate drags
    if (activeTool === 'transform' && transformDragRef.current && selBoundsRef.current) {
      const drag = transformDragRef.current;

      if (drag.type === 'resize') {
        const h = drag.handle!;
        const dxImg = point.x - drag.startX;
        const dyImg = point.y - drag.startY;

        // Compute scale change based on which handle is dragged
        let newSx = drag.origScale.x;
        let newSy = drag.origScale.y;
        const ob = drag.origBounds;

        if (h === 'tl' || h === 'bl' || h === 'l') {
          newSx = Math.max(0.05, drag.origScale.x - dxImg / ob.w);
        }
        if (h === 'tr' || h === 'br' || h === 'r') {
          newSx = Math.max(0.05, drag.origScale.x + dxImg / ob.w);
        }
        if (h === 'tl' || h === 'tr' || h === 't') {
          newSy = Math.max(0.05, drag.origScale.y - dyImg / ob.h);
        }
        if (h === 'bl' || h === 'br' || h === 'b') {
          newSy = Math.max(0.05, drag.origScale.y + dyImg / ob.h);
        }

        // Shift = constrain aspect ratio
        if (e.shiftKey && (h === 'tl' || h === 'tr' || h === 'bl' || h === 'br')) {
          const avgScale = (Math.abs(newSx) + Math.abs(newSy)) / 2;
          newSx = avgScale * Math.sign(newSx);
          newSy = avgScale * Math.sign(newSy);
        }

        transformRef.current = { ...transformRef.current, scaleX: newSx, scaleY: newSy };
        renderPreview();
        return;
      }

      if (drag.type === 'rotate') {
        const handles = getTransformHandles(drag.origBounds, { scaleX: drag.origScale.x, scaleY: drag.origScale.y, rotation: drag.origRotation });
        const center = handles.center;
        const startAngle = Math.atan2(drag.startY - center[1], drag.startX - center[0]);
        const curAngle = Math.atan2(point.y - center[1], point.x - center[0]);
        let delta = (curAngle - startAngle) * 180 / Math.PI;

        // Shift = snap to 15 degree increments
        if (e.shiftKey) {
          const total = drag.origRotation + delta;
          delta = Math.round(total / 15) * 15 - drag.origRotation;
        }

        transformRef.current = { ...transformRef.current, rotation: drag.origRotation + delta };
        renderPreview();
        return;
      }
    }

    // Move tool on text layer — drag text box position
    if (activeTool === 'move' && moveStartRef.current) {
      const al = layersRef.current.find((l) => l.id === activeLayerId);
      if (al?.textData) {
        let dx = point.x - moveStartRef.current.x;
        let dy = point.y - moveStartRef.current.y;
        if (e.shiftKey) {
          if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0;
        }
        const td = al.textData;
        setLayers((prev) => prev.map((l) =>
          l.id === activeLayerId && l.textData
            ? { ...l, textData: { ...l.textData, x: td.x + dx, y: td.y + dy } }
            : l,
        ));
        moveStartRef.current = { x: point.x, y: point.y };
        renderPreview();
        return;
      }
    }

    // Move tool — drag floating selection
    if ((activeTool === 'move' || activeTool === 'transform') && moveStartRef.current && selBoundsRef.current) {
      let dx = point.x - moveStartRef.current.x;
      let dy = point.y - moveStartRef.current.y;

      // Shift: lock to cardinal direction
      if (e.shiftKey) {
        const totalDx = moveOffsetRef.current.x + dx;
        const totalDy = moveOffsetRef.current.y + dy;
        if (Math.abs(totalDx) >= Math.abs(totalDy)) {
          dy = -moveOffsetRef.current.y;
        } else {
          dx = -moveOffsetRef.current.x;
        }
      }
      const b = selBoundsRef.current;
      const t = transformRef.current;
      const tw = b.w * Math.abs(t.scaleX);
      const th = b.h * Math.abs(t.scaleY);
      const snapThresh = 6 / (ds * zoom);

      // Snap selection edges to canvas borders and crop edges
      const newX = b.x + dx;
      const newY = b.y + dy;
      const snapEdgesX = [0, nw];
      const snapEdgesY = [0, nh];
      const cr = cropRectRef.current;
      if (cr) {
        snapEdgesX.push(cr.x, cr.x + cr.w);
        snapEdgesY.push(cr.y, cr.y + cr.h);
      }
      for (const sx of snapEdgesX) {
        if (Math.abs(newX - sx) < snapThresh) { dx += sx - newX; break; }
        if (Math.abs(newX + tw - sx) < snapThresh) { dx += sx - (newX + tw); break; }
      }
      for (const sy of snapEdgesY) {
        if (Math.abs(newY - sy) < snapThresh) { dy += sy - newY; break; }
        if (Math.abs(newY + th - sy) < snapThresh) { dy += sy - (newY + th); break; }
      }

      selBoundsRef.current.x += dx;
      selBoundsRef.current.y += dy;
      moveOffsetRef.current.x += dx;
      moveOffsetRef.current.y += dy;

      // Redraw selection mask from original at total offset
      const selCanvas = selMaskCanvasRef.current;
      if (selCanvas && origSelMaskRef.current) {
        const selCtx = selCanvas.getContext('2d')!;
        selCtx.clearRect(0, 0, nw, nh);
        selCtx.drawImage(origSelMaskRef.current, Math.round(moveOffsetRef.current.x), Math.round(moveOffsetRef.current.y));
        edgeCacheDirty.current = true;
        cachedEdgeSegs.current = null;
      }

      moveStartRef.current = { x: point.x, y: point.y };
      renderPreview();
      return;
    }

    if (effectiveTool === 'eyedropper') {
      const display = displayCanvasRef.current;
      if (display) {
        const dCtx = display.getContext('2d')!;
        const px = Math.max(0, Math.min(Math.round(point.x), display.width - 1));
        const py = Math.max(0, Math.min(Math.round(point.y), display.height - 1));
        const pixel = dCtx.getImageData(px, py, 1, 1).data;
        const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(v => (v ?? 0).toString(16).padStart(2, '0')).join('');
        if (strokeEyedropperRef.current) {
          setLayers((prev) => prev.map((l) =>
            l.id === activeLayerId && l.strokeEffect ? { ...l, strokeEffect: { ...l.strokeEffect, color: hex } } : l,
          ));
          renderPreview();
        } else {
          setEyedropperPreview(hex);
        }
      }
      return;
    }

    if (effectiveTool === 'select-rect') {
      const start = selStartRef.current;
      if (!start) return;
      selDraggedRef.current = true;
      let endX = point.x;
      let endY = point.y;
      if (pixelSnap) {
        endX = Math.round(endX);
        endY = Math.round(endY);
      }
      if (snapEnabled) {
        const snapThresh = 8 / (ds * zoom);
        for (const g of guides) {
          if (g.axis === 'x' && Math.abs(endX - g.position) < snapThresh) endX = g.position;
          if (g.axis === 'y' && Math.abs(endY - g.position) < snapThresh) endY = g.position;
        }
        const cr = cropRectRef.current;
        if (cr) {
          if (Math.abs(endX - cr.x) < snapThresh) endX = cr.x;
          else if (Math.abs(endX - (cr.x + cr.w)) < snapThresh) endX = cr.x + cr.w;
          if (Math.abs(endY - cr.y) < snapThresh) endY = cr.y;
          else if (Math.abs(endY - (cr.y + cr.h)) < snapThresh) endY = cr.y + cr.h;
        }
      }
      const x0 = Math.min(start.x, endX);
      const y0 = Math.min(start.y, endY);
      setDragRectBoth({ x: x0, y: y0, w: Math.abs(endX - start.x), h: Math.abs(endY - start.y) });
      return;
    }

    if (effectiveTool === 'select-polygon') {
      if (polyDraggingRef.current && polygonPointsRef.current.length > 0) {
        if (pixelSnap) {
          point.x = Math.round(point.x);
          point.y = Math.round(point.y);
        }
        if (snapEnabled && guides.length > 0) {
          const snapThresh = 8 / (ds * zoom);
          for (const g of guides) {
            if (g.axis === 'x' && Math.abs(point.x - g.position) < snapThresh) point.x = g.position;
            if (g.axis === 'y' && Math.abs(point.y - g.position) < snapThresh) point.y = g.position;
          }
        }
        const pts = [...polygonPointsRef.current];
        pts[pts.length - 1] = point;
        setPolygonPoints(pts);
      }
      return;
    }

    // Brush
    const drawCanvas = getActiveCanvas();
    if (!drawCanvas) return;
    const ctx = drawCanvas.getContext('2d')!;

    // --- Smudge move ---
    if (effectiveTool === 'smudge' && smudgeStateRef.current) {
      smudgeMove(ctx, point.x, point.y, paintBrush, smudgeStateRef.current);
      prevPointRef.current = point;
      if (!previewRafRef.current) {
        previewRafRef.current = requestAnimationFrame(() => {
          previewRafRef.current = null;
          renderPreview();
        });
      }
      return;
    }

    // --- Clone move ---
    if (effectiveTool === 'clone' && cloneStateRef.current) {
      if (!cloneSourceCanvasRef.current) return; // no source snapshot — skip
      const srcCtx = cloneSourceCanvasRef.current.getContext('2d')!;
      const cloneCtx = strokeBufferCtxRef.current ?? ctx;
      const cloneBrush = strokeBufferRef.current ? { ...paintBrush, opacity: 1 } : paintBrush;
      cloneMove(cloneCtx, point.x, point.y, cloneBrush, cloneStateRef.current, srcCtx);
      if (preStrokeDataRef.current && selMaskCanvasRef.current) {
        clipToSelection(ctx, preStrokeDataRef.current, selMaskCanvasRef.current);
      }
      // Update crosshair to track with brush
      cloneSourceRef.current = {
        x: point.x + cloneStateRef.current.offsetX,
        y: point.y + cloneStateRef.current.offsetY,
      };
      prevPointRef.current = point;
      // Throttle preview to animation frames to avoid jank
      if (!previewRafRef.current) {
        previewRafRef.current = requestAnimationFrame(() => {
          previewRafRef.current = null;
          renderPreview();
        });
      }
      return;
    }

    // --- Heal move ---
    if (effectiveTool === 'heal' && healStateRef.current) {
      const healCtx = strokeBufferCtxRef.current ?? ctx;
      // Interpolate between last point and current for smooth strokes
      const hlx = healStateRef.current.lastX;
      const hly = healStateRef.current.lastY;
      const hdx = point.x - hlx;
      const hdy = point.y - hly;
      const hdist = Math.sqrt(hdx * hdx + hdy * hdy);
      const hstep = Math.max(1, brush.size * brush.spacing);
      const hsteps = Math.max(1, Math.ceil(hdist / hstep));
      for (let i = 1; i <= hsteps; i++) {
        const t = i / hsteps;
        healBrush(healCtx, hlx + hdx * t, hly + hdy * t, paintBrush, healStateRef.current);
      }
      if (preStrokeDataRef.current && selMaskCanvasRef.current) {
        clipToSelection(ctx, preStrokeDataRef.current, selMaskCanvasRef.current);
      }
      healStateRef.current.lastX = point.x;
      healStateRef.current.lastY = point.y;
      prevPointRef.current = point;
      if (!previewRafRef.current) {
        previewRafRef.current = requestAnimationFrame(() => {
          previewRafRef.current = null;
          renderPreview();
        });
      }
      return;
    }

    // --- Pencil / Eraser move ---
    const drawCtx = strokeBufferCtxRef.current ?? ctx;
    const bufBrush = strokeBufferRef.current ? { ...paintBrush, opacity: 1 } : paintBrush;
    const pr = prevPointRef.current;
    if (pr) {
      drawStrokeSegment(drawCtx, pr as Point, point as Point, bufBrush, pixelSnap);
    }
    prevPointRef.current = point;
    lastStrokeEndRef.current = point;

    if (preStrokeDataRef.current && selMaskCanvasRef.current) {
      clipToSelection(ctx, preStrokeDataRef.current, selMaskCanvasRef.current);
    }

    if (!previewRafRef.current) {
      previewRafRef.current = requestAnimationFrame(() => {
        previewRafRef.current = null;
        renderPreview();
      });
    }
  }, [screenToMask, effectiveTool, paintBrush, renderPreview, guides, snapEnabled, ds, zoom, polygonPoints, setPolygonPoints, setDragRectBoth]);

  const handlePointerUp = useCallback((_e: React.PointerEvent) => {
    // Text tool — finish drag, create text layer immediately and enter edit mode
    if (activeTool === 'text' && textDragStartRef.current) {
      drawingRef.current = false;
      textDragStartRef.current = null;
      const box = textBoxRef.current;
      if (!box || box.w < 10 || box.h < 10) {
        textBoxRef.current = null;
        setTextBox(null);
        return;
      }
      // Create text layer now with empty text
      const settings = textSettingsRef.current;
      const td: TextLayerData = {
        text: '',
        x: box.x, y: box.y, w: box.w, h: box.h,
        font: settings.font, size: settings.size,
        bold: settings.bold, italic: settings.italic,
        underline: settings.underline, align: settings.align,
        color: fgColor,
      };
      const layer = createTextLayer(nw, nh, td);
      setLayers((prev) => {
        const activeIdx = prev.findIndex((l) => l.id === activeLayerId);
        const insertAt = activeIdx >= 0 ? activeIdx + 1 : prev.length;
        const next = [...prev];
        next.splice(insertAt, 0, layer);
        return next;
      });
      setActiveLayerId(layer.id);
      setEditingTextLayerId(layer.id);
      requestAnimationFrame(() => {
        textAreaRef.current?.focus();
        renderPreviewRef.current();
      });
      return;
    }

    // Crop tool — stop dragging
    if (activeTool === 'crop') {
      drawingRef.current = false;
      cropDragRef.current = null;
      return;
    }

    // Move/Transform tool — keep floating, just stop dragging
    if (activeTool === 'move' || activeTool === 'transform') {
      // Apply transform to text layer
      const al = layersRef.current.find((l) => l.id === activeLayerId);
      if (al?.textData && selBoundsRef.current) {
        const b = selBoundsRef.current;
        const t = transformRef.current;
        const newW = Math.round(b.w * Math.abs(t.scaleX));
        const newH = Math.round(b.h * Math.abs(t.scaleY));
        const newRotation = t.rotation;
        setLayers((prev) => prev.map((l) =>
          l.id === activeLayerId && l.textData
            ? { ...l, textData: { ...l.textData, x: b.x, y: b.y, w: Math.max(20, newW), h: Math.max(10, newH), rotation: newRotation } }
            : l,
        ));
        // Reset scale but keep rotation for continued transforms
        selBoundsRef.current = { x: b.x, y: b.y, w: Math.max(20, newW), h: Math.max(10, newH) };
        transformRef.current = { scaleX: 1, scaleY: 1, rotation: newRotation };
        renderPreview();
      }
      drawingRef.current = false;
      moveStartRef.current = null;
      transformDragRef.current = null;
      return;
    }

    if (effectiveTool === 'eyedropper') {
      drawingRef.current = false;
      if (eyedropperPreview) {
        if (strokeEyedropperRef.current) {
          // Feed picked color into stroke effect
          strokeEyedropperRef.current = false;
          const layer = layersRef.current.find((l) => l.id === activeLayerId);
          if (layer?.strokeEffect) {
            setLayers((prev) => prev.map((l) =>
              l.id === activeLayerId ? { ...l, strokeEffect: { ...l.strokeEffect!, color: eyedropperPreview } } : l,
            ));
            renderPreview();
          }
          setActiveToolRaw(prevToolRef.current);
        } else {
          setFgColor(eyedropperPreview);
          setBrush((b) => ({ ...b, color: eyedropperPreview }));
          addRecentColor(eyedropperPreview);
        }
        setEyedropperPreview(null);
      }
      return;
    }

    if (effectiveTool === 'select-polygon') {
      polyDraggingRef.current = false;
      drawingRef.current = false;
      return;
    }

    if (effectiveTool === 'select-rect') {
      drawingRef.current = false;
      const dr = dragRectRef.current;
      selStartRef.current = null;

      if (dr && selDraggedRef.current) {
        const sel: MaskSelection = { x: dr.x, y: dr.y, w: dr.w, h: dr.h };
        applySelectionShape(sel, selModeRef.current);
      } else if (!selDraggedRef.current && selModeRef.current === 'set') {
        // Click without drag in set mode = deselect
        clearSelection();
      }
      setDragRectBoth(null);
      renderPreview();
      return;
    }

    // Composite stroke buffer to layer
    if (strokeBufferRef.current) {
      const drawCanvas = getActiveCanvas();
      if (drawCanvas) {
        const layerCtx = drawCanvas.getContext('2d')!;
        layerCtx.save();
        layerCtx.globalAlpha = strokeOpacityRef.current;
        layerCtx.drawImage(strokeBufferRef.current, 0, 0);
        layerCtx.restore();
      }
      strokeBufferRef.current = null;
      strokeBufferCtxRef.current = null;
      renderPreview();
    }

    drawingRef.current = false;
    prevPointRef.current = null;
    preStrokeDataRef.current = null;
    smudgeStateRef.current = null;
    cloneStateRef.current = null;
    healStateRef.current = null;
    cloneSourceCanvasRef.current = null;
    forceUpdate((n) => n + 1);
  }, [effectiveTool, paintBrush, renderPreview, applySelectionShape, setDragRectBoth, clearSelection, eyedropperPreview, addRecentColor]);

  // --- Keyboard ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') { spaceHeldRef.current = true; setSpaceHeld(true); return; }
      if (e.key === 'Alt') { setAltHeld(true); e.preventDefault(); return; }
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+Z/Y handled by workspace master undo/redo
        if (e.key === 'a') {
          e.preventDefault();
          const selCtx = getSelMaskCtx();
          selCtx.fillStyle = '#ffffff';
          selCtx.fillRect(0, 0, nw, nh);
          updateHasSelection();
        }
        return;
      }

      // Tool shortcuts
      switch (e.key.toLowerCase()) {
        case 'b': setActiveTool('brush'); setBrush((b) => ({ ...b, type: 'pencil' })); break;
        case 'e': setActiveTool('brush'); setBrush((b) => ({ ...b, type: 'eraser' })); break;
        // R and H no longer used — paint white to reveal, erase to hide
        case 'g': setActiveTool('brush'); setBrush((b) => ({ ...b, type: 'fill' })); break;
        case 's': setActiveTool('brush'); setBrush((b) => ({ ...b, type: 'smudge' })); break;
        case 'c': setActiveTool('brush'); setBrush((b) => ({ ...b, type: 'clone' })); break;
        case 'j': setActiveTool('brush'); setBrush((b) => ({ ...b, type: 'heal' })); break;
        case 'm': setActiveTool('select-rect'); break;
        case 'p': setActiveTool('select-polygon'); break;
        case 'w': setActiveTool('select-wand'); break;
        case 'i': setActiveTool('eyedropper'); break;
        case 'v': setActiveTool('move'); break;
        case 't': setActiveTool('text'); break;
        case 'n': handleAddLayer(); break;
        case 'f': if (onFrame) onFrame(); break;
        case 'x':
          setFgColor((fg) => { setBgColor(fg); return bgColor; });
          break;
        case 'd':
          setFgColor('#000000');
          setBgColor('#ffffff');
          setBrush((b) => ({ ...b, color: '#000000' }));
          break;
        case '[':
          setBrush((b) => ({ ...b, size: Math.max(1, b.size - (b.size > 20 ? 5 : 1)) }));
          break;
        case ']':
          setBrush((b) => ({ ...b, size: Math.min(2048, b.size + (b.size >= 20 ? 5 : 1)) }));
          break;
        case 'escape':
          if (activeTool === 'crop') {
            // Cancel crop — revert to original
            setCropRect(image.cropRect ? { ...image.cropRect } : null);
            setActiveToolRaw('select-rect');
          }
          else if (floatingDataRef.current) {
            commitFloating(); clearSelection();
            if (activeTool === 'transform') setActiveToolRaw('select-rect');
          }
          else if (hasSelection) {
            clearSelection();
            if (activeTool === 'transform') setActiveToolRaw('select-rect');
          }
          else if (polygonPoints.length > 0) setPolygonPoints([]);
          else {
            // Revert crop to what it was when editor opened
            if (onCropChange) {
              const initial = initialCropRef.current;
              if (initial) onCropChange(initial);
              else onCropChange(null);
            }
            clearPaintHistory();
            onCancel();
          }
          break;
        case 'enter':
          if (activeTool === 'crop') {
            e.preventDefault();
            if (onCropChange) {
              // If crop covers full image, remove it
              const cr = cropRect;
              if (cr && Math.round(cr.x) === 0 && Math.round(cr.y) === 0 && Math.round(cr.w) >= nw && Math.round(cr.h) >= nh) {
                onCropChange(null);
              } else {
                onCropChange(cr ? { x: Math.round(cr.x), y: Math.round(cr.y), w: Math.round(cr.w), h: Math.round(cr.h) } : null);
              }
            }
            setActiveToolRaw('select-rect');
          }
          else if (floatingDataRef.current) {
            commitFloating();
            if (activeTool === 'transform') setActiveToolRaw('select-rect');
          }
          else handleApply();
          break;
        case 'delete':
        case 'backspace':
          if (hasSelection) handleFillSelection('hide');
          break;
        case 'arrowup':
        case 'arrowdown':
        case 'arrowleft':
        case 'arrowright':
          if (floatingDataRef.current && selBoundsRef.current) {
            e.preventDefault();
            const k = e.key.toLowerCase();
            const step = e.shiftKey ? 10 : 1;
            const dx = k === 'arrowleft' ? -step : k === 'arrowright' ? step : 0;
            const dy = k === 'arrowup' ? -step : k === 'arrowdown' ? step : 0;
            selBoundsRef.current.x += dx;
            selBoundsRef.current.y += dy;
            moveOffsetRef.current.x += dx;
            moveOffsetRef.current.y += dy;
            const selCanvas = selMaskCanvasRef.current;
            if (selCanvas && origSelMaskRef.current) {
              const selCtx = selCanvas.getContext('2d')!;
              selCtx.clearRect(0, 0, nw, nh);
              selCtx.drawImage(origSelMaskRef.current, Math.round(moveOffsetRef.current.x), Math.round(moveOffsetRef.current.y));
              edgeCacheDirty.current = true;
              cachedEdgeSegs.current = null;
            }
            renderPreview();
          }
          break;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') { spaceHeldRef.current = false; setSpaceHeld(false); }
      if (e.key === 'Alt') { setAltHeld(false); }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  });

  // --- Actions ---
  const handleApply = useCallback(() => {
    // Release paint-editor history before the (heavy) compositing work below.
    clearPaintHistory();

    // Commit pending text
    if (textBoxRef.current) commitTextBoxRef.current();

    // Commit current crop state via ref (avoids stale closure)
    if (onCropChange) {
      const cr = cropRectRef.current;
      if (cr && Math.round(cr.x) === 0 && Math.round(cr.y) === 0 && Math.round(cr.w) >= nw && Math.round(cr.h) >= nh) {
        onCropChange(null);
      } else {
        onCropChange(cr ? { x: Math.round(cr.x), y: Math.round(cr.y), w: Math.round(cr.w), h: Math.round(cr.h) } : null);
      }
    }

    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) { onApply(null, null, null, null); return; }
    const ctx = maskCanvas.getContext('2d')!;
    const data = ctx.getImageData(0, 0, nw, nh).data;
    let allWhite = true;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i]! < 255) { allWhite = false; break; }
    }
    const maskDataUrl = allWhite ? null : maskCanvas.toDataURL('image/png');

    // Serialize all non-Background layers for persistence
    const currentLayers = layersRef.current;
    const serialized = currentLayers
      .map((l) => ({
        name: l.name,
        dataUrl: l.name === 'Mask' ? (maskDataUrl ?? '') : l.name === 'Background' ? '' : l.textData ? '' : l.canvas.toDataURL('image/png'),
        visible: l.visible,
        opacity: l.opacity,
        blendMode: l.blendMode !== 'source-over' ? l.blendMode : undefined,
        strokeEffect: l.strokeEffect,
        textData: l.textData,
        adjustments: l.adjustments,
      }));

    // Save if there are extra paint layers, stroke effects, or non-default settings
    const hasAnythingToSave = serialized.some((l) =>
      (l.name !== 'Background' && l.name !== 'Mask') ||
      l.strokeEffect?.enabled ||
      l.blendMode ||
      (l.name === 'Mask' && l.dataUrl) ||
      !l.visible ||
      l.opacity < 1 ||
      layerAdjustFilter(l.adjustments) !== 'none'
    );
    const paintLayerData = hasAnythingToSave ? serialized : null;

    // Split visible non-Background, non-Mask layers into underlay (below mask) and overlay (above mask)
    // The underlay gets CSS mask applied like the background; the overlay renders on top unmasked.
    let paintOverlayUrl: string | null = null;
    let paintUnderlayUrl: string | null = null;
    const maskIdx = currentLayers.findIndex((l) => l.name === 'Mask');

    const drawLayerToCtx = (octx: CanvasRenderingContext2D, layer: Layer) => {
      if (layer.name !== 'Background') {
        octx.save();
        octx.globalAlpha = layer.opacity;
        octx.filter = layerAdjustFilter(layer.adjustments);
        if (layer.blendMode && layer.blendMode !== 'source-over') {
          octx.globalCompositeOperation = layer.blendMode;
        }
        if (layer.textData) {
          renderTextToCanvas(octx, layer.textData);
        } else {
          octx.drawImage(layer.canvas, 0, 0);
        }
        octx.restore();
      }
      if (layer.strokeEffect?.enabled) {
        let srcCanvas = layer.canvas;
        if (layer.textData) {
          const tmp = document.createElement('canvas');
          tmp.width = nw; tmp.height = nh;
          renderTextToCanvas(tmp.getContext('2d')!, layer.textData);
          srcCanvas = tmp;
        }
        const strokeCanvas = renderStrokeEffect(srcCanvas, layer.strokeEffect, nw, nh);
        if (strokeCanvas) {
          octx.save();
          octx.globalAlpha = layer.opacity;
        octx.filter = layerAdjustFilter(layer.adjustments);
          octx.drawImage(strokeCanvas, 0, 0);
          octx.restore();
        }
      }
    };

    // Layers below the mask (underlay — should be masked)
    const belowMask = currentLayers.filter((l, i) =>
      l.visible && l.name !== 'Background' && l.name !== 'Mask' && i < maskIdx);
    const belowHasStroke = currentLayers.some((l, i) =>
      i < maskIdx && l.strokeEffect?.enabled && l.visible);
    if (belowMask.length > 0 || belowHasStroke) {
      const c = document.createElement('canvas');
      c.width = nw; c.height = nh;
      const uctx = c.getContext('2d')!;
      for (const layer of currentLayers) {
        if (!layer.visible || layer.name === 'Mask') continue;
        if (currentLayers.indexOf(layer) >= maskIdx) continue;
        drawLayerToCtx(uctx, layer);
      }
      paintUnderlayUrl = c.toDataURL('image/png');
    }

    // Layers above the mask (overlay — no mask needed)
    const aboveMask = currentLayers.filter((l, i) =>
      l.visible && l.name !== 'Background' && l.name !== 'Mask' && i > maskIdx);
    const aboveHasStroke = currentLayers.some((l, i) =>
      i > maskIdx && l.strokeEffect?.enabled && l.visible);
    if (aboveMask.length > 0 || aboveHasStroke) {
      const c = document.createElement('canvas');
      c.width = nw; c.height = nh;
      const octx = c.getContext('2d')!;
      for (const layer of currentLayers) {
        if (!layer.visible || layer.name === 'Mask') continue;
        const li = currentLayers.indexOf(layer);
        if (li <= maskIdx) continue;
        drawLayerToCtx(octx, layer);
      }
      paintOverlayUrl = c.toDataURL('image/png');
    }

    // Check if Background layer was modified (compare to original image)
    let backgroundDataUrl: string | null = null;
    const bgLayer = currentLayers.find((l) => l.name === 'Background');
    if (bgLayer && imgRef.current) {
      const origCanvas = document.createElement('canvas');
      origCanvas.width = nw; origCanvas.height = nh;
      const origCtx = origCanvas.getContext('2d')!;
      origCtx.drawImage(imgRef.current, 0, 0, nw, nh);
      const origData = origCtx.getImageData(0, 0, nw, nh).data;
      const bgData = bgLayer.canvas.getContext('2d')!.getImageData(0, 0, nw, nh).data;
      let modified = false;
      for (let i = 0; i < origData.length; i++) {
        if (origData[i] !== bgData[i]) { modified = true; break; }
      }
      if (modified) {
        backgroundDataUrl = bgLayer.canvas.toDataURL('image/png');
      }
    }

    // Generate full composite when any layer uses a non-normal blend mode,
    // when a paint layer sits below the Background (split underlay/overlay
    // rendering can't represent below-background paint), or when any visible
    // layer has adjustments — the Background's filter in particular can only
    // reach the workspace through the composite.
    const hasBlendModes = currentLayers.some((l) =>
      l.blendMode && l.blendMode !== 'source-over' && l.name !== 'Mask' && l.visible);
    const bgIdx = currentLayers.findIndex((l) => l.name === 'Background');
    const hasPaintBelowBg = bgIdx > 0 && currentLayers.slice(0, bgIdx).some((l) =>
      l.visible && l.name !== 'Mask' && l.name !== 'Background');
    const hasLayerAdjustments = currentLayers.some((l) =>
      l.visible && l.name !== 'Mask' && layerAdjustFilter(l.adjustments) !== 'none');
    let paintCompositeUrl: string | null = null;
    if (hasBlendModes || hasPaintBelowBg || hasLayerAdjustments) {
      const comp = document.createElement('canvas');
      comp.width = nw; comp.height = nh;
      const cctx = comp.getContext('2d')!;
      for (const layer of currentLayers) {
        if (!layer.visible) continue;
        cctx.save();
        cctx.globalAlpha = layer.opacity;
        cctx.filter = layerAdjustFilter(layer.adjustments);
        if (layer.name === 'Background') {
          cctx.drawImage(layer.canvas, 0, 0);
        } else if (layer.name === 'Mask') {
          cctx.globalCompositeOperation = 'destination-in';
          cctx.drawImage(maskCanvas, 0, 0);
        } else {
          if (layer.blendMode && layer.blendMode !== 'source-over') {
            cctx.globalCompositeOperation = layer.blendMode;
          }
          if (layer.textData) {
            renderTextToCanvas(cctx, layer.textData);
          } else {
            cctx.drawImage(layer.canvas, 0, 0);
          }
        }
        cctx.restore();
        // Stroke effects
        if (layer.strokeEffect?.enabled && layer.name !== 'Mask') {
          let srcCanvas = layer.canvas;
          if (layer.textData) {
            const tmp = document.createElement('canvas');
            tmp.width = nw; tmp.height = nh;
            renderTextToCanvas(tmp.getContext('2d')!, layer.textData);
            srcCanvas = tmp;
          }
          const strokeCanvas = renderStrokeEffect(srcCanvas, layer.strokeEffect, nw, nh);
          if (strokeCanvas) {
            cctx.save();
            cctx.globalAlpha = layer.opacity;
        cctx.filter = layerAdjustFilter(layer.adjustments);
            cctx.drawImage(strokeCanvas, 0, 0);
            cctx.restore();
          }
        }
      }
      paintCompositeUrl = comp.toDataURL('image/png');
    }

    onApply(maskDataUrl, paintLayerData, paintOverlayUrl, backgroundDataUrl, paintUnderlayUrl, paintCompositeUrl);
  }, [nw, nh, onApply]);

  const handleInvert = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d')!;
    snapshotState(true);
    const img = ctx.getImageData(0, 0, nw, nh);
    const d = img.data;
    for (let i = 3; i < d.length; i += 4) d[i] = 255 - d[i]!;
    ctx.putImageData(img, 0, 0);
    renderPreview();
    forceUpdate((n) => n + 1);
  }, [nw, nh, renderPreview]);

  const handleUndo = useCallback(() => {
    // Text layer undo (separate stack)
    if (textUndoStack.current.length > 0) {
      const entry = textUndoStack.current.pop()!;
      const currentLayer = layersRef.current.find((l) => l.id === entry.layerId);
      if (currentLayer?.textData) {
        textRedoStack.current.push({ layerId: entry.layerId, textData: { ...currentLayer.textData } });
        setLayers((prev) => prev.map((l) =>
          l.id === entry.layerId ? { ...l, textData: entry.textData } : l,
        ));
        if (activeTool === 'transform' && selBoundsRef.current) {
          selBoundsRef.current = { x: entry.textData.x, y: entry.textData.y, w: entry.textData.w, h: entry.textData.h };
          transformRef.current = { scaleX: 1, scaleY: 1, rotation: entry.textData.rotation ?? 0 };
        }
        renderPreview();
        forceUpdate((n) => n + 1);
        return;
      }
    }
    // Unified undo — restore canvas + selection atomically
    if (undoStack.current.length > 0) {
      redoStack.current.push(captureUndoEntry(undoStack.current[undoStack.current.length - 1]!.canvasData !== null));
      if (redoStack.current.length > MAX_PAINT_HISTORY) redoStack.current.shift();
      restoreEntry(undoStack.current.pop()!);
    }
    renderPreview();
    forceUpdate((n) => n + 1);
  }, [renderPreview, getActiveCanvas, nw, nh, activeTool]);

  const handleRedo = useCallback(() => {
    // Text layer redo (separate stack)
    if (textRedoStack.current.length > 0) {
      const entry = textRedoStack.current.pop()!;
      const currentLayer = layersRef.current.find((l) => l.id === entry.layerId);
      if (currentLayer?.textData) {
        textUndoStack.current.push({ layerId: entry.layerId, textData: { ...currentLayer.textData } });
        setLayers((prev) => prev.map((l) =>
          l.id === entry.layerId ? { ...l, textData: entry.textData } : l,
        ));
        if (activeTool === 'transform' && selBoundsRef.current) {
          selBoundsRef.current = { x: entry.textData.x, y: entry.textData.y, w: entry.textData.w, h: entry.textData.h };
          transformRef.current = { scaleX: 1, scaleY: 1, rotation: entry.textData.rotation ?? 0 };
        }
        renderPreview();
        forceUpdate((n) => n + 1);
        return;
      }
    }
    // Unified redo — restore canvas + selection atomically
    if (redoStack.current.length > 0) {
      undoStack.current.push(captureUndoEntry(redoStack.current[redoStack.current.length - 1]!.canvasData !== null));
      if (undoStack.current.length > MAX_PAINT_HISTORY) undoStack.current.shift();
      restoreEntry(redoStack.current.pop()!);
    }
    renderPreview();
    forceUpdate((n) => n + 1);
  }, [renderPreview, getActiveCanvas, nw, nh, activeTool]);

  // Push undo/redo state to parent when it changes
  const canUndoPaint = undoStack.current.length > 0 || textUndoStack.current.length > 0;
  const canRedoPaint = redoStack.current.length > 0 || textRedoStack.current.length > 0;
  useEffect(() => {
    if (onHistoryChange) {
      onHistoryChange({
        undo: handleUndo,
        redo: handleRedo,
        canUndo: canUndoPaint,
        canRedo: canRedoPaint,
      });
    }
  }, [onHistoryChange, handleUndo, handleRedo, canUndoPaint, canRedoPaint]);

  const handleFillSelection = useCallback((fillMode: 'hide' | 'reveal') => {
    const drawCanvas = getActiveCanvas();
    const selMask = selMaskCanvasRef.current;
    if (!drawCanvas || !selMask) return;
    const ctx = drawCanvas.getContext('2d')!;
    snapshotState(true);
    ctx.save();

    if (fillMode === 'hide') {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }
    // Draw selection mask as the fill area on the active layer
    ctx.drawImage(selMask, 0, 0);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    renderPreview();
    forceUpdate((n) => n + 1);
  }, [nw, nh, renderPreview, getActiveCanvas]);

  // --- Layer operations ---
  const handleAddLayer = useCallback(() => {
    const layer = createLayer(nw, nh);
    setLayers((prev) => {
      // Insert above the active layer
      const activeIdx = prev.findIndex((l) => l.id === activeLayerId);
      const insertAt = activeIdx >= 0 ? activeIdx + 1 : prev.length;
      const next = [...prev];
      next.splice(insertAt, 0, layer);
      return next;
    });
    setActiveLayerId(layer.id);
  }, [nw, nh, activeLayerId]);

  // Import an external image file as a new paint layer
  useEffect(() => {
    if (!importLayerFile) return;
    const { file, mode } = importLayerFile;
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const layer = createLayer(nw, nh, file.name.replace(/\.[^.]+$/, ''));
      const oversized = mode === 'original' && (img.naturalWidth > nw || img.naturalHeight > nh);

      if (oversized) {
        // Image is larger than canvas — import as floating selection with transform tool
        // so the user can scale/position it before committing
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = img.naturalWidth;
        tmpCanvas.height = img.naturalHeight;
        const tmpCtx = tmpCanvas.getContext('2d')!;
        tmpCtx.imageSmoothingEnabled = false;
        tmpCtx.drawImage(img, 0, 0);
        floatingDataRef.current = tmpCtx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
        selBoundsRef.current = {
          x: Math.round((nw - img.naturalWidth) / 2),
          y: Math.round((nh - img.naturalHeight) / 2),
          w: img.naturalWidth,
          h: img.naturalHeight,
        };
        transformRef.current = { scaleX: 1, scaleY: 1, rotation: 0 };
        // Mark selection so transform tool sees it
        const selCanvas = selMaskCanvasRef.current;
        if (selCanvas) {
          const selCtx = selCanvas.getContext('2d')!;
          selCtx.fillStyle = '#ffffff';
          selCtx.fillRect(0, 0, nw, nh);
        }
        setHasSelection(true);
        setLayers((prev) => {
          const activeIdx = prev.findIndex((l) => l.id === activeLayerId);
          const insertAt = activeIdx >= 0 ? activeIdx + 1 : prev.length;
          const next = [...prev];
          next.splice(insertAt, 0, layer);
          return next;
        });
        setActiveLayerId(layer.id);
        setActiveToolRaw('transform');
      } else {
        const ctx = layer.canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;
        let x = 0, y = 0, w = nw, h = nh;
        if (mode === 'fit') {
          const scale = Math.min(nw / img.naturalWidth, nh / img.naturalHeight, 1);
          w = Math.round(img.naturalWidth * scale);
          h = Math.round(img.naturalHeight * scale);
          x = Math.round((nw - w) / 2);
          y = Math.round((nh - h) / 2);
        } else if (mode === 'original') {
          w = img.naturalWidth;
          h = img.naturalHeight;
          x = Math.round((nw - w) / 2);
          y = Math.round((nh - h) / 2);
        }
        // 'stretch' uses x=0, y=0, w=nw, h=nh (full canvas)
        ctx.drawImage(img, x, y, w, h);
        setLayers((prev) => {
          const activeIdx = prev.findIndex((l) => l.id === activeLayerId);
          const insertAt = activeIdx >= 0 ? activeIdx + 1 : prev.length;
          const next = [...prev];
          next.splice(insertAt, 0, layer);
          return next;
        });
        setActiveLayerId(layer.id);
      }

      URL.revokeObjectURL(src);
      onImportLayerDone?.();
    };
    img.onerror = () => {
      URL.revokeObjectURL(src);
      onImportLayerDone?.();
    };
    img.src = src;
  }, [importLayerFile]);

  const handleDeleteLayer = useCallback((id: string) => {
    // If deleting the active layer while a floating selection exists, commit it first
    if (id === activeLayerId && floatingDataRef.current) {
      commitFloating();
    }
    if (cloneSourceLayerIdRef.current === id) {
      cloneSourceRef.current = null;
      cloneOffsetRef.current = null;
      cloneSourceLayerIdRef.current = null;
      cloneSourceCanvasRef.current = null;
    }
    setLayers((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((l) => l.id !== id);
      if (activeLayerId === id) setActiveLayerId(next[next.length - 1]!.id);
      return next;
    });
  }, [activeLayerId, commitFloating]);

  const handleToggleVisibility = useCallback((id: string) => {
    setLayers((prev) => {
      const layer = prev.find((l) => l.id === id);
      if (!layer) return prev;
      if (layer.name === 'Background') setBgVisible((v) => !v);
      if (layer.name === 'Mask') setMaskVisible((v) => !v);
      return prev.map((l) => l.id === id ? { ...l, visible: !l.visible } : l);
    });
    requestAnimationFrame(() => renderPreview());
  }, [renderPreview]);

  const handleSetOpacity = useCallback((id: string, opacity: number) => {
    setLayers((prev) => prev.map((l) => l.id === id ? { ...l, opacity } : l));
    // Trigger preview re-render on next frame
    requestAnimationFrame(() => renderPreview());
  }, [renderPreview]);

  const handleSetAdjustments = useCallback((id: string, updates: Partial<LayerAdjustments>) => {
    setLayers((prev) => prev.map((l) => l.id === id ? { ...l, adjustments: { ...l.adjustments, ...updates } } : l));
    requestAnimationFrame(() => renderPreview());
  }, [renderPreview]);


  const handleRenameLayer = useCallback((id: string, name: string) => {
    setLayers((prev) => prev.map((l) => l.id === id ? { ...l, name } : l));
  }, []);

  const handleReorderLayer = useCallback((fromIndex: number, toIndex: number) => {
    setLayers((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved!);
      return next;
    });
    renderPreview();
  }, [renderPreview]);

  const handleDuplicateLayer = useCallback((id: string) => {
    setLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      if (idx === -1) return prev;
      const src = prev[idx]!;
      const newCanvas = document.createElement('canvas');
      newCanvas.width = nw; newCanvas.height = nh;
      newCanvas.getContext('2d')!.drawImage(src.canvas, 0, 0);
      const newLayer: Layer = {
        id: `layer-dup-${Date.now()}`,
        name: src.name + ' copy',
        visible: src.visible,
        opacity: src.opacity,
        blendMode: src.blendMode,
        adjustments: src.adjustments ? { ...src.adjustments } : undefined,
        canvas: newCanvas,
        strokeEffect: src.strokeEffect ? { ...src.strokeEffect } : undefined,
        textData: src.textData ? { ...src.textData } : undefined,
      };
      const next = [...prev];
      next.splice(idx + 1, 0, newLayer);
      return next;
    });
    renderPreview();
  }, [nw, nh, renderPreview]);

  const handleMergeDown = useCallback((id: string) => {
    setLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      if (idx <= 0) return prev;
      const upper = prev[idx]!;
      const lower = prev[idx - 1]!;
      const ctx = lower.canvas.getContext('2d')!;
      ctx.globalAlpha = upper.opacity;
      if (upper.textData) {
        renderTextToCanvas(ctx, upper.textData);
      } else {
        ctx.drawImage(upper.canvas, 0, 0);
      }
      ctx.globalAlpha = 1;
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
    renderPreview();
    forceUpdate((n) => n + 1);
  }, [renderPreview]);

  const handleFlatten = useCallback(() => {
    setLayers((prev) => {
      if (prev.length <= 1) return prev;
      const bg = prev.find((l) => l.name === 'Background');
      if (!bg) return prev;
      const w = bg.canvas.width;
      const h = bg.canvas.height;
      const tmp = document.createElement('canvas');
      tmp.width = w; tmp.height = h;
      const tctx = tmp.getContext('2d')!;
      for (const layer of prev) {
        if (!layer.visible || layer.name === 'Mask') continue;
        tctx.globalAlpha = layer.opacity;
        tctx.filter = layerAdjustFilter(layer.adjustments);
        if (layer.textData) {
          renderTextToCanvas(tctx, layer.textData);
        } else {
          tctx.drawImage(layer.canvas, 0, 0);
        }
      }
      tctx.globalAlpha = 1;
      tctx.filter = 'none';
      const bgctx = bg.canvas.getContext('2d')!;
      bgctx.clearRect(0, 0, w, h);
      bgctx.drawImage(tmp, 0, 0);
      return prev.filter((l) => l.name === 'Background' || l.name === 'Mask');
    });
    renderPreview();
    forceUpdate((n) => n + 1);
  }, [renderPreview]);

  const handleRasterizeLayer = useCallback((id: string) => {
    setLayers((prev) => prev.map((l) => {
      if (l.id !== id || !l.textData) return l;
      const ctx = l.canvas.getContext('2d')!;
      ctx.clearRect(0, 0, nw, nh);
      renderTextToCanvas(ctx, l.textData);
      const { textData: _, ...rest } = l;
      return rest as Layer;
    }));
    renderPreview();
    forceUpdate((n) => n + 1);
  }, [nw, nh, renderPreview]);

  const handleEditTextLayer = useCallback((id: string) => {
    const layer = layersRef.current.find((l) => l.id === id);
    if (!layer?.textData) return;
    const td = layer.textData;
    // Populate text settings from layer
    setTextSettings({
      font: td.font, size: td.size, bold: td.bold,
      italic: td.italic, underline: td.underline, align: td.align,
    });
    setFgColor(td.color);
    setBrush((b) => ({ ...b, color: td.color }));
    // Set up text box and editing state
    const box = { x: td.x, y: td.y, w: td.w, h: td.h };
    textBoxRef.current = box;
    setTextBox(box);
    setEditingTextLayerId(id);
    setActiveToolRaw('text');
    setActiveLayerId(id);
    // Pre-fill textarea on next frame and refresh preview to hide rendered text
    requestAnimationFrame(() => {
      if (textAreaRef.current) {
        textAreaRef.current.innerText = td.text;
        textAreaRef.current.focus();
      }
      renderPreviewRef.current();
    });
  }, []);

  const liftSelection = useCallback(() => {
    if (floatingDataRef.current) return true; // already floating
    if (!hasSelection) return false;
    const drawCanvas = getActiveCanvas();
    if (!drawCanvas) return false;
    const ctx = drawCanvas.getContext('2d')!;
    const selCanvas = selMaskCanvasRef.current;
    if (!selCanvas) return false;

    snapshotState(true);

    // Threshold selection mask
    const selCtx = selCanvas.getContext('2d')!;
    const selData = selCtx.getImageData(0, 0, nw, nh);
    for (let i = 0; i < selData.data.length; i += 4) {
      const v = selData.data[i + 3]! > 127 ? 255 : 0;
      selData.data[i] = v; selData.data[i + 1] = v; selData.data[i + 2] = v; selData.data[i + 3] = v;
    }
    selCtx.putImageData(selData, 0, 0);

    // Find bounds
    let minX = nw, minY = nh, maxX = 0, maxY = 0;
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        if (selData.data[(y * nw + x) * 4 + 3]! > 0) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX) return false;

    const sw = maxX - minX + 1;
    const sh = maxY - minY + 1;
    selBoundsRef.current = { x: minX, y: minY, w: sw, h: sh };

    // Extract pixels
    const srcData = ctx.getImageData(minX, minY, sw, sh);
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        if (selData.data[((minY + y) * nw + (minX + x)) * 4 + 3]! === 0) {
          const i = (y * sw + x) * 4;
          srcData.data[i] = 0; srcData.data[i + 1] = 0; srcData.data[i + 2] = 0; srcData.data[i + 3] = 0;
        }
      }
    }
    floatingDataRef.current = srcData;
    transformRef.current = { scaleX: 1, scaleY: 1, rotation: 0 };

    const origMask = document.createElement('canvas');
    origMask.width = nw; origMask.height = nh;
    origMask.getContext('2d')!.drawImage(selCanvas, 0, 0);
    origSelMaskRef.current = origMask;
    moveOffsetRef.current = { x: 0, y: 0 };

    // Clear selected pixels from layer
    const layerData = ctx.getImageData(0, 0, nw, nh);
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        if (selData.data[(y * nw + x) * 4 + 3]! > 0) {
          const i = (y * nw + x) * 4;
          layerData.data[i] = 0; layerData.data[i + 1] = 0; layerData.data[i + 2] = 0; layerData.data[i + 3] = 0;
        }
      }
    }
    ctx.putImageData(layerData, 0, 0);
    renderPreview();
    return true;
  }, [hasSelection, getActiveCanvas, nw, nh, renderPreview]);

  const flipSelection = useCallback((direction: 'h' | 'v') => {
    if (!floatingDataRef.current) {
      if (!liftSelection()) return;
    }
    if (!floatingDataRef.current || !selBoundsRef.current) return;
    const fd = floatingDataRef.current;
    const w = fd.width;
    const h = fd.height;
    const flipped = new ImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const si = (y * w + x) * 4;
        const fx = direction === 'h' ? (w - 1 - x) : x;
        const fy = direction === 'v' ? (h - 1 - y) : y;
        const di = (fy * w + fx) * 4;
        flipped.data[di] = fd.data[si]!;
        flipped.data[di + 1] = fd.data[si + 1]!;
        flipped.data[di + 2] = fd.data[si + 2]!;
        flipped.data[di + 3] = fd.data[si + 3]!;
      }
    }
    floatingDataRef.current = flipped;
    renderPreview();
    forceUpdate((n) => n + 1);
  }, [renderPreview, liftSelection]);

  const alignSelection = useCallback((mode: 'center' | 'horizontal' | 'vertical') => {
    if (!floatingDataRef.current) {
      if (!liftSelection()) return;
    }
    if (!floatingDataRef.current || !selBoundsRef.current) return;
    const fd = floatingDataRef.current;
    const w = fd.width;
    const h = fd.height;

    // Find bounding box of non-transparent pixels in the floating data
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (fd.data[(y * w + x) * 4 + 3]! > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return; // no visible pixels

    // Center of the non-transparent content within the floating data
    const contentCx = (minX + maxX + 1) / 2;
    const contentCy = (minY + maxY + 1) / 2;
    // Center of the floating data (= center of selection bounds)
    const selCx = w / 2;
    const selCy = h / 2;

    // Shift the selection bounds so content lands at center
    const b = selBoundsRef.current;
    if (mode === 'center' || mode === 'horizontal') {
      b.x += Math.round(selCx - contentCx);
    }
    if (mode === 'center' || mode === 'vertical') {
      b.y += Math.round(selCy - contentCy);
    }

    renderPreview();
    forceUpdate((n) => n + 1);
  }, [renderPreview, liftSelection]);

  // --- Render ---
  const isCloneHealAltMode = altHeld && activeTool === 'brush' && brush.type === 'clone';
  const isMoveTool = activeTool === 'move' || activeTool === 'transform';
  const isCrosshairTool = activeTool === 'select-rect' || activeTool === 'select-polygon' || activeTool === 'select-wand' || activeTool === 'eyedropper' || effectiveTool === 'fill' || activeTool === 'crop' || activeTool === 'text';
  const hideCursor = activeTool === 'brush' && effectiveTool !== 'fill' && !spaceHeld && !middleHeld && !isCloneHealAltMode;
  const canvasStyle: React.CSSProperties = {
    position: 'absolute',
    left: fullX * zoom + pan.x,
    top: fullY * zoom + pan.y,
    width: fullW * zoom,
    height: fullH * zoom,
    transformOrigin: 'center center',
    transform: `rotate(${image.rotation}deg)${image.flipH ? ' scaleX(-1)' : ''}${image.flipV ? ' scaleY(-1)' : ''}`,
    imageRendering: scaleFilter === 'nearest' ? 'pixelated' : 'auto',
    pointerEvents: (spaceHeld || middleHeld) ? 'none' : 'auto',
    cursor: hideCursor ? 'none' : undefined,
  };

  return (
    <div className="paint-editor">
      {/* Left toolbar */}
      <PaintToolbar
        activeTool={activeTool}
        brush={brush}
        onToolChange={setActiveTool}
        onBrushTypeChange={(type) => setBrush((b) => ({ ...b, type }))}
        fgColor={fgColor}
        bgColor={bgColor}
        onSwapColors={() => { setFgColor(bgColor); setBgColor(fgColor); }}
        onFgColorClick={() => setColorPickerOpen((v) => !v)}
        eyedropperPreview={eyedropperPreview}
        hasSelection={hasSelection}
        activeLayerIsText={!!layersRef.current.find((l) => l.id === activeLayerId)?.textData}
      />

      {/* Full-viewport interaction layer — allows starting strokes from outside the image */}
      <div
        className="paint-interaction-layer"
        style={{
          position: 'fixed', inset: 0, zIndex: 999995,
          pointerEvents: (spaceHeld || middleHeld || paintContextMenu) ? 'none' : 'auto',
          cursor: isMoveTool ? (transformHoverCursor ?? 'move') : isCrosshairTool ? 'crosshair' : isCloneHealAltMode ? 'crosshair' : hideCursor ? 'none' : undefined,
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setPaintContextMenu({ x: e.clientX, y: e.clientY });
        }}
        onDoubleClick={(e) => {
          if (activeTool !== 'text') return;
          const layer = layersRef.current.find((l) => l.id === activeLayerId);
          if (!layer?.textData || editingTextLayerIdRef.current) return;
          const pt = screenToMask(e.clientX, e.clientY);
          if (!pt) return;
          const td = layer.textData;
          if (pt.x >= td.x && pt.x <= td.x + td.w && pt.y >= td.y && pt.y <= td.y + td.h) {
            handleEditTextLayer(layer.id);
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={(e) => {
          const el = brushCursorRef.current;
          if (el && !isCloneHealAltMode) {
            if (pixelSnap) {
              // Snap cursor to pixel grid
              const pt = screenToMask(e.clientX, e.clientY);
              if (pt) {
                const s = brush.size;
                const snappedX = Math.floor(pt.x - s / 2) + s / 2;
                const snappedY = Math.floor(pt.y - s / 2) + s / 2;
                // Convert back to screen (simplified for no rotation)
                const rad = (image.rotation * Math.PI) / 180;
                const cosR = Math.cos(rad);
                const sinR = Math.sin(rad);
                const screenCx = (fullX + fullW / 2) * zoom + pan.x;
                const screenCy = (fullY + fullH / 2) * zoom + pan.y;
                let lx = (snappedX * ds - fullW / 2) * zoom;
                let ly = (snappedY * ds - fullH / 2) * zoom;
                if (image.flipH) lx = -lx;
                if (image.flipV) ly = -ly;
                el.style.left = (screenCx + lx * cosR - ly * sinR) + 'px';
                el.style.top = (screenCy + lx * sinR + ly * cosR) + 'px';
              }
            } else {
              el.style.left = e.clientX + 'px';
              el.style.top = e.clientY + 'px';
            }
            el.style.display = 'block';
          }
          else if (el && isCloneHealAltMode) { el.style.display = 'none'; }
          // Update clone/heal source crosshair position when offset is locked
          if (cloneOffsetRef.current && brush.type === 'clone') {
            const pt = screenToMask(e.clientX, e.clientY);
            if (pt) {
              cloneSourceRef.current = {
                x: pt.x + cloneOffsetRef.current.x,
                y: pt.y + cloneOffsetRef.current.y,
              };
            }
          }
          // Update transform handle hover cursor
          if (isMoveTool && !drawingRef.current && activeTool === 'transform' && floatingDataRef.current && selBoundsRef.current) {
            const pt = screenToMask(e.clientX, e.clientY);
            if (pt) {
              const handles = getTransformHandles(selBoundsRef.current, transformRef.current, ds * zoom);
              const hitRadius = 12 / (ds * zoom);
              const rot = transformRef.current.rotation;
              // Check rotation handle
              const rdx = pt.x - handles.rotHandle[0];
              const rdy = pt.y - handles.rotHandle[1];
              if (Math.sqrt(rdx * rdx + rdy * rdy) < hitRadius) {
                setTransformHoverCursor('grab');
              } else {
                // Check resize handles
                const handleNames = ['tl', 'tr', 'br', 'bl', 't', 'r', 'b', 'l'] as const;
                const handlePts = [
                  handles.corners.tl, handles.corners.tr, handles.corners.br, handles.corners.bl,
                  handles.edges.t, handles.edges.r, handles.edges.b, handles.edges.l,
                ];
                let found = false;
                for (let i = 0; i < handlePts.length; i++) {
                  const hx = handlePts[i]![0] - pt.x;
                  const hy = handlePts[i]![1] - pt.y;
                  if (Math.sqrt(hx * hx + hy * hy) < hitRadius) {
                    setTransformHoverCursor(getHandleCursor(handleNames[i]!, rot));
                    found = true;
                    break;
                  }
                }
                if (!found) setTransformHoverCursor(null);
              }
            }
          } else if (isMoveTool && transformHoverCursor) {
            setTransformHoverCursor(null);
          }
          handlePointerMove(e);
        }}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => { const el = brushCursorRef.current; if (el) el.style.display = 'none'; }}
      />

      {/* Canvas area */}
      <canvas ref={maskCanvasRef} style={{ display: 'none' }} />
      <canvas
        ref={displayCanvasRef}
        style={{ ...canvasStyle, pointerEvents: 'none' }}
        className="mask-display-canvas"
      />
      {/* Text tool overlay */}
      {textBox && activeTool === 'text' && (() => {
        const scaleX = (fullW * zoom) / nw;
        const scaleY = (fullH * zoom) / nh;
        const originX = fullX * zoom + pan.x;
        const originY = fullY * zoom + pan.y;
        const bx = originX + textBox.x * scaleX;
        const by = originY + textBox.y * scaleY;
        const bw = textBox.w * scaleX;
        const bh = textBox.h * scaleY;
        const scale = Math.min(scaleX, scaleY);
        const fontSize = textSettings.size * scale;
        const scaledPadding = 2 * scale;
        const editLayer = editingTextLayerId ? layersRef.current.find((l) => l.id === editingTextLayerId) : null;
        const textRotation = editLayer?.textData?.rotation ?? 0;
        // Resize the live text box from its handles (image-space coords)
        const startBoxResize = (e: React.PointerEvent, mode: string) => {
          e.preventDefault();
          e.stopPropagation();
          const start = textBoxRef.current;
          if (!start) return;
          const s = { ...start };
          const sx = e.clientX, sy = e.clientY;
          const MIN = 16;
          const onMove = (ev: PointerEvent) => {
            const dx = (ev.clientX - sx) / scaleX;
            const dy = (ev.clientY - sy) / scaleY;
            let { x, y, w, h } = s;
            if (mode.includes('e')) w = Math.max(MIN, s.w + dx);
            if (mode.includes('s')) h = Math.max(MIN, s.h + dy);
            if (mode.includes('w')) { const nw2 = Math.max(MIN, s.w - dx); x = s.x + (s.w - nw2); w = nw2; }
            if (mode.includes('n')) { const nh2 = Math.max(MIN, s.h - dy); y = s.y + (s.h - nh2); h = nh2; }
            const nb = { x, y, w, h };
            textBoxRef.current = nb;
            setTextBox(nb);
          };
          const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
          };
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
        };
        const HANDLES: { mode: string; cursor: string; style: React.CSSProperties }[] = [
          { mode: 'nw', cursor: 'nwse-resize', style: { left: -5, top: -5 } },
          { mode: 'n', cursor: 'ns-resize', style: { left: '50%', top: -5, transform: 'translateX(-50%)' } },
          { mode: 'ne', cursor: 'nesw-resize', style: { right: -5, top: -5 } },
          { mode: 'e', cursor: 'ew-resize', style: { right: -5, top: '50%', transform: 'translateY(-50%)' } },
          { mode: 'se', cursor: 'nwse-resize', style: { right: -5, bottom: -5 } },
          { mode: 's', cursor: 'ns-resize', style: { left: '50%', bottom: -5, transform: 'translateX(-50%)' } },
          { mode: 'sw', cursor: 'nesw-resize', style: { left: -5, bottom: -5 } },
          { mode: 'w', cursor: 'ew-resize', style: { left: -5, top: '50%', transform: 'translateY(-50%)' } },
        ];
        return (
          <div
            className="paint-text-overlay"
            style={{
              position: 'absolute',
              left: bx,
              top: by,
              width: bw,
              height: bh,
              zIndex: 999997,
              pointerEvents: 'auto',
              transformOrigin: 'center center',
              transform: textRotation ? `rotate(${textRotation}deg)` : undefined,
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div
              ref={textAreaRef}
              className="paint-text-input"
              contentEditable
              suppressContentEditableWarning
              style={{
                width: '100%',
                minHeight: '100%',
                fontFamily: `"${textSettings.font}"`,
                fontSize: `${fontSize}px`,
                fontWeight: textSettings.bold ? 'bold' : 'normal',
                fontStyle: textSettings.italic ? 'italic' : 'normal',
                textDecoration: textSettings.underline ? 'underline' : 'none',
                textAlign: textSettings.align,
                color: fgColor,
                caretColor: fgColor,
                padding: scaledPadding,
                lineHeight: 1.2,
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape') {
                  textBoxRef.current = null;
                  setTextBox(null);
                  if (textAreaRef.current) textAreaRef.current.innerText = '';
                }
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  commitTextBox();
                }
              }}
            />
            {HANDLES.map((h) => (
              <div
                key={h.mode}
                className="paint-text-handle"
                style={{ ...h.style, cursor: h.cursor }}
                onPointerDown={(e) => startBoxResize(e, h.mode)}
              />
            ))}
          </div>
        );
      })()}

      <canvas
        ref={overlayCanvasRef}
        className="mask-overlay-canvas"
        style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 999998 }}
      />

      {/* Left panels container — layers + properties stacked */}
      <div className="paint-left-panels">
        <LayerPanel
            layers={layers}
            activeLayerId={activeLayerId}
            onSelectLayer={setActiveLayerId}
            onToggleVisibility={handleToggleVisibility}
            onSetOpacity={handleSetOpacity}
            onSetBlendMode={(id, blendMode) => {
              setLayers((prev) => prev.map((l) => l.id === id ? { ...l, blendMode } : l));
              renderPreviewRef.current();
            }}
            onAddLayer={handleAddLayer}
            onDeleteLayer={handleDeleteLayer}
            onRenameLayer={handleRenameLayer}
            onReorderLayer={handleReorderLayer}
            onDuplicateLayer={handleDuplicateLayer}
            onMergeDown={handleMergeDown}
            onFlatten={handleFlatten}
            onSelectLayerContents={selectLayerContents}
            onRasterizeLayer={handleRasterizeLayer}
            onEditTextLayer={handleEditTextLayer}
            showCheckerboard={showCheckerboard}
            onToggleCheckerboard={() => { setShowCheckerboard((v) => { const next = !v; onHideSource?.(!next); return next; }); }}
            maskHasContent={(() => {
              const mc = maskCanvasRef.current;
              if (!mc) return false;
              const d = mc.getContext('2d')!.getImageData(0, 0, mc.width, mc.height).data;
              for (let i = 3; i < d.length; i += 4) {
                if (d[i]! < 255) return true;
              }
              return false;
            })()}
            onClearMask={() => {
              const mc = maskCanvasRef.current;
              if (!mc) return;
              snapshotState(true);
              const ctx = mc.getContext('2d')!;
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, mc.width, mc.height);
              renderPreviewRef.current();
              forceUpdate((n) => n + 1);
            }}
          />

        <ToolOptionsBar
          activeTool={activeTool}
          brush={brush}
          onBrushChange={(b) => setBrush(b)}
          maxBrushSize={Math.max(nw, nh)}
          wandSettings={wandSettings}
          onWandSettingsChange={setWandSettings}
          pixelSnap={pixelSnap}
          onPixelSnapChange={setPixelSnap}
          onInvert={handleInvert}
          hasSelection={hasSelection}
          onFillSelection={handleFillSelection}
          onClearSelection={clearSelection}
          onInvertSelection={invertSelection}
          onFlipSelectionH={() => flipSelection('h')}
          onFlipSelectionV={() => flipSelection('v')}
          onAlignSelectionCenter={() => alignSelection('center')}
          onAlignSelectionH={() => alignSelection('horizontal')}
          onAlignSelectionV={() => alignSelection('vertical')}
          onGrowShrinkSelection={growShrinkSelection}
          activeLayerName={layers.find((l) => l.id === activeLayerId)?.name}
          activeLayerIsText={!!layers.find((l) => l.id === activeLayerId)?.textData}
          strokeEffect={layers.find((l) => l.id === activeLayerId)?.strokeEffect}
          layerAdjustments={layers.find((l) => l.id === activeLayerId)?.adjustments}
          onLayerAdjustmentsChange={(updates) => handleSetAdjustments(activeLayerId, updates)}
          onStrokeEffectChange={(effect) => {
            if (editingTextLayerIdRef.current) commitTextBoxRef.current();
            setLayers((prev) => prev.map((l) =>
              l.id === activeLayerId ? { ...l, strokeEffect: effect } : l,
            ));
            renderPreview();
          }}
          onApplyStrokeEffect={() => {
            const layer = layersRef.current.find((l) => l.id === activeLayerId);
            if (!layer?.strokeEffect?.enabled) return;
            const strokeCanvas = renderStrokeEffect(layer.canvas, layer.strokeEffect, nw, nh);
            if (strokeCanvas) {
              const ctx = layer.canvas.getContext('2d')!;
              ctx.drawImage(strokeCanvas, 0, 0);
            }
            setLayers((prev) => prev.map((l) =>
              l.id === activeLayerId ? { ...l, strokeEffect: undefined } : l,
            ));
            renderPreview();
          }}
          onPickStrokeColor={() => {
            prevToolRef.current = activeTool;
            strokeEyedropperRef.current = true;
            setActiveToolRaw('eyedropper');
          }}
          cloneSourceMode={cloneSourceMode}
          onCloneSourceModeChange={setCloneSourceMode}
          onOpenStrokeColorWheel={() => {
            setColorPickerOpen(false);
            setStrokeColorPickerOpen(true);
          }}
          onCropConfirm={() => {
            if (onCropChange) {
              const cr = cropRect;
              if (cr && Math.round(cr.x) === 0 && Math.round(cr.y) === 0 && Math.round(cr.w) >= nw && Math.round(cr.h) >= nh) {
                onCropChange(null);
              } else {
                onCropChange(cr ? { x: Math.round(cr.x), y: Math.round(cr.y), w: Math.round(cr.w), h: Math.round(cr.h) } : null);
              }
            }
            setActiveToolRaw('select-rect');
          }}
          onCropCancel={() => {
            setCropRect(image.cropRect ? { ...image.cropRect } : null);
            setActiveToolRaw('select-rect');
          }}
          onCropRemove={() => {
            setCropRect(null);
            if (onCropChange) onCropChange(null);
          }}
          onCropReset={() => {
            setCropRect(initialCropRef.current ? { ...initialCropRef.current } : null);
          }}
          hasCrop={!!cropRect}
          hasCropChanged={(() => {
            const init = initialCropRef.current;
            const cur = cropRect;
            if (!init && !cur) return false;
            if (!init || !cur) return true;
            return Math.round(init.x) !== Math.round(cur.x) || Math.round(init.y) !== Math.round(cur.y) || Math.round(init.w) !== Math.round(cur.w) || Math.round(init.h) !== Math.round(cur.h);
          })()}
          textSettings={textSettings}
          onTextSettingsChange={updateTextSettings}
          textFonts={[...getAvailableFonts(), ...GOOGLE_FONTS.filter((f) => !getAvailableFonts().includes(f))]}
          textSizes={TEXT_SIZES}
          hasTextBox={!!textBox}
          onCommitText={commitTextBox}
        />
      </div>

      {/* Brush cursor — matches actual painted size (mouse pressure 0.5 → 0.75 multiplier) */}
      {activeTool === 'brush' && effectiveTool !== 'fill' && (() => {
        const pressureScale = pixelSnap ? 1 : (0.5 * 0.5 + 0.5);
        const cursorSize = brush.size * pressureScale * ds * zoom;
        const isRound = brush.shape === 'circle';
        const isOval = brush.shape === 'oval';
        const usePixelCursor = pixelSnap && (isRound || isOval) && brush.size >= 2;

        if (usePixelCursor) {
          // Build a grid of which pixels are filled
          const s = brush.size;
          const r = s / 2;
          const grid: boolean[][] = [];
          for (let y = 0; y < s; y++) {
            grid[y] = [];
            for (let x = 0; x < s; x++) {
              const dx = x + 0.5 - r;
              const dy = y + 0.5 - r;
              if (isOval) {
                const ndx = dx / (r * 0.6);
                const ndy = dy / r;
                grid[y]![x] = ndx * ndx + ndy * ndy <= 1;
              } else {
                grid[y]![x] = dx * dx + dy * dy <= r * r;
              }
            }
          }
          // Collect outline segments: edges between filled and empty pixels
          const cellSize = cursorSize / s;
          const lines: string[] = [];
          for (let y = 0; y < s; y++) {
            for (let x = 0; x < s; x++) {
              if (!grid[y]![x]) continue;
              const cx = x * cellSize;
              const cy = y * cellSize;
              const cs = cellSize;
              // Top edge
              if (y === 0 || !grid[y - 1]![x]) lines.push(`M${cx},${cy}H${cx + cs}`);
              // Bottom edge
              if (y === s - 1 || !grid[y + 1]![x]) lines.push(`M${cx},${cy + cs}H${cx + cs}`);
              // Left edge
              if (x === 0 || !grid[y]![x - 1]) lines.push(`M${cx},${cy}V${cy + cs}`);
              // Right edge
              if (x === s - 1 || !grid[y]![x + 1]) lines.push(`M${cx + cs},${cy}V${cy + cs}`);
            }
          }
          return (
            <svg
              ref={brushCursorRef as any}
              className="paint-brush-cursor paint-brush-cursor-pixel"
              style={{ display: 'none', width: cursorSize, height: cursorSize }}
              viewBox={`0 0 ${cursorSize} ${cursorSize}`}
            >
              <path d={lines.join('')} stroke="rgba(0,0,0,0.5)" strokeWidth="1.5" fill="none" />
              <path d={lines.join('')} stroke="rgba(255,255,255,0.8)" strokeWidth="0.75" fill="none" />
            </svg>
          );
        }

        return (
          <div
            ref={brushCursorRef}
            className="paint-brush-cursor"
            style={{
              display: 'none',
              width: isOval ? cursorSize * 0.6 : cursorSize,
              height: cursorSize,
              borderRadius: (isRound || isOval) ? '50%' : '0',
            }}
          />
        );
      })()}

      {/* Color picker */}
      {colorPickerOpen && (
        <ColorPicker
          color={fgColor}
          onChange={(c) => {
            setFgColor(c);
            setBrush((b) => ({ ...b, color: c }));
            // Update active text layer color when text tool is selected
            if (activeTool === 'text') {
              const activeLayer = layersRef.current.find((l) => l.id === activeLayerId);
              if (activeLayer?.textData) {
                setLayers((prev) => prev.map((l) =>
                  l.id === activeLayerId && l.textData ? { ...l, textData: { ...l.textData, color: c } } : l,
                ));
                renderPreview();
              }
            }
          }}
          onClose={() => setColorPickerOpen(false)}
          recentColors={recentColors}
          onAddRecentColor={addRecentColor}
        />
      )}

      {strokeColorPickerOpen && (() => {
        const layer = layers.find((l) => l.id === activeLayerId);
        const strokeColor = layer?.strokeEffect?.color ?? '#000000';
        return (
          <ColorPicker
            color={strokeColor}
            onChange={(c) => {
              setLayers((prev) => prev.map((l) =>
                l.id === activeLayerId && l.strokeEffect ? { ...l, strokeEffect: { ...l.strokeEffect, color: c } } : l,
              ));
              renderPreview();
            }}
            onClose={() => setStrokeColorPickerOpen(false)}
            recentColors={recentColors}
            onAddRecentColor={addRecentColor}
          />
        );
      })()}

      {/* Paint editor context menu */}
      {paintContextMenu && (
        <PaintContextMenu
          x={paintContextMenu.x}
          y={paintContextMenu.y}
          pixelSnap={pixelSnap}
          onTogglePixelSnap={() => setPixelSnap((v) => !v)}
          onSelectLayerContents={selectLayerContents}
          hasSelection={hasSelection}
          onInvertSelection={invertSelection}
          onTransformSelection={() => setActiveToolRaw('transform')}
          hasCrop={!!cropRect}
          onRemoveCrop={() => { setCropRect(null); if (onCropChange) onCropChange(null); }}
          onClose={() => setPaintContextMenu(null)}
        />
      )}
    </div>
  );
}

/* ── Paint Context Menu ──────────────────────────────────────────────── */

function PaintContextMenu({
  x, y, pixelSnap, onTogglePixelSnap, onSelectLayerContents, hasSelection, onInvertSelection, onTransformSelection, hasCrop, onRemoveCrop, onClose,
}: {
  x: number;
  y: number;
  pixelSnap: boolean;
  onTogglePixelSnap: () => void;
  onSelectLayerContents: () => void;
  hasSelection: boolean;
  onInvertSelection: () => void;
  onTransformSelection: () => void;
  hasCrop: boolean;
  onRemoveCrop: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('pointerdown', handleClick, true);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handleClick, true);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const [pos, setPos] = useState({ x, y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    let nx = x, ny = y;
    if (nx + rect.width > window.innerWidth - pad) nx = window.innerWidth - rect.width - pad;
    if (ny + rect.height > window.innerHeight - pad) ny = window.innerHeight - rect.height - pad;
    if (nx < pad) nx = pad;
    if (ny < pad) ny = pad;
    setPos({ x: nx, y: ny });
  }, [x, y]);

  return createPortal(
    <div
      ref={ref}
      className="context-menu"
      style={{ left: pos.x, top: pos.y, zIndex: 9999999 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        className="context-menu-item"
        onClick={() => { onSelectLayerContents(); onClose(); }}
      >
        Select Layer Contents
      </button>
      <button
        className={`context-menu-item${!hasSelection ? ' context-menu-item-disabled' : ''}`}
        disabled={!hasSelection}
        onClick={() => { onTransformSelection(); onClose(); }}
      >
        Transform Selection
      </button>
      <button
        className={`context-menu-item${!hasSelection ? ' context-menu-item-disabled' : ''}`}
        disabled={!hasSelection}
        onClick={() => { onInvertSelection(); onClose(); }}
      >
        Invert Selection
      </button>
      <div className="context-menu-separator" />
      <button
        className={`context-menu-item${!hasCrop ? ' context-menu-item-disabled' : ''}`}
        disabled={!hasCrop}
        onClick={() => { onRemoveCrop(); onClose(); }}
      >
        Remove Crop
      </button>
      <div className="context-menu-separator" />
      <button
        className="context-menu-item"
        onClick={() => { onTogglePixelSnap(); onClose(); }}
      >
        {pixelSnap ? '\u2713 ' : ''}Pixel Snapping
      </button>
    </div>,
    document.body,
  );
}
