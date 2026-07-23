import { useState, useRef, useCallback } from 'react';
import { FlipHorizontal2, FlipVertical2, Pipette, Grid2X2, Circle, Square, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import type { BrushSettings, ToolType, WandSettings, StrokeEffect, StrokePosition, TextSettings, LayerAdjustments } from './types';
import { layerAdjustFilter } from './types';

interface ToolOptionsBarProps {
  activeTool: ToolType;
  brush: BrushSettings;
  onBrushChange: (brush: BrushSettings) => void;
  maxBrushSize: number;
  wandSettings: WandSettings;
  onWandSettingsChange: (settings: WandSettings) => void;
  pixelSnap: boolean;
  onPixelSnapChange: (v: boolean) => void;
  onInvert: () => void;
  hasSelection: boolean;
  onFillSelection: (mode: 'hide' | 'reveal') => void;
  onClearSelection: () => void;
  onInvertSelection: () => void;
  onFlipSelectionH?: () => void;
  onFlipSelectionV?: () => void;
  onAlignSelectionCenter?: () => void;
  onAlignSelectionH?: () => void;
  onAlignSelectionV?: () => void;
  onGrowShrinkSelection?: (amount: number) => void;
  strokeEffect?: StrokeEffect;
  onStrokeEffectChange?: (effect: StrokeEffect) => void;
  layerAdjustments?: LayerAdjustments;
  onLayerAdjustmentsChange?: (updates: Partial<LayerAdjustments>) => void;
  onApplyStrokeEffect?: () => void;
  onPickStrokeColor?: () => void;
  onOpenStrokeColorWheel?: () => void;
  cloneSourceMode?: 'canvas' | 'layer';
  onCloneSourceModeChange?: (mode: 'canvas' | 'layer') => void;
  activeLayerName?: string;
  activeLayerIsText?: boolean;
  onCropConfirm?: () => void;
  onCropCancel?: () => void;
  onCropRemove?: () => void;
  onCropReset?: () => void;
  hasCrop?: boolean;
  hasCropChanged?: boolean;
  textSettings?: TextSettings;
  onTextSettingsChange?: (update: Partial<TextSettings>) => void;
  textFonts?: string[];
  textSizes?: number[];
  hasTextBox?: boolean;
  onCommitText?: () => void;
}

/** Editable numeric value — click to type, Enter/blur to commit, clamped to min/max */
function EditableValue({ value, min, max, suffix, onChange }: {
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback(() => {
    setDraft(String(value));
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  }, [value]);

  const commit = useCallback(() => {
    setEditing(false);
    const parsed = parseInt(draft, 10);
    if (!isNaN(parsed)) {
      onChange(Math.max(min, Math.min(max, parsed)));
    }
  }, [draft, min, max, onChange]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="paint-opt-value-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        autoFocus
      />
    );
  }

  return (
    <span className="paint-opt-value" onClick={startEdit} title="Click to edit">
      {value}{suffix ?? ''}
    </span>
  );
}

const isBrushTool = (type: string) =>
  ['pencil', 'eraser', 'smudge', 'clone', 'heal'].includes(type);

export function ToolOptionsBar({
  activeTool, brush, onBrushChange, maxBrushSize,
  wandSettings, onWandSettingsChange,
  pixelSnap, onPixelSnapChange,
  hasSelection, onClearSelection, onInvertSelection, onFlipSelectionH, onFlipSelectionV, onAlignSelectionCenter, onAlignSelectionH, onAlignSelectionV, onGrowShrinkSelection,
  strokeEffect, onStrokeEffectChange, onApplyStrokeEffect, onPickStrokeColor, onOpenStrokeColorWheel,
  layerAdjustments, onLayerAdjustmentsChange,
  cloneSourceMode, onCloneSourceModeChange, activeLayerName, activeLayerIsText,
  onCropConfirm, onCropCancel, onCropRemove, onCropReset, hasCrop, hasCropChanged,
  textSettings, onTextSettingsChange, textFonts, textSizes: _, hasTextBox, onCommitText,
}: ToolOptionsBarProps) {
  const showBrush = activeTool === 'brush' && isBrushTool(brush.type);
  const showWand = activeTool === 'select-wand';
  const [growAmount, setGrowAmount] = useState(1);

  return (
    <div className="paint-options-bar" onPointerDown={(e) => e.stopPropagation()}>
      <div className="paint-options-bar-header">Properties</div>

      <div className="paint-opt-row">
        <button
          className={`paint-opt-snap-btn${pixelSnap ? ' paint-opt-snap-btn-active' : ''}`}
          onClick={() => onPixelSnapChange(!pixelSnap)}
          title="Snap brush to pixel grid (for pixel art)"
        >
          <Grid2X2 size={14} />
          Pixel Snapping
        </button>
      </div>

      {/* Brush settings */}
      {showBrush && (
        <>
          <div className="paint-opt-row">
            <span className="paint-opt-label">Shape</span>
            <div className="paint-opt-right">
              <button
                className={`paint-opt-btn${brush.shape === 'circle' ? ' paint-opt-btn-active' : ''}`}
                onClick={() => onBrushChange({ ...brush, shape: 'circle' })}
                title="Round"
              >
                <Circle size={12} />
              </button>
              <button
                className={`paint-opt-btn${brush.shape === 'oval' ? ' paint-opt-btn-active' : ''}`}
                onClick={() => onBrushChange({ ...brush, shape: 'oval' })}
                title="Oval"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <ellipse cx="12" cy="12" rx="7" ry="11" />
                </svg>
              </button>
              <button
                className={`paint-opt-btn${brush.shape === 'square' ? ' paint-opt-btn-active' : ''}`}
                onClick={() => onBrushChange({ ...brush, shape: 'square' })}
                title="Square"
              >
                <Square size={12} />
              </button>
            </div>
          </div>

          <div className="paint-opt-row">
            <span className="paint-opt-label">Size</span>
            <div className="paint-opt-right">
              <input
                type="range"
                className="paint-opt-slider"
                min="1"
                max={maxBrushSize}
                value={brush.size}
                onChange={(e) => onBrushChange({ ...brush, size: parseInt(e.target.value, 10) })}
              />
              <EditableValue
                value={brush.size}
                min={1}
                max={maxBrushSize}
                onChange={(v) => onBrushChange({ ...brush, size: v })}
              />
            </div>
          </div>

          <div className="paint-opt-row">
            <span className="paint-opt-label">Opacity</span>
            <div className="paint-opt-right">
              <input
                type="range"
                className="paint-opt-slider"
                min="0"
                max="100"
                value={Math.round(brush.opacity * 100)}
                onChange={(e) => onBrushChange({ ...brush, opacity: parseInt(e.target.value, 10) / 100 })}
              />
              <EditableValue
                value={Math.round(brush.opacity * 100)}
                min={0}
                max={100}
                suffix="%"
                onChange={(v) => onBrushChange({ ...brush, opacity: v / 100 })}
              />
            </div>
          </div>

          <div className="paint-opt-row">
            <span className="paint-opt-label">Hardness</span>
            <div className="paint-opt-right">
              <input
                type="range"
                className="paint-opt-slider"
                min="0"
                max="100"
                value={Math.round(brush.hardness * 100)}
                onChange={(e) => onBrushChange({ ...brush, hardness: parseInt(e.target.value, 10) / 100 })}
              />
              <EditableValue
                value={Math.round(brush.hardness * 100)}
                min={0}
                max={100}
                suffix="%"
                onChange={(v) => onBrushChange({ ...brush, hardness: v / 100 })}
              />
            </div>
          </div>
        </>
      )}

      {/* Wand settings */}
      {showWand && (
        <>
          <div className="paint-opt-row">
            <span className="paint-opt-label">Tolerance</span>
            <div className="paint-opt-right">
              <input
                type="range"
                className="paint-opt-slider"
                min="0"
                max="255"
                value={wandSettings.tolerance}
                onChange={(e) => onWandSettingsChange({ ...wandSettings, tolerance: parseInt(e.target.value, 10) })}
              />
              <EditableValue
                value={wandSettings.tolerance}
                min={0}
                max={255}
                onChange={(v) => onWandSettingsChange({ ...wandSettings, tolerance: v })}
              />
            </div>
          </div>
          <div className="paint-opt-row">
            <span className="paint-opt-label">Spread</span>
            <div className="paint-opt-right">
              <input
                type="range"
                className="paint-opt-slider"
                min="-20"
                max="20"
                value={wandSettings.spread}
                onChange={(e) => onWandSettingsChange({ ...wandSettings, spread: parseInt(e.target.value, 10) })}
              />
              <EditableValue
                value={wandSettings.spread}
                min={-20}
                max={20}
                onChange={(v) => onWandSettingsChange({ ...wandSettings, spread: v })}
              />
            </div>
          </div>
          <div className="paint-opt-row">
            <label className="paint-opt-check">
              <input
                type="checkbox"
                checked={wandSettings.contiguous}
                onChange={(e) => onWandSettingsChange({ ...wandSettings, contiguous: e.target.checked })}
              />
              Contiguous
            </label>
          </div>
        </>
      )}

      {/* Clone source mode */}
      {activeTool === 'brush' && brush.type === 'clone' && onCloneSourceModeChange && (
        <div className="paint-opt-row">
          <span className="paint-opt-label">Source</span>
          <div className="paint-opt-right">
            <button
              className={`paint-opt-btn${cloneSourceMode === 'canvas' ? ' paint-opt-btn-active' : ''}`}
              onClick={() => onCloneSourceModeChange('canvas')}
              title="Clone from all visible layers"
            >Page</button>
            <button
              className={`paint-opt-btn${cloneSourceMode === 'layer' ? ' paint-opt-btn-active' : ''}`}
              onClick={() => onCloneSourceModeChange('layer')}
              title="Clone from the Alt+clicked layer only"
            >Layer</button>
          </div>
        </div>
      )}

      {/* Crop actions */}
      {activeTool === 'crop' && onCropConfirm && (
        <>
          <div className="paint-opt-row">
            <span className="paint-opt-label">Crop</span>
            <div className="paint-opt-right">
              <button className="paint-opt-apply" onClick={onCropConfirm}>Confirm</button>
              <button className="paint-opt-btn" onClick={onCropCancel}>Cancel</button>
            </div>
          </div>
          <div className="paint-opt-row">
            <div className="paint-opt-right">
              <button className="paint-opt-btn" onClick={onCropReset} disabled={!hasCropChanged}>Revert Crop</button>
              <button className={`paint-opt-btn${!hasCrop ? ' paint-opt-btn-disabled' : ''}`} disabled={!hasCrop} onClick={onCropRemove}>Remove Crop</button>
            </div>
          </div>
        </>
      )}

      {/* Text tool settings */}
      {activeTool === 'text' && textSettings && onTextSettingsChange && (
        <>
          <div className="paint-opt-row">
            <span className="paint-opt-label">Font</span>
            <div className="paint-opt-right">
              <select
                className="paint-opt-select"
                value={textSettings.font}
                onChange={(e) => onTextSettingsChange({ font: e.target.value })}
              >
                {(textFonts ?? []).map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="paint-opt-row">
            <span className="paint-opt-label">Size</span>
            <div className="paint-opt-right">
              <input
                type="range"
                className="paint-opt-slider"
                min={1}
                max={200}
                value={textSettings.size}
                onChange={(e) => onTextSettingsChange({ size: parseInt(e.target.value, 10) })}
              />
              <EditableValue
                value={textSettings.size}
                min={1}
                max={512}
                onChange={(v) => onTextSettingsChange({ size: v })}
              />
            </div>
          </div>
          <div className="paint-opt-row">
            <span className="paint-opt-label">Style</span>
            <div className="paint-opt-right">
              <button
                className={`paint-opt-btn${textSettings.bold ? ' paint-opt-btn-active' : ''}`}
                onClick={() => onTextSettingsChange({ bold: !textSettings.bold })}
                title="Bold"
                style={{ fontWeight: 'bold' }}
              >B</button>
              <button
                className={`paint-opt-btn${textSettings.italic ? ' paint-opt-btn-active' : ''}`}
                onClick={() => onTextSettingsChange({ italic: !textSettings.italic })}
                title="Italic"
                style={{ fontStyle: 'italic' }}
              >I</button>
              <button
                className={`paint-opt-btn${textSettings.underline ? ' paint-opt-btn-active' : ''}`}
                onClick={() => onTextSettingsChange({ underline: !textSettings.underline })}
                title="Underline"
                style={{ textDecoration: 'underline' }}
              >U</button>
            </div>
          </div>
          <div className="paint-opt-row">
            <span className="paint-opt-label">Align</span>
            <div className="paint-opt-right">
              <button
                className={`paint-opt-btn${textSettings.align === 'left' ? ' paint-opt-btn-active' : ''}`}
                onClick={() => onTextSettingsChange({ align: 'left' })}
                title="Align left"
              ><AlignLeft size={12} /></button>
              <button
                className={`paint-opt-btn${textSettings.align === 'center' ? ' paint-opt-btn-active' : ''}`}
                onClick={() => onTextSettingsChange({ align: 'center' })}
                title="Align center"
              ><AlignCenter size={12} /></button>
              <button
                className={`paint-opt-btn${textSettings.align === 'right' ? ' paint-opt-btn-active' : ''}`}
                onClick={() => onTextSettingsChange({ align: 'right' })}
                title="Align right"
              ><AlignRight size={12} /></button>
            </div>
          </div>
          {hasTextBox && onCommitText && (
            <div className="paint-opt-row">
              <div className="paint-opt-right">
                <button className="paint-opt-apply" onClick={onCommitText}>Commit Text</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Selection actions */}
      {hasSelection && (
        <>
          <div className="paint-opt-row">
            <span className="paint-opt-label">Selection</span>
            <div className="paint-opt-right">
              <button className="paint-opt-btn" onClick={onInvertSelection} title="Invert selection">Invert</button>
              <button className="paint-opt-btn" onClick={onClearSelection} title="Deselect (Esc)">Deselect</button>
            </div>
          </div>
          <div className="paint-opt-row">
            <span className="paint-opt-label">Flip</span>
            <div className="paint-opt-right">
              <button className="paint-opt-btn paint-opt-btn-icon" onClick={onFlipSelectionH} title="Flip horizontal"><FlipHorizontal2 size={14} /></button>
              <button className="paint-opt-btn paint-opt-btn-icon" onClick={onFlipSelectionV} title="Flip vertical"><FlipVertical2 size={14} /></button>
            </div>
          </div>
          <div className="paint-opt-row">
            <span className="paint-opt-label">Align</span>
            <div className="paint-opt-right">
              <button className="paint-opt-btn paint-opt-btn-icon" onClick={onAlignSelectionCenter} title="Center in selection">
                <svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="12" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 1.5" /><rect x="4.5" y="4.5" width="5" height="5" rx="0.5" fill="currentColor" /></svg>
              </button>
              <button className="paint-opt-btn paint-opt-btn-icon" onClick={onAlignSelectionH} title="Center horizontally">
                <svg width="14" height="14" viewBox="0 0 14 14"><line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" strokeWidth="1.3" /><rect x="4" y="4.5" width="6" height="5" rx="0.5" fill="currentColor" opacity="0.5" /><line x1="4" y1="7" x2="10" y2="7" stroke="currentColor" strokeWidth="1.3" /></svg>
              </button>
              <button className="paint-opt-btn paint-opt-btn-icon" onClick={onAlignSelectionV} title="Center vertically">
                <svg width="14" height="14" viewBox="0 0 14 14"><line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.3" /><rect x="4.5" y="4" width="5" height="6" rx="0.5" fill="currentColor" opacity="0.5" /><line x1="7" y1="4" x2="7" y2="10" stroke="currentColor" strokeWidth="1.3" /></svg>
              </button>
            </div>
          </div>
          {onGrowShrinkSelection && (
            <div className="paint-opt-row">
              <span className="paint-opt-label">Size</span>
              <div className="paint-opt-right">
                <button className="paint-opt-btn" onClick={() => onGrowShrinkSelection(-growAmount)} title="Shrink selection">Shrink</button>
                <EditableValue value={growAmount} min={1} max={100} suffix="px" onChange={setGrowAmount} />
                <button className="paint-opt-btn" onClick={() => onGrowShrinkSelection(growAmount)} title="Grow selection">Grow</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Per-layer adjustments — available on non-Mask layers */}
      {activeLayerName !== 'Mask' && onLayerAdjustmentsChange && (
        <AdjustControls adjustments={layerAdjustments} onChange={onLayerAdjustmentsChange} />
      )}

      {/* Stroke effect — available on non-Mask layers */}
      {activeLayerName !== 'Mask' && onStrokeEffectChange && (
        <StrokeEffectControls
          effect={strokeEffect ?? { enabled: false, color: '#000000', thickness: 2, opacity: 1, position: 'outside' }}
          onChange={onStrokeEffectChange}
          onApplyEffect={onApplyStrokeEffect}
          disableApplyEffect={activeLayerIsText}
          onPickColor={onPickStrokeColor}
          onOpenColorWheel={onOpenStrokeColorWheel}
        />
      )}

    </div>
  );
}

/* ── Layer Adjustment Controls ───────────────────────────────────────── */

function AdjustControls({
  adjustments,
  onChange,
}: {
  adjustments?: LayerAdjustments;
  onChange: (updates: Partial<LayerAdjustments>) => void;
}) {
  const hasAdjust = layerAdjustFilter(adjustments) !== 'none';
  return (
    <div className="paint-opt-stroke-section">
      <div className="paint-opt-row">
        <span className="paint-opt-label paint-opt-toggle-label">Adjust</span>
        {/* Always rendered so its appearance never shifts the layout */}
        <button
          className="paint-opt-btn"
          style={{ marginLeft: 'auto', visibility: hasAdjust ? 'visible' : 'hidden' }}
          title="Reset adjustments"
          onClick={() => onChange({ brightness: undefined, contrast: undefined, saturation: undefined, hue: undefined })}
        >Reset</button>
      </div>
      {([
        { key: 'brightness' as const, label: 'Bright', min: 0, max: 200, scale: 100, def: 1, unit: '%' },
        { key: 'contrast' as const, label: 'Contrast', min: 0, max: 200, scale: 100, def: 1, unit: '%' },
        { key: 'saturation' as const, label: 'Sat', min: 0, max: 200, scale: 100, def: 1, unit: '%' },
        { key: 'hue' as const, label: 'Hue', min: -180, max: 180, scale: 1, def: 0, unit: '°' },
      ]).map(({ key, label, min, max, scale, def, unit }) => {
        const val = Math.round((adjustments?.[key] ?? def) * scale);
        return (
          <div className="paint-opt-adjust" key={key}>
            <div className="paint-opt-row">
              <span className="paint-opt-label">{label}</span>
              <div className="paint-opt-right">
                <EditableValue
                  value={val}
                  min={min}
                  max={max}
                  suffix={unit}
                  onChange={(v) => onChange({ [key]: v / scale })}
                />
              </div>
            </div>
            <input
              type="range"
              className="paint-opt-slider paint-opt-slider-full"
              min={min}
              max={max}
              value={val}
              onDoubleClick={() => onChange({ [key]: undefined })}
              onChange={(e) => onChange({ [key]: parseInt(e.target.value, 10) / scale })}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ── Stroke Effect Controls ──────────────────────────────────────────── */

function StrokeEffectControls({
  effect,
  onChange,
  onApplyEffect,
  disableApplyEffect,
  onPickColor,
  onOpenColorWheel,
}: {
  effect: StrokeEffect;
  onChange: (effect: StrokeEffect) => void;
  onApplyEffect?: () => void;
  disableApplyEffect?: boolean;
  onPickColor?: () => void;
  onOpenColorWheel?: () => void;
}) {
  return (
    <div className="paint-opt-stroke-section">
      <div className="paint-opt-row">
        <label className="paint-opt-label paint-opt-toggle-label">
          <input
            type="checkbox"
            checked={effect.enabled}
            onChange={(e) => onChange({ ...effect, enabled: e.target.checked })}
          />
          Stroke
        </label>
        {effect.enabled && onApplyEffect && (
          <button className="paint-opt-btn paint-opt-apply-effect" onClick={onApplyEffect} disabled={disableApplyEffect} title={disableApplyEffect ? 'Rasterize text layer first' : 'Bake stroke onto layer'}>Apply</button>
        )}
      </div>

      {effect.enabled && (
        <>
          <div className="paint-opt-row">
            <span className="paint-opt-label">Color</span>
            <div className="paint-opt-right">
              <button className="paint-opt-color-swatch" style={{ background: effect.color }} onClick={onOpenColorWheel} title="Open color picker" />
              <button
                className="paint-opt-color-pick"
                title="Pick color from page"
                onClick={onPickColor}
              >
                <Pipette size={12} />
              </button>
            </div>
          </div>

          <div className="paint-opt-row">
            <span className="paint-opt-label">Size</span>
            <div className="paint-opt-right">
              <input
                type="range"
                min="1"
                max="50"
                value={effect.thickness}
                onChange={(e) => onChange({ ...effect, thickness: parseInt(e.target.value, 10) })}
                className="paint-opt-slider"
              />
              <span className="paint-opt-value">{effect.thickness}px</span>
            </div>
          </div>

          <div className="paint-opt-row">
            <span className="paint-opt-label">Opacity</span>
            <div className="paint-opt-right">
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(effect.opacity * 100)}
                onChange={(e) => onChange({ ...effect, opacity: parseInt(e.target.value, 10) / 100 })}
                className="paint-opt-slider"
              />
              <span className="paint-opt-value">{Math.round(effect.opacity * 100)}%</span>
            </div>
          </div>

          <div className="paint-opt-row">
            <span className="paint-opt-label">Position</span>
            <div className="paint-opt-right">
              <select
                value={effect.position}
                onChange={(e) => onChange({ ...effect, position: e.target.value as StrokePosition })}
                className="paint-opt-select"
              >
                <option value="outside">Outside</option>
                <option value="center">Center</option>
                <option value="inside">Inside</option>
              </select>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
