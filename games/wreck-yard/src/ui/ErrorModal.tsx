import { useEffect, useState } from 'react';
import type { MatchErrorDetails } from '../game/match';

export interface ErrorModalProps {
  readonly details: MatchErrorDetails;
  readonly onPlaySolo: () => void;
  readonly onRetry: () => void;
  readonly onDismiss: () => void;
}

export function ErrorModal({ details, onPlaySolo, onRetry, onDismiss }: ErrorModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  const copyDetails = async () => {
    try {
      const text = [
        `Title: ${details.title}`,
        details.code ? `Code: ${details.code}` : null,
        details.roomCode ? `Room: ${details.roomCode}` : null,
        `Message: ${details.message}`,
        `Technical: ${details.technical}`,
      ]
        .filter(Boolean)
        .join('\n');
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write failed; non-fatal
    }
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="wreck-yard-error-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(10, 12, 10, 0.78)',
        backdropFilter: 'blur(8px)',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: '#191d16',
          border: '1px solid #4a5440',
          borderRadius: 12,
          padding: '22px 24px',
          color: '#e8ecd8',
          font: '13px/1.5 ui-sans-serif, system-ui, sans-serif',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: 'rgba(255, 120, 100, 0.14)',
              border: '1px solid rgba(255, 120, 100, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: '#ff9c8a',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div
              id="wreck-yard-error-title"
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: '#f4f7ee',
                marginBottom: 4,
                letterSpacing: '-0.01em',
              }}
            >
              {details.title}
            </div>
            <div style={{ color: '#c4ccb6', fontSize: 13, lineHeight: 1.5 }}>
              {details.message}
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss error modal"
            onClick={onDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8f9884',
              cursor: 'pointer',
              padding: 4,
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <details
          style={{
            marginBottom: 20,
            background: '#121510',
            border: '1px solid #2d3625',
            borderRadius: 8,
            padding: '8px 12px',
          }}
        >
          <summary
            style={{
              cursor: 'pointer',
              color: '#9ba88d',
              fontSize: 12,
              fontWeight: 600,
              outline: 'none',
              userSelect: 'none',
            }}
          >
            Technical Details
          </summary>
          <div
            style={{
              marginTop: 8,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: 11,
              lineHeight: 1.5,
              color: '#ff9c8a',
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
            }}
          >
            {details.technical}
            {details.code ? `\nCode: ${details.code}` : ''}
            {details.roomCode ? `\nRoom: ${details.roomCode}` : ''}
          </div>
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={copyDetails}
              style={{
                background: 'transparent',
                border: '1px solid #4a5440',
                borderRadius: 4,
                color: '#b6c0a8',
                fontSize: 11,
                padding: '3px 8px',
                cursor: 'pointer',
              }}
            >
              {copied ? 'Copied!' : 'Copy error'}
            </button>
          </div>
        </details>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onDismiss}
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              border: '1px solid #4a5440',
              background: 'transparent',
              color: '#b6c0a8',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={onRetry}
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              border: '1px solid #6d7a62',
              background: '#2c3320',
              color: '#e8ecd8',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Retry
          </button>
          {details.isServerError ? (
            <button
              type="button"
              onClick={onPlaySolo}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid #b2d718',
                background: '#9bbc0f',
                color: '#101408',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              Play Solo (Offline)
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
