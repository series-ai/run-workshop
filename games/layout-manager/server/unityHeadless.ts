import { readFile } from 'node:fs/promises';
import { request as httpRequest, type ServerResponse } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { resolve } from 'node:path';

interface HeadlessModel {
  id: string;
  displayName: string;
  blurb: string;
  modalities: string[];
  caps: string[];
}

/** The CLI embeds literal \\n separators in its pipe-delimited model output. */
export function parseHeadlessModels(output: string): HeadlessModel[] {
  const models = new Map<string, HeadlessModel>();
  for (const line of output.replace(/\\n/g, '\n').split(/\r?\n/)) {
    const separator = line.indexOf(' | ');
    if (separator < 1) continue;
    const id = line.slice(0, separator).trim();
    const description = line.slice(separator + 3).trim();
    const caps = Array.from(description.matchAll(/Supports[A-Za-z0-9]+/g), (m) => m[0]);
    // No upload or size fields in the HTTP API. Do not offer operations that
    // need source images, even if the underlying Unity model supports them.
    if (
      !caps.includes('SupportsTextPrompt') ||
      /upscal|recolor|background.?remov|image-transform/i.test(id)
    )
      continue;
    const modalities = (description.match(/Modalities:\s*([^.]*)/)?.[1] ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value && !value.startsWith('Supports'));
    if (!modalities.some((value) => /^(image|sprite|texture)$/i.test(value))) continue;
    const text = description.replace(/,?\s*Modalities:.*$/, '');
    const comma = text.indexOf(',');
    models.set(id, {
      id,
      displayName: comma < 0 ? text : text.slice(0, comma).trim(),
      blurb: comma < 0 ? '' : text.slice(comma + 1).trim(),
      modalities,
      caps: caps.filter(
        (cap) =>
          ![
            'SupportsImageReference',
            'SupportsEditWithPrompt',
            'SupportsCustomResolutions',
          ].includes(cap),
      ),
    });
  }
  return Array.from(models.values());
}

/** One authenticated factory. Its key never enters browser config or URLs. */
class HeadlessFactory {
  private base: URL;
  private apiKey: string;

  constructor(url: string, apiKey: string) {
    this.base = new URL(url);
    if (
      !['http:', 'https:'].includes(this.base.protocol) ||
      this.base.username ||
      this.base.password ||
      this.base.search ||
      this.base.hash
    ) {
      throw new Error(
        'Headless Unity URL must be HTTP(S), without credentials, query, or fragment.',
      );
    }
    this.apiKey = apiKey.trim();
    if (!this.apiKey) throw new Error('Headless Unity API key is not configured.');
  }

  async request(path: string, signal: AbortSignal, payload?: unknown): Promise<Buffer> {
    const url = new URL(path, this.base);
    if (url.origin !== this.base.origin) throw new Error('Invalid headless Unity response URL.');
    // Native HTTP avoids fetch's five-minute headers timeout: /generate can
    // take 900s, and server-side Editor recovery can extend it further.
    return new Promise((accept, reject) => {
      const body = payload === undefined ? undefined : JSON.stringify(payload);
      const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(
        url,
        {
          method: body === undefined ? 'GET' : 'POST',
          signal,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            ...(body === undefined
              ? {}
              : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }),
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          let size = 0;
          response.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > 64 * 1024 * 1024) {
              request.destroy(new Error('Headless Unity response exceeds 64 MB.'));
              return;
            }
            chunks.push(chunk);
          });
          response.on('error', reject);
          response.on('end', () => {
            const data = Buffer.concat(chunks);
            const status = response.statusCode ?? 502;
            if (status < 200 || status >= 300) {
              let detail = `Headless Unity returned HTTP ${status}.`;
              try {
                const parsed = JSON.parse(data.toString());
                if (typeof parsed.detail === 'string') detail += ` ${parsed.detail}`;
              } catch {
                /* Do not forward arbitrary HTML or proxy responses. */
              }
              reject(new Error(detail.split(this.apiKey).join('[redacted]')));
            } else accept(data);
          });
        },
      );
      const timer = setTimeout(
        () =>
          request.destroy(
            new Error(
              'Headless Unity request timed out. The remote job may still be running; check before retrying.',
            ),
          ),
        payload === undefined ? 210_000 : 35 * 60_000,
      );
      request.on('close', () => clearTimeout(timer));
      request.on('error', reject);
      request.end(body);
    });
  }

  async json(
    path: string,
    signal: AbortSignal,
    payload?: unknown,
  ): Promise<Record<string, unknown>> {
    const bytes = await this.request(path, signal, payload);
    try {
      return JSON.parse(bytes.toString());
    } catch {
      throw new Error('Headless Unity returned invalid JSON.');
    }
  }
}

/** Return false without touching local Editor requests. */
export async function handleUnityHeadless(
  operation: 'status' | 'models' | 'generate',
  params: Record<string, unknown>,
  res: ServerResponse,
  configPath = resolve('.unity-headless.local.json'),
): Promise<boolean> {
  if (params.backend !== 'headless') return false;
  const controller = new AbortController();
  const onClose = () => controller.abort();
  res.on('close', onClose);
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const send = (event: string, data: unknown) => {
    if (!res.destroyed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  try {
    let config: { url: string; apiKey: string };
    try {
      config = JSON.parse(await readFile(configPath, 'utf8'));
    } catch {
      throw new Error(
        'Configure .unity-headless.local.json on the Layout Manager dev server with url and apiKey.',
      );
    }
    if (typeof config.url !== 'string' || typeof config.apiKey !== 'string')
      throw new Error('Headless Unity config requires url and apiKey strings.');
    const factory = new HeadlessFactory(config.url, config.apiKey);
    if (operation === 'generate') {
      const prompt = String(params.prompt ?? '').trim();
      const model = String(params.model ?? '').trim();
      if (
        params.refImage ||
        Number(params.width ?? 0) !== 0 ||
        Number(params.height ?? 0) !== 0 ||
        (params.kind && params.kind !== 'image') ||
        /upscal|recolor|background.?remov|image-transform/i.test(model)
      ) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error:
              'Headless Unity supports prompt-based images only; canvas references, utilities, other asset kinds, and custom sizes are not supported by this integration.',
          }),
        );
        return true;
      }
      if (!prompt || !model) throw new Error('Headless Unity requires a prompt and model.');
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      const started = Date.now();
      const progress = () =>
        send('progress', {
          message: 'Generating on headless Unity (may take several minutes)',
          elapsed: Math.floor((Date.now() - started) / 1000),
        });
      progress();
      heartbeat = setInterval(progress, 10_000);
      const result = await factory.json('/generate', controller.signal, {
        kind: 'image',
        prompt,
        model,
        remove_bg: false,
      });
      const downloads = Array.isArray(result.download)
        ? result.download.filter(
            (path): path is string => typeof path === 'string' && /\.png$/i.test(path),
          )
        : [];
      if (!downloads.length) throw new Error('Headless Unity returned no PNG images.');
      for (const path of downloads) {
        if (!/^\/exports\/[a-zA-Z0-9_./-]+\.png$/i.test(path) || path.split('/').includes('..'))
          throw new Error('Invalid headless Unity export path.');
        const image = await factory.request(path, controller.signal);
        if (!image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
          throw new Error('Headless Unity export is not a PNG image.');
        send('image', { dataUrl: `data:image/png;base64,${image.toString('base64')}` });
      }
      send('done', {});
      res.end();
    } else if (operation === 'status') {
      const health = await factory.json('/health', controller.signal);
      if (health.editor_connected !== true)
        throw new Error('Headless Unity Editor is not connected.');
      const ready = await factory.json('/ready', controller.signal);
      if (ready.session_valid !== true)
        throw new Error(
          ready.expired_session === true
            ? 'Headless Unity session has expired. The service can recover on generation; ask its operator to restore readiness before retrying here.'
            : 'Headless Unity session is not ready (Editor may be busy or restarting). Re-check shortly.',
        );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ up: true, backend: 'headless', project: config.url }));
    } else {
      const catalog = await factory.json('/models?kind=image', controller.signal);
      const models = parseHeadlessModels(typeof catalog.output === 'string' ? catalog.output : '');
      if (!models.length)
        throw new Error(
          'Headless Unity returned no supported image models. Re-check the Editor session.',
        );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ models }));
    }
  } catch (error) {
    if (!res.destroyed) {
      const message = error instanceof Error ? error.message : 'Headless Unity request failed.';
      if (res.headersSent) {
        send('error', { error: message });
        send('done', {});
        res.end();
      } else {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ up: false, error: message }));
      }
    }
  } finally {
    clearInterval(heartbeat);
    res.off('close', onClose);
  }
  return true;
}
