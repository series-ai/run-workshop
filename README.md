# run-workshop
A community-centric set of game starters, tools & tutorials for building on RUN.

## Games

- [BeatBoard](games/beat-board/) — a 4×4 pad-grid music maker where each pad fires a seamless loop layer (drums / bass / melody / FX) at a fixed BPM. Ships several genre packs and a documented pack-authoring pipeline powered by the `rundot` CLI. See [Creating New Packs](games/beat-board/README.md) and [docs/authoring-packs.md](games/beat-board/docs/authoring-packs.md).

## Tools

- [Picmon Map Editor](games/picmon-editor/) — a standalone, browser-based visual tile-map / world editor (Vite + React + TypeScript). Edit NPCs, portals, signs, object colliders, and animal placements against a Sprite Fusion + JSON data model, with a live "Play map" mode. Ships with sample Picmon data and a CC0 pixel-art asset pack; repurpose it for your own game by swapping the assets and data. See [games/picmon-editor/README.md](games/picmon-editor/README.md).
- [Layout Manager](games/layout-manager/) — a browser-based image layout, composition, and AI-assisted generation tool (Vite + React + TypeScript). Arrange, align, mask, and paint over images on a freeform workspace, with optional AI helpers: text-to-image via your own provider API keys, ComfyUI workflow integration (including background removal), and multi-provider AI chat. See [games/layout-manager/README.md](games/layout-manager/README.md).
- [3D PFX Library](tools/3d-pfx-library/) — a React Three Fiber particle-effects library: a catalog of 500 ranked presets with a drop-in `GamePfx` runtime component, plus a browser to search, preview and performance-profile effects (Vite + React + TypeScript). Effects are authored-preview grade. Ships with CC0 sprite/flipbook assets. See [tools/3d-pfx-library/README.md](tools/3d-pfx-library/README.md).

## License

This repository is source-available under the [RUN Repository Supplemental License v1.0](LICENSE.md).

This is not an open source license before January 1, 2028 because it limits use to RUN projects. On January 1, 2028, the licensed portions convert to the MIT License.

This License is supplemental to the [RUN Terms](https://policy.run.world/eula.html), including the User Terms, Creator Terms, Community Standards, and Privacy Policy.

The RUN Terms continue to apply to use of the RUN Platform, RUN Studio, Service Tools, accounts, publishing systems, marketplace features, monetization, hosted services, and other RUN services.

Before January 1, 2028, You may use, modify, fork, and redistribute the Series-owned and contributor-owned portions of this repository for RUN Platform projects. Commercial use on RUN is encouraged.

Third-party materials remain under their original licenses. See `THIRD_PARTY_NOTICES.md` where applicable.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution requirements, including RUN account eligibility and DCO acceptance.