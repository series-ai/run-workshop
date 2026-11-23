# run-workshop
A community-centric set of game starters, tools & tutorials for building on RUN.

**RUN** is Series Entertainment's AI game & media creation and publishing platform [run.world](https://run.world). 
You build against the RUN game SDK, develop locally
in a browser sandbox, and publish to the platform with the `rundot` CLI. Each
project under `games/` is self-contained — clone once, then work inside whichever
one you want.

## Getting Started

New here? Read **[GETTING_STARTED.md](GETTING_STARTED.md)** for prerequisites,
one-time repo setup (Git LFS + hooks), CLI authentication, and how to run your
first game starter. Each sub-project then documents its own specifics in its
`README.md`.

## Games

- [BeatBoard](games/beat-board/) — a 4×4 pad-grid music maker where each pad fires a seamless loop layer (drums / bass / melody / FX) at a fixed BPM. Ships several genre packs and a documented pack-authoring pipeline powered by the `rundot` CLI. See [Creating New Packs](games/beat-board/README.md) and [docs/authoring-packs.md](games/beat-board/docs/authoring-packs.md).
- [Pirate Nation Art Showcase](games/pirate-nation-showcase/) — a browsable showcase over the MIT-licensed Pirate Nation asset pack (Proof of Play): a thumbnail grid and 3D viewer over 355 models with animation playback and a collision-geometry toggle, a full pirate Avatar Lab, plus sprite and audio browsers. See [games/pirate-nation-showcase/README.md](games/pirate-nation-showcase/README.md).
- [RUN Voxel Packs showcase](games/run-voxel-showcase/) — the four RUN voxel packs (fantasy, space, monster, post-apocalypse) next to Pirate Nation: model gallery with clips and bound effects, a mixed-pack scene at native scale, a cross-pack Avatar Lab (parts, skins, held items, any pack's clip), PFX and sprite browsers. See [games/run-voxel-showcase/README.md](games/run-voxel-showcase/README.md).
- [RUN Cubix showcase](games/voxel-character-showcase/) — interactive 3D showcase for the `run-cubix-*` orthogonal voxel characters, outfits, beasts, monsters, and context dioramas loaded from `jam-ready-assets` via the RUN SDK: Parametric Voxel Lab, Animation Reviewer, 5-Context Stage, and S23 Ultra Perf Bench. See [games/voxel-character-showcase/README.md](games/voxel-character-showcase/README.md).
- [RUN Chisel Packs Showcase](games/run-chisel-showcase/) — stylized faceted low-poly modular avatar, creature, and world-prop workshop on one shared 53-joint Quaternius UAL1 rig (89 CC0 clips) plus 7 Mesh2Motion creature rigs across Core, Medieval, WW2, Sim, Cyberpunk, and Monsters: searchable Asset Gallery, Parametric Avatar Lab, 5-Context Stage, and S23 Ultra 120 Hz Perf Bench. See [games/run-chisel-showcase/README.md](games/run-chisel-showcase/README.md).
- [Dither Playground](games/dither-playground/) — apply retro dithering algorithms and palettes to 3D scenes, images, and video. Includes a split-screen algorithm comparison grid, a static-vs-animated crawl test, and a cursor-following resolve mask. See [games/dither-playground/README.md](games/dither-playground/README.md).
- [Clubhouse Demo](games/clubhouse-demo/) — showroom for the Clubhouse Games pack: playing cards, dominoes, dice, mahjong tiles, checkers, chess, and betting chips as procedural R3F pieces (Vite + React + R3F). Includes a `rundot generate image` pipeline for authoring card backs. See [games/clubhouse-demo/README.md](games/clubhouse-demo/README.md).
- [Procedural Paintings](games/procedural-paintings/) — 21 real-time procedural WebGL Three.js painting scenes (16 pre-1910 public-domain works + 5 original style studies) built with custom GLSL shaders, impasto strokes, and SDF meshes with zero external assets. See [games/procedural-paintings/README.md](games/procedural-paintings/README.md).

## Tools

- [Picmon Map Editor](games/picmon-editor/) — a standalone, browser-based visual tile-map / world editor (Vite + React + TypeScript). Edit NPCs, portals, signs, object colliders, and animal placements against a Sprite Fusion + JSON data model, with a live "Play map" mode. Ships with sample Picmon data and a CC0 pixel-art asset pack; repurpose it for your own game by swapping the assets and data. See [games/picmon-editor/README.md](games/picmon-editor/README.md).
- [Layout Manager](games/layout-manager/) — a browser-based image layout, composition, and AI-assisted generation tool (Vite + React + TypeScript). Arrange, align, mask, and paint over images on a freeform workspace, with optional AI helpers: text-to-image via your own provider API keys, ComfyUI workflow integration (including background removal), and multi-provider AI chat. See [games/layout-manager/README.md](games/layout-manager/README.md).
- [3D PFX Library](tools/3d-pfx-library/) — a React Three Fiber particle-effects library: a catalog of 500 ranked presets with a drop-in `GamePfx` runtime component, plus a browser to search, preview and performance-profile effects (Vite + React + TypeScript). Effects are authored-preview grade. Ships with CC0 sprite/flipbook assets. See [tools/3d-pfx-library/README.md](tools/3d-pfx-library/README.md).
- [RUN Voxel Packs pipeline](tools/run-voxel-packs/) — voxel-as-code authoring for the four RUN voxel packs: headless Blender build, contract validator, avatar rig on the Pirate Nation skeleton, themed UI and icon generation, catalog export and jam-ready-assets staging. See [tools/run-voxel-packs/README.md](tools/run-voxel-packs/README.md).
- [RUN Cubix pipeline](tools/run-voxel-characters/) — voxel-as-code authoring for the six `run-cubix-*` packs (Core, Heist, Industrial, Security, Creatures, Fantasy): headless Blender build on shared UAL1/Quadruped/Arachnid/external animal rigs, contract & Squint Test visual validation, showcase catalog export, and recommended staging/PR publishing to `jam-ready-assets`. See [tools/run-voxel-characters/README.md](tools/run-voxel-characters/README.md).
- [RUN Chisel Packs pipeline](tools/run-chisel-packs/) — procedural faceted low-poly authoring for `run-chisel-*` packs: headless Blender build, `scaffold` / `snapshot` / `lineup` CLIs, rig/budget/animation-audit validation, showcase catalog export, `jam-ready-assets` staging, and pin sync. See [tools/run-chisel-packs/README.md](tools/run-chisel-packs/README.md) and [tools/run-chisel-packs/SKILL.md](tools/run-chisel-packs/SKILL.md).
- [dither-kit](tools/dither-kit/) — engine-agnostic GPU dithering core (pure TypeScript, zero runtime deps): typed config → uniforms → GLSL fragment shader with 7 algorithms, 10 retro palettes, and 18 presets, shipped as source. Extracted from Dither Playground. See [tools/dither-kit/README.md](tools/dither-kit/README.md).
- [Clubhouse Games](tools/clubhouse-games/) — a React Three Fiber tabletop asset pack: procedural playing cards, dominoes, dice, mahjong tiles, checkers, chess, and betting chips (no asset files, no third-party licenses), with flat, chunky, disc, and turned piece components. See [tools/clubhouse-games/README.md](tools/clubhouse-games/README.md).

## Expanding Asset Packs (`jam-ready-assets`)

When adding new assets or expanding packs in [tools/run-chisel-packs/](tools/run-chisel-packs/) or [tools/run-voxel-packs/](tools/run-voxel-packs/), **we recommend publishing those new/updated assets into the `jam-ready-assets` repository** rather than keeping them local to `run-workshop`:

1. Build, validate, visually verify, and render `512×512` thumbnails in the matching showcase (`games/run-chisel-showcase` or `games/run-voxel-showcase`).
2. Stage the built pack leaves, previews, `License.txt`, `.preview-sources`, and `preview.webp` into your `jam-ready-assets` checkout (`npm run stage -- --target <jam-ready-assets>`).
3. Rebuild the v2 asset manifest and run `npm test` inside `jam-ready-assets` so all leaf hashes and previews validate cleanly.
4. Sync the updated leaf versions back into the showcase's `src/pins.ts` (e.g. `npm run sync-pins -- --target <jam-ready-assets>` for Chisel packs) so pinned production builds and any RUN game using `@series-inc/rundot-game-sdk` can load the new assets.

## License

This repository is source-available under the [RUN Repository Supplemental License v1.0](LICENSE.md).

This is not an open source license before January 1, 2028 because it limits use to RUN projects. On January 1, 2028, the licensed portions convert to the MIT License.

This License is supplemental to the [RUN Terms](https://policy.run.world/eula.html), including the User Terms, Creator Terms, Community Standards, and Privacy Policy.

The RUN Terms continue to apply to use of the RUN Platform, RUN Studio, Service Tools, accounts, publishing systems, marketplace features, monetization, hosted services, and other RUN services.

Before January 1, 2028, You may use, modify, fork, and redistribute the Series-owned and contributor-owned portions of this repository for RUN Platform projects. Commercial use on RUN is encouraged.

Third-party materials remain under their original licenses. See `THIRD_PARTY_NOTICES.md` where applicable.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution requirements, including RUN account eligibility and DCO acceptance.
