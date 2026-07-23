import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { ImageNode } from '../types';
import { flattenNode, urlToBlob } from './flattenNode';
import { useDraggableModal } from './useDraggableModal';

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
  const [model, setModel] = useState<'isnet' | 'u2netp'>('isnet');

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
        const resultBlob = await removeImageBackground(blob, (phase, pct) => {
          const prefix = imageNodes.length > 1 ? `(${i + 1}/${imageNodes.length}) ` : '';
          onProgress({ message: prefix + phase, progress: Math.round(pct * 100) });
        }, model);
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
      alert(`Background removal failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
    setProcessing(false);
  }, [processing, imageNodes, onGenerated, onProgress]);

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
                className={`ai-modal-ratio-btn${model === 'isnet' ? ' ai-modal-ratio-btn-active' : ''}`}
                onClick={() => setModel('isnet')}
                disabled={processing}
              >
                Quality (Local)
              </button>
              <button
                className={`ai-modal-ratio-btn${model === 'u2netp' ? ' ai-modal-ratio-btn-active' : ''}`}
                onClick={() => setModel('u2netp')}
                disabled={processing}
              >
                Fast (Local)
              </button>
            </div>
            <span className="ai-modal-size-hint">
              Runs in your browser — no API key needed.
              {model === 'isnet' ? ' Best edges; ~170 MB one-time model download.' : ' Small model (~5 MB), rougher edges.'}
            </span>
          </label>

          {imageNodes.map((node, i) => (
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
      </div>,
    document.body,
  );
}
