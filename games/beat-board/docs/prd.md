# BeatBoard — Product Requirements

> Pad-grid music maker. Tap pads on a 4×4 grid; each pad fires a seamless loop layer (drums, bass, melody, FX) at the kit's locked BPM and key. Layers are pre-quantized so any combination plays cleanly together — the player cannot make a clash. Layered loops compose a beat, the beat can be recorded, and the recording can be shared as an mp4.

This PRD is the implementation contract. Every screen, system, price, timing, and integration is specified here. Decisions are traced to their source in `.project/prd-decisions.md`.

---

## Product Strategy

This section is the output of the playbook analysis step. It anchors every numeric value in the rest of the PRD.

### Playbooks Consulted

| Playbook | Category | Key Takeaway Applied |
|---|---|---|
| `rundot-platform-pricing` | iap-monetization | All pricing in Runbucks; subscription tiers gate benefits, prices fetched at runtime via `getSubscriptions`. |
| `first-time-conversion-bundles` | iap-monetization | "Price at 99 Runbucks. The goal is maximum conversion, not revenue optimization." Drives the post-first-record Welcome Pack. |
| `try-before-you-buy` | iap-monetization | "Experiencing value firsthand is the most effective sales tool" — the free hero pack is the conversion engine for paid pack purchases. |
| `cosmetics` | iap-monetization | "Multiple price points (100–500 / 800–1500 / 1500–2500 Runbucks)" maps directly onto Genre Pack / Themed Pack / Pack Pass tiers; "Price legendary at 3–5x common" preserves the Themed-vs-Genre price gap. |
| `iap-bundles` | iap-monetization | Pack Pass priced at 1499 Runbucks per bundle's "mid-tier sweet spot 499–1499" guidance; bundles tell a story (Pack Pass = "all current packs + next 3 generated drops"). |
| `subscription-systems` | retention | CORE/PLUS only in v1 with "no ads" + daily Runbucks drip; PRIME/ULTIMATE deferred because no benefit material justifies the higher tier. |
| `rewarded-video-ads` | ad-monetization | "Opt-in is the most player-friendly format" — single placement (Try-a-Pack), cap at 3/day to avoid forcing-opt-in dark pattern. |
| `interstitial-ads` | ad-monetization | Excluded — confirms premium-with-IAP-cap games skip interstitials; supports the "no interstitials" position rather than recommending one. |
| `guided-progression` | retention | "Keep tutorial prompts under 15 words per step", "first reward reachable in <90s", "tutorial completable in <5 minutes". Drives FTUE step copy and timing. |
| `login-rewards` | retention | Daily Runbucks drip via subscription tier (CORE 50/day, PLUS 200/day) is login-gated and uses the multi-day-reward module pattern. |
| `push-notifications` | retention | One re-engagement notification at 24h after last session — minimal, opt-in respectful, premium-game-appropriate cadence. |
| `themed-events` | liveops | Read but deferred — every-month subscriber-only generated kit sits in v1.5; full themed events are post-launch. |

### Recommendations Applied

> **Runbucks display rule**: All in-game prices are quoted in Runbucks. The platform currency icon is rendered at runtime via `useRunbucksIcon()`; in screen specs and copy, prices appear as `{amount} {Runbucks icon}` (e.g., `"Get Welcome Pack — 99 {Runbucks icon}"`). Subscriptions never quote a numeric price — UI copy uses `{localizedPrice}` resolved by `RundotAPI.iap.getSubscriptions()` at runtime.

- **Welcome Pack price = 99 Runbucks** (per `first-time-conversion-bundles`: *"Price at 99 Runbucks. The goal is maximum conversion, not revenue optimization."*).
- **Genre Pack standard price = 299 Runbucks** (per `cosmetics`: *"100–500 Runbucks for simple recolors"* — single-genre kits are the commodity tier).
- **Themed Pack premium price = 499 Runbucks** (per `cosmetics`: *"3–5x the cost of common skins"* — at 1.67x the standard pack, with rarity preserved by themed-only generated kits and per-pack intro animation).
- **Pack Pass bundle price = 1499 Runbucks** (per `iap-bundles`: *"Mid-tier bundles (499–1499 Runbucks) should represent the highest volume of bundle revenue"* — sweet spot for the "all current packs + next 3 drops" promise).
- **Free hero pack** (per `try-before-you-buy`: *"experiencing value firsthand is the most effective sales tool"*) — unlimited play, unlimited recording, mp4 share. The icebreaker only fires after the player has lived in the hero pack and recorded an mp4.
- **Subscription tier ratio CORE 50/day → PLUS 200/day** (per `rundot-platform-pricing` Track 2 — "Daily currency drip amounts should scale with tier" — and the Decision Log Unsourced Decisions footnote calibrating the multiplier; PLUS tier is 4x because PLUS also gates cloud mix backup, the multiplier reflects two benefits not one).
- **Rewarded ad cap = 3 per day** (per `rewarded-video-ads`: *"3-4 ads/player/day for those who opt in"*).
- **Rewarded ad reward = 24-hour temporary access to one paid pack** (per `try-before-you-buy`: temporary access is the trial pattern; combined with `rewarded-video-ads` "opt-in is the most player-friendly format").
- **No interstitials** (per `interstitial-ads` allowance for premium games + research finding "Ad density is the #1 churn driver in freemium").
- **No energy / stamina** (per `energy-systems` only fits engagement-cap gameplay; BeatBoard's no-brake-pedal design philosophy is incompatible).
- **FTUE step copy ≤15 words each** (per `guided-progression`: *"Keep text in tutorial prompts under 15 words per step"*).
- **FTUE total under 5 minutes** (per `guided-progression`: *"Tutorial completable in under 5 minutes"*; in BeatBoard the linear FTUE is 3 spotlight steps targeting first-tap → second-tap → record).
- **Daily login reward gate via login screen** (per `login-rewards`: drip is login-gated, not auto-credited).
- **Push notification cadence = single 24h re-engagement** (per `push-notifications`: low cadence preserves premium-game tone).

### Research ↔ Playbook Reconciliation

| Feature | Comp Observation | Playbook Guidance | Decision | Rationale |
|---|---|---|---|---|
| Pre-recording interstitial | Groovepad shows an interstitial *before* recording starts (one of its 5 spend triggers, per research summary) | `interstitial-ads` allows skipping in premium games; `rewarded-video-ads` prefers opt-in | Follow playbook | Groovepad's pre-record interstitial is cited in 22% of negative reviews ("Ad density is the #1 churn driver", research risk #1). Premium-with-IAP-cap thesis says no interstitials. |
| Rewarded-video pack unlock | Groovepad's *most-praised* mechanic — unlock a pack by watching ads, **keep the pack permanently** | `rewarded-video-ads` + `try-before-you-buy` recommend rewarded ads grant *temporary* access so they don't cannibalize IAP | Compromise | Rewarded ad in BeatBoard grants 24-hour access to one paid pack (temporary), which is the "try-before-you-buy" lineage; the player can then convert via Runbucks IAP for permanent ownership. Resolves the cannibalization risk without removing the most-praised competitor mechanic. |
| Subscription pricing tiers | Groovepad uses weekly / monthly / annual subscription tiers at competitor-set retail prices (research summary "Monetization shape") | `rundot-platform-pricing` says games never set subscription prices — platform owns them | Follow playbook | Architectural; pricing is fetched via `getSubscriptions()`. We pick which platform tier (CORE / PLUS) gates which benefit. |
| Top-50 mix leaderboard | Incredibox runs a public Top 50 chart for shared mixes (research differentiation opp #4) | `basic-leaderboards` works best with a quantifiable score; user-generated content moderation is heavy infra | Follow playbook | Deferred to v2. UGC moderation is heavy infrastructure; mixes have no objective score. |
| Beat School-style lessons | Groovepad has per-pack tutorial lessons (research design pillar #3) | `guided-progression` prefers contextual learning over heavy tutorial ladders | Follow playbook | BeatBoard's hero pack is large enough (≥32 pads) that the player can self-teach; contextual FTUE on first record + first long-press is sufficient. AI-coached patterns deferred to v2 per overview. |

### Recommendations Deferred

| Playbook | Recommendation | Reason Deferred |
|---|---|---|
| `themed-events` | Limited-time themed events (e.g., a Halloween pack drop) | v1 ships hero pack + 4-6 generated packs. Themed events require a content cadence we haven't validated yet. v1.5+. |
| `basic-leaderboards` | Top-mix charts | UGC moderation infrastructure is out of scope; mixes have no objective score for ranking. v2 alongside async remix relay. |
| `social-chat-systems` | Player-to-player chat | No friend graph in v1 (CLAUDE.md: defer identity to platform); chat sits behind async-remix-relay which is v2. |
| `daily-goal-chests` | Daily quest chest unlock loop | Conflicts with no-brake-pedal philosophy — players come to BeatBoard to make a thing, not check off chores. |
| `battle-passes` | Seasonal battle pass with free + premium tracks | Content production cadence too high for a small team in v1; revisit if v1 retention proves the audience. |
| `friend-guild-gifts` | Gifting between friends | No friend graph in v1. Async remix relay (v2) is the social-graph foothold; gifting layers on top of that. |
| `achievement-systems` | Persistent achievement / badge collection | Shallow value for an audio toy in v1; recording portfolio (My Mixes) is the de-facto achievement surface. v2+ if telemetry shows demand. |

---

## UI Renderer Recommendation

- Recommended renderer variant ID: `neutral-base`
- Canonical renderer name: Flexible Baseline
- Design family: Baseline
- Match signals: `baseline`, `flexible`, `neutral`, `generalist`, `systems`, `utility`
- Why it fits: BeatBoard is an audio-tool-as-game with a clean, calm chrome and one dominant content surface (the pad grid). Audio is the identity surface, not the visual chrome — the renderer should stay out of the way. Neutral-base's selection profile lists "systems-heavy games that need neutral chrome" and "projects likely to lean on overrides.css for final tuning" as bestFor signals, both of which apply: pad grid + transport bar + recording HUD are systems-heavy, and visual fine-tuning will land via `src/config/ui-overrides.css` after visual design.
- Why the other renderer variants are weaker fits:
  - `cozy-casual` adds warm paper textures and tabletop materiality; that fights an electronic music tool. Listed under avoidKeywords for any non-cozy brief.
  - `arcade-casual` is energetic and chunky; BeatBoard's tone is calm/lofi (per Decision Log: "Lead genre is `lofi-hiphop`"), not high-energy arcade.
  - `ornate-fantasy` and `neon-scifi` / `industrial-scifi` mismatch the lofi aesthetic at the personality level — neutral-base avoidKeywords explicitly include "fantasy", "ornate", "neon", "cyberpunk".
  - `editorial-narrative` would match if BeatBoard had heavy text/copy; it doesn't.
- Override plan: none

The renderer is already locked at scaffold time (`status.json.uiRendererVariantId: neutral-base`); this section reaffirms that selection.

---

## Asset Packs

`status.json.assetIds` is `[]`. BeatBoard is an audio-only game — no 2D/3D asset packs are required.

> Note: No asset pack specified. Visual assets will use placeholders or custom art produced during the visual design pass. The audio-content pack (loop kits) is delivered through the loop-kit pipeline (`rundot generate` + `tools/generate-kit.ts`), not the standard asset-pack mechanism.

---

## Core Loop

The session arc is **Open → tap pads → record → share**. The first reward fires within 30 seconds of first launch.

1. **0–3s** — Player taps app icon → splash → land on `Pad Grid` screen with the hero pack pre-selected. Empty grid (16 dimmed pad outlines), single inline instruction "Tap a pad" (Koala/Incredibox empty-state precedent). Transport bar at bottom shows BPM (e.g., "84") and a steady metronome flash. **Sensory beat**: ambient pad pulse begins on the beat as the screen mounts (`juice/beat-sequencer` drives a subtle 1px glow on every empty pad — the grid is *alive* before the player has done anything).
2. **3–10s** — Player taps any pad. The first tap fires **immediately** (~10 ms head past the audio clock — Groovepad's "tap once, hear yourself instantly" hook per `research/groovepad/teardown.md:32`) and ramps in over the bar-aligned fade duration. Pad lights up, color fades in. **Sensory beat**: the player heard themselves make a thing within ~100 ms. *Astonishment that competence was free* — the universal genre hook (research cross-game pattern #2) fires here, and the previous ~3 s of dead air on the first tap is gone.
3. **10–60s** — Player taps a second, third, fourth pad. Now that the grid has rhythm, each tap fades in over one full bar starting at the next bar boundary (≈ 2.86 s pre-roll at 84 BPM, then a one-bar ramp — Groovepad's "tap and wait for the beat" feel). Cross-color taps stack — tapping a bass pad after a drums pad layers both — but a second drums tap replaces the first under the harmonic-lockout rule (one pad per color at a time). The grid pulses on every beat. **Sensory beat**: layers stack into a 4-piece beat (one per color) the player can rearrange by re-tapping; the absence of clashes makes every combination sound intentional. Player has not touched a tempo or key control because none exist. FTUE step 2 fires after the second pad-tap with the prompt "Press and hold a pad to lock it on." (skippable; auto-completes if the player long-presses on their own).
4. **60–120s** — Player has 4-6 active pads. The "I made a thing" moment lands. They tap the **Record** button in the transport bar. An 8-bar countdown begins (visible bar/beat counter); recording captures audio + animated grid as mp4. **Sensory beat**: the record button pulses red on the beat during capture; a circular bar-count fills around it. FTUE step 3 fires here: "Tap Record when it sounds good" (only if not yet recorded).
5. **120–150s** — Recording completes. Auto-navigates to `Recording Review` modal: poster frame of the pad grid, audio playback scrubber, three actions (Save, Share, Discard). Player taps **Share** → native share-link sheet opens via `data/share-service`. **Sensory beat**: the recording becomes a thing the player can show others. Welcome Pack offer (99 {Runbucks icon}) appears as a banner above the share sheet, one time only — research cross-game pattern #3 ("Recording is the bridge from toy to identity object") combined with the icebreaker pattern.
6. **Loop again or close** — Player either taps **Back to Grid** (continues a session, possibly browsing the **Pack Drawer** on the left side of the grid screen) or backgrounds the app. If a recording was made this session, a local notification is scheduled for 24h later.

**Failure / rejection path**: There is no fail state by architecture — every kit's loops are authored at the same BPM and key, and the phase-locked source pool keeps every layer aligned regardless of which pads the player stacks (research cross-game pattern #1). The only "rejection" path is the empty-grid state on first launch, which carries the FTUE prompt until the player taps any pad. If the audio engine fails to load a kit (network error, decode error), the grid shows a loud `Reload kit` button with the error reason — this is rare but explicit. If the recording capture errors mid-session (MediaRecorder failure on Safari iOS — research risk #2), the Recording Review modal shows "Recording failed — try again" and re-enables the Record button without losing the active loop set.

**Game end**: There is no game-end state. Sessions end when the player backgrounds the app. `My Mixes` persists every saved recording across sessions.

**Loop reason to do it again**: New generated packs land in the Pack Drawer over time (subscriber-only generated kit each month for CORE/PLUS subscribers, plus all paid Pack purchases). The hero pack feels samey by ~Day 3 (the wall moment per Decision Log) — the player either pays for a Genre Pack or watches a rewarded ad to try one for 24 hours.

---

## Navigation Architecture

- **Nav pattern**: Bottom tab bar (4 tabs) — chosen because BeatBoard has four root surfaces of equal weight: the pad grid (creation), My Mixes (recording portfolio), the Pack Drawer (content acquisition), and Settings (audio + subscription + about). A stack-only model would bury the pack drawer; a hamburger drawer would hide it from new players. Tabs make all four discoverable in one glance. Settings was promoted from a top-right gear modal on Play to a 4th tab in the 2026-04-26 nav simplification — that reclaim made the Play screen's top row empty (the prior pack-name chip was removed at the same time, so the kit name now lives only on the bottom transport rail).
- **Tab bar** (always visible except in fullscreen overlays):

| Tab | Icon (semantic) | Label | Badge behavior | Root screen |
|---|---|---|---|---|
| Play | `gamepad` | Play | Hidden | `Play` |
| Mixes | `cards` | Mixes | Numeric badge of unviewed recordings (resets on tab open) | `Mixes` |
| Packs | `shop` | Packs | "NEW" dot when a new pack lands (subscriber drop, generated pack arrival, purchased pack downloaded) | `Packs` |
| Settings | `settings` | Settings | Hidden (no badge in v1; reserved for future-feature toggles) | `Settings` |

- **Screen types**:
  - **Root screens** (own a tab): `Play`, `Mixes`, `Packs`, `Settings`
  - **Pushed screens** (from a root): `RecordingReview` (also a modal — see below), `KitDetail` (from Packs tap)
  - **Modal sheets** (overlay current screen): `RecordingReview`, `PackPurchaseSheet`, `WelcomePackOffer`, `RewardedAdConfirmSheet`, `Credits`
  - **Full-screen overlays** (suppress tab bar): `FtueOverlay` (over `Play`)
- **Global chrome**:
  - Status bar treatment: respects platform (read via `RundotAPI.safeArea`)
  - Bottom transport bar (only on `Play`): BPM label, Record button, Mute-all toggle, Pack name
  - Persistent Runbucks balance chip top-right of `Packs` only
- **Deep links**:
  - `idle_reminder` notification → `Play` (with the same pack the player last used)
  - `share_link_received` (player taps a friend's shared mp4 link) → `Mixes` with the imported mix as the top entry. The mix is always playback-only (license-safe — no raw loop access).

Hierarchy:

```
Tab Bar
├── Play → Play (root)
│   ├── (modal) RecordingReview
│   ├── (modal) WelcomePackOffer
│   ├── (modal) RewardedAdConfirmSheet
│   └── (overlay, suppresses tab bar) FtueOverlay
├── Mixes → Mixes (root)
│   └── (modal) RecordingReview (replay an existing mix)
├── Packs → Packs (root)
│   ├── (push) KitDetail
│   ├── (modal) PackPurchaseSheet
│   └── (modal) Credits
└── Settings → Settings (root)
    └── (modal) Credits

Deep Links
├── idle_reminder (24h) → Play
└── share_link_received → Mixes (imported mix focused)
```

**Orientation behavior**: BeatBoard is **portrait-only** (locked at scaffold time, `status.json.orientation: portrait`). No landscape adaptation work is needed. Tab bar at bottom in portrait. The pad grid + bottom transport is a natural one-handed layout per Decision Log.

---

## Screen Inventory

| Screen Name | Type | Entry Point | Purpose |
|---|---|---|---|
| `Play` | Root/Tab | App launch, Play tab tap | Tap pads to layer loops. Primary gameplay surface. |
| `Mixes` | Root/Tab | Mixes tab tap, post-recording auto-nav | Browse, replay, re-share, delete saved recordings |
| `Packs` | Root/Tab | Packs tab tap, Pack name tap on transport bar | Browse hero pack + paid packs + subscriber drops; trigger pack purchase or rewarded preview |
| `RecordingReview` | Modal | After recording completes, or tap a mix in Mixes | Preview recorded mp4, save / share / discard |
| `KitDetail` | Pushed | Tap a kit card in Packs | Pack hero art, kit description, sample pads, purchase / preview CTA |
| `PackPurchaseSheet` | Modal | Tap "Get [Pack]" CTA in KitDetail | Confirm Runbucks spend, render `iap-purchase-flow` UI |
| `WelcomePackOffer` | Modal | First mp4 recording completion in first session | One-time icebreaker IAP at 99 {Runbucks icon} |
| `RewardedAdConfirmSheet` | Modal | Tap "Try this pack — watch ad" on KitDetail | Confirm rewarded ad watch; show reward (24h pack access) |
| `Settings` | Modal | Top-right gear on Play | Audio volume, mute toggle, subscription status, link to Credits |
| `Credits` | Modal | "Credits" link in Settings | About, open-source attributions, version info |
| `FtueOverlay` | Full-screen overlay | First session, contextual unlock | Spotlights pad, record button, long-press hint per FTUE config |

---

## Shared UI Widgets

These compound widgets render on more than one screen. Each becomes a tier-0.5 issue in the plan; screen issues `use:` these files instead of re-owning them.

| Widget | Owner Screen | Also rendered on | Component file | Purpose |
|---|---|---|---|---|
| `PadCellGrid` | `Play` | `KitDetail` (preview-only mode), `RecordingReview` (poster frame) | `src/components/widgets/PadCellGrid.tsx` | 4×4 grid of `PadCell` components with shared color/state model |
| `TransportBar` | `Play` | `RecordingReview` (replay transport) | `src/components/widgets/TransportBar.tsx` | BPM label, Record/Stop button, Mute-all, current pack name |
| `KitCard` | `Packs` | `Mixes` (mix's source-pack chip), `KitDetail` (hero header) | `src/components/widgets/KitCard.tsx` | Compact pack tile: hero art, name, price-or-owned chip, badge dot |
| `RunbucksPriceChip` | `Packs` | `KitDetail`, `PackPurchaseSheet`, `WelcomePackOffer` | `src/components/widgets/RunbucksPriceChip.tsx` | "{amount} {Runbucks icon}" chip backed by `useRunbucksIcon()` |

---

## Screen Specifications

### Screen: Play

**Layout**: Top of screen = empty (the previous pack-name chip and Settings gear were removed in the 2026-04-26 simplification — Settings is now a 4th bottom-nav tab, and the kit name still appears on the bottom transport rail). Middle = `PadCellGrid` 4×4 filling ~70% of vertical space. Bottom = `TransportBar` fixed full-width (BPM label, Mute-all toggle, Record button as the visual anchor, current pack chip on far right tappable to open Pack Drawer focused at this pack).

**UI Elements**:
- `PadCellGrid` (shared): the 4×4 pad grid. Each cell has 4 visual states (idle / hover / active / muted). Color comes from the kit's pad metadata (one of 4 palette colors mapped to 4 instrument families: drums, bass, melody, FX).
- `TransportBar` (shared): bottom-fixed. Contains:
  - BPM label (left): `Badge.Counter` showing kit BPM (e.g., "84"). Read-only — tempo is locked.
  - Mute-all toggle (mid-left): `Button.Icon` with `mute` icon; tap toggles all-pads-muted.
  - Record button (center): `Button.Primary` (large), pulses red on beat during recording. Idle label: "Record". Recording label: "Recording — bar 3/8".
  - Pack chip (right): kit name; tap → `Packs` at this pack. This is the only persistent surface for the active kit name on Play after the top-left chip was removed.
- Empty state inline copy: "Tap a pad" rendered as `Text.Hint` over the grid when no pads have been activated this session AND FTUE step 1 is the active step. Disappears the moment any pad is tapped.

**Interactions** (Groovepad two-gesture model — research/groovepad/features.md:7,30 "Tap = one-shot trigger; press-and-hold = latch"):
- Pad short-tap (pointer-up before 400ms) → fire a one-shot. When the grid is empty, the fade-in starts immediately (~10 ms head — Groovepad's "tap once, hear yourself instantly" hook). Once the grid has rhythm, the fade-in is bar-aligned: a quarter-bar fade-in at the next bar boundary, full gain for one bar, then a one-bar fade-out. Pad enters `activePadIds` synchronously (cell highlights immediately) and auto-removes once the fade-out lands. Same-color harmonic lockout still applies: a one-shot drums fire while a drums pad is latched evicts the latch at the same bar boundary the one-shot fires. Cross-color stacking is unchanged — drums + bass + melody + fx coexist freely.
- Pad long-press (≥400ms) → latch the pad. When the grid is empty, the latch fade-in starts immediately (same first-tap-immediate path as the one-shot). Once the grid has rhythm, latched pads ramp in over one full bar at the next bar boundary. Latched pads stay in `activePadIds` indefinitely until tapped off (toggle path unchanged from v1) or replaced under same-color lockout.
- **There is no mute gesture.** Groovepad has no mute (`research/groovepad/features.md:7,30`); the mute concept was removed end-to-end (engine API, store fields, UI overlays, debug API, analytics event, FTUE copy). To silence a layer, tap an already-latched pad to deactivate it, or tap a different pad in the same column and let harmonic lockout retire the prior one. The Decision Log "Solo-pad behavior is *not* in v1" still holds.
- BPM label long-press → no-op in v1 (UI never exposes tempo). Reserved as future "tap to see kit metadata" affordance.
- Record button tap → enter recording state. The next bar boundary starts the 8-bar capture. While capturing, the button shows "Recording — bar N/8" and pulses red on every beat. Tap during recording → confirm-cancel sheet ("Discard recording?"); confirming returns to idle state with no save.
- Master mute (`Mute-all`) tap on the transport bar → silences the master output stream while leaving every pad's `active` state intact (visual chrome dims slightly so the player can tell). This is the master output mute, distinct from any per-pad mute (which does not exist).
- Pack chip on the transport rail tap → opens `Packs` focused at the current pack.

**States**:
- Loading: grid shows 16 skeleton pad outlines pulsing on the beat (driven by `juice/beat-sequencer` even before audio buffers are ready); transport bar shows "—" for BPM. Lasts until first kit decode completes (target <1.5s). If kit fetch fails, transitions to Error.
- Empty (no pads tapped this session yet): "Tap a pad" hint visible. Pad outlines dimly visible. This is also the FTUE step 1 state.
- Populated (1+ pads active): pads colored, looping, transport bar BPM visible, grid pulses on the beat.
- Recording: grid same as Populated; Record button shows progress; tap-to-cancel is the only allowed grid action besides toggling pads (player can layer or remove during capture — captured audio reflects whatever pads are active at each moment).
- Error: top banner reads "Couldn't load [kit name] — Reload kit". `Button.Primary` "Reload kit" retries fetch.

**Navigation**:
- Pack chip on transport rail → `Packs` tab
- Settings → `Settings` tab (bottom-nav, 4th tab; replaced the top-right gear)
- Record completion (bar 8 finishes) → auto-pushes `RecordingReview` modal

**Orientation adaptation**: Portrait-only; no adaptation specified.

---

### Screen: Mixes

**Layout**: Top: page title "My Mixes" + count badge. Below: vertical scrolling list of mix entries (most recent first). Each entry is a horizontal card: poster frame (left), title + relative timestamp + source pack chip (middle), play / share kebab (right). Empty state replaces the list when count = 0.

**UI Elements**:
- Page header: `Heading` "My Mixes ([N])"
- Mix list: `List` with rows of:
  - Poster frame (4:5 aspect): semantic `Panel.Card` thumbnail, frozen `PadCellGrid` poster from mid-recording
  - Title: editable on long-press (default = "Mix [N] · [date]")
  - Source pack: `KitCard` mini variant
  - Play/pause inline button: tap toggles audio playback inline
  - Kebab menu: Share / Rename / Delete
- Mix count badge in tab bar: clears on tab open

**Interactions**:
- Tap mix row → opens `RecordingReview` modal (replay mode)
- Inline play button → plays/pauses mp4 audio inline (no full-screen)
- Long-press title → inline rename input
- Kebab → action sheet with Share, Rename, Delete (Delete confirms via `ui/confirmation-dialog`)
- Pull-to-refresh → re-syncs mix list from storage (expected to be a no-op; protects against multi-device edge cases)

**States**:
- Loading: 3 skeleton rows
- Empty: centered icon `recording`, copy "No mixes yet — tap Record on a beat", CTA `Button.Primary` "Open Pad Grid" → switches to Play tab. (Empty state is justified here: Mixes is the "user-generated content" surface specified in Screen Specs guidance.)
- Populated: list rendered; tab badge reflects unviewed count
- Error: `Panel.Banner` "Couldn't load mixes" with retry button

**Navigation**: tap row → `RecordingReview` modal; CTA in empty state → Play tab.

**Orientation adaptation**: Portrait-only.

---

### Screen: Packs

**Layout**: Top: persistent Runbucks balance chip (right). Below: section headers — "Owned" (always shows hero pack + any purchased packs), then "Available" (paid packs the player can buy or preview), then optionally "Subscriber Exclusive" (visible only to subscribers; shows the monthly subscriber-only generated kit). Each section is a horizontal scroll of `KitCard` widgets.

**UI Elements**:
- Top-right Runbucks balance chip: `RunbucksPriceChip` variant showing wallet balance via `RundotAPI.iap.getHardCurrencyBalance()`. Tap → `RundotAPI.iap.openStore()` (Runbucks top-up).
- Section header `Owned`: shows hero pack always; shows additionally any pack the player has purchased or has unexpired rewarded-ad access to (with "24h trial" countdown chip on the latter)
- Section header `Available`: paid packs not yet owned, sorted by featured first (one Themed Pack featured at a time)
- Section header `Subscriber Exclusive`: visible only when `RundotAPI.iap.isUserSubscribed('CORE')` returns true; shows the current month's subscriber-only kit
- `KitCard` widgets (shared): each shows pack hero art, pack name, BPM range, and either an Owned chip or a `RunbucksPriceChip` ("299 {Runbucks icon}", "499 {Runbucks icon}", or "1499 {Runbucks icon}" for Pack Pass)
- Footer link: "Credits & Attribution" → opens `Credits` modal

**Interactions**:
- Tap any `KitCard` → push `KitDetail`
- Tap "+" on the Runbucks chip → `RundotAPI.iap.openStore()`
- Long-press a Themed Pack card → "Try for 24h" prompt → `RewardedAdConfirmSheet`

**States**:
- Loading: skeleton cards in each section
- Empty: only fires for the Subscriber Exclusive section if the player isn't subscribed (in which case the section is hidden, not empty); not applicable for Owned (hero pack is always there)
- Populated: as designed
- Error: top banner "Couldn't load pack catalog" with retry

**Navigation**:
- KitCard tap → `KitDetail` (push)
- Long-press Themed Pack → `RewardedAdConfirmSheet`
- Runbucks chip → SDK store
- Credits link → `Credits` modal

**Orientation adaptation**: Portrait-only.

---

### Screen: KitDetail

**Layout**: Top: full-bleed hero art (16:9, ~30% of vertical). Below: pack name, BPM range, layer count chips (e.g., "8 layers · 32 pads"). Sample pad row (4 representative pads the player can preview-tap with a 1-bar audio sting). Pack description copy (1-2 sentences flavor). Bottom CTA area: either "Owned — Play" or `RunbucksPriceChip` purchase button or "Try for 24h — Watch ad" rewarded button.

**UI Elements**:
- Hero art: `Panel.Hero` 16:9
- Title row: `Heading` (pack name) + `Badge.Status` (BPM range)
- Layer chips: `Badge.Counter` row for layer count, instrument count
- Sample pad row: 4 `PadCell` components in preview mode — tap plays a 1-bar (≤2s) audio sting, does not enter the pad-grid loop state
- Pack description: `Text.Body` 1-2 sentences
- Purchase CTA (mutually exclusive based on state):
  - If owned: `Button.Primary` "Play this pack" → switch to `Play` with this kit selected
  - If not owned: `Button.Primary` `RunbucksPriceChip` "Get [Pack] — 299 {Runbucks icon}" → opens `PackPurchaseSheet`
  - If has 24h rewarded access: `Button.Secondary` "Trial — [time remaining]" + small `Button.Primary` "Buy permanently — 299 {Runbucks icon}"
  - If not owned + rewarded ad ready: secondary `Button.Outline` "Try for 24h — Watch ad" → `RewardedAdConfirmSheet`. Hidden if `RundotAPI.ads.isRewardedAdReadyAsync()` returns false or daily cap (3) reached.
- Back button (top-left): `Button.Icon` `back` → pops to `Packs`

**Interactions**:
- Sample pad tap → preview audio sting (1 bar), pad lights briefly
- Buy CTA → `PackPurchaseSheet`
- Try-for-24h → `RewardedAdConfirmSheet`
- Play CTA (owned) → switch to Play tab with this pack active

**States**:
- Loading: skeleton hero + skeleton CTAs
- Populated: as designed
- Error: hero art falls back to neutral gradient + pack name; sample pads show "Couldn't load samples" with retry; CTAs still functional (purchase doesn't require samples)

**Navigation**: PackPurchaseSheet (modal) / RewardedAdConfirmSheet (modal) / Play (root tab switch on Play CTA)

**Orientation adaptation**: Portrait-only.

---

### Screen: RecordingReview

**Layout**: Modal sheet from bottom. Top: poster frame of the recording (frozen `PadCellGrid` from mid-recording). Below: `TransportBar` in replay mode (play/pause, scrubber, total time chip). Three primary action buttons: Save (when not yet saved), Share, Discard. If already saved (entered from Mixes), shows: Share, Rename, Delete.

**UI Elements**:
- Drag handle (top-center): standard sheet handle
- Poster frame: 4:5 thumbnail, frozen at mid-recording (bar 4 of 8)
- Replay transport: `TransportBar` (replay variant — no record button; play/pause + scrubber)
- Title field: editable text input, default "Mix [N] · [date]"
- Save: `Button.Primary` (only on first review)
- Share: `Button.Primary` (post-save) or `Button.Secondary` (pre-save)
- Discard / Delete: `Button.Tertiary` (red, requires confirmation)
- Rename: `Button.Tertiary`
- (First-recording-only) "🎁 Get the Welcome Pack — 99 {Runbucks icon}" banner above the action buttons. One-time only per Decision Log; persists as `welcomePackShown` flag in appStorage.

**Interactions**:
- Play/pause → toggle replay
- Scrubber drag → seek
- Save → persist mix to `My Mixes` and to platform storage (mp4 to local + the metadata JSON to `RundotAPI.storage`)
- Share → invokes `RundotAPI.social.shareLinkAsync()` via `data/share-service`. Share copy template: "I made a beat in BeatBoard 🎵 [link]"
- Discard → `ui/confirmation-dialog` "Discard this mix?" → on confirm, drops the audio buffer and dismisses modal
- Welcome Pack banner tap → opens `WelcomePackOffer` modal (replaces current modal)
- Modal dismiss (drag down or back-press) → if not yet saved, treats as Discard with confirmation

**States**:
- Loading: skeleton poster + disabled actions while audio buffer finalizes (target <500ms)
- Populated (post-record): all actions enabled
- Populated (replay from Mixes): no Save button, just Share/Rename/Delete
- Error: poster falls back to "Recording failed — try again" copy with `Button.Primary` "Back to Pad Grid". Triggered when MediaRecorder errors mid-capture (research risk #2 — "Recording reliability is the #1 feature complaint").

**Navigation**:
- Save → modal stays open, action set updates
- Share → native share-link sheet appears, returns to modal
- Welcome Pack banner → `WelcomePackOffer` modal
- Dismiss → `Play` (or `Mixes` if entered from there)

**Orientation adaptation**: Portrait-only.

---

### Screen: PackPurchaseSheet

**Layout**: Modal sheet. Top: pack hero art (small). Middle: pack name, "What's inside" line ("32 pads · 8 layers · BPM 80–95"), price `RunbucksPriceChip` ("299 {Runbucks icon}" or "499" or "1499"). Confirm CTA: `Button.Primary` "Confirm purchase". Cancel: `Button.Tertiary`.

**UI Elements**:
- Drag handle
- Hero art (small, ~120pt tall): `Panel.Hero` mini
- Pack name `Heading`
- "What's inside" `Text.Subtle`
- Price chip: `RunbucksPriceChip` showing the resolved Runbucks price
- Wallet chip (small, right of price): "Your balance: [N] {Runbucks icon}"
- Confirm CTA: `Button.Primary` "Confirm purchase"
- "Add Runbucks" link: `Button.Tertiary` only shown if balance < price → opens SDK store
- Error banner area: appears on purchase failure

**Interactions**:
- Confirm → calls `RundotAPI.iap.spendCurrency(productId, amount)` via `monetization/iap-purchase-flow`
  - On success: dismiss modal, fire toast "[Pack] unlocked!", auto-switch to Play tab with pack selected
  - On insufficient balance: show inline error, surface "Add Runbucks" link
  - On any other error: show inline error with copy-able diagnostic
- Add Runbucks → `RundotAPI.iap.openStore()`
- Cancel / dismiss → close sheet

**States**:
- Loading: confirm button disabled with spinner during purchase
- Populated: as designed
- Error: per failure type above

**Navigation**: dismisses to whatever pushed it (KitDetail). On success, auto-navigates to Play.

**Orientation adaptation**: Portrait-only.

---

### Screen: WelcomePackOffer

**Layout**: Modal sheet. Hero art top (welcome banner). Title "Welcome Pack". Body lists contents: "+1 Lofi Heights extension kit · +500 Runbucks". Price chip "99 {Runbucks icon}". Confirm + Maybe Later actions.

**UI Elements**:
- Hero banner: `Panel.Hero`
- Title `Heading` "Welcome Pack — for new producers"
- Contents list `Text.Body`:
  - "Lofi Heights · Extended Edition (8 extra pads, 2 extra layers)"
  - "+500 Runbucks (kickstart your library)"
- Price chip "99 {Runbucks icon}"
- Wallet chip "Your balance: [N] {Runbucks icon}"
- `Button.Primary` "Get Welcome Pack — 99 {Runbucks icon}"
- `Button.Tertiary` "Maybe later"
- One-time copy footer: `Text.Subtle` "This offer is one-time only."

**Interactions**:
- Get → routes through `iap-purchase-flow` like a normal pack purchase but flagged as `firstPurchase: true`
- Maybe later → dismiss modal; persist `welcomePackShown: true`. Offer never re-appears.
- Modal dismiss → treated as Maybe later

**States**:
- Loading: confirm disabled with spinner during purchase
- Populated
- Error: inline failure copy with retry

**Navigation**: dismisses to RecordingReview.

**Orientation adaptation**: Portrait-only.

---

### Screen: RewardedAdConfirmSheet

**Layout**: Small modal sheet. Title "Try [Pack] for 24 hours". Body describes the reward. Confirm + Cancel actions.

**UI Elements**:
- Title `Heading` "Try [Pack name] for 24 hours"
- Body `Text.Body` "Watch a short ad to unlock 24 hours of access to this pack. Watch up to 3 ads per day."
- Daily-cap chip `Badge.Counter` "Today: [N]/3 watched"
- `Button.Primary` "Watch ad"
- `Button.Tertiary` "Cancel"

**Interactions**:
- Watch ad → calls `RundotAPI.ads.showRewardedAdAsync()` via `monetization/rewarded-ad-flow`
  - On reward complete: grant 24h pack access (`entitlements-service` adds a `pack_trial_<packId>` entitlement with TTL 24h), dismiss modal, fire toast "[Pack] unlocked for 24h", auto-switch to Play tab with pack
  - On dismiss before reward: dismiss with no grant
  - On not-ready: hide the rewarded affordance entirely upstream (this sheet should not appear if `isRewardedAdReadyAsync` is false)
- Cancel → close

**States**:
- Loading: button disabled while ad is being shown
- Populated
- Error: "Ad not available right now — try again later" inline message

**Navigation**: dismisses to KitDetail.

**Orientation adaptation**: Portrait-only.

---

### Screen: Settings

**Layout**: Modal sheet. List of toggles and links. Bottom: footer with version + Credits link.

**UI Elements**:
- Section "Audio":
  - Master volume slider (0-100): `Slider` bound to `ui/settings-overlay` master gain
  - Mute toggle: `Toggle` bound to mute store
- Section "Subscription":
  - Current tier label: "Free", "CORE", or "PLUS" (read via `RundotAPI.iap.isUserSubscribed`)
  - Manage subscription `Button.Secondary` → opens platform subscription manager OR shows tier picker if Free
- Section "About":
  - Credits link → `Credits` modal
  - Version label `Text.Subtle` "v[package.json.version]"

**Interactions**:
- Volume slider → updates `audio-manager` master gain in real-time
- Mute toggle → mutes/unmutes audio engine
- Manage subscription (subscribed) → `RundotAPI.iap.openStore()` or platform-equivalent management URL
- Manage subscription (not subscribed) → opens `Pack Pass / Subscription` purchase sheet (BeatBoard's subscription is offered through KitDetail's PackPurchaseSheet for the Pack Pass + a tier picker accessed here)
- Credits → `Credits` modal

**States**:
- Loading (rare): skeleton labels while subscription state hydrates
- Populated: as designed
- Error: subscription label falls back to "—" with retry

**Navigation**: dismisses to Play.

**Orientation adaptation**: Portrait-only.

---

### Screen: Credits

**Layout**: Modal sheet. Scrollable. Sections for Made by, Open source, Version.

**UI Elements**:
- Title `Heading` "Credits"
- Section `Heading.Sub` "Made by" — team list (placeholder until visual design)
- Section `Heading.Sub` "Open source" — placeholder for module attributions
- Section `Heading.Sub` "Version" — `Text.Subtle` "v[package.json.version] · build [hash]"

Audio is generated via the `rundot` CLI and is workshop-owned content; the RUN platform pipeline does not require an in-app generator attribution, so there is no audio-attribution section.

**Interactions**: scrolls; no further nav.

**States**: static.

**Navigation**: dismisses to wherever opened (Settings or Packs).

**Orientation adaptation**: Portrait-only.

---

### Screen: FtueOverlay

**Layout**: Full-screen overlay rendered above `Play` by `onboarding/ftue-engine` + `onboarding/tutorial-overlay`. Spotlight cutout highlights the target element; positioned tooltip sits adjacent. Tab bar suppressed.

**UI Elements**:
- Spotlight mask: rectangular cutout around the `data-ftue` target
- Tooltip: small `Panel.Card` with prompt copy + "Got it" dismiss button (only on the first step; subsequent steps auto-complete on action)
- Skip-all link bottom-center on step 1 only: `Text.Hint` "Skip"

**Interactions**:
- Tap target (spotlit pad / record button / etc.) → step's completion trigger fires → auto-advance
- Skip → `ftue-engine.skipAll()` → marks FTUE complete, persists to appStorage
- Outside-spotlight tap → dismiss tooltip without skipping (overlay stays for next step)

**States**: per-step rendered states; on full FTUE completion, overlay unmounts.

**Navigation**: stays on Play throughout.

**Orientation adaptation**: Portrait-only.

---

## Game Modes

BeatBoard has **two distinct surfaces of play**, neither is a "mode" in the genre-game sense — they share the same underlying engine and pad grid layout.

- **Free Play (default)** — entry point: `Play` tab. The standard surface. Tap pads, layer loops, optional record. Unlimited time, unlimited tries. No score, no win condition.
- **Mix Replay** — entry point: tap a saved mix in `Mixes`. Opens `RecordingReview` with the original poster frame and replay transport. The pad grid is *not* interactive in this mode — it's an mp4 playback. Distinct UI: no Record button on transport, no pad-tap interactions, just play/pause/seek.

Per Decision Log: solo only in v1. No async remix relay (deferred to v2). No realtime jam (deferred — engineering challenge per research).

Shared vs distinct UI: `PadCellGrid` and `TransportBar` widgets are reused, with the TransportBar in two variants (Record / Replay). `PadCell` has 3 visual states (idle, hover, active) and one extra "preview pulse" state used in `KitDetail` sample row. **There is no `muted` state** — Groovepad has no mute gesture (`research/groovepad/features.md:7,30`) and the mute concept was removed end-to-end as part of the alignment pass.

---

## Mechanics Detail

### Pad grid: tap, latch, lockout

- v1 visual layout: **4 rows × 6 visual columns** — 16 sound pads (4 per row) flanked by 2 FX-toggle columns (one on each side of every row). Sound columns are split into a left "cool" half (cols 1–2) and a right "warm" half (cols 3–4); both halves carry pads of the same row category (drums, bass, melody, fx — top→bottom). The mirrored cool/warm bank split is what telegraphs "verse / chorus" performance to the player without explanation, mirroring Groovepad's category-leader layout (`research/groovepad/features.md:29`). The flanking FX-toggle columns are NOT sound pads — they flip a per-row, per-side FX-bypass flag (`padGridStore.fxBypass[category][side]`) that Phase 3 of `.project/plans/groovepad-alignment-plan-2026-04-29.md` wires into the FX bus; Phase 2 only persists the toggle state and renders the on/off chrome (`research/groovepad/features.md:31`). Phase 4 expands the layout to Groovepad-sized 6 rows × 10 sound columns once the content pipeline can author 50-loop packs.
- Each pad belongs to **exactly one** of 4 instrument color families: drums (warm red), bass (deep purple), melody (warm yellow), FX (cool teal). Color drives the row this pad sits in AND the harmonic-lockout key. Each pad also carries a `bank: 'cool' | 'warm'` field that drives only visual placement — lockout is keyed off `color` (the row), not `bank`. Color and bank are both metadata baked into the kit at content authoring / generation time, not runtime-computed.
- **Two-gesture model (Groovepad's defining design pillar — `research/groovepad/features.md:7,30`)**:
  - **Short-tap = one-shot.** Pointer-up before the 400ms long-press threshold fires `padGridStore.triggerOneShot(padId)`. The engine schedules a quarter-bar fade-in 0 → 1 at the next bar boundary, holds at full gain for one bar, then a one-bar fade-out 1 → 0. Pad enters `activePadIds` synchronously (cell highlights immediately) and auto-removes once the fade-out lands via `pendingRemovals` + the periodic `engine-tick` driver.
  - **Long-press ≥ 400ms = latch.** Pointer-down held past the threshold fires `padGridStore.activate(padId)`. The pad ramps in over a full bar at the next bar boundary and stays in `activePadIds` indefinitely until tapped off or replaced under same-color lockout. Tap-on-already-latched still toggles off (optimistic-removal + bar-aligned fade-out) — that is the intentional escape hatch when the player wants to drop a layer without waiting for a same-color tap.
  - The gesture model lets skilled creators perform live (latch the bass, tap-tap-tap the leads as melodic variation) while keeping the chord-of-loops feel that Groovepad players settle into. Most pad apps either always-toggle or always-one-shot; offering both is what unlocks the live-set ceiling without breaking the "tap = make music" floor.
- **Harmonic lockout (one pad per color at a time)** — the single most-praised design pillar of the category leader (Groovepad, ~110M downloads, 4.77 / 5 from 464.7K US ratings; `research/groovepad/teardown.md`). Tapping a second pad in the same color schedules the previously-active same-color pad's fade-out 1 → 0 at the next bar boundary AND the new pad's fade-in 0 → 1 at the same bar boundary, both ramps spanning one full bar. The result: the player **cannot produce a same-color clash**. Cross-color taps stack independently — drums + bass + melody + fx all coexist, so the player can still build the "thick wall of sound" that defines the genre. The maximum simultaneous voice count is therefore 4 (one per color), not 16; this is the deliberate Groovepad-aligned shape, and is what telegraphs "every combination sounds intentional" to the player.
- **First-tap-immediate (Groovepad's hook — `research/groovepad/teardown.md:32`)** — when the grid is empty (`activePadIds.length === 0`), the very first tap fires immediately (≈ 10 ms head past the AudioContext clock) instead of waiting for the next bar boundary. The fade-IN duration is unchanged (one bar for latch, quarter-bar for one-shot) — only the START time changes. The motivating insight: bar-aligned activation is what makes layers feel intentional once the grid has rhythm to align to, but the first tap has nothing to align to, so the bar pre-roll is just dead air. Groovepad nails the "tap once, hear yourself instantly" hook by starting the very first sound right now and letting subsequent layers join the established grid. Once any pad is active, subsequent taps fall back to the bar-aligned path. After the player toggles every active pad off (grid empties to zero), the next tap is treated as first-tap-immediate again. The engine emits an `engine:first-tap-immediate` audio-trace event so the audio-trace harness can verify the immediate path was taken.
- **Bar-aligned crossfades on a phase-locked source pool** — once the grid has rhythm, every gain transition starts at the next bar boundary (`beat-clock.nextBarFromNow()`) and ramps for one full bar (`beat-clock.secondsPerBar()`). At 84 BPM that's ≈ 2.86 s of pre-roll + ≈ 2.86 s of fade — Groovepad's "tap and wait for the beat" feel. The phase-locked source pool (see § Phase-locked audio below) is the architectural foundation that makes lockout safe: sources never start or stop, only gain ramps, so loop position is preserved across lockout swaps and re-tap retains its place in the bar.
- **Edge case — kit metadata missing** — if a kit fails to ship valid color metadata for any pad (loop-kit pipeline output bug, data corruption), the engine emits a loud diagnostic via `RundotAPI.error` and disables the lockout rule (the column key cannot be trusted). The engine degrades to "any combination valid" mode until the kit is repaired; the UI surfaces a degraded-state banner off the same diagnostic. (Decision Log Risk #5.)
- **Edge case — player taps the *same* pad twice rapidly** — the engine debounces taps within 200ms. The second tap registers as a no-op.

### Phase-locked audio (source pool + gain-only crossfades)

- **The phase-locked source pool is the audio architecture; bar-aligned activation + harmonic lockout sit on top of it as policy layers** (see § Pad grid + harmonic lockout). The source pool guarantees musical alignment across any combination of pads; the engine layers on top decide WHEN gain ramps fire and WHICH pads are allowed to be audible together. All three layers are designed to be independently swappable — a future kit format could reuse the same source pool with different timing or different lockout rules.
- **Source pool starts once at kit-load.** When a kit's buffers finish decoding, every `AudioBufferSourceNode` is created with `loop: true` and started at a single shared `kitStartTime` (≈ 100 ms past the AudioContext clock at first decode). All 16 sources play continuously from that point onward; tapping a pad never starts or stops a source.
- **Gain controls audibility.** Each source flows through its own `GainNode`. Tap = ramp the per-pad gain 0 → 1. Untap = ramp 1 → 0. Sources keep playing silently when their gain is 0, which is what guarantees layers stay phase-aligned across multiple activations.
- **Bar-aligned start, one-bar ramp.** Every gain transition starts at the next bar boundary (`beat-clock.nextBarFromNow()`) and ramps for one full bar (`beat-clock.secondsPerBar()` — ≈ 2.86 s at 84 BPM). This is Groovepad's "tap and wait for the beat" feel and matches the audio teardown's pre-quantized-loop contract. Earlier drafts experimented with eighth-note quantization to reduce the first-tap pre-roll, but that broke the "every combination sounds intentional" feel that the lockout depends on; the phase-locked source pool already smooths re-taps mid-loop, so the bar pre-roll is only paid on first activation per pad.
- **Re-tap doesn't restart loops.** Tapping a pad off and back on ramps gain to 0, then back to 1. The loop position keeps advancing through silence and resumes wherever the playhead is — the groove never resets.
- **Kit swap retires the source pool.** On active-kit change, `pad-audio-graph.disposeAll()` stops every source and clears the kit-start anchor before the new kit's buffers register. The new kit's pool then phase-locks to a fresh shared start.
- BPM range supported by kits: 40–240 (per loop-kit pipeline contract). UI never exposes BPM as a control.
- All kits are 4/4 only in v1 (per loop-kit pipeline contract). Other meters deferred.

### Press-and-hold latch (mute intentionally absent)

- **Mute is intentionally absent.** Groovepad has no mute gesture (`research/groovepad/features.md:7,30`); the mute concept was removed from BeatBoard end-to-end as part of the alignment pass. There is no `mutedPadIds` Set, no `toggleMute(padId)` action, no muted pad state, no diagonal-hatch overlay, no `pad_muted` analytics event, no debug-API entrypoint, and no FTUE step that mentions muting. To silence a layer, the player taps an already-latched pad to deactivate it (the optimistic-removal + bar-aligned fade-out path), or taps a different pad in the same column and lets harmonic lockout retire the prior one.
- Long-press = latch is the only press-and-hold gesture. Pointer-down held past the 400 ms threshold fires `padGridStore.activate(padId)`. The pad ramps in (immediately on an empty grid; bar-aligned otherwise) and stays in `activePadIds` indefinitely until tapped off or replaced under same-color lockout.
- The transport bar's "Mute-all" toggle is a master-output mute (audio destination chain), not a per-pad mute. It silences the rendered mix without touching `activePadIds` or `pad_activated` analytics.
- Solo (in Groovepad: long-press the pad and tap others) is still **not in v1**. Decision Log scope. If a future version reintroduces an explicit per-layer silence affordance, it ships as an explicit per-pad context-menu action — never as a hidden gesture overload.

### Recording → mp4 capture

- 8-bar fixed-length capture (per Decision Log). At 84 BPM that's ~22.8 seconds of audio.
- Capture begins at the next bar boundary after Record tap.
- Two streams captured: audio (mixed master output via `MediaStream` from a Web Audio destination) + video (animated `PadCellGrid` poster) → muxed into mp4 via `MediaRecorder` API.
- During capture, the player can continue to layer / mute pads; the recording reflects whatever pads are active at each moment.
- On capture complete: auto-pushes `RecordingReview` modal.
- Edge case — MediaRecorder unsupported / fails — fallback to audio-only mp3 capture (research risk #2). UI banner explains the fallback. The audio still saves to Mixes; the share is mp3 instead of mp4.
- Edge case — player backgrounds the app mid-capture — capture is aborted, audio buffer dropped, no save. Toast on resume: "Recording was interrupted — your beat is still here, tap Record to try again."

### Pack ownership and access tiers

- **Free** — hero pack ("Lofi Heights"). Always available. Loaded at install time.
- **Owned (paid)** — pack purchased with Runbucks. Permanent. Reflected in `entitlements-service` as `pack_owned_<packId>`.
- **Trial (rewarded ad)** — pack with 24-hour temporary access. `entitlements-service` carries `pack_trial_<packId>` with TTL 24h. UI shows a "Trial — 23h 42m left" countdown chip. Expires automatically; player can re-watch a rewarded ad to extend (still subject to daily cap of 3).
- **Subscriber-exclusive** — generated kit available to CORE+ subscribers each month. Granted via subscription benefit, revoked on subscription expiry.

### Welcome Pack icebreaker

- Triggers exactly once: after the player completes their **first mp4 recording** in their **first session** (Decision Log + research cross-game pattern #3).
- Banner is rendered above the share actions in `RecordingReview`. The player can tap to open the offer or ignore it.
- One-time-only is enforced via an appStorage flag `welcomePack.offerShownAt`. After it's set, the offer never reappears regardless of purchase outcome.

### Rewarded ad → 24h pack trial

- Single rewarded ad placement: the "Try this pack" affordance on Themed Packs in `KitDetail`.
- Daily cap: 3 watches per day (per `rewarded-video-ads`: "3-4 ads/player/day"). Daily reset at the user's local midnight.
- On reward complete: `entitlements-service.grantEntitlement('pack_trial_<packId>', { ttlSeconds: 24*60*60 })`. The pack appears in Packs's Owned section with a Trial badge.

### Daily login reward (subscription tier benefit)

- Subscriber-only. CORE = 50 Runbucks/day; PLUS = 200 Runbucks/day.
- Reward is **login-gated**: player must open the app and visit the daily login flow (rendered as an in-line banner on Play the first time the player opens the app each day). Tapping the banner credits Runbucks and dismisses it.
- Module: `monetization/multi-day-reward` for the 7-day rolling display + claim mechanic; underlying tier mapping via `monetization/subscription-vip`.

### FX system (Phase 3 of `.project/plans/groovepad-alignment-plan-2026-04-29.md`)

- The FX panel is the **only "off-grid" expressive surface** the player has — Groovepad's teardown frames it as the depth ceiling that converts a locked grid into a skill expression instrument (`research/groovepad/teardown.md:60`). Without it BeatBoard caps at "the user makes one mix" with no week-2 hook for users who already feel competent.
- **Four effect tabs** — `Filter / Flanger / Reverb / Delay`. Only one effect is active at a time; the active chain is selected by the bottom-rail FX panel's tab bar. Tab tap crossfades to the new chain over 50 ms.
- **XY pad** drives the active effect's two parameters continuously, in [0..1] each. Mappings:

  | Effect | x axis | y axis |
  |---|---|---|
  | Filter | Lowpass cutoff (logarithmic 80 Hz – 8 kHz) | Resonance Q (0.5 – 12) |
  | Flanger | LFO rate (0.05 – 5 Hz) | Feedback (0 – 0.85) |
  | Reverb | Decay (comb feedback 0.6 – 0.95) | Tone (lowpass 800 Hz – 8 kHz) |
  | Delay | Delay time (10 ms – 1000 ms) | Feedback (0 – 0.85) |

  Drags smoothed via `setTargetAtTime` (default 0.03 s time constant) so live drags feel instant without zipper noise.
- **Per-row FX-bypass toggles** flip whether each (category, side) cell of pads routes through the FX bus. The flanking FX-toggle columns from Phase 2 (`research/groovepad/features.md:31`) drive `padGridStore.fxBypass[category][side]`. A subscriber (`fx-bypass-wiring`) forwards every flip into per-pad `setPadWetSend()` calls so the wet branch ramps 0 → 1 (or 1 → 0) over ~50 ms. The dry branch is constant at 1, so toggling FX never silences a row — it only adds the FX color on top.
- **Routing topology** — every per-pad audibility gain has two sends: a constant dry send to master and a 0/1 wet send to the FX bus's input. Inside the bus, four parallel sub-chains (filter / flanger / algorithmic reverb / delay) all receive the bus input simultaneously; the active chain's output gain is at 1, the other three at 0. All four chain outputs sum into the bus output, which connects to master. The recording capture taps the master gain, so dry+wet mixed output is captured automatically once any pad's wet-send is non-zero.
- **Reverb topology** is algorithmic Schroeder-style — 4 comb filters (DelayNode + feedback + lowpass) in parallel feeding 2 allpass filters (DelayNode + feedback) in series. No external impulse-response asset is required; an IR-based reverb is a content-asset content roadmap item, not a v1 dependency.
- **Lockout, long-press, recording, and the phase-locked source pool are unaffected by the FX bus.** The bus operates on the wet branch only; the dry branch keeps the existing tap → bar-aligned crossfade → recording semantics that Phase 1 restored.
- **Discoverability defaults (FX polish pass)** — without them the FX system reads as broken on first launch (every wet send sits at 0, so the XY pad has no audible effect). On first install of `fx-bypass-wiring`, if every (category, side) cell is still `false`, the wiring auto-engages `drums.cool` exactly once so the player's first XY-pad drag is audible immediately. Idempotent across reinstalls and skipped when the player has already toggled any cell. When every cell is `false`, the `FxPanel` XY surface dims and overlays "Tap a sparkle column to send a row through this effect." so the gating affordance is visible. The flanking FX-toggle columns render with discoverable chrome — sparkle icon, "FX" label, off/on visual states driven by `--ui-pad-fx-off` / `--ui-pad-fx-on` tokens, `role="switch"` + `aria-checked` for assistive tech.

---

## FTUE Specification

> Module: `onboarding/ftue-engine` — the ONLY FTUE module.

**Tutorial mode**: **clean** (positioned tooltips). BeatBoard is app-like (a creative tool), not a game-with-character. Per `guided-progression` and the FTUE engine's principle 4: app-like games use clean tooltips. No character avatar.

### Subsection A: Core-loop FTUE

| Step | Phase | Type | Spotlight target | Prompt copy | Completion trigger | Reward |
|---|---|---|---|---|---|---|
| 1 | linear | spotlight | `[data-ftue="pad-cell-0"]` (top-left pad) | "Tap a pad to start your beat." | `{ type: 'pad_activated' }` | — |
| 2 | linear | spotlight | `[data-ftue="pad-cell-5"]` (a pad in a different color from step 1's target) | "Add another. Layers always sound good together." | `{ type: 'second_pad_activated' }` | — |
| 3 | linear | spotlight | `[data-ftue="record-button"]` | "Tap Record when it sounds good." | `{ type: 'recording_started' }` | One-time toast on capture complete: "Nice — your first mix is saved." |

**Phase**: All linear, all live in core gameplay. There is **no `onboarding` phase** — no pre-game setup screens, no character pick, no name entry (Decision Log: profile is platform-owned). The player starts directly on Play.

### Subsection B: Per-feature contextual tutorials

| featureKey | Unlock condition | Spotlight target | Prompt copy | Completion trigger |
|---|---|---|---|---|
| `mute_pad` (legacy key — feature is the latch hint) | Core-loop step 2 complete (player has 2+ pads active) | `[data-ftue="pad-cell-active-any"]` (the most recently activated pad) | "Press and hold a pad to lock it on." | manual dismiss (auto-dismisses on actual long-press detection) |
| `pack_drawer` | Core-loop step 3 complete (player has recorded at least once) AND has been on Play for 60+ continuous seconds since record | `[data-ftue="tab-packs"]` | "More packs live in the Packs tab." | manual dismiss |

- **Owning feature issue**: blank — `plan-issues-agent` resolves at plan-time from Screen Inventory.

### FTUE behavior

- **Skippable**: yes. A `Text.Hint` "Skip" link appears on step 1 only; tapping it calls `ftue-engine.skipAll()` and persists FTUE-complete to appStorage.
- **Force-quit recovery**: per `ftue-engine` SKILL.md, FTUE state persists via the engine's appStorage adapter (`storageKey: 'beatboard_ftue'`). Relaunch resumes at the last incomplete step (Decision Log: resume mid-FTUE).
- **Initial state when FTUE starts**: Play mounted, hero pack loaded, grid empty (no pads active), transport bar idle showing BPM. The "Tap a pad" empty-state hint is suppressed when FTUE step 1 is active because the FTUE tooltip carries the equivalent message.
- **Full FTUE completion fires**:
  - One-time analytics event `ftue_completed`
  - One-time toast "Nice — your first mix is saved." (already specified above)
  - No currency reward; the reward is the recording itself (a thing the player made)
- **Gate definitions**:
  - `gate.tabBar.disabled = true` while FTUE step 1 or 2 is active. Prevents the player from tab-switching mid-onboarding.
  - `gate.recordButton.disabled = true` until step 2 completes. The player cannot record until they have at least 2 pads active.
  - On step 3 completion, all gates open.

---

## Push Notifications

A single re-engagement notification. Cadence is intentionally low to preserve premium-game tone (per `push-notifications` and Decision Log).

| Trigger | Delay after trigger | Copy | Deep link destination |
|---|---|---|---|
| Player records a mix and then closes the app | 24h after last session | "🎵 Your beat is waiting. Tap to keep building." | `Play` (with the same pack the player last used) |

- This is the only push trigger in v1.
- Not scheduled for players who haven't recorded a mix yet (would be too cold a touch).
- Cancelled if the player opens the app before the 24h mark.
- Implementation: see `Local Notifications` section — push fires only if platform push is available; otherwise the local notification with the same payload runs as fallback.

---

## Economy

**Currencies**: BeatBoard uses a single currency — **Runbucks** (the Rundot platform hard currency). No soft currency, no energy, no tickets, no event currency. Decision Log Economy decision: "Runbucks only. The game has no need for an in-game soft currency since content is buy-once permanent unlocks."

> Research monetization data: Groovepad metrics in `research-raw/summary.md` confirm "Premium pricing works in this genre" — used to validate the no-soft-currency / no-grind position. Detailed competitor monetization scoring not collected per teardown depth; design is grounded in playbook guidance plus the cross-comp summary.

### Runbucks

| Source | Amount | Frequency / Condition |
|---|---|---|
| Welcome Pack purchase grant | 500 Runbucks | One-time, on Welcome Pack purchase. Bundled with extension kit. |
| CORE subscription daily login | 50 Runbucks | Once per day, login-gated, while CORE+ active |
| PLUS subscription daily login | 200 Runbucks | Once per day, login-gated, while PLUS+ active (replaces CORE drip — not additive) |
| Direct Runbucks purchase | varies | On-demand via `RundotAPI.iap.openStore()`. Platform-managed amounts. |

| Sink | Cost | Notes |
|---|---|---|
| Genre Pack purchase | 299 Runbucks | Per-pack, permanent unlock |
| Themed Pack purchase | 499 Runbucks | Per-pack, permanent unlock |
| Pack Pass (bundle) | 1499 Runbucks | One-time bundle: all current packs + next 3 generated drops |
| Welcome Pack | 99 Runbucks | One-time icebreaker |

Runbucks **can accumulate infinitely** — the platform wallet has no cap. There is no decay or conversion. The natural sink is more packs.

### Economy Model Validation

| Currency | Daily F2P Earn | Day 7 F2P Balance | First Meaningful Sink | Days to Sink (F2P) | First Purchase Pressure | Days to Pressure |
|---|---|---|---|---|---|---|
| Runbucks (F2P) | 0 | 0 × 7 = 0 | Welcome Pack 99 Runbucks | infinite (F2P never earns Runbucks in-game) | First-record icebreaker offer at end of session 1 | 0 (same session as first record, ~2-5 min in) |
| Runbucks (CORE subscriber) | 50 | 50 × 7 = 350 | Genre Pack 299 Runbucks | 299 / 50 = 5.98 ≈ 6 | Hero pack feels samey, prompts pack purchase | ~Day 3 (per Decision Log "wall moment") |
| Runbucks (PLUS subscriber) | 200 | 200 × 7 = 1400 | Pack Pass 1499 Runbucks | 1499 / 200 = 7.49 ≈ 8 | Wants the bundled "all packs" feel | ~Day 3-7 |

Validation:
- F2P player has 0 daily earn (deliberate — content is bought, not grinded for). Pressure fires at 0 days because the icebreaker is timed to the first-record moment in session 1, not after a soft-currency wait. This **is** the design — the icebreaker creates pressure on day 0, not aged in.
- CORE Days-to-Sink = 6 (within 3-7 target).
- PLUS Days-to-Sink = 8 (slightly over target by design; PLUS subscribers have stronger LTV intent and can wait, plus PLUS includes cloud mix backup as non-currency value).
- All currencies have reachable sinks within the 7-14 day window.
- No accumulation problem: sinks (packs) scale with content cadence (new packs land regularly).

---

## IAP Pricing Table

| Product ID | Display Name | Price (Runbucks) | Contents | One-time or Repeatable |
|---|---|---|---|---|
| `welcome_pack` | Welcome Pack | 99 | Lofi Heights extended kit (8 extra pads, 2 extra layers) + 500 Runbucks | One-time |
| `pack_lofi_heights_pro` | Lofi Heights — Pro | 299 | One Genre Pack (32+ pads, 8 layers) | One-time |
| `pack_trap_city` | Trap City | 299 | One Genre Pack | One-time |
| `pack_synth_horizon` | Synth Horizon | 299 | One Genre Pack | One-time |
| `pack_house_floor` | House Floor | 299 | One Genre Pack | One-time |
| `pack_themed_neon_nights` | Neon Nights — Themed | 499 | Themed Pack (intro animation + exclusive FX layer) | One-time |
| `pack_pass` | Pack Pass | 1499 | All current Genre Packs + Themed Pack + next 3 generated pack drops | One-time |

All prices are **Runbucks**. The Runbucks currency icon is rendered at runtime via `useRunbucksIcon()`. Screen specs and copy use the literal phrase "{Runbucks icon}" alongside the numeric amount; UI never abbreviates the currency name.

---

## Subscription Products

BeatBoard maps two platform tiers (CORE, PLUS) to in-game benefits. PRIME and ULTIMATE are not used in v1 — see exclusion at end of section.

| Tier | Benefits | Daily Login Reward | Reward Multiplier | Gated Features |
|---|---|---|---|---|
| CORE | No ads (rewarded ads are still opt-in available; no other ad surfaces exist), Pack Pass auto-applied to next purchase | 50 Runbucks/day | 1x | Subscriber-only generated kit (1 new kit per month) |
| PLUS | + Cloud mix backup (My Mixes synced across devices), + Exclusive subscriber-only Themed Packs (1 per quarter) | 200 Runbucks/day | 1x (no multiplier in v1; pack purchase scaling is via paid bundles) | + Cloud mix backup, exclusive Themed Packs section in Packs |

Benefits are cumulative — PLUS includes everything CORE has.

UI copy in Settings and any subscription purchase entry uses `{localizedPrice}`:

> "BeatBoard CORE — Then {localizedPrice}/month. Cancel anytime."

Prices are fetched at runtime via `RundotAPI.iap.getSubscriptions(tier?)`. Status checked via `RundotAPI.iap.isUserSubscribed(tier)` (respects tier hierarchy CORE < PLUS). Purchase via `RundotAPI.iap.purchaseSubscription(tier, interval)`. The `subscription-vip` module config is populated from this table.

**No PRIME or ULTIMATE tier in v1. Rationale**: per `rundot-platform-pricing` Track 2, PRIME and ULTIMATE expect high-LTV benefit material (premium content sections, all-exclusive content access). BeatBoard's content production cadence in v1 (one hand-authored hero + 4-6 generated packs) does not produce enough premium-tier-only content to justify the tier. Adding PRIME with thin benefits would devalue the subscription line.

---

## Rewarded Ads

| Placement ID | Trigger / Entry point | Player action | Reward | Reward amount | RundotAPI call |
|---|---|---|---|---|---|
| `rewarded_pack_trial` | Tap "Try for 24h — Watch ad" on `KitDetail` for any not-yet-owned paid pack (Genre or Themed) | Watches full rewarded video | Temporary access to that pack | 24-hour entitlement | `RundotAPI.ads.showRewardedAdAsync({ placementId: 'rewarded_pack_trial', rewardId: 'pack_trial_<packId>' })` |

- **Readiness check**: call `RundotAPI.ads.isRewardedAdReadyAsync()` before showing the "Try for 24h" button on any pack card. Hide the button if false.
- **Frequency cap**: maximum 3 rewarded ad views per day, reset at the user's local midnight. Tracked via `monetization/rewarded-ad-flow` daily counter.
- **CTA copy**: "Try for 24h — Watch ad" (button label on KitDetail). Confirmation sheet copy: "Watch a short ad to unlock 24 hours of access to this pack. Watch up to 3 ads per day." (RewardedAdConfirmSheet body.)
- **Subscriber exemption**: CORE+ subscribers see no ads anywhere — but rewarded ad opt-in *is* still allowed because rewarded is opt-in, not interruptive. Decision: hide the rewarded button entirely for subscribers because they have no incentive to use it (subscribers should buy or already own; surfacing it wastes the surface). Confirmed via `RundotAPI.iap.isUserSubscribed('CORE')` at button render time.

---

## Interstitial Ads

No interstitials in this game. Rationale: the playbook `ad-monetization/interstitial-ads.md` allows premium-with-IAP-cap games to skip interstitials, and research-raw/summary.md risk #1 ("Ad density is the #1 churn driver in freemium") plus the Groovepad teardown's 22% negative ad mentions establish the comp data that interstitials are the primary churn vector in this genre. Decision Log Monetization decision: "Ads — interstitial: none."

The deterministic compliance check requires explicit exclusion phrasing: **No interstitial ads in this game.**

---

## Local Notifications

Re-engagement fallback layer. Local notifications are scheduled on-device when the app exits and cancelled when the player returns.

| Notification ID | Schedule trigger | Delay | Copy (title / body) | Deep link | Cancel condition |
|---|---|---|---|---|---|
| `idle_after_first_record` | Player has recorded ≥1 mix this lifetime AND the app is going to background | 24h | "🎵 BeatBoard" / "Your beat is waiting. Tap to keep building." | `Play` (resume current pack) | Player opens app |
| `pack_trial_expiring` | Player has an active rewarded `pack_trial_<packId>` entitlement | 1h before TTL expires | "⏰ Trial ending soon" / "Your [Pack name] trial ends in 1 hour." | `KitDetail` for that pack | Player opens app + the trial entitlement is gone (consumed or already expired) |

- Module: `data/local-notifications` with the standard schedule-on-start cancel-and-reschedule pattern.
- **No simulation hook** — BeatBoard does not use `RundotAPI.simulation` (see Simulation Economy section below).
- Notification copy uses sentence case + 1 emoji max for premium-game tone. Body copy under 50 chars where possible.

---

## Timing & Frequency

| System | Frequency / Reset | Exact timing | Notes |
|---|---|---|---|
| Daily login Runbucks drip (CORE/PLUS) | Once per local-day | Midnight, user's local timezone | Login-gated; auto-claim on first Play mount each day |
| Rewarded ad daily cap | 3 watches per local-day | Resets at user-local midnight | Tracked by `monetization/rewarded-ad-flow` |
| Pack trial (rewarded ad) TTL | 24 hours from grant | Real-time decay; UI updates each minute | `entitlements-service` TTL |
| `idle_after_first_record` notification | 24 hours after backgrounding | Computed against `data/server-time` to avoid clock skew | Cancelled on app open |
| `pack_trial_expiring` notification | 23h after grant (1h before expiry) | Computed against trial grant timestamp | Cancelled on app open or trial consumption |
| Welcome Pack offer | Once ever per player | Triggered post-first-record in first session | Persisted via appStorage `welcomePack.offerShownAt` |
| FTUE state persist | Continuous | On every step transition | `ftue-engine` adapter writes to appStorage |
| Bar boundary (audio engine) | Every (60/BPM) × 4 seconds | Driven by `juice/beat-sequencer` | Anchors all fade-in/fade-out |

---

## Analytics Events

Required core analytics table.

| Event Name | Trigger | Properties | Required? |
|---|---|---|---|
| `game_opened` | Play first becomes visible after launch | `{ entry_point: string }` (cold-start / deep-link / push) | Yes |
| `player_identity` | The game has resolved profile state from `RundotAPI.profile.getProfile()` | `{ is_signed_in: boolean, has_profile_name?: boolean }` | Yes |
| `session_end` | App backgrounds / quits | `{ screen: string, trigger: string, duration_seconds: number }` | Yes |
| `screen_viewed` | Any major screen mounts (Play / Mixes / Packs / RecordingReview / KitDetail / Settings / Credits) | `{ screen: string, source?: string }` | Yes |
| `ftue_started` | FTUE engine starts | `{ ftue_variant: 'beatboard_v1' }` | Yes |
| `ftue_completed` | FTUE engine completes (all linear steps done OR skipAll fired) | `{ ftue_variant: 'beatboard_v1', duration_seconds: number, skipped: boolean }` | Yes |
| `run_started` | Player taps Record (recording attempt begins) | `{ mode: 'record', pack_id: string, attempt_number: number }` | Yes |
| `run_completed` | 8-bar capture finishes successfully | `{ mode: 'record', pack_id: string, attempt_number: number, duration_seconds: number, layers_active: number }` | Yes |
| `run_failed` | Recording capture errored or was cancelled mid-bar | `{ mode: 'record', pack_id: string, attempt_number: number, fail_reason: 'cancelled' \| 'media_recorder_error' \| 'app_backgrounded' }` | Yes |

Use `RundotAPI.analytics.trackFunnelStep()` for the first-session conversion funnel: `app_open → first_pad_tap → first_record → mix_saved → first_share → welcome_pack_offer_shown → welcome_pack_purchased`.

---

## Monetization Analytics

| Event Name | Trigger | Properties | Category |
|---|---|---|---|
| `store_opened` | Packs becomes visible OR `RundotAPI.iap.openStore()` invoked | `{ source: string }` (tab_tap / kit_card_tap / runbucks_chip / topup) | IAP |
| `iap_purchase_started` | Player taps Confirm in `PackPurchaseSheet` or `WelcomePackOffer` | `{ productId: string, priceRunbucks: number }` | IAP |
| `iap_purchase_complete` | `RundotAPI.iap.spendCurrency` resolves successfully | `{ productId: string, priceRunbucks: number, firstPurchase: boolean }` | IAP |
| `iap_purchase_failed` | spendCurrency error or user cancel | `{ productId: string, reason: string }` | IAP |
| `rewarded_ad_offered` | "Try for 24h — Watch ad" button rendered (passes the readiness check) | `{ placement: 'rewarded_pack_trial' }` | Ads |
| `rewarded_ad_watched` | Rewarded ad reward delivered | `{ placement: 'rewarded_pack_trial', reward: 'pack_trial_<packId>' }` | Ads |
| `rewarded_ad_dismissed` | Ad cancelled / not-completed | `{ placement: 'rewarded_pack_trial' }` | Ads |
| `interstitial_shown` | n/a (no interstitials) — included for compliance schema completeness; never fires | `{ placement: string, sessionDepth: number }` | Ads |
| `currency_earned` | Player receives Runbucks (login drip claim, Welcome Pack 500-grant, top-up purchase) | `{ currency: 'runbucks', amount: number, source: string }` | Economy |
| `currency_spent` | Runbucks deducted (any pack purchase including Welcome Pack) | `{ currency: 'runbucks', amount: number, sink: string }` | Economy |
| `first_purchase` | Player's first-ever spendCurrency success | `{ productId: string, daysSinceInstall: number }` | IAP |
| `subscription_status_checked` | Any call to `isUserSubscribed` resolves | `{ tier: string, isSubscribed: boolean }` | Subscription |
| `subscription_purchase_started` | Player initiates subscription purchase | `{ tier: string, interval: string }` | Subscription |
| `subscription_purchase_complete` | Subscription purchase confirmed by SDK | `{ tier: string, interval: string }` | Subscription |
| `subscription_expired` | Subscription tier transitioned from active to expired | `{ tier: string }` | Subscription |
| `entitlement_consumed` | Trial entitlement TTL expired or consumed | `{ itemId: string, quantity: number, reason: string }` | Entitlement |
| `entitlement_granted` | Pack ownership / trial / subscriber-kit entitlement added | `{ itemId: string, quantity: number, source: string }` | Entitlement |

Game-specific events:

| Event Name | Trigger | Properties |
|---|---|---|
| `pad_activated` | Player taps a pad ON (gesture: 'one-shot' or 'latch') | `{ pack_id: string, pad_color: string, layer_id: string, total_active_after: number, gesture: 'one-shot' \| 'latch' }` |
| `recording_started` | Player taps Record | `{ pack_id: string, layers_active_at_start: number }` |
| `recording_shared` | Player taps Share in RecordingReview | `{ mix_id: string, share_target?: string }` |
| `pack_previewed` | Player previews a pad in KitDetail | `{ pack_id: string, pad_id: string }` |

All events use `RundotAPI.analytics.recordCustomEvent(name, props)`. Funnel events use `trackFunnelStep`. Property keys are `snake_case`.

---

## Simulation Economy

Not used. Rationale: economy is hardcoded. BeatBoard's economy is a single currency (Runbucks) with platform-managed wallet, plus simple entitlements (pack ownership, pack trial TTL) — there is no resource-conversion graph to author, no shop section taxonomy beyond the three flat sections in Packs, and no timed-recipe pattern beyond the entitlement TTLs which are already handled by `entitlements-service`.

---

## Liveops Monetization

No liveops in v1. Rationale: per `themed-events` playbook, themed events require a content cadence and operations team that v1 cannot support; per Decision Log Recommendations Deferred, themed events sit in v1.5+. Subscriber-only generated kit each month is the only "drop" in v1, and that's a subscription benefit not an event. Limited-time offers and event currencies are explicitly out of scope.

---

## Progression Gates

BeatBoard has soft progression — no skill-gated content, only content-gated content (paid packs). Time estimates are conservative.

| Gate | Trigger | Requirement | Time estimate | IAP required? |
|---|---|---|---|---|
| 0 | First session | Tap any pad on Play | <30s | No |
| 1 | First session | Layer 2+ pads (FTUE step 2) | <90s | No |
| 2 | First session | First successful recording (FTUE step 3 + capture complete) | <3 min | No |
| 3 | First session | Reach Welcome Pack offer (post-record) | <5 min | No (but offer prompts a 99 Runbucks IAP) |
| 4 | Sessions 2-3 | Browse Packs; preview a paid pack via `KitDetail` | Day 1-3 | No |
| 5 | ~Day 3 | Hit the wall moment — hero pack feels samey, motivated to acquire content | Day 3-5 | Optional (rewarded ad trial OR pack purchase) |

All gates reachable without IAP. Gate 0 ≤ 5 minutes target hit at <30s.

---

## Visual Style

BeatBoard's visual identity is **calm, precise, and rhythmic**. The renderer's neutral chrome stays out of the way; the audio is the identity surface. Five dimensions:

1. **Renderer fit** — Flexible Baseline (`neutral-base`) is genuinely the right choice because the audio surface is the identity object: any opinionated chrome (cozy paper, ornate scrollwork, neon glow) would compete with the music for attention. Neutral-base's "systems" and "utility" personality lets the pad grid be the visual focus while the surrounding chrome stays disciplined.
2. **Motion level** — **ambient + reactive**. Ambient: every pad pulses subtly on the beat via `juice/beat-sequencer` even when idle, so the grid is *alive* before the player has done anything. Reactive: pads scale-pulse on tap (90ms ease-out via `juice/punch`), record button pulses red on the beat during capture, and bar transitions trigger subtle fade-in glows on activating pads. Idle / non-recording moments are restrained — no ambient particles, no wandering animations, no environment loops. Spectacle moments: first pad tap (single bloom on the pad as the loop fades in), first record completion (a soft full-grid bloom).
3. **Information density** — **medium**. Three coexistent surfaces on Play (pack chip, pad grid, transport bar). Packs densest at 3 horizontal-scroll sections. Mixes is sparse (vertical list). Hierarchy at high density established by surface separation: the pad grid owns the visual center; transport bar is a single fixed-position rail; pack chip is an unobtrusive top-corner badge.
4. **Layout orientation** — **portrait**, locked at scaffold time per `status.json.orientation: portrait`. Tab bar at bottom. The pad grid + bottom transport pattern is the natural one-handed layout. No landscape adaptation work required.
5. **Icon pack** — `lucide` (per `status.json.iconPack: lucide`). Semantic UI layer keeps icon IDs stable; UI references icons by semantic ID (`shop`, `recording`, `settings`, `mute`, `back`, `pad-grid`).

### Component Translation Table

Visual chrome (colors, fonts, shadows, radius) comes from the renderer. The Layout intent column captures structure / density / placement only.

| Component | Layout intent | Motion intent | Orientation intent |
|---|---|---|---|
| `PadCell` (idle) | Square cell, ~22% screen-width tall, dim outline, color tint barely visible | Subtle 1px-glow pulse on every beat (ambient via beat-sequencer) | n/a (portrait) |
| `PadCell` (active) | Same square; saturated color tint at full opacity; layer-name label slides in below | Scale-pulse 1.0 → 1.08 → 1.0 over 180ms on tap (juice/punch); on the next bar fade-in, color saturates from 0% to 100% over 1 bar | n/a |
<!-- `PadCell` (muted) row removed — Groovepad alignment dropped the mute concept end-to-end. There is no muted pad state. -->
| `PadCell` (preview, KitDetail) | 1×4 row of cells, full-width, larger touch targets | Single scale-pulse on tap; sting plays for 1 bar then fades | n/a |
| `PadCellGrid` (host) | 4×4 grid filling 70% of vertical space; uniform 8pt gap | Synchronized beat-pulse across all cells | n/a |
| `TransportBar` | Bottom-fixed rail, 64pt tall, full width | Record button pulses red on beat during capture (1s period at 60 BPM, scales with kit BPM) | n/a |
| `KitCard` | 4:5 aspect tile in horizontal scroll; hero art top, name + price chip bottom | Tap → 0.97 scale punch (80ms ease-out) | n/a |
| `RecordingReview` poster | 4:5 frozen poster, centered, ~60% screen height | Loops a slow 1.05 → 1.0 breath every 4s while audio replays | n/a |
| `RunbucksPriceChip` | Inline pill with currency icon left + amount right | Static; no animation in v1 | n/a |
| `Settings` modal | Vertical list of toggles; bottom-anchored | Sheet slide-up (240ms ease-out); toggles snap | n/a |
| `Credits` modal | Vertical scrollable text; section headers | Static | n/a |
| `WelcomePackOffer` banner | Horizontal banner above share actions in RecordingReview; gift icon left + chip right | Subtle gentle pulse 1.0 → 1.02 every 2s to draw attention | n/a |
| `FtueOverlay` spotlight | Spotlight cutout + tooltip card adjacent | Spotlight position interpolates 240ms when target changes; tooltip fades in 180ms | n/a |
| Tab bar | 3 icons + labels, bottom-fixed, 56pt tall | Active tab icon scales 1.0 → 1.1 on switch | n/a (portrait only) |

---

## Component → Module Map

| Component | Module | Screen(s) | Props/State |
|---|---|---|---|
| `PadCell` | `(custom)` (Pad-Grid Engine) | Play, KitDetail (preview), RecordingReview (poster) | `{ padId, color, state: 'idle'\|'hover'\|'active'\|'preview', layerId }` |
| `PadCellGrid` | `(custom)` (Pad-Grid Engine) | Play, KitDetail, RecordingReview | `{ kit: KitConfig, activePadIds: string[], onTap, onLongPress }` |
| `TransportBar` | `(custom)` (uses `juice/beat-sequencer` for tick) | Play, RecordingReview | `{ bpm, mode: 'idle'|'recording'|'replay', recordingBar, totalBars, onRecord, onStop }` |
| Audio playback engine | `audio/audio-manager` | Play (drives layer playback), RecordingReview (replay) | `{ buffers, gainGraph, masterGain }` |
| BPM clock / bar-beat scheduler | `juice/beat-sequencer` | Play, RecordingReview | `{ bpm, onBeat, onBar }` |
| Recording capture | `(custom)` (mp4/MediaRecorder) | Play → RecordingReview transition | `{ stream, onComplete, onError }` |
| `KitCard` | `(template)` `Skin*Card` for tile chrome + custom inner content | Packs, Mixes, KitDetail | `{ kit, ownership: 'free'|'owned'|'trial'|'paid', ttlSeconds? }` |
| `RunbucksPriceChip` | `(template)` Badge.Counter wrapping `useRunbucksIcon()` | Packs, KitDetail, PackPurchaseSheet, WelcomePackOffer | `{ amount: number }` |
| Pack catalog state | `data/catalog-system` | Packs, KitDetail | `{ packs: Pack[], byId: Record<string, Pack> }` |
| Player wallet display | `ui/currency-indicator` | Packs | `{ balance, deltaTracking }` |
| Pack ownership state | `monetization/entitlements-service` | Packs, KitDetail, Play | `{ entitlements: Entitlement[] }` |
| Purchase flow UI | `monetization/iap-purchase-flow` | PackPurchaseSheet, WelcomePackOffer | `{ productId, status }` |
| Subscription state + tier benefits | `monetization/subscription-sdk` + `monetization/subscription-vip` | Settings, Packs (subscriber section), Play (drip banner) | `{ tier, isSubscribed, multiplier }` |
| Daily login banner | `monetization/multi-day-reward` + `monetization/multi-day-reward-ui` | Play (top inline banner first time per day) | `{ rewards, claimable }` |
| Rewarded ad flow | `monetization/rewarded-ad-flow` + `monetization/ads-service` | RewardedAdConfirmSheet, KitDetail | `{ readiness, dailyCount, cap: 3 }` |
| FTUE engine | `onboarding/ftue-engine` | Play (FTUE drives) → renders via `tutorial-overlay` | `{ config, currentStep, gates, completed }` |
| FTUE overlay rendering | `onboarding/tutorial-overlay` | FtueOverlay | `{ targetSelector, copy, position }` |
| Settings store | `ui/settings-overlay` | Settings, Play (mute affordance) | `{ volume, muted }` |
| Tab bar | `ui/tab-navigation` | Global | `{ tabs, active, badges }` |
| Confirmation dialog | `ui/confirmation-dialog` | RecordingReview (discard), Mixes (delete) | promise-based |
| Bottom sheet host | `ui/bottom-sheet` | All modal sheets | `{ open, snapPoint }` |
| Toast host | `(template)` Toaster (already in scaffold) | Global | n/a |
| Share flow | `data/share-service` | RecordingReview | `{ url, payload }` |
| Local notifications | `data/local-notifications` | App lifecycle | `{ scheduled }` |
| Storage (mix metadata, FTUE state, flags) | `data/storage-service` | Global | scope-namespaced |
| Server time (notification calc, daily reset) | `data/server-time` | Daily reset, notification scheduling | `{ offset }` |
| Analytics | `data/analytics-service` | Global | `{ recordCustomEvent, trackFunnelStep }` |
| Error boundary | `(template)` ErrorBoundary | Global | n/a |
| Loop-kit asset catalog | `(custom)` (loop-kit pipeline integration) | Packs, KitDetail, Play | `{ kits: KitManifest[] }` |

---

## Research Insights

**Borrowed**:
- *Phase-locked source pool* (verified across **Incredibox**, **Groovepad**, **Koala Sampler**) — the single most important architectural decision in the genre's audio layer. All loops play continuously at a shared start time; tapping a pad ramps its gain audible without restarting any source. Layers always sound musically aligned because every loop's bar 1 is at the same wall-clock instant.
- *Harmonic lockout* (verified in **Groovepad**) — only one pad per column (instrument category) plays at a time; tapping a second pad in the same column replaces the first at the next bar boundary. This is the most-praised Groovepad design pillar per `research/groovepad/teardown.md` ("the user cannot produce a clash") and is what differentiates Groovepad from Incredibox-style free-stacking. **Incredibox** is genuinely free-stack; **Koala Sampler** is a sample-trigger surface and sits outside the lockout-vs-stack axis. An earlier draft of this PRD claimed free-stacking was "verified across all three teardowns" — that was a research-synthesis error that conflated three distinct activation models. BeatBoard ships with Groovepad's lockout because Groovepad is the category leader by user count by an order of magnitude (~110M downloads vs Incredibox's ~10M; `research/groovepad/metrics.json`).
- *Bar-aligned loop fade-in* (from **Incredibox**) — the "astonishment that competence was free" mechanic. Decision Log + research cross-game pattern #1.
- *Empty-state inline single instruction* (from **Koala Sampler / Incredibox**) — "Tap a pad" as the only onboarding copy on the first launch. No tutorial overlay to dismiss before the player can play.
- *Premium-with-IAP-cap pricing model* (from **Incredibox / Koala Sampler**) — community-respected, churn-resistant, modest lifetime spend cap. Anchors the entire monetization shape.
- *Recording → mp4 → social share* (from **Groovepad / Koala Sampler**) — the bridge from toy to identity object.

**Subverted**:
- *Hand-authored content* (Incredibox V1-V9) — BeatBoard subverts by shipping 1 hand-authored hero pack + 4-6 generated packs via the loop-kit pipeline. Rationale: hand-authored content requires multi-month production cycles per pack (Incredibox precedent). Generated content is BeatBoard's wedge — every player's library is unique-to-pack at install time.
- *Freemium-with-ads* (Groovepad) — BeatBoard subverts to premium-with-IAP-cap. Rationale: Groovepad's ad density drives 22% of negative reviews; the genre's most-praised entries (Incredibox 4.89, Koala 4.77) skip interstitials entirely. Players in this genre trust premium pricing because the alternative feels insulting.
- *Sampling-as-input* (Koala Sampler) — BeatBoard subverts by locking layers to pre-baked kits per the loop-kit pipeline. Rationale: sampling adds power but removes the "competence is free" hook (the player has to make decisions before they can hear themselves), shifting the audience from casual creatives to pro producers.

**Deferred**:
- *Async remix relay* (proposed differentiation bet #2) — deferred to v2. Rationale: introduces a friend graph + persistent shared rooms, both significant infrastructure beyond v1 scope.
- *AI-coached patterns* (proposed differentiation bet #3) — deferred to v2. Rationale: requires either pre-canned lesson scripts (out of scope) or live AI inference per session (cost / latency unknowns).
- *Top 50 mix leaderboard* (Incredibox) — deferred. Rationale: UGC moderation infrastructure; mixes have no objective score.
- *Beat School per-pack lessons* (Groovepad) — deferred. Rationale: hero pack is large enough to self-teach; AI-coached patterns is the v2 lineage successor to lessons.
- *FX columns + intensity slider* (Groovepad) — deferred. Rationale: adds a second-axis control surface that fights the calm tone in v1; reconsider once v1 retention validates.
- *Resampling* (Koala) — deferred. Rationale: power-user mechanic; doesn't fit casual-creative audience in v1.
<!-- *Hold-to-latch* deferral removed — long-press IS the latch gesture in v1 (Groovepad two-gesture model). The earlier note that long-press was reserved for mute no longer applies; mute was removed end-to-end. -->

The teardowns include observed UI screenshots only at conceptual reference depth (no per-frame asset captures); screen specs above describe behavior derived from the cross-comp summary's mechanics description rather than referencing specific competitor screenshots.

---

## Modules to Install

The core scaffold already ships `src/lib/utils.ts`, Tailwind, Toaster, ErrorBoundary, and the `src/components/*` compatibility wrappers — those are not listed below.

| Module | Category | Customization Notes |
|---|---|---|
| `ui/skin` | ui | Required as semantic UI surface for the entire game; renderer = `neutral-base` (already locked at scaffold) |
| `ui/shadcn-components` | ui | Pre-installed shadcn primitives backed by skin variables |
| `ui/tab-navigation` | ui | 3 tabs: Play / Mixes / Packs. Mixes badge shows unviewed count; Packs badge shows new-pack dot. |
| `ui/bottom-sheet` | ui | All modal sheets render through this |
| `ui/confirmation-dialog` | ui | Discard recording, Delete mix |
| `ui/settings-overlay` | ui | Volume slider + master mute toggle |
| `ui/currency-indicator` | ui | Runbucks balance chip on Packs |
| `ui/lucide-icon-system` | ui | Lucide-backed semantic icon catalogue |
| `audio/audio-manager` | audio | The pad-grid playback engine sits on top — buffer cache, gain graph, crossfade. Custom orchestrator (Pad-Grid Engine) consumes audio-manager outputs. |
| `juice/beat-sequencer` | juice | BPM clock; drives bar/beat events for fade-in/fade-out scheduling AND ambient pad pulse |
| `juice/punch` | juice | Pad scale-pulse on tap |
| `juice/ui-spring` | juice | Modal entrance, button bounce |
| `juice/feedback-channel` + `juice/feedback-player` | juice | Sequence beat-aligned visual feedback |
| `monetization/iap-purchase-flow` | monetization | Welcome Pack, Genre Packs, Themed Pack, Pack Pass purchases |
| `monetization/entitlements-service` | monetization | Pack ownership, pack trial TTL, subscriber-kit grants |
| `monetization/ads-service` | monetization | Wraps `RundotAPI.ads` |
| `monetization/rewarded-ad-flow` | monetization | Daily-cap-aware rewarded ad flow |
| `monetization/subscription-sdk` | monetization | Status check, package fetch, purchase |
| `monetization/subscription-vip` | monetization | Tier-to-benefit mapping (CORE / PLUS) |
| `monetization/multi-day-reward` + `monetization/multi-day-reward-ui` | monetization | Daily login Runbucks drip for subscribers |
| `onboarding/ftue-engine` | onboarding | The ONLY FTUE module per CLAUDE.md |
| `onboarding/tutorial-overlay` | onboarding | Spotlight + tooltip rendering for FTUE steps |
| `data/analytics-service` | data | Typed event tracking, funnel support |
| `data/local-notifications` | data | Idle reminder + trial-expiring notifications |
| `data/share-service` | data | mp4 share-link flow |
| `data/storage-service` | data | Mix metadata, FTUE state, flags |
| `data/server-time` | data | Daily reset, notification timing |
| `data/safe-area-service` | data | Mobile safe-area insets |
| `data/app-lifecycle` | data | App background → schedule notifications; foreground → cancel |
| `data/catalog-system` | data | Pack catalog index |
| `data/feature-flags` | data | Toggle generated-pack rollout, mp3-fallback toggle |

---

## Custom Systems Required

| Name | Category | Rationale |
|---|---|---|
| **Pad-Grid Engine** (`modules/audio/pad-grid` candidate) | Audio orchestration | Harmonic lockout (one pad per color/instrument category at a time — Groovepad's most-praised design pillar) layered on a phase-locked source pool: every kit buffer starts ONCE at kit-load with `loop: true`, gain controls audibility. First-tap-immediate on an empty grid (Groovepad's "tap once, hear yourself instantly" hook); once the grid has rhythm, taps fall back to bar-aligned starts. Latch (long-press = `activate`) ramps 0→1 over one bar; one-shot (short-tap = `triggerOneShot`) ramps 0→1 over a quarter-bar then fades out over one bar; same-color second tap schedules the previously-active pad's 1→0 fade-out at the same bar boundary (Groovepad's "tap and wait for the beat" feel). 200ms tap debounce. **Mute intentionally absent** — Groovepad has no mute gesture and BeatBoard removed the mute concept end-to-end. Sits on top of `audio/pad-audio-graph` (per-pad gain graph) and `audio/beat-clock` (bar timing). No existing module covers the orchestration policy — it is BeatBoard-specific (per Decision Log: "Pad-grid module should install under modules/audio/"). |
| **Recording Capture** | Audio + DOM | Captures `MediaStream` from Web Audio destination + animated `PadCellGrid` poster, muxes to mp4 via `MediaRecorder` API, falls back to mp3 on Safari iOS. No existing module covers DOM + Web Audio → mp4. Per Decision Log Modules row: custom. |
| **Loop-Kit Catalog Loader** | Asset integration | Loads `kit.json` manifests + per-layer wavs from the loop-kit pipeline (PR #122). Validates pad metadata (color, layer, BPM, key). Falls back loudly on missing/invalid metadata per Risk #5. No existing module covers loop-kit-format ingestion. |
| **Pack Trial TTL Manager** | Monetization sub-system | 24h temporary access via `entitlements-service` — but the trial-expiring notification scheduling, the 1h-before banner, and the per-second countdown UI are BeatBoard-specific glue around the entitlement TTL. |
| **Welcome Pack Offer Trigger** | Monetization sub-system | First-record-completion-in-first-session detection + one-time-only banner placement above the share action. Crosses Mixes / RecordingReview / appStorage. No existing module covers this specific first-record icebreaker pattern (the playbook is implemented across these surfaces). |

Custom systems are scoped tight; whether they later become reusable modules is decided post-build per the standard module-promotion path.

---

```json
{
  "$type": "prd-appendix",
  "schemaVersion": 1,
  "title": "BeatBoard — Product Requirements",
  "uiRenderer": {
    "variantId": "neutral-base",
    "canonicalName": "Flexible Baseline"
  },
  "iconPack": "lucide",
  "screens": [
    { "id": "pad-grid", "name": "Play", "type": "root" },
    { "id": "my-mixes", "name": "Mixes", "type": "root" },
    { "id": "pack-drawer", "name": "Packs", "type": "root" },
    { "id": "recording-review", "name": "RecordingReview", "type": "modal" },
    { "id": "kit-detail", "name": "KitDetail", "type": "pushed" },
    { "id": "pack-purchase-sheet", "name": "PackPurchaseSheet", "type": "modal" },
    { "id": "welcome-pack-offer", "name": "WelcomePackOffer", "type": "modal" },
    { "id": "rewarded-ad-confirm-sheet", "name": "RewardedAdConfirmSheet", "type": "modal" },
    { "id": "settings", "name": "Settings", "type": "modal" },
    { "id": "credits", "name": "Credits", "type": "modal" },
    { "id": "ftue-overlay", "name": "FtueOverlay", "type": "overlay" }
  ],
  "moduleIds": [
    "ui/skin",
    "ui/shadcn-components",
    "ui/tab-navigation",
    "ui/bottom-sheet",
    "ui/confirmation-dialog",
    "ui/settings-overlay",
    "ui/currency-indicator",
    "ui/lucide-icon-system",
    "audio/audio-manager",
    "juice/beat-sequencer",
    "juice/punch",
    "juice/ui-spring",
    "juice/feedback-channel",
    "juice/feedback-player",
    "monetization/iap-purchase-flow",
    "monetization/entitlements-service",
    "monetization/ads-service",
    "monetization/rewarded-ad-flow",
    "monetization/subscription-sdk",
    "monetization/subscription-vip",
    "monetization/multi-day-reward",
    "monetization/multi-day-reward-ui",
    "onboarding/ftue-engine",
    "onboarding/tutorial-overlay",
    "data/analytics-service",
    "data/local-notifications",
    "data/share-service",
    "data/storage-service",
    "data/server-time",
    "data/safe-area-service",
    "data/app-lifecycle",
    "data/catalog-system",
    "data/feature-flags"
  ],
  "iconNames": [
    "pad-grid",
    "recording",
    "shop",
    "settings",
    "back",
    "mute",
    "share"
  ]
}
```
