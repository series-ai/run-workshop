import { useState, useRef, useEffect, useCallback } from 'react';
import { Menu, FilePlus, FolderOpen, LayoutGrid, Save, Upload, Download, Image, Settings, Undo2, Redo2, Minus, Plus, Film, Magnet, Ruler, Type, Sparkles, MessageSquare, Workflow } from 'lucide-react';
import type { WorkspaceAction, ImageNode, CanvasRect, ScaleFilter, RulerGuide } from './types';
import { saveProject, saveProjectAs, loadProject, setCurrentFileHandle } from './projectFile';
import { CanvasMenu } from './CanvasMenu';
import type { CanvasInfoIssues } from './CanvasMenu';
import { FilterMenu } from './FilterMenu';
import { SourceManager } from './SourceManager';
import { MemoryMonitor } from './MemoryMonitor';

interface ToolbarProps {
  zoom: number;
  dispatch: React.Dispatch<WorkspaceAction>;
  pan: { x: number; y: number };
  onImport: () => void;
  onImportSpriteSheet: () => void;
  images: ImageNode[];
  canUndo: boolean;
  canRedo: boolean;
  canvas: CanvasRect | null;
  scaleFilter: ScaleFilter;
  snapEnabled: boolean;
  projectName: string | null;
  onNewProject: () => void;
  selectedIds: Set<string>;
  onCanvasInfoIssues: (issues: CanvasInfoIssues | null) => void;
  guides: RulerGuide[];
  rulersVisible: boolean;
  onToggleRulers: () => void;
  canvasBgColor: string | null;
  onOpenFlipbook: () => void;
  activeTool: 'pointer' | 'text';
  onSetActiveTool: (tool: 'pointer' | 'text') => void;
  exportOpen: boolean;
  onExportClosed: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onOpenPreferences: () => void;
  onExportStatus?: (status: string | null) => void;
  onMenuOpenChange?: (open: boolean) => void;
  editMode?: boolean;
  aiHidden?: boolean;
  onAiTextToImage?: () => void;
  onAiChat?: () => void;
  onAiComfy?: () => void;
  aiTextToImageOpen?: boolean;
  aiChatOpen?: boolean;
  aiComfyOpen?: boolean;
  historyPast: number;
  historyFuture: number;
  historyMax: number;
}

export function Toolbar({ zoom, dispatch, pan, onImport, onImportSpriteSheet, images, canUndo, canRedo, canvas, scaleFilter, snapEnabled, projectName, onNewProject, selectedIds, onCanvasInfoIssues, guides, rulersVisible, onToggleRulers, canvasBgColor, onOpenFlipbook, activeTool, onSetActiveTool, exportOpen, onExportClosed, onUndo, onRedo, onOpenPreferences, onExportStatus, onMenuOpenChange, editMode, aiHidden, onAiTextToImage, onAiChat, onAiComfy, aiTextToImageOpen, aiChatOpen, aiComfyOpen, historyPast, historyFuture, historyMax }: ToolbarProps) {
  const zoomPercent = Math.round(zoom * 100);
  const [menuOpen, setMenuOpenRaw] = useState(false);
  const setMenuOpen = useCallback((v: boolean | ((prev: boolean) => boolean)) => {
    setMenuOpenRaw((prev) => {
      const next = typeof v === 'function' ? v(prev) : v;
      if (onMenuOpenChange) onMenuOpenChange(next);
      return next;
    });
  }, [onMenuOpenChange]);
  const [saving, setSaving] = useState(false);
  const [sourceManagerOpen, setSourceManagerOpen] = useState(false);
  // Bumped when re-invoking while open — remounts the panel back at its
  // default position (recovers a panel dragged off screen)
  const [sourceManagerKey, setSourceManagerKey] = useState(0);
  const [exportAsOpen, setExportAsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const loadInputRef = useRef<HTMLInputElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('pointerdown', handleClick, true);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handleClick, true);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMenuOpen(false);
    try {
      const result = await saveProject(images, pan, zoom, canvas, scaleFilter, projectName, guides, canvasBgColor);
      if (result) dispatch({ type: 'SET_PROJECT_NAME', name: result.name });
    } catch (e) {
      console.error('Failed to save project:', e);
    }
    setSaving(false);
  }, [images, pan, zoom, canvas, scaleFilter, projectName, guides, canvasBgColor, dispatch]);

  const handleSaveAs = useCallback(async () => {
    setSaving(true);
    setMenuOpen(false);
    try {
      const result = await saveProjectAs(images, pan, zoom, canvas, scaleFilter, guides, canvasBgColor);
      if (result) dispatch({ type: 'SET_PROJECT_NAME', name: result.name });
    } catch (e) {
      console.error('Failed to save project:', e);
    }
    setSaving(false);
  }, [images, pan, zoom, canvas, scaleFilter, guides, canvasBgColor, dispatch]);

  const handleLoad = useCallback(async () => {
    setMenuOpen(false);
    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await (window as any).showOpenFilePicker({
          types: [
            {
              description: 'Layout Project',
              accept: { 'application/json': ['.layout'] },
            },
          ],
          multiple: false,
        });
        const file = await handle.getFile();
        setCurrentFileHandle(handle);
        const project = await loadProject(file);
        dispatch({
          type: 'LOAD_PROJECT',
          images: project.images,
          pan: project.pan,
          zoom: project.zoom,
          canvas: project.canvas,
          scaleFilter: project.scaleFilter,
          projectName: file.name,
          guides: project.guides,
          canvasBgColor: project.canvasBgColor,
        });
      } catch (e: any) {
        if (e.name !== 'AbortError') console.error('Failed to load project:', e);
      }
    } else {
      loadInputRef.current?.click();
    }
  }, [dispatch]);

  const handleLoadFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const project = await loadProject(file);
        dispatch({
          type: 'LOAD_PROJECT',
          images: project.images,
          pan: project.pan,
          zoom: project.zoom,
          canvas: project.canvas,
          scaleFilter: project.scaleFilter,
          projectName: file.name,
          guides: project.guides,
          canvasBgColor: project.canvasBgColor,
        });
      } catch (err) {
        console.error('Failed to load project:', err);
      }
      e.target.value = '';
    },
    [dispatch],
  );

  const handleZoomIn = () => {
    const newZoom = Math.min(32, zoom * 1.2);
    const vw = window.innerWidth / 2;
    const vh = window.innerHeight / 2;
    const wx = (vw - pan.x) / zoom;
    const wy = (vh - pan.y) / zoom;
    const newPanX = vw - wx * newZoom;
    const newPanY = vh - wy * newZoom;
    dispatch({ type: 'SET_ZOOM', zoom: newZoom, pan: { x: newPanX, y: newPanY } });
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(0.01, zoom / 1.2);
    const vw = window.innerWidth / 2;
    const vh = window.innerHeight / 2;
    const wx = (vw - pan.x) / zoom;
    const wy = (vh - pan.y) / zoom;
    const newPanX = vw - wx * newZoom;
    const newPanY = vh - wy * newZoom;
    dispatch({ type: 'SET_ZOOM', zoom: newZoom, pan: { x: newPanX, y: newPanY } });
  };

  const handleZoomReset = () => {
    dispatch({ type: 'SET_ZOOM', zoom: 1, pan: { x: 0, y: 0 } });
  };


  return (
    <div className={`toolbar${rulersVisible ? ' toolbar-rulers-on' : ''}`}>
      {/* Hamburger menu */}
      <div className="toolbar-menu-wrapper" ref={menuRef}>
        <button
          className="toolbar-btn toolbar-btn-icon"
          onClick={() => setMenuOpen((v) => !v)}
          title="Menu"
          disabled={editMode}
        >
          <Menu size={18} />
        </button>
        {menuOpen && (
          <div className="toolbar-dropdown" onPointerDown={(e) => e.stopPropagation()}>
            <button className="toolbar-dropdown-item" onClick={() => { setMenuOpen(false); onNewProject(); }}>
              <FilePlus size={16} />
              <span>New Project</span>
            </button>
            <button className="toolbar-dropdown-item" onClick={handleLoad}>
              <FolderOpen size={16} />
              <span>Open Project</span>
              <span className="toolbar-dropdown-shortcut">Ctrl+O</span>
            </button>
            <button className="toolbar-dropdown-item" onClick={() => { setMenuOpen(false); onImportSpriteSheet(); }}>
              <LayoutGrid size={16} />
              <span>Import Sprite Sheet</span>
            </button>
            <button className="toolbar-dropdown-item" onClick={handleSave} disabled={saving}>
              <Save size={16} />
              <span>{saving ? 'Saving...' : 'Save Project'}</span>
              <span className="toolbar-dropdown-shortcut">Ctrl+S</span>
            </button>
            <button className="toolbar-dropdown-item" onClick={handleSaveAs} disabled={saving}>
              <Save size={16} />
              <span>Save Project As</span>
              <span className="toolbar-dropdown-shortcut">Ctrl+Shift+S</span>
            </button>
            <button className="toolbar-dropdown-item" onClick={() => { setMenuOpen(false); onImport(); }}>
              <Upload size={16} />
              <span>Import Images</span>
            </button>
            <button className="toolbar-dropdown-item" onClick={() => { setMenuOpen(false); setExportAsOpen(true); }}>
              <Download size={16} />
              <span>Export...</span>
              <span className="toolbar-dropdown-shortcut">Ctrl+E</span>
            </button>
            <div className="toolbar-dropdown-separator" />
            <button className="toolbar-dropdown-item" onClick={() => {
              setMenuOpen(false);
              if (sourceManagerOpen) {
                setSourceManagerKey((k) => k + 1); // already open — reset to default position
              } else {
                setSourceManagerOpen(true);
              }
            }}>
              <Image size={16} />
              <span>Source Manager</span>
            </button>
            <div className="toolbar-dropdown-separator" />
            <button className="toolbar-dropdown-item" onClick={() => { setMenuOpen(false); onOpenPreferences(); }}>
              <Settings size={16} />
              <span>Preferences</span>
            </button>
          </div>
        )}
      </div>

      <div className="toolbar-separator" />

      <button
        className="toolbar-btn toolbar-btn-icon"
        onClick={() => onUndo ? onUndo() : dispatch({ type: 'UNDO' })}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
      >
        <Undo2 size={16} />
      </button>
      <button
        className="toolbar-btn toolbar-btn-icon"
        onClick={() => onRedo ? onRedo() : dispatch({ type: 'REDO' })}
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
      >
        <Redo2 size={16} />
      </button>

      <div className="toolbar-separator" />
      <button className="toolbar-btn toolbar-btn-icon" onClick={handleZoomOut} title="Zoom out">
        <Minus size={16} />
      </button>
      <button className="toolbar-btn toolbar-zoom-display" onClick={handleZoomReset} title="Reset zoom">
        {zoomPercent}%
      </button>
      <button className="toolbar-btn toolbar-btn-icon" onClick={handleZoomIn} title="Zoom in">
        <Plus size={16} />
      </button>
      <div className="toolbar-separator" />
      <CanvasMenu canvas={canvas} dispatch={dispatch} images={images} scaleFilter={scaleFilter} selectedIds={selectedIds} onCanvasInfoIssues={onCanvasInfoIssues} canvasBgColor={canvasBgColor} projectName={projectName} pan={pan} zoom={zoom} guides={guides} exportAsOpen={exportAsOpen || exportOpen} onExportAsClosed={() => { setExportAsOpen(false); onExportClosed(); }} onExportStatus={onExportStatus} disabled={editMode} />
      <button className="toolbar-btn" onClick={onOpenFlipbook} title="Flipbook Viewer" disabled={editMode}>
        <Film size={18} />
        <span>Flipbook</span>
      </button>
      <div className="toolbar-separator" />
      <FilterMenu scaleFilter={scaleFilter} dispatch={dispatch} />
      <div className="toolbar-separator" />
      <button
        className={`toolbar-btn toolbar-btn-icon${activeTool === 'text' ? ' toolbar-btn-active' : ''}`}
        onClick={() => onSetActiveTool(activeTool === 'text' ? 'pointer' : 'text')}
        title="Text tool (T)"
        disabled={editMode}
      >
        <Type size={16} />
      </button>
      <button
        className={`toolbar-btn toolbar-btn-icon${snapEnabled ? ' toolbar-btn-active' : ''}`}
        onClick={() => dispatch({ type: 'SET_SNAP', enabled: !snapEnabled })}
        title={snapEnabled ? 'Snapping enabled' : 'Snapping disabled'}
      >
        <Magnet size={16} />
      </button>
      <button
        className={`toolbar-btn toolbar-btn-icon${rulersVisible ? ' toolbar-btn-active' : ''}`}
        onClick={onToggleRulers}
        title={rulersVisible ? 'Hide rulers' : 'Show rulers'}
      >
        <Ruler size={16} />
      </button>

      {!aiHidden && (
        <>
          <div className="toolbar-separator" />
          <button
            className={`toolbar-btn toolbar-btn-icon${aiTextToImageOpen ? ' toolbar-btn-active' : ''}`}
            onClick={onAiTextToImage}
            title="Text to Image / Reference to Image (AI)"
            disabled={!!editMode}
          >
            <Sparkles size={16} />
          </button>
          <button
            className={`toolbar-btn toolbar-btn-icon${aiChatOpen ? ' toolbar-btn-active' : ''}`}
            onClick={onAiChat}
            title="AI Chat"
          >
            <MessageSquare size={16} />
          </button>
          <button
            className={`toolbar-btn toolbar-btn-icon${aiComfyOpen ? ' toolbar-btn-active' : ''}`}
            onClick={onAiComfy}
            title="ComfyUI Workflows"
          >
            <Workflow size={16} />
          </button>
        </>
      )}

      <div className="toolbar-separator" />
      <MemoryMonitor
        imageCount={images.length}
        historyPast={historyPast}
        historyFuture={historyFuture}
        historyMax={historyMax}
        onClearHistory={() => dispatch({ type: 'CLEAR_HISTORY' })}
      />

      <input
        ref={loadInputRef}
        type="file"
        accept=".layout"
        onChange={handleLoadFile}
        className="hidden-file-input"
      />

      {sourceManagerOpen && (
        <SourceManager
          key={sourceManagerKey}
          images={images}
          selectedIds={selectedIds}
          dispatch={dispatch}
          onClose={() => setSourceManagerOpen(false)}
        />
      )}
    </div>
  );
}
