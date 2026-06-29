import { StrictMode } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import RundotAPI from '@series-inc/rundot-game-sdk/api';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { appShellConfig } from './shell/config';
import { resolveLayoutMode } from './shell/layout';
import { attachPreloadLifecycle, preloadCoordinator, setPreloadLifecycleState } from './preload';
import { refreshSafeArea } from './services/SafeAreaService';
import { UiThemeProvider } from '@modules/ui/skin/theme/UiThemeProvider';
import { PreviewProvider } from './dev/PreviewProvider';
import { readPreviewRequest } from './dev/preview';
import { generatedRendererConfig } from './config/ui-renderer';
import { initializeRundot, setActiveScreenProvider } from './rundot/init';
import { recordGameOpened } from './systems/analytics';
import { useNavigationStore } from './stores/navigationStore';
import { getNotificationScheduler } from './systems/notification-scheduler';
import { consumeBootDeepLinks, fireAppOpenFunnelStep } from './polish/deep-links';
import { useFtueStore } from './systems/ftue-adapter';

// Consumer-owned CSS pipeline. Base theme ships with the provider; renderer
// theme + project overrides are imported here so the project layout is
// self-evident from the entry point.
import '@modules/ui/skin/renderers/active/theme.css';
import './config/ui-overrides.css';

// ── Layout detection ─────────────────────────────────────────────────────────
// Set data-layout on <html> at boot and on resize. The CSS shell uses
// [data-layout="landscape"] to flip .game-shell to flex-direction: row
// and reorder .nav-zone. Components adapt via container queries — no
// viewport media queries needed.

function detectLayout() {
  const previewOrientation = import.meta.env.DEV
    ? readPreviewRequest(window.location.search).orientation
    : null;
  document.documentElement.dataset['layout'] = resolveLayoutMode(
    window.innerWidth,
    window.innerHeight,
    previewOrientation ?? appShellConfig.orientation,
  );
}

detectLayout();
window.addEventListener('resize', detectLayout);

// ── Boot ─────────────────────────────────────────────────────────────────────

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

const root = createRoot(rootElement);

const render = (node: ReactNode) => {
  root.render(<StrictMode>{node}</StrictMode>);
};

function renderStartupError(error: unknown): void {
  const message = error instanceof Error ? error.message : 'An unexpected startup error occurred.';
  render(
    <div
      className="flex h-dvh w-full flex-col items-center justify-center gap-4 p-[var(--spacing-xl)] text-center text-[var(--ui-text-primary)] [background:var(--ui-page-bg)]"
      data-testid="app-startup-error"
      role="alert"
    >
      <div className="text-[32px] font-black">!</div>
      <div>
        <h1 className="text-[var(--font-xl)]">App failed to start</h1>
        <p className="mt-2 text-[var(--font-md)] text-[var(--ui-text-muted)]">{message}</p>
      </div>
      <button
        className="rounded-md border border-[var(--ui-panel-card-border)] px-4 py-2"
        onClick={() => window.location.reload()}
        type="button"
      >
        Reload App
      </button>
    </div>,
  );
}

function renderApp(): void {
  const appTree = (
    <UiThemeProvider config={generatedRendererConfig}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </UiThemeProvider>
  );

  render(import.meta.env.DEV ? <PreviewProvider>{appTree}</PreviewProvider> : appTree);
}

async function boot() {
  try {
    // 1. Show native loading screen immediately
    RundotAPI.preloader.showLoadScreen();
    RundotAPI.preloader.setLoaderProgress(0);

    // 2. Initialize SDK (must complete before any other SDK call)
    await RundotAPI.initializeAsync();
    attachPreloadLifecycle();
    setPreloadLifecycleState('ready');
    // 2a. Publish host safe-area insets to CSS vars before first render, so
    //     `.ui-safe-region` lays out correctly on the first frame.
    refreshSafeArea();
    // 2b. Wire BeatBoard SDK integrations: server time sync, profile +
    //     player_identity analytics, lifecycle session_end hook.
    setActiveScreenProvider(() => {
      const state = useNavigationStore.getState();
      const top = state.stack.length > 0 ? state.stack[state.stack.length - 1] : null;
      return (top ?? state.activeTab ?? 'unknown') as string;
    });
    await initializeRundot();
    // 2b-i. Wire local notifications scheduler — issue beat-board-26.
    //       Subscribes to lifecycle (background/foreground) and the
    //       entitlements store so trial grants schedule a `pack_trial_expiring`
    //       reminder. Server-time aware via `getServerNow()`.
    getNotificationScheduler().attach();
    // 2b-ii. Initialise FTUE engine before the React tree mounts. The Play
    //        screen also calls initialize() defensively, but kicking the
    //        condition runner up here means a fresh launch lands with the
    //        engine ready and the spotlight target already polled when the
    //        first paint arrives.
    try {
      await useFtueStore.getState().initialize();
      // Start the FTUE on the kit screen ('play'). startFtue is idempotent —
      // it no-ops when persistence already records progress, when the FTUE
      // is currentScreen mismatch, or when it's already started.
      useFtueStore.getState().startFtue('play');
    } catch (err) {
      RundotAPI.error('[Game] FTUE bootstrap failed', { err: String(err) });
    }
    // 2c. PRD § Analytics Events — `game_opened` fires once first paint is
    //     imminent (post-init, pre-render). entry_point uses the resolved
    //     launch intent when the host attached one, otherwise `cold_start`.
    // best-effort: a launch-intent RPC failure must not black-screen boot.
    let launchSource = '';
    try {
      const intent = await RundotAPI.app.resolveLaunchIntent();
      launchSource = (intent.params?.['source'] ?? '') as string;
    } catch (e) {
      RundotAPI.log('resolveLaunchIntent failed', e);
    }
    recordGameOpened({
      entry_point: launchSource || 'cold_start',
    });
    // 2c-i. Funnel anchor: `app_open` is the first step in the BeatBoard
    //       first-session conversion funnel. Per prd.md § Analytics Events,
    //       fire it once on boot before any user-driven step (first_pad_tap,
    //       first_record, …) can land.
    fireAppOpenFunnelStep();
    // 2c-ii. Deep-link consumption — route incoming notification taps and
    //        share-link launches now that the navigation store is configured
    //        (tabConfig is imported at App.tsx top-level, but the navigation
    //        store's `configure()` runs on import side-effect, so by the
    //        time we reach here it is initialised).
    await consumeBootDeepLinks();
    RundotAPI.preloader.setLoaderProgress(0.1);
    RundotAPI.log('[Game] SDK initialized');

    // 3. Run named preload stages instead of a flat critical asset list.
    RundotAPI.preloader.setLoaderText('Loading startup assets...');
    await preloadCoordinator.runStage('startup-critical', {
      presenterMode: 'native',
      onProgress: ({ loaded, total }) => {
        const ratio = total <= 0 ? 1 : loaded / total;
        RundotAPI.preloader.setLoaderProgress(0.1 + 0.4 * ratio);
      },
    });

    RundotAPI.preloader.setLoaderText('Preparing first screen...');
    await preloadCoordinator.runStage('first-screen-ready', {
      presenterMode: 'native',
      onProgress: ({ loaded, total }) => {
        const ratio = total <= 0 ? 1 : loaded / total;
        RundotAPI.preloader.setLoaderProgress(0.5 + 0.4 * ratio);
      },
    });

    // 4. Game-specific init goes here
    // e.g., load saved state from appStorage, fetch config, etc.
    // await loadGameState()

    // 5. Done — hide preloader and render
    RundotAPI.preloader.setLoaderProgress(1.0);
    RundotAPI.preloader.hideLoadScreen();

    renderApp();
    setPreloadLifecycleState('playing');

    RundotAPI.log('[Game] Rendered');
  } catch (error) {
    RundotAPI.error('[Game] Boot failed:', error);
    // Hide preloader even on error so the user isn't stuck on a loading screen
    RundotAPI.preloader.hideLoadScreen();
    renderStartupError(error);
  }
}

boot();
