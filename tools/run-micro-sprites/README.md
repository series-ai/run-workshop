# `run-micro-sprites` — Mixed-Scale Micro-RTS Sprite & Terrain Kit

Zero-dependency TypeScript generator for authentic `1×` native micro-RTS pixel art, sprite sheets, Wang-16 dual-grid terrain tilesets, contact proofs, and a self-contained interactive mobile-landscape battle showcase.

## Quick Start

Requires Node 24+ (executes `.ts` directly with no transpile step):

```bash
cd tools/run-micro-sprites
npm run build   # runs `node src/cli.ts`
```

## What It Generates (`output/`)

| Output | Description |
|---|---|
| `output/sprites/*-8x8.png` & `*-outlined-10x10.png` | 6 Infantry units × 8 rows (`N, NE, E, SE, S, SW, W, NW`) × 13 frames (`idle 2`, `move 4`, `attack 4`, `death 3`) |
| `output/sprites/*-14x12..18x16.png` & `*-outlined-*.png` | 6 Centerpiece Titans/Flyers × 8 rows (`N..NW`) × 13–14 frames |
| `output/sprites/vanguard-tank-8way-{hull,turret,shadow}.png` | `22×20` (`24×22` outlined) split-hull + independent-turret 8-way Siege Tank sheets (4 tread phases, 4 recoil/blast phases, track-hugging shadows) |
| `output/sprites/micro4-*-4x4.png` & `*-outlined-6x6.png` | Ultra-micro `4×4` infantry (3 factions) for 1,000-unit mega-swarms |
| `output/buildings/*.png` | Grounded faction bases, defensive structures, mineral patches, and terrain props |
| `output/tileset-8x8-wang16.png` | `128×64` (`16×8` tiles of `8×8`) 5-biome Wang-16 terrain atlas with Layer-1 alpha cliffs & ramps |
| `output/manifest.json` | Machine-readable metadata (sheet dimensions, frame offsets, pivots, muzzle/emitter offsets, tileset row indices) |
| `output/proof-8x8-sprites.png` | Uniform-background 8-way contact sheet (Idle + Strike A1 rows per infantry unit + buildings + `1×`/`2×` scale strip) |
| `output/proof-titans-16x16.png` | Uniform-background 8-way contact sheet (Idle + Strike A1 rows per Titan/Flyer) |
| `output/proof-tileset-8x8.png` | Full 8-row atlas proof + alpha-cliff checker + multi-biome ramp diorama |
| `output/proof-combined-arms-battle.png` | `1×` gameplay readability proof on the 5-biome battlefield |
| `output/micro-rts-showcase.html` | Self-contained interactive battle & 8-way turntable showcase with live terrain brushes |

## Authoring Documentation & Agent Skill

- **Agent Skill**: [`.agents/skills/run-micro-sprites/SKILL.md`](../../.agents/skills/run-micro-sprites/SKILL.md) — Canonical workflow and verification gate for AI coding agents
- **Unit & 8-Way Pixel Craft Guide**: [`docs/UNITS_AND_8WAY_CRAFT.md`](docs/UNITS_AND_8WAY_CRAFT.md) — Scale tiers, outline discipline, 3D rotational cues, split-hull tanks, and anti-jitter steering
- **Terrain & Wang-16 Guide**: [`docs/TERRAIN_AND_WANG16.md`](docs/TERRAIN_AND_WANG16.md) — Edge-exact Wang coverage math, 2-layer alpha cliffs, ramp alignment, and adding biomes
