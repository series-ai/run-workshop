/**
 * Direct AI API client — talks to Vite plugins that proxy to Google GenAI and OpenAI.
 */
import type { UserConfig } from '../userConfig';

export interface AiConfig {
  apiKeys?: Pick<UserConfig, 'googleGenaiApiKey' | 'openaiApiKey' | 'xaiApiKey' | 'anthropicApiKey'>;
}

export interface StreamCallbacks {
  onImage: (dataUrl: string) => Promise<void>;
  onProgress?: (msg: string) => void;
  onError?: (error: string) => void;
  onDone?: () => void;
  onCancelled?: () => void;
}

/** Cancel all in-flight direct API requests. */
export function cancelGeneration(): void {
  fetch('/__ai-cancel').then(() => console.log('[ai] Cancel requested')).catch(() => {});
}

/** Convert a blob URL or object URL to a base64 string (no data URL prefix). */
async function blobUrlToBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  if (url.startsWith('data:')) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (match) return { base64: match[2]!, mimeType: match[1]! };
  }
  const resp = await fetch(url);
  const blob = await resp.blob();
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  const idx = dataUrl.indexOf(',');
  const base64 = idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
  const mimeType = dataUrl.match(/data:([^;]+)/)?.[1] || blob.type || 'image/png';
  return { base64, mimeType };
}

/** Read an SSE stream and dispatch to callbacks. */
async function consumeSSE(resp: Response, callbacks: StreamCallbacks): Promise<void> {
  if (!resp.ok || !resp.body) {
    let msg = `Request failed: ${resp.status}`;
    try {
      const json = await resp.json();
      msg = json.error || msg;
    } catch {
      try { msg = await resp.text() || msg; } catch { /* ignore */ }
    }
    throw new Error(msg);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const pendingLoads: Promise<void>[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop()!;

    for (const part of parts) {
      let event = '';
      let data = '';
      for (const line of part.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7);
        else if (line.startsWith('data: ')) data = line.slice(6);
      }
      if (!event || !data) continue;

      try {
        const parsed = JSON.parse(data);
        console.log(`[ai] SSE ${event}:`, parsed);

        switch (event) {
          case 'image':
            pendingLoads.push(callbacks.onImage(parsed.dataUrl));
            break;
          case 'progress':
            callbacks.onProgress?.(`Generating... (${parsed.saved} saved)`);
            break;
          case 'error':
            callbacks.onError?.(parsed.error);
            break;
          case 'cancelled':
            callbacks.onCancelled?.();
            return;
          case 'done':
            await Promise.all(pendingLoads);
            callbacks.onDone?.();
            return;
        }
      } catch (e) {
        console.warn('[ai] Failed to parse SSE data:', data, e);
      }
    }
  }
}

/** Generate images from a text prompt. Routes to the right provider. */
export async function textToImage(
  config: AiConfig,
  params: {
    prompt: string;
    api?: string; // 'nano-banana' | 'nano-banana-lite' | 'gpt-image' | 'gpt-image-2'
    aspectRatio?: string;
    imageSize?: '1K' | '2K' | '4K';     // Google only
    size?: string;                       // OpenAI only — flexible (gpt-image-2 supports 2K)
    quality?: 'low' | 'medium' | 'high'; // OpenAI only
    background?: 'transparent' | 'opaque' | 'auto'; // OpenAI gpt-image-1 only
    refImages?: string[];
    count?: number;
    seed?: number;
  },
  callbacks: StreamCallbacks,
): Promise<void> {
  const api = params.api || 'nano-banana';
  callbacks.onProgress?.('Starting generation...');

  // Convert any blob URLs to base64
  let referenceImages: { base64: string; mimeType?: string }[] | undefined;
  if (params.refImages && params.refImages.length > 0) {
    callbacks.onProgress?.('Preparing reference images...');
    referenceImages = await Promise.all(params.refImages.map(blobUrlToBase64));
  }

  if (api === 'nano-banana' || api === 'nano-banana-lite') {
    const apiKey = config.apiKeys?.googleGenaiApiKey;
    if (!apiKey) throw new Error('Missing Google GenAI API key');
    const resp = await fetch('/__ai-generate-google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        model: api === 'nano-banana-lite' ? 'gemini-3.1-flash-lite-image' : undefined,
        prompt: params.prompt,
        aspectRatio: params.aspectRatio,
        imageSize: params.imageSize || '1K',
        count: params.count || 1,
        referenceImages,
        seed: params.seed,
      }),
    });
    await consumeSSE(resp, callbacks);
  } else if (api === 'gpt-image' || api === 'gpt-image-2') {
    const apiKey = config.apiKeys?.openaiApiKey;
    if (!apiKey) throw new Error('Missing OpenAI API key');
    const resp = await fetch('/__ai-generate-openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        model: api === 'gpt-image-2' ? 'gpt-image-2' : 'gpt-image-1',
        prompt: params.prompt,
        size: params.size || '1024x1024',
        quality: params.quality || 'medium',
        background: params.background,
        count: params.count || 1,
        referenceImages,
      }),
    });
    await consumeSSE(resp, callbacks);
  } else {
    throw new Error(`Unsupported text-to-image provider: ${api}`);
  }
}

