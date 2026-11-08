# Chonky Hounds: Doggo Dynasties

The chunky toy dog pack: 30 popular breeds in the chunky toy style. Unlike the faceted pack (shared bodies +
recolour masks), each dog here is its own model, generated from its own concept image.

| Folder | What |
|---|---|
| `breeds.csv` | slug, breed name, adult size class (toy/small/medium/large), and the literal look used in the concept prompt |
| `concepts/` | one Nano Banana Pro image per breed (style refs: the original pug, corgi and chunky-toy style sheet) |
| `raw/` | Hunyuan3D v3.1 output, ~12 MB each (gitignored, regenerate with `gen_models.sh`) |
| `rigged/` | **use these:** ~1,160 tris (1,000 + mouth), skinned to the shared dog skeleton, ~100 KB each; `clips.glb` (230 KB) holds all 15 shared clips once |
| `lowpoly/` | the same 1,000-tri dogs without a rig (static props) |
| `models/` | higher-detail static GLBs: 3,000 tris, smooth shading, 512 px JPEG texture, ~120 KB, height 1, feet at origin |
| `previews/`, `previews-rigged/` | 512 px renders (rigged ones mid-walk); `contact-sheet.png`, `contact-sheet-rigged.png` show all 30 |
| `index.html` | gallery + orbit viewer (serve this folder, e.g. `npx serve`) |
| `parade.html` | all 30 trotting in two rings, with puppy-to-adult growth; `?capture` renders exact frames for a seamless loop |

## Pipeline

```bash
./gen_concepts.sh     # concept image for any breed missing from concepts/
./gen_models.sh       # raw mesh for any concept missing from raw/ (then runs collect_raw.py)
./optimize_all.sh     # models/ + previews/ for any raw mesh missing from models/
./rig_all.sh          # lowpoly/ (1k) then rigged/ + clips.glb for any dog missing them
```

## Shared rig

Every dog has the same skeleton (`root`, `hips`, `spine`, `chest`, `neck`, `head`, `jaw`,
`mouth`, `tail.1-3` (+ `tail.tip` marker), `upperarm/forearm/hand.L/R`, `thigh/shin/foot.L/R`) with the **same
rest orientation for every bone**. `rig.py` only measures where the joints go, and leg
joints sit at fixed fractions of the leg length, so one clip file drives all 30.

Tails are found by growing along the mesh from the top of the rump, through vertices
down the middle behind the body (or rising above the back, for curls and plumes), then
fitted with three bones, so hanging, curled, plume and bob tails all bend and whip.
Every tail vertex is fully on the tail bones and nothing else is, so the rump (and its
coat pattern) stays put. Tail motion is authored in the tail bones' own frame (lift and
side-to-side), so it suits any tail direction. If Blender's heat
weighting fails on a mesh (the English Bulldog), a sealed voxel copy is weighted
instead and the weights are copied back.

Curled tails that lie on the rump (Pug, Shiba, Samoyed, Pomeranian) are marked by hand
in `tails.json` (coil centre and size, where it leaves the body): the whole coil is tail,
with the bones running from the base through the coil, so it moves as one piece, and
curled tails wiggle at 40% of the wag (`tail_curl`; real curls barely swing). Every tail
root blends softly into the rump, so a wag bends over a short distance, not one crease. Each dog
stores `tail_radius`, and dogclips.js keeps every tail above the floor by its own
thickness in every clip (lying out behind the dog, never forward under it), and lifts a
lying dog just enough that no folded leg goes through the floor.

Legs only move skin on the leg: away from each leg's column (radius measured at the knee)
leg weight fades into the chest or hips, so bellies and flanks don't swing with every
stride (belly wobble in trot / gallop dropped 30-70% across the 30 dogs).

Each dog also gets a real mouth: the muzzle is cut along the mouth line, with a dark
mouth and a tongue behind the lips (about 160 extra triangles). `mouth` is a socket
for a held ball. Per-dog extras on the armature node: `leg_length`, `body_length`,
`ball_radius`.

## Clips

`rigged/clips.glb` (authored on the Labrador by `clips_lib.py`):

| Group | Clips |
|---|---|
| Gaits (loop, in place) | `walk`, `trot` (the bouncy tippy-tap), `run` (canter), `gallop`, `robot` |
| Play | `play_bow`, `catch`, `drop_ball`, `stretch` (reach, quiver and yawn, back to neutral), `bark`, `sniff`, `point`, `idle` |
| Potty | `pee_male` (leg lift), `pee_female` (squat), `poop` |

| Poses (enter / loop / exit) | `sit`, `down`, `comfy` (from down: rolled on a hip, leg kicked out), `sploot`, `beg` (sit pretty, from sit), `dance` (up on hind legs, twirling), `play_dead` |
| Tricks (one-shot) | `paw` (from sit), `roll_over` (from down), `spin` (standing) |

Pose and trick clips carry `from` and `to` states (`stand`, `sit`, `down`, `comfy`,
`sploot`, `beg`, `dance`, `dead`). To get anywhere, find the shortest chain of clips
whose `from`/`to` link the current state to the target (the park does this in
`route()`), play them in order, then the target's `*_loop`.

Clip metadata (`clips` extras): duration, loop, `stride` for gaits (ground covered per
clip, in leg lengths) and event times: `catch`, `release`, `bark`, `sniff`, `pee_start`,
`pee_end`, `poop`.

Feet are placed with IK while authoring, so planted paws stay put while the body
crouches, bows or squats. Use [`dogclips.js`](dogclips.js) to play them in three.js; it
fits the clips to each dog at load time:

- root motion (bounce, crouch, jump) scales with leg length;
- body tilt shrinks for long-bodied dogs (Dachshund, Corgi), with legs counter-rotated,
  so a bow doesn't put the chest through the floor;
- `dog.setSpeed(speed, scale)` sets a gait's playback rate so feet don't slide:
  `timeScale = speed * duration / (stride * leg_length * scale)`;
- tail rotations are re-based from the Labrador's tail rest pose onto each dog's;
- clips flagged `nose_ground` (sniff) tip the neck each frame until the nose touches
  the ground, whatever the breed's neck and leg lengths;
- clips with a `tail_line` window (point) straighten the tail out behind;
- `dog.onEvent(name)` fires the events above (for props and sounds).

`parade.html` plays every clip with props (ball, puddle, poop, "Woof!"). `sheet.html`
is the test sheet: six extreme body shapes at six moments of one clip.
`seam-check.html` compares the skeleton wherever one pose clip hands over to another
(and each loop with itself); every seam should be under ~1°.
`skin-check.html` plays every clip on every dog and counts triangles that stretch past
1.8x or squash below 0.5x of their rest size, per dog, clip and bone (`window.check()`).

Weights: heat weighting, then rules (legs stay on their own side and below the
knee/elbow for lower-leg bones, tail moves only the tail), then a smoothing pass so
bends spread over more triangles.

## Sizes and growing up

Proportions never change with age; only scale does. Every dog starts as a puppy at
scale 0.45 and grows to its adult class from `breeds.csv`:

| Size | Adult scale | Breeds |
|---|---|---|
| toy | 0.45 (stays puppy-sized) | Chihuahua, Pomeranian, Yorkie, Shih Tzu |
| small | 0.65 | Pug, Frenchie, Boston, Jack Russell, Mini Schnauzer, Dachshund, Cavalier, Corgi, Beagle, Shiba |
| medium | 0.85 | English Bulldog, Border Collie, Aussie, Husky, Samoyed, Poodle, Dalmatian |
| large | 1.1 | Lab, Golden, German Shepherd, Rottweiler, Doberman, Great Dane, Bernese, Boxer, Greyhound |

## Eyes, nose and mouth

Every dog has separate glossy eye and nose geometry (rig.py, from `faces.json`: picked
on front renders of each original, sizes measured from the painted eyes), skinned like
the face under it. Eyes are near-round balls sunk a third into the head, facing the average
surface direction over the eye (so a wrinkle cannot tip one up); the nose is a solid
squashed dome (the nose in a
rounded-triangle outline) half sunk into the face, so it swallows the model's own
sculpted nose and eye bumps: nothing pokes through or curls around it. The AI texture's
own eyes, eye rings and nose leather are painted out with the fur around them
(`clean_face` in colorways.py), so the geometry is the only eye and nose. The mouth and
tongue sit back from the lips, and stay inside the head even on short fluffy muzzles
(the Pomeranian), so they never poke through a closed mouth.

Eyes, nose, mouth and tongue share one material (`face`): each vertex has its part's
default color (COLOR_0) and a part id (`_PART`: 1 left eye, 2 nose, 3 inside of the
mouth, 4 tongue, 5 right eye), so the whole dog is two draw calls (coat + face) and every
part can still be recolored, each eye on its own for odd eyes:
`coat.setFace({ eyes, eye_l, eye_r, nose, mouth, tongue })` (a colorway sets the nose;
`null` restores a default). The mouth is the inside of the mouth: it shows when the jaw
opens (bark, catch, pant). `eye_color` in faces.json sets the default (the Husky's blue).

## Colorways

A colorway is a palette, not a texture. `colorways.py` writes, per breed, 1-3 small
RGBA mask textures (`rigged/coats/<breed>-<n>.png`, 512 px) and `coats.json` (the
breed's mask layers and its colorway palettes; 166 across the 30 breeds, list in
[COLORWAYS.md](COLORWAYS.md)). `dogcoat.js` recolors in the shader:

    const coats = await loadCoats('coats.json', 'rigged/coats/');
    const coat = await coats.apply(dogScene, 'border-collie');
    coat.set(coats.palette('border-collie', 'blue-merle'));   // or any colors you like
    coat.set(null);                                          // the original

Masks: how much each texel is coat (inner ears and lips keep the original), the nose
leather, the breed's original color areas, and its marking layers (tan points, merle,
brindle, saddle...). Shading and fur detail aren't stored: the shader reads them from the
original texture (its lightness against each source color, `ref_l`). Channels are packed
tightly per breed (`channels` in coats.json); crisp shapes are stored as distance fields
at 256 px (sharper edges than 512 px coverage, at a quarter of the pixels), soft ones at
256 or 512 px. 65 mask PNGs, 2.6 MB, cover all 30 breeds.

Markings are built in 3D from the dog's skeleton and texel positions (coatlib.py): tan
points, brows and eye patches from the eye positions, saddle, blaze, socks, collar, and
patterns: merle (torn patches over the dilute base, matched to the original Aussie),
harlequin, brindle, sesame, sable, piebald, parti, ticking.

Before the masks are built, each freshly rigged dog's own texture is prepared once
(`prepare_base`): the painted eyes under the eye geometry are painted out with the fur
around them, and breeds whose AI pattern was broken on the back (it was guessed from
front and side views: Dalmatian, Australian Shepherd, English Bulldog, and the Husky's
face mask) get that pattern repainted in 3D, so spots and merle wrap round the body
without seams; a repaint keeps only soft form shading from the AI texture, not its lines.

Looks (`LOOKS` in colorways.py, `like` in coats.json) are colorways that let a body pass
for another breed: a German Shorthaired Pointer, Vizsla or Weimaraner on the Labrador,
Australian Cattle Dog on the Aussie, Keeshond and Chow on the Samoyed, pit bulls on the
Boxer, Papillon and Min Pin on the Chihuahua, Brittany and Springer on the Cavalier...

`python3 colorways.py --bake DIR` also writes every colorway as a ready-painted GLB (the
same math, in numpy) for engines without custom shaders. `colorways.html` shows them
all through the shader; click one to edit its palette live. `rig_all.sh` rebuilds the
masks after a re-rig.

## Markings (genes)

Twelve markings need no texture at all; the shader computes them per pixel from the
dog's rest-pose position and bone weights, so a game can set them per dog from a few
numbers (a breeding game's genes), and blend or randomize them freely:

| mark | size means |
|---|---|
| `sock_fl`, `sock_fr`, `sock_hl`, `sock_hr` | height up that leg: 0.12 socks, 0.3 boots, 0.55 stockings |
| `muzzle` | white muzzle round the nose and mouth |
| `blaze` | stripe up the face, width |
| `bib` | rounded chest patch |
| `eye_l`, `eye_r` | patch round one eye |
| `mask` | dark muzzle mask, how far back |
| `tail_tip` | tail tip length |
| `brows` | a dot above each eye |

Each is a color and a size (0 = off): `coat.set({...pal, marks: {sock_fl: ['#eeedea', 0.2]}})`.
`colorways.html` has sliders for all of them and a Randomize button. Recipes use them too
(`marks=` in colorways.py), and simple layers (socks, blaze, chest, eye patches, mask, tail
tip, brows) are turned into marks automatically, so they cost no texture. Python bakes run
the same formulas (`mark_value`, mirrored by `markValue` in dogcoat.js).

## Performance and mobile

`cd tools && npm install && npm run mobile` builds the shippable kit in `dist/` (its own
README from `KIT.md`, `example.html`, the runtime and all assets):
- textures: KTX2 (ETC1S colour, UASTC masks), stay compressed on the GPU
- geometry: quantised (16-bit skin weights: 8-bit flattens tail roots) + meshopt
- clips: resampled (redundant keys dropped) + meshopt
- wearables keep full-precision positions (they re-bind to the dog's skeleton)

Runtime: every breed shares one coat shader program (channel layout in uniforms), dogs
with no markings skip the markings pass, and the tail floor guard only runs on pose clips.
`bench.html?n=30[&mobile]` measures it: 30 dogs = 52 draw calls, 39k triangles, 2 shader
programs, 0.46 ms of animation CPU per frame (desktop), 10 MB of coat textures on the GPU.

## Wearables

`rigged/wear/<breed>--collar.glb` and `--bandana.glb`: fitted to each dog (wear_lib.py,
built by rig.py) and skinned to the same skeleton, so they follow every clip.
`attachWear(dogScene, wearScene)` (dogclips.js) binds them to a dog; they swap on and off
independently. The collar is a thick rounded strap with a D-ring and a tag (materials
`collar`, `tag`: set their color). The bandana is thick cloth: a rolled band, a knot at
the back and a triangle hanging in front of the chest. One shared pattern texture
(`rigged/wear/cloth.png`: dots, gingham, stripes) and `tintCloth(material, patterns,
colorA, colorB, 'dots')` (dogcoat.js) give any color and pattern for free.

Fitting: the collar sits on the narrowest slice of the neck that stays on neck (not
head) and passes under the mouth, tilted toward level when the neck is buried in a ruff
(Pomeranian). The bandana's triangle falls from the band and is pushed out of the body.

## Props

`props/`: 41 toys, beds and pet-care items in the same style, sized to the dogs
(`props.csv` height, in the same units as the dogs: a medium adult is 0.85 tall), each
tagged `basic` / `standard` / `premium` (`tier`):

- beds: old towel, cardboard box (basic); pillow, blanket, donut, crate, dog house
  (standard); bolster, dog sofa, wooden frame bed, teepee (premium)
- toys: stick, knotted sock, plastic bottle (basic); balls, rope toys, squeaky bone,
  frisbee, plushes, tug ring (standard); leather ball, puzzle toy, plush fox (premium)
- care: tin dish, margarine tub (basic); floor bowl, water bowl, brush, bags...
  (standard); raised feeder, water fountain (premium)

The floor bowl comes in three states: `floor-bowl--empty.glb`, `--food.glb` (kibble
mound) and `--water.glb` (`bowl_states.py` measures the inside of the bowl and fills it).
Same pipeline as the dogs: `gen_concepts.sh`, `gen_models.sh`, `optimize_all.sh`
(600 tris for toys, 800 care, 1,200 beds, 1,500 house and crate).
`props/contact-sheet.png` shows them; the park's Props button lays them out.
