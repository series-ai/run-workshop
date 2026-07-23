/**
 * ComfyUI integration client.
 *
 * Talks to a local ComfyUI server (default http://127.0.0.1:8188) via the
 * Vite plugin proxy at /__comfy/<path>?target=<url>. WebSocket goes direct
 * since browsers don't enforce CORS on WS.
 */

export interface WorkflowMeta {
  name: string;        // "Flux2Klein_txt2img"
  filename: string;    // "Flux2Klein_txt2img.json"
  workflow: ComfyWorkflow;
}

export type ComfyWorkflow = Record<string, ComfyNode>;

export interface ComfyNode {
  inputs: Record<string, unknown>;
  class_type: string;
  _meta?: { title?: string };
}

export type InputSpec =
  | { kind: 'text'; nodeId: string; field: string; title: string; defaultValue: string; multiline: boolean }
  | { kind: 'number'; nodeId: string; field: string; title: string; defaultValue: number }
  | { kind: 'image'; nodeId: string; field: string; title: string };

export interface ComfyCallbacks {
  onProgress?: (msg: string, value?: number, max?: number) => void;
  onImage: (dataUrl: string) => Promise<void>;
  onError?: (error: string) => void;
  onCancelled?: () => void;
  onDone?: () => void;
}

let activeAbort: AbortController | null = null;
let activeWs: WebSocket | null = null;
let activePromptId: string | null = null;
let activeComfyUrl: string | null = null;
let cancelRequested = false;

/** Fetch the list of workflows from comfy-workflows/. */
export async function loadWorkflows(): Promise<WorkflowMeta[]> {
  const resp = await fetch('/__comfy-workflows');
  if (!resp.ok) throw new Error(`Failed to load workflows: ${resp.status}`);
  return resp.json();
}

/** Quick reachability check — hit /system_stats and see if it answers. */
export async function checkConnection(comfyUrl: string): Promise<boolean> {
  try {
    const resp = await fetch(`/__comfy/system_stats?target=${encodeURIComponent(comfyUrl)}`);
    return resp.ok;
  } catch {
    return false;
  }
}

/** Walk the workflow JSON, return UI specs for every $-prefixed node (except any $Output*). */
export function parseInputs(workflow: ComfyWorkflow): InputSpec[] {
  const specs: InputSpec[] = [];
  for (const [nodeId, node] of Object.entries(workflow)) {
    const title = node._meta?.title;
    if (!title || !title.startsWith('$') || title.startsWith('$Output')) continue;

    const cls = node.class_type;
    const cleanTitle = title.slice(1); // strip the $

    if (cls === 'PrimitiveStringMultiline') {
      specs.push({ kind: 'text', nodeId, field: 'value', title: cleanTitle, defaultValue: String(node.inputs['value'] ?? ''), multiline: true });
    } else if (cls === 'PrimitiveString') {
      specs.push({ kind: 'text', nodeId, field: 'value', title: cleanTitle, defaultValue: String(node.inputs['value'] ?? ''), multiline: false });
    } else if (cls === 'PrimitiveInt' || cls === 'PrimitiveFloat') {
      specs.push({ kind: 'number', nodeId, field: 'value', title: cleanTitle, defaultValue: Number(node.inputs['value'] ?? 0) });
    } else if (cls === 'LoadImage') {
      specs.push({ kind: 'image', nodeId, field: 'image', title: cleanTitle });
    } else if (cls === 'CLIPTextEncode') {
      specs.push({ kind: 'text', nodeId, field: 'text', title: cleanTitle, defaultValue: String(node.inputs['text'] ?? ''), multiline: true });
    } else if (cls === 'CR Prompt Text') {
      specs.push({ kind: 'text', nodeId, field: 'prompt', title: cleanTitle, defaultValue: String(node.inputs['prompt'] ?? ''), multiline: true });
    } else if (cls === 'LoraLoader' || cls === 'LoraLoaderModelOnly') {
      // LoRA strength — expose strength_model as a float. The first scalar on a LoraLoader is
      // lora_name (a string), which the fallback would mistakenly expose as text.
      specs.push({ kind: 'number', nodeId, field: 'strength_model', title: cleanTitle, defaultValue: Number(node.inputs['strength_model'] ?? 1) });
    } else {
      // Fallback: scan inputs for the first scalar (non-array) value, expose as text
      for (const [key, val] of Object.entries(node.inputs)) {
        if (Array.isArray(val)) continue; // skip node references
        if (typeof val === 'string') {
          specs.push({ kind: 'text', nodeId, field: key, title: cleanTitle, defaultValue: val, multiline: val.includes('\n') });
          break;
        }
        if (typeof val === 'number') {
          specs.push({ kind: 'number', nodeId, field: key, title: cleanTitle, defaultValue: val });
          break;
        }
      }
    }
  }
  return specs;
}

/** Find every $Output* node ID in a workflow (matches "$Output", "$Output1", "$OutputDepth", etc.). */
function findOutputNodeIds(workflow: ComfyWorkflow): string[] {
  const ids: string[] = [];
  for (const [id, node] of Object.entries(workflow)) {
    const title = node._meta?.title;
    if (title && title.startsWith('$Output')) ids.push(id);
  }
  return ids;
}

/** Convert a blob/object URL to a Blob. */
async function urlToBlob(url: string): Promise<Blob> {
  if (url.startsWith('data:')) {
    const resp = await fetch(url);
    return resp.blob();
  }
  const resp = await fetch(url);
  return resp.blob();
}

/** Upload an image to ComfyUI's input folder. Returns the saved filename. */
async function uploadImage(comfyUrl: string, blob: Blob, filename = 'lm-input.png'): Promise<string> {
  const form = new FormData();
  form.append('image', blob, filename);
  form.append('type', 'input');
  form.append('overwrite', 'true');
  const resp = await fetch(`/__comfy/upload/image?target=${encodeURIComponent(comfyUrl)}`, {
    method: 'POST',
    body: form,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Upload failed (${resp.status}): ${text}`);
  }
  const json = await resp.json();
  return json.name as string;
}

/** Build the WebSocket URL from the comfy HTTP URL. */
function wsUrlFromHttp(httpUrl: string, clientId: string): string {
  const u = new URL(httpUrl);
  const proto = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${u.host}/ws?clientId=${clientId}`;
}

/**
 * Run a workflow:
 *   - resolve image inputs (upload to ComfyUI)
 *   - patch text/number inputs into a clone of the workflow
 *   - submit POST /prompt
 *   - watch WebSocket for progress
 *   - on completion, fetch result via GET /history → /view → emit base64 data URL
 */
export async function runWorkflow(
  comfyUrl: string,
  workflow: ComfyWorkflow,
  inputValues: Record<string, string | number | { blobUrl: string }>, // keyed by nodeId
  callbacks: ComfyCallbacks,
): Promise<void> {
  callbacks.onProgress?.('Preparing workflow...');
  cancelRequested = false;

  // Deep clone the workflow
  const wf: ComfyWorkflow = JSON.parse(JSON.stringify(workflow));
  const outputNodeIds = findOutputNodeIds(wf);
  if (outputNodeIds.length === 0) {
    callbacks.onError?.('Workflow has no $Output node (title a PreviewImage "$Output", or "$Output1", "$OutputDepth", etc. for multiple)');
    callbacks.onDone?.();
    return;
  }

  // Patch inputs onto cloned workflow
  for (const [nodeId, value] of Object.entries(inputValues)) {
    const node = wf[nodeId];
    if (!node) continue;

    if (typeof value === 'object' && value !== null && 'blobUrl' in value) {
      // Image input: upload first, then write filename
      callbacks.onProgress?.('Uploading image...');
      try {
        const blob = await urlToBlob((value as { blobUrl: string }).blobUrl);
        const uploadedName = await uploadImage(comfyUrl, blob);
        node.inputs['image'] = uploadedName;
      } catch (e) {
        callbacks.onError?.(e instanceof Error ? e.message : 'Image upload failed');
        callbacks.onDone?.();
        return;
      }
    } else if (typeof value === 'string' || typeof value === 'number') {
      // Find the field name for this node — use class_type defaults
      const cls = node.class_type;
      let field = 'value';
      if (cls === 'CLIPTextEncode') field = 'text';
      else if (cls === 'CR Prompt Text') field = 'prompt';
      else if (cls === 'LoraLoader' || cls === 'LoraLoaderModelOnly') field = 'strength_model';
      // For unknown types, find the first non-array input that already exists
      else if (cls !== 'PrimitiveString' && cls !== 'PrimitiveStringMultiline' && cls !== 'PrimitiveInt' && cls !== 'PrimitiveFloat') {
        for (const k of Object.keys(node.inputs)) {
          if (!Array.isArray(node.inputs[k])) { field = k; break; }
        }
      }
      node.inputs[field] = value;
    }
  }

  const clientId = crypto.randomUUID();
  activeComfyUrl = comfyUrl;

  // Open WebSocket first so we don't miss early events
  callbacks.onProgress?.('Connecting to ComfyUI...');
  let ws: WebSocket;
  try {
    ws = new WebSocket(wsUrlFromHttp(comfyUrl, clientId));
  } catch (e) {
    callbacks.onError?.(`Failed to open WebSocket: ${e instanceof Error ? e.message : 'unknown'}`);
    callbacks.onDone?.();
    return;
  }
  activeWs = ws;
  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = () => reject(new Error('WebSocket failed to open — is ComfyUI running?'));
    setTimeout(() => reject(new Error('WebSocket connect timeout')), 5000);
  }).catch((e) => { callbacks.onError?.(e.message); ws.close(); throw e; });

  // Submit the prompt
  callbacks.onProgress?.('Submitting workflow...');
  activeAbort = new AbortController();
  let promptId: string;
  try {
    const resp = await fetch(`/__comfy/prompt?target=${encodeURIComponent(comfyUrl)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: wf, client_id: clientId }),
      signal: activeAbort.signal,
    });
    const json = await resp.json();
    if (!resp.ok || json.error) {
      // ComfyUI returns the most useful detail in node_errors — surface it instead of just the generic
      // "Prompt outputs failed validation" top-level message.
      const top = json.error?.message || 'Validation failed';
      const nodeErrors: string[] = [];
      if (json.node_errors && typeof json.node_errors === 'object') {
        for (const [nodeId, info] of Object.entries(json.node_errors as Record<string, { errors?: { message?: string; details?: string }[] }>)) {
          for (const err of info.errors || []) {
            const detail = [err.message, err.details].filter(Boolean).join(' — ');
            if (detail) nodeErrors.push(`Node ${nodeId}: ${detail}`);
          }
        }
      }
      const msg = nodeErrors.length ? `${top}\n${nodeErrors.join('\n')}` : top;
      throw new Error(msg);
    }
    promptId = json.prompt_id;
    activePromptId = promptId;
  } catch (e) {
    ws.close();
    if (e instanceof Error && e.name === 'AbortError') {
      callbacks.onCancelled?.();
    } else {
      callbacks.onError?.(e instanceof Error ? e.message : 'Submit failed');
    }
    activeAbort = null;
    activeWs = null;
    activePromptId = null;
    callbacks.onDone?.();
    return;
  }

  // Listen to WS events until we get the "execution complete" signal
  await new Promise<void>((resolve) => {
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'progress') {
          callbacks.onProgress?.(`Generating... ${msg.data.value}/${msg.data.max}`, msg.data.value, msg.data.max);
        } else if (msg.type === 'executing') {
          if (msg.data.node === null && msg.data.prompt_id === promptId) {
            // Done
            resolve();
          } else if (msg.data.node) {
            callbacks.onProgress?.(`Running node ${msg.data.node}...`);
          }
        } else if (msg.type === 'execution_error') {
          const nodeId = msg.data?.node_id ? ` (node ${msg.data.node_id})` : '';
          callbacks.onError?.(`Execution failed${nodeId}: ${msg.data?.exception_message || JSON.stringify(msg.data)}`);
          resolve();
        } else if (msg.type === 'execution_interrupted') {
          callbacks.onCancelled?.();
          resolve();
        }
      } catch { /* skip non-JSON */ }
    };
    ws.onerror = () => {
      callbacks.onError?.('WebSocket error during execution');
      resolve();
    };
    ws.onclose = () => resolve();
  });
  ws.close();
  activeWs = null;

  if (cancelRequested) {
    callbacks.onCancelled?.();
    activeAbort = null;
    activePromptId = null;
    activeComfyUrl = null;
    callbacks.onDone?.();
    return;
  }

  // Fetch the result via /history then /view
  try {
    callbacks.onProgress?.('Fetching result...');
    const histResp = await fetch(`/__comfy/history/${promptId}?target=${encodeURIComponent(comfyUrl)}`);
    if (!histResp.ok) throw new Error(`History fetch failed: ${histResp.status}`);
    const hist = await histResp.json();
    const promptData = hist[promptId];
    const outputs = promptData?.outputs || {};
    // Collect images from every $Output* node, in workflow definition order
    const collected: { filename: string; subfolder?: string; type?: string }[] = [];
    for (const nodeId of outputNodeIds) {
      const imgs = outputs[nodeId]?.images || [];
      for (const img of imgs) collected.push(img);
    }
    if (collected.length === 0) {
      throw new Error('No images in output — workflow may have errored');
    }
    for (const img of collected) {
      const params = new URLSearchParams({
        filename: img.filename,
        subfolder: img.subfolder || '',
        type: img.type || 'temp',
      });
      params.set('target', comfyUrl);
      const viewResp = await fetch(`/__comfy/view?${params}`);
      if (!viewResp.ok) continue;
      const blob = await viewResp.blob();
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      await callbacks.onImage(dataUrl);
    }
  } catch (e) {
    callbacks.onError?.(e instanceof Error ? e.message : 'Failed to fetch result');
  }

  activeAbort = null;
  activePromptId = null;
  activeComfyUrl = null;
  callbacks.onDone?.();
}

/* ── Per-workflow timing samples ─────────────────────────────────────────
 * Each workflow gets a side file at comfy-workflows/<name>.timing.json.
 * We only record "warm" runs (model already loaded) to keep estimates
 * meaningful — the first run after a fresh load includes model-load time
 * and would skew the average.
 */

export interface TimingSample { duration: number; ts: number }
export interface WorkflowTimings { version: number; samples: Record<string, TimingSample[]> }

export async function loadTimings(workflowName: string): Promise<WorkflowTimings> {
  try {
    const resp = await fetch(`/__comfy-timings?name=${encodeURIComponent(workflowName)}`);
    if (!resp.ok) return { version: 1, samples: {} };
    return await resp.json();
  } catch {
    return { version: 1, samples: {} };
  }
}

export async function recordTiming(workflowName: string, dimsKey: string, duration: number): Promise<WorkflowTimings | null> {
  try {
    const resp = await fetch(`/__comfy-timings?name=${encodeURIComponent(workflowName)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dimsKey, duration }),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

/** Average duration (in seconds) for a given dims key, or null if no samples. */
export function estimateDuration(timings: WorkflowTimings | null, dimsKey: string): { avg: number; samples: number } | null {
  if (!timings) return null;
  const list = timings.samples[dimsKey];
  if (!list || list.length === 0) return null;
  const sum = list.reduce((acc, s) => acc + s.duration, 0);
  return { avg: sum / list.length, samples: list.length };
}

/** Restart ComfyUI via ComfyUI-Manager's /manager/reboot endpoint.
 *
 * Rationale: ComfyUI's /free endpoint moves VRAM tensors through CPU RAM
 * before deletion, which spikes system RAM and can OOM the host on ROCm.
 * A full restart is the only reliable way to free everything cleanly.
 *
 * /manager/reboot uses os.execv to exec-replace the python process — no
 * new terminal, no new browser window. Resolves once ComfyUI is back. */
export async function restartComfy(comfyUrl: string, timeoutMs = 60_000): Promise<boolean> {
  try {
    await fetch(`/__comfy/manager/reboot?target=${encodeURIComponent(comfyUrl)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }).catch(() => { /* connection drops as the server exits — expected */ });
  } catch { /* expected */ }

  const start = Date.now();
  // Give the process a moment to actually exit before we start polling.
  await new Promise((r) => setTimeout(r, 1500));
  while (Date.now() - start < timeoutMs) {
    if (await checkConnection(comfyUrl)) return true;
    await new Promise((r) => setTimeout(r, 750));
  }
  return false;
}

/** Cancel the currently-running ComfyUI workflow. */
export async function cancelComfy(): Promise<void> {
  cancelRequested = true;
  if (activeAbort) activeAbort.abort();
  if (activePromptId && activeComfyUrl) {
    try {
      await fetch(`/__comfy/interrupt?target=${encodeURIComponent(activeComfyUrl)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt_id: activePromptId }),
      });
    } catch { /* ignore */ }
  }
  if (activeWs) try { activeWs.close(); } catch { /* ignore */ }
  activeAbort = null;
  activePromptId = null;
  activeWs = null;
}
