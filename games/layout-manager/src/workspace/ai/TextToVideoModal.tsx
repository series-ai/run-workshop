import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { UserConfig } from '../userConfig';
import type { ImageNode } from '../types';
import { flattenNode } from './flattenNode';
import { friendlyAiError } from './TextToImageModal';
import { useDraggableModal } from './useDraggableModal';

interface TextToVideoModalProps {
  config: UserConfig;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  refNodes: ImageNode[];
  position?: { top: number; left: number };
  onProgress: (progress: { message: string; progress?: number } | null) => void;
  onClose: () => void;
}

const VIDEO_ASPECTS = ['9:16', '16:9', '1:1', '4:3', '3:4', '3:2', '2:3'] as const;

// Video providers — one today, built to grow. Each future provider gets an
// availability check and its own generate path.
const VIDEO_PROVIDERS = [
  {
    id: 'hermes-grok',
    label: 'Grok (Hermes)',
    title: 'Grok Imagine video via your local Hermes agent (SuperGrok login, no API key)',
    unavailableTitle: 'Needs the Hermes Agent with a SuperGrok / X Premium+ login',
  },
] as const;
type VideoProviderId = (typeof VIDEO_PROVIDERS)[number]['id'];

/**
 * Grok Imagine video via the local Hermes agent (SuperGrok login, no API key).
 * Layout Manager can't place video on the canvas, so the result saves to disk:
 * the download (and its save dialog) starts the instant Generate is clicked —
 * gesture-safe ticket — and Hermes streams the MP4 into it when finished.
 * With a selected image the backend auto-routes to image-to-video
 * (grok-imagine-video-1.5); text alone uses grok-imagine-video.
 */
export function TextToVideoModal({ config, prompt, onPromptChange, refNodes, position, onProgress, onClose }: TextToVideoModalProps) {
  const { panelRef, onPointerDown, onPointerMove, onPointerUp } = useDraggableModal();

  const [providerId, setProviderId] = useState<VideoProviderId>('hermes-grok');
  const [hermesXaiUp, setHermesXaiUp] = useState(false);
  const [has1080, setHas1080] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch('/__ai-local-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then((r) => r.json())
      .then((st) => {
        if (cancelled) return;
        setHermesXaiUp(!!st.hermesImageGen?.xai && config.hermesEnabled);
        setHas1080(!!st.hermesImageGen?.video1080);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [duration, setDuration] = useState(4);
  const [aspectRatio, setAspectRatio] = useState<string>('9:16');
  // With a source image, "auto" picks the supported ratio closest to the
  // image's own shape (the API only accepts the 7 fixed ratios) so the
  // animation isn't stretched into whatever ratio happened to be selected
  const [autoAspect, setAutoAspect] = useState(true);
  const [resolution, setResolution] = useState<'480p' | '720p' | '1080p'>('720p');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const sourceNode = refNodes[0] ?? null;
  const nearestAspect = (w: number, h: number): string => {
    const target = w / h;
    let best = VIDEO_ASPECTS[0] as string;
    let bestDiff = Infinity;
    for (const r of VIDEO_ASPECTS) {
      const [a, b] = r.split(':').map(Number) as [number, number];
      const diff = Math.abs(Math.log(target / (a / b)));
      if (diff < bestDiff) { bestDiff = diff; best = r; }
    }
    return best;
  };
  const effectiveAspect = sourceNode && autoAspect
    ? nearestAspect(sourceNode.naturalWidth || sourceNode.width, sourceNode.naturalHeight || sourceNode.height)
    : aspectRatio;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || generating) return;
    setGenError(null);
    setGenerating(true);

    // Claim the download ticket NOW, inside the click — the save dialog
    // appears immediately; the video streams into it when generation ends
    const ticket = crypto.randomUUID();
    const slug = prompt.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 5).join('-') || 'grok-video';
    const a = document.createElement('a');
    a.href = `/__download/${ticket}/${encodeURIComponent(slug)}.mp4`;
    a.download = `${slug}.mp4`;
    a.click();

    onProgress({ message: 'Starting video generation...' });
    // Abort the click-time download on ANY failure — otherwise the browser's
    // download entry sits pending until the server ticket times out
    const abortDownload = () => fetch(`/__download-fulfill/${ticket}`, { method: 'POST', body: new Blob([]) }).catch(() => {});
    let fulfilled = false;
    try {
      let image: { base64: string; mimeType?: string } | undefined;
      if (sourceNode) {
        onProgress({ message: 'Preparing source image...' });
        // Re-encode through a canvas so blob URLs and WebP sources arrive as PNG
        const srcUrl = await flattenNode(sourceNode);
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error('Could not load the source image'));
          el.src = srcUrl;
        });
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext('2d')!.drawImage(img, 0, 0);
        const pngUrl = c.toDataURL('image/png');
        image = { base64: pngUrl.slice(pngUrl.indexOf(',') + 1), mimeType: 'image/png' };
      }

      const resp = await fetch('/__ai-generate-hermes-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), ticket, duration, aspectRatio: effectiveAspect, resolution, image }),
      });
      if (!resp.ok || !resp.body) {
        let msg = `Request failed: ${resp.status}`;
        try { msg = (await resp.json()).error || msg; } catch { /* keep */ }
        throw new Error(msg);
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let gotVideo = false;
      let hadError = false;
      readLoop: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop()!;
        for (const part of parts) {
          let event = '';
          let data = '';
          for (const line of part.split('\n')) {
            if (line.startsWith('event: ')) event = line.slice(7);
            else if (line.startsWith('data: ')) data = line.slice(6);
          }
          if (!event || !data) continue;
          let parsed: { message?: string; error?: string };
          try { parsed = JSON.parse(data); } catch { continue; }
          if (event === 'progress') onProgress({ message: parsed.message ?? 'Working...' });
          else if (event === 'video') { gotVideo = true; fulfilled = true; }
          else if (event === 'error') { hadError = true; setGenError(friendlyAiError(parsed.error ?? 'Unknown error')); }
          else if (event === 'done') break readLoop;
        }
      }
      if (gotVideo && !hadError) {
        import('./completionSound').then((m) => m.playCompletionSound());
      }
    } catch (e) {
      setGenError(friendlyAiError(e instanceof Error ? e.message : 'Unknown error'));
    }
    if (!fulfilled) void abortDownload();
    onProgress(null);
    setGenerating(false);
  }, [prompt, generating, duration, effectiveAspect, resolution, sourceNode, onProgress]);

  return createPortal(
    <div
      className={`prefs-dialog ai-modal ai-modal-container${position ? ' ai-modal-aligned' : ''}`}
      ref={panelRef}
      style={position ? { maxWidth: 460, top: position.top, left: position.left } : { maxWidth: 460 }}
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
        <h2>Text to Video</h2>
        <button className="prefs-close" onClick={onClose} disabled={generating}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="ai-modal-body">
        <label className="ai-modal-label">
          Provider
          <div className="ai-modal-ratio-row">
            {/* Single provider today; more video providers slot in here as buttons */}
            {VIDEO_PROVIDERS.map((p) => {
              const available = p.id === 'hermes-grok' ? hermesXaiUp : false;
              return (
                <button
                  key={p.id}
                  className={`ai-modal-ratio-btn${p.id === providerId ? ' ai-modal-ratio-btn-active' : ''}${!available ? ' ai-modal-ratio-btn-disabled' : ''}`}
                  onClick={() => { if (available) setProviderId(p.id); }}
                  title={available ? p.title : p.unavailableTitle}
                  disabled={!available}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </label>

        {!hermesXaiUp && (
          <div className="ai-modal-error" role="alert">
            Needs the Hermes Agent with a SuperGrok / X Premium+ login (see Preferences &gt; AI &gt; Connections).
          </div>
        )}

        <span className="ai-modal-size-hint">
          The result saves to disk — the save dialog opens when you hit Generate, and the file lands when the
          video finishes (typically 1–4 minutes).
          {sourceNode
            ? ' The selected image will be animated (image-to-video).'
            : ' Select an image first to animate it (image-to-video); with no selection the video comes from the prompt alone.'}
        </span>

        {sourceNode && (
          <label className="ai-modal-label">
            Source image
            <div className="ai-modal-ref-grid">
              <div className="ai-modal-ref-cell ai-modal-ref-cell-main">
                <img
                  src={sourceNode.paintCompositeUrl || sourceNode.src}
                  alt={sourceNode.fileName}
                  className="ai-modal-ref-thumb"
                  title={sourceNode.fileName}
                />
                <span className="ai-modal-ref-badge">Main</span>
              </div>
            </div>
            {refNodes.length > 1 && (
              <span className="ai-modal-size-hint">Only the first selected image is animated</span>
            )}
          </label>
        )}

        <label className="ai-modal-label">
          Duration
          <div className="ai-modal-ratio-row">
            {[4, 6, 8, 10, 15].map((d) => (
              <button
                key={d}
                className={`ai-modal-ratio-btn${duration === d ? ' ai-modal-ratio-btn-active' : ''}`}
                onClick={() => setDuration(d)}
                disabled={generating}
              >
                {d}s
              </button>
            ))}
          </div>
        </label>

        <label className="ai-modal-label">
          Aspect Ratio
          <div className="ai-modal-ratio-row">
            {sourceNode && (
              <button
                className={`ai-modal-ratio-btn${autoAspect ? ' ai-modal-ratio-btn-active' : ''}`}
                onClick={() => setAutoAspect(true)}
                disabled={generating}
                title="Match the source image's shape (closest supported ratio)"
              >
                Auto
              </button>
            )}
            {VIDEO_ASPECTS.map((r) => (
              <button
                key={r}
                className={`ai-modal-ratio-btn${!(sourceNode && autoAspect) && r === aspectRatio ? ' ai-modal-ratio-btn-active' : ''}`}
                onClick={() => { setAspectRatio(r); setAutoAspect(false); }}
                disabled={generating}
              >
                {r}
              </button>
            ))}
          </div>
          {sourceNode && autoAspect && (
            <span className="ai-modal-size-hint">Auto: using {effectiveAspect} to match the source image</span>
          )}
        </label>

        <label className="ai-modal-label">
          Resolution
          <div className="ai-modal-ratio-row">
            {([...(['480p', '720p'] as const), ...(has1080 ? (['1080p'] as const) : [])]).map((r) => (
              <button
                key={r}
                className={`ai-modal-ratio-btn${resolution === r ? ' ai-modal-ratio-btn-active' : ''}`}
                onClick={() => setResolution(r)}
                disabled={generating}
                title={r === '480p' ? 'Faster, smaller file' : r === '720p' ? 'Balanced' : 'Native on image-to-video (Video 1.5)'}
              >
                {r}
              </button>
            ))}
          </div>
          {/* Hermes' plugin metadata claims no audio support, but verified
              output MP4s carry a real generated audio track */}
          <span className="ai-modal-size-hint">Videos include Grok-generated ambient audio</span>
        </label>

        <label className="ai-modal-label">
          Prompt
          <textarea
            className="ai-modal-textarea"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleGenerate(); } }}
            placeholder={sourceNode ? 'Describe the motion — camera movement, what animates, mood' : 'Describe the video — subject, motion, camera, style'}
            rows={3}
            disabled={generating}
          />
        </label>

        {genError && (
          <div className="ai-modal-error" role="alert">
            {genError}
          </div>
        )}
      </div>

      <div className="prefs-footer">
        <button className="prefs-btn prefs-btn-secondary" onClick={onClose} disabled={generating}>
          Cancel
        </button>
        <button
          className="prefs-btn prefs-btn-primary"
          onClick={handleGenerate}
          disabled={!prompt.trim() || generating || !hermesXaiUp}
        >
          {generating ? 'Generating...' : 'Generate'}
        </button>
      </div>
    </div>,
    document.body,
  );
}
