# Dog pack — breeds and body types

The full list lives in [`breeds.csv`](breeds.csv): **415 breeds** (the FCI/AKC
lists, plus regional, wild and designer dogs, and a "Mixed Breed" wildcard),
each tagged with a body type, size, ears, tail, coat and a stereotypical look:
`base` coat colour, up to three `layers` (`pattern:colour|pattern:colour`,
painted in order) and `nose`. Colours are names (`tan`, `liver`, `sable`...)
mapped to hex in `kit/index.html`, which reads the CSV directly to build the
labelled gallery. This page summarises it.

## How breeds share a body

A **build** is one parameter set for the shared base dog (same topology,
rig and UVs), so a build only exists when the *silhouette* is different. Everything
else is cheap and per breed:

- **Size** is just scale. A Miniature Pinscher is a small Doberman, a
  Pomeranian a tiny spitz, a Sheltie a small Collie.
- **Ears, tail and coat** are swappable parts (see below).
- **Colour** is the base coat + up to 3 pattern layers + nose.
- Optional per-breed **stretch** (length/girth/height ±15%) separates close
  cousins on one build, e.g. Dachshund vs Basset, Whippet vs Greyhound.

## Builds (21)

| Build | Breeds | Silhouette | Examples |
|---|---:|---|---|
| **scenthound** | 67 | sturdy, level back, long drop ears | Beagle, Foxhound, Bloodhound, Coonhounds |
| **lean** | 43 | square, short coat, long legs, moderate tuck | Doberman, Min Pin, Dalmatian, pointers, Weimaraner, Great Dane, Basenji, Xolo |
| **spitz** | 40 | compact square, thick neck, wedge head | Husky, Shiba, Akita, Samoyed, Pomeranian, Chow, Keeshond |
| **shepherd** | 32 | athletic, sloped back, wedge head | German Shepherd, Malinois, Border Collie, Aussie, Sheltie, Cattle Dog |
| **mountain** | 32 | big, heavy-boned, balanced head | Bernese, Rottweiler, Newfoundland, Great Pyrenees, Leonberger |
| **terrier** | 29 | square, leggy, flat skull | Jack Russell, Fox Terrier, Airedale, Schnauzers |
| **sighthound** | 22 | deep chest, extreme tuck, long thin legs | Greyhound, Whippet, Italian Greyhound, Saluki, Borzoi, Afghan |
| **gundog** | 19 | solid medium, otter/plume tail | Labrador, Golden, setters, Toller |
| **poodle** | 18 | elegant square, curly coat | Poodles, water dogs, Lagotto, Bedlington, doodles |
| **spaniel** | 15 | compact, domed head, long ears | Cocker, Springer, Cavalier, Brittany |
| **mastiff** | 15 | massive, wide short muzzle, jowls | Mastiff, Cane Corso, Dogue de Bordeaux, Saint Bernard, Shar-Pei |
| **shaggy** | 15 | barrel body hidden under coat | Old English Sheepdog, Puli, Komondor, Bouvier |
| **toylong** | 14 | tiny, low, coat to the floor | Shih Tzu, Maltese, Yorkie, Havanese, Bichon, Pekingese |
| **lowterrier** | 11 | short legs, deep body, beard | Scottie, Westie, Cairn, Skye, Dandie Dinmont |
| **bully** | 11 | muscular, broad chest, wide head | Pit Bull, Staffy, American Bulldog, Boxer, Dogo |
| **longlow** | 10 | very long body, very short legs | Dachshund, Basset, PBGV |
| **brachy** | 8 | small, cobby, flat face | Pug, French Bulldog, Boston Terrier, Brussels Griffon |
| **toy** | 6 | tiny, apple head, fine legs, big eyes | Chihuahua, Papillon, Chinese Crested |
| **corgi** | 4 | low herder, normal-length body | Pembroke, Cardigan, Vallhund |
| **bullterrier** | 2 | egg-shaped head (signature) | Bull Terrier, Mini Bull Terrier |
| **bulldog** | 1 | low, wide, rolling (signature) | English Bulldog |

`bullterrier` and `bulldog` exist only because they're iconic silhouettes; in a
collecting game those are worth a build each. `Bedlington Terrier` is flagged as
a candidate third signature (lamb look).

## Parts library

| Part | Variants (breeds using it) |
|---|---|
| **Ears** (8) | drop (177), prick (101), long/pendulous (62), button (28), rose (26), tipped/semi-erect (12), bat (7), butterfly (1) |
| **Tails** (10) | sabre (176), curl over back (62), carrot/upright (45), whip (41), plume (33), bob/docked (32), sickle (14), otter (4), screw (4), pom-pom (3) |
| **Coats** (11) | smooth = none (198), feathered (63), wire (47), ruff (39), curly (22), long (18), shaggy (13), hairless (4), poodle clip (4), puff (3), corded (3) |
| **Extras** | jowls/wrinkles, beard + brows, topknot, crest tufts |

Coats are geometry shells over the body (ruff = mane + trousers, feathered =
fringes on ears/legs/tail/chest, wire = beard and brows, etc.), skinned to the
same rig.

## Patterns still needed

The current 9 masks (saddle, tuxedo, face mask, tan points, piebald, spots,
ticking, merle, brindle) cover most breeds. To cover the list fully, add:
blanket (Beagle), harlequin (Great Dane),
sable shading, speckle (Cattle Dog), collar/Irish white (Collie), blaze, socks,
spectacles (Keeshond), dorsal ridge (Ridgebacks).

## Suggested build order

By breed count, 8 builds (scenthound, lean, spitz, shepherd, mountain, terrier,
sighthound, gundog) already cover 68% of the list. For a collecting game,
**popularity** matters more, so I'd start with:

1. **Wave 1, iconic first:** shepherd, gundog, spitz, terrier, brachy, toy, corgi, lean. That covers
   Lab, Golden, German Shepherd, Husky, Shiba, Frenchie, Pug, Chihuahua, Corgi,
   Doberman, Dalmatian and Jack Russell.
2. **Wave 2, volume:** scenthound, sighthound, mountain, spaniel, poodle, bully, longlow, lowterrier.
3. **Wave 3, the rest and signatures:** mastiff, shaggy, toylong, bulldog, bullterrier.

## Shipping: the asset library pack (Facet Fauna: Dogs)

The pack ships to the RUN asset library as one `3D/characters` leaf:

- `breeds/`: the ready-made breeds listed in `ready.txt` (at least one per
  build), each one self-contained skinned GLB with the coat baked into a
  512-texel texture and every clip. Baked by `scripts/build_breeds.py --ready`
  into `kit/breeds/` (generated, not committed); view them with
  `kit/breeds.html`.
- `kit/`: the parts (`dog_build_*`, `dog_head_*`, `dog_ear_*`, `dog_tail_*`,
  `dog_wear_*` with only the collar and bandana, pattern masks) and
  `kit/dogkit.js`, the three.js helper that makes any breed in `breeds.csv` or
  a cross of two (`kit/example.html`). Its breed table and catalog are written
  in by `build_breeds.py`; `kit/catalog.json` comes from `scripts/catalog.mjs`.

Optimisation: every export is slimmed (`scripts/slim.py`: redundant animation
keys dropped, weights and tag colours as bytes), then `scripts/package.mjs`
writes the leaf with every GLB meshopt-compressed, normals and colours
quantized, animation rotations as 16-bit integers (171 MB -> 77 MB).

    npm install
    python3 scripts/build_breeds.py --ready
    node scripts/package.mjs <jam-ready-assets>/run-facet-fauna-dogs/3D/characters

`kit/promo.html` is the library cover scene (screenshot at 1024 x 768).
