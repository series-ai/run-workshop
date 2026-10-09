# RUN Voxel Packs showcase

Browse the RUN voxel packs next to Pirate Nation, see them at native scale in
one scene, and dress one avatar in parts from every pack.

Production app: https://w.run/panysaurusrex/run-voxel-packs

The expanded release has 175 models per pack and 700 models in total. Each
pack has 60 props, 24 animated props, 20 buildings, 20 terrain models,
16 creatures, and 12 vehicles. The avatar models are unchanged.

Production uses the published pack versions in `src/pins.ts`. Update each
version from the public asset manifest when a pack changes.

```bash
npm install
npm run dev                # http://localhost:5192 — local assets (tools/run-voxel-packs stage + ~/dev/jam-ready-assets)
npm run build:local        # local-preview build; `npm run preview` serves it on 4192
npm run build              # production: fails until every catalogued leaf has a pin in src/pins.ts
npm test; npm run test:e2e
npm run thumbnails -- --pack fantasy   # previews into the stage, PN lighting and yaw
```

Catalogs come from `tools/run-voxel-packs` (`npm run catalog`). Every catalog
is parsed with the shared zod schema at load; RUN models pass a load-time
contract (`src/guards/contract.ts`), and RUN rigs pass `src/guards/rig.ts`
before they rebind to the PN skeleton. PFX play by id through `@rvx-pfx`
(`tools/3d-pfx-library/src/PfxById.tsx`). `src/pfx/SocketPfx.tsx` plays a
model's bindings at their sockets, at `binding.size` and turned to
`binding.aim`; one-shots fire once per clip cycle (at `binding.at`).

Environment: `VITE_RVX_STAGE_DIR`, `VITE_JAM_ASSETS_DIR` override the local roots.
