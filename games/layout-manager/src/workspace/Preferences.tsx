import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { themes } from '../theme/themes';
import { applyTheme } from '../theme/applyTheme';
import type { UserConfig } from './userConfig';
import { saveConfig } from './userConfig';
import type { ScaleFilter } from './types';

interface PreferencesProps {
  config: UserConfig;
  onConfigChange: (config: UserConfig) => void;
  onClose: () => void;
  onResetPanelPosition?: () => void;
}

const categories = [
  { id: 'theme', label: 'Theme', icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z' },
  { id: 'workspace', label: 'Workspace', icon: 'M4 3h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1zM3 9h18M9 3v18' },
  { id: 'ai', label: 'AI', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
  { id: 'comfyui', label: 'ComfyUI', icon: 'M3 3h6v6H3z M15 15h6v6h-6z M7 9v4a2 2 0 002 2h4' },
] as const;

type CategoryId = (typeof categories)[number]['id'];

export function Preferences({ config, onConfigChange, onClose, onResetPanelPosition }: PreferencesProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryId>('theme');
  const [draft, setDraft] = useState<UserConfig>({ ...config });

  // Close on overlay click
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    },
    [onClose],
  );

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Live-preview theme as user selects
  const handleThemeSelect = useCallback((name: string) => {
    setDraft((prev) => {
      const next = { ...prev, theme: name };
      const theme = themes[name];
      if (theme) {
        const applied = next.accentColor
          ? { ...theme, colors: { ...theme.colors, primary: next.accentColor } }
          : theme;
        applyTheme(applied);
      }
      return next;
    });
  }, []);

  const handleAccentChange = useCallback((color: string | null) => {
    setDraft((prev) => {
      const next = { ...prev, accentColor: color };
      const theme = themes[prev.theme];
      if (theme) {
        const applied = color
          ? { ...theme, colors: { ...theme.colors, primary: color } }
          : theme;
        applyTheme(applied);
      }
      return next;
    });
  }, []);

  const handleSave = useCallback(() => {
    saveConfig(draft);
    onConfigChange(draft);
    onClose();
  }, [draft, onConfigChange, onClose]);

  // On cancel, revert the live preview
  const handleCancel = useCallback(() => {
    const theme = themes[config.theme];
    if (theme) {
      const applied = config.accentColor
        ? { ...theme, colors: { ...theme.colors, primary: config.accentColor } }
        : theme;
      applyTheme(applied);
    }
    onClose();
  }, [config.theme, config.accentColor, onClose]);

  const updateDraft = useCallback(<K extends keyof UserConfig>(key: K, value: UserConfig[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  return createPortal(
    <div className="prefs-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="prefs-dialog" style={!draft.frostedGlass ? { backdropFilter: 'none', background: 'var(--color-surface)' } : undefined}>
        {/* Header */}
        <div className="prefs-header">
          <h2>Preferences</h2>
          <button className="prefs-close" onClick={handleCancel}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body: sidebar + content */}
        <div className="prefs-body">
          {/* Category sidebar */}
          <nav className="prefs-sidebar">
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`prefs-sidebar-item${activeCategory === cat.id ? ' prefs-sidebar-item-active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={cat.icon} />
                </svg>
                <span>{cat.label}</span>
              </button>
            ))}
          </nav>

          {/* Content area */}
          <div className="prefs-content">
            {activeCategory === 'theme' && (
              <ThemeSettings
                selectedTheme={draft.theme}
                onSelect={handleThemeSelect}
                accentColor={draft.accentColor}
                onAccentChange={handleAccentChange}
                randomizeAccent={draft.randomizeAccent}
                onRandomizeChange={(v) => updateDraft('randomizeAccent', v)}
                frostedGlass={draft.frostedGlass}
                onFrostedGlassChange={(v) => updateDraft('frostedGlass', v)}
              />
            )}
            {activeCategory === 'workspace' && (
              <WorkspaceSettings draft={draft} onChange={updateDraft} onResetPanelPosition={onResetPanelPosition} />
            )}
            {activeCategory === 'ai' && (
              <AISettings draft={draft} onChange={updateDraft} />
            )}
            {activeCategory === 'comfyui' && (
              <ComfyUISettings draft={draft} onChange={updateDraft} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="prefs-footer">
          <button className="prefs-btn prefs-btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button className="prefs-btn prefs-btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── Theme Settings Panel ────────────────────────────────────────────── */

const ACCENT_PRESETS = [
  { label: 'Blue', color: '#667eea' },
  { label: 'Purple', color: '#9b59b6' },
  { label: 'Teal', color: '#1abc9c' },
  { label: 'Green', color: '#2ecc71' },
  { label: 'Orange', color: '#e67e22' },
  { label: 'Red', color: '#e74c3c' },
  { label: 'Pink', color: '#e91e8b' },
];

function ThemeSettings({
  selectedTheme,
  onSelect,
  accentColor,
  onAccentChange,
  randomizeAccent,
  onRandomizeChange,
  frostedGlass,
  onFrostedGlassChange,
}: {
  selectedTheme: string;
  onSelect: (name: string) => void;
  accentColor: string | null;
  onAccentChange: (color: string | null) => void;
  randomizeAccent: boolean;
  onRandomizeChange: (v: boolean) => void;
  frostedGlass: boolean;
  onFrostedGlassChange: (v: boolean) => void;
}) {
  const activeTheme = themes[selectedTheme];
  const currentAccent = accentColor ?? activeTheme?.colors.primary ?? '#667eea';

  return (
    <div className="prefs-theme">
      <p className="prefs-theme-description">
        Choose a theme for Layout Manager. Themes control the colors used across the entire interface.
      </p>
      <div className="prefs-theme-grid">
        {Object.entries(themes).map(([name, theme]) => {
          const isActive = name === selectedTheme;
          return (
            <button
              key={name}
              className={`prefs-theme-card${isActive ? ' prefs-theme-card-active' : ''}`}
              onClick={() => onSelect(name)}
            >
              {/* Color preview swatches */}
              <div className="prefs-theme-preview">
                <div className="prefs-theme-swatch-bg" style={{ background: theme.colors.background }}>
                  <div className="prefs-theme-swatch-surface" style={{ background: theme.colors.surface }}>
                    <div className="prefs-theme-swatch-row">
                      <div className="prefs-theme-swatch-accent" style={{ background: theme.colors.primary }} />
                      <div className="prefs-theme-swatch-accent" style={{ background: theme.colors.secondary }} />
                    </div>
                    <div className="prefs-theme-swatch-text" style={{ background: theme.colors.text.primary }} />
                    <div className="prefs-theme-swatch-text prefs-theme-swatch-text-short" style={{ background: theme.colors.text.muted }} />
                  </div>
                </div>
              </div>
              <span className="prefs-theme-name">{name}</span>
              {isActive && (
                <svg className="prefs-theme-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {/* Accent color */}
      <div className="prefs-accent-section">
        <p className="prefs-theme-description" style={{ marginTop: 16 }}>
          Accent color used for highlights, active buttons, and selections.
        </p>
        <div className="prefs-accent-row">
          <button
            className={`prefs-accent-swatch${!accentColor ? ' prefs-accent-swatch-active' : ''}`}
            style={{ background: activeTheme?.colors.primary ?? '#667eea' }}
            onClick={() => onAccentChange(null)}
            title="Theme default"
          />
          {ACCENT_PRESETS.map((preset) => (
            <button
              key={preset.color}
              className={`prefs-accent-swatch${accentColor === preset.color ? ' prefs-accent-swatch-active' : ''}`}
              style={{ background: preset.color }}
              onClick={() => onAccentChange(preset.color)}
              title={preset.label}
            />
          ))}
          <label className="prefs-accent-custom" title="Custom color">
            <input
              type="color"
              value={currentAccent}
              onChange={(e) => onAccentChange(e.target.value)}
              className="prefs-accent-custom-input"
            />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </label>
        </div>
        <label className="prefs-randomize-toggle">
          <button
            type="button"
            role="switch"
            aria-checked={randomizeAccent}
            className={`prefs-toggle${randomizeAccent ? ' prefs-toggle-on' : ''}`}
            onClick={() => onRandomizeChange(!randomizeAccent)}
          >
            <span className="prefs-toggle-thumb" />
          </button>
          <span className="prefs-randomize-label">Randomize highlight color on startup</span>
        </label>
        <label className="prefs-randomize-toggle">
          <button
            type="button"
            role="switch"
            aria-checked={frostedGlass}
            className={`prefs-toggle${frostedGlass ? ' prefs-toggle-on' : ''}`}
            onClick={() => onFrostedGlassChange(!frostedGlass)}
          >
            <span className="prefs-toggle-thumb" />
          </button>
          <span className="prefs-randomize-label">Frosted glass panels</span>
        </label>
      </div>
    </div>
  );
}

/* ── Workspace Settings Panel ────────────────────────────────────────── */

function WorkspaceSettings({
  draft,
  onChange,
  onResetPanelPosition,
}: {
  draft: UserConfig;
  onChange: <K extends keyof UserConfig>(key: K, value: UserConfig[K]) => void;
  onResetPanelPosition?: () => void;
}) {
  return (
    <div className="prefs-workspace">
      <p className="prefs-section-description">
        Configure the default workspace behavior. These apply when you start a new session.
      </p>

      <div className="prefs-setting-group">
        <ToggleSetting
          label="Background Grid"
          description="Show the dot grid pattern on the workspace background"
          checked={draft.showGrid}
          onChange={(v) => onChange('showGrid', v)}
        />

        <ToggleSetting
          label="Rulers"
          description="Show pixel rulers along the top and left edges"
          checked={draft.showRulers}
          onChange={(v) => onChange('showRulers', v)}
        />

      </div>

      <div className="prefs-setting-divider" />

      <SelectSetting
        label="Default Scale Filter"
        description="How images are rendered when scaled up or down"
        value={draft.defaultScaleFilter}
        options={[
          { value: 'bicubic', label: 'Bicubic (smooth)' },
          { value: 'nearest', label: 'Nearest Neighbor (pixel-perfect)' },
        ]}
        onChange={(v) => onChange('defaultScaleFilter', v as ScaleFilter)}
      />

      <ToggleSetting
        label="Smart Scale Override"
        description="Auto-switch to bicubic for images larger than 1024px, unless PNG metadata specifies nearest neighbor"
        checked={draft.scaleOverride}
        onChange={(v) => onChange('scaleOverride', v)}
      />

      <div className="prefs-setting-divider" />

      <div className="prefs-toggle-row" style={{ cursor: 'default' }}>
        <div className="prefs-toggle-text">
          <span className="prefs-toggle-label">Reset Panel Position</span>
          <span className="prefs-toggle-desc">Move the properties panel back to its default position</span>
        </div>
        <button className="prefs-select" style={{ padding: '4px 12px', cursor: 'pointer' }} onClick={onResetPanelPosition}>Reset</button>
      </div>
    </div>
  );
}

/* ── AI Settings Panel ──────────────────────────────────────────────── */

function AISettings({
  draft,
  onChange,
}: {
  draft: UserConfig;
  onChange: <K extends keyof UserConfig>(key: K, value: UserConfig[K]) => void;
}) {
  const envInputRef = useRef<HTMLInputElement>(null);

  const handleEnvImport = useCallback(() => {
    envInputRef.current?.click();
  }, []);

  const handleEnvFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const lines = text.split('\n');
      const keyMap: Record<string, keyof UserConfig> = {
        'GOOGLE_GENAI_API_KEY': 'googleGenaiApiKey',
        'OPENAI_API_KEY': 'openaiApiKey',
        'XAI_API_KEY': 'xaiApiKey',
        'ANTHROPIC_API_KEY': 'anthropicApiKey',
        'Anthropic_API_KEY': 'anthropicApiKey',
      };
      let imported = 0;
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx < 0) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        // Strip surrounding quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        const configKey = keyMap[key];
        if (configKey && val) {
          onChange(configKey, val);
          imported++;
        }
      }
      if (imported > 0) {
        alert(`Imported ${imported} key${imported > 1 ? 's' : ''} from .env file`);
      } else {
        alert('No recognized API keys found in file.\nExpected keys: GOOGLE_GENAI_API_KEY, OPENAI_API_KEY, XAI_API_KEY, ANTHROPIC_API_KEY');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [onChange]);

  return (
    <div className="prefs-workspace">
      <div className="prefs-setting-group">
        <ToggleSetting
          label="Hide AI Features"
          description="Remove all AI buttons from the toolbar"
          checked={draft.aiHidden}
          onChange={(v) => onChange('aiHidden', v)}
        />

        <div className="prefs-select-row">
          <div className="prefs-toggle-text">
            <span className="prefs-toggle-label">Max Batch Count</span>
            <span className="prefs-toggle-desc">Maximum images per generation request</span>
          </div>
          <input
            type="text"
            inputMode="numeric"
            className="prefs-text-input"
            style={{ width: 70, textAlign: 'center' }}
            value={draft.aiMaxCount === 0 ? '' : String(draft.aiMaxCount ?? 10)}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '');
              onChange('aiMaxCount', v === '' ? 0 : Number(v));
            }}
            onBlur={() => { if (!draft.aiMaxCount || draft.aiMaxCount < 1) onChange('aiMaxCount', 10); }}
          />
        </div>
        {draft.aiMaxCount > 20 && (
          <p className="prefs-section-description" style={{ color: 'var(--color-warning, #e67e22)', marginTop: 4 }}>
            High batch counts load many large images into browser memory at once. This may cause slowdowns or crashes on machines with limited RAM.
          </p>
        )}
      </div>

      <div className="prefs-setting-divider" />

      <div className="prefs-toggle-row" style={{ cursor: 'default' }}>
        <div className="prefs-toggle-text">
          <span className="prefs-toggle-label">API Keys</span>
          <span className="prefs-toggle-desc">Only fill in the providers you use. Leave the rest blank.</span>
        </div>
        <button
          className="prefs-select"
          style={{ padding: '4px 12px', cursor: 'pointer' }}
          onClick={handleEnvImport}
        >
          Import .env
        </button>
        <input
          ref={envInputRef}
          type="file"
          accept=".env,.env.local,.txt"
          onChange={handleEnvFile}
          style={{ display: 'none' }}
        />
      </div>

      <TextInputSetting
        label="Google GenAI"
        value={draft.googleGenaiApiKey}
        onChange={(v) => onChange('googleGenaiApiKey', v)}
        placeholder="API key"
        secret
      />

      <TextInputSetting
        label="OpenAI"
        value={draft.openaiApiKey}
        onChange={(v) => onChange('openaiApiKey', v)}
        placeholder="API key"
        secret
      />

      <TextInputSetting
        label="xAI (Grok)"
        value={draft.xaiApiKey}
        onChange={(v) => onChange('xaiApiKey', v)}
        placeholder="API key"
        secret
      />

      <TextInputSetting
        label="Anthropic (Claude)"
        value={draft.anthropicApiKey}
        onChange={(v) => onChange('anthropicApiKey', v)}
        placeholder="API key"
        secret
      />

      <div className="prefs-setting-divider" />

      <div className="prefs-toggle-row" style={{ cursor: 'default' }}>
        <div className="prefs-toggle-text">
          <span className="prefs-toggle-label">Local Models</span>
          <span className="prefs-toggle-desc">Chat with LLMs running on your own machine. No API keys needed.</span>
        </div>
      </div>

      <TextInputSetting
        label="KoboldCpp URL"
        value={draft.koboldUrl}
        onChange={(v) => onChange('koboldUrl', v)}
        placeholder="http://127.0.0.1:5001"
      />

      <TextInputSetting
        label="Ollama URL"
        value={draft.ollamaUrl}
        onChange={(v) => onChange('ollamaUrl', v)}
        placeholder="http://127.0.0.1:11434"
      />

      <TextInputSetting
        label="Ollama model"
        value={draft.ollamaModel}
        onChange={(v) => onChange('ollamaModel', v)}
        placeholder="Blank = first installed model"
      />
    </div>
  );
}

function ComfyUISettings({
  draft,
  onChange,
}: {
  draft: UserConfig;
  onChange: <K extends keyof UserConfig>(key: K, value: UserConfig[K]) => void;
}) {
  const cats = draft.comfyAspectCategories ?? { sd15: true, sdxl: true, flux2: true };
  const ratios = draft.comfyAspectRatios ?? {};
  const toggleCat = (key: 'sd15' | 'sdxl' | 'flux2') => {
    onChange('comfyAspectCategories', { ...cats, [key]: !cats[key] });
  };
  const toggleRatio = (key: string) => {
    onChange('comfyAspectRatios', { ...ratios, [key]: !(ratios[key] ?? true) });
  };
  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 10px',
    borderRadius: 12,
    border: '1px solid var(--color-border)',
    background: active ? 'var(--color-accent, #4a90e2)' : 'rgba(var(--color-text-primary-rgb), 0.04)',
    color: active ? 'white' : 'var(--color-text-muted)',
    fontSize: 11,
    cursor: 'pointer',
    opacity: active ? 1 : 0.6,
    transition: 'all 0.15s',
  });

  return (
    <div className="prefs-workspace">
      <p className="prefs-section-description" style={{ marginBottom: 12 }}>
        Settings for the local ComfyUI workflow runner. Drop API-format JSONs into <code>comfy-workflows/</code> and pick them from the ComfyUI panel.
      </p>

      <TextInputSetting
        label="Server URL"
        description="Local ComfyUI instance (default http://127.0.0.1:8188). Launch ComfyUI with --enable-cors-header &quot;*&quot;."
        value={draft.comfyUrl}
        onChange={(v) => onChange('comfyUrl', v)}
        placeholder="http://127.0.0.1:8188"
      />

      <div className="prefs-select-row">
        <div className="prefs-toggle-text">
          <span className="prefs-toggle-label">Max Image Dimension</span>
          <span className="prefs-toggle-desc">Hard cap (in px) for $Width / $Height inputs — auto-clamps anything bigger</span>
        </div>
        <input
          type="text"
          inputMode="numeric"
          className="prefs-text-input"
          style={{ width: 80, textAlign: 'center' }}
          value={draft.comfyMaxDimension === 0 ? '' : String(draft.comfyMaxDimension ?? 8192)}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            const n = v === '' ? 0 : Math.min(8192, Number(v));
            onChange('comfyMaxDimension', n);
          }}
          onBlur={() => { if (!draft.comfyMaxDimension || draft.comfyMaxDimension < 64) onChange('comfyMaxDimension', 8192); }}
        />
      </div>

      <div className="prefs-setting-divider" />

      <div className="prefs-toggle-text" style={{ marginBottom: 8 }}>
        <span className="prefs-toggle-label">Aspect Ratio Dropdown — Categories</span>
        <span className="prefs-toggle-desc">Hide entire model-family preset groups</span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <button type="button" onClick={() => toggleCat('sd15')} style={pillStyle(cats.sd15)}>SD1.5 (small)</button>
        <button type="button" onClick={() => toggleCat('sdxl')} style={pillStyle(cats.sdxl)}>SDXL (medium)</button>
        <button type="button" onClick={() => toggleCat('flux2')} style={pillStyle(cats.flux2)}>Flux 2 (large)</button>
      </div>

      <div className="prefs-toggle-text" style={{ marginBottom: 8 }}>
        <span className="prefs-toggle-label">Aspect Ratio Dropdown — Shapes</span>
        <span className="prefs-toggle-desc">Each toggle covers both portrait and landscape orientations</span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {['1:1', '2:3', '3:4', '5:8', '9:16', '9:21', '1.85:1', '2:1'].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => toggleRatio(r)}
            style={pillStyle(ratios[r] ?? true)}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Reusable setting controls ───────────────────────────────────────── */

function ToggleSetting({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="prefs-toggle-row">
      <div className="prefs-toggle-text">
        <span className="prefs-toggle-label">{label}</span>
        <span className="prefs-toggle-desc">{description}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`prefs-toggle${checked ? ' prefs-toggle-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="prefs-toggle-thumb" />
      </button>
    </label>
  );
}

function SelectSetting({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="prefs-select-row">
      <div className="prefs-toggle-text">
        <span className="prefs-toggle-label">{label}</span>
        <span className="prefs-toggle-desc">{description}</span>
      </div>
      <select
        className="prefs-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function TextInputSetting({
  label,
  description,
  value,
  onChange,
  placeholder,
  secret,
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  secret?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="prefs-select-row">
      <div className="prefs-toggle-text">
        <span className="prefs-toggle-label">{label}</span>
        {description && <span className="prefs-toggle-desc">{description}</span>}
      </div>
      <div className="prefs-text-input-wrap">
        <input
          type={secret && !visible ? 'password' : 'text'}
          className="prefs-text-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
        />
        {secret && (
          <button
            type="button"
            className="prefs-password-toggle"
            onClick={() => setVisible(!visible)}
            title={visible ? 'Hide' : 'Show'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {visible ? (
                <>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              ) : (
                <>
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </>
              )}
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
