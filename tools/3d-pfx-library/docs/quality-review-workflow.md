# PFX Quality Review Workflow

This is the operational guide for running and resuming visual review. The
acceptance rules live in [production-pfx-standard.md](production-pfx-standard.md);
authoring and remediation guidance lives in
[pfx-craft-guide.md](pfx-craft-guide.md). This workflow packages and validates
evidence. It never awards visual scores.

## Start or resume

Run commands from `tools/3d-pfx-library`:

```bash
npm run quality:status
npm run quality:capture -- --effect fireball --batch review-001
# obtain three independent peer-review JSON files
npm run quality:assemble -- --iteration 1 --reviews review-a.json,review-b.json,review-c.json
npm test
npm run typecheck
npm run build
```

Use `npm run quality:status -- --write quality/current-status.md` after a
completed iteration. Read its first action before changing art or collecting
more evidence.

`quality:capture` accepts repeated `--effect` flags or a comma-separated list.
It starts the viewer when needed, selects deterministic onset, peak, and decay
samples, derives one honest camera distance, and captures:

- onset, peak, and decay from front, three-quarter, and side cameras;
- a peak three-quarter gameplay-context frame;
- a peak three-quarter reduced-motion frame.

The command writes eleven PNGs and a
`game-bot.r3f-pfx-visual-capture-batch.v3` manifest under
`.context/quality/<batch>/`. An existing batch is never overwritten.
Reduced-motion proof preserves the selected semantic phase. Because reduced
motion retimes the lifecycle, that proof may seek beyond the nominal standard
preview cycle; the original standard sample must still fall inside its cycle.

## Independent review

Send the captured packet to three reviewers who did not implement the change.
Do not send repository material to an external reviewer or service without
explicit authorization. Each reviewer supplies scores and blockers; the
implementation actor must not self-certify independent approval.

Each `--reviews` input may be a peer-review report plus `manifestPath`, or a
bundle containing `{ "review": ..., "manifest": ... }`. Reviewer batch IDs must
be distinct. The assembler uses the existing median consensus and preserves
either a split pass/rework verdict or a score spread greater than one point as
an adjudication blocker.

A standalone report uses this exact shape. Scores are integers from 1 through
5; `effects` is always an array, even for a one-effect batch. When
`manifestPath` is omitted, the assembler resolves
`.context/quality/<batchId>/manifest.json`.

```json
{
  "schema": "game-bot.r3f-pfx-peer-visual-review.v1",
  "batchId": "review-001",
  "peerRuntime": "independent-reviewer-a",
  "independentRuntime": true,
  "reviewedAt": "2026-07-30T03:00:00.000Z",
  "effects": [{
    "effectId": "fireball",
    "scores": {
      "SEMANTIC_IDENTITY": 4,
      "GAMEPLAY_READABILITY": 4,
      "VOLUME_AND_DEPTH": 4,
      "MULTI_ANGLE_RESILIENCE": 4,
      "SILHOUETTE_AND_COMPOSITION": 4,
      "TEMPORAL_ARC_AND_DECAY": 4,
      "MATERIAL_AND_SHADER_QUALITY": 4,
      "MESH_STRUCTURE_AND_EMITTER_QUALITY": 4,
      "CC0_ASSET_INTEGRATION": 4,
      "DISTINCTIVENESS_AND_RING_DISCIPLINE": 4,
      "SCALE_AND_VISUAL_HIERARCHY": 4,
      "OVERALL_PRODUCTION_POLISH": 4
    },
    "reviewerConfidence": 0.9,
    "grade": "B",
    "verdict": "pass",
    "findings": [],
    "reducedMotionReadable": true
  }]
}
```

Review files and manifests must point to real capture files. Reduced-motion
readability must be explicitly accepted by all three reviewers. Physical
mobile Safari and Chrome Android reports remain separate, measured inputs at
`.context/mobile-safari/<effectId>.json` and
`.context/chrome-android/<effectId>.json`; when present, assembly also requires
`.context/r3f-pfx-quality-device-registry.json`.

### Real-device evidence

Only measured physical mobile Safari and Chrome Android streams can close this
gate. Local Playwright/Chromium captures are diagnostic and must not be copied
or relabeled as device evidence.

### Reviewer disagreement

A split pass/rework verdict or a score spread greater than one point is
preserved as `evidence:peer-review-disagreement`. The only valid next action is
`adjudicate-review`; recapture or recipe edits do not erase the recorded
disagreement.
A newly disputed row may replace the prior row even when its median score would
otherwise be a regression, but only as a non-approving state: `finalPass`
remains false, the next action is `adjudicate-review`, and no convergence
decision is appended. Evidence-coverage regressions, unrelated effect
regressions, and repeated disputed plateaus still fail closed.

Adjudication uses the existing rolling consensus rather than a separate
approval schema. Capture fresh batches from the unchanged source fingerprint
and give each batch to a new output-only reviewer who has not seen source,
prior scores, or reviewer findings. Pass the original and adjudication reports
to `quality:assemble`; it deterministically uses the newest three distinct
batches by `reviewedAt` and batch ID. Collect enough fresh reports for the
newest-three window to resolve the verdict or score disagreement. Never edit
timestamps, omit a disputed report merely to force a pass, or relabel an
earlier review as fresh.
The immutable earlier iteration remains the decision history for the original
disagreement.

Run the evidence-only assembly with every original and adjudication report:

```bash
npm run quality:assemble -- \
  --iteration 7 \
  --adjudicate spawn-telegraph \
  --reviews original-a.json,original-b.json,original-c.json,adjudication-a.json,adjudication-b.json
```

`--adjudicate` is accepted only when the previous ledger required adjudication,
the render-source fingerprint is unchanged, and the newest-three consensus no
longer contains a disagreement blocker. It never appends a decision record.
An adjudicated rework result may replace the disputed row so the next recipe or
primitive action is resumable; unrelated regressions still reject assembly.

## Assembly and decisions

Assembly validates all inputs before replacing the canonical matrix. It rejects
malformed manifests, missing files, stale render-source fingerprints, fewer
than three independent reviews, invalid consensus, regressions, and plateaus.
Reviewer disagreement cannot be converted into a pass.

For a converging implementation iteration, include decision metadata:

```bash
npm run quality:assemble -- \
  --iteration 2 \
  --reviews review-a.json,review-b.json,review-c.json \
  --hypothesis "Shared depth policy restores side-view volume" \
  --defect-key visual:volumeAndDepth \
  --affected-effects fireball,explosion \
  --changed-paths src/PfxSurface.tsx,viewer/src/qualityWorkflow.test.ts \
  --result "Side-view volume reached the required floor without regression" \
  --validator "npm test -- --run viewer/src/qualityWorkflow.test.ts" \
  --craft-guide-anchor "pfx-craft-guide.md#5-shape-and-silhouette"
```

Only a converging iteration appends one row to `quality/decisions.jsonl`. The
row records the hypothesis, defect, effects, changed paths, before/after source
fingerprints, result, regression test or validator, craft-guide anchor, and
convergence verdict. Do not add a decision for failed validation, regression,
plateau, or an evidence-only status refresh. Update the craft guide only when
the lesson generalizes beyond the changed recipe family.

## Exactly one next action

Every effect receives one action:

| Action | Meaning |
| --- | --- |
| `refine-primitive` | A shared defect affects multiple effects; change the named renderer/runtime owner and add a RED test or deterministic regression validator. |
| `refine-recipe` | The defect is isolated; change `src/recipes/<effectId>.ts`. |
| `request-review` | Visual captures exist but independent review is missing or stale. |
| `request-device-evidence` | Visual acceptance passes but physical mobile Safari or Chrome Android evidence is missing. |
| `adjudicate-review` | Independent reviewers materially disagree; a reviewer must resolve it. |
| `stop` | The current row passes or no safe converging implementation action remains. |

Missing evidence is not an art defect. Do not edit a recipe to make an
evidence-only action disappear.

## Artifacts and recovery

Tracked:

- `quality/current-status.md`: compact current categories and first action;
- `quality/decisions.jsonl`: append-only converging decision history;
- this guide and the acceptance/craft documents.

Ignored under `.context/`:

- capture PNGs and v3 manifests;
- peer-review packets;
- physical-device reports and device registry;
- canonical matrix, ledger, and immutable iteration JSON.

After interruption, run `npm run quality:status`, inspect the named owner and
documentation anchor, then verify that every referenced ignored artifact still
exists. Recapture only stale effects: fingerprints are per effect, so changing
one recipe does not invalidate unrelated manifests. Never copy an old
fingerprint onto new evidence.

On regression or plateau, preserve the last passing canonical artifacts and do
not append a decision. On disagreement, choose `adjudicate-review`; do not
average away the blocker. When devices are unavailable, keep
`request-device-evidence` and hand off the exact missing platform. Production
approval remains blocked until the quality matrix and all other canonical
evidence streams pass.
