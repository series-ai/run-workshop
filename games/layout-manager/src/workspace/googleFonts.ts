/** Curated Google Fonts for text elements, loaded on demand via fonts.googleapis.com. */

export const GENERIC_FONTS = ['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'];

/** Curated, game-art-friendly selection — display, pixel, handwritten, and body fonts. */
export const GOOGLE_FONTS = [
  // Body / UI
  'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Nunito', 'Raleway', 'Fredoka', 'Comfortaa', 'Baloo 2',
  // Serif / editorial
  'Merriweather', 'Playfair Display', 'Lora', 'Cinzel',
  // Display / impact
  'Oswald', 'Bebas Neue', 'Anton', 'Archivo Black', 'Alfa Slab One', 'Righteous', 'Russo One', 'Bangers', 'Luckiest Guy',
  // Sci-fi / techy
  'Orbitron', 'Exo 2', 'Rajdhani',
  // Pixel / retro
  'Press Start 2P', 'VT323', 'Pixelify Sans', 'Silkscreen',
  // Themed
  'MedievalSharp', 'Creepster',
  // Handwritten / script
  'Permanent Marker', 'Caveat', 'Pacifico', 'Dancing Script', 'Indie Flower', 'Shadows Into Light', 'Amatic SC',
];

const loaded = new Set<string>();

/** Inject a stylesheet link for a Google Font (400 + 700 weights, with italics). No-op for generics/unknown/system fonts. */
export function ensureGoogleFont(family: string | undefined | null): void {
  if (!family || GENERIC_FONTS.includes(family) || !GOOGLE_FONTS.includes(family) || loaded.has(family)) return;
  loaded.add(family);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  // CORS mode so the dev server's COEP: require-corp doesn't block the request
  link.crossOrigin = 'anonymous';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:ital,wght@0,400;0,700;1,400;1,700&display=swap`;
  document.head.appendChild(link);
}

/** CSS font-family value — quotes multi-word families, adds a sans-serif fallback. */
export function cssFontFamily(family: string | undefined | null): string {
  const f = family || 'sans-serif';
  if (GENERIC_FONTS.includes(f)) return f;
  return `"${f}", sans-serif`;
}

/** Ensure a font is loaded and ready for canvas rendering (best effort). */
export async function loadFontForCanvas(family: string | undefined | null, px: number, bold?: boolean, italic?: boolean): Promise<void> {
  const f = family || 'sans-serif';
  if (GENERIC_FONTS.includes(f)) return;
  ensureGoogleFont(f);
  try {
    await document.fonts.load(`${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${px}px "${f}"`);
  } catch { /* best effort — canvas falls back to default font */ }
}
