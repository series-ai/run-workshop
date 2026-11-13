# RUN voxel effects: style and rules

The RUN voxel packs (`tools/run-voxel-packs`) must fit next to Pirate Nation
(PN). This page gives the rules for their effects (`rvx-<pack>-<name>`). The
general craft rules are in [pfx-craft-guide.md](pfx-craft-guide.md).

## Look

PN effects are toon effects, not photo effects. Use these rules:

1. **Hard shapes.** Use the faceted shapes in `assets/run-voxel/`: puff,
   flame, ring, slash, star, streak, leaf, bubble, shard, drop, beam. Each
   shape is white, with one shadow facet at about 77%. The emitter colour
   tints it.
2. **Voxel cubes for debris.** Embers, chips, coins, rubble and motes are
   cubes (`geometry: 'cube'`).
3. **Pixel glyphs.** Runes, skulls and bats are pixel art with square pixels.
4. **One soft element.** Use the soft circle only as a halo under the shapes,
   at low alpha, with additive blend.
5. **Shapes shrink away.** Solid shapes die by size (`POP`, `SWELL`). Only
   halos and rings fade by alpha.
6. **Theme colours.** Use `theme(pack)` from `rvx/common.ts`. It gives the
   same OKLab ramps as the models (`contracts/data/themes.json`). Fire and
   neutral smoke use the shared `FIRE` and `SMOKE` colours, so fire looks the
   same in each pack.

## Units and axes

- An effect is drawn at nominal size 1. The main body is about 1 unit: the
  height of a flame, the width of a plume, the diameter of a burst.
- +Y is the aim: up for smoke and flames, along the barrel for muzzles, along
  the beam for beams.
- `PfxById` plays an RVX effect at 1 world unit. A model's PFX binding sets
  the real size (`size`, in model units) and turns +Y to `aim`.
- Smoke, flames and exhaust simulate in world space (`worldSpace: true`).
  Their particles stay where they were born, so a moving socket leaves a
  trail and smoke rises along world up.

## Timing

- **Loops** (`loop()`): every layer loops with the same period. They keep
  10 to 40 live particles.
- **One-shots** (`oneShot()`): a flash in the first 0.1 s, the main shapes to
  about 0.4 s, and the last debris gone by about 1 s. `oneShot()` refuses a
  layer that lives after the effect ends.
- The peak live particle count must be 60 or less (`rvx.test.ts`).

## Archetypes

`rvx/kit.ts` has one function for each kind of effect. Each pack file calls
them with its colours:

| Archetype | Use |
|---|---|
| `smokeColumn` | chimneys, vents, exhausts at rest |
| `fire` | torches, candles (`torch`); braziers, campfires, barrels (`hearth`) |
| `lampGlow`, `motes`, `glint` | lanterns, wisps, spores, treasure |
| `bubbles`, `mist`, `fall` | cauldrons, pools; fog, coffins; leaves |
| `orbit`, `swarm` | spires, portals, auras; bats |
| `burst`, `slam`, `waves`, `glyphs` | impacts, deaths, pickups; ground hits; sound and shields; curses |
| `muzzle`, `bolt`, `spray`, `beam`, `slash`, `exhaust` | guns; energy bolts; breath; beams; weapon swipes; moving engines |

## Bindings

A PFX binding in a pack asset (`contracts/catalog.ts`, `pfxBindingSchema`)
names an effect of the same pack and sets:

- `size`: the nominal size in model units (world assets: voxels);
- `aim` (optional): the effect's +Y in the socket frame;
- `at` (optional): seconds into the clip at which a one-shot fires.

The catalog export refuses a binding to an effect of a different pack or to
an unknown effect. Run `npm run effect-ids` here after you add or rename an
effect.

## Review

Look at each effect before you change a binding: run `npm run dev` in
`games/run-voxel-showcase`, then open the PFX tab (each effect alone) and the
Models tab (each binding on its model, with its clip).

Examine each effect. Look for a clear silhouette, the timing sentence
(anticipation, peak, dissipation), a size that fits the asset, and colours
from the pack theme.
