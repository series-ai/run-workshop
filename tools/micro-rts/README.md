# `micro-rts` — RUN Micro-RTS Pixel-Art Asset Kit

Zero-dependency TypeScript generator for the **RUN Micro-RTS (`micro-rts`)** asset pack: native `1×` micro-pixel-art 8-way faction units, grounded buildings, 4 planet biomes (`8×8` Wang-16 tilesets), terrain objects, neutral units, combat VFX, and RTS UI/HUD chrome.

## Quick Start

Requires Node 24+ (executes `.ts` directly with no transpile step):

```bash
cd tools/micro-rts
npm run build:all
npm run stage -- --target ~/dev/jam-ready-assets
```

Or run individual stages:

| Script | Command | Generates |
|---|---|---|
| Core kit & buildings | `npm run build` | Core sprites, 21 faction buildings × 7 states + 5 team palettes, contact proofs, showcase HTML |
| 72-unit faction roster | `npm run build:roster` | 72 8-way faction units (`V01`–`V24`, `K01`–`K24`, `S01`–`S24`), 12 two-layer split turrets/hulls, `muzzleCell8` data |
| Environment & neutrals | `npm run build:env` | 4 planet biomes (`temperate`, `tundra`, `volcanic`, `desert`), 31 terrain objects, 12 neutral 8-way units (`N01`–`N12`) |
| Combat VFX & attacks | `npm run build:vfx` | 19 VFX sprite strips + 84-unit attack mapping (`unit-attacks.json`) across 12 RTS archetypes |
| UI & HUD chrome | `npm run build:ui` | 4×4 perspective selection rings, 8 tactical cursors, 5 world markers, 12 HUD icons |
| Pack index | `npm run build:manifest` | Unified `output/micro-rts-manifest.json` indexing all sub-manifests and asset counts |

## What It Generates (`output/`)

| Output | Description |
|---|---|
| `output/micro-rts-manifest.json` | Top-level **`micro-rts`** pack manifest indexing every module manifest and verified asset count |
| `output/roster/*` & `roster-manifest.json` | **72 faction units** (`Vanguard`, `Kraxen`, `Solaris` × 24) in 8-way × 12 frames (`idle 2`, `move 4`, `attack 4`, `death 2`), **12 true 2-layer aim-split units**, synced 4-frame melee kinematics, exact `muzzleCell8` origins, and shared mineral carry overlay |
| `output/sprites/*` & `sprites/manifest.json` | **21 grounded faction buildings × 7 states** + 5 team color swaps, core `8×8` / Titan / `4×4` mega-swarm sheets, and `22×20` split-hull tank sheets |
| `output/environment/*` & `env-manifest.json` | **4 planet biome `8×8` Wang-16 tilesets** (with Layer-1 alpha cliffs, 3-frame animated hazards, 4-way ramps, H/V bridges), **31 terrain objects** (depletion resources, 3-state destructible chokes, animated objectives, flora, wreckage), and **12 neutral 8-way units** (`N01`–`N06` critters + `N07`–`N12` guardians including 2 two-layer guardians) |
| `output/vfx/*`, `vfx-manifest.json` & `unit-attacks.json` | **19 combat VFX strips** (projectiles, missiles, flames, explosions, shields, beam impacts) and complete **84-unit attack profiles** |
| `output/ui/*`, `ui-manifest.json` & `proof-ui-chrome.png` | **4×4 perspective selection rings** (`sel-sm`, `sel-md`, `sel-lg`, `sel-bldg` × `selected`/`hover`/`enemy`/`ally`), **8 cursors**, **5 order/placement markers**, and **12 HUD icons** |
| `output/proof-*.png` & `output/micro-rts-showcase.html` | Contact sheets, 1× scale readability proofs, and self-contained interactive battle showcase |

## Authoring Documentation & Agent Skill

- **Agent Skill**: [`.agents/skills/micro-rts/SKILL.md`](../../.agents/skills/micro-rts/SKILL.md) — Canonical workflow and verification gate for AI coding agents
- **Unit & 8-Way Pixel Craft Guide**: [`docs/UNITS_AND_8WAY_CRAFT.md`](docs/UNITS_AND_8WAY_CRAFT.md) — Scale tiers, outline discipline, 3D rotational cues, split-hull tanks, and anti-jitter steering
- **Terrain & Wang-16 Guide**: [`docs/TERRAIN_AND_WANG16.md`](docs/TERRAIN_AND_WANG16.md) — Edge-exact Wang coverage math, 2-layer alpha cliffs, ramp alignment, and adding biomes
