import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ImageNode } from '../types';
import { flattenNode, urlToBlob } from './flattenNode';
import { useDraggableModal } from './useDraggableModal';
import { ColorPicker } from '../paint/ColorPicker';

/** Number input that tolerates in-progress typing ("-", "") — commits only
 * parseable values, snaps back to the real value on blur. */
function EdgeNumberInput({ value, onCommit, min, max, disabled }: { value: number; onCommit: (v: number) => void; min: number; max: number; disabled: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={draft ?? String(value)}
      onChange={(e) => {
        setDraft(e.target.value);
        const v = parseInt(e.target.value, 10);
        if (!Number.isNaN(v)) onCommit(Math.max(min, Math.min(max, v)));
      }}
      onFocus={() => setDraft(String(value))}
      onBlur={() => setDraft(null)}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      disabled={disabled}
      style={{ width: 46 }}
    />
  );
}

interface RemoveBgModalProps {
  sourceNodes: ImageNode[];
  position?: { top: number; left: number };
  onGenerated: (results: { localUrl: string; node: ImageNode; w: number; h: number }[]) => void;
  onProgress: (progress: { message: string; progress?: number } | null) => void;
  onClose: () => void;
}

export function RemoveBgModal({ sourceNodes, position, onGenerated, onProgress, onClose }: RemoveBgModalProps) {
  const { panelRef, onPointerDown, onPointerMove, onPointerUp } = useDraggableModal();
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [model, setModel] = useState<'isnet' | 'u2netp' | 'birefnet' | 'shadow'>('shadow');
  const [aiKeepShadows, setAiKeepShadows] = useState(false);
  const [shadowMode, setShadowMode] = useState<'wand' | 'chroma'>('wand');
  const [shadowTolerance, setShadowTolerance] = useState(4);
  const [keepShadows, setKeepShadows] = useState(false);
  const [edgeContract, setEdgeContract] = useState(0);
  const [edgeSmooth, setEdgeSmooth] = useState(0);
  const [edgeFeather, setEdgeFeather] = useState(0);
  const [chromaKey, setChromaKey] = useState('#00ff00');
  const [keyPickerPos, setKeyPickerPos] = useState<{ top: number; left: number } | null>(null);
  const shadowPreviewRef = useRef<HTMLCanvasElement>(null);
  const [aiHardness, setAiHardness] = useState(0);
  const [previewStatus, setPreviewStatus] = useState<string | null>(null);
  const [previewNeedsLoad, setPreviewNeedsLoad] = useState(false);
  const [forcedModels, setForcedModels] = useState<Set<string>>(new Set());
  // Opt-in for AI engines (preview costs a model run); the default Simple
  // engine is cheap, so it opens with the preview live
  const [livePreviewOn, setLivePreviewOn] = useState(true);
  // Preview resolution cap — low default keeps live tuning cheap on big
  // images; the real run always uses the actual image size
  const [previewRes, setPreviewRes] = useState<'512' | '1024' | '2048' | 'full'>('512');
  // Per-engine matte cache for the AI preview: inference runs once per model,
  // then slider changes only re-apply the cheap refinement ops
  const matteCacheRef = useRef(new Map<string, { matte: Uint8ClampedArray; base: ImageData; w: number; h: number }>());
  const [previewLoading, setPreviewLoading] = useState(false);
  useEffect(() => {
    matteCacheRef.current.clear();
    // New source — flag the old preview as stale immediately so switching
    // elements shows feedback instead of a frozen previous result
    setPreviewLoading(true);
  }, [previewUrls]);

  const previewCap = previewRes === 'full' ? Infinity : parseInt(previewRes, 10);

  // Engine switch — the old engine's preview is instantly misleading; blank
  // it until the new engine produces its own
  useEffect(() => {
    if (!livePreviewOn) return;
    setPreviewLoading(true);
    const out = shadowPreviewRef.current;
    if (out) { const w2 = out.width; out.width = w2; } // resets = clears to transparent
  }, [model]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live mask preview (first selected source) — all three engines, opt-in
  useEffect(() => {
    if (!livePreviewOn || !previewUrls[0]) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const src = new Image();
      await new Promise<void>((resolve, reject) => { src.onload = () => resolve(); src.onerror = reject; src.src = previewUrls[0]!; }).catch(() => {});
      if (cancelled || !src.naturalWidth) return;
      const s = Math.min(1, previewCap / Math.max(src.naturalWidth, src.naturalHeight));
      const w = Math.max(1, Math.round(src.naturalWidth * s));
      const h = Math.max(1, Math.round(src.naturalHeight * s));
      const work = document.createElement('canvas');
      work.width = w;
      work.height = h;
      const wctx = work.getContext('2d', { willReadFrequently: true })!;
      wctx.drawImage(src, 0, 0, w, h);
      const imageData = wctx.getImageData(0, 0, w, h);

      if (model === 'shadow') {
        const { wandCutout, chromaCutout } = await import('./cutoutEngine.mjs');
        if (cancelled) return;
        const img = { w, h, data: imageData.data };
        const opts = { tolerance: shadowTolerance, shadow: keepShadows, shadowStrength: 100, contract: edgeContract, smooth: edgeSmooth, feather: edgeFeather };
        if (shadowMode === 'chroma') {
          chromaCutout(img, [], { ...opts, key: chromaKey });
        } else {
          wandCutout(img, [{ x: 0, y: 0 }, { x: w - 1, y: 0 }, { x: 0, y: h - 1 }, { x: w - 1, y: h - 1 }], opts);
        }
      } else {
        // AI engines: compute the matte once per model+resolution, refine live after
        const cacheKey = `${model}@${previewRes}`;
        let entry = matteCacheRef.current.get(cacheKey);
        if (!entry) {
          // Don't silently kick off a big model download just for a preview
          const { isModelReady } = await import('./localBgRemoval');
          if (!(await isModelReady(model)) && !forcedModels.has(model)) {
            if (!cancelled) {
              setPreviewNeedsLoad(true);
              setPreviewStatus(
                model === 'isnet' ? 'Preview needs the ~170 MB model (one-time download).'
                : model === 'birefnet' ? 'Preview needs the ~475 MB model (one-time download).'
                : 'Preview needs the ~5 MB model.',
              );
              // Leave the canvas blank — showing the untouched source here
              // reads as "the model did nothing"
              const out = shadowPreviewRef.current;
              if (out) { out.width = w; out.height = h; }
              setPreviewLoading(false);
            }
            return;
          }
          if (!cancelled) setPreviewNeedsLoad(false);
          try {
            const { computeMatte } = await import('./localBgRemoval');
            const matte = await computeMatte(work, w, h, model, (phase) => {
              if (!cancelled) setPreviewStatus(phase);
            });
            if (cancelled) return;
            entry = { matte, base: imageData, w, h };
            matteCacheRef.current.set(cacheKey, entry);
          } catch (e) {
            if (!cancelled) { setPreviewStatus(`Preview failed: ${e instanceof Error ? e.message : 'unknown error'}`); setPreviewLoading(false); }
            return;
          } finally {
            if (!cancelled) setPreviewStatus(null);
          }
        }
        const { refineMatte, applyMatteToImageData, applyMatteWithShadows } = await import('./matteOps');
        if (cancelled) return;
        const refined = refineMatte(entry.matte, entry.w, entry.h, { hardness: aiHardness, contract: edgeContract, smooth: edgeSmooth, feather: edgeFeather });
        imageData.data.set(entry.base.data);
        if (model === 'birefnet' && aiKeepShadows) {
          applyMatteWithShadows(imageData, refined);
        } else {
          applyMatteToImageData(imageData, refined);
        }
      }

      const out = shadowPreviewRef.current;
      if (!out || cancelled) return;
      out.width = w;
      out.height = h;
      out.getContext('2d')!.putImageData(imageData, 0, 0);
      setPreviewLoading(false);
    }, 120);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [livePreviewOn, previewRes, previewCap, model, shadowMode, shadowTolerance, chromaKey, keepShadows, aiKeepShadows, edgeContract, edgeSmooth, edgeFeather, aiHardness, forcedModels, previewUrls]);

  const imageNodes = sourceNodes.filter((n) => n.nodeType !== 'text');

  useEffect(() => {
    Promise.all(imageNodes.map(flattenNode)).then(setPreviewUrls);
  }, [sourceNodes]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleRemove = useCallback(async () => {
    if (processing || imageNodes.length === 0) return;
    setProcessing(true);
    onProgress({ message: 'Removing background...' });
    try {
      const { removeImageBackground } = await import('./backgroundRemoval');
      const results: { localUrl: string; node: ImageNode; w: number; h: number }[] = [];
      for (let i = 0; i < imageNodes.length; i++) {
        const node = imageNodes[i]!;
        const flatUrl = await flattenNode(node);
        const blob = await urlToBlob(flatUrl);
        let resultBlob: Blob;
        if (model === 'shadow') {
          const { removeBackgroundShadowKeep } = await import('./shadowCutout');
          resultBlob = await removeBackgroundShadowKeep(blob, {
            mode: shadowMode,
            tolerance: shadowTolerance,
            key: chromaKey,
            shadowStrength: keepShadows ? 100 : 0,
            contract: edgeContract,
            smooth: edgeSmooth,
            feather: edgeFeather,
          });
        } else {
          resultBlob = await removeImageBackground(blob, (phase, pct) => {
            const prefix = imageNodes.length > 1 ? `(${i + 1}/${imageNodes.length}) ` : '';
            onProgress({ message: prefix + phase, progress: Math.round(pct * 100) });
          }, model, { hardness: aiHardness, contract: edgeContract, smooth: edgeSmooth, feather: edgeFeather, opsScaleRef: previewRes === 'full' ? undefined : parseInt(previewRes, 10), keepShadows: model === 'birefnet' && aiKeepShadows });
        }
        const resultUrl = URL.createObjectURL(resultBlob);
        const img = await new Promise<HTMLImageElement>((resolve) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.src = resultUrl;
        });
        results.push({ localUrl: resultUrl, node, w: img.naturalWidth, h: img.naturalHeight });
      }
      const { playCompletionSound } = await import('./completionSound');
      playCompletionSound();
      onProgress(null);
      onGenerated(results);
    } catch (e) {
      onProgress(null);
      console.error('[bg-removal] failed:', e);
      alert(`Background removal failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    setProcessing(false);
  }, [processing, imageNodes, onGenerated, onProgress, model, shadowMode, shadowTolerance, chromaKey, keepShadows, aiKeepShadows, edgeContract, edgeSmooth, edgeFeather, aiHardness]);

  if (imageNodes.length === 0) return null;

  return createPortal(
    <div
      className={`prefs-dialog ai-modal ai-modal-container${position ? ' ai-modal-aligned' : ''}`}
      ref={panelRef}
      style={position ? { maxWidth: 440, top: position.top, left: position.left } : { maxWidth: 440 }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div
        className="ai-modal-drag-header"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div className="grab-bar" />
      </div>
      <div className="prefs-header">
        <h2>Remove Background</h2>
        <button className="prefs-close" onClick={onClose} disabled={processing}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

        <div className="ai-modal-body">
          <label className="ai-modal-label">
            Engine
            <div className="ai-modal-ratio-row">
              <button
                className={`ai-modal-ratio-btn${model === 'shadow' ? ' ai-modal-ratio-btn-active' : ''}`}
                onClick={() => {
                  setModel('shadow');
                  // Simple is cheap enough to always preview live
                  setLivePreviewOn(true);
                  setPreviewRes('512');
                }}
                disabled={processing}
              >
                Simple
              </button>
              <button
                className={`ai-modal-ratio-btn${model === 'u2netp' ? ' ai-modal-ratio-btn-active' : ''}`}
                onClick={() => { setModel('u2netp'); setLivePreviewOn(false); }}
                disabled={processing}
              >
                Fast (Local)
              </button>
              <button
                className={`ai-modal-ratio-btn${model === 'isnet' ? ' ai-modal-ratio-btn-active' : ''}`}
                onClick={() => { setModel('isnet'); setLivePreviewOn(false); }}
                disabled={processing}
              >
                Quality (Local)
              </button>
              <button
                className={`ai-modal-ratio-btn${model === 'birefnet' ? ' ai-modal-ratio-btn-active' : ''}`}
                onClick={() => { setModel('birefnet'); setLivePreviewOn(false); }}
                disabled={processing}
              >
                Best (Local)
              </button>
            </div>
            <span className="ai-modal-size-hint">
              Runs in your browser — no API key needed.
              {model === 'isnet' && ' ISNet (DIS general-use) AI model, ~170 MB one-time download — best edges on hair and fine detail.'}
              {model === 'u2netp' && ' U2-Net small (u2netp) AI model, ~5 MB download — quick but rougher edges.'}
              {model === 'birefnet' && ' BiRefNet AI model (512 input), ~475 MB one-time download — top quality on hair, fine detail, and busy backgrounds; slower than Quality.'}
              {model === 'shadow' && ' Color-based cutout for flat/uniform backgrounds and green screens — instant, no AI model.'}
            </span>
          </label>

          {model === 'shadow' && (
            <label className="ai-modal-label">
              Cutout
              <div className="ai-modal-ratio-row">
                <button
                  className={`ai-modal-ratio-btn${shadowMode === 'wand' ? ' ai-modal-ratio-btn-active' : ''}`}
                  onClick={() => setShadowMode('wand')}
                  disabled={processing}
                  title="Flood-fills the background from the image corners"
                >
                  Wand (Corner Color)
                </button>
                <button
                  className={`ai-modal-ratio-btn${shadowMode === 'chroma' ? ' ai-modal-ratio-btn-active' : ''}`}
                  onClick={() => setShadowMode('chroma')}
                  disabled={processing}
                  title="Keys out a single color regardless of lighting"
                >
                  Chroma key
                </button>
                {shadowMode === 'chroma' && (
                  <>
                    <button
                      onClick={(e) => {
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setKeyPickerPos({ top: Math.min(r.bottom + 4, window.innerHeight - 320), left: Math.min(r.left, window.innerWidth - 260) });
                      }}
                      disabled={processing}
                      title="Key color"
                      style={{
                        width: 36, height: 26, padding: 0, cursor: 'pointer',
                        background: chromaKey, border: '1px solid var(--color-border)', borderRadius: 4,
                      }}
                    />
                    {'EyeDropper' in window && (
                      <button
                        className="canvas-bg-swatch canvas-bg-swatch-eyedropper"
                        disabled={processing}
                        title="Pick key color from screen (click the source preview below)"
                        onClick={async () => {
                          try {
                            const picker = new (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper();
                            const result = await picker.open();
                            setChromaKey(result.sRGBHex);
                          } catch { /* user cancelled */ }
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 22l1-1h3l9-9" />
                          <path d="M3 21v-3l9-9" />
                          <path d="M15 6l3-3a2.12 2.12 0 0 1 3 3l-3 3" />
                          <path d="M12 3l9 9" />
                        </svg>
                      </button>
                    )}
                  </>
                )}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                  Tolerance
                  <input
                    type="number"
                    min={0}
                    max={128}
                    value={shadowTolerance}
                    onChange={(e) => { const v = parseInt(e.target.value, 10); if (!Number.isNaN(v)) setShadowTolerance(Math.max(0, Math.min(128, v))); }}
                    disabled={processing}
                    style={{ width: 52 }}
                  />
                  <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
                    <button
                      className="ai-modal-stepper-btn"
                      disabled={processing || shadowTolerance >= 128}
                      onClick={() => setShadowTolerance((t) => Math.min(128, t + 1))}
                      title="Increase tolerance"
                    >
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 5l4-4 4 4" /></svg>
                    </button>
                    <button
                      className="ai-modal-stepper-btn"
                      disabled={processing || shadowTolerance <= 0}
                      onClick={() => setShadowTolerance((t) => Math.max(0, t - 1))}
                      title="Decrease tolerance"
                    >
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 1l4 4 4-4" /></svg>
                    </button>
                  </span>
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={128}
                value={shadowTolerance}
                onChange={(e) => setShadowTolerance(parseInt(e.target.value, 10))}
                disabled={processing}
                style={{ width: '100%', marginTop: 6 }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={keepShadows}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setKeepShadows(on);
                    // Soft shadows read best with the skill's original edge
                    // softening; exact cutout wants hard edges. Values stay
                    // editable after the toggle sets them.
                    setEdgeContract(on ? 1 : 0);
                    setEdgeSmooth(on ? 2 : 0);
                    setEdgeFeather(on ? 1 : 0);
                  }}
                  disabled={processing}
                />
                Keep soft shadows
                <span style={{ opacity: 0.6 }}>— removed pixels that were just darkened background come back as translucent black</span>
              </label>
            </label>
          )}

          {model === 'birefnet' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={aiKeepShadows}
                onChange={(e) => setAiKeepShadows(e.target.checked)}
                disabled={processing}
              />
              Keep soft shadows
              <span style={{ opacity: 0.6 }}>— removed pixels that were just darkened background come back as translucent black</span>
            </label>
          )}

          {model !== 'shadow' && (
            <label className="ai-modal-label">
              Matte Hardness
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={aiHardness}
                  onChange={(e) => setAiHardness(parseInt(e.target.value, 10))}
                  disabled={processing}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 12, width: 28, textAlign: 'right' }}>{aiHardness}</span>
              </div>
              <span className="ai-modal-size-hint">0 = the model&apos;s soft matte as-is; higher = harder cut at 50% confidence</span>
            </label>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, flexWrap: 'wrap' }}>
            <span style={{ opacity: 0.7 }}>Edge</span>
            {([['Contract', edgeContract, setEdgeContract, -20], ['Smooth', edgeSmooth, setEdgeSmooth, 0], ['Feather', edgeFeather, setEdgeFeather, 0]] as const).map(([label, val, set, min]) => (
              <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} title={label === 'Contract' ? 'Positive removes more (eats fringe), negative removes less (keeps a margin)' : undefined}>
                {label}
                <EdgeNumberInput value={val} onCommit={set} min={min} max={20} disabled={processing} />
              </span>
            ))}
          </div>

          {previewUrls[0] && (
            <label className="ai-modal-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Live Preview{imageNodes.length > 1 ? ' (first selected)' : ''}
                <button
                  className={`ai-modal-ratio-btn ${livePreviewOn ? 'ai-modal-preview-toggle-on' : 'ai-modal-preview-toggle-off'}`}
                  onClick={() => setLivePreviewOn((v) => {
                    // Always come back on at the cheap default — never surprise
                    // someone with a Full-res preview they picked earlier
                    if (!v) setPreviewRes('512');
                    return !v;
                  })}
                  disabled={processing}
                  title="Preview costs CPU (and a model run for the AI engines) — enable it when fine-tuning"
                >
                  {livePreviewOn ? 'On' : 'Off'}
                </button>
                {livePreviewOn && (['512', '1024', '2048', 'full'] as const).map((r) => (
                  <button
                    key={r}
                    className={`ai-modal-ratio-btn${previewRes === r ? ' ai-modal-ratio-btn-active' : ''}`}
                    onClick={() => { setPreviewRes(r); setPreviewLoading(true); }}
                    disabled={processing}
                    title="Preview resolution cap — the real run always uses the actual image size"
                    style={{ fontSize: 11, padding: '2px 6px' }}
                  >
                    {r === 'full' ? 'Full' : r}
                  </button>
                ))}
              </span>
              {livePreviewOn && previewStatus && (
                <span className="ai-modal-size-hint" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {previewStatus}
                  {previewNeedsLoad && model !== 'shadow' && (
                    <button
                      className="ai-modal-ratio-btn"
                      onClick={() => setForcedModels((prev) => new Set(prev).add(model))}
                      disabled={processing}
                    >
                      Load model
                    </button>
                  )}
                </span>
              )}
              {livePreviewOn && (
                <span style={{ position: 'relative', display: 'block' }}>
                  <canvas
                    ref={shadowPreviewRef}
                    style={{
                      width: '100%',
                      maxHeight: 240,
                      objectFit: 'contain',
                      borderRadius: 6,
                      background: 'repeating-conic-gradient(rgba(128,128,128,0.15) 0% 25%, transparent 0% 50%) 50% / 12px 12px',
                      opacity: previewLoading ? 0.35 : 1,
                    }}
                  />
                  {previewLoading && (
                    <span style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                      textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                      pointerEvents: 'none',
                    }}>
                      Loading...
                    </span>
                  )}
                </span>
              )}
            </label>
          )}

          {imageNodes.slice(0, 4).map((node, i) => (
            <div className="ai-modal-source-preview" key={node.id}>
              {previewUrls[i] && (
                <img
                  src={previewUrls[i]}
                  alt={node.fileName}
                  className="ai-modal-source-thumb"
                />
              )}
              <span className="ai-modal-source-name">
                {node.fileName} ({node.naturalWidth}&times;{node.naturalHeight})
                {(node.paintOverlayUrl || node.paintCompositeUrl) && ' + paint'}
              </span>
            </div>
          ))}
          {imageNodes.length > 4 && (
            <span className="ai-modal-size-hint">
              +{imageNodes.length - 4} more — all {imageNodes.length} selected elements will be processed
            </span>
          )}
        </div>

        <div className="prefs-footer">
          <button className="prefs-btn prefs-btn-secondary" onClick={onClose} disabled={processing}>
            Cancel
          </button>
          <button
            className="prefs-btn prefs-btn-primary"
            onClick={handleRemove}
            disabled={processing}
          >
            {processing ? 'Processing...' : `Remove Background${imageNodes.length > 1 ? ` (${imageNodes.length})` : ''}`}
          </button>
        </div>

        {keyPickerPos && createPortal(
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 100000 }}
            onPointerDown={(e) => { e.stopPropagation(); setKeyPickerPos(null); }}
          >
            <div
              style={{ position: 'absolute', top: keyPickerPos.top, left: keyPickerPos.left }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <ColorPicker
                color={chromaKey}
                onChange={setChromaKey}
                onClose={() => setKeyPickerPos(null)}
              />
            </div>
          </div>,
          document.body,
        )}
      </div>,
    document.body,
  );
}
