---
name: r3f-pfx-library
description: Game-ready React Three Fiber particle effects catalog with 500 ranked PFX needs, typed presets, mobile performance metadata, filters, export snippets, and a generic R3F preview/runtime component.
tier: view
renderer: r3f
depends-on: []
---

# R3F PFX Library

Typed, metadata-driven particle effects library for R3F games. It ships:

- a ranked 500-effect game PFX taxonomy;
- one preset per taxonomy entry, with all 500 ranked effects marked as `authored-preview`;
- style clusters, gameplay-use filters, space/loop filters, mobile safety, and performance tiers;
- machine-readable market source families and HTTP source URLs for every taxonomy effect;
- natural-language catalog search for developer phrases like `force field`, `fireball`, `cozy pickup sparkle`, and `mobile-safe hit impact`;
- populated low/medium/high/cinematic tier metadata, with high/cinematic entries excluded from mobile-safe filters;
- procedural thumbnail/clip descriptors for every preset;
- an all-results preview manifest export that serializes market-source traceability, thumbnail, generated SVG thumbnail asset, generated animated SVG clip asset, camera, performance, mobile-safety, and coverage metadata for every browsed effect;
- structured quality rubric scores for every preset, exported with JSON/component snippets and shown in the browser;
- typed style render profiles for every preset, with non-color runtime signatures for silhouette, material treatment, motion treatment, particle shape, geometry segment count, edge hardness, and particle size;
- JSON preset export for data-driven game integration;
- `PFX_COMPONENT_DEFINITIONS`, `PFX_COMPONENTS`, and `createGamePfxComponent(effectId, overrides)` so every catalog effect has a stable typed drop-in React component surface;
- aggregate performance summaries, recomputed control-aware preset budgets, and deterministic stress-scenario construction;
- reduced-motion fallback presets and runtime rendering support that lower density, velocity, turbulence, trail length, emissive intensity, flipbook animation, and LOD while recomputing budgets;
- `PFX_MOBILE_RUNTIME_POLICY` / `createPfxMobileRuntimePolicy()` for the shared mobile runtime contract, including capped DPR, WebGL options, tier concurrency caps, and required optimizations;
- deterministic procedural texture-atlas metadata exported with every preset, plus runtime particle maps backed by one shared atlas image with per-kind UV slice transforms;
- shared runtime caches for procedural particle textures and deterministic geometry buffers across repeated effect instances;
- authored preview render recipes for all 500 ranked effects, including per-surface phase/opacity material props, style-profile material and geometry modifiers, phase-specific motion, flipbook frame props, and profile-specific multi-surface render plans for directional bursts, radial bursts, trail ribbons, ring fields, beams, clouds, and screen overlays;
- copy-paste R3F component export snippets;
- `GamePfx`, a deterministic R3F particle preview/runtime component for catalog presets;
- a deterministic per-particle simulation (`createPfxParticleSimulation`, `updatePfxParticleSimulation`, `getPfxParticleMotionKind`, `getPfxParticleLifeAlpha`) with analytic life cycling, staggered respawn, gravity/turbulence, palette lerp with alpha-over-life vertex colors, and eight motion profiles (radial burst, cone fountain, orbit ring, column rise, cloud drift, screen fall, trail stream, impact burst);
- shared soft gradient surface textures (`getPfxSharedGradientTexture`: radial-glow, ring-glow, trail-fade, beam-fade, soft-smoke, screen-vignette) generated as DataTextures so previews, games, and jsdom tests share identical assets;
- an instanced sprite particle renderer modeled on wawa-vfx (MIT): all motion computed analytically in the vertex shader from elapsed time (`createPfxParticleEmission`, one uTime uniform update per frame), burst emission clocks for impact/burst effects, velocity-stretched spark billboards, per-particle rotation and size variance, size-over-life shaping per motion kind (`getPfxParticleShapeProfile`), and steep three-stop color ramps (`getPfxParticleColorRamp`);
- a curated CC0 sprite atlas: Kenney Particle Pack sprites plus procedural radial-glow cells (`src/particleSprites.ts`: 16 sprites — flame licks, smoke wisps, electric bolts, star sparkles, debris, slashes, clean gaussian glows — regenerate with `kits/juice/r3f-pfx-browser/scripts/build-particle-sprite-atlas.mjs`; no-arg patch mode regenerates the procedural cells without the Kenney download), with family-aware sprite selection per surface (`getPfxSpriteForSurface`);
- per-layer recipe authoring via `PfxSurfaceTuning` on `PfxRenderSurface` (sprite/motion/blend overrides, burst-cycle `delay`/`window` staggering, `countScale`/`speedScale`/`spawnScale`, extra `gravity`, exponential `drag` for leap-then-stop sparks, three-stop `size` curves, `stretch`, ramp treatments `hot`/`held`/`pinned-hot`/`dark` (dark = the value-contrast matter family: debris, heavy smoke), `spinScale`, `lifeScale`) plus burst-synced mesh animations (`meshMotion: 'flash' | 'shockwave' | 'pulse' | 'bloom' | 'break'`) that share the sprite shader's master cycle;
- dedicated GLSL mesh surfaces via `tuning.meshShader`: `'fresnel-shell'` (view-angle rim sphere for shields; pair with `meshMotion: 'break'` for a cell-by-cell shatter dissolve), `'vortex-swirl'` (polar-UV differential-rotation portal disc), and `'arc-sweep'` (burst-clocked slash crescent with a racing hot leading edge and tail erosion);| 'shockwave' | 'pulse'`) that share the sprite shader's master cycle;
- reference-derived flagship recipes (fireball, explosion, hit-spark, muzzle-flash, smoke-puff, healing-aura, shield-break, coin-pickup-sparkle, and more) documented with their external sources in `docs/reference-recipes.md`. Genre expansions (casual/puzzle, space RTS/shooter, fantasy RPG, modern shooter) with 2D-vs-3D guidance live in `docs/reference-recipes-casual-space.md` and `docs/reference-recipes-rpg-shooter.md`.

The governing art, evidence, grading, licensing, and 2022+ real-device rules
live in `docs/production-pfx-standard.md`. Reference recipes are examples; the
production standard is the acceptance contract. The redistributable craft
guide — layering, timing, blend-mode death rules, color ramps, RNG, and
verification technique with no external-source citations (safe to ship with
the CC0 set) — is `docs/pfx-craft-guide.md`.

## API

```tsx
import {
  GamePfx,
  PFX_PRESETS,
  PFX_TAXONOMY,
  createPfxPreset,
  createPfxPreviewAssetAudit,
  createPfxRuntimeOptimizationAudit,
  createPfxPreviewManifest,
  createPfxTaxonomyReviewTemplate,
  createPfxTaxonomyReviewDossier,
  createPfxProductionImplementationDossier,
  createPfxControlSafetyMatrix,
  createPfxExportCleanlinessAudit,
  createPfxStyleDifferentiationMatrix,
  createPfxStressScenario,
  createGamePfxComponent,
  exportPfxComponentSnippet,
  exportPfxPreviewManifestJson,
  exportPfxPresetJson,
  filterPfxCatalog,
  summarizePfxPerformance,
  validatePfxPreset,
  PFX_COMPONENTS,
  PFX_COMPONENT_DEFINITIONS,
} from './src'
```

## Usage

```tsx
const preset = createPfxPreset('fireball', {
  seed: 42,
  color: ['#ff7a18', '#ffd166'],
  density: 0.65,
  scale: 1.4,
})

<GamePfx preset={preset} />
```

```tsx
const ForceFieldPfx = createGamePfxComponent('force-field', {
  style: 'sci-fi',
  density: 0.5,
})

<ForceFieldPfx position={[0, 0.8, 0]} />
```

```ts
const stress = createPfxStressScenario({
  id: 'mobile-combat-20',
  query: { performanceTier: ['low'], mobileSafeOnly: true },
  concurrentEffects: 20,
})

console.log(stress.summary.totalParticles, stress.summary.overdrawRisk)
```

## Browser Kit

See `kits/juice/r3f-pfx-browser` for a searchable visual browser and customization/export tool. Plain visits boot into a paged gallery grid (9 live effects per page, labels click through to single-effect mode) for rapid catalog browsing; capture/profile URLs boot into the exact single-effect scene. The browser supports gallery, single-effect, and stress-scene preview modes, procedural thumbnails, all-500 result browsing, required catalog filters including mood/color/assets, authored/profile-backed coverage filtering, style render treatment display, selected-effect market-source provenance display, budget summaries, production-readiness gate display, factory-based R3F component export, JSON preset export, developer documentation export, preview manifest export for the current result set, `export:previews` SVG thumbnail and animated clip generation for all 500 effects, a rendered Playwright smoke script with `smoke -- --output=<file>` Definition-of-Done evidence for the four named objective searches, all 17 customization controls, and export flows, a six-scenario local Chromium profiling harness with warmed RAF samples, WebGL renderer and GPU timer-extension status capture, fail-loud threshold exits, an authored suite covering all current authored-preview effects, an empty profile-backed suite that guards against regression, a deterministic concurrent catalog-stress suite covering all 500 effects, catalog/all suite modes, `profile -- --suite authored --per-scenario-output-dir .context/mobile-safari` or `.context/chrome-android` for per-effect local profile artifact names that match approval templates, `export:capture-plan -- --base-url <real-device-preview-url>` for a 1,000-entry mobile Safari/Chrome Android real-device capture worklist with operator instructions, platform requirements, profile JSON selector, audit command, and per-capture save checklists, `export:capture-plan -- --markdown-output <file>` for a non-approving reviewer-readable real-device capture handoff, `verify:evidence` measured-evidence validation that fails on missing, duplicate, unexpected, or threshold-failing profile reports, `verify:evidence -- --runtime-policy-output <file>` for the shared mobile runtime policy with DPR cap and tier concurrency caps, `verify:evidence -- --performance-matrix-output <file>` for a per-effect local profile/stress evidence matrix with real-device gaps, `verify:evidence -- --export-cleanliness-output <file>` for a 500-effect component/JSON/docs export audit, `verify:evidence -- --preview-asset-audit-output <file>` for a 500-effect thumbnail/animated-clip audit, `verify:evidence -- --control-safety-output <file>` for a 500-effect min/default/max customization safety matrix, `verify:evidence -- --style-differentiation-output <file>` for a 500-effect non-color style differentiation matrix, `verify:evidence -- --taxonomy-template-output <file>` for the 500-effect market-review scaffold, `verify:evidence -- --taxonomy-dossier-output <file>` for the non-approving market-review dossier, `verify:evidence -- --approval-template-output <file>` for the 500-effect production approval scaffold with final evidence-slot instructions, `verify:evidence -- --implementation-template-output <file>` for the structured production implementation manifest with operator checklist and completion command, `verify:evidence -- --implementation-dossier-output <file>` for the non-approving reviewer packet that precomputes implementation facts plus per-effect review checklists, `verify:evidence -- --implementation-candidate-output <file>` for a non-approving code-prerequisite report of effects ready for implementation review, `verify:evidence -- --real-device-audit-output <file>` for strict raw mobile Safari/Chrome Android artifact coverage, `verify:evidence -- --real-device-batches <file> --real-device-batch-progress-output <file>` for a non-approving per-batch capture progress summary, `verify:evidence -- --real-device-batches <file> --real-device-batch-progress-markdown-output <file>` for the same progress as a readable resume handoff, `verify:evidence -- --red-team-template-output <file>` for the structured adversarial review manifest, `verify:evidence -- --red-team-dossier-output <file>` for the non-approving adversarial review packet with per-effect attack prompts and evidence references, `verify:evidence -- --red-team-dossier-markdown-output <file>` for a reviewer-readable Markdown companion to that adversarial packet, `verify:evidence -- --gap-audit-output <file>` for an effect-by-effect final acceptance worklist with canonical evidence paths, `verify:evidence -- --definition-of-done-smoke <file> --objective-readiness-output <file>` for the top-level goal readiness ledger with rendered smoke validation, `verify:evidence -- --definition-of-done-smoke <file> --objective-readiness-markdown-output <file>` for the same top-level readiness as a readable Definition-of-Done handoff, `verify:evidence -- --approval-readiness-output <file>` for effects whose taxonomy review, implementation, real-device, and red-team prerequisites are complete but still need final approval metadata, `verify:evidence -- --approval-readiness-markdown-output <file>` for the same approval-readiness queue as a readable final-approver handoff, `verify:evidence -- --developer-docs-output <file>` for a 500-effect developer docs manifest with markdown, component snippets, JSON presets, budgets, quality rubrics, and production caveats, `verify:evidence -- --taxonomy-review <file>` for completed market-reviewed taxonomy evidence, `verify:evidence -- --production-implementations <file>` for completed implementation evidence before final approval, `verify:evidence -- --red-team-review <file>` for completed adversarial signoff evidence before final approval, `verify:evidence -- --real-device-audit <file>` for completed real-device profile evidence before final approval, `verify:evidence -- --production-approvals <file>` for durable production implementation/device/red-team approval evidence, and `verify:evidence -- --definition-of-done-smoke <file> --acceptance-output <file> --final-acceptance` for the stricter final gate. Local Playwright profile artifacts are marked `capture.deviceClass: "local-playwright"` and do not satisfy production approval; mobile approval profile files must carry real-device capture metadata and the exact shared `PFX_MOBILE_RUNTIME_POLICY` snapshot used by the browser.

Final real-device profile credit also requires capture URL intent, single-effect scenario scope, touch capability evidence, and readback-derived overdraw evidence. Real-device capture URLs enable R3F `preserveDrawingBuffer` only for capture mode, emit `overdraw.measurementSource: "screenshot-readback"` from browser canvas pixel readback, and leave normal preview browsing on cheaper settings. Reports with `overdraw.measurementSource: "browser-estimate"` are diagnostic only and must not be cited as final mobile Safari or Chrome Android proof. Reports whose `url` does not contain exactly one matching `profileEffectIds=<effectId>` value and the expected `profilePlatform=mobile-safari|chrome-android` are rejected by the real-device audit, as are reports whose scenario is not `mode: "single"` with `effectCount: 1`, or reports without `device.maxTouchPoints > 0`, `device.pointerCoarse: true`, and `device.hoverNone: true`.

`exportPfxRealDeviceProfileCapturePlanMarkdown()` and `export:capture-plan -- --markdown-output <file>` produce a reviewer-readable companion to the real-device capture worklist. It is capture-operator guidance only; final device credit still requires raw mobile Safari and Chrome Android profile JSON files regenerated through the strict real-device audit.

`exportPfxRealDeviceCaptureBatchSheetMarkdown()` and `export:capture-plan -- --batch-sheet-output <file> --batch-id <id>` produce a one-batch checkbox sheet with exact capture URLs, output files, evidence refs, and screenshot-readback/touch checks. It is capture-operator guidance only; final device credit still requires raw mobile Safari and Chrome Android profile JSON files regenerated through the strict real-device audit.

`exportPfxRealDeviceCaptureBatchProgressMarkdown()` and `verify:evidence -- --real-device-batch-progress-markdown-output <file>` produce a readable resume handoff for incomplete real-device capture batches. It is progress guidance only; it does not satisfy real-device profile evidence or final approval.

When final-acceptance inputs are malformed or `--definition-of-done-smoke <file>` is missing, `verify:evidence -- --definition-of-done-smoke <file> --acceptance-output <file> --final-acceptance` writes `game-bot.r3f-pfx-browser-acceptance-input-error.v1` with `inputError: true`, `finalAcceptancePassed: false`, and an `input-error:` blocking finding. Treat this artifact as a failed gate that needs input repair, not as acceptance evidence.

Use `verify:evidence -- --runtime-optimization-output <file>` to emit the all-500 runtime optimization audit. It records atlas use, shared texture maps, shared geometry buffers, reduced-motion fallbacks, LOD-backed budgets, deterministic seeds, tier concurrency caps, and the linked mobile runtime policy for implementation reviewers.

Use `verify:evidence -- --definition-of-done-smoke <file> --objective-readiness-output <file>` to emit the objective-level readiness ledger. It validates the rendered Definition-of-Done smoke artifact, then maps the original research, product, performance, quality, red-team, and Definition of Done requirements to evidence artifacts and the remaining external blockers.

Use `verify:evidence -- --external-evidence-work-order-output <file>` to emit a 500-effect closure queue. Each effect row lists the taxonomy review, implementation or deferral, mobile Safari capture, Chrome Android capture, red-team review, and final approval work items with canonical output files and evidence references.

Use `verify:evidence -- --external-evidence-work-order-markdown-output <file>` to emit the same closure queue as a reviewer-readable Markdown handoff.

Use `verify:evidence -- --external-evidence-batch-plan-output <file>` to emit deterministic 25-effect batches from the current closure queue. Each batch lists rank range, open work-item counts by type, effect IDs, and canonical output files. It is a non-approving planning artifact.

Use `verify:evidence -- --external-evidence-batch-plan-markdown-output <file>` to emit the same batches as a reviewer-readable handoff.

Use `verify:evidence -- --external-evidence-batch-id external-evidence-batch-001 --external-evidence-batch-sheet-output <file>` to emit one batch sheet with per-effect checkboxes and canonical evidence references. Use `--external-evidence-batch-sheet-markdown-output <file>` for the readable companion. It is a non-approving operator checklist.

## Current Limits

The 500 entries are acceptance targets. All 500 ranked effects now have authored preview recipes; these are still preview implementations, not final art-directed production approvals. Per-preset performance data now includes populated low/medium/high/cinematic budget metadata, deterministic stress summaries, reduced-motion fallbacks, runtime texture-atlas sampling, shared runtime resource caches, warmed live browser RAF sampling, WebGL capability/timer-extension status reporting, fail-loud profile threshold exits, a Playwright/Chromium representative profile suite, a selectable authored suite covering all 500 authored-preview effects, an empty profile-backed regression suite, a concurrent catalog-stress suite covering all 500 effects in deterministic chunks, and a deterministic measured-evidence verifier that treats any `threshold.pass === false` report as failing even if the report omits failure detail strings. `createPfxExportCleanlinessAudit()` and `verify:evidence -- --export-cleanliness-output <file>` produce non-approving export evidence proving every effect has valid copy-paste component snippets, JSON presets, developer docs, and registry entries before reviewers mark `documentation-export-clean` or `drop-in-r3f-component`. `createPfxPreviewAssetAudit()` and `verify:evidence -- --preview-asset-audit-output <file>` produce non-approving preview coverage evidence proving every effect has valid SVG thumbnail and animated clip assets before reviewers mark `preview-asset-exported`. `createPfxControlSafetyMatrix()` and `verify:evidence -- --control-safety-output <file>` produce non-approving customization safety evidence proving every effect's browser-editable control surface has bounded min/default/max variants that validate before reviewers mark `all-controls-safe`. `createPfxStyleDifferentiationMatrix()` and `verify:evidence -- --style-differentiation-output <file>` produce non-approving style evidence proving every effect has distinct non-color render signatures across all 17 style clusters before red-team reviewers judge art-style fidelity. `PFX_MARKET_SOURCE_REFERENCES` plus each effect's `marketSourceFamilies` and `marketSourceUrls` provide machine-readable traceability back to the research scan. `createPfxTaxonomyReviewTemplate()` and `verify:evidence -- --taxonomy-template-output <file>` produce the machine-readable market-review worklist prefilled with those source URLs and reviewer instructions; `createPfxTaxonomyReviewDossier()` and `verify:evidence -- --taxonomy-dossier-output <file>` produce non-approving reviewer context with rank band, nearby effects, source families, source URLs, per-effect operator checklists, and per-criterion prompts. Final acceptance fails until the completed `--taxonomy-review` manifest covers exactly the accepted taxonomy without duplicate or unknown effect rows and all 500 effects have final reviewer metadata, HTTP(S) market source URLs, the exact taxonomy criteria set to `pass`, no blocker findings, and `market-reviewed` status. `createPfxProductionReadinessReport()` and `exportPfxProductionReadinessReportJson()` produce the machine-readable final-acceptance ledger; it rejects duplicate or unknown approval, implementation, and red-team review rows, can count completed implementation manifests passed with `--production-implementations`, can count completed red-team manifests passed with `--red-team-review`, and currently fails for all 500 effects until each has production implementation approval or explicit deferral, mobile Safari/Chrome Android profiling, and red-team sign-off. Per-preset quality scores are deterministic rubric metadata; `redTeamApproval` remains intentionally low until final adversarial sign-off.

`createPfxRuntimeOptimizationAudit()` and `verify:evidence -- --runtime-optimization-output <file>` produce non-approving mobile runtime optimization evidence proving every effect has atlas, shared texture, shared geometry, reduced-motion, LOD, deterministic seed, and tier-cap coverage before reviewers mark `mobile-budget-declared`. This audit verifies local runtime hooks only; it does not replace real mobile Safari or Chrome Android performance proof.

`exportPfxTaxonomyReviewDossierMarkdown()` and `verify:evidence -- --taxonomy-dossier-markdown-output <file>` produce a reviewer-readable companion to the non-approving taxonomy dossier. It is market-review guidance only; final taxonomy credit still requires a completed `game-bot.r3f-pfx-taxonomy-review.v1` manifest passed through `--taxonomy-review`.

`exportPfxProductionImplementationDossierMarkdown()` and `verify:evidence -- --implementation-dossier-markdown-output <file>` produce a reviewer-readable companion to the non-approving implementation dossier. It is implementation-review guidance only; final implementation credit still requires completed `game-bot.r3f-pfx-production-implementation.v1` rows passed through `--production-implementations`.

`createPfxObjectiveReadinessReport()` and `verify:evidence -- --definition-of-done-smoke <file> --objective-readiness-output <file>` produce a non-approving goal-level ledger tying the original PFX objective to concrete evidence files. The verifier rejects malformed rendered smoke evidence before citing local browser workflow proof, and the final-acceptance path requires the same explicit smoke artifact. It keeps local evidence separate from external evidence still required for taxonomy review, production implementation or approved deferral, real mobile Safari/Chrome Android profiling, red-team signoff, and final approval metadata.

`exportPfxObjectiveReadinessReportMarkdown()` and `verify:evidence -- --objective-readiness-markdown-output <file>` produce the same goal-level readiness ledger as a readable handoff. It is a Definition-of-Done audit aid only; any `external-evidence-required` requirement keeps the objective incomplete.

`createPfxExternalEvidenceWorkOrder()` and `verify:evidence -- --external-evidence-work-order-output <file>` produce a non-approving per-effect closure queue for the remaining external gates. When completed taxonomy, implementation, real-device, red-team, or approval inputs are passed to the verifier, credited work items are removed from the queue. Mobile Safari and Chrome Android capture work items close independently from per-platform audit validity, while final acceptance still requires both platforms. It is only an execution worklist; final acceptance still requires completed evidence manifests and approval metadata.

`exportPfxExternalEvidenceWorkOrderMarkdown()` and `verify:evidence -- --external-evidence-work-order-markdown-output <file>` produce a human-readable companion handoff for reviewers working through that queue.

`createPfxExternalEvidenceBatchPlan()` and `verify:evidence -- --external-evidence-batch-plan-output <file>` produce a non-approving 25-effect batch plan derived from the current external work order. The Markdown companion from `exportPfxExternalEvidenceBatchPlanMarkdown()` is reviewer guidance only; final acceptance still requires completed evidence manifests and approval metadata.

`createPfxExternalEvidenceBatchSheet()` and `verify:evidence -- --external-evidence-batch-id <id> --external-evidence-batch-sheet-output <file>` expand one external-evidence batch into per-effect checkboxes. `exportPfxExternalEvidenceBatchSheetMarkdown()` is an operator checklist only; final acceptance ignores the checklist and requires the completed canonical evidence streams.

`exportPfxProductionApprovalReadinessReportMarkdown()` and `verify:evidence -- --approval-readiness-markdown-output <file>` produce a readable final-approval handoff for effects whose taxonomy review, implementation, real-device, and red-team prerequisites are complete. It is only an approval queue; final acceptance still requires completed production approval metadata passed through `--production-approvals`.

Red-team signoff and final production approval must be independent from production implementation approval. A structured red-team row is not credited when its `reviewer` matches the same normalized actor as the matching implementation row's `implementedBy`; production readiness emits a blocking finding and the effect remains missing red-team signoff. A final approval row is also blocked when `approvedBy` matches either the implementation actor or red-team reviewer. Use distinct implementation, red-team reviewer, and final approver identities before moving an effect to production-ready status.

Production approval evidence references are mandatory but are not prerequisite credit by themselves. A `taxonomy-review:`, `production-implementation:`, `mobile-safari-profile:`, `chrome-android-profile:`, `red-team-signoff:`, or `approved-deferral:` string on an approval row must resolve to canonical evidence for the same effect, but production readiness credits taxonomy, implementation, real-device, and red-team prerequisites only from the completed structured streams passed through `--taxonomy-review`, `--production-implementations`, regenerated `--real-device-audit`, and `--red-team-review`. `createPfxRedTeamReviewDossier()` and `verify:evidence -- --red-team-dossier-output <file>` produce non-approving attack prompts and evidence references for the red-team reviewer; `exportPfxRedTeamReviewDossierMarkdown()` and `verify:evidence -- --red-team-dossier-markdown-output <file>` produce the human-readable companion handoff. These dossier outputs do not replace the completed `.context/r3f-pfx-red-team-review.json` signoff stream. Non-approving external work orders, batch plans, and batch sheets are also rejected when cited as final implementation, red-team, or deferral evidence. This prevents final approval metadata from self-certifying missing taxonomy review, implementation manifests, real-device captures, or adversarial review rows.

Production approval evidence files passed through `verify:evidence -- --production-approvals <file>` may be either an array of approvals or an object with an `approvals` array. `createPfxProductionApprovalTemplate()` and `verify:evidence -- --approval-template-output <file>` now emit instructions with the required implementation manifest, real-device audit, red-team review, taxonomy review, final acceptance command, production-ready evidence slot patterns, approved-deferral evidence slot patterns, and checklist. Template `TODO:` metadata must be replaced; the verifier rejects placeholder `approvedBy`, `approvedAt`, and `rationale` values, and rejects duplicate or unknown approval effect rows. A `production-ready` approval row must carry its own `taxonomy-review:`, `production-implementation:`, `mobile-safari-profile:`, `chrome-android-profile:`, and `red-team-signoff:` evidence references for the same effect; side-channel taxonomy, implementation, real-device, or red-team manifests can prove prerequisites are complete, but they do not replace the approval row's evidence list. `createPfxProductionAcceptanceGapAudit()` and `verify:evidence -- --gap-audit-output <file>` list each open effect gap with the exact canonical evidence slot and local file path still required. `createPfxProductionApprovalReadinessReport()` and `verify:evidence -- --approval-readiness-output <file>` list effects that have market-reviewed taxonomy evidence, production implementation evidence, fully captured real-device profiles, and red-team signoff, but still require final approval metadata; this report is a worklist only and does not pass final acceptance. `createPfxRealDeviceProfileCapturePlan()` and `export:capture-plan` enumerate the matching real-device capture URLs and output files for all 500 effects on both required platforms, plus an operator checklist that names `[data-profile-json="r3f-pfx-real-device"]`, the expected browser/device class, URL-intent requirements, single-effect scenario requirements, touch capability requirements, overdraw readback requirements, and the audit command to run after saving JSON. `createPfxRealDeviceCaptureBatchPlan()` and `export:capture-plan -- --batch-output <file>` group those 1,000 captures into deterministic platform-ordered batches for resumable real-device execution; the batch plan is non-approving and final evidence still comes from the raw capture JSON files. `createPfxRealDeviceCaptureBatchProgress()` and `verify:evidence -- --real-device-batches <file> --real-device-batch-progress-output <file>` summarize those batches as complete, partial, or missing from the strict audit, but remain non-approving operator progress only. Those URLs select the target effect through `profileEffectIds`, disable mobile-safe filtering for targeted captures, and expose a real-device capture panel containing the JSON payload and expected output filename. `createPfxRealDeviceCaptureAudit()` and `verify:evidence -- --real-device-audit-output <file>` scan the expected `.context/mobile-safari/<effect>.json` and `.context/chrome-android/<effect>.json` artifacts before approval assembly; a capture counts only when it matches the exact effect and platform, is a single-effect measurement, has real-device metadata, embeds the exact shared mobile runtime policy, uses a matching mobile user agent and mobile viewport, has touch-capable browser evidence, has available WebGL, passes thresholds, reports `overdraw.measurementSource: "screenshot-readback"`, and keeps the report URL bound to the same `profileEffectIds` and `profilePlatform`. `verify:evidence -- --real-device-audit <file>` treats the passed audit as an output-root hint and regenerates the audit from raw capture files before crediting device-profile gaps; forged or stale `fullyCaptured` rows in the audit JSON are not trusted. Final acceptance still requires approval metadata and the remaining evidence streams. `createPfxProductionImplementationDossier()` and `verify:evidence -- --implementation-dossier-output <file>` create a `game-bot.r3f-pfx-production-implementation-dossier.v1` packet with component anchors, authored recipe IDs, control keys, preview asset filenames, budgets, quality scores, source URLs, and per-effect operator checklists; this packet is reviewer input only and is never credited as production approval. `createPfxProductionImplementationTemplate()` and `verify:evidence -- --implementation-template-output <file>` create a structured `game-bot.r3f-pfx-production-implementation.v1` manifest with dossier/candidate pointers, a completion command, and a checklist for recording criterion-level decisions; `verify:evidence -- --production-implementations <file>` credits rows from that manifest for implementation-gap accounting only once it has no duplicate or unknown effect rows and an implementation has final implementer metadata, the exact required criteria set to `pass`, no blocker findings, and status `production-ready`. `createPfxProductionImplementationCandidateReport()` remains a non-approving prerequisite report even when every effect is ready for implementation review. `production-implementation:` approval evidence may point to the same manifest, but final acceptance still requires approval metadata, taxonomy review, real-device profiles, and red-team signoff. `createPfxRedTeamReviewTemplate()` and `verify:evidence -- --red-team-template-output <file>` create a structured `game-bot.r3f-pfx-red-team-review.v1` manifest; `verify:evidence -- --red-team-review <file>` credits rows from that manifest for signoff-gap accounting only once it has no duplicate or unknown effect rows and a review has final reviewer metadata, the exact required criteria set to `pass`, no blocker findings, and status `signed-off` or `approved-deferral`. `red-team-signoff:` and `approved-deferral:` approval evidence may point to the same manifest, but final acceptance still requires approval metadata, taxonomy review, and real-device profiles. Every local evidence reference after the first `:` must resolve to an existing file before the verifier credits the approval. `mobile-safari-profile:` and `chrome-android-profile:` references must parse as browser profile reports, cover the approved `effectId` by exact single-effect scenario id, use a mobile viewport, be a single-effect measurement, have an available WebGL context, pass profile thresholds, carry the matching mobile Safari or Chrome Android user agent, embed the exact `PFX_MOBILE_RUNTIME_POLICY` snapshot, include `capture.deviceClass: "real-device"` with `capture.platform: "mobile-safari"` or `"chrome-android"`, carry screenshot-readback overdraw evidence, preserve the exact capture URL intent, and include touch-capable browser evidence. Loose source-code or Markdown prose references do not satisfy `taxonomy-review:`, `production-implementation:`, `red-team-signoff:`, or `approved-deferral:` evidence:

```json
{
  "schema": "game-bot.r3f-pfx-production-approvals.v1",
  "approvals": [
    {
      "effectId": "force-field",
      "decision": "production-ready",
      "approvedBy": "red-team-lead",
      "approvedAt": "2026-07-03T12:00:00.000Z",
      "rationale": "Production implementation, mobile device profiles, and adversarial review all passed.",
      "evidence": [
        "production-implementation:.context/r3f-pfx-production-implementation.json#force-field",
        "mobile-safari-profile:.context/mobile-safari/force-field.json",
        "chrome-android-profile:.context/chrome-android/force-field.json",
        "red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field"
      ]
    }
  ]
}
```

## Test

```bash
npx vitest run modules/juice/r3f-pfx-library/src/R3fPfxLibrary.test.ts
```

## Install Notes

1. **Files to Copy**: `src/index.tsx` -> `src/modules/juice/r3f-pfx-library/index.tsx` and `src/particleSprites.ts` -> `src/modules/juice/r3f-pfx-library/particleSprites.ts`
2. **Imports to Add**: Import `GamePfx`, `createPfxPreset`, and selected presets in R3F scenes that need reusable PFX.
3. **Zustand Store Integration**: N/A
4. **config.json Changes**: N/A
