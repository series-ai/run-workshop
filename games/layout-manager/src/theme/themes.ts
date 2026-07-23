/**
 * Built-in theme presets for Layout Manager.
 *
 * Want to create your own theme? Copy any preset below, change the values,
 * and add it to the `themes` object at the bottom. The Preferences menu
 * will pick it up automatically.
 *
 * Color values can be any valid CSS color (hex, rgb, rgba, hsl, etc.).
 */

import type { Theme } from './types';

/* ── Blue (default) ─────────────────────────────────────────────────── */
export const blue: Theme = {
  colors: {
    background: '#1a1a2e',
    surface: '#16213e',
    primary: '#667eea',
    secondary: '#764ba2',
    text: {
      primary: '#ffffff',
      muted: 'rgba(255, 255, 255, 0.7)',
    },
    border: 'rgba(255, 255, 255, 0.1)',
    error: '#e74c3c',
    success: '#2ecc71',
    warning: '#f39c12',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  borderRadius: { sm: 8, md: 12, lg: 16, full: 9999 },
  animation: { fast: 150, normal: 200, slow: 300 },
  fontSize: { xs: 11, sm: 13, md: 16, lg: 18, xl: 24, xxl: 48 },
  fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
} as const;

/* ── Dark ────────────────────────────────────────────────────────────── */
export const dark: Theme = {
  colors: {
    background: '#1a1a1a',
    surface: '#252525',
    primary: '#667eea',
    secondary: '#764ba2',
    text: {
      primary: '#e0e0e0',
      muted: 'rgba(255, 255, 255, 0.5)',
    },
    border: 'rgba(255, 255, 255, 0.08)',
    error: '#e74c3c',
    success: '#2ecc71',
    warning: '#f39c12',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  borderRadius: { sm: 8, md: 12, lg: 16, full: 9999 },
  animation: { fast: 150, normal: 200, slow: 300 },
  fontSize: { xs: 11, sm: 13, md: 16, lg: 18, xl: 24, xxl: 48 },
  fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
} as const;

/* ── Light ───────────────────────────────────────────────────────────── */
export const light: Theme = {
  colors: {
    background: '#f0f0f0',
    surface: '#ffffff',
    primary: '#4a6cf7',
    secondary: '#7c5cbf',
    text: {
      primary: '#1a1a1a',
      muted: 'rgba(0, 0, 0, 0.55)',
    },
    border: 'rgba(0, 0, 0, 0.12)',
    error: '#d93025',
    success: '#1e8e3e',
    warning: '#e37400',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  borderRadius: { sm: 8, md: 12, lg: 16, full: 9999 },
  animation: { fast: 150, normal: 200, slow: 300 },
  fontSize: { xs: 11, sm: 13, md: 16, lg: 18, xl: 24, xxl: 48 },
  fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
} as const;

/**
 * All available themes, keyed by their display name.
 * Add your custom themes here!
 */
export const themes: Record<string, Theme> = {
  Blue: blue,
  Dark: dark,
  Light: light,
};
