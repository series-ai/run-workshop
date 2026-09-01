# pack3d

Reusable three.js/R3F helpers for the Pirate Nation art pack.

## Copying this into another app

The folder owns every component it exports, so copying `src/pack3d/` gets you
all of it. `PackModel` has two app-bound inputs:

| Import | What to provide |
|---|---|
| `PirateNationModelEntry` and `modelAssetReference` from `../catalog` | A catalog entry with `id`, `relativePath`, and `bounds`, plus its typed model reference |
| `useAssetUrl` from `../useAssetUrl` | `(reference) => string \| null` — resolves an asset reference, `null` while pending |

The caller owns the catalog and asset-library resolver. `PackModel` maps the
entry to the typed model reference before it calls `useAssetUrl`. Replace these
two imports when using another catalog.

`modelTransform.ts` and `layout.ts` are pure and import nothing at all, so they
drop into a non-React project unchanged.

## Why it exists

Two properties of the pack make naive rendering fail:

1. **Models span about 94x in size.** The largest dimension runs from ~2 world
   units (p5) to ~185 (p95). Two models placed at native scale differ by orders
   of magnitude, so one fills the screen and the other is a dot.
2. **Most models do not sit on `y=0`.** Only 147 of 355 have `bounds.min[1] == 0`;
   209 extend below the origin, one as far as -120. Dropped into a scene at
   native transform, they float or sink.

`modelTransform` and `layoutRow` solve both from the catalogue `bounds`.
A third property — the pack nests detail shells with hair-thin offsets — means
a linear depth buffer z-fights on the voxel art. `PackCanvas` carries the
`logarithmicDepthBuffer` flag that fixes it.

## API

| Export | Purpose |
|---|---|
| `PackCanvas` | Canvas preset: logarithmic depth buffer, default light rig, dark/light backdrop |
| `PackModel` | Loads a catalogue entry, clones the shared GLTF scene, places it by bounds |
| `modelTransform(bounds, options)` | Uniform `scale` + `position` from `fit` and `anchor` |
| `layoutRow(items, { fit, gap })` | Places N models left to right on the ground plane, centred |
| `FitCamera` | Frames whatever sits under a named root |
| `ViewerErrorBoundary` | Shows a readable message when WebGL or a GLB fails |
| `STAGE_COLORS` | Background, floor and grid colours per backdrop |

### Anchors

- `base` — the scaled box rests on `at.y`, centred on x/z. Use for scenes.
- `center` — the box centre lands on `at`. Use to frame one model.
- `native` — upstream coordinates, translated by `at` only.

## Example

Three ships on one ground plane, uniformly sized:

```tsx
import { FitCamera, layoutRow, PackCanvas, PackModel } from './pack3d'

export function ShipRow({ ships }: { ships: PirateNationModelEntry[] }) {
  const row = layoutRow(
    ships.map((entry) => ({ id: entry.id, bounds: entry.bounds })),
    { fit: 4, gap: 1.2 },
  )
  return (
    <PackCanvas backdrop="dark">
      <group name="ship-row">
        {ships.map((entry, index) => (
          <PackModel
            key={entry.id}
            entry={entry}
            fit={4}
            anchor="base"
            at={[row[index]!.position[0], 0, 0]}
          />
        ))}
      </group>
      <FitCamera rootName="ship-row" fitKey={ships.map((s) => s.id).join('|')} />
    </PackCanvas>
  )
}
```

## Caveats

- `modelTransform` throws on zero-size bounds rather than returning `Infinity`.
  `characters-skins-animation-template` carries synthetic unit-cube bounds
  because it holds animation data and no meshes.
- `PackModel` clones the GLTF scene on every mount. The drei loader cache
  shares one scene graph per URL, and material edits would otherwise leak
  between viewers.
- Placement is derived from catalogue `bounds`, never from model ids. The `NxM`
  tokens in ids are gameplay footprints, not geometry: dividing bounds by them
  gives units-per-cell with a standard deviation of 11.9 on a median of 16.
