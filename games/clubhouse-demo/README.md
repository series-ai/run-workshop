# Clubhouse Demo

Showcase and test app for [clubhouse-games](../../tools/clubhouse-games/):
procedural playing-card faces and backs, dominoes, dice, mahjong tiles, 3D
flips, and PNG card-back support.
See [GETTING_STARTED.md](../../GETTING_STARTED.md) for repo setup.

## Local setup

```bash
(cd ../../tools/clubhouse-games && npm install)  # first — the app typechecks library sources
npm install
cp .env.example .env   # sign in via the browser toolbar, or set RUNDOT_API_KEY
rundot init --name "Clubhouse Demo" --build-path ./dist  # once per checkout (game.config.*.json is gitignored)
npm run dev            # http://localhost:4319
```

## Commands

- `npm run dev` — Vite dev server (port 4319)
- `npm run build` — typecheck + production build
- `npm run generate:back` — generate a PNG card back via the rundot CLI
- `npm run deploy` — build + `rundot deploy`

## Tabs

- **Flip** — one card; pick rank/suit/back, click to flip.
- **Deck** — all 52 cards; click any card to flip it.
- **Backs** — every back the app can render: the 28 procedural presets plus
  any PNG in `src/assets/backs/`.
- **Table** — a 12-card deck lying on the felt. Shuffle runs three real
  riffles (cut, interleave, square up), deal sends the cards into a fan and
  turns them over on the way, and gather squares the deck back up.
- **Dominoes** — full double-six set (28 tiles); click a tile to flip it.
- **Dice** — throw d4–d20 onto the felt. The dice tumble on their corners,
  knock into each other, and settle where they land. Pip, ornate, or numeral
  styles and six colorways.
- **Mahjong** — gallery of the 42 unique faces of a 144-tile set; click a
  tile to flip it.

## Generating card backs

Requires `rundot login` (once per machine) and ImageMagick on PATH:

```bash
npm run generate:back -- --name deco-navy --prompt "<prompt below>"
```

The script writes `src/assets/backs/deco-navy.png` (512×716), which the
Backs tab picks up on the next dev-server start. Generated images are
workshop-owned (see `games/beat-board/docs/authoring-packs.md` § License +
ownership). Names must be kebab-case — the repo's asset-hygiene check blocks
download-style basenames.

### Back prompt template

```
A playing-card back design, portrait composition that fills the frame edge
to edge. Symmetric ornamental pattern in <2-3 colors>, <style — e.g. art-deco
fan geometry / victorian filigree / minimalist diamond grid>. Flat vector
style, crisp edges, uniform margins, perfectly centered and symmetrical.
No text, no typography, no watermark, no logos, no words, no letters.
Not a photo of a card — the artwork itself, full-bleed.
```

The "No text…" clause list is load-bearing (repetition is what suppresses
fake lettering); "Not a photo of a card" keeps the model from rendering a
card object on a table, which the center-crop would mangle.
