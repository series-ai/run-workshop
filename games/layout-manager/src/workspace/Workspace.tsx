import { useRef, useCallback, useState, useEffect, useLayoutEffect } from 'react';
import { useWorkspaceState } from './useWorkspaceState';
import { ImageNodeComponent } from './ImageNode';
import { Toolbar } from './Toolbar';
import { ContextMenu } from './ContextMenu';
import { InfoPanel } from './InfoPanel';
import { AnimationPreview } from './AnimationPreview';
import { GroupTransformBox } from './GroupTransformBox';
import { CropOverlay } from './CropOverlay';
import type { CropRect, CropGeometry } from './CropOverlay';
import { PaintEditor } from './paint/PaintEditor';
import { autoCropImage } from './cropImage';
import { saveProject, saveProjectAs, loadProject, setCurrentFileHandle, setCurrentFilePath } from './projectFile';
import { importSpriteSheet } from './importSpriteSheet';
import { Lock, Unlock, Target, Link2, Trash2, ScanEye } from 'lucide-react';
import { sliceImage } from './splitImage';
import type { ContextMenuState, SnapGuide, ImageNode as ImageNodeType } from './types';
import { adjustmentsFilter } from './types';
import { WelcomeModal } from './WelcomeModal';
import type { CanvasInfoIssues } from './CanvasMenu';
import { NodeTreePanel } from './NodeTreePanel';
import { Rulers } from './Rulers';
import { FlipbookViewer } from './FlipbookViewer';
import { BatchRename } from './BatchRename';
import { Preferences } from './Preferences';
import { loadConfig, saveConfig, type UserConfig } from './userConfig';
import { themes } from '../theme/themes';
import { applyTheme } from '../theme/applyTheme';
import { TextToImageModal } from './ai/TextToImageModal';
import { ComfyModal } from './ai/ComfyModal';
import { useAlignedPosition } from './ai/useDraggableModal';
import { AiChatPanel, type ChatMessage } from './ai/AiChatPanel';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];
// The browser sometimes reports an empty MIME type for valid images
// (network mounts, freshly-extracted archives) — fall back to the extension.
const ACCEPTED_EXT_RE = /\.(png|jpe?g|gif|webp|svg)$/i;
const isAcceptedImage = (f: File) =>
  ACCEPTED_TYPES.includes(f.type) || (f.type === '' && ACCEPTED_EXT_RE.test(f.name));

export function Workspace() {
  const { state, dispatch, addImageFromFile, addImagesFromFiles, addImageFromUrl, importProgress, canUndo, canRedo, historyDepth } = useWorkspaceState();
  const viewportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const spriteSheetInputRef = useRef<HTMLInputElement>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const spaceHeldRef = useRef(false);
  const marqueeRef = useRef<{ sx: number; sy: number } | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [bgContextMenu, setBgContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [splitV, setSplitV] = useState(0);
  const [splitH, setSplitH] = useState(0);
  const [cropMode, setCropMode] = useState<{ imageId: string; rect: CropRect; offsetOnly?: boolean; followerIds?: string[] } | null>(null);
  const [maskMode, setMaskMode] = useState<{ imageId: string } | null>(null);
  const [sliceMode, setSliceMode] = useState(false);
  const [slicePreview, setSlicePreview] = useState<{ imageId: string; axis: 'vertical' | 'horizontal'; cutAt: number } | null>(null);
  // Held-key axis lock for the knife. Refs (not state) so the pointer move
  // handler reads the latest value without rebinding; key handlers also
  // recompute the preview from the last cursor position on press/release.
  const forceVerticalRef = useRef(false);
  const forceHorizontalRef = useRef(false);
  const lastSliceCursorRef = useRef<{ wx: number; wy: number } | null>(null);
  const [hideEditSource, setHideEditSource] = useState(true);
  useEffect(() => { if (!maskMode) setHideEditSource(true); }, [maskMode]);
  const [paintImportFile, setPaintImportFile] = useState<{ file: File; mode: 'fit' | 'stretch' | 'original' } | null>(null);
  const [paintDropMenu, setPaintDropMenu] = useState<{ file: File; x: number; y: number } | null>(null);
  const [canvasInfoIssues, setCanvasInfoIssues] = useState<CanvasInfoIssues | null>(null);
  const [rulersVisible, setRulersVisible] = useState(() => loadConfig().showRulers);
  const [flipbookOpen, setFlipbookOpen] = useState(false);
  const [infoPanelPos, setInfoPanelPos] = useState<{ x: number; y: number } | null>(null);
  const [batchRenameOpen, setBatchRenameOpen] = useState(false);
  const [batchRenamePrefix, setBatchRenamePrefix] = useState<string | undefined>();
  const [exportOpen, setExportOpen] = useState(false);
  const [hamburgerOpen, setHamburgerOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [scaleFilterPrompt, setScaleFilterPrompt] = useState<string | null>(null);
  const [paintHistory, setPaintHistory] = useState<{ undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean } | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [userConfig, setUserConfig] = useState<UserConfig>(loadConfig);
  const [welcomeOpen, setWelcomeOpen] = useState(() => loadConfig().showWelcome !== false);
  const [showGrid, setShowGrid] = useState(() => loadConfig().showGrid);
  const [activeTool, setActiveTool] = useState<'pointer' | 'text'>('pointer');
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  // Safety: if the node being edited vanishes (undo, project load), drop the
  // stale edit state so it can't keep blocking empty-space clicks.
  useEffect(() => {
    if (editingTextId && !state.images.some((i) => i.id === editingTextId)) {
      setEditingTextId(null);
    }
  }, [editingTextId, state.images]);
  const resetPanelPosRef = useRef<(() => void) | null>(null);
  const [attachDrag, setAttachDrag] = useState<{ sourceId: string; cursorX: number; cursorY: number } | null>(null);
  const attachDragRef = useRef<{ sourceId: string } | null>(null);
  const guideDragRef = useRef<{ guideId: string; axis: 'x' | 'y' } | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const prevSelectionRef = useRef<string>('');

  // AI feature state
  const [aiTextToImageOpen, setAiTextToImageOpen] = useState(false);
  const [aiComfyOpen, setAiComfyOpen] = useState(false);
  const [aiComfyWorkflow, setAiComfyWorkflow] = useState<string>('');
  const [aiComfyInputs, setAiComfyInputs] = useState<Record<string, string | number>>({});
  const [aiChatOpen, setAiChatOpen] = useState(false);
  // Last AI output's placement — batch outputs chain to the right of it
  const lastAiOutputRef = useRef<{ x: number; y: number; w: number } | null>(null);
  // Per-element rasterize-preview snapshots (display-resolution renders shown
  // in place of the full-res source). One-time snapshots, not live — freed on
  // untoggle or element removal.
  const [rasterPreviews, setRasterPreviews] = useState<Map<string, { url: string; w: number; h: number }>>(new Map());
  const [aiChatDragged, setAiChatDragged] = useState(false);
  const [aiChatMessages, setAiChatMessages] = useState<ChatMessage[]>([]);
  const [aiChatProvider, setAiChatProvider] = useState(() => {
    const cfg = loadConfig();
    if (cfg.anthropicApiKey) return 'anthropic';
    if (cfg.googleGenaiApiKey) return 'google';
    if (cfg.openaiApiKey) return 'openai';
    if (cfg.xaiApiKey) return 'xai';
    return 'anthropic';
  });
  const [aiProgress, setAiProgress] = useState<{ message: string; progress?: number } | null>(null);
  const [trashFlash, setTrashFlash] = useState(false);
  const aiModalPosition = useAlignedPosition(rulersVisible, aiChatOpen, !aiChatDragged);
  const [aiTextToImagePrompt, setAiTextToImagePrompt] = useState('');

  // Apply saved preferences on startup
  useEffect(() => {
    const cfg = userConfig;
    const theme = themes[cfg.theme];
    if (theme) {
      let accent = cfg.accentColor;
      if (cfg.randomizeAccent) {
        const presets = ['#667eea', '#9b59b6', '#1abc9c', '#2ecc71', '#e67e22', '#e74c3c', '#e91e8b'];
        accent = presets[Math.floor(Math.random() * presets.length)]!;
      }
      const applied = accent
        ? { ...theme, colors: { ...theme.colors, primary: accent } }
        : theme;
      applyTheme(applied);
    }
    dispatch({ type: 'SET_SCALE_FILTER', filter: cfg.defaultScaleFilter });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Warn before closing if the workspace has content
  useEffect(() => {
    if (state.images.length === 0) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state.images.length]);

  const pngChunkDetectedRef = useRef(false);

  const handleScaleFilterDetected = useCallback((detected: string) => {
    pngChunkDetectedRef.current = true;
    if (detected !== stateRef.current.scaleFilter) {
      setScaleFilterPrompt(detected);
    }
  }, []);

  const handleImageSize = useCallback((w: number, h: number) => {
    if (!userConfig.scaleOverride) return;
    if (pngChunkDetectedRef.current) return;
    if (stateRef.current.scaleFilter !== 'nearest') return;
    if (w > 1024 || h > 1024) {
      dispatch({ type: 'SET_SCALE_FILTER', filter: 'bicubic' });
    }
  }, [dispatch, userConfig.scaleOverride]);

  // Apply crop using authoritative geometry from CropOverlay (no recomputation drift)
  const applyCrop = useCallback((imageId: string, rect: CropRect, geometry: CropGeometry) => {
    const img = state.images.find((i) => i.id === imageId);
    if (!img) return;

    const { ds, fullX, fullY } = geometry;

    // Full image or no-op? Clear cropRect
    const isFullImage = rect.x === 0 && rect.y === 0 && rect.w === img.naturalWidth && rect.h === img.naturalHeight;

    dispatch({
      type: 'SET_CROP',
      id: imageId,
      cropRect: isFullImage ? undefined : rect,
      width: Math.round(rect.w * ds),
      height: Math.round(rect.h * ds),
      x: Math.round(fullX + rect.x * ds),
      y: Math.round(fullY + rect.y * ds),
    });
    setCropMode(null);
  }, [state.images, dispatch]);

  // Apply offset — only changes cropRect position, node x/y/width/height stay the same
  const applyOffset = useCallback((imageId: string, rect: CropRect, followerIds?: string[]) => {
    const img = state.images.find((i) => i.id === imageId);
    if (!img || !img.cropRect) return;

    // Compute delta in display pixels (workspace coords) so it's pixel-perfect across sizes
    const primaryDs = img.width / img.cropRect.w;
    const displayDx = (rect.x - img.cropRect.x) * primaryDs;
    const displayDy = (rect.y - img.cropRect.y) * primaryDs;

    dispatch({
      type: 'SET_CROP',
      id: imageId,
      cropRect: rect,
      width: img.width,
      height: img.height,
      x: img.x,
      y: img.y,
    });

    // Convert display-pixel delta into each follower's natural-pixel space
    if (followerIds) {
      for (const fid of followerIds) {
        const f = state.images.find((i) => i.id === fid);
        if (!f || !f.cropRect) continue;
        const fDs = f.width / f.cropRect.w;
        const fDx = displayDx / fDs;
        const fDy = displayDy / fDs;
        const newRect = {
          x: Math.max(0, Math.min(Math.round(f.cropRect.x + fDx), f.naturalWidth - f.cropRect.w)),
          y: Math.max(0, Math.min(Math.round(f.cropRect.y + fDy), f.naturalHeight - f.cropRect.h)),
          w: f.cropRect.w,
          h: f.cropRect.h,
        };
        dispatch({
          type: 'SET_CROP',
          id: fid,
          cropRect: newRect,
          width: f.width,
          height: f.height,
          x: f.x,
          y: f.y,
        });
      }
    }

    setCropMode(null);
  }, [state.images, dispatch]);

  // --- Attach drag ---
  const handleAttachDragStart = useCallback((sourceId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    attachDragRef.current = { sourceId };
    setAttachDrag({ sourceId, cursorX: e.clientX, cursorY: e.clientY });

    const handleMove = (ev: PointerEvent) => {
      setAttachDrag((prev) => prev ? { ...prev, cursorX: ev.clientX, cursorY: ev.clientY } : null);
    };

    const handleUp = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);

      const ref = attachDragRef.current;
      if (!ref) { setAttachDrag(null); return; }
      attachDragRef.current = null;

      // Use fresh state from ref (avoids stale closure)
      const s = stateRef.current;
      const vRect = viewportRef.current?.getBoundingClientRect();
      const wx = (ev.clientX - (vRect?.left ?? 0) - s.pan.x) / s.zoom;
      const wy = (ev.clientY - (vRect?.top ?? 0) - s.pan.y) / s.zoom;

      // Find element under cursor in workspace coords (top-most first)
      const sorted = [...s.images].sort((a, b) => b.zIndex - a.zIndex);
      let targetId: string | null = null;
      for (const img of sorted) {
        if (img.id === ref.sourceId) continue;
        if (wx >= img.x && wx <= img.x + img.width && wy >= img.y && wy <= img.y + img.height) {
          targetId = img.id;
          break;
        }
      }

      if (targetId) {
        dispatch({ type: 'SNAPSHOT' });
        // Source is the parent, target (dropped on) becomes the child
        dispatch({ type: 'ATTACH_TO_PARENT', childId: targetId, parentId: ref.sourceId });
      }
      setAttachDrag(null);
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  }, [dispatch]);

  // Update document title with project name
  useEffect(() => {
    document.title = state.projectName ? `${state.projectName} — Layout Manager` : 'Layout Manager';
  }, [state.projectName]);

  // Reset split values and exit crop mode when selection changes
  useEffect(() => {
    const key = Array.from(state.selectedIds).sort().join(',');
    if (key !== prevSelectionRef.current) {
      prevSelectionRef.current = key;
      setSplitV(0);
      setSplitH(0);
      setCropMode(null);
      setMaskMode(null);
      // Slice mode requires exactly one non-text image to stay valid. Allow it
      // to persist across selection changes that still resolve to a single
      // element so chained slices on freshly-cut pieces don't kill the mode.
      if (state.selectedIds.size !== 1) {
        setSliceMode(false);
      }
      setSlicePreview(null);
    }
  }, [state.selectedIds]);

  // --- Keyboard ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block all workspace shortcuts when AI modals are open
      if (aiTextToImageOpen || aiChatOpen || aiComfyOpen) {
        const tag = (document.activeElement as HTMLElement)?.tagName;
        const typing = tag === 'TEXTAREA' || tag === 'INPUT' || (document.activeElement as HTMLElement)?.isContentEditable;
        // Exception: Ctrl+Arrow alignment still works while AI panels are open —
        // but never while typing in a prompt field, where Ctrl+Arrow is
        // word-jump text navigation.
        if (!typing && (e.ctrlKey || e.metaKey) && state.selectedIds.size >= 2
          && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          e.preventDefault();
          const ids = Array.from(state.selectedIds);
          const padding = userConfig.alignPadding ?? 0;
          const direction = e.key === 'ArrowUp' ? 'top' : e.key === 'ArrowDown' ? 'bottom' : e.key === 'ArrowLeft' ? 'left' : 'right';
          dispatch({ type: 'ALIGN', direction, ids, padding });
          return;
        }
        // Flash trash buttons if user presses delete/backspace outside a text field
        if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedIds.size > 0) {
          if (!typing) {
            setTrashFlash(true);
            setTimeout(() => setTrashFlash(false), 600);
          }
        }
        return;
      }
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        spaceHeldRef.current = true;
      }
      // Ctrl+Z / Ctrl+Y — route to paint editor when active, otherwise workspace
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (maskMode && paintHistory) paintHistory.undo();
        else if (!cropMode) dispatch({ type: 'UNDO' });
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || e.key === 'y')) {
        e.preventDefault();
        if (maskMode && paintHistory) paintHistory.redo();
        else if (!cropMode) dispatch({ type: 'REDO' });
        return;
      }
      // When in crop or mask mode, block all other workspace shortcuts
      if (cropMode || maskMode) {
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Delete guide if currently dragging one
        if (guideDragRef.current) {
          e.preventDefault();
          dispatch({ type: 'REMOVE_GUIDE', id: guideDragRef.current.guideId });
          guideDragRef.current = null;
        } else if (state.selectedIds.size > 0) {
          e.preventDefault();
          dispatch({ type: 'REMOVE_IMAGES', ids: Array.from(state.selectedIds) });
        }
      }
      // Ctrl+] bring forward, Ctrl+[ send backward
      if (e.ctrlKey && e.key === ']' && state.selectedIds.size === 1) {
        e.preventDefault();
        const id = Array.from(state.selectedIds)[0]!;
        dispatch({ type: 'BRING_FORWARD', id });
      }
      if (e.ctrlKey && e.key === '[' && state.selectedIds.size === 1) {
        e.preventDefault();
        const id = Array.from(state.selectedIds)[0]!;
        dispatch({ type: 'SEND_BACKWARD', id });
      }
      // Ctrl+Arrow: align selection
      if ((e.ctrlKey || e.metaKey) && state.selectedIds.size >= 2) {
        const ids = Array.from(state.selectedIds);
        const padding = userConfig.alignPadding ?? 0;
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          dispatch({ type: 'ALIGN', direction: 'top', ids, padding });
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          dispatch({ type: 'ALIGN', direction: 'bottom', ids, padding });
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          dispatch({ type: 'ALIGN', direction: 'left', ids, padding });
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          dispatch({ type: 'ALIGN', direction: 'right', ids, padding });
        }
      }
      // Arrow keys: nudge selection (without Ctrl/Meta)
      if (!e.ctrlKey && !e.metaKey && state.selectedIds.size > 0) {
        const step = e.shiftKey ? 1 : 10;
        const ids = Array.from(state.selectedIds);
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          dispatch({ type: 'MOVE_IMAGES', ids, dx: 0, dy: -step });
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          dispatch({ type: 'MOVE_IMAGES', ids, dx: 0, dy: step });
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          dispatch({ type: 'MOVE_IMAGES', ids, dx: -step, dy: 0 });
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          dispatch({ type: 'MOVE_IMAGES', ids, dx: step, dy: 0 });
        }
      }
      // T: toggle text tool
      if (e.key === 't' && !e.ctrlKey && !e.metaKey && !e.altKey && !editingTextId) {
        setActiveTool((prev) => prev === 'text' ? 'pointer' : 'text');
      }
      // F: frame selection (or all images if nothing selected)
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const s = stateRef.current;
        const targets =
          s.selectedIds.size > 0
            ? s.images.filter((img) => s.selectedIds.has(img.id))
            : s.images;
        if (targets.length > 0 && viewportRef.current) {
          const rect = viewportRef.current.getBoundingClientRect();
          const minX = Math.min(...targets.map((img) => img.x));
          const minY = Math.min(...targets.map((img) => img.y));
          const maxX = Math.max(...targets.map((img) => img.x + img.width));
          const maxY = Math.max(...targets.map((img) => img.y + img.height));
          const bw = maxX - minX || 1;
          const bh = maxY - minY || 1;
          const padding = 60;
          const scaleX = (rect.width - padding * 2) / bw;
          const scaleY = (rect.height - padding * 2) / bh;
          const newZoom = Math.min(32, Math.max(0.01, Math.min(scaleX, scaleY)));
          const cx = minX + bw / 2;
          const cy = minY + bh / 2;
          const newPanX = rect.width / 2 - cx * newZoom;
          const newPanY = rect.height / 2 - cy * newZoom;
          dispatch({ type: 'SET_ZOOM', zoom: newZoom, pan: { x: newPanX, y: newPanY } });
        }
      }
      // D: duplicate selection
      if (e.key === 'd' && !e.ctrlKey && !e.metaKey && !e.altKey && state.selectedIds.size > 0) {
        e.preventDefault();
        dispatch({ type: 'DUPLICATE_IMAGES', ids: Array.from(state.selectedIds) });
      }
      // Q: toggle onion skin on selection
      if (e.key === 'q' && !e.ctrlKey && !e.metaKey && !e.altKey && state.selectedIds.size > 0) {
        e.preventDefault();
        const ids = Array.from(state.selectedIds);
        const currentImages = stateRef.current.images;
        const selected = currentImages.filter((img) => ids.includes(img.id));
        const allOnion = selected.every((img) => img.opacity < 1);
        dispatch({ type: 'SET_OPACITY', ids, opacity: allOnion ? 1 : 0.6 });
      }
      // S: toggle snapping
      if (e.key === 's' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        dispatch({ type: 'SET_SNAP', enabled: !state.snapEnabled });
      }
      // K: toggle slice tool when a single non-text non-locked image is selected
      if (e.key === 'k' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const onlyId = state.selectedIds.size === 1 ? Array.from(state.selectedIds)[0] : null;
        const onlyImg = onlyId ? state.images.find((i) => i.id === onlyId) : null;
        if (onlyImg && onlyImg.nodeType !== 'text' && !onlyImg.locked) {
          e.preventDefault();
          setSliceMode((v) => !v);
          setSlicePreview(null);
        }
      }
      // Ctrl+A select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        dispatch({ type: 'SELECT_ALL' });
      }
      // Ctrl+Shift+S save project as
      // (read from stateRef — the effect's dep list doesn't cover every field
      // used here, so `state` alone can be stale, e.g. a null projectName that
      // made Ctrl+S behave like Save As)
      if ((e.ctrlKey || e.metaKey) && e.key === 'S' && e.shiftKey) {
        e.preventDefault();
        const s = stateRef.current;
        saveProjectAs(s.images, s.pan, s.zoom, s.canvas, s.scaleFilter, s.guides, s.canvasBgColor).then((result) => {
          if (result) dispatch({ type: 'SET_PROJECT_NAME', name: result.name });
        });
      }
      // Ctrl+S save project
      else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const s = stateRef.current;
        saveProject(s.images, s.pan, s.zoom, s.canvas, s.scaleFilter, s.projectName, s.guides, s.canvasBgColor).then((result) => {
          if (result) dispatch({ type: 'SET_PROJECT_NAME', name: result.name });
        });
      }
      // Ctrl+O open project
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        projectInputRef.current?.click();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        setExportOpen(true);
      }
      // C: enter crop mode for single selection
      if (e.key === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (state.selectedIds.size === 1) {
          const selId = Array.from(state.selectedIds)[0]!;
          const img = state.images.find((i) => i.id === selId);
          if (img && !img.locked) {
            e.preventDefault();
            setMaskMode(null);
            setCropMode({
              imageId: img.id,
              rect: img.cropRect
                ? { ...img.cropRect }
                : { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight },
            });
          }
        }
      }
      // O: enter offset mode (single or multi-selection with existing crops)
      if (e.key === 'o' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (state.selectedIds.size >= 1) {
          const selIds = Array.from(state.selectedIds);
          const eligible = selIds.filter((id) => {
            const img = state.images.find((i) => i.id === id);
            return img && !img.locked && img.cropRect;
          });
          if (eligible.length > 0) {
            const primaryId = eligible[0]!;
            const primaryImg = state.images.find((i) => i.id === primaryId)!;
            e.preventDefault();
            setCropMode({
              imageId: primaryImg.id,
              rect: { ...primaryImg.cropRect! },
              offsetOnly: true,
              followerIds: eligible.slice(1),
            });
          }
        }
      }
      // M: enter mask mode for single selection
      if (e.key === 'm' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (state.selectedIds.size === 1) {
          const selId = Array.from(state.selectedIds)[0]!;
          const img = state.images.find((i) => i.id === selId);
          if (img && !img.locked) {
            e.preventDefault();
            setCropMode(null);
            setMaskMode({ imageId: img.id });
          }
        }
      }
      if (e.key === 'Escape') {
        setContextMenu(null);
        if (sliceMode) {
          setSliceMode(false);
          setSlicePreview(null);
        }
      }
      // V / H: lock the knife cut to that axis while held. Recompute the
      // preview from the last cursor position so the line flips immediately
      // without requiring the user to wiggle the mouse.
      if (sliceMode && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat) {
        if (e.key === 'v' || e.key === 'V') {
          forceVerticalRef.current = true;
          const last = lastSliceCursorRef.current;
          if (last) setSlicePreview(computeSlicePreview(last.wx, last.wy));
        } else if (e.key === 'h' || e.key === 'H') {
          forceHorizontalRef.current = true;
          const last = lastSliceCursorRef.current;
          if (last) setSlicePreview(computeSlicePreview(last.wx, last.wy));
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        spaceHeldRef.current = false;
      }
      if (e.key === 'v' || e.key === 'V') {
        forceVerticalRef.current = false;
        if (sliceMode) {
          const last = lastSliceCursorRef.current;
          if (last) setSlicePreview(computeSlicePreview(last.wx, last.wy));
        }
      } else if (e.key === 'h' || e.key === 'H') {
        forceHorizontalRef.current = false;
        if (sliceMode) {
          const last = lastSliceCursorRef.current;
          if (last) setSlicePreview(computeSlicePreview(last.wx, last.wy));
        }
      }
    };
    const handlePaste = (e: ClipboardEvent) => {
      // Don't intercept paste when typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) {
            const centerX = (window.innerWidth / 2 - state.pan.x) / state.zoom;
            const centerY = (window.innerHeight / 2 - state.pan.y) / state.zoom;
            addImageFromFile(
              new File([blob], `pasted-image.${item.type.split('/')[1] || 'png'}`, { type: item.type }),
              centerX,
              centerY,
            );
          }
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('paste', handlePaste);
    };
    // computeSlicePreview is intentionally not in deps (it's declared later in
    // the file — listing it would TDZ-error). Its inputs (selectedIds, images,
    // scaleFilter) are all in this dep list, so re-runs always re-capture a
    // fresh callback.
  }, [dispatch, state.selectedIds, state.snapEnabled, state.images, state.scaleFilter, cropMode, maskMode, sliceMode, paintHistory, state.pan, state.zoom, addImageFromFile, userConfig.alignPadding]);

  // --- Zoom (native listener to allow preventDefault on non-passive wheel) ---
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (e: WheelEvent) => {
      // Don't zoom when scrolling inside paint editor panels
      const target = e.target as HTMLElement;
      if (target.closest('.paint-layer-list, .paint-options-bar, .paint-color-picker')) return;
      e.preventDefault();
      const rect = viewport.getBoundingClientRect();

      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newZoom = Math.min(32, Math.max(0.01, state.zoom * factor));

      const wx = (cursorX - state.pan.x) / state.zoom;
      const wy = (cursorY - state.pan.y) / state.zoom;

      const newPanX = cursorX - wx * newZoom;
      const newPanY = cursorY - wy * newZoom;

      dispatch({ type: 'SET_ZOOM', zoom: newZoom, pan: { x: newPanX, y: newPanY } });
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [dispatch, state.zoom, state.pan]);

  // --- Pan & Marquee ---
  const handleViewportPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Close context menu on any click
      setContextMenu(null);

      const isMiddle = e.button === 1;
      const isSpaceLeft = e.button === 0 && spaceHeldRef.current;

      if (isMiddle || isSpaceLeft) {
        e.preventDefault();
        isPanningRef.current = true;
        panStartRef.current = {
          sx: e.clientX,
          sy: e.clientY,
          px: state.pan.x,
          py: state.pan.y,
        };
        viewportRef.current?.setPointerCapture(e.pointerId);
        return;
      }

      // Don't deselect or start marquee while in mask or crop mode
      if (maskMode || cropMode) return;

      // Text tool — click on empty space to create a text node
      if (
        activeTool === 'text' &&
        e.button === 0 &&
        (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('workspace-canvas'))
      ) {
        e.preventDefault();
        const rect = viewportRef.current?.getBoundingClientRect();
        if (rect) {
          const wx = (e.clientX - rect.left - state.pan.x) / state.zoom;
          const wy = (e.clientY - rect.top - state.pan.y) / state.zoom;
          const id = 'text-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
          // Measure default text to set initial size
          const measureCtx = document.createElement('canvas').getContext('2d')!;
          measureCtx.font = '24px sans-serif';
          const metrics = measureCtx.measureText('Text');
          const textW = Math.max(60, Math.ceil(metrics.width) + 8);
          const lineH = (metrics.fontBoundingBoxAscent ?? 24) + (metrics.fontBoundingBoxDescent ?? 6);
          const textH = Math.ceil(lineH * 1.4);
          const newNode = {
            id,
            src: '',
            fileName: '',
            x: wx,
            y: wy,
            width: textW,
            height: textH,
            naturalWidth: textW,
            naturalHeight: textH,
            rotation: 0,
            zIndex: 0,
            locked: false,
            opacity: 1,
            spriteName: '',
            parentId: null,
            basePosition: null,
            offsetPosition: null,
            layerOrder: 'above' as const,
            replacesParent: false,
            flipH: false,
            flipV: false,
            nodeType: 'text' as const,
            text: 'Text',
            fontFamily: 'sans-serif',
            fontSize: 24,
            fontBold: false,
            fontItalic: false,
            fontUnderline: false,
            textAlign: 'left' as const,
            textColor: userConfig.theme === 'Light' ? '#000000' : '#ffffff',
            textAutoWidth: true,
          };
          dispatch({ type: 'SNAPSHOT' });
          dispatch({ type: 'ADD_IMAGE', image: newNode });
          dispatch({ type: 'SELECT', id, additive: false });
          setActiveTool('pointer');
          setEditingTextId(id);
        }
        return;
      }

      // Left click on empty space -> start marquee selection (deselect happens on pointer up if nothing selected)
      if (
        e.button === 0 &&
        (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('workspace-canvas'))
      ) {
        // While a workspace text element is being edited, ignore empty-space
        // clicks entirely: preventDefault keeps focus (and the caret) in the
        // text editor, and skipping the marquee keeps the element selected so
        // the Confirm Text panel stays available. Edit mode ends only via
        // Confirm Text, Ctrl+Enter, or Escape.
        if (editingTextId) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        marqueeRef.current = { sx: e.clientX, sy: e.clientY };
        setMarquee({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
        viewportRef.current?.setPointerCapture(e.pointerId);
        return;
      }
    },
    [dispatch, state.pan, state.zoom, maskMode, cropMode, activeTool, editingTextId],
  );

  /** Compute the slice preview for the currently-selected single image, given a
   *  workspace cursor position. Returns null when the cursor is outside the
   *  element or in the corner ambiguity zone. The cut runs perpendicular to the
   *  closer edge type — near top/bottom → vertical cut at cursor X; near
   *  left/right → horizontal cut at cursor Y. */
  const computeSlicePreview = useCallback((wx: number, wy: number) => {
    if (state.selectedIds.size !== 1) return null;
    const id = Array.from(state.selectedIds)[0]!;
    const img = state.images.find((i) => i.id === id);
    if (!img || img.nodeType === 'text' || img.locked) return null;
    const lx = wx - img.x;
    const ly = wy - img.y;
    if (lx < 0 || lx > img.width || ly < 0 || ly > img.height) return null;
    const minH = Math.min(ly, img.height - ly); // distance to nearest horizontal edge
    const minV = Math.min(lx, img.width - lx);  // distance to nearest vertical edge
    // In nearest-neighbor mode, snap the cut to natural-pixel boundaries so
    // the preview line lands exactly where pixel-art chunks meet. sliceImage
    // already rounds to natural pixels — this just makes the visual match.
    let cutVert = lx;
    let cutHoriz = ly;
    if (state.scaleFilter === 'nearest') {
      const region = img.cropRect ?? { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
      const dsX = img.width / region.w;
      const dsY = img.height / region.h;
      if (dsX > 0) cutVert = Math.round(lx / dsX) * dsX;
      if (dsY > 0) cutHoriz = Math.round(ly / dsY) * dsY;
    }
    // Held V or H locks the cut to that axis regardless of edge proximity.
    // V wins if both are held.
    if (forceVerticalRef.current) {
      return { imageId: id, axis: 'vertical' as const, cutAt: cutVert };
    }
    if (forceHorizontalRef.current) {
      return { imageId: id, axis: 'horizontal' as const, cutAt: cutHoriz };
    }
    // No corner dead-zone — always commit to a direction. Closer-edge wins;
    // on exact ties, fall through to a horizontal cut.
    if (minH < minV) {
      return { imageId: id, axis: 'vertical' as const, cutAt: cutVert };
    }
    return { imageId: id, axis: 'horizontal' as const, cutAt: cutHoriz };
  }, [state.selectedIds, state.images, state.scaleFilter]);

  const handleSlicePointerMove = useCallback((e: React.PointerEvent) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const wx = (e.clientX - rect.left - state.pan.x) / state.zoom;
    const wy = (e.clientY - rect.top - state.pan.y) / state.zoom;
    lastSliceCursorRef.current = { wx, wy };
    setSlicePreview(computeSlicePreview(wx, wy));
  }, [state.pan.x, state.pan.y, state.zoom, computeSlicePreview]);

  const handleSlicePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const wx = (e.clientX - rect.left - state.pan.x) / state.zoom;
    const wy = (e.clientY - rect.top - state.pan.y) / state.zoom;
    const preview = computeSlicePreview(wx, wy);
    if (!preview) return;
    const img = state.images.find((i) => i.id === preview.imageId);
    if (!img) return;
    const pieces = sliceImage(img, preview.axis, preview.cutAt);
    if (pieces.length !== 2) return;
    e.preventDefault();
    e.stopPropagation();
    // Single-select the larger piece so the user can keep trimming small chunks
    // off the same chunk without manually reselecting after each slice.
    const larger = (pieces[0]!.width * pieces[0]!.height) >= (pieces[1]!.width * pieces[1]!.height)
      ? pieces[0]!
      : pieces[1]!;
    dispatch({ type: 'SPLIT_IMAGE', originalId: img.id, pieces });
    dispatch({ type: 'SELECT', id: larger.id, additive: false });
    setSlicePreview(null);
  }, [state.pan.x, state.pan.y, state.zoom, state.images, computeSlicePreview, dispatch]);

  const handleViewportPointerMove = useCallback(
    (e: React.PointerEvent) => {
      // Marquee drag
      if (marqueeRef.current) {
        const sx = marqueeRef.current.sx;
        const sy = marqueeRef.current.sy;
        const cx = e.clientX;
        const cy = e.clientY;
        setMarquee({
          x: Math.min(sx, cx),
          y: Math.min(sy, cy),
          w: Math.abs(cx - sx),
          h: Math.abs(cy - sy),
        });
        return;
      }

      // Pan drag
      if (!isPanningRef.current || !panStartRef.current) return;
      const dx = e.clientX - panStartRef.current.sx;
      const dy = e.clientY - panStartRef.current.sy;
      dispatch({
        type: 'SET_PAN',
        pan: { x: panStartRef.current.px + dx, y: panStartRef.current.py + dy },
      });
    },
    [dispatch],
  );

  const handleViewportPointerUp = useCallback(
    (e: React.PointerEvent) => {
      // Finish marquee selection
      if (marqueeRef.current && marquee) {
        const rect = viewportRef.current?.getBoundingClientRect();
        if (rect) {
          // Convert marquee screen rect to workspace coordinates
          const mLeft = (marquee.x - rect.left - state.pan.x) / state.zoom;
          const mTop = (marquee.y - rect.top - state.pan.y) / state.zoom;
          const mRight = mLeft + marquee.w / state.zoom;
          const mBottom = mTop + marquee.h / state.zoom;

          // Find all images whose bounding box intersects the marquee
          const hitIds = state.images
            .filter((img) => {
              const iLeft = img.x;
              const iTop = img.y;
              const iRight = img.x + img.width;
              const iBottom = img.y + img.height;
              return iLeft < mRight && iRight > mLeft && iTop < mBottom && iBottom > mTop;
            })
            .map((img) => img.id);

          if (hitIds.length > 0) {
            dispatch({ type: 'SELECT_MULTIPLE', ids: hitIds, additive: e.ctrlKey || e.metaKey });
          } else if (!e.ctrlKey && !e.metaKey) {
            dispatch({ type: 'SELECT_NONE' });
          }
        }
        marqueeRef.current = null;
        setMarquee(null);
        return;
      }

      isPanningRef.current = false;
      panStartRef.current = null;
    },
    [dispatch, marquee, state.images, state.pan, state.zoom],
  );

  // Click on the canvas (inner div) empty area - let it bubble to viewport for marquee
  const handleCanvasPointerDown = useCallback(
    (_e: React.PointerEvent) => {
      // Marquee selection and deselect are handled by the viewport pointer handlers
    },
    [],
  );

  // --- Drop ---
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Show drop overlay for external file drags or image URLs from other browser windows
    const types = e.dataTransfer.types;
    if (types.includes('Files') || types.includes('text/uri-list') || types.includes('text/plain')) {
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only handle if actually leaving the viewport
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Capture the URI list synchronously — the dataTransfer may be cleared
      // once this handler yields to an await.
      const dropUris = (e.dataTransfer.getData('text/uri-list') ?? '')
        .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

      // For a single dropped .layout, also grab a writable file handle where the
      // File System Access API exists (Chrome/Edge; Brave needs its flag). Must
      // be initiated synchronously, before any await invalidates the items.
      let layoutHandlePromise: Promise<FileSystemFileHandle | null> | null = null;
      if (e.dataTransfer.files.length === 1 && e.dataTransfer.files[0]!.name.endsWith('.layout')) {
        const item = e.dataTransfer.items[0] as DataTransferItem & { getAsFileSystemHandle?: () => Promise<FileSystemFileHandle> };
        layoutHandlePromise = item.getAsFileSystemHandle?.().catch(() => null) ?? null;
      }

      // Check for directory entries and recursively collect files.
      // Entries must be collected synchronously — the dataTransfer items are
      // invalidated as soon as this handler yields to an await.
      const entries = Array.from(e.dataTransfer.items)
        .map((item) => item.webkitGetAsEntry?.() ?? null)
        .filter((entry): entry is FileSystemEntry => entry !== null);
      const hasDirectory = entries.some((entry) => entry.isDirectory);

      let allFiles: File[];
      if (hasDirectory) {
        // Recursively read all files from directories and top-level files
        const readEntry = (entry: FileSystemEntry): Promise<File[]> => {
          if (entry.isFile) {
            return new Promise((resolve) => {
              (entry as FileSystemFileEntry).file((f) => resolve([f]), () => resolve([]));
            });
          }
          if (entry.isDirectory) {
            return new Promise((resolve) => {
              const reader = (entry as FileSystemDirectoryEntry).createReader();
              const files: File[] = [];
              const readBatch = () => {
                reader.readEntries(async (entries) => {
                  if (entries.length === 0) {
                    resolve(files);
                    return;
                  }
                  for (const e of entries) {
                    files.push(...await readEntry(e));
                  }
                  readBatch(); // readEntries may paginate
                }, () => resolve(files));
              };
              readBatch();
            });
          }
          return Promise.resolve([]);
        };
        const collected: File[] = [];
        for (const entry of entries) {
          collected.push(...await readEntry(entry));
        }
        allFiles = collected;
      } else {
        allFiles = Array.from(e.dataTransfer.files);
      }

      const imageFiles = allFiles.filter(isAcceptedImage);
      const layoutFiles = allFiles.filter((f) => f.name.endsWith('.layout'));
      const jsonFiles = allFiles.filter((f) => f.name.endsWith('.json'));

      // In paint/mask mode: show import menu for single image
      if (maskMode && imageFiles.length === 1 && layoutFiles.length === 0 && jsonFiles.length === 0) {
        setPaintDropMenu({ file: imageFiles[0]!, x: e.clientX, y: e.clientY });
        return;
      }

      // If ONLY a .layout file was dropped (no images, no other files)
      if (layoutFiles.length === 1 && imageFiles.length === 0) {
        const layoutFile = layoutFiles[0]!;
        // If workspace has content, confirm before replacing
        if (state.images.length > 0) {
          const confirmed = window.confirm(
            'Opening this project will replace your current work.\n\nAre you sure you want to open "' + layoutFile.name + '"?',
          );
          if (!confirmed) return;
        }
        try {
          const project = await loadProject(layoutFile);
          // Remember where this project lives so Ctrl+S saves in place:
          // prefer a real file handle (Chromium + FS Access API), else a
          // file:// path from the URI list (sources that provide one).
          const handle = layoutHandlePromise ? await layoutHandlePromise : null;
          if (handle?.kind === 'file') {
            setCurrentFileHandle(handle);
          } else {
            const fileUri = dropUris.find((u) => /^file:\/\//i.test(u) && u.toLowerCase().endsWith('.layout'));
            if (fileUri) {
              try { setCurrentFilePath(decodeURIComponent(new URL(fileUri).pathname)); } catch { /* ignore bad URI */ }
            }
          }
          dispatch({
            type: 'LOAD_PROJECT',
            images: project.images,
            pan: project.pan,
            zoom: project.zoom,
            canvas: project.canvas,
            scaleFilter: project.scaleFilter,
            projectName: layoutFile.name,
            guides: project.guides,
            canvasBgColor: project.canvasBgColor,
          });
        } catch (err) {
          console.error('Failed to load project:', err);
        }
        return;
      }

      // If a .json file + exactly one image were dropped, treat as sprite sheet import
      if (jsonFiles.length === 1 && imageFiles.length === 1) {
        const jsonFile = jsonFiles[0]!;
        const imageFile = imageFiles[0]!;
        if (state.images.length > 0) {
          const confirmed = window.confirm(
            'Importing this sprite sheet will replace your current work.\n\nAre you sure you want to import "' + jsonFile.name + '"?',
          );
          if (!confirmed) return;
        }
        try {
          const result = await importSpriteSheet(jsonFile, imageFile);
          setCurrentFileHandle(null);
          setCurrentFilePath(null);
          dispatch({
            type: 'LOAD_PROJECT',
            images: result.images,
            pan: { x: 0, y: 0 },
            zoom: 1,
            canvas: result.canvas,
            projectName: jsonFile.name.replace(/\.json$/, ''),
          });
        } catch (err) {
          console.error('Failed to import sprite sheet:', err);
        }
        return;
      }

      // Otherwise import images only (ignore any .layout / .json files mixed in)
      if (imageFiles.length === 0) {
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const wx = (screenX - state.pan.x) / state.zoom;
        const wy = (screenY - state.pan.y) / state.zoom;

        // Check dataTransfer.items for image blobs the browser already has in memory
        // (works even when the file's MIME wasn't in our ACCEPTED_TYPES list)
        for (const item of Array.from(e.dataTransfer.items)) {
          if (item.kind === 'file' && item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              addImageFromFile(file, wx, wy);
              return;
            }
          }
        }

        // No image blob — try to get a URL (e.g. dragged from another browser tab).
        // Prefer <img src> from HTML data (actual image URL) over text/uri-list (may be a page URL).
        let url: string | undefined;
        const html = e.dataTransfer.getData('text/html');
        if (html) {
          const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
          if (m) { const t = document.createElement('textarea'); t.innerHTML = m[1]!; url = t.value; }
        }
        if (!url) {
          // Some sources (apps like Krita, some file managers) provide only a URI
          // list — possibly several file:// entries. Import them all via the proxy.
          const uris = dropUris.filter((u) => /^(https?|file):\/\//i.test(u));
          if (uris.length > 1) {
            uris.forEach((u, i) => addImageFromUrl(u, wx + i * 24, wy + i * 24));
            return;
          }
          url = uris[0];
        }
        if (!url) {
          url = e.dataTransfer.getData('text/plain')?.trim();
        }
        // Extract actual image URL from Google/redirect links
        if (url) {
          try {
            const parsed = new URL(url);
            const imgurl = parsed.searchParams.get('imgurl');
            if (imgurl) url = imgurl;
          } catch { /* not a valid URL, use as-is */ }
        }
        if (url && url.startsWith('data:image/')) {
          // Data URL (e.g. Google inline thumbnail) — import directly as file
          fetch(url).then((r) => r.blob()).then((blob) => {
            addImageFromFile(new File([blob], 'image.png', { type: blob.type }), wx, wy);
          }).catch(() => {});
        } else if (url && /^(https?|file):\/\/.+/i.test(url)) {
          addImageFromUrl(url, wx, wy);
        } else {
          // Nothing importable — log what the drop actually contained so
          // intermittent "import refused" reports can be diagnosed.
          console.warn('[import] Drop produced no importable image.', {
            dataTransferTypes: Array.from(e.dataTransfer.types),
            files: allFiles.map((f) => ({ name: f.name, type: f.type, size: f.size })),
            extractedUrl: url || null,
          });
        }
        return;
      }

      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const wx = (screenX - state.pan.x) / state.zoom;
      const wy = (screenY - state.pan.y) / state.zoom;

      if (imageFiles.length === 1) {
        pngChunkDetectedRef.current = false;
        addImageFromFile(imageFiles[0]!, wx, wy, handleScaleFilterDetected, handleImageSize);
      } else {
        addImagesFromFiles(imageFiles, wx, wy, handleScaleFilterDetected);
      }
    },
    [addImageFromFile, addImagesFromFiles, addImageFromUrl, handleScaleFilterDetected, state.pan, state.zoom, state.images.length, dispatch, maskMode],
  );

  // --- File picker ---
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList) return;

      const files = Array.from(fileList).filter(isAcceptedImage);
      if (files.length === 0) return;

      // Place imported files in center of viewport
      const rect = viewportRef.current?.getBoundingClientRect();
      const centerX = rect ? (rect.width / 2 - state.pan.x) / state.zoom : 200;
      const centerY = rect ? (rect.height / 2 - state.pan.y) / state.zoom : 200;

      if (files.length === 1) {
        pngChunkDetectedRef.current = false;
        addImageFromFile(files[0]!, centerX, centerY, handleScaleFilterDetected, handleImageSize);
      } else {
        addImagesFromFiles(files, centerX, centerY, handleScaleFilterDetected);
      }

      // Reset input so same file can be re-selected
      e.target.value = '';
    },
    [addImageFromFile, addImagesFromFiles, handleScaleFilterDetected, state.pan, state.zoom],
  );

  // --- Project file load ---
  const handleProjectFileChange = useCallback(
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

  const handleNewProject = useCallback(() => {
    setCurrentFileHandle(null);
    dispatch({ type: 'NEW_PROJECT' });
  }, [dispatch]);

  // --- Guide line drag (click on guide line in workspace to move/delete it) ---
  const handleGuideDragStart = useCallback((e: React.PointerEvent, guideId: string, axis: 'x' | 'y') => {
    e.stopPropagation();
    e.preventDefault();
    dispatch({ type: 'SNAPSHOT' });
    guideDragRef.current = { guideId, axis };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [dispatch]);

  const handleGuideDragMove = useCallback((e: React.PointerEvent) => {
    const ref = guideDragRef.current;
    if (!ref) return;
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const screenPos = ref.axis === 'x'
      ? e.clientX - rect.left
      : e.clientY - rect.top;
    const offset = ref.axis === 'x' ? state.pan.x : state.pan.y;
    let pos = Math.round((screenPos - offset) / state.zoom);

    // Snap to element edges and canvas edges when snapping is enabled
    if (state.snapEnabled) {
      const SNAP_THRESHOLD = 8;
      const targets: number[] = [];
      for (const img of state.images) {
        if (ref.axis === 'x') {
          targets.push(img.x, img.x + img.width, img.x + img.width / 2);
        } else {
          targets.push(img.y, img.y + img.height, img.y + img.height / 2);
        }
      }
      if (state.canvas) {
        if (ref.axis === 'x') {
          targets.push(0, state.canvas.width, state.canvas.width / 2);
        } else {
          targets.push(0, state.canvas.height, state.canvas.height / 2);
        }
      }
      let bestDist = Infinity;
      let bestPos = pos;
      for (const t of targets) {
        const dist = Math.abs(pos - t);
        if (dist < bestDist && dist <= SNAP_THRESHOLD) {
          bestDist = dist;
          bestPos = t;
        }
      }
      pos = bestPos;
    }

    dispatch({ type: 'MOVE_GUIDE', id: ref.guideId, position: pos });
  }, [dispatch, state.pan, state.zoom, state.snapEnabled, state.images, state.canvas]);

  const handleGuideDragUp = useCallback((e: React.PointerEvent) => {
    const ref = guideDragRef.current;
    if (!ref) return;
    guideDragRef.current = null;
    // Delete if dragged back onto a ruler
    const RULER_SIZE = 20;
    if (e.clientY < RULER_SIZE || e.clientX < RULER_SIZE) {
      dispatch({ type: 'REMOVE_GUIDE', id: ref.guideId });
    }
  }, [dispatch]);

  const handleImportSpriteSheet = useCallback(async () => {
    // Use showOpenFilePicker if available for multi-select, otherwise fall back to sequential inputs
    if ('showOpenFilePicker' in window) {
      try {
        const handles = await (window as any).showOpenFilePicker({
          types: [
            {
              description: 'Sprite Sheet (JSON + Image)',
              accept: {
                'application/json': ['.json'],
                'image/png': ['.png'],
                'image/jpeg': ['.jpg', '.jpeg'],
                'image/webp': ['.webp'],
              },
            },
          ],
          multiple: true,
        });
        const files: File[] = await Promise.all(handles.map((h: any) => h.getFile()));
        const jsonFile = files.find((f: File) => f.name.endsWith('.json'));
        const imageFile = files.find((f: File) => /\.(png|jpe?g|webp)$/i.test(f.name));
        if (!jsonFile || !imageFile) {
          alert('Please select both a .json file and an image file (.png, .jpg, .webp).');
          return;
        }
        const result = await importSpriteSheet(jsonFile, imageFile);
        setCurrentFileHandle(null);
        dispatch({
          type: 'LOAD_PROJECT',
          images: result.images,
          pan: { x: 0, y: 0 },
          zoom: 1,
          canvas: result.canvas,
          projectName: jsonFile.name.replace(/\.json$/, ''),
        });
      } catch (e: any) {
        if (e.name !== 'AbortError') console.error('Failed to import sprite sheet:', e);
      }
    } else {
      // Fallback: use hidden file input
      spriteSheetInputRef.current?.click();
    }
  }, [dispatch]);

  const handleSpriteSheetFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      const jsonFile = files.find((f) => f.name.endsWith('.json'));
      const imageFile = files.find((f) => /\.(png|jpe?g|webp)$/i.test(f.name));
      if (!jsonFile || !imageFile) {
        alert('Please select both a .json file and an image file (.png, .jpg, .webp).');
        e.target.value = '';
        return;
      }
      try {
        const result = await importSpriteSheet(jsonFile, imageFile);
        setCurrentFileHandle(null);
        dispatch({
          type: 'LOAD_PROJECT',
          images: result.images,
          pan: { x: 0, y: 0 },
          zoom: 1,
          canvas: result.canvas,
          projectName: jsonFile.name.replace(/\.json$/, ''),
        });
      } catch (err) {
        console.error('Failed to import sprite sheet:', err);
      }
      e.target.value = '';
    },
    [dispatch],
  );

  // --- Context menu ---
  const handleContextMenu = useCallback(
    (e: React.PointerEvent | React.MouseEvent, imageId: string) => {
      setContextMenu({ x: e.clientX, y: e.clientY, imageId });
    },
    [],
  );

  // Save selected images as individual files
  const handleSaveImages = useCallback(async (ids: string[], mode: '1:1' | 'display') => {
    const loadImg = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        const retry = new Image();
        retry.onload = () => resolve(retry);
        retry.onerror = reject;
        retry.src = src;
      };
      img.crossOrigin = 'anonymous';
      img.src = src;
    });

    for (const id of ids) {
      const node = state.images.find((i) => i.id === id);
      if (!node) continue;

      let srcX = 0, srcY = 0, srcW = node.naturalWidth, srcH = node.naturalHeight;
      if (node.cropRect) {
        srcX = node.cropRect.x; srcY = node.cropRect.y;
        srcW = node.cropRect.w; srcH = node.cropRect.h;
      }

      const outW = mode === '1:1' ? srcW : node.width;
      const outH = mode === '1:1' ? srcH : node.height;

      const offscreen = document.createElement('canvas');
      offscreen.width = outW;
      offscreen.height = outH;
      const ctx = offscreen.getContext('2d')!;

      if (state.scaleFilter === 'nearest') {
        ctx.imageSmoothingEnabled = false;
      } else {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
      }

      try {
        // Match on-screen adjustments (brightness/contrast/saturation/hue)
        ctx.filter = adjustmentsFilter(node) ?? 'none';
        // Flat bg color: drawn first so it fills any transparent regions of the layers above.
        if (node.bgColor) {
          ctx.fillStyle = node.bgColor;
          ctx.fillRect(0, 0, outW, outH);
        }

        // Flip is stored on the node as a display transform, not baked into the source.
        // Apply it around the destination's center so saved images match what's on the canvas.
        const hasFlip = node.flipH || node.flipV;
        if (hasFlip) {
          ctx.save();
          ctx.translate(outW / 2, outH / 2);
          ctx.scale(node.flipH ? -1 : 1, node.flipV ? -1 : 1);
          ctx.translate(-outW / 2, -outH / 2);
        }

        if (node.paintCompositeUrl) {
          const compositeImg = await loadImg(node.paintCompositeUrl);
          ctx.drawImage(compositeImg, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
        } else {
          const htmlImg = await loadImg(node.src);
          let drawSource: CanvasImageSource = htmlImg;

          if (node.maskDataUrl) {
            const maskImg = await loadImg(node.maskDataUrl);
            const tmp = document.createElement('canvas');
            tmp.width = node.naturalWidth; tmp.height = node.naturalHeight;
            const tctx = tmp.getContext('2d')!;
            tctx.drawImage(htmlImg, 0, 0);
            tctx.globalCompositeOperation = 'destination-in';
            tctx.drawImage(maskImg, 0, 0);
            drawSource = tmp;
          }

          ctx.drawImage(drawSource, srcX, srcY, srcW, srcH, 0, 0, outW, outH);

          if (node.paintUnderlayUrl) {
            const underlayImg = await loadImg(node.paintUnderlayUrl);
            if (node.maskDataUrl) {
              const maskImg = await loadImg(node.maskDataUrl);
              const tmp = document.createElement('canvas');
              tmp.width = node.naturalWidth; tmp.height = node.naturalHeight;
              const tctx = tmp.getContext('2d')!;
              tctx.drawImage(underlayImg, 0, 0);
              tctx.globalCompositeOperation = 'destination-in';
              tctx.drawImage(maskImg, 0, 0);
              ctx.drawImage(tmp, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
            } else {
              ctx.drawImage(underlayImg, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
            }
          }

          if (node.paintOverlayUrl) {
            const overlayImg = await loadImg(node.paintOverlayUrl);
            ctx.drawImage(overlayImg, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
          }
        }

        if (hasFlip) ctx.restore();

        const blob = await new Promise<Blob | null>((resolve) => {
          offscreen.toBlob((b) => resolve(b), 'image/png');
        });
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const baseName = node.spriteName || node.fileName.replace(/\.[^.]+$/, '') || 'image';
          a.download = `${baseName}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }
      } catch (e) {
        console.error('Failed to save image:', node.fileName, e);
      }
    }
  }, [state.images, state.scaleFilter]);

  // Flatten every pixel-modifying edit (mask, paint, crop, flip, bg color) into
  // a fresh source image. Mirrors the 1:1 export composite pipeline so the result
  // is bit-for-bit what `Save 1:1` would write to disk.
  /** A preview is only informative when the element displays smaller than its
   *  source pixels — upscaled/1:1 elements already show export-true quality. */
  const isDownscaled = useCallback((node: ImageNodeType): boolean => {
    const cw = node.cropRect ? node.cropRect.w : node.naturalWidth;
    const ch = node.cropRect ? node.cropRect.h : node.naturalHeight;
    return node.width < cw - 0.5 || node.height < ch - 0.5;
  }, []);

  /** Render a node at its display resolution — what an export would produce. */
  const rasterizeNodeAtDisplaySize = useCallback(async (node: ImageNodeType): Promise<{ url: string; w: number; h: number } | null> => {
    const loadImg = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('load failed'));
      img.src = src;
    });
    let srcX = 0, srcY = 0, srcW = node.naturalWidth, srcH = node.naturalHeight;
    if (node.cropRect) {
      srcX = node.cropRect.x; srcY = node.cropRect.y;
      srcW = node.cropRect.w; srcH = node.cropRect.h;
    }
    const outW = Math.max(1, Math.round(node.width));
    const outH = Math.max(1, Math.round(node.height));
    const off = document.createElement('canvas');
    off.width = outW;
    off.height = outH;
    const ctx = off.getContext('2d')!;
    if (state.scaleFilter === 'nearest') {
      ctx.imageSmoothingEnabled = false;
    } else {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }
    try {
      ctx.filter = adjustmentsFilter(node) ?? 'none';
      if (node.bgColor) {
        ctx.fillStyle = node.bgColor;
        ctx.fillRect(0, 0, outW, outH);
      }
      const hasFlip = node.flipH || node.flipV;
      if (hasFlip) {
        ctx.save();
        ctx.translate(outW / 2, outH / 2);
        ctx.scale(node.flipH ? -1 : 1, node.flipV ? -1 : 1);
        ctx.translate(-outW / 2, -outH / 2);
      }
      if (node.paintCompositeUrl) {
        const compositeImg = await loadImg(node.paintCompositeUrl);
        ctx.drawImage(compositeImg, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
      } else {
        const htmlImg = await loadImg(node.src);
        let drawSource: CanvasImageSource = htmlImg;
        if (node.maskDataUrl) {
          const maskImg = await loadImg(node.maskDataUrl);
          const tmp = document.createElement('canvas');
          tmp.width = node.naturalWidth; tmp.height = node.naturalHeight;
          const tctx = tmp.getContext('2d')!;
          tctx.drawImage(htmlImg, 0, 0);
          tctx.globalCompositeOperation = 'destination-in';
          tctx.drawImage(maskImg, 0, 0);
          drawSource = tmp;
        }
        ctx.drawImage(drawSource, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
        if (node.paintUnderlayUrl) {
          const underlayImg = await loadImg(node.paintUnderlayUrl);
          ctx.drawImage(underlayImg, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
        }
        if (node.paintOverlayUrl) {
          const overlayImg = await loadImg(node.paintOverlayUrl);
          ctx.drawImage(overlayImg, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
        }
      }
      if (hasFlip) ctx.restore();
      const blob = await new Promise<Blob | null>((resolve) => off.toBlob((b) => resolve(b), 'image/png'));
      if (!blob) return null;
      return { url: URL.createObjectURL(blob), w: outW, h: outH };
    } catch (e) {
      console.error('Rasterize preview failed:', e);
      return null;
    }
  }, [state.scaleFilter]);

  const toggleRasterPreview = useCallback(async (id: string) => {
    const existing = rasterPreviews.get(id);
    if (existing) {
      URL.revokeObjectURL(existing.url);
      setRasterPreviews((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      return;
    }
    const node = stateRef.current.images.find((i) => i.id === id);
    if (!node || node.nodeType === 'text') return;
    const snap = await rasterizeNodeAtDisplaySize(node);
    if (!snap) return;
    setRasterPreviews((prev) => new Map(prev).set(id, snap));
  }, [rasterPreviews, rasterizeNodeAtDisplaySize]);

  // Free preview snapshots when their element disappears
  useEffect(() => {
    setRasterPreviews((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const [id, snap] of prev) {
        if (!state.images.some((i) => i.id === id)) {
          URL.revokeObjectURL(snap.url);
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [state.images]);

  // Entering paint/mask edit mode disables the element's rasterize preview —
  // the editor works on the real source, and edits would leave the snapshot
  // stale anyway.
  useEffect(() => {
    if (!maskMode) return;
    const snap = rasterPreviews.get(maskMode.imageId);
    if (!snap) return;
    URL.revokeObjectURL(snap.url);
    setRasterPreviews((prev) => {
      const next = new Map(prev);
      next.delete(maskMode.imageId);
      return next;
    });
  }, [maskMode, rasterPreviews]);

  // Refresh preview snapshots after a resize settles: while the element's size
  // differs from its snapshot, this effect re-arms a short timer on every state
  // tick — so during a drag it keeps resetting, and the regeneration only runs
  // once the user stops scaling.
  useEffect(() => {
    if (rasterPreviews.size === 0) return;
    const stale: string[] = [];
    for (const [id, snap] of rasterPreviews) {
      const node = state.images.find((i) => i.id === id);
      if (node && (Math.round(node.width) !== snap.w || Math.round(node.height) !== snap.h)) stale.push(id);
    }
    if (stale.length === 0) return;
    const timer = setTimeout(async () => {
      for (const id of stale) {
        const node = stateRef.current.images.find((i) => i.id === id);
        if (!node) continue;
        // Scaled back to 1:1 or larger — the preview no longer says anything
        // the live view doesn't; drop it instead of regenerating
        if (!isDownscaled(node)) {
          setRasterPreviews((prev) => {
            const cur = prev.get(id);
            if (!cur) return prev;
            URL.revokeObjectURL(cur.url);
            const next = new Map(prev);
            next.delete(id);
            return next;
          });
          continue;
        }
        const snap = await rasterizeNodeAtDisplaySize(node);
        if (!snap) continue;
        setRasterPreviews((prev) => {
          const cur = prev.get(id);
          if (!cur) {
            // Untoggled while we were rendering — don't leak the new blob
            URL.revokeObjectURL(snap.url);
            return prev;
          }
          URL.revokeObjectURL(cur.url);
          return new Map(prev).set(id, snap);
        });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [state.images, rasterPreviews, rasterizeNodeAtDisplaySize, isDownscaled]);

  /**
   * Where an AI-generated image should land: right of the selection's bounding
   * box (flush, using the alignment padding), chaining right of the previous
   * output within a batch; viewport center when nothing is selected.
   */
  const placeAiOutput = useCallback((dw: number, dh: number, batchIndex: number): { x: number; y: number } => {
    const GAP = Math.max(0, Math.round(userConfig.alignPadding ?? 0));
    const cur = stateRef.current;
    const prev = batchIndex > 0 ? lastAiOutputRef.current : null;
    let gx: number, gy: number;
    if (prev) {
      gx = prev.x + prev.w + GAP;
      gy = prev.y;
    } else {
      const sel = cur.images.filter((i) => cur.selectedIds.has(i.id) && i.nodeType !== 'text');
      if (sel.length > 0) {
        gx = Math.max(...sel.map((i) => i.x + i.width)) + GAP;
        gy = Math.min(...sel.map((i) => i.y));
      } else {
        gx = (-cur.pan.x + (viewportRef.current?.clientWidth ?? 800) / 2) / cur.zoom - dw / 2;
        gy = (-cur.pan.y + (viewportRef.current?.clientHeight ?? 600) / 2) / cur.zoom - dh / 2;
      }
    }
    lastAiOutputRef.current = { x: gx, y: gy, w: dw };
    return { x: gx, y: gy };
  }, [userConfig.alignPadding]);

  const handleBakeImage = useCallback(async (id: string) => {
    const node = state.images.find((i) => i.id === id);
    if (!node) return;

    const loadImg = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.crossOrigin = 'anonymous';
      img.src = src;
    });

    let srcX = 0, srcY = 0, srcW = node.naturalWidth, srcH = node.naturalHeight;
    if (node.cropRect) {
      srcX = node.cropRect.x; srcY = node.cropRect.y;
      srcW = node.cropRect.w; srcH = node.cropRect.h;
    }
    const outW = srcW;
    const outH = srcH;

    const off = document.createElement('canvas');
    off.width = outW;
    off.height = outH;
    const ctx = off.getContext('2d')!;
    if (state.scaleFilter === 'nearest') {
      ctx.imageSmoothingEnabled = false;
    } else {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }

    try {
      // Bake adjustments into the pixels (BAKE_IMAGE resets the fields)
      ctx.filter = adjustmentsFilter(node) ?? 'none';
      if (node.bgColor) {
        ctx.fillStyle = node.bgColor;
        ctx.fillRect(0, 0, outW, outH);
      }

      const hasFlip = node.flipH || node.flipV;
      if (hasFlip) {
        ctx.save();
        ctx.translate(outW / 2, outH / 2);
        ctx.scale(node.flipH ? -1 : 1, node.flipV ? -1 : 1);
        ctx.translate(-outW / 2, -outH / 2);
      }

      if (node.paintCompositeUrl) {
        const compositeImg = await loadImg(node.paintCompositeUrl);
        ctx.drawImage(compositeImg, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
      } else {
        const htmlImg = await loadImg(node.src);
        let drawSource: CanvasImageSource = htmlImg;

        if (node.maskDataUrl) {
          const maskImg = await loadImg(node.maskDataUrl);
          const tmp = document.createElement('canvas');
          tmp.width = node.naturalWidth; tmp.height = node.naturalHeight;
          const tctx = tmp.getContext('2d')!;
          tctx.drawImage(htmlImg, 0, 0);
          tctx.globalCompositeOperation = 'destination-in';
          tctx.drawImage(maskImg, 0, 0);
          drawSource = tmp;
        }

        ctx.drawImage(drawSource, srcX, srcY, srcW, srcH, 0, 0, outW, outH);

        if (node.paintUnderlayUrl) {
          const underlayImg = await loadImg(node.paintUnderlayUrl);
          if (node.maskDataUrl) {
            const maskImg = await loadImg(node.maskDataUrl);
            const tmp = document.createElement('canvas');
            tmp.width = node.naturalWidth; tmp.height = node.naturalHeight;
            const tctx = tmp.getContext('2d')!;
            tctx.drawImage(underlayImg, 0, 0);
            tctx.globalCompositeOperation = 'destination-in';
            tctx.drawImage(maskImg, 0, 0);
            ctx.drawImage(tmp, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
          } else {
            ctx.drawImage(underlayImg, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
          }
        }

        if (node.paintOverlayUrl) {
          const overlayImg = await loadImg(node.paintOverlayUrl);
          ctx.drawImage(overlayImg, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
        }
      }

      if (hasFlip) ctx.restore();

      const blob = await new Promise<Blob | null>((resolve) => {
        off.toBlob((b) => resolve(b), 'image/png');
      });
      if (!blob) return;
      const newSrc = URL.createObjectURL(blob);
      // BAKE_IMAGE clears history itself — no SNAPSHOT needed (and one would just
      // capture the pre-bake state we're trying to free).
      dispatch({ type: 'BAKE_IMAGE', id: node.id, src: newSrc, naturalWidth: outW, naturalHeight: outH });
    } catch (e) {
      console.error('Failed to bake image:', node.fileName, e);
    }
  }, [state.images, state.scaleFilter, dispatch]);

  // Show workspace background context menu
  const handleViewportContextMenu = useCallback((e: React.MouseEvent) => {
    // Right-clicks in text fields (AI prompts, chat, ComfyUI inputs, etc.) get
    // the browser's native menu so spellcheck suggestions work.
    const target = e.target as HTMLElement;
    if (target.closest('textarea, input, [contenteditable="true"]')) return;
    e.preventDefault();
    if (!maskMode) {
      setBgContextMenu({ x: e.clientX, y: e.clientY });
    }
  }, [maskMode]);

  // Sort images by zIndex for rendering
  const sortedImages = [...state.images].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      ref={viewportRef}
      className={`workspace-viewport${isDragOver ? ' workspace-drag-over' : ''}${isPanningRef.current || spaceHeldRef.current ? ' workspace-panning' : ''}${maskMode ? ' workspace-paint-active' : ''}${!showGrid ? ' workspace-no-grid' : ''}${rulersVisible ? ' workspace-rulers-on' : ''}${!userConfig.frostedGlass ? ' workspace-no-blur' : ''} workspace-filter-${state.scaleFilter}`}
      style={activeTool === 'text' ? { cursor: 'crosshair' } : undefined}
      onPointerDown={handleViewportPointerDown}
      onPointerMove={handleViewportPointerMove}
      onPointerUp={handleViewportPointerUp}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={handleViewportContextMenu}
    >
      <div
        className="workspace-canvas"
        style={{
          transform: `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`,
        }}
        onPointerDown={handleCanvasPointerDown}
      >
        {state.canvas && (
          <div
            className="canvas-background"
            style={{
              left: 0,
              top: 0,
              width: state.canvas.width,
              height: state.canvas.height,
              background: state.canvasBgColor ?? undefined,
            }}
          >
            <div className="canvas-background-label" style={{ fontSize: 11 / state.zoom }}>
              {state.canvas.width} x {state.canvas.height}
            </div>
          </div>
        )}
        {/* Ruler guide lines (interactive) */}
        {rulersVisible && state.guides.map((g) => {
          const lineWidth = 1 / state.zoom;
          const hitSize = Math.max(6, 8 / state.zoom);
          if (g.axis === 'x') {
            return (
              <div key={g.id} style={{ position: 'absolute', left: g.position - hitSize / 2, top: -100000, width: hitSize, height: 200000, zIndex: 999996, cursor: 'ew-resize', pointerEvents: 'auto' }}
                onPointerDown={(e) => handleGuideDragStart(e, g.id, g.axis)}
                onPointerMove={handleGuideDragMove}
                onPointerUp={handleGuideDragUp}
              >
                <div className="ruler-guide-line ruler-guide-line-x" style={{ left: hitSize / 2 - lineWidth / 2, width: lineWidth }} />
              </div>
            );
          }
          return (
            <div key={g.id} style={{ position: 'absolute', top: g.position - hitSize / 2, left: -100000, height: hitSize, width: 200000, zIndex: 999996, cursor: 'ns-resize', pointerEvents: 'auto' }}
              onPointerDown={(e) => handleGuideDragStart(e, g.id, g.axis)}
              onPointerMove={handleGuideDragMove}
              onPointerUp={handleGuideDragUp}
            >
              <div className="ruler-guide-line ruler-guide-line-y" style={{ top: hitSize / 2 - lineWidth / 2, height: lineWidth }} />
            </div>
          );
        })}
        {sortedImages.map((img) => {
          // Hide the source image when checkerboard is off in paint editor
          if (hideEditSource && maskMode && img.id === maskMode.imageId) return null;
          let highlightColor: string | null = null;
          if (canvasInfoIssues) {
            if (canvasInfoIssues.duplicateIds.has(img.id)) highlightColor = '#e74c3c';
            else if (canvasInfoIssues.unnamedIds.has(img.id)) highlightColor = '#f1c40f';
            else if (canvasInfoIssues.overlappingIds.has(img.id)) highlightColor = '#e67e22';
          }
          return (
            <ImageNodeComponent
              key={img.id}
              node={(() => {
                // Rasterize preview: swap in the display-resolution snapshot
                // (everything is baked into it, so strip the live edit state)
                const snap = rasterPreviews.get(img.id);
                if (!snap) return img;
                return {
                  ...img,
                  src: snap.url,
                  naturalWidth: snap.w,
                  naturalHeight: snap.h,
                  cropRect: undefined,
                  maskDataUrl: null,
                  paintOverlayUrl: null,
                  paintUnderlayUrl: null,
                  paintCompositeUrl: null,
                  bgColor: null,
                  flipH: false,
                  flipV: false,
                  brightness: undefined,
                  contrast: undefined,
                  saturation: undefined,
                  hue: undefined,
                };
              })()}
              selected={state.selectedIds.has(img.id) && !maskMode}
              zoom={state.zoom}
              dispatch={dispatch}
              selectedIds={state.selectedIds}
              onContextMenu={handleContextMenu}
              multiSelected={state.selectedIds.size > 1 && state.selectedIds.has(img.id) && !maskMode}
              images={state.images}
              snapEnabled={state.snapEnabled}
              canvas={state.canvas}
              onSnapGuides={setSnapGuides}
              highlightColor={highlightColor}
              rulerGuides={rulersVisible ? state.guides : []}
              onDragActive={setIsDragging}
              editingText={editingTextId === img.id}
              onEditText={setEditingTextId}
            />
          );
        })}
        {/* Split preview lines */}
        {state.selectedIds.size === 1 && (splitV > 0 || splitH > 0) && (() => {
          const selId = Array.from(state.selectedIds)[0]!;
          const img = state.images.find((i) => i.id === selId);
          if (!img) return null;
          const lineWidth = 1 / state.zoom;
          const lines: React.ReactNode[] = [];
          for (let v = 1; v <= splitV; v++) {
            const xPos = img.x + (img.width * v) / (splitV + 1);
            lines.push(
              <div
                key={`sv-${v}`}
                className="split-preview-line split-preview-line-v"
                style={{
                  left: xPos,
                  top: img.y,
                  width: lineWidth,
                  height: img.height,
                  transform: img.rotation ? `rotate(${img.rotation}deg)` : undefined,
                  transformOrigin: `0px ${img.height / 2}px`,
                }}
              />,
            );
          }
          for (let h = 1; h <= splitH; h++) {
            const yPos = img.y + (img.height * h) / (splitH + 1);
            lines.push(
              <div
                key={`sh-${h}`}
                className="split-preview-line split-preview-line-h"
                style={{
                  left: img.x,
                  top: yPos,
                  width: img.width,
                  height: lineWidth,
                  transform: img.rotation ? `rotate(${img.rotation}deg)` : undefined,
                  transformOrigin: `${img.width / 2}px 0px`,
                }}
              />,
            );
          }
          return lines;
        })()}
        {state.selectedIds.size > 1 && (
          <GroupTransformBox
            images={state.images}
            selectedIds={state.selectedIds}
            zoom={state.zoom}
            dispatch={dispatch}
            snapEnabled={state.snapEnabled}
            canvas={state.canvas}
            onSnapGuides={setSnapGuides}
            rulerGuides={state.guides}
          />
        )}
        {snapGuides.map((guide, i) => {
          const lineWidth = 1 / state.zoom;
          if (guide.axis === 'x') {
            return (
              <div
                key={`snap-${i}`}
                className="snap-guide snap-guide-x"
                style={{
                  left: guide.position,
                  top: -10000,
                  width: lineWidth,
                  height: 20000,
                }}
              />
            );
          }
          return (
            <div
              key={`snap-${i}`}
              className="snap-guide snap-guide-y"
              style={{
                top: guide.position,
                left: -10000,
                height: lineWidth,
                width: 20000,
              }}
            />
          );
        })}
        {/* Ghost outlines of non-selected elements during drag */}
        {isDragging && state.images.map((img) => {
          if (state.selectedIds.has(img.id)) return null;
          const lineWidth = 1 / state.zoom;
          return (
            <div
              key={`ghost-${img.id}`}
              className="drag-ghost-outline"
              style={{
                left: img.x,
                top: img.y,
                width: img.width,
                height: img.height,
                transform: img.rotation ? `rotate(${img.rotation}deg)` : undefined,
                borderWidth: lineWidth,
              }}
            />
          );
        })}
        {/* Attach drag chain line */}
        {attachDrag && (() => {
          const src = state.images.find((i) => i.id === attachDrag.sourceId);
          if (!src) return null;
          const sx = src.x + src.width / 2;
          const sy = src.y + src.height / 2;
          // Cursor is in window coords — subtract the viewport's screen offset
          // before converting to workspace coords, or the endpoint drifts
          const vRect = viewportRef.current?.getBoundingClientRect();
          const ex = (attachDrag.cursorX - (vRect?.left ?? 0) - state.pan.x) / state.zoom;
          const ey = (attachDrag.cursorY - (vRect?.top ?? 0) - state.pan.y) / state.zoom;
          const lineWidth = 2 / state.zoom;
          return (
            // Explicit 1×1 size: the parent canvas div is 0×0 and a zero-sized
            // SVG paints nothing; overflow:visible renders beyond the viewport
            <svg className="attach-drag-line" style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, pointerEvents: 'none', overflow: 'visible', zIndex: 999999 }}>
              <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="var(--color-primary)" strokeWidth={lineWidth} strokeDasharray={`${6 / state.zoom} ${4 / state.zoom}`} />
              <circle cx={ex} cy={ey} r={5 / state.zoom} fill="var(--color-primary)" opacity={0.8} />
            </svg>
          );
        })()}
        {/* Crop overlay */}
        {cropMode && (() => {
          const cropImg = state.images.find((i) => i.id === cropMode.imageId);
          if (!cropImg) return null;
          return (
            <CropOverlay
              image={cropImg}
              cropRect={cropMode.rect}
              zoom={state.zoom}
              offsetOnly={cropMode.offsetOnly}
              onRectChange={(rect) => setCropMode((prev) => prev ? { ...prev, rect } : null)}
              onApply={cropMode.offsetOnly
                ? (rect) => applyOffset(cropImg.id, rect, cropMode.followerIds)
                : (rect, geometry) => applyCrop(cropImg.id, rect, geometry)
              }
              onCancel={() => setCropMode(null)}
            />
          );
        })()}

        {/* Slice tool preview line — drawn over the targeted image inside the
            scaled canvas so it tracks pan/zoom. 1/zoom keeps the line visually
            thin at any zoom level. */}
        {sliceMode && slicePreview && (() => {
          const img = state.images.find((i) => i.id === slicePreview.imageId);
          if (!img) return null;
          const lineW = 2 / state.zoom;
          if (slicePreview.axis === 'vertical') {
            return (
              <div
                className="slice-preview-line"
                style={{
                  position: 'absolute',
                  left: img.x + slicePreview.cutAt - lineW / 2,
                  top: img.y,
                  width: lineW,
                  height: img.height,
                  pointerEvents: 'none',
                  zIndex: 999998,
                }}
              />
            );
          }
          return (
            <div
              className="slice-preview-line"
              style={{
                position: 'absolute',
                left: img.x,
                top: img.y + slicePreview.cutAt - lineW / 2,
                width: img.width,
                height: lineW,
                pointerEvents: 'none',
                zIndex: 999998,
              }}
            />
          );
        })()}
      </div>

      {/* Slice tool pointer overlay — viewport-level so it captures clicks above
          ImageNode handlers (which stopPropagation). Only mounted while slicing. */}
      {sliceMode && (
        <div
          className="slice-pointer-overlay"
          onPointerMove={handleSlicePointerMove}
          onPointerDown={handleSlicePointerDown}
          onPointerLeave={() => setSlicePreview(null)}
        />
      )}

      {/* Screen-space selection frames — rendered outside the scaled canvas */}
      {state.images.map((img) => {
        if (!state.selectedIds.has(img.id)) return null;
        const sx = img.x * state.zoom + state.pan.x;
        const sy = img.y * state.zoom + state.pan.y;
        const sw = img.width * state.zoom;
        const sh = img.height * state.zoom;
        return (
          <div
            key={`sel-${img.id}`}
            className="selection-frame"
            style={{
              left: sx,
              top: sy,
              width: sw,
              height: sh,
              transform: img.rotation ? `rotate(${img.rotation}deg)` : undefined,
              transformOrigin: `${sw / 2}px ${sh / 2}px`,
            }}
          />
        );
      })}

      {/* Screen-space node action buttons (lock, onion, attach, delete) */}
      {!maskMode && (() => { const anyAiOpen = aiTextToImageOpen || aiChatOpen || aiComfyOpen; return state.images.map((img) => {
        const isSelected = state.selectedIds.has(img.id);
        const isSingle = state.selectedIds.size === 1;
        const showLocked = img.locked;
        const showUnlocked = isSelected && isSingle && !img.locked;
        // Multi-select while AI panels are open (keyboard delete is blocked
        // then): show a per-element delete button for culling
        const showMultiDelete = anyAiOpen && isSelected && !isSingle && !img.locked;
        if (!showLocked && !showUnlocked && !showMultiDelete) return null;

        // Compute screen position of the image's top-left corner
        const rad = (img.rotation * Math.PI) / 180;
        const cx = (img.x + img.width / 2) * state.zoom + state.pan.x;
        const cy = (img.y + img.height / 2) * state.zoom + state.pan.y;
        const hw = (img.width / 2) * state.zoom;
        const hh = (img.height / 2) * state.zoom;
        // Top-left corner in screen space (rotated)
        const tlx = cx + (-hw) * Math.cos(rad) - (-hh) * Math.sin(rad);
        const tly = cy + (-hw) * Math.sin(rad) + (-hh) * Math.cos(rad);

        const btnSize = 22;
        const iconSize = 14;
        const gap = 4;
        const topOffset = -(btnSize + gap);

        if (showLocked) {
          const isOnion = img.opacity < 1;
          return (
            <div key={`lock-${img.id}`} style={{ position: 'absolute', left: tlx, top: tly + topOffset, zIndex: 999991, display: 'flex', gap, pointerEvents: 'auto' }}>
              <button
                className="lock-icon-btn lock-icon-locked"
                style={{ width: btnSize, height: btnSize }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  dispatch({ type: 'TOGGLE_LOCK', ids: [img.id] });
                }}
                title="Unlock"
              >
                <Lock size={iconSize} />
              </button>
              <button
                className={`lock-icon-btn${isOnion ? ' onion-btn-active' : ''}`}
                style={{ width: btnSize, height: btnSize }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  dispatch({ type: 'SET_OPACITY', ids: [img.id], opacity: isOnion ? 1 : 0.6 });
                }}
                title={isOnion ? 'Disable onion skin' : 'Onion skin (60%)'}
              >
                <Target size={iconSize} />
              </button>
              {anyAiOpen && (
                <button
                  className={`lock-icon-btn lock-icon-delete${trashFlash ? ' lock-icon-delete-flash' : ''}`}
                  style={{ width: btnSize, height: btnSize }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    dispatch({ type: 'REMOVE_IMAGES', ids: [img.id] });
                  }}
                  title="Delete"
                >
                  <Trash2 size={iconSize} />
                </button>
              )}
            </div>
          );
        }

        if (showMultiDelete) {
          return (
            <div key={`multi-del-${img.id}`} style={{ position: 'absolute', left: tlx, top: tly + topOffset, zIndex: 999991, display: 'flex', gap, pointerEvents: 'auto' }}>
              <button
                className={`lock-icon-btn lock-icon-delete${trashFlash ? ' lock-icon-delete-flash' : ''}`}
                style={{ width: btnSize, height: btnSize }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  dispatch({ type: 'REMOVE_IMAGES', ids: [img.id] });
                }}
                title="Delete this element"
              >
                <Trash2 size={iconSize} />
              </button>
            </div>
          );
        }

        const isOnion = img.opacity < 1;
        const hasRasterPreview = rasterPreviews.has(img.id);
        return (
          <div key={`btns-${img.id}`} style={{ position: 'absolute', left: tlx, top: tly + topOffset, zIndex: 999991, display: 'flex', gap, pointerEvents: 'auto' }}>
            <button
              className="lock-icon-btn"
              style={{ width: btnSize, height: btnSize, position: 'relative' }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                dispatch({ type: 'TOGGLE_LOCK', ids: [img.id] });
              }}
              title="Lock"
            >
              <Unlock size={iconSize} />
            </button>
            {img.nodeType !== 'text' && (hasRasterPreview || isDownscaled(img)) && (
              <button
                className={`lock-icon-btn${hasRasterPreview ? ' onion-btn-active' : ''}`}
                style={{ width: btnSize, height: btnSize }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  toggleRasterPreview(img.id);
                }}
                title={hasRasterPreview
                  ? 'Rasterize preview on (snapshot at current display size) — click to restore full-resolution display'
                  : 'Rasterize preview — show this element at export resolution to check for over-downscaling'}
              >
                <ScanEye size={iconSize} />
              </button>
            )}
            <button
              className={`lock-icon-btn${isOnion ? ' onion-btn-active' : ''}`}
              style={{ width: btnSize, height: btnSize, position: 'relative' }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                dispatch({ type: 'SET_OPACITY', ids: [img.id], opacity: isOnion ? 1 : 0.6 });
              }}
              title={isOnion ? 'Disable onion skin' : 'Onion skin (60%)'}
            >
              <Target size={iconSize} />
            </button>
            <button
              className={`lock-icon-btn${img.parentId ? ' attach-btn-active' : ''}`}
              style={{ width: btnSize, height: btnSize, position: 'relative', cursor: 'grab' }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleAttachDragStart(img.id, e);
              }}
              title="Drag onto an element to make it a child"
            >
              <Link2 size={iconSize} />
            </button>
            {anyAiOpen && (
              <button
                className={`lock-icon-btn lock-icon-delete${trashFlash ? ' lock-icon-delete-flash' : ''}`}
                style={{ width: btnSize, height: btnSize, position: 'relative' }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  dispatch({ type: 'SNAPSHOT' });
                  dispatch({ type: 'REMOVE_IMAGES', ids: [img.id] });
                }}
                title="Delete"
              >
                <Trash2 size={iconSize} />
              </button>
            )}
          </div>
        );
      }); })()}

      {/* Drop overlay */}
      {isDragOver && (
        <div className="drop-overlay">
          <div className="drop-overlay-text">Drop images here</div>
        </div>
      )}

      {/* Marquee selection rectangle */}
      {marquee && marquee.w + marquee.h > 4 && (
        <div
          className="marquee-selection"
          style={{
            left: marquee.x,
            top: marquee.y,
            width: marquee.w,
            height: marquee.h,
          }}
        />
      )}

      {/* Paint/Mask editor — rendered at viewport level so fixed positioning works */}
      {maskMode && (() => {
        const maskImg = state.images.find((i) => i.id === maskMode.imageId);
        if (!maskImg) return null;
        return (
          <PaintEditor
            image={maskImg}
            zoom={state.zoom}
            pan={state.pan}
            scaleFilter={state.scaleFilter}
            guides={rulersVisible ? state.guides : []}
            snapEnabled={state.snapEnabled}
            onApply={(maskDataUrl, paintLayers, paintOverlayUrl, backgroundDataUrl, paintUnderlayUrl, paintCompositeUrl) => {
              dispatch({ type: 'SET_MASK', id: maskMode.imageId, maskDataUrl });
              dispatch({ type: 'SET_PAINT_LAYERS', id: maskMode.imageId, paintLayers, paintOverlayUrl, paintUnderlayUrl: paintUnderlayUrl ?? null, paintCompositeUrl: paintCompositeUrl ?? null });
              if (backgroundDataUrl) {
                dispatch({ type: 'SET_IMAGE_SRC', id: maskMode.imageId, src: backgroundDataUrl });
              }
              setMaskMode(null);
            }}
            onCancel={() => setMaskMode(null)}
            onCropChange={(newCrop) => {
              dispatch({ type: 'SET_CROP_RECT', id: maskMode.imageId, cropRect: newCrop ?? undefined });
            }}
            onHistoryChange={setPaintHistory}
            importLayerFile={paintImportFile}
            onImportLayerDone={() => setPaintImportFile(null)}
            onHideSource={setHideEditSource}
            onFrame={() => {
              const img = state.images.find((i) => i.id === maskMode.imageId);
              if (!img) return;
              const vw = window.innerWidth;
              const vh = window.innerHeight;
              const padding = 80;
              const scaleX = (vw - padding * 2) / img.width;
              const scaleY = (vh - padding * 2) / img.height;
              const newZoom = Math.min(32, Math.max(0.01, Math.min(scaleX, scaleY)));
              const cx = img.x + img.width / 2;
              const cy = img.y + img.height / 2;
              dispatch({ type: 'SET_ZOOM', zoom: newZoom, pan: { x: vw / 2 - cx * newZoom, y: vh / 2 - cy * newZoom } });
            }}
          />
        );
      })()}

      {paintDropMenu && (
        <>
          <div
            className="paint-drop-menu-backdrop"
            onClick={() => setPaintDropMenu(null)}
          />
          <div
            className="context-menu"
            style={{ left: paintDropMenu.x, top: paintDropMenu.y }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="paint-drop-menu-header">{paintDropMenu.file.name}</div>
            <button className="context-menu-item" onClick={() => {
              setPaintImportFile({ file: paintDropMenu.file, mode: 'fit' });
              setPaintDropMenu(null);
            }}>
              Import as Layer (Fit)
            </button>
            <button className="context-menu-item" onClick={() => {
              setPaintImportFile({ file: paintDropMenu.file, mode: 'stretch' });
              setPaintDropMenu(null);
            }}>
              Import as Layer (Stretch)
            </button>
            <button className="context-menu-item" onClick={() => {
              setPaintImportFile({ file: paintDropMenu.file, mode: 'original' });
              setPaintDropMenu(null);
            }}>
              Import as Layer (1:1)
            </button>
            <div className="context-menu-separator" />
            <button className="context-menu-item" onClick={() => {
              const rect = viewportRef.current?.getBoundingClientRect();
              if (rect) {
                const wx = (paintDropMenu.x - rect.left - state.pan.x) / state.zoom;
                const wy = (paintDropMenu.y - rect.top - state.pan.y) / state.zoom;
                addImageFromFile(paintDropMenu.file, wx, wy, handleScaleFilterDetected, handleImageSize);
              }
              setPaintDropMenu(null);
            }}>
              Import to Workspace
            </button>
            <div className="context-menu-separator" />
            <button className="context-menu-item" onClick={() => setPaintDropMenu(null)}>
              Cancel
            </button>
          </div>
        </>
      )}

      {rulersVisible && (
        <Rulers
          pan={state.pan}
          zoom={state.zoom}
          guides={state.guides}
          dispatch={dispatch}
          themeName={userConfig.theme}
        />
      )}

      <Toolbar
        zoom={state.zoom}
        dispatch={dispatch}
        pan={state.pan}
        onImport={handleImportClick}
        onImportSpriteSheet={handleImportSpriteSheet}
        images={state.images}
        canUndo={maskMode && paintHistory ? paintHistory.canUndo : canUndo}
        canRedo={maskMode && paintHistory ? paintHistory.canRedo : canRedo}
        onUndo={maskMode && paintHistory ? paintHistory.undo : undefined}
        onRedo={maskMode && paintHistory ? paintHistory.redo : undefined}
        canvas={state.canvas}
        scaleFilter={state.scaleFilter}
        snapEnabled={state.snapEnabled}
        projectName={state.projectName}
        onNewProject={handleNewProject}
        selectedIds={state.selectedIds}
        onCanvasInfoIssues={setCanvasInfoIssues}
        guides={state.guides}
        rulersVisible={rulersVisible}
        onToggleRulers={() => setRulersVisible((v) => !v)}
        canvasBgColor={state.canvasBgColor}
        onOpenFlipbook={() => setFlipbookOpen(true)}
        activeTool={activeTool}
        onSetActiveTool={setActiveTool}
        exportOpen={exportOpen}
        onExportClosed={() => setExportOpen(false)}
        onOpenPreferences={() => setPrefsOpen(true)}
        onExportStatus={setExportStatus}
        onMenuOpenChange={setHamburgerOpen}
        editMode={!!maskMode}
        aiHidden={userConfig.aiHidden}
        onAiTextToImage={() => { if (!aiProgress) { setAiTextToImageOpen((v) => { if (!v) { setAiComfyOpen(false); } return !v; }); } }}
        onAiComfy={() => { if (!aiProgress) { setAiComfyOpen((v) => { if (!v) { setAiTextToImageOpen(false); } return !v; }); } }}
        aiComfyOpen={aiComfyOpen}
        onAiChat={() => setAiChatOpen((v) => !v)}
        aiTextToImageOpen={aiTextToImageOpen}
        aiChatOpen={aiChatOpen}
        historyPast={historyDepth.past}
        historyFuture={historyDepth.future}
        historyMax={historyDepth.max}
      />

      {flipbookOpen && (
        <FlipbookViewer
          onImportFiles={(files, ox, oy, suggestedName) => {
            addImagesFromFiles(files, ox, oy, handleScaleFilterDetected, (newIds) => {
              if (newIds.length > 1) {
                dispatch({ type: 'SELECT_MULTIPLE', ids: newIds, additive: false });
                dispatch({ type: 'ARRANGE_STRIP', ids: newIds });
                setBatchRenamePrefix(suggestedName);
                setBatchRenameOpen(true);
              }
            });
          }}
          viewCenter={{
            x: viewportRef.current ? (viewportRef.current.clientWidth / 2 - state.pan.x) / state.zoom : 200,
            y: viewportRef.current ? (viewportRef.current.clientHeight / 2 - state.pan.y) / state.zoom : 200,
          }}
          onClose={() => setFlipbookOpen(false)}
        />
      )}

      {batchRenameOpen && (
        <BatchRename
          images={state.images}
          selectedIds={state.selectedIds}
          dispatch={dispatch}
          onClose={() => { setBatchRenameOpen(false); setBatchRenamePrefix(undefined); }}
          initialPrefix={batchRenamePrefix}
        />
      )}

      {prefsOpen && (
        <Preferences
          config={userConfig}
          onConfigChange={(cfg) => {
            setUserConfig(cfg);
            setShowGrid(cfg.showGrid);
            setRulersVisible(cfg.showRulers);
          }}
          onClose={() => setPrefsOpen(false)}
          onResetPanelPosition={() => resetPanelPosRef.current?.()}
        />
      )}

      {aiTextToImageOpen && (
        <TextToImageModal
          config={userConfig}
          prompt={aiTextToImagePrompt}
          onPromptChange={setAiTextToImagePrompt}
          position={aiModalPosition}
          refNodes={state.images.filter((i) => state.selectedIds.has(i.id) && i.nodeType !== 'text')}
          onGenerated={(localUrl, w, h, prompts, batchIndex) => {
            const MAX = 1024;
            let dw = w, dh = h;
            if (dw > MAX || dh > MAX) {
              const s = MAX / Math.max(dw, dh);
              dw = Math.round(dw * s);
              dh = Math.round(dh * s);
            }
            const pos = placeAiOutput(dw, dh, batchIndex);
            dispatch({ type: 'SNAPSHOT' });
            dispatch({
              type: 'ADD_IMAGE',
              image: {
                id: crypto.randomUUID(),
                src: localUrl,
                fileName: 'ai_generated.png',
                x: pos.x,
                y: pos.y,
                width: dw,
                height: dh,
                naturalWidth: w,
                naturalHeight: h,
                rotation: 0,
                zIndex: 0,
                locked: false,
                opacity: 1,
                spriteName: '',
                parentId: null,
                basePosition: null,
                offsetPosition: null,
                layerOrder: 'above',
                replacesParent: false,
                flipH: false,
                flipV: false,
                prompts: prompts.length > 0 ? prompts : undefined,
              },
            });
          }}
          onProgress={setAiProgress}
          onClose={() => setAiTextToImageOpen(false)}
        />
      )}


      {aiComfyOpen && (
        <ComfyModal
          config={userConfig}
          sourceNodes={state.images.filter((i) => state.selectedIds.has(i.id) && i.nodeType !== 'text')}
          selectedWorkflowFilename={aiComfyWorkflow}
          onSelectedWorkflowChange={setAiComfyWorkflow}
          inputValues={aiComfyInputs}
          onInputValuesChange={setAiComfyInputs}
          position={aiModalPosition}
          onGenerated={(dataUrl, w, h, prompts, fileName, batchIndex) => {
            const MAX = 1024;
            let dw = w, dh = h;
            if (dw > MAX || dh > MAX) {
              const s = MAX / Math.max(dw, dh);
              dw = Math.round(dw * s);
              dh = Math.round(dh * s);
            }
            const { x: gx, y: gy } = placeAiOutput(dw, dh, batchIndex);
            dispatch({ type: 'SNAPSHOT' });
            dispatch({
              type: 'ADD_IMAGE',
              image: {
                id: crypto.randomUUID(),
                src: dataUrl,
                fileName,
                x: gx,
                y: gy,
                width: dw,
                height: dh,
                naturalWidth: w,
                naturalHeight: h,
                rotation: 0,
                zIndex: 0,
                locked: false,
                opacity: 1,
                spriteName: '',
                parentId: null,
                basePosition: null,
                offsetPosition: null,
                layerOrder: 'above',
                replacesParent: false,
                flipH: false,
                flipV: false,
                prompts: prompts.length > 0 ? prompts : undefined,
              },
            });
          }}
          onProgress={setAiProgress}
          onClose={() => setAiComfyOpen(false)}
        />
      )}

      {aiChatOpen && (
        <AiChatPanel
          config={userConfig}
          messages={aiChatMessages}
          onMessagesChange={setAiChatMessages}
          providerId={aiChatProvider}
          onProviderChange={setAiChatProvider}
          selectedImageUrls={state.images.filter((i) => state.selectedIds.has(i.id) && i.nodeType !== 'text').slice(0, 5).map((i) => i.paintCompositeUrl || i.src)}
          rulersVisible={rulersVisible}
          onDragged={() => setAiChatDragged(true)}
          onClose={() => setAiChatOpen(false)}
        />
      )}

      {!hamburgerOpen && <NodeTreePanel
        images={state.images}
        selectedIds={state.selectedIds}
        dispatch={dispatch}
      />}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
        multiple
        onChange={handleFileChange}
        className="hidden-file-input"
      />

      <input
        ref={projectInputRef}
        type="file"
        accept=".layout"
        onChange={handleProjectFileChange}
        className="hidden-file-input"
      />

      <input
        ref={spriteSheetInputRef}
        type="file"
        accept=".json,.png,.jpg,.jpeg,.webp"
        multiple
        onChange={handleSpriteSheetFileChange}
        className="hidden-file-input"
      />

      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          dispatch={dispatch}
          onClose={() => setContextMenu(null)}
          selectedIds={state.selectedIds}
          images={state.images}
          onSaveImages={handleSaveImages}
          onRasterizeElement={async (id) => {
            const node = stateRef.current.images.find((i) => i.id === id);
            if (!node) return;
            const snap = await rasterizeNodeAtDisplaySize(node);
            if (!snap) return;
            dispatch({ type: 'SNAPSHOT' });
            dispatch({
              type: 'ADD_IMAGE',
              image: {
                id: crypto.randomUUID(),
                src: snap.url,
                fileName: node.fileName.replace(/\.\w+$/, '') + '_raster.png',
                x: node.x + 20,
                y: node.y + 20,
                width: snap.w,
                height: snap.h,
                naturalWidth: snap.w,
                naturalHeight: snap.h,
                rotation: 0,
                zIndex: 0,
                locked: false,
                opacity: 1,
                spriteName: '',
                parentId: null,
                basePosition: null,
                offsetPosition: null,
                layerOrder: 'above',
                replacesParent: false,
                flipH: false,
                flipV: false,
              },
            });
          }}
        />
      )}

      {bgContextMenu && (
        <WorkspaceBgContextMenu
          x={bgContextMenu.x}
          y={bgContextMenu.y}
          onClose={() => setBgContextMenu(null)}
          onPasteImage={(file) => {
            const wx = (bgContextMenu.x - state.pan.x) / state.zoom;
            const wy = (bgContextMenu.y - state.pan.y) / state.zoom;
            addImageFromFile(file, wx, wy);
            setBgContextMenu(null);
          }}
        />
      )}

      {state.selectedIds.size > 0 && (() => {
        const displayId = state.lastSelectedId && state.selectedIds.has(state.lastSelectedId)
          ? state.lastSelectedId
          : Array.from(state.selectedIds).pop()!;
        const displayImage = state.images.find((img) => img.id === displayId);
        return displayImage ? (
          <InfoPanel
            image={displayImage}
            selectionCount={state.selectedIds.size}
            dispatch={dispatch}
            selectedIds={state.selectedIds}
            images={state.images}
            splitV={splitV}
            splitH={splitH}
            onSplitVChange={setSplitV}
            onSplitHChange={setSplitH}
            isCropping={cropMode !== null}
            onCropStart={() => {
              setMaskMode(null);
              setCropMode({
                imageId: displayImage.id,
                rect: displayImage.cropRect
                  ? { ...displayImage.cropRect }
                  : { x: 0, y: 0, w: displayImage.naturalWidth, h: displayImage.naturalHeight },
              });
            }}
            onAutoCrop={async () => {
              const targets = state.images.filter((img) => state.selectedIds.has(img.id) && !img.locked);
              for (const target of targets) {
                const result = await autoCropImage(target);
                if (result) {
                  const prev = target.cropRect;
                  const ds = prev ? target.width / prev.w : target.width / target.naturalWidth;
                  const fullX = prev ? target.x - prev.x * ds : target.x;
                  const fullY = prev ? target.y - prev.y * ds : target.y;
                  applyCrop(target.id, result, { ds, fullX, fullY });
                }
              }
            }}
            onCropCancel={() => setCropMode(null)}
            onOffsetStart={() => {
              const selIds = Array.from(state.selectedIds);
              const eligible = selIds.filter((id) => {
                const img = state.images.find((i) => i.id === id);
                return img && !img.locked && img.cropRect;
              });
              if (eligible.length > 0) {
                const primaryId = eligible[0]!;
                const primaryImg = state.images.find((i) => i.id === primaryId)!;
                setCropMode({
                  imageId: primaryImg.id,
                  rect: { ...primaryImg.cropRect! },
                  offsetOnly: true,
                  followerIds: eligible.slice(1),
                });
              }
            }}
            isMasking={maskMode !== null}
            hasMask={!!displayImage.maskDataUrl}
            onMaskStart={() => {
              setCropMode(null);
              setMaskMode({ imageId: displayImage.id });
            }}
            onMaskCancel={() => setMaskMode(null)}
            onApplyMask={() => {
              const img = displayImage;
              if (!img.maskDataUrl) return;
              const srcImg = new Image();
              srcImg.onload = () => {
                const maskImg = new Image();
                maskImg.onload = () => {
                  const canvas = document.createElement('canvas');
                  canvas.width = img.naturalWidth;
                  canvas.height = img.naturalHeight;
                  const ctx = canvas.getContext('2d')!;
                  // Draw the mask as alpha channel
                  ctx.drawImage(maskImg, 0, 0);
                  // Draw the source image, keeping only where mask is white
                  ctx.globalCompositeOperation = 'source-in';
                  ctx.drawImage(srcImg, 0, 0);
                  canvas.toBlob((blob) => {
                    if (!blob) return;
                    const newSrc = URL.createObjectURL(blob);
                    dispatch({ type: 'SNAPSHOT' });
                    dispatch({ type: 'REPLACE_SOURCE', ids: [img.id], src: newSrc, fileName: img.fileName, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
                    dispatch({ type: 'SET_MASK', id: img.id, maskDataUrl: null });
                    dispatch({ type: 'SET_CROP', id: img.id, cropRect: undefined, width: img.width, height: img.height, x: img.x, y: img.y });
                  }, 'image/png');
                };
                maskImg.src = img.maskDataUrl!;
              };
              srcImg.crossOrigin = 'anonymous';
              srcImg.src = img.src;
            }}
            onClearMask={() => {
              dispatch({ type: 'SET_MASK', id: displayImage.id, maskDataUrl: null });
            }}
            hasEdits={!!(
              displayImage.maskDataUrl ||
              (displayImage.paintLayers && displayImage.paintLayers.length > 0) ||
              displayImage.paintOverlayUrl ||
              displayImage.paintUnderlayUrl ||
              displayImage.paintCompositeUrl ||
              displayImage.cropRect ||
              displayImage.flipH ||
              displayImage.flipV ||
              displayImage.bgColor ||
              adjustmentsFilter(displayImage)
            )}
            onBake={() => handleBakeImage(displayImage.id)}
            isSlicing={sliceMode}
            onSliceToggle={() => {
              setSliceMode((v) => !v);
              setSlicePreview(null);
            }}
            canvas={state.canvas}
            onBatchRename={() => setBatchRenameOpen(true)}
            editingTextId={editingTextId}
            onConfirmText={() => setEditingTextId(null)}
            onResetPositionRef={resetPanelPosRef}
            panelPos={infoPanelPos}
            onPanelPosChange={setInfoPanelPos}
            alignPadding={userConfig.alignPadding ?? 0}
            onAlignPaddingChange={(value) => {
              const next = { ...userConfig, alignPadding: value };
              setUserConfig(next);
              saveConfig(next);
            }}
          />
        ) : null;
      })()}

      {state.selectedIds.size >= 2 && (
        <AnimationPreview
          images={state.images}
          selectedIds={state.selectedIds}
        />
      )}

      {importProgress && (
        <div className="import-progress-toast">
          Optimising (Lossless)... {importProgress.current} / {importProgress.total}
          <div className="import-progress-bar">
            <div
              className="import-progress-fill"
              style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {welcomeOpen && (
        <WelcomeModal
          onClose={() => setWelcomeOpen(false)}
          onNewFromPreset={(size) => {
            dispatch({ type: 'NEW_PROJECT' });
            if (size) dispatch({ type: 'SET_CANVAS', canvas: { width: size.w, height: size.h } });
            setCurrentFileHandle(null);
            setCurrentFilePath(null);
          }}
          onOpenProject={() => projectInputRef.current?.click()}
          showOnStartup={userConfig.showWelcome !== false}
          onShowOnStartupChange={(v) => {
            const next = { ...userConfig, showWelcome: v };
            setUserConfig(next);
            saveConfig(next);
          }}
        />
      )}

      {exportStatus && !importProgress && (
        <div className="import-progress-toast">
          {exportStatus}
          <div className="import-progress-bar">
            <div className="import-progress-fill import-progress-fill-indeterminate" />
          </div>
        </div>
      )}

      {aiProgress && !importProgress && !exportStatus && (
        <div className="import-progress-toast">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span>{aiProgress.message}</span>
            <button
              className="ai-progress-cancel"
              onClick={() => {
                import('./ai/aiClient').then((m) => m.cancelGeneration());
                import('./ai/comfyClient').then((m) => m.cancelComfy());
                setAiProgress(null);
              }}
            >
              Stop
            </button>
          </div>
          <div className="import-progress-bar">
            <div
              className={`import-progress-fill${aiProgress.progress == null ? ' import-progress-fill-indeterminate' : ''}`}
              style={aiProgress.progress != null ? { width: `${aiProgress.progress}%` } : undefined}
            />
          </div>
        </div>
      )}

      {scaleFilterPrompt && (
        <div className="scale-filter-prompt">
          <span>
            This image was exported with <strong>{scaleFilterPrompt}</strong> scaling
            (currently using <strong>{state.scaleFilter}</strong>).
          </span>
          <div className="scale-filter-prompt-actions">
            <button
              className="scale-filter-prompt-btn scale-filter-prompt-btn-primary"
              onClick={() => {
                dispatch({ type: 'SET_SCALE_FILTER', filter: scaleFilterPrompt as 'bicubic' | 'nearest' });
                setScaleFilterPrompt(null);
              }}
            >
              Switch to {scaleFilterPrompt}
            </button>
            <button
              className="scale-filter-prompt-btn"
              onClick={() => setScaleFilterPrompt(null)}
            >
              Keep {state.scaleFilter}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Workspace background right-click menu ---

function WorkspaceBgContextMenu({ x, y, onClose, onPasteImage }: {
  x: number;
  y: number;
  onClose: () => void;
  onPasteImage: (file: File) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
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

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    let nx = x;
    let ny = y;
    if (nx + rect.width > window.innerWidth - pad) nx = window.innerWidth - rect.width - pad;
    if (ny + rect.height > window.innerHeight - pad) ny = window.innerHeight - rect.height - pad;
    if (nx < pad) nx = pad;
    if (ny < pad) ny = pad;
    setPos({ x: nx, y: ny });
  }, [x, y]);

  const handlePaste = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const ext = imageType.split('/')[1] || 'png';
          onPasteImage(new File([blob], `pasted-image.${ext}`, { type: imageType }));
          return;
        }
      }
      alert('No image found on clipboard.');
    } catch {
      alert('Could not read clipboard.\n\nMake sure the page has focus and clipboard access is allowed.');
    }
  }, [onPasteImage]);

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button className="context-menu-item" onClick={handlePaste}>
        Paste Image
      </button>
    </div>
  );
}
