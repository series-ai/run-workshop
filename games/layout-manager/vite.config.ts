import { defineConfig, type Plugin } from 'vite';
import { execSync } from 'node:child_process';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import { rundotGameLibrariesPlugin } from '@series-inc/rundot-game-sdk/vite';

// CDN assets in cdn/ folder are automatically served in dev mode

/** True for browser-initiated cross-origin requests. Same-origin GETs carry no
 * Origin header, so this checks Origin when present and falls back to
 * Sec-Fetch-Site — keeping the local proxies unusable from other pages while
 * never blocking the app's own fetches. */
function isCrossOriginRequest(req: import('node:http').IncomingMessage): boolean {
  const host = req.headers.host;
  const origin = req.headers.origin;
  if (origin && (!host || (origin !== `http://${host}` && origin !== `https://${host}`))) return true;
  const site = req.headers['sec-fetch-site'];
  if (typeof site === 'string' && site !== 'same-origin' && site !== 'none') return true;
  return false;
}

function imageProxyPlugin(): Plugin {
  return {
    name: 'image-proxy',
    configureServer(server) {
      // In-place .layout saves — lets "Save" rewrite the opened project file
      // even in browsers without the File System Access API (Brave, Firefox).
      server.middlewares.use('/__save-layout', async (req, res) => {
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
        // The target path comes from the request, so only accept same-origin
        // browser requests: Origin must match the dev server's Host (browsers
        // always send Origin on POST), and requiring a JSON content type keeps
        // cross-origin pages from reaching this without a CORS preflight.
        const origin = req.headers.origin;
        const host = req.headers.host;
        if (!req.headers['content-type']?.includes('application/json') ||
            !origin || !host || (origin !== `http://${host}` && origin !== `https://${host}`)) {
          res.writeHead(403); res.end('Cross-origin request rejected'); return;
        }
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(Buffer.from(chunk));
          const { path: filePath, data } = JSON.parse(Buffer.concat(chunks).toString());
          if (typeof filePath !== 'string' || typeof data !== 'string' || !filePath.endsWith('.layout')) {
            res.writeHead(400); res.end('Expected { path: "*.layout", data }'); return;
          }
          const fs = await import('node:fs/promises');
          const pathMod = await import('node:path');
          const resolved = pathMod.resolve(filePath);
          // Only overwrite an existing .layout file — never create new paths
          const stat = await fs.stat(resolved).catch(() => null);
          if (!stat?.isFile()) { res.writeHead(404); res.end('File does not exist'); return; }
          // Atomic write: temp file in the same directory, then rename
          const tmp = pathMod.join(pathMod.dirname(resolved), `.${pathMod.basename(resolved)}.tmp`);
          await fs.writeFile(tmp, data);
          await fs.rename(tmp, resolved);
          res.writeHead(200); res.end('ok');
        } catch (e) {
          console.error('[save-layout] Failed:', e);
          res.writeHead(500); res.end(e instanceof Error ? e.message : 'Save failed');
        }
      });

      server.middlewares.use('/__proxy', async (req, res) => {
        if (isCrossOriginRequest(req)) { res.writeHead(403); res.end('Cross-origin request rejected'); return; }
        const url = new URL(req.url ?? '', 'http://localhost').searchParams.get('url');
        if (!url) { res.writeHead(400); res.end('Missing url param'); return; }
        try {
          const parsed = new URL(url);
          // file:// URLs from drag-and-drop (e.g. dragging out of Krita or a file
          // manager that only provides a URI list) — read from disk. Images only,
          // so this can't be used to read arbitrary local files.
          if (parsed.protocol === 'file:') {
            const { fileURLToPath } = await import('node:url');
            const fs = await import('node:fs/promises');
            const filePath = fileURLToPath(url);
            const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
            const mimes: Record<string, string> = {
              png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
              webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', avif: 'image/avif',
            };
            const mime = mimes[ext];
            if (!mime) { res.writeHead(403); res.end('Only image files can be loaded from disk'); return; }
            const buffer = await fs.readFile(filePath);
            res.writeHead(200, { 'Content-Type': mime });
            res.end(buffer);
            return;
          }
          // First attempt with the bot UA (helps get og:image from SPAs)
          let resp = await fetch(url, { headers: { 'User-Agent': 'bot' } });
          if (!resp.ok) {
            // Retry with the base domain as Referer (needed for CDNs like Midjourney
            // that reject requests without a same-site Referer)
            const baseDomain = parsed.hostname.replace(/^(?:cdn|img|images?|media|static)\./i, '');
            resp = await fetch(url, {
              headers: { 'User-Agent': 'bot', 'Referer': `${parsed.protocol}//${baseDomain}/` },
            });
          }
          const contentType = resp.headers.get('content-type') || 'image/png';
          // Stream instead of buffering — large files (AI models) would
          // otherwise sit at 0 bytes client-side until fully fetched here,
          // which reads as a dead download (and costs the file's size in RAM)
          const headers: Record<string, string> = { 'Content-Type': contentType, 'Cache-Control': 'max-age=3600' };
          const len = resp.headers.get('content-length');
          if (len) headers['Content-Length'] = len;
          res.writeHead(resp.ok ? 200 : resp.status, headers);
          if (resp.body) {
            let clientGone = false;
            res.once('close', () => { clientGone = true; });
            for await (const chunk of resp.body) {
              // Client aborted (tab closed mid-download) — stop reading;
              // breaking the loop cancels the upstream fetch stream
              if (clientGone || res.destroyed) break;
              // Respect backpressure: if the browser drains slower than the
              // fetch (a 475 MB model download), pause until the socket
              // catches up instead of buffering the difference in memory.
              // Also wake on close/error so an aborted client can't leave
              // this await hanging forever with the upstream held open.
              if (!res.write(chunk)) {
                await new Promise<void>((resolve) => {
                  const done = () => {
                    res.off('drain', done);
                    res.off('close', done);
                    res.off('error', done);
                    resolve();
                  };
                  res.once('drain', done);
                  res.once('close', done);
                  res.once('error', done);
                });
              }
            }
            if (!clientGone && !res.destroyed) res.end();
          } else {
            res.end(Buffer.from(await resp.arrayBuffer()));
          }
        } catch {
          // Mid-transfer failures reach here with headers already sent —
          // writeHead would throw; just kill the socket so the client errors
          if (res.headersSent) {
            res.destroy();
          } else {
            res.writeHead(502); res.end('Fetch failed');
          }
        }
      });
    },
  };
}

/** Direct AI API plugin — calls Google GenAI and OpenAI from the dev server. */
function aiDirectPlugin(): Plugin {
  // Track all in-flight AbortControllers across endpoints for /__ai-cancel
  const activeAborts = new Set<AbortController>();

  return {
    name: 'ai-direct',
    configureServer(server) {
      // Cancel all in-flight direct API requests
      server.middlewares.use('/__ai-cancel', (req, res) => {
        if (isCrossOriginRequest(req)) { res.writeHead(403); res.end('Cross-origin request rejected'); return; }
        const n = activeAborts.size;
        for (const a of activeAborts) a.abort();
        activeAborts.clear();
        console.log(`[ai-direct] Cancelled ${n} in-flight requests`);
        res.writeHead(200); res.end(`Cancelled ${n}`);
      });

      // Helper: SSE writer
      function makeSSE(res: import('node:http').ServerResponse) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });
        return (event: string, data: unknown) => {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };
      }

      // Helper: read JSON body
      async function readJsonBody(req: import('node:http').IncomingMessage): Promise<Record<string, unknown> | null> {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { return null; }
      }

      // Helper: detect mime from base64 magic bytes
      function detectMime(b64: string, fallback = 'image/png'): string {
        if (b64.startsWith('/9j/')) return 'image/jpeg';
        if (b64.startsWith('iVBOR')) return 'image/png';
        if (b64.startsWith('R0lGO')) return 'image/gif';
        if (b64.startsWith('UklGR')) return 'image/webp';
        return fallback;
      }

      // ====== Unity AI (generation inside a live Unity Editor) ======
      // The com.unity.pipeline package runs a token-authenticated server on
      // localhost:7800; the official `unity` CLI is the only sanctioned way in
      // (no CORS, token auth — the browser can never talk to it directly).
      // Generation goes through `unity command eval` → reflection into the
      // internal Unity.AI.Generators.Tools.AssetGenerators API.
      const unityCli = async (projectPath: string, args: string[], timeoutMs: number): Promise<Record<string, unknown>> => {
        const { execFile } = await import('node:child_process');
        return await new Promise((resolve, reject) => {
          execFile('unity', ['--no-banner', '--format', 'json', ...args, ...(projectPath ? ['--project-path', projectPath] : [])],
            { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 },
            (err, stdout) => {
              // The CLI writes JSON even on failures; prefer parsing over err
              try { resolve(JSON.parse(stdout)); } catch { reject(err ?? new Error('unity CLI produced no JSON')); }
            });
        });
      };
      const unityEval = async (projectPath: string, code: string, timeoutSec = 60): Promise<string> => {
        const json = await unityCli(projectPath, ['command', 'eval', '--timeout', String(timeoutSec), '--code', code], (timeoutSec + 30) * 1000);
        const result = (json as { data?: { result?: { result?: unknown, error?: string } } }).data?.result;
        if (json.success !== true && json.success !== 'True') {
          const errs = (json as { errors?: { message?: string }[] }).errors ?? [];
          throw new Error(result?.error || errs[0]?.message || `unity eval failed: ${JSON.stringify(json).slice(0, 500)}`);
        }
        return String(result?.result ?? '');
      };
      const unityFlagsDecl = 'var flags = System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Static;';
      const csStr = (s: string) => JSON.stringify(s); // C# string literal == JSON string literal for our inputs

      server.middlewares.use('/__unity-status', async (req, res) => {
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
        if (isCrossOriginRequest(req)) { res.writeHead(403); res.end('Cross-origin request rejected'); return; }
        const params = await readJsonBody(req) ?? {};
        // Empty path = auto-detect: no-arg `unity status` lists every running
        // Editor with the Pipeline package; the Preferences path is only an
        // override for when more than one Editor is open
        const projectPath = String(params.projectPath || '').trim();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        try {
          const json = await unityCli(projectPath, ['status'], 20000);
          const instances = ((json as { data?: { instances?: { port?: number; project?: string; version?: string; state?: string }[] } }).data?.instances) ?? [];
          const inst = instances.find((i) => i.state === 'ready') ?? instances[0];
          if (!inst) {
            res.end(JSON.stringify({ up: false, error: projectPath
              ? 'No running Unity Editor with the Pipeline package on this project. Open it in Unity 6+.'
              : 'No running Unity Editor with the Pipeline package found. Open your project in Unity 6+.' }));
            return;
          }
          // Live Unity AI points balance (best-effort — status still reports up on failure)
          let points: { available: number; allocated: number } | null = null;
          if (inst.state === 'ready' && inst.project) {
            try {
              const bal = await unityEval(inst.project, `
${unityFlagsDecl}
var acct = System.Type.GetType("Unity.AI.Toolkit.Accounts.Services.Account, Unity.AI.Toolkit.Accounts");
if (acct == null) return "NO_API";
var state = acct.GetField("pointsBalance", flags).GetValue(null);
var val = state.GetType().GetProperty("Value", flags).GetValue(state);
if (val == null) return "NO_VALUE";
var vt = val.GetType();
return vt.GetField("PointsAvailable", flags).GetValue(val) + "/" + vt.GetField("PointsAllocated", flags).GetValue(val);`, 30);
              const m = bal.match(/^(\d+)\/(\d+)$/);
              if (m) points = { available: Number(m[1]), allocated: Number(m[2]) };
            } catch { /* balance unavailable — not fatal */ }
          }
          res.end(JSON.stringify({ up: inst.state === 'ready', project: inst.project, version: inst.version, port: inst.port, state: inst.state, points }));
        } catch (e) {
          res.end(JSON.stringify({ up: false, error: e instanceof Error ? e.message : 'unity CLI not available' }));
        }
      });

      // Model list: kicked off as a background task inside the Editor (the
      // call is async there), polled to completion here, cached per project.
      const unityModelsCache = new Map<string, { at: number; models: unknown[] }>();
      server.middlewares.use('/__unity-models', async (req, res) => {
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
        if (isCrossOriginRequest(req)) { res.writeHead(403); res.end('Cross-origin request rejected'); return; }
        const params = await readJsonBody(req) ?? {};
        const projectPath = String(params.projectPath || '').trim();
        if (!projectPath) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Missing projectPath' })); return; }
        const cached = unityModelsCache.get(projectPath);
        if (cached && !params.refresh && Date.now() - cached.at < 60 * 60 * 1000) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ models: cached.models }));
          return;
        }
        try {
          const startCode = `
${unityFlagsDecl}
var genType = System.Type.GetType("Unity.AI.Generators.Tools.AssetGenerators, Unity.AI.Generators.Tools");
if (genType == null) return "NO_API";
var existing = System.AppDomain.CurrentDomain.GetData("lm_unity_models") as System.Threading.Tasks.Task;
if (existing == null || existing.IsFaulted) {
  var method = genType.GetMethod("GetAvailableModelsAsync", flags);
  existing = (System.Threading.Tasks.Task)method.Invoke(null, new object[] { true, System.Threading.CancellationToken.None });
  System.AppDomain.CurrentDomain.SetData("lm_unity_models", existing);
}
if (!existing.IsCompleted) return "PENDING";
if (existing.IsFaulted) return "FAULTED:" + existing.Exception.GetBaseException().Message;
var list = existing.GetType().GetProperty("Result").GetValue(existing);
var sb = new System.Text.StringBuilder();
foreach (var item in (System.Collections.IEnumerable)list) {
  var t = item.GetType();
  sb.Append(t.GetField("ModelId").GetValue(item)).Append("\\t").Append(t.GetField("Description").GetValue(item)).Append("\\n");
}
return sb.ToString();`;
          let out = '';
          for (let i = 0; i < 40; i++) {
            out = await unityEval(projectPath, startCode, 60);
            if (out === 'NO_API') throw new Error('Unity.AI.Generators.Tools is not in this project. Add com.unity.ai.assistant.');
            if (out.startsWith('FAULTED:')) throw new Error(out.slice(8));
            if (out !== 'PENDING') break;
            await new Promise((r) => setTimeout(r, 2000));
          }
          if (out === 'PENDING' || !out) throw new Error('Timed out fetching the Unity model list');
          // "Description" bundles the display name, blurb, modalities, and
          // Supports* capability flags into one string — parse it apart
          const models = out.trim().split('\n').map((line) => {
            const [id, desc = ''] = line.split('\t');
            const caps = Array.from(desc.matchAll(/Supports[A-Za-z0-9]+/g)).map((m) => m[0]);
            const modalities = (desc.match(/Modalities:\s*([^,.]+(?:,\s*[^,.]+)*?)(?=,\s*Supports|\.$|$)/)?.[1] ?? '')
              .split(',').map((s) => s.trim()).filter(Boolean);
            const displayName = desc.split(',')[0]?.trim() || id;
            const blurb = desc.replace(/,?\s*Modalities:.*$/, '').split(',').slice(1).join(',').trim();
            return { id: id!.trim(), displayName, blurb, modalities, caps };
          }).filter((m) => m.id);
          unityModelsCache.set(projectPath, { at: Date.now(), models });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ models }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }));
        }
      });

      server.middlewares.use('/__unity-generate', async (req, res) => {
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
        if (isCrossOriginRequest(req)) { res.writeHead(403); res.end('Cross-origin request rejected'); return; }
        const params = await readJsonBody(req);
        if (!params) { res.writeHead(400); res.end('Invalid JSON'); return; }
        const projectPath = String(params.projectPath || '').trim();
        const prompt = String(params.prompt || '').trim();
        const kind = params.kind === 'sprite' ? 'sprite' : 'image';
        const model = String(params.model || '').trim();
        const width = Math.max(0, Math.min(4096, Number(params.width) || 0));
        const height = Math.max(0, Math.min(4096, Number(params.height) || 0));
        const refImage = params.refImage as { base64: string; mimeType?: string } | undefined;
        // Utility models (upscale, recolor, bg removal) transform the
        // reference image — the prompt is optional when a reference rides
        // along. Unity's validator still demands a non-empty prompt string,
        // so substitute a neutral instruction.
        if (!projectPath || !model || (!prompt && !refImage?.base64)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing projectPath or model, or neither prompt nor reference image provided' }));
          return;
        }
        const effectivePrompt = prompt || 'Process the reference image.';

        const fsMod = await import('node:fs/promises');
        const pathMod = await import('node:path');
        const send = makeSSE(res);
        let clientGone = false;
        res.on('close', () => { clientGone = true; });

        // Output path: dated folder, kind_time_model name, never overwrite
        const now = new Date();
        // Local date, not UTC — evening generations must not jump to tomorrow's folder
        const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const hms = now.toTimeString().slice(0, 8).replace(/:/g, '');
        const modelSlug = model.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
        let outRel = `Assets/AIGenerated/${day}/${kind}_${hms}_${modelSlug}.png`;
        const stampKey = `${day.replace(/-/g, '')}_${hms}_${Math.random().toString(36).slice(2, 6)}`;
        // Reference image temp asset — cleaned up in finally so failed runs
        // don't strand files in the Unity project
        let refRel: string | null = null;
        try {
          await fsMod.mkdir(pathMod.join(projectPath, `Assets/AIGenerated/${day}`), { recursive: true });
          let n = 2;
          const base = outRel.slice(0, -4);
          while (await fsMod.stat(pathMod.join(projectPath, outRel)).then(() => true, () => false)) {
            outRel = `${base}_${n}.png`; n++;
          }

          // Reference image: Unity only reads references that exist as assets
          // inside the project, and only the first one is used
          if (refImage?.base64) {
            // Extension must match the actual bytes or Unity's importer chokes
            const refMime = refImage.mimeType || detectMime(refImage.base64);
            const refExt = /jpe?g/.test(refMime) ? 'jpg' : /webp/.test(refMime) ? 'webp' : /gif/.test(refMime) ? 'gif' : 'png';
            refRel = `Assets/AIGenerated/_lm_refs/ref_${stampKey}.${refExt}`;
            await fsMod.mkdir(pathMod.join(projectPath, 'Assets/AIGenerated/_lm_refs'), { recursive: true });
            await fsMod.writeFile(pathMod.join(projectPath, refRel), Buffer.from(refImage.base64, 'base64'));
          }

          await unityCli(projectPath, ['command', 'set_autotick', 'enabled=true'], 15000).catch(() => {});

          const settingsType = kind === 'sprite' ? 'SpriteSettings' : 'ImageSettings';
          const removeBg = kind === 'sprite';
          const handleKey = `lm_unity_gen_${stampKey}`;
          const refSetup = refRel ? `
// The ref file (and possibly its folder) was just written from outside the
// Editor — Refresh so Unity discovers them before importing
UnityEditor.AssetDatabase.Refresh(UnityEditor.ImportAssetOptions.ForceSynchronousImport);
UnityEditor.AssetDatabase.ImportAsset(${csStr(refRel)}, UnityEditor.ImportAssetOptions.ForceSynchronousImport);
var refTex = UnityEditor.AssetDatabase.LoadAssetAtPath<UnityEngine.Texture2D>(${csStr(refRel)});
if (refTex == null) {
  UnityEditor.AssetDatabase.Refresh(UnityEditor.ImportAssetOptions.ForceSynchronousImport);
  refTex = UnityEditor.AssetDatabase.LoadAssetAtPath<UnityEngine.Texture2D>(${csStr(refRel)});
}
if (refTex == null) {
  var fi = new System.IO.FileInfo(${csStr(refRel)});
  return "REF_LOAD_FAILED exists=" + fi.Exists + " bytes=" + (fi.Exists ? fi.Length : -1)
    + " importer=" + (UnityEditor.AssetImporter.GetAtPath(${csStr(refRel)}) == null ? "null" : UnityEditor.AssetImporter.GetAtPath(${csStr(refRel)}).GetType().Name);
}
var orType = System.Type.GetType("Unity.AI.Generators.Tools.ObjectReference, Unity.AI.Generators.Tools");
var objRef = System.Activator.CreateInstance(orType);
orType.GetField("Image", flags).SetValue(objRef, refTex);
orType.GetField("Label", flags).SetValue(objRef, "reference");
var refArr = System.Array.CreateInstance(orType, 1);
refArr.SetValue(objRef, 0);
settingsType.GetField("ImageReferences", flags).SetValue(settings, refArr);` : '';
          const startCode = `
${unityFlagsDecl}
var genType = System.Type.GetType("Unity.AI.Generators.Tools.AssetGenerators, Unity.AI.Generators.Tools");
if (genType == null) return "NO_API";
var settingsType = System.Type.GetType("Unity.AI.Generators.Tools.${settingsType}, Unity.AI.Generators.Tools");
var settings = System.Activator.CreateInstance(settingsType);
var removeF = settingsType.GetField("RemoveBackground", flags);
if (removeF != null) removeF.SetValue(settings, ${removeBg});
var wF = settingsType.GetField("Width", flags);
var hF = settingsType.GetField("Height", flags);
if (wF != null) wF.SetValue(settings, ${width});
if (hF != null) hF.SetValue(settings, ${height});${refSetup}
var paramOpen = System.Type.GetType("Unity.AI.Generators.Tools.GenerationParameters\`1, Unity.AI.Generators.Tools");
var paramType = paramOpen.MakeGenericType(settingsType);
var parameters = System.Activator.CreateInstance(paramType);
paramType.GetField("AssetType", flags).SetValue(parameters, typeof(UnityEngine.Texture2D));
paramType.GetField("Prompt", flags).SetValue(parameters, ${csStr(effectivePrompt)});
paramType.GetField("SavePath", flags).SetValue(parameters, ${csStr(outRel)});
paramType.GetField("ModelId", flags).SetValue(parameters, ${csStr(model)});
paramType.GetField("Settings", flags).SetValue(parameters, settings);
var generate = System.Linq.Enumerable.First(genType.GetMethods(flags), m => m.Name == "GenerateAsync" && m.IsGenericMethodDefinition);
var handle = generate.MakeGenericMethod(settingsType).Invoke(null, new object[] { parameters, System.Threading.CancellationToken.None });
System.AppDomain.CurrentDomain.SetData(${csStr(handleKey)}, handle);
return "started";`;

          const absOut = pathMod.join(projectPath, outRel);
          const preBytes = await fsMod.stat(absOut).then((s) => s.size, () => -1);

          const started = await unityEval(projectPath, startCode, 60);
          if (started === 'NO_API') throw new Error('Unity.AI.Generators.Tools is not in this project. Add com.unity.ai.assistant.');
          if (started.startsWith('REF_LOAD_FAILED')) {
            // Keep the temp file for diagnosis — this failure means Unity saw
            // the file but couldn't import it, and the bytes are the evidence
            const diag = started.slice('REF_LOAD_FAILED'.length).trim();
            refRel = null; // skip cleanup
            throw new Error(`Reference image could not be imported into the Unity project (${diag || 'no details'}). The file was kept in Assets/AIGenerated/_lm_refs/ for inspection.`);
          }
          if (started !== 'started') throw new Error(`Unity generation did not start: ${started}`);
          send('progress', { message: 'Generation started in Unity...' });

          const pollCode = `
${unityFlagsDecl}
var handle = System.AppDomain.CurrentDomain.GetData(${csStr(handleKey)});
if (handle == null) return "NO_HANDLE";
var handleType = handle.GetType();
System.Func<string, string> stat = name => {
  var t = handleType.GetProperty(name, flags).GetValue(handle) as System.Threading.Tasks.Task;
  if (t == null) return "null";
  if (t.IsFaulted) return "FAULTED:" + t.Exception.GetBaseException().Message;
  if (t.IsCanceled) return "Canceled";
  return t.IsCompleted ? "Done" : "Running";
};
var msgs = "";
var msgsVal = handleType.GetProperty("Messages", flags).GetValue(handle);
if (msgsVal is System.Collections.IEnumerable en && !(msgsVal is string)) { foreach (var m in en) msgs += m + " | "; }
else if (msgsVal != null) msgs = msgsVal.ToString();
var cost = handleType.GetProperty("PointCost", flags).GetValue(handle);
// Where Unity is ACTUALLY writing — can differ from the requested SavePath
var ph = handleType.GetProperty("Placeholder", flags).GetValue(handle);
var ppath = "";
if (ph is UnityEngine.Object po) ppath = UnityEditor.AssetDatabase.GetAssetPath(po) ?? "";
return "v=" + stat("ValidationTask") + " g=" + stat("GenerationTask") + " dl=" + stat("DownloadTask") + " cost=" + cost + " path=" + ppath + (msgs.Length > 0 ? " msgs=" + msgs.TrimEnd(' ', '|') : "");`;

          // Poll: the file size moving away from both the pre-existing size
          // and the generator's blank placeholder — then holding steady — is
          // the only reliable completion signal (DownloadTask.Status can sit
          // at WaitingForActivation the whole time while succeeding)
          const maxWaitMs = 15 * 60 * 1000;
          const startAt = Date.now();
          let placeholderBytes = -1, lastBytes = -1, lastStage = '';
          // Follow the file Unity is ACTUALLY writing (the handle's Placeholder
          // asset), not just the path we asked for — some generators redirect
          let watchRel = outRel;
          let watchAbs = absOut;
          let watchPre = preBytes;
          let done = false;
          while (Date.now() - startAt < maxWaitMs) {
            if (clientGone) break;
            const poll = await unityEval(projectPath, pollCode, 30).catch((e) => `POLL_ERR:${e instanceof Error ? e.message : e}`);
            const elapsed = Math.round((Date.now() - startAt) / 1000);
            if (poll === 'NO_HANDLE') throw new Error('Generation lost (Unity domain reload — Play mode or a script recompile). Retry.');
            if (poll.includes('FAULTED:')) throw new Error(`Unity generation failed after ${elapsed}s: ${poll}`);
            const cost = poll.match(/cost=(\S+)/)?.[1];
            const msgs = poll.match(/ msgs=(.*)$/)?.[1];
            // path= runs to the next marker (project paths can contain spaces)
            const phPath = poll.match(/ path=(.*?)(?= msgs=|$)/)?.[1]?.trim();
            if (phPath && phPath !== watchRel) {
              watchRel = phPath;
              watchAbs = pathMod.join(projectPath, watchRel);
              watchPre = -1;
              placeholderBytes = -1;
              lastBytes = -1;
            }
            const stage = poll.includes('v=Running') ? 'Validating prompt/model'
              : poll.includes('g=Running') ? 'Generating on Unity servers'
              : poll.includes('dl=Done') ? 'Finalizing'
              : poll.startsWith('POLL_ERR') ? 'Waiting for Editor'
              : 'Downloading result 🐌';
            if (stage !== lastStage) {
              send('progress', { message: `${stage}...`, elapsed, cost, serverMessage: msgs });
              lastStage = stage;
            }
            const bytes = await fsMod.stat(watchAbs).then((s) => s.size, () => -1);
            const dlDone = poll.includes('dl=Done');
            if (dlDone && bytes > 0 && bytes !== watchPre) { done = true; break; }
            if (placeholderBytes < 0 && bytes >= 0) placeholderBytes = bytes;
            if (bytes > 0 && bytes !== watchPre && bytes !== placeholderBytes) {
              if (bytes === lastBytes) { done = true; break; }
              lastBytes = bytes;
              await new Promise((r) => setTimeout(r, 3000));
              continue;
            }
            await new Promise((r) => setTimeout(r, 5000));
          }
          if (clientGone) return;
          if (!done) throw new Error('No result after 15 minutes — the job may still finish inside the Editor; check there before regenerating (it costs points).');
          const buf = await fsMod.readFile(watchAbs);
          send('image', { dataUrl: `data:image/png;base64,${buf.toString('base64')}` });
          send('done', {});
        } catch (e) {
          if (!clientGone) {
            console.error('[ai-direct] Unity error:', e);
            send('error', { error: e instanceof Error ? e.message : 'Unknown error' });
            send('done', {});
          }
        } finally {
          // Clean up the temp reference asset (file + .meta) on every path
          if (refRel) {
            fsMod.unlink(pathMod.join(projectPath, refRel)).catch(() => {});
            fsMod.unlink(pathMod.join(projectPath, refRel + '.meta')).catch(() => {});
          }
        }
        res.end();
      });

      // ====== Google GenAI (Nano Banana / Gemini) ======
      server.middlewares.use('/__ai-generate-google', async (req, res) => {
        if (isCrossOriginRequest(req)) { res.writeHead(403); res.end('Cross-origin request rejected'); return; }
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
        const params = await readJsonBody(req);
        if (!params) { res.writeHead(400); res.end('Invalid JSON'); return; }

        const apiKey = params.apiKey as string;
        const prompt = (params.prompt as string) || '';
        const aspectRatio = params.aspectRatio as string | undefined;
        const imageSize = (params.imageSize as string) || '1K';
        const count = Math.max(1, Math.min(10, Number(params.count) || 1));
        const refImages = (params.referenceImages as { base64: string; mimeType?: string }[] | undefined) || [];
        const seed = params.seed as number | undefined;
        const model = (params.model as string) || 'gemini-3-pro-image-preview';

        if (!apiKey) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing Google GenAI API key' }));
          return;
        }

        const send = makeSSE(res);
        let savedCount = 0;

        // Run N parallel calls (Gemini doesn't have a built-in count param)
        const tasks = Array.from({ length: count }, async (_, i) => {
          const abort = new AbortController();
          activeAborts.add(abort);
          try {
            const parts: unknown[] = [{ text: prompt }];
            for (const ref of refImages) {
              parts.push({ inline_data: { mime_type: ref.mimeType || detectMime(ref.base64), data: ref.base64 } });
            }
            const imageConfig: Record<string, unknown> = { imageSize };
            if (aspectRatio) imageConfig.aspectRatio = aspectRatio;

            const body: Record<string, unknown> = {
              contents: [{ parts }],
              generationConfig: {
                responseModalities: ['IMAGE'],
                imageConfig,
              },
            };
            if (seed !== undefined) (body.generationConfig as Record<string, unknown>).seed = seed + i;

            console.log(`[ai-direct] Google generate ${i + 1}/${count}`);
            const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
              body: JSON.stringify(body),
              signal: abort.signal,
            });

            if (!resp.ok) {
              const text = await resp.text();
              throw new Error(`Google API ${resp.status}: ${text}`);
            }

            const json = await resp.json();
            const respParts = json.candidates?.[0]?.content?.parts || [];
            for (const part of respParts) {
              if (part.inlineData?.data || part.inline_data?.data) {
                const data = part.inlineData?.data || part.inline_data?.data;
                const mimeType = part.inlineData?.mimeType || part.inline_data?.mime_type || 'image/png';
                savedCount++;
                send('progress', { saved: savedCount });
                send('image', { dataUrl: `data:${mimeType};base64,${data}` });
              }
            }
          } finally {
            activeAborts.delete(abort);
          }
        });

        try {
          await Promise.all(tasks);
          send('done', {});
        } catch (e) {
          if (e instanceof Error && e.name === 'AbortError') {
            send('cancelled', {});
          } else {
            console.error('[ai-direct] Google error:', e);
            send('error', { error: e instanceof Error ? e.message : 'Unknown error' });
            send('done', {});
          }
        }
        res.end();
      });

      // ====== OpenAI (gpt-image-1, gpt-image-2) ======
      server.middlewares.use('/__ai-generate-openai', async (req, res) => {
        if (isCrossOriginRequest(req)) { res.writeHead(403); res.end('Cross-origin request rejected'); return; }
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
        const params = await readJsonBody(req);
        if (!params) { res.writeHead(400); res.end('Invalid JSON'); return; }

        const apiKey = params.apiKey as string;
        const model = (params.model as string) || 'gpt-image-1';
        const prompt = (params.prompt as string) || '';
        const size = (params.size as string) || '1024x1024';
        const quality = (params.quality as string) || 'medium';
        const background = params.background as string | undefined;
        const count = Math.max(1, Math.min(10, Number(params.count) || 1));
        const outputFormat = (params.outputFormat as string) || 'png';
        const refImages = (params.referenceImages as { base64: string; mimeType?: string }[] | undefined) || [];

        if (!apiKey) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing OpenAI API key' }));
          return;
        }

        const send = makeSSE(res);

        const abort = new AbortController();
        activeAborts.add(abort);

        try {
          let resp: Response;

          if (refImages.length > 0) {
            // Use /v1/images/edits with multipart form
            const form = new FormData();
            form.append('model', model);
            form.append('prompt', prompt);
            form.append('size', size);
            form.append('quality', quality);
            form.append('n', String(count));
            form.append('output_format', outputFormat);
            if (background) form.append('background', background);
            for (let i = 0; i < refImages.length; i++) {
              const ref = refImages[i]!;
              const buf = Buffer.from(ref.base64, 'base64');
              const blob = new Blob([buf], { type: ref.mimeType || detectMime(ref.base64) });
              form.append('image[]', blob, `ref_${i}.png`);
            }
            console.log(`[ai-direct] OpenAI edit ${model} (${refImages.length} refs, ${count}x ${size})`);
            resp = await fetch('https://api.openai.com/v1/images/edits', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${apiKey}` },
              body: form,
              signal: abort.signal,
            });
          } else {
            // Use /v1/images/generations
            const body: Record<string, unknown> = {
              model,
              prompt,
              size,
              quality,
              n: count,
              output_format: outputFormat,
            };
            if (background) body.background = background;
            console.log(`[ai-direct] OpenAI generate ${model} (${count}x ${size})`);
            resp = await fetch('https://api.openai.com/v1/images/generations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
              body: JSON.stringify(body),
              signal: abort.signal,
            });
          }

          if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`OpenAI API ${resp.status}: ${text}`);
          }

          const json = await resp.json();
          const data: { b64_json?: string; url?: string }[] = json.data || [];
          let savedCount = 0;
          for (const item of data) {
            if (item.b64_json) {
              savedCount++;
              send('progress', { saved: savedCount });
              const mime = outputFormat === 'jpeg' ? 'image/jpeg' : outputFormat === 'webp' ? 'image/webp' : 'image/png';
              send('image', { dataUrl: `data:${mime};base64,${item.b64_json}` });
            } else if (item.url) {
              // Fetch URL and convert to base64
              const imgResp = await fetch(item.url);
              const imgBuf = Buffer.from(await imgResp.arrayBuffer());
              savedCount++;
              send('progress', { saved: savedCount });
              const mime = outputFormat === 'jpeg' ? 'image/jpeg' : outputFormat === 'webp' ? 'image/webp' : 'image/png';
              send('image', { dataUrl: `data:${mime};base64,${imgBuf.toString('base64')}` });
            }
          }
          send('done', {});
        } catch (e) {
          if (e instanceof Error && e.name === 'AbortError') {
            send('cancelled', {});
          } else {
            console.error('[ai-direct] OpenAI error:', e);
            send('error', { error: e instanceof Error ? e.message : 'Unknown error' });
            send('done', {});
          }
        } finally {
          activeAborts.delete(abort);
        }
        res.end();
      });

      // ====== Hermes Grok Imagine (SuperGrok sub via hermes agent) ======
      server.middlewares.use('/__ai-generate-hermes', async (req, res) => {
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
        if (isCrossOriginRequest(req)) { res.writeHead(403); res.end('Cross-origin request rejected'); return; }
        const params = await readJsonBody(req);
        if (!params) { res.writeHead(400); res.end('Invalid JSON'); return; }
        const prompt = String(params.prompt || '').trim();
        if (!prompt) { res.writeHead(400); res.end('Missing prompt'); return; }
        const count = Math.max(1, Math.min(4, Number(params.count) || 1));
        // Grok models ride in the agent instruction; GPT Image tiers are picked
        // via the OPENAI_IMAGE_MODEL env override the codex plugin checks first
        const model = params.model === 'grok-imagine-image-quality' ? 'grok-imagine-image-quality'
          : params.model === 'grok-imagine-image' ? 'grok-imagine-image'
          : null;
        const gptTier = /^gpt-image-2-(low|medium|high)$/.test(String(params.model)) ? String(params.model) : null;
        // The active hermes image backend lives in config.yaml — flip it to
        // match the requested provider so both can be offered side by side.
        // A failed switch must abort: generating anyway would silently hit
        // (and bill) whichever backend is currently configured.
        const backend = model ? 'xai' : gptTier ? 'openai-codex' : null;
        if (backend) {
          try {
            const { execFileSync } = await import('node:child_process');
            execFileSync('hermes', ['config', 'set', 'image_gen.provider', backend], { timeout: 10000, stdio: 'ignore' });
          } catch (e) {
            console.error('[ai-direct] Could not switch hermes image_gen.provider:', e);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Could not switch the Hermes image backend to ${backend} — generation aborted so the wrong provider isn't used. Is the hermes CLI on PATH?` }));
            return;
          }
        }
        const XAI_ASPECTS = ['16:9', '1:1', '9:16', '4:3', '3:4', '3:2', '2:3'];
        const CODEX_ASPECTS = ['square', 'landscape', 'portrait'];
        const aspect = model && XAI_ASPECTS.includes(String(params.aspectRatio)) ? String(params.aspectRatio)
          : gptTier && CODEX_ASPECTS.includes(String(params.aspectRatio)) ? String(params.aspectRatio)
          : null;

        const send = (event: string, data: unknown) => {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
        send('progress', { saved: 0 });

        const os = await import('node:os');
        const fsMod = await import('node:fs/promises');
        const pathMod = await import('node:path');
        const { spawn } = await import('node:child_process');

        // Reference images ride as temp files the agent hands to the tool
        const tmpFiles: string[] = [];
        const refs = (params.refImages ?? []) as { base64: string; mimeType?: string }[];
        // xAI /v1/images/edits accepts up to 3 total source images; the codex
        // backend takes up to 16 reference images
        for (const img of refs.slice(0, gptTier ? 16 : 3)) {
          const ext = /jpe?g/.test(img.mimeType || '') ? 'jpg' : /webp/.test(img.mimeType || '') ? 'webp' : 'png';
          const f = pathMod.join(os.tmpdir(), `lm-hgi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
          await fsMod.writeFile(f, Buffer.from(img.base64, 'base64'));
          tmpFiles.push(f);
        }

        let instruction = model
          ? `Call the image_generate tool with model ${model} and prompt: ${prompt}`
          : `Call the image_generate tool with prompt: ${prompt}`;
        if (aspect) instruction += `\nSet aspect_ratio to ${aspect}.`;
        if (count > 1) {
          // The codex backend generates one image per call; batching means
          // calling the tool once per image. xAI takes num_images directly.
          instruction += gptTier
            ? `\nGenerate ${count} images total by calling the image_generate tool ${count} times with the same arguments.`
            : `\nSet num_images to ${count}.`;
        }
        if (tmpFiles.length) {
          instruction += `\nUse ${tmpFiles[0]} as the image_url source image.`;
          if (tmpFiles.length > 1) instruction += ` Use ${tmpFiles.slice(1).join(', ')} as reference_image_urls.`;
        }
        instruction += '\nWhen it finishes, reply with ONLY the absolute file path(s) or URL(s) of the generated image(s), one per line, nothing else.';

        const child = spawn('hermes', ['--yolo', '-z', instruction, '-t', 'image_gen'], {
          stdio: ['ignore', 'pipe', 'pipe'],
          // Tier override for the openai-codex image plugin — it checks this
          // env var before config.yaml, so the UI choice wins per-run
          env: gptTier ? { ...process.env, OPENAI_IMAGE_MODEL: gptTier } : process.env,
        });
        const cleanupTmp = () => { for (const f of tmpFiles) fsMod.unlink(f).catch(() => {}); };
        res.on('close', () => { child.kill('SIGTERM'); cleanupTmp(); });
        let out = '';
        let errBuf = '';
        child.stdout.on('data', (d: Buffer) => { out += d.toString(); });
        child.stderr.on('data', (d: Buffer) => { errBuf += d.toString(); });
        child.on('close', async (code: number | null) => {
          cleanupTmp();
          try {
            // Strip ANSI, collect image URLs/paths from the reply
            const clean = out.replace(/\x1b\[[0-9;]*m/g, '');
            const urls = Array.from(new Set(clean.match(/https?:\/\/[^\s"']+\.(?:png|jpe?g|webp)(?:\?[^\s"']*)?/gi) ?? []));
            const paths = Array.from(new Set(clean.match(/(?:~\/|\/)[\w.\/-]+\.(?:png|jpe?g|webp)/gi) ?? []))
              .filter((p) => !tmpFiles.includes(p));
            if (!urls.length && !paths.length) {
              send('error', { error: `Hermes returned no image${code ? ` (exit ${code})` : ''}: ${(clean.trim() || errBuf).slice(0, 300)}` });
              send('done', {});
              res.end();
              return;
            }
            let saved = 0;
            for (const u of urls) {
              const r = await fetch(u).catch(() => null);
              if (!r?.ok) continue;
              const buf = Buffer.from(await r.arrayBuffer());
              const mime = r.headers.get('content-type') || 'image/png';
              send('image', { dataUrl: `data:${mime};base64,${buf.toString('base64')}` });
              send('progress', { saved: ++saved });
            }
            for (const p of paths) {
              const buf = await fsMod.readFile(p.replace(/^~/, os.homedir())).catch(() => null);
              if (!buf) continue;
              const mime = /\.jpe?g$/i.test(p) ? 'image/jpeg' : /\.webp$/i.test(p) ? 'image/webp' : 'image/png';
              send('image', { dataUrl: `data:${mime};base64,${buf.toString('base64')}` });
              send('progress', { saved: ++saved });
            }
            if (!saved) send('error', { error: 'Hermes reported images but none could be fetched.' });
            send('done', {});
          } catch (e) {
            send('error', { error: e instanceof Error ? e.message : 'Unknown error' });
            send('done', {});
          }
          res.end();
        });
      });

      // Ensure the hermes proxy is running (spawn detached if not) — Grok chat
      // is always offered when hermes has an xAI login; the proxy spins up on
      // demand the first time it's needed
      const HERMES_PROXY_DEFAULT = 'http://127.0.0.1:8645';
      const normalizeHermesUrl = (u?: unknown): string => {
        let url = String(u || '').trim() || HERMES_PROXY_DEFAULT;
        if (!/^https?:\/\//i.test(url)) url = 'http://' + url;
        // 0.0.0.0 is a listen address, not a connect address
        return url.replace(/\/+$/, '').replace('//0.0.0.0', '//127.0.0.1');
      };
      async function hermesProxyModels(baseUrl: string = HERMES_PROXY_DEFAULT): Promise<string[] | null> {
        try {
          const r = await fetch(`${baseUrl}/v1/models`, { headers: { 'Authorization': 'Bearer layout-manager' }, signal: AbortSignal.timeout(1200) });
          if (!r.ok) return null;
          const j = await r.json();
          return ((j?.data ?? []) as { id?: string }[])
            .map((m) => m.id)
            .filter((id): id is string => !!id && !/imagine|image|video/i.test(id));
        } catch { return null; }
      }
      let proxySpawnAt = 0;
      async function ensureHermesProxy(baseUrl: string = HERMES_PROXY_DEFAULT): Promise<string[] | null> {
        const models = await hermesProxyModels(baseUrl);
        if (models) return models;
        // Don't spawn-storm: at most one attempt per 30s
        if (Date.now() - proxySpawnAt > 30_000) {
          proxySpawnAt = Date.now();
          try {
            const { spawn } = await import('node:child_process');
            const child = spawn('hermes', ['proxy', 'start', '--provider', 'xai'], { detached: true, stdio: 'ignore' });
            child.unref();
            console.log('[ai-direct] Spawned hermes proxy (detached)');
          } catch { return null; }
        }
        for (let i = 0; i < 12; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          const m = await hermesProxyModels(baseUrl);
          if (m) return m;
        }
        return null;
      }

      // Disconnect: kill any running hermes proxy (user opted out)
      server.middlewares.use('/__hermes-proxy-stop', async (req, res) => {
        if (isCrossOriginRequest(req)) { res.writeHead(403); res.end('Cross-origin request rejected'); return; }
        const params = (await readJsonBody(req)) ?? {};
        try {
          const { execSync } = await import('node:child_process');
          if (process.platform === 'win32') {
            // pkill doesn't exist on Windows — match the proxy by command line
            execSync('powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match \'hermes(\\.exe)?.* proxy\' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"', { timeout: 10000 });
          } else {
            execSync("pkill -f 'hermes [p]roxy'", { timeout: 5000 });
          }
        } catch { /* nothing running */ }
        // Report honestly: probe whether the proxy is actually gone
        const stillUp = await hermesProxyModels(normalizeHermesUrl(params.hermesUrl));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ stopped: !stillUp }));
      });

      // On-demand proxy ensure for the chat panel (returns live model list)
      server.middlewares.use('/__hermes-ensure', async (req, res) => {
        if (isCrossOriginRequest(req)) { res.writeHead(403); res.end('Cross-origin request rejected'); return; }
        const params = (await readJsonBody(req)) ?? {};
        const models = await ensureHermesProxy(normalizeHermesUrl(params.hermesUrl));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ up: !!models, models: models ?? [] }));
      });

      // ====== Local AI provider availability probe ======
      let claudeCliCache: boolean | null = null;
      server.middlewares.use('/__ai-local-status', async (req, res) => {
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
        if (isCrossOriginRequest(req)) { res.writeHead(403); res.end('Cross-origin request rejected'); return; }
        const params = await readJsonBody(req) ?? {};
        const norm = (u: unknown, fallback: string) => {
          let url = String(u || '').trim() || fallback;
          if (!/^https?:\/\//i.test(url)) url = 'http://' + url;
          return url.replace(/\/+$/, '').replace('//0.0.0.0', '//127.0.0.1');
        };
        const probe = async (url: string, headers?: Record<string, string>) => {
          try {
            const r = await fetch(url, { headers, signal: AbortSignal.timeout(1200) });
            return r.ok ? await r.json().catch(() => ({})) : null;
          } catch { return null; }
        };
        if (claudeCliCache === null) {
          try {
            const { execSync } = await import('node:child_process');
            execSync('claude --version', { stdio: 'ignore', timeout: 5000 });
            claudeCliCache = true;
          } catch { claudeCliCache = false; }
        }
        const [kobold, ollama, hermes] = await Promise.all([
          probe(`${norm(params.koboldUrl, 'http://127.0.0.1:5001')}/v1/models`),
          probe(`${norm(params.ollamaUrl, 'http://127.0.0.1:11434')}/api/tags`),
          probe(`${norm(params.hermesUrl, 'http://127.0.0.1:8645')}/v1/models`, { 'Authorization': 'Bearer layout-manager' }),
        ]);
        // Hermes logins: Codex → GPT chat via one-shot agent runs; xai-oauth →
        // Grok chat via the proxy (offered whenever the login exists — the
        // proxy auto-spawns on demand)
        let hermesCli: { up: boolean; models: string[] } = { up: false, models: [] };
        let hermesXaiLogin = false;
        let hermesCodexLogin = false;
        try {
          const { execSync } = await import('node:child_process');
          const authList = execSync('hermes auth list', { encoding: 'utf8', timeout: 8000 });
          hermesCodexLogin = /openai-codex/.test(authList);
          if (hermesCodexLogin) {
            hermesCli = { up: true, models: ['gpt-5.6-luna', 'gpt-5.6-luna-pro', 'gpt-5.6-sol', 'gpt-5.6-sol-pro', 'gpt-5.6-terra', 'gpt-5.6-terra-pro', 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini'] };
          }
          hermesXaiLogin = /xai-oauth/.test(authList);
        } catch { /* hermes not installed */ }
        // Image generation via the hermes agent — needs the image_gen backend
        // selected once in `hermes tools`. The provider (xai, openai-codex, …)
        // decides which UI the Text to Image panel shows.
        let hermesImageGenProvider: string | null = null;
        try {
          const fsMod = await import('node:fs/promises');
          const os = await import('node:os');
          const cfg = await fsMod.readFile(`${os.homedir()}/.hermes/config.yaml`, 'utf8');
          // Match provider inside the top-level image_gen block only
          const block = cfg.match(/^image_gen:\n((?:[ \t]+.*\n?)*)/m)?.[1] ?? '';
          hermesImageGenProvider = block.match(/^[ \t]+provider:[ \t]*(\S+)/m)?.[1] ?? null;
        } catch { /* no hermes config */ }
        const hermesModels = ((hermes?.data ?? []) as { id?: string }[])
          .map((m) => m.id)
          .filter((id): id is string => !!id && !/imagine|image|video/i.test(id));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          kobold: { up: !!kobold },
          ollama: { up: !!ollama },
          hermes: { up: !!hermes || hermesXaiLogin, models: hermesModels },
          hermesCli,
          hermesImageGen: {
            up: !!hermesImageGenProvider,
            provider: hermesImageGenProvider,
            // Which backends LM can offer — the generate endpoint switches
            // image_gen.provider on the fly via `hermes config set`
            xai: hermesXaiLogin,
            codex: hermesCodexLogin,
          },
          claude: { up: claudeCliCache },
        }));
      });

      // ====== Fal.ai Seedream Layerize (image → editable layers) ======
      server.middlewares.use('/__ai-layerize', async (req, res) => {
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
        if (isCrossOriginRequest(req)) { res.writeHead(403); res.end('Cross-origin request rejected'); return; }
        const params = await readJsonBody(req);
        if (!params) { res.writeHead(400); res.end('Invalid JSON'); return; }

        const apiKey = ((params.apiKey as string) || '').trim();
        const sourceImage = params.sourceImage as string;
        const prompt = (params.prompt as string) || '';

        if (!apiKey) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing Fal.ai API key' }));
          return;
        }
        if (!sourceImage) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing source image' }));
          return;
        }
        // After validation — detectMime throws on undefined input
        const sourceMime = (params.sourceMime as string) || detectMime(sourceImage);

        const abort = new AbortController();
        activeAborts.add(abort);

        try {
          console.log('[ai-direct] Fal.ai Seedream Layerize submit');
          const submitResp = await fetch('https://queue.fal.run/bytedance/seedream/v5/pro/layerize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${apiKey}` },
            body: JSON.stringify({
              image_url: `data:${sourceMime};base64,${sourceImage}`,
              ...(prompt ? { prompt } : {}),
              enable_safety_checker: params.disableSafety ? false : true,
            }),
            signal: abort.signal,
          });
          if (!submitResp.ok) {
            const text = await submitResp.text();
            throw new Error(`Fal.ai submit ${submitResp.status}: ${text}`);
          }
          const submitJson = await submitResp.json();
          const requestId = submitJson.request_id as string;
          if (!requestId) throw new Error('Fal.ai: no request_id in response');

          // Nested model paths poll at the app root (bytedance/seedream)
          const statusUrl = `https://queue.fal.run/bytedance/seedream/requests/${requestId}/status`;
          const resultUrl = `https://queue.fal.run/bytedance/seedream/requests/${requestId}`;
          let attempts = 0;
          let completed = false;
          while (attempts < 150) {
            attempts++;
            await new Promise((r) => setTimeout(r, 2000));
            const statusResp = await fetch(statusUrl, { headers: { 'Authorization': `Key ${apiKey}` }, signal: abort.signal });
            if (!statusResp.ok) continue;
            const statusJson = await statusResp.json();
            if (statusJson.status === 'COMPLETED') { completed = true; break; }
            if (statusJson.status === 'FAILED' || statusJson.status === 'ERROR') {
              throw new Error(`Fal.ai layerize failed: ${JSON.stringify(statusJson)}`);
            }
          }
          if (!completed) throw new Error('Fal.ai layerize timed out after 5 minutes');

          const resultResp = await fetch(resultUrl, { headers: { 'Authorization': `Key ${apiKey}` }, signal: abort.signal });
          if (!resultResp.ok) {
            const text = await resultResp.text();
            throw new Error(`Fal.ai result ${resultResp.status}: ${text}`);
          }
          const resultJson = await resultResp.json();
          const rawLayers = (resultJson.layers ?? []) as {
            image?: { url?: string; content_type?: string };
            z_index?: number;
            bounding_box?: { absolute?: number[] } | null;
            name?: string | null;
          }[];
          if (!rawLayers.length) throw new Error('Fal.ai: no layers in result');

          // Download each layer server-side (fal's CDN lacks CORP headers, so
          // the COEP-isolated browser can't fetch them directly)
          const layers = [];
          for (const layer of rawLayers) {
            const imgUrl = layer.image?.url;
            if (!imgUrl) continue;
            const imgResp = await fetch(imgUrl, { signal: abort.signal });
            if (!imgResp.ok) continue;
            const buf = Buffer.from(await imgResp.arrayBuffer());
            const mime = layer.image?.content_type || 'image/png';
            layers.push({
              dataUrl: `data:${mime};base64,${buf.toString('base64')}`,
              zIndex: layer.z_index ?? layers.length,
              name: layer.name ?? null,
              bbox: layer.bounding_box?.absolute ?? null,
            });
          }
          if (!layers.length) throw new Error('Fal.ai: layer downloads failed — no layers could be retrieved');
          console.log(`[ai-direct] Layerize returned ${layers.length} layers`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ layers }));
        } catch (e) {
          if (e instanceof Error && e.name === 'AbortError') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ cancelled: true }));
          } else {
            console.error('[ai-direct] Layerize error:', e);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }));
          }
        } finally {
          activeAborts.delete(abort);
        }
      });

      // ====== AI Chat (multi-provider) ======
      server.middlewares.use('/__ai-chat', async (req, res) => {
        if (isCrossOriginRequest(req)) { res.writeHead(403); res.end('Cross-origin request rejected'); return; }
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        let params: { provider: string; model: string; apiKey: string; localUrl?: string; messages: { role: string; content: string; images?: { base64: string; mimeType: string }[] }[] };
        try {
          params = JSON.parse(Buffer.concat(chunks).toString());
        } catch {
          res.writeHead(400); res.end('Invalid JSON'); return;
        }

        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });

        try {
          // Claude via local Claude Code CLI (claude.ai Pro/Max subscription login,
          // no API key). Streams tokens from `claude -p --output-format stream-json`.
          if (params.provider === 'hermes-cli') {
            const { spawn } = await import('node:child_process');
            const sendChat = (event: string, data: string) => {
              res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
            };
            // Documented one-shot form: `hermes chat -q <prompt> --image <path>
            // --safe-mode` (see Hermes CLI reference). --safe-mode strips the
            // agent machinery so output is pure text; -Q suppresses chrome.
            // --image takes a single path — the newest image rides the flag,
            // any earlier ones are referenced by path in the prompt text.
            const os = await import('node:os');
            const fsMod = await import('node:fs/promises');
            const pathMod = await import('node:path');
            const tmpFiles: string[] = [];
            const parts: string[] = [];
            for (const m of params.messages) {
              let line = `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`;
              for (const img of m.images ?? []) {
                const ext = /jpe?g/.test(img.mimeType || '') ? 'jpg' : /webp/.test(img.mimeType || '') ? 'webp' : 'png';
                const f = pathMod.join(os.tmpdir(), `lm-hermes-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
                await fsMod.writeFile(f, Buffer.from(img.base64, 'base64'));
                tmpFiles.push(f);
                line += `\n(Attached image: ${f})`;
              }
              parts.push(line);
            }
            const prompt = parts.join('\n\n');
            const args = ['chat', '-q', prompt, '--safe-mode', '-Q', '--provider', 'openai-codex'];
            if (tmpFiles.length) args.push('--image', tmpFiles[tmpFiles.length - 1]!);
            if (params.model) args.push('-m', params.model);
            const child = spawn('hermes', args, { stdio: ['ignore', 'pipe', 'pipe'] });
            const cleanupTmp = () => { for (const f of tmpFiles) fsMod.unlink(f).catch(() => {}); };
            res.on('close', () => { child.kill('SIGTERM'); cleanupTmp(); });
            let out = '';
            let errBuf = '';
            child.stdout.on('data', (d: Buffer) => { out += d.toString(); });
            child.stderr.on('data', (d: Buffer) => { errBuf += d.toString(); });
            child.on('close', (code: number | null) => {
              cleanupTmp();
              const text = out.replace(/^session_id:[^\n]*\n?/, '').trim();
              if (text) sendChat('text', text);
              else sendChat('text', `Hermes CLI error${code ? ` (exit ${code})` : ''}: ${(errBuf || 'no output').slice(0, 400)}`);
              sendChat('done', '');
              res.end();
            });
            return;
          }

          if (params.provider === 'claude-account') {
            const { spawn } = await import('node:child_process');
            const sendChat = (event: string, data: string) => {
              res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
            };
            // Claude Code takes a single prompt, so serialize the conversation
            const prompt = params.messages
              .map((m) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
              .join('\n\n');
            const child = spawn('claude', [
              '-p',
              '--output-format', 'stream-json',
              '--verbose',
              '--include-partial-messages',
              // Pure chat: disable all tools so the CLI can't read files or
              // browse from a chat message (or injected pasted text)
              '--disallowedTools', 'Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,Task,NotebookEdit,TodoWrite,KillShell,BashOutput,Skill,Workflow,ToolSearch,Agent,EnterWorktree,ExitWorktree,Monitor,SendMessage,TaskCreate,TaskGet,TaskList,TaskOutput,TaskStop,TaskUpdate,CronCreate,CronDelete,CronList,PushNotification,RemoteTrigger,ScheduleWakeup',
              // Ignore project/user MCP configs (e.g. ComfyUI Cloud) — chat only
              '--strict-mcp-config',
              ...(params.model ? ['--model', String(params.model)] : []),
            ], { stdio: ['pipe', 'pipe', 'pipe'] });
            child.stdin.write(prompt);
            child.stdin.end();

            res.on('close', () => { child.kill('SIGTERM'); });

            let sentAny = false;
            let stderrBuf = '';
            child.stderr.on('data', (d: Buffer) => { stderrBuf += d.toString(); });

            let lineBuf = '';
            child.stdout.on('data', (d: Buffer) => {
              lineBuf += d.toString();
              const lines = lineBuf.split('\n');
              lineBuf = lines.pop()!;
              for (const line of lines) {
                if (!line.trim()) continue;
                try {
                  const ev = JSON.parse(line);
                  if (ev.type === 'stream_event' && ev.event?.type === 'content_block_delta' && ev.event.delta?.type === 'text_delta') {
                    sentAny = true;
                    sendChat('text', ev.event.delta.text);
                  }
                } catch { /* skip unparseable lines */ }
              }
            });

            await new Promise<void>((resolve) => {
              child.on('error', (err: NodeJS.ErrnoException) => {
                sendChat('text', err.code === 'ENOENT'
                  ? 'Claude Code is not installed. Install it from https://claude.com/claude-code and run `claude` once to log in with your Claude account.'
                  : `Failed to start Claude Code: ${err.message}`);
                resolve();
              });
              child.on('close', (code) => {
                if (code !== 0 && !sentAny) {
                  console.error('[ai-chat] claude CLI error:', stderrBuf);
                  sendChat('text', `Claude Code error: ${stderrBuf.trim() || `exited with code ${code}`}\n\nIf you are not logged in, run \`claude\` in a terminal and use /login with your Claude account.`);
                }
                resolve();
              });
            });
            sendChat('done', '');
            res.end();
            return;
          }

          let apiResp: Response;

          if (params.provider === 'anthropic') {
            const msgs = params.messages.map((m) => {
              if (m.images?.length) {
                const content: unknown[] = [];
                for (const img of m.images) {
                  let mt = img.mimeType;
                  if (img.base64.startsWith('/9j/')) mt = 'image/jpeg';
                  else if (img.base64.startsWith('iVBOR')) mt = 'image/png';
                  else if (img.base64.startsWith('R0lGO')) mt = 'image/gif';
                  else if (img.base64.startsWith('UklGR')) mt = 'image/webp';
                  content.push({ type: 'image', source: { type: 'base64', media_type: mt, data: img.base64 } });
                }
                if (m.content) content.push({ type: 'text', text: m.content });
                return { role: m.role, content };
              }
              return { role: m.role, content: m.content };
            });
            apiResp = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-api-key': params.apiKey, 'anthropic-version': '2023-06-01' },
              body: JSON.stringify({ model: params.model, max_tokens: 4096, stream: true, messages: msgs }),
            });
          } else if (params.provider === 'google') {
            const contents = params.messages.map((m) => {
              const parts: unknown[] = [];
              if (m.images?.length) {
                for (const img of m.images) {
                  parts.push({ inline_data: { mime_type: img.mimeType, data: img.base64 } });
                }
              }
              if (m.content) parts.push({ text: m.content });
              return { role: m.role === 'assistant' ? 'model' : 'user', parts };
            });
            apiResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${params.model}:streamGenerateContent?alt=sse&key=${params.apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents }),
            });
          } else {
            // Local servers (KoboldCpp, Ollama) speak the OpenAI chat-completions
            // format too — same endpoint shape, no auth header.
            const isLocal = params.provider === 'kobold' || params.provider === 'ollama' || params.provider === 'hermes';
            let baseUrl: string;
            let model = params.model;
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (isLocal) {
              let url = (params.localUrl || '').trim()
                || (params.provider === 'kobold' ? 'http://127.0.0.1:5001'
                  : params.provider === 'hermes' ? 'http://127.0.0.1:8645'
                  : 'http://127.0.0.1:11434');
              if (!/^https?:\/\//i.test(url)) url = 'http://' + url;
              // 0.0.0.0 is a listen address, not a connect address
              baseUrl = url.replace(/\/+$/, '').replace('//0.0.0.0', '//127.0.0.1');
              if (params.provider === 'hermes') {
                // The proxy requires a bearer header but accepts any token —
                // it injects the real OAuth credentials itself. Spin the
                // proxy up if it isn't running.
                headers['Authorization'] = 'Bearer layout-manager';
                await ensureHermesProxy(baseUrl);
                if (!model) {
                  const list = await fetch(`${baseUrl}/v1/models`, { headers }).then((r) => r.json()).catch(() => null);
                  model = list?.data?.[0]?.id;
                  if (!model) throw new Error('Hermes proxy has no models. Start it with `hermes proxy start` (and log in via `hermes login` first).');
                }
              }
              if (params.provider === 'ollama' && !model) {
                // No model configured — use the first installed one
                const tags = await fetch(`${baseUrl}/api/tags`).then((r) => r.json()).catch(() => null);
                model = tags?.models?.[0]?.name;
                if (!model) throw new Error('No Ollama models found. Pull one first (e.g. `ollama pull llama3.2`) or set a model name in Preferences > AI.');
              }
              if (!model) model = 'local'; // KoboldCpp ignores the model field
            } else {
              baseUrl = params.provider === 'xai' ? 'https://api.x.ai' : 'https://api.openai.com';
              headers['Authorization'] = `Bearer ${params.apiKey}`;
            }
            const supportsImages = params.provider !== 'xai';
            const msgs = params.messages.map((m) => {
              if (supportsImages && m.images?.length) {
                const content: unknown[] = [];
                for (const img of m.images) {
                  content.push({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.base64}` } });
                }
                if (m.content) content.push({ type: 'text', text: m.content });
                return { role: m.role, content };
              }
              return { role: m.role, content: m.content };
            });
            apiResp = await fetch(`${baseUrl}/v1/chat/completions`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ model, stream: true, messages: msgs }),
            });
          }

          if (!apiResp.ok) {
            const errText = await apiResp.text();
            console.error(`[ai-chat] API error (${apiResp.status}):`, errText);
            const sendErr = (event: string, data: string) => { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
            sendErr('text', `API error: ${errText}`);
            sendErr('done', '');
            res.end();
            return;
          }

          const sendChat = (event: string, data: string) => {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
          };

          const reader = apiResp.body!.getReader();
          const decoder = new TextDecoder();
          let buf = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop()!;

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);

                if (params.provider === 'anthropic') {
                  if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                    sendChat('text', parsed.delta.text);
                  }
                } else if (params.provider === 'google') {
                  const parts = parsed.candidates?.[0]?.content?.parts || [];
                  for (const part of parts) {
                    if (part.text) {
                      sendChat('text', part.text);
                    } else if (part.inlineData?.data) {
                      const dataUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                      sendChat('image', dataUrl);
                    }
                  }
                } else {
                  const text = parsed.choices?.[0]?.delta?.content || '';
                  if (text) sendChat('text', text);
                }
              } catch { /* skip unparseable lines */ }
            }
          }
          sendChat('done', '');
        } catch (e) {
          console.error('[ai-chat] Error:', e);
          const sendChat = (event: string, data: string) => {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
          };
          sendChat('text', `\n\nError: ${e instanceof Error ? e.message : 'Unknown error'}`);
          sendChat('done', '');
        }
        res.end();
      });
    },
  };
}

/** ComfyUI integration plugin — workflow file listing + dynamic HTTP proxy. */
function comfyPlugin(): Plugin {
  return {
    name: 'comfy',
    configureServer(server) {
      // List all workflow JSONs from comfy-workflows/ at request time
      server.middlewares.use('/__comfy-workflows', async (req, res) => {
        if (isCrossOriginRequest(req)) { res.writeHead(403); res.end('Cross-origin request rejected'); return; }
        try {
          const fs = await import('node:fs');
          const path = await import('node:path');
          const dir = path.resolve('comfy-workflows');
          let files: string[] = [];
          try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.endsWith('.timing.json')); } catch { files = []; }
          const results: { name: string; filename: string; workflow: unknown }[] = [];
          for (const filename of files) {
            try {
              const text = fs.readFileSync(path.join(dir, filename), 'utf8');
              const workflow = JSON.parse(text);
              const name = filename.replace(/\.json$/, '');
              results.push({ name, filename, workflow });
            } catch (e) {
              console.warn(`[comfy] Failed to parse ${filename}:`, e);
            }
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(results));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }));
        }
      });

      // Per-workflow timing samples — read/write side files in comfy-workflows/.
      // Side file format: { version: 1, samples: { "<dimsKey>": [{duration, ts}, ...] } }
      // Capped at 20 samples per dim key (FIFO).
      server.middlewares.use('/__comfy-timings', async (req, res) => {
        if (isCrossOriginRequest(req)) { res.writeHead(403); res.end('Cross-origin request rejected'); return; }
        try {
          const fs = await import('node:fs');
          const path = await import('node:path');
          const reqUrl = new URL(req.url ?? '', 'http://localhost');
          const name = reqUrl.searchParams.get('name');
          if (!name || /[\\/]/.test(name)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing or invalid name' }));
            return;
          }
          const dir = path.resolve('comfy-workflows');
          const filePath = path.join(dir, `${name}.timing.json`);
          const readFile = () => {
            try {
              const text = fs.readFileSync(filePath, 'utf8');
              const parsed = JSON.parse(text);
              if (!parsed || typeof parsed !== 'object') return { version: 1, samples: {} };
              if (!parsed.samples || typeof parsed.samples !== 'object') parsed.samples = {};
              return parsed;
            } catch {
              return { version: 1, samples: {} };
            }
          };

          if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(readFile()));
            return;
          }

          if (req.method === 'POST') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(Buffer.from(chunk));
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            const dimsKey = String(body.dimsKey ?? '');
            const duration = Number(body.duration);
            if (!dimsKey || !Number.isFinite(duration) || duration <= 0) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid dimsKey or duration' }));
              return;
            }
            const data = readFile();
            const list: { duration: number; ts: number }[] = data.samples[dimsKey] || [];
            list.push({ duration, ts: Date.now() });
            // FIFO cap: keep last 20
            while (list.length > 20) list.shift();
            data.samples[dimsKey] = list;
            try { fs.mkdirSync(dir, { recursive: true }); } catch { /* exists */ }
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
            return;
          }

          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method not allowed' }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }));
        }
      });

      // Dynamic HTTP proxy to user's ComfyUI server (target URL via ?target= query param)
      server.middlewares.use('/__comfy', async (req, res) => {
        if (isCrossOriginRequest(req)) { res.writeHead(403); res.end('Cross-origin request rejected'); return; }
        const reqUrl = new URL(req.url ?? '', 'http://localhost');
        const target = reqUrl.searchParams.get('target');
        if (!target) { res.writeHead(400); res.end('Missing target query param'); return; }
        // Strip the ?target= so it doesn't double-up on the upstream URL
        const subPath = reqUrl.pathname; // e.g. "/prompt", "/upload/image"
        const passQuery = new URLSearchParams(reqUrl.searchParams);
        passQuery.delete('target');
        const queryString = passQuery.toString();
        const upstream = `${target.replace(/\/$/, '')}${subPath}${queryString ? '?' + queryString : ''}`;

        try {
          // Forward the request body verbatim
          let body: Buffer | undefined;
          if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(Buffer.from(chunk));
            body = Buffer.concat(chunks);
          }
          // Strip hop-by-hop headers; pass content-type so multipart works
          const headers: Record<string, string> = {};
          if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'] as string;
          if (req.headers.accept) headers.accept = req.headers.accept as string;

          const upstreamResp = await fetch(upstream, {
            method: req.method ?? 'GET',
            headers,
            body,
          });
          const respHeaders: Record<string, string> = {};
          upstreamResp.headers.forEach((value, key) => {
            // Skip transfer-encoding to let Node handle it
            if (key.toLowerCase() === 'transfer-encoding') return;
            respHeaders[key] = value;
          });
          res.writeHead(upstreamResp.status, respHeaders);
          const buf = Buffer.from(await upstreamResp.arrayBuffer());
          res.end(buf);
        } catch (e) {
          console.error('[comfy] Proxy error:', e);
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Proxy fetch failed' }));
        }
      });
    },
  };
}

/**
 * Auto-generate What's New + version info from git history so the welcome
 * splash never needs manual updates. Commit subjects double as release notes;
 * docs/internal-only commits are filtered out. Falls back to null when git
 * isn't available (ZIP downloads) — the splash then shows its baked-in list.
 */
function buildInfoDefines(): Record<string, string> {
  let notes: { date: string; items: string[] }[] = [];
  let build = '';
  try {
    // %x09 = tab (pretty-format code). The date format is strftime, where %x
    // would mean "locale date" — so the space needs real quoting instead.
    // Scope to this directory — in the monorepo, repo-wide history would pull
    // in unrelated sub-projects' commits.
    const raw = execSync('git log -80 --no-merges --date=format:"%B %Y" --pretty=format:%ad%x09%s -- .', { encoding: 'utf8' });
    const skip = /readme|document\b|call out|^rename |typo|^merge|^wip\b/i;
    const byMonth = new Map<string, string[]>();
    for (const line of raw.split('\n')) {
      const tab = line.indexOf('\t');
      if (tab < 0) continue;
      const date = line.slice(0, tab);
      const subject = line.slice(tab + 1);
      if (!subject || skip.test(subject)) continue;
      if (!byMonth.has(date)) byMonth.set(date, []);
      const items = byMonth.get(date)!;
      if (items.length < 12) items.push(subject);
    }
    notes = Array.from(byMonth, ([date, items]) => ({ date, items })).slice(0, 3);
  } catch { /* not a git checkout */ }
  try {
    build = execSync('git rev-list --count HEAD -- .', { encoding: 'utf8' }).trim();
  } catch { /* not a git checkout */ }
  return {
    __UPDATE_NOTES__: JSON.stringify(notes.length ? notes : null),
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '1.0.0'),
    __BUILD_NUMBER__: JSON.stringify(build || null),
  };
}

export default defineConfig({
  define: buildInfoDefines(),
  plugins: [
    react(), // Must come first - handles JSX transform
    wasm(),
    rundotGameLibrariesPlugin(),
    imageProxyPlugin(),
    aiDirectPlugin(),
    comfyPlugin(),
  ],
  base: './',
  server: {
    allowedHosts: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  // Vite uses esbuild both for transforms and (in dev) dependency prebundling.
  // RUN.game SDK includes top-level await, so we must target an environment that supports it.
  esbuild: {
    target: 'es2022',
  },
  optimizeDeps: {
    exclude: ['@jsquash/oxipng'],
    esbuildOptions: {
      target: 'es2022',
    },
  },
  build: {
    target: 'es2022', // Support top-level await for embedded libraries
  },
});
