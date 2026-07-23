import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { UserConfig } from '../userConfig';
import type { ImageNode } from '../types';
import { useDraggableModal } from './useDraggableModal';
import { flattenNode } from './flattenNode';

interface TextToImageModalProps {
  config: UserConfig;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  refNodes: ImageNode[];
  position?: { top: number; left: number };
  onGenerated: (imageUrl: string, width: number, height: number, prompts: { title: string; text: string }[], batchIndex: number) => void;
  onProgress: (progress: { message: string; progress?: number } | null) => void;
  onClose: () => void;
}

const PROVIDERS = [
  { id: 'nano-banana', label: 'Nano Banana', configKey: 'googleGenaiApiKey' as keyof UserConfig },
  { id: 'nano-banana-lite', label: 'Nano Banana 2 Lite', configKey: 'googleGenaiApiKey' as keyof UserConfig },
  { id: 'gpt-image', label: 'GPT Image 1', configKey: 'openaiApiKey' as keyof UserConfig },
  { id: 'gpt-image-2', label: 'GPT Image 2', configKey: 'openaiApiKey' as keyof UserConfig },
] as const;

type ProviderId = (typeof PROVIDERS)[number]['id'];

const GOOGLE_ASPECT_RATIOS = ['1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16'] as const;
const GOOGLE_IMAGE_SIZES = ['1K', '2K', '4K'] as const;
const OPENAI_SIZES = [
  { label: 'Square', value: '1024x1024' },
  { label: 'Portrait', value: '1024x1536' },
  { label: 'Landscape', value: '1536x1024' },
] as const;
const OPENAI_V2_SIZES = [
  { label: 'Square', value: '1024x1024' },
  { label: 'Portrait', value: '1024x1536' },
  { label: 'Landscape', value: '1536x1024' },
  { label: '2K Square', value: '2048x2048' },
  { label: '2K Landscape', value: '2048x1152' },
  { label: '2K Portrait', value: '1152x2048' },
] as const;
const OPENAI_QUALITIES = ['low', 'medium', 'high'] as const;

export function TextToImageModal({ config, prompt, onPromptChange, refNodes, position, onGenerated, onProgress, onClose }: TextToImageModalProps) {
  const { panelRef, onPointerDown, onPointerMove, onPointerUp } = useDraggableModal();
  const [providerId, setProviderId] = useState<ProviderId>(() => {
    const found = PROVIDERS.find((p) => config[p.configKey]);
    return (found?.id ?? PROVIDERS[0]!.id) as ProviderId;
  });
  const [count, setCount] = useState(1);
  // Google params
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  // OpenAI params (shared across gpt-image-1 and gpt-image-2; v2 also allows 2K values)
  const [openaiSize, setOpenaiSize] = useState<string>('1024x1024');
  const [openaiQuality, setOpenaiQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [transparentBg, setTransparentBg] = useState(false);

  const isGoogle = providerId === 'nano-banana' || providerId === 'nano-banana-lite';
  const isOpenAi = providerId === 'gpt-image' || providerId === 'gpt-image-2';
  const isOpenAiV2 = providerId === 'gpt-image-2';

  const [generating, setGenerating] = useState(false);

  const clampedRefs = refNodes.slice(0, 5);
  const hasRefs = clampedRefs.length > 0;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const imageCount = useRef(0);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || generating) return;
    const provider = PROVIDERS.find((p) => p.id === providerId);
    if (provider && !config[provider.configKey]) {
      alert(`Add your ${provider.label} API key in Preferences > AI to use this feature.`);
      return;
    }
    setGenerating(true);
    imageCount.current = 0;
    onProgress({ message: 'Starting generation...' });
    try {
      const { textToImage } = await import('./aiClient');

      let refImages: string[] | undefined;
      if (hasRefs) {
        onProgress({ message: 'Preparing reference images...' });
        refImages = await Promise.all(clampedRefs.map(flattenNode));
      }

      await textToImage(
        { apiKeys: config },
        {
          prompt: prompt.trim(),
          api: providerId,
          aspectRatio: isGoogle ? aspectRatio : undefined,
          imageSize: isGoogle ? imageSize : undefined,
          size: isOpenAi ? openaiSize : undefined,
          quality: isOpenAi ? openaiQuality : undefined,
          // gpt-image-2 does not support transparent backgrounds; only send for v1
          background: providerId === 'gpt-image' && transparentBg ? 'transparent' : undefined,
          refImages,
          count,
        },
        {
          onImage: async (dataUrl) => {
            imageCount.current++;
            onProgress({ message: `Loading image ${imageCount.current}${count > 1 ? `/${count}` : ''}...` });
            try {
              const img = await new Promise<HTMLImageElement>((resolve) => {
                const el = new Image();
                el.onload = () => resolve(el);
                el.src = dataUrl;
              });
              const trimmed = prompt.trim();
              onGenerated(dataUrl, img.naturalWidth, img.naturalHeight, trimmed ? [{ title: 'Prompt', text: trimmed }] : [], imageCount.current - 1);
            } catch (e) {
              console.error('[ai] Failed to load image:', e);
            }
          },
          onProgress: (msg) => onProgress({ message: msg }),
          onError: (error) => alert(`Generation failed: ${error}`),
          onDone: () => {
            onProgress(null);
            setGenerating(false);
            import('./completionSound').then((m) => m.playCompletionSound());
          },
          onCancelled: () => {
            onProgress(null);
            setGenerating(false);
          },
        },
      );
    } catch (e) {
      onProgress(null);
      alert(`Generation failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
      setGenerating(false);
    }
  }, [prompt, providerId, count, aspectRatio, imageSize, openaiSize, openaiQuality, transparentBg, generating, config, hasRefs, clampedRefs, onGenerated, onProgress, isGoogle, isOpenAi]);

  // Compute output dimensions hint
  let outputHint = '';
  if (isGoogle) {
    const longSide = imageSize === '4K' ? 4096 : imageSize === '2K' ? 2048 : 1024;
    const [aw, ah] = aspectRatio.split(':').map(Number) as [number, number];
    if (aw >= ah) {
      const w = longSide;
      const h = Math.round(longSide * (ah / aw));
      outputHint = `Output: ${w} × ${h}`;
    } else {
      const h = longSide;
      const w = Math.round(longSide * (aw / ah));
      outputHint = `Output: ${w} × ${h}`;
    }
  } else {
    outputHint = `Output: ${openaiSize}`;
  }

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
        <h2>Text to Image / Reference to Image</h2>
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
            {PROVIDERS.map((p) => {
              const hasKey = !!config[p.configKey];
              return (
                <button
                  key={p.id}
                  className={`ai-modal-ratio-btn${p.id === providerId ? ' ai-modal-ratio-btn-active' : ''}${!hasKey ? ' ai-modal-ratio-btn-disabled' : ''}`}
                  onClick={() => {
                    if (!hasKey) return;
                    setProviderId(p.id as ProviderId);
                    // When leaving gpt-image-2, fall back to a v1-compatible size if needed
                    if (p.id !== 'gpt-image-2' && !OPENAI_SIZES.some((s) => s.value === openaiSize)) {
                      setOpenaiSize('1024x1024');
                    }
                  }}
                  title={hasKey ? p.label : 'Needs API key'}
                  disabled={!hasKey}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </label>

        <label className="ai-modal-label">
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
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleGenerate(); } }}
            placeholder="Describe the image you want to generate..."
            rows={4}
            autoFocus
          />
        </label>

        {hasRefs ? (
          <label className="ai-modal-label">
            References ({clampedRefs.length}/5)
            {refNodes.length > 5 && (
              <span className="ai-modal-size-hint">Only the first 5 selected images are used</span>
            )}
            <div className="ai-modal-ref-grid">
              {clampedRefs.map((node) => (
                <img
                  key={node.id}
                  src={node.paintCompositeUrl || node.src}
                  alt={node.fileName}
                  className="ai-modal-ref-thumb"
                  title={node.fileName}
                />
              ))}
            </div>
          </label>
        ) : null}

        {/* Provider-specific size controls */}
        {isGoogle ? (
          <>
            <label className="ai-modal-label">
              Aspect Ratio
              <div className="ai-modal-ratio-row">
                {GOOGLE_ASPECT_RATIOS.map((r) => (
                  <button
                    key={r}
                    className={`ai-modal-ratio-btn${r === aspectRatio ? ' ai-modal-ratio-btn-active' : ''}`}
                    onClick={() => setAspectRatio(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </label>

            <label className="ai-modal-label">
              Image Size
              <div className="ai-modal-ratio-row">
                {GOOGLE_IMAGE_SIZES.map((s) => (
                  <button
                    key={s}
                    className={`ai-modal-ratio-btn${s === imageSize ? ' ai-modal-ratio-btn-active' : ''}`}
                    onClick={() => setImageSize(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </label>
          </>
        ) : (
          <>
            <label className="ai-modal-label">
              Size
              <div className="ai-modal-ratio-row">
                {(isOpenAiV2 ? OPENAI_V2_SIZES : OPENAI_SIZES).map((s) => (
                  <button
                    key={s.value}
                    className={`ai-modal-ratio-btn${s.value === openaiSize ? ' ai-modal-ratio-btn-active' : ''}`}
                    onClick={() => setOpenaiSize(s.value)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </label>

            <label className="ai-modal-label">
              Quality
              <div className="ai-modal-ratio-row">
                {OPENAI_QUALITIES.map((q) => (
                  <button
                    key={q}
                    className={`ai-modal-ratio-btn${q === openaiQuality ? ' ai-modal-ratio-btn-active' : ''}`}
                    onClick={() => setOpenaiQuality(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </label>

            {!isOpenAiV2 && (
              <label className="ai-chat-auto-describe">
                <input type="checkbox" checked={transparentBg} onChange={(e) => setTransparentBg(e.target.checked)} />
                Transparent background
              </label>
            )}
          </>
        )}

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
          />
        </label>

        <span className="ai-modal-size-hint">{outputHint}</span>
      </div>

      <div className="prefs-footer">
        <button className="prefs-btn prefs-btn-secondary" onClick={onClose} disabled={generating}>
          Cancel
        </button>
        <button
          className="prefs-btn prefs-btn-primary"
          onClick={handleGenerate}
          disabled={!prompt.trim() || generating}
        >
          {generating ? 'Generating...' : 'Generate'}
        </button>
      </div>
    </div>,
    document.body,
  );
}
