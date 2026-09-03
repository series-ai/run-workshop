# Clubhouse Games

Procedural tabletop art + React Three Fiber rendering. Four families — playing
cards, dominoes, dice, and mahjong tiles — painted onto 2D canvases (no asset
files, no third-party art licenses) and rendered as 3D pieces. PNG backs are
supported for custom/AI-generated **card** art.

Source-consumed in this repo: import from `src/index.ts` (the playground
aliases it as `@clubhouse`). Consumers must dedupe `react`, `react-dom`,
`three`, `@react-three/fiber` in their bundler config.

## Usage

In this repo, consumers alias `src/index.ts` (the playground aliases it as
`@clubhouse`); installed as a package, the same imports resolve from
`clubhouse-games` via the `exports` field:

```tsx
import { Canvas } from '@react-three/fiber'
import {
  BACK_PRESETS, DiceTray, Die, DominoPiece, MahjongPiece, PlayingCard, useCardBackTexture,
} from '@clubhouse'

// Playing card (procedural theme back):
<PlayingCard card={{ rank: 'A', suit: 'spades' }}
             back={{ kind: 'theme', theme: BACK_PRESETS[0] }}
             faceUp={faceUp} onClick={() => setFaceUp(v => !v)} />

// PNG card back (inside the Canvas):
const texture = useCardBackTexture('/backs/deco-navy.png')
<PlayingCard card={...} back={{ kind: 'texture', texture }} faceUp={false} />

// Domino, die, mahjong tile (chunky BoxPiece — scene needs lights):
<ambientLight intensity={0.7} />
<directionalLight position={[3, 4, 6]} intensity={1.1} />
<DominoPiece domino={{ left: 6, right: 3 }} faceUp />
<Die />
<Die kind={20} style="ornate" colorway="obsidian" />
// A thrown set. The dice collide with each other and with the table rails,
// then settle on whatever face they land on.
<DiceTray kind={6} style="ornate" colorway="ruby" count={2}
          tossToken={n} onSettle={setValues} />
<MahjongPiece tile={{ kind: 'dragon', dragon: 'red', copy: 1 }} faceUp />
```

Key exports:

- Cards: `fullDeck` / `cardId` / `parseCardId`, `paintFace` / `paintBack`,
  `BACK_PRESETS` / `getBackPreset`, `toTexture` / `getFaceTexture` /
  `getBackTexture` / `loadBackTexture`, `PlayingCard` / `useCardBackTexture`.
- Shuffling: `riffle` (one cut-and-interleave pass, Gilbert-Shannon-Reeds),
  `riffleShuffle` (several passes), `riffleTraced` (the same pass plus the cut
  point and which half each card fell from, for animating the interleave).
- Dominoes: `doubleSixSet` / `dominoId` / `parseDominoId`, `paintDomino`,
  `DominoPiece`.
- Dice: `DIE_FACES` / `paintDieFace` / `paintDieNumeral`, `Die` / `DiceTray`
  (d4–d20, pip / ornate / numeral, colorways). The throw is a rigid-body
  simulation: `startToss` / `stepToss` resolve impulses at the die's own
  corners, so it tips and rolls instead of bouncing like a ball, and
  `resolvePairs` keeps thrown dice out of each other. A die may only fall
  asleep once a face is actually level, and gravity tips it there during the
  throw, so the end of a roll is continuous — nothing is rotated onto a face
  after the fact. Supporting geometry:
  `dieVertices` / `dieRestHeight` / `dieInertia` / `facesForDie`.
- Mahjong: `fullMahjongSet` / `mahjongFaceId` / `mahjongTileId`,
  `paintMahjongFace` / `paintMahjongBack`, `MahjongPiece`.
- Shared: `BoxPiece` / `useFlipY` / `toTexture`, and the engraving helpers
  `drawGuillocheBand` / `drawCircleRosette` / `roundRectPath` used by the card
  backs and the ace.

## Conventions

- Card art is painted at 512×716 (5:7 poker ratio) by default; painters take
  `scale` for lower-res grids.
- Suit pips are drawn with canvas paths, never font glyphs (unicode suits
  render as color emoji on macOS).
- Face/back textures are cached and shared across meshes; call
  `disposeCardTextureCaches()` only after unmounting all card meshes (it
  disposes `card-`-prefixed keys only).
- Cards render with `meshBasicMaterial` — printed cards take no lighting. They
  still cast a shadow when given `castShadow`.
- Card backs are assembled from parts, so two backs differ in structure and
  not only in color. A theme picks a ground (`BACK_PATTERNS`, 17), a central
  ornament (`BACK_ORNAMENTS`, 4), a margin (`BACK_LAYOUTS`: centered,
  fullbleed, bordered, or an ivory cameo), a border (`BACK_FRAMES`: keyline,
  rope beading, greek meander, notched), a corner ornament (`BACK_CORNERS`),
  and a seal outline (`BACK_SEALS`); the seal can be switched off entirely.
  28 presets ship, no two sharing a combination. Each preset's rosette ripple
  counts come from its id, so no two roses match either.
- Corner ornaments only get 180-degree symmetry, since that is all a back
  needs; only brackets are turned through all four quarters.
- Two traps in `drawGuillocheBand`. Spinning the copies by a full ripple
  (`2*PI / waves`) cancels the phase offset and collapses them onto one path.
  And phase-shifting a single frequency is only a rotation, so the copies
  smear into a solid ring — the second, fixed harmonic is what makes them
  interlace.
- Court cards print from one fixed regal palette in every suit, the way a real
  deck's plates do; only the pips and indices take the suit color. The figure
  is built the way an engraving is: a diapered robe, ermine, a pleated ruff,
  and a face made of a few fine strokes. Rounder, larger features read as a
  cartoon at card size.
- Chunky pieces (dominoes, dice, mahjong) use `BoxPiece` with lit
  `meshStandardMaterial`. The scene must include an ambient light and a
  directional light.
- Every painted piece carries its own shading, because the lighting alone
  cannot show detail cut into a face: a gradient body, a bevelled rim, and
  pips drilled with a countersunk ring and a lit far edge. `lighten` and
  `darken` derive those tints and expect `#rrggbb`, so any color option
  passed to a painter must be in that form.
- Dominoes carry the brass spinner a real set has. Mahjong faces are carved
  and painted (a dark offset under the colored glyph), bamboo pips are jointed
  cane with leaves, and one bamboo is the traditional bird.
- Mahjong CJK faces use the `TILE_CJK_FONT` system stack
  (`"Songti SC", "STSong", "PingFang SC", serif`) — verified on macOS. Check
  Windows/Android fallbacks before shipping.

## PNG back format

Any square-ish portrait PNG works, but the house standard is **512×716
(5:7)** with opaque corners (the library draws its own rounded-corner alpha
only for procedural backs — PNGs should include their own corner radius or
ship square). Generate one with
`games/clubhouse-demo/scripts/generate-back.mjs`. PNG backs apply to playing
cards only.

## Tests

```bash
npm install
npm test          # vitest, pure-logic suites (deck, pips, themes, sets)
npm run typecheck
```

Visual verification happens in `games/clubhouse-demo` (node has no real 2D
canvas, so painters/components are not unit-tested).
