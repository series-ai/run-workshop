# Caravan Kingdoms: asset list (concept stage)

A Civilization-style miniature kit for the Silk Road jam week: hex tiles, boxy wargame-mini units, and cities that grow. Every piece is procedural Blender geometry: flat-shaded low-poly primitives with one flat colour per part. There are no textures, no downloaded assets and no AI meshes. The concepts are built with the same code the kit will use.

Concept source: `concepts/caravan.py` (boards) + `ck_base.py` (palette, hex grid, prisms, connectors), `ck_terrain.py`, `ck_city.py`, `ck_build.py`, `ck_units.py`, `ck_routes.py`, `ck_tiles2.py` (v2 full hex set). Boards: `concepts/renders/*.png` (v2). The round-1 boards are kept in `concepts/v1/` for comparison. The full-resolution map patch is at `concepts/renders/03-map-patch/00-00.png`.

> **Cultural-accuracy review required before shipping.** The four regional styles are stylised, generic forms (domes, iwans, wind-catchers, ribbed domes, tiered roofs, courtyards, arcades and ablaq striping). They use no religious symbols and no copies of real sacred buildings. Finials are plain gold balls and spikes. A reviewer with regional expertise should still check every style, the Bell Tower (pagoda-derived form), the costumes and the hats before release.

## Hex + grid spec

| | |
|---|---|
| Orientation | Flat-top hexes, `cyl(..., n=6)` default orientation |
| Size | Circumradius **1.0** (grid spacing). The mesh is drawn at **0.97** so neighbours show a hairline seam |
| Grid | Axial (q, r): `x = 1.5q`, `y = √3 (r + q/2)` |
| Edges | Edge k (0..5) has its midpoint at angle 30 + 60k° and distance 0.84 from the centre: 0 back-right, 1 back, 2 back-left, 3 front-left, 4 front, 5 front-right |
| Elevation | Tile top heights: low **0.22**, mid **0.42**, high **0.66**. The water surface is always **0.15** |
| Tile build | Dark foot stripe (0.04), earthy side band, and a 0.06 coloured top cap with a 0.025 chamfer. The band colour varies by type (earth, rock, red rock) |
| Snap | Decorators, units, goods and buildings sit at the tile-top centre `(0, 0, H)` and face -y |
| Scale | City parts are authored at 1:1 on the tile. Units placed on map tiles use `UNIT_S = 1.7` (camel trains 1.1). Trade goods sit on a 0.17-radius plinth and use 2.0 on tiles |

## 1. Terrain tiles: 20 types × 3 elevations = 60 tiles

desert, dunes, steppe, grassland, hills, oasis, river straight, river bend, river fork, river delta, lake, mountain, high pass (snowy), salt flat, red badlands (striped mesas), forest, bamboo, rice terraces, coast, sea.

- Elevation changes the column height. Mountains, passes and badlands also grow taller peaks, and mountains add snow at mid/high.
- **Water-like exceptions.** Sea uses shallows / sea / deep (colour) in place of height. Coast is beach / beach / cliff. The delta stays near sea level, with only a slight lift. A high lake becomes a rocky tarn.
- Rivers use the same edge-to-centre connector system as roads (`link(edges)`), with a sand bank and a water lip down the side band. Any edge set is valid, so straight, bend, fork and more are all data.

## 1b. Full hex set (v2): 82 tile cells, about 70 new tile types

Each category has its own board, all on the same hex. Every tile also takes the low / mid / high elevations where they make sense.

| Board | Tiles |
|---|---|
| 12 forests (8) | dense, sparse woods, pine, jungle, autumn, snowy pines, forest hills, bamboo grove |
| 13 ocean (9) | deep, open sea, shallows, coral reef, ice floes, kelp beds, fish shoals (sea resource), sea stacks, islet |
| 14 shore configurations (12) | 1, 2, 3, 4 and 5 (cove) contiguous land edges, strait (2 opposite), 3 points, 2 apart; cliff coast at high for 1–4 edges |
| 15 rivers (13) | straight, bend 120°, bend 60°, Y fork, branch left / right, arrow fork, 4-way crossing, source spring, lake mouth, waterfall over a cliff edge, ford (stepping stones + road), delta |
| 16 wild lands (12) | marsh, floodplain, tundra, snowfield, glacier, volcano (glowing lava), canyon, mesa, cliffs, cave entrance, ruins, red badlands |
| 17 highlands + resources (12) | mountain range with 1 / 2 / 3 peaks, high pass, iron hills, gem mountain, gold hills, marble crags, incense groves, wild horses, tea hills, salt flat |
| 18 farmland + oases (8) | farmland, pasture, vineyard terraces, rice terraces, tea hills, oasis pool, oasis palm grove, qanat oasis |
| 19 transitions (8) | grass > desert (1, 2, 3 edges), steppe > desert, grass > steppe, grass > snow, desert > salt, steppe > badlands |

How the pieces are built:
- **Shore tiles** are a sea tile with land pieces along the land edges: a trapezoid per edge, plus centre sectors when 3+ edges are land. Each piece gets a beach step, and split pieces have no chamfer so their joins vanish. Rotating 60° gives all six orientations of each configuration.
- **Transitions** paint the neighbour terrain along the chosen edges with a blobbed, irregular edge. Generated combinations are possible for any terrain pair.

## 2. Tile decorators: 11

rocks, scrub (tamarisk), poplars, date palms, mulberry trees, dune ripples, yurts (+ campfire), well, ruins, bones (camel skeleton), signpost. Each has a per-item scale in `DECOR`. Trees are round blobs on stubby trunks, scaled by the global `TREE = 1.4`.

## 3. Cities: 4 styles × 5 stages = 20 city tiles

Stages: **camp → village → town → city → capital**. All five sit on the same low hex, so they swap in place.

**Swappable-parts system.** Each style class implements the same part contract:

| Part | Notes |
|---|---|
| `house(0/1/2)` (+ alt) | Small / medium / large dwelling, footprint ≤ 0.22 |
| `block()` | District block of about 0.3 × 0.3 built from the style's houses (the Chinese block is a siheyuan courtyard) |
| `landmark(0/1/2)` | Town hall / city centrepiece / capital palace |
| `wall(L, h)` | Straight run along x, about 0.07 thick |
| `tower(h)` | Ring corner tower |
| `gate(L, h)` | Replaces one wall run; the opening faces outward |
| `tent()` | Camp shelter |

Stage layouts (`city()` in `ck_city.py`) only name slots: tents, houses, the landmark, district blocks, a wall ring on the hex (radius 0.84, gate on edge 4) and banners. So **any style drops into any layout**, and new styles only need the part contract.

| Stage | Contents |
|---|---|
| camp | 3 tents, campfire, sacks, 1 team flag |
| village | 5 houses, well, field, trees, track, 1 team flag |
| town | Landmark L0, 7 houses, paved core, walls rising on the back edges, 2 team flags |
| city | Full wall ring + gate + 6 towers, landmark L1, 4 district blocks, 4 team flags |
| capital | Taller towers, palace L2, 4 blocks, 6 swallow-tail team flags + 2 gate banners |

Each style has its own colour language (v2), so no two styles share the sandy base any more:

| Style | Colour language | Forms |
|---|---|---|
| Persian | White-cream plaster + turquoise + lapis + gold on orange sand | Puffy pointed domes, iwan portals, exaggerated tall wind-catchers, garden pool + cypress-poplars, striped pavilion tents |
| Central Asian | Warm fired brick + deep lapis and turquoise tile bands + dark timber + cream trim on yellow steppe | Ribbed melon domes, lapis pishtaq portals, timber aivan porches, sloped walls with tile-banded bastions and turquoise caps, Ark-style mound citadel with a cream palace, yurts |
| Chinese (quality bar) | Grey brick + white walls + red lacquer + teal glaze (gold for the capital) on green | Swooping hip roofs, siheyuan courtyards, gate towers, canvas camp tents |
| Levantine | Cool grey and white stone + terracotta pyramid roofs + sage-green domes + green shutters + rose ablaq on olive grass | Flat roofs + parapets, arcades, rooftop pergolas, square keeps with tiled caps, glacis citadel, black goat-hair tents |

Parts in the concepts: 4 styles × 12 parts = 48.

## 4. Buildings + improvements: 13 types, 22 stage pieces

| Improvement | Stages |
|---|---|
| farm | tilled → growing → harvest (haystacks) |
| silk farm | mulberry saplings → mulberry grove → grove + silkworm house (cocoon trays) |
| mine | prospect (marker, tent, ore) → mine (timbered adit, rail cart, ore, lamp) |
| quarry | marked rock → stepped cut faces + blocks + crane |
| pasture | 1 stage (fence ring, sheep, shelter) |
| caravanserai | under construction → complete (courtyard, corner towers, iwan gate, well) |
| bazaar | open stalls → covered domed bazaar + stalls |
| watchtower, fort, granary (beehive silos), waystation | 1 stage each |
| windmill | 1 stage: Persian vertical-axis windmill row |
| port | jetty + barge → stone harbour, crane, warehouse, dhow |

## 5. Wonders: 8 × 3 stages = 24

Great Gate, Grand Bazaar, Star Observatory (tiered drum, meridian sextant, armillary sphere), Bell Tower (renamed from Tower Pagoda), Lighthouse, Great Library (columned talar, scroll racks, reflecting pool), Cistern (ab anbar dome + wind-catchers), High Bridge (two-level arcaded bridge with a pavilion, on a river tile).

The build stages are generated from the finished model by `staged()` in `ck_build.py`:

| Stage | How it's made |
|---|---|
| scaffolding | Footings sliced at +0.03, a full timber scaffold, a stone/timber pile and a treadwheel crane |
| half-built | The model bisected at about 50% height, with the cut capped and scaffold over the top |
| complete | The finished model |

Every wonder gets stages for free.

## 6. Units: 13 + cargo

| Group | Units |
|---|---|
| Animals | Bactrian camel, dromedary, horse rider, yak (with tea load), ox cart |
| People | merchant, scout, guard, envoy |
| Camel trains | 1, 3 and 5 camels with a lead merchant and ropes |
| Boats | dhow (lateen sail), junk (battened sails), river barge (reed cabin + poler) |

v2 shape language (the chibi smiley look was rejected) follows tabletop wargame minis and Polytopia:
- **Bodies.** Boxes and prisms over spheres: block legs, robes that flare into broad shoulders, cube heads.
- **Faces.** No smiles or blush; a single dark eye slit is the only face detail.
- **Silhouettes.** Exaggerated for strategy scale:
  - merchant: tall turban + big pack block + staff
  - scout: tall pointed hood + cloak + bow
  - guard: tall helmet, pauldrons, very long spear, tower shield
  - envoy: very tall winged hat + team standard
  - rider: tall fur hat + lance
- **Animals.** Block bodies, tapered-prism giant humps, block necks and heads, no faces.
- **Team colour.** Every unit carries it: pennants on spears, staffs, lances, saddle poles and masts, plus shield, saddle and deck stripes. In a camel train only the lead camel flies the pennant.

- **Swappable cargo.** `load(kind)` attaches to the saddle snap point: silk bolts, spice sacks, tea bricks or crated ceramics. The same loads go on the camel, the cart bed and the yak.
- **Facing.** People turn 25° toward the camera. Animals, carts and boats turn 62° so their profile reads.

## 6b. Team colour slot

All team-coloured parts use one material named **`team`**, which a game recolours per player:
- city flags (the count grows with the stage)
- capital gate banners
- one flag per improvement
- two banners per wonder
- unit pennants and stripes
- route flags, city banners and border pieces

In code it's `team()` / `set_team(rgb)` / `tm(obj)` / `flag()` / `banner()` / `pennant()` / `tbox()` in `ck_base.py`. Board 20 shows a Persian city, a Chinese capital and a unit group in all 6 colours.

## 6c. Proportion exploration (pending a pick)

`concepts/ck_props.py` rebuilds the round-2 minis from proportion dicts. Every key is a multiplier on the round-2 baseline.

| Builders | Keys |
|---|---|
| `person_p` | head, torso_l, torso_w, shoulder, base, leg, leg_w, arm, hand, foot, hat |
| `camel_p` / `horse_p` / `yak_p` / `ox_p` | head, neck, leg, leg_w, body_l, body_d, body_w, hump, hoof |

The boards are 21 (13 people variants), 22 (10 animal variants with matching riders) and 23 (4 pairs on a hex). The live builders in `ck_units.py` are unchanged until a direction is picked; then the chosen dict becomes the default.

## 7. Trade goods: 13 resource icons

silk, spice, tea, porcelain, jade, gems, glass, paper, salt, incense, horses, coins, gold. Each sits on a round plinth with a coloured rim (the rim can encode the resource class). On tiles they use scale 2.0 at the front-right corner.

## 8. Routes

- **Dirt road and stone road.** Six edge-to-centre segments plus a hub, so any edge set makes a junction. Shown: end, straight, bend, sharp bend, fork, cross and hub. The dead end gets a signpost (dirt) or a milestone (stone).
- **Bridges:** wooden plank bridge and stone arch bridge, both on the straight river tile.
- **Player colours:** red, blue, yellow, green, purple, teal.
  - Route flags (cairn + pennant).
  - City banners (crossbar banner with a geometric lozenge emblem, no symbols).
  - Border posts.
  - Border edge strips, drawn along chosen hex edges.
- **Trade-route marker:** a dotted line of gold beads with chevrons between tile centres (`route_dots`).

## Counts (concept boards)

| Board | Cells |
|---|---|
| 01 terrain | 20 |
| 02 elevations | 60 |
| 03 map patch | 1 (17 tiles) |
| 04 decorators | 11 |
| 05 city parts | 48 |
| 06 city growth | 20 |
| 07 improvements | 22 |
| 08 wonders | 24 |
| 09 units | 25 |
| 10 goods | 19 |
| 11 routes | 29 |
| 12 forests | 8 |
| 13 ocean | 9 |
| 14 coasts | 12 |
| 15 rivers | 13 |
| 16 wild lands | 12 |
| 17 highlands + resources | 12 |
| 18 farm + oasis | 8 |
| 19 transitions | 8 |
| 20 team colours | 18 |
| 21 proportions: people | 52 |
| 22 proportions: animals | 50 |
| 23 proportions on tile | 4 |

## Open questions

- **Hex orientation.** Flat-top for now; pointy-top is still an open choice.
- **Unit bases.** Should units sit on a small round base (which could carry a team-colour rim)?
- **Bell Tower form.** It is renamed but still a tiered tower with a ring spire. Should it become a more obviously secular drum or bell tower, for example a brick base with a visible bell pavilion?
- **Team colour on cities.** Beyond flags, should it also tint wall trim or roof ridges on cities? That would read better at strategy zoom.
- **Transitions.** They are shown for 8 terrain pairs. Should the kit ship generated pieces for every neighbour pair, or a curated set?
- **Shore coverage.** Rotation covers every shore layout of the contiguous 1–5 edge pieces. Mixed non-contiguous patterns (e.g. land on edges 0, 1 and 3) currently need two pieces combined. Should those be covered too?
