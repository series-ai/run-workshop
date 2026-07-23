import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { UserConfig } from '../userConfig';
import { useDraggableModal } from './useDraggableModal';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
}

interface AiChatPanelProps {
  config: UserConfig;
  messages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
  providerId: string;
  onProviderChange: (id: string) => void;
  selectedImageUrls: string[];
  rulersVisible: boolean;
  onDragged?: () => void;
  onClose: () => void;
}

const PROVIDERS = [
  { id: 'anthropic', label: 'Claude', configKey: 'anthropicApiKey' as keyof UserConfig, model: 'claude-sonnet-4-20250514', noImages: false },
  // Uses the local Claude Code CLI with a claude.ai Pro/Max login — no API key.
  { id: 'claude-account', label: 'Claude Code', configKey: null, model: '', noImages: true },
  // Local LLM servers — no API keys; URLs configurable in Preferences > AI
  { id: 'kobold', label: 'KoboldCpp', configKey: null, model: '', noImages: false },
  { id: 'ollama', label: 'Ollama', configKey: null, model: '', noImages: false },
  { id: 'google', label: 'Gemini', configKey: 'googleGenaiApiKey' as keyof UserConfig, model: 'gemini-2.5-flash', noImages: false },
  { id: 'openai', label: 'OpenAI', configKey: 'openaiApiKey' as keyof UserConfig, model: 'gpt-4o', noImages: false },
  { id: 'xai', label: 'Grok', configKey: 'xaiApiKey' as keyof UserConfig, model: 'grok-3-mini', noImages: true },
] as const;

export function AiChatPanel({ config, messages, onMessagesChange, providerId, onProviderChange, selectedImageUrls, rulersVisible, onDragged, onClose }: AiChatPanelProps) {
  const { panelRef, onPointerDown, onPointerMove, onPointerUp } = useDraggableModal();
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const setMessages = useCallback((update: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    if (typeof update === 'function') {
      onMessagesChange(update(messagesRef.current));
    } else {
      onMessagesChange(update);
    }
  }, [onMessagesChange]);
  const [input, setInputRaw] = useState('');
  const [autoDescribe, setAutoDescribe] = useState(true);
  const setInput = useCallback((v: string) => {
    setInputRaw(v);
    if (v.trim()) setAutoDescribe(false);
  }, []);
  const [streaming, setStreaming] = useState(false);
  const setProviderId = onProviderChange;
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const currentProvider = PROVIDERS.find((p) => p.id === providerId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const handleImageAttach = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      if (!file.type.startsWith('image/')) continue;
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedImages((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) {
      handleImageAttach(e.dataTransfer.files);
    }
  }, [handleImageAttach]);

  const handleSend = useCallback(async () => {
    if ((!input.trim() && attachedImages.length === 0) || streaming) return;

    const provider = PROVIDERS.find((p) => p.id === providerId);
    if (provider?.configKey && !config[provider.configKey]) {
      alert(`Add your ${provider.label} API key in Preferences > AI to use chat.`);
      return;
    }

    // If images attached with no text and auto-describe is on, add generation prompt
    let messageText = input.trim();
    if (!messageText && attachedImages.length > 0 && autoDescribe) {
      messageText = 'Describe this image in a way that could be used as a prompt for AI image generation. Be literal and specific about the subject, composition, colors, lighting, and style. If the image has a transparent background, do not mention transparency — describe it as a simple flat background instead. No extra commentary.';
    }

    // Convert any blob/object URLs to data URLs before storing
    const resolvedImages: string[] = [];
    for (const img of attachedImages) {
      if (img.startsWith('data:')) {
        resolvedImages.push(img);
      } else {
        // blob: or http: URL — fetch and convert
        try {
          const resp = await fetch(img);
          const blob = await resp.blob();
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          resolvedImages.push(dataUrl);
        } catch {
          console.warn('[ai-chat] Failed to convert image:', img);
        }
      }
    }

    const userMsg: ChatMessage = {
      role: 'user',
      content: messageText,
      images: resolvedImages.length > 0 ? resolvedImages : undefined,
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputRaw('');
    setAttachedImages([]);
    setAutoDescribe(true);
    setStreaming(true);

    // Add placeholder for assistant response
    setMessages([...newMessages, { role: 'assistant', content: '' }]);

    try {
      const apiKey = provider?.configKey ? (config[provider.configKey] as string) : '';
      const abort = new AbortController();
      abortRef.current = abort;
      const resp = await fetch('/__ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abort.signal,
        body: JSON.stringify({
          provider: providerId,
          model: providerId === 'ollama' ? (config.ollamaModel || '') : provider?.model,
          localUrl: providerId === 'kobold' ? config.koboldUrl
            : providerId === 'ollama' ? config.ollamaUrl
            : undefined,
          apiKey,
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
            images: provider?.noImages ? undefined : m.images?.map((img) => {
              const idx = img.indexOf(',');
              const b64 = idx >= 0 ? img.slice(idx + 1) : img;
              // Detect actual mime type from data URL or base64 magic bytes
              let mimeType = img.match(/data:([^;]+)/)?.[1] || '';
              if (!mimeType || mimeType === 'application/octet-stream') {
                if (b64.startsWith('/9j/')) mimeType = 'image/jpeg';
                else if (b64.startsWith('iVBOR')) mimeType = 'image/png';
                else if (b64.startsWith('R0lGO')) mimeType = 'image/gif';
                else if (b64.startsWith('UklGR')) mimeType = 'image/webp';
                else mimeType = 'image/png';
              }
              return { base64: b64, mimeType };
            }),
          })),
        }),
      });

      if (!resp.ok || !resp.body) {
        const text = await resp.text();
        throw new Error(text || `Chat failed: ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let fullText = '';
      const responseImages: string[] = [];

      while (true) {
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
          try {
            const parsed = JSON.parse(data);
            if (event === 'text') {
              fullText += parsed;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: fullText, images: responseImages.length > 0 ? [...responseImages] : undefined };
                return updated;
              });
            } else if (event === 'image') {
              responseImages.push(parsed);
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: fullText, images: [...responseImages] };
                return updated;
              });
            } else if (event === 'done') {
              break;
            }
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        // User cancelled — keep whatever we have so far
      } else {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: `Error: ${e instanceof Error ? e.message : 'Unknown error'}` };
          return updated;
        });
      }
    }
    abortRef.current = null;
    setStreaming(false);
    textareaRef.current?.focus();
  }, [input, attachedImages, messages, streaming, providerId, config, autoDescribe]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  return createPortal(
    <div
      className="prefs-dialog ai-modal ai-modal-container ai-chat-panel"
      ref={panelRef}
      style={{ top: rulersVisible ? 80 : 60, left: rulersVisible ? 28 : 8 }}
      onKeyDown={(e) => e.stopPropagation()}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <div
        className="ai-modal-drag-header"
        onPointerDown={onPointerDown}
        onPointerMove={(e) => { onPointerMove(e); if (onDragged) onDragged(); }}
        onPointerUp={onPointerUp}
      >
        <div className="grab-bar" />
      </div>
      <div className="prefs-header">
        <h2>AI Chat</h2>
        <button className="prefs-close" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Provider picker + new chat */}
      <div className="ai-chat-providers">
        {messages.length > 0 && (
          <button
            className="ai-chat-new-btn"
            onClick={() => { setMessages([]); setInput(''); setAttachedImages([]); }}
            title="New chat"
            disabled={streaming}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Chat
          </button>
        )}
        <div className="ai-chat-providers-right">
        {PROVIDERS.map((p) => {
          const hasKey = p.configKey ? !!config[p.configKey] : true;
          const title = !hasKey ? 'Needs API key'
            : p.id === 'claude-account' ? 'Chats through your locally installed Claude Code CLI using its login (text only, tools disabled)'
            : p.id === 'kobold' ? 'Local KoboldCpp server — set the URL in Preferences > AI'
            : p.id === 'ollama' ? 'Local Ollama server — set URL and model in Preferences > AI'
            : p.label;
          return (
            <button
              key={p.id}
              className={`ai-modal-ratio-btn${p.id === providerId ? ' ai-modal-ratio-btn-active' : ''}${!hasKey ? ' ai-modal-ratio-btn-disabled' : ''}`}
              onClick={() => hasKey && setProviderId(p.id)}
              title={title}
              disabled={!hasKey}
            >
              {p.label}
            </button>
          );
        })}
        </div>
      </div>

      {/* Claude Code provider disclaimer */}
      {providerId === 'claude-account' && (
        <div className="ai-chat-disclaimer">
          Runs through your local Claude Code CLI and its login — usage counts against
          your Claude Pro/Max limits (shared with claude.ai and Claude Code). Text only,
          no images, no model choice, and replies may start a bit slower than API providers.
        </div>
      )}

      {/* Messages */}
      <div className="ai-chat-messages">
        {messages.length === 0 && (
          <div className="ai-chat-empty">
            Ask me anything. Drag in images for visual context.
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`ai-chat-msg ai-chat-msg-${msg.role}`}>
            {msg.images && msg.images.length > 0 && (
              <div className="ai-chat-msg-images">
                {msg.images.map((img, j) => (
                  <img key={j} src={img} className="ai-chat-msg-thumb" alt="" />
                ))}
              </div>
            )}
            <div className="ai-chat-msg-text">
              {msg.content || (msg.role === 'assistant' && streaming && i === messages.length - 1 ? '...' : '')}
            </div>
            {msg.role === 'assistant' && msg.content && (
              <button className="ai-chat-copy" onClick={() => handleCopy(msg.content)} title="Copy to clipboard">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              </button>
            )}
            {msg.role === 'user' && msg.content && (
              <button className="ai-chat-reuse" onClick={() => { setInput(msg.content); if (msg.images?.length) setAttachedImages(msg.images); textareaRef.current?.focus(); }} title="Edit and resend">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Attached images preview */}
      {attachedImages.length > 0 && (
        <div className="ai-chat-attachments">
          {currentProvider?.noImages && (
            <span className="ai-chat-img-warn">{currentProvider.label} does not support images — they will be ignored</span>
          )}
          {attachedImages.map((img, i) => (
            <div key={i} className="ai-chat-attach-thumb-wrap">
              <img src={img} className="ai-chat-attach-thumb" alt="" />
              <button className="ai-chat-attach-remove" onClick={() => setAttachedImages((prev) => prev.filter((_, j) => j !== i))}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      {selectedImageUrls.length > 0 && !currentProvider?.noImages && (
        <button
          className="ai-chat-use-selected"
          onClick={() => setAttachedImages((prev) => [...prev, ...selectedImageUrls])}
        >
          + {selectedImageUrls.length} selected image{selectedImageUrls.length > 1 ? 's' : ''}
        </button>
      )}
      {attachedImages.length > 0 && !input.trim() && (
        <label className="ai-chat-auto-describe">
          <input type="checkbox" checked={autoDescribe} onChange={(e) => setAutoDescribe(e.target.checked)} />
          Auto-describe for image generation
        </label>
      )}
      <div className="ai-chat-input-row">
        {!currentProvider?.noImages && <button className="ai-chat-attach-btn" onClick={() => fileInputRef.current?.click()} title="Attach image">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </button>}
        <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { if (e.target.files) handleImageAttach(e.target.files); e.target.value = ''; }} />
        <textarea
          ref={textareaRef}
          className="ai-chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Type a message... (Shift+Enter for new line)"
          rows={1}
          autoFocus
        />
        {streaming ? (
          <button className="ai-chat-send ai-chat-stop" onClick={handleStop} title="Stop">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        ) : (
          <button className="ai-chat-send" onClick={handleSend} disabled={!input.trim() && attachedImages.length === 0}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
