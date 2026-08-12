import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { ImageNode } from '../types';
import { flattenNode } from './flattenNode';
import { useDraggableModal } from './useDraggableModal';
import { friendlyAiError } from './TextToImageModal';
import type { UserConfig } from '../userConfig';
import type { LayerizeLayer } from './aiClient';

interface LayerizeModalProps {
  config: UserConfig;
  sourceNodes: ImageNode[];
  position?: { top: number; left: number };
  onGenerated: (layers: { localUrl: string; name: string | null; w: number; h: number; bbox: number[] | null }[], sourceNode: ImageNode) => void;
  onProgress: (progress: { message: string; progress?: number } | null) => void;
  onClose: () => void;
}

export function LayerizeModal({ config, sourceNodes, position, onGenerated, onProgress, onClose }: LayerizeModalProps) {
  const { panelRef, onPointerDown, onPointerMove, onPointerUp } = useDraggableModal();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [processing, setProcessing] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [disableSafety, setDisableSafety] = useState(true);

  // Layerize works on a single image — first selected element
  const node = sourceNodes.find((n) => n.nodeType !== 'text') ?? null;

  useEffect(() => {
    if (node) flattenNode(node).then(setPreviewUrl);
  }, [node]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleRun = useCallback(async () => {
    if (processing || !node) return;
    if (!config.falApiKey) {
      setGenError('Add your Fal.ai API key in Preferences > AI to use this feature.');
      return;
    }
    setGenError(null);
    setProcessing(true);
    onProgress({ message: 'Splitting into layers...' });
    try {
      const { layerizeImage } = await import('./aiClient');
      const flatUrl = await flattenNode(node);
      const result = await layerizeImage(
        { apiKeys: config },
        { sourceImageUrl: flatUrl, prompt: prompt.trim() || undefined, disableSafety },
        (msg) => onProgress({ message: msg }),
      );
      if (result.cancelled) {
        onProgress(null);
        setProcessing(false);
        return;
      }
      // Decode each layer for natural dimensions before placing
      const decoded: { localUrl: string; name: string | null; w: number; h: number; bbox: number[] | null }[] = [];
      for (const layer of result.layers as LayerizeLayer[]) {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = reject;
          el.src = layer.dataUrl;
        });
        decoded.push({ localUrl: layer.dataUrl, name: layer.name, w: img.naturalWidth, h: img.naturalHeight, bbox: layer.bbox });
      }
      const { playCompletionSound } = await import('./completionSound');
      playCompletionSound();
      onProgress(null);
      onGenerated(decoded, node);
    } catch (e) {
      onProgress(null);
      const raw = e instanceof Error ? e.message : String(e);
      // Bytedance filters depictions of people (incl. anime characters)
      // aggressively and fal surfaces the rejection as a generic 5xx — say so
      const friendly = /503|UNAVAILABLE|overloaded|500/i.test(raw)
        ? 'The provider rejected this request — either its servers are busy, or its content filter blocked the image (Bytedance is strict about depictions of people, including anime characters). Retry, or try the "Disable safety checker" option below.'
        : friendlyAiError(raw);
      setGenError(friendly);
    }
    setProcessing(false);
  }, [processing, node, prompt, disableSafety, config, onGenerated, onProgress]);

  if (!node) return null;

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
        <h2>Split to Layers</h2>
        <button className="prefs-close" onClick={onClose} disabled={processing}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="ai-modal-body">
        <span className="ai-modal-size-hint">
          Seedream Layerize splits the image into 2–17 transparent layers (background + separate elements),
          placed as new elements next to the original. Uses your Fal.ai key — paid per call, ~30–60s.
        </span>

        <div className="ai-modal-source-preview">
          {previewUrl && <img src={previewUrl} alt={node.fileName} className="ai-modal-source-thumb" />}
          <span className="ai-modal-source-name">
            {node.fileName} ({node.naturalWidth}&times;{node.naturalHeight})
            {(node.paintOverlayUrl || node.paintCompositeUrl) && ' + paint'}
          </span>
        </div>

        <label className="ai-modal-label">
          Guidance (optional)
          <textarea
            className="ai-modal-textarea"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe which elements to separate — leave empty to let the model decide"
            rows={2}
            disabled={processing}
            spellCheck
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={disableSafety}
            onChange={(e) => setDisableSafety(e.target.checked)}
            disabled={processing}
          />
          Disable safety checker
          <span style={{ opacity: 0.6 }}>— may allow images of people/characters; requires your fal account to permit it</span>
        </label>

        {genError && (
          <div className="ai-modal-error" role="alert">
            {genError}
          </div>
        )}
      </div>

      <div className="prefs-footer">
        <button className="prefs-btn prefs-btn-secondary" onClick={onClose} disabled={processing}>
          Cancel
        </button>
        <button className="prefs-btn prefs-btn-primary" onClick={handleRun} disabled={processing}>
          {processing ? 'Splitting...' : 'Split to Layers'}
        </button>
      </div>
    </div>,
    document.body,
  );
}
