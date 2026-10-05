# run-voxel-packs

Authoring pipeline for the four RUN voxel asset packs (fantasy, space,
monster, post-apocalypse) that interchange with the Pirate Nation (PN) pack in
`jam-ready-assets`.

## Commands

```bash
npm install
npm run gen:rig            # contracts/avatarRig.generated.ts + data/rig.generated.json from the PN avatar
npm run body-ref           # out/cache/pn-body-ref.npz (build-time fitting guide; never shipped)
npm run build:pack -- --pack fantasy [--only <substring>]   # Blender → out/jam-stage/<pack dir>/…
npm run validate -- --pack fantasy --level asset|slice|content|release   # or --all
npm run ui -- --all        # themed UI tiles → out/jam-stage/<pack dir>/ui/
npm run pack-sheet -- --pack monster --category props [--clip open@0.5]      # review sheet
npm run avatar-sheet -- --pack monster --mode parts|skins|held               # on the PN body
npm run stage -- --target <jam-ready-assets checkout> [--packs fantasy,space]  # licences + previews
npm run catalog            # games/run-voxel-showcase/public/catalog/{index.json,<pack>/catalog.json}
npm run snapshot -- --out sheet.png [--clip open@0.5] [--clip-from other.glb] a.glb …   # dev contact sheet
npm run lineup -- --out lineup.png <rvx id | pn:<file stem> | a.glb> …   # native-scale lineup next to a person gauge
# previews and icons come from the showcase: (cd ../../games/run-voxel-showcase && npm run thumbnails -- --pack fantasy [--icons])
npm test                   # unit tests;  npm run test:integration  needs a built fantasy pack
```

Blender 5.1 runs headless (`BLENDER_BIN` overrides the path). The PN pack is
read from `~/dev/jam-ready-assets` (`JAM_ASSETS_DIR` overrides it).

## Contracts (`contracts/`)

One source for the pipeline and the showcase. Data the Python side also reads
is JSON under `contracts/data/`.

| Rule | Value |
|---|---|
| World assets | 1 unit per voxel, Y up, face −Z, base on y = 0, centred on x/z |
| Rig assets (parts, skins) | PN rig space: 0.01 units per voxel, face +X, 16 PN joints |
| Held items | PN `Hand.R` joint frame at T-pose: +X thumb/forward, +Z along the arm, +Y back of hand; origin = the joint (palm 3 voxels out) |
| Material | one `palette` material, NEAREST/NEAREST, CLAMP, metallic 0, roughness 1: world assets use a painted atlas PNG (1 texel per unit); avatar-space assets use the shared 256×1 palette PNG (32 ramps × 8 shades) |
| Prop clips | node-hierarchy TRS: `idle open close active hit attack death move spin` |
| Avatar clips | `NN_Name`; PN owns 00–31, fantasy 32–39, space 40–47, monster 48–55, apocalypse 56–63 |
| Part nodes | `<slot> <pack>-<n>` (PN keeps `<slot> <n>`); composition rules are per part (`AvatarPartRules`) |
| Part layers | each slot's faces sit a fixed distance (0.02–0.24 voxel, `data/avatar-layers.json`) out from the voxel grid, outer slots further out, so parts that cover one another (tops over bottoms, a face on the head, headwear over hair) never share a plane with each other or with PN parts and cannot z-fight; `blender/mesher.layered_mesh` builds it; the `avatar.layers` and `avatar.composite` rules check it (see Z-fighting checks) |

Licence: every leaf is under the RUN License (the RUN Repository
Supplemental License v1.0 in the repository's `LICENSE.md`, SPDX
`LicenseRef-RUN-Repository-Supplemental-1.0`); each staged leaf carries the
whole licence in its `License.txt`. Files that carry the PN armature (avatar
parts, skins, clips) ship in the `3D/characters` leaf, whose `License.txt`
also keeps the Proof of Play MIT notice for that armature data (a
Third-Party Material, `LICENSE.md` Section 8). No pack file carries a PN mesh
or clip.

## Scale standard (`contracts/data/scale.json`)

All packs share one world scale, matched to Pirate Nation (PN) by class: each
class range comes from the PN models of that kind (1 voxel = 1 world unit;
PN footprints use a 16-voxel tile, so a "6x6" building is 96 wide). Each
world asset has a scale class, listed in `assets/<pack>/scale-classes.json`
(or set with `Asset(scale=…)`); the `scale.class` rule checks its bounds:

| Class | Size (units) | PN reference |
|---|---|---|
| `building` | 60–150 tall, 66–180 long | workshop, townhall, tailor shop |
| `tower` | 85–170 tall, 28–72 wide | tesla coil, buoy |
| `vehicle` / `vehicle-large` | 60–110 long / 85–160 largest | skiff, boat, small and XL ships |
| `humanoid` | 28–44 tall | tiki statue, goblin totem |
| `prop` | 6–40 | chest 18, jack-o'-lantern 16–20 |
| `coffin` / `lamp` / `tree` | 16–26 / 40–64 / 30–100 tall | coffin 19, lamp 44–60, palm to spooky tree |
| `fence` / `kit` / `tile` | whole 16-unit tiles long | fence segment 16 |
| `creature-boss` | 150–280 largest | giant turtle, kraken |

Two more rules keep voxel size and proportion the same across packs:

- `scale.node`: no part may be scaled, so one voxel stays one unit (0.01 in
  avatar space) in every asset. Only finalize's own scales pass: the 1/n of a
  quantized mesh holder and its 1/16-voxel z-fight inset (within 10%).
- `scale.outlier` (pack level): an asset more than 3× larger or smaller than
  the median of its scale class in the pack (held items and skins: of their
  category). Scale classes bound absolute size; this catches drift inside a
  class, for example a rework that doubles a prop.

`sockets.placement` keeps effects on the model: every `socket-*` node must sit
within 10 voxels of a surface at rest. A socket built from absolute instead of
hinge-relative coordinates puts its smoke or dust in empty air. A socket for a
moving part (a drawbridge tip) follows that part (`parent`), so it is on the
surface at rest too.

## Authoring an asset

Each `assets/<pack>/<category>/<slug>.py` defines `build()` returning an
`Asset` (or a list). World assets use `blender/voxgrid.py` (`Grid`,
`Grid.prism` with `top=` for frustums, cones, pyramids and hip roofs,
`Part` with a rest `rot`, `Clip`, `Socket`) and the kit below; the export
centres them on their full bounds. Rig assets use `blender/rigkit.py` (body
regions, shells, `part_rules`); rigid skinning follows the PN joints
(`blender/rigspace.py`).

World assets are meshed by shape only and painted into an atlas at 1 texel
per unit (`blender/atlas.py`), so colour detail costs no triangles. Check
every asset by eye: `npm run review -- --pack <pack> --only <slug> --clips`
writes a sheet with four views, one frame per clip and a native-scale
lineup with PN references of its class.

## Kit (Pirate Nation style world assets)

World assets follow the rules in `docs/art-direction.md`: few big
volumes, true slopes, detail painted on flat faces. The kit in `blender/`
is shared by all four packs. Use it before you write a pack helper.

| Module | Use it for | Main functions |
|---|---|---|
| `pnkit.py` | Building parts on a face (`-z`, `+z`, `-x`, `+x`, `top`) | `on_face`, `face_prism`, `box`, `edges`, `gable_roof` (`trim`, `trim_shade`), `window`, `door`, `lancet`, `rose`, `shutters`, `awning`, `posts`, `beam`, `barrel`, `crate`, `pennant` |
| `pnshapes.py` | Faceted solids (true slopes) | `wheel`, `tyre`, `disc`, `drum`, `gear`, `gear_poly`, `pipe`, `bar`, `quad`, `rotate`, `arch`, `cone`, `pyramid`, `hip_roof`, `dome`, `spire`, `cross`, `skull`, `tombstone`, `pumpkin`, `banner`, `lantern`, `flame`, `facets`, `seams` |
| `pnglyph.py` | Painted pixel text and icons | `text`, `text_size`, `icon`, `icon_size`, `stamp`, `FONT`, `ICONS` |
| `paint.py` | Material painters | `planks`, `stone`, `tiles`, `thatch`, `plates`, `mottle`, `outline`, `grime`, `uv` |
| `pnpaint.py` | More material painters | `hazard`, `corrugate`, `concrete`, `fur`, `blotch`, `plated`, `glow_window` |

Rules of the kit:

- Shapes fill the grid, paint themselves and return the mask they added.
  `wheel` and `lantern` return a dict with the mask and their placement points.
- Round shapes are n-gons. `r` is the flat radius, so a wheel stands on a
  flat side exactly on `y0`.
- Painters take `frame=None`. Walls get a pattern that wraps corners, tops
  get straight rows. For a slope, paint each face with its own frame:
  `for m, fr in pnshapes.facets(g): paint.tiles(g, m, "red", 4, frame=fr)`.
- Text and icons are never mirrored. `u0, v0` is the lowest grid corner of
  the glyph box; the painter turns the glyph for the face.
- Colours are `(ramp, shade)` pairs, or a ramp and a `base` shade.

Pitfalls the authors found:

- Paint glyphs 2 deep (`depth=2`) on sloped faces and on faces that lie on
  half-voxel planes: the atlas samples the voxel half a unit behind the face.
- `paint.outline` on a mask thicker than one voxel paints its whole skin;
  pass `normal=` or paint a surface mask.
- A prism added later overwrites the colours of an earlier one it overlaps:
  add frames and rings first, then the core.
- Build a tilted sign as its own part with `Part.rot`; text painted on a
  tilted slab breaks up.
- Never copy `grid.a` into a new Grid by hand: use `crop`, `flip` or
  `rot_y`, which keep the prisms.
- In the review sheet's front 3/4 view, the `-z` face is on the right and the
  `+x` face on the left.

`python3 blender/test_atlas.py` meshes every kit shape (`kit_cases()`) and
checks budgets, wheels on the ground, glyph direction and top patterns.
`python3 blender/test_voxgrid.py` checks the clip key helpers: `turn` (a
constant spin, whole turns only) and `sway` (a sine loop that closes, for
hanging lanterns, bells, fronds and scanning dishes).

Keep big solids SOLID: the mesher only emits faces between filled and empty voxels, so a hollow interior adds hidden faces and file size. The validator also enforces a 1.5 MB per-GLB budget.

## Z-fighting checks

Z-fighting is two faces in one plane that overlap: the depth buffer cannot
order them, so the picture flickers between their colours as the camera or
the model moves. `npm run validate` scans for it at every level, so a new
pack gets the checks with no extra step:

| Rule | What it scans | How the build prevents it |
|---|---|---|
| `geometry.zfight` | Each GLB on its own: coplanar overlaps with different paint, not buried inside another solid and not on the ground. World assets and held items count every pair of parts (limit 1 voxel² per file); avatar files count the worst single part (a parts file shows one part per slot). | `finalize` moves the smaller of two fighting parts 1/16 voxel back (world assets, held items); atlas prisms get distinct plane offsets. |
| `avatar.layers` | Every face of every avatar part sits its slot's layer out from the voxel grid (`contracts/data/avatar-layers.json`). | `blender/rig.py` meshes parts with `mesher.layered_mesh`. |
| `avatar.composite` | Each pack's avatar parts worn on the PN bodies with the PN parts and every other staged pack's parts (`src/validate/composite.ts`): any two parts that can be on one avatar at once (`wornTogether`: different slots, no hide rule between them) must not share a plane. Needs the PN avatar (`JAM_ASSETS_DIR`) and the build metadata in `out/meta`. | The layers above. |

Each message names the node pair and a point (rig voxels for avatar space),
so a fight can be found in a viewer. When you add:

- a pack: nothing; `build:pack` layers its parts and `validate` scans them
  against every other staged pack.
- an avatar slot: give it its own value in `avatar-layers.json` (outer slots
  larger; keep away from 0 and 0.1, where PN parts sit).
- a composition rule (a new way one part hides another): add it to
  `wornTogether`, or the composite scan reports parts that never show together.

Not covered: faces that cross while an avatar or prop animates (the scans use
the rest pose), a held item against the hand, and models placed next to each
other in a scene. Painted one-voxel specks (`speck_rig`) shimmer at a
distance but do not flicker in place; a z-fight does.

The validator is the gate: every GLB must pass `--level asset`; the style
slice passes `--level slice`; authored content passes `--level content`
(counts: 95–105 GLBs, ≥20 animated world models, ≥30 parts, 6–8 clips, 6
skins, 16 held items); a staged pack passes `--level release` (plus previews,
≥40 icons, ≥40 UI tiles, one licence per leaf). Two clean builds are
byte-identical.

## Full release flow

A full pack build (no `--only`) first clears that pack's 3D leaves and build
metadata, so a removed or renamed source cannot leave a stale GLB; render the
previews again afterwards. Duplicate asset ids fail the build.

```bash
npm run build:pack -- --all && npm run validate -- --all --level content
npm run ui -- --all && npm run catalog
(cd ../../games/run-voxel-showcase && for p in fantasy space monster apocalypse; do
  npm run thumbnails -- --pack $p --force && npm run thumbnails -- --pack $p --icons --force; done)
npm run catalog
npm run stage -- --target <jam-ready-assets checkout>
npm run validate -- --all --level release --stage <jam-ready-assets checkout>
```
