# Dither Playground

An interactive playground for GPU dithering: apply Bayer, blue-noise, halftone,
crosshatch, and stipple dithering with retro palettes (Game Boy, CGA, PICO-8,
C64, …) to a live 3D scene, your own images, or your own videos. Includes a
split-screen algorithm comparison grid, a static-vs-animated crawl test, and a
cursor-following resolve mask. Dropped files are read locally in your browser —
nothing is uploaded.

> New to run-workshop? Start with [Getting Started](../../GETTING_STARTED.md)
> for the shared prerequisites (Node 20+, npm 10+, Git LFS, the `rundot` CLI).

## Demo video

Watch the [dithered.mp4 demo](public/dithered.mp4) to see the effect in motion.

## Local setup

```bash
npm install
cp .env.example .env   # optional; both values can stay blank for local play
npm run dev
```

Then open the printed URL and sign in via the sandbox toolbar. `RUNDOT_API_KEY`
is only needed for headless/CI usage.

## Commands

- `npm run dev` — local dev server with the RUN sandbox
- `npm run build` — typecheck + production build
- `npm test` — unit tests (the dither-core tests live in
  [tools/dither-kit](../../tools/dither-kit/))
- `npm run deploy` — build and deploy with the `rundot` CLI (requires `rundot login`)

## Where things live

- `src/dither/` — `DitherPostProcess.tsx`, the bridge into
  `@react-three/postprocessing`. The dithering core itself (pure-TS config →
  uniforms → GLSL, palettes, named presets) lives in
  [tools/dither-kit](../../tools/dither-kit/) and is imported as the
  `dither-kit` package.
- `src/scenes/` — the three tabs: `SceneDemo` (3D), `ImageDemo`, `VideoDemo`.
- `src/components/` — shared controls, drop zone, media plane, frame updater.
