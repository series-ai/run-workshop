/**
 * Theme type definition.
 *
 * Colors accept any valid CSS color string so custom themes
 * are not locked to specific hex values.
 */
export interface Theme {
  colors: {
    background: string;
    surface: string;
    primary: string;
    secondary: string;
    text: {
      primary: string;
      muted: string;
    };
    border: string;
    error: string;
    success: string;
    warning: string;
  };
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number };
  borderRadius: { sm: number; md: number; lg: number; full: number };
  animation: { fast: number; normal: number; slow: number };
  fontSize: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number };
  fontWeight: { normal: number; medium: number; semibold: number; bold: number };
}
