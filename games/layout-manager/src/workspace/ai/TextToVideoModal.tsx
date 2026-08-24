import { uuid } from '../uuid';
import { postDownloadFulfill } from '../downloadFulfill';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  imageDropsAspect?: boolean; endImageKey?: string; audio: boolean; negative: boolean; note?: string; typical?: string; elements?: boolean;
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

  // Which selected image is the Start (main) frame, and — for families that
  // support it — which is the End frame. Selection order isn't controllable,
  // so the user picks by clicking: the clicked image is Start and, with 2+
  // images on an end-frame model, another image is always the End (the
  // swapped-out Start if any, else the first other). Clicking either swaps.
  const [startRefId, setStartRefId] = useState<string | null>(null);
  const [endRefId, setEndRefId] = useState<string | null>(null);
  const shownRefs = refNodes.slice(0, 8);
  const sourceNode = (startRefId && refNodes.find((n) => n.id === startRefId)) || refNodes[0] || null;
  useEffect(() => {
    if (startRefId && !refNodes.some((n) => n.id === startRefId)) setStartRefId(null);
    if (endRefId && !refNodes.some((n) => n.id === endRefId)) setEndRefId(null);
  }, [refNodes, startRefId, endRefId]);
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
  // Second selected image = end frame, for Fal families that take one
  const supportsEndFrame = isFal && !!fam?.endImageKey;
  // End-frame models with 2+ images: the clicked image is Start and another
  // is End — the explicitly swapped-out one if there is one, else the first
  // other selected image. Clicking the End swaps the two.
  // Extra images beyond Start/End become References where the provider takes
  // them: Grok video (up to 7 reference_image_urls), Kling (elements)
  const supportsRefs = providerId === 'hermes-grok' || (isFal && !!fam?.elements);
  const refRole = isFal && fam?.elements ? 'Element' : 'Ref';
  const endNode = supportsEndFrame && sourceNode && refNodes.length >= 2
    ? ((endRefId && endRefId !== sourceNode.id ? refNodes.find((n) => n.id === endRefId) : null)
        ?? refNodes.find((n) => n.id !== sourceNode.id) ?? null)
    : null;
  const refNodesExtra = supportsRefs && sourceNode
    ? shownRefs.filter((n) => n.id !== sourceNode.id && n.id !== endNode?.id).slice(0, 7)
    : [];
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

  // Stop a running generation: server-side cancel (kills the Hermes agent /
  // aborts the Fal poll) plus the pending download. Fal may still bill a
  // job it already started — this saves time, not necessarily money.
  // Local stop state covers the client-side prepare phase (before anything is
  // registered server-side) and aborts the in-flight request itself
  const stopRequestedRef = useRef(false);
  const requestAbortRef = useRef<AbortController | null>(null);
  const handleStop = useCallback(() => {
    stopRequestedRef.current = true;
    // Cancel the server-side job FIRST (it kills the agent / aborts the poll
    // and aborts the pending download), then drop our stream — the other
    // order lets a job finish after the panel already says Stopped
    import('./aiClient').then((m) => m.cancelGeneration());
    setTimeout(() => requestAbortRef.current?.abort(), 300);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || generating) return;
    setGenError(null);
    setGenerating(true);
    stopRequestedRef.current = false;
    const requestAbort = new AbortController();
    requestAbortRef.current = requestAbort;

    // Claim the download ticket NOW, inside the click — the save dialog
    // appears immediately; the video streams into it when generation ends
    const ticket = uuid();
    const slug = prompt.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 5).join('-') || (isFal ? 'fal-video' : 'grok-video');
    const a = document.createElement('a');
    a.href = `/__download/${ticket}/${encodeURIComponent(slug)}.mp4`;
    a.download = `${slug}.mp4`;
    a.click();

    const startedAt = Date.now();
    const elapsed = () => { const s = Math.round((Date.now() - startedAt) / 1000); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`; };
    onProgress({ message: 'Starting video generation...' });
    // Abort the click-time download on ANY failure — otherwise the browser's
    // download entry sits pending until the server ticket times out
    const abortDownload = () => postDownloadFulfill(ticket, null);
    let fulfilled = false;
    try {
      // Re-encode through a canvas so blob URLs and WebP sources arrive as PNG
      const toPng = async (node: ImageNode): Promise<{ base64: string; mimeType: string }> => {
        const srcUrl = await flattenNode(node);
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
        return { base64: pngUrl.slice(pngUrl.indexOf(',') + 1), mimeType: 'image/png' };
      };
      let image: { base64: string; mimeType?: string } | undefined;
      let endImage: { base64: string; mimeType?: string } | undefined;
      let refImages: { base64: string; mimeType?: string }[] | undefined;
      if (sourceNode) {
        onProgress({ message: 'Preparing images...' });
        image = await toPng(sourceNode);
        if (endNode) endImage = await toPng(endNode);
        if (refNodesExtra.length) refImages = await Promise.all(refNodesExtra.map(toPng));
      }
      // Stop pressed while preparing: nothing was submitted — just bail
      if (stopRequestedRef.current) throw new Error('Cancelled');

      const resp = isFal
        ? await fetch('/__ai-generate-fal-video', {
            method: 'POST',
            signal: requestAbort.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: config.falApiKey, model: fam?.id, prompt: prompt.trim(), ticket, duration, aspectRatio: effectiveAspect, resolution, audio: falAudio, negativePrompt: falNegative, image, endImage, refImages }),
          })
        : await fetch('/__ai-generate-hermes-video', {
            method: 'POST',
            signal: requestAbort.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt.trim(), ticket, duration, aspectRatio: effectiveAspect, resolution, image, refImages }),
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
          if (event === 'progress') onProgress({ message: `${parsed.message ?? 'Working...'} (${elapsed()})` });
          else if (event === 'video') { gotVideo = true; fulfilled = true; }
          else if (event === 'error') {
            hadError = true;
            // A Stop arrives as a server 'Cancelled' event on the still-open stream
            if (stopRequestedRef.current || parsed.error === 'Cancelled') setGenError('Stopped.');
            else setGenError(friendlyAiError(parsed.error ?? 'Unknown error'));
          }
          else if (event === 'done') break readLoop;
        }
      }
      if (gotVideo && !hadError) {
        import('./completionSound').then((m) => m.playCompletionSound());
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      if (stopRequestedRef.current || /abort/i.test(msg) || msg === 'Cancelled') setGenError('Stopped.');
      else setGenError(friendlyAiError(msg));
    }
    requestAbortRef.current = null;
    if (!fulfilled) void abortDownload();
    onProgress(null);
    setGenerating(false);
  }, [prompt, generating, duration, effectiveAspect, resolution, sourceNode, endNode, refNodesExtra, isFal, fam, falAudio, falNegative, config.falApiKey, onProgress]);

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
                {fam.typical ? ` · typically ${fam.typical}` : ''}
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

        {!sourceNode && famNeedsImage && (
          <label className="ai-modal-label">
            Source image
            <div className="ai-modal-error" role="alert">
              {fam?.display} is image-to-video only — select an image on the canvas to animate it.
            </div>
          </label>
        )}

        {sourceNode && (
          <label className="ai-modal-label">
            {supportsEndFrame ? (supportsRefs ? 'Start / End / Elements' : 'Start / End frames') : supportsRefs ? 'Source + references' : 'Source image'}
            <div className="ai-modal-ref-grid">
              {/* Show only the images the model will actually use: all of them
                  when extras are references, Start+End for end-frame-only
                  models, just the one for single-image models */}
              {(supportsRefs ? shownRefs : supportsEndFrame ? [sourceNode, ...(endNode ? [endNode] : [])] : [sourceNode]).map((node) => {
                const refIdx = refNodesExtra.findIndex((n) => n.id === node.id);
                const role = node.id === sourceNode.id ? (supportsEndFrame ? 'Start' : 'Main')
                  : endNode?.id === node.id ? 'End'
                  : refIdx >= 0 ? (refRole === 'Element' ? `Element ${refIdx + 1}` : 'Ref')
                  : null;
                const clickable = (supportsRefs && shownRefs.length > 1) || (supportsEndFrame && !!endNode);
                // Whatever you click becomes the Start; with an end-frame model
                // the other image is the End, and clicking the End swaps them.
                const onClick = () => {
                  if (role === 'Main') return;
                  // Clicking the Start swaps it with the End (if there is one)
                  if (role === 'Start') { if (endNode) { setStartRefId(endNode.id); setEndRefId(node.id); } return; }
                  setStartRefId(node.id);
                  // Clicking the End swaps; clicking a Ref/Element promotes it and
                  // keeps the current End (or, if no End, the old Start becomes End)
                  setEndRefId(supportsEndFrame ? (role === 'End' || !endNode ? sourceNode.id : endNode.id) : null);
                };
                const tip = !clickable ? node.fileName
                  : role === 'Start' ? `${node.fileName} — Start${endNode ? ' (click to swap with End)' : ''}`
                  : role === 'Main' ? `${node.fileName} — Main`
                  : role === 'End' ? `${node.fileName} — End (click to make it the Start)`
                  : role ? `${node.fileName} — ${role} (click to make it the Start)`
                  : `${node.fileName} — click to make it the ${supportsEndFrame ? 'Start' : 'Main'}`;
                return (
                  <div key={node.id} className={`ai-modal-ref-cell${role === 'Start' || role === 'Main' ? ' ai-modal-ref-cell-start' : role === 'End' ? ' ai-modal-ref-cell-end' : role ? ' ai-modal-ref-cell-ref' : ''}`}>
                    <img
                      src={node.paintCompositeUrl || node.src}
                      alt={node.fileName}
                      className="ai-modal-ref-thumb"
                      title={tip}
                      style={clickable ? { cursor: 'pointer', opacity: role ? 1 : 0.6 } : undefined}
                      onClick={clickable ? onClick : undefined}
                    />
                    {role && <span className="ai-modal-ref-badge">{role}</span>}
                  </div>
                );
              })}
            </div>
            <span className="ai-modal-size-hint">
              {[
                supportsEndFrame
                  ? (endNode ? `${fam?.display} transitions from Start to End — click either to swap${refNodes.length > 2 && !supportsRefs ? ' (other selected images are ignored)' : ''}` : 'Select a second image to use as the End frame')
                  : shownRefs.length > 1 && !supportsRefs ? 'Only this image is animated (the first selected) — the other selected images are ignored' : '',
                supportsRefs && refRole === 'Element'
                  ? (refNodesExtra.length ? 'Extra images are Kling elements — refer to them in the prompt as @Element1, @Element2…' : 'Select more images to add them as Kling elements (characters/objects the prompt can name as @Element1…)')
                  : supportsRefs
                    ? (refNodesExtra.length ? `${refNodesExtra.length} extra image${refNodesExtra.length > 1 ? 's' : ''} sent as style/character references (up to 7)` : 'Select more images to send them as style/character references (up to 7)')
                    : '',
              ].filter(Boolean).join(' · ')}
            </span>
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
        {generating ? (
          <button className="prefs-btn prefs-btn-secondary" onClick={handleStop} title="Stop the running generation (a Fal job already started may still be billed)">
            Stop
          </button>
        ) : (
          <button className="prefs-btn prefs-btn-secondary" onClick={onClose}>
            Cancel
          </button>
        )}
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
