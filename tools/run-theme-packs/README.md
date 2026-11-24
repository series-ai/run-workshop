# Theme packs

Four 3D asset packs for the weekly RUN jam themes. Each one ships as its own pack.

| Pack | Theme week | Folder |
|---|---|---|
| Glowdrop Critters: bioluminescent collectibles | Glow (Nov 4) | `glowdrop/` |
| Caravan Kingdoms: Civilization-style mini Silk Road | Silk Road (Nov 11) | `caravan-kingdoms/` |
| Bolt-On Racers: modular mini vehicles | Full Throttle (Nov 18) | `bolt-on-racers/` |
| Harvest Haul: crops, pumpkins, gourds, cornucopias | Harvest (Nov 25) | `harvest-haul/` |

Everything is built procedurally in Blender from plain geometry, with no AI-generated meshes or textures. The concepts use the same method, so a concept board shows what the shipped kit will actually look like.

## Shared look

- **Chunky, small and cute.** Use low-poly facets, flat shading and soft rounded silhouettes. Shapes should be fat and simple, readable at thumbnail size, and toy-like.
- **Low segment counts.** Lathes and cylinders use 6–12 sides and spheres use 8×6. The facets are the point: never smooth-shade.
- **Flat colour per part.** Use no textures. Each pack has one small palette, and saturated colours sit on soft neutrals.
- **Glow** (Glowdrop, plus lanterns and lights in other packs): emit on accents (spots, rims, lures, bellies, tips) at strength 1–1.5. A whole glowing body (a jellyfish bell) goes at 0.4–0.8. Use `{"dark": True}` boards.
- **Faces** only on Glowdrop critters and mushrooms (Animal Crossing collectible charm), via `face()`. The other packs stay face-free unless it's a character (racer drivers, merchants).
- **Ground at z = 0, front faces -y.** The camera looks from front-right at about 30° down. Turn faces about 25° toward +x so they read.
- **Mix and match.** Parts share named snap points. Concepts show the parts catalogue *and* combos made only from those parts.
- **Growth stages** share a base footprint, so they swap in place. A board row with shared scale shows the true size change.

## Concept workflow

```
cd tools/run-theme-packs/<pack>/concepts
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -t 1 --python <pack>.py -- renders [board-prefix ...]
python3 ../../shared/board.py renders [board-prefix ...]   # writes renders/<slug>.png + /tmp/tp-<slug>.jpg
```

`shared/kit.py` is the toolkit. It provides `box`, `cyl`, `cone`, `ell`, `lathe` (revolve a profile, with `lobes` for ribbed pumpkins and domes), `torus`, `loft`, `tube` (spline tube), `slab` (an extruded 2D outline), `blade` (leaf, petal or fin), `face` and `ring_of`. It also has the `at(loc, rx, ry, rz, s)` transform context for composing parts, and `run(BOARDS)`. Rows share scale by default. `{"shared": False}` frames each cell on its own, and `{"note": "..."}` adds a subtitle.

Battery: always run Blender with `-t 1`. Run one Blender at a time per pack, and limit it to a few in parallel even when plugged in.
