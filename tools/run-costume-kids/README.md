# RUN costume kids

96 chibi "Bobble" kids for a Halloween dress-up game: one shared body with a
giant rounded-cube head, mitten hands and stub legs, and a costume built on
top of it. Each costume is a Blender script made of plain rounded primitives
(no sculpting, no textures). Every kid is rigged to a small toy rig and
animated with 22 clips, and a web previewer shows them all moving at once.

```
concepts/            the kid body (bobble.py), the primitives (blockout.py) and the art brief
  wardrobe.py        the regular kids' swappable hair, faces, tops, bottoms, shoes and props
  costumes/<slug>.py one costume per file; renders in costumes/renders/
  costumes/archive/  earlier versions of redesigned or cut costumes
rig/                 the toy rig, the clips, the GLB exporter and the tests
previewer/           the web previewer and the exported GLBs (previewer/chars/)
  kit/               the avatar kit: base.glb, one GLB per wardrobe item, kit.json, kidkit.js
neighborhood/        houses, the house parts kit, cars, street props and candy
promo/               the Boo Brigade trailer (SCRIPT.md)
scripts/compress.mjs the compressed shipping copies of every GLB
```

## The avatar kit

The ten regular kids (`concepts/costumes/kids.py`) aren't fixed characters: each is a
look made from the wardrobe in `concepts/wardrobe.py`. A look is a skin tone and one
item for each of six slots:

| slot | items |
| --- | --- |
| hair | crop, anime, swoop, quiff, mohawk, afro, cloud, puffs, braids, ponytail, long |
| face | none, freckles, round glasses, square glasses, plaster |
| top | tee, stripy, hoodie, jersey, cardigan, tube top, raincoat, band tee, sweater vest, puffer, sweater |
| bottom | pants, jeans, joggers, shorts, skirt, tutu, overalls |
| shoes | sneakers, classic, high-tops, wellies, boots |
| prop | none, bucket, full bucket, sack, flashlight, lollipop, wand, teddy |

Any top goes with any bottoms. The layers never touch: bottoms hug the waist, tops sit
over them, and the overalls' bib sits over a regular top. Outer tops (the raincoat, puffer
and sweater) hide the bib. Each item paints up to four channels (main, trim, accent and
detail) that a game can recolour freely. It also has a few named colourways. The props
go in the left mitt, which leaves the right one free for the waving and eating clips. The
costume kids are not part of the kit: each costume is one fixed piece.

`rig/export_kit.py` exports the kit to `previewer/kit/`:

- `base.glb`: the skeleton, all 22 clips, and the plain kid (head, face and expressions,
  skin body);
- one GLB per item, on the same skeleton;
- `kit.json`: the catalog, colourways and the ten ready-made looks.

The clips are baked once on a stand-in kid wearing the longest hair, the widest skirts,
the longest coat and the full bucket, all at once. That way every combination stays off
the floor and inside its skirt. `previewer/kit/kidkit.js` assembles a kid in three.js: it
merges the pieces into one skinned mesh with one material (one draw call per kid), and
recolouring is a uniform change. Any GLB in the kit also opens in a plain glTF loader,
in its first colourway.

```js
import { loadKidKit } from './kit/kidkit.js';
const kit = await loadKidKit('kit/');
const kid = await kit.makeKid(kit.looks['kid-spiky']);    // or kit.randomLook(), or your own
scene.add(kid.object);
kid.play('walk');
await kid.wear('top', 'raincoat', 'red');                 // swap an item (a colourway or colours)
kid.paint('top', 'main', '#3a7bd5');                      // recolour one channel
kid.setSkin(4);
// every frame: kid.update(dt)
```

```bash
$BLENDER -b --factory-startup -t 1 --python rig/export_kit.py -- "$PWD/previewer/kit"
$BLENDER -b --factory-startup -t 1 --python rig/scrub_kit.py -- [layers|hair|props|feet]   # fit test
# http://127.0.0.1:5205/avatar.html     the kid builder (and a crowd of random kids)
# http://127.0.0.1:5205/kit-check.html?set=layers&clip=run&t=0.12   frozen grids for checking fits
```

Pass the export an absolute path: the rig scripts run from inside Blender.

## Art rules

The full brief is [concepts/BRIEF.md](concepts/BRIEF.md). In short:

- **Same head.** Every kid has the same giant head, the same size and in the
  same place. A costume can hide it under a hood or helmet, but it can't
  shrink it. The blank base kid is `concepts/costumes/mannequin.py`.
- **Big headwear.** Silhouettes come from exaggerated hats, crowns and hair.
- **No porthole faces.** No small face in a hole in a big costume.
- **Held props only.** Nothing loose on the ground and nothing floating
  beside the kid. Props are held in a mitt or worn.
- **Opaque materials only.** No transparency and no glass.
- **Skin colour.** Kid skin is drawn in `bobble.SKIN`, so it can be swapped
  for any skin tone.

## Commands

Set `BLENDER` to a Blender 5.x binary. Run these from this folder.

```bash
# render one costume: 3/4, front and side views plus a sheet, into concepts/costumes/renders/
$BLENDER -b --factory-startup --python concepts/costumes/witch.py -- concepts/costumes/renders
python3 concepts/costumes/fitcheck.py witch          # the base kid's outline over the costume

# export the animated GLBs for the previewer (all kids, or name some)
$BLENDER -b --factory-startup --python rig/export_glb.py -- previewer/chars [<slug> ...]

# scrub test: every kid, every clip, 16 moments each
$BLENDER -b --factory-startup --python rig/scrub.py -- [<slug> ...]

# pieces a costume forgot to tag; a render of the kid coloured by rig part
$BLENDER -b --factory-startup --python rig/untagged.py -- [<slug> ...]
$BLENDER -b --factory-startup --python rig/anchors_view.py -- /tmp/anchors <slug>

# previewer: http://127.0.0.1:5205/
python3 -m http.server 5205 --bind 127.0.0.1 -d previewer
```

The cast list is `rig/slugs.txt`.

## Shipping

The GLBs in `previewer/` and `neighborhood/glb/` are the working copies.
`scripts/compress.mjs` writes the copies a game should load: meshopt-compressed,
with normals and colours quantized, clip tracks that only hold the rest pose
dropped and rotations stored as 16-bit. That takes the 96 kids, 234 house parts
and 54 props from 103 MB to 24 MB. `--verify` samples every clip of every kid,
old file against new: the worst difference is 0.004°.

```bash
npm install
node scripts/compress.mjs <out dir>            # <out>/kids, <out>/houses (+ manifest.json), <out>/props
node scripts/compress.mjs --verify <out dir>
```

A game loading them needs the meshopt decoder:
`loader.setMeshoptDecoder(MeshoptDecoder)` from
`three/examples/jsm/libs/meshopt_decoder.module.js`.

## Trailer

[promo/SCRIPT.md](promo/SCRIPT.md) covers the shots and how to render. After
`promo/render.sh`, `promo/release.sh` writes `promo/release/`, which is committed
(through LFS), unlike the working frames in `promo/frames/` and `promo/out/`:

- `boo-brigade-trailer.mp4`, 21 MB, H.264 with fast start and the cover embedded as its thumbnail;
- `boo-brigade-trailer-cover.jpg`, the end card (the title over the crowd at 44.8 s), 1080 × 1920;
- `boo-brigade-trailer-cover-square.jpg`, a 1080 × 1080 crop of the top of it.

## The rig

Every piece a costume builds is tagged with the rig part it rides on, using
`with part("..."):` (see [concepts/BRIEF.md](concepts/BRIEF.md)). A held
prop is one block, so it always moves as a whole. `rig/untagged.py` lists
any piece that was missed.

`rig/toyanim.py` builds each kid with no skinning. Every piece is attached
rigidly to one part of a 14-part toy rig:

- the root, hips and chest
- the head
- an arm and a mitt on each side
- a held prop on each side
- a leg and a foot on each side

Tags always win. For anything untagged, the rig falls back to guessing
from position and colour, using rules that came from art review:

- **Head.** Anything inside the standard head box, or on top of the head,
  goes with the head.
- **Decorations.** Stripes, buttons and trims follow the piece they sit on.
- **Orphans.** A piece that only touches other body parts joins what it is
  attached to.
- **Held props.** They hang from a grip in the mitt and swing a beat behind.
- **Rigid costumes.** Costumes that surround the head (the taco, the rocket,
  the wizard's beard) move as one block.
- **Overrides.** A few costumes have their own rules, in `OVERRIDE`.

There are six clips: idle, walk, run, jump, pick-up and celebrate. Each clip
is a function of time. `rig/export_glb.py` bakes them at 30 fps, one glTF
animation per clip. At every frame a floor guard stops anything from going
through the ground: a long robe makes the kid crouch less, and an arm holding
a bucket swings out until the bucket clears the floor.

`rig/scrub.py` checks the result in every clip. It flags three things:

- a piece that separates from everything it touched at rest;
- a piece that goes below the floor;
- a piece that pokes into a big piece of another part, deeper than it sits
  at rest. A piece hidden entirely inside a costume doesn't count.

The current cast has no detached or sinking pieces. Three small pokes
remain:

- the angel's bucket brushes her robe hem in the run;
- Cleopatra's feet rise inside her closed dress in the run, which doesn't
  show.

`rig/rig_all.py` also has the older experiments that put the kids on the
Pirate Nation and KayKit skeletons. Those read their rigs from
`JAM_ASSETS_DIR`, which defaults to `~/Documents/GitHub/jam-ready-assets`.
