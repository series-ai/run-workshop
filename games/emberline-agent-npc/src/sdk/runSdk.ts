/**
 * Thin app-shell wrapper around the RUN SDK: one-time init + lifecycle
 * registration. System templates (save, shop, ads, ...) import the SDK
 * directly; this module only owns the boot-time concerns.
 *
 * Posture (applies to ALL SDK usage): every RundotGameAPI call can reject,
 * and an unhandled rejection crashes the game — so everything here is
 * try/catch'd, and if init fails (e.g. no playground session yet) the
 * app must boot and run anyway.
 */
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
// Type-only import from the package root (the /api entry doesn't re-export it);
// erased at build time, so no extra runtime code is pulled in.
import type { Subscription } from '@series-inc/rundot-game-sdk';

let _ready = false;

/** True once initializeAsync resolved — i.e. the RUN host (or its dev mock) answered. */
export function sdkReady(): boolean {
    return _ready;
}

/**
 * Initialize the SDK. Call once, first thing in boot, before ANY other SDK
 * call. Never throws: if init fails it logs a warning and the game still boots
 * (SDK-backed features degrade in their own modules until a session exists).
 */
export async function initSdk(): Promise<boolean> {
    try {
        await RundotGameAPI.initializeAsync();
        _ready = true;
    } catch (err) {
        console.warn('[runSdk] initializeAsync failed — running without the RUN host (local dev?)', err);
    }
    return _ready;
}

/**
 * Lifecycle callbacks are `() => void` per the SDK types. Async handlers are
 * fine to pass: a Promise-returning function is assignable where a void
 * return is expected (the SDK just won't await it).
 */
export type LifecycleCallback = () => void;

/** All six hooks are optional. See registerLifecycles for what each means. */
export interface LifecycleConfig {
    onPause?: LifecycleCallback;
    onResume?: LifecycleCallback;
    onSleep?: LifecycleCallback;
    onAwake?: LifecycleCallback;
    onQuit?: LifecycleCallback;
    onBackButton?: LifecycleCallback;
}

/**
 * Register host lifecycle callbacks. All six hooks are optional; each SDK
 * hook returns an { unsubscribe() } handle, collected so hot-reload / scene
 * swaps can detach cleanly.
 *
 * Hook meanings (SDK docs):
 *   onPause/onResume — host overlay or brief focus loss: pause/resume loops + audio
 *   onSleep/onAwake  — long background suspend: persist progress / refresh stale data
 *   onQuit           — host teardown: last-chance flush (may NOT fire on hard close)
 *   onBackButton     — Android back button (no-op elsewhere); without a handler the
 *                      host quits by default — call RundotGameAPI.requestPopOrQuit()
 *                      yourself when your in-game back navigation is exhausted
 */
export function registerLifecycles(
    { onPause, onResume, onSleep, onAwake, onQuit, onBackButton }: LifecycleConfig = {}
): { unsubscribeAll(): void } {
    const subs: Subscription[] = [];
    const hook = (name: keyof LifecycleConfig, cb: LifecycleCallback | undefined) => {
        if (!cb) return;
        try {
            subs.push(RundotGameAPI.lifecycles[name](cb));
        } catch (err) {
            console.warn(`[runSdk] lifecycles.${name} registration failed`, err);
        }
    };
    hook('onPause', onPause);
    hook('onResume', onResume);
    hook('onSleep', onSleep);
    hook('onAwake', onAwake);
    hook('onQuit', onQuit);
    hook('onBackButton', onBackButton);
    return {
        unsubscribeAll() {
            for (const s of subs) {
                try { s?.unsubscribe?.(); } catch { /* already gone */ }
            }
            subs.length = 0;
        },
    };
}
