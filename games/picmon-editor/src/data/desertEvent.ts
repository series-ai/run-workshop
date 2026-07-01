// 2026-05-13 — Pharaoh's Awakening limited-time event.
//
// Single source of truth for the desert event lifecycle. Every gate
// in the game (portal visibility, HUD currency chip, event quests,
// zone type buffs, intro modal first-fire) calls `isEventActive()`
// instead of duplicating date math. When we ship the event, set
// EVENT_START_MS / EVENT_END_MS to real launch and close timestamps;
// the rest of the codebase needs no further changes to "open" it.
//
// Lifecycle decision (locked, plan: pharaohs_awakening_event):
//   • Hard global date window. Real-world clock on the player's
//     device. Players who join late get locked out (FOMO model).
//   • Admins bypass the date gate via `isAdminCached()` so we can
//     preview pre-launch and post-close.
//   • Permanent rewards (dojo cap bonuses, Hieroglyph Tomb style
//     unlock) persist after window closes — these survive on player
//     storage, not on this flag.
//   • Scarab Coin balance: stays visible after window closes
//     (souvenir behavior). Earn paths gate on `isEventActive()`,
//     so post-close the balance can't grow. Spend paths (if any
//     ship) ALSO gate on the flag, so the balance freezes.
//   • To switch to "wipe on close" behavior: flip the
//     SOURVENIR_AFTER_CLOSE flag below to false; a one-shot
//     cleanup runs at next boot once the close date passes.

import { isAdminCached } from '../utils/adminAccess';

/** Stable event id. Used in portal gates, quest defs, analytics. */
export const EVENT_ID = 'desert_pharaoh' as const;

/** Human-readable name for UI / modals / quest titles. */
export const EVENT_NAME = "Pharaoh's Awakening" as const;

/**
 * Real-world launch timestamps (ms epoch).
 *
 * 2026-05-21 (v1.457) — Public rollout window locked. 7-day window
 * starting at UTC midnight today through UTC midnight 2026-05-28
 * (exclusive). UTC anchor means every player gets the same close
 * deadline regardless of timezone — no "did the event end yet?"
 * ambiguity for players near the cutoff.
 *
 * 2026-05-28 (v1.543) — End extended to midnight Pacific tonight
 * (2026-05-29 07:00 UTC = 00:00 PDT). Players have been complaining
 * the event closed too early on UTC midnight while it was still
 * Thursday afternoon for US players; this 31h extension gives the
 * entire Pacific-evening cohort a proper final session. After this
 * window the event closes for good — wire the countdown chip in
 * the World HUD so players see the deadline approaching.
 *
 * Tip: use `Date.parse('2026-06-01T00:00:00Z')` for UTC clarity, or
 * pick a midnight local-time anchor if we want a per-region rollout.
 */
export const EVENT_START_MS = Date.parse('2026-05-21T00:00:00Z');
export const EVENT_END_MS = Date.parse('2026-05-29T07:00:00Z');

/**
 * 2026-05-16 — Admin-controlled event window override.
 *
 * Stored in localStorage so an admin can "open the event now" (or close
 * it early) without shipping a new build. When set, both lifecycle
 * functions below read from the override INSTEAD of the hardcoded
 * EVENT_START_MS / EVENT_END_MS constants. Clearing the override
 * (setEventWindowOverride(null)) reverts to the constant fallback.
 *
 * Only admins should ever write this — the UI lives in PharaohSubTab.
 * Stored values are simple numeric timestamps (ms epoch); we tolerate
 * "undefined" / corrupt strings by treating them as "no override set".
 */
const EVENT_WINDOW_OVERRIDE_KEY = 'picmon_desert_event_window_override_v1';

interface EventWindowOverride {
  startMs: number;
  endMs: number;
}

export function getEventWindowOverride(): EventWindowOverride | null {
  try {
    const raw = localStorage.getItem(EVENT_WINDOW_OVERRIDE_KEY);
    if (!raw || raw === 'undefined' || raw === 'null') return null;
    const parsed = JSON.parse(raw);
    if (
      parsed
      && typeof parsed.startMs === 'number'
      && typeof parsed.endMs === 'number'
      && parsed.endMs > parsed.startMs
    ) {
      return { startMs: parsed.startMs, endMs: parsed.endMs };
    }
    return null;
  } catch {
    return null;
  }
}

export function setEventWindowOverride(window: EventWindowOverride | null): void {
  try {
    if (window === null) {
      localStorage.removeItem(EVENT_WINDOW_OVERRIDE_KEY);
    } else {
      localStorage.setItem(EVENT_WINDOW_OVERRIDE_KEY, JSON.stringify(window));
    }
  } catch {
    /* swallow — degraded mode means override won't persist, that's fine */
  }
}

/** Effective start timestamp — admin override if set, else constant. */
export function getEffectiveStartMs(): number {
  return getEventWindowOverride()?.startMs ?? EVENT_START_MS;
}

/** Effective end timestamp — admin override if set, else constant. */
export function getEffectiveEndMs(): number {
  return getEventWindowOverride()?.endMs ?? EVENT_END_MS;
}

/**
 * If true, the Scarab Coin balance stays visible in the HUD after
 * the event window closes (as a souvenir of participation). The
 * coin can't be spent (no post-event sinks ship in v1) and the
 * earn paths are gated by `isEventActive()`, so the balance simply
 * freezes at whatever the player ended with. Flip to false to wipe
 * the balance to zero at close instead (more aggressive FOMO).
 */
export const SOUVENIR_AFTER_CLOSE = true;

/** True if the desert event is currently live for normal players,
 *  OR the viewer is an admin (admins always see event content for
 *  pre-launch / post-close QA). Pure — pass `now` from tests.
 *
 *  2026-05-16 — Reads effective start/end (admin override wins over the
 *  hardcoded constants) so flipping the override opens / closes the
 *  event for every screen the moment it's set.
 */
export function isEventActive(now: number = Date.now()): boolean {
  if (isAdminCached()) return true;
  return now >= getEffectiveStartMs() && now < getEffectiveEndMs();
}

/** True if the event is live for normal players right now (admin
 *  bypass NOT applied). Used by the analytics / metrics layer when
 *  we want to distinguish admin-preview traffic from real player
 *  activity in dashboards. */
export function isEventActiveForPlayers(now: number = Date.now()): boolean {
  return now >= getEffectiveStartMs() && now < getEffectiveEndMs();
}

/** True if the event window has fully closed (real-world clock past
 *  the effective end). Used to detect "souvenir mode" for the HUD chip
 *  and any post-event cleanup hooks. */
export function isEventClosed(now: number = Date.now()): boolean {
  return now >= getEffectiveEndMs();
}

/** True if the event hasn't opened yet for normal players. Mostly
 *  used by admin tools to surface "scheduled for X" vs "live now". */
export function isEventUpcoming(now: number = Date.now()): boolean {
  return now < getEffectiveStartMs();
}

/** Milliseconds remaining until the event ends. Returns 0 if the
 *  event is already closed. Used by the rules infographic countdown. */
export function msUntilEventEnd(now: number = Date.now()): number {
  return Math.max(0, getEffectiveEndMs() - now);
}

/** v1.543 — Shared "Xd Yh" / "Xh Ym" / "Xm Ys" / "Xs" formatter. Lifted
 *  from DesertEventIntroModal so the World HUD countdown chip uses the
 *  same string format as the rules infographic. Caller decides which
 *  resolution it cares about (the chip ticks once per second when the
 *  remaining window drops under 60 minutes so the final-hour read feels
 *  alive; before that it ticks once per minute). */
export function formatEventRemaining(ms: number): string {
  if (ms <= 0) return 'Closed';
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const hrs  = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days >= 2) return `${days}d ${hrs}h`;
  if (totalSec >= 3600) return `${hrs}h ${mins}m`;
  if (totalSec >= 60)   return `${mins}m ${secs}s`;
  return `${secs}s`;
}

/* ─── First-fire flags ─────────────────────────────────────────────
 * Localstorage-backed "seen this event modal" flags. Device-scoped on
 * purpose so a player who finishes the event on one account doesn't
 * have to re-read the intro on the next. The values are timestamps so
 * we can correlate "saw intro at T, completed at T+Δ" if we ever want
 * funnel analytics on the event onboarding.
 */
const INTRO_SEEN_KEY = 'picmon_desert_intro_seen_v1';
const COMPLETION_SEEN_KEY = 'picmon_desert_completion_seen_v1';
const LAST_CHANCE_SEEN_KEY = 'picmon_desert_last_chance_seen_v1';

/**
 * v1.544 — Last-chance window. Once `msUntilEventEnd()` drops below
 * this threshold, `DesertEventLastChanceModal` fires once per device
 * to give the player a final read of what's about to lock and a
 * shortcut into the shop to burn their remaining scarab balance.
 *
 * 2h chosen as a balance between:
 *   • Long enough for late-evening visitors to actually do something
 *     with the warning (run a session, claim outstanding quest
 *     rewards, blow scarabs on a final pack).
 *   • Short enough that we don't fire it while the player still has
 *     half a day to play — that would feel like nagging.
 *
 * The "seen" flag is keyed per-event-end so a future event re-firing
 * the modal works automatically (we cycle EVENT_END_MS each rollout
 * and the key bakes in that timestamp via setDesertLastChanceSeen).
 */
const LAST_CHANCE_THRESHOLD_MS = 2 * 60 * 60 * 1000;

function readFlag(key: string): boolean {
  try {
    const raw = localStorage.getItem(key);
    return !!raw && raw !== 'undefined' && raw !== 'null' && raw !== '';
  } catch {
    return false;
  }
}

function writeFlag(key: string): void {
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch { /* ignore — degraded mode just re-fires the modal */ }
}

export function hasSeenDesertIntro(): boolean {
  return readFlag(INTRO_SEEN_KEY);
}

export function markDesertIntroSeen(): void {
  writeFlag(INTRO_SEEN_KEY);
}

export function hasSeenDesertCompletion(): boolean {
  return readFlag(COMPLETION_SEEN_KEY);
}

export function markDesertCompletionSeen(): void {
  writeFlag(COMPLETION_SEEN_KEY);
}

/**
 * v1.544 — Last-chance flag. We bake the current EVENT_END_MS into the
 * value so the next event re-rolls a fresh "unseen" state without
 * needing a separate cleanup migration: when the close timestamp
 * changes, `hasSeenDesertLastChance()` reads the old timestamp from
 * storage and returns false because it doesn't match.
 */
export function hasSeenDesertLastChance(): boolean {
  try {
    const raw = localStorage.getItem(LAST_CHANCE_SEEN_KEY);
    if (!raw || raw === 'undefined' || raw === 'null') return false;
    return raw === String(getEffectiveEndMs());
  } catch {
    return false;
  }
}

export function markDesertLastChanceSeen(): void {
  try {
    localStorage.setItem(LAST_CHANCE_SEEN_KEY, String(getEffectiveEndMs()));
  } catch { /* degraded mode — modal may re-fire on next boot, acceptable */ }
}

/**
 * v1.544 — True when the last-chance modal should auto-fire on the
 * current World render. Gated on: event is live for PLAYERS (not just
 * admin override), the remaining window is under the 2h threshold,
 * and the player hasn't dismissed it yet. Admin-only sessions never
 * see the modal — admins are testing across the boundary, they don't
 * need the FOMO copy. Pure: pass `now` from tests to control timing.
 */
export function shouldShowDesertLastChance(now: number = Date.now()): boolean {
  if (!isEventActiveForPlayers(now)) return false;
  if (hasSeenDesertLastChance()) return false;
  const remaining = msUntilEventEnd(now);
  return remaining > 0 && remaining <= LAST_CHANCE_THRESHOLD_MS;
}

export { LAST_CHANCE_THRESHOLD_MS };
