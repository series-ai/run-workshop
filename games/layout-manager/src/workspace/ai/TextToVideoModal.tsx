import { uuid } from '../uuid';
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
  {
    id: 'fal',
    label: 'Fal.ai',
    title: 'Fal-hosted video models (Kling, Veo, Seedance, MiniMax, FLUX, Grok, …) via your Fal.ai API key — pay-per-video',
    unavailableTitle: 'Needs a Fal.ai API key (Preferences > AI)',
  },
] as const;

/** Fal video family spec, served by the dev server's table (single source of truth) */
interface FalFamily {
  id: string; display: string; tier: 'cheap' | 'premium';
  textEndpoint: string | null; imageEndpoint: string;
  durations: [number, number] | number[] | null;
  aspects: string[] | null; resolutions: string[] | null;
  imageDropsAspect?: boolean; audio: boolean; negative: boolean; note?: string;
}
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
  const [resolution, setResolution] = useState<string>('720p');
  const [falAudio, setFalAudio] = useState(true);
  const [falNegative, setFalNegative] = useState('');
  const [falFamilies, setFalFamilies] = useState<FalFamily[]>([]);
  const [falModel, setFalModel] = useState('kling-v3-4k');
  useEffect(() => {
    fetch('/__fal-video-models').then((r) => r.json()).then((j) => { if (Array.isArray(j.families)) setFalFamilies(j.families); }).catch(() => {});
  }, []);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const sourceNode = refNodes[0] ?? null;
  const isFal = providerId === 'fal';
  const providerUp = providerId === 'hermes-grok' ? hermesXaiUp : !!config.falApiKey;
  const fam = isFal ? (falFamilies.find((f) => f.id === falModel) ?? falFamilies[0] ?? null) : null;
  // Each Fal family declares its own aspect/resolution/duration support;
  // null means "the endpoint decides" (no control shown)
  const activeAspects: readonly string[] = isFal ? (fam?.aspects ?? []) : VIDEO_ASPECTS;
  const famDurations: number[] = (() => {
    const d = fam?.durations;
    if (!d) return [];
    if (d.length === 2 && (d[1]! - d[0]!) > 1 && fam?.id !== 'veo3.1') {
      // range → sensible presets inside it
      const [lo, hi] = d as [number, number];
      return [lo, 4, 5, 6, 8, 10, 15, 20, 30, hi].filter((v, i, a) => v >= lo && v <= hi && a.indexOf(v) === i).sort((a, b) => a - b);
    }
    return [...(d as number[])];
  })();
  const famNeedsImage = !!fam && !fam.textEndpoint;
  const nearestAspect = (w: number, h: number): string => {
    const target = w / h;
    let best = activeAspects[0] ?? aspectRatio;
    let bestDiff = Infinity;
    for (const r of activeAspects) {
      const [a, b] = r.split(':').map(Number) as [number, number];
      const diff = Math.abs(Math.log(target / (a / b)));
      if (diff < bestDiff) { bestDiff = diff; best = r; }
    }
    return best;
  };
  const effectiveAspect = sourceNode && autoAspect
    ? nearestAspect(sourceNode.naturalWidth || sourceNode.width, sourceNode.naturalHeight || sourceNode.height)
    : (activeAspects.includes(aspectRatio) ? aspectRatio : (activeAspects[0] ?? aspectRatio));

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
    const ticket = uuid();
    const slug = prompt.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 5).join('-') || (isFal ? 'fal-video' : 'grok-video');
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

      const resp = isFal
        ? await fetch('/__ai-generate-fal-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: config.falApiKey, model: fam?.id, prompt: prompt.trim(), ticket, duration, aspectRatio: effectiveAspect, resolution, audio: falAudio, negativePrompt: falNegative, image }),
          })
        : await fetch('/__ai-generate-hermes-video', {
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
  }, [prompt, generating, duration, effectiveAspect, resolution, sourceNode, isFal, fam, falAudio, falNegative, config.falApiKey, onProgress]);

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
              const available = p.id === 'hermes-grok' ? hermesXaiUp : p.id === 'fal' ? !!config.falApiKey : false;
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

        {isFal && (
          <label className="ai-modal-label">
            Model
            <select
              className="ai-modal-size-input"
              value={fam?.id ?? ''}
              onChange={(e) => setFalModel(e.target.value)}
              disabled={generating}
              style={{ width: '100%' }}
            >
              {[...falFamilies].sort((a, b) => a.display.localeCompare(b.display)).map((f) => (
                <option key={f.id} value={f.id}>{f.display}</option>
              ))}
            </select>
            {isFal && !fam && <span className="ai-modal-size-hint">Loading Fal model list...</span>}
            {fam && (
              <span className="ai-modal-size-hint">
                Pay-per-video on your Fal account ({fam.tier === 'cheap' ? 'budget model' : 'premium pricing'})
                {fam.note ? ` · ${fam.note}` : ''}
                {famNeedsImage && !sourceNode ? ' · select an image to use this model' : ''}
              </span>
            )}
          </label>
        )}

        {!providerUp && (
          <div className="ai-modal-error" role="alert">
            {isFal
              ? 'Needs a Fal.ai API key (Preferences > AI).'
              : 'Needs the Hermes Agent with a SuperGrok / X Premium+ login (see Preferences > AI > Connections).'}
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

        {(!isFal || famDurations.length > 0) && (
        <label className="ai-modal-label">
          Duration
          <div className="ai-modal-ratio-row">
            {(isFal ? famDurations : [4, 6, 8, 10, 15]).map((d) => (
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
        )}

        {isFal && activeAspects.length === 0 ? null : isFal && sourceNode && fam?.imageDropsAspect ? (
          <label className="ai-modal-label">
            Aspect Ratio
            <span className="ai-modal-size-hint">{fam?.display} image-to-video follows the source image's shape — no ratio setting</span>
          </label>
        ) : (
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
            {activeAspects.map((r) => (
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
        )}

        {isFal ? (
          <>
            {fam?.resolutions && (
              <label className="ai-modal-label">
                Resolution
                <div className="ai-modal-ratio-row">
                  {fam.resolutions.map((r) => (
                    <button
                      key={r}
                      className={`ai-modal-ratio-btn${resolution === r ? ' ai-modal-ratio-btn-active' : ''}`}
                      onClick={() => setResolution(r)}
                      disabled={generating}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                {!fam.resolutions.includes(resolution) && (
                  <span className="ai-modal-size-hint">Pick a resolution this model supports (otherwise its default applies)</span>
                )}
              </label>
            )}
            {fam?.audio && (
              <label className="ai-modal-label" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={falAudio} onChange={(e) => setFalAudio(e.target.checked)} disabled={generating} />
                Generate audio
              </label>
            )}
            {fam?.negative && (
              <label className="ai-modal-label">
                Negative prompt (optional)
                <input
                  type="text"
                  className="ai-modal-size-input"
                  style={{ width: '100%' }}
                  value={falNegative}
                  onChange={(e) => setFalNegative(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="What to avoid — e.g. blur, text, extra limbs"
                  disabled={generating}
                />
              </label>
            )}
          </>
        ) : (
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
        )}

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
          disabled={!prompt.trim() || generating || !providerUp || (isFal && !fam) || (famNeedsImage && !sourceNode)}
        >
          {generating ? 'Generating...' : 'Generate'}
        </button>
      </div>
    </div>,
    document.body,
  );
}
