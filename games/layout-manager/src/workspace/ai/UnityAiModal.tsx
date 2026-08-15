import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { UserConfig } from '../userConfig';
import type { ImageNode } from '../types';
import { flattenNode } from './flattenNode';
import { friendlyAiError } from './TextToImageModal';
import { useDraggableModal } from './useDraggableModal';

interface UnityAiModalProps {
  config: UserConfig;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  refNodes: ImageNode[];
  position?: { top: number; left: number };
  onGenerated: (imageUrl: string, width: number, height: number, prompts: { title: string; text: string }[], batchIndex: number) => void;
  onProgress: (progress: { message: string; progress?: number } | null) => void;
  onClose: () => void;
}

interface UnityModel {
  id: string;
  displayName: string;
  blurb: string;
  modalities: string[];
  caps: string[];
}

interface UnityStatus {
  checking: boolean;
  up?: boolean;
  project?: string;
  version?: string;
  port?: number;
  points?: { available: number; allocated: number } | null;
  error?: string;
}

/** Purpose groups, in display order. A model lands in the first group that matches. */
const GROUPS: { name: string; match: (m: UnityModel) => boolean }[] = [
  { name: 'Utilities', match: (m) => /upscale|recolor|background.?remov|pixelate/i.test(m.id + ' ' + m.blurb) },
  { name: 'Icons & UI', match: (m) => /icon|\bui\b|9.?slice|card|button|frame/i.test(m.id + ' ' + m.blurb) || m.caps.includes('Supports9SliceUI') },
  { name: 'Environments', match: (m) => /environment|landscape|rpg|scene/i.test(m.id + ' ' + m.blurb) },
  { name: 'Textures & Materials', match: (m) => m.caps.includes('SupportsTileable') || /texture|tileable|material|pbr/i.test(m.id + ' ' + m.blurb) },
  { name: 'General', match: () => true },
];

// Transform utilities that require a SOURCE image (or palette). The generic
// GenerateAsync API only carries style references, so these silently redraw
// instead of transforming — Unity's dedicated methods (UpscaleImageAsync,
// RemoveSpriteBackgroundAsync, RecolorImageAsync) would be needed to offer
// them honestly. Hidden until that's built. Verified 2026-08-14: pixelate
// returned a smooth redraw, Photoroom returned no transparency, Recolor had
// no palette to work from. The upscalers DO work through the generic path.
const BROKEN_UTILITIES = new Set(['scenario-image-transform', 'photoroom-bg-removal', 'gpt-image-1-5-recolor']);

// Observed behavior (2026-08-14): each of these doubled the input resolution
const UPSCALERS = new Set(['scenario-gemini-upscale', 'magnific-upscaler-precision', 'scenario-texture-upscale-v3', 'scenario-upscale-v3']);

/** Only 2D image output makes sense on the canvas (v1). */
function isImageModel(m: UnityModel): boolean {
  if (BROKEN_UTILITIES.has(m.id)) return false;
  if (!m.modalities.length) return true;
  return m.modalities.some((mod) => /image|sprite|texture/i.test(mod));
}

export function UnityAiModal({ config, prompt, onPromptChange, refNodes, position, onGenerated, onProgress, onClose }: UnityAiModalProps) {
  const { panelRef, onPointerDown, onPointerMove, onPointerUp } = useDraggableModal();
  const projectPath = config.unityProjectPath.trim();

  const [status, setStatus] = useState<UnityStatus>({ checking: true });
  const [models, setModels] = useState<UnityModel[] | null>(null);
  // Which project the catalog was fetched from — a re-check or Preferences
  // override can switch Editors, and the old catalog must not survive that
  const [modelsProject, setModelsProject] = useState<string | null>(null);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelId, setModelId] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('General');
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [lastCost, setLastCost] = useState<string | null>(null);

  const checkStatus = useCallback(() => {
    setStatus({ checking: true });
    fetch('/__unity-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath }),
    })
      .then((r) => r.json())
      .then((st) => setStatus({ checking: false, up: !!st.up, project: st.project, version: st.version, port: st.port, points: st.points, error: st.error }))
      .catch((e) => setStatus({ checking: false, up: false, error: e instanceof Error ? e.message : 'Status check failed' }));
  }, [projectPath]);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  // Model list: fetched once the Editor is confirmed up (server caches it)
  useEffect(() => {
    const target = status.project ?? projectPath;
    if (status.checking || !status.up || (models && modelsProject === target)) return;
    let cancelled = false;
    fetch('/__unity-models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath: target }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.error) { setModelsError(j.error); return; }
        const list = (j.models as UnityModel[]).filter(isImageModel);
        setModels(list);
        setModelsProject(target);
        if (!list.some((m) => m.id === modelId)) {
          setModelId(list.find((m) => m.id === 'gemini-3.1-flash')?.id ?? list[0]?.id ?? '');
        }
      })
      .catch((e) => { if (!cancelled) setModelsError(e instanceof Error ? e.message : 'Could not load models'); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, projectPath, modelsProject]);

  // The status probe resolves which project/Editor to talk to (auto-detected
  // when no path is configured) — models and generation follow it
  const effectiveProject = status.project ?? projectPath;
  const selected = models?.find((m) => m.id === modelId) ?? null;
  const supportsCustomRes = !!selected?.caps.includes('SupportsCustomResolutions');
  const supportsRefs = !!selected?.caps.includes('SupportsImageReference');
  const refNode = refNodes[0] ?? null;
  const useRefImage = !!refNode && supportsRefs;

  const searching = search.trim().length > 0;
  const grouped = useMemo(() => {
    if (!models) return [];
    const seen = new Set<string>();
    const groups = GROUPS.map((g) => ({
      name: g.name,
      models: models.filter((m) => {
        if (seen.has(m.id) || !g.match(m)) return false;
        seen.add(m.id);
        return true;
      }),
    })).filter((g) => g.models.length > 0);
    // GROUPS order is matching priority (General is the catch-all and must
    // match last) — but General is the default, so it displays first
    return groups.sort((a, b) => (a.name === 'General' ? -1 : b.name === 'General' ? 1 : 0));
  }, [models]);

  // Searching looks across ALL categories (category buttons pause); otherwise
  // the list is the active category's models. No silent fallback to another
  // category — the highlight only ever shows what the user picked.
  const activeGroup = grouped.find((g) => g.name === category) ?? grouped[0] ?? null;
  const shownModels = useMemo(() => {
    if (!models) return [];
    if (searching) {
      const q = search.trim().toLowerCase();
      return models.filter((m) => (m.id + ' ' + m.displayName + ' ' + m.blurb).toLowerCase().includes(q));
    }
    return activeGroup?.models ?? [];
  }, [models, searching, search, activeGroup]);

  // Switching category (or filtering) selects a model in view — preferring
  // the Nano Banana 2 default whenever it's among them
  useEffect(() => {
    if (shownModels.length && !shownModels.some((m) => m.id === modelId)) {
      setModelId((shownModels.find((m) => m.id === 'gemini-3.1-flash') ?? shownModels[0]!).id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroup?.name, searching, shownModels.length]);

  // Utilities transform the reference image: upscalers REQUIRE a reference
  // (running one without an image would spend points on nothing), while for
  // other models a reference makes the prompt optional
  const canGenerate = UPSCALERS.has(modelId) ? useRefImage : (!!prompt.trim() || useRefImage);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate || generating || !modelId) return;
    setGenError(null);
    setLastCost(null);
    setGenerating(true);
    onProgress({ message: 'Starting Unity generation...' });
    try {
      let refImage: { base64: string; mimeType?: string } | undefined;
      if (useRefImage && refNode) {
        onProgress({ message: 'Preparing reference image...' });
        // flattenNode may return the node's blob: URL untouched (no paint
        // layers), and the underlying image may be WebP/AVIF — which Unity's
        // TextureImporter can't read. Re-encode through a canvas so the
        // reference always reaches Unity as PNG.
        const srcUrl = await flattenNode(refNode);
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error('Could not load the reference image'));
          el.src = srcUrl;
        });
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext('2d')!.drawImage(img, 0, 0);
        const pngUrl = c.toDataURL('image/png');
        refImage = { base64: pngUrl.slice(pngUrl.indexOf(',') + 1), mimeType: 'image/png' };
      }
      const resp = await fetch('/__unity-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath: effectiveProject,
          prompt: prompt.trim(),
          kind: 'image',
          model: modelId,
          width: supportsCustomRes ? width : 0,
          height: supportsCustomRes ? height : 0,
          refImage,
        }),
      });
      if (!resp.ok || !resp.body) {
        let msg = `Request failed: ${resp.status}`;
        try { msg = (await resp.json()).error || msg; } catch { /* keep */ }
        throw new Error(msg);
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let hadError = false;
      let gotImage = false;
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
          let parsed: { message?: string; elapsed?: number; cost?: string; serverMessage?: string; dataUrl?: string; error?: string };
          try { parsed = JSON.parse(data); } catch { continue; }
          if (event === 'progress') {
            if (parsed.cost && parsed.cost !== '0') setLastCost(parsed.cost);
            const t = parsed.elapsed ? ` (${parsed.elapsed}s${parsed.cost && parsed.cost !== '0' ? `, ${parsed.cost} pts` : ''})` : '';
            onProgress({ message: `${parsed.message ?? 'Working'}${t}` });
          } else if (event === 'image' && parsed.dataUrl) {
            gotImage = true;
            const img = await new Promise<HTMLImageElement>((resolve) => {
              const el = new Image();
              el.onload = () => resolve(el);
              el.src = parsed.dataUrl!;
            });
            onGenerated(parsed.dataUrl, img.naturalWidth, img.naturalHeight, [{ title: 'Prompt', text: prompt.trim() }], 0);
          } else if (event === 'error') {
            hadError = true;
            setGenError(friendlyAiError(parsed.error ?? 'Unknown error'));
          } else if (event === 'done') {
            break readLoop;
          }
        }
      }
      if (gotImage && !hadError) {
        import('./completionSound').then((m) => m.playCompletionSound());
      }
    } catch (e) {
      setGenError(friendlyAiError(e instanceof Error ? e.message : 'Unknown error'));
    }
    onProgress(null);
    setGenerating(false);
  }, [prompt, canGenerate, generating, modelId, effectiveProject, width, height, supportsCustomRes, useRefImage, refNode, onGenerated, onProgress]);

  const statusText = status.checking ? 'Checking Unity...'
    : status.up ? `Unity connected — ${status.project?.split('/').pop() ?? 'project'} (${status.version ?? '?'}, port ${status.port ?? '?'})`
    : status.error ?? 'Unity not running';

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
        <h2>Unity AI</h2>
        <button className="prefs-close" onClick={onClose} disabled={generating}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="ai-modal-body">
        <div className={`ai-modal-status${status.checking ? '' : status.up ? ' ai-modal-status-ok' : ' ai-modal-status-bad'}`}>
          <span>
            {statusText}
            {status.up === true && status.points && (
              <><br />{status.points.available.toLocaleString()} Unity AI points remaining</>
            )}
          </span>
          {!status.checking && (
            <button className="ai-modal-clear-btn" onClick={checkStatus} title="Re-check connection">↻</button>
          )}
        </div>
        {!status.checking && !status.up && (
          <span className="ai-modal-size-hint">
            Open your project in Unity 6+ (with com.unity.ai.assistant and com.unity.pipeline installed), then re-check.
            The running Editor is detected automatically; set a project path in Preferences &gt; AI only if more than one is open.
          </span>
        )}

        {status.up === true && (
          <>
            {/* div, not label: a label forwards clicks on its empty space to
                its first button (Utilities), silently switching category */}
            <div className="ai-modal-label">
              Model
              {models === null && !modelsError && <span className="ai-modal-size-hint">Loading model list from Unity...</span>}
              {modelsError && <div className="ai-modal-error" role="alert">{modelsError}</div>}
              {models && (
                <>
                  <div className="ai-modal-ratio-row">
                    {grouped.map((g) => (
                      <button
                        key={g.name}
                        className={`ai-modal-ratio-btn ai-modal-cat-btn${!searching && activeGroup?.name === g.name ? ' ai-modal-ratio-btn-active' : ''}`}
                        onClick={() => { setSearch(''); setCategory(g.name); }}
                        disabled={generating}
                        title={searching ? 'Clears the search and shows this category' : g.name}
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    className="ai-modal-size-input"
                    placeholder="Search models..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ width: '100%', marginBottom: 4, marginTop: 4 }}
                  />
                  <select
                    className="ai-modal-size-input"
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                    disabled={generating}
                    style={{ width: '100%' }}
                    size={Math.min(8, Math.max(4, shownModels.length))}
                  >
                    {shownModels.map((m) => (
                      <option key={m.id} value={m.id} title={m.blurb}>
                        {m.displayName}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {selected && (
                <span className="ai-modal-size-hint">
                  {selected.blurb}
                  {selected.caps.length > 0 && ` — ${selected.caps.map((c) => c.replace(/^Supports/, '')).join(' · ')}`}
                  {UPSCALERS.has(selected.id) && ' — 2× upscale of the reference image per run'}
                </span>
              )}
            </div>

            <label className="ai-modal-label">
              Size
              {supportsCustomRes ? (
                <div className="ai-modal-ratio-row">
                  <input
                    type="text"
                    inputMode="numeric"
                    className="ai-modal-size-input"
                    value={width === 0 ? '' : width}
                    placeholder="auto"
                    onChange={(e) => setWidth(Math.min(4096, Number(e.target.value.replace(/\D/g, '')) || 0))}
                    disabled={generating}
                    style={{ width: 70 }}
                  />
                  <span>×</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="ai-modal-size-input"
                    value={height === 0 ? '' : height}
                    placeholder="auto"
                    onChange={(e) => setHeight(Math.min(4096, Number(e.target.value.replace(/\D/g, '')) || 0))}
                    disabled={generating}
                    style={{ width: 70 }}
                  />
                </div>
              ) : (
                <span className="ai-modal-size-hint">This model uses a fixed output size</span>
              )}
            </label>

            {useRefImage && refNode && (
              <label className="ai-modal-label">
                Reference (1/1)
                {refNodes.length > 1 && (
                  <span className="ai-modal-size-hint">Unity uses only the first selected image</span>
                )}
                <div className="ai-modal-ref-grid">
                  <img
                    src={refNode.paintCompositeUrl || refNode.src}
                    alt={refNode.fileName}
                    className="ai-modal-ref-thumb"
                    title={refNode.fileName}
                  />
                </div>
              </label>
            )}
            {refNodes.length > 0 && !supportsRefs && selected && (
              <span className="ai-modal-size-hint">Selected model does not support reference images</span>
            )}
            {UPSCALERS.has(modelId) && !useRefImage && (
              <span className="ai-modal-size-hint">This upscaler needs an image — select one on the canvas first</span>
            )}

            {/* div for the same reason: empty-space clicks would hit the copy button */}
            <div className="ai-modal-label">
              <span className="ai-modal-label-row">
                <span>Prompt</span>
                <span style={{ display: 'flex', gap: 4 }}>
                  {prompt && (
                    <button
                      type="button"
                      className="ai-modal-clear-btn"
                      onClick={() => { navigator.clipboard.writeText(prompt).catch((e) => console.warn('[ai] clipboard write failed:', e)); }}
                      title="Copy to clipboard"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                    </button>
                  )}
                  <button
                    type="button"
                    className="ai-modal-clear-btn"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        if (text) onPromptChange(text);
                      } catch (e) {
                        console.warn('[ai] clipboard read failed:', e);
                      }
                    }}
                    title="Paste from clipboard"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
                      <rect x="8" y="2" width="8" height="4" rx="1" />
                    </svg>
                  </button>
                  {prompt && (
                    <button type="button" className="ai-modal-clear-btn" onClick={() => onPromptChange('')} title="Clear prompt">&times;</button>
                  )}
                </span>
              </span>
              <textarea
                className="ai-modal-textarea"
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                placeholder={useRefImage ? 'Describe what to generate — optional for utilities like upscale' : 'Describe what to generate — literal and specific'}
                rows={3}
                disabled={generating}
              />
            </div>

            {lastCost && <span className="ai-modal-size-hint">Point cost: {lastCost}</span>}
          </>
        )}

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
          disabled={!canGenerate || generating || !status.up || !modelId}
        >
          {generating ? 'Generating...' : 'Generate'}
        </button>
      </div>
    </div>,
    document.body,
  );
}
