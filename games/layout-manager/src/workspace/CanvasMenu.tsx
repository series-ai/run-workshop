import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { WorkspaceAction, CanvasRect, ImageNode, ScaleFilter, RulerGuide } from './types';
import { adjustmentsFilter } from './types';
import { cssFontFamily, loadFontForCanvas } from './googleFonts';
import { ColorPicker } from './paint/ColorPicker';
import { getCanvasOverlappingImages, overlapsCanvas, findDuplicateSpriteNames, findUnnamedImages, findOverlappingElements, findOffBasePoseImages, buildCanvasInfoJson, getSpriteName } from './canvasInfo';
import { buildProjectBlob } from './projectFile';
import { writePngScaleFilter } from './pngChunks';
import optimise from '@jsquash/oxipng/optimise';

async function optimisePng(blob: Blob): Promise<Blob> {
  try {
    const buf = await blob.arrayBuffer();
    console.log(`[oxipng] Input: ${(blob.size / 1024).toFixed(1)}KB`);
    const optimised = await optimise(buf, { level: 3 });
    const result = new Blob([optimised], { type: 'image/png' });
    console.log(`[oxipng] Output: ${(result.size / 1024).toFixed(1)}KB (${result.size < blob.size ? 'saved ' + ((1 - result.size / blob.size) * 100).toFixed(1) + '%' : 'no savings, using original'})`);
    return result.size < blob.size ? result : blob;
  } catch (e) {
    console.error('[oxipng] Failed:', e);
    return blob;
  }
}

export interface CanvasInfoIssues {
  duplicateIds: Set<string>;
  unnamedIds: Set<string>;
  duplicateNames: Map<string, string[]>;
  overlappingIds: Set<string>;
  overlappingPairs: [string, string][];
  offBasePoseIds: Set<string>;
}

interface CanvasMenuProps {
  canvas: CanvasRect | null;
  dispatch: React.Dispatch<WorkspaceAction>;
  images: ImageNode[];
  scaleFilter: ScaleFilter;
  selectedIds: Set<string>;
  onCanvasInfoIssues: (issues: CanvasInfoIssues | null) => void;
  canvasBgColor: string | null;
  projectName: string | null;
  pan: { x: number; y: number };
  zoom: number;
  guides: RulerGuide[];
  exportAsOpen?: boolean;
  onExportAsClosed?: () => void;
  onExportStatus?: (status: string | null) => void;
  disabled?: boolean;
}

const PRESETS: { label: string; w: number; h: number }[] = [
  { label: '512 x 512', w: 512, h: 512 },
  { label: '1024 x 1024', w: 1024, h: 1024 },
  { label: '1920 x 1080', w: 1920, h: 1080 },
  { label: '1080 x 1920', w: 1080, h: 1920 },
  { label: '2048 x 2048', w: 2048, h: 2048 },
];

export function CanvasMenu({ canvas, dispatch, images, scaleFilter, selectedIds, onCanvasInfoIssues, canvasBgColor, projectName, pan, zoom, guides, exportAsOpen, onExportAsClosed, onExportStatus, disabled }: CanvasMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customW, setCustomW] = useState('1024');
  const [customH, setCustomH] = useState('1024');
  const [exporting, setExporting] = useState(false);
  const [exportingInfo, setExportingInfo] = useState(false);
  const [showIssues, setShowIssues] = useState<CanvasInfoIssues | null>(null);
  const [colorWheelOpen, setColorWheelOpen] = useState(false);
  const [eyedropperActive, setEyedropperActive] = useState(false);
  const [eyedropperPreview, setEyedropperPreview] = useState<string | null>(null);
  const eyedropperCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const colorBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setShowCustom(false);
        setShowIssues(null);
        onCanvasInfoIssues(null);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setShowCustom(false);
        setShowIssues(null);
        onCanvasInfoIssues(null);
      }
    }
    document.addEventListener('pointerdown', handleClick, true);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handleClick, true);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  const setCanvas = useCallback(
    (w: number, h: number) => {
      dispatch({ type: 'SET_CANVAS', canvas: { width: w, height: h } });
      setMenuOpen(false);
      setShowCustom(false);
    },
    [dispatch],
  );

  const frameCanvas = useCallback(() => {
    if (!canvas) return;
    setMenuOpen(false);
    // Center the canvas in the viewport with padding
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const padding = 80;
    const scaleX = (vw - padding * 2) / canvas.width;
    const scaleY = (vh - padding * 2) / canvas.height;
    const newZoom = Math.min(32, Math.max(0.01, Math.min(scaleX, scaleY)));
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const newPanX = vw / 2 - cx * newZoom;
    const newPanY = vh / 2 - cy * newZoom;
    dispatch({ type: 'SET_ZOOM', zoom: newZoom, pan: { x: newPanX, y: newPanY } });
  }, [canvas, dispatch]);

  const handleCustomSubmit = useCallback(() => {
    const w = parseInt(customW, 10);
    const h = parseInt(customH, 10);
    if (w > 0 && h > 0 && w <= 8192 && h <= 8192) {
      setCanvas(w, h);
    }
  }, [customW, customH, setCanvas]);

  // Render all workspace images to an offscreen canvas (shared by export + eyedropper)
  const renderWorkspaceCanvas = useCallback(async (): Promise<HTMLCanvasElement | null> => {
    if (!canvas) return null;

    const offscreen = document.createElement('canvas');
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const ctx = offscreen.getContext('2d')!;

    if (canvasBgColor) {
      ctx.fillStyle = canvasBgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (scaleFilter === 'nearest') {
      ctx.imageSmoothingEnabled = false;
    } else {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }

    const sorted = [...images].sort((a, b) => a.zIndex - b.zIndex);

    for (const img of sorted) {
      if (!overlapsCanvas(img, canvas)) {
        continue;
      }

      let srcX = 0;
      let srcY = 0;
      let srcW = img.naturalWidth;
      let srcH = img.naturalHeight;

      if (img.cropRect) {
        srcX = img.cropRect.x;
        srcY = img.cropRect.y;
        srcW = img.cropRect.w;
        srcH = img.cropRect.h;
      }

      ctx.save();
      ctx.globalAlpha = img.opacity;
      // Match on-screen CSS adjustments (brightness/contrast/saturation/hue)
      ctx.filter = adjustmentsFilter(img) ?? 'none';
      const cx = img.x + img.width / 2;
      const cy = img.y + img.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate((img.rotation * Math.PI) / 180);
      if (img.flipH || img.flipV) {
        ctx.scale(img.flipH ? -1 : 1, img.flipV ? -1 : 1);
      }

      // Re-apply after save/transforms — some browsers reset this through save/restore cycles
      if (scaleFilter === 'nearest') {
        ctx.imageSmoothingEnabled = false;
      } else {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
      }

      // Text nodes: draw as canvas text instead of loading an image
      if (img.nodeType === 'text') {
        const text = img.text || 'Text';
        const fontSize = img.fontSize ?? 24;
        const fontFamily = img.fontFamily ?? 'sans-serif';
        const bold = img.fontBold ? 'bold ' : '';
        const italic = img.fontItalic ? 'italic ' : '';
        // Make sure web fonts are actually loaded before drawing to canvas
        await loadFontForCanvas(fontFamily, fontSize, img.fontBold, img.fontItalic);
        ctx.font = `${italic}${bold}${fontSize}px ${cssFontFamily(fontFamily)}`;
        ctx.fillStyle = img.textColor ?? '#000000';
        ctx.textBaseline = 'top';

        const align = img.textAlign ?? 'left';
        let textX = -img.width / 2;
        if (align === 'center') textX = 0;
        else if (align === 'right') textX = img.width / 2;
        ctx.textAlign = align;

        const lines = text.split('\n');
        const lineHeight = fontSize * 1.2;
        // Match CSS rendering: 2px padding + center glyph within line-height
        const lineGap = (lineHeight - fontSize) / 2;
        let textY = -img.height / 2 + 2 + lineGap;
        for (const line of lines) {
          ctx.fillText(line, textX, textY);
          if (img.fontUnderline) {
            const metrics = ctx.measureText(line);
            let ulX = textX;
            if (align === 'center') ulX = textX - metrics.width / 2;
            else if (align === 'right') ulX = textX - metrics.width;
            ctx.fillRect(ulX, textY + fontSize, metrics.width, Math.max(1, fontSize / 16));
          }
          textY += lineHeight;
        }
        ctx.restore();
        continue;
      }

      // Per-element flat bg color: drawn first so it fills any transparent regions of the layers above
      if (img.bgColor) {
        ctx.fillStyle = img.bgColor;
        ctx.fillRect(-img.width / 2, -img.height / 2, img.width, img.height);
      }

      if (img.paintCompositeUrl) {
        // Full composite already includes background, layers with blend modes, and mask
        const compositeImg = await loadImage(img.paintCompositeUrl);
        ctx.drawImage(
          compositeImg,
          srcX, srcY, srcW, srcH,
          -img.width / 2, -img.height / 2, img.width, img.height,
        );
      } else {
        const htmlImg = await loadImage(img.src);
        let drawSource: CanvasImageSource = htmlImg;

        if (img.maskDataUrl) {
          const maskImg = await loadImage(img.maskDataUrl);
          const tmp = document.createElement('canvas');
          tmp.width = img.naturalWidth;
          tmp.height = img.naturalHeight;
          const tctx = tmp.getContext('2d')!;
          if (scaleFilter === 'nearest') {
            tctx.imageSmoothingEnabled = false;
          } else {
            tctx.imageSmoothingEnabled = true;
            tctx.imageSmoothingQuality = 'high';
          }
          tctx.drawImage(htmlImg, 0, 0);
          tctx.globalCompositeOperation = 'destination-in';
          tctx.drawImage(maskImg, 0, 0);
          drawSource = tmp;
        }

        ctx.drawImage(
          drawSource,
          srcX, srcY, srcW, srcH,
          -img.width / 2, -img.height / 2, img.width, img.height,
        );

        // Draw paint underlay (below-mask layers — apply mask via destination-in)
        if (img.paintUnderlayUrl) {
          const underlayImg = await loadImage(img.paintUnderlayUrl);
          if (img.maskDataUrl) {
            const maskImg = await loadImage(img.maskDataUrl);
            const tmp = document.createElement('canvas');
            tmp.width = img.naturalWidth;
            tmp.height = img.naturalHeight;
            const tctx = tmp.getContext('2d')!;
            tctx.drawImage(underlayImg, 0, 0);
            tctx.globalCompositeOperation = 'destination-in';
            tctx.drawImage(maskImg, 0, 0);
            ctx.drawImage(
              tmp,
              srcX, srcY, srcW, srcH,
              -img.width / 2, -img.height / 2, img.width, img.height,
            );
          } else {
            ctx.drawImage(
              underlayImg,
              srcX, srcY, srcW, srcH,
              -img.width / 2, -img.height / 2, img.width, img.height,
            );
          }
        }

        // Draw paint overlay on top of masked image (use same crop region as source)
        if (img.paintOverlayUrl) {
          const overlayImg = await loadImage(img.paintOverlayUrl);
          ctx.drawImage(
            overlayImg,
            srcX, srcY, srcW, srcH,
            -img.width / 2, -img.height / 2, img.width, img.height,
          );
        }
      }

      ctx.restore();
    }

    return offscreen;
  }, [canvas, images, scaleFilter, canvasBgColor]);

  const renderExportCanvas = useCallback(async (format: 'png' | 'jpeg' | 'webp' = 'png', quality?: number): Promise<Blob | null> => {
    let offscreen = await renderWorkspaceCanvas();
    if (!offscreen) return null;

    // JPEG has no alpha channel — composite onto a solid background so
    // transparent regions don't turn black
    if (format === 'jpeg') {
      const flat = document.createElement('canvas');
      flat.width = offscreen.width;
      flat.height = offscreen.height;
      const fctx = flat.getContext('2d')!;
      fctx.fillStyle = canvasBgColor || '#ffffff';
      fctx.fillRect(0, 0, flat.width, flat.height);
      fctx.drawImage(offscreen, 0, 0);
      offscreen = flat;
    }

    const mime = `image/${format}`;
    return new Promise<Blob | null>((resolve) => {
      try {
        offscreen.toBlob((blob) => resolve(blob), mime, quality);
      } catch {
        // Canvas tainted by cross-origin image — fall back to dataURL conversion
        try {
          const dataUrl = offscreen.toDataURL(mime, quality);
          fetch(dataUrl).then((r) => r.blob()).then((b) => resolve(b)).catch(() => resolve(null));
        } catch {
          resolve(null);
        }
      }
    });
  }, [renderWorkspaceCanvas, canvasBgColor]);

  // Convert any remaining remote-URL images to local blob URLs before export
  const convertRemoteImages = useCallback(async (): Promise<string[]> => {
    const failed: string[] = [];
    for (const img of images) {
      if (/^https?:\/\//.test(img.src)) {
        try {
          const resp = await fetch(img.src);
          const blob = await resp.blob();
          const localUrl = URL.createObjectURL(blob);
          dispatch({ type: 'SET_IMAGE_SRC', id: img.id, src: localUrl });
        } catch {
          failed.push(img.fileName || img.src);
        }
      }
    }
    return failed;
  }, [images, dispatch]);

  const handleExport = useCallback(async () => {
    if (!canvas) return;
    setExporting(true);
    setMenuOpen(false);

    try {
      // Convert remote URLs to local blobs first
      onExportStatus?.('Preparing images...');
      const failed = await convertRemoteImages();
      if (failed.length > 0) {
        alert(`Cannot export — ${failed.length} image(s) have remote URLs that block download due to browser security (CORS).\n\nAffected: ${failed.join(', ')}\n\nRemove these and re-drag them from your browser to fix.`);
        setExporting(false);
        onExportStatus?.(null);
        return;
      }

      onExportStatus?.('Rendering...');
      let blob = await renderExportCanvas();
      if (blob) {
        onExportStatus?.('Optimising (Lossless)...');
        blob = await optimisePng(blob);
        blob = await writePngScaleFilter(blob, scaleFilter);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        let baseName = 'canvas-export';
        if (projectName) baseName = projectName.replace(/\.layout$/i, '');
        else if (images.length === 1) baseName = images[0]!.fileName.replace(/\.[^.]+$/, '');
        a.download = `${baseName}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('Export failed:', e);
    }

    onExportStatus?.(null);
    setExporting(false);
  }, [canvas, renderExportCanvas, convertRemoteImages, projectName, onExportStatus]);

  const handleCanvasToImage = useCallback(async () => {
    if (!canvas) return;
    setExporting(true);
    setMenuOpen(false);
    try {
      onExportStatus?.('Rendering...');
      const blob = await renderExportCanvas();
      if (blob) {
        const src = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          const node: ImageNode = {
            id: crypto.randomUUID(),
            src,
            fileName: 'canvas-flatten.png',
            x: 0,
            y: 0,
            width: canvas.width,
            height: canvas.height,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
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
          };
          dispatch({ type: 'ADD_IMAGE', image: node });
          dispatch({ type: 'SELECT', id: node.id, additive: false });
        };
        img.src = src;
      }
    } catch (e) {
      console.error('Canvas to image failed:', e);
    }
    onExportStatus?.(null);
    setExporting(false);
  }, [canvas, renderExportCanvas, dispatch, onExportStatus]);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFileName, setExportFileName] = useState('');
  const [exportIncludeJson, setExportIncludeJson] = useState(false);
  const [exportIncludeLayout, setExportIncludeLayout] = useState(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [exportQuality, setExportQuality] = useState(90);

  // Allow parent to trigger the export modal
  useEffect(() => {
    if (exportAsOpen) openExportAs();
  }, [exportAsOpen]);

  const openExportAs = useCallback(() => {
    let baseName = 'canvas-export';
    if (projectName) {
      baseName = projectName.replace(/\.layout$/i, '');
    } else if (images.length === 1) {
      baseName = images[0]!.fileName.replace(/\.[^.]+$/, '');
    }
    setExportFileName(baseName);
    setExportIncludeJson(false);
    setShowExportModal(true);
    setMenuOpen(false);
  }, [projectName, images]);

  useEffect(() => {
    if (!showExportModal && onExportAsClosed) onExportAsClosed();
  }, [showExportModal, onExportAsClosed]);

  const handleExportAs = useCallback(async () => {
    if (!canvas) return;
    setShowExportModal(false);
    setExporting(true);

    try {
      onExportStatus?.('Rendering...');
      const lossy = exportFormat !== 'png';
      let blob = await renderExportCanvas(exportFormat, lossy ? exportQuality / 100 : undefined);
      if (!blob) { onExportStatus?.(null); setExporting(false); return; }
      if (!lossy) {
        onExportStatus?.('Optimising (Lossless)...');
        blob = await optimisePng(blob);
        blob = await writePngScaleFilter(blob, scaleFilter);
      }

      const name = exportFileName.trim() || 'canvas-export';
      const ext = exportFormat === 'jpeg' ? 'jpg' : exportFormat;
      const mime = `image/${exportFormat}`;

      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: `${name}.${ext}`,
            types: [{ description: `${ext.toUpperCase()} Image`, accept: { [mime]: [`.${ext}`] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch (e: any) {
          if (e.name === 'AbortError') { setExporting(false); return; }
          throw e;
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
      }

      // Also export JSON if requested
      if (exportIncludeJson && canvas) {
        const json = buildCanvasInfoJson(images, canvas);
        const jsonBlob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
        const jsonUrl = URL.createObjectURL(jsonBlob);
        const ja = document.createElement('a');
        ja.href = jsonUrl;
        ja.download = `${name}.json`;
        ja.click();
        URL.revokeObjectURL(jsonUrl);
      }

      // Also save layout file if requested
      if (exportIncludeLayout) {
        const layoutBlob = await buildProjectBlob(images, pan, zoom, canvas, scaleFilter, guides, canvasBgColor);
        const layoutUrl = URL.createObjectURL(layoutBlob);
        const la = document.createElement('a');
        la.href = layoutUrl;
        la.download = `${name}.layout`;
        la.click();
        URL.revokeObjectURL(layoutUrl);
      }
    } catch (e) {
      console.error('Export failed:', e);
    }

    onExportStatus?.(null);
    setExporting(false);
  }, [canvas, images, renderExportCanvas, exportFileName, exportIncludeJson, exportIncludeLayout, exportFormat, exportQuality, pan, zoom, guides, scaleFilter, canvasBgColor, onExportStatus]);

  const doExportCanvasInfo = useCallback(() => {
    if (!canvas) return;
    setExportingInfo(true);
    setShowIssues(null);
    onCanvasInfoIssues(null);
    try {
      const json = buildCanvasInfoJson(images, canvas);
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const baseName = projectName ? projectName.replace(/\.layout$/i, '') : 'canvas-export';
      a.download = `${baseName}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Canvas info export failed:', e);
    }
    setExportingInfo(false);
  }, [canvas, images, onCanvasInfoIssues, projectName]);

  const handleExportCanvasInfo = useCallback(() => {
    if (!canvas) return;
    const overlapping = getCanvasOverlappingImages(images, canvas);
    const duplicateNames = findDuplicateSpriteNames(overlapping);
    const unnamedIdList = findUnnamedImages(overlapping);
    const { pairs: overlappingPairs, ids: overlappingIds } = findOverlappingElements(overlapping);
    const offBasePoseList = findOffBasePoseImages(overlapping);

    const hasIssues = duplicateNames.size > 0 || unnamedIdList.length > 0 || overlappingPairs.length > 0 || offBasePoseList.length > 0;

    if (hasIssues) {
      const duplicateIds = new Set<string>();
      for (const ids of duplicateNames.values()) {
        for (const id of ids) duplicateIds.add(id);
      }
      const issues: CanvasInfoIssues = {
        duplicateIds,
        unnamedIds: new Set(unnamedIdList),
        duplicateNames,
        overlappingIds,
        overlappingPairs,
        offBasePoseIds: new Set(offBasePoseList),
      };
      setShowIssues(issues);
      onCanvasInfoIssues(issues);
    } else {
      doExportCanvasInfo();
      setMenuOpen(false);
    }
  }, [canvas, images, doExportCanvasInfo, onCanvasInfoIssues]);

  return (
    <>
    <div className="toolbar-menu-wrapper" ref={menuRef}>
      <button
        className="toolbar-btn"
        onClick={() => setMenuOpen((v) => !v)}
        title="Page"
        disabled={disabled}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          {canvas && <path d="M3 3l18 18M21 3L3 21" strokeWidth="1" opacity="0.3" />}
        </svg>
        <span>Page</span>
        {canvas && (
          <span style={{ fontSize: 11, opacity: 0.6 }}>
            {canvas.width}x{canvas.height}
          </span>
        )}
      </button>
      {menuOpen && (
        <div className="toolbar-dropdown" onPointerDown={(e) => e.stopPropagation()}>
          {!canvas && !showCustom && (() => {
            const singleImg = selectedIds.size === 1 ? images.find((img) => selectedIds.has(img.id)) : null;
            return (
              <>
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    className="toolbar-dropdown-item"
                    onClick={() => setCanvas(p.w, p.h)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                    </svg>
                    <span>{p.label}</span>
                  </button>
                ))}
                {singleImg && (
                  <>
                    <div className="context-menu-separator" />
                    <button
                      className="toolbar-dropdown-item"
                      onClick={() => setCanvas(singleImg.naturalWidth, singleImg.naturalHeight)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <path d="M12 8v8M8 12h8" />
                      </svg>
                      <span>Original Size ({singleImg.naturalWidth}x{singleImg.naturalHeight})</span>
                    </button>
                    <button
                      className="toolbar-dropdown-item"
                      onClick={() => setCanvas(Math.round(singleImg.width), Math.round(singleImg.height))}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <path d="M12 8v8M8 12h8" />
                      </svg>
                      <span>Display Size ({Math.round(singleImg.width)}x{Math.round(singleImg.height)})</span>
                    </button>
                  </>
                )}
                <div className="context-menu-separator" />
                <button
                  className="toolbar-dropdown-item"
                  onClick={() => setShowCustom(true)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  <span>Custom Size...</span>
                </button>
              </>
            );
          })()}

          {!canvas && showCustom && (
            <div className="canvas-custom-form">
              <div className="canvas-custom-row">
                <label className="canvas-custom-label">W</label>
                <input
                  type="number"
                  className="canvas-custom-input"
                  value={customW}
                  onChange={(e) => setCustomW(e.target.value)}
                  min="1"
                  max="8192"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCustomSubmit(); }}
                />
              </div>
              <div className="canvas-custom-row">
                <label className="canvas-custom-label">H</label>
                <input
                  type="number"
                  className="canvas-custom-input"
                  value={customH}
                  onChange={(e) => setCustomH(e.target.value)}
                  min="1"
                  max="8192"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCustomSubmit(); }}
                />
              </div>
              <div className="canvas-custom-actions">
                <button className="canvas-custom-btn" onClick={() => setShowCustom(false)}>Cancel</button>
                <button className="canvas-custom-btn canvas-custom-btn-primary" onClick={handleCustomSubmit}>Create</button>
              </div>
            </div>
          )}

          {canvas && (
            <>
              <div className="canvas-size-display">
                {canvas.width} x {canvas.height}
              </div>
              <button className="toolbar-dropdown-item" onClick={frameCanvas}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h6v6" />
                  <path d="M9 21H3v-6" />
                  <path d="M21 3l-7 7" />
                  <path d="M3 21l7-7" />
                </svg>
                <span>Frame Page</span>
              </button>
              <div className="context-menu-separator" />
              <div style={{ padding: '4px 12px', fontSize: 11, color: 'var(--color-text-muted)', opacity: 0.6 }}>
                Background:
              </div>
              <div className="canvas-bg-color-row">
                <button
                  className={`canvas-bg-swatch canvas-bg-swatch-transparent${canvasBgColor === null ? ' canvas-bg-swatch-active' : ''}`}
                  onClick={() => dispatch({ type: 'SET_CANVAS_BG_COLOR', color: null })}
                  title="Transparent"
                />
                <button
                  className={`canvas-bg-swatch${canvasBgColor === '#ffffff' ? ' canvas-bg-swatch-active' : ''}`}
                  style={{ background: '#ffffff' }}
                  onClick={() => dispatch({ type: 'SET_CANVAS_BG_COLOR', color: '#ffffff' })}
                  title="White"
                />
                <button
                  className={`canvas-bg-swatch${canvasBgColor === '#000000' ? ' canvas-bg-swatch-active' : ''}`}
                  style={{ background: '#000000' }}
                  onClick={() => dispatch({ type: 'SET_CANVAS_BG_COLOR', color: '#000000' })}
                  title="Black"
                />
                <button
                  ref={colorBtnRef}
                  className="canvas-bg-swatch canvas-bg-swatch-custom"
                  style={{ background: canvasBgColor && canvasBgColor !== '#ffffff' && canvasBgColor !== '#000000' ? canvasBgColor : 'var(--color-primary)' }}
                  onClick={() => setColorWheelOpen(true)}
                  title="Custom color"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
                <button
                  className="canvas-bg-swatch canvas-bg-swatch-eyedropper"
                  onClick={async () => {
                    setMenuOpen(false);
                    const snap = await renderWorkspaceCanvas();
                    if (snap) {
                      eyedropperCanvasRef.current = snap;
                      setEyedropperActive(true);
                    }
                  }}
                  title="Pick color from page"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 22l1-1h3l9-9" />
                    <path d="M3 21v-3l9-9" />
                    <path d="M15 6l3-3a2.12 2.12 0 0 1 3 3l-3 3" />
                    <path d="M12 3l9 9" />
                  </svg>
                </button>
              </div>
              <div className="context-menu-separator" />
              <button className="toolbar-dropdown-item" onClick={handleExport} disabled={exporting}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>{exporting ? 'Exporting...' : 'Export PNG'}</span>
              </button>
              <button className="toolbar-dropdown-item" onClick={handleExportCanvasInfo} disabled={exportingInfo}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                <span>{exportingInfo ? 'Exporting...' : 'Export Page Info'}</span>
              </button>
              <div className="context-menu-separator" />
              <button className="toolbar-dropdown-item" onClick={handleCanvasToImage} disabled={exporting}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span>Page to New Rasterized Element</span>
              </button>
              {showIssues && (
                <div className="canvas-info-issues">
                  {showIssues.unnamedIds.size > 0 && (
                    <div className="canvas-info-issue-section">
                      <div className="canvas-info-issue-title canvas-info-issue-title-warning">
                        <span className="canvas-info-issue-dot canvas-info-issue-dot-warning" />
                        Missing Sprite Names ({showIssues.unnamedIds.size})
                      </div>
                      <div className="canvas-info-issue-hint">
                        These elements will use their filename as the sprite name.
                        Highlighted yellow on the page.
                      </div>
                    </div>
                  )}
                  {showIssues.duplicateNames.size > 0 && (
                    <div className="canvas-info-issue-section">
                      <div className="canvas-info-issue-title canvas-info-issue-title-error">
                        <span className="canvas-info-issue-dot canvas-info-issue-dot-error" />
                        Duplicate Sprite Names ({showIssues.duplicateNames.size})
                      </div>
                      <div className="canvas-info-issue-body">
                        {Array.from(showIssues.duplicateNames.entries()).map(([name, ids]) => (
                          <div key={name} className="canvas-info-issue-item">
                            <strong>{name}</strong> <span style={{ opacity: 0.6 }}>x{ids.length}</span>
                          </div>
                        ))}
                      </div>
                      <div className="canvas-info-issue-hint">
                        Duplicates will be exported with _2, _3 suffixes.
                        Highlighted red on the page.
                      </div>
                    </div>
                  )}
                  {showIssues.overlappingPairs.length > 0 && (
                    <div className="canvas-info-issue-section">
                      <div className="canvas-info-issue-title canvas-info-issue-title-overlap">
                        <span className="canvas-info-issue-dot canvas-info-issue-dot-overlap" />
                        Overlapping Elements ({showIssues.overlappingPairs.length} pair{showIssues.overlappingPairs.length > 1 ? 's' : ''})
                      </div>
                      <div className="canvas-info-issue-body">
                        {showIssues.overlappingPairs.map(([idA, idB], i) => {
                          const a = images.find((img) => img.id === idA);
                          const b = images.find((img) => img.id === idB);
                          const nameA = a ? getSpriteName(a) : '?';
                          const nameB = b ? getSpriteName(b) : '?';
                          return (
                            <div key={i} className="canvas-info-issue-item">
                              {nameA} <span style={{ opacity: 0.4 }}>&harr;</span> {nameB}
                            </div>
                          );
                        })}
                      </div>
                      <div className="canvas-info-issue-hint">
                        These elements overlap and may cause clipping issues.
                        Highlighted orange on the page.
                      </div>
                    </div>
                  )}
                  {showIssues.offBasePoseIds.size > 0 && (
                    <div className="canvas-info-issue-section">
                      <div className="canvas-info-issue-title canvas-info-issue-title-error">
                        <span className="canvas-info-issue-dot canvas-info-issue-dot-error" />
                        Not at Base Position ({showIssues.offBasePoseIds.size})
                      </div>
                      <div className="canvas-info-issue-body">
                        {Array.from(showIssues.offBasePoseIds).map((id) => {
                          const img = images.find((i) => i.id === id);
                          return (
                            <div key={id} className="canvas-info-issue-item">
                              {img ? getSpriteName(img) : '?'}
                            </div>
                          );
                        })}
                      </div>
                      <div className="canvas-info-issue-hint">
                        The sheet rect and offset are computed from current positions, so
                        exporting from the dressed pose produces wrong rig data. Use
                        &quot;Base Pos&quot; in the Info Panel to return these elements first.
                      </div>
                    </div>
                  )}
                  <div className="canvas-custom-actions">
                    <button className="canvas-custom-btn" onClick={() => { setShowIssues(null); onCanvasInfoIssues(null); }}>Cancel</button>
                    <button className="canvas-custom-btn canvas-custom-btn-primary" onClick={() => { doExportCanvasInfo(); setShowIssues(null); onCanvasInfoIssues(null); setMenuOpen(false); }}>Export Anyway</button>
                  </div>
                </div>
              )}
              <div className="context-menu-separator" />
              <button className="toolbar-dropdown-item" onClick={() => { setShowCustom(false); dispatch({ type: 'SET_CANVAS', canvas: null }); setMenuOpen(false); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                </svg>
                <span>Remove Page</span>
              </button>
              <div className="context-menu-separator" />
              <div style={{ padding: '4px 12px', fontSize: 11, color: 'var(--color-text-muted)', opacity: 0.6 }}>
                Resize:
              </div>
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  className="toolbar-dropdown-item"
                  onClick={() => setCanvas(p.w, p.h)}
                >
                  <span>{p.label}</span>
                </button>
              ))}
              {(() => {
                const singleImg = selectedIds.size === 1 ? images.find((img) => selectedIds.has(img.id)) : null;
                if (!singleImg) return null;
                return (
                  <>
                    <div className="context-menu-separator" />
                    <button className="toolbar-dropdown-item" onClick={() => setCanvas(singleImg.naturalWidth, singleImg.naturalHeight)}>
                      <span>Original Size ({singleImg.naturalWidth}x{singleImg.naturalHeight})</span>
                    </button>
                    <button className="toolbar-dropdown-item" onClick={() => setCanvas(Math.round(singleImg.width), Math.round(singleImg.height))}>
                      <span>Display Size ({Math.round(singleImg.width)}x{Math.round(singleImg.height)})</span>
                    </button>
                  </>
                );
              })()}
              <div className="context-menu-separator" />
              <button
                className="toolbar-dropdown-item"
                onClick={() => setShowCustom(true)}
              >
                <span>Custom Size...</span>
              </button>
              {showCustom && (
                <div className="canvas-custom-form">
                  <div className="canvas-custom-row">
                    <label className="canvas-custom-label">W</label>
                    <input
                      type="number"
                      className="canvas-custom-input"
                      value={customW}
                      onChange={(e) => setCustomW(e.target.value)}
                      min="1"
                      max="8192"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleCustomSubmit(); }}
                    />
                  </div>
                  <div className="canvas-custom-row">
                    <label className="canvas-custom-label">H</label>
                    <input
                      type="number"
                      className="canvas-custom-input"
                      value={customH}
                      onChange={(e) => setCustomH(e.target.value)}
                      min="1"
                      max="8192"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleCustomSubmit(); }}
                    />
                  </div>
                  <div className="canvas-custom-actions">
                    <button className="canvas-custom-btn" onClick={() => setShowCustom(false)}>Cancel</button>
                    <button className="canvas-custom-btn canvas-custom-btn-primary" onClick={handleCustomSubmit}>Create</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>

      {showExportModal && createPortal(
        <div className="video-extract-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowExportModal(false); }}>
          <div className="video-extract-panel" onPointerDown={(e) => e.stopPropagation()}>
            <div className="video-extract-header">
              <h2>Export</h2>
              <button className="video-extract-close" onClick={() => setShowExportModal(false)} title="Cancel">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="video-extract-form">
              <div className="video-extract-section">
                <div className="video-extract-section-label">File Name</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="text"
                    className="video-extract-input"
                    style={{ flex: 1, width: 'auto', textAlign: 'left' }}
                    value={exportFileName}
                    onChange={(e) => setExportFileName(e.target.value)}
                    onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') handleExportAs(); }}
                    autoFocus
                  />
                  <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>.{exportFormat === 'jpeg' ? 'jpg' : exportFormat}</span>
                </div>
              </div>

              <div className="video-extract-section">
                <div className="video-extract-section-label">Format</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {([['png', 'PNG'], ['jpeg', 'JPG'], ['webp', 'WebP']] as const).map(([fmt, label]) => (
                    <button
                      key={fmt}
                      className={`ai-modal-ratio-btn${exportFormat === fmt ? ' ai-modal-ratio-btn-active' : ''}`}
                      onClick={() => setExportFormat(fmt)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {exportFormat !== 'png' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)', flexShrink: 0 }}>Quality</span>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={exportQuality}
                      onChange={(e) => setExportQuality(parseInt(e.target.value, 10))}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 12, width: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{exportQuality}%</span>
                  </div>
                )}
                {exportFormat === 'jpeg' && (
                  <div className="video-extract-note" style={{ marginTop: 6 }}>
                    JPG has no transparency — transparent areas fill with the page background color (or white).
                  </div>
                )}
              </div>

              <label className="mask-toolbar-wand-check">
                <input
                  type="checkbox"
                  checked={exportIncludeJson}
                  onChange={(e) => setExportIncludeJson(e.target.checked)}
                />
                Also export page info JSON
              </label>

              <label className="mask-toolbar-wand-check">
                <input
                  type="checkbox"
                  checked={exportIncludeLayout}
                  onChange={(e) => setExportIncludeLayout(e.target.checked)}
                />
                Also save layout project file
              </label>

              {'showSaveFilePicker' in window ? null : (
                <div className="video-extract-note">
                  Tip: Enable "Ask where to save" in browser settings to choose save location.
                </div>
              )}

              <div className="video-extract-actions">
                <button className="video-extract-btn video-extract-btn-primary" onClick={handleExportAs}>
                  Export
                </button>
                <button className="video-extract-btn" onClick={() => setShowExportModal(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
      {colorWheelOpen && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100000 }}
          onPointerDown={(e) => { e.stopPropagation(); setColorWheelOpen(false); }}
        >
          <div
            style={{
              position: 'absolute',
              top: (colorBtnRef.current?.getBoundingClientRect().bottom ?? 200) + 4,
              left: (colorBtnRef.current?.getBoundingClientRect().left ?? 100) - 80,
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <ColorPicker
              color={canvasBgColor ?? '#ffffff'}
              onChange={(c) => dispatch({ type: 'SET_CANVAS_BG_COLOR', color: c })}
              onClose={() => setColorWheelOpen(false)}
            />
          </div>
        </div>,
        document.body,
      )}
      {eyedropperActive && canvas && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100001, cursor: 'crosshair' }}
          onPointerMove={(e) => {
            const snap = eyedropperCanvasRef.current;
            if (!snap) return;
            // Convert screen coords to canvas coords
            const wx = (e.clientX - pan.x) / zoom;
            const wy = (e.clientY - pan.y) / zoom;
            const cx = Math.round(wx);
            const cy = Math.round(wy);
            if (cx >= 0 && cx < canvas.width && cy >= 0 && cy < canvas.height) {
              const pixel = snap.getContext('2d')!.getImageData(cx, cy, 1, 1).data;
              const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(v => (v ?? 0).toString(16).padStart(2, '0')).join('');
              setEyedropperPreview(hex);
            } else {
              setEyedropperPreview(null);
            }
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const snap = eyedropperCanvasRef.current;
            if (!snap) { setEyedropperActive(false); return; }
            const wx = (e.clientX - pan.x) / zoom;
            const wy = (e.clientY - pan.y) / zoom;
            const cx = Math.round(wx);
            const cy = Math.round(wy);
            if (cx >= 0 && cx < canvas.width && cy >= 0 && cy < canvas.height) {
              const pixel = snap.getContext('2d')!.getImageData(cx, cy, 1, 1).data;
              const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(v => (v ?? 0).toString(16).padStart(2, '0')).join('');
              dispatch({ type: 'SET_CANVAS_BG_COLOR', color: hex });
            }
            setEyedropperActive(false);
            setEyedropperPreview(null);
            eyedropperCanvasRef.current = null;
          }}
          onContextMenu={(e) => { e.preventDefault(); setEyedropperActive(false); setEyedropperPreview(null); }}
          onKeyDown={(e) => { if (e.key === 'Escape') { setEyedropperActive(false); setEyedropperPreview(null); } }}
          tabIndex={-1}
          ref={(el) => el?.focus()}
        >
          {eyedropperPreview && (
            <div style={{
              position: 'fixed',
              bottom: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              background: 'rgba(0,0,0,0.85)',
              borderRadius: 8,
              color: '#fff',
              fontSize: 13,
              fontFamily: 'monospace',
              pointerEvents: 'none',
            }}>
              <div style={{ width: 24, height: 24, borderRadius: 4, background: eyedropperPreview, border: '2px solid rgba(255,255,255,0.3)' }} />
              {eyedropperPreview}
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      // CORS load failed — retry without crossOrigin so the image at least renders
      // (the export canvas will be tainted, but toBlob still works in most browsers)
      const retry = new Image();
      retry.onload = () => resolve(retry);
      retry.onerror = reject;
      retry.src = src;
    };
    img.crossOrigin = 'anonymous';
    img.src = src;
  });
}
