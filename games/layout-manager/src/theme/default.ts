import type { Theme } from './types';

/**
 * Default theme configuration
 * Customize these values to match your app's design
 */
export const defaultTheme: Theme = {
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
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    full: 9999,
  },
  animation: {
    fast: 150,
    normal: 200,
    slow: 300,
  },
  fontSize: {
    xs: 11,
    sm: 13,
    md: 16,
    lg: 18,
    xl: 24,
    xxl: 48,
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
};
