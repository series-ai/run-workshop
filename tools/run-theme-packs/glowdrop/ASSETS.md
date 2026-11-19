# Glowdrop Critters: asset list (concept stage)

Bioluminescent collectibles for an Animal Crossing-style catch, grow and display game. Everything is chunky, low-poly, flat-shaded and procedural (Blender, no generated meshes or textures). Glow is an emissive material on accents, with bloom in the engine.

Style rules (from review): no stuck-on faces. Eyes appear only where the animal really has them, so jellies, mushrooms, plants and corals have none. Each species gets an exaggerated, distinct silhouette. There is no glass or transparency (the game can't render it): jars glow in the colour of what's inside, and tanks and cases are open-front cutaways.

Concept boards: `concepts/renders/01-…14-*.png` (round 1 is in `concepts/v1/`, round 2 in `concepts/v2/`) (rebuild with the commands in `concepts/glow.py`).

## Growth and life stages

| Group | Stages | Species | GLBs |
|---|---|---|---|
| Mushrooms | pin → button → young → mature → spore puff | 12: lantern cap, moon disc, inkcap, puffball, coral fungus, pixie cup, jelly ear, shelf fungus (wall mount), glow morel, giant umbrella (tree-sized), fairy ring, veil cap | 60 |
| Plants | seed → sprout → bud → bloom → seed pod | 9: moonflower, glow bulb, fiddlehead fern, lantern-pod vine, glow cattail, glow lotus + lily pad, star moss, glow kelp, glow grass | 45 |
| Corals | polyp → bud → young → full → spawning | 4: finger, fan, brain, bubble | 20 |
| Jellyfish | polyp → ephyra → medusa (real life cycle) | 8: moon, comb, box, lion's mane, fried-egg, crown, upside-down, spark swarm | 24 |
| Bugs | real stages, 2–3 each | 10: firefly (larva, pupa, adult), glowworm, click beetle, glow moth (caterpillar, cocoon, adult), railroad worm, glow snail, glow millipede, cave gnat (silk threads, adult), springtail, glow cricket | 22 |

All stages of a species share one base footprint (the moss pad, sand disc or rock), so they swap in place.

## Fish and sea critters
12 species: anglerfish, lanternfish, hatchetfish, flashlight fish, glow guppy, ribbon eel, firefly squid, sea angel, glow shrimp, dumbo octopus, glow seahorse and sea pickle. Shown side-on with a ground shadow.

- **Sizes:** tiny, small, medium, large and huge are the same model scaled, so they're done at runtime.
- **Shiny:** a gold palette swap on the same mesh, as a second material set.

## Mix-and-match parts
- **Mushrooms:** 5 cap shapes (bell, dome, disc, cone, wavy) × 5 stems (slim, stout, bulb, ringed, curved) × 5 glow patterns (spots, rim, gills, whole cap, stripes) × palette.
- **Fish:** 4 bodies (round, slim, tall, long) × 4 tails (fork, fan, veil, paddle) × 5 light patterns (dots, stripe, belly, patch, spots) × 3 lures (bulb, chin, twin), on one shared body rig.

## Collecting props
- **Tools:** bug net, fishing rod with a glowing bobber, field guide, lantern.
- **Specimen jars:** empty, plus filled examples (firefly, mushroom, jelly). In the kit the jar is one piece and any collectible can be dropped inside.
- **Display:** terrarium, museum plinth, display case, and aquariums (small, medium, large).

## FX and habitat
- **FX:** ground shadows in sizes 1–6, spawn sparkle, bubbles, ripple ring.
- **Water:** glow ponds (small, medium, large), shoreline (straight, corner), tide pool.
- **Ground:** mossy log, stump, rock cluster, stalagmites, driftwood.

## Animation plan (build stage)
Swim loops, jelly pulse, firefly blink, mushroom glow-breathe, moth flutter, and a "caught!" wiggle. Load the procedural-animation skill before authoring any of these.

**Rough total:** about 275 GLBs.
