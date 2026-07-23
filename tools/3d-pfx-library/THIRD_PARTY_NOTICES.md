# Third-Party Notices — 3D PFX Library

This tool bundles third-party assets and is modeled on third-party open-source
technique. Each item below is listed with its license and attribution. All
bundled third-party assets are public-domain-dedicated (CC0 1.0); the one
code-technique credit is MIT. First-party (original, project-generated) assets
are recorded separately in the per-asset provenance files under `assets/` and
in the file headers, and are covered by the repository license.

## Kenney — Particle Pack (sprites)

- Files: sprite cells embedded (base64) in `src/particleSprites.ts`.
- Author: Kenney (kenney.nl)
- License: CC0 1.0 Universal (public domain dedication)
- Source: https://kenney.nl/assets/particle-pack

## Unity Labs Paris — real-time VFX flipbook image sequences

- Files: `FireBall01` sequence embedded (base64) in `src/fireballFlipbook.ts`;
  `SmallFlame01` sequence embedded (base64) in `src/flameFlipbook.ts`.
- Author: Unity Labs, Paris (Unity Technologies)
- License: CC0 1.0 Universal (public domain dedication)
- Provenance: recorded in each file's header comment.

## wawa-vfx (technique reference)

- Not vendored: the instanced particle renderer in `src/index.tsx` (analytic
  vertex-shader motion, burst emission) is an original implementation *modeled
  on* the approach of wawa-vfx. No wawa-vfx source is copied into this tool.
- Author: Wawa Sensei
- License: MIT
- Source: https://github.com/wass08/wawa-vfx —
  https://wawasensei.dev/blog/wawa-vfx-open-source-particle-system-for-react-three-fiber-projects

---

The CC0 dedications do not require attribution; credit is provided here as a
courtesy. First-party original assets in this tool
(`assets/runtime/muzzle-flash-atlas-v1.png`,
`assets/runtime/plasma-impact-flipbook-v1.png`, their `source/` inputs, and the
embedded muzzle-flash / plasma-impact data in `src/`) were generated for this
project — see the matching `assets/*.provenance.json` records
(`thirdPartyImages: []`, `proprietaryArt: []`).
