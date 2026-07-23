import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Eye, EyeOff, Trash2, Type } from 'lucide-react';
import type { Layer, BlendMode } from './types';
import { BLEND_MODES } from './types';

interface LayerPanelProps {
  layers: Layer[];
  activeLayerId: string;
  onSelectLayer: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onSetOpacity: (id: string, opacity: number) => void;
  onSetBlendMode: (id: string, blendMode: BlendMode) => void;
  onAddLayer: () => void;
  onDeleteLayer: (id: string) => void;
  onRenameLayer: (id: string, name: string) => void;
  onReorderLayer: (fromIndex: number, toIndex: number) => void;
  onDuplicateLayer: (id: string) => void;
  onMergeDown: (id: string) => void;
  onFlatten: () => void;
  onSelectLayerContents: (layerId: string) => void;
  onRasterizeLayer: (id: string) => void;
  onEditTextLayer: (id: string) => void;
  showCheckerboard?: boolean;
  onToggleCheckerboard?: () => void;
  onClearMask?: () => void;
  maskHasContent?: boolean;
}

export function LayerPanel({
  layers, activeLayerId,
  onSelectLayer, onToggleVisibility, onSetOpacity, onSetBlendMode,
  onAddLayer, onDeleteLayer, onRenameLayer, onReorderLayer,
  onDuplicateLayer, onMergeDown, onFlatten, onSelectLayerContents,
  onRasterizeLayer, onEditTextLayer, showCheckerboard, onToggleCheckerboard, onClearMask, maskHasContent,
}: LayerPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; layerId: string } | null>(null);
  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Display top-to-bottom (reversed from render order)
  const displayLayers = [...layers].reverse();

  const startRename = useCallback((layer: Layer) => {
    setEditingId(layer.id);
    setEditName(layer.name);
  }, []);

  const commitRename = useCallback(() => {
    if (editingId && editName.trim()) {
      onRenameLayer(editingId, editName.trim());
    }
    setEditingId(null);
  }, [editingId, editName, onRenameLayer]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  // Get the real index in layers array from display index
  const realIndex = (displayIdx: number) => layers.length - 1 - displayIdx;

  const handleDragStart = (displayIdx: number) => {
    setDragFromIdx(displayIdx);
  };

  const handleDragOver = (e: React.DragEvent, displayIdx: number) => {
    e.preventDefault();
    setDragOverIdx(displayIdx);
  };

  const handleDrop = (displayIdx: number) => {
    if (dragFromIdx !== null && dragFromIdx !== displayIdx) {
      onReorderLayer(realIndex(dragFromIdx), realIndex(displayIdx));
    }
    setDragFromIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDragFromIdx(null);
    setDragOverIdx(null);
  };

  const canMergeDown = (layerId: string) => {
    const idx = layers.findIndex((l) => l.id === layerId);
    if (idx <= 0) return false;
    if (layers[idx]!.name === 'Background' || layers[idx]!.name === 'Mask') return false;
    // Can't merge down into the Mask layer
    if (layers[idx - 1]!.name === 'Mask') return false;
    return true;
  };

  const isProtected = (layer: Layer) => layer.name === 'Background' || layer.name === 'Mask';

  return (
    <div
      className="paint-layer-panel"
      onPointerDown={(e) => e.stopPropagation()}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <div className="paint-layer-header">
        <span>Layers</span>
      </div>

      {(() => {
        const active = layers.find((l) => l.id === activeLayerId);
        if (!active) return null;
        return (
          <div className="paint-layer-controls" onPointerDown={(e) => e.stopPropagation()}>
            <input
              type="range"
              className="paint-layer-opacity-slider"
              min="0"
              max="100"
              value={Math.round(active.opacity * 100)}
              onChange={(e) => onSetOpacity(active.id, parseInt(e.target.value, 10) / 100)}
            />
            <span
              className="paint-layer-opacity-value"
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => {
                const v = parseInt(e.currentTarget.textContent ?? '', 10);
                if (!isNaN(v)) onSetOpacity(active.id, Math.max(0, Math.min(100, v)) / 100);
                e.currentTarget.textContent = `${Math.round(active.opacity * 100)}%`;
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); }
              }}
            >{Math.round(active.opacity * 100)}%</span>
            {active.name !== 'Mask' && (
              <select
                className="paint-layer-blend-select"
                value={active.blendMode}
                onChange={(e) => onSetBlendMode(active.id, e.target.value as BlendMode)}
              >
                {BLEND_MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            )}
          </div>
        );
      })()}


      <div className="paint-layer-list" onWheel={(e) => e.stopPropagation()}>
        {displayLayers.map((layer, displayIdx) => {
          const isActive = layer.id === activeLayerId;
          const isDragging = dragFromIdx === displayIdx;
          const isDragOver = dragOverIdx === displayIdx && dragFromIdx !== displayIdx;
          const dragAbove = isDragOver && dragFromIdx !== null && dragFromIdx > displayIdx;
          const dragBelow = isDragOver && dragFromIdx !== null && dragFromIdx < displayIdx;
          return (
            <div
              key={layer.id}
              className={`paint-layer-item${isActive ? ' paint-layer-item-active' : ''}${dragAbove ? ' paint-layer-item-dragover-above' : ''}${dragBelow ? ' paint-layer-item-dragover-below' : ''}`}
              style={{ opacity: isDragging ? 0.4 : 1 }}
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  e.stopPropagation();
                  onSelectLayerContents(layer.id);
                  return;
                }
                onSelectLayer(layer.id);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({ x: e.clientX, y: e.clientY, layerId: layer.id });
              }}
              draggable={!isProtected(layer)}
              onDragStart={() => handleDragStart(displayIdx)}
              onDragOver={(e) => handleDragOver(e, displayIdx)}
              onDrop={() => handleDrop(displayIdx)}
              onDragEnd={handleDragEnd}
              onDragLeave={() => { if (dragOverIdx === displayIdx) setDragOverIdx(null); }}
            >
              <button
                className={`paint-layer-vis-btn${layer.visible ? '' : ' paint-layer-vis-off'}`}
                onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }}
                title={layer.visible ? 'Hide layer' : 'Show layer'}
              >
                {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>

              {editingId === layer.id ? (
                <input
                  ref={editInputRef}
                  className="paint-layer-name-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  {layer.textData && <Type size={10} style={{ flexShrink: 0, opacity: 0.5, marginRight: 2 }} />}
                  <span
                    className="paint-layer-name"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (isProtected(layer)) return;
                      if (layer.textData) {
                        onEditTextLayer(layer.id);
                      } else {
                        startRename(layer);
                      }
                    }}
                  >
                    {layer.name}
                  </span>
                  {layer.name === 'Mask' && (
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, flexShrink: 0 }}>
                    {onClearMask && (
                      <button
                        className={`paint-layer-vis-btn${!maskHasContent ? ' paint-layer-vis-off' : ''}`}
                        onClick={(e) => { e.stopPropagation(); onClearMask(); }}
                        title="Clear mask"
                        style={{ flexShrink: 0 }}
                        disabled={!maskHasContent}
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                    {onToggleCheckerboard && (
                    <button
                      className={`paint-layer-vis-btn${showCheckerboard ? '' : ' paint-layer-vis-off'}`}
                      onClick={(e) => { e.stopPropagation(); onToggleCheckerboard(); }}
                      title={showCheckerboard ? 'Show workspace behind' : 'Show checkerboard'}
                      style={{ flexShrink: 0 }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                        <rect x="0" y="0" width="4" height="4" opacity="0.6" />
                        <rect x="4" y="4" width="4" height="4" opacity="0.6" />
                        <rect x="8" y="0" width="4" height="4" opacity="0.6" />
                        <rect x="0" y="8" width="4" height="4" opacity="0.6" />
                        <rect x="8" y="8" width="4" height="4" opacity="0.6" />
                        <rect x="4" y="0" width="4" height="4" opacity="0.2" />
                        <rect x="0" y="4" width="4" height="4" opacity="0.2" />
                        <rect x="8" y="4" width="4" height="4" opacity="0.2" />
                        <rect x="4" y="8" width="4" height="4" opacity="0.2" />
                      </svg>
                    </button>
                    )}
                    </div>
                  )}
                </>
              )}

            </div>
          );
        })}
      </div>

      <div className="paint-layer-footer" onPointerDown={(e) => e.stopPropagation()}>
        <button className="paint-layer-add-btn" onClick={onAddLayer} title="New layer">
          <Plus size={16} strokeWidth={3} />
        </button>
        <button
          className="paint-layer-action-btn paint-layer-delete-btn"
          onClick={() => onDeleteLayer(activeLayerId)}
          disabled={(() => { const al = layers.find((l) => l.id === activeLayerId); return !al || isProtected(al) || layers.length <= 1; })()}
          title="Delete layer"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Layer context menu */}
      {contextMenu && (
        <LayerContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          layerId={contextMenu.layerId}
          canMergeDown={canMergeDown(contextMenu.layerId)}
          canDelete={layers.length > 1 && !isProtected(layers.find((l) => l.id === contextMenu.layerId)!)}
          canRename={!isProtected(layers.find((l) => l.id === contextMenu.layerId)!)}
          isTextLayer={!!layers.find((l) => l.id === contextMenu.layerId)?.textData}
          onRename={() => { startRename(layers.find((l) => l.id === contextMenu.layerId)!); setContextMenu(null); }}
          onDuplicate={() => { onDuplicateLayer(contextMenu.layerId); setContextMenu(null); }}
          onMergeDown={() => { onMergeDown(contextMenu.layerId); setContextMenu(null); }}
          onFlatten={() => { onFlatten(); setContextMenu(null); }}
          onDelete={() => { onDeleteLayer(contextMenu.layerId); setContextMenu(null); }}
          onRasterize={() => { onRasterizeLayer(contextMenu.layerId); setContextMenu(null); }}
          onEditText={() => { onEditTextLayer(contextMenu.layerId); setContextMenu(null); }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

/* ── Layer Context Menu ──────────────────────────────────────────────── */

function LayerContextMenu({
  x, y, canMergeDown, canDelete, canRename, isTextLayer,
  onRename, onDuplicate, onMergeDown, onFlatten, onDelete, onRasterize, onEditText, onClose,
}: {
  x: number; y: number; layerId: string;
  canMergeDown: boolean; canDelete: boolean; canRename: boolean; isTextLayer: boolean;
  onRename: () => void; onDuplicate: () => void;
  onMergeDown: () => void; onFlatten: () => void;
  onDelete: () => void; onRasterize: () => void; onEditText: () => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', handleClick, true);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handleClick, true);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="context-menu"
      style={{ left: x, top: y, zIndex: 99999999 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {isTextLayer && <button className="context-menu-item" onClick={onEditText}>Edit Text</button>}
      {isTextLayer && <button className="context-menu-item" onClick={onRasterize}>Rasterize</button>}
      {isTextLayer && <div className="context-menu-separator" />}
      <button className={`context-menu-item${!canRename ? ' context-menu-item-disabled' : ''}`} disabled={!canRename} onClick={onRename}>Rename</button>
      <button className="context-menu-item" onClick={onDuplicate}>Duplicate</button>
      <div className="context-menu-separator" />
      <button className={`context-menu-item${!canMergeDown ? ' context-menu-item-disabled' : ''}`} disabled={!canMergeDown} onClick={onMergeDown}>Merge Down</button>
      <button className="context-menu-item" onClick={onFlatten}>Flatten Image</button>
      <div className="context-menu-separator" />
      <button className={`context-menu-item context-menu-item-danger${!canDelete ? ' context-menu-item-disabled' : ''}`} disabled={!canDelete} onClick={onDelete}>Delete</button>
    </div>,
    document.body,
  );
}
