import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import RundotAPI from '@series-inc/rundot-game-sdk/api';
import App from './App';

async function boot(): Promise<void> {
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Root element not found');

  try {
    RundotAPI.preloader.showLoadScreen();
    // Must complete before any other SDK call. Bounded so a hung init can't
    // wedge the app behind the load screen forever.
    await Promise.race([
      RundotAPI.initializeAsync(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('RUN SDK init timed out')), 5000),
      ),
    ]);
  } catch (error) {
    // The playground is usable standalone in a plain browser, so a failed SDK
    // init (no sandbox session / signed-out) is not fatal.
    console.warn('RUN SDK initialization failed; continuing standalone.', error);
  }
  try {
    RundotAPI.preloader.hideLoadScreen();
  } catch {
    // No host preloader (plain browser) — nothing to hide. Kept out of
    // `finally` so a throwing hideLoadScreen can't mask an init error or
    // produce an unhandled rejection.
  }

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
