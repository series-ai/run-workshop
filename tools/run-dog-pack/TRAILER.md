# Facet Fauna: Dogs — trailer outline (draft 2)

**Series:** *Facet Fauna: Dogs* (cats, horses, birds... later). A web and
asset-store search turned up no existing product with the name; run a
trademark check before printing it anywhere big.

**Concept: One Ball → drone show.** An off-screen hand keeps throwing a tennis
ball, and every throw sends a bigger, sillier stampede of dogs charging across
the screen. The chase passes through the kit's scenes, so breeds, mix-and-match,
recolours, clips, toys and props all get shown on the way. The running gag is
that the crowd always arrives too late, because the chihuahua already has the
ball. Smaller gags get mixed in. On the last throw the camera pulls high and the
stampede streams into formation like a drone light show, spelling the title.

**Length / format:** about 50 s, portrait 1080 × 1920 at 30 fps, cut to music
at roughly 120 BPM (each shot is a whole number of bars). It's built from the real GLBs and
clips in a three.js scene, like the dice promo.

## Camera rules: keep them small

- No dog taller than about a third of the frame; most are 1/6 to 1/12 of the
  frame height.
- High three-quarter game camera, never at snout level.
- Crowds are the hero: the more dogs on screen the better.
- Long lens, flat pastel light, slow constant drift.

## Look: glassy, modern, minimal UI

Unlike the playful balloon text of the dice promo, this one is calm and premium:

- **Frosted glass cards** (translucent white, background blur, thin light
  border, soft shadow) for captions and stats, floating in a corner rather
  than centred.
- **Type:** one clean geometric sans (Inter or similar), all-caps small labels
  with wide letter-spacing, plus big light-weight numbers ("415").
- **Motion:** cards slide and fade in over about 8 frames with a little blur;
  numbers count up; nothing bounces.
- **Palette:** off-white glass, near-black text, with one accent colour that
  changes per section and is taken from the dogs' coat palette.
- **Callout chips:** a thin line from a dog to a small glass tag (e.g. "prick
  ears", "piebald") in the mix-and-match shots.
- **Logo:** "FACET FAUNA" as a thin wordmark with a faceted gem / paw glyph,
  and ": DOGS" in the accent colour.

## Shots (draft 3: all crowd patterns)

The trailer leans on crowd patterns, which read best with small dogs: no close
gags, no ill-fitting gear.

| Time | Pattern | Glass UI |
|---|---|---|
| 0–5 s | Stripes: rows stream in from both sides, alternating direction | wordmark **FACET FAUNA · DOGS** |
| 5–9 s | Roll call: rows of breeds sorted tiny to huge | **415** breeds |
| 9–13 s | Waves: columns snake toward the camera in sine waves | 21 body types |
| 13–17 s | Mix & match: one dog swaps ears, tails and coats on the beat, lanes stream behind | 21 · 10 · 10 · 7 |
| 17–21 s | Recolour grid, repainted on every beat | 4-colour masks |
| 21–23 s | "Squirrel?": the marching grid freezes and looks sideways | SQUIRREL? |
| 23–28 s | Weave: rows and columns zip through each other's gaps | 65 animations |
| 28–34 s | Tricks grid: every dog a different trick, switching every bar | ONE CLIP · EVERY BREED |
| 34–38 s | Rings: concentric rings in opposite directions, in collars and bandanas (smooth coats only) | Collars & bandanas |
| 38–46 s | Finale: dark dogs run into formation and spell **DOGS** (2×2 dogs per pixel); the corgi is late | FACET FAUNA · stats |

## Making it

- **Scene:** `promo/index.html`, built on the kit viewer's loading code. A shot
  list drives dog placement, clips, crowd paths and the camera; captions are
  HTML glass cards (`backdrop-filter`) drawn into the captured frame.
- **Crowds:** dogs follow flow paths with per-dog random offsets, speed and
  breed, and play walk / trot / run / zoomies matched to their speed. For the
  drone show, each dog gets a target point sampled from the letter shapes,
  assigned nearest-first so the paths don't tangle.
- **Capture:** frame by frame, like the dice promo (`server.py` saves frames,
  `render.sh` encodes), so playback is smooth however heavy the crowd is.
- **Audio:** a synthesized upbeat track, with paw-pat rumble under the
  stampedes, a ball "tok", and a squeak on each gag.
- **Battery:** render one shot at a time, in the background.

## Decided

- Portrait only (1080 × 1920).
- Music: modern and clean (plucky synth, claps, soft sub) to match the glassy UI.

## Build status

Built: `promo/index.html` (all 12 shots, glass UI, gags), `promo/music.py`,
`promo/sfx.py`, `promo/render.sh`. Render with `promo/render.sh` from
`tools/run-dog-pack` (about 10 minutes); it writes `promo/out/trailer.mp4`
(1080 × 1920, 46 s). Check single frames with `promo/?at=<seconds>`.
