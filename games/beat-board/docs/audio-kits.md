# Audio Kits — Audio Internals Reference

> **Looking for "how to make a new pack"?** See
> [`docs/authoring-packs.md`](./authoring-packs.md) — the end-to-end
> guide that covers scaffolding, prompts, validation, cover art, and
> catalog wiring. This doc is the deeper reference on the audio
> internals only: validator thresholds, magic numbers, and the
> `audio-fix-issues` decision table.

Each kit is 48 audio files (32 looping pads + 16 one-shots) bound to a
fixed BPM and key so every pad combination plays cleanly together.

The reference implementation is `lofi_heights_hero`. Everything below is
extracted from `pack-runs/lofi-heights-8bar-2026-05-03/`.

## What is a kit?

A kit is the catalog entry the player selects from the Packs screen. Each
kit ships:

| Layer | Count | Type | Length |
|---|---|---|---|
| `drums-{1-4}` + `drums-B-{0-3}` | 8 | loop | 8 bars |
| `bass-{1-4}` + `bass-B-{0-3}` | 8 | loop | 8 bars |
| `melody-{1-4}` + `melody-B-{0-3}` | 8 | loop | 8 bars |
| `vocals-A-{0-3}` + `vocals-B-{0-3}` | 8 | loop | 8 bars |
| `fills-A-{0-3}` + `fills-B-{0-3}` | 8 | one-shot | 0.6–1.8 s |
| `fx-{1-4}` + `fx-B-{0-3}` | 8 | one-shot | 0.8–1.8 s |

8 bars at the kit's BPM. For 84 BPM: 22.857142857 s per loop. For 90 BPM:
21.333333333 s per loop. Formula: `bars × 4 × 60 / bpm`.

The pad layout (which file maps to which 4×4 cell) lives in
`src/content-assets/kits/<kitId>.json`. Filenames are conventional, not
required — the `bufferUrl` in the kit JSON is the contract.

## Directory layout

```
games/beat-board/
├── docs/audio-kits.md                                 ← this file
├── public/cdn-assets/audio/<kitId>/                   ← shipped audio
│   ├── drums-1.mp3 …
│   └── fx-B-3.mp3
├── src/content-assets/kits/<kitId>.json               ← pad layout / metadata
└── pack-runs/<kitId>-<purpose>-<YYYY-MM-DD>/          ← generation workspace
    ├── manifest.json                                  ← prompts + targets (tracked)
    ├── raw/                                           ← unprocessed rundot output
    ├── trimmed/                                       ← post-trim slices
    ├── logs/                                          ← per-file + master log
    └── results.json                                   ← per-file status
```

Inside a run dir only `manifest.json` is tracked; `raw/`, `trimmed/`,
`logs/`, and `results.json` are gitignored. The
`public/cdn-assets/audio/<kitId>/` tree and the kit JSON are tracked.

## Prompt constraints — bake these into every prompt

These are non-negotiable per-pad-type constraints that the music generator
will silently ignore if you don't say them. Every prompt for the
matching pad type must include the constraint verbatim.

**Loops (drums / bass / melody):**
- `"in <KEY> minor"` for bass and melody (drums omit but should mention
  "in <KEY> key context" to keep the rendered tone musical).
- `"<N> bars"` and the bar-by-bar phrase shape: bars 1–6 lock the
  pattern, bar 7 has a small variation, bar 8 is a turnaround.
- `"continuous percussion across all 8 bars"` (drums) /
  `"continuous bass energy across all 8 bars; no silent bars"` (bass)
  / `"continuous melody across all 8 bars"` (melody) — the model will
  otherwise fade out, leaving a near-silent bar that fails
  PHRASE_LOCKED.
- `"strong, accented attack on the downbeat of bar 1"` — coaxes the
  loudest peak onto a beat so the validator's CYCLE_DRIFT gate
  passes. Critical for sustained-pitched content (bass, pad).
- `"Just <instrument>, no drums, no melody, no vocals"` — explicitly
  exclude every category the pad isn't. Without this you get a full
  mix on every pad and layered playback turns into mud.

**Vocals (`color: 'vocals'`, `kind: 'vocal'`):**
- `"PURE vocal — no background music, no instruments, no drums, no
  bass, no melody. Voice only."` — the generator will otherwise
  hallucinate a backing track. The kit's whole point is layering, so
  vocal pads stacking with built-in beats is a mix disaster.
- The phrase shape rules above (8 bars, bar-1 attack, continuous
  energy) apply equally.
- For chopped / hooky vocals, write the exact syllables — the model
  treats them as lyric input.

**One-shots (`kind: 'oneShot'`, blocks 4 + 5):**
- Every pack ships **8 drum fills + 8 FX one-shots** (4 per bank). A
  loops-only pack reads as half-finished — the player can't punctuate
  their groove with rolls or transitions. If you generate loops first,
  schedule the one-shot run before the kit JSON is finalised so the
  one-shot pads aren't stub-empty.
- Drum fills: `"Single <descriptor>, <duration> seconds. <character>.
  No bass, no melody. Just one drum fill."`
- FX one-shots: `"<sound description>, <duration> seconds, fades
  naturally. <texture cue>."` — atmospherics, transitions, foley,
  not music.

**Across the pack:**
- Every pad's `layerName` should be **distinct from every other pad
  in the same color** AND **distinct from every pad with the same
  position in any other shipped pack** (no "Choir Pad" in two
  packs). Generic instrument names ("Saxophone", "Plucked Lead") are
  fine but try to differentiate via descriptors ("Sax Sample" vs
  "Soulful Sax").
- Every prompt should write the genre + BPM + key in the first
  sentence. The generator uses the opening as the strongest signal for
  the rendered timbre.

## Pipeline (per file)

For each loop file:

1. **`rundot generate music --duration 40`** (or `sfx` / `tts` per item
   kind) — request roughly 1.7× the target so we have headroom to pick a
   clean 8-bar window. The raw clip is written via `--out` to
   `pack-runs/<run>/raw/<file>`.
2. **Find a clean trim offset** (`find-downbeat-trim.mjs` for
   drums/bass/melody, smooth-onset probe for vocals). The finder scans
   every 50 ms offset for a window where:
   - Global-peak 10 ms frame lands within ~60 ms of a quarter-note beat.
   - Tail RMS < 0.02 (the loop ends quietly, no rolling-over noise).
   - Wrap discontinuity < 0.07 (the loop seam is clean).
   - For multi-bar loops, every bar's RMS is above 0.04 (no fade-out tail
     — use `find-trim-no-dropout.mjs` for this gate).
3. **`ffmpeg -ss <offset> -t 22.857142857 ...`** — trim to exact duration,
   stereo, 44.1 kHz, 256 kbps mp3, with `volume=0.55` to keep the
   mono-downmix peak below the validator's CLIP threshold (1.20).

For each one-shot file: skip the offset finder; trim to `targetSec` from
the strongest onset.

## Why those magic numbers?

Captured the hard way during the lofi run:

- **`volume=0.55` instead of `alimiter`.** The validator decodes mp3 with
  `ffmpeg -ac 1` mono downmix that *sums* L+R without dividing by 2. A
  stereo peak of 0.6 per channel becomes mono peak 1.2 — instant CLIPPED
  fail. `alimiter` also re-applies makeup gain that nullifies the limit
  AND lookahead-squashes loud peaks more than quiet ones, flipping which
  10 ms frame is loudest and producing CYCLE_DRIFT. Linear scalar gain
  preserves peak structure.
- **256 kbps mp3, not 128.** With `volume=0.55` source, 128 kbps decode
  reconstruction can push mono-downmix peaks back up to ~1.15. 256 kbps
  keeps the peak under ~1.05.
- **Bar-RMS floor 0.04, not 0.02.** The music generator often ends songs
  with a fade-out tail. The trim-finder's basic gates can pick a window
  with a near-silent bar 8 → PHRASE_LOCKED. The 0.04 floor is 2× the
  validator's per-bar threshold so the `volume=0.55` and mp3 round-trip
  can't push it back below.
- **`audio-phase-align.mjs` is unsafe for bass/melody.** It rotates the
  loop so sample 0 sits at the loudest peak. That's correct for drums
  (loudest = downbeat) but wrong for bass/melody (sustain peaks can land
  mid-bar). Use trim-offset selection instead for those colors.

## Validation + automated fixes

After all 48 files land in `public/audio/<kitId>/`:

```bash
node tools/audio-detect-cutoffs.mjs --kit <kitId>     # report only
node tools/audio-fix-issues.mjs --kit <kitId>         # auto-fix what's deterministic
```

The validator emits per-file verdicts:

| Verdict | Threshold | Auto-fixable? |
|---|---|---|
| `CLIPPED` | mono peak > 1.20 | yes — `volume=0.55` static gain re-encode |
| `CUT_OFF` | tail RMS > 0.05 AND wrap > 0.15 | usually — 32 ms blend splice. If head/tail energies differ, re-trim from a different offset in the same raw |
| `CYCLE_DRIFT` (drums) | peak > 100 ms from any quarter-note | yes — rotate to peak |
| `CYCLE_DRIFT` (bass/melody/vocals) | same | no — regen |
| `SUSPICIOUS` | tail RMS > 0.02 AND wrap > 0.07 | for sustained-tail loops (sax, pad), apply `audio-phase-align.mjs --no-rotate --blend-ms 32` manually |
| `PHRASE_LOCKED` | one bar near-silent vs others loud | no — re-trim or regen |
| `LENGTH_MISMATCH` | bar count ≠ 8 (loops) | no — regen |
| `BAR_VIOLATION` | duration ≠ `barSec × bars` | no — regen |
| `TOO_SHORT` / `ERROR` | unreadable | no — regen |

`audio-fix-issues.mjs` runs the validator → applies fixes → re-validates,
up to 3 iterations. Exit code 1 means residue needs regen.

For residue: re-trim from the saved raw with `find-trim-no-dropout.mjs`
*before* reaching for a fresh `rundot generate`. The `raw/` folder
usually contains 1.5–3× the target slice, so a different offset almost
always passes.

## Generating a new kit — workflow

1. **Decide kit identity.** Pick:
   - A unique `kitId` (snake_case, no copyrighted names). Hero pack
     convention: `<genre>_<theme>_hero`.
   - BPM (typical: lofi 80–90, hip-hop 85–95, house 118–125, synthwave
     95–110, trap 130–150).
   - Key (most loops use a minor key for darker feel: C/D/F/G minor are
     common). Every loop in the kit must share this key.
   - The kit's "flavor" copy that shows up on the Packs tile.

2. **Copy the lofi run as a template.** The run dir uses the
   **hyphenated** kit id (underscores → hyphens); `check-label-content-
   alignment.mjs` resolves the run via `kitId.replace(/_/g, '-')`.
   ```bash
   mkdir -p pack-runs/<kit-id>-<YYYY-MM-DD>      # e.g. synthwave_neon → synthwave-neon-…
   cp pack-runs/lofi-heights-8bar-2026-05-03/manifest.json \
      pack-runs/<kit-id>-<YYYY-MM-DD>/manifest.json
   ```
   Update `manifest.json`:
   - `tempo` and `key` to match the genre.
   - `outputDir` to the absolute path of `public/cdn-assets/audio/<kitId>`.
   - `barSec = 60 / tempo × 4`.
   - `trimSec = barSec × 8`.
   - Every prompt — the prompt is the only thing that carries the genre.
     Keep the structural rules verbatim ("8 bars, in <key> key context.
     Bars 1 through 6 keep this exact pattern locked. Bar 7 adds a
     single ghost… Bar 8 is a turnaround …"). Swap only the
     instrumentation, groove, and texture descriptors.

3. **Run the orchestrator.**
   ```bash
   npx tsx tools/generate-kit.ts "$(pwd)/pack-runs/<kit-id>-<YYYY-MM-DD>"
   ```
   This dispatches each item through `rundot generate`, trims, encodes,
   and writes to the manifest's `outputDir`. ~30–45 minutes of CPU +
   `rundot` calls. Runs are resumable: pass `--only <filename>` to
   regenerate a single item.

4. **Author the kit JSON** — do this **before** validating. Copy
   `src/content-assets/kits/lofi_heights_hero.json` to `<kitId>.json`
   and rewrite. The validators read `bpm` and per-pad `color` from this
   file and default to 84 BPM / lofi when it's missing, so a non-84-BPM
   kit validated first gets every loop false-flagged `BAR_VIOLATION`.
   - Top-level `id`, `name`, `bpm`, `key` (key is the no-space form,
     e.g. `Cmin`), plus the catalog metadata in step 6 below.
   - Every `bufferUrl` to point at `audio/<kitId>/...`.
   - Every `layerName` — these show on the pad cells, so they need to be
     specific ("Boom Bap" not "Drums").

5. **Validate and auto-fix.**
   ```bash
   node tools/audio-fix-issues.mjs --kit <kitId>
   npm run validate:audio                    # CI gate — the real green signal
   ```
   `audio-fix-issues.mjs` exits non-zero while **any** verdict remains,
   including a "fixable" verdict (e.g. `CUT_OFF`) whose deterministic fix
   didn't converge. For residue, re-trim from `raw/` first
   (`retrim-existing-audio.mjs`, or `find-trim-no-dropout.mjs` directly);
   only regen if a different offset doesn't help.

6. **Catalog metadata lives in the same kit JSON.** There is no separate
   store to edit — `loadCatalog()` in `src/stores/kitsStore.ts`
   auto-discovers every `src/content-assets/kits/*.json` via Vite
   `import.meta.glob`. The kit JSON ships the full `KitMeta`: alongside
   `id`/`name`/`bpm`/`key`/`pads`, set `flavor`, `bpmRange`, `layers`,
   `ownership` (`'owned' | 'paid' | 'subscriber' | 'trial'`),
   `priceRunbucks`, `tier` (`'hero' | 'genre' | 'themed' | 'subscriber'`),
   and `heroGradient` (two hex stops). Do **not** add a `seedKits` entry —
   the legacy hardcoded arrays were removed.

7. **Verify the Pack tile.** The kit becomes visible in the Packs screen
   automatically once the JSON lands. Verify:
   - It appears under the right section (Owned / Available / Subscriber).
   - The hero gradient renders on the tile.
   - Tapping the tile opens kit-detail without crashing.

## License + ownership

All audio is generated through the `rundot generate` commands and is
workshop-owned content authored for this repository. The RUN platform
pipeline does not require an in-app generator attribution, so the
Credits modal carries no audio-attribution line — only code/open-source
attributions and the build version.

## Common gotchas (don't re-derive these)

1. Request ~40 s via `--duration` and accept whatever length comes
   back. Budget 50+ s of CPU per file for the trim-finder on long raws.
2. Don't use `audio-phase-align.mjs` on bass/melody/vocals (it rotates
   based on loudest peak; sustain peaks aren't downbeats).
3. Don't use `alimiter` for makeup gain — flips peak structure and
   breaks downbeat alignment.
4. CUT_OFF survival after `audio-fix-issues.mjs` iteration 2 means the
   head/tail energies differ too much for splice-blend to help. Re-trim
   from the same raw at a different offset before regenerating.
5. SUSPICIOUS on a sustained-tail loop (sax, pad, choir) is splice-fixable
   even though `audio-fix-issues.mjs` doesn't auto-apply it. Run
   `audio-phase-align.mjs --no-rotate --blend-ms 32` manually.
6. The validator decodes mono with sum-not-mean. A stereo peak of 0.6
   becomes mono 1.2. Always pre-scale with `volume=0.55`.
7. 128 kbps mp3 round-trips poorly with `volume=0.55` — use 256 kbps.

## Next pack to generate

`hiphop_brooklyn_hero` — see
`pack-runs/hiphop-brooklyn-hero-2026-05-04/manifest.json`.
