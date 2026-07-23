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
          res.writeHead(resp.ok ? 200 : resp.status, { 'Content-Type': contentType, 'Cache-Control': 'max-age=3600' });
          const buffer = Buffer.from(await resp.arrayBuffer());
          res.end(buffer);
        } catch {
          res.writeHead(502); res.end('Fetch failed');
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
            const isLocal = params.provider === 'kobold' || params.provider === 'ollama';
            let baseUrl: string;
            let model = params.model;
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (isLocal) {
              let url = (params.localUrl || '').trim()
                || (params.provider === 'kobold' ? 'http://127.0.0.1:5001' : 'http://127.0.0.1:11434');
              if (!/^https?:\/\//i.test(url)) url = 'http://' + url;
              // 0.0.0.0 is a listen address, not a connect address
              baseUrl = url.replace(/\/+$/, '').replace('//0.0.0.0', '//127.0.0.1');
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
