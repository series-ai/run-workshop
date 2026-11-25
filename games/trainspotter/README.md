# Trainspotter (RUN app)

A voxel model railway to play with, built from the **Trainspotter** asset pack
(`run-trainspotter` in jam-ready-assets; source in `tools/run-trainspotter`). Pick one of five
railways and one of about thirty trains, run it round, set the points and signals, change the
paint and the time of day, and watch the trailer. It works on phones (the controls become a
bottom sheet).

The app is the kit's own viewer (`tools/run-trainspotter/viewer/viewer.js`), with:

- models and sounds loaded from the published pack through
  `RundotGameAPI.assetLibrary.getPackBaseUrl(leaf, pin)`, with the versions pinned in
  `src/pins.js`; the kit catalogue the helper needs is `src/kit.json`;
- a "Watch the trailer" button that plays `public/trailer.mp4` full screen;
- `public/thumbnail.jpg` (512×512) as the app thumbnail, `public/icon.png` as the page icon, and
  both on the loading screen over `public/loading-backdrop.jpg`. They come from the tool's hero
  render (`node pack/hero.mjs` in `tools/run-trainspotter`, variant `mid-a`): the green express at
  golden hour, low and close, with the title.

| Path | What |
|---|---|
| `config.json` | the RUN app's id, name and description |
| `index.html`, `src/main.js`, `src/app.css` | the page, start-up (pack URLs, viewer, trailer) and the app's own styling |
| `src/pins.js` | published pack versions, one per leaf |
| `src/kit.json` | the kit catalogue from the same build as the pinned pack (`npm run sync-kit`) |
| `scripts/trailer.mjs` | makes the web-sized trailer from the tool's render (`npm run trailer`) |
| `vite.config.js` | local asset serving, the pin check for production builds |

## Run locally

```sh
npm ci
npm run dev            # http://localhost:5197
```

Local builds serve the pack from a jam-ready-assets checkout next to this repo (or
`VITE_JAM_ASSETS_DIR`), and otherwise from the tool's build output
(`tools/run-trainspotter/out/glb` and `out/sounds/ogg`). `npm run build:local` and
`npm run preview` check a production-like build with local assets.

The trailer carries its song, so `public/trailer.mp4` is not in git. Render it in the tool
(`node trailer/capture.mjs`), then `npm run trailer` here. Without it the app simply has no
trailer button.

## Deploy

1. Merge the pack into jam-ready-assets and wait for it to mirror.
2. Copy the two leaves' `version` values from the published `manifest/v2/index.json` into
   `src/pins.js` (`run-trainspotter/3D/vehicles-racing` and `run-trainspotter/audio`), and run
   `npm run sync-kit` from the same build.
3. `npm run trailer`, so the build has the trailer.
4. `rundot login` (once per machine), `rundot init --name "Trainspotter" --build-path ./dist`
   (once; writes a git-ignored `game.config.*.json`), then `npm run deploy`.

A production build stops with a message if a pin is missing.
