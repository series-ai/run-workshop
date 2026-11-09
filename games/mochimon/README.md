# Mochimon

Build a little pixel-art character, dress it up, watch it move, and export it as a game-ready sprite sheet.

Play it on RUN: **<https://w.run/run.sterf/mochimon>**

- **Make a character:** 10 bodies, 11 kinds of ears, 24 coat patterns, 58 hats, hairdos and masks, glasses, 16
  outfits, boots and 10 tails.
- **Watch it move:** 47 animations: idle, walking and running, jumping, sitting, eating, attacks with their
  effects, getting hit, magic, chores, and a full set of emotes. Drag the preview to turn it round.
- **Pick a palette:** 16 palettes at 2 (one-bit), 4, 8, 16 or 32 colours. Edit any colour and choose which
  ramp each part uses.
- **Export a sprite sheet:** choose animations (Basics, Attacks, More, or pick each), one, four or eight
  directions, and a file name. You get a zip with:
  - `<name>.png`: the sheet. One row per animation and direction, frames left to right, every cell the
    same size with the character's feet on the same spot.
  - `<name>.roles.png`: the same sheet with each pixel's part as a code in the red channel (0 outline,
    1 eye, 2 + role * 8 + shade), so a game can recolour the character at run time.
  - `<name>.json`: frame size, anchor, fps, the palette, and every row's animation, direction and frame
    count.
- **Export a UI kit:** speech, thought and shout bubbles (each with an anchor at its tail tip) and UI
  icons, painted in the same palette.

Ready-made characters, food and the UI kit, exported with this editor, are in the RUN asset library as
the *Mochimon* packs (`run-mochimon/2D/characters`, `run-mochimon/2D/food` and `run-mochimon/ui` in
[jam-ready-assets](https://github.com/series-ai/jam-ready-assets)).

## Run it

```bash
npm install
npm run dev
```

Then open <http://127.0.0.1:5195>. `npm run build` makes a static build in `dist/` that runs anywhere,
including as a RUN game (`rundot deploy`).

## How it works

Each character is a small 3D model built from signed distance functions (spheres, boxes, capsules and
blends), ray-marched to pixel art at its final size: outlines, three-quarter lighting and per-part
colours come straight from the render, with no drawing or downscaling. Everything happens in the
browser.

- `src/model/cat-model.ts`: the character model: bodies, ears, coats, hats, clothes, tails, the poses and
  effects for every animation, and the palettes. It also runs under Node for build scripts.
- `src/model/iso.ts`: the ray-marcher and shading. `src/model/bitmap.ts`: the pixel bitmap.
- `src/model/palette.ts`: palettes and colour modes. `src/model/ui-kit.ts`: the bubbles and icons.
- `src/render-worker.ts`: renders frames in a pool of web workers (geometry is the slow part, so it is
  cached; colour is painted on top, so palette changes are instant).
- `src/main.ts`: the editor UI and the export.

Draw exported sheets with nearest-neighbour filtering and scale them by whole numbers to keep the pixels
square.
