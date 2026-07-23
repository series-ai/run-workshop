import type { Theme } from './types';

/**
 * Parse any CSS color to its r, g, b components.
 * Works with hex (#rgb, #rrggbb, #rrggbbaa), rgb(), rgba().
 */
function parseRGB(color: string): string {
  // hex
  const hex = color.trim();
  if (hex.startsWith('#')) {
    let r: number, g: number, b: number;
    if (hex.length === 4 || hex.length === 5) {
      r = parseInt(hex[1]! + hex[1]!, 16);
      g = parseInt(hex[2]! + hex[2]!, 16);
      b = parseInt(hex[3]! + hex[3]!, 16);
    } else {
      r = parseInt(hex.slice(1, 3), 16);
      g = parseInt(hex.slice(3, 5), 16);
      b = parseInt(hex.slice(5, 7), 16);
    }
    return `${r}, ${g}, ${b}`;
  }
  // rgb()/rgba()
  const match = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (match) return `${match[1]}, ${match[2]}, ${match[3]}`;
  return '0, 0, 0';
}

/**
 * Apply theme values to CSS variables.
 * Call this once on app initialization and whenever the theme changes.
 */
export const applyTheme = (theme: Theme): void => {
  const root = document.documentElement;

  // Apply color variables
  root.style.setProperty('--color-background', theme.colors.background);
  root.style.setProperty('--color-surface', theme.colors.surface);
  root.style.setProperty('--color-primary', theme.colors.primary);
  // Alias — newer UI (welcome screen, scrollbars, selection highlights) uses
  // --color-accent; it tracks the primary/accent color
  root.style.setProperty('--color-accent', theme.colors.primary);
  root.style.setProperty('--color-secondary', theme.colors.secondary);
  root.style.setProperty('--color-text-primary', theme.colors.text.primary);
  root.style.setProperty('--color-text-muted', theme.colors.text.muted);
  root.style.setProperty('--color-border', theme.colors.border);
  root.style.setProperty('--color-error', theme.colors.error);
  root.style.setProperty('--color-success', theme.colors.success);
  root.style.setProperty('--color-warning', theme.colors.warning);

  // RGB triplets for use with rgba() in CSS
  root.style.setProperty('--color-background-rgb', parseRGB(theme.colors.background));
  root.style.setProperty('--color-surface-rgb', parseRGB(theme.colors.surface));
  root.style.setProperty('--color-primary-rgb', parseRGB(theme.colors.primary));
  root.style.setProperty('--color-secondary-rgb', parseRGB(theme.colors.secondary));
  root.style.setProperty('--color-text-primary-rgb', parseRGB(theme.colors.text.primary));
  root.style.setProperty('--color-error-rgb', parseRGB(theme.colors.error));

  // Apply spacing variables
  root.style.setProperty('--spacing-xs', `${theme.spacing.xs}px`);
  root.style.setProperty('--spacing-sm', `${theme.spacing.sm}px`);
  root.style.setProperty('--spacing-md', `${theme.spacing.md}px`);
  root.style.setProperty('--spacing-lg', `${theme.spacing.lg}px`);
  root.style.setProperty('--spacing-xl', `${theme.spacing.xl}px`);

  // Apply border radius variables
  root.style.setProperty('--radius-sm', `${theme.borderRadius.sm}px`);
  root.style.setProperty('--radius-md', `${theme.borderRadius.md}px`);
  root.style.setProperty('--radius-lg', `${theme.borderRadius.lg}px`);
  root.style.setProperty('--radius-full', `${theme.borderRadius.full}px`);

  // Apply font size variables
  root.style.setProperty('--font-xs', `${theme.fontSize.xs}px`);
  root.style.setProperty('--font-sm', `${theme.fontSize.sm}px`);
  root.style.setProperty('--font-md', `${theme.fontSize.md}px`);
  root.style.setProperty('--font-lg', `${theme.fontSize.lg}px`);
  root.style.setProperty('--font-xl', `${theme.fontSize.xl}px`);
  root.style.setProperty('--font-xxl', `${theme.fontSize.xxl}px`);

  // Apply font weight variables
  root.style.setProperty('--font-normal', theme.fontWeight.normal.toString());
  root.style.setProperty('--font-medium', theme.fontWeight.medium.toString());
  root.style.setProperty('--font-semibold', theme.fontWeight.semibold.toString());
  root.style.setProperty('--font-bold', theme.fontWeight.bold.toString());

  // Apply animation duration variables (in ms for JavaScript, convert for CSS)
  root.style.setProperty('--animation-fast', `${theme.animation.fast}ms`);
  root.style.setProperty('--animation-normal', `${theme.animation.normal}ms`);
  root.style.setProperty('--animation-slow', `${theme.animation.slow}ms`);
};
