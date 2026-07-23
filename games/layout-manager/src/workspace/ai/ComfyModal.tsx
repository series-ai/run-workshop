import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { UserConfig } from '../userConfig';
import type { ImageNode } from '../types';
import { useDraggableModal } from './useDraggableModal';
import { flattenNode } from './flattenNode';
import { loadWorkflows, checkConnection, parseInputs, runWorkflow, cancelComfy, restartComfy, loadTimings, recordTiming, estimateDuration, type WorkflowMeta, type InputSpec, type WorkflowTimings } from './comfyClient';

// Session-wide counter so every ComfyUI output gets a unique trailing index.
// Lives at module scope so it persists across modal opens/closes but resets on page reload.
let comfyOutputCounter = 0;
function buildComfyFileName(seed: number): string {
  const d = new Date();
  const time = `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
  const counter = String(++comfyOutputCounter).padStart(5, '0');
  return `ComfyUI_${time}_${seed}_${counter}.png`;
}

/**
 * AI-friendly W×H presets, taken from Comfyroll's CR_AspectRatio node:
 * https://github.com/Suzie1/ComfyUI_Comfyroll_CustomNodes/blob/main/nodes/nodes_aspect_ratio.py
 */
type AspectCategory = 'sd15' | 'sdxl' | 'flux2';
const ASPECT_PRESETS: { label: string; w: number; h: number; category: AspectCategory; ratio: string }[] = [
  { label: 'SD1.5 — 1:1 square 512×512', w: 512, h: 512, category: 'sd15', ratio: '1:1' },
  { label: 'SD1.5 — 2:3 portrait 512×768', w: 512, h: 768, category: 'sd15', ratio: '2:3' },
  { label: 'SD1.5 — 3:4 portrait 512×682', w: 512, h: 682, category: 'sd15', ratio: '3:4' },
  { label: 'SD1.5 — 3:2 landscape 768×512', w: 768, h: 512, category: 'sd15', ratio: '2:3' },
  { label: 'SD1.5 — 4:3 landscape 682×512', w: 682, h: 512, category: 'sd15', ratio: '3:4' },
  { label: 'SD1.5 — 16:9 cinema 910×512', w: 910, h: 512, category: 'sd15', ratio: '9:16' },
  { label: 'SD1.5 — 1.85:1 cinema 952×512', w: 952, h: 512, category: 'sd15', ratio: '1.85:1' },
  { label: 'SD1.5 — 2:1 cinema 1024×512', w: 1024, h: 512, category: 'sd15', ratio: '2:1' },
  { label: 'SDXL — 1:1 square 1024×1024', w: 1024, h: 1024, category: 'sdxl', ratio: '1:1' },
  { label: 'SDXL — 3:4 portrait 896×1152', w: 896, h: 1152, category: 'sdxl', ratio: '3:4' },
  { label: 'SDXL — 5:8 portrait 832×1216', w: 832, h: 1216, category: 'sdxl', ratio: '5:8' },
  { label: 'SDXL — 9:16 portrait 768×1344', w: 768, h: 1344, category: 'sdxl', ratio: '9:16' },
  { label: 'SDXL — 9:21 portrait 640×1536', w: 640, h: 1536, category: 'sdxl', ratio: '9:21' },
  { label: 'SDXL — 4:3 landscape 1152×896', w: 1152, h: 896, category: 'sdxl', ratio: '3:4' },
  { label: 'SDXL — 3:2 landscape 1216×832', w: 1216, h: 832, category: 'sdxl', ratio: '2:3' },
  { label: 'SDXL — 16:9 landscape 1344×768', w: 1344, h: 768, category: 'sdxl', ratio: '9:16' },
  { label: 'SDXL — 21:9 landscape 1536×640', w: 1536, h: 640, category: 'sdxl', ratio: '9:21' },
  { label: 'Flux 2 — 1:1 square 2048×2048', w: 2048, h: 2048, category: 'flux2', ratio: '1:1' },
  { label: 'Flux 2 — 3:4 portrait 1536×2048', w: 1536, h: 2048, category: 'flux2', ratio: '3:4' },
  { label: 'Flux 2 — 2:3 portrait 1344×2048', w: 1344, h: 2048, category: 'flux2', ratio: '2:3' },
  { label: 'Flux 2 — 9:16 portrait 1152×2048', w: 1152, h: 2048, category: 'flux2', ratio: '9:16' },
  { label: 'Flux 2 — 9:21 portrait 896×2048', w: 896, h: 2048, category: 'flux2', ratio: '9:21' },
  { label: 'Flux 2 — 4:3 landscape 2048×1536', w: 2048, h: 1536, category: 'flux2', ratio: '3:4' },
  { label: 'Flux 2 — 3:2 landscape 2048×1344', w: 2048, h: 1344, category: 'flux2', ratio: '2:3' },
  { label: 'Flux 2 — 16:9 landscape 2048×1152', w: 2048, h: 1152, category: 'flux2', ratio: '9:16' },
  { label: 'Flux 2 — 21:9 landscape 2048×896', w: 2048, h: 896, category: 'flux2', ratio: '9:21' },
  { label: 'Flux 2 — 16:9 desktop wallpaper 2560×1440', w: 2560, h: 1440, category: 'flux2', ratio: '9:16' },
];

interface ComfyModalProps {
  config: UserConfig;
  sourceNodes: ImageNode[];
  selectedWorkflowFilename: string;
  onSelectedWorkflowChange: (filename: string) => void;
  inputValues: Record<string, string | number>;
  onInputValuesChange: (values: Record<string, string | number>) => void;
  position?: { top: number; left: number };
  onGenerated: (dataUrl: string, w: number, h: number, prompts: { title: string; text: string }[], fileName: string, batchIndex: number) => void;
  onProgress: (progress: { message: string; progress?: number } | null) => void;
  onClose: () => void;
}

export function ComfyModal({ config, sourceNodes, selectedWorkflowFilename, onSelectedWorkflowChange, inputValues, onInputValuesChange, position, onGenerated, onProgress, onClose }: ComfyModalProps) {
  const { panelRef, onPointerDown, onPointerMove, onPointerUp } = useDraggableModal();
  const [workflows, setWorkflows] = useState<WorkflowMeta[]>([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(true);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [restartStatus, setRestartStatus] = useState<'ok' | 'fail' | null>(null);
  const [count, setCount] = useState(1);
  const [randomizeSeed, setRandomizeSeed] = useState<Record<string, boolean>>({});
  const [aspectPreset, setAspectPreset] = useState<string>('custom');
  const [timings, setTimings] = useState<WorkflowTimings | null>(null);
  const isWarmRef = useRef(false);

  const sourceNode = sourceNodes[0];
  const generatedCount = useRef(0);
  const batchCancelled = useRef(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Flatten the source image (paint layers baked in) for preview
  useEffect(() => {
    if (!sourceNode) { setPreviewUrl(null); return; }
    let cancelled = false;
    flattenNode(sourceNode).then((url) => { if (!cancelled) setPreviewUrl(url); });
    return () => { cancelled = true; };
  }, [sourceNode]);

  const refreshConnection = useCallback(async () => {
    setCheckingConnection(true);
    const ok = await checkConnection(config.comfyUrl);
    setConnected(ok);
    setCheckingConnection(false);
  }, [config.comfyUrl]);

  // Load workflows + check connection on mount
  useEffect(() => {
    let cancelled = false;
    loadWorkflows()
      .then((list) => { if (!cancelled) setWorkflows(list); })
      .catch((e) => { console.warn('[comfy] loadWorkflows failed:', e); if (!cancelled) setWorkflows([]); })
      .finally(() => { if (!cancelled) setLoadingWorkflows(false); });
    refreshConnection();
    return () => { cancelled = true; };
  }, [refreshConnection]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Find the selected workflow
  const selectedWorkflow = workflows.find((w) => w.filename === selectedWorkflowFilename) ?? workflows[0];
  const inputSpecs: InputSpec[] = (() => {
    if (!selectedWorkflow) return [];
    const specs = parseInputs(selectedWorkflow.workflow);
    // Move the negative-prompt input to render directly after the positive-prompt input.
    const negIdx = specs.findIndex((s) => /negative/i.test(s.title) && /prompt/i.test(s.title));
    const posIdx = specs.findIndex((s) => /prompt/i.test(s.title) && !/negative/i.test(s.title));
    if (negIdx === -1 || posIdx === -1 || posIdx < negIdx) return specs;
    const result = [...specs];
    const [neg] = result.splice(negIdx, 1);
    if (!neg) return specs;
    result.splice(posIdx, 0, neg);
    return result;
  })();

  // Load timing samples whenever the selected workflow changes
  useEffect(() => {
    if (!selectedWorkflow) { setTimings(null); return; }
    let cancelled = false;
    loadTimings(selectedWorkflow.name).then((t) => { if (!cancelled) setTimings(t); });
    return () => { cancelled = true; };
  }, [selectedWorkflow?.name]);

  // Compute the dims key for the current generate config — used to look up + record timings.
  // Prefer explicit $Width/$Height values; fall back to source image dims for img2img workflows.
  const computeDimsKey = useCallback((): string => {
    let w = 0, h = 0;
    for (const s of inputSpecs) {
      if (s.kind !== 'number') continue;
      if (!/^width$/i.test(s.title) && !/^height$/i.test(s.title)) continue;
      const v = Number(inputValues[s.nodeId] ?? s.defaultValue);
      if (/^width$/i.test(s.title)) w = v;
      else h = v;
    }
    if (w && h) return `${w}x${h}`;
    if (sourceNode) return `src-${sourceNode.naturalWidth}x${sourceNode.naturalHeight}`;
    return 'default';
  }, [inputSpecs, inputValues, sourceNode]);

  const currentDimsKey = computeDimsKey();
  const estimate = estimateDuration(timings, currentDimsKey);

  const updateInput = useCallback((nodeId: string, value: string | number) => {
    onInputValuesChange({ ...inputValues, [nodeId]: value });
  }, [inputValues, onInputValuesChange]);

  const handleGenerate = useCallback(async () => {
    if (!selectedWorkflow || generating || !connected) return;
    // Validate: image inputs need a canvas selection
    const imageInputs = inputSpecs.filter((s) => s.kind === 'image');
    if (imageInputs.length > 0 && !sourceNode) {
      alert('This workflow needs an image input — select an image on the canvas first.');
      return;
    }

    // Sanity-check large dimensions before VRAM gets nuked
    let widthVal = 0, heightVal = 0;
    for (const s of inputSpecs) {
      if (s.kind !== 'number') continue;
      if (!/^(width|height)$/i.test(s.title)) continue;
      const v = Number(inputValues[s.nodeId] ?? s.defaultValue);
      if (/^width$/i.test(s.title)) widthVal = v;
      else heightVal = v;
    }
    if (widthVal > 2048 || heightVal > 2048 || (widthVal * heightVal) > 4_194_304) {
      const dims = widthVal && heightVal ? `${widthVal}×${heightVal}` : `${widthVal || heightVal}px`;
      const ok = window.confirm(
        `That's a large image (${dims}). Diffusion models can OOM your GPU at this size. Continue?`,
      );
      if (!ok) return;
    }

    const runsPerSource = Math.max(1, Math.min(config.aiMaxCount, count));
    // Multiple selected images on an image-input workflow: run each source
    // back to back (× the count field)
    const hasImageInput = inputSpecs.some((s) => s.kind === 'image');
    const sources = hasImageInput ? sourceNodes.filter((n) => n.nodeType !== 'text') : [];
    const sourceRuns = Math.max(1, sources.length);
    const runs = runsPerSource * sourceRuns;
    setGenerating(true);
    generatedCount.current = 0;
    batchCancelled.current = false;
    onProgress({ message: runs > 1 ? `Starting batch 1/${runs}...` : 'Starting workflow...' });

    try {
      // Flatten each source image once — cached across its batch runs
      const flatCache = new Map<string, string>();
      const flattenSource = async (node: ImageNode): Promise<string> => {
        const cached = flatCache.get(node.id);
        if (cached) return cached;
        const url = await flattenNode(node);
        flatCache.set(node.id, url);
        return url;
      };

      let cancelled = false;
      const dimsKey = computeDimsKey();
      let latestTimings: WorkflowTimings | null = timings;
      for (let i = 0; i < runs; i++) {
        if (batchCancelled.current) { cancelled = true; break; }

        const runSource = sources.length > 0 ? sources[Math.floor(i / runsPerSource)]! : null;
        const flatBlobUrl = runSource ? await flattenSource(runSource) : null;

        // Build values per iteration so seed gets re-randomized each run
        const values: Record<string, string | number | { blobUrl: string }> = {};
        for (const spec of inputSpecs) {
          if (spec.kind === 'image') {
            if (flatBlobUrl) values[spec.nodeId] = { blobUrl: flatBlobUrl };
          } else if (spec.kind === 'number' && /^seed$/i.test(spec.title) && (randomizeSeed[spec.nodeId] ?? true)) {
            values[spec.nodeId] = Math.floor(Math.random() * 0xFFFFFFFF);
          } else if (spec.kind === 'number') {
            // Normalize: raw in-progress strings ("", "-") fall back to default
            const n = Number(inputValues[spec.nodeId]);
            values[spec.nodeId] = Number.isFinite(n) && inputValues[spec.nodeId] !== '' ? n : spec.defaultValue;
          } else {
            const v = inputValues[spec.nodeId];
            values[spec.nodeId] = v ?? spec.defaultValue;
          }
        }

        // Snapshot prompt-labelled text inputs to attach to the generated image
        const capturedPrompts: { title: string; text: string }[] = [];
        for (const spec of inputSpecs) {
          if (spec.kind !== 'text' || !/prompt/i.test(spec.title)) continue;
          const text = String(inputValues[spec.nodeId] ?? spec.defaultValue).trim();
          if (text) capturedPrompts.push({ title: spec.title, text });
        }

        // Capture (or invent) a seed value for the output filename.
        // If the workflow exposes $Seed we use whatever we injected; otherwise we synthesize one
        // purely for the filename — the actual run uses whatever the workflow has hardcoded.
        const seedSpec = inputSpecs.find((s) => s.kind === 'number' && /^seed$/i.test(s.title));
        const seedForFilename = seedSpec
          ? Number(values[seedSpec.nodeId])
          : Math.floor(Math.random() * 0xFFFFFFFF);

        const batchPrefix = runs > 1 ? `[${i + 1}/${runs}] ` : '';
        const wasWarmAtStart = isWarmRef.current;
        const startTime = Date.now();
        let succeeded = false;
        await runWorkflow(config.comfyUrl, selectedWorkflow.workflow, values, {
          onProgress: (msg) => onProgress({ message: `${batchPrefix}${msg}` }),
          onImage: async (dataUrl) => {
            generatedCount.current++;
            onProgress({ message: `${batchPrefix}Loading image ${generatedCount.current}...` });
            const img = await new Promise<HTMLImageElement>((resolve) => {
              const el = new Image();
              el.onload = () => resolve(el);
              el.src = dataUrl;
            });
            onGenerated(dataUrl, img.naturalWidth, img.naturalHeight, capturedPrompts, buildComfyFileName(seedForFilename), generatedCount.current - 1);
            succeeded = true;
          },
          onError: (error) => alert(`ComfyUI error: ${error}`),
          onCancelled: () => { cancelled = true; batchCancelled.current = true; },
          onDone: () => { /* per-run done; batch finalization happens after the loop */ },
        });
        if (succeeded) {
          const duration = (Date.now() - startTime) / 1000;
          // Only record warm runs — first run after model load includes load time and would skew the average
          if (wasWarmAtStart && selectedWorkflow) {
            const updated = await recordTiming(selectedWorkflow.name, dimsKey, duration);
            if (updated) latestTimings = updated;
          }
          isWarmRef.current = true;
        }
        if (cancelled || batchCancelled.current) break;
      }
      if (latestTimings !== timings) setTimings(latestTimings);

      onProgress(null);
      setGenerating(false);
      if (!cancelled) {
        import('./completionSound').then((m) => m.playCompletionSound());
      }
    } catch (e) {
      onProgress(null);
      alert(`ComfyUI error: ${e instanceof Error ? e.message : 'Unknown error'}`);
      setGenerating(false);
    }
  }, [selectedWorkflow, generating, connected, inputSpecs, sourceNode, sourceNodes, config.comfyUrl, config.aiMaxCount, count, inputValues, randomizeSeed, onGenerated, onProgress, computeDimsKey, timings]);

  const handleStop = useCallback(() => {
    batchCancelled.current = true;
    cancelComfy();
  }, []);

  const handleRestart = useCallback(async () => {
    if (restarting || generating || !connected) return;
    setRestarting(true);
    setRestartStatus(null);
    const ok = await restartComfy(config.comfyUrl);
    if (ok) isWarmRef.current = false;
    setRestartStatus(ok ? 'ok' : 'fail');
    setRestarting(false);
    setTimeout(() => setRestartStatus(null), 2500);
  }, [config.comfyUrl, restarting, generating, connected]);

  return createPortal(
    <div
      className={`prefs-dialog ai-modal ai-modal-container${position ? ' ai-modal-aligned' : ''}`}
      ref={panelRef}
      style={position ? { maxWidth: 480, top: position.top, left: position.left } : { maxWidth: 480 }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          handleGenerate();
        }
      }}
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
        <h2>ComfyUI</h2>
        <button className="prefs-close" onClick={onClose} disabled={generating}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="ai-modal-body">
        {/* Connection bar */}
        <div className="comfy-connection-bar">
          <span className={`comfy-status-dot ${connected ? 'comfy-status-ok' : 'comfy-status-bad'}`} />
          <span className="comfy-status-text">
            {restartStatus === 'ok' ? 'ComfyUI restarted' : restartStatus === 'fail' ? 'Restart failed' : restarting ? 'Restarting ComfyUI...' : checkingConnection ? 'Checking...' : connected ? `Connected to ${config.comfyUrl}` : 'Not connected — start ComfyUI and refresh'}
          </span>
          <button
            className="comfy-unload-btn"
            onClick={handleRestart}
            title="Restart ComfyUI to fully free VRAM and RAM (takes ~10–20s)"
            disabled={!connected || restarting || generating}
          >
            {restarting ? 'Restarting...' : 'Restart ComfyUI'}
          </button>
          <button
            className="ai-modal-clear-btn"
            onClick={refreshConnection}
            title="Refresh connection"
            disabled={checkingConnection}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
          </button>
        </div>

        {/* Workflow picker */}
        <label className="ai-modal-label">
          Workflow
          {loadingWorkflows ? (
            <span className="ai-modal-size-hint">Loading workflows...</span>
          ) : workflows.length === 0 ? (
            <span className="ai-modal-size-hint">No workflows in <code>comfy-workflows/</code></span>
          ) : (
            <select
              className="prefs-select"
              value={selectedWorkflow?.filename ?? ''}
              onChange={(e) => onSelectedWorkflowChange(e.target.value)}
              style={{ width: '100%' }}
              disabled={!connected || generating}
            >
              {workflows.map((w) => (
                <option key={w.filename} value={w.filename}>{w.name}</option>
              ))}
            </select>
          )}
        </label>

        {/* Dynamic inputs */}
        {selectedWorkflow && connected && (() => {
          const renderNumber = (spec: Extract<InputSpec, { kind: 'number' }>, fullWidth: boolean) => {
            // Keep the raw string while typing — coercing to Number eats the
            // leading "-" of negative values ("" -> 0) before it can be typed
            const stored = inputValues[spec.nodeId];
            const value = stored !== undefined ? stored : spec.defaultValue;
            const isSeed = /^seed$/i.test(spec.title);
            const isDimension = /^(width|height)$/i.test(spec.title);
            const randomOn = randomizeSeed[spec.nodeId] ?? true;
            const cap = config.comfyMaxDimension || 8192;
            const numberInput = (
              <input
                type="number"
                className="ai-modal-size-input"
                max={isDimension ? cap : undefined}
                value={isSeed && randomOn ? '' : value}
                placeholder={isSeed && randomOn ? 'random' : undefined}
                onChange={(e) => {
                  const raw = e.target.value;
                  // Allow in-progress negative/empty entry ("-", "") — the
                  // submit path falls back to the default for non-numbers
                  if (raw === '' || raw === '-') {
                    updateInput(spec.nodeId, raw);
                    return;
                  }
                  let n = Number(raw);
                  if (Number.isNaN(n)) return;
                  if (isDimension && n > cap) {
                    n = cap;
                    // Force the DOM to show the clamped value — if state was already at cap,
                    // React skips the re-render and the typed digits stay in the DOM.
                    e.currentTarget.value = String(n);
                  }
                  updateInput(spec.nodeId, n);
                  if (isDimension && aspectPreset !== 'custom') setAspectPreset('custom');
                }}
                style={fullWidth ? { width: '100%' } : { width: 120, flex: isSeed ? 1 : undefined }}
                disabled={generating || (isSeed && randomOn)}
              />
            );
            return (
              <label key={spec.nodeId} className="ai-modal-label" style={fullWidth ? { flex: 1 } : undefined}>
                {spec.title}
                {isSeed ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {numberInput}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 'normal', fontSize: 11, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      <input
                        type="checkbox"
                        checked={randomOn}
                        onChange={(e) => setRandomizeSeed({ ...randomizeSeed, [spec.nodeId]: e.target.checked })}
                        disabled={generating}
                      />
                      Randomize?
                    </label>
                  </div>
                ) : numberInput}
              </label>
            );
          };

          // Build a render plan: pair $Width and $Height side-by-side; everything else standalone.
          type RenderItem = { type: 'single'; spec: InputSpec } | { type: 'pair'; left: InputSpec; right: InputSpec };
          const used = new Set<string>();
          const items: RenderItem[] = [];
          for (const spec of inputSpecs) {
            if (used.has(spec.nodeId)) continue;
            if (spec.kind === 'number' && /^(width|height)$/i.test(spec.title)) {
              const partnerTitle = /^width$/i.test(spec.title) ? 'height' : 'width';
              const partner = inputSpecs.find((s) => s.kind === 'number' && new RegExp(`^${partnerTitle}$`, 'i').test(s.title) && !used.has(s.nodeId));
              if (partner && partner.nodeId !== spec.nodeId) {
                const widthSpec = /^width$/i.test(spec.title) ? spec : partner;
                const heightSpec = widthSpec === spec ? partner : spec;
                items.push({ type: 'pair', left: widthSpec, right: heightSpec });
                used.add(spec.nodeId);
                used.add(partner.nodeId);
                continue;
              }
            }
            items.push({ type: 'single', spec });
            used.add(spec.nodeId);
          }

          // Filter presets by max-dimension cap, category toggles, and aspect-ratio toggles
          const cap = config.comfyMaxDimension || 8192;
          const catFilter = config.comfyAspectCategories ?? { sd15: true, sdxl: true, flux2: true };
          const ratioFilter = config.comfyAspectRatios ?? {};
          const fittingPresets = ASPECT_PRESETS.filter((p) =>
            p.w <= cap &&
            p.h <= cap &&
            (catFilter[p.category] ?? true) &&
            (ratioFilter[p.ratio] ?? true),
          );

          return items.map((item, idx) => {
            if (item.type === 'pair' && item.left.kind === 'number' && item.right.kind === 'number') {
              const widthNodeId = item.left.nodeId;
              const heightNodeId = item.right.nodeId;
              return (
                <div key={`pair-${idx}`} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label className="ai-modal-label">
                    Aspect Ratio
                    <select
                      className="prefs-select"
                      value={aspectPreset}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAspectPreset(v);
                        if (v === 'custom') return;
                        const preset = ASPECT_PRESETS.find((p) => p.label === v);
                        if (!preset) return;
                        onInputValuesChange({
                          ...inputValues,
                          [widthNodeId]: preset.w,
                          [heightNodeId]: preset.h,
                        });
                      }}
                      style={{ width: '100%' }}
                      disabled={generating}
                    >
                      <option value="custom">Custom (manual W×H)</option>
                      {fittingPresets.map((p) => (
                        <option key={p.label} value={p.label}>{p.label}</option>
                      ))}
                    </select>
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {renderNumber(item.left, true)}
                    {renderNumber(item.right, true)}
                  </div>
                </div>
              );
            }
            const spec = item.type === 'single' ? item.spec : item.left;
            if (spec.kind === 'text') {
              const value = inputValues[spec.nodeId] !== undefined ? String(inputValues[spec.nodeId]) : spec.defaultValue;
              const pasteHere = async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  if (text) updateInput(spec.nodeId, text);
                } catch (e) {
                  console.warn('[comfy] clipboard read failed:', e);
                }
              };
              const copyHere = () => {
                navigator.clipboard.writeText(value).catch((e) => console.warn('[comfy] clipboard write failed:', e));
              };
              const isNegativePrompt = /negative/i.test(spec.title) && /prompt/i.test(spec.title);
              const isPositivePrompt = !isNegativePrompt && /prompt/i.test(spec.title);
              const titleColor = isNegativePrompt
                ? 'var(--color-error)'
                : isPositivePrompt
                  ? 'var(--color-success)'
                  : undefined;
              return (
                <label key={spec.nodeId} className="ai-modal-label">
                  <span className="ai-modal-label-row">
                    <span style={titleColor ? { color: titleColor } : undefined}>{spec.title}</span>
                    <span style={{ display: 'flex', gap: 4 }}>
                      {value && (
                        <button type="button" className="ai-modal-clear-btn" onClick={copyHere} title="Copy to clipboard">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                        </button>
                      )}
                      <button type="button" className="ai-modal-clear-btn" onClick={pasteHere} title="Paste from clipboard">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
                          <rect x="8" y="2" width="8" height="4" rx="1" />
                        </svg>
                      </button>
                      {value && (
                        <button type="button" className="ai-modal-clear-btn" onClick={() => updateInput(spec.nodeId, '')} title="Clear">&times;</button>
                      )}
                    </span>
                  </span>
                  {spec.multiline ? (
                    <textarea
                      className="ai-modal-textarea"
                      value={value}
                      onChange={(e) => updateInput(spec.nodeId, e.target.value)}
                      rows={4}
                      style={titleColor ? { borderColor: titleColor } : undefined}
                    />
                  ) : (
                    <input
                      type="text"
                      className="ai-modal-size-input"
                      value={value}
                      onChange={(e) => updateInput(spec.nodeId, e.target.value)}
                      style={titleColor ? { width: '100%', borderColor: titleColor } : { width: '100%' }}
                    />
                  )}
                </label>
              );
            }
            if (spec.kind === 'number') {
              return renderNumber(spec, false);
            }
            if (spec.kind === 'image') {
              return (
                <div key={spec.nodeId} className="ai-modal-label">
                  <span>{spec.title}</span>
                  <div className="ai-modal-source-preview">
                    {sourceNode ? (
                      <>
                        {previewUrl && (
                          <img src={previewUrl} alt={sourceNode.fileName} className="ai-modal-source-thumb" />
                        )}
                        <span className="ai-modal-source-name">
                          {sourceNodes.length > 1
                            ? <>{sourceNodes.length} images selected — runs once per image</>
                            : <>{sourceNode.fileName} ({sourceNode.naturalWidth}×{sourceNode.naturalHeight})</>}
                          {sourceNodes.length === 1 && (sourceNode.paintOverlayUrl || sourceNode.paintCompositeUrl) && ' + paint'}
                        </span>
                      </>
                    ) : (
                      <span className="ai-modal-source-name" style={{ color: 'var(--color-warning, #e67e22)' }}>
                        Select an image on the canvas
                      </span>
                    )}
                  </div>
                </div>
              );
            }
            return null;
          });
        })()}

        {selectedWorkflow && connected && (
          <label className="ai-modal-label">
            Count
            <input
              type="text"
              inputMode="numeric"
              className="ai-modal-size-input"
              value={count === 0 ? '' : count}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '');
                setCount(v === '' ? 0 : Math.min(config.aiMaxCount, Number(v)));
              }}
              onBlur={() => { if (count < 1) setCount(1); }}
              style={{ width: 60 }}
              disabled={generating}
            />
          </label>
        )}

        {selectedWorkflow && connected && estimate && (() => {
          const fmt = (sec: number) => sec < 60 ? `${sec.toFixed(1)}s` : `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`;
          const totalSec = estimate.avg * count;
          return (
            <p className="comfy-estimate">
              Estimated: <span className="comfy-estimate-strong">~{fmt(estimate.avg)}</span> per run
              {count > 1 && <> (×{count} ≈ <span className="comfy-estimate-strong">{fmt(totalSec)}</span>)</>}
              <span className="comfy-estimate-meta">
                Based on {estimate.samples} warm run{estimate.samples === 1 ? '' : 's'} at {currentDimsKey}
              </span>
            </p>
          );
        })()}
        {selectedWorkflow && connected && !estimate && (
          <p className="comfy-estimate">
            <span className="comfy-estimate-strong">No timing data yet</span>
            <span className="comfy-estimate-meta">
              First run after a model load is the cold start and isn&apos;t recorded — subsequent runs build the estimate
            </span>
          </p>
        )}
      </div>

      <div className="prefs-footer">
        <button className="prefs-btn prefs-btn-secondary" onClick={onClose} disabled={generating}>
          Cancel
        </button>
        {generating ? (
          <button className="prefs-btn prefs-btn-secondary" onClick={handleStop}>
            Stop
          </button>
        ) : (
          <button
            className="prefs-btn prefs-btn-primary"
            onClick={handleGenerate}
            disabled={!connected || !selectedWorkflow}
          >
            Generate
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
