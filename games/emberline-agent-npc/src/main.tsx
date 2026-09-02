import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App.tsx';
import { initSdk, registerLifecycles } from './sdk/runSdk.ts';
import './styles/app.css';

/**
 * Boot sequence. The ORDER here matters — it's the pattern from a shipped RUN
 * game. Keep the numbered steps in this order; add your own work at the
 * marked points.
 */
async function boot() {
    // 1. SDK first. Nothing may call RundotGameAPI before this resolves.
    //    Resolves even if init fails, so boot never blocks.
    await initSdk();

    // 2. Mount React. The agent restores its durable session after this first
    //    paint, so the player sees the conversation shell at once.
    createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );

    // 3. Lift the boot cover once the application has painted.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const cover = document.getElementById('boot-cover');
            if (!cover) return;
            cover.classList.add('hidden');
            setTimeout(() => cover.remove(), 400); // matches the CSS transition
        });
    });

    // 4. Host lifecycle hooks. The journal is already durable at every agent
    //    boundary. Pause only stops active presentation work.
    registerLifecycles({
        onPause: () => window.dispatchEvent(new Event('run-agent-pause')),
        onSleep: () => window.dispatchEvent(new Event('run-agent-pause')),
    });
}

if (document.readyState === 'complete') boot();
else window.addEventListener('load', boot);
