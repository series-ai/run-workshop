import type { MaskBrushType, MaskBrushSettings, WandSettings } from './maskBrushes';

interface MaskToolbarProps {
  brush: MaskBrushSettings;
  onBrushChange: (brush: MaskBrushSettings) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onInvert: () => void;
  onApply: () => void;
  onCancel: () => void;
  hasSelection: boolean;
  onFillSelection: (mode: 'hide' | 'reveal') => void;
  wandSettings: WandSettings;
  onWandSettingsChange: (settings: WandSettings) => void;
}

const SIZE_PRESETS = [2, 6, 14, 28, 50, 80];

export function MaskToolbar({
  brush, onBrushChange, canUndo, canRedo,
  onUndo, onRedo, onInvert, onApply, onCancel,
  hasSelection, onFillSelection,
  wandSettings, onWandSettingsChange,
}: MaskToolbarProps) {
  const setType = (type: MaskBrushType) => onBrushChange({ ...brush, type });
  const isBrushTool = brush.type === 'hide' || brush.type === 'reveal';

  return (
    <div className="mask-toolbar" onPointerDown={(e) => e.stopPropagation()}>
      <div className="mask-toolbar-section">
        <div className="mask-toolbar-label">Tool</div>
        <div className="mask-toolbar-tools">
          <button
            className={`mask-toolbar-tool-btn${brush.type === 'reveal' ? ' mask-toolbar-tool-active' : ''}`}
            onClick={() => setType('reveal')}
            title="Reveal (B)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18.37 2.63L14 7l-1.59-1.59a2 2 0 00-2.82 0L8 7l9 9 1.59-1.59a2 2 0 000-2.82L17 10l4.37-4.37a2.12 2.12 0 10-3-3z" />
              <path d="M9 8L3 14l3 3 3 3 6-6" />
              <path d="M3 20l3 3" />
            </svg>
            B
          </button>
          <button
            className={`mask-toolbar-tool-btn${brush.type === 'hide' ? ' mask-toolbar-tool-active' : ''}`}
            onClick={() => setType('hide')}
            title="Hide (E)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 20H4L8 4h8l4 16z" />
              <path d="M8 4l2 8h4l2-8" />
              <line x1="6" y1="12" x2="18" y2="12" />
            </svg>
            E
          </button>
          <button
            className={`mask-toolbar-tool-btn${brush.type === 'fill' ? ' mask-toolbar-tool-active' : ''}`}
            onClick={() => setType('fill')}
            title="Fill (G)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16.56 3.44a1.5 1.5 0 00-2.12 0L2 15.88V22h6.12L20.56 9.56a1.5 1.5 0 000-2.12z" />
              <path d="M13 4l4 4" />
              <line x1="2" y1="22" x2="10" y2="22" />
              <path d="M21 15c0 1.66-1.5 3-1.5 3s-1.5-1.34-1.5-3a1.5 1.5 0 013 0z" />
            </svg>
            G
          </button>
          <div className="mask-toolbar-separator" />
          <button
            className={`mask-toolbar-tool-btn${brush.type === 'select-rect' ? ' mask-toolbar-tool-active' : ''}`}
            onClick={() => setType('select-rect')}
            title="Box Select (M)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 2">
              <rect x="3" y="3" width="18" height="18" rx="1" />
            </svg>
            M
          </button>
          <button
            className={`mask-toolbar-tool-btn${brush.type === 'select-polygon' ? ' mask-toolbar-tool-active' : ''}`}
            onClick={() => setType('select-polygon')}
            title="Polygon Select (P)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 2">
              <polygon points="12 2, 22 8, 18 20, 6 20, 2 8" />
            </svg>
            P
          </button>
          <button
            className={`mask-toolbar-tool-btn${brush.type === 'select-wand' ? ' mask-toolbar-tool-active' : ''}`}
            onClick={() => setType('select-wand')}
            title="Magic Wand (W)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 4V2" />
              <path d="M15 16v-2" />
              <path d="M8 9h2" />
              <path d="M20 9h2" />
              <path d="M17.8 11.8l1.4 1.4" />
              <path d="M11.4 5.2l1.4 1.4" />
              <path d="M17.8 6.2l1.4-1.4" />
              <path d="M11.4 12.8l1.4-1.4" />
              <path d="M2 22l10-10" />
              <path d="M8 16l-2 2" />
            </svg>
            W
          </button>
        </div>
      </div>

      {/* Wand settings */}
      {brush.type === 'select-wand' && (
        <>
          <div className="mask-toolbar-section">
            <div className="mask-toolbar-label">Tolerance ({wandSettings.tolerance})</div>
            <div className="mask-toolbar-wand-row">
              <input
                type="range"
                className="mask-toolbar-slider"
                min="0"
                max="255"
                value={wandSettings.tolerance}
                onChange={(e) => onWandSettingsChange({ ...wandSettings, tolerance: parseInt(e.target.value, 10) })}
              />
              <input
                type="number"
                className="mask-toolbar-wand-input"
                min={0}
                max={255}
                value={wandSettings.tolerance}
                onChange={(e) => onWandSettingsChange({ ...wandSettings, tolerance: Math.max(0, Math.min(255, parseInt(e.target.value, 10) || 0)) })}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="mask-toolbar-section">
            <div className="mask-toolbar-label">Spread ({wandSettings.spread})</div>
            <div className="mask-toolbar-wand-row">
              <input
                type="range"
                className="mask-toolbar-slider"
                min="-20"
                max="20"
                value={wandSettings.spread}
                onChange={(e) => onWandSettingsChange({ ...wandSettings, spread: parseInt(e.target.value, 10) })}
              />
              <input
                type="number"
                className="mask-toolbar-wand-input"
                min={-20}
                max={20}
                value={wandSettings.spread}
                onChange={(e) => onWandSettingsChange({ ...wandSettings, spread: Math.max(-20, Math.min(20, parseInt(e.target.value, 10) || 0)) })}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="mask-toolbar-section">
            <div className="mask-toolbar-tools">
              <label className="mask-toolbar-wand-check">
                <input
                  type="checkbox"
                  checked={wandSettings.contiguous}
                  onChange={(e) => onWandSettingsChange({ ...wandSettings, contiguous: e.target.checked })}
                />
                Contiguous
              </label>
            </div>
          </div>
        </>
      )}

      {/* Selection actions — show when selection exists */}
      {hasSelection && (
        <div className="mask-toolbar-section">
          <div className="mask-toolbar-label">Selection</div>
          <div className="mask-toolbar-tools">
            <button
              className="mask-toolbar-tool-btn"
              onClick={() => onFillSelection('hide')}
              title="Hide selection (Del)"
            >
              Hide
            </button>
            <button
              className="mask-toolbar-tool-btn"
              onClick={() => onFillSelection('reveal')}
              title="Reveal selection"
            >
              Reveal
            </button>
          </div>
        </div>
      )}

      {isBrushTool && (
        <>
          <div className="mask-toolbar-section">
            <div className="mask-toolbar-label">Shape</div>
            <div className="mask-toolbar-tools">
              <button
                className={`mask-toolbar-tool-btn${brush.shape === 'round' ? ' mask-toolbar-tool-active' : ''}`}
                onClick={() => onBrushChange({ ...brush, shape: 'round' })}
                title="Round brush"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                </svg>
              </button>
              <button
                className={`mask-toolbar-tool-btn${brush.shape === 'square' ? ' mask-toolbar-tool-active' : ''}`}
                onClick={() => onBrushChange({ ...brush, shape: 'square' })}
                title="Square brush"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" />
                </svg>
              </button>
            </div>
          </div>

          <div className="mask-toolbar-section">
            <div className="mask-toolbar-label">Size ({brush.size})</div>
            <div className="mask-toolbar-slider-row">
              <input
                type="range"
                className="mask-toolbar-slider"
                min="1"
                max="2048"
                value={brush.size}
                onChange={(e) => onBrushChange({ ...brush, size: parseInt(e.target.value, 10) })}
              />
              <div className="mask-toolbar-presets">
                {SIZE_PRESETS.map((s) => (
                  <button
                    key={s}
                    className={`mask-toolbar-preset${brush.size === s ? ' mask-toolbar-preset-active' : ''}`}
                    onClick={() => onBrushChange({ ...brush, size: s })}
                  >
                    <span className="mask-toolbar-preset-dot" style={{ width: Math.max(3, s * 0.3), height: Math.max(3, s * 0.3) }} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mask-toolbar-section">
            <div className="mask-toolbar-label">Opacity ({Math.round(brush.opacity * 100)}%)</div>
            <input
              type="range"
              className="mask-toolbar-slider"
              min="5"
              max="100"
              value={Math.round(brush.opacity * 100)}
              onChange={(e) => onBrushChange({ ...brush, opacity: parseInt(e.target.value, 10) / 100 })}
            />
          </div>

          <div className="mask-toolbar-section">
            <div className="mask-toolbar-label">Hardness ({Math.round(brush.hardness * 100)}%)</div>
            <input
              type="range"
              className="mask-toolbar-slider"
              min="0"
              max="100"
              value={Math.round(brush.hardness * 100)}
              onChange={(e) => onBrushChange({ ...brush, hardness: parseInt(e.target.value, 10) / 100 })}
            />
          </div>
        </>
      )}

      <div className="mask-toolbar-section mask-toolbar-actions">
        <button className="mask-toolbar-btn" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>
        <button className="mask-toolbar-btn" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
        <div className="mask-toolbar-separator" />
        <button className="mask-toolbar-btn" onClick={onInvert} title="Invert mask">Invert</button>
      </div>

      <div className="mask-toolbar-commit">
        <button className="mask-toolbar-apply" onClick={onApply}>Apply</button>
        <button className="mask-toolbar-cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
