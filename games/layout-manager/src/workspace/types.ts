export interface SavedPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface ImageNode {
  id: string;
  src: string;
  fileName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  opacity: number;
  spriteName: string;
  cropRect?: { x: number; y: number; w: number; h: number };
  maskDataUrl?: string | null;
  /** Serialized paint layers for the paint editor (array of { name, dataUrl, visible, opacity }) */
  paintLayers?: { name: string; dataUrl: string; visible: boolean; opacity: number; blendMode?: string; strokeEffect?: { enabled: boolean; color: string; thickness: number; opacity: number; position: string }; textData?: { text: string; x: number; y: number; w: number; h: number; font: string; size: number; bold: boolean; italic: boolean; underline: boolean; align: 'left' | 'center' | 'right'; color: string; rotation?: number }; adjustments?: { brightness?: number; contrast?: number; saturation?: number; hue?: number } }[] | null;
  /** Composited paint overlay (paint layers above mask, flattened) for workspace display */
  paintOverlayUrl?: string | null;
  /** Composited paint underlay (paint layers below mask, flattened) — gets CSS mask applied like background */
  paintUnderlayUrl?: string | null;
  /** Full composite (bg + layers with blend modes + mask) — used when blend modes are present */
  paintCompositeUrl?: string | null;
  parentId: string | null;
  /** Where the child lives on the sprite sheet (its resting/packed position). */
  basePosition: SavedPosition | null;
  /** Where the child goes when dressed on the parent (overlaid position). */
  offsetPosition: SavedPosition | null;
  layerOrder: 'above' | 'below';
  /** When true, using this child hides the parent. */
  replacesParent: boolean;
  flipH: boolean;
  flipV: boolean;
  /** Optional flat background color drawn behind the image — fills transparent regions on save/export */
  bgColor?: string | null;
  /** Node type — undefined or 'image' for image nodes, 'text' for text nodes */
  nodeType?: 'image' | 'text';
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontBold?: boolean;
  fontItalic?: boolean;
  fontUnderline?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  textColor?: string;
  /** When true, text node width auto-expands to fit content. Set to false when the user manually resizes. */
  textAutoWidth?: boolean;
  /** Prompts captured at generation time (ComfyUI / T2I / I2I). Each entry is a labeled text the user can copy. */
  prompts?: { title: string; text: string }[];
  /* ── Non-destructive image adjustments (CSS-filter compatible) ── */
  /** Brightness multiplier — 1 = unchanged */
  brightness?: number;
  /** Contrast multiplier — 1 = unchanged */
  contrast?: number;
  /** Saturation multiplier — 1 = unchanged, 0 = grayscale */
  saturation?: number;
  /** Hue rotation in degrees — 0 = unchanged */
  hue?: number;
}

/** CSS/canvas filter string for a node's adjustments, or undefined when all are default. */
export function adjustmentsFilter(img: Pick<ImageNode, 'brightness' | 'contrast' | 'saturation' | 'hue'>): string | undefined {
  const b = img.brightness ?? 1;
  const c = img.contrast ?? 1;
  const s = img.saturation ?? 1;
  const h = img.hue ?? 0;
  if (b === 1 && c === 1 && s === 1 && h === 0) return undefined;
  return `brightness(${b}) contrast(${c}) saturate(${s}) hue-rotate(${h}deg)`;
}

export interface CanvasRect {
  width: number;
  height: number;
}

export type ScaleFilter = 'bicubic' | 'nearest';

export interface WorkspaceState {
  images: ImageNode[];
  selectedIds: Set<string>;
  lastSelectedId: string | null;
  pan: { x: number; y: number };
  zoom: number;
  canvas: CanvasRect | null;
  scaleFilter: ScaleFilter;
  snapEnabled: boolean;
  projectName: string | null;
  guides: RulerGuide[];
  canvasBgColor: string | null;
}

export interface ProjectFile {
  version: 1;
  images: (Omit<ImageNode, 'src'> & { dataUrl: string })[];
  pan: { x: number; y: number };
  zoom: number;
  canvas?: CanvasRect | null;
  scaleFilter?: ScaleFilter;
  snapEnabled?: boolean;
  guides?: RulerGuide[];
  canvasBgColor?: string | null;
}

export type WorkspaceAction =
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SNAPSHOT' }
  | { type: 'LOAD_PROJECT'; images: ImageNode[]; pan: { x: number; y: number }; zoom: number; canvas?: CanvasRect | null; scaleFilter?: ScaleFilter; snapEnabled?: boolean; projectName?: string | null; guides?: RulerGuide[]; canvasBgColor?: string | null }
  | { type: 'SET_PROJECT_NAME'; name: string | null }
  | { type: 'NEW_PROJECT' }
  | { type: 'ADD_IMAGE'; image: ImageNode }
  | { type: 'ADD_IMAGES'; images: ImageNode[] }
  | { type: 'REMOVE_IMAGES'; ids: string[] }
  | { type: 'MOVE_IMAGES'; ids: string[]; dx: number; dy: number }
  | { type: 'RESIZE_IMAGE'; id: string; width: number; height: number; x: number; y: number }
  | { type: 'ROTATE_IMAGE'; id: string; rotation: number }
  | { type: 'SELECT'; id: string; additive: boolean }
  | { type: 'SELECT_NONE' }
  | { type: 'SET_PAN'; pan: { x: number; y: number } }
  | { type: 'SET_ZOOM'; zoom: number; pan: { x: number; y: number } }
  | { type: 'SELECT_ALL' }
  | { type: 'SELECT_MULTIPLE'; ids: string[]; additive: boolean }
  | { type: 'ORIGINAL_SCALE' }
  | { type: 'ORIGINAL_SCALE_SELECTION'; ids: string[] }
  | { type: 'RESIZE_SELECTION'; ids: string[]; scaleX: number; scaleY: number; scaleTogether?: boolean }
  | { type: 'NORMALIZE_SCALE'; targetHeight: number }
  | { type: 'SCALE_SELECTION_TO_LARGEST'; ids: string[] }
  | { type: 'SCALE_SELECTION_TO_SMALLEST'; ids: string[] }
  | { type: 'NORMALIZE_SELECTION'; ids: string[]; targetHeight: number }
  | { type: 'ALIGN'; direction: 'top' | 'bottom' | 'left' | 'right'; ids: string[]; padding?: number }
  | { type: 'DISTRIBUTE_GAPS'; ids: string[]; gap: number }
  | { type: 'ARRANGE_GRID'; ids: string[] }
  | { type: 'ARRANGE_STRIP'; ids: string[] }
  | { type: 'ARRANGE_LIST'; ids: string[] }
  | { type: 'BRING_TO_FRONT'; id: string }
  | { type: 'SEND_TO_BACK'; id: string }
  | { type: 'BRING_FORWARD'; id: string }
  | { type: 'SEND_BACKWARD'; id: string }
  | { type: 'SCALE_GROUP'; ids: string[]; scaleX: number; scaleY: number; originX: number; originY: number }
  | { type: 'ROTATE_GROUP'; ids: string[]; deltaRotation: number; originX: number; originY: number }
  | { type: 'SET_CANVAS'; canvas: CanvasRect | null }
  | { type: 'MAKE_CANVAS_FROM_SELECTION'; ids: string[] }
  | { type: 'SET_SCALE_FILTER'; filter: ScaleFilter }
  | { type: 'SET_SNAP'; enabled: boolean }
  | { type: 'SPLIT_IMAGE'; originalId: string; pieces: ImageNode[] }
  | { type: 'TOGGLE_LOCK'; ids: string[] }
  | { type: 'SET_OPACITY'; ids: string[]; opacity: number }
  | { type: 'RENAME_IMAGE'; id: string; spriteName: string }
  | { type: 'SET_CROP'; id: string; cropRect: { x: number; y: number; w: number; h: number } | undefined; width: number; height: number; x: number; y: number }
  | { type: 'SET_CROP_RECT'; id: string; cropRect: { x: number; y: number; w: number; h: number } | undefined }
  | { type: 'REPLACE_SOURCE'; ids: string[]; src: string; fileName: string; naturalWidth: number; naturalHeight: number }
  | { type: 'BAKE_IMAGE'; id: string; src: string; naturalWidth: number; naturalHeight: number }
  | { type: 'DUPLICATE_IMAGES'; ids: string[] }
  | { type: 'SET_MASK'; id: string; maskDataUrl: string | null }
  | { type: 'SET_IMAGE_SRC'; id: string; src: string }
  | { type: 'SET_PAINT_LAYERS'; id: string; paintLayers: { name: string; dataUrl: string; visible: boolean; opacity: number; blendMode?: string; strokeEffect?: { enabled: boolean; color: string; thickness: number; opacity: number; position: string }; textData?: { text: string; x: number; y: number; w: number; h: number; font: string; size: number; bold: boolean; italic: boolean; underline: boolean; align: 'left' | 'center' | 'right'; color: string; rotation?: number }; adjustments?: { brightness?: number; contrast?: number; saturation?: number; hue?: number } }[] | null; paintOverlayUrl: string | null; paintUnderlayUrl: string | null; paintCompositeUrl: string | null }
  | { type: 'ATTACH_TO_PARENT'; childId: string; parentId: string }
  | { type: 'DETACH_FROM_PARENT'; childId: string }
  | { type: 'SET_LAYER_ORDER'; id: string; layerOrder: 'above' | 'below' }
  | { type: 'SET_BASE_POSITION'; id: string }
  | { type: 'SET_OFFSET_POSITION'; id: string }
  | { type: 'GOTO_BASE_POSITION'; id: string }
  | { type: 'GOTO_OFFSET_POSITION'; id: string }
  | { type: 'SET_REPLACES_PARENT'; id: string; replaces: boolean }
  | { type: 'ADD_GUIDE'; guide: RulerGuide }
  | { type: 'MOVE_GUIDE'; id: string; position: number }
  | { type: 'REMOVE_GUIDE'; id: string }
  | { type: 'CLEAR_GUIDES' }
  | { type: 'SET_CANVAS_BG_COLOR'; color: string | null }
  | { type: 'FLIP_IMAGES'; ids: string[]; axis: 'h' | 'v' }
  | { type: 'SET_BG_COLOR'; ids: string[]; color: string | null }
  | { type: 'UPDATE_TEXT'; id: string; updates: Partial<Pick<ImageNode, 'text' | 'fontFamily' | 'fontSize' | 'fontBold' | 'fontItalic' | 'fontUnderline' | 'textAlign' | 'textColor' | 'textAutoWidth'>> }
  | { type: 'SET_ADJUSTMENTS'; ids: string[]; updates: Partial<Pick<ImageNode, 'brightness' | 'contrast' | 'saturation' | 'hue'>> }
  | { type: 'CLEAR_HISTORY' };

export interface SnapGuide {
  axis: 'x' | 'y';
  position: number;
}

export interface RulerGuide {
  id: string;
  axis: 'x' | 'y';
  /** Position in workspace coordinates */
  position: number;
}

export interface ContextMenuState {
  x: number;
  y: number;
  imageId: string;
}
