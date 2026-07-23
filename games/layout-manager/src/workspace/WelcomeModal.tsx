import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FolderOpen, FilePlus2, X, Star } from 'lucide-react';

const VERSION = __APP_VERSION__;
const BUILD = __BUILD_NUMBER__;

const PRESETS: { label: string; w: number; h: number }[] = [
  { label: '512 × 512', w: 512, h: 512 },
  { label: '1024 × 1024', w: 1024, h: 1024 },
  { label: '1920 × 1080', w: 1920, h: 1080 },
  { label: '1080 × 1920', w: 1080, h: 1920 },
  { label: '2048 × 2048', w: 2048, h: 2048 },
];

/** Fallback for ZIP downloads without git — git checkouts auto-generate notes from commit history. */
const FALLBACK_NOTES: { date: string; items: string[] }[] = [
  {
    date: 'July 2026',
    items: [
      'This welcome screen — new page presets, update notes, run.world branding',
      'Image adjustments — brightness / contrast / saturation / hue sliders on elements and paint layers, non-destructive until you bake',
      'JPG and WebP export with a quality slider',
      'Google Fonts for text elements and paint text layers',
      'Paint text boxes are resizable while editing, and applying uncommitted text no longer loses it',
      'Free Memory button in the MEM popover — clears undo history to release deleted images',
      'Local LLM chat — KoboldCpp and Ollama providers, plus Claude Code (no API key)',
      'Save now updates your .layout file in place instead of downloading a copy',
      'Right-click spellcheck in AI chat and prompt fields',
      'Ctrl+Arrow alignment only considers selected elements',
      'Drag-and-drop fixes: multi-folder drops, file:// URIs, and clearer diagnostics',
    ],
  },
];

const UPDATE_NOTES = __UPDATE_NOTES__ ?? FALLBACK_NOTES;

interface WelcomeModalProps {
  onClose: () => void;
  /** null = empty workspace with no page */
  onNewFromPreset: (size: { w: number; h: number } | null) => void;
  onOpenProject: () => void;
  showOnStartup: boolean;
  onShowOnStartupChange: (v: boolean) => void;
}

export function WelcomeModal({ onClose, onNewFromPreset, onOpenProject, showOnStartup, onShowOnStartupChange }: WelcomeModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="welcome-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="welcome-panel" onPointerDown={(e) => e.stopPropagation()}>
        <div className="welcome-banner">
          <div className="welcome-banner-text">
            <h1>Layout Manager</h1>
            <span className="welcome-banner-sub">image layout · paint · AI workspace</span>
          </div>
          <span className="welcome-banner-version">v{VERSION}{BUILD ? ` · build ${BUILD}` : ''}</span>
          <button className="welcome-close" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>

        <div className="welcome-body">
          <div className="welcome-start">
            <div className="welcome-section-title"><FilePlus2 size={13} /> New Page</div>
            <div className="welcome-presets">
              <button
                className="welcome-preset-btn"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => { onNewFromPreset(null); onClose(); }}
              >
                <Star size={12} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                Empty — no page
              </button>
              {PRESETS.map((p) => (
                <button key={p.label} className="welcome-preset-btn" onClick={() => { onNewFromPreset({ w: p.w, h: p.h }); onClose(); }}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="welcome-section-title" style={{ marginTop: 14 }}><FolderOpen size={13} /> Open</div>
            <button className="welcome-preset-btn" onClick={() => { onOpenProject(); onClose(); }}>
              Open .layout project…
            </button>
            <p className="welcome-hint">
              …or just close this and drag images straight onto the workspace.
            </p>
          </div>

          <div className="welcome-updates">
            <div className="welcome-section-title">What's New</div>
            {UPDATE_NOTES.map((entry) => (
              <div key={entry.date} className="welcome-update-entry">
                <div className="welcome-update-date">{entry.date}</div>
                <ul>
                  {entry.items.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="welcome-footer">
          <label className="welcome-startup-check">
            <input
              type="checkbox"
              checked={showOnStartup}
              onChange={(e) => onShowOnStartupChange(e.target.checked)}
            />
            Show on startup
          </label>
          <button className="welcome-continue-btn" onClick={onClose}>Continue</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
