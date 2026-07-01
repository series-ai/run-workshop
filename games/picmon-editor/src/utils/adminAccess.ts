// Gate admin / debug tooling to specific RUN.game account IDs or usernames.
// Add a new line per admin — use getMyUserId() (Settings tab) to find an ID,
// or match a known display username via ADMIN_USERNAMES below.
// Identifiers end up in the JS bundle at build time; security comes from the
// RUN.game platform identity (RundotGameAPI.getProfile()) which cannot be
// spoofed by the client.

import RundotGameAPI from '@series-inc/rundot-game-sdk/api';

const ADMIN_IDS: string[] = [
  '06zH5r7tYNT4IozcQnc3Ld44H2b2', // Luciano
  'L4je7FhRL1WikrNOySn1XWJqrb43', // Mike
  'NRA8QxNVWHPSrwsQq8sNzsar5qu1', // Mike
];

// v1.250 — username-based admin whitelist. Used when we want to grant
// admin to someone we know by handle but not yet by RUN.game user id.
// Case-insensitive match against `profile.username`. As soon as we have
// the user's id from `getMyUserId()` we should migrate them up to
// ADMIN_IDS so the check survives a username change.
const ADMIN_USERNAMES: string[] = [
  'Bork',
  'Wally',
];

/** Cached after first call so repeated checks don't refetch the profile. */
let cachedIsAdmin: boolean | null = null;

export async function isAuthorizedAdmin(): Promise<boolean> {
  if (cachedIsAdmin !== null) return cachedIsAdmin;
  // Dev shortcut: anyone running on the local Vite dev server is treated
  // as admin. The dev server's profile mock returns a synthetic ID that
  // won't match the production whitelist, so without this branch admin
  // tools (Trainer Gen, Wilds, FX, etc.) are unreachable locally —
  // exactly the friction we want when working on them. `import.meta.env.DEV`
  // is true only for `npm run dev`, and gets compiled away in production
  // bundles so this can't accidentally elevate a real user.
  if (import.meta.env.DEV) {
    cachedIsAdmin = true;
    return true;
  }
  if (ADMIN_IDS.length === 0 && ADMIN_USERNAMES.length === 0) {
    cachedIsAdmin = false;
    return false;
  }
  try {
    const profile = await RundotGameAPI.getProfile();
    if (ADMIN_IDS.includes(profile.id)) {
      cachedIsAdmin = true;
      return true;
    }
    const usernameLc = (profile.username ?? '').toLowerCase();
    if (usernameLc && ADMIN_USERNAMES.some((u) => u.toLowerCase() === usernameLc)) {
      cachedIsAdmin = true;
      return true;
    }
    cachedIsAdmin = false;
    return false;
  } catch {
    cachedIsAdmin = false;
    return false;
  }
}

/** Dev aid: grab the current user's ID so they know what to paste into .env.local */
export async function getMyUserId(): Promise<string | null> {
  try {
    const profile = await RundotGameAPI.getProfile();
    return profile.id ?? null;
  } catch {
    return null;
  }
}

/** Clear the isAdmin cache (used after hot-reloading the env). */
export function invalidateAdminCache(): void {
  cachedIsAdmin = null;
}

/**
 * Synchronous read of the cached admin flag for hot loops (e.g. the
 * per-frame Overworld portal check) that can't `await`. Returns false
 * if the async `isAuthorizedAdmin()` hasn't resolved yet — boot order
 * (App.tsx / SettingsTab / HelpMenu) calls the async path early so by
 * the time the player walks anywhere this is populated.
 *
 * In `npm run dev` `isAuthorizedAdmin()` returns true synchronously
 * via the DEV branch, so this returns true on the very first call.
 */
export function isAdminCached(): boolean {
  if (cachedIsAdmin !== null) return cachedIsAdmin;
  if (import.meta.env.DEV) {
    cachedIsAdmin = true;
    return true;
  }
  return false;
}
