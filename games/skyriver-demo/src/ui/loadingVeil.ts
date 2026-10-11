/**
 * @file loadingVeil.ts — the startup loading veil: a staged boot report, not one static line.
 *
 * The demo's boot has three real phases, and the entry point controls each boundary:
 *   1. the sealed city snapshot is verified (hash, gzip, envelope),
 *   2. the skyline is raised (towers, glass, signs, atlases and the traffic streams),
 *   3. the first frame is warmed (shaders, buffers, the first submitted draw).
 *
 * The veil names the phase in progress, counts the step, and shows elapsed wall time, so a slow
 * first load reads as work in progress instead of a frozen screen. Every label describes work this
 * build actually performs at that boundary; the veil is not a decorative animation.
 *
 * No assets and no framework: the DOM is built in JS with one injected <style>, exactly like
 * src/ui/hud.ts, so the veil adds nothing to the bundle but its own source.
 *
 * Plan anchors (.plans/skyriver-syncplay-demo.html):
 *   R8 — zero third-party assets, and no "Megacity" in user-facing strings.
 *   A3 — cold start on the phone webview; this veil is what a slow cold start shows.
 */

/** The startup phases, in order. Each label names the phase; each detail says what that work is. */
export const SKYRIVER_LOADING_STAGES = [
  {
    label: 'Verifying the city snapshot',
    detail: 'checking the sealed city data against its manifest',
  },
  {
    label: 'Raising the skyline',
    detail: 'towers, glass, signs and the traffic streams',
  },
  {
    label: 'Warming the first frame',
    detail: 'shaders, atlases and the first drawn frame',
  },
] as const;

export type SkyriverLoadingStage = (typeof SKYRIVER_LOADING_STAGES)[number];

/**
 * The stage indexes the boot names, so no call site depends on the array's order by number. A test
 * pins each name to its position in SKYRIVER_LOADING_STAGES.
 */
export const SKYRIVER_LOADING_STAGE = {
  verifyingSnapshot: 0,
  raisingSkyline: 1,
  warmingFirstFrame: 2,
} as const;

const VEIL_STYLE_ID = 'skyriver-loading-veil-style';

/**
 * The veil's look: the same unbranded slate-and-monospace language as the HUD, so the loading
 * screen and the running demo read as one product.
 */
const VEIL_CSS = `
.skyriver-veil {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  background: #04060b;
  color: #8ecfff;
  font: 16px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  padding: 24px;
  box-sizing: border-box;
  text-align: center;
}
.skyriver-veil-title {
  font-size: 13px;
  letter-spacing: 0.42em;
  text-transform: uppercase;
  color: #5f9dc8;
}
.skyriver-veil-stage {
  font-size: 18px;
  color: #cfe9ff;
}
.skyriver-veil-detail {
  font-size: 13px;
  color: #6f93ad;
  max-width: 32em;
}
.skyriver-veil-track {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}
.skyriver-veil-segment {
  width: 54px;
  height: 3px;
  border-radius: 2px;
  background: #16232f;
}
.skyriver-veil-segment-filled {
  background: #4fb0e8;
}
.skyriver-veil-segment-active {
  background: #8ecfff;
}
.skyriver-veil-step {
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #5f9dc8;
}
.skyriver-veil-elapsed {
  font-size: 12px;
  color: #4a6d85;
}
`;

/** `0` -> `"Step 1 of 3"`. Stage indexes are zero-based and clamped into range. */
export function formatLoadingStep(stageIndex: number): string {
  return `Step ${clampStageIndex(stageIndex) + 1} of ${SKYRIVER_LOADING_STAGES.length}`;
}

/**
 * `1234` -> `"1.2s"`, `65000` -> `"1m 5s"`. A non-finite or negative reading shows as `"0.0s"`; the
 * readout reports elapsed wall time, so it never invents progress of its own.
 */
export function formatLoadingElapsed(elapsedMs: number): string {
  const clampedMs = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
  const seconds = clampedMs / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds - minutes * 60)}s`;
}

function clampStageIndex(stageIndex: number): number {
  const last = SKYRIVER_LOADING_STAGES.length - 1;
  if (!Number.isFinite(stageIndex)) return 0;
  return Math.min(Math.max(Math.trunc(stageIndex), 0), last);
}

/** The veil as the boot drives it: advance the phase, report elapsed time, then remove it. */
export interface SkyriverLoadingVeil {
  readonly element: HTMLElement;
  /** Names the phase now in progress and marks the progress track up to it. */
  setStage(stageIndex: number): void;
  /** Removes the veil and stops the elapsed readout. Safe to call more than once. */
  dispose(): void;
}

function injectVeilStyle(doc: Document): void {
  if (doc.getElementById(VEIL_STYLE_ID) !== null) return;
  const style = doc.createElement('style');
  style.id = VEIL_STYLE_ID;
  style.textContent = VEIL_CSS;
  doc.head.appendChild(style);
}

/**
 * Builds the veil inside `root` and starts its elapsed readout. The readout runs on an interval, so
 * it keeps ticking through the long synchronous build; it stops the moment the veil is disposed.
 */
export function createLoadingVeil(root: HTMLElement): SkyriverLoadingVeil {
  const doc = root.ownerDocument;
  injectVeilStyle(doc);

  const element = doc.createElement('div');
  element.className = 'skyriver-veil';
  element.id = 'skyriver-loading-veil';
  element.setAttribute('role', 'status');
  element.setAttribute('aria-live', 'polite');

  const title = doc.createElement('div');
  title.className = 'skyriver-veil-title';
  title.textContent = 'Skyriver';

  const stageLine = doc.createElement('div');
  stageLine.className = 'skyriver-veil-stage';

  const detailLine = doc.createElement('div');
  detailLine.className = 'skyriver-veil-detail';

  const track = doc.createElement('div');
  track.className = 'skyriver-veil-track';
  const segments = SKYRIVER_LOADING_STAGES.map(() => {
    const segment = doc.createElement('div');
    segment.className = 'skyriver-veil-segment';
    track.appendChild(segment);
    return segment;
  });

  const stepLine = doc.createElement('div');
  stepLine.className = 'skyriver-veil-step';

  const elapsedLine = doc.createElement('div');
  elapsedLine.className = 'skyriver-veil-elapsed';

  element.append(title, stageLine, detailLine, track, stepLine, elapsedLine);
  root.appendChild(element);

  const startedAtMs = typeof performance === 'undefined' ? Date.now() : performance.now();
  const now = (): number => (typeof performance === 'undefined' ? Date.now() : performance.now());
  let currentStageIndex = 0;
  let disposed = false;

  function renderElapsed(): void {
    elapsedLine.textContent = `${formatLoadingElapsed(now() - startedAtMs)} elapsed`;
  }

  function renderStage(): void {
    const stage: SkyriverLoadingStage = SKYRIVER_LOADING_STAGES[currentStageIndex];
    stageLine.textContent = stage.label;
    detailLine.textContent = stage.detail;
    stepLine.textContent = formatLoadingStep(currentStageIndex);
    segments.forEach((segment, index) => {
      const filled = index <= currentStageIndex;
      segment.className = `skyriver-veil-segment${filled ? ' skyriver-veil-segment-filled' : ''}${
        index === currentStageIndex ? ' skyriver-veil-segment-active' : ''
      }`;
    });
    renderElapsed();
  }

  const interval: ReturnType<typeof setInterval> | null =
    typeof setInterval === 'function' ? setInterval(renderElapsed, 100) : null;

  renderStage();

  return {
    element,
    setStage(stageIndex: number): void {
      if (disposed) return;
      currentStageIndex = clampStageIndex(stageIndex);
      renderStage();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      if (interval !== null) clearInterval(interval);
      if (element.parentNode === root) root.removeChild(element);
    },
  };
}
