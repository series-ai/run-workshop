---
title: "Pirate Nation Showcase: RUN app conversion and model browser rework"
status: done
created: 2026-08-24
updated: 2026-08-24
tags: [pirate-nation-showcase, rundot, cdn-assets, ux]
---

# Pirate Nation Showcase: RUN app conversion and model browser rework

> **For agentic workers:** Use the `execute-spec` skill to implement
> this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the showcase a deployable RUN app — moved to `games/`, with its
341 MB pack served from `public/cdn-assets/` — and turn the model tab from a
355-row text list into a browser with thumbnails, a persistent 3D stage, and
keyboard, next/prev, and random navigation.

**Architecture:** The pack moves to `public/cdn-assets/pirate-nation/`, which
the `rundot` CLI uploads to the CDN on deploy. Asset URLs stop being string
concatenation and go through `RundotGameAPI.cdn.resolveAssetUrl()`, which is
async, so a `useAssetUrl` hook feeds the four consumers. A thumbnail per model
is pre-rendered offline by a headless-browser script against a dedicated
`thumb.html` route and committed with the pack. The gallery becomes a
thumbnail grid beside an always-mounted viewer, modelled on the Avatar Lab.

**Tech Stack:** Vite 6, React 18, three.js 0.170 + R3F, `@series-inc/rundot-game-sdk`
5.24.0, Playwright (thumbnail rendering + e2e), vitest.

---

## Overview

The showcase is currently a local-only tool: it lives in `tools/`, serves its
pack from `public/assets/`, and has no RUN app identity, so the only way to
show someone is to have them clone the repo and run a dev server. Every other
deployable app in this repo (`beat-board`, `dither-playground`,
`layout-manager`, `picmon-editor`) lives in `games/`, carries a `config.json` +
`game.config.prod.json`, and deploys with `rundot deploy`. This plan closes
that gap.

The pack cannot ship inside the bundle: the deploy cap is 100 MB zipped and the
pack is 341 MB. `public/cdn-assets/` is the platform's answer — the CLI uploads
that folder to the CDN, content-hashes it, and the SDK resolves logical paths at
runtime. `beat-board` already ships 116 MB this way.

Separately, the Models tab is hard to browse: 355 cards showing nothing but a
name and a metadata line, and the 3D viewer only appears after a click and
disappears on close. The Avatar Lab — which the user considers fine — keeps a
large persistent stage next to its controls. The model browser adopts the same
shape and gains the thing it most obviously lacks: a picture of each model.

## Background

Verified in this session, in this worktree unless noted.

**RUN app conventions** (from `games/dither-playground/`, on `main`):

- `package.json` — `"keywords": ["RUN.game"]`, `"deploy": "npm run build && rundot deploy"`, `@series-inc/rundot-game-sdk` pinned at `5.24.0`.
- `config.json` — `appData` with `id`, `name`, `description`, `versionTag`.
- `game.config.prod.json` — `gameId`, `relativePathToDistFolder: "dist"`, `usesPreloader`, `orientation`, `keywords`, `kitId`. It is **not** committed: `CONTRIBUTING.md:53-55` says `game.config.*.json` files are per-account bindings created by `rundot init` and are gitignored, and `git ls-files games/dither-playground` confirms only `config.json` is tracked.
- `vite.config.ts` — `rundotGameLibrariesPlugin()` (plus `rundotGameSandboxPlugin` for playground-backed APIs, which this app does not use), `base: './'`, `esbuild.target`/`build.target` = `es2022`, `optimizeDeps.exclude: ['@series-inc/rundot-game-sdk']` (the SDK uses top-level await).
- `index.html` — `<meta name="game-id" content="…">`.
- `src/main.tsx` — `await RundotAPI.initializeAsync()` before anything else touches the SDK, raced against a 5 s timeout and caught, because "the playground is usable standalone in a plain browser" (`games/dither-playground/src/main.tsx:6-39`).
- `.gitignore` — adds `.env`, `game.config.playground.json`, `.rundot/session/`, `.rundot-docs`.
- `rundot` CLI 7.13.1 is installed at `~/.local/bin/rundot`. `rundot init` registers a new game and `rundot import <dir>` registers an existing project; `rundot deploy` only uploads a build for an already-registered game.
- `ModelViewer.tsx:123-137` lights its stage with `ambientLight` + `hemisphereLight` + a bounds-scaled `directionalLight`, on a `Canvas` with `logarithmicDepthBuffer: true` (the pack's nested shells z-fight without it). The app uses no drei `Environment`, so nothing currently fetches a remote HDR.

**CDN assets** (from the SDK's `docs/rundot-developer-platform/api/ASSETS.md` and `dist/`):

- Only files under `public/cdn-assets/` are uploaded to the CDN. `rundot deploy` takes `--build-path ./dist`, so the folder must reach `dist/` — which Vite's default `public/` copy already does. `beat-board` relies on exactly this and has no exclusion in its `vite.config.ts`.
- `cdn.resolveAssetUrl(path): Promise<string>` returns a URL without fetching bytes — the right call for a GLTF loader and `<img>`/`<audio>` sources. `cdn.fetchAsset()` returns a Blob and would pull whole models into memory.
- In local dev the SDK swaps in `MockCdnApi` (`dist/chunk-OSKQDUTI.js:1290`), whose `resolveAssetUrl` returns the relative path `cdn-assets/<path>` — which Vite serves straight from `public/cdn-assets/`. `getCdnAssetsBaseUrl()` returns the literal `"cdn-assets"`.
- Deploy caps: the deploy guide states 100 MB for the zipped `dist/`; `ASSETS.md` mentions a 32 MB bundle limit. Neither number can hold if `dist/cdn-assets` counted toward it, since `beat-board` ships 116 MB — see Open Questions.

**Current showcase** (`tools/pirate-nation-showcase/`):

- Asset URLs are already centralised: `PACK_BASE_URL = '/assets/pirate-nation'` (`src/catalog.ts:12`), `runtimeAssetUrl(entry)` (`:105`), `packAssetUrl(path)` (`:109`), and a `fetch` in `loadJson` (`:150`).
- Only four runtime consumers: `ModelViewer.tsx:27` (GLB), `SpriteLibrary.tsx:146` (`<img src>`), `AudioRoom.tsx:74` (`<audio src>`), `ModelGallery.tsx:118` (download link). Plus `AvatarLab.tsx:35`, which computes `AVATAR_MODEL_URL` at module scope, and `Dashboard.tsx:98`, which only prints `PACK_BASE_URL` as text.
- `scripts/repair-model-normalization.ts:17` hardcodes `public/assets/pirate-nation/runtime`.
- The pack is 341 MB / 1172 files; all 375 GLBs are self-contained (0 external image or buffer URIs), so a resolved CDN URL or blob URL loads them with no sibling fetches.
- `ModelGallery.tsx` renders a flat `.model-grid` of text-only `<button className="model-card">` elements and mounts `ModelViewer` only inside a conditional `.gallery-detail` aside. `AvatarLab.tsx:145` by contrast renders `.avatar-panel` beside a permanent `.avatar-stage`.
- Tests: 36 vitest (`src/**` + `scripts/**`), 6 Playwright e2e. `playwright.config.ts` boots the app with `npm run dev` on port 5190.
- `.gitattributes` at the repo root already routes `*.jpg`, `*.png`, `*.webp`, and `*.glb` through Git LFS, so generated thumbnails are LFS-tracked automatically.

**Thumbnail rendering spike** (run this session, artifacts deleted): driving the
existing app with Playwright and screenshotting `.model-viewer` averaged
**756 ms per model** across 6 models in one page session (42 KB, 20 KB, 36 KB,
7 KB, 50 KB, 27 KB PNGs). 355 models therefore land near 5 minutes
single-threaded, and headless Chromium renders the WebGL scene correctly.

**Docs gate:** this changes observable surfaces — the project moves path, gains
npm scripts (`deploy`, `thumbnails`), and changes where the pack lives. The
project `README.md`, the root `README.md` (its entry moves from Tools to Games),
`THIRD_PARTY_NOTICES.md`, and the pack's `PROVENANCE.md` (new generated
thumbnails, new pack location) all change. They are in the File Roster.

## Requirements

1. The project lives at `games/pirate-nation-showcase/` with history preserved (`git mv`), and every path reference inside it is updated.
2. The pack lives at `public/cdn-assets/pirate-nation/` — `runtime/`, `data/`, `manifest.json`, `prefabs.json`, `LICENSE`, `PROVENANCE.md` — and nothing pack-related remains under `public/assets/`.
3. The app is a RUN app: the SDK dependency, `rundotGameLibrariesPlugin()`, `base: './'`, `es2022` targets, `config.json`, `index.html` game-id meta, `.gitignore` entries, and a `deploy` npm script. `game.config.prod.json` is produced locally by `rundot init` and stays gitignored, per `CONTRIBUTING.md`. `rundotGameSandboxPlugin` is deliberately not used — it exists to back storage, profile, and leaderboard calls in local dev, and this app makes none.
4. `src/main.tsx` awaits `RundotGameAPI.initializeAsync()` before rendering, since the SDK requires it before any other call. The wait is bounded by a 5 s timeout and a failure is logged and survived, so the app still runs in a plain browser.
5. Asset URLs resolve through `RundotGameAPI.cdn.resolveAssetUrl()`. Because it is async, `catalog.ts` exposes pack-relative *paths* plus an async resolver, and a `useAssetUrl` hook supplies the components.
6. Whether the RUN SDK is usable is decided once, by `main.tsx` recording the outcome of `initializeAsync()`. When it did not initialize, URL resolution returns the relative `cdn-assets/<path>` the SDK's own mock returns. When it did, resolution goes to the SDK and every failure propagates — no error-message sniffing, no silent retry.
7. `scripts/render-thumbnails.ts` renders one 320×320 JPEG per catalogued model into `public/cdn-assets/pirate-nation/thumbnails/<id>.jpg`, driving a dedicated `thumb.html` route with Playwright and a Vite server it starts itself. It skips models whose thumbnail already exists unless `--force`, reports every failure by model id, and exits non-zero if any model failed.
8. All 355 visual models have a committed thumbnail.
9. The model grid shows each model's thumbnail; a model whose thumbnail fails to load falls back to the existing text-only card rather than a broken image.
10. The Models tab keeps a persistent 3D stage: a model is always selected (the first in the current filtered list), and changing filters or search never leaves the stage empty unless the filter matches nothing.
11. The Models tab supports keyboard navigation — `ArrowLeft`/`ArrowRight` step through the filtered list, `Escape` clears the search — and has a "Random" button that jumps to a random model in the current filter. Keyboard handling is ignored while a text input has focus.
12. Existing behavior is preserved: `npm run typecheck`, `npm test`, `npm run test:e2e`, and `npm run build` all pass.
13. Docs are updated: the project's `README.md` and `THIRD_PARTY_NOTICES.md`, the pack's `PROVENANCE.md`, and the repo-root `README.md` and `THIRD_PARTY_NOTICES.md`, which both link to the old `tools/` path.

## Non-goals

- Running `rundot login`, `rundot init`, or `rundot deploy`. Those need the user's platform account; the plan ships the config with an empty `gameId` and documents the commands.
- Playground-backed SDK surfaces (storage, profiles, leaderboards, purchases) and therefore `rundotGameSandboxPlugin` and `sandbox.config.ts`.
- Using any RUN SDK surface beyond `cdn` (no storage, leaderboards, profiles, IAP, multiplayer, preloader integration).
- Animated or 3D-interactive thumbnails, thumbnail regeneration in CI, or thumbnails for the 20 collision meshes.
- Reworking the Avatar Lab, Sprites, or Audio tabs beyond the mechanical async-URL change.
- Fullscreen/lightbox viewing, multi-model compare staging, or drag-and-drop scene building.
- Changing the pack's contents, the extractor, or `models.json` schema.

## Acceptance Criteria

- [x] `git log --follow games/pirate-nation-showcase/src/catalog.ts` shows commits from before the move.
- [x] `ls games/pirate-nation-showcase/public/cdn-assets/pirate-nation/runtime/models.json` succeeds and `tools/pirate-nation-showcase` does not exist.
- [x] `grep -rn "public/assets/pirate-nation" games/pirate-nation-showcase --include='*.ts' --include='*.tsx' --include='*.md'` returns no hits.
- [x] `npm run typecheck`, `npm test`, `npm run test:e2e`, and `npm run build` all pass from `games/pirate-nation-showcase/`.
- [x] `ls games/pirate-nation-showcase/dist/cdn-assets/pirate-nation/runtime/models.json` succeeds after `npm run build` (proves the CLI will find the pack in `dist/`).
- [x] The bundle without CDN assets is small: `find dist -path dist/cdn-assets -prune -o -type f -print0 | xargs -0 stat -f%z | awk '{s+=$1} END {print s/1048576}'` reports under 32.
- [x] `node -e "…"` over `models.json` reports 355 visual models and `ls public/cdn-assets/pirate-nation/thumbnails/*.jpg | wc -l` reports 355.
- [x] `npm run thumbnails` on an already-rendered pack prints `0 to render` and exits 0.
- [x] A new e2e test asserts the Models tab mounts `.model-viewer canvas` on first paint with no card click, that `.model-card img` is present, that `ArrowRight` changes the selected card, and that "Random" changes it too.
- [x] `rundot deploy --help` runs (CLI present), `games/pirate-nation-showcase/config.json` parses as JSON, and `git check-ignore games/pirate-nation-showcase/game.config.prod.json` succeeds (the per-account binding is not committed).
- [x] `grep -n initializeAsync games/pirate-nation-showcase/src/main.tsx` returns a hit, and the app still renders with the SDK unreachable (the e2e run proves this, since no RUN host is present).
- [x] Root `README.md` lists the showcase under `## Games` with the `games/pirate-nation-showcase/` path and no longer lists it under `## Tools`.

## File Roster

| File | Action | Why |
|------|--------|-----|
| `tools/pirate-nation-showcase/**` | delete (via `git mv`) | The project moves to `games/` (Req 1) |
| `games/pirate-nation-showcase/**` | create (via `git mv`) | New home matching the repo's deployable-app convention (Req 1) |
| `games/pirate-nation-showcase/public/assets/pirate-nation/**` | delete (via `git mv`) | Pack moves under `cdn-assets/` (Req 2) |
| `games/pirate-nation-showcase/public/cdn-assets/pirate-nation/**` | create (via `git mv`) | Only this folder is uploaded to the CDN (Req 2) |
| `games/pirate-nation-showcase/public/cdn-assets/README.md` | create | States what belongs in `cdn-assets/`, matching the other games (Req 2) |
| `games/pirate-nation-showcase/scripts/repair-model-normalization.ts` | modify | `PACK_RUNTIME` points at the new pack location (Req 1) |
| `games/pirate-nation-showcase/package.json` | modify | SDK dependency, `RUN.game` keyword, `deploy` and `thumbnails` scripts (Req 3, 7) |
| `games/pirate-nation-showcase/vite.config.ts` | modify | RUN plugins, `base`, es2022 targets, `optimizeDeps.exclude` (Req 3) |
| `games/pirate-nation-showcase/index.html` | modify | `game-id` meta tag (Req 3) |
| `games/pirate-nation-showcase/config.json` | create | RUN app metadata (Req 3) |
| `games/pirate-nation-showcase/.gitignore` | create | Ignores `dist`, `.env`, `.rundot/session/`, test output (Req 3) |
| `games/pirate-nation-showcase/src/main.tsx` | modify | Awaits `initializeAsync()` before render, non-fatally (Req 4) |
| `games/pirate-nation-showcase/src/catalog.ts` | modify | Pack-relative paths + async `resolveAssetUrl` with SDK fallback (Req 5, 6) |
| `games/pirate-nation-showcase/src/catalog.test.ts` | modify | Cover path builders, the resolver, and the fallback (Req 5, 6) |
| `games/pirate-nation-showcase/src/useAssetUrl.ts` | create | Hook that feeds resolved URLs to components and rethrows failures (Req 5, 6) |
| `games/pirate-nation-showcase/src/components/ModelViewer.tsx` | modify | Consume the hook instead of a sync URL (Req 5) |
| `games/pirate-nation-showcase/src/tabs/SpriteLibrary.tsx` | modify | Consume the hook for `<img>` sources (Req 5) |
| `games/pirate-nation-showcase/src/tabs/AudioRoom.tsx` | modify | Consume the hook for `<audio>` sources (Req 5) |
| `games/pirate-nation-showcase/src/tabs/AvatarLab.tsx` | modify | Consume the hook for the avatar GLB (Req 5) |
| `games/pirate-nation-showcase/src/tabs/Dashboard.tsx` | modify | Print the new pack location instead of `PACK_BASE_URL` (Req 5) |
| `games/pirate-nation-showcase/thumb.html` | create | Isolated dev-only render route so thumbnails have no UI chrome; not part of the production build (Req 7) |
| `games/pirate-nation-showcase/src/thumb.tsx` | create | Renders one model on a fixed stage and signals readiness (Req 7) |
| `games/pirate-nation-showcase/scripts/render-thumbnails.ts` | create | Batch renderer: Vite server + Playwright + JPEG output (Req 7) |
| `games/pirate-nation-showcase/public/cdn-assets/pirate-nation/thumbnails/*.jpg` | create (by script, 355 files) | The thumbnails themselves (Req 8) |
| `games/pirate-nation-showcase/src/tabs/ModelGallery.tsx` | modify | Thumbnail cards, persistent stage, keyboard nav, Random (Req 9, 10, 11) |
| `games/pirate-nation-showcase/src/styles.css` | modify | Thumbnail tile grid and stage layout (Req 9, 10) |
| `games/pirate-nation-showcase/e2e/smoke.spec.ts` | modify | Cover persistent stage, thumbnails, keyboard nav, Random (Req 9-11) |
| `games/pirate-nation-showcase/README.md` | modify | New paths, deploy flow, thumbnail script (Req 13) |
| `games/pirate-nation-showcase/THIRD_PARTY_NOTICES.md` | modify | Pack path references (Req 13) |
| `games/pirate-nation-showcase/public/cdn-assets/pirate-nation/PROVENANCE.md` | modify | Records the move and the generated thumbnails (Req 13) |
| `README.md` | modify | Showcase moves from Tools to Games with the new path (Req 13) |
| `THIRD_PARTY_NOTICES.md` (repo root) | modify | Line 14 links to `tools/pirate-nation-showcase/…`, which the move breaks (Req 13) |

## Implementation Plan

All commands run from `games/pirate-nation-showcase/` unless stated otherwise.
Repo-root commands are marked.

### Task 1: Move the project and the pack

**Files:**
- Move: `tools/pirate-nation-showcase` → `games/pirate-nation-showcase`
- Move: `public/assets/pirate-nation` → `public/cdn-assets/pirate-nation`
- Modify: `scripts/repair-model-normalization.ts`
- Create: `public/cdn-assets/README.md`

- [x] **Step 1: Move the project directory**

From the repo root:

```bash
git mv tools/pirate-nation-showcase games/pirate-nation-showcase
```

Expected: `git status --porcelain | grep -c '^R'` reports the moved files; `ls tools/` shows only `3d-pfx-library`.

- [x] **Step 2: Move the pack under cdn-assets**

From `games/pirate-nation-showcase/`:

```bash
mkdir -p public/cdn-assets
git mv public/assets/pirate-nation public/cdn-assets/pirate-nation
rmdir public/assets
```

Expected: `ls public/` prints `cdn-assets`; `ls public/cdn-assets/pirate-nation` prints `LICENSE PROVENANCE.md data manifest.json prefabs.json runtime`.

- [x] **Step 3: Document the folder**

Create `public/cdn-assets/README.md`:

~~~markdown
# cdn-assets

Everything in this folder is uploaded to the RUN.world CDN by `rundot deploy`
and served from there at runtime. Files elsewhere in `public/` are bundled into
the game build instead, which is capped, so large assets belong here.

This app keeps its whole Pirate Nation pack here, under `pirate-nation/`:

- `pirate-nation/runtime/` — the extracted GLB, sprite, and audio files plus
  their JSON catalogs.
- `pirate-nation/thumbnails/` — one 320×320 JPEG per model, generated by
  `npm run thumbnails`.
- `pirate-nation/manifest.json`, `prefabs.json`, `data/` — pack metadata.
- `pirate-nation/LICENSE`, `PROVENANCE.md` — upstream license and provenance.

Resolve a path through the SDK, never by string concatenation:

```ts
import { resolvePackAssetUrl, runtimeAssetPath } from './src/catalog'

const url = await resolvePackAssetUrl(runtimeAssetPath(entry))
```

In React, use the `useAssetUrl` hook in `src/useAssetUrl.ts`.
~~~

- [x] **Step 4: Repoint the repair script**

In `scripts/repair-model-normalization.ts`, change line 17:

```ts
const PACK_RUNTIME = join(SHOWCASE_ROOT, 'public/cdn-assets/pirate-nation/runtime')
```

- [x] **Step 5: Verify nothing else points at the old path**

Run: `grep -rn "public/assets/pirate-nation\|/assets/pirate-nation" src scripts e2e *.md *.json *.ts 2>/dev/null`
Expected: only `src/catalog.ts` (its `PACK_BASE_URL` and docstring) and `README.md`/`THIRD_PARTY_NOTICES.md`, all of which later tasks rewrite.

- [x] **Step 6: Confirm the app still runs on the old URL scheme**

Temporarily, `PACK_BASE_URL` is stale, so the app is expected to be broken here;
only the non-network checks must pass.

Run: `npm run typecheck && npx vitest run scripts/`
Expected: PASS — typecheck clean, 8 script tests pass (the repair script finds the pack at its new path).

### Task 2: RUN app scaffolding

**Files:**
- Modify: `package.json`, `vite.config.ts`, `index.html`, `src/main.tsx`
- Create: `config.json`, `game.config.prod.json`, `.gitignore`

- [x] **Step 1: Install the SDK**

Run: `npm install @series-inc/rundot-game-sdk@5.24.0 && npm install --save-dev firebase`
Expected: the SDK lands in `dependencies` and `firebase` in `devDependencies`;
`ls node_modules/@series-inc/rundot-game-sdk/dist/index.js` succeeds.

`firebase` is required even though this app uses no playground API: the SDK's
main chunk contains `import('firebase/app')`, and Vite's import analysis
resolves that statically, so the dev server returns HTTP 500 for the SDK
module when the package is absent. The SDK's `playground.md` prescribes it as
a devDependency for the same reason.

- [x] **Step 2: Add the RUN scripts and keyword**

In `package.json`, add to `scripts` (after `test:e2e`):

```json
    "thumbnails": "node --import tsx scripts/render-thumbnails.ts",
    "deploy": "npm run build && rundot deploy"
```

and add a top-level `keywords` field next to `description`:

```json
  "keywords": ["RUN.game"],
```

- [x] **Step 3: Add the RUN config files**

Create `config.json`:

```json
{
  "appData": {
    "id": "pirate-nation-showcase",
    "name": "Pirate Nation Art Showcase",
    "description": "Browse 355 MIT-licensed Pirate Nation models, compose pirates in the Avatar Lab, and preview 513 sprites and 30 audio tracks.",
    "versionTag": "0.1.0",
    "thumbnailUrl": "",
    "userState": {}
  }
}
```

Create `.gitignore`:

```
node_modules
dist
test-results
playwright-report
.env
game.config.*.json
.rundot/session/
.rundot-docs
```

`game.config.*.json` is per-account and generated by `rundot init`; see
`CONTRIBUTING.md`. Only `config.json` is committed.

- [x] **Step 4: Wire the Vite plugins**

Replace `vite.config.ts` with:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { rundotGameLibrariesPlugin } from '@series-inc/rundot-game-sdk/vite'

// Ports are pinned so sub-projects never collide: picmon-editor owns
// 5180/4180, this app owns 5190/4190.
//
// `rundotGameSandboxPlugin` is intentionally absent: it backs storage,
// profile, and leaderboard calls in local dev, and this app calls none of
// them. Skipping it keeps `npm run dev` and the e2e suite free of any
// RUNDOT_API_KEY requirement.
export default defineConfig(() => {
  return {
    plugins: [
      react(), // Must come first — handles the JSX transform
      rundotGameLibrariesPlugin(),
    ],
    base: './',
    resolve: {
      // R3F hooks crash if two `three` or `react` copies load; dedupe is the
      // safety net (same convention as tools/3d-pfx-library).
      dedupe: ['react', 'react-dom', 'three', '@react-three/fiber'],
    },
    // The RUN SDK ships top-level await, so both the transform and the dev
    // pre-bundle need an es2022 target.
    esbuild: { target: 'es2022' },
    optimizeDeps: {
      esbuildOptions: { target: 'es2022' },
      exclude: ['@series-inc/rundot-game-sdk'],
    },
    server: { port: 5190, strictPort: true },
    preview: { port: 4190, strictPort: true },
    build: {
      target: 'es2022',
      outDir: 'dist',
      emptyOutDir: true,
    },
    test: {
      include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
      // Node by default: the catalog and avatar-composition tests are pure
      // logic and need no DOM.
      environment: 'node',
    },
  }
})
```

- [x] **Step 5: Tag the game id in the HTML**

In `index.html`, add inside `<head>` directly after the `viewport` meta:

```html
    <meta name="game-id" content="pirate-nation-showcase" />
```

- [x] **Step 6: Initialize the SDK before render**

The SDK requires `initializeAsync()` to finish before any other call, including
`cdn.resolveAssetUrl`. Wrap the existing `createRoot(...).render(...)` in
`src/main.tsx` with a boot function, following `dither-playground`:

```tsx
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { setRunSdkReady } from './catalog'

async function boot(): Promise<void> {
  const rootElement = document.getElementById('root')
  if (!rootElement) throw new Error('Root element not found')

  try {
    // Must complete before any other SDK call. Bounded so a hung init cannot
    // wedge the app.
    await Promise.race([
      RundotAPI.initializeAsync(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('RUN SDK init timed out')), 5000),
      ),
    ])
    setRunSdkReady(true)
  } catch (error) {
    // Not fatal: `resolvePackAssetUrl` then serves cdn-assets/ directly.
    setRunSdkReady(false)
    console.warn('RUN SDK initialization failed; continuing standalone.', error)
  }

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void boot()
```

Keep whatever `App`/`StrictMode`/CSS imports `main.tsx` already has.

- [x] **Step 7: Verify the app builds and the dev server boots**

The pack moved in Task 1 but `catalog.ts` still points at the old URL, so the
app cannot load assets yet and the e2e suite stays red until Task 3. Check only
what is meaningful now:

Run: `npm run typecheck && npm run build`
Expected: PASS — typecheck clean, `vite build` succeeds with the RUN plugins in
place.

Run: `npm run dev` and open http://localhost:5190
Expected: the shell renders, and the console shows one
`RUN SDK initialization failed; continuing standalone.` warning — the intended
standalone path with no `RUNDOT_API_KEY`. Asset panels are still empty; Task 3
fixes that. Stop the server.

### Task 3: Resolve asset URLs through the CDN API

**Files:**
- Modify: `src/catalog.ts`, `src/catalog.test.ts`
- Create: `src/useAssetUrl.ts`
- Modify: `src/components/ModelViewer.tsx`, `src/tabs/SpriteLibrary.tsx`, `src/tabs/AudioRoom.tsx`, `src/tabs/AvatarLab.tsx`, `src/tabs/Dashboard.tsx`

- [x] **Step 1: Write the failing tests**

In `src/catalog.test.ts`, keep every existing import (the file's other suites
still use `afterEach`, `loadModels`, and the rest) and make three edits:

1. Add the new symbols to the existing `./catalog` import:
   `PACK_CDN_PREFIX`, `packAssetPath`, `resolvePackAssetUrl`,
   `runtimeAssetPath`, `setRunSdkReady`, `thumbnailPath`. Drop only `PACK_BASE_URL`,
   `runtimeAssetUrl`, and `packAssetUrl`, which no longer exist.
2. Add `beforeEach` and `vi` to the existing `vitest` import if they are not
   already there.
3. Replace only the URL-helper `describe` blocks (the `runtimeAssetUrl` /
   `packAssetUrl` cases) with the suites below, and update the one
   `loadModels` assertion that expects
   `` `${PACK_BASE_URL}/runtime/models.json` `` to expect
   `'cdn-assets/pirate-nation/runtime/models.json'` — the fallback path the
   mocked SDK returns.

```ts
const resolveAssetUrl = vi.fn()

vi.mock('@series-inc/rundot-game-sdk/api', () => ({
  default: {
    get cdn() {
      return { resolveAssetUrl }
    },
  },
}))

describe('pack paths', () => {
  it('builds runtime, pack, and thumbnail paths under the pack prefix', () => {
    expect(runtimeAssetPath({ relativePath: 'models/ships/ships-boat.glb' })).toBe(
      `${PACK_CDN_PREFIX}/runtime/models/ships/ships-boat.glb`,
    )
    expect(packAssetPath('manifest.json')).toBe(`${PACK_CDN_PREFIX}/manifest.json`)
    expect(thumbnailPath('ships-boat')).toBe(`${PACK_CDN_PREFIX}/thumbnails/ships-boat.jpg`)
  })
})

describe('resolvePackAssetUrl', () => {
  beforeEach(() => {
    resolveAssetUrl.mockReset()
    setRunSdkReady(false)
  })

  it('serves cdn-assets/ directly when the SDK never initialized', async () => {
    await expect(resolvePackAssetUrl('pirate-nation/manifest.json')).resolves.toBe(
      'cdn-assets/pirate-nation/manifest.json',
    )
    expect(resolveAssetUrl).not.toHaveBeenCalled()
  })

  it('returns the URL the SDK resolves once it is ready', async () => {
    setRunSdkReady(true)
    resolveAssetUrl.mockResolvedValue('https://cdn.example/abc123/manifest.json')
    await expect(resolvePackAssetUrl('pirate-nation/manifest.json')).resolves.toBe(
      'https://cdn.example/abc123/manifest.json',
    )
    expect(resolveAssetUrl).toHaveBeenCalledWith('pirate-nation/manifest.json')
  })

  it('propagates a resolution failure once the SDK is ready', async () => {
    setRunSdkReady(true)
    resolveAssetUrl.mockRejectedValue(new Error('ASSET_NOT_FOUND'))
    await expect(resolvePackAssetUrl('pirate-nation/nope.json')).rejects.toThrow(/ASSET_NOT_FOUND/)
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/catalog.test.ts`
Expected: FAIL — `PACK_CDN_PREFIX`, `packAssetPath`, `runtimeAssetPath`, `thumbnailPath`, and `resolvePackAssetUrl` are not exported.

- [x] **Step 3: Implement the path builders and resolver**

In `src/catalog.ts`, replace the `PACK_BASE_URL` constant (line 12) and the
`runtimeAssetUrl` / `packAssetUrl` functions (lines 104–110) with:

```ts
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

/** Folder inside `public/cdn-assets/` that holds the whole pack. */
export const PACK_CDN_PREFIX = 'pirate-nation'

let runSdkReady = false

/**
 * Records whether `initializeAsync()` succeeded. `main.tsx` calls this once,
 * before anything renders, and nothing else does.
 */
export function setRunSdkReady(ready: boolean): void {
  runSdkReady = ready
}

/**
 * Resolves a pack path to a loadable URL.
 *
 * Inside a RUN host the SDK maps the logical path onto the content-hashed CDN
 * copy. With no host — a plain browser, `vite preview`, any static server —
 * the SDK is never initialized, so we use the same relative path its own mock
 * returns, which serves straight from `public/cdn-assets/`. Once the SDK is
 * live, a resolution failure means a real problem (missing asset, missing
 * entitlement) and propagates to the caller.
 */
export async function resolvePackAssetUrl(cdnPath: string): Promise<string> {
  if (!runSdkReady) return `cdn-assets/${cdnPath}`
  return RundotGameAPI.cdn.resolveAssetUrl(cdnPath)
}

/** Catalog entries address files under `runtime/`; the avatar catalog uses
 * pack-relative paths that already include `runtime/`. */
export function runtimeAssetPath(entry: { relativePath: string }): string {
  return `${PACK_CDN_PREFIX}/runtime/${entry.relativePath}`
}

export function packAssetPath(packRelativePath: string): string {
  return `${PACK_CDN_PREFIX}/${packRelativePath}`
}

/** Pre-rendered grid thumbnail for a model id (see `npm run thumbnails`). */
export function thumbnailPath(modelId: string): string {
  return `${PACK_CDN_PREFIX}/thumbnails/${modelId}.jpg`
}
```

Update the file's opening docstring to say the catalogs live under
`public/cdn-assets/pirate-nation/`, and change `loadJson` (line ~150) to resolve
first:

```ts
    pending = resolvePackAssetUrl(packAssetPath(path))
      .then((url) => fetch(url))
      .then((response) => {
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/catalog.test.ts`
Expected: PASS

- [x] **Step 5: Add the hook**

Create `src/useAssetUrl.ts`:

```ts
import { useEffect, useState } from 'react'
import { resolvePackAssetUrl } from './catalog'

/**
 * Resolves a pack path to a URL for rendering. Returns `null` while the
 * resolution is in flight. A genuine resolution failure is rethrown during
 * render so the nearest error boundary shows it instead of the component
 * silently rendering nothing forever.
 */
export function useAssetUrl(cdnPath: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!cdnPath) {
      setUrl(null)
      return
    }
    let cancelled = false
    setUrl(null)
    // Clear any previous failure: a new path deserves a fresh attempt, and
    // without this one bad asset would latch the error for the session.
    setError(null)
    resolvePackAssetUrl(cdnPath).then(
      (resolved) => {
        if (!cancelled) setUrl(resolved)
      },
      (cause) => {
        if (!cancelled) setError(cause as Error)
      },
    )
    return () => {
      cancelled = true
    }
  }, [cdnPath])

  if (error) throw error
  return url
}
```

- [x] **Step 6: Update the consumers**

In `src/components/ModelViewer.tsx`, replace the import and line 27:

```ts
import { runtimeAssetPath, type PirateNationModelEntry } from '../catalog'
import { useAssetUrl } from '../useAssetUrl'
```

```ts
  const url = useAssetUrl(runtimeAssetPath(entry))
  if (!url) return null
```

(The call site is `ModelScene`, already inside the viewer's `<Suspense>` and
`ViewerErrorBoundary`. Returning `null` draws an empty scene for the frame or
two before the path resolves; `useAssetUrl` rethrows a real failure into the
boundary.)

In `src/tabs/SpriteLibrary.tsx`, replace the `runtimeAssetUrl` import with
`runtimeAssetPath`, add `import { useAssetUrl } from '../useAssetUrl'`, and
extract the `<img>` into a component so the hook has a stable call site:

```tsx
function SpriteImage({ sprite }: { sprite: PirateNationSpriteEntry }) {
  const src = useAssetUrl(runtimeAssetPath(sprite))
  if (!src) return <span className="sprite-placeholder" />
  return <img src={src} alt={sprite.name} loading="lazy" />
}
```

and use `<SpriteImage sprite={sprite} />` at line 146.

In `src/tabs/AudioRoom.tsx`, do the same for the player at line 74:

```tsx
function TrackPlayer({ track }: { track: PirateNationAudioEntry }) {
  const src = useAssetUrl(runtimeAssetPath(track))
  if (!src) return <span className="audio-placeholder" />
  return <audio controls preload="none" src={src} />
}
```

In `src/tabs/AvatarLab.tsx`, delete the module-scope `AVATAR_MODEL_URL`
(line 35) and resolve it inside the component:

```tsx
  const avatarModelUrl = useAssetUrl(packAssetPath(PIRATE_AVATAR_ASSET_PATH))
```

then guard the stage: `{!avatarModelUrl && <div className="viewer-loading">Loading avatar…</div>}`
and pass `avatarModelUrl` where `AVATAR_MODEL_URL` was used.

In `src/tabs/ModelGallery.tsx`, replace the download link (line 118) with a
resolved href:

```tsx
function DownloadLink({ entry }: { entry: PirateNationModelEntry }) {
  const href = useAssetUrl(runtimeAssetPath(entry))
  if (!href) return null
  return (
    <a className="download-link" href={href} download={entry.filename}>
      Download {entry.filename}
    </a>
  )
}
```

In `src/tabs/Dashboard.tsx` line 98, replace the `PACK_BASE_URL` text with the
new location and drop the now-unused import:

```tsx
              cdn-assets/{PACK_CDN_PREFIX}/LICENSE · cdn-assets/{PACK_CDN_PREFIX}/PROVENANCE.md
```

- [x] **Step 7: Verify the whole app**

Run: `npm run typecheck && npm test && npm run test:e2e`
Expected: PASS — typecheck clean, 36 vitest, 6 e2e. The e2e prove models, sprites, and audio all resolve through the new path.

### Task 4: The thumbnail render route

**Files:**
- Create: `thumb.html`, `src/thumb.tsx`

- [x] **Step 1: Add the HTML entry**

Create `thumb.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Thumbnail renderer</title>
    <style>
      html,
      body {
        margin: 0;
        background: #10141c;
      }
      #thumb-root {
        width: 320px;
        height: 320px;
      }
    </style>
  </head>
  <body>
    <div id="thumb-root"></div>
    <script type="module" src="/src/thumb.tsx"></script>
  </body>
</html>
```

- [x] **Step 2: Add the render component**

Create `src/thumb.tsx`:

```tsx
/**
 * Offscreen render route used by `npm run thumbnails`. It draws exactly one
 * model on a fixed 320x320 stage with no UI, then sets `window.__thumbReady`
 * so the capture script knows the frame is on screen. Dev-only: nothing in the
 * app links to it and it is not an entry of the production build.
 */
import { StrictMode, Suspense, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { FitCamera } from './components/FitCamera'
import { MODEL_VIEWER_ROOT_NAME } from './components/ModelViewer'
import { loadModels, runtimeAssetPath, type PirateNationModelEntry } from './catalog'
import { useAssetUrl } from './useAssetUrl'

declare global {
  interface Window {
    __thumbReady?: boolean
    __thumbError?: string
  }
}

function LoadedModel({ url, id }: { url: string; id: string }) {
  const { scene } = useGLTF(url)

  useEffect(() => {
    // FitCamera needs a frame to measure the subject, so signal readiness two
    // frames after the scene mounts - by then the fitted view has been drawn.
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        window.__thumbReady = true
      })
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [scene])

  return (
    <>
      {/* FitCamera always frames from straight ahead, so yaw the model
          instead: a three-quarter view reads far better in a grid than a
          front elevation, and FitCamera measures the rotated bounds. */}
      <group name={MODEL_VIEWER_ROOT_NAME} rotation={[0, -Math.PI / 5, 0]}>
        <primitive object={scene} />
      </group>
      <FitCamera rootName={MODEL_VIEWER_ROOT_NAME} fitKey={id} />
    </>
  )
}

function ThumbModel({ entry }: { entry: PirateNationModelEntry }) {
  const url = useAssetUrl(runtimeAssetPath(entry))
  if (!url) return null
  return <LoadedModel url={url} id={entry.id} />
}

function ThumbApp() {
  const [entry, setEntry] = useState<PirateNationModelEntry | null>(null)

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('model')
    if (!id) {
      window.__thumbError = 'missing ?model= parameter'
      return
    }
    loadModels().then(
      (models) => {
        const match = models.find((model) => model.id === id)
        if (match) {
          setEntry(match)
        } else {
          window.__thumbError = `unknown model id ${id}`
        }
      },
      (error: Error) => {
        window.__thumbError = error.message
      },
    )
  }, [])

  if (!entry) return null

  return (
    <Canvas
      camera={{ position: [0, 2, 5], fov: 45 }}
      // Same lighting and depth settings as the in-app viewer, so a thumbnail
      // matches what the stage shows. The pack's nested shells z-fight
      // without the logarithmic depth buffer.
      gl={{ preserveDrawingBuffer: true, antialias: true, logarithmicDepthBuffer: true }}
      style={{ width: 320, height: 320 }}
    >
      <color attach="background" args={['#10141c']} />
      <ambientLight intensity={1.1} />
      <hemisphereLight intensity={0.6} groundColor="#26303f" color="#ffffff" />
      <directionalLight position={[4, 6, 3]} intensity={1.4} />
      <Suspense fallback={null}>
        <ThumbModel entry={entry} />
      </Suspense>
    </Canvas>
  )
}

createRoot(document.getElementById('thumb-root')!).render(
  <StrictMode>
    <ThumbApp />
  </StrictMode>,
)
```

- [x] **Step 3: Verify the route renders**

Run: `npm run dev` in one terminal, then in another:

```bash
npx playwright screenshot --viewport-size=320,320 --wait-for-timeout=4000 \
  "http://localhost:5190/thumb.html?model=ships-item-4x8-pirateshipsmallundead" /tmp/thumb-check.png
```

Expected: `/tmp/thumb-check.png` is a 320×320 image of the undead ship on the dark background with no UI chrome. Then `rm /tmp/thumb-check.png` and stop the dev server.

### Task 5: Render the thumbnails

**Files:**
- Create: `scripts/render-thumbnails.ts`
- Create (by script): `public/cdn-assets/pirate-nation/thumbnails/*.jpg`

- [x] **Step 1: Write the script**

Create `scripts/render-thumbnails.ts`:

```ts
/**
 * Renders one grid thumbnail per catalogued model.
 *
 * Starts a Vite dev server, drives the `thumb.html` route with headless
 * Chromium, and writes a 320×320 JPEG per model to
 * `public/cdn-assets/pirate-nation/thumbnails/<id>.jpg`. Existing thumbnails
 * are skipped unless `--force` is passed. Every failure is reported by model
 * id and the process exits non-zero if any model failed.
 *
 * Usage:
 *   node --import tsx scripts/render-thumbnails.ts [--force] [--limit N]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const SHOWCASE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PACK = join(SHOWCASE_ROOT, 'public/cdn-assets/pirate-nation')
const THUMBS = join(PACK, 'thumbnails')
const SIZE = 320
const READY_TIMEOUT_MS = 30_000

interface ModelEntry {
  id: string
  relativePath: string
}

function isCollisionModel(id: string): boolean {
  return id.endsWith('-collision')
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force')
  const limitFlag = process.argv.indexOf('--limit')
  const limit = limitFlag === -1 ? Infinity : Number(process.argv[limitFlag + 1])

  const models = (
    JSON.parse(readFileSync(join(PACK, 'runtime/models.json'), 'utf8')) as ModelEntry[]
  ).filter((model) => !isCollisionModel(model.id))

  mkdirSync(THUMBS, { recursive: true })
  const pending = models
    .filter((model) => force || !existsSync(join(THUMBS, `${model.id}.jpg`)))
    .slice(0, limit)

  console.log(`${models.length} visual models, ${pending.length} to render`)
  if (pending.length === 0) return

  const server = await createServer({ root: SHOWCASE_ROOT, server: { port: 5191, strictPort: true } })
  await server.listen()
  const base = `http://localhost:5191`

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } })
  const failures: { id: string; reason: string }[] = []

  try {
    for (const [index, model] of pending.entries()) {
      try {
        await page.goto(`${base}/thumb.html?model=${encodeURIComponent(model.id)}`)
        await page.waitForFunction(
          () => window.__thumbReady === true || typeof window.__thumbError === 'string',
          undefined,
          { timeout: READY_TIMEOUT_MS },
        )
        const renderError = await page.evaluate(() => window.__thumbError)
        if (renderError) throw new Error(renderError)

        const shot = await page.locator('#thumb-root').screenshot({ type: 'jpeg', quality: 82 })
        writeFileSync(join(THUMBS, `${model.id}.jpg`), shot)
      } catch (error) {
        failures.push({ id: model.id, reason: (error as Error).message })
      }
      if ((index + 1) % 25 === 0) console.log(`  ${index + 1}/${pending.length}`)
    }
  } finally {
    await browser.close()
    await server.close()
  }

  console.log(`rendered ${pending.length - failures.length} of ${pending.length}`)
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAILED ${failure.id}: ${failure.reason}`)
    throw new Error(`${failures.length} model(s) failed to render`)
  }
}

await main()
```

- [x] **Step 2: Render a small batch first**

Run: `npm run thumbnails -- --limit 5`
Expected: `355 visual models, 5 to render` then `rendered 5 of 5`; `ls public/cdn-assets/pirate-nation/thumbnails/ | wc -l` reports 5.

Open two of the JPEGs and confirm the model fills the frame on the dark background.

- [x] **Step 3: Render the rest**

Run: `npm run thumbnails`
Expected: `rendered 350 of 350` (already-rendered ids are skipped), no `FAILED` lines, exit 0. Runtime is roughly 5 minutes.

- [x] **Step 4: Confirm coverage and idempotence**

Run:

```bash
ls public/cdn-assets/pirate-nation/thumbnails/*.jpg | wc -l
npm run thumbnails
du -sh public/cdn-assets/pirate-nation/thumbnails
```

Expected: 355 files; the second run prints `0 to render` and exits 0; the folder is under 15 MB.

- [x] **Step 5: Confirm the thumbnails are LFS-tracked**

Run: `git add public/cdn-assets/pirate-nation/thumbnails && git check-attr filter -- public/cdn-assets/pirate-nation/thumbnails/ships-item-4x8-pirateshipsmallundead.jpg`
Expected: `filter: lfs`

### Task 6: Thumbnails in the grid

**Files:**
- Modify: `src/tabs/ModelGallery.tsx`, `src/styles.css`

- [x] **Step 1: Write the failing e2e expectation**

In `e2e/smoke.spec.ts`, add:

```ts
test('model cards show pre-rendered thumbnails', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Models' }).click()
  const firstThumb = page.locator('.model-card img').first()
  await expect(firstThumb).toBeVisible()
  await expect(firstThumb).toHaveJSProperty('naturalWidth', 320)
})
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx playwright test e2e/smoke.spec.ts -g "thumbnails"`
Expected: FAIL — no `.model-card img` element exists.

- [x] **Step 3: Implement the thumbnail card**

In `src/tabs/ModelGallery.tsx`, add the import `thumbnailPath` from `../catalog`
and `useAssetUrl` from `../useAssetUrl`, then add:

```tsx
function ModelThumb({ entry }: { entry: PirateNationModelEntry }) {
  const src = useAssetUrl(thumbnailPath(entry.id))
  const [failed, setFailed] = useState(false)

  // A model with no thumbnail renders as the plain text card it was before.
  if (failed) return null
  // Still resolving: hold the tile's shape so the grid does not jump.
  if (!src) return <span className="model-card-thumb model-card-thumb-empty" />
  return (
    <img
      className="model-card-thumb"
      src={src}
      alt=""
      loading="lazy"
      width={320}
      height={320}
      onError={() => setFailed(true)}
    />
  )
}
```

and render it as the first child of each `.model-card` button, before
`.model-card-name`.

- [x] **Step 4: Style the tile grid**

In `src/styles.css`, replace the `.model-grid` and `.model-card` rules with:

```css
.model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  overflow-y: auto;
  padding: 4px;
}

.model-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  text-align: left;
  background: #161b26;
  border: 1px solid #232a38;
  border-radius: 10px;
  cursor: pointer;
  color: inherit;
}

.model-card:hover {
  border-color: #3a465d;
}

.model-card.selected {
  border-color: #f2c14e;
}

.model-card-thumb {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: 6px;
  background: #10141c;
}

.model-card-thumb-empty {
  display: block;
}

.model-card-name {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
}

.model-card-meta {
  font-size: 11px;
  color: #8b97ad;
  line-height: 1.3;
}
```

- [x] **Step 5: Run the test to verify it passes**

Run: `npx playwright test e2e/smoke.spec.ts -g "thumbnails"`
Expected: PASS

### Task 7: Persistent stage, keyboard navigation, and Random

**Files:**
- Modify: `src/tabs/ModelGallery.tsx`, `src/styles.css`, `e2e/smoke.spec.ts`

- [x] **Step 1: Write the failing e2e expectations**

In `e2e/smoke.spec.ts`, add:

```ts
test('models tab keeps a stage mounted and navigates by keyboard', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Models' }).click()

  // The stage is up before any card is clicked.
  await expect(page.locator('.model-viewer canvas, .viewer-error').first()).toBeVisible()

  const selectedName = () => page.locator('.model-card.selected .model-card-name').innerText()
  const first = await selectedName()

  await page.keyboard.press('ArrowRight')
  await expect
    .poll(async () => await selectedName())
    .not.toBe(first)

  const afterArrow = await selectedName()
  await page.getByRole('button', { name: 'Random' }).click()
  await expect
    .poll(async () => await selectedName())
    .not.toBe(afterArrow)
})
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx playwright test e2e/smoke.spec.ts -g "keeps a stage"`
Expected: FAIL — no card is selected on load, so `.model-card.selected` does not exist.

- [x] **Step 3: Implement selection defaulting and navigation**

In `src/tabs/ModelGallery.tsx`, inside the component after `visible` is computed:

```tsx
  // The stage is never empty: selection follows the filtered list.
  useEffect(() => {
    if (visible.length === 0) {
      if (selectedId !== null) setSelectedId(null)
      return
    }
    if (!visible.some((entry) => entry.id === selectedId)) {
      setSelectedId(visible[0]!.id)
    }
  }, [visible, selectedId])

  const step = useCallback(
    (delta: number) => {
      if (visible.length === 0) return
      const index = visible.findIndex((entry) => entry.id === selectedId)
      const next = (index + delta + visible.length) % visible.length
      setSelectedId(visible[next]!.id)
    },
    [visible, selectedId],
  )

  const pickRandom = useCallback(() => {
    if (visible.length < 2) return
    let next = selectedId
    while (next === selectedId) {
      next = visible[Math.floor(Math.random() * visible.length)]!.id
    }
    setSelectedId(next)
  }, [visible, selectedId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      // Never steal keys from the search box or the sort/animation selects.
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) {
        if (event.key === 'Escape' && target.tagName === 'INPUT') setSearch('')
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        step(1)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        step(-1)
      } else if (event.key === 'Escape') {
        setSearch('')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [step])
```

Add `useCallback` to the `react` import.

Add the Random button to `.gallery-toolbar`, after the sort `<select>`:

```tsx
          <button type="button" className="chip" onClick={pickRandom}>
            Random
          </button>
```

- [x] **Step 4: Make the stage permanent**

Replace the conditional `{selected && (<aside className="gallery-detail">…)}`
block and the wrapper `className` with an always-rendered stage:

```tsx
    <div className="gallery with-detail">
      …
      <aside className="gallery-detail">
        {selected ? (
          <>
            <div className="gallery-detail-header">
              <h2>{selected.name}</h2>
              <span className="gallery-detail-position">
                {visible.findIndex((entry) => entry.id === selected.id) + 1} / {visible.length}
              </span>
            </div>
            <ModelDetail
              entry={selected}
              collisionEntry={collisionIndex.get(selected.id) ?? null}
            />
          </>
        ) : (
          <p className="empty">No models match this filter.</p>
        )}
      </aside>
    </div>
```

Clicking the selected card no longer deselects, since the stage must stay
filled — change the card's handler to `onClick={() => setSelectedId(entry.id)}`.

In `ModelDetail`, key the error boundary by model so it resets when the stage
swaps. Without this, one asset that fails to resolve leaves the permanent stage
dead for the rest of the visit, where the old open/close panel used to clear it:

```tsx
      <ViewerErrorBoundary key={entry.id}>
```

- [x] **Step 5: Style the two-pane layout**

In `src/styles.css`, replace the `.gallery` rules with:

```css
.gallery {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.gallery.with-detail {
  grid-template-columns: minmax(0, 1fr) minmax(360px, 42%);
}

.gallery-list,
.gallery-detail {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}

.gallery-detail-position {
  font-size: 12px;
  color: #8b97ad;
}

/* Narrow screens stack, and the stage goes first: the grid is 355 cards
   tall, so a stage placed after it would be unreachable by scrolling. */
@media (max-width: 900px) {
  .gallery.with-detail {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(320px, 45vh) minmax(0, 1fr);
  }

  .gallery-detail {
    order: -1;
    min-height: 0;
    overflow-y: auto;
  }
}
```

- [x] **Step 6: Run the tests to verify they pass**

Run: `npm run test:e2e`
Expected: PASS — 8 tests (6 existing plus the thumbnail and stage/keyboard tests).

- [x] **Step 7: Full suite**

Run: `npm run typecheck && npm test && npm run build`
Expected: PASS — typecheck clean, 36 vitest, build succeeds.

### Task 8: Documentation

**Files:**
- Modify: `README.md`, `THIRD_PARTY_NOTICES.md`, `public/cdn-assets/pirate-nation/PROVENANCE.md`
- Modify (repo root): `README.md`, `THIRD_PARTY_NOTICES.md`

- [x] **Step 1: Project README**

In `games/pirate-nation-showcase/README.md`:

- Replace every `public/assets/pirate-nation` with `public/cdn-assets/pirate-nation`.
- Change the "Other scripts" paragraph to:

```markdown
Other scripts: `npm run build`, `npm run preview` (port 4190),
`npm run typecheck`, `npm test` (vitest), `npm run test:e2e` (playwright),
`npm run thumbnails` (re-render the model grid thumbnails),
`npm run repair:models` (one-time GLB normalization repair; see
`public/cdn-assets/pirate-nation/PROVENANCE.md` §6).
```

- Add a new section before "What the showcase shows":

~~~markdown
## Deploying

This app runs on RUN.world. The pack lives in `public/cdn-assets/`, which
`rundot deploy` uploads to the CDN, so the game bundle stays small.

```bash
rundot login                                    # once per machine
rundot init --name "Pirate Nation Art Showcase" --build-path ./dist  # once per game
npm run deploy                                  # builds, then uploads
```

`rundot init` registers the game and fills in `gameId`; commit that change.
`rundot deploy` only uploads builds for an already-registered game, so `init`
comes first and only once.
~~~

- Update the Models bullet to describe the new browser:

```markdown
- **Models** — a thumbnail grid over the 355 visual GLBs in 10 categories, with
  search, sort, category chips, `←`/`→` keyboard paging and a Random button.
  A model is always on the stage beside the grid: orbit, turntable, wireframe,
  animation-clip playback (~148 models are animated), and a Collision toggle
  where the pack ships collision geometry. The detail panel lists real
  dimensions from baked bounds, grid footprint, source path, and license.
```

- [x] **Step 2: THIRD_PARTY_NOTICES**

Run: `grep -n "assets/pirate-nation" THIRD_PARTY_NOTICES.md`
Replace each hit's `public/assets/pirate-nation` with `public/cdn-assets/pirate-nation`.

- [x] **Step 3: PROVENANCE**

Append to `public/cdn-assets/pirate-nation/PROVENANCE.md`:

```markdown
### 2026-08-24 — Moved to cdn-assets, thumbnails added

The pack moved from `public/assets/pirate-nation/` to
`public/cdn-assets/pirate-nation/`. The RUN.world CLI uploads only
`public/cdn-assets/` to the CDN, and the pack is too large for the game bundle.

`thumbnails/` holds one 320×320 JPEG per visual model. These are generated from
the pack's own GLBs by `npm run thumbnails`; they are not upstream art. They
carry the same license as the models they show.
```

- [x] **Step 4: Root THIRD_PARTY_NOTICES**

In the repo-root `THIRD_PARTY_NOTICES.md`, line 14 points at the old path.
Change both the label and the link target to
`games/pirate-nation-showcase/THIRD_PARTY_NOTICES.md`.

Run: `grep -rn "tools/pirate-nation-showcase" README.md THIRD_PARTY_NOTICES.md` (repo root)
Expected: no output.

- [x] **Step 5: Root README**

In the repo-root `README.md`, delete the Pirate Nation Showcase entry from
`## Tools` (if present) and add to `## Games`, after the Dither Playground line:

```markdown
- [Pirate Nation Art Showcase](games/pirate-nation-showcase/) — a browsable showcase over the MIT-licensed Pirate Nation asset pack (Proof of Play): a thumbnail grid and 3D viewer over 355 models with animation playback and collision-geometry toggle, a full pirate Avatar Lab, plus sprite and audio browsers. See [games/pirate-nation-showcase/README.md](games/pirate-nation-showcase/README.md).
```

- [x] **Step 6: Final verification**

From `games/pirate-nation-showcase/`:

```bash
npm run typecheck && npm test && npm run test:e2e && npm run build
ls dist/cdn-assets/pirate-nation/runtime/models.json
find dist -path dist/cdn-assets -prune -o -type f -print0 | xargs -0 stat -f%z | awk '{s+=$1} END {print s/1048576" MB (excluding cdn-assets)"}'
grep -rn "public/assets/pirate-nation" . --include='*.ts' --include='*.tsx' --include='*.md' --exclude-dir=node_modules
```

Expected: all suites pass; the pack is present under `dist/cdn-assets/`; `dist`
excluding `cdn-assets` is under 32 MB; the grep returns nothing.

## Open Questions

- **Does the deploy zip exclude `dist/cdn-assets`?** The deploy guide caps the zipped `dist/` at 100 MB, and this pack is 341 MB. `beat-board` ships 116 MB the same way, and the CLI's symbols (`UploadCdnAssetsIfExist`, `UploadAssetsToCdnAsync`, `ZipGameDistFolder`) show the CDN upload happening as its own step, so the cap almost certainly applies to the bundle without CDN assets. This can only be settled by an actual `rundot deploy`, which needs the user's account — so it is a deploy-time check, not an implementation blocker. If the upload is rejected, the fallback is to split the pack across deploys or ask RUN ops to raise the cap.
- **The production `gameId`.** `rundot init` writes a gitignored `game.config.prod.json` holding the per-account binding, so nothing in this plan creates or commits it; `rundot deploy` assumes an already-registered game. Both need `rundot login`, so they stay user actions. `rundot import <dir>` is an alternative that registers the project and wires the SDK itself — it would overlap Task 2, so this plan writes the committed config (`config.json`) by hand instead, which keeps the diff reviewable.
- **No playground session in local dev.** Without `rundotGameSandboxPlugin`, `initializeAsync()` fails locally and every asset resolves through the `cdn-assets/` fallback, which Vite serves from `public/`. That is the intended local path, but it means the real manifest-resolved CDN URLs are first exercised on the deployed build. Adding the sandbox plugin later is a two-line change if a playground-backed API is ever needed.
- Thumbnails are generated once and committed. They go stale if the pack is re-extracted or the repair script runs again. Re-running `npm run thumbnails -- --force` is the fix; wiring that into CI is a non-goal here.
