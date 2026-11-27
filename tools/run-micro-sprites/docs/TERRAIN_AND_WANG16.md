# Authoring 8×8 Wang-16 Terrain & 2-Layer Alpha Cliffs

This guide documents the terrain architecture in `tools/run-micro-sprites/src/tileset.ts` so new biomes, cliffs, ramps, and map layouts can be authored with zero tiling seams, zero checkerboard artifacts, and clean figure-ground separation for `8×8` units.

---

## 1. Atlas Layout (`128×64` PNG = `16 cols × 8 rows` of `8×8` tiles)

| Row | Contents | Layer |
|---:|---|---|
| **0** | Base seamless fills (4 variants each): `[0..3]` dirt, `[4..7]` grass, `[8..11]` creep, `[12..15]` plateau | Layer-0 (plateau is Layer-1) |
| **1** | `[0..3]` water fills, `[4..7]` off-center sandstone moss/cracks, `[8..10]` carved stone ramps (L/C/R), `[11..13]` dirt craters, `[14..15]` wildflowers | Mixed (ramps/plateau accents = Layer-1) |
| **2** | `grass-on-dirt` Wang-16 masks `0..15` | Layer-0 |
| **3** | `creep-on-dirt` Wang-16 masks `0..15` | Layer-0 |
| **4** | `creep-on-grass` Wang-16 masks `0..15` | Layer-0 |
| **5** | `water-on-grass` Wang-16 masks `0..15` | Layer-0 |
| **6** | `plateau-cliff` **alpha-blended** Wang-16 masks `0..15` | **Layer-1 Alpha Overlay** |
| **7** | `water-on-dirt` Wang-16 masks `0..15` | Layer-0 |

---

## 2. Dual-Grid Corner Masking & Exact Edge Continuity

Every map cell `(tx, ty)` samples the 4 surrounding dual-grid corner vertices `(tx, ty)`, `(tx+1, ty)`, `(tx, ty+1)`, `(tx+1, ty+1)` into a 4-bit Wang mask:

```
NW = bit 0 (1)     NE = bit 1 (2)
SW = bit 2 (4)     SE = bit 3 (8)
```

### Why Adjacent Tiles Always Align Pixel-for-Pixel
In `wangCoverage(x, y, mask, interiorBump)`:
1. Coordinates are **vertex-aligned** on `[0, 1]`:
   ```ts
   const u = x / (TILE_PX - 1); // x=0 -> 0.0, x=7 -> 1.0
   const v = y / (TILE_PX - 1); // y=0 -> 0.0, y=7 -> 1.0
   ```
   Two adjacent tiles sharing an edge evaluate the **exact same linear interpolation** between their shared corner vertices!
2. Organic curves (`sin(πu)·sin(πv)`) and hash jitter (`rockJitter` / tuft jitter) are **strictly forced to `0` on all 4 border pixels** (`x === 0 || x === 7 || y === 0 || y === 7`). This prevents IEEE-754 residuals (`Math.sin(Math.PI) ≈ 1.22e-16`) or random noise from breaking edge continuity across compatible masks (e.g., mask `2 → 3`, `1 → 5`, `4 → 12`).
3. Every Wang transition row uses **one unified threshold ladder** across all 16 masks and samples `paintBasePixel(biome, x, y, 0)` (variant `0`) so transitions match the default base fill smoothly.

---

## 3. The 2-Layer Alpha Cliff & Ramp System

Never bake a hardcoded valley biome (like grass or dirt) underneath a cliff tile! If a cliff borders grass on the left, dirt in the center, and creep on the right, baking a single valley color causes ugly biome seams.

Instead, `composeTilemap()` renders every cell `(tx, ty)` in **two passes**:

1. **Pass 1 — Layer-0 Ground (`resolveGroundTileAtlasCoord`)**:
   - Resolves strictly ground biomes (`grass`, `dirt`, `creep`, `water`).
   - Whenever a corner vertex is `'plateau'`, it substitutes the dominant adjacent non-plateau biome (or searches downward for the nearest valley biome). Thus grass, dirt, and creep flow **uninterrupted underneath the entire plateau edge**.
2. **Pass 2 — Layer-1 Alpha Overlay (`resolveOverlayTileAtlasCoord`)**:
   - Draws plateau interior fills (`pMask === 15`), alpha-transparent cliff faces (`Row 6`, `pMask 1..14`), and carved stone ramps (`Row 1, cols 8..10`) **with alpha blending** (`blendPixel`) directly on top of Layer-0.
   - Row 6 threshold ladder:
     - `c >= 0.81`: sunlit sandstone plateau interior
     - `0.68..0.81`: bright top rim (`cliffTop`)
     - `0.57..0.68`: rim bevel shadow (`cliffDark`)
     - `0.34..0.57`: textured vertical rock face (`cliffLit` + striated `cliffDark`)
     - `0.21..0.34`: lower rock foot (`cliffDark`)
     - `0.14..0.21`: crisp base ink line (`cliffInk`)
     - `0.07..0.14`: translucent deep cast shadow (`rgba(18, 12, 28, 136)`)
     - `0.01..0.07`: translucent soft cast shadow (`rgba(18, 12, 28, 64)`)
     - `< 0.01` (and `mask === 0`): `0` (fully transparent — reveals Layer-0 ground!)

### Ramp-to-Cliff Vertex Alignment Law
A plateau cliff face appears on tile row `ty = RAMP_CLIFF_GY` when vertex row `gy <= RAMP_CLIFF_GY` is `'plateau'` and `gy >= RAMP_CLIFF_GY + 1` is valley.
- Flatten the plateau ridge mouth around each ramp (`Math.abs(gx - r.gx) <= r.halfW + 1`) to exact boundary `(RAMP_CLIFF_GY + 0.5) * TILE_PX`.
- Place ramp overlay tiles on **`ty = RAMP_CLIFF_GY` and `ty = RAMP_CLIFF_GY + 1`**.
- Use tapered alpha curbs (`cols 8 & 10`) that fade cleanly into translucent cast shadows at `y = 7` so ramps seat into any Layer-0 biome with **zero leftover cliff wall** blocking the entrance!

---

## 4. Terrain Value & Texture Discipline

- **Stay calm & mid-dark**: Keep luminance well below unit highlights so hundreds of `8×8` and `4×4` sprites remain effortless to read.
  - Grass: `#253d2b` → `#315034` → `#3d613b` → `#4e7544` (lip `#5f8c4f`)
  - Dirt: `#423029` → `#574134` → `#6b523e` → `#7c6148` → `#917456`
  - Creep: `#1d0c24` → `#2e1336` → `#401b45` → `#592857` → `#753b6b`
  - Sandstone Plateau: `#66513c` → `#876f50` → `#a38962` (cliff rim `#b59c72`)
  - Water: `#183854` → `#214e6b` → `#2f6a82` (broken naturalistic foam `#73bac7`, never a uniform dotted ring!)
- **Avoid regular grid repetition**:
  - Weight base variants unevenly (`variant 0` ~52%, `1` ~20%, `2` ~16%, `3` ~12%).
  - Place decorative motifs (sandstone moss tufts, flowers, cracks) **off-center** at staggered coordinates across variants `0..3` so large flats never form polka-dot grids.
  - Break shoreline foam (`foamBreak > 0.56`) and grass/creep transition edges with interior-only hash jitter so borders feel hand-pixelled rather than geometrically traced.

---

## 5. Step-by-Step: Adding a New Biome (e.g. `snow` or `lava`)

1. **Add biome & palette** in `src/tileset.ts`:
   - Add `'snow'` to `TileBiome` and `TILE_BIOMES`.
   - Add a calm 4-step ramp to `PAL` (for snow, keep base cool mid-grey-blue `#8ea4b8` rather than blinding `#ffffff` so pale Vanguard steel still pops!).
2. **Expand atlas rows**:
   - Bump `ATLAS_ROWS` and add a `rowIndex` entry (e.g., `snowOnDirt`, `snowOnGrass`).
   - Paint 4 base variants in `paintBasePixel('snow', x, y, variant)` + write them to a base row.
   - Paint the Wang-16 transition row(s) using `wangCoverage(x, y, mask)` with `onBorder ? 0 : jitter`.
3. **Wire Layer-0 resolution**:
   - Add the new biome priority check to `resolveGroundTileAtlasCoord()` (and update the JS terrain brush/renderer mirror in `src/cli.ts` if painting live in the showcase).
4. **Verify**:
   - Run `npm run build` and inspect `output/proof-tileset-8x8.png`: verify zero border breaks across all 16 masks, clean transparency on Layer-1 cliffs over the new biome, and clear `1×` unit contrast on the new biome.
