# Stick Zone: Exfil

High-action 3D stickman extraction shooter built on **Venus Platform Infrastructure**. Fight automated facility defenses, scavenge depot loot crates, manage ammo and arterial bleeding, survive against rival operatives and the Warlord boss, hold extraction zones, and settle verified receipts to the custody ledger.

Stick Zone is a pure client game on RUN.game. It runs entirely on existing Venus infrastructure with zero custom backend servers.

---

## Architecture & Venus Infrastructure Integration

Stick Zone relies strictly on first-party Venus monorepo services:

1. **Multiplayer & Room Authority (`server/mp-room-server`)**:
   - Authoritative multiplayer rooms powered by `@series-inc/rundot-syncplay`.
   - Real-time frame synchronization, input authority, and rollback-free deterministic tick pacing.
   - Connected via `MultiplayerCoordinator` (`src/sim/multiplayer.ts`) over the platform Syncplay WebSocket gateway (`/ws`) via `sdk.extraction`.

2. **Turnkey Extraction & Airlocks (`@series-inc/rundot-synchub`)**:
   - Turnkey spatial airlock choreography, corridor presentation countdowns, and handoff tickets via `@series-inc/rundot-syncplay/extensions/hub`.
   - Client state machine driven by `ExfilController` (`idle` -> `holding_zone` -> `corridor_presentation` -> `submitting_settlement` -> `extracted`).
   - Structural and cryptographic receipt validation via `verifyReceiptIntegrity` and canonical SHA-256 digest matching (`computeCanonicalOutcomeDigest`).

3. **Deterministic Simulation & Outcome Extraction (`server/raid-runtime-worker`)**:
   - Sandboxed background worker executing deterministic raid replay via `@series-inc/rundot-syncplay/modules/extraction`.
   - Verifies sequential inputs and extracts authoritative settlement outcomes without granting client-minted cash or items.

4. **SDK Simulation & Recipes (`@series-inc/rundot-game-sdk`)**:
   - Integrates with `rundotGameApi.simulation` for container state, recipes, inventory slots, and power previews.

5. **Client-Side Tactical Meta-Progression (`src/progression/stashStore.ts`)**:
   - Armory loadouts (weapons, armor tiers, stims), persistent bank, and leveling.
   - Zero-trust settlement: cash is credited exclusively from canonical digest-verified `SettlementReceipt` payloads (`outcomePayload.cashBanked`).
   - Anti-replay receipt ledger and anti-tamper SHA-256 storage checksums.

---

## Directory Structure

- `src/sim/` — Deterministic 60Hz physics, tactical combat, weapon ballistics, cover raycasting (`game.ts`), SyncHub airlock & settlement ledger adapter (`airlock.ts`), and Syncplay multiplayer client coordinator (`multiplayer.ts`).
- `src/progression/` — Authoritative stash store, operative leveling, loadout armory, contracts (`stashStore.ts`, `contracts.ts`).
- `src/input/` — Universal input abstraction supporting Keyboard/Mouse, Virtual Mobile D-Pad/Action buttons, and Gamepad API (`gamepadController.ts`).
- `src/components/` — React Three Fiber (R3F) 3D scene, cel-shaded stick operatives, dynamic drones and turrets, Tactical HUD, Mobile Controls, Hideout menu, and ExfilOverlay.
- `tests/` — Comprehensive Vitest test suite (8 test files, 206 test cases) covering game mechanics, combat invariants, Synchub airlocks, and zero-trust settlement verification.

---

## Development

```sh
npm run dev      # Launches local Vite client on :5196
npm run preview  # Previews compiled production bundle on :4196
```

## Build & Verification

```sh
npm run typecheck # Strict TypeScript compilation (tsc --noEmit)
npm run build     # Stages inkline assets and builds optimized production client bundle (dist/)
npm test          # Runs all 8 test suites (206 cases) via vitest
```
