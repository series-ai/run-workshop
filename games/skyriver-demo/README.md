# Skyriver Demo

Chase a red shuttle through a rain-slick neon megacity chasm among thousands
of free-flying cars — no roads anywhere. Built as a deterministic simulation
on the RUN engine ([RUN Syncplay](https://github.com/series-ai/venus)), rendered with
three.js, tuned for Android WebView (Galaxy S23 class).

The simulation runs as a custom deterministic runtime
(`createInstalledRuntimeAdapter` immutable-state pattern) inside the syncplay
runner at a fixed 30 Hz with per-tick checksums: the same seed and input trace
produce byte-identical checksum sequences, replays verify, and a future
networked peer would render the same flight. Ambient city and traffic are pure
seeded derivations from the same session seed — zero third-party assets.

## Run it

```bash
npm install
npm run dev        # vite dev server on http://localhost:5197
npm test           # deterministic sim suite (node, no WebGL)
npm run typecheck
npm run build
```

Preflight (same checks RUN runs before deploy):

```bash
rundot preflight --phase all
```

## Orientation & target device

Landscape. Performance targets: desktop 60 fps; Galaxy S23 WebView ≥ 45 fps
sustained across a 10-minute thermal window, with adaptive DPR and quality
tiers (traffic count, god rays) so render quality degrades before frame rate
does.

## Visual reference (README-only credit)

The visual bar is inspired by the Megacity demo (Unity GDC 2019 / Three.js
port). Skyriver is an original composition: all architecture, vehicles, and
lighting here are procedural and first-party — no assets from that demo.

## License

First-party code and all game content are original and procedural. This
sub-project ships under the repository's
[RUN Repository Supplemental License v1.0](../LICENSE.md) alongside its
platform dependencies; see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)
for three.js (MIT) and platform package notices. There are **zero third-party
binary assets** in this game.
