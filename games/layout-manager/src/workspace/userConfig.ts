/**
 * User configuration — persisted to localStorage.
 *
 * Add new preference keys here as the Preferences panel grows.
 */

import type { ScaleFilter } from './types';

const STORAGE_KEY = 'layout-manager-config';

/* ── Simple obfuscation for API keys in localStorage ──
 * XOR + base64 so stored values don't match API key patterns
 * that browser malware scans for. Not real encryption — just
 * enough to defeat pattern-matching sniffers.
 */
const OBF_KEY = 'LM-2026-obf';

function obfuscate(value: string): string {
  if (!value) return '';
  const bytes = new TextEncoder().encode(value);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i]! ^= OBF_KEY.charCodeAt(i % OBF_KEY.length);
  }
  return btoa(String.fromCharCode(...bytes));
}

function deobfuscate(encoded: string): string {
  if (!encoded) return '';
  try {
    const str = atob(encoded);
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i) ^ OBF_KEY.charCodeAt(i % OBF_KEY.length);
    }
    const decoded = new TextDecoder().decode(bytes);
    // Verify roundtrip — if re-obfuscating doesn't produce the original,
    // this wasn't an obfuscated value (legacy plain text)
    if (obfuscate(decoded) !== encoded) return encoded;
    return decoded;
  } catch {
    return encoded; // not obfuscated (legacy plain text) — return as-is
  }
}

const SECRET_KEYS: (keyof UserConfig)[] = [
  'googleGenaiApiKey', 'openaiApiKey', 'xaiApiKey', 'anthropicApiKey',
];

export interface UserConfig {
  /** Name of the active theme (matches a key in themes.ts) */
  theme: string;

  /* ── Workspace defaults ── */

  /** Show the background grid on the workspace */
  showGrid: boolean;
  /** Show rulers by default */
  showRulers: boolean;
  /** Default scale filter for images */
  defaultScaleFilter: ScaleFilter;
  /** Custom accent/highlight color override (null = use theme default) */
  accentColor: string | null;
  /** Randomize accent color from presets on each startup */
  randomizeAccent: boolean;
  /** Auto-switch large images (>1024px) to bicubic unless PNG chunk says nearest */
  scaleOverride: boolean;
  /** Enable frosted glass blur effect on panels */
  frostedGlass: boolean;
  /** Pixel gap inserted between elements when Ctrl+Arrow alignment stacks them */
  alignPadding: number;

  /* ── AI features ── */

  /** Hide all AI toolbar buttons and features */
  aiHidden: boolean;
  /** Show the welcome popup on startup */
  showWelcome: boolean;
  /** Google GenAI API key (for nano-banana / Gemini image generation) */
  googleGenaiApiKey: string;
  /** OpenAI API key */
  openaiApiKey: string;
  /** xAI (Grok) API key */
  xaiApiKey: string;
  /** Anthropic (Claude) API key */
  anthropicApiKey: string;
  /** Max batch count for AI generation */
  aiMaxCount: number;
  /** Local KoboldCpp server URL */
  koboldUrl: string;
  /** Local Ollama server URL */
  ollamaUrl: string;
  /** Ollama model name (empty = use first installed model) */
  ollamaModel: string;
  /** Local ComfyUI server URL */
  comfyUrl: string;
  /** Hard cap (per-dimension) for $Width / $Height inputs in the ComfyUI modal */
  comfyMaxDimension: number;
  /** Which preset categories show in the Aspect Ratio dropdown */
  comfyAspectCategories: { sd15: boolean; sdxl: boolean; flux2: boolean };
  /** Which aspect ratios show in the Aspect Ratio dropdown (covers both portrait + landscape) */
  comfyAspectRatios: Record<string, boolean>;
}

const defaultConfig: UserConfig = {
  theme: 'Dark',
  showGrid: true,
  showRulers: false,
  defaultScaleFilter: 'bicubic',
  accentColor: '#1abc9c',
  randomizeAccent: false,
  scaleOverride: true,
  frostedGlass: true,
  alignPadding: 0,
  aiHidden: false,
  showWelcome: true,
  googleGenaiApiKey: '',
  openaiApiKey: '',
  xaiApiKey: '',
  anthropicApiKey: '',
  aiMaxCount: 10,
  koboldUrl: 'http://127.0.0.1:5001',
  ollamaUrl: 'http://127.0.0.1:11434',
  ollamaModel: '',
  comfyUrl: 'http://127.0.0.1:8188',
  comfyMaxDimension: 8192,
  comfyAspectCategories: { sd15: true, sdxl: true, flux2: true },
  comfyAspectRatios: {
    '1:1': true,
    '2:3': true,
    '3:4': true,
    '5:8': true,
    '9:16': true,
    '9:21': true,
    '1.85:1': true,
    '2:1': true,
  },
};

/** Load the saved config, falling back to defaults for missing keys. */
export function loadConfig(): UserConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const config = { ...defaultConfig, ...parsed };
      // Deobfuscate secret fields
      for (const key of SECRET_KEYS) {
        if (config[key]) config[key] = deobfuscate(config[key] as string);
      }
      return config;
    }
  } catch {
    // corrupt data — fall back to defaults
  }
  return { ...defaultConfig };
}

/** Save config to localStorage. */
export function saveConfig(config: UserConfig): void {
  try {
    // Obfuscate secret fields before writing
    const toStore = { ...config };
    for (const key of SECRET_KEYS) {
      if (toStore[key]) (toStore as Record<string, unknown>)[key] = obfuscate(toStore[key] as string);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // quota exceeded — silently fail
  }
}
