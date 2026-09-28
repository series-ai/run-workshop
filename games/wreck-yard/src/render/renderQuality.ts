/**
 * Post-processing tiers.
 * - low: ink lines, cavity, 1/4-res glow, color grade. Phones and weak GPUs.
 * - high: adds ambient occlusion and a multi-level bloom. Desktop default.
 * The HUD toggle lasts for the session. Browser storage is blocked in the RUN sandbox.
 */
export type RenderQuality = 'low' | 'high';

/** URL `?quality=low|high` wins over the device default. Unknown values are ignored. */
export function selectRenderQuality(env: { readonly isMobile: boolean; readonly urlQuality: string | null }): RenderQuality {
  if (env.urlQuality === 'low' || env.urlQuality === 'high') return env.urlQuality;
  return env.isMobile ? 'low' : 'high';
}

export function readRenderQuality(isMobile: boolean): RenderQuality {
  return selectRenderQuality({ isMobile, urlQuality: new URLSearchParams(window.location.search).get('quality') });
}

/** The automatic high tier falls back to low after this many slow windows in a row. */
export const QUALITY_FALLBACK = { windowFrames: 30, slowFrameMs: 22, slowWindows: 3 } as const;

/** Counts consecutive slow frame windows. Any fast window resets the count. */
export function nextSlowWindowCount(count: number, windowAverageMs: number): number {
  return windowAverageMs > QUALITY_FALLBACK.slowFrameMs ? count + 1 : 0;
}
