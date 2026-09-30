import { useEffect, useState } from 'react';
import './Hud.css';
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
      className="yard-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div className="yard-plate yard-modal__card">
        <div className="yard-modal__stripe" aria-hidden="true" />
        <div className="yard-modal__head">
          <span className="yard-modal__badge" aria-hidden="true"><span>!</span></span>
          <div className="yard-modal__text">
            <div id="wreck-yard-error-title" className="yard-modal__title">{details.title}</div>
            <div className="yard-modal__message">{details.message}</div>
          </div>
          <button type="button" aria-label="Dismiss error modal" className="yard-modal__close" onClick={onDismiss}>✕</button>
        </div>

        <details className="yard-modal__details">
          <summary>Technical Details</summary>
          <pre>
            {details.technical}
            {details.code ? `\nCode: ${details.code}` : ''}
            {details.roomCode ? `\nRoom: ${details.roomCode}` : ''}
          </pre>
          <button type="button" className="yard-modal__copy" onClick={copyDetails}>
            {copied ? 'Copied!' : 'Copy error'}
          </button>
        </details>

        <div className="yard-modal__actions">
          <button type="button" className="yard-button" onClick={onDismiss}>Dismiss</button>
          <button type="button" className={details.isServerError ? 'yard-button' : 'yard-button yard-button--primary'} onClick={onRetry}>Retry</button>
          {details.isServerError ? (
            <button type="button" className="yard-button yard-button--primary" onClick={onPlaySolo}>Play Solo (Offline)</button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
