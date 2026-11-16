# Chonky Cats (working title: Purrfect Pedigrees)

The cat companion to Chonky Hounds (`../chunky-toy`). Cats vary less in body than dogs, so instead of
one model per breed there are **8 shared bodies**; the 30 breeds in `breeds.csv` become colourways on them.

| Body | Concept | Breeds |
|---|---|---|
| moggy | ginger-tabby | Ginger, Tuxedo, Calico, Brown Tabby, Black, Tortie, American Shorthair, Bengal, Egyptian Mau, Turkish Van |
| cobby | british-shorthair | British Shorthair, Scottish Fold |
| flatface | persian | Persian, Himalayan, Exotic Shorthair |
| floof | maine-coon | Maine Coon, Norwegian Forest, Siberian, Ragdoll, Birman |
| sleek | siamese | Siamese, Oriental, Russian Blue, Abyssinian, Savannah |
| pixie | sphynx | Sphynx, Devon Rex |
| munchkin | munchkin | Munchkin (legs shortened by `stubby.py`) |
| bobtail | japanese-bobtail | Manx, Japanese Bobtail |

## Pipeline (run from this folder; Blender one job at a time, single thread)

```bash
./gen_concepts.sh          # concept per breed (asset-bot, Nano Banana Pro); board.py -> concepts/board.png
./gen_models.sh            # Hunyuan3D mesh per body (bodies.csv) -> raw/
# models/ (3k) and lowpoly/ (1k): ../chunky-toy/optimize.py, then stubby.py on the munchkin
./rig_all.sh               # the Hounds rig on every body -> rigged/<body>.glb, wear, previews-rigged/
                           # and rigged/clips.glb (authored on the moggy from clips_cat.py)
```

`faces.json` holds each body's eye and nose picks, `tails.json` each tail's traced centreline, (from front renders, glTF space) and nose
colour; `../chunky-toy/rig.py` reads it via `RIG_DATA`, and the clip set via `CLIPS_MODULE=clips_cat`.

## Clips

Played with the Hounds' `dogclips.js` (`loadClipLibrary`, `setupDog`), the same as the dogs.

| Group | Clips |
|---|---|
| Gaits (in place) | `walk`, `trot`, `run`, `gallop` (tail up and hooked when walking, streaming back when running) |
| Standing | `idle` (looks about, tail-tip flicks), `meow`, `hiss` (puffed, stiff-legged), `pounce` (crouch, bum wiggle, leap, pin, spring back), `stretch`, `sniff` |
| Sitting | `sit_enter` / `sit_loop` / `sit_exit`, `groom`, `bat`, `knead` |
| Lying | `down_*`, `flop_enter` / `flop_loop` / `flop_exit` (rolls onto its side, from down), `loaf_enter` / `loaf_loop` / `loaf_exit` (straight from standing, all legs tucking at once; dozing), `roll_over` |

Pupils dilate: each eye has a `dilate` blend shape (slit to round), driven by the non-deforming
`dilate` bone's x scale (1 slit, 2 round), so clips set it: slits when calm or sleepy, part-open
for curiosity, play, kneading and the meow, wide for hunting (pounce) and the hiss. A game can hold
them anywhere with `cat.pupils = 0..1` (null hands back to the clip). `viewer.html?pupils=1`,
and the pupils slider on `colorways.html`.

Events: `meow`, `hiss`, `land` (pounce). Pose clips carry `from` / `to` states (`stand`, `sit`, `down`, `flop`, `loaf`).

Tails move in every clip with overlap (`swish()`: each bone follows the one before two frames later,
swinging wider toward the tip). They're skinned from hand-traced centrelines in `tails.json`
(`path` + tube radius `r`, from side renders): weights follow distance along the tail, blending
into the hips over the first fifth, so bends never crease or tear at the root.

## Colourways

`python3 colorways_cat.py [body ...]` writes `rigged/coats/` (mask PNGs, 1.5 MB) and `coats.json`:
236 colourways over the 8 bodies, read by the Hounds' `../chunky-toy/dogcoat.js` exactly like the dogs':

```js
const coats = await loadCoats('coats.json', 'rigged/coats/');
const coat = await coats.apply(catScene, 'sleek');
coat.set(coats.palette('sleek', 'siamese'));   // also sets the eye colour (palette.face)
```

Each body is first repainted to a plain neutral coat (the AI's own stripes and patches go, its
soft shading stays), so every pattern is a mask: mackerel and classic tabby, spots, rosettes,
ticked, colour points (face mask, ear tips, legs, tail), tuxedo, mitts, van, calico, tortie,
smoke, bold and leopard spots (solid: ring rosettes read as something growing on the cat), white socks / boots / mitts
(the shader's sock marks, 0.17 / 0.28 / 0.55 on these short legs). Every colourway darkens a thin rim round the eyes (the shader's eye marks) so
the eye colour pops; cat eyes have slit pupils (faces.json `pupil`, `_PART` 6) that look ahead (between straight forward
and the face's surface normal), on rounder eyeballs, with the face tucked under each ball so nothing pokes over its rim. Calico variants
(dilute, high white, caliby, tortie and white, tuxedo calico) and white cats with brows (brows mark) or a cap
(van mask) come from the same masks. Cat eyes are flatter and set deeper than the dogs' (`EYE_DEPTH` / `EYE_SINK` in rig.py), with near
full-height slit pupils wrapped onto the eye. Cats have no mouth cut (faces.json `mouth_w` 0): the jaw
drops the chin, and no seam shows round the muzzle. Colourways tagged `breed` are the 30 breeds in `breeds.csv`; the rest are everyday colours
(black, white, blue, cream, ginger, tabbies, tuxedo, calico, tortie) on every body.
`colorways.html` shows them (drag to swivel every cat at once; `?body=sleek`, `?back`; `capture.py colours[:body[:back]]`).

## Wearables

Each body has four, fitted by `../chunky-toy/wear_lib.py` (`WEAR_KINDS` in `rig_all.sh`) into
`rigged/wear/<body>--<kind>.glb`: `collar` (tag), `bandana`, `bell_collar` (white strap: tint with
`material.color`; brass bell) and `neckerchief` (scout style: band, slide, two ends; cloth tinted with
`tintCloth` from `../chunky-toy/dogcoat.js`, any two colours, plain / dots / gingham / stripes).
Attach with `attachWear` (dogclips.js); one neck piece at a time. `viewer.html?wear=<kind>&front`.

## Sizes

On the Chonky Hounds scale (a puppy is 0.45, a medium dog 0.85), so cats and dogs share a scene:
scale a cat's root to **small 0.45, medium 0.55, large 0.65** (`size` in `breeds.csv`). Kittens can
start at 0.3: `cat.grow(g, adult)` (dogclips.js; g 0 kitten .. 1 adult) scales the root and gives
kittens bigger eyes (1.35x, shrinking to 1 at adult size) through the per-eye `eye.L` / `eye.R`
bones; `cat.eyes` sets the eye size directly. The fluffy body (Maine Coon, Norwegian, Siberian,
Ragdoll, Birman) has 15% smaller eyes: big breeds read odd with kitten-size eyes. Props in `props/` are modelled at that real size (the cat tree is 1.6 units, about
three medium cats tall); small toys are 1.5x real so they read in a game.

## Props

50 cat-only props in `props/` (incl. 10 novelty ones: pineapple house, strawberry cave, fruit-tart, watermelon, avocado (the cat is the pit), toast, mushroom house, shark bed, mushroom cat tree, croissant toy) (`props.csv`: group bed / scratch / toy / care, tier basic / standard /
premium), made like the Hounds props: concept (`gen_concepts.sh`) → Hunyuan3D (`gen_models.sh`) →
`optimize_all.sh`. The hair tie, spring toys, ball track tower, cat poop, litter clump and pee spot (see-through) are
built by `procedural.py`. `fix_tree.py` (run by `optimize_all.sh`) swaps the decimated cat
tree's house for a clean box with a round doorway: at game budgets the AI one warped. Bowls, the water fountain, plain beds, the box and the brush come from the
Hounds props. `props/props-check.html` shows every prop at size beside a cat (`capture.py props`).

Fit: every bed, cave, house and litter box holds the biggest cat at the large size (0.65), curled up
(sitting for litter boxes). `capture.py sizes` measures the bodies per pose (`checks/cat-sizes.html`,
tail left out), `props/fit.py --write` grows any container that's too small (then `optimize_all.sh`),
and `props/fit-check.html` (`capture.py fit`) shows a cat inside each one. `checks/prop_angles.py`
renders every prop from four angles to look for pinching.

## Checking

Run `python3 chonky-cats/serve.py` (serves `tools/run-dog-pack` with caching off) and open
http://localhost:8765/chonky-cats/viewer.html (all 8 bodies, a button per clip; pose clips
play their way in and out). `python3 chonky-cats/capture.py <clip>[:cats[:n[:side[:zoom]]]]` (from
`tools/run-dog-pack`) saves frame strips from headless Chrome to `/tmp/chonky-cats/`;
`gallery[:clip[:WxH]]` captures the viewer page itself at a window size.

After every bake: `python3 checks/seams.py` (loops meet themselves, enter clips end where the next
clip starts) and `python3 checks/jumps.py` (one-frame pops), from this folder; and
`python3 chonky-cats/capture.py skin` (stretched triangles and floor contact per clip and body;
`skin-dogs` gives the Hounds baseline). Anything over ~15 degrees a frame that isn't a deliberate flick is a bug.

## Still to do

Library packaging (as the Hounds' `tools/library.mjs`), cover and trailer.
