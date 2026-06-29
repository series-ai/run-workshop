# Authoring Packs — End-to-End Pack Creation Guide

The canonical guide for taking a pack from "I want a synthwave kit" to a
shipped, validated, visually-finished entry on the Packs screen. Lives in
this repo so anyone with a checkout + the `rundot` CLI can author a new
pack.

This doc owns the **process**. For the **audio internals** (per-kind
validator thresholds, magic numbers, the full `audio-fix-issues` decision
table), see [`docs/audio-kits.md`](./audio-kits.md).

The flow has three phases — each step below maps to one:

| Phase | What you do | Steps |
|---|---|---|
| **Generate** | Decide kit identity, scaffold a run, pre-flight the manifest, and run `rundot generate` to produce + trim + encode the audio. | 1 – 4 |
| **Validate** | Author the kit JSON (the validators read BPM + pad colors from it), then run the audio quality gates (detect → auto-fix → label/content alignment → full sweep) until the kit is clean. | 5 – 6, and 9 before shipping |
| **Integrate** | Generate cover art, confirm the kit auto-discovers into the catalog, and verify the pack on the Packs screen. | 7 – 8 |

---

## TL;DR — the flow

```bash
# 1. one-time per machine
#    install the rundot CLI and authenticate once: `rundot login`
#    (generation uses the stored session — no API key in .env).
#    Verify the generation surface: `rundot generate --help`

# 2. scaffold a new run — NOTE the run dir uses the HYPHENATED kit id
#    (underscores → hyphens); the label checker resolves the run by
#    `kitId.replace(/_/g, '-')`, so a snake_case dir is silently skipped.
mkdir -p pack-runs/<kit-id>-<YYYY-MM-DD>      # e.g. synthwave_neon → synthwave-neon-2026-06-29
cp pack-runs/lofi-heights-8bar-2026-05-03/manifest.json \
   pack-runs/<kit-id>-<YYYY-MM-DD>/manifest.json
# edit kitId / tempo / key / outputDir / barSec / trimSec
# rewrite every prompt with the genre's character

# 3. pre-flight the manifest (catches impossible requests for free)
node tools/validate-kit-manifest.mjs pack-runs/<kit-id>-<YYYY-MM-DD>

# 4. generate audio (~30-45 min)
npx tsx tools/generate-kit.ts "$(pwd)/pack-runs/<kit-id>-<YYYY-MM-DD>"

# 5. author the kit JSON FIRST — the validators read bpm + pad colors
#    from it (and default to 84 BPM when it's missing). This file is also
#    the catalog entry, so writing it now covers Step 8 too.
#    src/content-assets/kits/<kitId>.json   ← pad layout + catalog metadata

# 6. audio quality gates
npm run validate:audio:kit -- --kit <kitId>            # report (one kit)
node tools/audio-fix-issues.mjs --kit <kitId>          # auto-fix
node tools/check-label-content-alignment.mjs --kit <kitId>
npm run validate:audio                                 # full sweep across every kit (CI gate)

# 7. cover art (1:1 square, 1024×1024; cover renders on the Packs tile).
#    ONLY set the kit JSON's `coverArt` field once this PNG exists — a
#    dangling path 404s on the tile (see Step 7). If you can't generate one,
#    omit `coverArt` and the heroGradient + chrome placeholder renders.
rundot generate image \
  --prompt "<see § Cover-art prompts>" \
  --aspect-ratio 1:1 \
  --out pack-runs/<kit-id>-<YYYY-MM-DD>/cover-candidate.png \
  --json

# 8. catalog: nothing to wire — the kit JSON from step 5 auto-discovers
#    via Vite `import.meta.glob`. Just verify it shows on the Packs tile.

# 9. ship-readiness check
npm run test                                # vitest, includes BPM-flow assertion
npm run dev                                 # eyeball on Packs screen
```

Every step is detailed below, with the lessons-learned that drove each
constraint.

---

## What's in a pack

Each pack ships:

| Component | Lives in | Tracked? |
|---|---|---|
| 32 looping pads (8 drums, 8 bass, 8 melody, 8 vocals) | `public/cdn-assets/audio/<kitId>/*.mp3` | yes |
| 16 one-shots (8 fills, 8 FX) | same | yes |
| Cover image (1:1 square, 1024×1024) — optional | `public/cdn-assets/images/packs/<kitId>.png` | yes |
| Pad layout **and** catalog metadata (price, tier, hero gradient, ownership) | `src/content-assets/kits/<kitId>.json` | yes |
| Run dir (prompts, raw, trimmed, logs) | `pack-runs/<kit-id>-<date>/` | manifest.json yes; raw/logs/trimmed gitignored |

The kit JSON is the single source of truth for a pack: it carries both
the pad layout and the catalog `KitMeta`. There is **no** separate
catalog file or `seedKits` array to edit (see Step 8).

The 4×4 pad grid maps to 16 cells (one bank). Banks A and B together
give the 32-pad / 16-one-shot layout above.

---

## Prerequisites

1. The `rundot` CLI installed and authenticated. Run `rundot login` once —
   the CLI stores a session and every `rundot generate` call reuses it, so
   you do **not** put an API key in `.env` for generation. Verify the
   generation surface with `rundot generate --help`; it should list `music`,
   `sfx`, `tts`, and `image`. The RUN platform manages the underlying
   music / speech / image generation backends and their credentials (the
   provider is credited in-app — see § License + attribution). To target a
   specific game, either run from the game's rundot config or set
   `RUNDOT_SANDBOX_GAME_ID` (passed through as `--game-id`).

2. `ffmpeg` on `PATH` (the validators decode every mp3 through it).

3. A node toolchain matching the project (`nvm use` against `.nvmrc`).

`generate-kit.ts` reads `RUNDOT_SANDBOX_GAME_ID` from the environment and
passes it to `rundot generate --game-id` when present; otherwise `rundot`
falls back to its own local sandbox config.

---

## Step 1 — Decide kit identity

Pick before scaffolding:

| Field | Constraint | Example |
|---|---|---|
| `kitId` | snake_case, no copyrighted names (root CLAUDE.md §Naming) | `synthwave_neon` |
| `bpm` | one of the canonical genre tempos below | `100` |
| `key` | minor preferred for darker mood; **every loop in the kit MUST share this key** | `C minor` |
| `tier` | `hero` / `genre` / `themed` / `subscriber` | `genre` |
| `flavor` | Packs-tile copy, ≤ 60 chars, sensory not generic | `"Cassette synths, neon rain, late drives."` |
| `heroGradient` | two hex stops; renders behind cover art when image fails to load | `["#7048ff", "#ff5fb1"]` |

**BPM bands** (use these unless you have a reason):

| Genre | BPM | Bar-seconds |
|---|---|---|
| lofi / chill | 80–90 | 2.857 (84) |
| boom-bap hip-hop | 88–95 | 2.667 (90) |
| synthwave | 95–110 | 2.400 (100) |
| house | 118–125 | 2.000 (120) |
| trap | 130–150 | 1.846 (130) |
| drum-and-bass | 160–175 | 1.500 (160) |

Bar-seconds = `60 / bpm × 4`. The full 8-bar loop length is `barSec × 8`.
For 100 BPM that's 19.2s. For 120 BPM, 16.0s.

**Hard music-generator constraint:** `barSec × bars + 8s downbeat
headroom ≤ 60s` (the backend caps a single generation at 60s). The
pre-flight validator (step 3) enforces this. At 84
BPM you can do 16 bars; at 60 BPM you can't even do 8. Pick a tempo that
gives you room.

---

## Step 2 — Scaffold the run

The run directory is the workspace. Everything for one pack lives there
until the audio lands in `public/`. Copy the closest reference:

```bash
# Use the HYPHENATED kit id for the directory name. `check-label-content-
# alignment.mjs` finds the run via `kitId.replace(/_/g, '-')`, so a
# snake_case dir (synthwave_neon-…) is silently skipped (SKIP — no manifest).
mkdir -p pack-runs/<kit-id>-$(date +%F)        # e.g. synthwave-neon-2026-06-29
cp pack-runs/lofi-heights-8bar-2026-05-03/manifest.json \
   pack-runs/<kit-id>-$(date +%F)/manifest.json
```

Reference packs by genre:

| Genre archetype | Reference run |
|---|---|
| Chill / lofi (84 BPM) | `lofi-heights-8bar-2026-05-03/` |
| Boom-bap hip-hop (90 BPM) | `hiphop-brooklyn-hero-2026-05-04/` |
| Synthwave (100 BPM) | `midnight-synthwave-2026-05-04/` |
| Drum-and-bass (160 BPM) | `skyway-dnb-2026-05-04/` |
| House (120 BPM) | `glass-house-2026-05-04/` |

Edit the manifest top-level fields:

```jsonc
{
  "version": 3,
  "kitId": "<kitId>",
  "tempo": <bpm>,
  "key": "<C minor>",
  "outputDir": "<absolute path to public/cdn-assets/audio/<kitId>>",
  "barSec": <60 / bpm × 4>,
  "trimSec": <barSec × 8>,
  "rawSec": 40,
  "voices": { "femaleSoft": "21m00Tcm4TlvDq8ikWAM", "maleSoft": "TxGEqnHWrfWFTfGW9XjX" }
}
```

> The top-level `voices` map is documentation only — the orchestrator
> does **not** read it. A `tts` vocal item must carry its own `voiceId`
> (see Step 4).

Then rewrite every `items[].prompt`. The structural envelope stays
identical; only the genre/instrument/groove descriptors change. See
**§ Prompt templates** below for the per-kind skeletons.

---

## Step 3 — Pre-flight the manifest

Run **before** burning credits on `rundot generate` calls:

```bash
node tools/validate-kit-manifest.mjs pack-runs/<kit-id>-<date>
```

Catches:

- **`rawSec > 60`** — the music generator caps at 60s. Lower your `rawSec`
  or raise `tempo`.
- **`barCount × barSec + 8 > 60`** — same ceiling, derived from bars.
- **Vocal `barCount` not in {8, 16, 32}** — voice rendering has effective
  minima.
- **Non-vocal loop `barCount ≠ 8`** — kit-wide loop length is fixed.
- **`barSec` contradicts `tempo`** — typo'd one without updating the
  other. Easy off-by-one.
- **`outputDir` doesn't exist** — typically a missing `mkdir -p`.
- **Duplicate `file` keys** — would clobber on regen.
- **Artist names in prompts** — `ARTIST_NAME_BLOCKLIST` rejects names
  that the generator's content policy will reject downstream (1-credit fail otherwise).
  Current blocklist includes:

  ```
  aretha, curtis mayfield, marvin gaye, diana ross, roberta flack,
  the delfonics, j dilla, jay dee, 9th wonder, pete rock, dj premier,
  ltj bukem, high contrast, goldie, roni size, kraftwerk, daft punk,
  stardust, modjo, spiller, robin s, crystal waters
  ```

  Extend `tools/validate-kit-manifest.mjs:ARTIST_NAME_BLOCKLIST` as new
  rejections surface. **Never name a real living/recent artist in a
  prompt** — describe the *style* instead ("dusty 90s NY hip-hop
  sampled-from-vinyl character" not "J Dilla style").

Exit 0 means the request is shape-correct. It does not vouch for the
audio quality — that's the job of step 6.

---

## Step 4 — Generate audio

The orchestrator dispatches each manifest item to the matching
`rundot generate` subcommand, writing the raw clip to
`pack-runs/<run>/raw/<file>` via `--out`, then trims + encodes it:

```bash
npx tsx tools/generate-kit.ts "$(pwd)/pack-runs/<kit-id>-<date>"
```

Under the hood, that is equivalent to these per-item calls (item `kind`
+ `type` select the subcommand):

```bash
# drums / bass / melody (kind in {drum, bass, melody})  → music
rundot generate music --prompt "<prompt>" --duration 40 \
  --out pack-runs/<run>/raw/drums-1.mp3 --json

# vocals — the reference packs render SUNG vocals through the music backend
# by setting "type": "music" on the vocal item (no voice id needed). Use the
# a-cappella / "voice only" prompt discipline from § Prompt templates.
rundot generate music --prompt "<voice-only prompt>" --duration 40 \
  --out pack-runs/<run>/raw/vocals-A-0.mp3 --json

# vocals — SPOKEN/TTS alternate: a vocal item with no "type" defaults to
# "voice" → tts, which REQUIRES a per-item "voiceId" or generate-kit.ts
# fails with "voice item is missing voiceId". (The top-level `voices`
# map is NOT auto-applied — set voiceId on the item itself.)
rundot generate tts --text "<prompt>" --voice-id <id> \
  --out pack-runs/<run>/raw/vocals-A-0.mp3 --json

# one-shot FX (kind: oneShot, type: sfx)                → sfx
rundot generate sfx --description "<prompt>" --duration 1.2 \
  --out pack-runs/<run>/raw/fx-1.mp3 --json
```

When `RUNDOT_SANDBOX_GAME_ID` is set, the orchestrator appends
`--game-id <id>` to each call.

Per file: the music generator renders up to ~60s of raw audio, the
trim-finder hunts a clean 8-bar window, ffmpeg encodes mp3 at 256 kbps
with `volume=0.55` headroom. ~30–45 min for 48 files.

**Resumable.** Pass `--only drums-1.mp3` to regenerate one item:

```bash
npx tsx tools/generate-kit.ts <run-dir> --only drums-1.mp3
```

**Expanding a partial pack / regenerating a subset.** Keep one canonical
48-item manifest, and drive a subset with a shell loop over `--only`. A
skip-if-exists guard makes the loop idempotent, so a partial failure
(network blip, ToS-rejected vocal) just re-runs the missing files
without re-burning credits on the good ones:

```bash
RUNDIR="$(pwd)/pack-runs/<kit-id>-<YYYY-MM-DD>"
OUT="public/cdn-assets/audio/<kitId>"
for f in drums-3 drums-4 bass-3 vocals-B-0 fx-B-3; do   # the items you want
  [ -f "$OUT/$f.mp3" ] && { echo "skip $f"; continue; }
  npx tsx tools/generate-kit.ts "$RUNDIR" --only "$f.mp3"
done
```

`generate-kit.ts` exits non-zero on a failed item — check the per-item
logs under `<run-dir>/logs/` when one fails. (`tsx` opens an IPC pipe at
startup, so run this in a real shell, not a locked-down sandbox that
blocks `listen()`.)

Why those magic numbers (256 kbps, `volume=0.55`, 0.04 RMS floor) — see
[`docs/audio-kits.md` § Why those magic numbers](./audio-kits.md).

---

## Step 5 — Author the kit JSON

Author this **before** running the audio validators (Step 6). The
validators read `bpm` and per-pad `color` from this file and silently
fall back to **84 BPM / lofi defaults** when it's missing — so a
non-84-BPM kit validated before this file exists gets every loop
false-flagged as `BAR_VIOLATION`. This same file is the catalog entry
(Step 8), so writing it now covers both.

Copy the closest existing kit JSON and rewrite:

```bash
cp src/content-assets/kits/lofi_heights_hero.json \
   src/content-assets/kits/<kitId>.json
```

Top-level fields:

```jsonc
{
  "id": "<kitId>",                        // snake_case, matches the JSON filename
  "name": "<Display Name>",
  "bpm": <bpm>,
  "key": "Cmin",                          // pitch-class + mode, NO space (Cmin/Fmin/Amin).
                                          // NB: the run manifest uses the human form ("C minor").
  "flavor": "<≤60 char tile copy>",
  "bpmRange": "<bpm>",                   // pinned; live tempo TBD in v2
  "layers": 8,                            // always 8 (the column count)
  "ownership": "owned" | "paid" | "subscriber" | "trial",
  "priceRunbucks": <0 if owned/free, else int>,
  "tier": "hero" | "genre" | "themed" | "subscriber",
  "heroGradient": ["<#hex1>", "<#hex2>"],
  "comingSoon": false,
  "coverArt": "images/packs/<kitId>.png",  // OPTIONAL — set ONLY when the PNG exists.
                                           // Omit the field entirely if you have no
                                           // cover yet (the heroGradient + chrome render).
                                           // A dangling path 404s on the tile (see Step 7).
  "pads": [ /* 48 entries — see below */ ]
}
```

Per-pad fields:

```jsonc
{
  "padId": "A-block-0-0",                // bank-block-variant
  "color": "drums",                       // drums|bass|melody|vocals|drumFills|fx
  "bank": "A",                            // A|B
  "blockId": "block-0",                   // block-0..5
  "variantIndex": 0,                      // 0..3 within block
  "isOneShot": false,                     // true for the drumFills (block-4) + fx (block-5) blocks
  "layerId": "drums-A-0",                 // unique within kit
  "bufferUrl": "audio/<kitId>/drums-1.mp3",
  "layerName": "<player-facing label, ≤16 chars>"
}
```

**Block → color map** (each block is one 4-pad column, banks A and B):

| block | color | isOneShot |
|---|---|---|
| `block-0` | `drums` | no |
| `block-1` | `bass` | no |
| `block-2` | `melody` | no |
| `block-3` | `vocals` | no |
| `block-4` | `drumFills` | **yes** |
| `block-5` | `fx` | **yes** |

A full pack is **48 pads** = 6 blocks × 4 variants × 2 banks (A/B) = 32
loops + 16 one-shots.

**Audio file-naming convention** (the manifest `file` and the kit
`bufferUrl` must agree). For historical reasons the names are not fully
uniform — match this exactly or the pad 404s:

- Bank A drums / bass / melody / fx use **legacy 1-indexed** names:
  `drums-1..4`, `bass-1..4`, `melody-1..4`, `fx-1..4`.
- Bank A vocals + fills and **all** of bank B use
  `<color>-<bank>-<index>` (0-indexed): `vocals-A-0..3`, `fills-A-0..3`,
  `drums-B-0..3`, `bass-B-0..3`, `melody-B-0..3`, `vocals-B-0..3`,
  `fills-B-0..3`, `fx-B-0..3`.

(Copy the `pads` array from an existing full pack such as
`midnight_synthwave.json` and rewrite `layerName` + `bufferUrl` kit id —
the padId/blockId/variantIndex/file scaffold is identical across packs.)

**`layerName` rules** (these are surfaced to players):

- Specific, not generic. "Boom Bap" beats "Drums"; "Window Bus" beats
  "Pad".
- Distinct within the same color. No two drum pads named "Kick" in the
  same kit.
- Distinct across packs in the same position. Don't name two different
  packs' `block-0 variant-0` pad "Choir Pad".
- Short. The pad cell renders ~12-16 characters; longer truncates.
- **Reflects the audio.** Run `check-label-content-alignment.mjs` after
  edits.

---

## Step 6 — Audio quality gates

Three validators, run in order. All of them read `bpm` and pad `color`
from the kit JSON you authored in Step 5 — if you skipped ahead, go back:
without it everything is measured against 84 BPM / lofi colors.

### 6a. Audio defects

```bash
npm run validate:audio:kit -- --kit <kitId>           # report
node tools/audio-fix-issues.mjs --kit <kitId>         # auto-fix
npm run validate:audio                                # all kits + cross-kit summary (CI gate)
```

Verdicts (high level — full table in `docs/audio-kits.md`):

| Verdict | What it means | Fix |
|---|---|---|
| `CLIPPED` | mono peak > 1.20 | auto: re-encode at `volume=0.55` |
| `CUT_OFF` | hard click at the loop wrap | auto: 32ms blend splice; re-trim if head/tail differ |
| `LOOP_TAIL_FADE` | tail energy stays flat or rises into the wrap (no decay) — wrap click likely even when sample-0 ≈ sample-N | regen with a "natural release on the last beat" instruction; `LENGTH_MISMATCH` is sometimes the underlying cause |
| `LOUDNESS_OUTLIER` | full-loop RMS is > 2.5× or < 0.4× the kit median | regen, OR normalize via `audio-fix-issues.mjs` once it learns the rule |
| `CYCLE_DRIFT` (drums) | peak > 100ms off any quarter-note | auto: rotate to peak |
| `CYCLE_DRIFT` (bass/melody/vocal) | same | regen — rotation breaks pitched content |
| `SUSPICIOUS` | tail RMS + wrap discontinuity over thresholds | manual: `audio-phase-align.mjs --no-rotate --blend-ms 32` |
| `PHRASE_LOCKED` | one bar near-silent vs others loud | regen — fade-out in source |
| `BAR_VIOLATION` | duration ≠ `barSec × bars` | regen (or you validated before authoring the kit JSON — fix the order) |
| `LENGTH_MISMATCH` | bar count ≠ kit-wide expected | regen |
| `SUSTAIN_GAP` | sub-bar dropout in sustained-energy material (the **Reese-sub gap** detector) | regen with a "no silent bars, continuous bass energy" prompt |
| `SUSTAIN_CLICK` | isolated sample-level glitches in sustained material (the **Wobble-bass click** detector) | regen — render artefact |
| `SILENT_ATTACK` | one-shot's full-loop RMS < 0.03 AND peak < 0.1 | re-trim from a different offset (caught the silent intro) |
| `TOO_SHORT` / `ERROR` | unreadable | regen |

`audio-fix-issues.mjs` runs `detect → fix → re-detect` up to 3
iterations and exits non-zero if **any** verdict remains — including a
"fixable" verdict like `CUT_OFF` whose deterministic fix didn't converge.
Treat a non-zero exit as "still broken", and always confirm with
`npm run validate:audio` (the CI gate), not the fixer's summary alone.

For residue, **try a different trim offset from the saved `raw/` first**
before regenerating from scratch. The generator returns 90–125s of audio;
the first chosen window is often not the only viable one. Use
`tools/retrim-existing-audio.mjs` (it re-picks the offset with
`find-trim-no-dropout.mjs`, which rejects faded/quiet bars that the
plain downbeat picker keeps), or call `tools/find-trim-no-dropout.mjs
<raw.mp3> <trimSec> <downbeat|smooth>` directly to inspect candidate
offsets (`downbeat` for drums/bass/melody, `smooth` for vocals).

### 6b. Label-content alignment

```bash
node tools/check-label-content-alignment.mjs --kit <kitId>
```

The kit JSON's `layerName` is what the player reads under each pad.
The manifest's `prompt` is what the audio actually is. The validator
checks that at least one substantive content word from the label appears
in the first 200 chars of the prompt. Generic words ("vocal", "hook",
"sample") are stoplisted. It resolves your run dir by the **hyphenated**
kit id (Step 2) — a snake_case run dir reports `SKIP … no manifest`.

This catches the bug where a pad labeled "Oh Yeah" was backed by a
generic soul-hook prompt with no "oh yeah" content — the player tapped
the pad expecting the vocal hook in the title and got something else.
Failure means: rename the label OR rewrite the prompt with the literal
content. **Don't ship a mismatch** — it reads as broken even when the
audio is fine.

### 6c. BPM-flow assertion

`src/__tests__/kit-bpm-flow.test.ts` asserts that every loop's
duration is an integer multiple of `secondsPerBar(kit.bpm)`. Runs as
part of `npm run test`.

If a single loop violates this, the kit's pads will drift against each
other — a 7.99s loop layered with an 8.00s loop accumulates 240ms drift
over the first 30 layered passes. The validator above catches it as
`BAR_VIOLATION`; this test catches it across the whole catalog so a
regression in one pack doesn't ship in another.

---

## Step 7 — Cover art

Each pack ships a **1:1 square** cover image, **1024×1024**, at
`public/cdn-assets/images/packs/<kitId>.png` (match the existing covers —
they are all 1024×1024). It renders behind the kit title on the Packs
tile, on the kit-detail screen, and as the hero in the RecordingReview
modal when a player replays a saved mix from this kit.

> **The cover is optional, but a *dangling* `coverArt` path is not safe.**
> `KitCard` always paints the `heroGradient` underlay, then renders the
> cover `<img>` **unconditionally whenever the kit JSON sets `coverArt`** —
> there is no `onError` fallback, and the tier-chrome placeholder is only
> drawn when `coverArt` is **absent**. So:
> - **Have a cover?** Set `coverArt` and ship the PNG at the path above.
> - **No cover yet** (e.g. `rundot generate image` is unavailable — see
>   below)? **Omit the `coverArt` field entirely.** The tile then renders
>   the gradient + chrome placeholder cleanly.
> - **Never** point `coverArt` at a file that doesn't exist — it 404s on
>   the Packs tile and suppresses the placeholder chrome. (This is exactly
>   how `phonk_midnight` shipped a 404 before its cover was generated.)

### Generate

Generate the cover directly to a candidate path:

```bash
rundot generate image \
  --prompt "<see prompt template below>" \
  --aspect-ratio 1:1 \
  --out pack-runs/<kit-id>-<date>/cover-candidate.png \
  --json
```

> **If `rundot generate image` is unavailable.** The endpoint can fail
> server-side (observed: `VenusServerApiException: Image generation
> failed`, and `image-models` → HTTP 404). When it does, you cannot
> produce the production-CDN cover this way. Either (a) ship the pack
> **coverless** by omitting `coverArt` until the service is back, or
> (b) produce a 1024×1024 PNG by some other means and drop it at the
> tracked path. Do not leave a dangling `coverArt` pointing at a file you
> never created.

**Reference images** keep new covers visually consistent with the
catalog, but `--reference-image` only accepts an `https://` URL or a
`data:` URI **unless** you also pass `--game-id <id>` for a game that
has an owner. A bare local path (e.g. a file under `public/`) is
rejected with *"local files and file keys require a game — pass an
https:// URL or data: URI instead."* If you don't have a hosted
reference, skip the flag — `heroGradient` is the fallback (see the
callout above for what "fallback" actually does).

Generate a few candidates to different `--out` paths and pick the best —
more than ~4 burns budget for marginal gain; fewer often misses the
right composition. Style consistency comes from the reference image, not
from text in the prompt.

### Convert + ship

The generator may return a non-square image — center-crop to a clean
1024×1024 square (the catalog standard) before shipping:

```bash
# Pick the best candidate, then fill-crop to the square cover size:
magick pack-runs/<run>/cover-candidate.png \
  -resize 1024x1024^ -gravity center -extent 1024x1024 -strip \
  public/cdn-assets/images/packs/<kitId>.png

# Verify dimensions (should report 1024x1024)
identify public/cdn-assets/images/packs/<kitId>.png
```

Use the `.png` extension at the tracked path to match the rest of the
catalog (the asset pipeline keys covers by that path).

### Cover-art prompt template

```
A 1:1 square album-cover for a <genre> beat pack called "<Kit Name>".
<Single-sentence sensory scene that matches the kit's flavor copy —
mood, time of day, location, materials, weather>. Bold neon
<2-3 colors that tie to heroGradient> palette. Centered focal subject,
balanced negative space, dramatic rim lighting. No text, no typography,
no watermark, no logos, no words, no letters. Cinematic, evocative,
album-art finish.
```

Concrete example for `synthwave_neon`:

```
A 1:1 square album-cover for a synthwave beat pack called "Neon Drift".
A long stretch of empty highway at dusk under a violet sky, retro
chrome car streaking past with neon underglow leaving a magenta-and-cyan
light trail. Bold neon purple, hot magenta, and cyan palette. Centered
focal subject, balanced negative space, dramatic rim lighting. No text,
no typography, no watermark, no logos, no words, no letters. Cinematic,
evocative, album-art finish.
```

Why each clause matters:

- **"1:1 square album-cover"** — the model needs the format cue in the
  prompt, not just the `--aspect-ratio` flag.
- **Sensory scene tied to flavor copy** — the cover and the `flavor`
  string are read together on the Packs tile. They should describe the
  same world.
- **Bold neon `<colors>` palette** — pin to the same hexes as
  `heroGradient` so the gradient fallback transitions cleanly to the
  loaded image.
- **Centered focal subject, balanced negative space** — covers display
  small (~180px wide on the Packs grid). Edge-of-frame detail vanishes;
  centered focal points read at thumbnail size.
- **No text, no typography, no watermark, no logos, no words, no
  letters** — the model will otherwise add fake band names or watermarks.
  Repetitive listing is the only thing that consistently suppresses it.
- **Cinematic, evocative, album-art finish** — flips the model from
  "stock-photo" mode to "music-cover" mode.

---

## Step 8 — Catalog registration

There is **no separate registration step**. The catalog is built at load
time by `loadCatalog()` in `src/stores/kitsStore.ts`, which eagerly
imports every `src/content-assets/kits/*.json` via Vite
`import.meta.glob`. The kit JSON you authored in Step 5 ships its full
`KitMeta` — pad layout **and** catalog metadata (`tier`, `ownership`,
`priceRunbucks`, `heroGradient`, `flavor`, `coverArt`). Dropping that
file in **is** the registration.

Do **not** add the kit to a `seedKits` array or any hardcoded list in
`kitsStore.ts` — the legacy per-kit arrays were removed in favour of
`loadCatalog()`. There are no TS edits to make here.

Verify after the JSON lands (e.g. `npm run dev`):

- Tile appears under the right Packs section (Owned / Available /
  Subscriber), driven by `ownership`.
- Hero gradient renders behind the cover art (visible briefly while the
  cover image loads, and as the permanent fallback if no cover ships).
- Tapping the tile opens kit-detail without a crash.

---

## Step 9 — Quality gates before shipping

Before opening a PR for a new pack, all of these MUST be green:

```bash
# 1. typecheck
npx tsc --noEmit

# 2. unit tests (includes BPM-flow assertion + label-content)
npm run test

# 3. dev server eyeball
npm run dev
#   - Open Packs tab — cover renders, label looks good
#   - Tap kit-detail — preview audio plays back without artifacts
#   - Tap "Use this pack" — Play screen loads with the new kit's pads
#   - Tap a few pads — no clicks at loop wrap, no drift, no muddy mix
#   - Hold a pad through 2 full bars — no SUSTAIN_GAP, no SUSTAIN_CLICK
#   - Layer 4-6 pads — they stay phase-locked
```

If any of those fail, fix in the run dir + regen the affected file.
**Don't paper over a single broken loop with a stub** — the kit ships as
a unit, and a single bad pad makes the pack feel broken.

---

## Prompt templates

The structural envelope below is shared across all loop kinds. Swap only
the `<...>` placeholders. The non-placeholder text is non-negotiable —
each clause was added to fix a specific failure mode.

### Loop — drums

```
<groove descriptor> drum loop, <bpm> BPM, <key> key context, 8 bars.
<Beat-by-beat pattern: kick on N, snare on N, hi-hat figure>.
Strong, accented kick attack on the downbeat of bar 1 (loudest moment
of the loop). All 8 bars play the same locked groove with continuous
percussion — no fades, no silent bars, no intro, no outro. Loopable.
<Texture: vinyl-grit / clean / dusty / punchy>. <Genre cue: 90s NY
hip-hop / 2000s house / synthwave>. Just drums, no instruments, no
bass, no melody, no vocals.
```

### Loop — bass

```
<Genre> bass loop, <bpm> BPM, in <key>, 8 bars. Strong, accented
attack on <root pitch + octave, e.g. F1> at the downbeat of bar 1
(loudest moment of the loop), then <pattern description: deep round
sub holding the root / walking line through I-iv-V-I / etc.>.
Continuous bass energy across all 8 bars; no fades, no silent bars,
no intro, no outro. Loopable. <Texture cue>. Just bass, no drums,
no melody, no vocals.
```

### Loop — melody / pad

```
<Genre> <instrument> loop, <bpm> BPM, in <key>, 8 bars. <Phrase
shape: arpeggio / stab pattern / sustained chord progression>.
Strong, accented attack on the downbeat of bar 1 (loudest moment of
the loop). Bars 1 through 6 keep this exact pattern locked. Bar 7
adds a single ghost <note/embellishment>. Bar 8 is a turnaround
<that lands on the I chord>. Continuous melody across all 8 bars;
no silent bars, no fades. Loopable. <Texture: dusty Rhodes / Juno-60
/ DX7 bell>. Just <instrument>, no drums, no bass, no vocals.
```

### Loop — vocal

```
PURE vocal — no background music, no instruments, no drums, no bass,
no melody. Voice only. <Genre> <vocal style> in <key>, <bpm> BPM,
8 bars. <Specific syllables / words / phonetic shape — write what the
voice should sing>. Strong, accented attack on the downbeat of bar 1
(loudest moment of the loop). Continuous vocal energy across all 8
bars; no fades, no silent bars. Loopable. <Voice character: smoky
female alto / breathy male tenor / chopped-and-screwed / gospel
choir>. Voice only — nothing else.
```

### One-shot — drum fill

```
Single <fill descriptor: tom roll / snare flam / cymbal swell>,
<duration in seconds>. <Character: gritty / clean / vinyl-dusty>.
No bass, no melody, no vocals. Just one drum fill.
```

### One-shot — FX

```
<Sound description: vinyl crackle riser / synth riser / glass shatter
/ tape stop>, <duration in seconds>, fades naturally. <Texture:
analogue tape warmth / clean digital / detuned chorus>. Atmospheric,
not musical.
```

---

## Why each clause matters (lessons learned)

These were captured the hard way — every clause in the templates above
exists because we shipped a pack without it and the player heard the
problem.

| Clause | Failure mode without it |
|---|---|
| `"in <key>"` on every loop | Loops layer in different keys → dissonance |
| `"<bpm> BPM"` first sentence | Render BPM drifts → BAR_VIOLATION |
| `"strong, accented attack on the downbeat of bar 1"` | Loudest peak lands mid-bar → CYCLE_DRIFT for pitched content |
| `"continuous <energy> across all 8 bars; no silent bars, no fades"` | the generator fades or pauses → PHRASE_LOCKED, SUSTAIN_GAP |
| `"All 8 bars play the same locked groove"` (loops) | Render evolves bar-by-bar → drum/bass loops drift against each other |
| `"loopable"` | Render ends with reverb tail → CUT_OFF at wrap |
| `"PURE vocal — no instruments"` (vocal pads) | Backing track baked in → muddy layered playback |
| `"Just <inst>, no <other categories>"` | Full mix on every pad → double drums when player layers |
| Specific syllables on vocal pads | Generic mumbling that doesn't match the label |
| `"<duration> seconds"` (one-shots) | Renders too long, trim cuts mid-decay |
| `"fades naturally"` (FX) | Hard cut at sample boundary → click |
| `"no fades, no intro, no outro"` | Bar 8 is a fade-out → near-silent bar |

When you write a new genre's prompts, start by copying a reference
manifest verbatim and rewriting only the `<...>` placeholders. Don't
remove non-placeholder text without a specific reason — every clause is
load-bearing.

---

## Common gotchas (don't re-derive these)

1. **Vocal "too sing-y" / "too vocally"** — caused by the music generator
   layering background music under the voice. Fix: re-author the prompt
   with `"PURE vocal — no background music, no instruments, no drums,
   no bass, no melody. Voice only."` verbatim and `"Voice only — nothing
   else."` as the closer. Both clauses, not one.

2. **`audio-phase-align.mjs` rotation breaks bass and melody.** It
   rotates the loop so sample 0 sits at the loudest peak — correct for
   drums (loudest = downbeat) but wrong for sustained-pitched content
   (sustain peaks land mid-bar). Use trim-offset selection instead.

3. **CUT_OFF surviving 2 fix iterations** means head/tail energies
   differ too much for splice-blend. Re-trim from the same raw at a
   different offset before regenerating. `audio-fix-issues.mjs` now exits
   non-zero when this residue remains (it does not report a false pass).

4. **SUSPICIOUS on a sustained-tail loop** (sax, pad, choir) is
   splice-fixable even though the auto-fixer skips it. Run
   `audio-phase-align.mjs --no-rotate --blend-ms 32` manually.

5. **128 kbps mp3 round-trips poorly with `volume=0.55`.** Use 256 kbps.

6. **The validator decodes mono with sum-not-mean.** A stereo peak of
   0.6 becomes mono peak 1.2. Always pre-scale with `volume=0.55`.

7. **Don't use `alimiter` for makeup gain** — it lookahead-squashes loud
   peaks, flipping which 10ms frame is loudest and producing
   CYCLE_DRIFT. Linear scalar gain (`volume=`) preserves peak structure.

8. **Cover art with edge-of-frame detail vanishes** at thumbnail size.
   Always center the focal subject and verify by viewing the cover at
   180px wide.

   **Covers are 1:1 1024×1024**, not 4:5 — match the existing catalog.
   And only set `coverArt` once the PNG exists: `KitCard` renders the
   `<img>` unconditionally when `coverArt` is set (no `onError`), so a
   dangling path 404s on the tile and hides the chrome placeholder. No
   cover yet? Omit the field.

9. **`heroGradient` should match cover-art palette.** The gradient
   shows briefly while the image loads; a blue gradient under a red
   cover flashes wrong on slow connections.

10. **Never name a real living artist in any prompt.** The generator's
    content policy rejects them. Describe the *style* instead. The
    `ARTIST_NAME_BLOCKLIST` in `validate-kit-manifest.mjs` is the
    canonical list; extend as new rejections surface.

11. **Sustained-bass genres (phonk / trap 808s) fight the validators.**
    A quiet tail (needed to avoid `CUT_OFF`/`SUSPICIOUS`) reads as
    `SUSTAIN_GAP`, while a fully-continuous sub puts its loudest moment
    mid-bar → `CYCLE_DRIFT`. The convergent recipe: prompt for
    "continuous energy **with** a hard re-struck downbeat accent on beat
    1 of every bar" so the sub never drops out yet the downbeat is the
    loudest moment, then pick the window with `find-trim-no-dropout.mjs`.

---

## License + ownership

All audio is generated through the `rundot generate` commands and is
workshop-owned content authored for this repository. The RUN platform
pipeline does not require an in-app generator attribution, so there is no
mandatory attribution string to carry in Credits.

---

## Reference packs

| Pack | Run dir | What it demonstrates |
|---|---|---|
| `lofi_heights_hero` | `pack-runs/lofi-heights-8bar-2026-05-03/` | The reference. 84 BPM, C minor. All prompt templates landed here first. |
| `hiphop_brooklyn_hero` | `pack-runs/hiphop-brooklyn-hero-2026-05-04/` | 90 BPM, F minor. Boom-bap drum patterns + the "phrase-locked, no fades" envelope. |
| `midnight_synthwave` | `pack-runs/midnight-synthwave-2026-05-04/` | 100 BPM, A minor. Synthwave pad textures + the cover-art gradient pattern. |
| `skyway_dnb` | `pack-runs/skyway-dnb-2026-05-04/` | 160 BPM, D minor. Tight-tempo bar arithmetic; surfaced the SUSTAIN_GAP / SUSTAIN_CLICK detectors via Reese-sub + wobble-bass artifacts. |
| `glass_house` | `pack-runs/glass-house-2026-05-04/` | 120 BPM, A minor. House. Tested the manifest pre-flight ceiling at higher tempo. |

When you pick a reference to copy, pick the one closest in **tempo
band** first, then in **genre**. The structural envelope (bar-1 attack,
all-8-bars-locked, PURE vocal) is reused; the stylistic descriptors are
where each pack diverges.
