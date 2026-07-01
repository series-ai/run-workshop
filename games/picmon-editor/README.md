# Picmon Map Editor (standalone)

A self-contained copy of the visual world editor originally built inside
`picmon-rpg`. It's a browser-based tile-map / world editor with a Vite dev
server that reads and writes the game's data files on disk.

You can use it for other games by replacing the sample Picmon data and assets
with your own (same file format — see **Using it for your own game** below).

## What you can edit

- **NPCs** — place, edit dialogue/behavior, pick character sprites, create/delete
- **Portals** — doorways between (or within) maps, with door overlays
- **Signs** — interactable signposts
- **Object colliders** — per-object and per-folder collider boxes
- **Animals** — decorative wandering animal placements

## Play mode (demo the map)

Hit **▶ Play map** in the sidebar to drop a character onto the current map and
walk around with the real game's controls and camera:

- **Arrow keys / WASD** to move; the dead-zone follow camera matches the game.
- Collision, NPCs, animals, objects, and signs all render and block.
- Walk into a doorway to **travel through portals** to the linked map.
- **■ Stop** (top-left) returns to the editor.

Play mode reuses Picmon's actual overworld engine, so movement and camera feel
identical. Battles, wild-grass encounters, and NPC dialogue are intentionally
inert (those systems aren't part of the editor). It runs the **saved** map —
Save your edits first if you want to see them in the demo.

## Requirements

- Node 18+ and npm

## Run it

```bash
npm install
npm run dev
```

Then open the printed URL (defaults to <http://localhost:5180>). The dev server
binds the LAN too, so phones/tablets on the same network can hit
`http://<your-ip>:5180`.

> **The editor only works under `npm run dev`.** Saving relies on dev-server
> middleware (`vite.config.ts` → `editorSaveApi`) that writes files to disk.
> `npm run build` / `npm run preview` produce a static bundle with **no save
> backend** — useful for a read-only preview, not for editing.

## How the data is laid out

The editor reads/writes two trees, both rooted at the project directory:

| Path | Holds |
| --- | --- |
| `public/world/maps/<id>.json` | Sprite Fusion **tile data** (the map's painted tiles; edit in Sprite Fusion and re-export) |
| `public/world/maps/<id>.png` | Map tilesheet |
| `public/world/tilesets/…` | Object PNGs, door overlays, animated objects |
| `public/world/npcs/Character/<Name>/…` | Character spritesheets (`SpriteSheet.png/json`, `Faceset.png`) |
| `src/world/data/maps/<id>.json` | Per-map **placement config** (NPCs on the map, objects, animals, spawn) |
| `src/world/data/npcs/<id>.json` | NPC identity (name, dialogue, trainer party, …) |
| `src/world/data/portals.json` | All portals (A/B pairs) |
| `src/world/data/worldSigns.json` | All signs |

The map and NPC catalogs are assembled at build time from those `src/world/data`
folders via `import.meta.glob`, so adding/removing a JSON there is picked up on
the next dev reload.

When a Sprite Fusion export lands in `public/world/maps/<id>.json` with no
matching `src/world/data/maps/<id>.json`, the `auto-stub-maps` plugin creates a
placement-config stub for you automatically.

## Using it for your own game

This is a literal copy of the Picmon editor, so it still understands Picmon's
data model (NPC/trainer/monster catalogs, type system, sign kinds, etc.). To
repurpose it:

1. Replace the sample assets under `public/world/` with your game's tilesets,
   character sprites, and map PNGs.
2. Replace the JSON under `src/world/data/maps/` and `src/world/data/npcs/`
   (and `portals.json` / `worldSigns.json`) with your own, following the same
   shapes.
3. Adjust the Picmon-specific catalogs the UI references if your game differs:
   - `src/world/data/trainerMonCatalog.ts`
   - `src/data/typeSystem.ts`
   - `src/types/card.ts` (rarity order)
   - `src/world/data/worldSigns.ts` (sign kinds/sprites)

Anything the editor doesn't expose in its UI is merged-and-preserved on save,
so extra fields you add to the JSON survive round-trips.

## Where this came from

Extracted from `picmon-rpg/src/editor/` plus its data-model dependencies and the
editor dev-server middleware. The game-runtime, battle system, and run.game SDK
were intentionally left out — this is editor-only.
