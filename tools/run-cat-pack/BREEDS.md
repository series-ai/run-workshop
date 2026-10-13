# Facet Fauna: Cats — breeds and body types

Faceted, papercraft-style cats built the same way as the dog pack
(`tools/run-dog-pack`): the scripts are copied from it, not shared, so the
packs can diverge. [`breeds.csv`](breeds.csv) lists **84 entries**: the
recognised breeds (CFA / TICA), the common moggy colours, kittens and a
"Mixed Breed" wildcard. Each entry is tagged with a build, size, head, ears,
tail, coat, eye colour and a typical look: `base` colour, up to three `layers`
(`pattern:colour|…`) and `nose`.

## Builds (6)

Art direction: **"sleek cute"** (`concepts/singles/D-sleek-*.png`, picked from the four directions in
`concepts/00-directions.png`). Cats are their own creature, not reproportioned dogs:
- **Body:** a level back, straight column legs on small oval paws, and a short thick neck.
- **Head:** big and round, with a flat face: small dark eyes treated exactly like the dogs' (realistic
  proportions, nothing goofy), a tiny pink nose, a little smile and pink inner ears.
- **Tail:** thick, held up in an S.
- **Own skeleton and clips:** spine, neck, head, an eight-bone tail, four-bone legs, ear bones, breathing
  bones and an eyelid bone, with their own clips in `scripts/cat_anims.py` (see [ANIMATIONS.md](ANIMATIONS.md)).

There are deliberately few body types: cats vary much less than dogs. Most of the variety comes from heads,
ears, tails and how fluffy the coat is. Each build has a clearly different silhouette:

| Build | Breeds | Silhouette | Examples |
|---|---:|---|---|
| **domestic** | 16 | the everyday cat | Domestic Shorthair, American / European Shorthair, Manx |
| **cobby** | 16 | round and low: barrel body, short thick legs, big round head | British Shorthair, Persian, Exotic, Scottish Fold |
| **large** | 14 | big and square: long deep boxy body, flat back, heavy legs | Maine Coon, Norwegian Forest, Siberian, Ragdoll |
| **wild** | 28 | long and lean: long legs, tucked waist, long thin tail | Abyssinian, Bengal, Savannah, Siamese, Oriental, Sphynx, Rex |
| **munchkin** | 5 | an everyday cat on very short legs | Munchkin, Minskin, Bambino |
| **kitten** | 4 | big head, short body, legs and tail | any breed's kitten |

The body cross-section has a squareness setting (`box`): round for most builds, square for the Maine Coon.

## Parts

| Part | Variants |
|---|---|
| **Heads** (6) | domestic (modified wedge), round, wedge (Siamese), flat (Persian), pixie (Rex, Sphynx), lynx (Maine Coon) |
| **Ears** (7) | standard, round (rounded tip), large, small, fold (Scottish Fold), curl (American Curl), tufted (lynx tips) |
| **Tails** (7) | long, thin, plume, thick, curl (over the back), bob, stub (Manx). Built into the body and skinned to the tail bones, so they swish and curl. |
| **Coats** (7) | short (no shell), ruff (neck and chest mane), fluffy (medium all over), semilong (ruff, britches, belly fringe), long (full Persian coat), rex (wavy), hairless (skin colours) |
| **Eyes** | rendered dark like the dogs; `breeds.csv` keeps eye colour (blue, green, gold, copper, hazel, odd) as breed data |

## Patterns

The patterns follow cat colour genetics, so a breeding game can map genes
straight onto layers:

- **Region masks** (projected from the side, like the dog masks): points (colour-point / Siamese),
  bicolour, van, mitted, locket, harlequin, mackerel tabby, classic tabby, shaded / smoke.
- **Tile masks** (wrapped over the surface): spots, rosettes (Bengal), ticking (Abyssinian), tortie.
- **Colours:** black, blue, chocolate, lilac, cinnamon, fawn, red, cream and white; silver and golden;
  the tabby grounds (brown, ruddy, sepia); and skin tones for hairless cats.

Example combinations from the breed table: calico is `tortie:red|bicolor:white` on black, and a seal-point
Ragdoll is `points:seal|mitted:white` on cream.

## Mix and match / breeding

- **Every slot is independent:** build, head, ears, tail, coat, eye colour, base colour and the pattern
  layers. A child can inherit each one from either parent.
- **Bodies can be blended:** every build has the same topology and skeleton, so a child's body can be a
  vertex blend of its parents' builds, not just one or the other.
- Clips to add next: sit, loaf, lie down, sleep curled, groom, stretch, pounce, jump, knead, tail wrap.

## Build

```bash
B=/Applications/Blender.app/Contents/MacOS/Blender
python3 scripts/gen_patterns.py
$B -b -t 1 --factory-startup -P scripts/build_parts.py -- kit/parts      # ears
$B -b -t 1 --factory-startup -P scripts/build_heads.py -- kit/heads
for b in domestic cobby large wild munchkin kitten; do
  $B -b -t 1 --factory-startup -P scripts/build_cat.py -- $b kit/builds/$b.glb; done
python3 scripts/build_breeds.py      # ready-made breeds (no Blender), ~25 s
```

## Two ways to use it

- **Ready-made breeds** (`kit/breeds/<breed>.glb`, 83 files, about 0.85 MB each): one self-contained GLB per
  breed that works in any glTF loader.
  - **Built by** `scripts/build_breeds.py`.
  - **Mesh and skin:** head, eyes and ears are skinned to the skeleton.
  - **Coat:** baked into a per-triangle atlas by evaluating the recolour shader, so it matches the kit.
  - **Clips and size:** every clip is included, and the root is scaled to the breed's length in metres.
  - **Preview:** `kit/breeds.html` uses a stock loader and a standard material.
  - **Limitation:** tile patterns (spots, rosettes) can't be laid along the legs and tail, so those take the
    region layers only.
- **Mix-and-match kit** (`kit/catkit.js`): `loadCatKit(base)` loads the parts.
  - **`makeCat(breed or row)`** assembles any combination at run time. It uses a standard material with the
    pattern layers injected, so it's lit by the game's own lights.
  - **`breed(a, b)`** mixes two cats slot by slot.
  - **Example:** `kit/example.html`.
  - **Data:** parts and colours are in `kit/catalog.json`, and breeds in `kit/breeds.csv` (copied from
    `breeds.csv` by the bake).

Every export runs `scripts/slim.py`, which removes animation keys that interpolation already reproduces,
drops tracks that never move, and stores bone weights and tag colours as bytes. Each build is about 1.1 MB
(37 clips, all coats and tails).

Viewer: serve `tools/` and open `run-cat-pack/kit/index.html` (same controls as the dog gallery, plus eye
colour; `?review=idle&breeds=…&zoom=2` for review sheets).
