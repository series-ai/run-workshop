---
name: r3f-pfx-library
description: React Three Fiber PFX catalog, preview runtime, profiling tools, and resumable independent quality-review workflow.
tier: view
renderer: r3f
depends-on: []
---

# R3F PFX Library

This package contains 500 ranked authored-preview PFX recipes, the `GamePfx`
runtime, the searchable Vite viewer, mobile profiling models, and the
production evidence gates. Authored previews, generated rubric metadata,
dossiers, templates, and local Chromium results are not production approval.

## Agent router

Run commands from `tools/3d-pfx-library`.

1. Run `npm run quality:status`.
2. Read the first recommended action and owner path.
3. Follow `docs/quality-review-workflow.md` for capture, review import,
   assembly, recovery, and handoff.
4. Use `docs/pfx-craft-guide.md` for authoring and remediation.
5. Use `docs/production-pfx-standard.md` for normative acceptance disputes.

The supported workflow commands are:

```bash
npm run quality:status
npm run quality:capture -- --effect fireball --batch review-001
npm run quality:assemble -- --iteration 1 --reviews review-a.json,review-b.json,review-c.json
```

Use `npm run dev` for the viewer; `npm run profile`,
`npm run profile:authored`, and `npm run profile:catalog-stress` for local
Playwright profiling. Use `npm test`, `npm run typecheck`, and `npm run build`
for validation. Do not document or invoke package scripts that are absent from
`package.json`.

## Source routing

- Per-effect authored recipes: `src/recipes/<effectId>.ts`.
- Shared renderer/runtime defects: `src/PfxSurface.tsx`, `src/tooling/07.tsx`,
  or the owner named by the quality ledger.
- Public API: `src/index.ts`.
- Browser and capture harness: `viewer/`.
- Raw captures, reviews, matrices, ledgers, and device evidence: ignored
  `.context/`.
- Durable handoff: `quality/current-status.md` and
  `quality/decisions.jsonl`.

Every successful systemic fix needs a RED test or deterministic validator.
Update the craft guide only for lessons that generalize beyond one recipe
family. Independent visual reviewers must be distinct from the implementation
actor, and production-ready approval requires the canonical six evidence
streams, including a current passing quality-matrix row.
