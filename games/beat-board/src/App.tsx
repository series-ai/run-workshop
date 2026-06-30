import { Suspense, lazy, useEffect, useState } from 'react';
import { TabBar } from './components/TabBar';
import { Toaster } from './components/Toaster';
import {
  getDebugConsoleState,
  subscribeToDebugConsole,
} from './debug-console/controller';
import { PerformanceOverlay } from './debug-console/PerformanceOverlay';
import { TuningOverlay } from './tuning';
import { PreloadOverlay } from './preload';
import { useDebugConsoleHotkeys } from './debug-console/useDebugConsoleHotkeys';
import { useDebugConsoleTouchGesture } from './debug-console/useDebugConsoleTouchGesture';
// Importing tabConfig configures the navigation store as a side effect, so it
// must land in the module graph before the store is read.
import './tabs/tabConfig';
import { setCurrentScreen, installDebugApi } from './dev/DebugApi';
import { installLogBuffer } from './debug-console/logBuffer';
import { installBeatBoardDebugApi } from './systems/debug-api';
import { installFxBypassWiring } from './audio/fx-bypass-wiring';
import { installEngineTickDriver } from './audio/engine-tick';
import { hydrateSession } from './systems/session-persistence';
import { hydrateMixesAtBoot } from './stores/mixesStore';
import { BottomSheetRoot } from './modules/ui/bottom-sheet/BottomSheetRoot';
import { NavigationModalHost } from './components/shell/NavigationModalHost';
import {
  useCurrentScreen,
  useCurrentScreenId,
  useTabBarVisible,
  useDesktopNavMode,
} from './stores/navigationStore';
import './style.css';

// Install debug API synchronously so automation and support tooling can query it
// before React effects run.
installDebugApi();
// Tee console.* + RundotAPI.log/error/warn into a circular buffer so the
// 3-tap debug overlay's Logs panel can show + copy them. Mobile users
// can't open browser devtools — the buffer is their only way to inspect
// runtime logs.
installLogBuffer();
// Layer the BeatBoard-specific namespace on top of the baseline so smoke
// tests, FTUE bypass keys, and harnesses can query game state without
// reaching into stores directly.
installBeatBoardDebugApi();
// Phase 3 of `.project/plans/groovepad-alignment-plan-2026-04-29.md`. The
// flanking FX-toggle columns flip per-(category, side) cells of
// `padGridStore.fxBypass`; this wiring forwards each flip into the
// per-pad wet-send gain on the audio graph so the FX bus actually engages.
installFxBypassWiring();
// Drive the pad-grid engine's `tick(audioTime)` periodically so one-shot
// fades and explicit deactivations auto-remove pads from `activePadIds`
// once their fade-out lands. Without this, one-shots scheduled by short-tap
// would stay highlighted forever.
installEngineTickDriver();
// Wire the live stores to `appStorage` so the player's last-selected pack
// + active pads survive a reload. `hydrateSession` reads the persisted
// blob and stashes pad activations in a pending slot — PadGridScreen
// then prompts the player to resume or reset, and only afterwards
// installs the persistence subscription so the auto-write doesn't
// clobber the saved state before the player has decided.
void hydrateSession();
// Read every saved mix's metadata + IDB-stored mp4 blob so the Mixes
// tab survives a refresh. Fire-and-forget: the call is best-effort and
// any failure logs through RundotAPI.error inside the system.
void hydrateMixesAtBoot();

const LazyDebugConsoleShell = lazy(async () => ({
  default: (await import('./debug-console/DebugConsoleShell')).DebugConsoleShell,
}))

function App() {
  useDebugConsoleHotkeys();
  useDebugConsoleTouchGesture();
  const [debugConsoleOpen, setDebugConsoleOpen] = useState(() => getDebugConsoleState().open);

  const currentScreenId = useCurrentScreenId();
  const currentScreen = useCurrentScreen();
  const tabBarVisible = useTabBarVisible();
  const desktopNavMode = useDesktopNavMode();

  useEffect(() => {
    setCurrentScreen(currentScreenId ?? 'none');
  }, [currentScreenId]);

  useEffect(() => subscribeToDebugConsole(() => {
    setDebugConsoleOpen(getDebugConsoleState().open);
  }), []);

  const contentKey = currentScreenId ?? 'none';
  const tabContent = currentScreen ? currentScreen.render() : null;
  const isPushed = currentScreen?.type === 'pushed';

  return (
    <>
      {/* Game shell — zone layout */}
      <div className="game-shell" data-current-screen={contentKey} data-e2e-state="ready" data-testid="app-shell">
        <main className="game-zone">
          <div className="content-area">
            <div className={`tab-content ${isPushed ? 'screen-fade-in' : 'tab-fade-in'}`} key={contentKey}>
              {tabContent}
            </div>
          </div>
        </main>
        {tabBarVisible && (
          <nav className="nav-zone" data-desktop-nav={desktopNavMode}>
            <TabBar />
          </nav>
        )}
      </div>

      <BottomSheetRoot />
      {/* ConfirmDialogRoot self-mounts via the confirmation-dialog
          module's portal on first `show()` call. Mounting it here would
          double-render the dialog. */}
      <NavigationModalHost />
      <Toaster />
      <PreloadOverlay />
      <PerformanceOverlay />
      <TuningOverlay />
      {debugConsoleOpen ? (
        // Promote the debug console into a stacking context above FTUE
        // (backdrop z-index 700), modal overlay (800), and tuning (1000) so it
        // remains reachable when those layers are active. Keep this value in
        // sync across all project App.tsx copies.
        <div style={{ position: 'relative', zIndex: 1500 }}>
          <Suspense fallback={null}>
            <LazyDebugConsoleShell />
          </Suspense>
        </div>
      ) : null}
    </>
  );
}

export default App;
