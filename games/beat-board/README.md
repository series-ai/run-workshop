# BeatBoard

Pad-grid music maker. A 4×4 grid where each pad fires a seamless loop layer
(drums / bass / melody / FX) at a fixed BPM. Tap any combination — every layer
in a pack shares BPM and key, so they always play cleanly together. Genre packs
(lofi-hiphop, hip-hop, synthwave, house, drum-and-bass, …) unlock new content,
and a session can be recorded and shared as audio/video.

> New to RUN or run-workshop? Start with the shared
> **[Getting Started guide](../../GETTING_STARTED.md)** for platform basics,
> one-time repo setup (Git LFS + hooks), and CLI authentication. The steps below
> cover what's specific to BeatBoard.

## Prerequisites

- Node.js 20+
- npm 10+
- `ffmpeg` on your `PATH` (only needed for authoring/validating audio packs)
- The [`rundot`](https://run.world) CLI (only needed for generating new packs);
  authenticate once with `rundot login`

## Local Setup

```bash
npm install
cp .env.example .env   # optional — defaults work; see the file for details
npm run dev
```

When you open the dev server, sign in through the sandbox toolbar (Google
Sign-In) — local development does not require an API key in `.env`. The env is
scoped to this game's root only; nothing is read from a parent directory.
`RUNDOT_API_KEY` is only needed for a headless dev server (CI / no browser);
mint one with `rundot playground`.

## Test Commands

```bash
# Type + lint + unit tests
npm run typecheck
npm run lint
npm run test

# Production build
npm run build

# Audio validation across every shipped kit
npm run validate:audio

# End-to-end (Playwright)
npx playwright install --with-deps chromium
npm run test:e2e
```

## Creating New Packs

A pack is 48 audio files (32 looping pads + 16 one-shots) plus cover art and a
kit JSON. The kit JSON is also the catalog entry — it ships the full `KitMeta`
and auto-discovers into the catalog, so there is no separate store to edit. New
packs are generated through the `rundot generate` CLI
(`music` / `sfx` / `tts` / `image`) and assembled by `tools/generate-kit.ts`.

> **How-to:** the full step-by-step guide to **generate → validate → integrate**
> a new music pack lives in
> **[docs/authoring-packs.md](docs/authoring-packs.md)**. Read it before
> authoring your first pack — the quick start below is just the command spine.

Authenticate the CLI once before generating (no API key in `.env` is needed —
the CLI stores a session):

```bash
rundot login
```

Quick start (every command is detailed in the how-to):

```bash
# ── Generate ─────────────────────────────────────────────────────────
# 1. scaffold a run from a reference manifest. NOTE: the run dir uses the
#    HYPHENATED kit id (the label checker resolves it via _ → -).
mkdir -p pack-runs/<kit-id>-$(date +%F)      # e.g. synthwave_neon → synthwave-neon-…
cp pack-runs/lofi-heights-8bar-2026-05-03/manifest.json \
   pack-runs/<kit-id>-$(date +%F)/manifest.json
# edit kitId / tempo / key / outputDir / barSec / trimSec, then rewrite prompts

# 2. pre-flight the manifest (catches impossible requests before spending credits)
node tools/validate-kit-manifest.mjs pack-runs/<kit-id>-$(date +%F)

# 3. generate audio (dispatches rundot generate per item, trims + encodes)
npx tsx tools/generate-kit.ts "$(pwd)/pack-runs/<kit-id>-$(date +%F)"

# ── Validate ─────────────────────────────────────────────────────────
# 4. author the kit JSON FIRST — the validators read bpm + pad colors from
#    it (and default to 84 BPM when missing). This file is ALSO the catalog
#    entry (auto-discovered), so there is no separate store to edit.
cp src/content-assets/kits/lofi_heights_hero.json \
   src/content-assets/kits/<kitId>.json
# edit id/name/bpm/key (key is the no-space form, e.g. Cmin) + catalog meta
# (tier/ownership/priceRunbucks/heroGradient/flavor); point every bufferUrl at
# audio/<kitId>/..., set specific layerNames

# 5. audio quality gates (report → auto-fix → label/content alignment → sweep)
npm run validate:audio:kit -- --kit <kitId>
node tools/audio-fix-issues.mjs --kit <kitId>   # exits non-zero while ANY verdict remains
node tools/check-label-content-alignment.mjs --kit <kitId>
npm run validate:audio                          # CI gate — the real green signal

# ── Integrate ────────────────────────────────────────────────────────
# 6. cover art (1:1 square, 1024×1024), written to its tracked path. Set the
#    kit JSON's `coverArt` field ONLY once this PNG exists — a dangling path
#    404s on the Packs tile (no onError fallback). No cover yet? Omit `coverArt`
#    and the heroGradient + chrome placeholder renders. (--reference-image needs
#    an https/data URI or a game id.)
rundot generate image --prompt "<cover prompt>" --aspect-ratio 1:1 \
  --out public/cdn-assets/images/packs/<kitId>.png --json

# 7. verify it ships clean — the kit JSON from step 4 already auto-discovers
npm run typecheck && npm run test
npm run dev   # eyeball the Packs tile, kit detail, and pad playback
```

Reference manifests for several genres ship under `pack-runs/`. For audio
internals (validator thresholds, trim math, the fix decision table) see
[docs/audio-kits.md](docs/audio-kits.md).

## Project Structure

- `src/` — game source code
- `public/cdn-assets/` — shipped assets (audio loops, pack cover art, images)
- `src/content-assets/kits/` — per-pack pad layout + metadata (`<kitId>.json`)
- `tools/` — pack generation, trim, and audio-validation tooling
- `pack-runs/` — pack-authoring run workspaces (only `manifest.json` is tracked)
- `e2e/` — Playwright tests
- `docs/` — project documentation

## Documentation

- [Authoring Packs](docs/authoring-packs.md) — end-to-end pack creation guide
- [Audio Kits](docs/audio-kits.md) — audio internals reference
- [Preload](docs/preload.md) — asset preload guide
- [Product Requirements](docs/prd.md)
- [Roadmap](ROADMAP.md)

## License

This game is part of [run-workshop](../../README.md) and is licensed under the
[RUN Repository Supplemental License v1.0](../../LICENSE.md). Third-party
attributions are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
