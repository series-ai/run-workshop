export interface Point {
  x: number;
  y: number;
  pressure: number;
}

/**
 * Brush types available in the paint editor.
 * 'reveal' and 'hide' are mask-specific (white channel paint/erase).
 */
export type BrushType = 'pencil' | 'eraser' | 'fill' | 'smudge' | 'clone' | 'heal' | 'reveal' | 'hide';

export type ToolType = 'brush' | 'select-rect' | 'select-polygon' | 'select-wand' | 'eyedropper' | 'move' | 'transform' | 'crop' | 'text';

export interface TextSettings {
  font: string;
  size: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: 'left' | 'center' | 'right';
}

export type BrushShape = 'circle' | 'oval' | 'square';

export interface BrushSettings {
  type: BrushType;
  color: string;
  size: number;
  opacity: number;
  hardness: number; // 0 = soft, 1 = hard
  spacing: number; // 0.05 to 2.0 — fraction of brush size between stamps
  shape: BrushShape;
}

export interface WandSettings {
  tolerance: number; // 0–255
  spread: number;    // -20 to +20 pixels
  contiguous: boolean;
}

export interface SelectionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Selection {
  bounds: SelectionRect;
  polygon?: Point[];
  mask?: HTMLCanvasElement;
}

export type StrokePosition = 'inside' | 'center' | 'outside';

export interface StrokeEffect {
  enabled: boolean;
  color: string;
  thickness: number;   // px
  opacity: number;     // 0–1
  position: StrokePosition;
}

export interface TextLayerData {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  font: string;
  size: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: 'left' | 'center' | 'right';
  color: string;
  rotation?: number;
}

export type BlendMode =
  | 'source-over'    // Normal
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

export const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: 'source-over', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'hard-light', label: 'Hard Light' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
  { value: 'hue', label: 'Hue' },
  { value: 'saturation', label: 'Saturation' },
  { value: 'color', label: 'Color' },
  { value: 'luminosity', label: 'Luminosity' },
];

/** Per-layer non-destructive adjustments (CSS/canvas filter compatible). */
export interface LayerAdjustments {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  hue?: number;
}

/** Canvas filter string for a layer's adjustments — 'none' when default. */
export function layerAdjustFilter(adj: LayerAdjustments | undefined): string {
  if (!adj) return 'none';
  const b = adj.brightness ?? 1;
  const c = adj.contrast ?? 1;
  const s = adj.saturation ?? 1;
  const h = adj.hue ?? 0;
  if (b === 1 && c === 1 && s === 1 && h === 0) return 'none';
  return `brightness(${b}) contrast(${c}) saturate(${s}) hue-rotate(${h}deg)`;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  canvas: HTMLCanvasElement;
  strokeEffect?: StrokeEffect;
  textData?: TextLayerData;
  adjustments?: LayerAdjustments;
}

export interface HistoryEntry {
  layerSnapshots: Map<string, ImageData>;
}

export const BRUSH_SIZES = [2, 6, 14, 28, 50, 80, 120, 200];

export const DEFAULT_BRUSH: BrushSettings = {
  type: 'pencil',
  color: '#ffffff',
  size: 28,
  opacity: 1,
  hardness: 1,
  spacing: 0.15,
  shape: 'circle',
};
