# Unity AI: local Editor and headless server

The Unity AI panel supports two connections. **Local Editor remains the default**;
its project discovery, reference images, and model-specific size controls are
unchanged. Select **Preferences → AI → Unity connection → Headless server**, save,
then open Unity AI from the toolbar to use the remote factory.

## Headless setup

This integration targets the HTTP API in
[series-ai/unity-cli-ai-gen](https://github.com/series-ai/unity-cli-ai-gen).
It requires Layout Manager's **Vite dev server** (`pnpm dev`), like the existing
local Unity bridge. A static production build or `vite preview` does not expose
these backend routes.

Create `.unity-headless.local.json` in the Layout Manager repository root with
these two string properties:

- `url`: the factory's base URL, for example `https://unity-factory.example.com`
- `apiKey`: the factory's bearer API key

Use file permissions `0600` on Linux/macOS. This file is Git-ignored and denied
by Vite's filesystem-serving rules. It is read server-side on each request, so
rotating the key does not require a rebuild. Do not put the key in a `VITE_*`
variable, browser preferences, a project file, or committed source. Unity account
credentials and the Enterprise serial belong on the factory, not in Layout Manager.

Prefer HTTPS or an encrypted tunnel. A plain HTTP base URL sends the bearer key,
prompts, and output images unencrypted. Avoid exposing the Layout Manager dev
server to untrusted users: its same-origin endpoints have access to this key.

## Supported behavior

- Authenticated session readiness (`/health` plus `/ready`), not just process liveness.
- Live image model catalog, adapted from the CLI's pipe-delimited output.
- Prompt-based 2D image generation with the selected model (`kind: image`,
  `remove_bg: false` explicitly).
- Long-running HTTP requests with an elapsed-time heartbeat in the panel.
- Authenticated PNG export downloads, imported through the same persisted-image
  path as local Unity results. Only same-factory `/exports/` paths are accepted;
  redirects and non-PNG payloads are rejected.
- Busy/authentication/generation errors surfaced without automatic client retries
  that might double-spend credits. The factory handles its own session recovery.

The HTTP API does **not** accept uploaded canvas references or width/height
parameters. Those controls and reference-dependent utilities are therefore not
offered in headless mode, and the bridge rejects unsupported inputs rather than
silently ignoring them. Images use the model's default size. This integration
uses the existing image canvas; mesh, audio, rigging, and animation outputs are
not exposed here. The local Editor option retains its existing capabilities.

A disconnected browser or a timeout does not guarantee cancellation on the remote
factory. Check the factory's exports/operator before resubmitting a paid job.

## Verification

No new dependencies are required. Tests use Node's built-in runner and native
TypeScript loading (Node 22.18+ or a newer supported Node release).

- `node --test tests/unityHeadless*.test.mjs` — HTTP fixture generation/downloads,
  auth, catalog parsing, readiness, input rejection, local routing, and Vite
  protections. Does not use real credentials or spend credits.
- `pnpm run build` — normal application type check and production build.
- `pnpm exec tsc --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution bundler server/unityHeadless.ts`
  — standalone server adapter type check.
- `node tests/unityHeadless.browser.mjs` — browser UI regression checks using
  fixture Unity responses, including malformed/empty images, persisted canvas
  import, and switching back to local. Start an **isolated** Chromium with
  `--headless --remote-debugging-port=9333 --user-data-dir=/tmp/lm-unity-qa`
  and Layout Manager on port 5181 first. Override `LM_TEST_CDP` and `LM_TEST_URL`
  if necessary. Never point this test at a personal browser profile; it resets
  preferences for the test origin. Screenshots are written to `/tmp`.

Live `/health`, `/ready`, and `/models` checks do not spend credits. A real
`/generate` smoke test does; fixture test results are not evidence of a live
Unity cloud generation.
