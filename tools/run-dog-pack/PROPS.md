# Dog pack — props & wearables

Procedural props for the faceted dogs: built from code in Blender like the dogs
themselves, flat shaded with chamfered edges, in a Scandi palette (pale oak,
warm whites, oatmeal, muted sage / dusty blue / terracotta / mustard) that is a
little cartoony but not too much.

## Build

```bash
B=/Applications/Blender.app/Contents/MacOS/Blender
# Props: ~2 s for all of them. Pass ids to rebuild only those.
$B -b -t 1 --factory-startup -P scripts/build_props.py -- kit/props [id ...]
# Wearables: fitted to the finished dog builds, so run after build_dog.py (~1 s per build).
$B -b -t 1 --factory-startup -P scripts/build_wearables.py -- kit/builds kit/wearables [build ...]
```

Preview (serve the pack root, the viewers load `../breeds.csv`):

```bash
python3 -m http.server 8811 --bind 127.0.0.1   # from tools/run-dog-pack
```

- `kit/props.html` — opens on the **house**: a small furnished one-storey house with a garden, every room
  cut away (interior walls at 1.1 m, `?cut=0` for full height, `?front=1` adds the front wall). Then every
  category (`?view=toys|food|beds|bedding|home|wear|agility|furniture|living|plants|bedroom|kitchen|bathroom|hall|house|all`),
  one prop close up (`?id=sofa`), and wearables on any builds (`?wear=corgi,pug&items=collar,harness&coat=ruff`).
- `kit/index.html` — the dog gallery: **Wear** checkboxes in the panel, a toy picker next to the toy box.
  URL options: `?wear=harness,bags,collar` and `&toy=1&toyKind=bone_toy` (also work in `?review=` sheets).

## Conventions

- **Units:** metres, at real-ish sizes for a medium dog's world. **+X** is the prop's front (the way the dogs
  face), +Z up in Blender (Y up in glTF), and the origin is on the floor under the middle of the prop.
- **Materials:** one palette material per colour, named (`oak`, `sage`, `linen`…). A game can recolour a prop
  by material name. Cloth is double-sided (`linen@2s`). There are no textures or UVs.
- **Carried toys** have a `socket_grip` node: the point the mouth holds. Its axes match the mouth's (+X out of
  the mouth, +Y across it, +Z up), so to hold a toy, put `socket_grip` on the head's `socket_mouth`. Toys stay
  real size on every dog.
- **Manifest:** `kit/props/props.json` lists `id, label, category, attach, tris, size, holdable, materials`.
  `attach` is `floor`, `wall`, or `<wearable>.<socket>` for add-ons.

## Wearables (skinned, per build)

`kit/wearables/<build>.glb` holds the build's skeleton plus one skinned mesh per item:

| Item | Notes |
|---|---|
| `collar` | band round the upper neck, buckle, D-ring under the throat |
| `bandana` | neck band, triangle draped over the chest, knot at the nape |
| `harness` | Y-front: neck loop, girth strap behind the elbows, back and chest straps, padded saddle |
| `vest` | cut from the dog's own torso surface (neck base to mid back), piped edges |
| `sweater` | torso surface from mid neck to the loin, knit stripes, rolled turtleneck |

- Vertices are in the dog's bind space and the bone names match, so bind each mesh to the dog's own skeleton
  by bone name (the viewer remaps `skinIndex` and calls `bind`). Weights are copied from the nearest torso
  vertex, so the wearables follow every clip.
- **Coat refits:** `<item>@<coat>` (e.g. `harness@ruff`) is fitted over that coat shell. Use it when the dog
  wears the coat. Otherwise use the plain item.
- **Sockets:** empties named `socket_<item>.<point>` (e.g. `socket_harness.leash`, `socket_harness.pack_L`,
  `socket_collar.tag`). They're placed in dog space at rest, with `extras.bone` set; parent them to that bone,
  keeping the rest transform.
  - collar: `tag`, `leash`
  - harness / vest: `leash`, `back`, `pack_L`, `pack_R`
- **Add-ons** (in `kit/props/`) have their origin on the socket they hang from and are sized for a 0.72 m dog.
  Scale them by `dog length / 0.72` so they grow with the dog: `saddlebag_L/R` → `pack_L/R`,
  `backpack_mini` → `back`, `tag_round|bone|heart` → `collar.tag`.
- Materials are named by role for tinting: `collar`, `bandana`, `bandana_trim`, `strap`, `pad`, `vest`,
  `trim`, `knit`, `knit_stripe`, `hardware`.

## What's in it (162 props)

| Category | Props |
|---|---|
| Toys (16) | tennis ball, rubber ball, spiky squeaky ball, rubber bone, rope tug, rope ring, frisbee, stick, treat stuffer, chew ring, antler chew, chewed slipper, plush duck, plush fox, plush hedgehog, squeaky carrot |
| Food & water (15) | bone biscuit, food bowl (empty / full), water bowl, steel bowl, raised feeder, bowl mat, treat jar, kibble bag, spilled kibble, meaty bone, chew stick, dental chew, open food tin, food scoop |
| Beds (8) | donut, bolster (sage / blue), pillow, raised cot, cave, wicker basket, crate |
| Blankets & towels (10) | blanket laid out, rumpled blanket, folded blankets, chunky knit throw, towel laid out / rolled / folded, throw pillows (mustard / blush), washable mat |
| Dog things (6) | dog house, toy basket (with toys), fire hydrant, leash post, leash hook rack, coiled leash |
| Harness add-ons & tags (6) | saddlebags L/R, mini backpack, tags (round / bone / heart) |
| Agility (8) | bar jump, tire jump, weave poles, tunnel, A-frame, seesaw, pause table, training cone |
| Living room (12) | sofa, armchair, coffee table, side table, dining table, dining chairs (oak / painted), bench, sideboard, round rug, striped rug, floor lamp |
| Living extras (8) | bookshelf (filled), TV & stand, wall shelf, knitted pouf, floor cushion, pendant lamp, framed print, vase & flowers |
| Plants (7) | fiddle-leaf fig, monstera, snake plant, olive tree, cactus, succulent bowl, trailing pothos |
| Bedroom (8) | double bed, single bed, nightstand, table lamp, wardrobe, chest of drawers, desk, leaning mirror |
| Kitchen (11) | cabinet, drawers, sink, stove & oven, fridge, wall cabinet, open shelf, mugs, kettle, fruit bowl, stool |
| Bathroom (7) | bathtub, toilet, vanity & basin, round mirror, towel ladder, bath mat, laundry basket |
| Hall (3) | shoe bench, coat stand, door mat |
| Bushes & trees (16) | round / small / flowering bushes, lavender, hedge (1 m), evergreen shrub, birch, pine, apple tree, tree with rope tug, stump, fallen log, boulder, stones, grass tuft, wildflowers |
| Fences, gates & yard (13) | fence post, picket fence, low border fence, slatted fence, garden gate, gate arch, grass / stone path / deck ground tiles, paddling pool, dig pit, garden bench, garden tap & hose |
| Walls, doors & floors (9) | wall 1 m / 0.5 m, wall with doorway, wall with window, door, front door, oak floor, tiled floor |

## House kit

- **Grid:** walls are 1 m pieces, 0.1 m thick and 2.6 m tall, centred on the grid line and running along Y, with
  skirting on both faces. Rotate 90° for walls running along X. Floors are 1 × 1 m tiles.
- **Doorways:** the opening is 0.82 × 2.1 m. The `door` / `front_door` origin is the hinge at the floor, matching
  `socket_hinge` on `wall_door`, and the leaf runs along +Y, so rotating about Z swings it open.
- **Kitchen:** modules are 0.6 m wide and 0.62 m deep, with the worktop at 0.9 m. Line them up against a wall
  at 0.36 m from the wall's grid line.
- **Wall-mounted pieces** (wall cabinet, open shelf, wall shelf, print, round mirror) keep the floor-origin
  convention with their height built in. Their back is at x = −0.31, so they share placement with the 0.62 m
  kitchen modules.
- **Fences** use the same 1 m grid. A piece runs along Y with its post at the −Y end only, so runs tile without
  doubled posts; finish a run with `fence_post`. The `fence_gate` origin is its hinge (the leaf runs +Y, 0.88 m),
  and `gate_arch` straddles a 1 m opening.
- The layout in `kit/props.html` is a worked example of placing everything on the grid. The `put(...)` calls
  build the house, and the `fence(...)` calls build the fenced dog yard: deck, path, gated arch, agility
  course, pool, dig pit, and bushes and trees round the edge.

## Known issues / next

- Long coats (feathered, shaggy) poke through the sweater and vest in a few places.
- Over the ruff coat the bandana's tip juts forward. It should drape over the ruff instead.
- No leash line yet: `socket_*.leash` is ready for a rope or line renderer in the game.
- Props have no LODs. The heaviest are under ~1.5k tris (toy basket, treat jar, raised feeder).
