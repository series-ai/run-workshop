/**
 * @file hud.ts — the Skyriver HUD: a DOM overlay built in JS, with no assets and no framework.
 *
 * Plan anchors (.plans/skyriver-syncplay-demo.html):
 *   File Roster — "src/ui/hud.ts: Mode/speed/tier/stats DOM HUD".
 *   R5 — touch controls on mobile; mode switches are events.
 *   R8 — zero third-party assets, and no "Megacity" in user-facing strings.
 *   A5 — the mode toggle is reachable and each toggle shows exactly one event.
 *
 * Everything is created with document.createElement and one injected <style>: no images, no fonts, no
 * framework, so the HUD adds nothing to the bundle but its own source and cannot pull a licensed
 * asset in through a back door.
 *
 * The debug line (tier, fps, draw calls) is hidden by default because it is diagnostic, not part of
 * the demo's look. Reveal it with `?debug=1` or the F3 key (main.ts owns that binding).
 */
import type { SkyriverHudEvent } from '../sim/session';
import type { SkyriverMode } from '../sim/systems';

const HUD_STYLE_ID = 'skyriver-hud-style';

/**
 * Mute, unbranded styling: translucent slate panels and a system monospace stack, so the HUD reads
 * over the night city without competing with the neon.
 */
const HUD_CSS = `
.skyriver-hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
  font: 500 13px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: #c9d4e4;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.skyriver-hud__readout {
  position: absolute;
  top: calc(12px + env(safe-area-inset-top, 0px));
  left: calc(12px + env(safe-area-inset-left, 0px));
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}
.skyriver-hud__badge {
  padding: 4px 9px;
  border: 1px solid rgba(150, 180, 220, 0.35);
  border-radius: 3px;
  background: rgba(8, 12, 20, 0.55);
  font-size: 12px;
}
.skyriver-hud__badge--mode-freefly {
  border-color: rgba(255, 126, 92, 0.55);
  color: #ffb49c;
}
.skyriver-hud__speed {
  font-size: 26px;
  line-height: 1;
  letter-spacing: 0.02em;
  color: #eaf1fb;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
}
.skyriver-hud__speed span {
  font-size: 11px;
  color: #8ea2bd;
  margin-left: 4px;
}
.skyriver-hud__boost {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #6f8099;
}
.skyriver-hud__boost-bar {
  width: 66px;
  height: 4px;
  border-radius: 2px;
  background: rgba(150, 180, 220, 0.2);
  overflow: hidden;
}
.skyriver-hud__boost-fill {
  display: block;
  height: 100%;
  width: 0%;
  background: #4fd2ff;
  transition: width 90ms linear;
}
.skyriver-hud__boost--active {
  color: #9fe6ff;
}
.skyriver-hud__flash {
  min-height: 14px;
  font-size: 11px;
  color: #7f93ae;
  opacity: 0;
  transition: opacity 180ms ease-out;
}
.skyriver-hud__flash--on { opacity: 1; }
.skyriver-hud__debug {
  position: absolute;
  bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  left: calc(12px + env(safe-area-inset-left, 0px));
  display: none;
  max-width: 70vw;
  padding: 5px 8px;
  border-radius: 3px;
  background: rgba(8, 12, 20, 0.6);
  font-size: 11px;
  letter-spacing: 0.02em;
  text-transform: none;
  color: #8ea2bd;
  white-space: pre-line;
}
.skyriver-hud__debug--on { display: block; }
.skyriver-hud__controls {
  position: absolute;
  right: calc(14px + env(safe-area-inset-right, 0px));
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: auto;
}
.skyriver-hud__button {
  min-width: 74px;
  padding: 11px 14px;
  border: 1px solid rgba(150, 180, 220, 0.4);
  border-radius: 4px;
  background: rgba(10, 16, 26, 0.6);
  color: #c9d4e4;
  font: inherit;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
  touch-action: manipulation;
}
.skyriver-hud__button:active,
.skyriver-hud__button--held {
  border-color: rgba(79, 210, 255, 0.8);
  background: rgba(24, 48, 68, 0.75);
  color: #e6f6ff;
}
.skyriver-hud__hint {
  position: absolute;
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: rgba(142, 162, 189, 0.75);
  text-align: center;
}
@media (max-width: 520px) {
  .skyriver-hud__hint { display: none; }
  .skyriver-hud__speed { font-size: 22px; }
}
`;

/** What the HUD shows each frame. All presentation values. */
export interface SkyriverHudState {
  readonly mode: SkyriverMode;
  /** Metres per second, before the boost multiplier (the sim's own `speed`). */
  readonly speed: number;
  /** True while boost is held and fuel remains. */
  readonly boosting: boolean;
  /** Seconds of boost held, 0..BOOST_MAX_SECONDS. Drives the bar. */
  readonly boostT: number;
  /** Boost seconds available, for the bar's full-scale. */
  readonly boostCapacity: number;
  readonly paused: boolean;
}

/** The debug line's fields (hidden unless the debug flag is on). */
export interface SkyriverHudDebug {
  readonly tier: string;
  readonly fps: number;
  readonly drawCalls: number;
  readonly drawCallBudget: number;
  readonly cars: number;
  readonly tick: number;
  readonly alpha: number;
  readonly adapter: string | null;
  readonly rollbacks: number;
}

export interface SkyriverHudOptions {
  /** Where the overlay mounts. main.ts passes #app. */
  readonly root: HTMLElement;
  /** Start with the debug line visible. */
  readonly debug?: boolean;
  /** MODE button. One tap must queue exactly one toggle. */
  readonly onModeTap: () => void;
  /** BOOST button, held: down and up are separate, because boost is a level not a pulse. */
  readonly onBoostDown: () => void;
  readonly onBoostUp: () => void;
}

export interface SkyriverHud {
  readonly element: HTMLElement;
  /** Per-frame refresh. Writes only the fields that changed, so it does not thrash layout. */
  update(state: SkyriverHudState): void;
  /** Debug line refresh. Cheap no-op while the line is hidden. */
  updateDebug(debug: SkyriverHudDebug): void;
  setDebugVisible(visible: boolean): void;
  toggleDebug(): boolean;
  readonly debugVisible: boolean;
  /** Shows one deduped sim event. Called from runner.subscribeEvents. */
  showEvent(event: SkyriverHudEvent): void;
  /** Total events shown. The browser probe asserts one toggle emits exactly one. */
  readonly eventCount: number;
  dispose(): void;
}

const MODE_LABEL: Readonly<Record<SkyriverMode, string>> = Object.freeze({
  0: 'autopilot',
  1: 'fly',
});

function installStyle(doc: Document): void {
  if (doc.getElementById(HUD_STYLE_ID) !== null) return;
  const style = doc.createElement('style');
  style.id = HUD_STYLE_ID;
  style.textContent = HUD_CSS;
  doc.head.appendChild(style);
}

function element<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createSkyriverHud(options: SkyriverHudOptions): SkyriverHud {
  const doc = options.root.ownerDocument;
  installStyle(doc);

  const element_ = element(doc, 'div', 'skyriver-hud');

  const readout = element(doc, 'div', 'skyriver-hud__readout');
  const modeBadge = element(doc, 'div', 'skyriver-hud__badge', MODE_LABEL[0]);
  const speed = element(doc, 'div', 'skyriver-hud__speed');
  const speedValue = doc.createElement('b');
  const speedUnit = doc.createElement('span');
  speedUnit.textContent = 'm/s';
  speed.append(speedValue, speedUnit);

  const boost = element(doc, 'div', 'skyriver-hud__boost');
  const boostLabel = doc.createElement('span');
  boostLabel.textContent = 'boost';
  const boostBar = element(doc, 'div', 'skyriver-hud__boost-bar');
  const boostFill = element(doc, 'i', 'skyriver-hud__boost-fill');
  boostBar.appendChild(boostFill);
  boost.append(boostLabel, boostBar);

  const flash = element(doc, 'div', 'skyriver-hud__flash');
  readout.append(modeBadge, speed, boost, flash);

  const debugLine = element(doc, 'div', 'skyriver-hud__debug');

  const controls = element(doc, 'div', 'skyriver-hud__controls');
  const modeButton = element(doc, 'button', 'skyriver-hud__button', 'mode');
  modeButton.type = 'button';
  const boostButton = element(doc, 'button', 'skyriver-hud__button', 'boost');
  boostButton.type = 'button';
  controls.append(modeButton, boostButton);

  const hint = element(
    doc,
    'div',
    'skyriver-hud__hint',
    'drag to steer · hold lower third to boost · wasd / arrows · b boost · m mode · f3 stats',
  );

  element_.append(readout, debugLine, controls, hint);
  options.root.appendChild(element_);

  let debugVisible = options.debug === true;
  debugLine.classList.toggle('skyriver-hud__debug--on', debugVisible);

  let eventCount = 0;
  let flashTimer: number | null = null;

  // Last-written values, so a 60 Hz update only touches the DOM when a field really changed.
  let lastMode: SkyriverMode | null = null;
  let lastSpeedText = '';
  let lastBoosting: boolean | null = null;
  let lastBoostPercent = -1;
  let lastPaused: boolean | null = null;
  let lastDebugText = '';

  function onModeClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    options.onModeTap();
  }

  function onBoostDown(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    boostButton.classList.add('skyriver-hud__button--held');
    // Keeps the up event on this button even if the finger slides off it.
    if (boostButton.setPointerCapture !== undefined) {
      try {
        boostButton.setPointerCapture(event.pointerId);
      } catch {
        // A browser that refuses capture still delivers pointerup on the document path.
      }
    }
    options.onBoostDown();
  }

  function onBoostUp(event: PointerEvent): void {
    event.stopPropagation();
    boostButton.classList.remove('skyriver-hud__button--held');
    options.onBoostUp();
  }

  modeButton.addEventListener('click', onModeClick);
  boostButton.addEventListener('pointerdown', onBoostDown);
  boostButton.addEventListener('pointerup', onBoostUp);
  boostButton.addEventListener('pointercancel', onBoostUp);
  boostButton.addEventListener('lostpointercapture', onBoostUp);

  return {
    element: element_,

    update(state: SkyriverHudState): void {
      if (state.mode !== lastMode) {
        lastMode = state.mode;
        modeBadge.textContent = MODE_LABEL[state.mode];
        modeBadge.classList.toggle('skyriver-hud__badge--mode-freefly', state.mode === 1);
      }

      const speedText = String(Math.round(state.speed * (state.boosting ? 1.8 : 1)));
      if (speedText !== lastSpeedText) {
        lastSpeedText = speedText;
        speedValue.textContent = speedText;
      }

      if (state.boosting !== lastBoosting) {
        lastBoosting = state.boosting;
        boost.classList.toggle('skyriver-hud__boost--active', state.boosting);
      }

      const percent = state.boostCapacity > 0
        ? Math.round(Math.min(state.boostT / state.boostCapacity, 1) * 100)
        : 0;
      if (percent !== lastBoostPercent) {
        lastBoostPercent = percent;
        boostFill.style.width = `${percent}%`;
      }

      if (state.paused !== lastPaused) {
        lastPaused = state.paused;
        modeBadge.textContent = state.paused ? 'paused' : MODE_LABEL[state.mode];
      }
    },

    updateDebug(debug: SkyriverHudDebug): void {
      if (!debugVisible) return;
      const budget = debug.drawCalls <= debug.drawCallBudget ? 'ok' : 'OVER';
      const text = [
        `tier ${debug.tier}  fps ${debug.fps.toFixed(1)}`,
        `draw ${debug.drawCalls}/${debug.drawCallBudget} ${budget}  cars ${debug.cars}`,
        `tick ${debug.tick}  alpha ${debug.alpha.toFixed(2)}  rollbacks ${debug.rollbacks}`,
        debug.adapter === null ? 'adapter unavailable' : `gpu ${debug.adapter}`,
      ].join('\n');
      if (text !== lastDebugText) {
        lastDebugText = text;
        debugLine.textContent = text;
      }
    },

    setDebugVisible(visible: boolean): void {
      debugVisible = visible;
      debugLine.classList.toggle('skyriver-hud__debug--on', visible);
    },

    toggleDebug(): boolean {
      debugVisible = !debugVisible;
      debugLine.classList.toggle('skyriver-hud__debug--on', debugVisible);
      return debugVisible;
    },

    get debugVisible(): boolean {
      return debugVisible;
    },

    showEvent(event: SkyriverHudEvent): void {
      eventCount += 1;
      flash.textContent = event.kind === 'mode'
        ? `${MODE_LABEL[event.mode]} engaged`
        : event.edge === 'start'
          ? 'boost'
          : 'boost released';
      flash.classList.add('skyriver-hud__flash--on');
      if (flashTimer !== null) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        flash.classList.remove('skyriver-hud__flash--on');
        flashTimer = null;
      }, 900) as unknown as number;
    },

    get eventCount(): number {
      return eventCount;
    },

    dispose(): void {
      if (flashTimer !== null) clearTimeout(flashTimer);
      modeButton.removeEventListener('click', onModeClick);
      boostButton.removeEventListener('pointerdown', onBoostDown);
      boostButton.removeEventListener('pointerup', onBoostUp);
      boostButton.removeEventListener('pointercancel', onBoostUp);
      boostButton.removeEventListener('lostpointercapture', onBoostUp);
      element_.remove();
    },
  };
}
