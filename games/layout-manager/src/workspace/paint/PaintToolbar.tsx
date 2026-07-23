import type { BrushType, ToolType, BrushSettings } from './types';
import { Pencil, Eraser, PaintBucket, PaintRoller, Stamp, Bandage, Pipette, Move, Wand2, BoxSelect, Crop, Scaling, ArrowLeftRight, Type } from 'lucide-react';

interface PaintToolbarProps {
  activeTool: ToolType;
  brush: BrushSettings;
  onToolChange: (tool: ToolType) => void;
  onBrushTypeChange: (type: BrushType) => void;
  fgColor: string;
  bgColor: string;
  onSwapColors: () => void;
  onFgColorClick: () => void;
  eyedropperPreview?: string | null;
  hasSelection?: boolean;
  activeLayerIsText?: boolean;
}

interface ToolDef {
  type: ToolType;
  brushType?: BrushType;
  label: string;
  shortcut: string;
  icon: JSX.Element;
}

const BRUSH_TOOLS: ToolDef[] = [
  { type: 'brush', brushType: 'pencil', label: 'Pencil', shortcut: 'B', icon: <Pencil size={16} /> },
  { type: 'brush', brushType: 'eraser', label: 'Eraser', shortcut: 'E', icon: <Eraser size={16} /> },
  { type: 'brush', brushType: 'fill', label: 'Fill', shortcut: 'G', icon: <PaintBucket size={16} /> },
  { type: 'brush', brushType: 'smudge', label: 'Smudge', shortcut: 'S', icon: <PaintRoller size={16} /> },
  { type: 'brush', brushType: 'clone', label: 'Clone', shortcut: 'C', icon: <Stamp size={16} /> },
  { type: 'brush', brushType: 'heal', label: 'Heal', shortcut: 'J', icon: <Bandage size={16} /> },
];

const SELECT_TOOLS: ToolDef[] = [
  { type: 'select-rect', label: 'Box Select', shortcut: 'M', icon: <BoxSelect size={16} /> },
  { type: 'select-polygon', label: 'Polygon Select', shortcut: 'P', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 2"><polygon points="12 2, 22 8, 18 20, 6 20, 2 8" /></svg> },
  { type: 'select-wand', label: 'Magic Wand', shortcut: 'W', icon: <Wand2 size={16} /> },
  { type: 'eyedropper', label: 'Eyedropper', shortcut: 'I', icon: <Pipette size={16} /> },
];

export function PaintToolbar({
  activeTool, brush, onToolChange, onBrushTypeChange,
  fgColor, bgColor, onSwapColors, onFgColorClick,
  eyedropperPreview, hasSelection, activeLayerIsText,
}: PaintToolbarProps) {
  const isActive = (def: ToolDef) => {
    if (def.type === 'brush') {
      return activeTool === 'brush' && brush.type === def.brushType;
    }
    return activeTool === def.type;
  };

  const handleClick = (def: ToolDef) => {
    if (def.brushType) {
      onToolChange('brush');
      onBrushTypeChange(def.brushType);
    } else {
      onToolChange(def.type);
    }
  };

  return (
    <div className="paint-sidebar" onPointerDown={(e) => e.stopPropagation()}>
      <div className="paint-sidebar-group">
        <button
          className={`paint-sidebar-btn${activeTool === 'move' ? ' paint-sidebar-btn-active' : ''}`}
          onClick={() => onToolChange('move')}
          title="Move (V)"
        >
          <Move size={16} />
        </button>
        <button
          className={`paint-sidebar-btn${activeTool === 'transform' ? ' paint-sidebar-btn-active' : ''}`}
          onClick={() => onToolChange('transform')}
          disabled={!hasSelection && !activeLayerIsText}
          title="Transform"
        >
          <Scaling size={16} />
        </button>
        <button
          className={`paint-sidebar-btn${activeTool === 'crop' ? ' paint-sidebar-btn-active' : ''}`}
          onClick={() => onToolChange('crop')}
          title="Crop"
        >
          <Crop size={16} />
        </button>
        <button
          className={`paint-sidebar-btn${activeTool === 'text' ? ' paint-sidebar-btn-active' : ''}`}
          onClick={() => onToolChange('text')}
          title="Text (T)"
        >
          <Type size={16} />
        </button>
      </div>
      <div className="paint-sidebar-divider" />
      <div className="paint-sidebar-group">
        {BRUSH_TOOLS.map((def) => (
          <button
            key={def.brushType ?? def.type}
            className={`paint-sidebar-btn${isActive(def) ? ' paint-sidebar-btn-active' : ''}`}
            onClick={() => handleClick(def)}
            title={`${def.label} (${def.shortcut})`}
          >
            {def.icon}
          </button>
        ))}
      </div>

      <div className="paint-sidebar-divider" />

      <div className="paint-sidebar-group">
        {SELECT_TOOLS.map((def) => (
          <button
            key={def.type}
            className={`paint-sidebar-btn${isActive(def) ? ' paint-sidebar-btn-active' : ''}`}
            onClick={() => handleClick(def)}
            title={`${def.label} (${def.shortcut})`}
          >
            {def.icon}
          </button>
        ))}
      </div>

      <div className="paint-sidebar-divider" />

      {/* FG/BG color */}
      <div className="paint-sidebar-colors">
        <button
          className="paint-sidebar-color-fg"
          style={{ background: eyedropperPreview ?? fgColor }}
          onClick={onFgColorClick}
          title="Foreground color"
        />
        <button
          className="paint-sidebar-color-bg"
          style={{ background: bgColor }}
          title="Background color"
        />
        <button className="paint-sidebar-color-swap" onClick={onSwapColors} title="Swap colors (X)">
          <ArrowLeftRight size={10} />
        </button>
      </div>

    </div>
  );
}
